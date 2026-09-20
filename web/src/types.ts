// Формы документов Firestore, читаемых клиентом напрямую (§4 плана, чтение открыто всем).
// Зеркалит functions/src/firestore.ts и functions/src/domain/rotation.ts — отдельного общего
// пакета между функциями и вебом на этом этапе нет, поля стабильны и меняются редко.

export interface GroupConfig {
  id: string;
  title: string;
}

export interface AppConfig {
  groups: GroupConfig[];
  blockSize: number;
  timezone: string;
}

export interface WorkoutsState {
  totalCount: number;
  currentBlockNo: number;
  countInBlock: number;
  lastGroupId: string | null;
}

export interface WorkoutDoc {
  id: string;
  date: string;
  groupId: string;
  blockNo: number;
  posInBlock: number;
  seq: number;
}

export interface ExerciseDoc {
  id: string;
  name: string;
  groupId: string;
  archived: boolean;
  lastWeight?: number;
  lastDate?: string;
}

export interface WeightLogDoc {
  id: string;
  exerciseId: string;
  groupId: string;
  date: string;
  weight: number;
  reps?: number;
  note?: string;
}
