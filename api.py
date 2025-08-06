#!/usr/bin/env python3
"""
Enhanced Flask API for Real-time Sign Language Detection - Part 1
Now supports all 18 signs including the new ones
"""

import os
import cv2
import numpy as np
import mediapipe as mp
from flask import Flask, request, jsonify, Response
from flask_cors import CORS
import pickle
import base64
import time
from collections import deque, Counter
import logging
from sklearn.ensemble import RandomForestClassifier
import json
from datetime import datetime
import io
from PIL import Image

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ============================================
# ENHANCED CLASSES FOR ALL 18 SIGNS
# ============================================

class SignLanguageClassifier:
    """Enhanced classifier supporting all 18 signs using Random Forest"""
    
    def __init__(self):
        # Enhanced Random Forest for better performance with more classes
        self.model = RandomForestClassifier(
            n_estimators=200,  # Increased for better performance
            max_depth=15,      # Increased depth
            min_samples_split=5,
            min_samples_leaf=2,
            random_state=42,
            n_jobs=-1
        )
        self.label_to_idx = {}
        self.idx_to_label = {}
        
    def predict(self, landmarks):
        """Predict sign with confidence"""
        if not hasattr(self.model, 'predict_proba'):
            raise ValueError("Model not trained or loaded!")
            
        # Get prediction probabilities
        proba = self.model.predict_proba([landmarks])[0]
        class_idx = np.argmax(proba)
        confidence = proba[class_idx]
        
        return self.idx_to_label[class_idx], confidence
    
    def predict_top_k(self, landmarks, k=3):
        """Get top-k predictions with confidence scores"""
        if not hasattr(self.model, 'predict_proba'):
            raise ValueError("Model not trained or loaded!")
            
        proba = self.model.predict_proba([landmarks])[0]
        top_indices = np.argsort(proba)[::-1][:k]
        
        predictions = []
        for idx in top_indices:
            predictions.append({
                'sign': self.idx_to_label[idx],
                'confidence': float(proba[idx])
            })
        
        return predictions
    
    def load_model(self, filepath='enhanced_sign_model.pkl'):
        """Load a pre-trained model - tries enhanced model first, falls back to original"""
        model_files_to_try = [
            'enhanced_sign_model.pkl',  # Try enhanced model first
            'sign_model.pkl'            # Fallback to original
        ]
        
        loaded_successfully = False
        for model_file in model_files_to_try:
            if os.path.exists(model_file):
                try:
                    with open(model_file, 'rb') as f:
                        model_data = pickle.load(f)
                    self.model = model_data['model']
                    self.label_to_idx = model_data['label_to_idx']
                    self.idx_to_label = model_data['idx_to_label']
                    logger.info(f"📂 Model loaded successfully from {model_file}")
                    logger.info(f"🎯 Model supports {len(self.idx_to_label)} signs: {list(self.idx_to_label.values())}")
                    loaded_successfully = True
                    break
                except Exception as e:
                    logger.warning(f"⚠️ Failed to load {model_file}: {str(e)}")
                    continue
        
        if not loaded_successfully:
            raise FileNotFoundError(f"No valid model found! Tried: {model_files_to_try}")

