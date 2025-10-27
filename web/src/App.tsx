import React, { useEffect, useRef, useState } from "react";
import type { NotesStructured, ToolResponse } from "./types";

declare global {
  interface Window {
    openai: any;
  }
}

function useToolOutput(): NotesStructured | null {
  const [out, setOut] = useState<NotesStructured | null>(null);
  useEffect(() => {
    setOut(window.openai?.toolOutput ?? null);
    const handler = (e: any) => {
      const globals = e?.detail?.globals;
      if (globals?.toolOutput !== undefined) setOut(globals.toolOutput);
    };
    window.addEventListener("openai:set_globals", handler);
    return () => window.removeEventListener("openai:set_globals", handler);
  }, []);
  return out;
}

export default function App() {
  const initial = useToolOutput();
  const [data, setData] = useState<NotesStructured | null>(initial);
  const [saving, setSaving] = useState(false);
  const saveTimer = useRef<number | null>(null);

  useEffect(() => {
    if (initial) setData(initial);
  }, [initial]);

  const notes = data?.notes ?? [];
  const selected = data?.selected ?? null;
  const selectedId = data?.selectedId ?? null;

  async function call(name: string, args: Record<string, unknown> = {}) {
    const resp: ToolResponse = await window.openai?.callTool(name, args);
    if (resp?.structuredContent) {
      setData(resp.structuredContent);
    }
    return resp;
  }

  async function onSelect(id: string) {
    await call("get_note", { id });
  }

  async function onNew() {
    const title = prompt("Title for the new note?")?.trim();
    if (!title) return;
    await call("create_note", { title, body: "" });
  }

  async function onDelete(id: string) {
    if (!confirm("Delete this note?")) return;
    await call("delete_note", { id });
  }

  function debouncedUpdate(partial: { title?: string; body?: string }) {
    if (!selectedId) return;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    setSaving(true);
    saveTimer.current = window.setTimeout(async () => {
      await call("update_note", { id: selectedId, ...partial });
      setSaving(false);
      saveTimer.current = null;
    }, 500);
  }

  function onTitleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const title = e.target.value;
    setData((d) => d && ({ ...d, selected: d.selected ? { ...d.selected, title } : d.selected }));
    debouncedUpdate({ title });
  }

  function onBodyChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const body = e.target.value;
    setData((d) => d && ({ ...d, selected: d.selected ? { ...d.selected, body } : d.selected }));
    debouncedUpdate({ body });
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 12, padding: 12 }}>
      {/* Left column: list */}
      <div style={{ borderRight: "1px solid #333", paddingRight: 12 }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <button onClick={() => call("render_notes")}>Refresh</button>
          <button onClick={onNew}>New</button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {notes.map((n) => (
            <button
              key={n.id}
              onClick={() => onSelect(n.id)}
              style={{
                textAlign: "left",
                padding: "8px 10px",
                background: n.id === selectedId ? "#1f2937" : "#111827",
                color: "#e5e7eb",
                border: "1px solid #374151",
                borderRadius: 8,
                cursor: "pointer"
              }}
            >
              <div style={{ fontWeight: 600, fontSize: 14 }}>{n.title || "(untitled)"}</div>
              <div style={{ fontSize: 12, opacity: 0.7 }}>
                {new Date(n.updated_at).toLocaleString()}
              </div>
            </button>
          ))}
          {notes.length === 0 && (
            <div style={{ color: "#9ca3af" }}>No notes yet. Click "New" to create one.</div>
          )}
        </div>
      </div>

      {/* Right column: editor */}
      <div>
        {!selected ? (
          <div style={{ color: "#9ca3af" }}>Select a note from the left to start editing.</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                value={selected.title}
                onChange={onTitleChange}
                placeholder="Title"
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  fontSize: 16,
                  background: "#111827",
                  color: "#e5e7eb",
                  border: "1px solid #374151",
                  borderRadius: 8
                }}
              />
              <button
                onClick={() => selectedId && onDelete(selectedId)}
                style={{ background: "#7f1d1d", color: "white", padding: "8px 10px", borderRadius: 8 }}
              >
                Delete
              </button>
              <span style={{ fontSize: 12, color: saving ? "#93c5fd" : "#9ca3af" }}>
                {saving ? "Saving…" : "Saved"}
              </span>
            </div>
            <textarea
              value={selected.body}
              onChange={onBodyChange}
              placeholder="Write your note here…"
              style={{
                width: "100%",
                height: 420,
                padding: 12,
                fontSize: 14,
                lineHeight: 1.5,
                background: "#0b1220",
                color: "#e5e7eb",
                border: "1px solid #374151",
                borderRadius: 12,
                resize: "vertical"
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
