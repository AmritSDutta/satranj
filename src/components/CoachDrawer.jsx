import React, { useState, useEffect, useRef } from 'react';
import { X, Send, Sparkles, Settings, Bot, Lightbulb, ShieldAlert, Compass, Trash2 } from 'lucide-react';
import { getItemEncrypted, setItemEncrypted } from '../utils/cryptoStorage';
import { createLlmProvider } from '../services/providers/providerFactory';
import { satranjWebMcpTools, subscribeChatMessages, drainChatMessages } from '../services/webMcpService';

const COACH_SYSTEM_PROMPT = `You are a Grandmaster Chess Coach in Satranj.
Your mission is to provide concise, friendly, and actionable tactical chess guidance.
When asked for move recommendations or position reviews, call the available tools:
- Call get_game_state() to inspect the active FEN, turn, and move history.
- Call get_position_analysis() to get Stockfish's evaluation score and best move.
- Call post_chat_message() to output your final coaching advice, suggested moves, and board highlight squares/arrows.
Always explain the tactical ideas simply and clearly. Keep explanations under 3-4 sentences.`;

export default function CoachDrawer({
  isOpen,
  onClose,
  activeGameBridge,
  onClearHighlights
}) {
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      sender: 'Grandmaster Coach',
      role: 'assistant',
      text: 'Welcome to your tactical coaching corner! Click a quick prompt below or ask me any question about your position.',
      suggestedMoves: []
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Settings
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [provider, setProvider] = useState('gemini');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('gemini-2.5-flash');
  const [endpoint, setEndpoint] = useState('');

  const messagesEndRef = useRef(null);

  // Load encrypted credentials and defaults for a specific provider
  const loadProviderConfig = async (targetProvider) => {
    const savedKey = await getItemEncrypted(`satranj_${targetProvider}_api_key`);
    setApiKey(savedKey || '');

    const savedModel = await getItemEncrypted(`satranj_${targetProvider}_model`);
    if (savedModel) {
      setModel(savedModel);
    } else {
      if (targetProvider === 'gemini') setModel('gemini-2.5-flash');
      else if (targetProvider === 'openrouter') setModel('openrouter/free');
      else if (targetProvider === 'nebius') setModel('MiniMaxAI/MiniMax-M3.1-Flash');
      else if (targetProvider === 'openai') setModel('gpt-4o-mini');
      else if (targetProvider === 'ollama') setModel('llama3.2');
    }

    const savedEndpoint = await getItemEncrypted(`satranj_${targetProvider}_endpoint`);
    if (savedEndpoint) {
      setEndpoint(savedEndpoint);
    } else {
      if (targetProvider === 'nebius') setEndpoint('https://api.tokenfactory.nebius.com/v1');
      else if (targetProvider === 'openrouter') setEndpoint('https://openrouter.ai/api/v1');
      else if (targetProvider === 'ollama') setEndpoint('http://localhost:11434');
      else setEndpoint('');
    }
  };

  // Load encrypted settings on mount or drawer open
  useEffect(() => {
    async function loadSettings() {
      const savedProvider = (await getItemEncrypted('satranj_active_provider')) || 'gemini';
      setProvider(savedProvider);
      await loadProviderConfig(savedProvider);
    }
    loadSettings();
  }, [isOpen]);

  const handleProviderChange = async (nextProvider) => {
    setProvider(nextProvider);
    await loadProviderConfig(nextProvider);
  };

  // Auto-scroll chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Subscribe to live incoming messages from WebMCP / Visiting LLMs
  useEffect(() => {
    // Sync initial drained messages if any
    const existing = drainChatMessages();
    if (existing.length > 0) {
      setMessages((prev) => {
        const prevIds = new Set(prev.map((m) => m.id));
        const newItems = existing.filter((m) => !prevIds.has(m.id));
        return newItems.length > 0 ? [...prev, ...newItems] : prev;
      });
    }

    const unsubscribe = subscribeChatMessages((payload) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === payload.id)) return prev;
        return [
          ...prev,
          {
            id: payload.id || `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            sender: payload.sender || 'Coach',
            role: 'assistant',
            text: payload.text || payload.message || '',
            suggestedMoves: payload.suggestedMoves || [],
            timestamp: payload.timestamp || Date.now()
          }
        ];
      });
    });

    return unsubscribe;
  }, []);

  const saveSettings = async () => {
    await setItemEncrypted('satranj_active_provider', provider);
    await setItemEncrypted(`satranj_${provider}_api_key`, apiKey);
    await setItemEncrypted(`satranj_${provider}_model`, model);
    if (endpoint) {
      await setItemEncrypted(`satranj_${provider}_endpoint`, endpoint);
    }
    setIsSettingsOpen(false);
  };

  const executeToolCall = async (toolCall) => {
    const tool = satranjWebMcpTools.find((t) => t.name === toolCall.name);
    if (!tool) {
      return { status: 'error', message: `Unknown tool: ${toolCall.name}` };
    }
    try {
      return await tool.execute(toolCall.args);
    } catch (err) {
      return { status: 'error', message: err.message };
    }
  };

  const handleSendMessage = async (textToSend) => {
    const query = (textToSend || inputText).trim();
    if (!query || isLoading) return;

    setInputText('');
    const userMsgId = `user_${Date.now()}`;
    const newMessages = [
      ...messages,
      { id: userMsgId, sender: 'You', role: 'user', text: query }
    ];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      const llm = createLlmProvider({
        provider,
        apiKey,
        model,
        endpoint
      });

      // Prepare conversation history
      const chatMessages = [
        { role: 'system', content: COACH_SYSTEM_PROMPT },
        ...newMessages.map((m) => {
          const msg = {
            role: m.role,
            content: m.text
          };
          if (m.reasoning_details !== undefined) {
            msg.reasoning_details = m.reasoning_details;
          }
          return msg;
        })
      ];

      // Convert WebMCP tool schemas for provider
      const toolDecls = satranjWebMcpTools.map((t) => ({
        name: t.name,
        description: t.description,
        parameters: t.inputSchema
      }));

      // Agent loop: allow up to 4 turns of tool calling
      let currentMessages = chatMessages;
      let finalContent = '';
      let suggestedMoves = [];
      let lastReasoningDetails = null;

      for (let turn = 0; turn < 4; turn++) {
        const result = await llm.chat(currentMessages, toolDecls);
        if (result.assistantMessage?.reasoning_details !== undefined) {
          lastReasoningDetails = result.assistantMessage.reasoning_details;
        }

        if (!result.toolCalls || result.toolCalls.length === 0) {
          finalContent = result.content;
          break;
        }

        currentMessages = [...currentMessages, result.assistantMessage];

        for (const tc of result.toolCalls) {
          if (tc.name === 'post_chat_message') {
            finalContent = tc.args?.message || finalContent;
            suggestedMoves = tc.args?.suggestedMoves || [];
          }
          const toolResult = await executeToolCall(tc);
          currentMessages.push({
            role: 'tool',
            content: JSON.stringify(toolResult),
            tool_call_id: tc.id,
            tool_name: tc.name
          });
        }
      }

      if (finalContent) {
        setMessages((prev) => [
          ...prev,
          {
            id: `reply_${Date.now()}`,
            sender: `${provider.toUpperCase()} Coach`,
            role: 'assistant',
            text: finalContent,
            suggestedMoves,
            ...(lastReasoningDetails !== null ? { reasoning_details: lastReasoningDetails } : {})
          }
        ]);
      }
    } catch (err) {
      const rawText = err?.message || 'Error communicating with coach';
      const cleanText = rawText.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      setMessages((prev) => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          sender: 'Coach System',
          role: 'assistant',
          text: `⚠️ ${cleanText}`
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplySuggestedMove = (moveSan) => {
    if (!activeGameBridge) return;
    const legalMoves = activeGameBridge.getLegalMoves ? activeGameBridge.getLegalMoves() : [];
    const match = legalMoves.find((m) => m.san === moveSan);
    if (match && typeof activeGameBridge.highlightBoard === 'function') {
      activeGameBridge.highlightBoard({
        highlightSquares: {
          [match.from]: 'rgba(16, 185, 129, 0.4)',
          [match.to]: 'rgba(16, 185, 129, 0.7)'
        },
        arrows: [{ startSquare: match.from, endSquare: match.to, color: 'rgb(16, 185, 129)' }],
        clearPrevious: true
      });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="coach-drawer-overlay" onClick={onClose}>
      <div className="coach-drawer" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="coach-drawer-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div className="coach-badge-icon">
              <Bot size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>AI Chess Coach</h3>
              <span className="webmcp-pill">
                <span className="webmcp-dot" /> WebMCP Active
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            {onClearHighlights && (
              <button
                className="btn-icon-subtle"
                title="Clear board highlights"
                onClick={onClearHighlights}
              >
                <Trash2 size={16} />
              </button>
            )}
            <button
              className="btn-icon-subtle"
              title="Provider Settings"
              onClick={() => setIsSettingsOpen(!isSettingsOpen)}
            >
              <Settings size={16} />
            </button>
            <button className="btn-icon-subtle" onClick={onClose}>
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Settings Popdown */}
        {isSettingsOpen && (
          <div className="coach-settings-panel">
            <h4 style={{ fontSize: '0.85rem', marginBottom: '0.5rem', textTransform: 'uppercase', color: 'var(--text-dim)' }}>
              LLM Provider Settings (Encrypted AES-256)
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Provider</label>
                <select
                  className="coach-input-field"
                  value={provider}
                  onChange={(e) => handleProviderChange(e.target.value)}
                >
                  <option value="gemini">Google Gemini (Recommended)</option>
                  <option value="openrouter">OpenRouter (Free / Multi-Model)</option>
                  <option value="nebius">Nebius Token Factory</option>
                  <option value="openai">OpenAI</option>
                  <option value="ollama">Ollama (Localhost)</option>
                </select>
              </div>

              {provider !== 'ollama' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {provider === 'nebius' ? 'Nebius Token' : `${provider.toUpperCase()} API Key`}
                    </label>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.7rem', color: apiKey ? 'var(--success)' : 'var(--text-muted)' }}>
                        {apiKey ? '● Saved' : '○ Not Set'}
                      </span>
                      {apiKey && (
                        <button
                          type="button"
                          onClick={() => setApiKey('')}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--danger)',
                            fontSize: '0.7rem',
                            cursor: 'pointer',
                            padding: 0
                          }}
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>
                  <input
                    type="password"
                    autoComplete="new-password"
                    className="coach-input-field"
                    placeholder={`Enter ${provider === 'nebius' ? 'Nebius' : provider} key`}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                  />
                </div>
              )}

              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Model Name</label>
                <input
                  type="text"
                  className="coach-input-field"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                />
              </div>

              {(provider === 'ollama' || provider === 'nebius' || provider === 'openrouter') && (
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Endpoint URL</label>
                  <input
                    type="text"
                    className="coach-input-field"
                    placeholder={
                      provider === 'nebius'
                        ? 'https://api.tokenfactory.nebius.com/v1'
                        : provider === 'openrouter'
                          ? 'https://openrouter.ai/api/v1'
                          : 'http://localhost:11434'
                    }
                    value={endpoint}
                    onChange={(e) => setEndpoint(e.target.value)}
                  />
                </div>
              )}

              <button className="btn btn-primary" style={{ marginTop: '0.25rem', padding: '0.4rem 0.8rem' }} onClick={saveSettings}>
                Save Encrypted Credentials
              </button>
            </div>
          </div>
        )}

        {/* Quick Action Chips */}
        <div className="coach-quick-actions">
          <button
            className="coach-chip"
            onClick={() => handleSendMessage('Suggest the best candidate moves and tactical ideas for my current position.')}
          >
            <Lightbulb size={13} /> Suggest Move
          </button>
          <button
            className="coach-chip"
            onClick={() => handleSendMessage('Evaluate the current position and explain who has the advantage and why.')}
          >
            <Compass size={13} /> Evaluate Position
          </button>
          <button
            className="coach-chip"
            onClick={() => handleSendMessage('Check what threats my opponent is creating and how I should defend.')}
          >
            <ShieldAlert size={13} /> Check Threats
          </button>
        </div>

        {/* Message Stream */}
        <div className="coach-messages-area">
          {messages.map((m) => (
            <div key={m.id} className={`coach-bubble ${m.role === 'user' ? 'user' : 'assistant'}`}>
              <div className="bubble-header">
                <span className="bubble-sender">{m.sender}</span>
              </div>
              <div className="bubble-body">{m.text}</div>
              {Array.isArray(m.suggestedMoves) && m.suggestedMoves.length > 0 && (
                <div className="bubble-suggestions">
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', fontWeight: 600 }}>CANDIDATES:</span>
                  {m.suggestedMoves.map((sm, i) => (
                    <button
                      key={i}
                      className="suggested-move-pill"
                      title="Preview on board"
                      onClick={() => handleApplySuggestedMove(sm)}
                    >
                      {sm}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="coach-bubble assistant loading">
              <Sparkles size={16} className="animate-spin" /> Coach is analyzing position via WebMCP...
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="coach-input-bar">
          <input
            type="text"
            className="coach-chat-input"
            placeholder="Ask your coach anything..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSendMessage();
            }}
          />
          <button
            className="btn btn-primary btn-icon"
            onClick={() => handleSendMessage()}
            disabled={!inputText.trim() || isLoading}
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
