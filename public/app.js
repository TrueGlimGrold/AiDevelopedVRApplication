const sessionLabel = document.getElementById("sessionLabel");
const modeSelect = document.getElementById("modeSelect");
const styleSelect = document.getElementById("styleSelect");
const captureInput = document.getElementById("captureInput");
<<<<<<< ours
const openCameraBtn = document.getElementById("openCameraBtn");
const takePhotoBtn = document.getElementById("takePhotoBtn");
const closeCameraBtn = document.getElementById("closeCameraBtn");
const cameraStatus = document.getElementById("cameraStatus");
const cameraPreview = document.getElementById("cameraPreview");
=======
>>>>>>> theirs
const capturesEl = document.getElementById("captures");
const template = document.getElementById("captureTemplate");
const wsUrlInput = document.getElementById("wsUrl");
const connectionState = document.getElementById("connectionState");

const newSessionBtn = document.getElementById("newSessionBtn");
const connectBtn = document.getElementById("connectBtn");
const uploadBtn = document.getElementById("uploadBtn");
const doneBtn = document.getElementById("doneBtn");

const HIGH_CONF = 0.8;
const MEDIUM_CONF = 0.55;
const MAX_RETRIES = 3;
const ACK_TIMEOUT_MS = 3000;

let sessionId = buildSessionId();
let captures = [];
let ws = null;
let ackWaiters = new Map();
<<<<<<< ours
let cameraStream = null;

if (!wsUrlInput.value.trim()) {
  wsUrlInput.value = buildDefaultWsUrl();
}
=======
>>>>>>> theirs

refreshSessionLabel();
renderCaptures();

newSessionBtn.addEventListener("click", () => {
  sessionId = buildSessionId();
  captures = [];
  refreshSessionLabel();
  renderCaptures();
});

connectBtn.addEventListener("click", connectSocket);
uploadBtn.addEventListener("click", uploadSession);
<<<<<<< ours
openCameraBtn.addEventListener("click", openCamera);
takePhotoBtn.addEventListener("click", takePhotoFromCamera);
closeCameraBtn.addEventListener("click", closeCamera);
=======
>>>>>>> theirs
doneBtn.addEventListener("click", () => {
  captures = [];
  renderCaptures();
});

captureInput.addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;

<<<<<<< ours
  await addCaptureFromBlob(file);
  captureInput.value = "";
});

function buildSessionId() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `session_${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
}

function buildDefaultWsUrl() {
  const wsProtocol = window.location.protocol === "https:" ? "wss" : "ws";
  return `${wsProtocol}://${window.location.host}/ws/upload`;
}

function refreshSessionLabel() {
  sessionLabel.textContent = `Current session: ${sessionId}`;
}

async function addCaptureFromBlob(blobLike) {
=======
>>>>>>> theirs
  const mode = modeSelect.value;
  const imageStyle = styleSelect.value;
  const timestamp = new Date().toISOString();
  const id = `capture_${timestamp}_${Math.random().toString(16).slice(2, 8)}`;

<<<<<<< ours
  const processedBlob = await processImage(blobLike, imageStyle);
=======
  const bitmap = await createImageBitmap(file);
  const displayCanvas = preprocessForDisplay(bitmap, imageStyle);
  const processedBlob = await new Promise((resolve) => displayCanvas.toBlob(resolve, "image/png", 1));
>>>>>>> theirs
  const imageRef = `./images/${id}.png`;
  const dataUrl = await blobToDataUrl(processedBlob);

  const capture = {
    id,
    sessionId,
    mode,
    imageStyle,
    timestamp,
    dataUrl,
    imageRef,
    markdown: "",
    ocr: { language: "en", confidence: 0 },
    status: "pending"
  };

  if (mode === "text") {
<<<<<<< ours
    const ocr = await runOcr(dataUrl);
    capture.ocr = ocr;
    const parsed = await parseTextWithGemini(ocr.text || "");
    capture.markdown = `${parsed.trim()}\n\n![source](${imageRef})`;
=======
    const bestAttempt = await runHandwritingOcr(bitmap);
    capture.ocr = {
      language: "en",
      confidence: bestAttempt.confidence,
      variant: bestAttempt.label
    };
    capture.markdown = `${bestAttempt.text.trim()}\n\n![source](${imageRef})`;
>>>>>>> theirs
  } else {
    capture.markdown = `![source](${imageRef})`;
  }

  captures.push(capture);
  captures.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  renderCaptures();
<<<<<<< ours
}

