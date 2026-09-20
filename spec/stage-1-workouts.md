# Этап 1 — тренировки

План выполнения §10 «Этап 1» из [gym-tracker-plan.md](gym-tracker-plan.md).
Опирается на §4 (модель данных), §5 (бизнес-логика), §6 (API), §7 (правила), §8 (UI).

## Готово к старту

Этап 0 закрыт: hosting + функция `api` (hello-world) задеплоены, `BOT_TOKEN` в Secret Manager,
`OWNER_TELEGRAM_ID=289244058` в `functions/.env.gym-tracker-tg`, бот `ii_gym_tracker_bot`,
ссылка `t.me/ii_gym_tracker_bot/ii_gym_tracker_app`. Подробности — [stage-0-infra.md](stage-0-infra.md).

## Что входит в этап 1 / что нет

**Входит:** `domain/rotation.ts`, `auth.ts`, actions `whoami` / `addWorkout` / `undoLastWorkout` /
`setWorkoutGroup` / `seed`, экран «Тренировки» по мокапу
`spec/mockup/Screenshot 2026-09-19 at 16.30.35.png`, разовый бутстрап `config/main`.

**Не входит** (более поздние этапы): упражнения и веса (этап 2), график, тема/haptics/скелетоны,
`updateConfig` и экран «Порядок групп» (этап 3), экспорт CSV (этап 4).

Экран «Веса» на этом этапе — заглушка «скоро» под тем же таб-баром, чтобы навигация из §8
существовала целиком, но без реализации.

## Проверенные факты (важны для реализации)

- Библиотека для initData — **`@tma.js/init-data-node`**, не `@telegram-apps/init-data-node`
  (тот deprecated, автор перенёс пакет). API: `validate(raw, botToken, opts)` бросает исключение
  на невалидной подписи/просроченном `auth_date` (`expiresIn` по умолчанию `86400` — ровно те 24ч
  из §5), `parse(raw)` возвращает типизированный объект с `user`. Тот же пакет экспортирует
  `sign()`/`signData()` — пригодится для локального тестирования без реального Telegram.
  Обновил §2/§5 основного плана — они раньше указывали на deprecated имя.
- Admin SDK (`@google-cloud/firestore`, тянется `firebase-admin@13`) поддерживает
  `transaction.get(query)`, не только `transaction.get(docRef)` — это нужно для `undoLastWorkout`
  (прочитать последние 2 записи по `seq` внутри транзакции).
- `Intl.DateTimeFormat('en-CA', { timeZone, year, month, day })` отдаёт готовую `YYYY-MM-DD` —
  отдельная библиотека дат для «сегодня в Asia/Bangkok» не нужна, Node 22 несёт полный ICU.

## Принятые решения

1. **Тест-раннер — Vitest.** В `functions/` тестов ещё нет. Vitest не требует конфигурации для
   голого TS/ESM, быстрый, подходит и для чистых unit-тестов `rotation.ts`, и для `auth.ts` (там
   нужно самому подписать `initData`, что тоже чистые функции без сети).
2. **Бутстрап `config/main` — отдельный одноразовый скрипт, не HTTPS action.** В §6 `seed`
   принимает только `{ currentBlockNo, countInBlock, lastGroupId }` — без групп/`blockSize`/
   `timezone`. Заводить лишний API ради разового посева документа не стоит: `updateConfig`
   всё равно появится в этапе 3 как настоящий путь редактирования. Пишем
   `functions/scripts/bootstrap-config.ts` (Admin SDK, локальный запуск через
   `npm --prefix functions run bootstrap-config`), кладём туда 5 групп из §4, `blockSize: 12`,
   `timezone: "Asia/Bangkok"`. Скрипт идемпотентен: не перезаписывает существующий `config/main`
   без `--force`.
3. **`seed` — только если тренировок ещё нет.** Без этой защиты случайный повторный вызов посреди
   использования тихо переписывает счётчики. Транзакция проверяет `state.totalCount` (нет
   документа или `totalCount === 0`) и иначе отвечает `409`.
4. **Свежесть initData: используем дефолт библиотеки (24ч), не переопределяем.** Совпадает с §5.
   Риск — если Mini App держат открытым в фоне больше суток, `initData` протухнет; Telegram
   обычно перезапускает WebView при реальном использовании, так что для одиночного владельца
   это не проблема, но стоит иметь это в виду при ручном тестировании.
