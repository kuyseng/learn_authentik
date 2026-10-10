# AGENTS.md — Authentik Lab Learning Workspace

## Project Overview

This is a **learning workspace** for mastering Authentik SSO integration. It uses a **Bun monorepo (workspace)** to host multiple apps that all authenticate through a shared Authentik identity provider.

The goal is to learn Authentik step-by-step — from fundamentals to advanced patterns — and build reusable auth infrastructure that can scale to any number of in-house or 3rd-party apps.

## Architecture Decisions

| Decision               | Choice                                                        |
| ---------------------- | ------------------------------------------------------------- |
| Runtime                | Bun (latest)                                                  |
| Package Manager        | Bun workspaces                                                |
| Web Framework          | Hono                                                          |
| Frontend (SSR)         | Hono JSX templates (server-side rendered)                     |
| Frontend (SPA)         | React SPA with Hono API backend                               |
| Identity Provider      | Authentik (Docker Compose)                                    |
| Reverse Proxy          | Traefik (for Forward Auth / Outpost)                          |
| Local Networking       | `*.local.dev` domains with self-signed wildcard TLS cert      |
| Code Reuse             | Shared packages (`packages/auth`, `packages/ui`)              |
| Bun Apps               | Run natively on host (not containerized during development)   |

## Workspace Structure (Target)

```
authentik_lab/
├── AGENTS.md                    # This file — context for AI agents
├── PLAN.md                      # Learning plan & progress tracker
├── docker/
│   ├── docker-compose.yml       # Authentik + Traefik + Redis + PostgreSQL
│   ├── traefik/                 # Traefik config & dynamic routing
│   └── certs/                   # Self-signed wildcard TLS certs
├── packages/
│   ├── auth/                    # Shared OIDC client, session, middleware
│   └── ui/                      # Shared UI components (layouts, nav, etc.)
├── apps/
│   ├── portal/                  # SSR app — Hono JSX (Authorization Code flow)
│   ├── dashboard/               # SPA app — React + Hono API (PKCE flow)
│   └── api/                     # API service (Client Credentials / JWT validation)
├── package.json                 # Bun workspace root
├── bunfig.toml                  # Bun configuration
└── tsconfig.json                # Shared TypeScript config
```

## Auth Patterns Covered

1. **Direct OIDC — Authorization Code Flow** (SSR apps)
   - Server-side redirect → Authentik login → callback → session
2. **Direct OIDC — PKCE Flow** (SPA apps)
   - Browser-initiated flow, no client secret, token in memory
3. **Client Credentials Flow** (API-to-API / machine-to-machine)
   - Service accounts, no user interaction
4. **Forward Auth via Traefik + Authentik Outpost**
   - Protect 3rd-party apps that don't support OIDC natively
5. **RBAC via Authentik Groups**
   - Map Authentik groups → app roles, enforce in middleware
6. **User Profile Management**
   - Read/update user profile via Authentik API

## Key Concepts for Agents

- **Learning-first**: Every chapter explains the "why" before the "how". Include OAuth2/OIDC theory since the user is a beginner.
- **Progressive**: Each chapter builds on the previous. Don't skip ahead.
- **Interactive**: User navigates with `c` (continue), `go to <chapter>`, or asks questions mid-chapter.
- **Practical**: Every concept has a working code exercise. No dry theory without code.

## Technology Notes

- **Hono**: Use `hono/bun` adapter. For JSX, use Hono's built-in JSX support.
- **Bun workspaces**: Declare in root `package.json` → `"workspaces": ["packages/*", "apps/*"]`.
- **Authentik**: Version 2024.x+ via official Docker Compose. Accessed at `auth.local.dev`.
- **Traefik**: v3.x, used for TLS termination + Forward Auth middleware.

## Progress Tracking

Current progress is tracked in `PLAN.md`. Update the status emoji:
- ⬜ Not started
- 🔄 In progress
- ✅ Completed
- ⏭️ Skipped
