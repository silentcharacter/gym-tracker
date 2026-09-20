// Разовый импорт реальной истории тренировок + фикс порядка ротации в config/main (§12 плана,
// выполнено раньше срока по факту наличия данных у владельца — см. spec/stage-1-workouts.md).
//
// Порядок ротации подобран разбором всех 27 реальных тренировок: Спина → Грудные → Ноги →
// Бицепс/трицепс → Плечи → (снова Спина) предсказывает КАЖДЫЙ реальный выбор без исключений,
// включая 4 случая ручного пропуска дня рук (что подтверждает и корректность §5 «следующая
// группа считается от фактической последней, а не по жёсткой формуле»).
//
// Запуск: npm run import-history -- [--force]
// (--force нужен, если state/workouts уже не пуст — иначе скрипт откажется перезаписывать).

import { initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { applyWorkout, EMPTY_STATE } from "../domain/rotation";
import type { AppConfig } from "../firestore";

const CONFIG: AppConfig = {
  groups: [
    { id: "back", title: "Спина" },
    { id: "chest", title: "Грудные" },
    { id: "legs", title: "Ноги" },
    { id: "arms", title: "Бицепс / трицепс" },
    { id: "shoulders", title: "Плечи" },
  ],
  blockSize: 12,
  timezone: "Asia/Bangkok",
};

// Хронологический порядок, как прислал владелец.
const HISTORY: { date: string; groupId: string }[] = [
  { date: "2026-07-24", groupId: "back" },
  { date: "2026-07-27", groupId: "chest" },
  { date: "2026-07-29", groupId: "legs" },
  { date: "2026-07-31", groupId: "shoulders" },
  { date: "2026-08-05", groupId: "back" },
  { date: "2026-08-07", groupId: "chest" },
  { date: "2026-08-10", groupId: "legs" },
  { date: "2026-08-12", groupId: "shoulders" },
  { date: "2026-08-14", groupId: "back" },
  { date: "2026-08-17", groupId: "chest" },
  { date: "2026-08-18", groupId: "legs" },
  { date: "2026-08-20", groupId: "shoulders" },
  { date: "2026-08-21", groupId: "back" },
  { date: "2026-08-24", groupId: "chest" },
  { date: "2026-08-25", groupId: "legs" },
  { date: "2026-08-27", groupId: "shoulders" },
  { date: "2026-08-28", groupId: "back" },
  { date: "2026-09-03", groupId: "chest" },
  { date: "2026-09-04", groupId: "legs" },
  { date: "2026-09-07", groupId: "arms" },
  { date: "2026-09-08", groupId: "shoulders" },
  { date: "2026-09-10", groupId: "back" },
  { date: "2026-09-11", groupId: "chest" },
  { date: "2026-09-14", groupId: "legs" },
  { date: "2026-09-15", groupId: "arms" },
  { date: "2026-09-16", groupId: "shoulders" },
  { date: "2026-09-18", groupId: "back" },
];

async function main() {
  const force = process.argv.includes("--force");

  initializeApp();
  const db = getFirestore();

  const stateSnap = await db.doc("state/workouts").get();
  if (stateSnap.exists && (stateSnap.data()?.totalCount ?? 0) > 0 && !force) {
    console.log("state/workouts уже не пуст, отказываюсь перезаписывать без --force:");
    console.log(JSON.stringify(stateSnap.data(), null, 2));
    return;
  }

  const groupIds = CONFIG.groups.map((g) => g.id);
  const batch = db.batch();

  batch.set(db.doc("config/main"), CONFIG);

  let state = EMPTY_STATE;
  for (const entry of HISTORY) {
    const { workout, nextState } = applyWorkout(state, groupIds, CONFIG.blockSize, entry.groupId);
    const ref = db.collection("workouts").doc();
    batch.set(ref, {
      date: entry.date,
      groupId: workout.groupId,
      blockNo: workout.blockNo,
      posInBlock: workout.posInBlock,
      seq: workout.seq,
      createdAt: FieldValue.serverTimestamp(),
    });
    state = nextState;
  }

  batch.set(db.doc("state/workouts"), state);

  await batch.commit();

  console.log(`Импортировано ${HISTORY.length} тренировок.`);
  console.log("Итоговый state:", JSON.stringify(state, null, 2));
  console.log("config/main:", JSON.stringify(CONFIG, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
