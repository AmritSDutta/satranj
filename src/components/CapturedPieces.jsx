import React from 'react';

const pieceSymbols = {
  q: '♛',
  r: '♜',
  b: '♝',
  n: '♞',
  p: '♟'
};

const pieceValues = { q: 9, r: 5, b: 3, n: 3, p: 1 };

export default function CapturedPieces({ game, playerColor }) {
  // playerColor is 'w' or 'b'
  // If playerColor is 'w', we want to show Black pieces captured BY White.
  // If playerColor is 'b', we want to show White pieces captured BY Black.
  
  const getCapturedPieces = () => {
    const startingCounts = {
      w: { p: 8, n: 2, b: 2, r: 2, q: 1 },
      b: { p: 8, n: 2, b: 2, r: 2, q: 1 }
    };

    const currentCounts = {
      w: { p: 0, n: 0, b: 0, r: 0, q: 0 },
      b: { p: 0, n: 0, b: 0, r: 0, q: 0 }
    };

    // Scan board
    const board = game.board();
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = board[r][c];
        if (piece && piece.type !== 'k') {
          currentCounts[piece.color][piece.type]++;
        }
      }
    }

    // Determine captured pieces of both colors
    const captured = { w: [], b: [] }; // w means captured White pieces, b means captured Black pieces
    const order = ['q', 'r', 'b', 'n', 'p'];

    order.forEach(type => {
      // White pieces captured (starting - current)
      const wCapturedCount = Math.max(0, startingCounts.w[type] - currentCounts.w[type]);
      for (let i = 0; i < wCapturedCount; i++) {
        captured.w.push(type);
      }

      // Black pieces captured (starting - current)
      const bCapturedCount = Math.max(0, startingCounts.b[type] - currentCounts.b[type]);
      for (let i = 0; i < bCapturedCount; i++) {
        captured.b.push(type);
      }
    });

    // Calculate material value on board for score difference
    let whiteValue = 0;
    let blackValue = 0;
    
    Object.keys(currentCounts.w).forEach(type => {
      whiteValue += currentCounts.w[type] * pieceValues[type];
      blackValue += currentCounts.b[type] * pieceValues[type];
    });

    return {
      captured,
      scoreDiff: whiteValue - blackValue
    };
  };

  const { captured, scoreDiff } = getCapturedPieces();

  // If we are White, we display Black pieces captured by White (captured.b)
  // If we are Black, we display White pieces captured by Black (captured.w)
  const targetPieces = playerColor === 'w' ? captured.b : captured.w;
  const isTargetWhite = playerColor === 'b'; // White pieces are captured by Black
  
  // Show score diff if positive for this player
  // If player is White, show scoreDiff if > 0
  // If player is Black, show -scoreDiff if < 0 (meaning Black is up)
  const showScore = playerColor === 'w' ? scoreDiff > 0 : scoreDiff < 0;
  const scoreText = showScore ? `+${Math.abs(scoreDiff)}` : '';

  return (
    <div className="captured-pieces-panel">
      {targetPieces.map((piece, index) => (
        <span 
          key={index} 
          className="captured-piece"
          style={{ 
            color: isTargetWhite ? '#e2e8f0' : '#475569',
            textShadow: isTargetWhite ? '0 0 1px #000' : 'none'
          }}
        >
          {pieceSymbols[piece]}
        </span>
      ))}
      {showScore && <span className="captured-score-diff">{scoreText}</span>}
    </div>
  );
}
