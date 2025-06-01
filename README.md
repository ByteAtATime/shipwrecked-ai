# shipwrecked-ai

A Bun monorepo for the Shipwrecked AI Slack bot.

## Installation

To install dependencies:

```bash
bun install
```

## Development

To run the bot in development:

```bash
bun dev
```

To run in production:

```bash
bun start
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
- **docker-compose.yml** - PostgreSQL with pgvector extension

This project was created using `bun init` and converted to a monorepo using [Bun workspaces](https://bun.sh/guides/install/workspaces).