class SignLanguageDetector:
    """Enhanced real-time sign language detection supporting all 18 signs"""
    
    def __init__(self, classifier):
        self.classifier = classifier
        self.mp_hands = mp.solutions.hands
        self.hands = self.mp_hands.Hands(
            static_image_mode=False,
            max_num_hands=1,
            min_detection_confidence=0.7,
            min_tracking_confidence=0.5
        )
        self.mp_drawing = mp.solutions.drawing_utils
        
        # Enhanced smoothing for better accuracy with more signs
        self.prediction_history = deque(maxlen=20)
        self.recognized_text = []
        self.last_sign = None
        self.last_sign_time = time.time()
        self.confidence_threshold = 0.7
        self.session_stats = {
            'total_predictions': 0,
            'successful_predictions': 0,
            'signs_detected': set(),
            'session_start': time.time()
        }
        
    def extract_landmarks(self, image):
        """Extract hand landmarks from image with enhanced error handling"""
        logger.info(f"🔍 Processing image for landmarks - Shape: {image.shape}, Type: {image.dtype}")
        
        try:
            # Validate image
            if image is None or image.size == 0:
                logger.error("❌ Invalid image provided")
                return None, None
                
            height, width = image.shape[:2]
            if height < 50 or width < 50:
                logger.warning(f"⚠️ Image too small: {width}x{height}")
                return None, None
            
            # Convert to RGB for MediaPipe
            image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
            logger.info(f"🎨 Converted to RGB - Shape: {image_rgb.shape}")
            
            # Process with MediaPipe
            results = self.hands.process(image_rgb)
            logger.info(f"👋 MediaPipe processing complete")
            
            if results.multi_hand_landmarks:
                logger.info(f"✅ Found {len(results.multi_hand_landmarks)} hand(s)")
                landmarks = results.multi_hand_landmarks[0]
                landmark_list = []
                
                # Extract all 21 landmarks with 3D coordinates
                for i, lm in enumerate(landmarks.landmark):
                    landmark_list.extend([lm.x, lm.y, lm.z])
                    if i < 3:  # Log first 3 landmarks for debugging
                        logger.info(f"   Landmark {i}: ({lm.x:.3f}, {lm.y:.3f}, {lm.z:.3f})")
                
                # Validate landmark count
                if len(landmark_list) != 63:  # 21 landmarks * 3 coordinates
                    logger.error(f"❌ Invalid landmark count: {len(landmark_list)} (expected 63)")
                    return None, None
                
                logger.info(f"📊 Extracted {len(landmark_list)} landmark values")
                return landmark_list, landmarks
            else:
                logger.info("👋 No hands detected by MediaPipe")
                return None, None
                
        except Exception as e:
            logger.error(f"❌ Error in extract_landmarks: {str(e)}")
            return None, None
    
    def process_frame(self, frame):
        """Process a single frame and return enhanced detection results"""
        logger.info(f"🖼️ Processing frame - Shape: {frame.shape}, Size: {frame.size}")
        
        # Update session stats
        self.session_stats['total_predictions'] += 1
        
        # Debug: Check if frame is valid
        if frame is None or frame.size == 0:
            logger.error("❌ Invalid frame received!")
            return {
                'hand_detected': False, 
                'error': 'Invalid frame',
                'success': False
            }
        
        # Debug: Check frame properties
        height, width = frame.shape[:2]
        logger.info(f"📐 Frame dimensions: {width}x{height}")
        
        # Check if frame is too dark or too bright
        mean_brightness = np.mean(frame)
        logger.info(f"💡 Frame brightness (mean): {mean_brightness:.2f}")
        
        if mean_brightness < 10:
            logger.warning("⚠️ Frame appears very dark!")
        elif mean_brightness > 245:
            logger.warning("⚠️ Frame appears very bright!")
        
        # Extract landmarks
        landmarks, landmarks_visual = self.extract_landmarks(frame)
        
        # Initialize result structure
        result = {
            'hand_detected': False,
            'sign': None,
            'confidence': 0.0,
            'top_predictions': [],
            'timestamp': datetime.now().isoformat(),
            'landmarks': None,
            'frame_info': {
                'width': width,
                'height': height,
                'brightness': float(mean_brightness),
                'channels': frame.shape[2] if len(frame.shape) > 2 else 1
            },
            'session_stats': {
                'total_predictions': self.session_stats['total_predictions'],
                'successful_predictions': self.session_stats['successful_predictions'],
                'unique_signs_detected': len(self.session_stats['signs_detected']),
                'session_duration': time.time() - self.session_stats['session_start']
            },
            'success': True
        }
        
        if landmarks is not None:
            logger.info("✅ Hand landmarks detected successfully!")
            result['hand_detected'] = True
            result['landmarks'] = landmarks
            
            try:
                # Get main prediction
                sign, confidence = self.classifier.predict(landmarks)
                logger.info(f"🎯 Main prediction: {sign} (confidence: {confidence:.3f})")
                
                # Get top 3 predictions for better insight
                top_predictions = self.classifier.predict_top_k(landmarks, k=3)
                logger.info(f"🏆 Top predictions: {[(p['sign'], p['confidence']) for p in top_predictions]}")
                
                result['sign'] = sign
                result['confidence'] = float(confidence)
                result['top_predictions'] = top_predictions
                
                # Update session stats
                if confidence > self.confidence_threshold:
                    self.session_stats['successful_predictions'] += 1
                    self.session_stats['signs_detected'].add(sign)
                
                # Add to prediction history for smoothing
                self.prediction_history.append((sign, confidence))
                logger.info(f"📈 Prediction history length: {len(self.prediction_history)}")
                
                # Enhanced smoothing algorithm
                if len(self.prediction_history) >= 10:
                    # Only consider high-confidence predictions
                    recent = [(s, c) for s, c in self.prediction_history 
                             if c > self.confidence_threshold]
                    logger.info(f"🔄 Recent high-confidence predictions: {len(recent)}")
                    
                    if len(recent) >= 5:  # Need at least 5 consistent predictions
                        signs = [s for s, c in recent]
                        sign_counts = Counter(signs)
                        most_common = sign_counts.most_common(1)
                        
                        if most_common:
                            detected_sign = most_common[0][0]
                            consistency_ratio = most_common[0][1] / len(recent)
                            logger.info(f"🏆 Most common sign: {detected_sign} (consistency: {consistency_ratio:.2f})")
                            
                            # Add to recognized text if stable, new, and highly consistent
                            current_time = time.time()
                            if (detected_sign != self.last_sign and 
                                current_time - self.last_sign_time > 2.0 and  # Increased delay
                                consistency_ratio > 0.6):  # Require good consistency
                                
                                self.recognized_text.append(detected_sign)
                                self.last_sign = detected_sign
                                self.last_sign_time = current_time
                                result['new_sign_added'] = True
                                result['recognized_text'] = ' '.join(self.recognized_text)
                                result['consistency_ratio'] = float(consistency_ratio)
                                logger.info(f"🆕 New sign added to text: {detected_sign}")
                                logger.info(f"📝 Current recognized text: {result['recognized_text']}")
                
            except Exception as e:
                logger.error(f"❌ Prediction failed: {str(e)}")
                result['prediction_error'] = str(e)
                result['success'] = False
        else:
            logger.info("👋 No hand landmarks found in frame")
        
        logger.info(f"📤 Final result: {result}")
        return result
    
    def reset_session(self):
        """Reset session statistics and recognized text"""
        self.recognized_text = []
        self.last_sign = None
        self.prediction_history.clear()
        self.session_stats = {
            'total_predictions': 0,
            'successful_predictions': 0,
            'signs_detected': set(),
            'session_start': time.time()
        }
        logger.info("🔄 Session reset complete")

