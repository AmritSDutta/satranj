export class StockfishService {
  constructor(onMessage, onEval) {
    this.worker = null;
    this.onMessage = onMessage;
    this.onEval = onEval;
    this.currentTurn = 'w';
  }

  init() {
    this.terminate();
    try {
      // Using Stockfish 10 compilation from CDN via Blob URL to circumvent CORS constraints
      const blobCode = `importScripts('https://cdnjs.cloudflare.com/ajax/libs/stockfish.js/10.0.2/stockfish.js');`;
      const blob = new Blob([blobCode], { type: 'application/javascript' });
      this.worker = new Worker(URL.createObjectURL(blob));
      this.worker.onerror = (err) => {
        console.error('[Stockfish Worker Error]:', err);
      };

      this.worker.onmessage = (e) => {
        const line = e.data;
        
        // Parse evaluation scores from info lines
        if (line.startsWith('info ') && line.includes('score ')) {
          this.parseEval(line);
        }

        if (this.onMessage) {
          this.onMessage(line);
        }
      };

      this.worker.postMessage('uci');
      this.worker.postMessage('setoption name Hash value 32');
    } catch (err) {
      console.error('Failed to initialize Stockfish worker:', err);
    }
  }

  parseEval(line) {
    // Info lines contain "score cp X" or "score mate Y"
    const parts = line.split(' ');
    const scoreIdx = parts.indexOf('score');
    if (scoreIdx !== -1 && scoreIdx + 2 < parts.length) {
      const type = parts[scoreIdx + 1]; // 'cp' or 'mate'
      const valStr = parts[scoreIdx + 2];
      let value = parseInt(valStr, 10);

      if (!isNaN(value)) {
        // Stockfish evaluations are relative to the side active in the sent FEN position.
        // Convert to absolute advantage (positive for White, negative for Black)
        if (this.currentTurn === 'b') {
          value = -value;
        }
        
        if (this.onEval) {
          this.onEval({ type, value });
        }
      }
    }
  }

  setTurn(turn) {
    this.currentTurn = turn;
  }

  calculateBestMove(fen, depth = 10) {
    if (!this.worker) this.init();
    if (!this.worker) return;

    // Parse active side from FEN
    // FEN format: [board] [active_color] [castling] [en_passant] [halfmove] [fullmove]
    const fenParts = fen.split(' ');
    const activeColor = fenParts[1] || 'w';
    this.setTurn(activeColor);

    this.worker.postMessage(`position fen ${fen}`);
    this.worker.postMessage(`go depth ${depth}`);
  }

  evaluatePosition(fen, depth = 8) {
    if (!this.worker) this.init();
    if (!this.worker) return;

    const fenParts = fen.split(' ');
    const activeColor = fenParts[1] || 'w';
    this.setTurn(activeColor);

    this.worker.postMessage(`position fen ${fen}`);
    this.worker.postMessage(`go depth ${depth}`);
  }

  evaluatePositionPromise(fen, depth = 8, timeoutMs = 1500) {
    return new Promise((resolve) => {
      if (!this.worker) this.init();
      if (!this.worker) {
        resolve({ evalData: { type: 'cp', value: 0 }, bestMove: '' });
        return;
      }
      
      const fenParts = fen.split(' ');
      const activeColor = fenParts[1] || 'w';
      this.setTurn(activeColor);

      let lastEval = null;
      let lastPv = [];
      let isResolved = false;
      const prevOnMessage = this.worker.onmessage;

      const timer = setTimeout(() => {
        if (!isResolved) {
          isResolved = true;
          this.worker.onmessage = prevOnMessage;
          resolve({
            evalData: lastEval || { type: 'cp', value: 0 },
            bestMove: '',
            pv: lastPv,
            depth,
            isTimeout: true
          });
        }
      }, timeoutMs);
      
      this.worker.onmessage = (e) => {
        const line = e.data;

        // Parse evaluation and principal variation from info line
        if (line.startsWith('info ')) {
          const parts = line.split(' ');
          if (line.includes('score ')) {
            const scoreIdx = parts.indexOf('score');
            if (scoreIdx !== -1 && scoreIdx + 2 < parts.length) {
              const type = parts[scoreIdx + 1]; // 'cp' or 'mate'
              const valStr = parts[scoreIdx + 2];
              let value = parseInt(valStr, 10);
              if (!isNaN(value)) {
                if (this.currentTurn === 'b') {
                  value = -value;
                }
                lastEval = { type, value };
              }
            }
          }
          if (line.includes(' pv ')) {
            const pvIdx = parts.indexOf('pv');
            if (pvIdx !== -1 && pvIdx + 1 < parts.length) {
              lastPv = parts.slice(pvIdx + 1);
            }
          }
        }

        // Search is finished when bestmove is outputted
        if (line.startsWith('bestmove')) {
          const parts = line.split(' ');
          const bestMove = parts[1];
          
          if (!isResolved) {
            isResolved = true;
            clearTimeout(timer);
            this.worker.onmessage = prevOnMessage; // Restore standard listener
            resolve({
              evalData: lastEval || { type: 'cp', value: 0 },
              bestMove: bestMove !== '(none)' ? bestMove : '',
              pv: lastPv,
              depth
            });
          }
        }
      };

      this.worker.postMessage(`position fen ${fen}`);
      this.worker.postMessage(`go depth ${depth}`);
    });
  }

  stop() {
    if (this.worker) {
      this.worker.postMessage('stop');
    }
  }

  terminate() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }
}
