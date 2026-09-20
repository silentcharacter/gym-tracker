import { selectionChanged } from "../lib/haptics";

export type Tab = "workouts" | "weights";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "workouts", label: "Тренировки", icon: "📅" },
  { id: "weights", label: "Веса", icon: "📈" },
];

export function TabBar({ active, onChange }: { active: Tab; onChange: (tab: Tab) => void }) {
  function handleChange(tab: Tab) {
    if (tab !== active) selectionChanged();
    onChange(tab);
  }

  return (
    <nav
      style={{
        display: "flex",
        borderTop: "1px solid rgba(255,255,255,0.08)",
        background: "var(--card)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      {TABS.map((tab) => {
        const isActive = tab.id === active;
        return (
          <button
            key={tab.id}
            onClick={() => handleChange(tab.id)}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 2,
              padding: "8px 0 10px",
              background: "transparent",
              border: "none",
              color: isActive ? "var(--accent)" : "var(--hint)",
              fontSize: 12,
            }}
          >
            <span style={{ fontSize: 18 }}>{tab.icon}</span>
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}
