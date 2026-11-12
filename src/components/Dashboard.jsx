import React, { useState, useEffect, useRef } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { Play, RotateCcw, Award, ArrowLeftRight, Info, Volume2, VolumeX, Eye, Cpu, Users, LogOut, Pause, Sun, Moon, X, Bot, Sparkles } from 'lucide-react';

import { StockfishService } from '../services/stockfish';
import { audioService } from '../services/audio';

import EvaluationBar from './EvaluationBar';
import ChessClock from './ChessClock';
import MoveHistory from './MoveHistory';
import CapturedPieces from './CapturedPieces';
import AboutModal from './AboutModal';
import GameAnalysisModal from './GameAnalysisModal';
import CoachDrawer from './CoachDrawer';
import { initWebMcp, ensureWebMcpInitialized, setActiveGameBridge, enqueueChatMessage } from '../services/webMcpService';
import { saveActiveGame, loadActiveGame, clearActiveGame } from '../services/storage';

// Board Theme Colors mapping
const boardThemes = {
  emerald: {
    light: '#eeeed2',
    dark: '#769656',
    name: 'Emerald Green'
  },
  wood: {
    light: '#f0d9b5',
    dark: '#b58863',
    name: 'Classic Wood'
  },
  carbon: {
    light: '#71717a',
    dark: '#27272a',
    name: 'Carbon Fiber'
  },
  midnight: {
    light: '#38bdf8',
    dark: '#0f172a',
    name: 'Midnight Neon'
  }
};

