# AgentOS

Open-source AI mission control. Run prompts against multiple LLM providers, compare outputs side-by-side, track costs, and manage your entire AI stack from one dashboard.

## Demo

<p align="center">
  <video src="assets/demo.mp4" controls width="100%">
    Your browser does not support the video tag.
  </video>
  <br>
  <em>Side-by-side model comparison with real-time streaming, token counting, and cost tracking</em>
</p>

## What is AgentOS?

AgentOS is a self-hosted, multi-tenant AI operations platform. Instead of juggling multiple provider dashboards, API keys, and cost reports, AgentOS unifies everything into one interface.

| Problem | Solution |
|---------|----------|
| Multiple provider consoles | One dashboard for OpenAI, Anthropic, Gemini, NVIDIA NIM, OpenRouter |
| No visibility into costs | Real-time cost tracking per run, agent, model, provider |
| Prompt iteration is slow | Side-by-side comparison across 5 models simultaneously |
| API keys scattered in .env files | Encrypted credential vault (AES-256-GCM) with per-workspace isolation |
| No audit trail | Complete activity logs for every run, invite, and provider change |

**Who is it for:** AI Engineers, Product Teams, Platform Teams, Researchers.

## Features

- **Agent Builder** — Reusable agents with system prompts, model defaults, temperature, tools
- **Streaming Chat** — Real-time token streaming with markdown, code highlighting, copy, retry
- **Multi-Provider** — OpenAI, Anthropic, Gemini, NVIDIA NIM, OpenRouter with unified adapter
- **Mission Control** — Cost trends, run breakdowns, provider health, usage analytics
- **Chat History** — Persistent conversations with search, sort, pin, archive, export/import
- **Workflows** — Schema and data model for multi-step orchestration (visual builder in Phase 2)
- **Usage Tracking** — Per-run tokens, costs, daily trends, per-model/provider breakdowns
- **Encrypted Credentials** — AES-256-GCM at rest, per-workspace keys, never logged
- **Docker Ready** — Multi-stage build, non-root, health checks, standalone output
- **Self-Hosted** — MIT licensed, runs anywhere PostgreSQL and Redis exist

## Getting Started

### Prerequisites

- Node.js 18+ (20 LTS recommended)
- PostgreSQL 14+ (or Docker)
- Redis 7+ (for BullMQ in Phase 2)

### 1. Clone and Install

```bash
git clone https://github.com/your-org/agentos.git
cd agentos
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your values:

```env
DATABASE_URL="postgresql://user:pass@localhost:5432/agentos?schema=public"
NEXTAUTH_SECRET="openssl rand -base64 32"
NEXTAUTH_URL="http://localhost:3000"
ENCRYPTION_KEY="openssl rand -base64 32"
```

### 3. Database Setup

```bash
npm run db:generate
npm run db:push
npm run db:seed
```

### 4. Run

```bash
npm run dev
# http://localhost:3000
```

### 5. First Time

1. Register at `/register`
2. Go to Settings > Providers > Connect your first API key
3. Create an Agent or start a Chat

## Docker

```bash
# Build and run everything
docker compose up -d

# Or with dev hot reload
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d
```

Services: PostgreSQL (5432), Redis (6379), App (3000), Worker.

## Architecture

```
app/                          Next.js App Router
  (auth)/                     Login, register
  (dashboard)/w/[workspaceId] Workspace pages
    agents/                   Agent CRUD
    chats/                    Chat + history
    runs/                     Run history
    usage/                    Analytics
    settings/                 Profile, members, providers, keys, webhooks
    workflows/                Workflow builder
  api/                        API routes
    auth/                     NextAuth + register
    chat/                     Single + compare streaming
    workspaces/[id]/          Workspace-scoped APIs
      conversations/          Chat history (CRUD, duplicate, export, import, messages)
      agents/                 Agent management
      providers/              Provider management
      members/                Team management
      models/                 Model catalog
      runs/                   Run history
components/                   UI components
  agents/                     Agent form, delete
  chat/                       ChatRunner, ChatLayout, ConversationSidebar
  common/                     WorkspaceSwitcher, ComingSoon
  dashboard/                  Sidebar, TopBar, StatCard
  runs/                       RunsToolbar, RetryButton
  settings/                   Profile, Members, Providers
  ui/                         shadcn/ui components
  usage/                      CostTrendChart
features/                     Business logic
  agents/runner.ts            Core streaming execution engine
  auth/                       NextAuth config (edge + server)
  audit/logger.ts             Activity logging
  providers/queries.ts        Provider catalog queries
lib/                          Shared utilities
  ai/cost.ts                  Token cost calculator
  db/prisma.ts                Prisma singleton
  permissions/                RBAC guards and roles
  providers/                  Adapters, registry, encryption, types
  security/                   Rate limiting, error sanitization
  utils/                      cn(), formatters, slugify
