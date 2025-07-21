import React from 'react';
import { Play, Pause, SkipForward, SkipBack } from 'lucide-react';

const Controls = ({ 
  isPlaying, 
  onPlay, 
  onPause, 
  onNext, 
  onPrev, 
  currentSign,
  availableSigns 
}) => {
  const currentIndex = availableSigns.indexOf(currentSign);

  return (
    <div style={{ margin: '20px', textAlign: 'center' }}>
      <div style={{ 
        background: '#333', 
        color: 'white', 
        padding: '10px 20px', 
        borderRadius: '20px',
        display: 'inline-block',
        marginBottom: '20px'
      }}>
        <strong>Current Sign: {currentSign.replace('_', ' ').toUpperCase()}</strong>
        <div style={{ fontSize: '12px', opacity: 0.8 }}>
          {currentIndex + 1} of {availableSigns.length}
        </div>
      </div>
      
      <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', alignItems: 'center' }}>
        <button
          onClick={onPrev}
          style={{
            padding: '12px',
            backgroundColor: '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '50%',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <SkipBack size={20} />
        </button>
        
        <button
          onClick={isPlaying ? onPause : onPlay}
          style={{
            padding: '15px',
            fontSize: '16px',
            backgroundColor: isPlaying ? '#dc3545' : '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '50%',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          {isPlaying ? <Pause size={24} /> : <Play size={24} />}
        </button>
        
        <button
          onClick={onNext}
          style={{
            padding: '12px',
            backgroundColor: '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '50%',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <SkipForward size={20} />
        </button>
      </div>
    </div>
  );
};

export default Controls;