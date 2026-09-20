import { findGroupsProblem, sameGroupIds } from "../domain/groups";
import { configRef, db } from "../firestore";
import { HttpError } from "../httpError";
import type { UpdateConfigPayload } from "../schemas";

/**
 * Обновляет config/main: порядок/названия групп, blockSize, timezone (§5, §6 плана).
 * Набор id менять нельзя (решение 5, spec/stage-3-polish.md) — groupId денормализован
 * в workouts/exercises/weightLogs, удаление группы осиротило бы эти документы.
 * state/workouts не трогаем — это и есть требование §5: следующая группа пересчитывается
 * по новому порядку от уже существующего lastGroupId.
 */
export async function updateConfig(payload: UpdateConfigPayload) {
  return db.runTransaction(async (t) => {
    const snap = await t.get(configRef);
    const current = snap.data();
    if (!current) {
      throw new HttpError(500, "config/main is missing — run bootstrap-config first");
    }

    if (payload.groups) {
      const problem = findGroupsProblem(payload.groups);
      if (problem) {
        throw new HttpError(400, problem);
      }
      if (!sameGroupIds(current.groups, payload.groups)) {
        throw new HttpError(400, "changing the set of group ids is not supported");
      }
    }

    const patch: Partial<typeof current> = {};
    if (payload.groups) patch.groups = payload.groups;
    if (payload.blockSize !== undefined) patch.blockSize = payload.blockSize;
    if (payload.timezone !== undefined) patch.timezone = payload.timezone;

    t.update(configRef, patch);
    return { ...current, ...patch };
  });
}
