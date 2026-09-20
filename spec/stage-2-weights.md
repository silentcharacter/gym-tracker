# Этап 2 — веса

План выполнения §10 «Этап 2» из [gym-tracker-plan.md](gym-tracker-plan.md).
Опирается на §4 (модель данных), §5 (даты), §6 (API), §8 (экраны «Веса» и «Упражнение»).

## Готово к старту

Предполагается закрытый этап 1 ([stage-1-workouts.md](stage-1-workouts.md)): диспетчер actions с
auth-гейтом в `functions/src/index.ts`, `auth.ts`, `schemas.ts`, `domain/rotation.ts` + Vitest,
`config/main` создан бутстрап-скриптом, на вебе есть `firebase.ts` (чтение Firestore), `api.ts`
(`postApi`), `telegram.ts`, таб-бар и экран «Тренировки», `WeightsStub.tsx` как заглушка.

⚠️ На момент написания этого плана этап 1 ещё не реализован. Перед стартом сверить фактические
имена файлов и сигнатур — ниже они указаны так, как их описывает stage-1.

## Что входит в этап 2 / что нет

**Входит:** actions `addExercise` / `updateExercise` / `addWeight` / `deleteWeight` с
денормализацией `lastWeight` / `lastDate`, экран «Веса» (мокап `Screenshot 2026-09-19 at 16.30.42.png`),
экран «Упражнение» (мокап `Screenshot 2026-09-19 at 16.31.02.png`) **без графика**, переход
«Внести веса → [группа]» после отметки тренировки, `BackButton` Telegram на вложенном экране.

**Не входит:** график Chart.js и переключатель 1ПМ, тема/haptics/скелетоны/пустые состояния,
`updateConfig` и «Порядок групп», toast «Отменить» (этап 3), экспорт CSV (этап 4).

На экране «Упражнение» место графика занимает пустая карточка-заглушка фиксированной высоты —
чтобы вёрстка экрана не переезжала, когда график появится в этапе 3.

Смена группы у упражнения намеренно не поддерживается: `updateExercise` принимает только
`{ id, name?, archived? }` (§6), и благодаря этому денормализованный `weightLogs.groupId` не может
разойтись с `exercises.groupId`. Проверки уникальности названия упражнения тоже нет — владелец один.

## Принятые решения

1. **«Последняя запись» = максимальная `date`, при равенстве — максимальный `createdAt`.**
   Это определение нужно в двух местах (обновление `lastWeight` при `addWeight` и пересчёт при
   `deleteWeight`), поэтому оно фиксируется один раз и выносится в чистую функцию
   `domain/weights.ts`. Без правила про `createdAt` две записи одного дня ранжируются Firestore по
   `__name__` (случайный autoId) — «последний вес» получался бы произвольным.
2. **Добавляем composite-индекс `weightLogs (exerciseId ASC, date DESC, createdAt DESC)`.**
   Существующий индекс из §4 (`exerciseId ASC, date ASC`) обслуживает чтение истории и будущий
   график; для пересчёта после удаления нужен обратный порядок с тай-брейком по `createdAt`, а
   смешанный порядок Firestore из ASC-индекса не выводит. Альтернатива (жить с тай-брейком по
   `__name__` и не заводить индекс) отклонена: цена — один индекс, выигрыш — детерминированный
   `lastWeight`.
3. **Backdate не перетирает `lastWeight`.** Запись задним числом (§5) обновляет денормализацию
   только если её дата не раньше текущей `lastDate`. Иначе запись создаётся, а `lastWeight` /
   `lastDate` остаются прежними.
4. **`addWeight` / `deleteWeight` возвращают актуальные `lastWeight` / `lastDate`.** §6 описывает
   только «(+ обновление/пересчёт)»; конкретизируем: ответ содержит пересчитанные значения, чтобы
   клиент патчил список упражнений из ответа и не перечитывал коллекцию после каждой записи.
5. **Клиент читает `exercises` целиком, без серверных фильтров.** Фильтрация по группе, отсев
   `archived` и сортировка по имени — в памяти. Коллекция на десятки документов, так что запрос
   `where archived == false orderBy name` не стоит ещё одного индекса.
6. **Минимальный toast появляется уже сейчас.** §10 относит toast «Отменить» к этапу 3, но переход
   «Внести веса» (этап 2) живёт в том же элементе (§8). Делаем `components/Toast.tsx` с одной
   ссылкой «Внести веса → [группа]»; этап 3 добавит в него кнопку «Отменить» и таймер на 5 с.

## Проверенные факты (важны для реализации)

