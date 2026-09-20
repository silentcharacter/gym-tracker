import { z } from "zod";

// Валидация payload для actions API (§6 плана). Расширяется в этапе 2 (упражнения/веса)
// и этапе 3 (updateConfig).

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD");

export const addWorkoutSchema = z.object({
  date: dateString.optional(),
  groupId: z.string().min(1).optional(),
});
export type AddWorkoutPayload = z.infer<typeof addWorkoutSchema>;

export const undoLastWorkoutSchema = z.object({});
export type UndoLastWorkoutPayload = z.infer<typeof undoLastWorkoutSchema>;

export const setWorkoutGroupSchema = z.object({
  workoutId: z.string().min(1),
  groupId: z.string().min(1),
});
export type SetWorkoutGroupPayload = z.infer<typeof setWorkoutGroupSchema>;

export const seedSchema = z.object({
  currentBlockNo: z.number().int().positive(),
  countInBlock: z.number().int().min(0).max(12),
  lastGroupId: z.string().min(1).nullable(),
});
export type SeedPayload = z.infer<typeof seedSchema>;

export const whoamiSchema = z.object({});
export type WhoamiPayload = z.infer<typeof whoamiSchema>;

export const addExerciseSchema = z.object({
  name: z.string().trim().min(1).max(60),
  groupId: z.string().min(1),
});
export type AddExercisePayload = z.infer<typeof addExerciseSchema>;

export const updateExerciseSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().trim().min(1).max(60).optional(),
    archived: z.boolean().optional(),
  })
  .refine((v) => v.name !== undefined || v.archived !== undefined, {
    message: "at least one of name/archived is required",
  });
export type UpdateExercisePayload = z.infer<typeof updateExerciseSchema>;

export const addWeightSchema = z.object({
  exerciseId: z.string().min(1),
  weight: z.number().positive().max(999).multipleOf(0.5),
  reps: z.number().int().min(1).max(100).optional(),
  date: dateString.optional(),
  note: z.string().max(200).optional(),
});
export type AddWeightPayload = z.infer<typeof addWeightSchema>;

export const deleteWeightSchema = z.object({ id: z.string().min(1) });
export type DeleteWeightPayload = z.infer<typeof deleteWeightSchema>;

export const updateConfigSchema = z.object({
  groups: z
    .array(
      z.object({
        id: z.string().min(1),
        title: z.string().trim().min(1).max(40),
      })
    )
    .min(1)
    .optional(),
  blockSize: z.number().int().min(1).max(100).optional(),
  timezone: z.string().min(1).optional(),
});
export type UpdateConfigPayload = z.infer<typeof updateConfigSchema>;
