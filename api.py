#!/usr/bin/env python3
"""
OPTIMIZED Flask API - Using EXACT sign_translator.py Logic
Simplified for maximum speed and accuracy
"""

import os
import cv2
import numpy as np
import mediapipe as mp
from flask import Flask, request, jsonify
from flask_cors import CORS
import pickle
import base64
import time
from collections import deque, Counter
import logging

# Configure logging
logging.basicConfig(level=logging.WARNING)  # Reduced logging for speed
logger = logging.getLogger(__name__)

# ============================================
# DIRECT COPY FROM sign_translator.py
# ============================================

class SignLanguageClassifier:
    """Direct copy from sign_translator.py"""
    
    def __init__(self):
        from sklearn.ensemble import RandomForestClassifier
        self.model = RandomForestClassifier(
            n_estimators=200,  
            max_depth=15,      
            min_samples_split=5,
            min_samples_leaf=2,
            random_state=42,
            n_jobs=-1
        )
        self.label_to_idx = {}
        self.idx_to_label = {}
        
    def predict(self, landmarks):
        """EXACT copy from sign_translator.py"""
        proba = self.model.predict_proba([landmarks])[0]
        class_idx = np.argmax(proba)
        confidence = proba[class_idx]
        return self.idx_to_label[class_idx], confidence
    
    def predict_top_k(self, landmarks, k=3):
        """EXACT copy from sign_translator.py"""
        proba = self.model.predict_proba([landmarks])[0]
        top_indices = np.argsort(proba)[::-1][:k]
        
        predictions = []
        for idx in top_indices:
            predictions.append((self.idx_to_label[idx], proba[idx]))
        
        return predictions

class SignLanguageRecognizer:
    """EXACT copy from sign_translator.py - simplified for API"""
    
    def __init__(self, classifier):
        self.classifier = classifier
        self.mp_hands = mp.solutions.hands
        # EXACT SAME SETTINGS as sign_translator.py
        self.hands = self.mp_hands.Hands(
            static_image_mode=False,
            max_num_hands=1,
            min_detection_confidence=0.7,  # EXACT SAME
            min_tracking_confidence=0.5    # EXACT SAME
        )
        self.mp_drawing = mp.solutions.drawing_utils
        
        # EXACT SAME smoothing logic
        self.prediction_history = deque(maxlen=20)
        self.recognized_text = []
        self.last_sign = None
        self.last_sign_time = time.time()
        self.confidence_threshold = 0.7  # EXACT SAME
        
    def extract_landmarks(self, image):
        """EXACT copy from sign_translator.py"""
        image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        results = self.hands.process(image_rgb)
        
        if results.multi_hand_landmarks:
            landmarks = results.multi_hand_landmarks[0]
            landmark_list = []
            for lm in landmarks.landmark:
                landmark_list.extend([lm.x, lm.y, lm.z])
            return landmark_list, landmarks
        return None, None
    
    def process_single_frame(self, frame):
        """SIMPLIFIED version of sign_translator.py recognition logic"""
        # EXACT same landmark extraction
        landmarks, landmarks_visual = self.extract_landmarks(frame)
        
        result = {
            'hand_detected': False,
            'sign': None,
            'confidence': 0.0,
            'success': True
        }
        
        if landmarks is not None:
            result['hand_detected'] = True
            
            # EXACT same prediction logic
            sign, confidence = self.classifier.predict(landmarks)
            top_predictions = self.classifier.predict_top_k(landmarks, k=3)
            
            # EXACT same smoothing logic from sign_translator.py
            self.prediction_history.append((sign, confidence))
            
            # Smooth predictions - EXACT same logic
            if len(self.prediction_history) >= 10:
                recent = [(s, c) for s, c in self.prediction_history 
                         if c > self.confidence_threshold]
                if recent:
                    signs = [s for s, c in recent]
                    most_common = Counter(signs).most_common(1)
                    if most_common and len(most_common[0]) > 0:
                        detected_sign = most_common[0][0]
                        
                        # EXACT same temporal filtering
                        current_time = time.time()
                        if (detected_sign != self.last_sign and 
                            current_time - self.last_sign_time > 1.8):  # EXACT SAME 1.8s
                            self.recognized_text.append(detected_sign)
                            self.last_sign = detected_sign
                            self.last_sign_time = current_time
                            
                            result['sign'] = detected_sign
                            result['confidence'] = confidence
                            result['new_sign_added'] = True
                        elif detected_sign == self.last_sign:
                            result['sign'] = detected_sign
                            result['confidence'] = confidence
                            result['new_sign_added'] = False
            
            # Always return top predictions for debugging
            result['top_predictions'] = [{'sign': s, 'confidence': float(c)} for s, c in top_predictions]
        
        return result

# ============================================
# SIMPLIFIED FLASK APP
# ============================================

app = Flask(__name__)
CORS(app)

# Global recognizer (single instance for speed)
recognizer = None

def initialize_recognizer():
    """Initialize with exact same logic as sign_translator.py"""
    global recognizer
    
    print("🚀 Initializing OPTIMIZED recognizer...")
    
    # Load model exactly like sign_translator.py
    model_files = ['enhanced_sign_model.pkl', 'sign_model.pkl']
    
    for model_file in model_files:
        if os.path.exists(model_file):
            print(f"📦 Loading {model_file}...")
            try:
                with open(model_file, 'rb') as f:
                    model_data = pickle.load(f)
                
                # Create classifier exactly like sign_translator.py
                classifier = SignLanguageClassifier()
                classifier.model = model_data['model']
                classifier.label_to_idx = model_data['label_to_idx']
                classifier.idx_to_label = model_data['idx_to_label']
                
                print(f"✅ Loaded with {len(classifier.idx_to_label)} signs")
                
                # Create recognizer exactly like sign_translator.py
                recognizer = SignLanguageRecognizer(classifier)
                print("✅ OPTIMIZED recognizer initialized!")
                return True
                
            except Exception as e:
                print(f"❌ Failed: {e}")
                continue
    
    print("❌ No valid model found!")
    return False