# ============================================
# FLASK APP SETUP
# ============================================

app = Flask(__name__)
CORS(app)  # Enable CORS for React frontend

# Global detector instance
detector = None

# All supported signs (18 total)
ALL_SUPPORTED_SIGNS = [
    'HELLO', 'THANKS', 'YES', 'NO', 'PLEASE', 'GOOD',
    'BEAUTIFUL', 'BETTER', 'HAPPY', 'GREAT', 'NAME', 'MY',
    'LOOK', 'TALK', 'SAY', 'ASK', 'EAT', 'DRINK'
]

def initialize_detector():
    """Initialize the enhanced sign language detector"""
    global detector
    try:
        logger.info("🔧 Initializing enhanced sign language detector...")
        logger.info(f"🎯 Target signs ({len(ALL_SUPPORTED_SIGNS)}): {', '.join(ALL_SUPPORTED_SIGNS)}")
        
        # Initialize enhanced classifier
        classifier = SignLanguageClassifier()
        classifier.load_model()  # Will try enhanced_sign_model.pkl first
        
        # Verify model has expected signs
        loaded_signs = list(classifier.idx_to_label.values())
        logger.info(f"📚 Model loaded with {len(loaded_signs)} signs: {loaded_signs}")
        
        # Check coverage
        missing_signs = set(ALL_SUPPORTED_SIGNS) - set(loaded_signs)
        if missing_signs:
            logger.warning(f"⚠️ Model missing some target signs: {missing_signs}")
            logger.info("💡 Consider retraining with all signs for full functionality")
        else:
            logger.info("✅ Model supports all target signs!")
        
        # Test the model
        logger.info("🧪 Testing model with dummy data...")
        dummy_landmarks = [0.5] * 63  # 21 landmarks * 3 coordinates
        try:
            test_sign, test_confidence = classifier.predict(dummy_landmarks)
            test_top_k = classifier.predict_top_k(dummy_landmarks, k=3)
            logger.info(f"✅ Model test successful:")
            logger.info(f"   Main prediction: {test_sign} ({test_confidence:.3f})")
            logger.info(f"   Top 3: {[(p['sign'], p['confidence']) for p in test_top_k]}")
        except Exception as test_error:
            logger.error(f"❌ Model test failed: {str(test_error)}")
            return False
        
        # Initialize enhanced detector
        detector = SignLanguageDetector(classifier)
        logger.info("✅ Enhanced sign language detector initialized successfully!")
        
        return True
    except Exception as e:
        logger.error(f"❌ Failed to initialize detector: {str(e)}")
        import traceback
        logger.error(f"📜 Traceback: {traceback.format_exc()}")
        return False
# ============================================
# ENHANCED API ROUTES - PART 2
# ============================================

