import type { WorkoutsState } from "../domain/rotation";
import { db, stateRef } from "../firestore";
import { HttpError } from "../httpError";
import type { SeedPayload } from "../schemas";

/**
 * Разовая инициализация счётчиков текущим состоянием блока (§10 «Seed текущего состояния»).
 * Защищено от повторного вызова: если тренировки уже есть, возвращает 409 — иначе случайный
 * повторный тап тихо затирает боевые данные (см. spec/stage-1-workouts.md, решение 3).
 *
 * totalCount намеренно равен countInBlock: без истории прошлых блоков (§12 — отдельная задача)
 * единственный корректный источник глобального счётчика — то, что реально произошло в текущем
 * блоке. Следующий addWorkout продолжит seq от этого числа.
 */
export async function seed(payload: SeedPayload) {
  return db.runTransaction(async (t) => {
    const snap = await t.get(stateRef);
    const existing = snap.data();
    if (existing && existing.totalCount > 0) {
      throw new HttpError(409, "state already initialized — seed is only for the first run");
    }

    const state: WorkoutsState = {
      totalCount: payload.countInBlock,
      currentBlockNo: payload.currentBlockNo,
      countInBlock: payload.countInBlock,
      lastGroupId: payload.lastGroupId,
    };
    t.set(stateRef, state);

    return { state };
  });
}