5. **CORS не нужен в проде** (тот же вывод, что в §0.3 stage-0: `/api` и hosting — один origin).
   Для локальной разработки (`vite dev` на порту 5173, функция — в облаке или в эмуляторе на
   другом порту) в `onRequest` временно оставляем `cors: true`, как и в hello-world.

## Файлы `functions/src/`

```
domain/
  rotation.ts        # чистая логика, без Firestore
  rotation.test.ts
auth.ts               # verifyInitData(header, botToken, ownerId)
auth.test.ts
schemas.ts            # zod: addWorkout / undoLastWorkout / setWorkoutGroup / seed / whoami
actions/
  addWorkout.ts
  undoLastWorkout.ts
  setWorkoutGroup.ts
  seed.ts
  whoami.ts
index.ts              # export api — диспетчер action → { auth-гейт, zod, action }
scripts/
  bootstrap-config.ts # разовый посев config/main (см. решение 2)
```

### `domain/rotation.ts`

Чистые функции без побочных эффектов — на них и держатся unit-тесты из чек-листа §10.

```ts
export interface WorkoutsState {
  totalCount: number;
  currentBlockNo: number;
  countInBlock: number;   // 0..blockSize
  lastGroupId: string | null;
}

// Следующая группа — от lastGroupId, не от totalCount (§5). Если lastGroupId
// не входит в текущий список групп (группу удалили), следующая — первая.
export function nextGroupId(groups: string[], lastGroupId: string | null): string;

// Блок и ротация независимы (12 не кратно 5, §5).
export function advanceBlock(
  state: WorkoutsState,
  blockSize: number
): { blockNo: number; posInBlock: number; countInBlock: number };

// Полный переход "есть state + группы → новая тренировка + новый state".
export function applyWorkout(
  state: WorkoutsState,
  groups: string[],
  blockSize: number,
  groupIdOverride?: string
): { workout: { groupId: string; blockNo: number; posInBlock: number; seq: number }; nextState: WorkoutsState };

// Пересчёт state по записи, которая станет последней после удаления (undo).
// previous == null, если удаляемая запись была единственной.
export function recomputeStateAfterUndo(
  previous: { groupId: string; blockNo: number; posInBlock: number; seq: number } | null
): WorkoutsState;
```

Тесты (`rotation.test.ts`), по чек-листу §10:

- **граница блока**: `countInBlock == blockSize` → `blockNo + 1`, `posInBlock = 1`, `countInBlock = 1`.
- **ротация через границу блока**: 5 групп, `blockSize = 12` — группа на позиции 13 продолжает
  очередь с позиции 12, а не начинается заново (12 mod 5 = 2, значит сдвиг на 3, не на 0).
- **ручная смена группы не ломает очередь**: `nextGroupId` считается от фактического
  `lastGroupId`, включая случай, когда он не следующий по формуле `totalCount % 5`.
- **`lastGroupId` отсутствует в списке групп** (группу удалили в `config`) → следующая первая.
- **undo**: `recomputeStateAfterUndo` по предпоследней записи восстанавливает `blockNo`/`countInBlock`
  /`lastGroupId`/`totalCount`; `recomputeStateAfterUndo(null)` → пустой state (`totalCount: 0`,
  `currentBlockNo: 1`, `countInBlock: 0`, `lastGroupId: null`).

### `auth.ts`

```ts
export interface AuthResult {
  userId: number;
  isOwner: boolean;
}

// Возвращает null, если заголовка нет или initData не распарсился/не прошла подпись/протухла.
// Не бросает исключение наружу — вызывающий код сам решает, что делать (whoami можно вызывать
// анонимно, остальные actions при null обязаны вернуть 403).
export function verifyInitData(
  authHeader: string | undefined,
  botToken: string
): AuthResult | null;
```

Реализация: достать `tma <initData>` из заголовка, `validate(raw, botToken)` (ловим исключение →
`null`), `parse(raw)`, сравнить `user.id` с `OWNER_TELEGRAM_ID` (параметр функции, не глобальная
константа — чтобы было чем мокать в тестах).

Тесты (`auth.test.ts`) — подписываем initData тем же пакетом (`sign`/`signData` из
`@tma.js/init-data-node`) с тестовым `BOT_TOKEN`, затем:

