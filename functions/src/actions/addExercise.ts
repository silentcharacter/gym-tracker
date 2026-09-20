import { FieldValue } from "firebase-admin/firestore";
import { configRef, exercisesCol } from "../firestore";
import { HttpError } from "../httpError";
import type { AddExercisePayload } from "../schemas";

/** Создаёт упражнение в указанной группе (§6 плана). Без транзакции — единственная запись. */
export async function addExercise(payload: AddExercisePayload) {
  const configSnap = await configRef.get();
  const config = configSnap.data();
  if (!config) {
    throw new HttpError(500, "config/main is missing — run bootstrap-config first");
  }
  if (!config.groups.some((g) => g.id === payload.groupId)) {
    throw new HttpError(400, `unknown groupId: ${payload.groupId}`);
  }

  const ref = await exercisesCol.add({
    name: payload.name,
    groupId: payload.groupId,
    archived: false,
    createdAt: FieldValue.serverTimestamp(),
  });

  const created = await ref.get();
  return { id: ref.id, ...created.data() };
}