prisma/
  schema.prisma               Data model (25 models)
  seed.ts                     Provider catalog seed
```

## Supported Providers

| Provider | Streaming | Vision | Tools | JSON Mode |
|----------|:---------:|:------:|:-----:|:---------:|
| OpenAI | Yes | Yes (GPT-4o) | Yes | Yes |
| Anthropic | Yes | Yes (Claude 3.5) | Yes | Yes |
| Google Gemini | Yes | Yes (1.5 Pro) | Yes | Yes |
| NVIDIA NIM | Yes | No | No | No |
| OpenRouter | Yes | Yes (varies) | Yes | Yes |

Adding a new provider: create `lib/providers/adapters/your-provider.ts`, register in `lib/providers/registry.ts`.

## API

### Authentication

All workspace routes require a valid NextAuth session.

### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/chat | Single-model streaming |
| POST | /api/chat/compare | Multi-model comparison |
| GET/POST | /api/workspaces/[id]/conversations | List/create conversations |
| GET/PATCH/DELETE | /api/workspaces/[id]/conversations/[id] | Conversation CRUD |
| POST | /api/workspaces/[id]/conversations/[id]/duplicate | Deep copy |
| GET | /api/workspaces/[id]/conversations/[id]/export | Export as MD/JSON |
| POST | /api/workspaces/[id]/conversations/import | Import from JSON |
| GET/POST | /api/workspaces/[id]/conversations/[id]/messages | Message history |
| GET | /api/workspaces/[id]/providers | List providers |
| POST | /api/workspaces/[id]/providers | Connect provider |
| DELETE | /api/workspaces/[id]/providers | Remove provider |
| GET | /api/workspaces/[id]/models | Model list |
| GET/POST | /api/workspaces/[id]/agents | Agent CRUD |
| PATCH/DELETE | /api/workspaces/[id]/agents/[id] | Update/archive agent |
| GET | /api/workspaces/[id]/runs | List runs |
| POST | /api/workspaces/[id]/runs/[id]/retry | Re-run failed |
| GET/POST | /api/workspaces/[id]/members | List/invite members |

### SSE Format

```
data: {"type":"token","content":"Hello"}
data: {"type":"done","usage":{"promptTokens":10,"completionTokens":5,"totalTokens":15}}
data: [DONE]
```

## Chat History

- Conversations saved automatically to database
- Sidebar with search, sort, pin, archive, delete
- Full-text search across titles and messages
- Export as Markdown or JSON, import from JSON
- Keyboard shortcuts: Ctrl+K toggle sidebar, Ctrl+Shift+O open history

## Environment Variables

| Variable | Required | Description |
|----------|:--------:|-------------|
| DATABASE_URL | Yes | PostgreSQL connection string |
| NEXTAUTH_SECRET | Yes | `openssl rand -base64 32` |
| NEXTAUTH_URL | Yes | e.g. http://localhost:3000 |
| ENCRYPTION_KEY | Yes | `openssl rand -base64 32` for AES-256-GCM |
| GITHUB_ID | Optional | GitHub OAuth client ID |
| GITHUB_SECRET | Optional | GitHub OAuth secret |
| GOOGLE_CLIENT_ID | Optional | Google OAuth client ID |
| GOOGLE_CLIENT_SECRET | Optional | Google OAuth secret |
| RATE_LIMIT_AUTH_MAX | Optional | Auth attempts per window (default: 5) |
| RATE_LIMIT_API_MAX | Optional | API requests per window (default: 60) |
| RATE_LIMIT_CHAT_MAX | Optional | Chat requests per window (default: 30) |

Never commit `.env`. Use `.env.example` as template.

## Roadmap

- **v0.2** — Workflow execution engine
- **v0.3** — Memory and RAG
- **v0.4** — Multi-agent collaboration
- **v0.5** — Marketplace and extensibility
- **v0.6** — Enterprise features (SSO, SCIM, audit export)
- **v0.7** — Voice and multimodal

## Contributing

```bash
git clone https://github.com/your-username/agentos.git
cd agentos
npm install
npm run lint
npm run build
```

We welcome contributions. See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## FAQ

**Can I run without Docker?** Yes. Install Node.js 18+, PostgreSQL, Redis locally and run `npm run dev`.

**Does it phone home?** No. Zero telemetry, no external calls except to your configured LLM providers.

**Can I use my own OpenAI-compatible endpoint?** Yes. Enter your custom base URL in Settings > Providers. Works with Ollama, LocalAI, vLLM, TGI.

**How are API keys stored?** AES-256-GCM encrypted at rest. Never logged.

## License

MIT License. See [LICENSE](LICENSE).