export default function Dashboard() {
  // Game state
  const [game, setGame] = useState(() => new Chess());
  const [fen, setFen] = useState(() => game.fen());
  const [history, setHistory] = useState([]);
  
  // Custom board state to support move browsing
  const [historyFens, setHistoryFens] = useState([game.fen()]);
  const [activeMoveIndex, setActiveMoveIndex] = useState(0); // 0 is initial FEN
  
  // Setup screen states
  const [gameStarted, setGameStarted] = useState(false);
  const [userColor, setUserColor] = useState('w'); // 'w' | 'b' | 'random'
  const [assignedColor, setAssignedColor] = useState('w'); // 'w' | 'b'
  
  // Game settings and visual state
  const [gameMode, setGameMode] = useState('ai'); // 'pvp' or 'ai'
  const [aiDifficulty, setAiDifficulty] = useState(8); // Depth (1-15)
  const [timePreset, setTimePreset] = useState('10+0');
  const [boardTheme, setBoardTheme] = useState('emerald');
  const [isFlipped, setIsFlipped] = useState(false);
  const [evaluation, setEvaluation] = useState(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [resetTrigger, setResetTrigger] = useState(0);
  
  // Game Over state
  const [isGameOver, setIsGameOver] = useState(false);
  const [gameOverReason, setGameOverReason] = useState('');
  const [winner, setWinner] = useState(''); // 'w', 'b', or 'draw'
  const [showGameOverModal, setShowGameOverModal] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  // Analysis states
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisData, setAnalysisData] = useState(null);
  const [showAnalysisModal, setShowAnalysisModal] = useState(false);

  // Modals
  const [isAboutOpen, setIsAboutOpen] = useState(false);

  // WebMCP and Coach Drawer states
  const [isCoachOpen, setIsCoachOpen] = useState(false);
  const [customSquareStyles, setCustomSquareStyles] = useState({});
  const [customArrows, setCustomArrows] = useState([]);
  const [clockTimes, setClockTimes] = useState(null);
  const clockTimesRef = useRef(null);
  const [savedGame, setSavedGame] = useState(() => loadActiveGame());
  const activeGameBridgeRef = useRef(null);
  const makeAIMoveRef = useRef(null);

  // Theme mode (Light / Dark)
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('satranj-theme') || 'dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('satranj-theme', newTheme);
  };

  const handleCloseTab = () => {
    // Terminate Stockfish Web Worker
    if (stockfishRef.current) {
      stockfishRef.current.terminate();
    }
    
    // Close Web Audio Context
    audioService.close();

    // Close the browser window
    window.close();

    // Fallback: If blocked by browser policies, redirect to empty blank page
    setTimeout(() => {
      window.location.href = 'about:blank';
    }, 100);
  };



  // Stockfish service reference
  const stockfishRef = useRef(null);

  // Initialize Stockfish Web Worker
  useEffect(() => {
    stockfishRef.current = new StockfishService();
    stockfishRef.current.init();

    return () => {
      if (stockfishRef.current) {
        stockfishRef.current.terminate();
      }
    };
  }, []);

  // Initialize WebMCP on mount with retry guarantee
  useEffect(() => {
    initWebMcp();
    ensureWebMcpInitialized();
  }, []);

  // Synchronize ActiveGameBridge with WebMCP
  useEffect(() => {
    const bridge = {
      getGameState: () => ({
        fen: game.fen(),
        turn: game.turn(),
        turnName: game.turn() === 'w' ? 'White' : 'Black',
        history: history.map((h) => (typeof h === 'string' ? h : h.san)),
        moveCount: history.length,
        isGameOver: game.isGameOver() || isGameOver,
        inCheck: game.inCheck(),
        gameMode,
        aiDifficulty,
        timePreset,
        clocks: clockTimesRef.current,
        assignedColor
      }),
      getLegalMoves: (square) => {
        try {
          return game.moves({ verbose: true, square });
        } catch {
          return [];
        }
      },
      getPositionAnalysis: async (depth = 8) => {
        if (!stockfishRef.current) return null;
        try {
          const raw = await stockfishRef.current.evaluatePositionPromise(game.fen(), depth);
          if (!raw) return null;

          let bestMoveSan = '';
          if (raw.bestMove) {
            try {
              const tempGame = new Chess(game.fen());
              const from = raw.bestMove.substring(0, 2);
              const to = raw.bestMove.substring(2, 4);
              const promotion = raw.bestMove.length === 5 ? raw.bestMove[4] : undefined;
              const mv = tempGame.move({ from, to, promotion });
              if (mv) bestMoveSan = mv.san;
            } catch {}
          }

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
            bestMoveSan,
            pv: raw.pv || [],
            depth: raw.depth || depth
          };
        } catch (e) {
          return { error: e.message };
        }
      },
      postChatMessage: (payload) => {
        enqueueChatMessage(payload);
        if (payload.highlightSquares || payload.arrows) {
          if (payload.clearPrevious) {
            setCustomSquareStyles(payload.highlightSquares || {});
            setCustomArrows(payload.arrows || []);
          } else {
            setCustomSquareStyles((prev) => ({ ...prev, ...(payload.highlightSquares || {}) }));
            setCustomArrows((prev) => [...prev, ...(payload.arrows || [])]);
          }
        }
      },
      highlightBoard: ({ highlightSquares, arrows, clearPrevious }) => {
        if (clearPrevious) {
          setCustomSquareStyles(highlightSquares || {});
          setCustomArrows(arrows || []);
        } else {
          setCustomSquareStyles((prev) => ({ ...prev, ...(highlightSquares || {}) }));
          setCustomArrows((prev) => [...prev, ...(arrows || [])]);
        }
      }
    };

    activeGameBridgeRef.current = bridge;
    setActiveGameBridge(bridge);
  }, [game, fen, history, isGameOver, gameMode, aiDifficulty, timePreset, assignedColor]);

  // Dev SSE bridge connection & state sync
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    let es;
    try {
      es = new EventSource('/api/mcp/sse');
      es.addEventListener('chat_message', (evt) => {
        try {
          const data = JSON.parse(evt.data);
          activeGameBridgeRef.current?.postChatMessage?.(data);
        } catch {}
      });
      es.addEventListener('highlight_board', (evt) => {
        try {
          const data = JSON.parse(evt.data);
          activeGameBridgeRef.current?.highlightBoard?.(data);
        } catch {}
      });
    } catch {}

    return () => {
      if (es) es.close();
    };
  }, []);

  // Sync state to Vite dev bridge for external MCP tools
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    try {
      fetch('/api/mcp/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fen: game.fen(),
          turn: game.turn(),
          turnName: game.turn() === 'w' ? 'White' : 'Black',
          history: history.map((h) => (typeof h === 'string' ? h : h.san)),
          moveCount: history.length,
          isGameOver: game.isGameOver() || isGameOver,
          inCheck: game.inCheck(),
          gameMode,
          aiDifficulty,
          timePreset,
          assignedColor,
          clocks: clockTimesRef.current,
          evaluation
        })
      }).catch(() => {});
    } catch {}
  }, [fen, history, isGameOver, gameMode, aiDifficulty, timePreset, assignedColor, evaluation, game]);

  // Persist game on tab close/unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (gameStarted && !isGameOver && history.length > 0) {
        saveActiveGame({
          fen: game.fen(),
          history,
          historyFens,
          activeMoveIndex,
          gameMode,
          userColor,
          assignedColor,
          aiDifficulty,
          timePreset,
          boardTheme,
          isFlipped,
          clocks: clockTimesRef.current
        });
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [gameStarted, isGameOver, history, historyFens, activeMoveIndex, gameMode, userColor, assignedColor, aiDifficulty, timePreset, boardTheme, isFlipped, game]);

  // Update Stockfish callbacks dynamically to ensure fresh closures and turn checks
  useEffect(() => {
    if (stockfishRef.current) {
      stockfishRef.current.onMessage = (msg) => {
        if (msg.startsWith('bestmove')) {
          const parts = msg.split(' ');
          const bestMove = parts[1];
          if (bestMove && bestMove !== '(none)') {
            const aiColor = assignedColor === 'w' ? 'b' : 'w';
            // ONLY execute AI moves when it is actually the AI's turn (in AI mode) and the game is not paused
            if (gameMode === 'ai' && game.turn() === aiColor && !isPaused) {
              makeAIMoveRef.current?.(bestMove);
            }
          }
        }
      };

      stockfishRef.current.onEval = (evalData) => {
        setEvaluation(evalData);
      };
    }
  }, [game, gameMode, aiDifficulty, assignedColor, isPaused]);

  // Update Stockfish position evaluation on moves
  useEffect(() => {
    if (!gameStarted || isGameOver || isPaused) return;

    // Determine whose turn it is
    const turn = game.turn();
    const aiColor = assignedColor === 'w' ? 'b' : 'w';

    // Trigger AI move if it is the AI's turn in AI mode
    if (gameMode === 'ai' && turn === aiColor) {
      stockfishRef.current.calculateBestMove(game.fen(), aiDifficulty);
    } else {
      // In PVP mode or when user is playing, request evaluation score for UI
      stockfishRef.current.evaluatePosition(game.fen(), 8);
    }
  }, [fen, gameMode, isGameOver, gameStarted, assignedColor, isPaused, game, aiDifficulty]);

  // Sync game over conditions
  useEffect(() => {
    if (game.isGameOver()) {
      clearActiveGame();
      setSavedGame(null);
      setIsGameOver(true);
      if (soundEnabled) audioService.playGameOver();

      if (game.isCheckmate()) {
        setGameOverReason('checkmate');
        setWinner(game.turn() === 'w' ? 'b' : 'w'); // active turn lost
        
        // Wait 30 seconds before showing the Game Over overlay for checkmates
        const timer = setTimeout(() => {
          setShowGameOverModal(true);
        }, 30000);
        return () => clearTimeout(timer);
      } else {
        if (game.isDraw()) {
          setWinner('draw');
          if (game.isStalemate()) {
            setGameOverReason('stalemate');
          } else if (game.isThreefoldRepetition()) {
            setGameOverReason('threefold');
          } else if (game.isInsufficientMaterial()) {
            setGameOverReason('insufficient');
          } else {
            setGameOverReason('draw');
          }
        }
        setShowGameOverModal(true);
      }
    }
  }, [fen, game, soundEnabled]);

  // Execute a chess move securely
  const executeMove = (moveConfig) => {
    try {
      const newGame = new Chess(game.fen());
      const result = newGame.move(moveConfig);

      if (result) {
        // Sound effects
        if (soundEnabled) {
          if (result.san.endsWith('#') || newGame.isGameOver()) {
            audioService.playGameOver();
          } else if (result.san.endsWith('+') || newGame.inCheck()) {
            audioService.playCheck();
          } else if (result.captured) {
            audioService.playCapture();
          } else {
            audioService.playMove();
          }
        }

        // Commit to state
        setGame(newGame);
        setFen(newGame.fen());
        
        // Append the new move result to the existing move history slice
        const newHistory = [...history.slice(0, activeMoveIndex), result];
        setHistory(newHistory);

        // Update history FENs
        const updatedFens = [...historyFens.slice(0, activeMoveIndex + 1), newGame.fen()];
        setHistoryFens(updatedFens);
        setActiveMoveIndex(updatedFens.length - 1);

        // Auto-save active game state (skip and clear if game is over)
        if (!newGame.isGameOver()) {
          saveActiveGame({
            fen: newGame.fen(),
            history: newHistory,
            historyFens: updatedFens,
            activeMoveIndex: updatedFens.length - 1,
            gameMode,
            userColor,
            assignedColor,
            aiDifficulty,
            timePreset,
            boardTheme,
            isFlipped,
            clocks: clockTimesRef.current
          });
        } else {
          clearActiveGame();
          setSavedGame(null);
        }

        return true;
      }
    } catch (e) {
      console.warn('Invalid Move:', e.message);
      return false;
    }
    return false;
  };

  const makeAIMove = (uciMove) => {
    // UCI format: e2e4 or e7e8q
    const from = uciMove.substring(0, 2);
    const to = uciMove.substring(2, 4);
    const promotion = uciMove.length === 5 ? uciMove[4] : undefined;

    executeMove({ from, to, promotion });
  };
  makeAIMoveRef.current = makeAIMove;

  const startGame = () => {
    clearActiveGame();
    setSavedGame(null);
    setClockTimes(null);
    clockTimesRef.current = null;
    setCustomSquareStyles({});
    setCustomArrows([]);

    let color = userColor;
    if (color === 'random') {
      color = Math.random() < 0.5 ? 'w' : 'b';
    }
    setAssignedColor(color);
    setIsFlipped(color === 'b');
    
    // Reset board state
    const freshGame = new Chess();
    setGame(freshGame);
    setFen(freshGame.fen());
    setHistory([]);
    setHistoryFens([freshGame.fen()]);
    setActiveMoveIndex(0);
    setEvaluation(null);
    setIsGameOver(false);
    setShowGameOverModal(false);
    setIsPaused(false);
    setGameOverReason('');
    setWinner('');
    setResetTrigger(prev => prev + 1);
    
    // Reset analysis states
    setAnalysisData(null);
    setIsAnalyzing(false);
    setAnalysisProgress(0);
    setShowAnalysisModal(false);
    
    setGameStarted(true);
  };

  const handleResumeGame = (saved) => {
    if (!saved) return;
    try {
      const restored = new Chess(saved.fen);
      setGame(restored);
      setFen(saved.fen);
      setHistory(saved.history || []);
      setHistoryFens(saved.historyFens || [saved.fen]);
      setActiveMoveIndex(saved.activeMoveIndex ?? (saved.history ? saved.history.length : 0));
      setGameMode(saved.gameMode || 'ai');
      setUserColor(saved.userColor || 'w');
      setAssignedColor(saved.assignedColor || 'w');
      setAiDifficulty(saved.aiDifficulty ?? 8);
      setTimePreset(saved.timePreset || '10+0');
      setBoardTheme(saved.boardTheme || 'emerald');
      setIsFlipped(Boolean(saved.isFlipped));
      if (saved.clocks) {
        setClockTimes(saved.clocks);
        clockTimesRef.current = saved.clocks;
      }
      setIsPaused(true);
      setIsGameOver(false);
      setShowGameOverModal(false);
      setGameStarted(true);
      setSavedGame(null);
    } catch (err) {
      console.error('Failed to restore saved game:', err);
      clearActiveGame();
      setSavedGame(null);
    }
  };

  const getPlayerName = (position) => {
    if (position === 'bottom') {
      return assignedColor === 'b' ? 'Player (Black)' : 'Player (White)';
    } else { // top player (opponent)
      if (gameMode === 'ai') {
        return `Stockfish AI (Level ${aiDifficulty})`;
      } else {
        return assignedColor === 'b' ? 'Player 1 (White)' : 'Player 2 (Black)';
      }
    }
  };

  // Piece drop validator for react-chessboard v5
  const onPieceDrop = ({ piece, sourceSquare, targetSquare }) => {
    if (!targetSquare) return false;
    const pieceType = piece.pieceType; // e.g. 'wP', 'bP'

    // Block moves if user is currently reviewing move logs
    if (activeMoveIndex !== historyFens.length - 1) {
      // Auto snap to latest move
      setActiveMoveIndex(historyFens.length - 1);
      return false;
    }

    // Block moves if game is over
    if (isGameOver) return false;

    // Block moves if AI is active
    const aiColor = assignedColor === 'w' ? 'b' : 'w';
    if (gameMode === 'ai' && game.turn() === aiColor) return false;

    // Auto-promotion helper
    const isPromotion = 
      (pieceType === 'wP' && targetSquare[1] === '8') || 
      (pieceType === 'bP' && targetSquare[1] === '1');

    return executeMove({
      from: sourceSquare,
      to: targetSquare,
      ...(isPromotion && { promotion: 'q' })
    });
  };

  const resetGame = () => {
    clearActiveGame();
    setSavedGame(null);
    setClockTimes(null);
    clockTimesRef.current = null;
    setCustomSquareStyles({});
    setCustomArrows([]);

    const freshGame = new Chess();
    setGame(freshGame);
    setFen(freshGame.fen());
    setHistory([]);
    setHistoryFens([freshGame.fen()]);
    setActiveMoveIndex(0);
    setEvaluation(null);
    setIsGameOver(false);
    setShowGameOverModal(false);
    setIsPaused(false);
    setGameOverReason('');
    setWinner('');
    setResetTrigger(prev => prev + 1);
    if (stockfishRef.current) {
      stockfishRef.current.stop();
    }

    // Reset analysis states
    setAnalysisData(null);
    setIsAnalyzing(false);
    setAnalysisProgress(0);
    setShowAnalysisModal(false);
  };

  const handleUndo = () => {
    if (history.length === 0) return;
    
    const newGame = new Chess();
    // Replay moves up to length - 1 (or length - 2 if AI mode to undo user + AI move)
    const undosCount = gameMode === 'ai' && history.length >= 2 ? 2 : 1;
    const targetLength = history.length - undosCount;

    for (let i = 0; i < targetLength; i++) {
      newGame.move(history[i].san);
    }

    setGame(newGame);
    setFen(newGame.fen());
    const newHistory = newGame.history({ verbose: true });
    setHistory(newHistory);

    const newFens = historyFens.slice(0, targetLength + 1);
    setHistoryFens(newFens);
    setActiveMoveIndex(newFens.length - 1);
    
    setIsGameOver(false);
    setShowGameOverModal(false);
    setIsPaused(false);
    setGameOverReason('');
    setWinner('');

    // Reset analysis states on undo
    setAnalysisData(null);
    setIsAnalyzing(false);
    setAnalysisProgress(0);
    setShowAnalysisModal(false);
  };

  // Clock timeout handler
  const handleTimeout = (color) => {
    clearActiveGame();
    setSavedGame(null);
    setIsGameOver(true);
    setGameOverReason('timeout');
    setWinner(color === 'w' ? 'b' : 'w');
    if (soundEnabled) audioService.playGameOver();
    setShowGameOverModal(true);
  };

  // Browser move navigation
  const selectMoveIndex = (index) => {
    // index is 0-indexed in plies. historyBoards[0] is starting position.
    // So move history index 0 matches historyBoards[1].
    setActiveMoveIndex(index + 1);
  };

  const returnToLatest = () => {
    setActiveMoveIndex(historyFens.length - 1);
  };

  const getAbsoluteScore = (evalData) => {
    if (!evalData) return 0;
    if (evalData.type === 'mate') {
      return evalData.value > 0 
        ? (10000 - evalData.value * 100) 
        : (-10000 - evalData.value * 100);
    }
    return evalData.value;
  };

  const getWinProbability = (score) => {
    return 1 / (1 + Math.pow(10, -score / 400));
  };

  const calculateAccuracy = (scoreBefore, scoreAfter, isWhite) => {
    const wpBefore = getWinProbability(scoreBefore);
    const wpAfter = getWinProbability(scoreAfter);
    const pBefore = isWhite ? wpBefore : (1 - wpBefore);
    const pAfter = isWhite ? wpAfter : (1 - wpAfter);
    const pLoss = Math.max(0, pBefore - pAfter);
    return 100 * (1 - pLoss);
  };

  const classifyMove = (loss, scoreBefore, scoreAfter, isWhite, isBestMove) => {
    if (isBestMove) return 'best';
    if (loss <= 10) return 'excellent';
    
    // Mitigate blunder classification in dead-won positions
    const wasWinning = isWhite ? scoreBefore > 400 : scoreBefore < -400;
    const isStillWinning = isWhite ? scoreAfter > 300 : scoreAfter < -300;
    if (wasWinning && isStillWinning) {
      if (loss < 150) return 'excellent';
      return 'good';
    }

    if (loss <= 30) return 'excellent';
    if (loss <= 60) return 'good';
    if (loss <= 120) return 'inaccuracy';
    if (loss <= 250) return 'mistake';
    return 'blunder';
  };

  const handleAnalyzeGame = async () => {
    if (historyFens.length <= 1) return;
    setIsAnalyzing(true);
    setAnalysisProgress(0);
    setShowAnalysisModal(true);

    const evaluations = [];
    const movesAnalysis = [];
    const totalPositions = historyFens.length;
    
    // Stop any active engine calculations
    if (stockfishRef.current) {
      stockfishRef.current.stop();
    }

    // Evaluate starting position + all moves
    for (let i = 0; i < totalPositions; i++) {
      const fen = historyFens[i];
      const tempGame = new Chess(fen);
      if (tempGame.isGameOver()) {
        let evalData = { type: 'cp', value: 0 };
        if (tempGame.isCheckmate()) {
          // If checkmate, the side whose turn it is lost.
          // White turn checkmated: Black won (-1 mate). Black turn checkmated: White won (+1 mate).
          evalData = {
            type: 'mate',
            value: tempGame.turn() === 'w' ? -1 : 1
          };
        }
        evaluations.push({
          evalData,
          bestMove: ''
        });
      } else {
        try {
          const result = await stockfishRef.current.evaluatePositionPromise(fen, 8);
          evaluations.push(result);
        } catch (err) {
          console.error('Error during position evaluation:', err);
          evaluations.push({ evalData: { type: 'cp', value: 0 }, bestMove: '' });
        }
      }
      setAnalysisProgress(Math.round(((i + 1) / totalPositions) * 100));
    }

    const summary = {
      w: { accuracy: 0, best: 0, excellent: 0, good: 0, inaccuracy: 0, mistake: 0, blunder: 0, count: 0, totalAccuracy: 0 },
      b: { accuracy: 0, best: 0, excellent: 0, good: 0, inaccuracy: 0, mistake: 0, blunder: 0, count: 0, totalAccuracy: 0 }
    };

    for (let i = 0; i < history.length; i++) {
      const move = history[i];
      const playerColor = move.color;
      const isWhite = playerColor === 'w';

      const evalBefore = evaluations[i];
      const evalAfter = evaluations[i + 1];

      const scoreBefore = getAbsoluteScore(evalBefore.evalData);
      const scoreAfter = getAbsoluteScore(evalAfter.evalData);

      const playedMoveUci = move.from + move.to + (move.promotion || '');
      const bestMoveUci = evalBefore.bestMove;
      const isBestMove = playedMoveUci === bestMoveUci;

      let loss = isWhite ? (scoreBefore - scoreAfter) : (scoreAfter - scoreBefore);
      loss = Math.max(0, loss);

      const classification = classifyMove(loss, scoreBefore, scoreAfter, isWhite, isBestMove);
      const accuracy = calculateAccuracy(scoreBefore, scoreAfter, isWhite);

      summary[playerColor][classification]++;
      summary[playerColor].count++;
      summary[playerColor].totalAccuracy += accuracy;

      movesAnalysis.push({
        ply: i + 1,
        playedMove: playedMoveUci,
        san: move.san,
        player: playerColor,
        classification,
        accuracy,
        scoreBefore,
        scoreAfter,
        bestMove: bestMoveUci
      });
    }

    if (summary.w.count > 0) {
      summary.w.accuracy = Math.round(summary.w.totalAccuracy / summary.w.count);
    } else {
      summary.w.accuracy = 100;
    }
    if (summary.b.count > 0) {
      summary.b.accuracy = Math.round(summary.b.totalAccuracy / summary.b.count);
    } else {
      summary.b.accuracy = 100;
    }

    setAnalysisData({
      evaluations,
      moves: movesAnalysis,
      summary
    });
    setIsAnalyzing(false);
  };

  const isReviewMode = activeMoveIndex !== historyFens.length - 1;

  // Board details for rendering
  const activeFen = historyFens[activeMoveIndex];
  const currentThemeColors = boardThemes[boardTheme];
  const isUserTurn = gameMode === 'pvp' || game.turn() === assignedColor;
  const canDrag = !isGameOver && isUserTurn && !isReviewMode;

  const getCustomSquareStyles = () => {
    const styles = {};
    const lastMove = activeMoveIndex > 0 && history[activeMoveIndex - 1] ? history[activeMoveIndex - 1] : null;

    if (!lastMove) return { ...styles, ...customSquareStyles };

    // Helper to check if square is light
    const isLightSquare = (square) => {
      const file = square.charCodeAt(0) - 97; // a=0, b=1, ...
      const rank = parseInt(square[1], 10) - 1; // 1=0, 2=1, ...
      return (file + rank) % 2 !== 0;
    };

    const fromSquare = lastMove.from;
    const toSquare = lastMove.to;

    const fromSqColor = isLightSquare(fromSquare) ? currentThemeColors.light : currentThemeColors.dark;
    const toSqColor = isLightSquare(toSquare) ? currentThemeColors.light : currentThemeColors.dark;

    // 1. Draw circle ring around the last move destination (piece square)
    styles[toSquare] = {
      background: `radial-gradient(circle, transparent 66%, var(--color-primary) 66%, var(--color-primary) 74%, transparent 74%), ${toSqColor}`
    };

    // 2. Draw soft background highlight on the last move source
    styles[fromSquare] = {
      background: `linear-gradient(rgba(99, 102, 241, 0.2), rgba(99, 102, 241, 0.2)), ${fromSqColor}`
    };

    return { ...styles, ...customSquareStyles };
  };

  // Helper labels
  const getGameOverTitle = () => {
    if (gameOverReason === 'timeout') return 'Game Over by Timeout';
    if (winner === 'draw') return 'Match Drawn';
    return winner === 'w' ? 'White Wins!' : 'Black Wins!';
  };

  const getGameOverSub = () => {
    switch (gameOverReason) {
      case 'checkmate': return 'Victory achieved by checkmate.';
      case 'stalemate': return 'Stalemate - No legal moves left.';
      case 'threefold': return 'Draw by threefold repetition.';
      case 'insufficient': return 'Draw by insufficient mating material.';
      case 'timeout': return winner === 'w' ? 'White won because Black ran out of time.' : 'Black won because White ran out of time.';
      default: return 'The match concluded in a draw.';
    }
  };

  if (!gameStarted) {
    return (
      <div className="setup-screen-container" style={{ position: 'relative' }}>
        <div style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', zIndex: 10, display: 'flex', gap: '0.5rem' }}>
          <button 
            className="btn btn-secondary btn-icon" 
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            onClick={toggleTheme}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button 
            className="btn btn-danger btn-icon" 
            title="Close Tab"
            onClick={handleCloseTab}
          >
            <X size={18} />
          </button>
        </div>
        <div className="setup-card">
          <div className="setup-logo-group">
            <img 
              src="https://pub-c1d80f0f7327493997a3c1285f43a9ea.r2.dev/amrit_logo.png" 
              alt="Satranj Logo" 
              className="setup-logo-icon" 
              style={{ width: '48px', height: '48px', objectFit: 'contain' }}
            />
            <h1 className="setup-title">SATRANJ</h1>
            <p className="setup-subtitle">Select your battle parameters to begin</p>
          </div>

          <div className="setup-form">
            {/* Game Mode Choice */}
            <div className="setup-row">
              <span className="setup-row-title">Game Mode</span>
              <div className="setup-choices-grid">
                <div 
                  className={`setup-choice-card ${gameMode === 'ai' ? 'active' : ''}`}
                  onClick={() => setGameMode('ai')}
                >
                  <Cpu size={28} />
                  <span className="setup-choice-card-title">vs Computer (AI)</span>
                </div>
                <div 
                  className={`setup-choice-card ${gameMode === 'pvp' ? 'active' : ''}`}
                  onClick={() => setGameMode('pvp')}
                >
                  <Users size={28} />
                  <span className="setup-choice-card-title">vs Friend (Local)</span>
                </div>
              </div>
            </div>

            {/* Play Color Selection - only if vs AI */}
            {gameMode === 'ai' && (
              <div className="setup-row">
                <span className="setup-row-title">Play As (Your Color)</span>
                <div className="color-picker-group">
                  <div 
                    className={`color-picker-card ${userColor === 'w' ? 'active' : ''}`}
                    onClick={() => setUserColor('w')}
                  >
                    <span className="color-icon-piece white-piece">♔</span>
                    <span className="color-picker-title">White</span>
                  </div>
                  <div 
                    className={`color-picker-card ${userColor === 'random' ? 'active' : ''}`}
                    onClick={() => setUserColor('random')}
                  >
                    <span className="color-icon-piece random-piece">?</span>
                    <span className="color-picker-title">Random</span>
                  </div>
                  <div 
                    className={`color-picker-card ${userColor === 'b' ? 'active' : ''}`}
                    onClick={() => setUserColor('b')}
                  >
                    <span className="color-icon-piece black-piece">♚</span>
                    <span className="color-picker-title">Black</span>
                  </div>
                </div>
              </div>
            )}

            {/* Time Presets picker */}
            <div className="setup-row">
              <span className="setup-row-title">Time Control</span>
              <div className="preset-picker-group">
                <div 
                  className={`preset-picker-card ${timePreset === '10+0' ? 'active' : ''}`}
                  onClick={() => setTimePreset('10+0')}
                >
                  <span className="preset-picker-name">10 + 0</span>
                  <span className="preset-picker-desc">Rapid</span>
                </div>
                <div 
                  className={`preset-picker-card ${timePreset === '30+0' ? 'active' : ''}`}
                  onClick={() => setTimePreset('30+0')}
                >
                  <span className="preset-picker-name">30 + 0</span>
                  <span className="preset-picker-desc">Classical</span>
                </div>
                <div 
                  className={`preset-picker-card ${timePreset === 'none' ? 'active' : ''}`}
                  onClick={() => setTimePreset('none')}
                >
                  <span className="preset-picker-name">∞</span>
                  <span className="preset-picker-desc">No Clock</span>
                </div>
              </div>
            </div>

            {/* AI Difficulty slider - only if vs AI */}
            {gameMode === 'ai' && (
              <div className="setup-row">
                <div className="slider-labels" style={{ marginBottom: '0.2rem' }}>
                  <span className="setup-row-title">AI Difficulty (Stockfish Level)</span>
                  <span style={{ fontWeight: 'bold', color: 'var(--color-secondary)' }}>Level {aiDifficulty}</span>
                </div>
                <input 
                  type="range"
                  min="2"
                  max="15"
                  className="slider-input"
                  value={aiDifficulty}
                  onChange={(e) => setAiDifficulty(parseInt(e.target.value, 10))}
                />
              </div>
            )}

            {/* Resume In-Progress Game Card */}
            {savedGame && (
              <div className="resume-game-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-secondary)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <Sparkles size={14} /> Saved Game Detected
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                    {Math.ceil((savedGame.history?.length || 0) / 2)} moves played
                  </span>
                </div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 0 0.75rem' }}>
                  {savedGame.gameMode === 'ai' ? `vs Stockfish (Level ${savedGame.aiDifficulty})` : 'Local Hotseat PvP'} • {savedGame.timePreset === 'none' ? 'Casual' : savedGame.timePreset}
                </p>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    className="btn btn-primary"
                    style={{ flex: 1, padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}
                    onClick={() => handleResumeGame(savedGame)}
                  >
                    <Play size={14} fill="currentColor" /> Resume Saved Game
                  </button>
                  <button
                    className="btn btn-secondary"
                    style={{ padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}
                    onClick={() => {
                      clearActiveGame();
                      setSavedGame(null);
                    }}
                    title="Discard saved game"
                  >
                    Discard
                  </button>
                </div>
              </div>
            )}

            {/* Start Button */}
            <button className="btn-start-match" onClick={startGame}>
              <Play size={20} fill="#fff" /> Start Match
            </button>
          </div>
        </div>

        {/* Small version info footer */}
        <div style={{ position: 'absolute', bottom: '1.5rem', fontSize: '0.8rem', color: 'var(--text-dim)' }}>
          Satranj Chess v1.0 • GPL-3.0 Compliance Active
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header">
        <div className="header-title-group">
          <img 
            src="https://pub-c1d80f0f7327493997a3c1285f43a9ea.r2.dev/amrit_logo.png" 
            alt="Satranj Logo" 
            className="header-logo-icon" 
            style={{ width: '32px', height: '32px', objectFit: 'contain' }}
          />
          <div>
            <h1 className="app-title">SATRANJ</h1>
            <span className="app-version">v1.0 GPLv3</span>
          </div>
        </div>
        <div className="header-actions">
          <button 
            className="btn btn-secondary btn-icon" 
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            onClick={toggleTheme}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button 
            className="btn btn-danger btn-icon" 
            title="Close Tab"
            onClick={handleCloseTab}
          >
            <X size={18} />
          </button>
          <button 
            className="btn btn-secondary btn-icon" 
            title="Toggle sound"
            onClick={() => setSoundEnabled(!soundEnabled)}
          >
            {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </button>
          <button 
            className="btn btn-secondary" 
            onClick={() => setIsAboutOpen(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <Info size={16} /> Legal & About
          </button>
        </div>
      </header>

      {/* Grid Dashboard */}
      <div className="dashboard-grid">
        {/* Left: Chessboard Column */}
        <div className="glass-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem', justifyContent: 'center' }}>
          
          {/* Review Indicator Banner */}
          {isReviewMode && (
            <div className="info-alert" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(245, 158, 11, 0.08)', borderColor: 'rgba(245, 158, 11, 0.25)', color: '#fcd34d' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 500 }}>
                <Eye size={16} /> Reviewing Board Position (Move {activeMoveIndex})
              </span>
              <button className="btn btn-secondary" style={{ padding: '0.2rem 0.6rem', fontSize: '0.75rem' }} onClick={returnToLatest}>
                Jump to Latest
              </button>
            </div>
          )}

          {/* Pause Indicator Banner */}
          {isPaused && (
            <div className="info-alert" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(99, 102, 241, 0.08)', borderColor: 'rgba(99, 102, 241, 0.25)', color: '#a5b4fc' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 500 }}>
                <Pause size={16} /> Game Paused. Clocks and piece movement are locked.
              </span>
              <button className="btn btn-secondary" style={{ padding: '0.2rem 0.6rem', fontSize: '0.75rem', borderColor: '#a5b4fc', color: '#a5b4fc' }} onClick={() => setIsPaused(false)}>
                Resume
              </button>
            </div>
          )}

          {/* Checkmate Review Banner */}
          {isGameOver && gameOverReason === 'checkmate' && !showGameOverModal && (
            <div className="info-alert" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(16, 185, 129, 0.08)', borderColor: 'rgba(16, 185, 129, 0.25)', color: 'var(--success)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 500 }}>
                <Award size={16} /> Checkmate! {winner === 'w' ? 'White' : 'Black'} Wins. Reviewing final board position...
              </span>
              <button className="btn btn-secondary" style={{ padding: '0.2rem 0.6rem', fontSize: '0.75rem', borderColor: 'var(--success)', color: 'var(--success)' }} onClick={() => setShowGameOverModal(true)}>
                Show Results
              </button>
            </div>
          )}

          <div className="board-section">
            {/* Live Evaluation Bar */}
            <EvaluationBar evaluation={evaluation} isFlipped={isFlipped} />

            {/* Chess Board Container */}
            <div className="board-outer-container">
              {/* Opponent Info Row (Top) */}
              <div className="player-bar">
                <div className="player-info">
                  <div className={`player-avatar ${isFlipped ? 'white' : 'black'}`}>
                    {isFlipped ? 'W' : 'B'}
                  </div>
                  <div>
                    <div className="player-name">
                      {getPlayerName('top')}
                    </div>
                  </div>
                  {gameMode === 'ai' && <span className="player-tag">CPU</span>}
                </div>
                {/* Captured pieces by the opponent */}
                <CapturedPieces game={game} playerColor={isFlipped ? 'w' : 'b'} />
              </div>

              {/* Main Interactive Chess Board */}
              <div className="custom-board-shadow">
                <Chessboard
                  key={`${boardTheme}-${assignedColor}-${resetTrigger}`}
                  options={{
                    position: activeFen,
                    boardOrientation: isFlipped ? 'black' : 'white',
                    darkSquareStyle: { backgroundColor: currentThemeColors.dark },
                    lightSquareStyle: { backgroundColor: currentThemeColors.light },
                    allowDragging: canDrag,
                    animationDurationInMs: 200,
                    onPieceDrop: onPieceDrop,
                    squareStyles: getCustomSquareStyles(),
                    arrows: customArrows
                  }}
                />
              </div>

              {/* Player Info Row (Bottom) */}
              <div className="player-bar">
                <div className="player-info">
                  <div className={`player-avatar ${isFlipped ? 'black' : 'white'}`}>
                    {isFlipped ? 'B' : 'W'}
                  </div>
                  <div>
                    <div className="player-name">
                      {getPlayerName('bottom')}
                    </div>
                  </div>
                </div>
                {/* Captured pieces by the player */}
                <CapturedPieces game={game} playerColor={isFlipped ? 'b' : 'w'} />
              </div>
            </div>
          </div>
        </div>

        {/* Right: Controls & History Column */}
        <div className="glass-card sidebar-panel">
          
          {/* Game Clock Settings */}
          <div className="panel-section">
            <h3 className="section-title">Match Clocks</h3>
            {timePreset === 'none' ? (
              <div 
                className="clock-card" 
                style={{ width: '100%', padding: '1rem', background: 'rgba(15, 23, 42, 0.25)', borderStyle: 'dashed' }}
              >
                <span className="clock-label">Time Control</span>
                <span className="clock-time" style={{ fontSize: '1.25rem', color: 'var(--text-muted)' }}>
                  Casual Play (No Timer)
                </span>
              </div>
            ) : (
              <ChessClock
                activeColor={game.turn()}
                isGameOver={isGameOver || isPaused}
                onTimeout={handleTimeout}
                timePreset={timePreset}
                gameHistoryLength={history.length}
                resetTrigger={resetTrigger}
                initialWhiteTime={clockTimes?.whiteTime}
                initialBlackTime={clockTimes?.blackTime}
                onTimeUpdate={(times) => {
                  clockTimesRef.current = times;
                }}
              />
            )}
          </div>

          {/* Configuration Form */}
          <div className="panel-section">
            <h3 className="section-title">Match Settings</h3>
            
            {gameMode === 'ai' && (
              <div className="slider-container">
                <div className="slider-labels">
                  <span className="setting-label">AI Difficulty (Stockfish Level)</span>
                  <span style={{ fontWeight: 'bold', color: 'var(--color-secondary)' }}>Level {aiDifficulty}</span>
                </div>
                <input 
                  type="range"
                  min="2"
                  max="15"
                  className="slider-input"
                  value={aiDifficulty}
                  onChange={(e) => setAiDifficulty(parseInt(e.target.value, 10))}
                />
              </div>
            )}

            <div className="setting-row">
              <span className="setting-label">Board Colors</span>
              <select 
                className="select-input"
                value={boardTheme}
                onChange={(e) => setBoardTheme(e.target.value)}
              >
                {Object.keys(boardThemes).map((key) => (
                  <option key={key} value={key}>{boardThemes[key].name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Move Log */}
          <MoveHistory 
            history={history} 
            activeMoveIndex={activeMoveIndex - 1} 
            onSelectMoveIndex={selectMoveIndex}
            analysisMoves={analysisData?.moves}
          />

          {/* Primary Board Actions */}
          <div className="controls-footer">
            {isGameOver && (
              <button 
                className="btn btn-secondary" 
                onClick={analysisData ? () => setShowAnalysisModal(true) : handleAnalyzeGame}
                style={{ gridColumn: 'span 2', borderColor: 'var(--color-secondary)', color: 'var(--color-secondary)' }}
              >
                {analysisData ? 'View Analysis Report' : 'Analyze Game'}
              </button>
            )}
            <button 
              className={`btn ${isPaused ? 'btn-primary' : 'btn-secondary'}`} 
              onClick={() => setIsPaused(!isPaused)}
              disabled={isGameOver || history.length === 0}
            >
              {isPaused ? (
                <>
                  <Play size={14} fill="#fff" /> Resume Game
                </>
              ) : (
                <>
                  <Pause size={14} fill="currentColor" /> Pause Game
                </>
              )}
            </button>
            <button className="btn btn-secondary" onClick={handleUndo} disabled={history.length === 0 || isGameOver || isPaused}>
              Undo Move
            </button>
            <button className="btn btn-secondary" onClick={() => setIsCoachOpen(true)}>
              <Bot size={14} /> Ask Coach
            </button>
            <button className="btn btn-secondary" onClick={() => setIsFlipped(!isFlipped)}>
              <ArrowLeftRight size={14} /> Flip Board
            </button>
            <button className="btn btn-secondary" onClick={resetGame}>
              <RotateCcw size={14} /> Restart Match
            </button>
            <button className="btn btn-danger" onClick={() => setGameStarted(false)}>
              <LogOut size={14} /> Setup Menu
            </button>
          </div>

        </div>
      </div>

      {/* Game Over Popup Modal */}
      {showGameOverModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <img 
              src="https://pub-c1d80f0f7327493997a3c1285f43a9ea.r2.dev/amrit_logo.png" 
              alt="Satranj Logo" 
              className="header-logo-icon" 
              style={{ width: '48px', height: '48px', objectFit: 'contain', margin: '0 auto 1rem', display: 'block' }}
            />
            <h2 className="modal-title">{getGameOverTitle()}</h2>
            <p className="modal-subtitle">{getGameOverSub()}</p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '1rem' }}>
              <button 
                className="btn btn-secondary" 
                onClick={() => {
                  setShowGameOverModal(false);
                  handleAnalyzeGame();
                }}
              >
                Analyze Game
              </button>
              <button className="btn btn-primary" onClick={resetGame}>
                Play Again
              </button>
            </div>
          </div>
        </div>
      )}

      {/* About & Licenses Modal */}
      <AboutModal isOpen={isAboutOpen} onClose={() => setIsAboutOpen(false)} />

      {/* Game Analysis Modal */}
      <GameAnalysisModal
        isOpen={showAnalysisModal}
        onClose={() => setShowAnalysisModal(false)}
        isAnalyzing={isAnalyzing}
        progress={analysisProgress}
        analysisData={analysisData}
        activeMoveIndex={activeMoveIndex}
        onSelectMoveIndex={selectMoveIndex}
        playerNames={{
          w: assignedColor === 'w' ? getPlayerName('bottom') : getPlayerName('top'),
          b: assignedColor === 'b' ? getPlayerName('bottom') : getPlayerName('top')
        }}
      />

      {/* AI Coach Slide-Out Drawer (WebMCP Powered) */}
      <CoachDrawer
        isOpen={isCoachOpen}
        onClose={() => setIsCoachOpen(false)}
        activeGameBridge={activeGameBridgeRef.current}
        onClearHighlights={() => {
          setCustomSquareStyles({});
          setCustomArrows([]);
        }}
      />
    </div>
  );
}
