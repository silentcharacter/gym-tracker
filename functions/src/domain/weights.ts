// Чистая логика "последней записи" веса (§4, §5 плана; см. spec/stage-2-weights.md, решение 1).
// "Последняя запись" — максимальная date, при равенстве — максимальный createdAt.

export interface LogRef {
  date: string; // YYYY-MM-DD
  createdAtMs: number; // Timestamp.toMillis()
}

export function isLater(a: LogRef, b: LogRef): boolean {
  if (a.date !== b.date) return a.date > b.date;
  return a.createdAtMs > b.createdAtMs;
}

/**
 * Становится ли новая запись с датой candidateDate последней для упражнения.
 * lastDate === undefined значит, что у упражнения ещё нет записей.
 * Запись той же датой считается более новой (свежая правка того же дня побеждает) —
 * при добавлении новой записи createdAt всегда больше, чем у уже существующих.
 */
export function supersedesLast(lastDate: string | undefined, candidateDate: string): boolean {
  if (lastDate === undefined) return true;
  return candidateDate >= lastDate;
}

/** Выбирает новую "последнюю" запись после удаления текущей. [] → null. */
export function pickLatest<T extends LogRef>(logs: T[]): T | null {
  let best: T | null = null;
  for (const log of logs) {
    if (best === null || isLater(log, best)) {
      best = log;
    }
  }
  return best;
}
