import { useEffect, useMemo, useRef, useState } from "react";
import { ApiError, postApi } from "../api";
import { EmptyState } from "../components/EmptyState";
import { ProgressBar } from "../components/ProgressBar";
import { Sheet, SheetButton } from "../components/Sheet";
import { Skeleton } from "../components/Skeleton";
import { Toast } from "../components/Toast";
import { nextGroupId } from "../domain";
import { fetchConfig, fetchRecentWorkouts, fetchState } from "../firebase";
import { notifyError, notifySuccess } from "../lib/haptics";
import { formatShortDate } from "../lib/format";
import type { AppConfig, WorkoutDoc, WorkoutsState } from "../types";

const LONG_PRESS_MS = 500;

interface Props {
  isOwner: boolean;
  onOpenWeightsForGroup: (groupId: string, groupTitle: string) => void;
}

interface AddWorkoutResult {
  workout: { id: string; groupId: string };
  state: WorkoutsState;
}

export function Workouts({ isOwner, onOpenWeightsForGroup }: Props) {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [state, setState] = useState<WorkoutsState | null>(null);
  const [workouts, setWorkouts] = useState<WorkoutDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [undoPending, setUndoPending] = useState(false);
  // Блоки, у которых пользователь переключил свёрнутость вручную (относительно дефолта:
  // текущий блок раскрыт, остальные свёрнуты). Именно XOR с дефолтом, а не отдельный
  // "свёрнут/раскрыт" флаг — иначе тогл прошлых блоков всегда перебивался бы дефолтом.
  const [toggledBlocks, setToggledBlocks] = useState<Set<number>>(new Set());
  const [menuWorkout, setMenuWorkout] = useState<WorkoutDoc | null>(null);
  const [pickingGroup, setPickingGroup] = useState(false);
  const [toast, setToast] = useState<{ groupId: string; groupTitle: string } | null>(null);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function loadAll() {
    const [cfg, st, wk] = await Promise.all([fetchConfig(), fetchState(), fetchRecentWorkouts()]);
    setConfig(cfg);
    setState(st);
    setWorkouts(wk);
  }

  useEffect(() => {
    loadAll()
      .catch((err) => setError(String(err)))
      .finally(() => setLoading(false));
  }, []);

  const groupTitleById = useMemo(() => {
    const map = new Map<string, string>();
    config?.groups.forEach((g) => map.set(g.id, g.title));
    return map;
  }, [config]);

  const nextGroupTitle = useMemo(() => {
    if (!config) return null;
    const id = nextGroupId(
      config.groups.map((g) => g.id),
      state?.lastGroupId ?? null
    );
    return id ? (groupTitleById.get(id) ?? id) : null;
  }, [config, state, groupTitleById]);

  const blocks = useMemo(() => {
    const byBlock = new Map<number, WorkoutDoc[]>();
    for (const w of workouts) {
      if (!byBlock.has(w.blockNo)) byBlock.set(w.blockNo, []);
      byBlock.get(w.blockNo)!.push(w);
    }
    return [...byBlock.entries()].sort((a, b) => b[0] - a[0]);
  }, [workouts]);

  async function handleAddWorkout() {
    setPending(true);
    setError(null);
    try {
      const result = await postApi<AddWorkoutResult>("addWorkout");
      await loadAll();
      notifySuccess();
      const groupTitle = groupTitleById.get(result.workout.groupId) ?? result.workout.groupId;
      setToast({ groupId: result.workout.groupId, groupTitle });
    } catch (err) {
      notifyError();
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setPending(false);
    }
  }

  async function handleSetGroup(workout: WorkoutDoc, groupId: string) {
    try {
      await postApi("setWorkoutGroup", { workoutId: workout.id, groupId });
      await loadAll();
      notifySuccess();
    } catch (err) {
      notifyError();
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setMenuWorkout(null);
      setPickingGroup(false);
    }
  }

  async function handleUndo() {
    if (undoPending) return; // защита от двойного тапа — иначе второй запрос удалит следующую
    setUndoPending(true);
    try {
      await postApi("undoLastWorkout");
      await loadAll();
      notifySuccess();
    } catch (err) {
      notifyError();
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setUndoPending(false);
      setMenuWorkout(null);
    }
  }

  function handleDeleteFromMenu() {
    if (!confirm("Удалить последнюю тренировку?")) return;
    handleUndo();
  }

  function startPress(workout: WorkoutDoc) {
    if (!isOwner) return;
    pressTimer.current = setTimeout(() => setMenuWorkout(workout), LONG_PRESS_MS);
  }
  function cancelPress() {
    if (pressTimer.current) clearTimeout(pressTimer.current);
  }

  if (loading) {
    return (
      <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={card()}>
          <Skeleton height={22} width="50%" />
          <Skeleton height={6} />
        </div>
        <Skeleton height={20} />
        <Skeleton height={20} />
        <Skeleton height={20} />
      </div>
    );
  }
  if (!config || !state) {
    return <EmptyState>Нет данных. Нужен bootstrap-config и seed.</EmptyState>;
  }

  const isLastWorkout = (w: WorkoutDoc) => w.seq === state.totalCount;
  const remaining = config.blockSize - state.countInBlock;

  return (
    <div style={{ padding: 16, paddingBottom: 90, display: "flex", flexDirection: "column", gap: 16 }}>
      {error && <div style={{ color: "var(--danger)", fontSize: 14 }}>{error}</div>}

      <div style={card()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <strong style={{ fontSize: 18 }}>Блок №{state.currentBlockNo}</strong>
          <span style={{ color: "var(--hint)" }}>
            {state.countInBlock} из {config.blockSize}
          </span>
        </div>
        <div style={{ marginTop: 10 }}>
          <ProgressBar value={state.countInBlock} max={config.blockSize} />
        </div>
        {remaining > 0 && remaining <= 2 && (
          <div style={badge()}>
            Осталось {remaining} {remaining === 1 ? "тренировка" : "тренировки"}
          </div>
        )}
      </div>

      {nextGroupTitle && (
        <div style={card()}>
          <div style={{ color: "var(--hint)", fontSize: 13 }}>Следующая</div>
          <strong style={{ fontSize: 18 }}>{nextGroupTitle}</strong>
        </div>
      )}

      {workouts.length === 0 ? (
        <EmptyState>
          Пока нет тренировок{isOwner ? " — нажмите «Отметить тренировку» ниже" : ""}
        </EmptyState>
      ) : (
        <div>
          {blocks.map(([blockNo, items], idx) => {
            const isCurrent = idx === 0;
            const defaultCollapsed = !isCurrent;
            const collapsed = toggledBlocks.has(blockNo) ? !defaultCollapsed : defaultCollapsed;
            return (
              <div key={blockNo} style={{ marginBottom: 8 }}>
                <button
                  onClick={() =>
                    setToggledBlocks((prev) => {
                      const next = new Set(prev);
                      if (next.has(blockNo)) next.delete(blockNo);
                      else next.add(blockNo);
                      return next;
                    })
                  }
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    width: "100%",
                    background: "transparent",
                    border: "none",
                    color: "var(--hint)",
                    fontSize: 13,
                    padding: "6px 0",
                  }}
                >
                  <span>
                    Блок №{blockNo}
                    {!isCurrent ? ` · ${items.length} тренировок` : ""}
                  </span>
                  <span>{collapsed ? "⌄" : "⌃"}</span>
                </button>
                {!collapsed &&
                  items.map((w) => (
                    <div
                      key={w.id}
                      onPointerDown={() => startPress(w)}
                      onPointerUp={cancelPress}
                      onPointerLeave={cancelPress}
                      style={row()}
                    >
                      <span>
                        #{w.posInBlock} · {groupTitleById.get(w.groupId) ?? w.groupId}
                      </span>
                      <span style={{ color: "var(--hint)" }}>{formatShortDate(w.date)}</span>
                    </div>
                  ))}
              </div>
            );
          })}
        </div>
      )}

      {isOwner && (
        <button
          onClick={handleAddWorkout}
          disabled={pending}
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
            opacity: pending ? 0.6 : 1,
          }}
        >
          {pending ? "…" : "Отметить тренировку"}
        </button>
      )}

      {toast && (
        <Toast
          groupTitle={toast.groupTitle}
          onOpenWeights={() => {
            onOpenWeightsForGroup(toast.groupId, toast.groupTitle);
            setToast(null);
          }}
          onUndo={handleUndo}
          onClose={() => setToast(null)}
        />
      )}

      {menuWorkout && !pickingGroup && (
        <Sheet onClose={() => setMenuWorkout(null)}>
          <SheetButton onClick={() => setPickingGroup(true)}>Изменить группу</SheetButton>
          {isLastWorkout(menuWorkout) && (
            <SheetButton destructive onClick={handleDeleteFromMenu}>
              Удалить
            </SheetButton>
          )}
        </Sheet>
      )}

      {menuWorkout && pickingGroup && (
        <Sheet
          onClose={() => {
            setMenuWorkout(null);
            setPickingGroup(false);
          }}
        >
          {config.groups.map((g) => (
            <SheetButton key={g.id} onClick={() => handleSetGroup(menuWorkout, g.id)}>
              {g.title}
            </SheetButton>
          ))}
        </Sheet>
      )}
    </div>
  );
}

function card(): React.CSSProperties {
  return {
    background: "var(--card)",
    borderRadius: 14,
    padding: 16,
  };
}

function badge(): React.CSSProperties {
  return {
    marginTop: 10,
    display: "inline-block",
    padding: "4px 10px",
    borderRadius: 999,
    background: "rgba(255,170,0,0.15)",
    color: "#ffb020",
    fontSize: 13,
  };
}

function row(): React.CSSProperties {
  return {
    display: "flex",
    justifyContent: "space-between",
    padding: "10px 4px",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
  };
}
