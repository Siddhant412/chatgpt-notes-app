import express, { Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { registerWidgetResource } from "./resource/widget.js";
import { registerNotesTools } from "./tools/notes.js";

const PORT = parseInt(process.env.PORT || "2092", 10);

type Session = {
  transport: StreamableHTTPServerTransport;
  server: McpServer;
};

const sessions: Record<string, Session> = {};

function createNotesServer() {
  const server = new McpServer({ name: "notes-server", version: "0.1.0" });
  registerWidgetResource(server);
  registerNotesTools(server);
  return server;
}

const app = express();

app.use(express.json({ limit: "5mb" }));

app.post("/mcp", async (req, res) => {
  try {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    let sess = sessionId ? sessions[sessionId] : undefined;

    if (sess) {
      // Reuse existing session transport
      await sess.transport.handleRequest(req, res, req.body);
      return;
    }

    if (!sessionId && isInitializeRequest(req.body)) {
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        enableDnsRebindingProtection: true,
        onsessioninitialized: (sid) => {
          sessions[sid] = { transport, server };
          console.log("[mcp] session initialized:", sid);
        },
      });

      const server = createNotesServer();

      transport.onclose = () => {
        const sid = transport.sessionId;
        if (sid && sessions[sid]) {
          delete sessions[sid];
          console.log("[mcp] session closed:", sid);
        }
      };

      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
      return;
    }

    res.status(400).json({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Bad Request: No valid session ID provided" },
      id: null,
    });
  } catch (err) {
    console.error("[/mcp POST] error:", err);
    if (!res.headersSent) res.status(500).json({ error: "mcp transport error" });
  }
});

const handleSessionRequest = async (req: Request, res: Response) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  const sess = sessionId ? sessions[sessionId] : undefined;
  if (!sess) {
    res.status(400).send("Invalid or missing session ID");
    return;
  }
  try {
    await sess.transport.handleRequest(req, res);
  } catch (err) {
    console.error(`[${req.method} /mcp] error:`, err);
    if (!res.headersSent) res.status(500).send("mcp transport error");
  }
};

app.get("/mcp", handleSessionRequest);
app.delete("/mcp", handleSessionRequest);

// healthcheck
app.get("/", (_req, res) => res.status(200).send("OK"));

app.listen(PORT, "127.0.0.1", () => {
  console.log(`MCP Notes server listening at http://127.0.0.1:${PORT}/mcp`);
});
