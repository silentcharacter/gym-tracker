import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useEffect, useState } from "react";
import { ApiError, postApi } from "../api";
import { fetchConfig } from "../firebase";
import { bindBackButton } from "../telegram";
import type { GroupConfig } from "../types";

interface Props {
  onBack: () => void;
}

/**
 * Вложенный экран поверх «Тренировок» (§8, §10 этап 3). Перетаскивание — @dnd-kit/sortable
 * с PointerSensor и activationConstraint, чтобы обычный скролл списка не начинал drag
 * (spec/stage-3-polish.md, решение 6). После сохранения возврат на «Тренировки» размонтирует
 * этот экран и заново смонтирует Workouts — она перечитает config/main с новым порядком
 * (§11: «Следующая: …» должна показать группу по новому порядку, а не патчиться локально).
 */
export function GroupOrder({ onBack }: Props) {
  const [groups, setGroups] = useState<GroupConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => bindBackButton(onBack), [onBack]);

  useEffect(() => {
    fetchConfig()
      .then((cfg) => setGroups(cfg?.groups ?? []))
      .catch((err) => setError(String(err)))
      .finally(() => setLoading(false));
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { delay: 150, tolerance: 5 } })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setGroups((prev) => {
      const oldIndex = prev.findIndex((g) => g.id === active.id);
      const newIndex = prev.findIndex((g) => g.id === over.id);
      const next = [...prev];
      const [moved] = next.splice(oldIndex, 1);
      next.splice(newIndex, 0, moved);
      return next;
    });
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await postApi("updateConfig", { groups });
      onBack();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div style={{ padding: 32, color: "var(--hint)" }}>Загрузка…</div>;

  return (
    <div style={{ padding: 16, paddingBottom: 90, display: "flex", flexDirection: "column", gap: 16 }}>
      <strong style={{ fontSize: 18 }}>Порядок групп</strong>
      {error && <div style={{ color: "var(--danger)", fontSize: 14 }}>{error}</div>}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={groups.map((g) => g.id)} strategy={verticalListSortingStrategy}>
          <div>
            {groups.map((g) => (
              <SortableRow key={g.id} group={g} />
            ))}
          </div>
        </SortableContext>
      </DndContext>

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
    </div>
  );
}

function SortableRow({ group }: { group: GroupConfig }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: group.id,
  });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 8px",
        marginBottom: 6,
        borderRadius: 10,
        background: "var(--card)",
        opacity: isDragging ? 0.6 : 1,
      }}
    >
      <span {...attributes} {...listeners} style={{ color: "var(--hint)", cursor: "grab", touchAction: "none" }}>
        ≡
      </span>
      <span>{group.title}</span>
    </div>
  );
}
