const sessionLabel = document.getElementById("sessionLabel");
const modeSelect = document.getElementById("modeSelect");
const styleSelect = document.getElementById("styleSelect");
const captureInput = document.getElementById("captureInput");
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
doneBtn.addEventListener("click", () => {
  captures = [];
  renderCaptures();
});

captureInput.addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;

  const mode = modeSelect.value;
  const imageStyle = styleSelect.value;
  const timestamp = new Date().toISOString();
  const id = `capture_${timestamp}_${Math.random().toString(16).slice(2, 8)}`;

  const processedBlob = await processImage(file, imageStyle);
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
    const ocr = await runOcr(dataUrl);
    capture.ocr = ocr;
    const parsed = await parseTextWithGemini(ocr.text || "");
    capture.markdown = `${parsed.trim()}\n\n![source](${imageRef})`;
  } else {
    capture.markdown = `![source](${imageRef})`;
  }

  captures.push(capture);
  captures.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  renderCaptures();
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
    node.querySelector(".capture-meta").textContent = `${capture.mode.toUpperCase()} • ${capture.imageStyle} • ${capture.timestamp} • ${capture.status}`;
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
