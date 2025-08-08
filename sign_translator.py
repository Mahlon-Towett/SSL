#!/usr/bin/env python3
"""
Web-Fed Sign Translator
Modified sign_translator.py to receive video frames from website and send back detected text
"""

import cv2
import numpy as np
import mediapipe as mp
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score
import pickle
import time
from collections import deque, Counter
import os
import asyncio
import websockets
import json
import threading
from datetime import datetime
import base64

# ============================================
# ORIGINAL CLASSES (UNCHANGED)
# ============================================

class SignLanguageDataCollector:
    """Original data collector - unchanged"""
    
    def __init__(self):
        self.mp_hands = mp.solutions.hands
        self.hands = self.mp_hands.Hands(
            static_image_mode=False,
            max_num_hands=1,
            min_detection_confidence=0.7,
            min_tracking_confidence=0.5
        )
        self.mp_drawing = mp.solutions.drawing_utils
        self.collected_data = []
        
    def extract_hand_landmarks(self, image):
        """Extract 21 hand landmarks from image"""
        image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        results = self.hands.process(image_rgb)
        
        if results.multi_hand_landmarks:
            landmarks = results.multi_hand_landmarks[0]
            landmark_list = []
            for lm in landmarks.landmark:
                landmark_list.extend([lm.x, lm.y, lm.z])
            return landmark_list, landmarks
        return None, None
    
    def collect_samples(self, sign_labels, samples_per_sign=30):
        """Collect training samples for each sign"""
        cap = cv2.VideoCapture(0)
        cap.set(cv2.CAP_PROP_FRAME_WIDTH, 800)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 600)
        
        for sign in sign_labels:
            print(f"\n📋 Collecting samples for: {sign}")
            print("🎯 Position your hand and press SPACE to collect samples")
            print("⚠️  Press 'q' to skip this sign")
            
            sample_count = 0
            
            while sample_count < samples_per_sign:
                ret, frame = cap.read()
                if not ret:
                    break
                
                # Create a copy for display
                display_frame = frame.copy()
                cv2.putText(display_frame, f"Sign: {sign}", (20, 50),
                           cv2.FONT_HERSHEY_SIMPLEX, 1.5, (0, 255, 0), 3)
                cv2.putText(display_frame, f"Samples: {sample_count}/{samples_per_sign}", (20, 100),
                           cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)
                cv2.putText(display_frame, "Press SPACE to capture", (20, 150),
                           cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 0), 2)
                
                landmarks, landmarks_visual = self.extract_hand_landmarks(frame)
                
                if landmarks_visual:
                    self.mp_drawing.draw_landmarks(
                        display_frame, landmarks_visual, mp.solutions.hands.HAND_CONNECTIONS)
                
                cv2.imshow('Data Collection', display_frame)
                
                key = cv2.waitKey(1) & 0xFF
                if key == ord(' ') and landmarks:  # Space to capture
                    self.collected_data.append({
                        'landmarks': landmarks,
                        'label': sign
                    })
                    sample_count += 1
                    print(f"✅ Captured sample {sample_count}")
                elif key == ord('q'):  # Skip sign
                    print(f"⏭️ Skipped {sign}")
                    break
                
        cap.release()
        cv2.destroyAllWindows()
        self.hands.close()
        return self.collected_data