@app.route('/api/health', methods=['GET'])
def health_check():
    """Enhanced health check endpoint"""
    detector_info = {}
    if detector is not None:
        detector_info = {
            'signs_supported': list(detector.classifier.idx_to_label.values()),
            'total_signs': len(detector.classifier.idx_to_label),
            'session_stats': {
                'total_predictions': detector.session_stats['total_predictions'],
                'successful_predictions': detector.session_stats['successful_predictions'],
                'unique_signs_detected': len(detector.session_stats['signs_detected']),
                'uptime_seconds': time.time() - detector.session_stats['session_start']
            }
        }
    
    return jsonify({
        'status': 'healthy',
        'message': 'Enhanced Sign Language Detection API is running',
        'api_version': '2.0',
        'detector_loaded': detector is not None,
        'detector_info': detector_info,
        'target_signs_count': len(ALL_SUPPORTED_SIGNS),
        'timestamp': datetime.now().isoformat()
    })

@app.route('/api/detect-sign', methods=['POST'])
def detect_sign():
    """Detect sign from uploaded image file"""
    if detector is None:
        return jsonify({
            'error': 'Detector not initialized. Please check model file.',
            'success': False
        }), 500
    
    try:
        # Get image from request
        if 'image' not in request.files:
            return jsonify({
                'error': 'No image provided',
                'success': False
            }), 400
        
        image_file = request.files['image']
        
        # Convert to OpenCV format
        image_bytes = image_file.read()
        nparr = np.frombuffer(image_bytes, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if frame is None:
            return jsonify({
                'error': 'Invalid image format',
                'success': False
            }), 400
        
        # Process frame with enhanced detector
        result = detector.process_frame(frame)
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"Error in detect_sign: {str(e)}")
        return jsonify({
            'error': f'Detection failed: {str(e)}',
            'success': False
        }), 500

@app.route('/api/detect-sign-base64', methods=['POST'])
def detect_sign_base64():
    """Enhanced detect sign from base64 encoded image"""
    logger.info("🚀 === NEW ENHANCED DETECTION REQUEST ===")
    
    if detector is None:
        logger.error("❌ Detector not initialized")
        return jsonify({
            'error': 'Detector not initialized. Please check model file.',
            'success': False
        }), 500
    
    try:
        # Get request data
        data = request.get_json()
        logger.info(f"📥 Received request data keys: {list(data.keys()) if data else 'None'}")
        
        if 'image' not in data:
            logger.error("❌ No image data in request")
            return jsonify({
                'error': 'No image data provided',
                'success': False
            }), 400
        
        # Decode base64 image
        image_data = data['image']
        logger.info(f"📊 Original image data length: {len(image_data)} characters")
        
        if image_data.startswith('data:image'):
            # Remove data:image/jpeg;base64, prefix
            header, image_data = image_data.split(',', 1)
            logger.info(f"🏷️ Removed header: {header}")
            logger.info(f"📊 Image data after header removal: {len(image_data)} characters")
        
        try:
            image_bytes = base64.b64decode(image_data)
            logger.info(f"🔄 Decoded to {len(image_bytes)} bytes")
        except Exception as decode_error:
            logger.error(f"❌ Base64 decode failed: {str(decode_error)}")
            return jsonify({
                'error': f'Base64 decode failed: {str(decode_error)}',
                'success': False
            }), 400
        
        # Convert to numpy array and decode
        try:
            nparr = np.frombuffer(image_bytes, np.uint8)
            logger.info(f"📈 Numpy array shape: {nparr.shape}, dtype: {nparr.dtype}")
            
            frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            logger.info(f"🖼️ Decoded frame shape: {frame.shape if frame is not None else 'None'}")
            
            if frame is None:
                logger.error("❌ cv2.imdecode returned None - invalid image format")
                return jsonify({
                    'error': 'Invalid image format - cv2.imdecode failed',
                    'success': False
                }), 400
                
            # Log frame statistics
            logger.info(f"📐 Frame info: {frame.shape}, dtype: {frame.dtype}")
            logger.info(f"💡 Brightness stats - Min: {np.min(frame)}, Max: {np.max(frame)}, Mean: {np.mean(frame):.2f}")
            
        except Exception as img_error:
            logger.error(f"❌ Image processing failed: {str(img_error)}")
            return jsonify({
                'error': f'Image processing failed: {str(img_error)}',
                'success': False
            }), 400
        
        # Process frame with enhanced detector
        logger.info("🔍 Starting enhanced frame processing...")
        result = detector.process_frame(frame)
        logger.info(f"✅ Processing complete. Result keys: {list(result.keys())}")
        
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"❌ Unexpected error in detect_sign_base64: {str(e)}")
        logger.error(f"🔍 Error type: {type(e).__name__}")
        import traceback
        logger.error(f"📜 Traceback: {traceback.format_exc()}")
        return jsonify({
            'error': f'Detection failed: {str(e)}',
            'success': False
        }), 500

