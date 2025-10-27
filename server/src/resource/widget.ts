import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

function firstExisting(paths: string[]): string | null {
  for (const p of paths) if (existsSync(p)) return p;
  return null;
}

export function registerWidgetResource(server: McpServer) {
  const __filename = fileURLToPath(import.meta.url);
  const here = dirname(__filename);

  const jsCandidates = [
    // when running with tsx on src files: server/src/resource -> project root
    join(here, "../../..", "web", "dist", "notes.js"),
    // when running compiled build: server/build/resource -> project root
    join(here, "../../../..", "web", "dist", "notes.js"),
    // when process.cwd() === server/
    join(process.cwd(), "..", "web", "dist", "notes.js"),
    // when process.cwd() === project root
    join(process.cwd(), "web", "dist", "notes.js"),
  ];

  const cssCandidates = jsCandidates.map((p) => p.replace(/notes\.js$/, "notes.css"));

  const jsPath = firstExisting(jsCandidates);
  if (!jsPath) {
    const searched = jsCandidates.join("\n  - ");
    throw new Error(
      `notes.js not found. Did you build the widget?\n` +
      `Run: cd web && npm run build\n` +
      `Searched:\n  - ${searched}`
    );
  }

  const cssPath = firstExisting(cssCandidates);
  const JS = readFileSync(jsPath, "utf8");
  const CSS = cssPath ? readFileSync(cssPath, "utf8") : "";

  server.registerResource(
    "notes-widget",
    "ui://widget/notes.html",
    {},
    async () => ({
      contents: [
        {
          uri: "ui://widget/notes.html",
          mimeType: "text/html+skybridge",
          text: `
            <div id="root"></div>
            ${CSS ? `<style>${CSS}</style>` : ""}
            <script type="module">${JS}</script>
          `.trim(),
          _meta: {
            "openai/widgetPrefersBorder": true,
            "openai/widgetCSP": { connect_domains: [], resource_domains: [] },
          },
        },
      ],
    })
  );
}