- валидная подпись + `user.id == ownerId` → `{ userId, isOwner: true }`;
- валидная подпись + чужой `user.id` → `{ userId, isOwner: false }` (не `null` — валиден, просто
  не владелец; различие важно для `whoami`);
- подпись подделана (один символ в `hash` испорчен) → `null`;
- `auth_date` в прошлом дальше `expiresIn` → `null`;
- заголовок отсутствует или не начинается с `tma ` → `null`.

### `schemas.ts` (zod)

```ts
export const addWorkoutSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  groupId: z.string().optional(),
});
export const undoLastWorkoutSchema = z.object({});
export const setWorkoutGroupSchema = z.object({
  workoutId: z.string().min(1),
  groupId: z.string().min(1),
});
export const seedSchema = z.object({
  currentBlockNo: z.number().int().positive(),
  countInBlock: z.number().int().min(0).max(12),
  lastGroupId: z.string().nullable(),
});
export const whoamiSchema = z.object({});
```

### `actions/addWorkout.ts`

Транзакция:
1. `t.get(configRef)` → `groups`, `blockSize`, `timezone`. Нет документа → `500`
   (`config/main` должен быть создан бутстрап-скриптом до первого использования).
2. `t.get(stateRef)` → текущий `WorkoutsState` (нет документа → нулевой state).
3. `applyWorkout(state, groups.map(g => g.id), blockSize, payload.groupId)`.
4. `date`: `payload.date`, если передан (задним числом, §5), иначе
   `Intl.DateTimeFormat('en-CA', { timeZone: config.timezone, ... }).format(new Date())`.
5. `t.set(workoutsCol.doc(), { date, groupId, blockNo, posInBlock, seq, createdAt: FieldValue.serverTimestamp() })`,
   `t.set(stateRef, nextState)`.
6. Вернуть созданную тренировку + `nextState`.

### `actions/undoLastWorkout.ts`

Транзакция:
1. `t.get(workoutsCol.orderBy('seq', 'desc').limit(2))`.
2. Пусто → `409` (нечего отменять).
3. `t.delete(docs[0].ref)`.
4. `t.set(stateRef, recomputeStateAfterUndo(docs[1]?.data() ?? null))`.
5. Вернуть новый state.

### `actions/setWorkoutGroup.ts`

Транзакция:
1. `t.get(workoutRef)` по `payload.workoutId` → нет документа → `404`.
2. `t.get(stateRef)`.
3. `t.update(workoutRef, { groupId: payload.groupId })`.
4. Если `workout.seq === state.totalCount` (это последняя запись) — также
   `t.update(stateRef, { lastGroupId: payload.groupId })` (§5: смена группы старой записи на
   очередь не влияет и `state` не трогает).

### `actions/seed.ts`

Транзакция:
1. `t.get(stateRef)` → если существует и `totalCount > 0` → `409` (см. решение 3).
2. `t.set(stateRef, { totalCount: payload.countInBlock, currentBlockNo: payload.currentBlockNo, countInBlock: payload.countInBlock, lastGroupId: payload.lastGroupId })`.

   `totalCount` намеренно равен `countInBlock`: без истории прошлых блоков (§12 — отдельная,
   более поздняя задача) единственный корректный источник глобального счётчика — то, что реально
   произошло в текущем блоке. Следующий `addWorkout` продолжит `seq` от этого числа.

### `actions/whoami.ts`

Без Firestore. `verifyInitData(...)`: `null` → `{ isOwner: false }`; иначе
`{ isOwner: result.isOwner }`.

### `index.ts` — диспетчер

```ts
const auth = verifyInitData(req.get('Authorization'), botToken.value());
const action = req.body?.action;

if (action === 'whoami') return res.json(await whoami(auth));

if (!auth?.isOwner) return res.status(403).json({ error: 'forbidden' });

switch (action) {
  case 'addWorkout': ...
  case 'undoLastWorkout': ...
  case 'setWorkoutGroup': ...
  case 'seed': ...
  default: return res.status(400).json({ error: 'unknown action' });
}
```

Zod-парсинг `payload` — на входе каждого case (`schema.parse(req.body?.payload)`), ошибка парсинга
→ `400` с деталями. `botToken` — `defineSecret('BOT_TOKEN')`, `ownerId` — `defineString('OWNER_TELEGRAM_ID')`,
оба передаются в `onRequest({ secrets: [botToken], ... })`.

## `functions/scripts/bootstrap-config.ts`

