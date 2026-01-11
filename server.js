import express from 'express';
import ffmpeg from 'fluent-ffmpeg';
import { createCanvas, loadImage } from 'canvas';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.static('public'));
app.use('/temp', express.static('temp'));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/game.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'game.html'));
});

const PORT = 3000;
const PYTHON_API = 'http://localhost:5000';

app.post('/load-video', async (req, res) => {
  const { videoUrl } = req.body;
  
  try {
    console.log('Downloading video from:', videoUrl);
    
    let videoId;
    try {
      const url = new URL(videoUrl);
      videoId = url.searchParams.get('v') || url.pathname.split('/').pop();
    } catch (e) {
      return res.status(400).json({ error: 'Invalid YouTube URL' });
    }
    
    const outputDir = path.join(__dirname, 'temp', videoId);
    const videoPath = path.join(outputDir, 'video.mp4');
    
    if (fs.existsSync(videoPath)) {
      console.log('Video already downloaded');
      return res.json({ 
        success: true, 
        videoPath: `/temp/${videoId}/video.mp4`,
        videoId: videoId
      });
    }
    
    fs.mkdirSync(outputDir, { recursive: true });
    
    console.log('Downloading to:', videoPath);
    try {
      execSync(
        `yt-dlp -f "best[height<=720][ext=mp4]" -o "${videoPath}" "${videoUrl}"`,
        { stdio: 'inherit' }
      );
    } catch (dlError) {
      console.error('Primary download failed, trying alternative...');
      execSync(
        `yt-dlp -f "best[height<=720]" --merge-output-format mp4 -o "${videoPath}" "${videoUrl}"`,
        { stdio: 'inherit' }
      );
    }
    
    if (!fs.existsSync(videoPath)) {
      throw new Error('Video download failed');
    }
    
    const stats = fs.statSync(videoPath);
    console.log(`Video downloaded: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
    
    res.json({ 
      success: true, 
      videoPath: `/temp/${videoId}/video.mp4`,
      videoId: videoId,
      size: stats.size
    });
    
  } catch (error) {
    console.error('Error downloading video:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/process-frame', async (req, res) => {
  const { imageData, confidence = 0.05 } = req.body;
  
  try {
    const response = await axios.post(`${PYTHON_API}/detect`, {
      image: imageData,
      confidence: confidence
    }, {
      timeout: 10000
    });
    
    res.json(response.data);
    
  } catch (error) {
    console.error('Error processing frame:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.post('/cleanup', async (req, res) => {
  const { videoId } = req.body;
  
  try {
    const outputDir = path.join(__dirname, 'temp', videoId);
    if (fs.existsSync(outputDir)) {
      fs.rmSync(outputDir, { recursive: true, force: true });
      console.log('Cleaned up:', videoId);
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log('Make sure Python API is running on http://localhost:5000');
});