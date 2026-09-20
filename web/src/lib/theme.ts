// Canvas не понимает CSS-переменные — Chart.js рисует строками цветов, которые парсит сам,
// поэтому для графика цвета читаются через getComputedStyle (spec/stage-3-polish.md,
// «Проверенные факты»). Остальной интерфейс использует var(--accent, ...) напрямую в CSS/inline
// style и в этой функции не нуждается.
export function readThemeColor(name: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

export { onThemeChanged } from "../telegram";
