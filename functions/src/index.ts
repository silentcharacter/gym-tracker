import { onRequest } from "firebase-functions/v2/https";
import { defineSecret, defineString } from "firebase-functions/params";
import { ZodError } from "zod";
import { addExercise } from "./actions/addExercise";
import { addWeight } from "./actions/addWeight";
import { addWorkout } from "./actions/addWorkout";
import { deleteWeight } from "./actions/deleteWeight";
import { seed } from "./actions/seed";
import { setWorkoutGroup } from "./actions/setWorkoutGroup";
import { undoLastWorkout } from "./actions/undoLastWorkout";
import { updateConfig } from "./actions/updateConfig";
import { updateExercise } from "./actions/updateExercise";
import { whoami } from "./actions/whoami";
import { verifyInitData } from "./auth";
import { HttpError } from "./httpError";
import {
  addExerciseSchema,
  addWeightSchema,
  addWorkoutSchema,
  deleteWeightSchema,
  seedSchema,
  setWorkoutGroupSchema,
  undoLastWorkoutSchema,
  updateConfigSchema,
  updateExerciseSchema,
  whoamiSchema,
} from "./schemas";

const botToken = defineSecret("BOT_TOKEN");
const ownerTelegramId = defineString("OWNER_TELEGRAM_ID");

/**
 * Единая HTTPS-функция (§6 плана). Все запросы — POST { action, payload }.
 * `whoami` доступен анонимно, остальные actions требуют auth.isOwner (§5 «Проверка initData»).
 */
export const api = onRequest(
  { region: "asia-southeast1", cors: true, secrets: [botToken] },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "method not allowed" });
      return;
    }

    const action = req.body?.action;
    const payload = req.body?.payload ?? {};
    const auth = verifyInitData(
      req.get("Authorization"),
      botToken.value(),
      Number(ownerTelegramId.value())
    );

    try {
      if (action === "whoami") {
        whoamiSchema.parse(payload);
        res.json(whoami(auth));
        return;
      }

      if (!auth?.isOwner) {
        res.status(403).json({ error: "forbidden" });
        return;
      }

      switch (action) {
        case "addWorkout":
          res.json(await addWorkout(addWorkoutSchema.parse(payload)));
          return;
        case "undoLastWorkout":
          undoLastWorkoutSchema.parse(payload);
          res.json(await undoLastWorkout());
          return;
        case "setWorkoutGroup":
          res.json(await setWorkoutGroup(setWorkoutGroupSchema.parse(payload)));
          return;
        case "seed":
          res.json(await seed(seedSchema.parse(payload)));
          return;
        case "addExercise":
          res.json(await addExercise(addExerciseSchema.parse(payload)));
          return;
        case "updateExercise":
          res.json(await updateExercise(updateExerciseSchema.parse(payload)));
          return;
        case "addWeight":
          res.json(await addWeight(addWeightSchema.parse(payload)));
          return;
        case "deleteWeight":
          res.json(await deleteWeight(deleteWeightSchema.parse(payload)));
          return;
        case "updateConfig":
          res.json(await updateConfig(updateConfigSchema.parse(payload)));
          return;
        default:
          res.status(400).json({ error: "unknown action" });
      }
    } catch (err) {
      if (err instanceof HttpError) {
        res.status(err.status).json({ error: err.message });
        return;
      }
      if (err instanceof ZodError) {
        res.status(400).json({ error: "invalid payload", details: err.issues });
        return;
      }
      console.error(err);
      res.status(500).json({ error: "internal error" });
    }
  }
);
