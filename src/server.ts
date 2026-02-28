import { join } from "node:path";

const publicDir = join(process.cwd(), "public");
<<<<<<< ours
const GEMINI_MODEL = "gemini-2.0-flash";

type ParseTextRequest = {
  text: string;
};

type ParseTextResponse = {
  parsedText: string;
  provider: "gemini" | "ocr";
};
=======
>>>>>>> theirs

type UploadMessage = {
  type: "capture_item";
  sessionId: string;
  payload: {
    id: string;
    timestamp: string;
  };
};

type AckMessage = {
  type: "ack";
  sessionId: string;
  captureId: string;
  timestamp: string;
  status: "received";
};

const server = Bun.serve<{ path: string }>({
<<<<<<< ours
  hostname: "0.0.0.0",
  port: Number(process.env.PORT ?? 3000),
  async fetch(req, server) {
    const url = new URL(req.url);

    if (url.pathname === "/api/parse-text" && req.method === "POST") {
      return handleParseText(req);
    }

=======
  port: Number(process.env.PORT ?? 3000),
  fetch(req, server) {
    const url = new URL(req.url);

>>>>>>> theirs
    if (url.pathname === "/ws/upload") {
      const upgraded = server.upgrade(req, { data: { path: url.pathname } });
      if (upgraded) {
        return undefined;
      }
      return new Response("WebSocket upgrade failed", { status: 400 });
    }

    const filePath = url.pathname === "/" ? "/index.html" : url.pathname;
    const absolute = join(publicDir, filePath);
    const file = Bun.file(absolute);

    return file.exists().then((exists) => {
      if (!exists) {
        return new Response("Not found", { status: 404 });
      }
      return new Response(file);
    });
  },
  websocket: {
    message(ws, message) {
      try {
        const parsed = JSON.parse(String(message)) as UploadMessage;
        if (parsed.type !== "capture_item") {
          return;
        }

        const ack: AckMessage = {
          type: "ack",
          sessionId: parsed.sessionId,
          captureId: parsed.payload.id,
          timestamp: new Date().toISOString(),
          status: "received"
        };

        ws.send(JSON.stringify(ack));
      } catch {
        // Ignore malformed payloads in mock receiver.
      }
    }
  }
});

console.log(`Prototype app running at http://localhost:${server.port}`);
<<<<<<< ours

async function handleParseText(req: Request): Promise<Response> {
  try {
    const body = (await req.json()) as ParseTextRequest;
    const text = String(body?.text ?? "").trim();
    if (!text) {
      return Response.json({ error: "Missing text." }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      const fallback: ParseTextResponse = { parsedText: text, provider: "ocr" };
      return Response.json(fallback);
    }

    const parsedText = await parseWithGemini(text, apiKey);
    const response: ParseTextResponse = { parsedText, provider: "gemini" };
    return Response.json(response);
  } catch {
    return Response.json({ error: "Unable to parse text." }, { status: 500 });
  }
}

async function parseWithGemini(text: string, apiKey: string): Promise<string> {
  const prompt = [
    "You are fixing OCR text from an image capture.",
    "Return plain text only.",
    "Correct obvious OCR mistakes, preserve original meaning, and preserve line breaks where appropriate.",
    "",
    "OCR text:",
    text
  ].join("\n");

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1
        }
      })
    }
  );

  if (!response.ok) {
    throw new Error(`Gemini request failed: ${response.status}`);
  }

  const data = (await response.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{ text?: string }>;
      };
    }>;
  };

  const parsed =
    data.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? "")
      .join("")
      .trim() ?? "";

  return parsed || text;
}
=======
>>>>>>> theirs
