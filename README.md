# shipwrecked-ai

A Bun monorepo for the Shipwrecked AI Slack bot and web interface with API-first architecture.

## Architecture

- **packages/bot/** - Slack bot that makes HTTP requests to the web API
- **packages/web/** - SvelteKit app with API endpoints and web interface
- **docker-compose.yml** - PostgreSQL with pgvector extension

## Installation

To install dependencies:

```bash
bun install
```

## Development

### Web Backend (Start First)

The web backend serves the API that the bot consumes, so start it first:

```bash
bun web:dev
```

This will start the SvelteKit development server on `http://localhost:5173` with API endpoints.

### Slack Bot

To run the bot in development (make sure web backend is running):

```bash
bun dev
```

To run in production:

```bash
bun start
```

### Web UI

The web interface is available at `http://localhost:5173` when running `bun web:dev`.

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

The web package owns the database. All database operations go through the web API.

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

## API Endpoints

The web backend exposes these API endpoints that the bot uses:

- `POST /api/embeddings` - Generate text embeddings
- `POST /api/ai/parse-qas` - Parse Q&A pairs from Slack threads
- `POST /api/citations` - Create citations
- `GET /api/citations?ids=...` - Get citations by IDs
- `POST /api/questions` - Create questions
- `GET /api/questions?embedding=...&limit=3` - Search similar questions

## Environment Variables

### Bot Package

- `SLACK_TOKEN` - Slack bot token
- `SLACK_SIGNING_SECRET` - Slack signing secret
- `SLACK_APP_TOKEN` - Slack app token
- `API_BASE_URL` - Base URL for web API (default: http://localhost:5174)

### Web Package

- `DATABASE_URL` - PostgreSQL connection URL
- `GEMINI_API_KEY` - Google Gemini API key for embeddings

This project was created using `bun init` and converted to a monorepo using [Bun workspaces](https://bun.sh/guides/install/workspaces).
