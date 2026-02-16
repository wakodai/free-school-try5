export type AttendanceStatus = "present" | "absent" | "late" | "unknown";
export type MessageDirection = "inbound" | "outbound";

export interface Guardian {
  id: string;
  name: string;
  phone?: string | null;
  lineUserId?: string | null;
  loginToken?: string | null;
  createdAt: string;
}

export interface Student {
  id: string;
  name: string;
  grade?: string | null;
  notes?: string | null;
  createdAt: string;
  guardian?: { id: string; name: string; createdAt: string } | null;
}

export interface AttendanceRequest {
  id: string;
  guardianId: string;
  studentId: string;
  requestedFor: string; // YYYY-MM-DD (date string)
  status: AttendanceStatus;
  reason?: string | null;
  createdAt: string;
  guardian?: { id: string; name: string; phone?: string | null };
  student?: { id: string; name: string; grade?: string | null };
}

export interface Message {
  id: string;
  guardianId: string;
  studentId?: string | null;
  direction: MessageDirection;
  body: string;
  createdAt: string;
  guardian?: { id: string; name: string; phone?: string | null };
  student?: { id: string; name: string; grade?: string | null };
}

export interface StatusCounts {
  present: number;
  absent: number;
  late: number;
  unknown: number;
  total: number;
}

export interface AttendanceStats {
  range: { from: string | null; to: string | null };
  overall: StatusCounts;
  byStudent: Array<
    StatusCounts & {
      student: { id: string; name: string; grade?: string | null };
    }
  >;
}
