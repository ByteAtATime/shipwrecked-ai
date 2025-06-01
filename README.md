# shipwrecked-ai

A Bun monorepo for the Shipwrecked AI Slack bot and web interface.

## Installation

To install dependencies:

```bash
bun install
```

## Development

### Bot

To run the bot in development:

```bash
bun dev
```

To run in production:

```bash
bun start
```

### Web UI

To run the web UI in development:

```bash
bun web:dev
```

To build the web UI for production:

```bash
bun web:build
```

To preview the production build:

```bash
bun web:preview
```

To run TypeScript checks on the web UI:

```bash
bun web:check
```

## Database

To generate Drizzle migrations:

```bash
bun db:generate
```

To run migrations:

```bash
bun db:migrate
```

To open Drizzle Studio:

```bash
bun db:studio
```

## Architecture

- **packages/bot/** - The main Slack bot application
- **packages/web/** - SvelteKit web interface with TypeScript and Tailwind CSS
- **docker-compose.yml** - PostgreSQL with pgvector extension

This project was created using `bun init` and converted to a monorepo using [Bun workspaces](https://bun.sh/guides/install/workspaces).
