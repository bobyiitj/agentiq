<p align="center">
  <img alt="AgentOS" src="assets/logo.svg" width="320">
</p>

<p align="center">
  <strong>Open-source AI mission control.</strong> Run prompts against multiple LLM providers, compare outputs side-by-side, track costs, and manage your entire AI stack from one dashboard.
</p>

<p align="center">
  <a href="#getting-started"><img src="https://img.shields.io/badge/Get%20Started-000?style=for-the-badge&logo=rocket&logoColor=white" alt="Get Started"></a>
  <a href="#docker"><img src="https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white" alt="Docker"></a>
  <a href="https://github.com/your-org/agentos/releases"><img src="https://img.shields.io/badge/Release-v0.1.0-000?style=for-the-badge&logo=github&logoColor=white" alt="Release"></a>
  <a href="https://github.com/your-org/agentos/issues/new"><img src="https://img.shields.io/badge/Report%20Issue-000?style=for-the-badge&logo=github&logoColor=white" alt="Report Issue"></a>
</p>

<p align="center">
  <a href="https://github.com/your-org/agentos/stargazers"><img src="https://img.shields.io/github/stars/your-org/agentos?style=flat&color=ffcb47&logo=star" alt="Stars"></a>
  <a href="https://github.com/your-org/agentos/network/members"><img src="https://img.shields.io/github/forks/your-org/agentos?style=flat&color=8ae8a5&logo=fork" alt="Forks"></a>
  <a href="https://github.com/your-org/agentos/issues"><img src="https://img.shields.io/github/issues/your-org/agentos?style=flat&color=ff6b6b&logo=issue" alt="Issues"></a>
  <a href="https://github.com/your-org/agentos/blob/main/LICENSE"><img src="https://img.shields.io/github/license/your-org/agentos?style=flat&color=00d4aa&logo=license" alt="License"></a>
</p>

---

## Demo

<p align="center">
  <video src="assets/demo.mp4" controls width="100%">
    Your browser does not support the video tag.
  </video>
  <br>
  <em>Side-by-side model comparison with real-time streaming, token counting, and cost tracking</em>
</p>

---

## Table of Contents

