import { FieldValue } from "firebase-admin/firestore";
import { db, exercisesCol, weightLogsCol } from "../firestore";
import { HttpError } from "../httpError";
import type { DeleteWeightPayload } from "../schemas";

/**
 * Удаляет запись веса и пересчитывает lastWeight/lastDate (§5, §6 плана).
 * Порядок чтений строго до записей — иначе Firestore бросает INVALID_ARGUMENT
 * (см. spec/stage-2-weights.md, «Проверенные факты»).
 */
export async function deleteWeight(payload: DeleteWeightPayload) {
  const logRef = weightLogsCol.doc(payload.id);

  return db.runTransaction(async (t) => {
    const logSnap = await t.get(logRef);
    if (!logSnap.exists) {
      throw new HttpError(404, "weight log not found");
    }
    const log = logSnap.data()!;
    const exerciseRef = exercisesCol.doc(log.exerciseId);

    const [exerciseSnap, topSnap] = await Promise.all([
      t.get(exerciseRef),
      t.get(
        weightLogsCol
          .where("exerciseId", "==", log.exerciseId)
          .orderBy("date", "desc")
          .orderBy("createdAt", "desc")
          .limit(2)
      ),
    ]);
    if (!exerciseSnap.exists) {
      throw new HttpError(404, "exercise not found");
    }

    t.delete(logRef);

    const candidate = topSnap.docs.find((d) => d.id !== payload.id)?.data();

    let lastWeight: number | null;
    let lastDate: string | null;
    if (candidate) {
      lastWeight = candidate.weight;
      lastDate = candidate.date;
      t.update(exerciseRef, { lastWeight, lastDate });
    } else {
      lastWeight = null;
      lastDate = null;
      t.update(exerciseRef, { lastWeight: FieldValue.delete(), lastDate: FieldValue.delete() });
    }

    return { ok: true, lastWeight, lastDate };
  });
}
