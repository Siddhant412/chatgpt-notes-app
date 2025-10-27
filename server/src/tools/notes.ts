import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { db, type Note } from "../db.js";
import { randomUUID } from "node:crypto";
import { z } from "zod";

export type NotesStructured = {
  notes: Array<{ id: string; title: string; updated_at: string }>;
  selectedId?: string | null;
  selected?: { id: string; title: string; body: string; updated_at: string } | null;
};

function rowsToList(rows: Note[]): NotesStructured["notes"] {
  return rows
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    .map((n) => ({ id: n.id, title: n.title, updated_at: n.updated_at }));
}

function loadAll(): Note[] {
  const stmt = db.prepare("SELECT * FROM notes ORDER BY updated_at DESC");
  return stmt.all() as Note[];
}

function loadOne(id: string): Note | undefined {
  const stmt = db.prepare("SELECT * FROM notes WHERE id = ?");
  return stmt.get(id) as Note | undefined;
}

function nowIso() {
  return new Date().toISOString();
}

async function makeStructured(selectedId?: string | null): Promise<NotesStructured> {
  const all = loadAll();
  const pick = selectedId ?? (all[0]?.id ?? null);
  const selected = pick ? loadOne(pick) ?? null : null;
  return {
    notes: rowsToList(all),
    selectedId: pick,
    selected: selected
      ? {
          id: selected.id,
          title: selected.title,
          body: selected.body,
          updated_at: selected.updated_at,
        }
      : null,
  };
}

export function registerNotesTools(server: McpServer) {
  const OUTPUT_TEMPLATE = "ui://widget/notes.html";

  const CreateNoteShape = {
    title: z.string().min(1),
    body: z.string().optional(), // default to "" in handler
  } as const;
  const CreateNoteSchema = z.object(CreateNoteShape);
  type CreateNoteInput = z.infer<typeof CreateNoteSchema>;

  const IdOnlyShape = {
    id: z.string().min(1),
  } as const;
  const IdOnlySchema = z.object(IdOnlyShape);
  type IdOnlyInput = z.infer<typeof IdOnlySchema>;

  const UpdateNoteShape = {
    id: z.string().min(1),
    title: z.string().optional(),
    body: z.string().optional(),
  } as const;
  const UpdateNoteSchema = z.object(UpdateNoteShape);
  type UpdateNoteInput = z.infer<typeof UpdateNoteSchema>;

  /** Render initial UI */
  server.registerTool(
    "render_notes",
    {
      title: "Render Notes",
      description: "Render the notes UI",
      _meta: {
        "openai/outputTemplate": OUTPUT_TEMPLATE,
        "openai/toolInvocation/invoking": "Opening notes…",
        "openai/toolInvocation/invoked": "Notes shown.",
        "openai/widgetAccessible": true,
      },
    },
    async () => ({
      content: [],
      structuredContent: await makeStructured(),
    })
  );

  /** 2) List notes */
  server.registerTool(
    "list_notes",
    {
      title: "List Notes",
      description: "List all notes",
      _meta: {
        "openai/outputTemplate": OUTPUT_TEMPLATE,
        "openai/widgetAccessible": true,
      },
    },
    async () => ({
      content: [],
      structuredContent: await makeStructured(),
    })
  );

  /** 3) Create note */
  server.registerTool(
    "create_note",
    {
      title: "Create Note",
      description: "Create a new note with a title and body",
      inputSchema: CreateNoteShape,
      _meta: {
        "openai/outputTemplate": OUTPUT_TEMPLATE,
        "openai/widgetAccessible": true,
      },
    },
    async ({ title, body }: CreateNoteInput) => {
      const id = randomUUID();
      const ts = nowIso();
      db.prepare(
        "INSERT INTO notes(id, title, body, created_at, updated_at) VALUES(?,?,?,?,?)"
      ).run(id, title.trim(), body ?? "", ts, ts);
      return {
        content: [],
        structuredContent: await makeStructured(id),
      };
    }
  );

  /** 4) Get note */
  server.registerTool(
    "get_note",
    {
      title: "Get Note",
      description: "Get a single note by id",
      inputSchema: IdOnlyShape,
      _meta: {
        "openai/outputTemplate": OUTPUT_TEMPLATE,
        "openai/widgetAccessible": true,
      },
    },
    async ({ id }: IdOnlyInput) => ({
      content: [],
      structuredContent: await makeStructured(id),
    })
  );

  /** 5) Update note (partial) */
  server.registerTool(
    "update_note",
    {
      title: "Update Note",
      description: "Update the title and/or body of a note",
      inputSchema: UpdateNoteShape,
      _meta: {
        "openai/outputTemplate": OUTPUT_TEMPLATE,
        "openai/widgetAccessible": true,
      },
    },
    async ({ id, title, body }: UpdateNoteInput) => {
      const existing = loadOne(id);
      if (!existing) {
        return { content: [], structuredContent: await makeStructured() };
      }

      // If no fields to update, just return current state
      if (title === undefined && body === undefined) {
        return { content: [], structuredContent: await makeStructured(id) };
      }

      const newTitle = title ?? existing.title;
      const newBody = body ?? existing.body;

      db.prepare(
        "UPDATE notes SET title = ?, body = ?, updated_at = ? WHERE id = ?"
      ).run(newTitle, newBody, nowIso(), id);

      return {
        content: [],
        structuredContent: await makeStructured(id),
      };
    }
  );

  /** 6) Delete note */
  server.registerTool(
    "delete_note",
    {
      title: "Delete Note",
      description: "Delete a note by id",
      inputSchema: IdOnlyShape,
      _meta: {
        "openai/outputTemplate": OUTPUT_TEMPLATE,
        "openai/widgetAccessible": true,
      },
    },
    async ({ id }: IdOnlyInput) => {
      db.prepare("DELETE FROM notes WHERE id = ?").run(id);
      return {
        content: [],
        structuredContent: await makeStructured(),
      };
    }
  );
}