@app.route('/api/get-recognized-text', methods=['GET'])
def get_recognized_text():
    """Get the current recognized text sequence with enhanced info"""
    if detector is None:
        return jsonify({
            'error': 'Detector not initialized',
            'success': False
        }), 500
    
    return jsonify({
        'recognized_text': ' '.join(detector.recognized_text),
        'signs_array': detector.recognized_text,
        'signs_count': len(detector.recognized_text),
        'last_sign': detector.last_sign,
        'last_sign_time': detector.last_sign_time,
        'unique_signs_in_session': list(detector.session_stats['signs_detected']),
        'session_stats': {
            'total_predictions': detector.session_stats['total_predictions'],
            'successful_predictions': detector.session_stats['successful_predictions'],
            'success_rate': (detector.session_stats['successful_predictions'] / 
                           max(1, detector.session_stats['total_predictions'])),
            'session_duration': time.time() - detector.session_stats['session_start']
        },
        'success': True
    })

@app.route('/api/clear-recognized-text', methods=['POST'])
def clear_recognized_text():
    """Clear the recognized text sequence and reset session"""
    if detector is None:
        return jsonify({
            'error': 'Detector not initialized',
            'success': False
        }), 500
    
    # Store stats before reset
    old_stats = detector.session_stats.copy()
    
    # Reset session
    detector.reset_session()
    
    return jsonify({
        'message': 'Recognized text cleared and session reset',
        'previous_session_stats': {
            'total_predictions': old_stats['total_predictions'],
            'successful_predictions': old_stats['successful_predictions'],
            'unique_signs_detected': len(old_stats['signs_detected']),
            'session_duration': time.time() - old_stats['session_start']
        },
        'success': True
    })

@app.route('/api/model-info', methods=['GET'])
def model_info():
    """Get comprehensive information about the loaded model"""
    if detector is None:
        return jsonify({
            'error': 'Detector not initialized',
            'success': False
        }), 500
    
    classifier = detector.classifier
    loaded_signs = list(classifier.idx_to_label.values())
    
    return jsonify({
        'model_type': 'Enhanced RandomForestClassifier',
        'signs_supported': loaded_signs,
        'total_signs': len(classifier.idx_to_label),
        'target_signs': ALL_SUPPORTED_SIGNS,
        'target_signs_count': len(ALL_SUPPORTED_SIGNS),
        'missing_signs': list(set(ALL_SUPPORTED_SIGNS) - set(loaded_signs)),
        'model_loaded': True,
        'model_config': {
            'confidence_threshold': detector.confidence_threshold,
            'prediction_history_size': detector.prediction_history.maxlen,
            'smoothing_enabled': True
        },
        'api_version': '2.0',
        'success': True
    })

@app.route('/api/detection-stats', methods=['GET'])
def detection_stats():
    """Get comprehensive detection statistics"""
    if detector is None:
        return jsonify({
            'error': 'Detector not initialized',
            'success': False
        }), 500
    
    session_duration = time.time() - detector.session_stats['session_start']
    
    return jsonify({
        'session_stats': {
            'total_predictions': detector.session_stats['total_predictions'],
            'successful_predictions': detector.session_stats['successful_predictions'],
            'success_rate': (detector.session_stats['successful_predictions'] / 
                           max(1, detector.session_stats['total_predictions'])),
            'unique_signs_detected': len(detector.session_stats['signs_detected']),
            'signs_detected_list': list(detector.session_stats['signs_detected']),
            'session_duration_seconds': session_duration,
            'predictions_per_minute': (detector.session_stats['total_predictions'] / 
                                     max(1, session_duration / 60))
        },
        'current_state': {
            'total_signs_recognized': len(detector.recognized_text),
            'prediction_history_length': len(detector.prediction_history),
            'last_detection_time': detector.last_sign_time,
            'current_session_text': ' '.join(detector.recognized_text),
            'last_sign': detector.last_sign
        },
        'model_info': {
            'total_signs_supported': len(detector.classifier.idx_to_label),
            'confidence_threshold': detector.confidence_threshold
        },
        'success': True
    })

