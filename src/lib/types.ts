export type Role = "manager" | "staff";
export type Priority = "low" | "medium" | "high" | "urgent";

export interface Profile {
  id: string;
  full_name: string;
  email: string | null;
  email_notifications?: boolean;
}

export interface Workspace {
  id: string;
  name: string;
  invite_code: string;
  logo_url: string | null;
  accent_color: string | null;
  location_label: string;
  show_location: boolean;
  show_priority: boolean;
  priority_labels: Partial<Record<Priority, string>>;
  default_priority: Priority;
  staff_can_create_tasks: boolean;
  staff_can_delete_tasks: boolean;
  staff_can_manage_columns: boolean;
  key_prefix: string;
  item_name: string;
  item_name_plural: string;
}

/** The workspace columns a manager can change from the settings panel. */
export type WorkspaceSettings = Omit<Workspace, "id" | "invite_code">;

/** How a company has configured the optional task fields. */
export interface FieldConfig {
  /** What this company calls a task, lower case: "job" / "jobs" by default. */
  itemName: string;
  itemNamePlural: string;
  showLocation: boolean;
  locationLabel: string;
  showPriority: boolean;
  priorityLabels: Record<Priority, string>;
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
  /** Set when the task reaches the last column; done work is archived a week later. */
  completed_at: string | null;
}

/** An automatic history entry, e.g. "moved this to Done". */
export interface TaskEvent {
  id: string;
  task_id: string;
  workspace_id: string;
  actor_id: string | null;
  message: string;
  created_at: string;
}

export interface Attachment {
  id: string;
  task_id: string;
  workspace_id: string;
  path: string;
  uploaded_by: string | null;
  created_at: string;
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