async function processImage(file, style) {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(bitmap, 0, 0);

  if (style === "grayscale") {
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      const gray = (data[i] + data[i + 1] + data[i + 2]) / 3;
      data[i] = gray;
      data[i + 1] = gray;
      data[i + 2] = gray;
    }
    ctx.putImageData(imgData, 0, 0);
  }

  return new Promise((resolve) => canvas.toBlob(resolve, "image/png", 1));
}

async function runOcr(dataUrl) {
  const result = await Tesseract.recognize(dataUrl, "eng");
  return {
    language: "en",
    confidence: (result.data.confidence || 0) / 100,
    text: result.data.text || ""
  };
}

async function openCamera() {
  if (!navigator.mediaDevices?.getUserMedia) {
    cameraStatus.textContent = "Camera API not available in this browser.";
    return;
  }

  if (cameraStream) return;

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: "environment" }
      },
      audio: false
    });

    cameraStream = stream;
    cameraPreview.srcObject = stream;
    cameraPreview.classList.remove("hidden");
    takePhotoBtn.disabled = false;
    closeCameraBtn.disabled = false;
    openCameraBtn.disabled = true;
    cameraStatus.textContent = "Camera ready";
  } catch {
    cameraStatus.textContent = "Unable to access camera. Use file capture instead.";
  }
}

async function takePhotoFromCamera() {
  if (!cameraStream || !cameraPreview.videoWidth || !cameraPreview.videoHeight) {
    cameraStatus.textContent = "Camera not ready yet.";
    return;
  }

  const canvas = document.createElement("canvas");
  canvas.width = cameraPreview.videoWidth;
  canvas.height = cameraPreview.videoHeight;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(cameraPreview, 0, 0, canvas.width, canvas.height);

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png", 1));
  if (!blob) {
    cameraStatus.textContent = "Could not capture photo.";
    return;
  }

  cameraStatus.textContent = "Processing capture...";
  await addCaptureFromBlob(blob);
  cameraStatus.textContent = "Photo captured";
}

function closeCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach((track) => track.stop());
    cameraStream = null;
  }

  cameraPreview.srcObject = null;
  cameraPreview.classList.add("hidden");
  takePhotoBtn.disabled = true;
  closeCameraBtn.disabled = true;
  openCameraBtn.disabled = false;
  cameraStatus.textContent = "Camera inactive";
=======
  captureInput.value = "";
});

