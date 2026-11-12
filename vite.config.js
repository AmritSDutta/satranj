import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import faroUploader from '@grafana/faro-rollup-plugin';

function viteWebMcpPlugin() {
  const sseClients = new Set();
  let syncedGameState = null;

  const mcpToolDefinitions = [
    {
      name: 'post_chat_message',
      description: 'Outputs a coaching advice or tactical tip into the player Coach Drawer, with optional candidate moves and board tints/arrows.',
      inputSchema: {
        type: 'object',
        properties: {
          message: { type: 'string', description: 'Coaching text to display.' },
          sender: { type: 'string', description: 'Sender display name.' },
          suggestedMoves: { type: 'array', items: { type: 'string' }, description: 'Candidate SAN moves.' },
          highlightSquares: { type: 'object', description: 'Square highlight styles.' },
          arrows: { type: 'array', items: { type: 'array', items: { type: 'string' } }, description: 'Directional arrows.' },
          clearPrevious: { type: 'boolean', description: 'If true, clears previous square highlights and arrows.' }
        },
        required: ['message']
      }
    },
    {
      name: 'get_game_state',
      description: 'Get active board position, FEN, turn, and match configuration.',
      inputSchema: { type: 'object', properties: {} }
    },
    {
      name: 'get_legal_moves',
      description: 'Get legal moves for the active position.',
      inputSchema: {
        type: 'object',
        properties: {
          square: { type: 'string', description: 'Optional square filter (e.g. "e2").' }
        }
      }
    },
    {
      name: 'get_position_analysis',
      description: 'Queries Stockfish engine to retrieve centipawn/mate score, best move, and PV.',
      inputSchema: {
        type: 'object',
        properties: {
          depth: { type: 'number', description: 'Evaluation depth between 2 and 15 (default: 8).' }
        }
      }
    },
    {
      name: 'highlight_board',
      description: 'Draw highlights and arrows directly on the active chessboard.',
      inputSchema: {
        type: 'object',
        properties: {
          highlightSquares: { type: 'object' },
          arrows: { type: 'array', items: { type: 'array', items: { type: 'string' } } },
          clearPrevious: { type: 'boolean' }
        }
      }
    }
  ];

  return {
    name: 'vite-webmcp-bridge',
    configureServer(server) {
      server.middlewares.use('/api/mcp/sse', (req, res) => {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
          'Access-Control-Allow-Origin': '*'
        });
        res.write('event: endpoint\ndata: /api/mcp/message\n\n');
        sseClients.add(res);
        req.on('close', () => sseClients.delete(res));
      });

      // Browser dashboard state sync endpoint
      server.middlewares.use('/api/mcp/state', (req, res) => {
        if (req.method === 'OPTIONS') {
          res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
          });
          return res.end();
        }

        if (req.method === 'POST') {
          let body = '';
          req.on('data', (chunk) => {
            body += chunk;
          });
          req.on('end', () => {
            try {
              syncedGameState = JSON.parse(body);
            } catch {}
            res.writeHead(200, {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            });
            res.end(JSON.stringify({ status: 'synced' }));
          });
          return;
        }

        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        });
        res.end(JSON.stringify(syncedGameState || { status: 'empty' }));
      });

      // Secure local proxy for AI providers (mirrored from excalidraw_experiment)
      server.middlewares.use('/api/proxy', async (req, res) => {
        if (req.method === 'OPTIONS') {
          res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
          });
          return res.end();
        }

        if (req.method === 'POST') {
          let bodyStr = '';
          req.on('data', (chunk) => {
            bodyStr += chunk;
          });
          req.on('end', async () => {
            try {
              const { targetUrl, body, headers, method: reqMethod } = JSON.parse(bodyStr);
              let parsed;
              try {
                parsed = new URL(targetUrl);
              } catch {
                parsed = null;
              }

              const allowedHosts = [
                'generativelanguage.googleapis.com',
                'api.openai.com',
                'openai.com',
                'ollama.com',
                'api.mistral.ai',
                'router.requesty.ai',
                'api.tokenfactory.nebius.com'
              ];

              const parsedHost = parsed ? parsed.hostname.toLowerCase() : '';
              const isLocal = parsedHost === 'localhost' || parsedHost === '127.0.0.1';
              const protocolAllowed = isLocal
                ? (parsed?.protocol === 'https:' || parsed?.protocol === 'http:')
                : parsed?.protocol === 'https:';

              const hostAllowed =
                allowedHosts.includes(parsedHost) ||
                allowedHosts.some((h) => parsedHost.endsWith('.' + h)) ||
                isLocal;

              const allowed = !!parsed && protocolAllowed && hostAllowed;

              if (!allowed) {
                res.writeHead(403, {
                  'Content-Type': 'application/json',
                  'Access-Control-Allow-Origin': '*'
                });
                return res.end(
                  JSON.stringify({
                    error: `Blocked: target host "${parsedHost}" is not on the proxy allow-list`
                  })
                );
              }

              const forwardHeaders = {
                'Content-Type': 'application/json'
              };
              if (headers && typeof headers.Authorization === 'string' && headers.Authorization) {
                forwardHeaders.Authorization = headers.Authorization;
              }

              const method = typeof reqMethod === 'string' && reqMethod ? reqMethod.toUpperCase() : 'POST';
              const fetchOptions = {
                method,
                headers: forwardHeaders
              };
              if (method !== 'GET' && method !== 'HEAD' && body !== undefined) {
                fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
              }

              const response = await fetch(targetUrl, fetchOptions);
              const data = await response.text();
              res.writeHead(response.status, {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
              });
              res.end(data);
            } catch (e) {
              res.writeHead(500, {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
              });
              res.end(JSON.stringify({ error: e?.message || 'Local proxy failed' }));
            }
          });
        } else {
          res.writeHead(204, { 'Access-Control-Allow-Origin': '*' });
          res.end();
        }
      });

      server.middlewares.use('/api/mcp/message', (req, res) => {
        if (req.method === 'OPTIONS') {
          res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
          });
          return res.end();
        }

        if (req.method === 'POST') {
          let body = '';
          req.on('data', (chunk) => {
            body += chunk;
          });
          req.on('end', () => {
            let json = {};
            try {
              json = JSON.parse(body);
            } catch {
              json = {};
            }

            res.writeHead(200, {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            });

            if (json.method === 'tools/list') {
              res.end(
                JSON.stringify({
                  jsonrpc: '2.0',
                  id: json.id,
                  result: {
                    tools: mcpToolDefinitions
                  }
                })
              );
            } else if (json.method === 'tools/call') {
              const name = json.params?.name;
              const args = json.params?.arguments || {};

              if (name === 'post_chat_message') {
                const payloadStr = JSON.stringify(args);
                sseClients.forEach((client) => {
                  try {
                    client.write(`event: chat_message\ndata: ${payloadStr}\n\n`);
                  } catch {}
                });

                res.end(
                  JSON.stringify({
                    jsonrpc: '2.0',
                    id: json.id,
                    result: {
                      content: [
                        {
                          type: 'text',
                          text: `Message delivered to Coach Drawer${args.suggestedMoves?.length ? ` with suggested moves: ${args.suggestedMoves.join(', ')}` : ''}`
                        }
                      ]
                    }
                  })
                );
              } else if (name === 'highlight_board') {
                const payloadStr = JSON.stringify(args);
                sseClients.forEach((client) => {
                  try {
                    client.write(`event: highlight_board\ndata: ${payloadStr}\n\n`);
                  } catch {}
                });

                res.end(
                  JSON.stringify({
                    jsonrpc: '2.0',
                    id: json.id,
                    result: {
                      content: [
                        {
                          type: 'text',
                          text: 'Visual board highlights and arrows dispatched'
                        }
                      ]
                    }
                  })
                );
              } else if (name === 'get_game_state') {
                res.end(
                  JSON.stringify({
                    jsonrpc: '2.0',
                    id: json.id,
                    result: {
                      content: [
                        {
                          type: 'text',
                          text: JSON.stringify(syncedGameState || { status: 'no_active_game' }, null, 2)
                        }
                      ]
                    }
                  })
                );
              } else if (name === 'get_legal_moves') {
                res.end(
                  JSON.stringify({
                    jsonrpc: '2.0',
                    id: json.id,
                    result: {
                      content: [
                        {
                          type: 'text',
                          text: JSON.stringify(syncedGameState?.legalMoves || [], null, 2)
                        }
                      ]
                    }
                  })
                );
              } else if (name === 'get_position_analysis') {
                res.end(
                  JSON.stringify({
                    jsonrpc: '2.0',
                    id: json.id,
                    result: {
                      content: [
                        {
                          type: 'text',
                          text: JSON.stringify(
                            syncedGameState?.evaluation || {
                              score: { type: 'cp', value: 0, formatted: '0.00' },
                              bestMove: '',
                              pv: []
                            },
                            null,
                            2
                          )
                        }
                      ]
                    }
                  })
                );
              } else {
                res.end(
                  JSON.stringify({
                    jsonrpc: '2.0',
                    id: json.id,
                    error: {
                      code: -32601,
                      message: `Unknown tool: ${name}`
                    }
                  })
                );
              }
            } else if (json.method === 'initialize') {
              res.end(
                JSON.stringify({
                  jsonrpc: '2.0',
                  id: json.id,
                  result: {
                    protocolVersion: '2024-11-05',
                    capabilities: { tools: {} },
                    serverInfo: { name: 'satranj-mcp', version: '1.0.0' }
                  }
                })
              );
            } else if (json.method === 'ping') {
              res.end(JSON.stringify({ jsonrpc: '2.0', id: json.id, result: {} }));
            } else {
              res.end(
                JSON.stringify({
                  jsonrpc: '2.0',
                  id: json.id,
                  result: { status: 'acknowledged', received: json.method }
                })
              );
            }
          });
        }
      });
    }
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    viteWebMcpPlugin(),
    faroUploader({
      appName: 'satranj.amritai.org',
      endpoint: 'https://faro-api-prod-ap-south-1.grafana.net/faro/api/v1',
      appId: '1960',
      stackId: '1619876',
      verbose: true,
      // Retrieve the API key from environment variables to avoid committing secrets
      apiKey: process.env.FARO_API_KEY || '$your-api-key',
      gzipContents: true,
    })
  ],
  server: {
    host: true,
  }
})

