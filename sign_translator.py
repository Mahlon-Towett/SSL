#!/usr/bin/env python3
"""
Enhanced Sign Translator with Real-time Web Communication
Integrates your working sign_translator.py with WebSocket server for seamless web integration
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
        
        print("\n🎥 DATA COLLECTION MODE")
        print("="*50)
        print("📋 Instructions:")
        print("  SPACE - Capture sample")
        print("  N - Next sign")
        print("  P - Previous sign") 
        print("  Q - Quit")
        print("="*50)
        
        current_sign_idx = 0
        samples_collected = 0
        target_samples = samples_per_sign
        collecting = False
        
        while current_sign_idx < len(sign_labels):
            ret, frame = cap.read()
            if not ret:
                break
            
            frame = cv2.flip(frame, 1)
            height, width = frame.shape[:2]
            current_sign = sign_labels[current_sign_idx]
            
            # Extract landmarks for preview
            landmarks, landmarks_visual = self.extract_hand_landmarks(frame)
            
            # Draw hand landmarks
            if landmarks_visual:
                self.mp_drawing.draw_landmarks(
                    frame, landmarks_visual, self.mp_hands.HAND_CONNECTIONS)
            
            # UI
            cv2.rectangle(frame, (0, 0), (width, 80), (0, 0, 0), -1)
            cv2.putText(frame, f"Collecting: {current_sign} ({current_sign_idx+1}/{len(sign_labels)})", 
                       (10, 25), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
            cv2.putText(frame, f"Samples: {samples_collected}/{target_samples}", 
                       (10, 50), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
            
            if landmarks:
                cv2.putText(frame, "Hand Detected - Press SPACE", (10, height-20), 
                           cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)
                collecting = True
            else:
                cv2.putText(frame, "Show your hand clearly", (10, height-20), 
                           cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 255), 2)
                collecting = False
            
            cv2.imshow('Sign Data Collection', frame)
            
            key = cv2.waitKey(1) & 0xFF
            if key == ord('q'):
                break
            elif key == ord(' ') and collecting and landmarks:
                self.collected_data.append({
                    'sign': current_sign,
                    'landmarks': landmarks
                })
                samples_collected += 1
                print(f"✅ Captured {current_sign} - Sample {samples_collected}")
                
                if samples_collected >= target_samples:
                    current_sign_idx += 1
                    samples_collected = 0
                    if current_sign_idx < len(sign_labels):
                        print(f"\n➡️  Moving to next sign: {sign_labels[current_sign_idx]}")
                    
            elif key == ord('n'):  # Next sign
                if current_sign_idx < len(sign_labels) - 1:
                    current_sign_idx += 1
                    samples_collected = 0
                    collecting = False
                    print(f"\n➡️  Next sign: {sign_labels[current_sign_idx]}")
                    
            elif key == ord('p'):  # Previous sign
                if current_sign_idx > 0:
                    current_sign_idx -= 1
                    samples_collected = 0
                    collecting = False
                    print(f"\n⬅️  Previous sign: {sign_labels[current_sign_idx]}")
        
        cap.release()
        cv2.destroyAllWindows()
        self.hands.close()
        
        print(f"\n✅ Data collection complete! Total samples: {len(self.collected_data)}")
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
        """Convert collected data to training arrays"""
        X = []
        y = []
        
        self.label_to_idx = {label: idx for idx, label in enumerate(sign_labels)}
        self.idx_to_label = {idx: label for label, idx in self.label_to_idx.items()}
        
        sign_counts = {}
        for sample in collected_data:
            sign = sample['sign']
            sign_counts[sign] = sign_counts.get(sign, 0) + 1
            X.append(sample['landmarks'])
            y.append(self.label_to_idx[sign])
        
        print(f"\n📊 Data Distribution:")
        for sign, count in sorted(sign_counts.items()):
            print(f"  {sign}: {count} samples")
        
        return np.array(X), np.array(y)
    
    def train(self, X, y, test_size=0.2):
        """Train the model"""
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=test_size, random_state=42, stratify=y
        )
        
        print(f"\n🎯 Training Details:")
        print(f"  Training samples: {len(X_train)}")
        print(f"  Testing samples:  {len(X_test)}")
        print(f"  Number of signs:  {len(np.unique(y))}")
        
        print("\n🔄 Training model...")
        self.model.fit(X_train, y_train)
        
        train_pred = self.model.predict(X_train)
        test_pred = self.model.predict(X_test)
        
        train_acc = accuracy_score(y_train, train_pred)
        test_acc = accuracy_score(y_test, test_pred)
        
        print(f"\n📊 Results:")
        print(f"  Training Accuracy: {train_acc:.1%}")
        print(f"  Testing Accuracy:  {test_acc:.1%}")
        
        return train_acc, test_acc
    
    def predict(self, landmarks):
        """Predict sign with confidence"""
        proba = self.model.predict_proba([landmarks])[0]
        class_idx = np.argmax(proba)
        confidence = proba[class_idx]
        return self.idx_to_label[class_idx], confidence
    
    def predict_top_k(self, landmarks, k=3):
        """Get top-k predictions"""
        proba = self.model.predict_proba([landmarks])[0]
        top_indices = np.argsort(proba)[::-1][:k]
        
        predictions = []
        for idx in top_indices:
            predictions.append((self.idx_to_label[idx], proba[idx]))
        
        return predictions
    
    def save_model(self, filepath='enhanced_sign_model.pkl'):
        """Save the trained model"""
        model_data = {
            'model': self.model,
            'label_to_idx': self.label_to_idx,
            'idx_to_label': self.idx_to_label
        }
        with open(filepath, 'wb') as f:
            pickle.dump(model_data, f)
        print(f"💾 Model saved to {filepath}")
    
    def load_model(self, filepath='enhanced_sign_model.pkl'):
        """Load a pre-trained model"""
        with open(filepath, 'rb') as f:
            model_data = pickle.load(f)
        self.model = model_data['model']
        self.label_to_idx = model_data['label_to_idx']
        self.idx_to_label = model_data['idx_to_label']
        print(f"📂 Model loaded from {filepath}")
        print(f"   Available signs: {list(self.label_to_idx.keys())}")

# ============================================
# ENHANCED RECOGNIZER WITH WEB INTEGRATION
# ============================================

class WebIntegratedSignLanguageRecognizer:
    """Enhanced recognizer with WebSocket communication to web interface"""
    
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
        self.websocket_server = None
        self.server_task = None
        
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
    
    async def websocket_handler(self, websocket, path):
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
                'message': 'Connected to sign_translator.py'
            }))
            
            # Keep connection alive
            await websocket.wait_closed()
        except websockets.exceptions.ConnectionClosed:
            pass
        finally:
            print(f"🔌 Web interface disconnected")
            self.websocket_clients.discard(websocket)
    
    async def send_to_web(self, data):
        """Send data to all connected web clients"""
        if self.websocket_clients:
            message = json.dumps(data)
            # Send to all connected clients
            disconnected = set()
            for client in self.websocket_clients:
                try:
                    await client.send(message)
                except websockets.exceptions.ConnectionClosed:
                    disconnected.add(client)
            
            # Remove disconnected clients
            self.websocket_clients -= disconnected
    
    def start_websocket_server(self):
        """Start WebSocket server in background thread"""
        def run_server():
            asyncio.set_event_loop(asyncio.new_event_loop())
            loop = asyncio.get_event_loop()
            
            start_server = websockets.serve(
                self.websocket_handler,
                "localhost",
                8765,  # WebSocket port
                ping_interval=20,
                ping_timeout=10
            )
            
            print(f"🌐 WebSocket server started on ws://localhost:8765")
            print(f"🔗 Web interface can now connect to receive real-time sign detection")
            
            loop.run_until_complete(start_server)
            loop.run_forever()
        
        server_thread = threading.Thread(target=run_server, daemon=True)
        server_thread.start()
        time.sleep(1)  # Give server time to start
    
    def send_detection_update(self, hand_detected, current_sign=None, confidence=0.0, new_text_added=False):
        """Send detection update to web interface"""
        data = {
            'type': 'detection_update',
            'timestamp': datetime.now().isoformat(),
            'hand_detected': hand_detected,
            'current_sign': current_sign,
            'confidence': confidence,
            'recognized_text': self.recognized_text.copy(),
            'full_text': ' '.join(self.recognized_text),
            'new_text_added': new_text_added
        }
        
        # Send asynchronously
        asyncio.run_coroutine_threadsafe(
            self.send_to_web(data),
            asyncio.get_event_loop()
        ).result() if self.websocket_clients else None
    
    def run_recognition_with_web_integration(self):
        """Run recognition with real-time web updates"""
        # Start WebSocket server
        self.start_websocket_server()
        
        cap = cv2.VideoCapture(0)
        cap.set(cv2.CAP_PROP_FRAME_WIDTH, 800)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 600)
        
        print("\n" + "="*60)
        print("🎥 ENHANCED SIGN LANGUAGE RECOGNITION WITH WEB INTEGRATION")
        print("="*60)
        print(f"\n🎯 Available Signs ({len(self.classifier.label_to_idx)}):")
        signs = list(self.classifier.label_to_idx.keys())
        for i, sign in enumerate(signs, 1):
            print(f"  {i:2d}. {sign}")
        
        print(f"\n⚙️ Controls:")
        print("  C - Clear text")
        print("  S - Save text to file")
        print("  T - Toggle confidence threshold")
        print("  Q - Quit")
        
        print(f"\n🌐 Web Integration:")
        print("  WebSocket Server: ws://localhost:8765")
        print("  Connected clients: Updates sent in real-time")
        print("  Your web interface will receive live detection data")
        print("-"*60 + "\n")
        
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            
            frame = cv2.flip(frame, 1)
            height, width = frame.shape[:2]
            
            # Enhanced side panel
            panel_width = 400
            info_panel = np.ones((height, panel_width, 3), dtype=np.uint8) * 40
            
            # Extract landmarks - EXACT SAME logic
            landmarks, landmarks_visual = self.extract_landmarks(frame)
            
            # Title
            cv2.rectangle(frame, (0, 0), (width, 60), (0, 0, 0), -1)
            cv2.putText(frame, "Enhanced Sign Recognition + Web", (10, 40),
                       cv2.FONT_HERSHEY_DUPLEX, 1, (255, 255, 255), 2)
            
            hand_detected = landmarks is not None
            current_sign = None
            confidence = 0.0
            new_text_added = False
            
            if landmarks is not None:
                # Draw hand landmarks
                self.mp_drawing.draw_landmarks(
                    frame, landmarks_visual, self.mp_hands.HAND_CONNECTIONS,
                    self.mp_drawing.DrawingSpec(color=(0,255,0), thickness=2, circle_radius=3),
                    self.mp_drawing.DrawingSpec(color=(255,255,255), thickness=2)
                )
                
                # Get predictions - EXACT SAME logic
                sign, conf = self.classifier.predict(landmarks)
                top_predictions = self.classifier.predict_top_k(landmarks, k=3)
                
                current_sign = sign
                confidence = conf
                
                # Add to history - EXACT SAME logic
                self.prediction_history.append((sign, conf))
                
                # Smooth predictions - EXACT SAME logic
                if len(self.prediction_history) >= 10:
                    recent = [(s, c) for s, c in self.prediction_history 
                             if c > self.confidence_threshold]
                    if recent:
                        signs = [s for s, c in recent]
                        most_common = Counter(signs).most_common(1)
                        if most_common and len(most_common[0]) > 0:
                            detected_sign = most_common[0][0]
                            
                            # Add to text if stable and new - EXACT SAME logic
                            current_time = time.time()
                            if (detected_sign != self.last_sign and 
                                current_time - self.last_sign_time > 1.8):
                                self.recognized_text.append(detected_sign)
                                self.last_sign = detected_sign
                                self.last_sign_time = current_time
                                new_text_added = True
                                print(f"✅ Added: {detected_sign}")
                
                # Display on panel
                cv2.putText(info_panel, f"Sign: {sign}", (20, 100),
                           cv2.FONT_HERSHEY_SIMPLEX, 1.2, (255, 255, 255), 2)
                cv2.putText(info_panel, f"Conf: {conf:.2f}", (20, 140),
                           cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)
                
                # Top predictions
                cv2.putText(info_panel, "Top 3:", (20, 200),
                           cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 0), 2)
                for i, (pred_sign, pred_conf) in enumerate(top_predictions):
                    y_pos = 230 + i * 30
                    cv2.putText(info_panel, f"{i+1}. {pred_sign} ({pred_conf:.2f})", 
                               (25, y_pos), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (200, 200, 200), 2)
            
            # Send update to web interface
            self.send_detection_update(hand_detected, current_sign, confidence, new_text_added)
            
            # Display recognized text
            cv2.putText(info_panel, "Recognized Text:", (20, 320),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 0), 2)
            
            if self.recognized_text:
                text_lines = []
                current_line = ""
                words_per_line = 3
                
                for i, word in enumerate(self.recognized_text):
                    if i > 0 and i % words_per_line == 0:
                        text_lines.append(current_line.strip())
                        current_line = word + " "
                    else:
                        current_line += word + " "
                
                if current_line.strip():
                    text_lines.append(current_line.strip())
                
                for i, line in enumerate(text_lines[-5:]):  # Show last 5 lines
                    y_pos = 350 + i * 25
                    cv2.putText(info_panel, line, (20, y_pos),
                               cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
            
            # Status
            cv2.putText(info_panel, f"WebSocket clients: {len(self.websocket_clients)}", 
                       (20, height-60), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 255), 1)
            cv2.putText(info_panel, f"Threshold: {self.confidence_threshold:.1f}", 
                       (20, height-35), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
            cv2.putText(info_panel, f"Total words: {len(self.recognized_text)}", 
                       (20, height-10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
            
            # Combine frame and panel
            combined = np.hstack([frame, info_panel])
            cv2.imshow('Enhanced Sign Recognition + Web Integration', combined)
            
            # Handle keyboard input
            key = cv2.waitKey(1) & 0xFF
            if key == ord('q'):
                break
            elif key == ord('c'):
                self.recognized_text.clear()
                print("🗑️ Text cleared")
            elif key == ord('s'):
                if self.recognized_text:
                    timestamp = time.strftime("%Y%m%d_%H%M%S")
                    filename = f'recognized_text_{timestamp}.txt'
                    with open(filename, 'w') as f:
                        f.write(' '.join(self.recognized_text))
                    print(f"💾 Text saved to {filename}")
            elif key == ord('t'):
                thresholds = [0.5, 0.6, 0.7, 0.8, 0.9]
                current_idx = thresholds.index(self.confidence_threshold) if self.confidence_threshold in thresholds else 2
                next_idx = (current_idx + 1) % len(thresholds)
                self.confidence_threshold = thresholds[next_idx]
                print(f"🎯 Confidence threshold set to: {self.confidence_threshold:.1f}")
        
        cap.release()
        cv2.destroyAllWindows()
        self.hands.close()
        
        if self.recognized_text:
            print("\n" + "="*60)
            print("📝 FINAL RECOGNIZED TEXT:")
            print(' '.join(self.recognized_text))
            print("="*60)

# ============================================
# MAIN PROGRAM WITH WEB INTEGRATION
# ============================================

def main():
    """Main execution function with web integration"""
    
    SIGN_LABELS = [
        'HELLO', 'THANKS', 'YES', 'NO', 'PLEASE', 'GOOD',
        'BEAUTIFUL', 'BETTER', 'HAPPY', 'GREAT', 'NAME', 'MY',
        'LOOK', 'TALK', 'SAY', 'ASK', 'EAT', 'DRINK'
    ]
    
    print("\n" + "="*70)
    print(" "*15 + "ENHANCED SIGN LANGUAGE RECOGNITION WITH WEB INTEGRATION")
    print("="*70)
    print(f"\n📚 Available Signs ({len(SIGN_LABELS)}):")
    
    for i in range(0, len(SIGN_LABELS), 3):
        row = SIGN_LABELS[i:i+3]
        print("  " + "".join(f"{sign:<12}" for sign in row))
    
    print(f"\n🎯 Choose an option:")
    print("  1. Collect training data")
    print("  2. Train model") 
    print("  3. Run recognition with web integration 🌐")
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
            
            print("\n🌐 Starting Web-Integrated Recognition...")
            print("🔗 This will start a WebSocket server that your web interface can connect to")
            print("📡 Real-time detection data will be sent to your webpage")
            
            recognizer = WebIntegratedSignLanguageRecognizer(classifier)
            recognizer.run_recognition_with_web_integration()
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