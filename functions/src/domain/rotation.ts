// Чистая логика блоков тренировок и ротации групп мышц.
// Никакого Firestore здесь — это специально, чтобы можно было тестировать без эмулятора.
// См. spec/gym-tracker-plan.md §5 и spec/stage-1-workouts.md.

export interface WorkoutsState {
  totalCount: number;
  currentBlockNo: number;
  countInBlock: number; // 0..blockSize
  lastGroupId: string | null;
}

export interface WorkoutRecord {
  groupId: string;
  blockNo: number;
  posInBlock: number;
  seq: number;
}

export const EMPTY_STATE: WorkoutsState = {
  totalCount: 0,
  currentBlockNo: 1,
  countInBlock: 0,
  lastGroupId: null,
};

/**
 * Следующая группа определяется от последней ФАКТИЧЕСКОЙ группы, а не формулой
 * totalCount % groups.length — благодаря этому ручная смена группы не ломает очередь.
 * Если lastGroupId отсутствует в текущем списке групп (группу убрали из config),
 * следующей считается первая группа.
 */
export function nextGroupId(groups: string[], lastGroupId: string | null): string {
  if (groups.length === 0) {
    throw new Error("groups must not be empty");
  }
  if (lastGroupId === null) {
    return groups[0];
  }
  const idx = groups.indexOf(lastGroupId);
  if (idx === -1) {
    return groups[0];
  }
  return groups[(idx + 1) % groups.length];
}

/**
 * Граница блока и ротация групп независимы: blockSize (12) не кратен количеству групп (5),
 * поэтому ротация продолжается через границу блока как ни в чём не бывало.
 */
export function advanceBlock(
  state: Pick<WorkoutsState, "currentBlockNo" | "countInBlock">,
  blockSize: number
): { blockNo: number; posInBlock: number; countInBlock: number } {
  if (state.countInBlock >= blockSize) {
    return { blockNo: state.currentBlockNo + 1, posInBlock: 1, countInBlock: 1 };
  }
  return {
    blockNo: state.currentBlockNo,
    posInBlock: state.countInBlock + 1,
    countInBlock: state.countInBlock + 1,
  };
}

/**
 * Полный переход "есть state + список групп → новая тренировка + новый state".
 * groupIdOverride — ручной выбор группы вместо автоматической ротации (тренер может
 * скорректировать); на очередь для следующей тренировки это не влияет иначе, чем через
 * обновлённый lastGroupId.
 */
export function applyWorkout(
  state: WorkoutsState,
  groups: string[],
  blockSize: number,
  groupIdOverride?: string
): { workout: WorkoutRecord; nextState: WorkoutsState } {
  const groupId = groupIdOverride ?? nextGroupId(groups, state.lastGroupId);
  const { blockNo, posInBlock, countInBlock } = advanceBlock(state, blockSize);
  const seq = state.totalCount + 1;

  return {
    workout: { groupId, blockNo, posInBlock, seq },
    nextState: {
      totalCount: seq,
      currentBlockNo: blockNo,
      countInBlock,
      lastGroupId: groupId,
    },
  };
}

/**
 * Пересчёт state после удаления последней тренировки (undo). `previous` — запись, которая
 * становится последней после удаления, или null, если удалённая запись была единственной.
 */
export function recomputeStateAfterUndo(previous: WorkoutRecord | null): WorkoutsState {
  if (previous === null) {
    return { ...EMPTY_STATE };
  }
  return {
    totalCount: previous.seq,
    currentBlockNo: previous.blockNo,
    countInBlock: previous.posInBlock,
    lastGroupId: previous.groupId,
  };
}
