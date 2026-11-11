import React, { useEffect, useRef } from 'react';
import { ScrollText, Trophy } from 'lucide-react';

export default function MoveHistory({ history, activeMoveIndex, onSelectMoveIndex, analysisMoves }) {
  const scrollRef = useRef(null);

  const getBadgeSymbol = (classification) => {
    switch (classification) {
      case 'best': return { symbol: '★', color: '#10b981', title: 'Best Move' };
      case 'excellent': return { symbol: '★', color: '#10b981', title: 'Excellent' };
      case 'good': return { symbol: '✓', color: '#14b8a6', title: 'Good' };
      case 'inaccuracy': return { symbol: '?!', color: '#d97706', title: 'Inaccuracy' };
      case 'mistake': return { symbol: '?', color: '#ea580c', title: 'Mistake' };
      case 'blunder': return { symbol: '??', color: '#dc2626', title: 'Blunder' };
      default: return null;
    }
  };

  const renderMoveWithBadge = (move, index) => {
    if (!move) return '';
    const text = typeof move === 'string' ? move : move.san;
    if (!analysisMoves || !analysisMoves[index]) return text;

    const badge = getBadgeSymbol(analysisMoves[index].classification);
    if (!badge) return text;

    return (
      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
        <span>{text}</span>
        <span 
          style={{ 
            color: badge.color, 
            fontWeight: 'bold', 
            fontSize: '0.8rem',
            marginLeft: '0.4rem',
            fontFamily: 'var(--font-mono)'
          }} 
          title={badge.title}
        >
          {badge.symbol}
        </span>
      </span>
    );
  };

  // Group moves into pairs (White, Black)
  const renderMoveRows = () => {
    const rows = [];
    for (let i = 0; i < history.length; i += 2) {
      const moveNum = Math.floor(i / 2) + 1;
      const whiteMove = history[i];
      const blackMove = history[i + 1];

      const whiteIndex = i;
      const blackIndex = i + 1;

      rows.push(
        <tr key={moveNum} className="move-row">
          <td className="move-number">{moveNum}.</td>
          <td 
            className={`move-ply ${activeMoveIndex === whiteIndex ? 'active-ply' : ''}`}
            onClick={() => onSelectMoveIndex && onSelectMoveIndex(whiteIndex)}
          >
            {renderMoveWithBadge(whiteMove, whiteIndex)}
          </td>
          <td 
            className={`move-ply ${blackMove && activeMoveIndex === blackIndex ? 'active-ply' : ''}`}
            onClick={() => blackMove && onSelectMoveIndex && onSelectMoveIndex(blackIndex)}
          >
            {blackMove ? renderMoveWithBadge(blackMove, blackIndex) : ''}
          </td>
        </tr>
      );
    }
    return rows;
  };

  // Auto scroll to bottom when moves are added
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history.length]);

  return (
    <div className="glass-card move-history-card">
      <div className="move-history-header">
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600, fontSize: '0.9rem' }}>
          <ScrollText size={16} className="header-logo-icon" /> Move Log
        </span>
        <span className="move-count">
          {Math.ceil(history.length / 2)} moves
        </span>
      </div>

      <div className="moves-scroll-area" ref={scrollRef}>
        {history.length === 0 ? (
          <div className="empty-moves">
            <Trophy size={20} style={{ opacity: 0.3 }} />
            <span>No moves played yet.</span>
          </div>
        ) : (
          <table className="moves-table">
            <tbody>
              {renderMoveRows()}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
