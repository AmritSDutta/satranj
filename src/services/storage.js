const SAVE_KEY = 'satranj_active_save';

export function saveActiveGame(gameState) {
  if (typeof window === 'undefined') return;
  if (!gameState || !gameState.fen) return;

  try {
    const payload = {
      version: 1,
      savedAt: Date.now(),
      fen: gameState.fen,
      history: gameState.history || [],
      historyFens: gameState.historyFens || [gameState.fen],
      activeMoveIndex: gameState.activeMoveIndex ?? (gameState.history ? gameState.history.length : 0),
      gameMode: gameState.gameMode || 'ai',
      userColor: gameState.userColor || 'w',
      assignedColor: gameState.assignedColor || 'w',
      aiDifficulty: gameState.aiDifficulty ?? 8,
      timePreset: gameState.timePreset || '10+0',
      boardTheme: gameState.boardTheme || 'emerald',
      isFlipped: Boolean(gameState.isFlipped),
      clocks: gameState.clocks || null,
      isPaused: true
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
  } catch (err) {
    console.warn('[Storage] Failed to save active game:', err);
  }
}

export function loadActiveGame() {
  if (typeof window === 'undefined') return null;

  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data.fen !== 'string' || !data.fen.trim()) {
      clearActiveGame();
      return null;
    }
    return data;
  } catch {
    clearActiveGame();
    return null;
  }
}

export function clearActiveGame() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(SAVE_KEY);
}