Отдельный запускаемый файл (не часть деплоя функций), Admin SDK с `applicationDefault()` или
`GOOGLE_APPLICATION_CREDENTIALS`, пишет `config/main`:

```ts
{
  groups: [
    { id: "legs", title: "Ноги" },
    { id: "shoulders", title: "Плечи" },
    { id: "chest", title: "Грудные" },
    { id: "arms", title: "Бицепс / трицепс" },
    { id: "back", title: "Спина" }
  ],
  blockSize: 12,
  timezone: "Asia/Bangkok"
}
```

Запуск: `npm --prefix functions run bootstrap-config -- --project gym-tracker-tg [--force]`.
Без `--force` и существующего документа — выходит с сообщением, ничего не трогая.

## Веб (`web/src/`)

```
firebase.ts   # initializeApp + getFirestore, конфиг из web/src/firebase.config.ts (не секрет,
              # см. ниже), чтение config/main, state/workouts, workouts (последние ~20 по seq)
api.ts        # postApi(action, payload) → fetch('/api', ...), кладёт Authorization: tma <initData>
telegram.ts   # уже есть с этапа 0
screens/
  Workouts.tsx     # экран из §8, по мокапу 16.30.35
  WeightsStub.tsx  # заглушка «Веса — скоро», под тем же таб-баром
components/
  TabBar.tsx
  ProgressBar.tsx
  Sheet.tsx      # bottom sheet для меню долгого тапа (изменить группу / удалить)
domain.ts        # клиентское зеркало nextGroupId — только для UI-предпросмотра, не для записи
types.ts         # формы документов Firestore, читаемых клиентом
App.tsx        # роутинг между Workouts / WeightsStub, вызывает ready()/expand() один раз,
               # применяет Telegram.WebApp.themeParams как CSS-переменные
```

`firebase.ts`: `firebaseConfig` (apiKey/projectId/appId и т.д.) — это не секрет, а публичная
конфигурация клиентского SDK, защиту делают Firestore rules (§7), а не сокрытие ключа. Берём
через `firebase apps:sdkconfig web --project gym-tracker-tg` (после `firebase apps:create web`,
если веб-приложение ещё не зарегистрировано в проекте) и кладём в `web/src/firebase.config.ts`
(коммитится, не в `.gitignore`).

`Workouts.tsx` — по мокапу `Screenshot 2026-09-19 at 16.30.35.png`:
- карточка блока (`state.currentBlockNo`, `state.countInBlock` / `config.blockSize`), progress bar;
- бейдж «Осталось N тренировки», когда `blockSize - countInBlock <= 2`;
- карточка «Следующая: …» — `nextGroupId(groups, state.lastGroupId)` считается **на клиенте** только
  для отображения (сервер всё равно пересчитает при реальном `addWorkout` — это чисто UI-предпросмотр,
  дублирование логики допустимо, т.к. она чистая и общая с `domain/rotation.ts` не шарится между
  функциями и вебом без отдельного пакета — на этом этапе просто копируем ту же чистую формулу);
- список тренировок текущего блока + свёрнутые предыдущие блоки;
- кнопка «Отметить тренировку» (видна только если `whoami().isOwner`), вызывает `postApi('addWorkout', {})`,
  `HapticFeedback` пока не подключаем (это этап 3, но флаг оставляем в TODO);
- долгий тап по строке (owner) → меню «Изменить группу» / «Удалить» (только для последней) —
  вызывает `setWorkoutGroup` / `undoLastWorkout`.

## Проверка этапа (definition of done)

- [x] `npm --prefix functions test` — все тесты `rotation.test.ts` и `auth.test.ts` зелёные (19/19).
- [x] `bootstrap-config` создал `config/main` с 5 группами, `blockSize: 12`, `Asia/Bangkok`
      (проверено чтением через REST, как в этапе 0; идемпотентность проверена — повторный
      запуск без `--force` не трогает документ).
- [x] Цикл `seed → addWorkout → addWorkout → setWorkoutGroup → undoLastWorkout` проверен end-to-end
      на задеплойенной функции с валидной подписью владельца: ротация групп, откат группы при
      undo, `updatedLastGroup` — всё как в §5. Тестовые данные удалены из боевой базы после проверки.
- [x] Запрос с `action: "addWorkout"` и подписью постороннего `user.id` → `403`; повторный `seed`
      при уже существующих данных → `409` (см. решение 3).