function buildSessionId() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `session_${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
}

function refreshSessionLabel() {
  sessionLabel.textContent = `Current session: ${sessionId}`;
}

function drawBitmap(bitmap, scale = 1) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return { canvas, ctx };
}

function grayscaleAndNormalize(imageData, contrastBoost = 1.35) {
  const { data } = imageData;
  let min = 255;
  let max = 0;

  for (let i = 0; i < data.length; i += 4) {
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    min = Math.min(min, gray);
    max = Math.max(max, gray);
  }

  const range = Math.max(1, max - min);
  for (let i = 0; i < data.length; i += 4) {
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    let normalized = ((gray - min) / range) * 255;
    normalized = (normalized - 127.5) * contrastBoost + 127.5;
    normalized = Math.max(0, Math.min(255, normalized));
    data[i] = normalized;
    data[i + 1] = normalized;
    data[i + 2] = normalized;
  }

  return imageData;
}

function adaptiveThreshold(imageData, width, height, blockSize = 19, c = 12) {
  const src = new Uint8ClampedArray(imageData.data);
  const { data } = imageData;
  const radius = Math.floor(blockSize / 2);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let sum = 0;
      let count = 0;
      for (let ky = -radius; ky <= radius; ky += 1) {
        const yy = Math.max(0, Math.min(height - 1, y + ky));
        for (let kx = -radius; kx <= radius; kx += 1) {
          const xx = Math.max(0, Math.min(width - 1, x + kx));
          const idx = (yy * width + xx) * 4;
          sum += src[idx];
          count += 1;
        }
      }

      const idx = (y * width + x) * 4;
      const mean = sum / count;
      const value = src[idx] > mean - c ? 255 : 0;
      data[idx] = value;
      data[idx + 1] = value;
      data[idx + 2] = value;
      data[idx + 3] = 255;
    }
  }

  return imageData;
}

function medianDenoise(imageData, width, height) {
  const src = new Uint8ClampedArray(imageData.data);
  const { data } = imageData;

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const values = [];
      for (let ky = -1; ky <= 1; ky += 1) {
        for (let kx = -1; kx <= 1; kx += 1) {
          const idx = ((y + ky) * width + (x + kx)) * 4;
          values.push(src[idx]);
        }
      }
      values.sort((a, b) => a - b);
      const v = values[4];
      const idx = (y * width + x) * 4;
      data[idx] = v;
      data[idx + 1] = v;
      data[idx + 2] = v;
    }
  }

  return imageData;
}

function preprocessForDisplay(bitmap, style) {
  const { canvas, ctx } = drawBitmap(bitmap, 1);
  if (style === "grayscale") {
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    grayscaleAndNormalize(imageData, 1.15);
    ctx.putImageData(imageData, 0, 0);
  }
  return canvas;
}

function preprocessHandwritingVariants(bitmap) {
  const variants = [];

  const createVariant = (label, adaptC, contrastBoost, doMedian) => {
    const { canvas, ctx } = drawBitmap(bitmap, 2);
    let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    imageData = grayscaleAndNormalize(imageData, contrastBoost);
    if (doMedian) {
      imageData = medianDenoise(imageData, canvas.width, canvas.height);
    }
    imageData = adaptiveThreshold(imageData, canvas.width, canvas.height, 19, adaptC);
    ctx.putImageData(imageData, 0, 0);
    variants.push({ label, dataUrl: canvas.toDataURL("image/png") });
  };

  createVariant("balanced", 12, 1.35, true);
  createVariant("high-contrast", 18, 1.6, true);
  createVariant("light-ink", 8, 1.25, false);

  return variants;
}

function scoreOcrResult(text, confidence) {
  const usefulChars = (text.match(/[A-Za-z0-9]/g) || []).length;
  return confidence * 100 + usefulChars * 0.15;
}

async function runHandwritingOcr(bitmap) {
  const variants = preprocessHandwritingVariants(bitmap);
  const attempts = [];

  for (const variant of variants) {
    const result = await Tesseract.recognize(variant.dataUrl, "eng", {
      tessedit_pageseg_mode: "6",
      preserve_interword_spaces: "1",
      user_defined_dpi: "300"
    });

    attempts.push({
      label: variant.label,
      text: result.data.text || "",
      confidence: (result.data.confidence || 0) / 100
    });
  }

  attempts.sort((a, b) => scoreOcrResult(b.text, b.confidence) - scoreOcrResult(a.text, a.confidence));
  return attempts[0];
>>>>>>> theirs
}

function blobToDataUrl(blob) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(blob);
  });
}

function confidenceLabel(conf) {
  if (conf >= HIGH_CONF) return { text: "High confidence", className: "good" };
  if (conf >= MEDIUM_CONF) return { text: "Medium confidence (review recommended)", className: "warn" };
  return { text: "Low confidence (retake or manual edit)", className: "low" };
}

function renderCaptures() {
  capturesEl.innerHTML = "";
  captures.forEach((capture) => {
    const node = template.content.cloneNode(true);
    node.querySelector(".capture-title").textContent = capture.id;
<<<<<<< ours
    node.querySelector(".capture-meta").textContent = `${capture.mode.toUpperCase()} | ${capture.imageStyle} | ${capture.timestamp} | ${capture.status}`;
=======
    node.querySelector(".capture-meta").textContent = `${capture.mode.toUpperCase()} • ${capture.imageStyle} • ${capture.timestamp} • ${capture.status}`;
>>>>>>> theirs
    const image = node.querySelector(".capture-image");
    image.src = capture.dataUrl;

    const confidence = node.querySelector(".confidence");
    if (capture.mode === "text") {
      const label = confidenceLabel(capture.ocr.confidence);
      confidence.textContent = `${label.text} (${capture.ocr.confidence.toFixed(2)})`;
      confidence.className = `confidence ${label.className}`;
    } else {
      confidence.textContent = "Image mode (OCR skipped)";
      confidence.className = "confidence";
    }

    const manualText = node.querySelector(".manual-text");
    manualText.value = capture.mode === "text" ? capture.markdown.replace(/\n\n!\[source\].*$/s, "") : "";

    node.querySelector(".apply-edit").addEventListener("click", () => {
      if (capture.mode === "text") {
        capture.markdown = `${manualText.value.trim()}\n\n![source](${capture.imageRef})`;
        renderCaptures();
      }
    });

    node.querySelector(".remove-item").addEventListener("click", () => {
      captures = captures.filter((c) => c.id !== capture.id);
      renderCaptures();
    });

    node.querySelector(".markdown-preview").textContent = capture.markdown;

    capturesEl.appendChild(node);
  });
}

function connectSocket() {
  if (ws && ws.readyState === WebSocket.OPEN) return;
  ws = new WebSocket(wsUrlInput.value.trim());

  ws.addEventListener("open", () => {
    connectionState.textContent = "Connected";
  });

  ws.addEventListener("close", () => {
    connectionState.textContent = "Disconnected";
  });

  ws.addEventListener("message", (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.type === "ack" && ackWaiters.has(data.captureId)) {
        ackWaiters.get(data.captureId)(data);
        ackWaiters.delete(data.captureId);
      }
    } catch {
      // ignore
    }
  });
}

async function uploadSession() {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    alert("Connect WebSocket first.");
    return;
  }

  const ordered = [...captures].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  for (const capture of ordered) {
    const message = {
      type: "capture_item",
      sessionId,
      payload: {
        id: capture.id,
        mode: capture.mode,
        timestamp: capture.timestamp,
        markdown: capture.markdown,
        imageRefs: [capture.imageRef],
        imageStyle: capture.imageStyle,
        ocr: capture.ocr
      }
    };

    let received = false;
    for (let attempt = 1; attempt <= MAX_RETRIES && !received; attempt += 1) {
      ws.send(JSON.stringify(message));
      capture.status = `sent attempt ${attempt}`;
      renderCaptures();

      received = await waitForAck(capture.id);
    }

    capture.status = received ? "acked" : "failed";
    renderCaptures();
  }
}

function waitForAck(captureId) {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      ackWaiters.delete(captureId);
      resolve(false);
    }, ACK_TIMEOUT_MS);

    ackWaiters.set(captureId, () => {
      clearTimeout(timeout);
      resolve(true);
    });
  });
}
<<<<<<< ours

async function parseTextWithGemini(text) {
  const raw = String(text || "").trim();
  if (!raw) return "";

  try {
    const response = await fetch("/api/parse-text", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: raw })
    });

    if (!response.ok) {
      return raw;
    }

    const data = await response.json();
    return String(data.parsedText || raw);
  } catch {
    return raw;
  }
}
=======
>>>>>>> theirs