@app.route('/api/set-confidence-threshold', methods=['POST'])
def set_confidence_threshold():
    """Set the confidence threshold for sign detection"""
    if detector is None:
        return jsonify({
            'error': 'Detector not initialized',
            'success': False
        }), 500
    
    try:
        data = request.get_json()
        if 'threshold' not in data:
            return jsonify({
                'error': 'No threshold value provided',
                'success': False
            }), 400
        
        threshold = float(data['threshold'])
        if threshold < 0.0 or threshold > 1.0:
            return jsonify({
                'error': 'Threshold must be between 0.0 and 1.0',
                'success': False
            }), 400
        
        old_threshold = detector.confidence_threshold
        detector.confidence_threshold = threshold
        
        return jsonify({
            'message': f'Confidence threshold updated',
            'old_threshold': old_threshold,
            'new_threshold': threshold,
            'success': True
        })
        
    except (ValueError, TypeError) as e:
        return jsonify({
            'error': f'Invalid threshold value: {str(e)}',
            'success': False
        }), 400

@app.route('/api/supported-signs', methods=['GET'])
def supported_signs():
    """Get list of all supported signs"""
    if detector is None:
        return jsonify({
            'error': 'Detector not initialized',
            'success': False
        }), 500
    
    loaded_signs = list(detector.classifier.idx_to_label.values())
    
    # Categorize signs
    original_signs = ['HELLO', 'THANKS', 'YES', 'NO', 'PLEASE', 'GOOD']
    new_signs = ['BEAUTIFUL', 'BETTER', 'HAPPY', 'GREAT', 'NAME', 'MY', 
                 'LOOK', 'TALK', 'SAY', 'ASK', 'EAT', 'DRINK']
    
    available_original = [sign for sign in original_signs if sign in loaded_signs]
    available_new = [sign for sign in new_signs if sign in loaded_signs]
    missing_signs = [sign for sign in ALL_SUPPORTED_SIGNS if sign not in loaded_signs]
    
    return jsonify({
        'all_supported_signs': ALL_SUPPORTED_SIGNS,
        'total_target_signs': len(ALL_SUPPORTED_SIGNS),
        'loaded_signs': loaded_signs,
        'total_loaded_signs': len(loaded_signs),
        'sign_categories': {
            'original_signs': {
                'signs': available_original,
                'count': len(available_original),
                'total_possible': len(original_signs)
            },
            'new_signs': {
                'signs': available_new,
                'count': len(available_new),
                'total_possible': len(new_signs)
            }
        },
        'missing_signs': missing_signs,
        'missing_count': len(missing_signs),
        'coverage_percentage': (len(loaded_signs) / len(ALL_SUPPORTED_SIGNS)) * 100,
        'success': True
    })

