import type { WorkoutsState } from "../domain/rotation";
import { db, stateRef, workoutsCol } from "../firestore";
import { HttpError } from "../httpError";
import type { SetWorkoutGroupPayload } from "../schemas";

/**
 * Меняет группу у произвольной тренировки (§5 «Смена группы у последней тренировки»).
 * На очередь влияет только смена группы у ПОСЛЕДНЕЙ записи — тогда обновляется и
 * state.lastGroupId. Для более старых записей это чисто косметическое изменение.
 */
export async function setWorkoutGroup(payload: SetWorkoutGroupPayload) {
  const workoutRef = workoutsCol.doc(payload.workoutId);

  return db.runTransaction(async (t) => {
    const [workoutSnap, stateSnap] = await Promise.all([t.get(workoutRef), t.get(stateRef)]);
    if (!workoutSnap.exists) {
      throw new HttpError(404, "workout not found");
    }

    const workout = workoutSnap.data() as { seq: number };
    const state = stateSnap.data() as WorkoutsState | undefined;

    t.update(workoutRef, { groupId: payload.groupId });

    const isLast = state != null && workout.seq === state.totalCount;
    if (isLast) {
      t.update(stateRef, { lastGroupId: payload.groupId });
    }

    return {
      workoutId: payload.workoutId,
      groupId: payload.groupId,
      updatedLastGroup: isLast,
    };
  });
}
