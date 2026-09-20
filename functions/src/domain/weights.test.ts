import { describe, expect, it } from "vitest";
import { isLater, pickLatest, supersedesLast, type LogRef } from "./weights";

describe("supersedesLast", () => {
  it("первая запись у упражнения без истории всегда становится последней", () => {
    expect(supersedesLast(undefined, "2026-09-14")).toBe(true);
  });

  it("запись задним числом не перетирает lastWeight", () => {
    expect(supersedesLast("2026-09-14", "2026-09-01")).toBe(false);
  });

  it("запись той же датой побеждает (свежая правка того же дня)", () => {
    expect(supersedesLast("2026-09-14", "2026-09-14")).toBe(true);
  });

  it("запись более поздней датой побеждает", () => {
    expect(supersedesLast("2026-09-14", "2026-09-20")).toBe(true);
  });
});

describe("isLater", () => {
  it("сравнивает по дате в первую очередь", () => {
    const a: LogRef = { date: "2026-09-20", createdAtMs: 1 };
    const b: LogRef = { date: "2026-09-14", createdAtMs: 999 };
    expect(isLater(a, b)).toBe(true);
  });

  it("при равных датах сравнивает createdAt", () => {
    const a: LogRef = { date: "2026-09-14", createdAtMs: 200 };
    const b: LogRef = { date: "2026-09-14", createdAtMs: 100 };
    expect(isLater(a, b)).toBe(true);
    expect(isLater(b, a)).toBe(false);
  });
});

describe("pickLatest", () => {
  it("пустой список → null", () => {
    expect(pickLatest([])).toBeNull();
  });

  it("возвращает запись с максимальной датой", () => {
    const logs: LogRef[] = [
      { date: "2026-09-01", createdAtMs: 1 },
      { date: "2026-09-20", createdAtMs: 2 },
      { date: "2026-09-14", createdAtMs: 3 },
    ];
    expect(pickLatest(logs)).toEqual({ date: "2026-09-20", createdAtMs: 2 });
  });

  it("при одинаковых датах возвращает максимальный createdAt", () => {
    const logs: LogRef[] = [
      { date: "2026-09-14", createdAtMs: 100 },
      { date: "2026-09-14", createdAtMs: 300 },
      { date: "2026-09-14", createdAtMs: 200 },
    ];
    expect(pickLatest(logs)).toEqual({ date: "2026-09-14", createdAtMs: 300 });
  });
});
