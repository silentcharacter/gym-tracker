import type { ReactNode } from "react";

/** Общий контейнер для «Новое упражнение», «Переименовать / Архивировать» (§8). */
export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 360,
          background: "var(--card)",
          borderRadius: 16,
          padding: 20,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
          <strong style={{ fontSize: 17 }}>{title}</strong>
          <button
            onClick={onClose}
            style={{ background: "transparent", border: "none", color: "var(--hint)", fontSize: 18 }}
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
