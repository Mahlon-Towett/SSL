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

# ============================================
# PART 1: DATA COLLECTION
# ============================================

class SignLanguageDataCollector:
    """Collect hand landmark data for different signs"""
    
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
            # Flatten landmarks to a list of coordinates
            landmark_list = []
            for lm in landmarks.landmark:
                landmark_list.extend([lm.x, lm.y, lm.z])
            return landmark_list, landmarks
        return None, None
    
    def collect_samples(self, sign_labels, samples_per_sign=30):
        """Collect training samples for each sign"""
        cap = cv2.VideoCapture(0)
        cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
        
        current_sign_idx = 0
        samples_collected = 0
        collecting = False
        
        print(f"\n📹 Collecting data for signs: {sign_labels}")
        print("\nInstructions:")
        print("  SPACE - Start/Stop collecting")
        print("  N - Next sign")
        print("  Q - Quit")
        print("-" * 40)
        
        while current_sign_idx < len(sign_labels):
            ret, frame = cap.read()
            if not ret:
                break
                
            frame = cv2.flip(frame, 1)  # Mirror image
            current_sign = sign_labels[current_sign_idx]
            
            # Extract landmarks
            landmarks_data, landmarks_visual = self.extract_hand_landmarks(frame)
            
            # Draw landmarks if detected
            if landmarks_visual:
                self.mp_drawing.draw_landmarks(
                    frame, landmarks_visual, self.mp_hands.HAND_CONNECTIONS,
                    self.mp_drawing.DrawingSpec(color=(0,255,0), thickness=2, circle_radius=2),
                    self.mp_drawing.DrawingSpec(color=(255,255,255), thickness=2)
                )
            
            # Create info overlay
            overlay = frame.copy()
            cv2.rectangle(overlay, (0, 0), (640, 140), (0, 0, 0), -1)
            frame = cv2.addWeighted(overlay, 0.3, frame, 0.7, 0)
            
            # Display status
            status = "🔴 RECORDING" if collecting else "⚪ READY"
            color = (0, 255, 0) if collecting else (0, 150, 255)
            
            cv2.putText(frame, f"Sign: {current_sign}", (20, 35),
                       cv2.FONT_HERSHEY_DUPLEX, 1.2, (255, 255, 255), 2)
            cv2.putText(frame, status, (20, 75),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.9, color, 2)
            cv2.putText(frame, f"Progress: {samples_collected}/{samples_per_sign}", 
                       (20, 110), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 255), 2)
            
            # Progress bar
            bar_width = int((samples_collected / samples_per_sign) * 400)
            cv2.rectangle(frame, (220, 90), (620, 115), (100, 100, 100), 2)
            cv2.rectangle(frame, (222, 92), (222 + bar_width, 113), (0, 255, 0), -1)
            
            # Collect data if in collecting mode
            if collecting and landmarks_data and samples_collected < samples_per_sign:
                self.collected_data.append({
                    'sign': current_sign,
                    'landmarks': landmarks_data
                })
                samples_collected += 1
                time.sleep(0.1)  # Small delay between samples
                
                if samples_collected >= samples_per_sign:
                    collecting = False
                    print(f"✅ Completed '{current_sign}' ({samples_collected} samples)")
            
            # Hand detection indicator
            if landmarks_data:
                cv2.circle(frame, (600, 35), 15, (0, 255, 0), -1)
                cv2.putText(frame, "Hand OK", (520, 70), 
                           cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)
            else:
                cv2.circle(frame, (600, 35), 15, (0, 0, 255), -1)
                cv2.putText(frame, "No Hand", (520, 70), 
                           cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 255), 2)
            
            cv2.imshow('Sign Language Data Collection', frame)
            
            key = cv2.waitKey(1) & 0xFF
            if key == ord('q'):
                break
            elif key == ord(' '):  # Space bar
                if landmarks_data:  # Only start if hand is detected
                    collecting = not collecting
                    if collecting:
                        print(f"🔴 Recording '{current_sign}'...")
                    else:
                        print(f"⏸️  Paused at {samples_collected} samples")
            elif key == ord('n'):  # Next sign
                if samples_collected >= 10:  # Minimum samples required
                    current_sign_idx += 1
                    samples_collected = 0
                    collecting = False
                    if current_sign_idx < len(sign_labels):
                        print(f"\n➡️  Next sign: {sign_labels[current_sign_idx]}")
                else:
                    print(f"⚠️  Need at least 10 samples! Currently: {samples_collected}")
        
        cap.release()
        cv2.destroyAllWindows()
        self.hands.close()
        
        print(f"\n✅ Data collection complete! Total samples: {len(self.collected_data)}")
        return self.collected_data

# ============================================
# PART 2: MODEL TRAINING (Using sklearn)
# ============================================