- В транзакции Firestore **все чтения идут строго до записей**. В `deleteWeight` это значит:
  сначала `t.get(logRef)`, `t.get(exerciseRef)` и `t.get(query)`, и только потом `t.delete` /
  `t.update`.
- Очистить денормализованное поле нужно через `FieldValue.delete()`: запись `undefined` Admin SDK
  по умолчанию отвергает (`ignoreUndefinedProperties` не включён).
- `Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' })` даёт «14 сент.» — в мокапе
  «14 сен». Формат из мокапа получаем своим массивом сокращений в `lib/format.ts`, а не подгонкой
  локали.
- Первый запрос к новому composite-индексу до его деплоя падает с `FAILED_PRECONDITION`. Индекс
  деплоится отдельно и строится не мгновенно: `firebase deploy --only firestore:indexes` **до**
  первого вызова `deleteWeight`.

## Функции (`functions/src/`)

Добавляется к структуре этапа 1:

```
domain/
  weights.ts        # чистая логика "последней записи"
  weights.test.ts
actions/
  addExercise.ts
  updateExercise.ts
  addWeight.ts
  deleteWeight.ts
schemas.ts          # + 4 схемы
index.ts            # + 4 case в switch
```

### `domain/weights.ts`

```ts
export interface LogRef {
  date: string;        // YYYY-MM-DD
  createdAtMs: number; // Timestamp.toMillis()
}

// "Latest entry" rule: by date first, by createdAt on ties.
export function isLater(a: LogRef, b: LogRef): boolean;

// Whether a new entry becomes the exercise's latest one.
// lastDate === undefined means the exercise has no entries yet.
export function supersedesLast(lastDate: string | undefined, candidateDate: string): boolean;

// Picks the new latest entry after a deletion; [] → null.
export function pickLatest<T extends LogRef>(logs: T[]): T | null;
```

Тесты (`weights.test.ts`):

- `supersedesLast(undefined, '2026-09-14')` → `true`;
- запись задним числом (`'2026-09-01'` при `lastDate = '2026-09-14'`) → `false`;
- запись той же датой → `true` (свежая правка того же дня побеждает);
- `isLater` при равных датах сравнивает `createdAtMs`;
- `pickLatest([])` → `null`; `pickLatest` из нескольких дат возвращает максимальную, а из
  одинаковых дат — с максимальным `createdAtMs`.

### `schemas.ts` (zod, добавить)

```ts
export const addExerciseSchema = z.object({
  name: z.string().trim().min(1).max(60),
  groupId: z.string().min(1),
});
export const updateExerciseSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(60).optional(),
  archived: z.boolean().optional(),
});
export const addWeightSchema = z.object({
  exerciseId: z.string().min(1),
  weight: z.number().positive().max(999).multipleOf(0.5),
  reps: z.number().int().min(1).max(100).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  note: z.string().max(200).optional(),
});
export const deleteWeightSchema = z.object({ id: z.string().min(1) });
```

`multipleOf(0.5)` закрывает требование «шаг 0.5» из §4 на входе API, а не только в UI.

### `actions/addExercise.ts`

Без транзакции. `get(configRef)` → проверить, что `payload.groupId` есть в `config.groups`
(иначе `400`), затем `exercisesCol.add({ name, groupId, archived: false, createdAt: serverTimestamp() })`.
Вернуть созданный документ с `id`.

### `actions/updateExercise.ts`

Без транзакции: `update(exerciseRef, { ...name?, ...archived? })`, `NOT_FOUND` от Admin SDK → `404`.
Пустой payload (ни `name`, ни `archived`) → `400`. Вернуть обновлённый документ.

### `actions/addWeight.ts`

Транзакция:
1. `t.get(exerciseRef)` → нет документа → `404`. Архивность не проверяем: архив — это про видимость
   в списке, а не про запрет записи.
2. `date`: `payload.date`, если передан, иначе «сегодня» в `config.timezone` — тем же хелпером, что
   и `addWorkout` (этап 1); вынести его в общий модуль, если он там оказался локальным.
3. `t.set(weightLogsCol.doc(), { exerciseId, groupId: exercise.groupId, date, weight, reps?, note?,
   createdAt: FieldValue.serverTimestamp() })` — `groupId` денормализуется из упражнения, не из payload.
4. Если `supersedesLast(exercise.lastDate, date)` — `t.update(exerciseRef, { lastWeight: weight, lastDate: date })`.
5. Вернуть `{ log, lastWeight, lastDate }` (решение 4) — фактические значения упражнения после шага 4.

### `actions/deleteWeight.ts`