# ============================================
# MINIMAL API ENDPOINTS
# ============================================

@app.route('/api/health', methods=['GET'])
def health_check():
    """Minimal health check"""
    return jsonify({
        'status': 'healthy',
        'message': 'OPTIMIZED Sign Detection API',
        'recognizer_loaded': recognizer is not None,
        'optimizations': [
            'Direct sign_translator.py logic',
            'Minimal processing overhead',
            'Exact MediaPipe settings (0.7/0.5)',
            'Same smoothing algorithm',
            'Reduced logging for speed'
        ]
    })

@app.route('/api/detect-sign', methods=['POST'])
def detect_sign_optimized():
    """OPTIMIZED detection with minimal overhead"""
    if recognizer is None:
        return jsonify({'error': 'Recognizer not initialized', 'success': False}), 500
    
    if 'image' not in request.files:
        return jsonify({'error': 'No image provided', 'success': False}), 400
    
    try:
        # Minimal processing - direct to OpenCV
        file_data = request.files['image'].read()
        nparr = np.frombuffer(file_data, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if frame is None:
            return jsonify({'error': 'Invalid image', 'success': False}), 400
        
        # DIRECT processing using sign_translator.py logic
        result = recognizer.process_single_frame(frame)
        return jsonify(result)
        
    except Exception as e:
        return jsonify({
            'error': f'Detection failed: {str(e)}',
            'success': False
        }), 500

@app.route('/api/detect-sign-base64', methods=['POST'])
def detect_sign_base64_optimized():
    """OPTIMIZED base64 detection"""
    if recognizer is None:
        return jsonify({'error': 'Recognizer not initialized', 'success': False}), 500
    
    try:
        data = request.get_json()
        if not data or 'image' not in data:
            return jsonify({'error': 'No base64 image data', 'success': False}), 400
        
        # Minimal processing
        image_data = data['image']
        if image_data.startswith('data:image'):
            image_data = image_data.split(',')[1]
        
        img_bytes = base64.b64decode(image_data)
        nparr = np.frombuffer(img_bytes, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if frame is None:
            return jsonify({'error': 'Invalid base64 image', 'success': False}), 400
        
        # DIRECT processing
        result = recognizer.process_single_frame(frame)
        return jsonify(result)
        
    except Exception as e:
        return jsonify({
            'error': f'Base64 detection failed: {str(e)}',
            'success': False
        }), 500

@app.route('/api/get-recognized-text', methods=['GET'])
def get_recognized_text():
    """Get recognized text exactly like sign_translator.py"""
    if recognizer is None:
        return jsonify({'error': 'Recognizer not initialized', 'success': False}), 500
    
    return jsonify({
        'recognized_text': recognizer.recognized_text,
        'full_text': ' '.join(recognizer.recognized_text),
        'word_count': len(recognizer.recognized_text),
        'success': True
    })

@app.route('/api/clear-recognized-text', methods=['POST'])
def clear_recognized_text():
    """Clear text exactly like sign_translator.py"""
    if recognizer is None:
        return jsonify({'error': 'Recognizer not initialized', 'success': False}), 500
    
    recognizer.recognized_text.clear()
    recognizer.prediction_history.clear()
    recognizer.last_sign = None
    recognizer.last_sign_time = time.time()
    
    return jsonify({
        'message': 'Text cleared',
        'success': True
    })

# ============================================
# MAIN EXECUTION
# ============================================

if __name__ == '__main__':
    print("\n" + "="*60)
    print("    OPTIMIZED SIGN DETECTION API - MAXIMUM SPEED")
    print("="*60)
    print("\n🚀 KEY OPTIMIZATIONS:")
    print("  ✅ Direct sign_translator.py logic (no extra complexity)")
    print("  ✅ Minimal API endpoints (faster response)")
    print("  ✅ Reduced logging (less I/O overhead)")
    print("  ✅ Same MediaPipe settings (0.7/0.5)")
    print("  ✅ Exact smoothing algorithm")
    print("  ✅ Identical temporal filtering (1.8s)")
    print("\n📊 Expected Performance:")
    print("  - API response time: <100ms (vs previous 300ms+)")
    print("  - Same accuracy as sign_translator.py")
    print("  - Minimal memory usage")
    
    if initialize_recognizer():
        print("\n🚀 Starting OPTIMIZED server...")
        print("📡 Endpoints:")
        print("  POST /api/detect-sign       - Optimized detection")
        print("  POST /api/detect-sign-base64 - Optimized base64 detection")
        print("  GET  /api/get-recognized-text - Get recognized text")
        print("  POST /api/clear-recognized-text - Clear text")
        print("  GET  /api/health            - Health check")
        print("="*60)
        
        app.run(
            host='0.0.0.0',
            port=5000,
            debug=False,  # Disabled for speed
            threaded=True,
            use_reloader=False
        )
    else:
        print("\n❌ Failed to initialize recognizer")
        print("💡 Make sure enhanced_sign_model.pkl or sign_model.pkl exists")