export type UUID = string;
export type Timestamp = string;

export type Database = {
  public: {
    Tables: {
      guardians: {
        Row: {
          id: UUID;
          name: string;
          phone: string | null;
          line_user_id: string | null;
          login_token: string | null;
          created_at: Timestamp;
        };
        Insert: {
          id?: UUID;
          name: string;
          phone?: string | null;
          line_user_id?: string | null;
          login_token?: string | null;
          created_at?: Timestamp;
        };
        Update: Partial<{
          name: string;
          phone: string | null;
          line_user_id: string | null;
          login_token: string | null;
        }>;
      };
      students: {
        Row: {
          id: UUID;
          name: string;
          grade: string | null;
          notes: string | null;
          created_at: Timestamp;
        };
        Insert: {
          id?: UUID;
          name: string;
          grade?: string | null;
          notes?: string | null;
          created_at?: Timestamp;
        };
        Update: Partial<{
          name: string;
          grade: string | null;
          notes: string | null;
        }>;
      };
      guardian_students: {
        Row: {
          guardian_id: UUID;
          student_id: UUID;
          created_at: Timestamp;
        };
        Insert: {
          guardian_id: UUID;
          student_id: UUID;
          created_at?: Timestamp;
        };
        Update: Partial<{
          guardian_id: UUID;
          student_id: UUID;
        }>;
      };
      attendance_requests: {
        Row: {
          id: UUID;
          guardian_id: UUID;
          student_id: UUID;
          requested_for: string; // YYYY-MM-DD
          status: "present" | "absent" | "late" | "unknown";
          reason: string | null;
          created_at: Timestamp;
        };
        Insert: {
          id?: UUID;
          guardian_id: UUID;
          student_id: UUID;
          requested_for: string;
          status?: "present" | "absent" | "late" | "unknown";
          reason?: string | null;
          created_at?: Timestamp;
        };
        Update: Partial<{
          guardian_id: UUID;
          student_id: UUID;
          requested_for: string;
          status: "present" | "absent" | "late" | "unknown";
          reason: string | null;
        }>;
      };
      messages: {
        Row: {
          id: UUID;
          guardian_id: UUID;
          student_id: UUID | null;
          direction: "inbound" | "outbound";
          body: string;
          created_at: Timestamp;
        };
        Insert: {
          id?: UUID;
          guardian_id: UUID;
          student_id?: UUID | null;
          direction: "inbound" | "outbound";
          body: string;
          created_at?: Timestamp;
        };
        Update: Partial<{
          guardian_id: UUID;
          student_id: UUID | null;
          direction: "inbound" | "outbound";
          body: string;
        }>;
      };
    };
    Enums: {
      attendance_status: "present" | "absent" | "late" | "unknown";
      message_direction: "inbound" | "outbound";
    };
  };
};
