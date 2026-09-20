import { recomputeStateAfterUndo, type WorkoutRecord } from "../domain/rotation";
import { db, stateRef, workoutsCol } from "../firestore";
import { HttpError } from "../httpError";

/**
 * Удаляет тренировку с максимальным seq и пересчитывает state по новой последней записи
 * (§5 «Undo последней тренировки»). Разрешено только для последней записи — здесь это
 * гарантируется тем, что удаляется именно она.
 */
export async function undoLastWorkout() {
  return db.runTransaction(async (t) => {
    const snap = await t.get(workoutsCol.orderBy("seq", "desc").limit(2));
    if (snap.empty) {
      throw new HttpError(409, "no workouts to undo");
    }

    const [last, previous] = snap.docs;
    t.delete(last.ref);

    const previousRecord: WorkoutRecord | null = previous
      ? (previous.data() as WorkoutRecord)
      : null;
    const nextState = recomputeStateAfterUndo(previousRecord);
    t.set(stateRef, nextState);

    return { state: nextState };
  });
}
