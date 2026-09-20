import { FieldValue } from "firebase-admin/firestore";
import { supersedesLast } from "../domain/weights";
import { configRef, db, exercisesCol, todayInTimezone, weightLogsCol } from "../firestore";
import { HttpError } from "../httpError";
import type { AddWeightPayload } from "../schemas";

/** Пишет запись веса и при необходимости обновляет денормализацию lastWeight/lastDate (§5, §6). */
export async function addWeight(payload: AddWeightPayload) {
  const exerciseRef = exercisesCol.doc(payload.exerciseId);

  return db.runTransaction(async (t) => {
    const [exerciseSnap, configSnap] = await Promise.all([t.get(exerciseRef), t.get(configRef)]);
    if (!exerciseSnap.exists) {
      throw new HttpError(404, "exercise not found");
    }
    const exercise = exerciseSnap.data()!;
    const config = configSnap.data();
    if (!config) {
      throw new HttpError(500, "config/main is missing — run bootstrap-config first");
    }

    const date = payload.date ?? todayInTimezone(config.timezone);

    const logRef = weightLogsCol.doc();
    t.set(logRef, {
      exerciseId: payload.exerciseId,
      groupId: exercise.groupId, // денормализуется из упражнения, не из payload
      date,
      weight: payload.weight,
      ...(payload.reps !== undefined ? { reps: payload.reps } : {}),
      ...(payload.note !== undefined ? { note: payload.note } : {}),
      createdAt: FieldValue.serverTimestamp(),
    });

    let lastWeight = exercise.lastWeight;
    let lastDate = exercise.lastDate;
    if (supersedesLast(exercise.lastDate, date)) {
      lastWeight = payload.weight;
      lastDate = date;
      t.update(exerciseRef, { lastWeight, lastDate });
    }

    return {
      log: {
        id: logRef.id,
        exerciseId: payload.exerciseId,
        groupId: exercise.groupId,
        date,
        weight: payload.weight,
        reps: payload.reps,
        note: payload.note,
      },
      lastWeight: lastWeight ?? null,
      lastDate: lastDate ?? null,
    };
  });
}
