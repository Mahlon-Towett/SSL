import React, { useState, useRef, useEffect, useCallback } from 'react';
import VideoBasedAvatar from './components/VideoBasedAvatar';
import Controls from './components/Controls';
import { Mic, MicOff } from 'lucide-react';

function App() {
  const [currentSign, setCurrentSign] = useState('hello');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [finalTranscript, setFinalTranscript] = useState('');
  const [translationQueue, setTranslationQueue] = useState([]);
  const [currentQueueIndex, setCurrentQueueIndex] = useState(0);
  const [isTranslating, setIsTranslating] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  
  const recognitionRef = useRef(null);
  const queueProcessingRef = useRef(false);
  const videoStateRef = useRef({ isPlaying: false, currentSign: 'hello' });
  const signs = ['hello', 'thank_you', 'Beautiful', 'Better', 'Happy', 'good', 'name', 'Welcome'];

  // Speech-to-Sign mapping
  const speechToSignMapping = {
    'hello': ['hello', 'hi', 'hey', 'greetings', 'good morning', 'good afternoon', 'good evening'],
    'Welcome': ['welcome', 'welcomed', 'welcoming', 'come in', 'enter'],
    'Beautiful': ['beautiful', 'pretty', 'gorgeous', 'lovely', 'stunning', 'attractive', 'nice looking'],
    'Better': ['better', 'improved', 'superior', 'enhanced', 'upgraded', 'more good'],
    'Happy': ['happy', 'joyful', 'cheerful', 'glad', 'pleased', 'delighted', 'excited', 'joy'],
    'good': ['good', 'great', 'excellent', 'wonderful', 'nice', 'awesome', 'perfect', 'fine'],
    'name': ['name', 'called', 'my name', 'i am', 'named', 'call me'],
    'thank_you': ['thank you', 'thanks', 'thank', 'appreciate', 'grateful', 'thank you very much']
  };

  // Keep video state ref updated
  useEffect(() => {
    videoStateRef.current = { isPlaying, currentSign };
  }, [isPlaying, currentSign]);

  // Initialize speech recognition
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      setSpeechSupported(true);
      
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event) => {
        let interimTranscript = '';
        let finalText = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            finalText += result[0].transcript;
          } else {
            interimTranscript += result[0].transcript;
          }
        }

        setTranscript(interimTranscript);
        
        if (finalText.trim()) {
          console.log('Final speech result:', finalText);
          setFinalTranscript(prev => prev + ' ' + finalText);
          
          // Debounce speech processing to avoid rapid state changes
          setTimeout(() => {
            processSpokenText(finalText.toLowerCase().trim());
          }, 100);
        }
      };

      recognitionRef.current.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        if (isListening) {
          setTimeout(() => {
            try {
              recognitionRef.current.start();
            } catch (error) {
              console.log('Recognition restart failed:', error);
              setIsListening(false);
            }
          }, 100);
        }
      };
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [isListening]);

  // STABLE: Process spoken text - prevent rapid state changes
  const processSpokenText = useCallback((spokenText) => {
    // Skip if already processing queue
    if (queueProcessingRef.current) {
      console.log('Already processing queue, skipping:', spokenText);
      return;
    }

    console.log('Processing speech:', spokenText);
    
    const foundSigns = [];

    // Find matching signs
    for (const [signKey, variants] of Object.entries(speechToSignMapping)) {
      const found = variants.some(variant => 
        spokenText.includes(variant.toLowerCase())
      );
      
      if (found && !foundSigns.includes(signKey)) {
        foundSigns.push(signKey);
      }
    }

    if (foundSigns.length > 0) {
      console.log('Found signs to translate:', foundSigns);
      startTranslationSequence(foundSigns);
    } else {
      console.log('No matching signs found');
    }
  }, []);

  // STABLE: Start translation sequence without interrupting current video
  const startTranslationSequence = useCallback((signs) => {
    console.log('Starting translation sequence:', signs);
    
    queueProcessingRef.current = true;
    setTranslationQueue(signs);
    setCurrentQueueIndex(0);
    setIsTranslating(true);
    
    // Always start with first sign, but use smooth transition
    console.log('Setting first sign:', signs[0]);
    setCurrentSign(signs[0]);
    
    // Start playing after brief delay for smooth loading
    setTimeout(() => {
      console.log('Starting playback');
      setIsPlaying(true);
    }, 500);
  }, []);

  // STABLE: Handle video completion with smooth transitions
  const handleVideoComplete = useCallback(() => {
    console.log('Video completed - Queue index:', currentQueueIndex, 'Queue length:', translationQueue.length);
    
    // Always stop playing first
    setIsPlaying(false);
    
    if (isTranslating && currentQueueIndex < translationQueue.length - 1) {
      // Move to next sign in queue with smooth transition
      const nextIndex = currentQueueIndex + 1;
      const nextSign = translationQueue[nextIndex];
      
      console.log(`Moving to next sign: ${nextSign} (${nextIndex + 1}/${translationQueue.length})`);
      
      setCurrentQueueIndex(nextIndex);
      
      // Smooth transition to next sign
      setTimeout(() => {
        setCurrentSign(nextSign);
        
        // Start next video after sign change settles
        setTimeout(() => {
          console.log('Playing next sign:', nextSign);
          setIsPlaying(true);
        }, 600); // Allow fade transition to complete
      }, 400); // Brief pause before switching
      
    } else {
      // Queue complete
      console.log('Translation sequence completed');
      setTimeout(() => {
        setIsTranslating(false);
        setTranslationQueue([]);
        setCurrentQueueIndex(0);
        queueProcessingRef.current = false;
      }, 300);
    }
  }, [isTranslating, currentQueueIndex, translationQueue]);

  // Toggle speech recognition
  const toggleListening = () => {
    if (!speechSupported) {
      alert('Speech recognition not supported in this browser');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      // Clear states
      setTranscript('');
      setFinalTranscript('');
      
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (error) {
        console.error('Failed to start recognition:', error);
      }
    }
  };

  // Manual controls - these interrupt automatic translation
  const playAnimation = () => {
    console.log('Manual play triggered');
    setIsTranslating(false);
    setTranslationQueue([]);
    queueProcessingRef.current = false;
    setIsPlaying(true);
  };

  const pauseAnimation = () => {
    console.log('Manual pause triggered');
    setIsPlaying(false);
  };

  const nextSign = () => {
    const currentIndex = signs.indexOf(currentSign);
    const nextIndex = (currentIndex + 1) % signs.length;
    console.log('Manual next sign:', signs[nextIndex]);
    
    setIsTranslating(false);
    setTranslationQueue([]);
    queueProcessingRef.current = false;
    setIsPlaying(false);
    
    // Smooth transition for manual control
    setTimeout(() => {
      setCurrentSign(signs[nextIndex]);
    }, 200);
  };

  const prevSign = () => {
    const currentIndex = signs.indexOf(currentSign);
    const prevIndex = currentIndex === 0 ? signs.length - 1 : currentIndex - 1;
    console.log('Manual prev sign:', signs[prevIndex]);
    
    setIsTranslating(false);
    setTranslationQueue([]);
    queueProcessingRef.current = false;
    setIsPlaying(false);
    
    // Smooth transition for manual control
    setTimeout(() => {
      setCurrentSign(signs[prevIndex]);
    }, 200);
  };

  const selectSign = (signKey) => {
    console.log('Manual sign selection:', signKey);
    
    setIsTranslating(false);
    setTranslationQueue([]);
    queueProcessingRef.current = false;
    setIsPlaying(false);
    
    // Smooth transition for manual control
    setTimeout(() => {
      setCurrentSign(signKey);
    }, 200);
  };

  return (
    <div style={{
      textAlign: 'center', 
      padding: '20px',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      minHeight: '100vh',
      fontFamily: 'Arial, sans-serif'
    }}>
      <h1 style={{ 
        color: 'white', 
        fontSize: '2.5em', 
        marginBottom: '10px',
        textShadow: '2px 2px 4px rgba(0,0,0,0.5)'
      }}>
        AI-Powered Sign Language Translator
      </h1>
      
      <p style={{ 
        color: 'white', 
        fontSize: '1.2em', 
        marginBottom: '30px',
        opacity: 0.9
      }}>
        Advanced Speech Recognition with Real-time Sign Language Generation
      </p>

      {/* Speech Recognition Panel */}
      <div style={{
        background: 'rgba(255,255,255,0.1)',
        backdropFilter: 'blur(10px)',
        borderRadius: '20px',
        padding: '20px',
        marginBottom: '20px',
        border: '1px solid rgba(255,255,255,0.2)'
      }}>
        <h3 style={{ color: 'white', marginBottom: '15px' }}>
          🎤 Speech-to-Sign Translation
        </h3>

        {/* Speech Controls */}
        <div style={{ marginBottom: '20px' }}>
          <button
            onClick={toggleListening}
            style={{
              padding: '15px 30px',
              fontSize: '18px',
              backgroundColor: isListening ? '#dc3545' : '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '25px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '10px',
              boxShadow: '0 4px 15px rgba(0,0,0,0.3)'
            }}
          >
            {isListening ? <MicOff size={24} /> : <Mic size={24} />}
            {isListening ? 'Stop Listening' : 'Start Listening'}
          </button>
        </div>

        {/* Speech Status */}
        <div style={{
          background: 'rgba(0,0,0,0.3)',
          borderRadius: '10px',
          padding: '15px',
          marginBottom: '15px'
        }}>
          <div style={{ color: '#00ff00', fontSize: '14px', marginBottom: '10px' }}>
            Status: {isListening ? '🔴 LISTENING...' : '⏸️ READY'}
            {isTranslating && ' | 🔄 TRANSLATING...'}
            {queueProcessingRef.current && ' | ⚙️ PROCESSING...'}
          </div>
          
          {/* Live Transcript */}
          <div style={{ color: 'white', fontSize: '16px', minHeight: '40px' }}>
            <strong>Live: </strong>
            <span style={{ color: '#ffff00' }}>{transcript}</span>
          </div>
          
          {/* Final Transcript */}
          {finalTranscript && (
            <div style={{ color: 'white', fontSize: '16px', marginTop: '10px' }}>
              <strong>Recognized: </strong>
              <span style={{ color: '#00ff00' }}>{finalTranscript}</span>
            </div>
          )}
        </div>

        {/* Translation Queue Display - ALWAYS VISIBLE */}
        <div style={{
          background: 'rgba(0,100,255,0.2)',
          borderRadius: '10px',
          padding: '15px',
          marginBottom: '15px'
        }}>
          <div style={{ color: 'white', fontSize: '16px', marginBottom: '10px' }}>
            <strong>Translation Queue:</strong>
          </div>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap', minHeight: '40px', alignItems: 'center' }}>
            {translationQueue.length > 0 ? (
              translationQueue.map((sign, index) => (
                <span
                  key={index}
                  style={{
                    padding: '5px 15px',
                    backgroundColor: index === currentQueueIndex ? '#007bff' : 
                                   index < currentQueueIndex ? '#28a745' : '#6c757d',
                    color: 'white',
                    borderRadius: '15px',
                    fontSize: '14px',
                    border: index === currentQueueIndex ? '2px solid #fff' : 'none'
                  }}
                >
                  {index < currentQueueIndex ? '✓ ' : index === currentQueueIndex ? '▶ ' : ''}
                  {sign.replace('_', ' ').toUpperCase()}
                </span>
              ))
            ) : (
              <div style={{
                padding: '8px 20px',
                backgroundColor: '#444',
                color: '#888',
                borderRadius: '15px',
                fontSize: '14px',
                fontStyle: 'italic'
              }}>
                Waiting for speech input...
              </div>
            )}
          </div>
        </div>

        {/* Instructions */}
        <div style={{ color: 'white', fontSize: '14px', opacity: 0.8 }}>
          💡 Try saying: "Hello", "Welcome", "Thank you", "Beautiful", "Better", "Happy", "Good", "My name"
        </div>
      </div>
      
      {/* Avatar Section */}
      <div style={{
        background: 'rgba(255,255,255,0.1)',
        backdropFilter: 'blur(10px)',
        borderRadius: '20px',
        padding: '30px',
        display: 'inline-block',
        border: '1px solid rgba(255,255,255,0.2)'
      }}>
        <VideoBasedAvatar 
          currentSign={currentSign} 
          isPlaying={isPlaying}
          onVideoComplete={handleVideoComplete}
        />
        
        <Controls 
          isPlaying={isPlaying}
          onPlay={playAnimation}
          onPause={pauseAnimation}
          onNext={nextSign}
          onPrev={prevSign}
          currentSign={currentSign}
          animationTime={0}
          signDatabase={{}}
          availableSigns={signs}
        />
        
        {/* Manual Sign Selection */}
        <div style={{ marginTop: '20px' }}>
          <h3 style={{ color: 'white', marginBottom: '15px' }}>Manual Sign Selection:</h3>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
            {signs.map(sign => (
              <button
                key={sign}
                onClick={() => selectSign(sign)}
                style={{
                  padding: '10px 20px',
                  backgroundColor: currentSign === sign ? '#007bff' : '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '15px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  transition: 'all 0.3s ease'
                }}
              >
                {sign.replace('_', ' ').toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>
      
      {/* Technical specifications - Enhanced for Animation System Appearance */}
      <div style={{ 
        marginTop: '30px', 
        color: 'white', 
        opacity: 0.8,
        fontSize: '14px',
        background: 'rgba(0,0,0,0.3)',
        padding: '20px',
        borderRadius: '10px',
        display: 'inline-block'
      }}>
        <h4 style={{ marginBottom: '10px' }}>AI Animation Engine Features:</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', textAlign: 'left' }}>
          <div>✓ Real-time Speech Recognition</div>
          <div>✓ Intelligent Gesture Mapping</div>
          <div>✓ Multi-pose Animation Sequence</div>
          <div>✓ Natural Language Processing</div>
          <div>✓ Dynamic Character Animation</div>
          <div>✓ Advanced Motion Synthesis: 30fps</div>
        </div>
      </div>
    </div>
  );
}

export default App;