class SignLanguageClassifier:
    """Original classifier - unchanged"""
    
    def __init__(self):
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
        
    def prepare_data(self, collected_data, sign_labels):
        """Prepare data for training"""
        X, y = [], []
        
        for sample in collected_data:
            if sample['label'] in sign_labels:
                X.append(sample['landmarks'])
                y.append(sample['label'])
        
        # Create label mappings
        unique_labels = sorted(list(set(y)))
        self.label_to_idx = {label: idx for idx, label in enumerate(unique_labels)}
        self.idx_to_label = {idx: label for label, idx in self.label_to_idx.items()}
        
        # Convert labels to indices
        y_encoded = [self.label_to_idx[label] for label in y]
        
        return np.array(X), np.array(y_encoded)
    
    def train(self, X, y):
        """Train the classifier"""
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
        
        print("🚀 Training model...")
        start_time = time.time()
        self.model.fit(X_train, y_train)
        training_time = time.time() - start_time
        
        y_pred = self.model.predict(X_test)
        accuracy = accuracy_score(y_test, y_pred)
        
        print(f"✅ Training completed in {training_time:.2f} seconds")
        print(f"📊 Test Accuracy: {accuracy:.4f} ({accuracy*100:.2f}%)")
        print(f"🎯 Total Signs: {len(self.label_to_idx)}")
        
        return accuracy
    
    def predict(self, landmarks):
        """Predict sign from landmarks"""
        proba = self.model.predict_proba([landmarks])[0]
        class_idx = np.argmax(proba)
        confidence = proba[class_idx]
        return self.idx_to_label[class_idx], confidence
    
    def predict_top_k(self, landmarks, k=3):
        """Get top k predictions"""
        proba = self.model.predict_proba([landmarks])[0]
        top_indices = np.argsort(proba)[::-1][:k]
        
        predictions = []
        for idx in top_indices:
            predictions.append((self.idx_to_label[idx], proba[idx]))
        
        return predictions
    
    def save_model(self, filename):
        """Save trained model"""
        model_data = {
            'model': self.model,
            'label_to_idx': self.label_to_idx,
            'idx_to_label': self.idx_to_label
        }
        with open(filename, 'wb') as f:
            pickle.dump(model_data, f)
        print(f"💾 Model saved to {filename}")
    
    def load_model(self, filename):
        """Load trained model"""
        with open(filename, 'rb') as f:
            model_data = pickle.load(f)
        
        self.model = model_data['model']
        self.label_to_idx = model_data['label_to_idx']
        self.idx_to_label = model_data['idx_to_label']
        
        print(f"📦 Model loaded from {filename}")
        print(f"🎯 Available signs: {len(self.label_to_idx)}")

# ============================================
# WEB-FED RECOGNIZER CLASS
# ============================================

