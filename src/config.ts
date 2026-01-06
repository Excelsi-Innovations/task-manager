import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

export interface TaskManagerConfig {
  provider: string;
  vikunja?: {
    apiUrl: string;
    token: string;
    defaultProjectId?: number;
  };
  github?: {
    token: string;
    owner: string;
    repo: string;
  };
}

const CONFIG_DIR = join(homedir(), '.config', 'task-manager');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

export function getConfigPath(): string {
  return CONFIG_FILE;
}

export function loadConfig(): TaskManagerConfig | null {
  if (!existsSync(CONFIG_FILE)) {
    return null;
  }

  try {
    const content = readFileSync(CONFIG_FILE, 'utf-8');
    return JSON.parse(content) as TaskManagerConfig;
  } catch {
    return null;
  }
}

export function saveConfig(config: TaskManagerConfig): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }

  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

export function getEffectiveConfig(): TaskManagerConfig | null {
  // Priority: Environment variables > Config file

  const fileConfig = loadConfig();

  // Check if we have env vars for vikunja
  if (process.env.VIKUNJA_API_URL && process.env.VIKUNJA_TOKEN) {
    return {
      provider: process.env.TM_PROVIDER || 'vikunja',
      vikunja: {
        apiUrl: process.env.VIKUNJA_API_URL,
        token: process.env.VIKUNJA_TOKEN,
        defaultProjectId: process.env.VIKUNJA_DEFAULT_PROJECT_ID
          ? Number(process.env.VIKUNJA_DEFAULT_PROJECT_ID)
          : fileConfig?.vikunja?.defaultProjectId,
      },
    };
  }

  return fileConfig;
}
