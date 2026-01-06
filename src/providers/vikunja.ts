import axios, { AxiosInstance } from 'axios';
import {
  Task,
  TaskProvider,
  CreateTaskInput,
  UpdateTaskInput,
  TaskFilter,
  TaskStatus,
  Project,
} from '../interfaces.js';

interface VikunjaTask {
  id: number;
  title: string;
  description: string;
  done: boolean;
  priority: number;
  due_date: string | null;
  labels: { id: number; title: string }[];
  project_id: number;
  created: string;
  updated: string;
}

interface VikunjaProject {
  id: number;
  title: string;
  description: string;
}

export interface VikunjaConfig {
  apiUrl: string;
  token: string;
  defaultProjectId?: number;
}

function mapVikunjaTaskToTask(vt: VikunjaTask): Task {
  let status: TaskStatus = 'todo';
  if (vt.done) {
    status = 'done';
  }

  return {
    id: String(vt.id),
    title: vt.title,
    description: vt.description || undefined,
    status,
    priority:
      vt.priority >= 4
        ? 'urgent'
        : vt.priority >= 3
          ? 'high'
          : vt.priority >= 2
            ? 'medium'
            : 'low',
    dueDate: vt.due_date ? new Date(vt.due_date) : undefined,
    labels: vt.labels?.map((l) => l.title) || [],
    projectId: String(vt.project_id),
    createdAt: new Date(vt.created),
    updatedAt: new Date(vt.updated),
  };
}

export class VikunjaProvider implements TaskProvider {
  readonly name = 'vikunja';
  private client: AxiosInstance;
  private defaultProjectId?: number;

  constructor(config: VikunjaConfig) {
    this.defaultProjectId = config.defaultProjectId;
    this.client = axios.create({
      baseURL: config.apiUrl.replace(/\/$/, ''),
      headers: {
        Authorization: `Bearer ${config.token}`,
        'Content-Type': 'application/json',
      },
    });
  }

  async listTasks(filter?: TaskFilter): Promise<Task[]> {
    const params: Record<string, string> = {};

    if (filter?.status === 'done') {
      params.filter_done = 'true';
    }

    const response = await this.client.get<VikunjaTask[]>('/api/v1/tasks/all', {
      params,
    });
    let tasks = response.data.map(mapVikunjaTaskToTask);

    // Apply additional filters
    if (filter?.projectId) {
      tasks = tasks.filter((t) => t.projectId === filter.projectId);
    }
    if (filter?.status && filter.status !== 'done') {
      tasks = tasks.filter((t) => t.status === filter.status);
    }
    if (filter?.labels && filter.labels.length > 0) {
      tasks = tasks.filter((t) =>
        filter.labels!.some((l) => t.labels?.includes(l)),
      );
    }

    return tasks;
  }

  async getTask(id: string): Promise<Task | null> {
    try {
      const response = await this.client.get<VikunjaTask>(
        `/api/v1/tasks/${id}`,
      );
      return mapVikunjaTaskToTask(response.data);
    } catch {
      return null;
    }
  }

  async createTask(input: CreateTaskInput): Promise<Task> {
    const projectId = input.projectId
      ? Number(input.projectId)
      : this.defaultProjectId;

    if (!projectId) {
      throw new Error(
        'Project ID is required. Set VIKUNJA_DEFAULT_PROJECT_ID or provide projectId.',
      );
    }

    const payload = {
      title: input.title,
      description: input.description || '',
      priority:
        input.priority === 'urgent'
          ? 4
          : input.priority === 'high'
            ? 3
            : input.priority === 'medium'
              ? 2
              : 1,
      due_date: input.dueDate?.toISOString() || null,
    };

    const response = await this.client.put<VikunjaTask>(
      `/api/v1/projects/${projectId}/tasks`,
      payload,
    );
    return mapVikunjaTaskToTask(response.data);
  }

  async updateTask(id: string, input: UpdateTaskInput): Promise<Task> {
    const payload: Record<string, unknown> = {};

    if (input.title !== undefined) payload.title = input.title;
    if (input.description !== undefined)
      payload.description = input.description;
    if (input.status !== undefined) payload.done = input.status === 'done';
    if (input.priority !== undefined) {
      payload.priority =
        input.priority === 'urgent'
          ? 4
          : input.priority === 'high'
            ? 3
            : input.priority === 'medium'
              ? 2
              : 1;
    }
    if (input.dueDate !== undefined)
      payload.due_date = input.dueDate?.toISOString() || null;

    const response = await this.client.post<VikunjaTask>(
      `/api/v1/tasks/${id}`,
      payload,
    );
    return mapVikunjaTaskToTask(response.data);
  }

  async deleteTask(id: string): Promise<void> {
    await this.client.delete(`/api/v1/tasks/${id}`);
  }

  async listProjects(): Promise<Project[]> {
    const response =
      await this.client.get<VikunjaProject[]>('/api/v1/projects');
    return response.data.map((p) => ({
      id: String(p.id),
      name: p.title,
      description: p.description || undefined,
    }));
  }

  async getProject(id: string): Promise<Project | null> {
    try {
      const response = await this.client.get<VikunjaProject>(
        `/api/v1/projects/${id}`,
      );
      return {
        id: String(response.data.id),
        name: response.data.title,
        description: response.data.description || undefined,
      };
    } catch {
      return null;
    }
  }
}