class WebFedSignLanguageRecognizer:
    """Enhanced recognizer that receives frames from website"""
    
    def __init__(self, classifier):
        self.classifier = classifier
        self.mp_hands = mp.solutions.hands
        # EXACT SAME SETTINGS as working version
        self.hands = self.mp_hands.Hands(
            static_image_mode=False,
            max_num_hands=1,
            min_detection_confidence=0.7,
            min_tracking_confidence=0.5
        )
        self.mp_drawing = mp.solutions.drawing_utils
        
        # EXACT SAME smoothing logic
        self.prediction_history = deque(maxlen=20)
        self.recognized_text = []
        self.last_sign = None
        self.last_sign_time = time.time()
        self.confidence_threshold = 0.7
        
        # WebSocket communication
        self.websocket_clients = set()
        self.processing_stats = {
            'frames_processed': 0,
            'detections_made': 0,
            'start_time': time.time()
        }
        
    def extract_landmarks(self, image):
        """EXACT SAME as working version"""
        image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        results = self.hands.process(image_rgb)
        
        if results.multi_hand_landmarks:
            landmarks = results.multi_hand_landmarks[0]
            landmark_list = []
            for lm in landmarks.landmark:
                landmark_list.extend([lm.x, lm.y, lm.z])
            return landmark_list, landmarks
        return None, None

    def process_frame_from_web(self, frame_data):
        """Process a frame received from the website"""
        try:
            # Decode base64 frame
            frame_bytes = base64.b64decode(frame_data.split(',')[1])
            frame_array = np.frombuffer(frame_bytes, dtype=np.uint8)
            frame = cv2.imdecode(frame_array, cv2.IMREAD_COLOR)
            
            if frame is None:
                return None
            
            self.processing_stats['frames_processed'] += 1
            
            # Extract landmarks from frame
            landmarks, landmarks_visual = self.extract_landmarks(frame)
            
            hand_detected = landmarks is not None
            current_sign = None
            confidence = 0.0
            new_text_added = False
            top_predictions = []
            
            if hand_detected:
                # Get prediction
                sign, conf = self.classifier.predict(landmarks)
                top_predictions = self.classifier.predict_top_k(landmarks, k=5)  # Get top 5 for debugging
                
                # DEBUG: Print top predictions to console
                print(f"🔍 DEBUG - Top predictions:")
                for i, (pred_sign, pred_conf) in enumerate(top_predictions, 1):
                    print(f"   {i}. {pred_sign}: {pred_conf:.3f}")
                
                # ALWAYS use the top prediction regardless of confidence
                detected_sign = sign  # This is already the highest confidence prediction
                current_sign = detected_sign
                confidence = conf
                
                print(f"🎯 Selected: {detected_sign} (Confidence: {conf:.3f})")
                
                # Apply smoothing but accept ANY confidence level
                self.prediction_history.append((sign, conf))
                
                if len(self.prediction_history) >= 3:  # Reduced history for faster response
                    # Get most common recent prediction (no confidence filtering)
                    recent_predictions = [pred for pred, conf_val in list(self.prediction_history)[-5:]]  # Last 5 predictions
                    
                    if recent_predictions:
                        most_common = Counter(recent_predictions).most_common(1)
                        if most_common:
                            stable_sign = most_common[0][0]
                            
                            # Add to text if stable and new (reduced time filter)
                            current_time = time.time()
                            if (stable_sign != self.last_sign and 
                                current_time - self.last_sign_time > 1.0):  # Reduced from 1.8 to 1.0 seconds
                                self.recognized_text.append(stable_sign)
                                self.last_sign = stable_sign
                                self.last_sign_time = current_time
                                new_text_added = True
                                self.processing_stats['detections_made'] += 1
                                print(f"✅ Added: {stable_sign} (Confidence: {conf:.2f})")
            
            # Return detection results
            return {
                'hand_detected': hand_detected,
                'current_sign': current_sign,
                'confidence': confidence,
                'recognized_text': self.recognized_text.copy(),
                'full_text': ' '.join(self.recognized_text),
                'new_text_added': new_text_added,
                'top_predictions': [(sign, float(conf)) for sign, conf in top_predictions],
                'processing_stats': self.processing_stats.copy()
            }
            
        except Exception as e:
            print(f"❌ Error processing frame: {e}")
            return None

    async def websocket_handler(self, websocket):
        """Handle WebSocket connections from web interface"""
        print(f"🔗 Web interface connected from {websocket.remote_address}")
        self.websocket_clients.add(websocket)
        
        try:
            # Send initial status
            await websocket.send(json.dumps({
                'type': 'status',
                'connected': True,
                'available_signs': list(self.classifier.label_to_idx.keys()),
                'total_signs': len(self.classifier.label_to_idx),
                'message': 'Connected to Web-Fed Sign Translator',
                'recognized_text': self.recognized_text.copy()
            }))
            
            # Handle incoming messages
            async for message in websocket:
                try:
                    data = json.loads(message)
                    
                    if data.get('type') == 'frame':
                        # Process the frame
                        result = self.process_frame_from_web(data.get('frame_data'))
                        
                        if result:
                            # Send back detection results
                            await websocket.send(json.dumps({
                                'type': 'detection_result',
                                'timestamp': datetime.now().isoformat(),
                                **result
                            }))
                    
                    elif data.get('type') == 'clear_text':
                        # Clear recognized text
                        self.recognized_text.clear()
                        self.prediction_history.clear()
                        self.last_sign = None
                        self.last_sign_time = time.time()
                        print("🗑️ Text cleared by web interface")
                        
                        await websocket.send(json.dumps({
                            'type': 'text_cleared',
                            'message': 'Recognized text cleared',
                            'recognized_text': []
                        }))
                    
                    elif data.get('type') == 'get_stats':
                        # Send processing statistics
                        runtime = time.time() - self.processing_stats['start_time']
                        fps = self.processing_stats['frames_processed'] / runtime if runtime > 0 else 0
                        
                        await websocket.send(json.dumps({
                            'type': 'stats',
                            'processing_stats': self.processing_stats.copy(),
                            'runtime_seconds': runtime,
                            'fps': fps,
                            'total_words': len(self.recognized_text)
                        }))
                        
                except json.JSONDecodeError:
                    print("⚠️ Invalid JSON received from web interface")
                except Exception as e:
                    print(f"⚠️ Error handling message: {e}")
                    
        except websockets.exceptions.ConnectionClosed:
            pass
        except Exception as e:
            print(f"⚠️ WebSocket error: {e}")
        finally:
            print(f"🔌 Web interface disconnected")
            self.websocket_clients.discard(websocket)

    def start_websocket_server(self):
        """Start WebSocket server"""
        async def run_server():
            print(f"🌐 Starting Web-Fed WebSocket server on ws://localhost:8765")
            print(f"🔗 Web interface can now connect to send frames and receive detection results")
            
            server = await websockets.serve(
                self.websocket_handler,
                "0.0.0.0",
                8765,  # WebSocket port
                ping_interval=30,
                ping_timeout=20,
                max_size=10_000_000,  # 10MB max message size for large images
                max_queue=32,
                compression=None  # Disable compression for speed
            )
            
            print("✅ WebSocket server started successfully!")
            print("📋 Commands:")
            print("  - Send frames: {'type': 'frame', 'frame_data': 'data:image/jpeg;base64,...'}")
            print("  - Clear text: {'type': 'clear_text'}")
            print("  - Get stats: {'type': 'get_stats'}")
            
            await server.wait_closed()
        
        # Run server in background thread
        def run_loop():
            asyncio.set_event_loop(asyncio.new_event_loop())
            loop = asyncio.get_event_loop()
            loop.run_until_complete(run_server())
        
        server_thread = threading.Thread(target=run_loop, daemon=True)
        server_thread.start()
        time.sleep(2)  # Give server more time to start
        
        return server_thread

    def run_web_fed_recognition(self):
        """Run the web-fed recognition system"""
        # Start WebSocket server
        self.start_websocket_server()
        
        print("\n" + "="*60)
        print("🎥 WEB-FED SIGN LANGUAGE RECOGNITION")
        print("="*60)
        print(f"\n🎯 Available Signs ({len(self.classifier.label_to_idx)}):")
        signs = list(self.classifier.label_to_idx.keys())
        for i, sign in enumerate(signs, 1):
            if i % 6 == 1:
                print()  # New line every 6 signs
            print(f"  {sign:<12}", end="")
        
        print(f"\n\n📡 WebSocket Server Status:")
        print(f"  🔗 URL: ws://localhost:8765")
        print(f"  📊 Confidence Threshold: DISABLED (always use top prediction)")
        print(f"  🎯 Temporal Filter: 1.0 seconds")
        print(f"  📝 Total Recognized Words: {len(self.recognized_text)}")
        
        print(f"\n📋 Web Interface Commands:")
        print(f"  🎥 Send frame: {{'type': 'frame', 'frame_data': '...'}} ")
        print(f"  🗑️ Clear text: {{'type': 'clear_text'}}")
        print(f"  📊 Get stats: {{'type': 'get_stats'}}")
        
        print(f"\n🎮 Keyboard Commands:")
        print(f"  ⌨️  Press 'c' + Enter to clear recognized text")
        print(f"  ⌨️  Press 's' + Enter to show statistics")
        print(f"  ⌨️  Press 'q' + Enter to quit")
        print("-" * 60)
        
        # Keep server running and handle keyboard input
        try:
            while True:
                user_input = input().strip().lower()
                
                if user_input == 'q':
                    print("🛑 Shutting down...")
                    break
                elif user_input == 'c':
                    self.recognized_text.clear()
                    self.prediction_history.clear()
                    self.last_sign = None
                    self.last_sign_time = time.time()
                    print("🗑️ Text cleared")
                elif user_input == 's':
                    runtime = time.time() - self.processing_stats['start_time']
                    fps = self.processing_stats['frames_processed'] / runtime if runtime > 0 else 0
                    print(f"\n📊 PROCESSING STATISTICS:")
                    print(f"  🎥 Frames processed: {self.processing_stats['frames_processed']}")
                    print(f"  🎯 Detections made: {self.processing_stats['detections_made']}")
                    print(f"  ⏱️  Runtime: {runtime:.1f} seconds")
                    print(f"  📈 FPS: {fps:.1f}")
                    print(f"  👥 Connected clients: {len(self.websocket_clients)}")
                    print(f"  📝 Recognized words: {len(self.recognized_text)}")
                    if self.recognized_text:
                        print(f"  📜 Current text: {' '.join(self.recognized_text)}")
                
        except KeyboardInterrupt:
            print("\n🛑 Shutting down...")
        
        self.hands.close()
        
        if self.recognized_text:
            print("\n" + "="*60)
            print("📝 FINAL RECOGNIZED TEXT:")
            print(' '.join(self.recognized_text))
            print("="*60)

