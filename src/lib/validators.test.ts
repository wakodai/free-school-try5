import { describe, expect, it } from "vitest";
import {
  attendanceQuerySchema,
  createAttendanceSchema,
  createGuardianSchema,
  createMessageSchema,
  createStudentSchema,
} from "./validators";

describe("createGuardianSchema", () => {
  it("allows optionalフィールドを空文字から未設定に変換する", () => {
    const result = createGuardianSchema.parse({
      name: "山田太郎",
      phone: "",
      lineUserId: "   ",
      loginToken: "",
    });

    expect(result.phone).toBeUndefined();
    expect(result.lineUserId).toBeUndefined();
    expect(result.loginToken).toBeUndefined();
  });
});

describe("createStudentSchema", () => {
  it("児童名が空なら失敗する", () => {
    const result = createStudentSchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
  });
});

describe("createAttendanceSchema", () => {
  it("日付フォーマットが不正なら失敗する", () => {
    const result = createAttendanceSchema.safeParse({
      guardianId: "46a8a6b3-1dd6-4d4f-8a5a-548d9a5c1234",
      studentId: "de9fb648-0a39-4bb8-8a8e-5f9273ed1234",
      requestedFor: "2026/01/01",
      status: "present",
    });
    expect(result.success).toBe(false);
  });
});

describe("attendanceQuerySchema", () => {
  it("日付がYYYY-MM-DDであれば通過する", () => {
    const result = attendanceQuerySchema.parse({ date: "2026-01-01" });
    expect(result.date).toBe("2026-01-01");
  });
});

describe("createMessageSchema", () => {
  it("空本文は拒否される", () => {
    const result = createMessageSchema.safeParse({
      guardianId: "46a8a6b3-1dd6-4d4f-8a5a-548d9a5c1234",
      direction: "inbound",
      body: "",
    });
    expect(result.success).toBe(false);
  });
});
