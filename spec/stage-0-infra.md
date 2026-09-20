# Этап 0 — инфраструктура

План выполнения §10 «Этап 0» из [gym-tracker-plan.md](gym-tracker-plan.md).
Цель этапа: из Telegram открывается Mini App на Firebase Hosting, который показывает
Telegram ID открывшего и ответ от Cloud Function. Бизнес-логики ещё нет.

## Исходное состояние (проверено 2026-09-19)

| Что | Значение |
|---|---|
| Node / npm | v22.14.0 / 10.9.2 |
| firebase-tools | 15.15.0, **не авторизован** (`firebase login:list` пуст) |
| gcloud | 565.0.0, аккаунт `ilia.igolnikov.hu@gmail.com` |
| Биллинг-аккаунт | `013678-67E970-7F2183` (Blaze, привязан к другим проектам) |
| Репозиторий | пустой: `README.md`, `spec/`, `.gitignore` от Next.js (заменить) |

## Принятые решения

1. **Новый GCP-проект** вместо подселения в `expense-bot-489609`.
   Причина: правила §7 (`allow read: if true` на `/{document=**}`) действуют на всю базу,
   а в `expense-bot` уже есть `(default)` Firestore с чужими данными. Отдельный проект
   даёт изоляцию правил, индексов и бэкапов, и `(default)` БД попадает под бесплатный лимит
   Firestore (у именованных БД его нет).
2. **`firebase init` не запускаем.** Все конфиги (`firebase.json`, `.firebaserc`,
   `firestore.rules`, `firestore.indexes.json`) пишем файлами — интерактивный визард плохо
   воспроизводится и генерирует лишнее.
3. **Telegram ID владельца узнаём из самого hello-world**: страница печатает
   `Telegram.WebApp.initDataUnsafe.user.id`. Сторонние боты вроде @userinfobot не нужны.
4. `BOT_TOKEN` — только в Secret Manager (`defineSecret`), в git не попадает никогда.
   `OWNER_TELEGRAM_ID` — в `functions/.env.<project-id>`, файл в `.gitignore`.

---

## 0.1 GCP-проект

Идентификатор проекта глобально уникален. Базовый вариант — `gym-tracker-tg`;
если занят, добавляем суффикс (`gym-tracker-tg-1` и т.д.).

```bash
PROJECT_ID=gym-tracker-tg
gcloud projects create "$PROJECT_ID" --name="Gym Tracker"
gcloud billing projects link "$PROJECT_ID" --billing-account=013678-67E970-7F2183
gcloud config set project "$PROJECT_ID"
```

Включаем API (Cloud Functions 2nd gen тянет за собой Run / Build / Artifact Registry / Eventarc):

```bash
gcloud services enable \
  firebase.googleapis.com \
  firebaserules.googleapis.com \
  firebasehosting.googleapis.com \
  firestore.googleapis.com \
  cloudfunctions.googleapis.com \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  eventarc.googleapis.com \
  secretmanager.googleapis.com \
  --project="$PROJECT_ID"
```

**Проверка:** `gcloud billing projects describe "$PROJECT_ID"` → `billingEnabled: true`.

## 0.2 Firebase и Firestore

⚠️ **Если аккаунт ещё ни разу не пользовался Firebase**, `projects:addfirebase` падает с
`403 The caller does not have permission` даже у владельца проекта: не приняты Firebase Terms of
Service, а принять их через CLI нельзя. Признак — `firebase projects:list` отвечает `No projects found`.
Лечится один раз в консоли: https://console.firebase.google.com → **Create a project** → выбрать
в списке **существующий** GCP-проект → принять ToS → Google Analytics выключить. После этого
`addFirebase` уже не нужен, проект появляется в `firebase projects:list`.

```bash
firebase login
firebase projects:addfirebase "$PROJECT_ID"   # пропустить, если Firebase добавлен через консоль
gcloud firestore databases create \
  --database='(default)' \
  --location=asia-southeast1 \
  --type=firestore-native \
  --project="$PROJECT_ID"
```

**Проверка:** `gcloud firestore databases list --project="$PROJECT_ID"` → `(default)`, `asia-southeast1`, `FIRESTORE_NATIVE`.

⚠️ Регион Firestore меняется только пересозданием базы. Проверить `asia-southeast1` до того, как что-то записано.

## 0.3 Скелет репозитория

Создаём структуру из §9:

```
firebase.json          # hosting → web/dist, rewrite /api/** → функция api
.firebaserc            # default: <project-id>
firestore.rules        # правила §7
firestore.indexes.json # composite-индекс §4 (weightLogs)
functions/             # TS, Node 22, единственный export api
web/                   # Vite + React + TS
.gitignore             # переписать: node_modules, dist, .env*, functions/lib, .firebase
```

Ключевые куски `firebase.json`:

```json
{
  "hosting": {
    "public": "web/dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [
      { "source": "/api", "function": { "functionId": "api", "region": "asia-southeast1" } },
      { "source": "/api/**", "function": { "functionId": "api", "region": "asia-southeast1" } },
      { "source": "**", "destination": "/index.html" }
    ],
    "predeploy": ["npm --prefix web run build"]
  },
  "functions": { "source": "functions", "runtime": "nodejs22", "predeploy": ["npm --prefix functions run build"] },
  "firestore": { "rules": "firestore.rules", "indexes": "firestore.indexes.json" }
}
```

Rewrite на функцию нужен, чтобы фронт ходил на свой же origin (`/api`) — это снимает вопрос CORS,
упомянутый в §6.

