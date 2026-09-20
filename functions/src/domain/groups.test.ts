import { describe, expect, it } from "vitest";
import { findGroupsProblem, sameGroupIds, type Group } from "./groups";

const CURRENT: Group[] = [
  { id: "back", title: "Спина" },
  { id: "chest", title: "Грудные" },
  { id: "legs", title: "Ноги" },
  { id: "arms", title: "Бицепс / трицепс" },
  { id: "shoulders", title: "Плечи" },
];

describe("sameGroupIds", () => {
  it("тот же набор в другом порядке → true", () => {
    const reordered = [...CURRENT].reverse();
    expect(sameGroupIds(CURRENT, reordered)).toBe(true);
  });

  it("убрали группу → false", () => {
    expect(sameGroupIds(CURRENT, CURRENT.slice(0, 4))).toBe(false);
  });

  it("добавили новую → false", () => {
    expect(sameGroupIds(CURRENT, [...CURRENT, { id: "core", title: "Пресс" }])).toBe(false);
  });

  it("заменили id при том же количестве → false", () => {
    const swapped = [...CURRENT.slice(0, 4), { id: "core", title: "Пресс" }];
    expect(sameGroupIds(CURRENT, swapped)).toBe(false);
  });
});

describe("findGroupsProblem", () => {
  it("валидный список → null", () => {
    expect(findGroupsProblem(CURRENT)).toBeNull();
  });

  it("дубликат id → проблема", () => {
    const dup = [...CURRENT, { id: "back", title: "Спина 2" }];
    expect(findGroupsProblem(dup)).not.toBeNull();
  });

  it("пустой title → проблема", () => {
    const blank = [{ id: "back", title: "  " }];
    expect(findGroupsProblem(blank)).not.toBeNull();
  });

  it("пустой массив → проблема", () => {
    expect(findGroupsProblem([])).not.toBeNull();
  });
});
