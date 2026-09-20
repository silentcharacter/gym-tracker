// Разовый посев config/main (§4 плана). Запуск: npm run bootstrap-config -- [--force]
// Требует Application Default Credentials, например:
//   gcloud auth application-default login
// или GOOGLE_APPLICATION_CREDENTIALS, указывающий на service account key.
// См. spec/stage-1-workouts.md, решение 2.

import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import type { AppConfig } from "../firestore";

// Порядок ротации подобран разбором реальной истории тренировок владельца (27 записей,
// 100% совпадение с фактическими выборами) — см. scripts/import-history.ts и
// spec/stage-1-workouts.md. Это не иллюстративный пример из §4 плана, а реальный порядок.
const DEFAULT_CONFIG: AppConfig = {
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

async function main() {
  const force = process.argv.includes("--force");

  initializeApp();
  const db = getFirestore();
  const ref = db.doc("config/main");

  const existing = await ref.get();
  if (existing.exists && !force) {
    console.log("config/main уже существует, пропускаю (передайте --force для перезаписи):");
    console.log(JSON.stringify(existing.data(), null, 2));
    return;
  }

  await ref.set(DEFAULT_CONFIG);
  console.log(`config/main ${existing.exists ? "перезаписан" : "создан"}:`);
  console.log(JSON.stringify(DEFAULT_CONFIG, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