⚠️ **Glob-ловушка:** `/api/**` в Firebase Hosting матчит `/api/что-то`, но не точный путь `/api`
без хвоста. Наш клиент стучится ровно в `/api` (единая функция, без вложенных путей — action
передаётся в теле, см. §6), поэтому нужны оба правила: `/api` и `/api/**`. Без первого — запрос
на `/api` тихо падает в catch-all `** → index.html` и в ответ приходит HTML вместо JSON.

## 0.4 Hello-world

**Функция `api`** (`functions/src/index.ts`): `onRequest` в `asia-southeast1`, пока отвечает
`{ ok: true, ts, hasInitData }` на любой запрос. Проверки подписи ещё нет — это этап 1,
поэтому функция ничего не читает и не пишет.

**Фронт** (`web/`): Vite + React + TS, в `index.html` подключён
`https://telegram.org/js/telegram-web-app.js`. `App` вызывает `ready()` / `expand()` и печатает:

- `user.id` и `first_name` из `initDataUnsafe` (или «вне Telegram», если их нет);
- `themeParams.bg_color` — проверка, что тема доезжает;
- ответ `POST /api` — проверка rewrite и функции.

Деплой:

```bash
npm --prefix functions install && npm --prefix web install
firebase deploy --only firestore:rules,firestore:indexes,functions,hosting --project "$PROJECT_ID"
```

**Проверка:** `https://<project-id>.web.app` открывается в обычном браузере, пишет «вне Telegram»
и показывает `{ ok: true }` от функции.

## 0.5 BotFather

Выполняется вручную в Telegram; я даю шаги, результат (токен, username, ссылка) присылаешь мне.

1. `@BotFather` → `/newbot` → имя (например `Gym Tracker`) → username, оканчивающийся на `bot`
   (например `ilya_gym_tracker_bot`) → **BotFather выдаёт токен**.
2. `/newapp` → выбрать бота → Title → Description → фото 640×360 → GIF: `/empty` →
   **Web App URL**: `https://<project-id>.web.app` → short name (например `app`).
3. BotFather отвечает ссылкой вида `t.me/<bot_username>/<short_name>` — это и есть вход в приложение.
4. Опционально: `/mybots` → Bot Settings → Menu Button → тот же URL, чтобы Mini App открывался
   кнопкой рядом с полем ввода.

Токен нигде не коммитим, в переписку тоже лучше не вставлять — можно сразу записать его
в секрет на шаге 0.6 и прислать мне только username и ссылку.

## 0.6 Секреты и параметры

```bash
firebase functions:secrets:set BOT_TOKEN --project "$PROJECT_ID"   # вставить токен в prompt
echo "OWNER_TELEGRAM_ID=<твой id>" > functions/.env."$PROJECT_ID"  # файл в .gitignore
```

`OWNER_TELEGRAM_ID` берём из hello-world: открыть ссылку `t.me/<bot>/<app>` и посмотреть
напечатанный `user.id`.

## 0.7 Проверка этапа (definition of done)

- [x] `gcloud firestore databases list` показывает `(default)` в `asia-southeast1`.
- [x] `firebase deploy` проходит целиком: rules, indexes, functions, hosting.
- [x] `https://<project-id>.web.app` открывается в браузере: «вне Telegram» + `{ ok: true }`.
- [x] Прямое чтение Firestore с клиента разрешено (200), запись отклоняется правилами §7 (403) —
      проверено `curl` напрямую к REST API Firestore.
- [x] Ссылка `t.me/<bot>/<app>`, открытая в Telegram, показывает реальный `user.id` и цвет темы.
- [x] `firebase functions:secrets:access BOT_TOKEN` возвращает токен.
- [x] В git нет ни токена, ни `.env.<project-id>` (`git status` / `git ls-files` чисты).

Фактический hosting URL: `https://gym-tracker-tg.web.app`. Функция также доступна напрямую:
`https://asia-southeast1-gym-tracker-tg.cloudfunctions.net/api`.

Бот: `ii_gym_tracker_bot`, ссылка на Mini App: `t.me/ii_gym_tracker_bot/ii_gym_tracker_app`.
`OWNER_TELEGRAM_ID=289244058` (Ilya) — в `functions/.env.gym-tracker-tg`, `BOT_TOKEN` — в Secret Manager.

**Этап 0 завершён.**

## Риски и на что смотреть

| Риск | Что делать |
|---|---|
| `gym-tracker-tg` занят | взять суффикс; project id не переименовывается потом |
| Регион Firestore выбран неверно | база пересоздаётся только с нуля — проверить до записи данных |
| `addFirebase` → 403 у владельца проекта | не приняты Firebase ToS: добавить проект один раз через консоль Firebase (см. 0.2) |
| Первый деплой функций 2nd gen падает по правам Cloud Build / Artifact Registry | подождать 1–2 мин после `services enable` и повторить `firebase deploy` |
| Первый деплой падает с `could not set up cleanup policy in location <region>` | функция при этом уже создана; выполнить `firebase functions:artifacts:setpolicy --location asia-southeast1 --days 7 --force` и повторить `firebase deploy` — иначе на каждый деплой копится образ в Artifact Registry |
| Telegram кэширует Mini App | при смене URL в BotFather закрыть и переоткрыть приложение, при сомнениях — «Очистить кэш» в настройках Telegram |
| В hello-world не приходит `initData` | проверять только по ссылке `t.me/<bot>/<app>` или через кнопку меню, но не по прямому URL в браузере |

## Что остаётся на этап 1

Проверка подписи `initData`, `OWNER_TELEGRAM_ID`-гейт, `domain/rotation.ts`, реальные actions
и экран «Тренировки». В этапе 0 функция `api` намеренно ничего не защищает и не пишет в БД.
