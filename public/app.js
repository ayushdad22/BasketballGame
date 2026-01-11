let video, canvas, ctx;
let isDetecting = false;
let currentVideoId = null;
let stats = {
  framesProcessed: 0,
  detectionsCount: 0,
  totalConfidence: 0,
  startTime: null,
  lastUpdateTime: Date.now()
};

document.addEventListener('DOMContentLoaded', init);

function init() {
  video = document.getElementById('videoPlayer');
  canvas = document.getElementById('canvas');
  ctx = canvas.getContext('2d');

  setupEventListeners();
}

function setupEventListeners() {
  document.getElementById('confidence').addEventListener('input', (e) => {
    document.getElementById('confidenceValue').textContent = e.target.value + '%';
  });

  document.getElementById('speed').addEventListener('input', (e) => {
    const speeds = ['Very Slow', 'Slow', 'Medium-Slow', 'Medium', 'Medium-Fast', 
                   'Fast', 'Very Fast', 'Ultra Fast', 'Maximum', 'Turbo'];
    document.getElementById('speedValue').textContent = speeds[e.target.value - 1];
  });

  video.addEventListener('loadedmetadata', () => {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    document.getElementById('toggleBtn').disabled = false;
    showStatus('Video loaded successfully. Click Start Detection to begin.', 'success');
  });

  document.getElementById('loadBtn').addEventListener('click', loadVideo);
  document.getElementById('toggleBtn').addEventListener('click', toggleDetection);

  window.addEventListener('beforeunload', cleanup);
}

async function loadVideo() {
  const url = document.getElementById('videoUrl').value.trim();

  if (!url) {
    showStatus('Please enter a YouTube URL', 'warning');
    return;
  }

  showStatus('Downloading video. This may take a moment.', 'info');
  document.getElementById('loadBtn').disabled = true;
  document.getElementById('toggleBtn').disabled = true;

  try {
    const response = await fetch('/load-video', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoUrl: url })
    });

    const data = await response.json();

    if (data.success) {
      currentVideoId = data.videoId;
      video.src = data.videoPath + '?t=' + Date.now();
      document.getElementById('videoContainer').classList.add('show');
      document.getElementById('stats').classList.add('show');
      showStatus('Video loaded successfully.', 'success');
    } else {
      showStatus('Failed to load video: ' + data.error, 'error');
      document.getElementById('loadBtn').disabled = false;
    }
  } catch (error) {
    showStatus('Error: ' + error.message, 'error');
    document.getElementById('loadBtn').disabled = false;
  } finally {
    document.getElementById('loadBtn').disabled = false;
  }
}

function toggleDetection() {
  isDetecting = !isDetecting;
  const btn = document.getElementById('toggleBtn');
  const text = btn.querySelector('span');

  if (isDetecting) {
    btn.innerHTML = '<i data-lucide="pause"></i><span>Stop Detection</span>';
    btn.classList.remove('btn-secondary');
    btn.classList.add('btn-primary');
    showStatus('Detection active. Processing frames in real-time.', 'info');
    
    stats = { 
      framesProcessed: 0, 
      detectionsCount: 0, 
      totalConfidence: 0,
      startTime: Date.now(),
      lastUpdateTime: Date.now()
    };
    
    video.play();
    processFrame();
  } else {
    btn.innerHTML = '<i data-lucide="play"></i><span>Start Detection</span>';
    btn.classList.remove('btn-primary');
    btn.classList.add('btn-secondary');
    showStatus('Detection paused.', 'info');
  }

  lucide.createIcons();
}

async function processFrame() {
  if (!isDetecting || video.paused || video.ended) {
    if (video.ended) {
      showStatus('Video ended. Processed ' + stats.framesProcessed + ' frames.', 'success');
      isDetecting = false;
      const btn = document.getElementById('toggleBtn');
      btn.innerHTML = '<i data-lucide="play"></i><span>Start Detection</span>';
      btn.classList.remove('btn-primary');
      btn.classList.add('btn-secondary');
      lucide.createIcons();
    }
    return;
  }

  try {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = video.videoWidth;
    tempCanvas.height = video.videoHeight;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(video, 0, 0);
    const imageData = tempCanvas.toDataURL('image/jpeg', 0.7);

    const confidence = parseInt(document.getElementById('confidence').value) / 100;
    const response = await fetch('/process-frame', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageData, confidence })
    });

    const result = await response.json();

    if (!result.detected && result.max_confidence_available > 0) {
      console.warn(`No detection at ${(confidence*100).toFixed(0)}% threshold. Found detection at ${(result.max_confidence_available*100).toFixed(1)}%`);
    }

    if (result.detected && result.confidence >= confidence) {
      drawDetection(result);
      stats.detectionsCount++;
      stats.totalConfidence += result.confidence;
    }

    stats.framesProcessed++;
    updateStats();

    if (stats.framesProcessed === 20 && stats.detectionsCount === 0) {
      showStatus('No detections yet. Try lowering the confidence threshold to 1-3% for broadcast footage.', 'warning');
    }

  } catch (error) {
    console.error('Detection error:', error);
    showStatus('Detection error: ' + error.message, 'error');
  }

  const speed = parseInt(document.getElementById('speed').value);
  const delay = Math.max(100, 600 - (speed * 50));
  setTimeout(processFrame, delay);
}

function drawDetection(result) {
  const x1 = result.xmin * canvas.width;
  const y1 = result.ymin * canvas.height;
  const x2 = result.xmax * canvas.width;
  const y2 = result.ymax * canvas.height;

  ctx.strokeStyle = '#10b981';
  ctx.lineWidth = 3;
  ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);

  ctx.fillStyle = '#ef4444';
  const corners = [[x1, y1], [x2, y1], [x2, y2], [x1, y2]];
  corners.forEach(([x, y]) => {
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.fillStyle = 'rgba(16, 185, 129, 0.9)';
  const label = `${(result.confidence * 100).toFixed(1)}%`;
  ctx.font = '600 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto';
  const textWidth = ctx.measureText(label).width;
  ctx.fillRect(x1, y1 - 32, textWidth + 16, 32);

  ctx.fillStyle = '#ffffff';
  ctx.fillText(label, x1 + 8, y1 - 10);
}

function updateStats() {
  document.getElementById('framesProcessed').textContent = stats.framesProcessed;
  document.getElementById('detectionsCount').textContent = stats.detectionsCount;

  const avgConf = stats.detectionsCount > 0 
    ? (stats.totalConfidence / stats.detectionsCount * 100).toFixed(1)
    : 0;
  document.getElementById('avgConfidence').textContent = avgConf + '%';

  if (stats.startTime) {
    const elapsed = (Date.now() - stats.startTime) / 1000;
    const fps = (stats.framesProcessed / elapsed).toFixed(1);
    document.getElementById('fps').textContent = fps;
  }
}

function showStatus(message, type) {
  const status = document.getElementById('status');
  status.className = `alert show ${type}`;
  const hasSpinner = type === 'info' && message.includes('Downloading');
  status.innerHTML = hasSpinner 
    ? `<span class="spinner"></span>${message}` 
    : message;
}

function cleanup() {
  if (currentVideoId) {
    fetch('/cleanup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoId: currentVideoId }),
      keepalive: true
    });
  }
}