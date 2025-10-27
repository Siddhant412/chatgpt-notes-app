export type NotesStructured = {
  notes: Array<{ id: string; title: string; updated_at: string }>;
  selectedId?: string | null;
  selected?: { id: string; title: string; body: string; updated_at: string } | null;
};

export type ToolResponse = {
  structuredContent?: NotesStructured;
  content?: Array<{ type: "text"; text: string }>;
  _meta?: Record<string, unknown>;
};