Транзакция (порядок чтений важен, см. «Проверенные факты»):
1. `t.get(logRef)` → нет → `404`.
2. `t.get(exerciseRef)` по `log.exerciseId`.
3. `t.get(weightLogsCol.where('exerciseId','==',log.exerciseId).orderBy('date','desc').orderBy('createdAt','desc').limit(2))`
   — две записи, чтобы после удаления верхней осталась следующая.
4. `t.delete(logRef)`.
5. Кандидат = первая из выборки с `id !== payload.id`. Если есть — `t.update(exerciseRef,
   { lastWeight: candidate.weight, lastDate: candidate.date })`; если нет —
   `t.update(exerciseRef, { lastWeight: FieldValue.delete(), lastDate: FieldValue.delete() })`.
6. Вернуть `{ ok: true, lastWeight, lastDate }` (`null`, если поля очищены).

Удаление не последней записи проходит те же шаги: кандидат совпадёт с текущим `lastWeight`, и
`update` окажется no-op по значению.

### `index.ts`

Четыре новых `case` в существующем `switch` после owner-гейта — все четыре action'а только для
владельца, анонимным остаётся один `whoami`.

## Firestore

`firestore.indexes.json` — добавить (решение 2):

```json
{
  "collectionGroup": "weightLogs",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "exerciseId",  "order": "ASCENDING" },
    { "fieldPath": "date",        "order": "DESCENDING" },
    { "fieldPath": "createdAt",   "order": "DESCENDING" }
  ]
}
```

Правила (§7) не меняются: запись по-прежнему только через функцию.

## Веб (`web/src/`)

```
screens/
  Weights.tsx          # мокап 16.30.42; заменяет WeightsStub.tsx (файл удалить)
  Exercise.tsx         # мокап 16.31.02, карточка графика — заглушка
components/
  GroupChips.tsx       # чипы групп, порядок = config.groups, перенос на 2 строки
  Modal.tsx            # общий контейнер: "Новое упражнение", "Переименовать / Архивировать"
  WeightStepper.tsx    # −2.5 · <вес> · +2.5
  Toast.tsx            # минимальный (решение 6)
lib/format.ts          # formatShortDate('2026-09-14') → '14 сен'; formatWeight(87.5) → '87,5'
firebase.ts            # + fetchExercises(), fetchWeightLogs(exerciseId)
api.ts                 # без изменений — postApi(action, payload) уже общий
telegram.ts            # + BackButton (show/hide/onClick)
App.tsx                # + вложенный экран и selectedGroupId
```

### Навигация и состояние

`App.tsx` держит `activeTab: 'workouts' | 'weights'`, `selectedGroupId: string | null` и
`openExerciseId: string | null`. Экран «Упражнение» — не третий таб, а вложенный экран поверх
вкладки «Веса»: таб-бар остаётся видимым (§8 «Навигация»), сверху — «‹ Назад».

Мокап `16.31.02` таб-бар не показывает — следуем §8, а не мокапу: таб-бар виден и здесь.

`BackButton` Telegram показывается при `openExerciseId !== null` и прячется при возврате; его
`onClick` делает то же, что «‹ Назад» в шапке.

