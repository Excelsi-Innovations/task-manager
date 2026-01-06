/**
 * Core interfaces for the Task Manager
 * These are agnostic to any specific task provider
 */

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority?: TaskPriority;
  dueDate?: Date;
  labels?: string[];
  projectId?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'cancelled';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface CreateTaskInput {
  title: string;
  description?: string;
  priority?: TaskPriority;
  dueDate?: Date;
  labels?: string[];
  projectId?: string;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueDate?: Date;
  labels?: string[];
}

export interface TaskFilter {
  status?: TaskStatus;
  priority?: TaskPriority;
  projectId?: string;
  labels?: string[];
}

export interface Project {
  id: string;
  name: string;
  description?: string;
}

/**
 * TaskProvider interface - implement this for each task management backend
 */
export interface TaskProvider {
  readonly name: string;

  // Task operations
  listTasks(filter?: TaskFilter): Promise<Task[]>;
  getTask(id: string): Promise<Task | null>;
  createTask(input: CreateTaskInput): Promise<Task>;
  updateTask(id: string, input: UpdateTaskInput): Promise<Task>;
  deleteTask(id: string): Promise<void>;

  // Project operations (optional)
  listProjects?(): Promise<Project[]>;
  getProject?(id: string): Promise<Project | null>;
}
