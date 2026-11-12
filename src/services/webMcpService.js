let activeGameBridge = null;

// ── In-Memory Message Inbox & Subscriptions ──────────────────────────
const chatInbox = [];
const chatSubscribers = new Set();

export function enqueueChatMessage(msg) {
  const messageItem = {
    id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    sender: msg.sender || 'Coach',
    role: 'assistant',
    text: msg.message || msg.text || '',
    suggestedMoves: msg.suggestedMoves || [],
    highlightSquares: msg.highlightSquares || null,
    arrows: msg.arrows || null,
    timestamp: Date.now()
  };
  chatInbox.push(messageItem);
  if (chatInbox.length > 50) chatInbox.shift();

  chatSubscribers.forEach((fn) => {
    try {
      fn(messageItem);
    } catch {}
  });

  return messageItem;
}

export function drainChatMessages() {
  return [...chatInbox];
}

export function subscribeChatMessages(callback) {
  if (typeof callback !== 'function') return () => {};
  chatSubscribers.add(callback);
  return () => chatSubscribers.delete(callback);
}

export function setActiveGameBridge(bridge) {
  activeGameBridge = bridge;
}

export function getActiveGameBridge() {
  return activeGameBridge;
}

// ── WebMCP Tool Definitions ──────────────────────────────────────────

export const postChatMessageTool = {
  name: 'post_chat_message',
  description: 'Outputs a tactical advice or analysis message from the visiting LLM into the player\'s Coach Drawer. Can optionally suggest candidate moves and draw square tints/arrows on the live chessboard.',
  inputSchema: {
    type: 'object',
    properties: {
      message: {
        type: 'string',
        description: 'Coaching text to display in the chat drawer (Markdown supported).'
      },
      sender: {
        type: 'string',
        description: 'Name of the LLM coach or agent (defaults to "Coach").'
      },
      suggestedMoves: {
        type: 'array',
        items: { type: 'string' },
        description: 'Candidate SAN moves recommended to play (e.g. ["Nf3", "d4"]).'
      },
      highlightSquares: {
        type: 'object',
        description: 'Map of squares to CSS background colors (e.g. {"e4": "rgba(16,185,129,0.5)", "c7": "rgba(239,68,68,0.5)"}).'
      },
      arrows: {
        type: 'array',
        items: {
          type: 'array',
          items: { type: 'string' }
        },
        description: 'List of [fromSquare, toSquare, color] arrows (e.g. [["g1", "f3", "rgb(16,185,129)"]]).'
      },
      clearPrevious: {
        type: 'boolean',
        description: 'If true, clears previous square highlights and arrows before applying new ones.'
      }
    },
    required: ['message']
  },
  execute: async (params = {}) => {
    const payload = {
      message: params.message || '',
      sender: params.sender || 'Coach',
      suggestedMoves: params.suggestedMoves || [],
      highlightSquares: params.highlightSquares || null,
      arrows: params.arrows || null,
      clearPrevious: params.clearPrevious ?? false
    };

    if (activeGameBridge && typeof activeGameBridge.postChatMessage === 'function') {
      activeGameBridge.postChatMessage(payload);
    } else {
      enqueueChatMessage(payload);
    }

    return {
      status: 'success',
      message: 'Message delivered to Coach Drawer and visual highlights updated on board'
    };
  }
};

export const getGameStateTool = {
  name: 'get_game_state',
  description: 'Returns the complete state of the active chess match including FEN, active turn, move history, clocks, and game settings.',
  readOnly: true,
  inputSchema: {
    type: 'object',
    properties: {}
  },
  execute: async () => {
    if (!activeGameBridge) {
      return { status: 'error', message: 'No active game bridge available' };
    }
    return activeGameBridge.getGameState ? activeGameBridge.getGameState() : { status: 'empty' };
  }
};

