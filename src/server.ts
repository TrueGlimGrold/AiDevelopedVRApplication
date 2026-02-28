import { join } from "node:path";

const publicDir = join(process.cwd(), "public");

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
  port: Number(process.env.PORT ?? 3000),
  fetch(req, server) {
    const url = new URL(req.url);

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
