import { exercisesCol } from "../firestore";
import { HttpError } from "../httpError";
import type { UpdateExercisePayload } from "../schemas";

/**
 * Переименование / архивация упражнения (§6, §8 плана). Смена группы намеренно не
 * поддерживается — иначе денормализованный weightLogs.groupId разошёлся бы с exercises.groupId
 * (см. spec/stage-2-weights.md, «Что входит»).
 */
export async function updateExercise(payload: UpdateExercisePayload) {
  const ref = exercisesCol.doc(payload.id);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new HttpError(404, "exercise not found");
  }

  const patch: { name?: string; archived?: boolean } = {};
  if (payload.name !== undefined) patch.name = payload.name;
  if (payload.archived !== undefined) patch.archived = payload.archived;

  await ref.update(patch);
  const updated = await ref.get();
  return { id: ref.id, ...updated.data() };
}
