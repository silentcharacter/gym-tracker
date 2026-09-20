import type { ReactNode } from "react";

/** Простой bottom sheet для меню действий (долгий тап по строке тренировки, §8). */
export function Sheet({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "flex-end",
        zIndex: 100,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          background: "var(--card)",
          borderRadius: "16px 16px 0 0",
          padding: "8px 0 24px",
        }}
      >
        {children}
      </div>
    </div>
  );
}

export function SheetButton({
  children,
  onClick,
  destructive,
}: {
  children: ReactNode;
  onClick: () => void;
  destructive?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "block",
        width: "100%",
        textAlign: "left",
        padding: "14px 20px",
        background: "transparent",
        border: "none",
        color: destructive ? "var(--danger)" : "var(--text)",
        fontSize: 16,
      }}
    >
      {children}
    </button>
  );
}
