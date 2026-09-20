// Чистые проверки списка групп для updateConfig (§5, §6 плана; см. spec/stage-3-polish.md, решение 5).

export interface Group {
  id: string;
  title: string;
}

/** Тот же набор id, порядок не важен. */
export function sameGroupIds(current: Group[], next: Group[]): boolean {
  if (current.length !== next.length) return false;
  const currentIds = new Set(current.map((g) => g.id));
  return next.every((g) => currentIds.has(g.id));
}

/** Дубликаты id или пустые title делают список невалидным. Возвращает текст проблемы или null. */
export function findGroupsProblem(next: Group[]): string | null {
  if (next.length === 0) {
    return "groups must not be empty";
  }
  const seen = new Set<string>();
  for (const g of next) {
    if (!g.title.trim()) {
      return `group "${g.id}" has an empty title`;
    }
    if (seen.has(g.id)) {
      return `duplicate group id: ${g.id}`;
    }
    seen.add(g.id);
  }
  return null;
}