- [What is AgentOS?](#what-is-agentos)
- [Core Features](#core-features)
- [Architecture](#architecture)
- [Supported Providers](#supported-providers)
- [Mission Control Dashboard](#mission-control-dashboard)
- [Agent Builder](#agent-builder)
- [Chat Interface](#chat-interface)
- [Workflows](#workflows)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Docker](#docker)
- [Project Structure](#project-structure)
- [API Overview](#api-overview)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [FAQ](#faq)
- [License](#license)

---

## What is AgentOS?

**AgentOS** is a self-hosted, multi-tenant AI operations platform that gives you complete control over your LLM workflows. Instead of juggling multiple provider dashboards, API keys, and cost reports, AgentOS unifies everything into a single interface.

### Why AgentOS?

| Problem | AgentOS Solution |
|---------|------------------|
| Multiple provider consoles | **One dashboard** for OpenAI, Anthropic, Gemini, NVIDIA NIM, OpenRouter |
| No visibility into costs | **Real-time cost tracking** per run, agent, model, provider, workspace |
| Prompt iteration is slow | **Side-by-side comparison** — run the same prompt across 5 models simultaneously |
| API keys scattered in `.env` files | **Encrypted credential vault** (AES-256-GCM) with per-workspace isolation |
| No audit trail | **Complete activity logs** — every run, invite, provider change recorded |
| Vendor lock-in | **Self-hosted, open-source (MIT)** — your data, your infrastructure |

### Who is it for?

- **AI Engineers** — iterate on prompts across models, track token costs, debug failures
- **Product Teams** — compare model outputs before committing to a provider
- **Platform Teams** — centrally manage API keys, enforce quotas, audit usage
- **Researchers** — reproducible runs with full input/output/cost history

---

## Core Features

<div align="center">

| Feature | Description |
|---------|-------------|
| **Agent Builder** | Reusable agents with system prompts, model defaults, temperature, and status (Active/Archived/Draft) |
| **Streaming Chat** | Real-time token streaming with markdown, code highlighting, copy, retry, stop generation |
| **Multi-Provider** | OpenAI, Anthropic, Gemini, NVIDIA NIM, OpenRouter — unified adapter interface |
| **Mission Control** | Cost trends, run breakdowns, provider health, usage analytics |
| **Model Comparison** | Side-by-side streaming across 2–5 models with interleaved tokens and per-model cost |
| **Chat History** | Persistent conversations with search, sort, pin, archive, export/import, duplicate |
| **Usage Tracking** | Per-run tokens, costs, daily trends, per-model/provider breakdowns, 30-day analytics |
| **Audit Logs** | Append-only record of security-relevant actions (runs, invites, provider changes) |
| **Encrypted Credentials** | AES-256-GCM at rest, per-workspace keys, never logged |
| **RBAC** | Owner / Admin / Member / Viewer roles with resource-level permission matrix |
| **Rate Limiting** | In-memory sliding window (auth: 5/15min, API: 60/min, chat: 30/min) |
| **Docker Ready** | Multi-stage build, non-root, health checks, standalone output |
| **Self-Hosted** | MIT licensed, runs anywhere PostgreSQL exists |

</div>

---

## Architecture

```mermaid
graph TB
    subgraph Client["Next.js 14 App Router (React 18)"]
        UI["UI Components\nshadcn/ui + Tailwind"]
        Chat["Chat Runner\nSSE Streaming"]
        Dash["Dashboard\nRecharts"]
    end

    subgraph Auth["NextAuth v5"]
        Cred["Credentials"]
        GitHub["GitHub OAuth"]
        Google["Google OAuth"]
        Middleware["Middleware\nRate Limiting"]
    end

    subgraph API["API Routes (Node.js Runtime)"]
        ChatAPI["POST /api/chat\nSingle Model"]
        CompareAPI["POST /api/chat/compare\nMulti-Model"]
        AgentsAPI["CRUD /api/agents"]
        ProvidersAPI["CRUD /api/providers"]
        RunsAPI["Runs / Retry"]
        WorkspacesAPI["Workspaces / Members"]
    end

    subgraph Core["Core Services"]
        Runner["Agent Runner\nstreamAgentRun"]
        Registry["Provider Registry\n5 Adapters"]
        Crypto["Encryption\nAES-256-GCM"]
        Cost["Cost Calculator"]
        Audit["Audit Logger"]
    end

    subgraph Data["Data Layer"]
        PG[("PostgreSQL\nPrisma ORM")]
    end

    Chat --> ChatAPI
    Chat --> CompareAPI
    UI --> API
    API --> Core
    Core --> Data
    Auth --> Middleware
    Middleware --> API
```

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| UI | React 18, shadcn/ui, Tailwind CSS, Recharts |
| Auth | NextAuth v5 (Credentials + GitHub + Google) |
| Database | PostgreSQL 16 + Prisma ORM |
| Validation | Zod |
| AI SDKs | OpenAI, Anthropic, Google Generative AI |
| Encryption | Node.js crypto (AES-256-GCM) |
| Language | TypeScript (strict) |

---

## Supported Providers

AgentOS uses a unified `ProviderAdapter` interface. Adding a new provider = one adapter class.

| Provider | Streaming | Vision | Tools | JSON Mode | Models API |
|----------|:---------:|:------:|:-----:|:---------:|:----------:|
| **OpenAI** | Yes | Yes (GPT-4o) | Yes | Yes | Live |
| **Anthropic** | Yes | Yes (Claude 3.5) | Yes | Yes | Live |
| **Google Gemini** | Yes | Yes (Gemini 2.0+) | Yes | Yes | Live |
| **NVIDIA NIM** | Yes | No | No | No | Live |
| **OpenRouter** | Yes | Yes (varies) | Yes | Yes | Live |

### Adding Custom Providers

1. Create `lib/providers/adapters/your-provider.ts` implementing `ProviderAdapter`
2. Register in `lib/providers/registry.ts`
3. Seed in `prisma/seed.ts` (or add via Settings > Providers)

```typescript
// All adapters implement this interface
interface ProviderAdapter {
  readonly name: string;
  chat(req: ChatRequest): Promise<{ content: string; usage: TokenUsage }>;
  chatStream(req: ChatRequest): AsyncGenerator<StreamEvent>;
  listModels(): Promise<ModelInfo[]>;
  validate(): Promise<boolean>;
}
```

---

## Mission Control Dashboard

The dashboard (`/w/[workspaceId]`) is your operational center.

### Overview Page

| Widget | Metrics |
|--------|---------|
| **Cost (24h)** | Spend in last 24 hours |
| **Active Runs** | Currently running / streaming / queued |
| **Failures** | Total failed runs |
| **Total Spend** | All-time cost + token count |
| **Recent Runs** | Last 8 runs with status, model, cost |
| **Providers** | Connected provider accounts with status |
| **Quick Actions** | New agent, new run, new workflow, usage |

### Usage Page

| Section | Description |
|---------|-------------|
| **Summary Cards** | Total spend, total tokens, completed runs, avg cost/run |
| **Cost Trend** | 30-day daily cost chart (Recharts area chart) |
| **By Model** | Token usage and cost per model |
| **By Provider** | Token usage and cost per provider account |

### Audit Logs

Append-only table of security-relevant actions: `chat.message`, `run.completed`, `provider.connected`, `provider.removed`, `member.invited`, `workspace.created`, `agent.created`.

Columns: Time, Action, Resource, Actor, Details (metadata JSON).

---

## Agent Builder

Create reusable agents with full configuration.

| Field | Type | Description |
|-------|------|-------------|
| **Name** | `string` | Display name |
| **Description** | `string?` | What this agent does |
| **System Prompt** | `string` | Full system instruction |
| **Default Provider** | `WorkspaceProviderAccount` | Pre-connected provider |
| **Default Model** | `Model` | Specific model ID |
| **Temperature** | `number (0-2)` | Sampling randomness |
| **Top-P** | `number (0-1)` | Nucleus sampling |
| **Max Tokens** | `number (1-32000)` | Output ceiling |
| **Status** | `ACTIVE / ARCHIVED / DRAFT` | Lifecycle |

### Agent Lifecycle

```
DRAFT --> ACTIVE --> ARCHIVED
```

- Every edit increments the `version` integer
- Runs always reference the agent at trigger time
- Archived agents are hidden from active lists but historical runs remain

---

## Chat Interface

### Single Model Mode

- Streaming tokens via Server-Sent Events (SSE)
- Markdown rendering with code block syntax highlighting
- Copy button per message
- Stop generation (abort controller)
- Retry failed messages
- Conversation persistence linked to agents or standalone

### Compare Mode

Select 2-5 (provider, model) pairs and run the same prompt against all of them:

- Shared prompt fans out to all targets
- Interleaved streaming — tokens arrive tagged by model
- Collapsible sections per model with cost/token badges
- Independent retry per model failure

### Chat History

| Feature | Description |
|---------|-------------|
| **Search** | Full-text across titles and message content |
| **Sort** | Updated, newest, oldest, alphabetical |
| **Filter** | By agent, provider, model, tag, archived/pinned |
| **Pin/Archive** | Organize conversations |
| **Export** | JSON or Markdown download |
| **Import** | Import from JSON (version 1 format) |
| **Duplicate** | Deep copy a conversation with all messages |

---

## Workflows

> **Status:** Schema and data model complete. Visual builder and execution engine planned for Phase 2.

### Step Types

| Type | Description |
|------|-------------|
| **AGENT** | Invoke an agent with prompt + context |
| **TOOL** | Run a tool (web search, HTTP, webhook, DB, custom) |
| **TRANSFORM** | Map/filter/reduce JSON between steps |
| **APPROVAL** | Human-in-the-loop gate |
| **CONDITION** | Branch on expression result |
| **DELAY** | Wait N ms before next step |

### Database Schema

- `Workflow` — definition (JSON), trigger config, status, version
- `WorkflowStep` — typed steps with config JSON, canvas position (x,y), order
- `WorkflowRun` — execution instance with status and trigger data
- `WorkflowRunStep` — per-step status, input/output, duration, retry count

---

## Getting Started

### Prerequisites

- **Node.js 18+** (20 LTS recommended)
- **PostgreSQL 14+** (or use Docker)

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
npm run db:generate    # Generate Prisma client
npm run db:push        # Push schema to dev database
npm run db:seed        # Seed provider catalog
```

### 4. Run Development Server

```bash
npm run dev
# http://localhost:3000
```

### 5. First Time

1. Register at `/register`
2. Go to **Settings > Providers** > Connect your first API key
3. Create an **Agent** or start a **Chat**

---

## Environment Variables

| Variable | Required | Description |
|----------|:--------:|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `NEXTAUTH_SECRET` | Yes | `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Yes | Canonical URL (e.g. `http://localhost:3000`) |
| `ENCRYPTION_KEY` | Yes | `openssl rand -base64 32` for AES-256-GCM |
| `GITHUB_ID` | Optional | GitHub OAuth client ID |
| `GITHUB_SECRET` | Optional | GitHub OAuth secret |
| `GOOGLE_CLIENT_ID` | Optional | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Optional | Google OAuth secret |
| `RATE_LIMIT_AUTH_MAX` | Optional | Auth attempts per window (default: 5) |
| `RATE_LIMIT_AUTH_WINDOW_MS` | Optional | Auth window ms (default: 900000) |
| `RATE_LIMIT_API_MAX` | Optional | API requests per window (default: 60) |
| `RATE_LIMIT_API_WINDOW_MS` | Optional | API window ms (default: 60000) |
| `RATE_LIMIT_CHAT_MAX` | Optional | Chat requests per window (default: 30) |
| `RATE_LIMIT_CHAT_WINDOW_MS` | Optional | Chat window ms (default: 60000) |

> Never commit `.env` — it's in `.gitignore`. Use `.env.example` as template.

---

## Docker

### Quick Start

```bash
# Build and run everything
docker compose up -d

# Or with dev hot reload
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d
```

### Services

| Service | Image | Port | Health Check |
|---------|-------|------|--------------|
| `postgres` | `postgres:16-alpine` | 5432 | `pg_isready` |
| `redis` | `redis:7-alpine` | 6379 | `redis-cli ping` |
| `app` | Multi-stage build | 3000 | `GET /api/health` |
| `worker` | Same image | - | - |

### Dockerfile Highlights

- Multi-stage build: deps -> builder -> runner
- Standalone output (`next.config.mjs`)
- Non-root user (`nextjs:1001`)
- tini for proper signal handling
- Health check on `/api/health`

---

## Project Structure

```
agentos/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # Login, register
│   ├── (dashboard)/              # Protected routes
│   │   └── w/[workspaceId]/      # Workspace-scoped pages
│   │       ├── agents/           # Agent CRUD
│   │       ├── chats/            # Chat interface
│   │       ├── runs/             # Run history + detail
│   │       ├── usage/            # Cost analytics
│   │       ├── logs/             # Audit logs
│   │       ├── settings/         # Profile, members, providers
│   │       ├── workflows/        # Workflow builder (Phase 2)
│   │       └── page.tsx          # Overview dashboard
│   └── api/                      # API Routes
│       ├── auth/                 # NextAuth + register
│       ├── chat/                 # Single + compare streaming
│       ├── health/               # Health check
│       └── workspaces/           # Workspace CRUD + nested resources
├── components/
│   ├── agents/                   # Agent form, delete button
│   ├── chat/                     # ChatRunner, ModelPicker, ConversationSidebar
│   ├── common/                   # WorkspaceSwitcher, ComingSoon
│   ├── dashboard/                # Sidebar, TopBar, StatCard
│   ├── runs/                     # RunsToolbar, RetryButton
│   ├── settings/                 # Profile, Members, Providers
│   ├── ui/                       # shadcn/ui components
│   └── usage/                    # CostTrendChart
├── features/
│   ├── agents/runner.ts          # Core streaming execution engine
│   ├── auth/                     # NextAuth config (edge + server)
│   ├── audit/logger.ts           # Activity logging
│   └── providers/queries.ts      # Provider catalog queries
├── lib/
│   ├── ai/cost.ts                # Token cost calculator
│   ├── db/prisma.ts              # Prisma singleton
│   ├── permissions/              # RBAC (guards.ts, rbac.ts)
│   ├── providers/                # Adapters, registry, encryption, types
│   ├── queue/worker.ts           # BullMQ worker (Phase 2 placeholder)
│   ├── security/                 # Rate limiting, error sanitization
│   ├── utils/index.ts            # cn(), formatters, slugify
│   └── workspace-context.ts      # Active workspace resolver
├── middleware.ts                 # Auth + rate limiting
├── prisma/
│   ├── schema.prisma             # Data model (25 models)
│   └── seed.ts                   # Provider catalog seed
├── docker-compose.yml            # Production stack
├── docker-compose.dev.yml        # Dev override
├── Dockerfile                    # Multi-stage build
└── .env.example                  # Environment template
```

---

## API Overview

### Authentication

All workspace routes require a valid NextAuth session (cookie-based).

### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/chat` | Single-model streaming chat |
| `POST` | `/api/chat/compare` | Multi-model comparison streaming |
| `GET` | `/api/workspaces` | User's workspaces |
| `POST` | `/api/workspaces` | Create workspace |
| `GET/POST` | `/api/workspaces/[id]/providers` | List / connect providers |
| `DELETE` | `/api/workspaces/[id]/providers` | Remove provider |
| `GET` | `/api/workspaces/[id]/models` | Resolved model list |
| `GET/POST` | `/api/workspaces/[id]/agents` | Agent CRUD |
| `PATCH/DELETE` | `/api/workspaces/[id]/agents/[id]` | Update / archive agent |
| `GET` | `/api/workspaces/[id]/runs` | List runs |
| `GET` | `/api/workspaces/[id]/runs/[id]` | Run detail |
| `POST` | `/api/workspaces/[id]/runs/[id]/retry` | Re-run failed |
| `GET/POST` | `/api/workspaces/[id]/members` | List / invite members |
| `GET/POST` | `/api/workspaces/[id]/conversations` | List / create conversations |
| `GET/PATCH/DELETE` | `/api/workspaces/[id]/conversations/[id]` | Conversation CRUD |
| `POST` | `/api/workspaces/[id]/conversations/[id]/duplicate` | Deep copy |
| `GET` | `/api/workspaces/[id]/conversations/[id]/export` | Export JSON / Markdown |
| `POST` | `/api/workspaces/[id]/conversations/import` | Import from JSON |
| `GET/POST` | `/api/workspaces/[id]/conversations/[id]/messages` | Message history |

### SSE Streaming Format

```
data: {"type":"token","content":"Hello"}

data: {"type":"token","content":" world"}

data: {"type":"done","usage":{"promptTokens":10,"completionTokens":5,"totalTokens":15}}

data: [DONE]
```

### Error Response

```json
{ "error": "API key validation failed - check your key and try again." }
```

---

## Roadmap

<details>
<summary><strong>v0.2 - Workflow Execution Engine</strong></summary>

- [ ] Workflow DAG executor (topological sort)
- [ ] Step-level retries and timeouts
- [ ] Human approval UI (in-app)
- [ ] Conditional branching evaluation
- [ ] Visual canvas builder
</details>

<details>
<summary><strong>v0.3 - Memory and RAG</strong></summary>

- [ ] Vector store integration (pgvector)
- [ ] Document ingestion (PDF, MD, TXT, URL)
- [ ] Semantic search in chat context
- [ ] Agent memory (conversation summarization)
</details>

<details>
<summary><strong>v0.4 - Multi-Agent Collaboration</strong></summary>

- [ ] Agent-to-agent handoff
- [ ] Shared scratchpad / memory
- [ ] Debate / consensus patterns
</details>

<details>
<summary><strong>v0.5 - Marketplace and Extensibility</strong></summary>

- [ ] Agent / Workflow / Tool registry
- [ ] Plugin SDK (TypeScript)
- [ ] Community sharing (import/export JSON)
- [ ] Versioned templates
</details>

<details>
<summary><strong>v0.6 - Enterprise Features</strong></summary>

- [ ] SSO (SAML / OIDC)
- [ ] SCIM provisioning
- [ ] Audit log export (SIEM)
- [ ] Cost budgets and alerts
</details>

---

## Contributing

We welcome contributions!

```bash
# Fork and clone
git clone https://github.com/your-username/agentos.git

# Create feature branch
git checkout -b feat/amazing-feature

# Install and verify
npm install
npm run lint
npm run typecheck
npm run build

# Commit with conventional commits
git commit -m "feat: add amazing feature"

# Push and open PR
git push origin feat/amazing-feature
```

### Code Standards

- **TypeScript strict mode** — no `any`, no implicit returns
- **ESLint** — enforced via `npm run lint`
- **Conventional Commits** — `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`
- **Validate with Zod** — all API inputs validated

### Areas We Need Help

- Unit / integration tests
- Accessibility improvements
- Documentation and examples
- New provider adapters
- UI/UX polish

---

## FAQ

<details>
<summary><strong>Can I run without Docker?</strong></summary>

Yes. Install Node.js 18+, PostgreSQL locally and run `npm run dev`.
</details>

<details>
<summary><strong>Does it phone home?</strong></summary>

No. Zero telemetry, no external calls except to your configured LLM providers.
</details>

<details>
<summary><strong>Can I use my own OpenAI-compatible endpoint?</strong></summary>

Yes. In Settings > Providers > Connect Provider, enter your custom base URL. Works with Ollama, LocalAI, vLLM, TGI, etc.
</details>

<details>
<summary><strong>How are API keys stored?</strong></summary>

AES-256-GCM encrypted at rest. The `ENCRYPTION_KEY` (32-byte base64) is required at startup. Keys are never logged.
</details>

<details>
<summary><strong>What's the difference between "Agent" and "Workflow"?</strong></summary>

An **Agent** is a reusable prompt + model config. A **Workflow** is a directed graph of steps (agents, tools, conditions) for complex multi-step automation. Workflows are coming in v0.2.
</details>

<details>
<summary><strong>How does cost tracking work?</strong></summary>

Each run records `promptTokens` and `completionTokens`, then uses the model's `inputCostPer1k` / `outputCostPer1k` to compute `estimatedCost`. Aggregated in the Usage dashboard.
</details>

---

## License

**MIT License** — free for personal and commercial use.

```
MIT License

Copyright (c) 2024 AgentOS Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

<p align="center">
  Built with care by the AgentOS community.<br>
  <strong>Star the repo</strong> if you find it useful — it helps more developers discover the project.
</p>

<p align="center">
  <sub>AgentOS v0.1.0 - MIT License</sub>
</p>
