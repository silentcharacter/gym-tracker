import { FieldValue } from "firebase-admin/firestore";
import { EMPTY_STATE, applyWorkout, type WorkoutsState } from "../domain/rotation";
import { configRef, db, stateRef, todayInTimezone, workoutsCol } from "../firestore";
import { HttpError } from "../httpError";
import type { AddWorkoutPayload } from "../schemas";

/**
 * Создаёт новую тренировку и продвигает state (§5 «Блок», §5 «Следующая группа»).
 * config/main должен существовать заранее — см. scripts/bootstrap-config.ts.
 */
export async function addWorkout(payload: AddWorkoutPayload) {
  return db.runTransaction(async (t) => {
    const [configSnap, stateSnap] = await Promise.all([t.get(configRef), t.get(stateRef)]);
    const config = configSnap.data();
    if (!config) {
      throw new HttpError(500, "config/main is missing — run bootstrap-config first");
    }

    const state: WorkoutsState = stateSnap.data() ?? EMPTY_STATE;
    const groupIds = config.groups.map((g) => g.id);
    const { workout, nextState } = applyWorkout(
      state,
      groupIds,
      config.blockSize,
      payload.groupId
    );
    const date = payload.date ?? todayInTimezone(config.timezone);

    const workoutRef = workoutsCol.doc();
    t.set(workoutRef, {
      date,
      groupId: workout.groupId,
      blockNo: workout.blockNo,
      posInBlock: workout.posInBlock,
      seq: workout.seq,
      createdAt: FieldValue.serverTimestamp(),
    });
    t.set(stateRef, nextState);

    return {
      workout: { id: workoutRef.id, date, ...workout },
      state: nextState,
    };
  });
}
