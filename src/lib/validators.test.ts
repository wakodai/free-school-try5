import { describe, expect, it } from "vitest";
import {
  attendanceQuerySchema,
  attendanceStatusSchema,
  createAttendanceSchema,
  createGuardianSchema,
  createMessageSchema,
  createStudentSchema,
  messageDirectionSchema,
  messagesQuerySchema,
  statsQuerySchema,
  uuidSchema,
} from "./validators";

const validUuid = "46a8a6b3-1dd6-4d4f-8a5a-548d9a5c1234";
const validUuid2 = "de9fb648-0a39-4bb8-8a8e-5f9273ed1234";

describe("uuidSchema", () => {
  it("有効なUUIDを受け入れる", () => {
    expect(uuidSchema.safeParse(validUuid).success).toBe(true);
  });

  it("無効なUUIDを拒否する", () => {
    expect(uuidSchema.safeParse("not-a-uuid").success).toBe(false);
    expect(uuidSchema.safeParse("").success).toBe(false);
    expect(uuidSchema.safeParse(123).success).toBe(false);
  });
});

describe("attendanceStatusSchema", () => {
  it("有効なステータスを受け入れる", () => {
    for (const status of ["present", "absent", "late", "unknown"]) {
      expect(attendanceStatusSchema.safeParse(status).success).toBe(true);
    }
  });

  it("無効なステータスを拒否する", () => {
    expect(attendanceStatusSchema.safeParse("invalid").success).toBe(false);
    expect(attendanceStatusSchema.safeParse("").success).toBe(false);
  });
});

describe("messageDirectionSchema", () => {
  it("有効な方向を受け入れる", () => {
    expect(messageDirectionSchema.safeParse("inbound").success).toBe(true);
    expect(messageDirectionSchema.safeParse("outbound").success).toBe(true);
  });

  it("無効な方向を拒否する", () => {
    expect(messageDirectionSchema.safeParse("invalid").success).toBe(false);
  });
});

