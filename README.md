# @excelsi/task-manager

Agnostic Task Manager CLI with support for Vikunja, GitHub Projects, and more.

## Installation

```bash
# Install globally
bun add -g @excelsi/task-manager

# Or from GitHub Packages
npm install -g @excelsi/task-manager
```

## Quick Start

```bash
# Configure once (saved to ~/.config/task-manager/config.json)
tm config --provider vikunja --url https://tasks.excelsi.dev --token YOUR_TOKEN --project 5

# That's it! Now use it:
tm list
tm add "My new task"
```

## Usage

```bash
# Configure
tm config --provider vikunja --url <URL> --token <TOKEN>
tm config --project <id>          # Set default project
tm config --show                  # View current config

# List tasks
tm list
tm list --all           # Include completed
tm list --json          # JSON output for AI agents

# Create task
tm add "My new task"
tm add "Urgent task" --priority urgent --description "Do this ASAP"

# Complete task
tm done <task-id>

# Delete task
tm delete <task-id>

# List projects
tm projects
```

## Configuration

Config is saved to `~/.config/task-manager/config.json`. Environment variables take priority over saved config.

| Variable          | Description            |
| ----------------- | ---------------------- |
| `TM_PROVIDER`     | Provider override      |
| `VIKUNJA_API_URL` | Vikunja URL override   |
| `VIKUNJA_TOKEN`   | Vikunja token override |

## AI Agent Integration

Use `--json` flag for structured output:

```bash
tm list --json
tm config --show --json
```

## Supported Providers

- [x] Vikunja
- [ ] GitHub Projects (coming soon)
- [ ] Linear (coming soon)
