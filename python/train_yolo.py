from ultralytics import YOLO
import os
import pandas as pd
from pathlib import Path
import shutil

def convert_to_yolo_format():
    """Convert your dataset to YOLO format"""
    
    # Create YOLO dataset structure
    yolo_dir = Path('yolo_dataset')
    for split in ['train', 'valid', 'test']:
        (yolo_dir / split / 'images').mkdir(parents=True, exist_ok=True)
        (yolo_dir / split / 'labels').mkdir(parents=True, exist_ok=True)
    
    # Convert annotations
    for split in ['train', 'valid', 'test']:
        csv_path = f'Data/{split}/_annotations.csv'
        if not os.path.exists(csv_path):
            continue
            
        df = pd.read_csv(csv_path)
        print(f"Converting {len(df)} images from {split}...")
        
        for _, row in df.iterrows():
            img_path = f'Data/{split}/{row["filename"]}'
            
            if not os.path.exists(img_path):
                continue
            
            # Copy image
            dest_img = yolo_dir / split / 'images' / row['filename']
            shutil.copy(img_path, dest_img)
            
            # Convert bbox to YOLO format (x_center, y_center, width, height) normalized
            img_w, img_h = row['width'], row['height']
            x_center = ((row['xmin'] + row['xmax']) / 2) / img_w
            y_center = ((row['ymin'] + row['ymax']) / 2) / img_h
            width = (row['xmax'] - row['xmin']) / img_w
            height = (row['ymax'] - row['ymin']) / img_h
            
            # Save label file (class 0 for backboard)
            label_file = yolo_dir / split / 'labels' / row['filename'].replace('.jpg', '.txt')
            with open(label_file, 'w') as f:
                f.write(f"0 {x_center:.6f} {y_center:.6f} {width:.6f} {height:.6f}\n")
        
        print(f"  Converted {split}: {len(list((yolo_dir / split / 'images').glob('*.jpg')))} images")
    
    # Create dataset.yaml
    yaml_content = f"""
path: {yolo_dir.absolute()}
train: train/images
val: valid/images
test: test/images

nc: 1
names: ['backboard']
"""
    
    with open(yolo_dir / 'dataset.yaml', 'w') as f:
        f.write(yaml_content)
    
    print(f"\nDataset converted! Config saved to {yolo_dir / 'dataset.yaml'}")
    return yolo_dir / 'dataset.yaml'

def train_yolo():
    """Train YOLOv8 model"""
    
    # Convert dataset
    dataset_yaml = convert_to_yolo_format()
    
    # Load a pretrained YOLOv8 nano model
    model = YOLO('yolov8n.pt')
    
    print("\n" + "="*60)
    print("Starting YOLOv8 Training")
    print("="*60)
    
    # Train the model
    results = model.train(
        data=str(dataset_yaml),
        epochs=100,
        imgsz=640,
        batch=16,
        patience=20,
        save=True,
        project='yolo_runs',
        name='backboard_detector',
        exist_ok=True,
        pretrained=True,
        verbose=True
    )
    
    print("\n" + "="*60)
    print("Training Complete!")
    print("="*60)
    print(f"Best model saved to: yolo_runs/backboard_detector/weights/best.pt")
    
    return model

if __name__ == '__main__':
    model = train_yolo()