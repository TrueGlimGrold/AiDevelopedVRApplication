"use client";

import { useMemo, useState } from "react";
import Tesseract from "tesseract.js";

const HIGH_CONF = 0.8;
const MEDIUM_CONF = 0.55;
const MAX_RETRIES = 3;
const ACK_TIMEOUT_MS = 3000;

function buildSessionId() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `session_${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
}

function confidenceLabel(conf) {
  if (conf >= HIGH_CONF) return { text: "High confidence", className: "good" };
  if (conf >= MEDIUM_CONF) return { text: "Medium confidence (review recommended)", className: "warn" };
  return { text: "Low confidence (retake or manual edit)", className: "low" };
}

async function blobToDataUrl(blob) {
  return await new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(blob);
  });
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
}

export default function HomePage() {
  const [sessionId, setSessionId] = useState(buildSessionId());
  const [mode, setMode] = useState("text");
  const [imageStyle, setImageStyle] = useState("color");
  const [wsUrl, setWsUrl] = useState("ws://localhost:3000/ws/upload");
  const [connectionState, setConnectionState] = useState("Disconnected");
  const [captures, setCaptures] = useState([]);
  const [socket, setSocket] = useState(null);

  const sortedCaptures = useMemo(
    () => [...captures].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()),
    [captures]
  );

  const onNewSession = () => {
    setSessionId(buildSessionId());
    setCaptures([]);
  };

  const onConnect = () => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      return;
    }
    const ws = new WebSocket(wsUrl.trim());
    ws.onopen = () => setConnectionState("Connected");
    ws.onclose = () => setConnectionState("Disconnected");
    setSocket(ws);
  };

  const waitForAck = (ws, captureId) =>
    new Promise((resolve) => {
      const timeout = setTimeout(() => resolve(false), ACK_TIMEOUT_MS);
      const handler = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "ack" && data.captureId === captureId) {
            clearTimeout(timeout);
            ws.removeEventListener("message", handler);
            resolve(true);
          }
        } catch {
          // ignore malformed ack
        }
      };
      ws.addEventListener("message", handler);
    });

  const updateCapture = (captureId, patch) => {
    setCaptures((prev) => prev.map((c) => (c.id === captureId ? { ...c, ...patch } : c)));
  };

  const onUploadSession = async () => {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      alert("Connect WebSocket first.");
      return;
    }

    for (const capture of sortedCaptures) {
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
        socket.send(JSON.stringify(message));
        updateCapture(capture.id, { status: `sent attempt ${attempt}` });
        // eslint-disable-next-line no-await-in-loop
        received = await waitForAck(socket, capture.id);
      }

      updateCapture(capture.id, { status: received ? "acked" : "failed" });
    }
  };

  const onDone = () => setCaptures([]);

  const onFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const timestamp = new Date().toISOString();
    const id = `capture_${timestamp}_${Math.random().toString(16).slice(2, 8)}`;
    const bitmap = await createImageBitmap(file);
    const displayCanvas = preprocessForDisplay(bitmap, imageStyle);
    const displayBlob = await new Promise((resolve) => displayCanvas.toBlob(resolve, "image/png", 1));
    const imageRef = `./images/${id}.png`;
    const dataUrl = await blobToDataUrl(displayBlob);

    let markdown = `![source](${imageRef})`;
    let ocr = { language: "en", confidence: 0 };

    if (mode === "text") {
      const bestAttempt = await runHandwritingOcr(bitmap);
      ocr = {
        language: "en",
        confidence: bestAttempt.confidence,
        variant: bestAttempt.label
      };
      markdown = `${bestAttempt.text.trim()}\n\n![source](${imageRef})`;
    }

    setCaptures((prev) => [
      ...prev,
      {
        id,
        sessionId,
        mode,
        imageStyle,
        timestamp,
        dataUrl,
        imageRef,
        markdown,
        ocr,
        status: "pending",
        manualText: mode === "text" ? markdown.replace(/\n\n!\[source\].*$/s, "") : ""
      }
    ]);

    event.target.value = "";
  };

  const onApplyEdit = (capture) => {
    updateCapture(capture.id, {
      markdown: `${capture.manualText.trim()}\n\n![source](${capture.imageRef})`
    });
  };

  const onRemoveCapture = (captureId) => {
    setCaptures((prev) => prev.filter((capture) => capture.id !== captureId));
  };

  return (
    <main>
      <h1>Quest Phone Capture Prototype (Next.js)</h1>

      <section className="card">
        <h2>Session</h2>
        <p>Current session: {sessionId}</p>
        <button onClick={onNewSession}>New Session</button>
      </section>

      <section className="card">
        <h2>Capture</h2>
        <p>Text mode now runs handwriting-enhanced OCR preprocessing automatically.</p>
        <label>
          Output Mode
          <select value={mode} onChange={(e) => setMode(e.target.value)}>
            <option value="text">Text</option>
            <option value="image">Image</option>
          </select>
        </label>
        <label>
          Image Style
          <select value={imageStyle} onChange={(e) => setImageStyle(e.target.value)}>
            <option value="color">Color</option>
            <option value="grayscale">Grayscale</option>
          </select>
        </label>
        <input type="file" accept="image/*" capture="environment" onChange={onFileChange} />
      </section>

      <section className="card">
        <h2>Quest Upload</h2>
        <label>
          WebSocket URL
          <input value={wsUrl} onChange={(e) => setWsUrl(e.target.value)} />
        </label>
        <button onClick={onConnect}>Connect</button>
        <button onClick={onUploadSession}>Upload Session</button>
        <button onClick={onDone}>Done (Clear All)</button>
        <p>{connectionState}</p>
      </section>

      <section className="card">
        <h2>Captures</h2>
        {sortedCaptures.map((capture) => {
          const confidence = confidenceLabel(capture.ocr.confidence);
          return (
            <article className="capture-item" key={capture.id}>
              <h3>{capture.id}</h3>
              <p>
                {capture.mode.toUpperCase()} • {capture.imageStyle} • {capture.timestamp} • {capture.status}
              </p>
              <img className="capture-image" src={capture.dataUrl} alt="capture" />

              {capture.mode === "text" ? (
                <p className={confidence.className}>
                  {confidence.text} ({capture.ocr.confidence.toFixed(2)})
                </p>
              ) : (
                <p>Image mode (OCR skipped)</p>
              )}

              <textarea
                rows={6}
                value={capture.manualText}
                onChange={(e) =>
                  updateCapture(capture.id, {
                    manualText: e.target.value
                  })
                }
              />
              <button onClick={() => onApplyEdit(capture)}>Apply Edit</button>
              <button onClick={() => onRemoveCapture(capture.id)}>Remove</button>

              <pre className="markdown-preview">{capture.markdown}</pre>
            </article>
          );
        })}
      </section>
    </main>
  );
}
