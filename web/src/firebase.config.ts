// Публичная конфигурация клиентского Firebase SDK — это не секрет: защиту данных делают
// Firestore rules (§7 плана), а не сокрытие apiKey. Получено через:
//   firebase apps:sdkconfig WEB <appId> --project gym-tracker-tg
export const firebaseConfig = {
  projectId: "gym-tracker-tg",
  appId: "1:461679071430:web:7de31038a17e5c6518c7c7",
  storageBucket: "gym-tracker-tg.firebasestorage.app",
  apiKey: "AIzaSyC-72i6-cagFv6mts-j_u0_vEYJE4R_8JA",
  authDomain: "gym-tracker-tg.firebaseapp.com",
  messagingSenderId: "461679071430",
};