@app.route('/api/prediction-confidence', methods=['POST'])
def get_prediction_confidence():
    """Get detailed prediction confidence for specific image"""
    if detector is None:
        return jsonify({
            'error': 'Detector not initialized',
            'success': False
        }), 500
    
    try:
        data = request.get_json()
        if 'image' not in data:
            return jsonify({
                'error': 'No image data provided',
                'success': False
            }), 400
        
        # Decode image
        image_data = data['image']
        if image_data.startswith('data:image'):
            header, image_data = image_data.split(',', 1)
        
        image_bytes = base64.b64decode(image_data)
        nparr = np.frombuffer(image_bytes, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if frame is None:
            return jsonify({
                'error': 'Invalid image format',
                'success': False
            }), 400
        
        # Extract landmarks
        landmarks, _ = detector.extract_landmarks(frame)
        
        if landmarks is None:
            return jsonify({
                'hand_detected': False,
                'message': 'No hand detected in image',
                'success': True
            })
        
        # Get all predictions with confidence scores
        all_predictions = detector.classifier.predict_top_k(landmarks, k=len(detector.classifier.idx_to_label))
        
        return jsonify({
            'hand_detected': True,
            'all_predictions': all_predictions,
            'total_signs': len(all_predictions),
            'highest_confidence': all_predictions[0] if all_predictions else None,
            'above_threshold': [p for p in all_predictions if p['confidence'] > detector.confidence_threshold],
            'confidence_threshold': detector.confidence_threshold,
            'success': True
        })
        
    except Exception as e:
        logger.error(f"Error in prediction_confidence: {str(e)}")
        return jsonify({
            'error': f'Analysis failed: {str(e)}',
            'success': False
        }), 500

@app.route('/api/batch-detect', methods=['POST'])
def batch_detect():
    """Process multiple images in batch"""
    if detector is None:
        return jsonify({
            'error': 'Detector not initialized',
            'success': False
        }), 500
    
    try:
        data = request.get_json()
        if 'images' not in data or not isinstance(data['images'], list):
            return jsonify({
                'error': 'No images array provided',
                'success': False
            }), 400
        
        if len(data['images']) > 10:
            return jsonify({
                'error': 'Maximum 10 images per batch',
                'success': False
            }), 400
        
        results = []
        for i, image_data in enumerate(data['images']):
            try:
                # Decode image
                if image_data.startswith('data:image'):
                    header, image_data = image_data.split(',', 1)
                
                image_bytes = base64.b64decode(image_data)
                nparr = np.frombuffer(image_bytes, np.uint8)
                frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
                
                if frame is not None:
                    result = detector.process_frame(frame)
                    result['image_index'] = i
                    results.append(result)
                else:
                    results.append({
                        'image_index': i,
                        'error': 'Invalid image format',
                        'success': False
                    })
                    
            except Exception as img_error:
                results.append({
                    'image_index': i,
                    'error': f'Processing failed: {str(img_error)}',
                    'success': False
                })
        
        # Summary statistics
        successful_detections = [r for r in results if r.get('hand_detected', False)]
        high_confidence_detections = [r for r in successful_detections 
                                    if r.get('confidence', 0) > detector.confidence_threshold]
        
        return jsonify({
            'batch_results': results,
            'batch_summary': {
                'total_images': len(data['images']),
                'successful_detections': len(successful_detections),
                'high_confidence_detections': len(high_confidence_detections),
                'detection_rate': len(successful_detections) / len(data['images']),
                'confidence_rate': len(high_confidence_detections) / max(1, len(successful_detections))
            },
            'success': True
        })
        
    except Exception as e:
        logger.error(f"Error in batch_detect: {str(e)}")
        return jsonify({
            'error': f'Batch processing failed: {str(e)}',
            'success': False
        }), 500

@app.route('/api/export-session', methods=['GET'])
def export_session():
    """Export session data and statistics"""
    if detector is None:
        return jsonify({
            'error': 'Detector not initialized',
            'success': False
        }), 500
    
    session_duration = time.time() - detector.session_stats['session_start']
    
    export_data = {
        'session_info': {
            'session_start': datetime.fromtimestamp(detector.session_stats['session_start']).isoformat(),
            'session_end': datetime.now().isoformat(),
            'duration_seconds': session_duration,
            'duration_formatted': f"{int(session_duration // 3600):02d}:{int((session_duration % 3600) // 60):02d}:{int(session_duration % 60):02d}"
        },
        'recognition_results': {
            'recognized_text': ' '.join(detector.recognized_text),
            'signs_array': detector.recognized_text,
            'total_signs_recognized': len(detector.recognized_text),
            'unique_signs_used': list(detector.session_stats['signs_detected']),
            'unique_signs_count': len(detector.session_stats['signs_detected'])
        },
        'performance_stats': {
            'total_predictions': detector.session_stats['total_predictions'],
            'successful_predictions': detector.session_stats['successful_predictions'],
            'success_rate': (detector.session_stats['successful_predictions'] / 
                           max(1, detector.session_stats['total_predictions'])),
            'predictions_per_minute': (detector.session_stats['total_predictions'] / 
                                     max(1, session_duration / 60))
        },
        'model_info': {
            'total_signs_supported': len(detector.classifier.idx_to_label),
            'signs_supported': list(detector.classifier.idx_to_label.values()),
            'confidence_threshold': detector.confidence_threshold,
            'api_version': '2.0'
        },
        'export_timestamp': datetime.now().isoformat()
    }
    
    return jsonify({
        'export_data': export_data,
        'success': True
    })

@app.route('/api/video-stream')
def video_stream():
    """Enhanced video stream with real-time detection overlay"""
    def generate():
        cap = cv2.VideoCapture(0)
        cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
        
        while True:
            success, frame = cap.read()
            if not success:
                break
            
            if detector is not None:
                # Process frame for detection
                result = detector.process_frame(frame)
                
                # Draw enhanced detection results on frame
                if result['hand_detected']:
                    # Main prediction
                    cv2.putText(frame, f"Sign: {result['sign']}", (10, 30),
                               cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)
                    cv2.putText(frame, f"Confidence: {result['confidence']:.2f}", (10, 70),
                               cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
                    
                    # Show top predictions
                    if 'top_predictions' in result and result['top_predictions']:
                        y_pos = 110
                        for i, pred in enumerate(result['top_predictions'][:3]):
                            text = f"{i+1}. {pred['sign']}: {pred['confidence']:.2f}"
                            cv2.putText(frame, text, (10, y_pos),
                                       cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 0), 1)
                            y_pos += 25
                    
                    # Show recognized text
                    if 'recognized_text' in result:
                        cv2.putText(frame, f"Text: {result['recognized_text']}", (10, 250),
                                   cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 255), 2)
                else:
                    cv2.putText(frame, "No hand detected", (10, 30),
                               cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 2)
            
            # Encode frame
            ret, buffer = cv2.imencode('.jpg', frame)
            frame_bytes = buffer.tobytes()
            
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
        
        cap.release()
    
    return Response(generate(), mimetype='multipart/x-mixed-replace; boundary=frame')

