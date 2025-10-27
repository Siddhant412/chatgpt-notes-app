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

function PillButton({
  variant = "neutral",
  onClick,
  children,
  title,
  disabled,
}: {
  variant?: "neutral" | "primary" | "danger";
  onClick?: () => void;
  children: React.ReactNode;
  title?: string;
  disabled?: boolean;
}) {
  const stylesBy = {
    neutral: {
      background: "#eef2f7",
      borderColor: "#d1d5db",
      color: "#111827",
    },
    primary: {
      background: "#e6ecff",
      borderColor: "#c7d2fe",
      color: "#111827",
    },
    danger: {
      background: "#fde8e8",
      borderColor: "#fecaca",
      color: "#7f1d1d",
    },
  } as const;

  const s = stylesBy[variant];
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      disabled={disabled}
      style={{
        padding: "8px 14px",
        borderRadius: 16,
        fontWeight: 600,
        border: `1px solid ${s.borderColor}`,
        background: s.background,
        color: s.color,
        cursor: disabled ? "not-allowed" : "pointer",
        boxShadow: "0 1px 0 rgba(0,0,0,0.05)",
        outline: "none",
      }}
    >
      {children}
    </button>
  );
}

export default function App() {
  const initial = useToolOutput();
  const [data, setData] = useState<NotesStructured | null>(initial);
  const [saving, setSaving] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
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
    setConfirmDelete(false);
    await call("get_note", { id });
  }

  async function onRefresh() {
    setConfirmDelete(false);
    await call("render_notes");
  }

  async function onCreate() {
    const title = (newTitle || "Untitled").trim();
    setShowNew(false);
    setNewTitle("");
    await call("create_note", { title, body: "" });
  }

  async function onDeleteConfirmed() {
    if (!selectedId) return;
    setConfirmDelete(false);
    await call("delete_note", { id: selectedId });
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
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "320px 1fr",
        gap: 16,
        padding: 16,
        background: "#ffffff",
        color: "#111827",
        borderRadius: 16,
        border: "1px solid #e5e7eb",
      }}
    >
      {/* Left column: list */}
      <div style={{ borderRight: "1px solid #e5e7eb", paddingRight: 16 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12 }}>
          <PillButton variant="neutral" onClick={onRefresh} title="Refresh">
            Refresh
          </PillButton>
          {!showNew ? (
            <PillButton variant="primary" onClick={() => setShowNew(true)} title="Add a new note">
              Add
            </PillButton>
          ) : (
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="New note title"
                style={{
                  padding: "8px 10px",
                  borderRadius: 12,
                  border: "1px solid #d1d5db",
                  width: 160,
                }}
              />
              <PillButton variant="primary" onClick={onCreate}>
                Create
              </PillButton>
              <PillButton variant="neutral" onClick={() => (setShowNew(false), setNewTitle(""))}>
                Cancel
              </PillButton>
            </div>
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {notes.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => onSelect(n.id)}
              style={{
                textAlign: "left",
                padding: "12px 14px",
                background: n.id === selectedId ? "#eef2ff" : "#f9fafb",
                color: "#111827",
                border: "1px solid #e5e7eb",
                borderRadius: 12,
                cursor: "pointer",
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 14 }}>{n.title || "(untitled)"}</div>
              <div style={{ fontSize: 12, opacity: 0.7 }}>
                {new Date(n.updated_at).toLocaleString()}
              </div>
            </button>
          ))}
          {notes.length === 0 && (
            <div style={{ color: "#6b7280" }}>No notes yet. Click “Add” to create one.</div>
          )}
        </div>
      </div>

      {/* Right column: editor */}
      <div>
        {!selected ? (
          <div style={{ color: "#6b7280" }}>Select a note from the left to start editing.</div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <input
                value={selected.title}
                onChange={onTitleChange}
                placeholder="Title"
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  fontSize: 16,
                  background: "#ffffff",
                  color: "#111827",
                  border: "1px solid #d1d5db",
                  borderRadius: 12,
                }}
              />
              {!confirmDelete ? (
                <PillButton
                  variant="danger"
                  onClick={() => setConfirmDelete(true)}
                  title="Delete this note"
                  disabled={!selectedId}
                >
                  Delete
                </PillButton>
              ) : (
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <PillButton variant="danger" onClick={onDeleteConfirmed}>
                    Confirm delete
                  </PillButton>
                  <PillButton variant="neutral" onClick={() => setConfirmDelete(false)}>
                    Cancel
                  </PillButton>
                </div>
              )}
              <span style={{ fontSize: 12, color: saving ? "#2563eb" : "#6b7280" }}>
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
                padding: 14,
                fontSize: 14,
                lineHeight: 1.6,
                background: "#fcfcfd",
                color: "#111827",
                border: "1px solid #e5e7eb",
                borderRadius: 14,
                resize: "vertical",
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
