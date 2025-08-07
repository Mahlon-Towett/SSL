// src/utils/signConstants.js - Updated constants without missing videos

// Complete list of available signs with proper video mappings (removed No and Please)
export const AVAILABLE_SIGNS = [
  // Numbers
  '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
  // Letters A-Z
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 
  'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
  // Common words - ensure these match your video file names exactly
  'Hello', 'Welcome', 'Thank_You', 'Thank', 'Beautiful', 'Better', 'Happy', 'Good', 
  'Great', 'Name', 'My', 'ME', 'You', 'Your', 'Yourself', 'I', 'We', 'Us', 'They',
  'This', 'That', 'Those', 'Here', 'There', 'Where', 'What', 'When', 'Why', 'Who',
  'Which', 'Whose', 'How', 'Time', 'Day', 'Home', 'Work', 'Study', 'Learn', 'Help',
  'Go', 'Come', 'Stay', 'Walk', 'See', 'Look', 'Talk', 'Say', 'Ask', 'Eat', 'Drink',
  'Sleep', 'Sad', 'Angry', 'Love', 'Like', 'Want', 'Need', 'Have', 'Do',
  'Does_Not', 'Do_Not', 'Cannot', 'Will', 'Can', 'Be', 'Am', 'Is', 'Are', 'Was',
  'Sorry', 'Excuse_Me', 'Yes', 'Maybe', 'Friend', 'Family'
];

// Speech-to-Sign mapping (handles spaces and underscores) - removed missing videos
export const SPEECH_TO_SIGN_MAPPING = {
  'hello': 'Hello',
  'hi': 'Hello',
  'hey': 'Hello',
  'welcome': 'Welcome',
  'thank you': 'Thank_You',
  'thanks': 'Thank_You',
  'beautiful': 'Beautiful',
  'pretty': 'Beautiful',
  'happy': 'Happy',
  'glad': 'Happy',
  'good': 'Good',
  'great': 'Great',
  'better': 'Better',
  'name': 'Name',
  'my': 'My',
  'me': 'ME',
  'you': 'You',
  'your': 'Your',
  'yourself': 'Yourself',
  'i': 'I',
  'we': 'We',
  'us': 'Us',
  'they': 'They',
  'this': 'This',
  'that': 'That',
  'those': 'Those',
  'here': 'Here',
  'there': 'There',
  'what': 'What',
  'where': 'Where',
  'when': 'When',
  'why': 'Why',
  'who': 'Who',
  'which': 'Which',
  'whose': 'Whose',
  'how': 'How',
  'help': 'Help',
  'work': 'Work',
  'home': 'Home',
  'time': 'Time',
  'day': 'Day',
  'study': 'Study',
  'learn': 'Learn',
  'go': 'Go',
  'come': 'Come',
  'stay': 'Stay',
  'see': 'See',
  'look': 'Look',
  'walk': 'Walk',
  'talk': 'Talk',
  'say': 'Say',
  'ask': 'Ask',
  'eat': 'Eat',
  'drink': 'Drink',
  'sleep': 'Sleep',
  'sad': 'Sad',
  'angry': 'Angry',
  'love': 'Love',
  'like': 'Like',
  'want': 'Want',
  'need': 'Need',
  'have': 'Have',
  'do': 'Do',
  'can': 'Can',
  'will': 'Will',
  'be': 'Be',
  'am': 'Am',
  'is': 'Is',
  'are': 'Are',
  'was': 'Was',
  'sorry': 'Sorry',
  'excuse me': 'Excuse_Me',
  'yes': 'Yes',
  'maybe': 'Maybe',
  'friend': 'Friend',
  'family': 'Family'
};

// Quick access signs for the selector (removed missing videos)
export const QUICK_SIGNS = [
  'Hello', 'Thank_You', 'Yes', 'Help', 'Good', 'Love', 'Friend', 'Sorry'
];

// Mock signs for detection simulation (removed missing videos)
export const MOCK_DETECTION_SIGNS = [
  'Hello', 'Thank_You', 'Yes', 'Help', 'Good', 'Love'
];

// Multi-word phrase patterns
export const PHRASE_PATTERNS = {
  'thank you': 'Thank_You',
  'do not': 'Do_Not',
  "don't": 'Do_Not',
  'does not': 'Does_Not',
  "doesn't": 'Does_Not',
  'cannot': 'Cannot',
  "can't": 'Cannot',
  'excuse me': 'Excuse_Me'
};

// Animation timing configurations
export const ANIMATION_TIMING = {
  LETTER_DURATION: 1500,    // Duration for single letters/numbers
  WORD_DURATION: 2500,      // Duration for words
  TRANSITION_DELAY: 300     // Delay between signs
};

// Default detection settings
export const DETECTION_SETTINGS = {
  CONFIDENCE_THRESHOLD: 85,
  DETECTION_INTERVAL: 3000,
  DISPLAY_DURATION: 1500
};