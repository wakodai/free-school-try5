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
        Relationships: [];
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
        Relationships: [];
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
        Relationships: [
          {
            foreignKeyName: "guardian_students_guardian_id_fkey";
            columns: ["guardian_id"];
            referencedRelation: "guardians";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "guardian_students_student_id_fkey";
            columns: ["student_id"];
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
        ];
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
        Relationships: [
          {
            foreignKeyName: "attendance_requests_guardian_id_fkey";
            columns: ["guardian_id"];
            referencedRelation: "guardians";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "attendance_requests_student_id_fkey";
            columns: ["student_id"];
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
        ];
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
        Relationships: [
          {
            foreignKeyName: "messages_guardian_id_fkey";
            columns: ["guardian_id"];
            referencedRelation: "guardians";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "messages_student_id_fkey";
            columns: ["student_id"];
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
        ];
      };
    } & {
      [key: string]:
        | {
            Row: Record<string, unknown>;
            Insert?: Record<string, unknown>;
            Update?: Record<string, unknown>;
            Relationships?: unknown[];
          }
        | undefined;
    };
    Enums: {
      attendance_status: "present" | "absent" | "late" | "unknown";
      message_direction: "inbound" | "outbound";
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
