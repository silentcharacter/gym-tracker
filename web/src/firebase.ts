import { initializeApp } from "firebase/app";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  limit,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { firebaseConfig } from "./firebase.config";
import type { AppConfig, ExerciseDoc, WeightLogDoc, WorkoutDoc, WorkoutsState } from "./types";

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// Клиент только читает (§3, §7 плана) — вся запись идёт через api.ts.

export async function fetchConfig(): Promise<AppConfig | null> {
  const snap = await getDoc(doc(db, "config/main"));
  return snap.exists() ? (snap.data() as AppConfig) : null;
}

export async function fetchState(): Promise<WorkoutsState | null> {
  const snap = await getDoc(doc(db, "state/workouts"));
  return snap.exists() ? (snap.data() as WorkoutsState) : null;
}

/** Последние N тренировок, новые сверху — для списка на экране «Тренировки». */
export async function fetchRecentWorkouts(max = 30): Promise<WorkoutDoc[]> {
  const q = query(collection(db, "workouts"), orderBy("seq", "desc"), limit(max));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<WorkoutDoc, "id">) }));
}

/** Все упражнения — фильтрация по группе/archived делается на клиенте (§8, решение 5). */
export async function fetchExercises(): Promise<ExerciseDoc[]> {
  const snap = await getDocs(collection(db, "exercises"));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ExerciseDoc, "id">) }));
}

export async function fetchExercise(id: string): Promise<ExerciseDoc | null> {
  const snap = await getDoc(doc(db, "exercises", id));
  return snap.exists() ? { id: snap.id, ...(snap.data() as Omit<ExerciseDoc, "id">) } : null;
}

/** История записей веса по упражнению, старые сверху (для графика в этапе 3). */
export async function fetchWeightLogs(exerciseId: string): Promise<WeightLogDoc[]> {
  const q = query(
    collection(db, "weightLogs"),
    where("exerciseId", "==", exerciseId),
    orderBy("date", "asc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<WeightLogDoc, "id">) }));
}