class SignLanguageClassifier:
    """Simple and reliable classifier using Random Forest"""
    
    def __init__(self):
        # Random Forest is robust and works well for this task
        self.model = RandomForestClassifier(
            n_estimators=100,
            max_depth=10,
            random_state=42,
            n_jobs=-1  # Use all CPU cores
        )
        self.label_to_idx = {}
        self.idx_to_label = {}
        
    def prepare_data(self, collected_data, sign_labels):
        """Convert collected data to training arrays"""
        X = []
        y = []
        
        # Create label mappings
        self.label_to_idx = {label: idx for idx, label in enumerate(sign_labels)}
        self.idx_to_label = {idx: label for label, idx in self.label_to_idx.items()}
        
        for sample in collected_data:
            X.append(sample['landmarks'])
            y.append(self.label_to_idx[sample['sign']])
        
        return np.array(X), np.array(y)
    
    def train(self, X, y, test_size=0.2):
        """Train the model with train/test split"""
        # Split the data
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=test_size, random_state=42, stratify=y
        )
        
        print(f"Training on {len(X_train)} samples...")
        print(f"Testing on {len(X_test)} samples...")
        
        # Train the model
        self.model.fit(X_train, y_train)
        
        # Evaluate
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
        # Get prediction probabilities
        proba = self.model.predict_proba([landmarks])[0]
        class_idx = np.argmax(proba)
        confidence = proba[class_idx]
        
        return self.idx_to_label[class_idx], confidence
    
    def save_model(self, filepath='sign_model.pkl'):
        """Save the trained model"""
        model_data = {
            'model': self.model,
            'label_to_idx': self.label_to_idx,
            'idx_to_label': self.idx_to_label
        }
        with open(filepath, 'wb') as f:
            pickle.dump(model_data, f)
        print(f"💾 Model saved to {filepath}")
    
    def load_model(self, filepath='sign_model.pkl'):
        """Load a pre-trained model"""
        with open(filepath, 'rb') as f:
            model_data = pickle.load(f)
        self.model = model_data['model']
        self.label_to_idx = model_data['label_to_idx']
        self.idx_to_label = model_data['idx_to_label']
        print(f"📂 Model loaded from {filepath}")

# ============================================
# PART 3: REAL-TIME RECOGNITION
# ============================================

class SignLanguageRecognizer:
    """Real-time sign language recognition with enhanced UI"""
    
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
        
        # For smoothing predictions
        self.prediction_history = deque(maxlen=15)
        self.recognized_text = []
        self.last_sign = None
        self.last_sign_time = time.time()
        
    def extract_landmarks(self, image):
        """Extract hand landmarks"""
        image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        results = self.hands.process(image_rgb)
        
        if results.multi_hand_landmarks:
            landmarks = results.multi_hand_landmarks[0]
            landmark_list = []
            for lm in landmarks.landmark:
                landmark_list.extend([lm.x, lm.y, lm.z])
            return landmark_list, landmarks
        return None, None
    
    def run_recognition(self):
        """Run real-time recognition with enhanced UI"""
        cap = cv2.VideoCapture(0)
        cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
        
        print("\n" + "="*50)
        print("🎥 SIGN LANGUAGE RECOGNITION STARTED")
        print("="*50)
        print("\nControls:")
        print("  C - Clear text")
        print("  S - Save text to file")
        print("  Q - Quit")
        print("-"*50 + "\n")
        
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            
            frame = cv2.flip(frame, 1)
            height, width = frame.shape[:2]
            
            # Create side panel for information
            panel_width = 350
            info_panel = np.ones((height, panel_width, 3), dtype=np.uint8) * 40
            
            # Extract landmarks
            landmarks, landmarks_visual = self.extract_landmarks(frame)
            
            # Title on main frame
            cv2.rectangle(frame, (0, 0), (width, 50), (0, 0, 0), -1)
            cv2.putText(frame, "Sign Language Recognition", (10, 35),
                       cv2.FONT_HERSHEY_DUPLEX, 1, (255, 255, 255), 2)
            
            if landmarks is not None:
                # Draw hand landmarks
                self.mp_drawing.draw_landmarks(
                    frame, landmarks_visual, self.mp_hands.HAND_CONNECTIONS,
                    self.mp_drawing.DrawingSpec(color=(0,255,0), thickness=2, circle_radius=3),
                    self.mp_drawing.DrawingSpec(color=(255,255,255), thickness=2)
                )
                
                # Get prediction
                sign, confidence = self.classifier.predict(landmarks)
                
                # Add to history
                self.prediction_history.append((sign, confidence))
                
                # Smooth predictions
                if len(self.prediction_history) >= 8:
                    recent = [(s, c) for s, c in self.prediction_history if c > 0.6]
                    if recent:
                        signs = [s for s, c in recent]
                        most_common = Counter(signs).most_common(1)
                        if most_common:
                            detected_sign = most_common[0][0]
                            
                            # Add to text if it's stable and new
                            current_time = time.time()
                            if (detected_sign != self.last_sign and 
                                current_time - self.last_sign_time > 1.5):
                                self.recognized_text.append(detected_sign)
                                self.last_sign = detected_sign
                                self.last_sign_time = current_time
                
                # Display current detection on panel
                cv2.putText(info_panel, "CURRENT DETECTION", (20, 40),
                           cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
                
                # Sign name with colored background
                color = (0, 255, 0) if confidence > 0.7 else (0, 165, 255)
                cv2.rectangle(info_panel, (15, 60), (335, 120), color, -1)
                cv2.putText(info_panel, sign, (30, 100),
                           cv2.FONT_HERSHEY_DUPLEX, 1.2, (255, 255, 255), 2)
                
                # Confidence bar
                cv2.putText(info_panel, f"Confidence", (20, 150),
                           cv2.FONT_HERSHEY_SIMPLEX, 0.6, (200, 200, 200), 1)
                bar_length = int(confidence * 300)
                cv2.rectangle(info_panel, (20, 160), (320, 180), (100, 100, 100), 2)
                cv2.rectangle(info_panel, (22, 162), (22 + bar_length, 178), color, -1)
                cv2.putText(info_panel, f"{confidence:.0%}", (280, 150),
                           cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 1)
                
                # Hand indicator
                cv2.circle(frame, (width - 30, 25), 10, (0, 255, 0), -1)
            else:
                cv2.putText(info_panel, "NO HAND DETECTED", (20, 90),
                           cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 255), 2)
                cv2.circle(frame, (width - 30, 25), 10, (0, 0, 255), -1)
            
            # Display recognized text on panel
            cv2.putText(info_panel, "RECOGNIZED TEXT", (20, 230),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
            cv2.line(info_panel, (20, 240), (330, 240), (100, 100, 100), 2)
            
            # Word wrap text
            text_y = 270
            words = self.recognized_text[-20:]  # Last 20 words
            line = ""
            for word in words:
                test_line = line + word + " "
                if len(test_line) > 25:
                    if line:
                        cv2.putText(info_panel, line.strip(), (20, text_y),
                                   cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 255), 1)
                        text_y += 25
                    line = word + " "
                else:
                    line = test_line
            
            if line:
                cv2.putText(info_panel, line.strip(), (20, text_y),
                           cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 255), 1)
            
            # Instructions at bottom
            cv2.putText(info_panel, "C: Clear | S: Save | Q: Quit", (20, height - 20),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.5, (150, 150, 150), 1)
            
            # Combine frame and panel
            display = np.hstack([frame, info_panel])
            cv2.imshow('Sign Language Recognition System', display)
            
            key = cv2.waitKey(1) & 0xFF
            if key == ord('q'):
                break
            elif key == ord('c'):
                self.recognized_text = []
                print("🗑️  Text cleared!")
            elif key == ord('s'):
                if self.recognized_text:
                    with open('recognized_text.txt', 'w') as f:
                        f.write(' '.join(self.recognized_text))
                    print(f"💾 Text saved to recognized_text.txt")
        
        cap.release()
        cv2.destroyAllWindows()
        self.hands.close()
        
        # Print final text
        if self.recognized_text:
            print("\n" + "="*50)
            print("📝 FINAL RECOGNIZED TEXT:")
            print(' '.join(self.recognized_text))
            print("="*50)

