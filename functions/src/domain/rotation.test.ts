import { describe, expect, it } from "vitest";
import {
  EMPTY_STATE,
  advanceBlock,
  applyWorkout,
  nextGroupId,
  recomputeStateAfterUndo,
  type WorkoutRecord,
  type WorkoutsState,
} from "./rotation";

const GROUPS = ["legs", "shoulders", "chest", "arms", "back"];

describe("nextGroupId", () => {
  it("возвращает первую группу, если ещё не было тренировок", () => {
    expect(nextGroupId(GROUPS, null)).toBe("legs");
  });

  it("идёт по кругу после последней группы", () => {
    expect(nextGroupId(GROUPS, "back")).toBe("legs");
  });

  it("продолжает от фактической последней группы, а не по totalCount % 5", () => {
    // Тренер вручную поставил "chest", хотя по формуле должна быть другая группа —
    // следующая всё равно "arms", т.к. считается от lastGroupId.
    expect(nextGroupId(GROUPS, "chest")).toBe("arms");
  });

  it("если lastGroupId убрали из config.groups — следующая первая", () => {
    expect(nextGroupId(GROUPS, "removed-group")).toBe("legs");
  });
});

describe("advanceBlock", () => {
  it("увеличивает позицию внутри блока", () => {
    expect(advanceBlock({ currentBlockNo: 7, countInBlock: 9 }, 12)).toEqual({
      blockNo: 7,
      posInBlock: 10,
      countInBlock: 10,
    });
  });

  it("на границе блока (12-я) начинает новый блок с позиции 1", () => {
    expect(advanceBlock({ currentBlockNo: 7, countInBlock: 12 }, 12)).toEqual({
      blockNo: 8,
      posInBlock: 1,
      countInBlock: 1,
    });
  });
});

describe("applyWorkout", () => {
  it("13-я тренировка получает blockNo + 1 и posInBlock = 1 (критерий приёмки §11)", () => {
    const state: WorkoutsState = {
      totalCount: 12,
      currentBlockNo: 1,
      countInBlock: 12,
      lastGroupId: "chest", // позиция 12 в ротации 5 групп: legs,shoulders,chest,arms,back,legs,...
    };
    const { workout, nextState } = applyWorkout(state, GROUPS, 12);

    expect(workout.blockNo).toBe(2);
    expect(workout.posInBlock).toBe(1);
    expect(workout.seq).toBe(13);
    expect(workout.groupId).toBe("arms"); // следующая после chest
    expect(nextState).toEqual({
      totalCount: 13,
      currentBlockNo: 2,
      countInBlock: 1,
      lastGroupId: "arms",
    });
  });

  it("ротация продолжается через границу блока (12 не кратно 5)", () => {
    // Раскручиваем 12 тренировок подряд от пустого состояния и проверяем 13-ю.
    let state = EMPTY_STATE;
    for (let i = 0; i < 12; i++) {
      state = applyWorkout(state, GROUPS, 12).nextState;
    }
    // После 12 тренировок группы прошли 2 полных круга по 5 + ещё 2 = группа "shoulders" (индекс 1).
    expect(state.lastGroupId).toBe("shoulders");

    const { workout } = applyWorkout(state, GROUPS, 12);
    expect(workout.groupId).toBe("chest"); // ротация не сбросилась на границе блока
    expect(workout.blockNo).toBe(2);
    expect(workout.posInBlock).toBe(1);
  });

  it("groupIdOverride переопределяет группу, но не ломает счётчики блока", () => {
    const { workout, nextState } = applyWorkout(EMPTY_STATE, GROUPS, 12, "back");
    expect(workout.groupId).toBe("back");
    expect(workout.posInBlock).toBe(1);
    expect(nextState.lastGroupId).toBe("back");
  });
});

describe("recomputeStateAfterUndo", () => {
  it("восстанавливает state по предпоследней записи", () => {
    const previous: WorkoutRecord = { groupId: "legs", blockNo: 6, posInBlock: 12, seq: 72 };
    expect(recomputeStateAfterUndo(previous)).toEqual({
      totalCount: 72,
      currentBlockNo: 6,
      countInBlock: 12,
      lastGroupId: "legs",
    });
  });

  it("если удалённая запись была единственной — пустой state", () => {
    expect(recomputeStateAfterUndo(null)).toEqual(EMPTY_STATE);
  });

  it("undo — обратная операция к applyWorkout", () => {
    const state: WorkoutsState = {
      totalCount: 10,
      currentBlockNo: 1,
      countInBlock: 10,
      lastGroupId: "legs",
    };
    const { workout } = applyWorkout(state, GROUPS, 12);
    // "предыдущая" запись перед новой — это как раз состояние до неё, представленное записью.
    const previousRecord: WorkoutRecord = {
      groupId: state.lastGroupId!,
      blockNo: state.currentBlockNo,
      posInBlock: state.countInBlock,
      seq: state.totalCount,
    };
    expect(recomputeStateAfterUndo(previousRecord)).toEqual(state);
    void workout;
  });
});
