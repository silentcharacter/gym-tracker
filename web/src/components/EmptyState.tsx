export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ padding: "32px 16px", textAlign: "center", color: "var(--hint)" }}>
      {children}
    </div>
  );
}
