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
