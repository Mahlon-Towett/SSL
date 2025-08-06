// src/utils/speechTranslationUtils.js - Speech to sign translation utilities

import { SPEECH_TO_SIGN_MAPPING, PHRASE_PATTERNS } from './signConstants';

/**
 * Translates spoken text to an array of sign language signs
 * @param {string} spokenText - The text to translate
 * @returns {string[]} - Array of sign names to display
 */
export const translateSpeechToSigns = (spokenText) => {
  console.log('Translating:', spokenText);
  const words = spokenText.toLowerCase().trim().split(/\s+/);
  const foundSigns = [];

  // Check for "my name is" pattern
  const nameMatch = spokenText.match(/(?:my name is|i am) (\w+)/i);
  if (nameMatch && nameMatch[1]) {
    const name = nameMatch[1].toUpperCase();
    foundSigns.push('My', 'Name');
    
    // Add each letter of the name
    for (const letter of name) {
      if (letter.match(/[A-Z]/)) {
        foundSigns.push(letter);
      }
    }
    return foundSigns;
  }

  // Process multi-word phrases first
  const fullText = spokenText.toLowerCase();
  const processedPhrases = new Set();
  
  for (const [phrase, sign] of Object.entries(PHRASE_PATTERNS)) {
    if (fullText.includes(phrase)) {
      foundSigns.push(sign);
      processedPhrases.add(phrase);
    }
  }

  // Process individual words
  for (const word of words) {
    // Skip words that were already part of processed phrases
    if (shouldSkipWord(word, processedPhrases, fullText)) {
      continue;
    }

    // Check if it's a single letter
    if (word.length === 1 && word.match(/[a-z]/i)) {
      foundSigns.push(word.toUpperCase());
    } 
    // Check if it's a number
    else if (word.match(/^\d$/)) {
      foundSigns.push(word);
    }
    // Check word mapping
    else if (SPEECH_TO_SIGN_MAPPING[word]) {
      const sign = SPEECH_TO_SIGN_MAPPING[word];
      if (!foundSigns.includes(sign)) {
        foundSigns.push(sign);
      }
    }
  }

  return foundSigns;
};

/**
 * Determines if a word should be skipped because it was part of a processed phrase
 * @param {string} word - The word to check
 * @param {Set} processedPhrases - Set of already processed phrases
 * @param {string} fullText - The full text being processed
 * @returns {boolean} - Whether to skip this word
 */
const shouldSkipWord = (word, processedPhrases, fullText) => {
  const skipConditions = [
    word === 'thank' && processedPhrases.has('thank you'),
    word === 'you' && processedPhrases.has('thank you'),
    word === 'do' && (processedPhrases.has('do not') || processedPhrases.has("don't")),
    word === 'does' && (processedPhrases.has('does not') || processedPhrases.has("doesn't")),
    word === 'not' && (processedPhrases.has('do not') || processedPhrases.has('does not')),
    word === 'excuse' && processedPhrases.has('excuse me'),
    word === 'me' && processedPhrases.has('excuse me')
  ];

  return skipConditions.some(condition => condition);
};

/**
 * Initializes speech recognition with proper configuration
 * @param {Object} callbacks - Object containing callback functions
 * @returns {SpeechRecognition|null} - Configured speech recognition instance
 */
export const initializeSpeechRecognition = (callbacks) => {
  if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
    return null;
  }

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = new SpeechRecognition();
  
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = 'en-US';
  
  recognition.onresult = (event) => {
    let interimTranscript = '';
    let finalTranscript = '';
    
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        finalTranscript += transcript;
      } else {
        interimTranscript += transcript;
      }
    }
    
    if (callbacks.onInterimResult) {
      callbacks.onInterimResult(interimTranscript);
    }
    
    if (finalTranscript && callbacks.onFinalResult) {
      callbacks.onFinalResult(finalTranscript);
    }
  };
  
  recognition.onerror = (event) => {
    console.error('Speech recognition error:', event.error);
    if (callbacks.onError) {
      callbacks.onError(event.error);
    }
  };
  
  recognition.onend = () => {
    if (callbacks.onEnd) {
      callbacks.onEnd();
    }
  };
  
  return recognition;
};

/**
 * Validates if speech recognition is supported in the current browser
 * @returns {boolean} - Whether speech recognition is supported
 */
export const isSpeechRecognitionSupported = () => {
  return 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
};