# ============================================
# ERROR HANDLERS
# ============================================

@app.errorhandler(404)
def not_found(error):
    return jsonify({
        'error': 'Endpoint not found',
        'success': False,
        'available_endpoints': [
            'GET /api/health',
            'POST /api/detect-sign',
            'POST /api/detect-sign-base64',
            'GET /api/get-recognized-text',
            'POST /api/clear-recognized-text',
            'GET /api/model-info',
            'GET /api/detection-stats',
            'POST /api/set-confidence-threshold',
            'GET /api/supported-signs',
            'POST /api/prediction-confidence',
            'POST /api/batch-detect',
            'GET /api/export-session',
            'GET /api/video-stream'
        ]
    }), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({
        'error': 'Internal server error',
        'success': False,
        'message': 'Please check server logs for details'
    }), 500

@app.errorhandler(413)
def payload_too_large(error):
    return jsonify({
        'error': 'Request payload too large',
        'success': False,
        'message': 'Please reduce image size or use batch processing'
    }), 413

# ============================================
# MAIN EXECUTION
# ============================================

if __name__ == '__main__':
    print("\n" + "="*70)
    print(" "*15 + "ENHANCED SIGN LANGUAGE DETECTION API v2.0")
    print("="*70)
    print(f"\n🎯 Supports up to {len(ALL_SUPPORTED_SIGNS)} signs:")
    print("📚 Original Signs: HELLO, THANKS, YES, NO, PLEASE, GOOD")
    print("🆕 New Signs: BEAUTIFUL, BETTER, HAPPY, GREAT, NAME, MY")
    print("          LOOK, TALK, SAY, ASK, EAT, DRINK")
    
    # Initialize enhanced detector
    if initialize_detector():
        print("\n🚀 Starting Enhanced Flask API server...")
        print("\n📡 Available endpoints:")
        print("  GET  /api/health                    - Enhanced health check")
        print("  POST /api/detect-sign              - Detect from image file")
        print("  POST /api/detect-sign-base64       - Detect from base64 image")
        print("  GET  /api/get-recognized-text      - Get recognized text with stats")
        print("  POST /api/clear-recognized-text    - Clear text and reset session")
        print("  GET  /api/model-info              - Comprehensive model info")
        print("  GET  /api/detection-stats         - Detailed detection statistics")
        print("  POST /api/set-confidence-threshold - Adjust confidence threshold")
        print("  GET  /api/supported-signs         - List all supported signs")
        print("  POST /api/prediction-confidence   - Get detailed prediction analysis")
        print("  POST /api/batch-detect           - Process multiple images")
        print("  GET  /api/export-session         - Export session data")
        print("  GET  /api/video-stream           - Enhanced video stream")
        print("\n" + "-"*70)
        print("🔧 Enhanced Features:")
        print("  ✅ Support for up to 18 different signs")
        print("  ✅ Improved smoothing algorithms")
        print("  ✅ Top-K predictions for better insight")
        print("  ✅ Comprehensive session statistics")
        print("  ✅ Adjustable confidence thresholds")
        print("  ✅ Batch processing capabilities")
        print("  ✅ Enhanced error handling and logging")
        print("  ✅ Session export functionality")
        print("\n💡 Usage Tips:")
        print("  - Model will automatically load enhanced_sign_model.pkl if available")
        print("  - Falls back to sign_model.pkl for backward compatibility")
        print("  - Use /api/model-info to check which signs are loaded")
        print("  - Adjust confidence threshold via /api/set-confidence-threshold")
        print("  - Monitor performance with /api/detection-stats")
        print("-"*70 + "\n")
        
        # Configure Flask app
        app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size
        
        # Start the Enhanced Flask development server
        app.run(
            host='0.0.0.0',  # Allow external connections
            port=5000,       # Port 5000
            debug=True,      # Enable debug mode for development
            threaded=True,   # Handle multiple requests
            use_reloader=False  # Prevent double initialization
        )
    else:
        print("\n❌ Failed to start Enhanced API - Detector initialization failed")
        print("\n🔧 Troubleshooting:")
        print("  1. Ensure 'enhanced_sign_model.pkl' or 'sign_model.pkl' exists")
        print("  2. Check that the model was trained with the enhanced script")
        print("  3. Verify all required Python packages are installed")
        print("  4. Check the console logs above for specific error details")
        print("\n💡 To create an enhanced model:")
        print("  python enhanced_sign_translator.py  # Choose option 4 or 1+2")
        print("-"*70)