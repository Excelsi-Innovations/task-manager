#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import { config } from 'dotenv';
import { VikunjaProvider, VikunjaConfig } from './providers/vikunja.js';
import {
  loadConfig,
  saveConfig,
  getConfigPath,
  getEffectiveConfig,
  TaskManagerConfig,
} from './config.js';
import type {
  TaskProvider,
  Task,
  CreateTaskInput,
  TaskFilter,
  TaskStatus,
  TaskPriority,
} from './interfaces.js';

// Load environment variables (lower priority than saved config for some things)
config();

const program = new Command();

function getProvider(): TaskProvider {
  const effectiveConfig = getEffectiveConfig();

  if (!effectiveConfig) {
    console.error(
      chalk.red('Error: No configuration found.'),
      '\nRun',
      chalk.cyan('tm config --provider vikunja --url <URL> --token <TOKEN>'),
      'to configure.',
    );
    process.exit(1);
  }

  const providerName = effectiveConfig.provider || 'vikunja';

  if (providerName === 'vikunja') {
    if (!effectiveConfig.vikunja?.apiUrl || !effectiveConfig.vikunja?.token) {
      console.error(
        chalk.red('Error: Vikunja configuration incomplete.'),
        '\nRun',
        chalk.cyan('tm config --provider vikunja --url <URL> --token <TOKEN>'),
        'to configure.',
      );
      process.exit(1);
    }

    const vikunjaConfig: VikunjaConfig = {
      apiUrl: effectiveConfig.vikunja.apiUrl,
      token: effectiveConfig.vikunja.token,
      defaultProjectId: effectiveConfig.vikunja.defaultProjectId,
    };

    return new VikunjaProvider(vikunjaConfig);
  }

  console.error(
    chalk.red(`Error: Unknown provider "${providerName}". Supported: vikunja`),
  );
  process.exit(1);
}

function formatTask(task: Task): string {
  const statusIcon =
    task.status === 'done'
      ? chalk.green('✓')
      : task.status === 'in_progress'
        ? chalk.yellow('●')
        : chalk.gray('○');
  const priorityColor =
    task.priority === 'urgent'
      ? chalk.red
      : task.priority === 'high'
        ? chalk.yellow
        : chalk.white;
  return `${statusIcon} ${chalk.bold(task.id)} ${priorityColor(task.title)}`;
}

function outputJson(data: unknown): void {
  console.log(JSON.stringify(data, null, 2));
}

program
  .name('tm')
  .description('Agnostic Task Manager CLI')
  .version('0.1.0')
  .option('--json', 'Output in JSON format (for AI agents)');

// Config command
program
  .command('config')
  .description('Configure the task manager')
  .option('--provider <provider>', 'Set provider (vikunja, github)')
  .option('--url <url>', 'API URL for the provider')
  .option('--token <token>', 'API token')
  .option('--project <id>', 'Default project ID')
  .option('--show', 'Show current configuration')
  .action(
    (options: {
      provider?: string;
      url?: string;
      token?: string;
      project?: string;
      show?: boolean;
    }) => {
      if (options.show) {
        const currentConfig = loadConfig();
        if (program.opts().json) {
          outputJson(currentConfig || {});
        } else {
          if (currentConfig) {
            console.log(chalk.bold('\n⚙️  Current Configuration:\n'));
            console.log(`  ${chalk.gray('File:')} ${getConfigPath()}`);
            console.log(
              `  ${chalk.gray('Provider:')} ${currentConfig.provider}`,
            );
            if (currentConfig.vikunja) {
              console.log(
                `  ${chalk.gray('Vikunja URL:')} ${currentConfig.vikunja.apiUrl}`,
              );
              console.log(
                `  ${chalk.gray('Token:')} ${currentConfig.vikunja.token.slice(0, 10)}...`,
              );
              if (currentConfig.vikunja.defaultProjectId) {
                console.log(
                  `  ${chalk.gray('Default Project:')} ${currentConfig.vikunja.defaultProjectId}`,
                );
              }
            }
            console.log();
          } else {
            console.log(chalk.gray('No configuration found.'));
            console.log(
              'Run',
              chalk.cyan(
                'tm config --provider vikunja --url <URL> --token <TOKEN>',
              ),
              'to configure.',
            );
          }
        }
        return;
      }

      // Update config
      const currentConfig = loadConfig() || { provider: 'vikunja' };
      const newConfig: TaskManagerConfig = { ...currentConfig };

      if (options.provider) {
        newConfig.provider = options.provider;
      }

      if (
        options.provider === 'vikunja' ||
        (!options.provider && newConfig.provider === 'vikunja')
      ) {
        if (!newConfig.vikunja) {
          newConfig.vikunja = { apiUrl: '', token: '' };
        }
        if (options.url) {
          newConfig.vikunja.apiUrl = options.url;
        }
        if (options.token) {
          newConfig.vikunja.token = options.token;
        }
        if (options.project) {
          newConfig.vikunja.defaultProjectId = Number(options.project);
        }
      }

      saveConfig(newConfig);

      if (program.opts().json) {
        outputJson({ success: true, config: newConfig });
      } else {
        console.log(chalk.green('✓ Configuration saved to'), getConfigPath());
      }
    },
  );

