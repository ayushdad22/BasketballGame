# Basketball Backboard Detection System

A real-time basketball backboard detection system using YOLOv8 and a web interface.

## Prerequisites

### Install Nix

**macOS and Linux:**
```bash
curl -L https://nixos.org/nix/install | sh
```

After installation, restart your terminal or run:
```bash
source ~/.nix-profile/etc/profile.d/nix.sh
```

**Windows:**

Install WSL2 (Windows Subsystem for Linux) first:
1. Open PowerShell as Administrator
2. Run: `wsl --install`
3. Restart your computer
4. Open WSL and install Nix:
```bash
curl -L https://nixos.org/nix/install | sh
```

### Verify Nix Installation

```bash
nix --version
```
### Open Nix Environment

```bash
nix develop
```
## Setup

### 1. Get the Dataset

Place your training data in the `Data/` folder with the following structure:
```
Data/
├── train/
│   ├── images
│   └── _annotations.csv
├── valid/
│   ├── images
│   └── _annotations.csv
└── test/
    ├── images
    └── _annotations.csv
```

### 2. Train the YOLO Model

```bash
python python/train_yolo.py
```

This will:
- Convert your dataset to YOLO format
- Train the YOLOv8 model
- Save the best model to `yolo_runs/backboard_detector/weights/best.pt`

### 3. Install Frontend Dependencies

```bash
npm install
```

### 4. Run the Application

Start both the backend API server and frontend in separate terminals:

**Terminal 1 - Backend API:**
```bash
python python/api_server.py
```

**Terminal 2 - Frontend:**
```bash
npm start
```

The application should now be running. Open your browser and navigate to the local development URL shown in Terminal 2.

## Project Structure

```
.
├── Data/                  # Training dataset
├── python/
│   ├── train_yolo.py     # Model training script
│   └── api_server.py     # Backend API server
├── yolo_dataset/         # Generated YOLO format dataset
├── yolo_runs/            # Training runs and model weights
├── server.js             # Server file for js
└── package.json          # Frontend dependencies
```

## Notes

- The `Data/` folder contains large image files and is not tracked in Git
- Model weights (`.pt` files) are also ignored except for the base model
- Make sure both servers are running simultaneously for the application to work