describe("createGuardianSchema", () => {
  it("有効なデータを受け入れる", () => {
    const result = createGuardianSchema.parse({
      name: "山田太郎",
      phone: "090-1234-5678",
      lineUserId: "U1234567890",
      loginToken: "token123",
    });
    expect(result.name).toBe("山田太郎");
    expect(result.phone).toBe("090-1234-5678");
    expect(result.lineUserId).toBe("U1234567890");
    expect(result.loginToken).toBe("token123");
  });

  it("名前のみでも受け入れる", () => {
    const result = createGuardianSchema.parse({ name: "山田太郎" });
    expect(result.name).toBe("山田太郎");
    expect(result.phone).toBeUndefined();
  });

  it("optionalフィールドの空文字をundefinedに変換する", () => {
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

  it("名前が空なら失敗する", () => {
    const result = createGuardianSchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
  });

  it("名前が未指定なら失敗する", () => {
    const result = createGuardianSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("名前の前後の空白をトリムする", () => {
    const result = createGuardianSchema.parse({ name: "  山田太郎  " });
    expect(result.name).toBe("山田太郎");
  });
});

describe("createStudentSchema", () => {
  it("有効なデータを受け入れる", () => {
    const result = createStudentSchema.parse({
      name: "山田花子",
      grade: "小3",
      notes: "アレルギーあり",
      guardianId: validUuid,
    });
    expect(result.name).toBe("山田花子");
    expect(result.grade).toBe("小3");
    expect(result.notes).toBe("アレルギーあり");
    expect(result.guardianId).toBe(validUuid);
  });

  it("名前のみでも受け入れる", () => {
    const result = createStudentSchema.parse({ name: "山田花子" });
    expect(result.name).toBe("山田花子");
  });

  it("児童名が空なら失敗する", () => {
    const result = createStudentSchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
  });

  it("guardianIdが無効なUUIDなら失敗する", () => {
    const result = createStudentSchema.safeParse({
      name: "山田花子",
      guardianId: "invalid-uuid",
    });
    expect(result.success).toBe(false);
  });
});

describe("createAttendanceSchema", () => {
  it("有効なデータを受け入れる", () => {
    const result = createAttendanceSchema.parse({
      guardianId: validUuid,
      studentId: validUuid2,
      requestedFor: "2026-02-14",
      status: "present",
      reason: "体調不良",
    });
    expect(result.guardianId).toBe(validUuid);
    expect(result.studentId).toBe(validUuid2);
    expect(result.requestedFor).toBe("2026-02-14");
    expect(result.status).toBe("present");
    expect(result.reason).toBe("体調不良");
  });

  it("reasonなしでも受け入れる", () => {
    const result = createAttendanceSchema.parse({
      guardianId: validUuid,
      studentId: validUuid2,
      requestedFor: "2026-02-14",
      status: "absent",
    });
    expect(result.reason).toBeUndefined();
  });

  it("日付フォーマットが不正なら失敗する", () => {
    const result = createAttendanceSchema.safeParse({
      guardianId: validUuid,
      studentId: validUuid2,
      requestedFor: "2026/01/01",
      status: "present",
    });
    expect(result.success).toBe(false);
  });

  it("無効なステータスなら失敗する", () => {
    const result = createAttendanceSchema.safeParse({
      guardianId: validUuid,
      studentId: validUuid2,
      requestedFor: "2026-01-01",
      status: "invalid",
    });
    expect(result.success).toBe(false);
  });

  it("必須フィールドが欠けていたら失敗する", () => {
    expect(createAttendanceSchema.safeParse({}).success).toBe(false);
    expect(
      createAttendanceSchema.safeParse({
        guardianId: validUuid,
      }).success,
    ).toBe(false);
  });
});

describe("attendanceQuerySchema", () => {
  it("dateのみで通過する", () => {
    const result = attendanceQuerySchema.parse({ date: "2026-01-01" });
    expect(result.date).toBe("2026-01-01");
  });

  it("from/toで通過する", () => {
    const result = attendanceQuerySchema.parse({
      from: "2026-01-01",
      to: "2026-01-31",
    });
    expect(result.from).toBe("2026-01-01");
    expect(result.to).toBe("2026-01-31");
  });

  it("空のオブジェクトでも通過する（ビジネスロジックで検証）", () => {
    const result = attendanceQuerySchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("不正な日付フォーマットは失敗する", () => {
    const result = attendanceQuerySchema.safeParse({ date: "invalid" });
    expect(result.success).toBe(false);
  });
});

describe("statsQuerySchema", () => {
  it("attendanceQuerySchemaと同じスキーマである", () => {
    const result = statsQuerySchema.parse({ date: "2026-01-01" });
    expect(result.date).toBe("2026-01-01");
  });
});

describe("createMessageSchema", () => {
  it("有効なデータを受け入れる", () => {
    const result = createMessageSchema.parse({
      guardianId: validUuid,
      studentId: validUuid2,
      direction: "inbound",
      body: "テストメッセージ",
    });
    expect(result.guardianId).toBe(validUuid);
    expect(result.direction).toBe("inbound");
    expect(result.body).toBe("テストメッセージ");
  });

  it("studentIdがnullでも受け入れる", () => {
    const result = createMessageSchema.parse({
      guardianId: validUuid,
      studentId: null,
      direction: "outbound",
      body: "返信メッセージ",
    });
    expect(result.studentId).toBeNull();
  });

  it("studentIdが未指定でも受け入れる", () => {
    const result = createMessageSchema.parse({
      guardianId: validUuid,
      direction: "outbound",
      body: "返信メッセージ",
    });
    expect(result.studentId).toBeUndefined();
  });

  it("空本文は拒否される", () => {
    const result = createMessageSchema.safeParse({
      guardianId: validUuid,
      direction: "inbound",
      body: "",
    });
    expect(result.success).toBe(false);
  });

  it("スペースのみの本文は拒否される", () => {
    const result = createMessageSchema.safeParse({
      guardianId: validUuid,
      direction: "inbound",
      body: "   ",
    });
    expect(result.success).toBe(false);
  });

  it("無効なdirectionは拒否される", () => {
    const result = createMessageSchema.safeParse({
      guardianId: validUuid,
      direction: "invalid",
      body: "テスト",
    });
    expect(result.success).toBe(false);
  });
});

describe("messagesQuerySchema", () => {
  it("全パラメータ指定で通過する", () => {
    const result = messagesQuerySchema.parse({
      guardianId: validUuid,
      studentId: validUuid2,
      direction: "inbound",
    });
    expect(result.guardianId).toBe(validUuid);
    expect(result.studentId).toBe(validUuid2);
    expect(result.direction).toBe("inbound");
  });

  it("空のオブジェクトでも通過する", () => {
    const result = messagesQuerySchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("無効なUUIDは拒否される", () => {
    const result = messagesQuerySchema.safeParse({
      guardianId: "invalid",
    });
    expect(result.success).toBe(false);
  });
});