// List tasks
program
  .command('list')
  .alias('ls')
  .description('List all tasks')
  .option('-s, --status <status>', 'Filter by status (todo, in_progress, done)')
  .option('-p, --project <id>', 'Filter by project ID')
  .option('--all', 'Show all tasks including completed')
  .action(
    async (options: { status?: string; project?: string; all?: boolean }) => {
      try {
        const provider = getProvider();
        const filter: TaskFilter = {};

        if (options.status) {
          filter.status = options.status as TaskStatus;
        } else if (!options.all) {
          // By default, hide completed tasks
          filter.status = 'todo';
        }

        if (options.project) {
          filter.projectId = options.project;
        }

        const tasks = await provider.listTasks(filter);

        if (program.opts().json) {
          outputJson(tasks);
        } else {
          if (tasks.length === 0) {
            console.log(chalk.gray('No tasks found.'));
          } else {
            console.log(chalk.bold(`\n📋 Tasks (${tasks.length}):\n`));
            tasks.forEach((task) => console.log('  ' + formatTask(task)));
            console.log();
          }
        }
      } catch (error) {
        console.error(
          chalk.red('Error:'),
          error instanceof Error ? error.message : error,
        );
        process.exit(1);
      }
    },
  );

// Add a task
program
  .command('add <title>')
  .description('Create a new task')
  .option('-d, --description <text>', 'Task description')
  .option(
    '-p, --priority <priority>',
    'Priority (low, medium, high, urgent)',
    'medium',
  )
  .option('--project <id>', 'Project ID')
  .action(
    async (
      title: string,
      options: { description?: string; priority?: string; project?: string },
    ) => {
      try {
        const provider = getProvider();
        const input: CreateTaskInput = {
          title,
          description: options.description,
          priority: (options.priority as TaskPriority) || 'medium',
          projectId: options.project,
        };

        const task = await provider.createTask(input);

        if (program.opts().json) {
          outputJson(task);
        } else {
          console.log(chalk.green('✓ Task created:'), formatTask(task));
        }
      } catch (error) {
        console.error(
          chalk.red('Error:'),
          error instanceof Error ? error.message : error,
        );
        process.exit(1);
      }
    },
  );

// Complete a task
program
  .command('done <id>')
  .description('Mark a task as done')
  .action(async (id: string) => {
    try {
      const provider = getProvider();
      const task = await provider.updateTask(id, { status: 'done' });

      if (program.opts().json) {
        outputJson(task);
      } else {
        console.log(chalk.green('✓ Task completed:'), formatTask(task));
      }
    } catch (error) {
      console.error(
        chalk.red('Error:'),
        error instanceof Error ? error.message : error,
      );
      process.exit(1);
    }
  });

// Delete a task
program
  .command('delete <id>')
  .alias('rm')
  .description('Delete a task')
  .action(async (id: string) => {
    try {
      const provider = getProvider();
      await provider.deleteTask(id);

      if (program.opts().json) {
        outputJson({ success: true, id });
      } else {
        console.log(chalk.green('✓ Task deleted'));
      }
    } catch (error) {
      console.error(
        chalk.red('Error:'),
        error instanceof Error ? error.message : error,
      );
      process.exit(1);
    }
  });

// List projects
program
  .command('projects')
  .description('List all projects')
  .action(async () => {
    try {
      const provider = getProvider();

      if (!provider.listProjects) {
        console.error(
          chalk.red('Error: This provider does not support projects.'),
        );
        process.exit(1);
      }

      const projects = await provider.listProjects();

      if (program.opts().json) {
        outputJson(projects);
      } else {
        if (projects.length === 0) {
          console.log(chalk.gray('No projects found.'));
        } else {
          console.log(chalk.bold(`\n📁 Projects (${projects.length}):\n`));
          projects.forEach((p) =>
            console.log(`  ${chalk.bold(p.id)} ${p.name}`),
          );
          console.log();
        }
      }
    } catch (error) {
      console.error(
        chalk.red('Error:'),
        error instanceof Error ? error.message : error,
      );
      process.exit(1);
    }
  });

program.parse();
