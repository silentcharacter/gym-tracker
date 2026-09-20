import { useEffect, useRef, useState } from "react";
import { ApiError, postApi } from "../api";
import { EmptyState } from "../components/EmptyState";
import { Modal } from "../components/Modal";
import { Skeleton } from "../components/Skeleton";
import { WeightChart } from "../components/WeightChart";
import { WeightStepper } from "../components/WeightStepper";
import { fetchExercise, fetchWeightLogs } from "../firebase";
import { formatShortDate, formatWeight } from "../lib/format";
import { notifyError, notifySuccess } from "../lib/haptics";
import { bindBackButton } from "../telegram";
import type { ExerciseDoc, WeightLogDoc } from "../types";

interface Props {
  exerciseId: string;
  isOwner: boolean;
  onBack: () => void;
}

interface AddWeightResult {
  log: WeightLogDoc;
  lastWeight: number | null;
  lastDate: string | null;
}

interface DeleteWeightResult {
  ok: true;
  lastWeight: number | null;
  lastDate: string | null;
}

export function Exercise({ exerciseId, isOwner, onBack }: Props) {
  const [exercise, setExercise] = useState<ExerciseDoc | null>(null);
  const [logs, setLogs] = useState<WeightLogDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [weight, setWeight] = useState(20);
  const [reps, setReps] = useState("");
  const [pickingDate, setPickingDate] = useState(false);
  const [date, setDate] = useState<string | null>(null); // null = сегодня
  const [saving, setSaving] = useState(false);

  const [editing, setEditing] = useState(false);
  const [renameValue, setRenameValue] = useState("");

  useEffect(() => bindBackButton(onBack), [onBack]);

  useEffect(() => {
    Promise.all([fetchExercise(exerciseId), fetchWeightLogs(exerciseId)])
      .then(([ex, lg]) => {
        setExercise(ex);
        setLogs(lg);
        if (ex?.lastWeight != null) setWeight(ex.lastWeight);
        if (ex) setRenameValue(ex.name);
      })
      .catch((err) => setError(String(err)))
      .finally(() => setLoading(false));
  }, [exerciseId]);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const parsedReps = reps.trim() ? Number(reps) : undefined;
      const result = await postApi<AddWeightResult>("addWeight", {
        exerciseId,
        weight,
        ...(parsedReps ? { reps: parsedReps } : {}),
        ...(date ? { date } : {}),
      });
      notifySuccess();
      setLogs((prev) => [...prev, result.log].sort((a, b) => a.date.localeCompare(b.date)));
      setExercise((prev) =>
        prev
          ? { ...prev, lastWeight: result.lastWeight ?? undefined, lastDate: result.lastDate ?? undefined }
          : prev
      );
      setReps("");
      setDate(null);
      setPickingDate(false);
    } catch (err) {
      notifyError();
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(log: WeightLogDoc) {
    if (!confirm(`Удалить запись ${formatWeight(log.weight)} кг от ${formatShortDate(log.date)}?`)) {
      return;
    }
    try {
      const result = await postApi<DeleteWeightResult>("deleteWeight", { id: log.id });
      notifySuccess();
      setLogs((prev) => prev.filter((l) => l.id !== log.id));
      setExercise((prev) =>
        prev
          ? { ...prev, lastWeight: result.lastWeight ?? undefined, lastDate: result.lastDate ?? undefined }
          : prev
      );
    } catch (err) {
      notifyError();
      setError(err instanceof ApiError ? err.message : String(err));
    }
  }

  async function handleRename() {
    if (!renameValue.trim()) return;
    try {
      await postApi("updateExercise", { id: exerciseId, name: renameValue.trim() });
      notifySuccess();
      setExercise((prev) => (prev ? { ...prev, name: renameValue.trim() } : prev));
      setEditing(false);
    } catch (err) {
      notifyError();
      setError(err instanceof ApiError ? err.message : String(err));
    }
  }

  async function handleArchive() {
    try {
      await postApi("updateExercise", { id: exerciseId, archived: true });
      notifySuccess();
      setEditing(false);
      onBack(); // §8: после архивации — принудительный возврат на «Веса»
    } catch (err) {
      notifyError();
      setError(err instanceof ApiError ? err.message : String(err));
    }
  }

  if (loading) {
    return (
      <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 16 }}>
        <Skeleton height={180} />
        <Skeleton height={20} />
        <Skeleton height={20} />
      </div>
    );
  }
  if (!exercise) return <EmptyState>Упражнение не найдено</EmptyState>;

  const historyDesc = [...logs].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div style={{ padding: 16, paddingBottom: 90, display: "flex", flexDirection: "column", gap: 16 }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <strong style={{ fontSize: 18 }}>{exercise.name}</strong>
        {isOwner && (
          <button
            onClick={() => setEditing(true)}
            style={{ background: "transparent", border: "none", color: "var(--hint)", fontSize: 18 }}
          >
            ✎
          </button>
        )}
      </header>

      {error && <div style={{ color: "var(--danger)", fontSize: 14 }}>{error}</div>}

      <WeightChart logs={logs} />

      {isOwner && (
        <div style={{ background: "var(--card)", borderRadius: 14, padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{ color: "var(--hint)", fontSize: 13 }}>Новая запись ·</span>
            {pickingDate ? (
              <input
                type="date"
                value={date ?? new Date().toISOString().slice(0, 10)}
                onChange={(ev) => setDate(ev.target.value)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--accent)",
                  fontSize: 13,
                }}
              />
            ) : (
              <button
                onClick={() => setPickingDate(true)}
                style={{ background: "transparent", border: "none", color: "var(--accent)", fontSize: 13 }}
              >
                сегодня
              </button>
            )}
          </div>

          <WeightStepper value={weight} onChange={setWeight} />

          <input
            value={reps}
            onChange={(ev) => setReps(ev.target.value.replace(/[^0-9]/g, ""))}
            inputMode="numeric"
            placeholder="Повторения (необязательно)"
            style={{
              width: "100%",
              marginTop: 12,
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.15)",
              background: "var(--bg)",
              color: "var(--text)",
              fontSize: 15,
              boxSizing: "border-box",
            }}
          />
        </div>
      )}

      <div>
        {historyDesc.length === 0 && <EmptyState>Пока нет записей</EmptyState>}
        {historyDesc.map((log) => (
          <HistoryRow
            key={log.id}
            log={log}
            isOwner={isOwner}
            onDelete={() => handleDelete(log)}
          />
        ))}
      </div>

      {isOwner && (
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            position: "fixed",
            left: 16,
            right: 16,
            bottom: "calc(66px + env(safe-area-inset-bottom))",
            padding: "14px 0",
            borderRadius: 12,
            border: "none",
            background: "var(--accent)",
            color: "var(--accent-text)",
            fontSize: 16,
            fontWeight: 600,
            opacity: saving ? 0.6 : 1,
          }}
        >
          {saving ? "…" : "Сохранить"}
        </button>
      )}

      {editing && (
        <Modal title="Упражнение" onClose={() => setEditing(false)}>
          <input
            value={renameValue}
            onChange={(ev) => setRenameValue(ev.target.value)}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.15)",
              background: "var(--bg)",
              color: "var(--text)",
              fontSize: 16,
              marginBottom: 12,
              boxSizing: "border-box",
            }}
          />
          <button
            onClick={handleRename}
            style={{
              width: "100%",
              padding: "12px 0",
              borderRadius: 10,
              border: "none",
              background: "var(--accent)",
              color: "var(--accent-text)",
              fontSize: 16,
              marginBottom: 8,
            }}
          >
            Переименовать
          </button>
          <button
            onClick={handleArchive}
            style={{
              width: "100%",
              padding: "12px 0",
              borderRadius: 10,
              border: "none",
              background: "transparent",
              color: "var(--danger)",
              fontSize: 16,
            }}
          >
            Архивировать
          </button>
        </Modal>
      )}
    </div>
  );
}

