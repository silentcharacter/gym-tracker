import { selectionChanged } from "../lib/haptics";
import type { GroupConfig } from "../types";

/** Чипы групп мышц, порядок = config.groups, перенос на несколько строк (мокап §8). */
export function GroupChips({
  groups,
  activeId,
  onChange,
}: {
  groups: GroupConfig[];
  activeId: string | null;
  onChange: (id: string) => void;
}) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {groups.map((g) => {
        const active = g.id === activeId;
        return (
          <button
            key={g.id}
            onClick={() => {
              if (!active) selectionChanged();
              onChange(g.id);
            }}
            style={{
              padding: "8px 14px",
              borderRadius: 999,
              border: "none",
              background: active ? "var(--accent)" : "var(--card)",
              color: active ? "var(--accent-text)" : "var(--text)",
              fontSize: 14,
            }}
          >
            {g.title}
          </button>
        );
      })}
    </div>
  );
}
