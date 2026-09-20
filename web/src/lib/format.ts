// Свой массив сокращений вместо Intl, чтобы формат совпадал с мокапом («14 сен», не «14 сент.»,
// см. spec/stage-2-weights.md, «Проверенные факты»).
const MONTHS_SHORT = [
  "янв", "фев", "мар", "апр", "май", "июн",
  "июл", "авг", "сен", "окт", "ноя", "дек",
];

/** '2026-09-14' → '14 сен' */
export function formatShortDate(iso: string): string {
  const [, month, day] = iso.split("-");
  return `${Number(day)} ${MONTHS_SHORT[Number(month) - 1]}`;
}

/** 87.5 → '87,5'; 90 → '90' — вес без лишних нулей, с запятой как в мокапе. */
export function formatWeight(weight: number): string {
  return String(weight).replace(".", ",");
}
