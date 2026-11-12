import React, { useState, useEffect, useRef } from 'react';
import { Clock } from 'lucide-react';

export default function ChessClock({
  activeColor,
  isGameOver,
  onTimeout,
  timePreset,
  gameHistoryLength,
  resetTrigger,
  initialWhiteTime,
  initialBlackTime,
  onTimeUpdate
}) {
  const [whiteTime, setWhiteTime] = useState(() => initialWhiteTime ?? 600000);
  const [blackTime, setBlackTime] = useState(() => initialBlackTime ?? 600000);
  const [isTicking, setIsTicking] = useState(false);
  
  const timerRef = useRef(null);
  const prevHistoryLength = useRef(0);
  const activeColorRef = useRef(activeColor);

  // Extract preset times (in milliseconds and increment)
  const getPresetConfig = (preset) => {
    switch (preset) {
      case '1+0': return { time: 60000, increment: 0 };
      case '3+2': return { time: 180000, increment: 2000 };
      case '5+0': return { time: 300000, increment: 0 };
      case '10+0': return { time: 600000, increment: 0 };
      case '30+0': return { time: 1800000, increment: 0 };
      default: return { time: 600000, increment: 0 };
    }
  };

  const { time: initialTime, increment } = getPresetConfig(timePreset);

  // Reset clocks when preset changes or game reset triggers
  useEffect(() => {
    setWhiteTime(initialWhiteTime ?? initialTime);
    setBlackTime(initialBlackTime ?? initialTime);
    setIsTicking(false);
    prevHistoryLength.current = 0;
  }, [timePreset, resetTrigger, initialTime, initialWhiteTime, initialBlackTime]);

  // Synchronize time updates with parent for persistence
  useEffect(() => {
    if (typeof onTimeUpdate === 'function') {
      onTimeUpdate({ whiteTime, blackTime });
    }
  }, [whiteTime, blackTime, onTimeUpdate]);

  // Track turn changes to apply increment
  useEffect(() => {
    if (gameHistoryLength > 0 && !isGameOver) {
      setIsTicking(true);

      // A move happened! Apply increment to the player who just moved
      // If color is now 'w', it means black just finished their move
      if (gameHistoryLength !== prevHistoryLength.current) {
        const justMoved = activeColor === 'w' ? 'b' : 'w';
        if (increment > 0 && prevHistoryLength.current > 0) {
          if (justMoved === 'w') {
            setWhiteTime((prev) => prev + increment);
          } else {
            setBlackTime((prev) => prev + increment);
          }
        }
        prevHistoryLength.current = gameHistoryLength;
      }
    } else {
      setIsTicking(false);
    }
    activeColorRef.current = activeColor;
  }, [gameHistoryLength, activeColor, isGameOver, increment]);

  // Main countdown loop (millisecond accurate using 100ms intervals)
  useEffect(() => {
    if (isTicking && !isGameOver) {
      timerRef.current = setInterval(() => {
        if (activeColorRef.current === 'w') {
          setWhiteTime((prev) => {
            if (prev <= 100) {
              clearInterval(timerRef.current);
              setIsTicking(false);
              onTimeout('w');
              return 0;
            }
            return prev - 100;
          });
        } else {
          setBlackTime((prev) => {
            if (prev <= 100) {
              clearInterval(timerRef.current);
              setIsTicking(false);
              onTimeout('b');
              return 0;
            }
            return prev - 100;
          });
        }
      }, 100);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isTicking, isGameOver, onTimeout]);

  // Format milliseconds into human readable format: MM:SS.T (tenths) or MM:SS
  const formatTime = (ms) => {
    if (ms <= 0) return '0:00.0';
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    
    if (ms < 10000) {
      // Under 10 seconds: show tenths of a second
      const tenths = Math.floor((ms % 1000) / 100);
      return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}.${tenths}`;
    }
    
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  const isWhiteLow = whiteTime < 20000;
  const isBlackLow = blackTime < 20000;

  return (
    <div className="clock-grid">
      {/* White Clock */}
      <div 
        className={`clock-card ${activeColor === 'w' && isTicking ? 'active' : ''} ${isWhiteLow ? 'flagged' : ''}`}
      >
        <span className="clock-label" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          <Clock size={10} /> White Time
        </span>
        <span className="clock-time">{formatTime(whiteTime)}</span>
      </div>

      {/* Black Clock */}
      <div 
        className={`clock-card ${activeColor === 'b' && isTicking ? 'active' : ''} ${isBlackLow ? 'flagged' : ''}`}
      >
        <span className="clock-label" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          <Clock size={10} /> Black Time
        </span>
        <span className="clock-time">{formatTime(blackTime)}</span>
      </div>
    </div>
  );
}
