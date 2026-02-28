# Phone Capture App Prototype — Requirements Spec (v0.4)

## 1) Confirmed product scope

This project builds the **phone-side capture application only** (web app) that prepares data for the Quest 2 app.

The app must:
- Capture one or many photos in a session (for example, scanning multiple pages from a book).
- Keep each captured item as a **separate data object** so users can organize/modify them later in Quest.
- Let user choose output mode per capture/session:
  - **Image mode**: send raw image (color or grayscale)
  - **Text mode**: OCR output preserving layout as much as possible
- In text mode, always include a source image link in markdown output.
- Prioritize **local Wi‑Fi transfer** via **WebSocket** between phone app and Quest receiver.
- Deletion is for storage management: transferred captures are removed only when user presses **Done**.
- Support English OCR only in v1.
- Handle low OCR confidence by offering:
  - retake photo, or
  - manual text edit
- Use AI only for cleanup/organization (denoise page color/background artifacts, remove ruled paper lines when possible),
  not for tutoring, recommendations, or study tips.

## 2) Finalized transfer decisions

- **Quest route for prototype:** `/ws/upload`
- **ACK strategy:** per-item ACK
- **ACK retry policy:** max 3 retries per item when ACK is not received
- **Cleanup on Done:** pressing Done clears **all** items in the session, even if transfer is partial
- **Markdown format:** no specific fixed heading/template required (linear markdown acceptable)
- **Image links in text mode:** always included
- **Send order:** preserve capture order by timestamp

## 3) Data contract to Quest (phone output)

Primary transfer payload format: **Markdown + image references**.

Transfer protocol: **WebSocket** on local Wi‑Fi using `/ws/upload`.

Proposed object per captured page/item:

```json
{
  "id": "capture_2026-02-28T19-00-00Z_001",
  "sessionId": "session_2026-02-28_19-00-00",
  "mode": "text|image",
  "title": "session_2026-02-28_19-00-00",
  "timestamp": "2026-02-28T19:00:00Z",
  "markdown": "Extracted text...\n\n![source](./images/capture_001.png)",
  "imageRefs": ["./images/capture_001.png"],
  "imageStyle": "color|grayscale",
  "ocr": {
    "language": "en",
    "confidence": 0.0
  },
  "createdAt": "ISO-8601"
}
```

For image mode, markdown can hold minimal metadata + an image link.
Default image format is **PNG**.

## 4) ACK contract details (simple + concrete)

In simple terms, ACK means: **"Quest received this specific capture item."**

Why this matters:
- The phone app can mark each item as delivered as ACKs arrive.
- The phone app can show clear progress during upload.
- When user presses Done, app clears all local items in that session (per finalized decision).

### Per-item ACK message shape

Quest sends one ACK per capture item:

```json
{
  "type": "ack",
  "sessionId": "session_2026-02-28_19-00-00",
  "captureId": "capture_2026-02-28T19-00-00Z_001",
  "timestamp": "2026-02-28T19:00:04Z",
  "status": "received"
}
```

### Minimal ACK status set (prototype)

- `received`: item accepted by Quest.
- `rejected`: item format invalid and not accepted.
- `error`: temporary receiver issue (client may retry).

### Retry rule

- If no ACK is received in timeout window, retry send for that item.
- Maximum retries per item: **3**.
- After 3 failed attempts, mark item as failed and continue batch flow.

## 5) Session behavior

- A session can contain multiple captures.
- Each capture remains independently addressable in transfer data.
- Batch transfer sends a session manifest + per-item payloads.
- Upload order is preserved by timestamp (`oldest -> newest`).
- Post-transfer data remains available until user presses **Done**.
- Pressing **Done** clears **all items** in the session, including items with failed transfer.
- Session naming is timestamp-based (for example: `session_YYYY-MM-DD_HH-mm-ss`).

## 6) OCR confidence thresholds (prototype behavior, low to start)

Thresholds are intentionally set lower for early prototype velocity:

- **High confidence (>= 0.80):**
  - Mark item as Ready.
  - No intervention prompt.

- **Medium confidence (0.55 to 0.79):**
  - Show "Review recommended" banner.
  - Allow send as-is, retake, or manual text edit.

- **Low confidence (< 0.55):**
  - Prompt required action before send.
  - Primary options: Retake photo or Edit text manually.

Rationale: early testing should prioritize flow speed and broad input coverage while still preventing very low-quality OCR from silently shipping.

## 7) Prototype UX (minimal utility)

- Open app in mobile browser.
- Create timestamp-based session.
- Capture repeatedly with camera input.
- For each capture choose:
  - Text output (OCR + always include source image link in markdown)
  - Image output (color/grayscale)
- Review confidence (text mode).
- If low confidence: Retake or Edit Text.
- Send via local Wi‑Fi WebSocket to `/ws/upload`.
- Process per-item ACK updates.
- If ACK missing, retry item up to 3 times.
- Keep transferred items cached until user presses Done.
- On Done, clear all local items in that session (including partial failures).

## 8) Non-goals for prototype

- No account system.
- No cloud dependency required for core path.
- No advanced pre-send editing pipeline besides low-confidence correction.
- No educational advice generation.

## 9) Remaining clarification questions before coding sprint

No blocking product questions remain from current decision set.

---

If this revision is approved, next step is implementing a fast web prototype focused on:
camera capture, OCR + linear markdown generation, denoise/grayscale pipeline, local WebSocket upload (`/ws/upload`), per-item ACK handling with up to 3 retries, and Done-triggered full-session cleanup.
