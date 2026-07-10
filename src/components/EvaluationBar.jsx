import React from 'react';

export default function EvaluationBar({ evaluation, isFlipped }) {
  // Calculate percentage of white advantage
  const getWhitePercentage = () => {
    if (!evaluation) return 50;

    let scoreVal = 0;
    if (evaluation.type === 'mate') {
      // Mate scores are extremely strong. Cap at +/- 10
      scoreVal = evaluation.value > 0 ? 10 : -10;
    } else {
      // Centipawns. Divide by 100 to get pawn units
      scoreVal = evaluation.value / 100;
    }

    // Map score range [-10, 10] to percentage [5, 95]
    // 0 score maps to 50%
    let percentage = 50 + scoreVal * 4.5;
    return Math.max(5, Math.min(95, percentage));
  };

  const getEvalText = () => {
    if (!evaluation) return '0.0';
    
    if (evaluation.type === 'mate') {
      const moves = Math.abs(evaluation.value);
      return `M${moves}`;
    }
    
    const scoreVal = evaluation.value / 100;
    return scoreVal > 0 ? `+${scoreVal.toFixed(1)}` : scoreVal.toFixed(1);
  };

  const whitePercent = getWhitePercentage();
  const evalText = getEvalText();
  
  // Decide who is winning based on score
  const scoreNum = evaluation ? (evaluation.type === 'mate' ? evaluation.value : evaluation.value) : 0;
  const isWhiteWinning = scoreNum > 0;

  // When board is flipped, the orientation is inverted (Black at bottom)
  const whiteBarHeight = isFlipped ? 100 - whitePercent : whitePercent;
  const blackBarHeight = isFlipped ? whitePercent : 100 - whitePercent;

  return (
    <div className="eval-bar-container">
      {/* Black eval portion (top by default, bottom if flipped) */}
      <div 
        className="eval-fill-black" 
        style={{ height: `${blackBarHeight}%` }}
      />
      
      {/* White eval portion (bottom by default, top if flipped) */}
      <div 
        className="eval-fill-white" 
        style={{ height: `${whiteBarHeight}%` }}
      />

      {/* Eval value text overlay */}
      <div className={`eval-text ${isWhiteWinning ? 'bottom-eval' : 'top-eval'}`}>
        {evalText}
      </div>
    </div>
  );
}
