import axios, { AxiosInstance } from "axios";
import {
  Task,
  TaskProvider,
  CreateTaskInput,
  UpdateTaskInput,
  TaskFilter,
  TaskStatus,
  TaskPriority,
  Project,
} from "../interfaces.js";

// ─── Atlas raw shapes ──────────────────────────────────────────────────────

interface AtlasTicket {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority?: string;
  projectId: string;
  dueDate?: string | null;
  createdAt: string;
  updatedAt: string;
  labels?: { id: string; name: string }[];
}

interface AtlasProject {
  id: string;
  name: string;
  description?: string;
}

// ─── Config ───────────────────────────────────────────────────────────────

export interface AtlasConfig {
  apiUrl: string;
  email: string;
  password: string;
  defaultProjectId?: string;
}

// ─── Status mapping ───────────────────────────────────────────────────────

function atlasStatusToTask(status: string): TaskStatus {
  switch (status) {
    case "DONE":
      return "done";
    case "IN_PROGRESS":
      return "in_progress";
    case "CANCELLED":
      return "cancelled";
    default:
      return "todo";
  }
}

function taskStatusToAtlas(status: TaskStatus): string {
  switch (status) {
    case "done":
      return "DONE";
    case "in_progress":
      return "IN_PROGRESS";
    case "cancelled":
      return "CANCELLED";
    default:
      return "TODO";
  }
}

// ─── Priority mapping ─────────────────────────────────────────────────────

function atlasPriorityToTask(priority?: string): TaskPriority {
  switch (priority) {
    case "URGENT":
      return "urgent";
    case "HIGH":
      return "high";
    case "MEDIUM":
      return "medium";
    default:
      return "low";
  }
}

function taskPriorityToAtlas(priority?: TaskPriority): string {
  switch (priority) {
    case "urgent":
      return "URGENT";
    case "high":
      return "HIGH";
    case "medium":
      return "MEDIUM";
    default:
      return "LOW";
  }
}

// ─── Mapper ───────────────────────────────────────────────────────────────

function mapAtlasTicketToTask(t: AtlasTicket): Task {
  return {
    id: t.id,
    title: t.title,
    description: t.description ?? undefined,
    status: atlasStatusToTask(t.status),
    priority: atlasPriorityToTask(t.priority),
    dueDate: t.dueDate ? new Date(t.dueDate) : undefined,
    labels: t.labels?.map((l) => l.name) ?? [],
    projectId: t.projectId,
    createdAt: new Date(t.createdAt),
    updatedAt: new Date(t.updatedAt),
  };
}

// ─── Provider ─────────────────────────────────────────────────────────────

export class AtlasProvider implements TaskProvider {
  readonly name = "atlas";
  private client: AxiosInstance;
  private defaultProjectId?: string;
  private accessToken: string | null = null;
  private loginCredentials: { email: string; password: string };

  constructor(config: AtlasConfig) {
    this.defaultProjectId = config.defaultProjectId;
    this.loginCredentials = { email: config.email, password: config.password };

    this.client = axios.create({
      baseURL: config.apiUrl.replace(/\/$/, ""),
      headers: { "Content-Type": "application/json" },
    });

    // Lazily inject token before each request
    this.client.interceptors.request.use(async (req) => {
      if (!this.accessToken) {
        await this.authenticate();
      }
      req.headers["Authorization"] = `Bearer ${this.accessToken}`;
      return req;
    });

    // Re-authenticate on 401 and retry once
    this.client.interceptors.response.use(
      (res) => res,
      async (error) => {
        const original = error.config;
        if (error.response?.status === 401 && !original._retry) {
          original._retry = true;
          this.accessToken = null;
          await this.authenticate();
          original.headers["Authorization"] = `Bearer ${this.accessToken}`;
          return this.client.request(original);
        }
        return Promise.reject(error);
      },
    );
  }

  private async authenticate(): Promise<void> {
    const baseURL = this.client.defaults.baseURL as string;
    const response = await axios.post<{ accessToken: string }>(
      `${baseURL}/api/v1/auth/login`,
      this.loginCredentials,
      { headers: { "Content-Type": "application/json" } },
    );
    this.accessToken = response.data.accessToken;
  }

  async listTasks(filter?: TaskFilter): Promise<Task[]> {
    const params: Record<string, string> = {};

    if (filter?.projectId) {
      params.projectId = filter.projectId;
    } else if (this.defaultProjectId) {
      params.projectId = this.defaultProjectId;
    }

    if (filter?.status) {
      params.status = taskStatusToAtlas(filter.status);
    }

    const response = await this.client.get<{ tickets: AtlasTicket[] }>(
      "/api/v1/tickets",
      { params },
    );
    let tasks = response.data.tickets.map(mapAtlasTicketToTask);

    // Atlas API does not support filtering by label name; do it client-side
    if (filter?.labels && filter.labels.length > 0) {
      tasks = tasks.filter((t) =>
        filter.labels!.some((l) => t.labels?.includes(l)),
      );
    }

    return tasks;
  }

  async getTask(id: string): Promise<Task | null> {
    try {
      const response = await this.client.get<{ ticket: AtlasTicket }>(
        `/api/v1/tickets/${id}`,
      );
      return mapAtlasTicketToTask(response.data.ticket);
    } catch {
      return null;
    }
  }

  async createTask(input: CreateTaskInput): Promise<Task> {
    const projectId = input.projectId ?? this.defaultProjectId;
    if (!projectId) {
      throw new Error(
        "Project ID is required. Set ATLAS_DEFAULT_PROJECT_ID or pass --project <uuid>.",
      );
    }

    const payload: Record<string, unknown> = { title: input.title };
    if (input.description) payload.description = input.description;
    if (input.priority) payload.priority = taskPriorityToAtlas(input.priority);
    if (input.dueDate) payload.dueDate = input.dueDate.toISOString();

    const response = await this.client.post<{ ticket: AtlasTicket }>(
      `/api/v1/projects/${projectId}/tickets`,
      payload,
    );
    return mapAtlasTicketToTask(response.data.ticket);
  }

  async updateTask(id: string, input: UpdateTaskInput): Promise<Task> {
    const payload: Record<string, unknown> = {};

    if (input.title !== undefined) payload.title = input.title;
    if (input.description !== undefined)
      payload.description = input.description;
    if (input.status !== undefined)
      payload.status = taskStatusToAtlas(input.status);
    if (input.priority !== undefined)
      payload.priority = taskPriorityToAtlas(input.priority);
    if (input.dueDate !== undefined)
      payload.dueDate = input.dueDate?.toISOString() ?? null;

    const response = await this.client.patch<{ ticket: AtlasTicket }>(
      `/api/v1/tickets/${id}`,
      payload,
    );
    return mapAtlasTicketToTask(response.data.ticket);
  }

  async deleteTask(id: string): Promise<void> {
    await this.client.delete(`/api/v1/tickets/${id}`);
  }

  async listProjects(): Promise<Project[]> {
    const response = await this.client.get<{ projects: AtlasProject[] }>(
      "/api/v1/projects",
    );
    return response.data.projects.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description ?? undefined,
    }));
  }

  async getProject(id: string): Promise<Project | null> {
    try {
      const response = await this.client.get<{ project: AtlasProject }>(
        `/api/v1/projects/${id}`,
      );
      const p = (response.data as any).project ?? response.data;
      return {
        id: p.id,
        name: p.name,
        description: p.description ?? undefined,
      };
    } catch {
      return null;
    }
  }
}
