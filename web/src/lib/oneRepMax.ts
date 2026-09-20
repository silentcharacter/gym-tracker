/**
 * Расчётный 1ПМ по формуле Эпли (§8 плана): w * (1 + reps / 30).
 * Без reps возвращает вес как есть — выдумывать точность, которой нет в данных, смысла нет
 * (spec/stage-3-polish.md, решение 3).
 */
export function epley(weight: number, reps: number | undefined): number {
  if (!reps) return weight;
  return weight * (1 + reps / 30);
}