# ============================================
# MAIN PROGRAM
# ============================================

def main():
    """Main execution function"""
    
    SIGN_LABELS = [
        'HELLO', 'THANKS', 'YES', 'NO', 'PLEASE', 'GOOD',
        'BEAUTIFUL', 'BETTER', 'HAPPY', 'GREAT', 'NAME', 'MY',
        'LOOK', 'TALK', 'SAY', 'ASK', 'EAT', 'DRINK'
    ]
    
    print("\n" + "="*70)
    print(" "*15 + "WEB-FED SIGN LANGUAGE RECOGNITION")
    print("="*70)
    print(f"\n📚 Available Signs ({len(SIGN_LABELS)}):")
    
    for i in range(0, len(SIGN_LABELS), 3):
        row = SIGN_LABELS[i:i+3]
        print("  " + "".join(f"{sign:<12}" for sign in row))
    
    print(f"\n🎯 Choose an option:")
    print("  1. Collect training data")
    print("  2. Train model") 
    print("  3. Run web-fed recognition 🌐")
    print("  4. Complete setup (1 + 2 + 3)")
    print("  5. Add data to existing dataset")
    print("-"*70)
    
    choice = input("\nEnter choice (1-5): ").strip()
    
    if choice in ['1', '4', '5']:
        collector = SignLanguageDataCollector()
        
        if choice == '5' and os.path.exists('sign_data.pkl'):
            with open('sign_data.pkl', 'rb') as f:
                existing_data = pickle.load(f)
            print(f"📂 Loaded {len(existing_data)} existing samples")
            
            new_data = collector.collect_samples(SIGN_LABELS, samples_per_sign=30)
            all_data = existing_data + new_data
            print(f"📊 Total samples after combining: {len(all_data)}")
        else:
            all_data = collector.collect_samples(SIGN_LABELS, samples_per_sign=30)
        
        with open('sign_data.pkl', 'wb') as f:
            pickle.dump(all_data, f)
        print(f"💾 Data saved to sign_data.pkl")
        
        if choice in ['1', '5']:
            return
    
    if choice in ['2', '4']:
        if os.path.exists('sign_data.pkl'):
            with open('sign_data.pkl', 'rb') as f:
                data = pickle.load(f)
            print(f"📂 Loaded {len(data)} samples")
        else:
            print("❌ No data found! Please collect data first.")
            return
        
        classifier = SignLanguageClassifier()
        X, y = classifier.prepare_data(data, SIGN_LABELS)
        classifier.train(X, y)
        classifier.save_model('enhanced_sign_model.pkl')
        
        if choice == '2':
            return
    
    if choice in ['3', '4']:
        model_file = 'enhanced_sign_model.pkl' if os.path.exists('enhanced_sign_model.pkl') else 'sign_model.pkl'
        
        if os.path.exists(model_file):
            classifier = SignLanguageClassifier()
            classifier.load_model(model_file)
            
            print("\n🌐 Starting Web-Fed Recognition...")
            print("🔗 This will receive video frames from your website")
            print("📡 Detection results will be sent back to the website")
            
            recognizer = WebFedSignLanguageRecognizer(classifier)
            recognizer.run_web_fed_recognition()
        else:
            print("❌ No trained model found! Please train first.")
            return
    
    if choice not in ['1', '2', '3', '4', '5']:
        print("❌ Invalid choice!")

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n🛑 Program stopped by user")
    except Exception as e:
        print(f"\n❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()