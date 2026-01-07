import { z } from "zod";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const dateString = () =>
  z
    .string()
    .regex(datePattern, { message: "日付はYYYY-MM-DD形式で指定してください。" });

export const attendanceStatusSchema = z.enum([
  "present",
  "absent",
  "late",
  "unknown",
]);
export const messageDirectionSchema = z.enum(["inbound", "outbound"]);
export const uuidSchema = z.string().uuid();

const optionalTrimmed = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value === "" ? undefined : value));

export const createGuardianSchema = z.object({
  name: z.string().trim().min(1, "名前は必須です。"),
  phone: optionalTrimmed,
  lineUserId: optionalTrimmed,
  loginToken: optionalTrimmed,
});

export const createStudentSchema = z.object({
  name: z.string().trim().min(1, "児童名は必須です。"),
  grade: optionalTrimmed,
  notes: optionalTrimmed,
  guardianId: uuidSchema.optional(),
});

export const createAttendanceSchema = z.object({
  guardianId: uuidSchema,
  studentId: uuidSchema,
  requestedFor: dateString(),
  status: attendanceStatusSchema,
  reason: optionalTrimmed,
});

export const attendanceQuerySchema = z.object({
  date: dateString().optional(),
  from: dateString().optional(),
  to: dateString().optional(),
});

export const statsQuerySchema = attendanceQuerySchema;

export const createMessageSchema = z.object({
  guardianId: uuidSchema,
  studentId: uuidSchema.nullable().optional(),
  direction: messageDirectionSchema,
  body: z.string().trim().min(1, "本文は必須です。"),
});

export const messagesQuerySchema = z.object({
  guardianId: uuidSchema.optional(),
  studentId: uuidSchema.optional(),
  direction: messageDirectionSchema.optional(),
});

export type CreateGuardianInput = z.infer<typeof createGuardianSchema>;
export type CreateStudentInput = z.infer<typeof createStudentSchema>;
export type CreateAttendanceInput = z.infer<typeof createAttendanceSchema>;
export type AttendanceQuery = z.infer<typeof attendanceQuerySchema>;
export type StatsQuery = z.infer<typeof statsQuerySchema>;
export type CreateMessageInput = z.infer<typeof createMessageSchema>;
export type MessagesQuery = z.infer<typeof messagesQuerySchema>;