export const getLegalMovesTool = {
  name: 'get_legal_moves',
  description: 'Returns all legal moves available for the current player, with capture, check, and castling flags.',
  readOnly: true,
  inputSchema: {
    type: 'object',
    properties: {
      square: {
        type: 'string',
        description: 'Optional square to filter legal moves for (e.g. "e2").'
      }
    }
  },
  execute: async (params = {}) => {
    if (!activeGameBridge) {
      return { status: 'error', message: 'No active game bridge available' };
    }
    return activeGameBridge.getLegalMoves ? activeGameBridge.getLegalMoves(params.square) : [];
  }
};

export const getPositionAnalysisTool = {
  name: 'get_position_analysis',
  description: 'Queries the Stockfish chess engine to evaluate the current board position and retrieve centipawn/mate score and engine best move.',
  readOnly: true,
  inputSchema: {
    type: 'object',
    properties: {
      depth: {
        type: 'number',
        description: 'Stockfish evaluation depth between 2 and 15 (default: 8).'
      }
    }
  },
  execute: async (params = {}) => {
    if (!activeGameBridge) {
      return { status: 'error', message: 'No active game bridge available' };
    }
    const depth = params.depth || 8;
    const raw = activeGameBridge.getPositionAnalysis ? await activeGameBridge.getPositionAnalysis(depth) : null;
    if (!raw) return null;
    if (raw.score && raw.bestMove !== undefined) return raw;

    const evalType = raw.evalData?.type || 'cp';
    const evalVal = raw.evalData?.value ?? 0;
    let formattedScore = '0.00';
    if (evalType === 'mate') {
      formattedScore = evalVal > 0 ? `M${evalVal}` : `-M${Math.abs(evalVal)}`;
    } else {
      const pawnVal = evalVal / 100;
      formattedScore = pawnVal >= 0 ? `+${pawnVal.toFixed(2)}` : pawnVal.toFixed(2);
    }

    return {
      score: {
        type: evalType,
        value: evalVal,
        formatted: formattedScore
      },
      bestMove: raw.bestMove || '',
      bestMoveSan: raw.bestMoveSan || '',
      pv: raw.pv || [],
      depth: raw.depth || depth
    };
  }
};

export const highlightBoardTool = {
  name: 'highlight_board',
  description: 'Highlights tactical threat squares and draws directional arrows directly onto the chessboard.',
  inputSchema: {
    type: 'object',
    properties: {
      highlightSquares: {
        type: 'object',
        description: 'Object mapping square notation to CSS color strings (e.g. {"f7": "rgba(239,68,68,0.5)"}).'
      },
      arrows: {
        type: 'array',
        items: {
          type: 'array',
          items: { type: 'string' }
        },
        description: 'List of [fromSquare, toSquare, color] arrows.'
      },
      clearPrevious: {
        type: 'boolean',
        description: 'If true, clears previous square highlights and arrows.'
      }
    }
  },
  execute: async (params = {}) => {
    if (!activeGameBridge || typeof activeGameBridge.highlightBoard !== 'function') {
      return { status: 'error', message: 'Highlighting not available on active bridge' };
    }
    activeGameBridge.highlightBoard({
      highlightSquares: params.highlightSquares || {},
      arrows: params.arrows || [],
      clearPrevious: params.clearPrevious ?? false
    });
    return { status: 'success' };
  }
};

export const satranjWebMcpTools = [
  postChatMessageTool,
  getGameStateTool,
  getLegalMovesTool,
  getPositionAnalysisTool,
  highlightBoardTool
];

// Provide specification aliases across Model Context API and WebMCP inspector variations
for (const tool of satranjWebMcpTools) {
  tool.parameters = tool.inputSchema;
  tool.schema = tool.inputSchema;
  tool.handler = tool.execute;
}

const targetRegisteredTools = new WeakMap();

export function getModelContextTargets() {
  const rawTargets = [];
  if (typeof document !== 'undefined' && document.modelContext?.registerTool) {
    rawTargets.push(document.modelContext);
  }
  if (typeof navigator !== 'undefined' && navigator.modelContext?.registerTool) {
    rawTargets.push(navigator.modelContext);
  }
  if (typeof window !== 'undefined' && window.modelContext?.registerTool) {
    rawTargets.push(window.modelContext);
  }
  return Array.from(new Set(rawTargets));
}

