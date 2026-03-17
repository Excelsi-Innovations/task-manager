# Providers

Providers are adapters between the `tm` CLI and a task management backend. Each provider implements the `TaskProvider` interface, translating the generic task model to and from the backend's own API and data types.

---

## `TaskProvider` Interface

Defined in `src/interfaces.ts`. All providers must implement this interface.

```typescript
interface TaskProvider {
  readonly name: string;

  listTasks(filter?: TaskFilter): Promise<Task[]>;
  getTask(id: string): Promise<Task | null>;
  createTask(input: CreateTaskInput): Promise<Task>;
  updateTask(id: string, input: UpdateTaskInput): Promise<Task>;
  deleteTask(id: string): Promise<void>;

  // Optional
  listProjects?(): Promise<Project[]>;
  getProject?(id: string): Promise<Project | null>;
}
```

### Methods

| Method                  | Returns           | Description                                    |
| ----------------------- | ----------------- | ---------------------------------------------- |
| `listTasks(filter?)`    | `Task[]`          | List tasks, optionally filtered                |
| `getTask(id)`           | `Task \| null`    | Fetch a single task by ID; `null` if not found |
| `createTask(input)`     | `Task`            | Create a new task                              |
| `updateTask(id, input)` | `Task`            | Partially update a task                        |
| `deleteTask(id)`        | `void`            | Delete a task                                  |
| `listProjects?()`       | `Project[]`       | List all projects (optional)                   |
| `getProject?(id)`       | `Project \| null` | Fetch a single project (optional)              |

---

## Core Types

### `Task`

```typescript
interface Task {
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
```

### `TaskStatus`

```typescript
type TaskStatus = "todo" | "in_progress" | "done" | "cancelled";
```

### `TaskPriority`

```typescript
type TaskPriority = "low" | "medium" | "high" | "urgent";
```

### `CreateTaskInput`

```typescript
interface CreateTaskInput {
  title: string;
  description?: string;
  priority?: TaskPriority;
  dueDate?: Date;
  labels?: string[];
  projectId?: string;
}
```

### `UpdateTaskInput`

All fields optional — only provided fields are updated.

```typescript
interface UpdateTaskInput {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueDate?: Date;
  labels?: string[];
}
```

### `TaskFilter`

```typescript
interface TaskFilter {
  status?: TaskStatus;
  priority?: TaskPriority;
  projectId?: string;
  labels?: string[];
}
```

### `Project`

```typescript
interface Project {
  id: string;
  name: string;
  description?: string;
}
```

---

## `AtlasProvider`

File: `src/providers/atlas.ts`

### Config

```typescript
interface AtlasConfig {
  apiUrl: string; // Base URL, e.g. "http://localhost:3000"
  email: string; // Atlas user email
  password: string; // Atlas user password
  defaultProjectId?: string; // UUID — used when no projectId is passed to createTask/listTasks
}
```

### Status Mapping

| Atlas API value | `TaskStatus`  |
| --------------- | ------------- |
| `BACKLOG`       | `todo`        |
| `TODO`          | `todo`        |
| `IN_REVIEW`     | `todo`        |
| `IN_PROGRESS`   | `in_progress` |
| `DONE`          | `done`        |
| `CANCELLED`     | `cancelled`   |

### Priority Mapping

| Atlas API value | `TaskPriority` |
| --------------- | -------------- |
| `NONE`          | `low`          |
| `LOW`           | `low`          |
| `MEDIUM`        | `medium`       |
| `HIGH`          | `high`         |
| `URGENT`        | `urgent`       |

### Notes

- **Authentication** is lazy: the first API call triggers `POST /api/v1/auth/login` automatically. The token is stored in memory for the lifetime of the provider instance.
- **401 handling**: a single re-authentication retry is performed transparently. If it fails again, the error propagates.
- **Create ticket** uses a project-nested route (`POST /api/v1/projects/:projectId/tickets`). A `projectId` must be available — either from `CreateTaskInput.projectId` or `AtlasConfig.defaultProjectId`.
- **All other ticket operations** use the top-level route (`/api/v1/tickets/:id`).
- **Label filtering** is performed client-side — the Atlas API does not support filtering by label name.

---

## `VikunjaProvider`

File: `src/providers/vikunja.ts`

### Config

```typescript
interface VikunjaConfig {
  apiUrl: string; // Base URL, e.g. "https://tasks.example.com"
  token: string; // Vikunja API token
  defaultProjectId?: number; // Numeric project ID (not a UUID)
}
```

### Status Mapping

Vikunja uses a boolean `done` field rather than a status enum.

| Vikunja field | `TaskStatus` |
| ------------- | ------------ |
| `done: false` | `todo`       |
| `done: true`  | `done`       |

> `in_progress` and `cancelled` are not supported by Vikunja and will not round-trip correctly.

### Priority Mapping

Vikunja uses a numeric `priority` field (0–4).

| Vikunja `priority` | `TaskPriority` |
| ------------------ | -------------- |
| 0–1                | `low`          |
| 2                  | `medium`       |
| 3                  | `high`         |
| 4                  | `urgent`       |

### Notes

- **`defaultProjectId` is a `number`**, not a string UUID. Passing a non-numeric string will result in a `NaN` project ID.
- **`listTasks`** fetches all tasks (`GET /api/v1/tasks/all`) and applies `projectId`, status, and label filters client-side, except `done` which is passed as a query param.
- **`createTask`** uses `PUT /api/v1/projects/:id/tasks` (Vikunja's creation endpoint).
- **`updateTask`** uses `POST /api/v1/tasks/:id` (not `PATCH`).
- Labels are not written on create — Vikunja requires a separate labels API call not currently implemented.