Переход «Внести веса» (§10, этап 2): после успешного `addWorkout` экран «Тренировки» показывает
`Toast` со ссылкой на группу созданной тренировки (`groupId` берётся из ответа action'а);
клик — `setSelectedGroupId(groupId)` + `setActiveTab('weights')`.

### Экран «Веса»

- Шапка: «Закрыть» слева, «Веса» по центру, `+` справа (только владелец) → `Modal` с полем
  «Название» → `postApi('addExercise', { name, groupId: selectedGroupId })`.
- `GroupChips` по `config.groups`; активный чип залит `button_color`. Начальная группа —
  `selectedGroupId` либо первая из `config.groups`.
- Список: `name`, под ним `formatShortDate(lastDate)` мелким, справа крупно `lastWeight` + «кг».
  Упражнения без записей — прочерк вместо веса. `archived === true` скрыты.
- Тап по строке → `openExerciseId = exercise.id`.

### Экран «Упражнение»

- Шапка: «‹ Назад», название, `✎` справа (владелец) → `Modal` «Переименовать» / «Архивировать»
  → `updateExercise`. После архивации возврат на «Веса».
- Карточка-заглушка на месте графика (этап 3).
- «Новая запись · сегодня»: `WeightStepper` (`−2.5` / крупное значение / `+2.5`), значение
  предзаполнено из `lastWeight` (или `20`, если записей нет); поле «Повторения (необязательно)»
  с `inputMode="numeric"`. Тап по слову «сегодня» открывает `<input type="date">` — запись задним
  числом (§5).
- История, новые сверху: «90 кг × 8» / «90 кг» без `reps`, дата справа. Удаление — долгий тап →
  подтверждение → `deleteWeight` (свайп из §8 откладываем на этап 3 вместе с остальной полировкой
  жестов).
- Первичная кнопка «Сохранить» над таб-баром → `addWeight`; после успеха запись добавляется в
  список локально, а `lastWeight` / `lastDate` в списке упражнений патчатся из ответа (решение 4).

Вес вводится только степпером, без текстового поля: шаг 0.5 гарантируется на клиенте, а мобильная
цифровая клавиатура с дробями — источник ошибок ввода.

### Режим «только чтение»

Скрыты: `+` в шапке «Весов», `✎` на «Упражнении», блок «Новая запись», кнопка «Сохранить», долгий
тап по строке истории. Списки, чипы и переходы работают одинаково для всех (§8).

## Проверка этапа (definition of done)

- [x] `npm --prefix functions test` — `weights.test.ts` зелёный (9 тестов), тесты этапа 1 не сломаны (28/28 всего).
- [x] `firebase deploy --only firestore:indexes` прошёл, новый индекс в консоли — `READY`
      (проверено `gcloud firestore indexes composite list`).
- [x] `addExercise` создаёт упражнение — проверено end-to-end на деплойенной функции.
- [x] `addWeight` пишет лог и возвращает актуальные `lastWeight`/`lastDate` (решение 4);
      UI (`Exercise.tsx`) патчит локальный список из ответа, без перезагрузки.
- [x] Запись задним числом (`date: "2020-01-01"`) создаётся, `lastWeight` остаётся прежним —
      подтверждено и unit-тестом, и на реальном вызове (решение 3).
- [x] Удаление последней записи возвращает `lastWeight` к предыдущей; удаление последней
      оставшейся — очищает `lastWeight`/`lastDate` (`FieldValue.delete()`, вернулся `null`).
- [x] Тай-брейк по `createdAt` проверен транзитивно: 2 записи одной датой (80 и 85), удаление
      верхней (85) вернуло `lastWeight: 80` — ровно ту, что создана раньше.
- [x] `updateExercise` с `archived: true` работает; UI скрывает архивные в `Weights.tsx`
      (фильтр `!e.archived`), записи в БД не трогаются.
- [x] После «Отметить тренировку» `Toast` со ссылкой «Внести веса → [группа]» открывает «Веса»
      с `selectedGroupId` из ответа `addWorkout` (`App.tsx`).
- [x] `BackButton` Telegram на «Упражнении» показывается через `useBackButtonHandler` и вызывает
      `onBack`; таб-бар в `App.tsx` рендерится вне `<main>`, виден на обоих экранах.
- [ ] Визуально не проверено (нужен реальный Telegram-аккаунт тренера): что `isOwner === false`
      скрывает `+`, `✎`, блок «Новая запись» и «Сохранить». Логика в коде (`isOwner &&`) на месте
      на обоих экранах; `403` для чужого `user.id` проверен в этапе 1 на том же диспетчере,
      актуален и для новых actions (owner-гейт общий для всех non-whoami actions).

## Риски и на что смотреть

| Риск | Что делать |
|---|---|
| Индекс не задеплоен → `deleteWeight` падает `FAILED_PRECONDITION` | деплоить индексы до первого удаления; в логе функции будет прямая ссылка на создание индекса |
| Запись `undefined` в `lastWeight` при очистке | только `FieldValue.delete()`, см. «Проверенные факты» |
| Запись задним числом «перетирает» последний вес | правило `supersedesLast`, покрыто unit-тестом |
| Транзакция с чтением после записи → `INVALID_ARGUMENT` | в `deleteWeight` держать все `t.get` строго перед `t.delete` / `t.update` |
| Дробный вес приходит с плавающей ошибкой (`87.50000000000001`) | степпер считает в шагах по 0.5 от целого (`value = steps * 0.5`), а не накапливает `+= 2.5`; на сервере `multipleOf(0.5)` отвергнет мусор |
| Список упражнений и история расходятся после записи | не перечитывать коллекции, а патчить из ответа action'а (решение 4) — единый источник значений |
| `archived` у упражнения, открытого на вложенном экране | после «Архивировать» принудительный возврат на «Веса», иначе экран показывает скрытое упражнение |

## Что остаётся на следующие этапы

График Chart.js и переключатель 1ПМ, тема/haptics/скелетоны/пустые состояния, свайп-удаление,
toast «Отменить», `updateConfig` и «Порядок групп» (этап 3); экспорт CSV, бэкап, эмуляторы (этап 4).