const SWIPE_THRESHOLD = 40;
const VERTICAL_CANCEL = 20;

/**
 * Строка истории: свайп влево или долгий тап → удаление (§8, §10 этап 3, перенесено из этапа 2).
 * Вертикальное движение отменяет жест, чтобы не конфликтовать со скроллом списка.
 */
function HistoryRow({
  log,
  isOwner,
  onDelete,
}: {
  log: WeightLogDoc;
  isOwner: boolean;
  onDelete: () => void;
}) {
  const [dragX, setDragX] = useState(0);
  const start = useRef<{ x: number; y: number } | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clearLongPress() {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }

  function handlePointerDown(e: React.PointerEvent) {
    if (!isOwner) return;
    start.current = { x: e.clientX, y: e.clientY };
    longPressTimer.current = setTimeout(() => {
      longPressTimer.current = null;
      onDelete();
    }, 500);
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!start.current) return;
    const dx = e.clientX - start.current.x;
    const dy = e.clientY - start.current.y;
    if (Math.abs(dy) > VERTICAL_CANCEL) {
      cancelGesture();
      return;
    }
    if (Math.abs(dx) > 10) clearLongPress();
    setDragX(Math.min(0, dx));
  }

  function handlePointerUp() {
    clearLongPress();
    if (dragX < -SWIPE_THRESHOLD) onDelete();
    setDragX(0);
    start.current = null;
  }

  function cancelGesture() {
    clearLongPress();
    setDragX(0);
    start.current = null;
  }

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={cancelGesture}
      style={{
        display: "flex",
        justifyContent: "space-between",
        padding: "10px 4px",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        transform: `translateX(${dragX}px)`,
        transition: dragX === 0 ? "transform 0.15s ease" : "none",
        touchAction: "pan-y",
      }}
    >
      <span>
        {formatWeight(log.weight)} кг{log.reps ? ` × ${log.reps}` : ""}
      </span>
      <span style={{ color: "var(--hint)" }}>{formatShortDate(log.date)}</span>
    </div>
  );
}
