import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// Единая инициализация Admin SDK для всех actions (§4, §9 плана).
initializeApp();
export const db = getFirestore();

export interface GroupConfig {
  id: string;
  title: string;
}

export interface AppConfig {
  groups: GroupConfig[];
  blockSize: number;
  timezone: string;
}

export interface ExerciseDoc {
  name: string;
  groupId: string;
  archived: boolean;
  createdAt: FirebaseFirestore.Timestamp;
  lastWeight?: number;
  lastDate?: string;
}

export interface WeightLogDoc {
  exerciseId: string;
  groupId: string;
  date: string;
  weight: number;
  reps?: number;
  note?: string;
  createdAt: FirebaseFirestore.Timestamp;
}

export const configRef = db.doc("config/main") as FirebaseFirestore.DocumentReference<AppConfig>;
export const stateRef = db.doc(
  "state/workouts"
) as FirebaseFirestore.DocumentReference<import("./domain/rotation").WorkoutsState>;
export const workoutsCol = db.collection("workouts");
export const exercisesCol = db.collection(
  "exercises"
) as FirebaseFirestore.CollectionReference<ExerciseDoc>;
export const weightLogsCol = db.collection(
  "weightLogs"
) as FirebaseFirestore.CollectionReference<WeightLogDoc>;

/** "Сегодня" в заданной таймзоне, формат YYYY-MM-DD (§5 «Даты»). */
export function todayInTimezone(timezone: string): string {
  // en-CA форматирует даты как YYYY-MM-DD — готовый формат без сторонних библиотек.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
