import { useEffect, useMemo, useState } from "react";
import { ApiError, postApi } from "../api";
import { EmptyState } from "../components/EmptyState";
import { GroupChips } from "../components/GroupChips";
import { Modal } from "../components/Modal";
import { Skeleton } from "../components/Skeleton";
import { fetchConfig, fetchExercises } from "../firebase";
import { formatShortDate } from "../lib/format";
import { notifyError, notifySuccess } from "../lib/haptics";
import type { AppConfig, ExerciseDoc } from "../types";

interface Props {
  isOwner: boolean;
  selectedGroupId: string | null;
  onSelectGroup: (id: string) => void;
  onOpenExercise: (id: string) => void;
}

export function Weights({ isOwner, selectedGroupId, onSelectGroup, onOpenExercise }: Props) {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [exercises, setExercises] = useState<ExerciseDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);

  async function loadAll() {
    const [cfg, ex] = await Promise.all([fetchConfig(), fetchExercises()]);
    setConfig(cfg);
    setExercises(ex);
  }

  useEffect(() => {
    loadAll()
      .catch((err) => setError(String(err)))
      .finally(() => setLoading(false));
  }, []);

  const activeGroupId = selectedGroupId ?? config?.groups[0]?.id ?? null;

  const groupExercises = useMemo(() => {
    return exercises
      .filter((e) => e.groupId === activeGroupId && !e.archived)
      .sort((a, b) => a.name.localeCompare(b.name, "ru"));
  }, [exercises, activeGroupId]);

  async function handleAdd() {
    if (!activeGroupId || !newName.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await postApi("addExercise", { name: newName.trim(), groupId: activeGroupId });
      notifySuccess();
      setNewName("");
      setAdding(false);
      await loadAll();
    } catch (err) {
      notifyError();
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 16 }}>
        <Skeleton height={32} width="60%" />
        <Skeleton height={48} />
        <Skeleton height={48} />
        <Skeleton height={48} />
        <Skeleton height={48} />
      </div>
    );
  }
  if (!config) return <EmptyState>Нет данных. Нужен bootstrap-config.</EmptyState>;

  return (
    <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 16 }}>
      {error && <div style={{ color: "var(--danger)", fontSize: 14 }}>{error}</div>}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <GroupChips groups={config.groups} activeId={activeGroupId} onChange={onSelectGroup} />
        {isOwner && (
          <button
            onClick={() => setAdding(true)}
            style={{
              flexShrink: 0,
              marginLeft: 8,
              width: 32,
              height: 32,
              borderRadius: "50%",
              border: "none",
              background: "var(--card)",
              color: "var(--text)",
              fontSize: 18,
            }}
          >
            +
          </button>
        )}
      </div>

      <div>
        {groupExercises.length === 0 && (
          <EmptyState>В этой группе пока нет упражнений</EmptyState>
        )}
        {groupExercises.map((e) => (
          <button
            key={e.id}
            onClick={() => onOpenExercise(e.id)}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              width: "100%",
              padding: "12px 4px",
              background: "transparent",
              border: "none",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
              color: "var(--text)",
              textAlign: "left",
            }}
          >
            <div>
              <div style={{ fontSize: 16 }}>{e.name}</div>
              {e.lastDate && (
                <div style={{ fontSize: 13, color: "var(--hint)" }}>
                  {formatShortDate(e.lastDate)}
                </div>
              )}
            </div>
            <div style={{ fontSize: 17, fontWeight: 600 }}>
              {e.lastWeight != null ? `${e.lastWeight} кг` : "—"}
            </div>
          </button>
        ))}
      </div>

      {adding && (
        <Modal title="Новое упражнение" onClose={() => setAdding(false)}>
          <input
            autoFocus
            value={newName}
            onChange={(ev) => setNewName(ev.target.value)}
            placeholder="Название"
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.15)",
              background: "var(--bg)",
              color: "var(--text)",
              fontSize: 16,
              marginBottom: 16,
              boxSizing: "border-box",
            }}
          />
          <button
            onClick={handleAdd}
            disabled={saving || !newName.trim()}
            style={{
              width: "100%",
              padding: "12px 0",
              borderRadius: 10,
              border: "none",
              background: "var(--accent)",
              color: "var(--accent-text)",
              fontSize: 16,
              opacity: saving || !newName.trim() ? 0.6 : 1,
            }}
          >
            Добавить
          </button>
        </Modal>
      )}
    </div>
  );
}