- [x] `npm --prefix web run build` проходит, приложение задеплоено на `https://gym-tracker-tg.web.app`.
- [x] **Реальные данные загружены — не через `seed`, а полным импортом истории**, см. отдельный
      раздел «Реальный порядок ротации и импорт истории» ниже. Итоговый `state`:
      `{ totalCount: 27, currentBlockNo: 3, countInBlock: 3, lastGroupId: "back" }`.
- [ ] Тап «Отметить тренировку» в Telegram (не curl) создаёт запись с сегодняшней датой в
      `Asia/Bangkok` и правильной следующей группой (критерий §11) — визуальная проверка на
      реальном экране «Тренировки». По расчёту следующая группа — «Грудные».
- [x] 13-я тренировка получила `blockNo + 1 = 2`, `posInBlock = 1` — подтверждено и unit-тестом,
      и реальными данными (запись `2026-08-21 · back · block 2 · pos 1`, seq 13).
- [ ] Тренер (тот же URL, initData без owner-id или вообще без Telegram) видит список тренировок,
      но не видит кнопку «Отметить тренировку» — логика в `Workouts.tsx` (`isOwner &&`) на месте,
      визуально не проверялось со стороннего Telegram-аккаунта.

### Реальный порядок ротации и импорт истории

При попытке вызвать `seed` выяснилось, что порядок групп, скопированный в `bootstrap-config.ts`
из иллюстративного примера §4 плана (Ноги→Плечи→Грудные→БТ→Спина), **не совпадает** с реальной
практикой владельца. Владелец прислал полный список из 27 прошедших тренировок с датами и
группами; разбор показал, что порядок **Спина → Грудные → Ноги → Бицепс/трицепс → Плечи →
(снова Спина)** предсказывает все 27 реальных выборов без единого исключения, включая 4 случая,
когда владелец вручную пропустил день рук и вместо этого сделал плечи — это ровно тот сценарий,
для которого спроектирована формула «следующая группа — от фактической последней» (§5): ручное
отклонение не сбивает очередь, а лишь сдвигает её от нового факта.

Вместо `seed` (который выставляет только счётчики) написан и запущен разовый скрипт
`functions/src/scripts/import-history.ts`: он перезаписывает `config/main` правильным порядком
групп и по очереди прогоняет 27 реальных записей через `applyWorkout` (тот же чистый код, что и
в `addWorkout`), создавая настоящие документы `workouts/*` с верными `date`/`blockNo`/`posInBlock`/
`seq`, и выставляет `state/workouts` в точности так, как если бы все 27 тренировок были отмечены
через приложение по одной. `bootstrap-config.ts` тоже обновлён на правильный порядок — на случай
пересоздания окружения с нуля.

Это расширяет исходный scope этапа 1 (там `seed` предполагался как посев только счётчиков) до
фактического выполнения §12 «Инициализация данных уже проведёнными блоками» — оправдано тем, что
данные были явно предоставлены владельцем и без них `seed` дал бы неверный порядок ротации.

## Риски и на что смотреть

| Риск | Что делать |
|---|---|
| `config/main` не создан до первого `addWorkout` | транзакция вернёт `500`; всегда сначала `bootstrap-config`, потом `seed`, потом первый реальный тап |
| Повторный вызов `seed` затирает боевые данные | защищено проверкой `totalCount > 0` → `409`, но не полагаться только на неё — `seed` не выставлять в постоянно видимый UI (§8 держит его на одноразовом экране владельца) |
| `initData` протухает при долго открытом Mini App (>24ч) | закрыть и переоткрыть приложение — Telegram выдаст свежий `initData` |
| Ручное тестирование `403`/`200` без реального Telegram неудобно | использовать `sign()`/`signData()` из `@tma.js/init-data-node` в скрипте/тесте для генерации валидного `initData` с произвольным `user.id` и `BOT_TOKEN` из `.env` |
| `web/src/firebase.config.ts` не создан заранее | зарегистрировать веб-приложение (`firebase apps:create web`) до начала работы над `firebase.ts` |

## Что остаётся на следующие этапы

Упражнения, веса, денормализация `lastWeight` (этап 2); `updateConfig`, экран «Порядок групп»,
график, тема/haptics, бейдж/toast полировка (этап 3); экспорт, бэкап, эмуляторы (этап 4).
