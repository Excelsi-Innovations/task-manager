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

## Atlas Provider

```bash
# Configure Atlas
tm config --provider atlas --url http://localhost:3000 --email user@example.com --password yourpassword
tm config --project <atlas-project-uuid>   # Set default project

# Use it
tm projects                  # List Atlas projects
tm list                      # List tickets (todo status)
tm list --all                # All tickets
tm add "New ticket"          # Create ticket
tm done <ticket-uuid>        # Mark as done
```

Or set environment variables instead of saved config:

```env
ATLAS_API_URL=http://localhost:3000
ATLAS_EMAIL=user@example.com
ATLAS_PASSWORD=yourpassword
ATLAS_DEFAULT_PROJECT_ID=<uuid>
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
- [x] Atlas
- [ ] GitHub Projects (coming soon)
- [ ] Linear (coming soon)
