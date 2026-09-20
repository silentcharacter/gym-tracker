import { useEffect, useRef, useState } from "react";

const AUTO_HIDE_MS = 5000;

/**
 * Toast после отметки тренировки (§8, §10 этап 3): «Отменить» + ссылка «Внести веса → […]».
 * Автоскрытие через 5с; после «Отменить» закрывается сразу, не дожидаясь таймера.
 * Повторный тап по «Отменить» блокируется на время запроса — иначе второй запрос удалит уже
 * следующую тренировку (spec/stage-3-polish.md).
 */
export function Toast({
  groupTitle,
  onOpenWeights,
  onUndo,
  onClose,
}: {
  groupTitle: string;
  onOpenWeights: () => void;
  onUndo: () => Promise<void>;
  onClose: () => void;
}) {
  const [undoing, setUndoing] = useState(false);
  const closeRef = useRef(onClose);

  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const timer = setTimeout(() => closeRef.current(), AUTO_HIDE_MS);
    return () => clearTimeout(timer);
  }, []);

  async function handleUndoClick() {
    if (undoing) return;
    setUndoing(true);
    try {
      await onUndo();
    } finally {
      onClose(); // закрывается сразу после ответа, не дожидаясь таймера
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        left: 16,
        right: 16,
        bottom: "calc(130px + env(safe-area-inset-bottom))",
        background: "var(--card)",
        borderRadius: 12,
        padding: "12px 14px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 12,
        boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
        zIndex: 50,
      }}
    >
      <button
        onClick={handleUndoClick}
        disabled={undoing}
        style={{
          background: "transparent",
          border: "none",
          color: "var(--danger)",
          fontSize: 14,
          fontWeight: 600,
          opacity: undoing ? 0.6 : 1,
        }}
      >
        Отменить
      </button>
      <button
        onClick={onOpenWeights}
        style={{
          flex: 1,
          textAlign: "right",
          background: "transparent",
          border: "none",
          color: "var(--accent)",
          fontSize: 14,
        }}
      >
        Внести веса → {groupTitle}
      </button>
    </div>
  );
}
