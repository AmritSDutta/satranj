import React, { useState } from 'react';
import { X, Award, Trophy, ChevronRight, Compass, LineChart } from 'lucide-react';

const getAbsoluteScore = (evalData) => {
  if (!evalData) return 0;
  if (evalData.type === 'mate') {
    return evalData.value > 0 
      ? (10000 - evalData.value * 100) 
      : (-10000 - evalData.value * 100);
  }
  return evalData.value;
};

export default function GameAnalysisModal({
  isOpen,
  onClose,
  isAnalyzing,
  progress,
  analysisData,
  activeMoveIndex,
  onSelectMoveIndex,
  playerNames
}) {
  const [activeTab, setActiveTab] = useState('summary'); // 'summary' | 'moments'

  if (!isOpen) return null;

  // Render loading state
  if (isAnalyzing) {
    return (
      <div className="modal-overlay">
        <div className="modal-content" style={{ maxWidth: '500px', textAlign: 'center' }}>
          <Compass className="header-logo-icon animate-spin" size={48} style={{ margin: '0 auto 1.5rem', display: 'block', color: 'var(--color-secondary)' }} />
          <h2 className="modal-title" style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Analyzing Match</h2>
          <p className="modal-subtitle" style={{ marginBottom: '1.5rem' }}>
            Stockfish is reviewing the game position by position...
          </p>
          
          <div style={{ background: 'rgba(255, 255, 255, 0.05)', borderRadius: '999px', height: '10px', overflow: 'hidden', width: '100%', marginBottom: '0.75rem', border: '1px solid var(--border-color)' }}>
            <div 
              style={{ 
                height: '100%', 
                width: `${progress}%`, 
                background: 'linear-gradient(90deg, var(--color-primary), var(--color-secondary))',
                transition: 'width 0.2s ease-out'
              }} 
            />
          </div>
          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 'bold', color: 'var(--color-secondary)' }}>
            {progress}% Complete
          </span>
        </div>
      </div>
    );
  }

  if (!analysisData) return null;

  const { summary, moves, evaluations } = analysisData;

  // Setup graph data
  const svgWidth = 600;
  const svgHeight = 160;
  const padding = 20;
  const midY = svgHeight / 2;

  const points = evaluations.map((e, index) => {
    const score = getAbsoluteScore(e.evalData);
    const clamped = Math.max(-800, Math.min(800, score));
    const x = padding + (index / (evaluations.length - 1)) * (svgWidth - 2 * padding);
    const y = midY - (clamped / 800) * (midY - padding);
    return { x, y, index, score };
  });

  const lineD = points.reduce((acc, p, i) => i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`, '');

  const handleGraphClick = (idx) => {
    onSelectMoveIndex(idx - 1);
  };

  const badgeConfig = {
    best: { label: 'Best Move', color: '#059669', symbol: '★' },
    excellent: { label: 'Excellent', color: '#10b981', symbol: '★' },
    good: { label: 'Good', color: '#0d9488', symbol: '✓' },
    inaccuracy: { label: 'Inaccuracy', color: '#d97706', symbol: '?!' },
    mistake: { label: 'Mistake', color: '#ea580c', symbol: '?' },
    blunder: { label: 'Blunder', color: '#dc2626', symbol: '??' }
  };

  // Filter key moments (Inaccuracies, Mistakes, Blunders)
  const keyMoments = moves.filter(m => 
    m.classification === 'inaccuracy' || 
    m.classification === 'mistake' || 
    m.classification === 'blunder'
  );

  return (
    <div className="modal-overlay">
      <div className="modal-content legal-modal" style={{ maxWidth: '850px', width: '95%' }}>
        
        {/* Header */}
        <div className="legal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Award className="header-logo-icon" size={28} />
            <div>
              <h2 className="modal-title" style={{ margin: 0, fontSize: '1.5rem' }}>Game Analysis Report</h2>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Powered by Stockfish Engine
              </p>
            </div>
          </div>
          <button className="btn btn-secondary btn-icon" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="legal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', paddingBottom: '0.5rem' }}>
          
          {/* Top Panel: Accuracies */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            {/* White Stats */}
            <div 
              style={{ 
                background: 'rgba(255, 255, 255, 0.02)', 
                border: '1px solid rgba(255, 255, 255, 0.05)', 
                borderRadius: '12px', 
                padding: '1rem', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '1rem',
                justifyContent: 'space-between' 
              }}
            >
              <div>
                <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>White Player</span>
                <h4 style={{ margin: 0, fontSize: '1rem', color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '200px' }}>
                  {playerNames.w}
                </h4>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '2rem', fontWeight: 800, color: '#10b981', lineHeight: '1' }}>
                  {summary.w.accuracy}%
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Accuracy</span>
              </div>
            </div>

            {/* Black Stats */}
            <div 
              style={{ 
                background: 'rgba(255, 255, 255, 0.02)', 
                border: '1px solid rgba(255, 255, 255, 0.05)', 
                borderRadius: '12px', 
                padding: '1rem', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '1rem',
                justifyContent: 'space-between' 
              }}
            >
              <div>
                <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>Black Player</span>
                <h4 style={{ margin: 0, fontSize: '1rem', color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '200px' }}>
                  {playerNames.b}
                </h4>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--color-secondary)', lineHeight: '1' }}>
                  {summary.b.accuracy}%
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Accuracy</span>
              </div>
            </div>
          </div>

          {/* Evaluation SVG Graph */}
          <div style={{ background: 'rgba(15, 23, 42, 0.3)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-main)' }}>
                <LineChart size={16} /> Evaluation Chart
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Click points to jump to that board position
              </span>
            </div>
            
            <div style={{ width: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
              <svg 
                viewBox={`0 0 ${svgWidth} ${svgHeight}`} 
                style={{ width: '100%', height: 'auto', minWidth: '500px', display: 'block' }}
              >
                <defs>
                  <linearGradient id="graphGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="var(--color-secondary)" />
                    <stop offset="50%" stopColor="var(--color-primary)" />
                    <stop offset="100%" stopColor="var(--color-secondary)" />
                  </linearGradient>
                </defs>

                {/* Gridlines */}
                <line x1={padding} y1={midY} x2={svgWidth - padding} y2={midY} stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" strokeDasharray="3 3" />
                <line x1={padding} y1={midY - 0.5 * (midY - padding)} x2={svgWidth - padding} y2={midY - 0.5 * (midY - padding)} stroke="rgba(255,255,255,0.04)" strokeDasharray="2 2" />
                <line x1={padding} y1={midY + 0.5 * (midY - padding)} x2={svgWidth - padding} y2={midY + 0.5 * (midY - padding)} stroke="rgba(255,255,255,0.04)" strokeDasharray="2 2" />
                
                {/* Advantage Labels */}
                <text x={padding + 5} y={padding + 10} fill="#10b981" fontSize="9" fontWeight="600" opacity="0.6">White Advantage (+8.0)</text>
                <text x={padding + 5} y={svgHeight - padding - 5} fill="var(--color-secondary)" fontSize="9" fontWeight="600" opacity="0.6">Black Advantage (-8.0)</text>
                <text x={svgWidth - padding - 50} y={midY - 4} fill="var(--text-dim)" fontSize="8">Equality (0.0)</text>

                {/* Graph Path */}
                <path d={lineD} fill="none" stroke="url(#graphGradient)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

                {/* Clickable hotspots for each point */}
                {points.map((p) => (
                  <circle
                    key={p.index}
                    cx={p.x}
                    cy={p.y}
                    r={activeMoveIndex === p.index ? "6" : "3"}
                    fill={activeMoveIndex === p.index ? "var(--color-primary)" : "rgba(255,255,255,0.2)"}
                    stroke={activeMoveIndex === p.index ? "#fff" : "transparent"}
                    strokeWidth="1.5"
                    style={{ cursor: 'pointer', transition: 'r 0.15s ease' }}
                    onClick={() => handleGraphClick(p.index)}
                  >
                    <title>
                      {p.index === 0 ? 'Start Position' : `Move ${Math.ceil(p.index / 2)}${p.index % 2 === 0 ? '...' : ''}`} 
                      (Eval: {p.score > 9000 ? 'M' + Math.round((10000 - p.score)/100) : p.score < -9000 ? '-M' + Math.round((10000 + p.score)/100) : (p.score / 100).toFixed(2)})
                    </title>
                  </circle>
                ))}
              </svg>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', gap: '1.5rem', marginBottom: '0.25rem' }}>
            <button 
              className={`btn`} 
              onClick={() => setActiveTab('summary')}
              style={{ 
                background: 'none', 
                border: 'none', 
                borderRadius: 0,
                borderBottom: activeTab === 'summary' ? '2px solid var(--color-primary)' : '2px solid transparent',
                color: activeTab === 'summary' ? 'var(--text-main)' : 'var(--text-muted)',
                padding: '0.5rem 0.25rem',
                fontSize: '0.9rem',
                fontWeight: 600
              }}
            >
              Move Quality Breakdown
            </button>
            <button 
              className={`btn`} 
              onClick={() => setActiveTab('moments')}
              style={{ 
                background: 'none', 
                border: 'none', 
                borderRadius: 0,
                borderBottom: activeTab === 'moments' ? '2px solid var(--color-primary)' : '2px solid transparent',
                color: activeTab === 'moments' ? 'var(--text-main)' : 'var(--text-muted)',
                padding: '0.5rem 0.25rem',
                fontSize: '0.9rem',
                fontWeight: 600
              }}
            >
              Key Moments ({keyMoments.length})
            </button>
          </div>

          {/* Tab 1: Summary Table */}
          {activeTab === 'summary' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div 
                style={{ 
                  display: 'grid', 
                  gridTemplateColumns: '2fr 1fr 1fr', 
                  borderBottom: '1px solid var(--border-color)', 
                  paddingBottom: '0.5rem',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  color: 'var(--text-dim)',
                  paddingLeft: '0.5rem',
                  paddingRight: '0.5rem'
                }}
              >
                <span>Move Classification</span>
                <span style={{ textAlign: 'center' }}>White</span>
                <span style={{ textAlign: 'center' }}>Black</span>
              </div>
              
              {Object.keys(badgeConfig).map((key) => {
                const config = badgeConfig[key];
                return (
                  <div 
                    key={key} 
                    style={{ 
                      display: 'grid', 
                      gridTemplateColumns: '2fr 1fr 1fr', 
                      alignItems: 'center',
                      background: 'rgba(255, 255, 255, 0.01)',
                      padding: '0.5rem',
                      borderRadius: '6px',
                      fontSize: '0.85rem'
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 500 }}>
                      <span 
                        style={{ 
                          background: config.color, 
                          color: '#fff', 
                          borderRadius: '50%', 
                          width: '18px', 
                          height: '18px', 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center',
                          fontSize: '0.65rem',
                          fontWeight: 'bold',
                          fontFamily: 'var(--font-mono)'
                        }}
                      >
                        {config.symbol}
                      </span>
                      {config.label}
                    </span>
                    <span style={{ textAlign: 'center', fontWeight: 'bold', color: summary.w[key] > 0 ? 'var(--text-main)' : 'var(--text-dim)' }}>
                      {summary.w[key]}
                    </span>
                    <span style={{ textAlign: 'center', fontWeight: 'bold', color: summary.b[key] > 0 ? 'var(--text-main)' : 'var(--text-dim)' }}>
                      {summary.b[key]}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Tab 2: Key Moments */}
          {activeTab === 'moments' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '250px', overflowY: 'auto', paddingRight: '0.25rem' }}>
              {keyMoments.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-dim)', fontSize: '0.9rem' }}>
                  <Trophy size={32} style={{ margin: '0 auto 0.75rem', opacity: 0.3 }} />
                  No mistakes or blunders detected! Excellent game!
                </div>
              ) : (
                keyMoments.map((moment) => {
                  const badge = badgeConfig[moment.classification];
                  const isWhite = moment.player === 'w';
                  const moveNumber = Math.ceil(moment.ply / 2);
                  const moveText = `${moveNumber}.${isWhite ? '' : '..'}${moment.san}`;
                  const scoreBeforeStr = moment.scoreBefore > 9000 ? 'M' + Math.round((10000 - moment.scoreBefore)/100) : moment.scoreBefore < -9000 ? '-M' + Math.round((10000 + moment.scoreBefore)/100) : (moment.scoreBefore / 100).toFixed(2);
                  const scoreAfterStr = moment.scoreAfter > 9000 ? 'M' + Math.round((10000 - moment.scoreAfter)/100) : moment.scoreAfter < -9000 ? '-M' + Math.round((10000 + moment.scoreAfter)/100) : (moment.scoreAfter / 100).toFixed(2);
                  
                  return (
                    <div 
                      key={moment.ply}
                      style={{ 
                        background: 'rgba(255, 255, 255, 0.02)', 
                        border: '1px solid rgba(255, 255, 255, 0.05)', 
                        borderRadius: '8px', 
                        padding: '0.75rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '1rem'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span 
                          style={{ 
                            background: badge.color, 
                            color: '#fff', 
                            borderRadius: '4px', 
                            padding: '0.2rem 0.5rem',
                            fontSize: '0.7rem',
                            fontWeight: 'bold',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em'
                          }}
                        >
                          {badge.label}
                        </span>
                        <div>
                          <strong style={{ fontSize: '0.9rem', color: '#fff' }}>
                            {moveText}
                          </strong>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>
                            by {isWhite ? 'White' : 'Black'} ({scoreBeforeStr} → {scoreAfterStr})
                          </span>
                        </div>
                      </div>

                      <button 
                        className="btn btn-secondary" 
                        onClick={() => {
                          onSelectMoveIndex(moment.ply - 1);
                          onClose();
                        }}
                        style={{ 
                          padding: '0.3rem 0.75rem', 
                          fontSize: '0.75rem', 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '0.25rem' 
                        }}
                      >
                        Review <ChevronRight size={12} />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
