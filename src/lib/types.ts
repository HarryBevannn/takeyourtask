export type Role = "manager" | "staff";
export type Priority = "low" | "medium" | "high" | "urgent";

export interface Profile {
  id: string;
  full_name: string;
  email: string | null;
}

export interface Workspace {
  id: string;
  name: string;
  invite_code: string;
}

export interface Membership {
  role: Role;
  workspace: Workspace;
}

export interface Member {
  user_id: string;
  role: Role;
  profile: Profile;
}

export interface Column {
  id: string;
  workspace_id: string;
  name: string;
  position: number;
}

export interface Task {
  id: string;
  workspace_id: string;
  column_id: string;
  number: number;
  title: string;
  description: string;
  location: string;
  assignee_id: string | null;
  due_date: string | null;
  priority: Priority;
  position: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChecklistItem {
  id: string;
  task_id: string;
  workspace_id: string;
  label: string;
  done: boolean;
  position: number;
}

export interface Comment {
  id: string;
  task_id: string;
  workspace_id: string;
  author_id: string | null;
  body: string;
  created_at: string;
}

export interface AppNotification {
  id: string;
  user_id: string;
  workspace_id: string;
  task_id: string | null;
  actor_id: string | null;
  type: string;
  message: string;
  read: boolean;
  created_at: string;
}

export interface Toast {
  id: string;
  message: string;
  kind: "info" | "error";
  taskId?: string | null;
  workspaceId?: string;
}
