// Клиентское зеркало functions/src/domain/rotation.ts::nextGroupId — только для UI-предпросмотра
// карточки «Следующая: …» (§8). Сервер всё равно пересчитывает это в транзакции при реальном
// addWorkout, так что расхождение здесь не может привести к неверной записи, только к неверной
// подсказке в интерфейсе на долю секунды до подтверждения сервера.
export function nextGroupId(groups: string[], lastGroupId: string | null): string | null {
  if (groups.length === 0) return null;
  if (lastGroupId === null) return groups[0];
  const idx = groups.indexOf(lastGroupId);
  if (idx === -1) return groups[0];
  return groups[(idx + 1) % groups.length];
}
