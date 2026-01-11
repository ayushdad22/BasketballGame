from flask import Flask, request, jsonify
from flask_cors import CORS
from ultralytics import YOLO
import cv2
import numpy as np
import base64
import io
from PIL import Image
import os

app = Flask(__name__)
CORS(app)

# Load YOLO model
MODEL_PATH = '/home/ayush/Documents/TensorFlow Basketball/yolo_runs/backboard_detector/weights/best.pt'

model = None
if os.path.exists(MODEL_PATH):
    try:
        model = YOLO(MODEL_PATH)
        print(f"✓ YOLO model loaded successfully from: {MODEL_PATH}")
    except Exception as e:
        print(f"✗ Failed to load YOLO model: {e}")
        exit(1)
else:
    print(f"ERROR: Model not found at {MODEL_PATH}")
    exit(1)

@app.route('/detect', methods=['POST'])
def detect_backboard():
    try:
        data = request.json
        image_data = data['image'].split(',')[1]  # Remove data:image/jpeg;base64,
        
        # Get custom confidence threshold from request (default: 0.25)
        # For broadcast footage, frontend can send lower threshold like 0.01
        conf_threshold = float(data.get('confidence', 0.25))
        
        # Decode image
        image_bytes = base64.b64decode(image_data)
        image = Image.open(io.BytesIO(image_bytes))
        image = np.array(image)
        
        if len(image.shape) == 2:  # Grayscale
            image = cv2.cvtColor(image, cv2.COLOR_GRAY2RGB)
        elif image.shape[2] == 4:  # RGBA
            image = cv2.cvtColor(image, cv2.COLOR_RGBA2RGB)
        
        orig_h, orig_w = image.shape[:2]
        
        # Run YOLO inference with custom confidence threshold
        results = model(image, verbose=False, conf=conf_threshold)[0]
        
        # Check if any detections were made
        if len(results.boxes) == 0:
            # Try with very low threshold to see if anything is detected
            results_low = model(image, verbose=False, conf=0.001)[0]
            max_conf = float(results_low.boxes.conf.max()) if len(results_low.boxes) > 0 else 0.0
            
            return jsonify({
                'detected': False,
                'message': f'No backboard detected at threshold {conf_threshold:.2f}. Highest confidence seen: {max_conf:.3f}',
                'xmin': 0.0,
                'ymin': 0.0,
                'xmax': 0.0,
                'ymax': 0.0,
                'width': orig_w,
                'height': orig_h,
                'confidence': 0.0,
                'max_confidence_available': max_conf
            })
        
        # Get the highest confidence detection
        boxes = results.boxes
        best_idx = boxes.conf.argmax()
        box = boxes.xyxy[best_idx].cpu().numpy()
        confidence = float(boxes.conf[best_idx].cpu().numpy())
        
        # Convert to normalized coordinates (0-1)
        xmin = float(box[0] / orig_w)
        ymin = float(box[1] / orig_h)
        xmax = float(box[2] / orig_w)
        ymax = float(box[3] / orig_h)
        
        # Clamp to valid range
        xmin = max(0.0, min(1.0, xmin))
        ymin = max(0.0, min(1.0, ymin))
        xmax = max(0.0, min(1.0, xmax))
        ymax = max(0.0, min(1.0, ymax))
        
        # Return normalized coordinates (0-1)
        result = {
            'detected': True,
            'xmin': xmin,
            'ymin': ymin,
            'xmax': xmax,
            'ymax': ymax,
            'width': orig_w,
            'height': orig_h,
            'confidence': confidence,
            'num_detections': len(results.boxes)
        }
        
        return jsonify(result)
        
    except Exception as e:
        print(f"Error in detection: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'ok', 
        'model_loaded': model is not None,
        'model_type': 'YOLOv8',
        'model_path': MODEL_PATH,
        'training_performance': {
            'mAP50': 0.973,
            'precision': 0.966,
            'recall': 0.915
        }
    })

if __name__ == '__main__':
    print("="*50)
    print("YOLO Backboard Detection API Server")
    print("="*50)
    print(f"Model loaded: {model is not None}")
    print(f"Model path: {MODEL_PATH}")
    print(f"Training stats: 97.3% mAP50, 96.6% precision")
    print(f"\nConfidence threshold guidance:")
    print(f"  - Close-up images: 0.3 (default)")
    print(f"  - Broadcast footage: 0.01-0.05 (adaptive)")
    print(f"Server starting on http://0.0.0.0:5000")
    print("="*50)
    app.run(host='0.0.0.0', port=5000, debug=True)