# ============================================
# MAIN PROGRAM
# ============================================

def main():
    """Main execution function"""
    
    # Signs to recognize - start simple!
    SIGN_LABELS = [
        'HELLO',
        'THANKS',
        'YES',
        'NO',
        'PLEASE',
        'GOOD'
    ]
    
    print("\n" + "="*60)
    print(" "*15 + "SIGN LANGUAGE RECOGNITION SYSTEM")
    print("="*60)
    print("\n📚 Available Signs:", ', '.join(SIGN_LABELS))
    print("\n🎯 Choose an option:")
    print("  1. Collect training data")
    print("  2. Train model") 
    print("  3. Run real-time recognition")
    print("  4. Complete setup (1 + 2 + 3)")
    print("-"*60)
    
    choice = input("\nEnter choice (1-4): ").strip()
    
    if choice in ['1', '4']:
        # Collect data
        collector = SignLanguageDataCollector()
        data = collector.collect_samples(SIGN_LABELS, samples_per_sign=30)
        
        # Save data
        with open('sign_data.pkl', 'wb') as f:
            pickle.dump(data, f)
        print(f"💾 Data saved to sign_data.pkl")
        
        if choice == '1':
            return
    
    if choice in ['2', '4']:
        # Load data
        if os.path.exists('sign_data.pkl'):
            with open('sign_data.pkl', 'rb') as f:
                data = pickle.load(f)
            print(f"📂 Loaded {len(data)} samples")
        else:
            print("❌ No data found! Please collect data first.")
            return
        
        # Train model
        classifier = SignLanguageClassifier()
        X, y = classifier.prepare_data(data, SIGN_LABELS)
        classifier.train(X, y)
        classifier.save_model('sign_model.pkl')
        
        if choice == '2':
            return
    
    if choice in ['3', '4']:
        # Load model and run recognition
        if os.path.exists('sign_model.pkl'):
            classifier = SignLanguageClassifier()
            classifier.load_model('sign_model.pkl')
            
            recognizer = SignLanguageRecognizer(classifier)
            recognizer.run_recognition()
        else:
            print("❌ No trained model found! Please train first.")
            return
    
    if choice not in ['1', '2', '3', '4']:
        print("❌ Invalid choice!")

if __name__ == "__main__":
    main()