export async function registerWebMcpTool(tool) {
  const targets = getModelContextTargets();
  if (targets.length === 0) return false;

  for (const target of targets) {
    let regSet = targetRegisteredTools.get(target);
    if (!regSet) {
      regSet = new Set();
      targetRegisteredTools.set(target, regSet);
    }
    if (regSet.has(tool.name)) continue;

    try {
      const p = target.registerTool(tool);
      if (p && typeof p.catch === 'function') {
        await p.catch(() => {});
      } else {
        await p;
      }
    } catch {}
    regSet.add(tool.name);
  }
  return true;
}

export async function initWebMcp() {
  if (typeof window === 'undefined') return false;

  const patchModelContext = (ctx) => {
    if (!ctx) return;
    if (!Array.isArray(ctx.tools)) {
      ctx.tools = [];
    }
    for (const tool of satranjWebMcpTools) {
      if (!ctx.tools.some((t) => t?.name === tool.name)) {
        ctx.tools.push(tool);
      }
    }

    const origRegister = ctx.registerTool;
    ctx.registerTool = function (tool) {
      if (Array.isArray(ctx.tools) && !ctx.tools.some((t) => t?.name === tool?.name)) {
        ctx.tools.push(tool);
      }
      if (typeof origRegister === 'function' && origRegister !== ctx.registerTool) {
        try {
          const p = origRegister.call(ctx, tool);
          if (p && typeof p.catch === 'function') {
            p.catch(() => {});
          }
        } catch {}
      }
    };

    const getList = function () {
      return Array.isArray(ctx.tools) && ctx.tools.length > 0 ? ctx.tools : Array.from(satranjWebMcpTools);
    };

    ctx.listTools = getList;
    ctx.getTools = getList;
  };

  if (typeof document !== 'undefined') {
    if (!document.modelContext) document.modelContext = {};
    patchModelContext(document.modelContext);
  }
  if (typeof window !== 'undefined') {
    if (!window.modelContext) window.modelContext = document ? document.modelContext : {};
    patchModelContext(window.modelContext);
  }
  if (typeof navigator !== 'undefined') {
    if (!navigator.modelContext) navigator.modelContext = window.modelContext;
    patchModelContext(navigator.modelContext);
  }

  const targets = getModelContextTargets();
  for (const tool of satranjWebMcpTools) {
    for (const target of targets) {
      let regSet = targetRegisteredTools.get(target);
      if (!regSet) {
        regSet = new Set();
        targetRegisteredTools.set(target, regSet);
      }
      if (regSet.has(tool.name)) continue;

      try {
        const p = target.registerTool(tool);
        if (p && typeof p.catch === 'function') {
          await p.catch(() => {});
        } else {
          await p;
        }
      } catch {}
      regSet.add(tool.name);
    }
  }

  return true;
}

const WEBMCP_INIT_MAX_ATTEMPTS = 5;
const WEBMCP_INIT_RETRY_DELAY_MS = 800;

export async function ensureWebMcpInitialized() {
  for (let attempt = 1; attempt <= WEBMCP_INIT_MAX_ATTEMPTS; attempt++) {
    const ok = await initWebMcp();
    if (ok && getModelContextTargets().length > 0) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, WEBMCP_INIT_RETRY_DELAY_MS));
  }
  return false;
}

// Module-level auto-run and extension listener
if (typeof window !== 'undefined') {
  window.__webMcpTools = satranjWebMcpTools;

  window.addEventListener('modelContextReady', () => {
    initWebMcp().catch(() => {});
  });
  window.addEventListener('modelcontextready', () => {
    initWebMcp().catch(() => {});
  });

  initWebMcp().catch(() => {});
  ensureWebMcpInitialized();
}
