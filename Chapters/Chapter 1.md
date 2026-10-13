# Chapter 1 — Environment Setup

Now that we have mastered the theoretical foundations of OAuth2, OIDC, flows, and JWTs in Chapter 0, it's time to build our actual laboratory environment.

By the end of this chapter, we will have:
1. A **Bun monorepo** prepared for our apps and shared authentication libraries.
2. Local domain routing via **`*.local.dev`** resolving to `127.0.0.1`.
3. Valid **wildcard TLS certificates** trusted by your browser so our OAuth redirects happen cleanly over `https://`.
4. A production-grade **Docker Compose stack** running **Authentik** (Server & Worker), **PostgreSQL**, **Redis**, and **Traefik v3**.
5. The Authentik admin console accessible at `https://auth.local.dev`.

---

## 1.1 — Initialize Bun Workspace (Monorepo)

### Why a Monorepo for an SSO Lab?

When working with Single Sign-On (SSO), you rarely build a single isolated application. In real-world enterprise architectures, you have:
- **Multiple consumer apps**: e.g., a server-rendered web portal (`apps/portal`), a single-page React dashboard (`apps/dashboard`), and backend APIs (`apps/api`).
- **Shared identity infrastructure**: e.g., OIDC client configuration, session management helpers, token validation middleware, and common UI navigation bars.

If every app lived in a separate repository, you would have to publish shared auth code to a private npm registry or copy-paste authentication middleware across repositories. 

Using **Bun workspaces**, our repository is organized into:
- **`packages/`**: Shared libraries linked automatically by Bun without publishing.
  - `packages/auth`: Common OIDC client helpers, token validation, session guards.
  - `packages/ui`: Shared UI components (header with user profile, login/logout buttons).
- **`apps/`**: The distinct applications consuming the identity provider:
  - `apps/portal`: Server-rendered Hono app (Auth Code flow).
  - `apps/dashboard`: React SPA (PKCE flow).
  - `apps/api`: REST API (Client Credentials & JWT bearer validation).
- **`docker/`**: The infrastructure layer hosting Authentik and Traefik.

---

### Workspace Configuration

#### 1. Root `package.json`

The root `package.json` defines the workspace globs:

```json
{
  "name": "authentik-lab",
  "version": "1.0.0",
  "private": true,
  "workspaces": [
    "packages/*",
    "apps/*"
  ],
  "scripts": {
    "dev:portal": "bun --filter portal dev",
    "dev:dashboard": "bun --filter dashboard dev",
    "dev:api": "bun --filter api dev"
  },
  "devDependencies": {
    "@types/bun": "latest",
    "typescript": "^5.0.0"
  }
}
```

- `"private": true` prevents accidental publication of the root workspace to npm.
- `"workspaces": ["packages/*", "apps/*"]` instructs Bun to scan subdirectories for nested packages and symlink them together into `node_modules`.
- `"scripts"` allows filtering commands directly to target apps via `bun --filter <package-name> <script>`.

---

#### 2. Root `tsconfig.json`

Our TypeScript configuration sets up modern module resolution and path aliases:

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "types": ["bun-types"],
    "strict": true,
    "skipLibCheck": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "jsxImportSource": "hono/jsx",
    "baseUrl": ".",
    "paths": {
      "@authentik-lab/auth": ["packages/auth/src/index.ts"],
      "@authentik-lab/ui": ["packages/ui/src/index.ts"]
    }
  }
}
```

- `"moduleResolution": "bundler"`: Best-in-class resolution for modern TS/Bun projects.
- `"paths"`: Maps `@authentik-lab/auth` and `@authentik-lab/ui` directly to source files so code navigation and autocompletion work instantly across packages.

---

#### 3. Verification

We ran `bun install`, creating `bun.lock` and resolving root TypeScript definitions:

```bash
bun install
```

---

> **Key takeaway**: Bun workspaces let us build and test multiple auth patterns (SSR, SPA, API) in one coordinated environment, sharing our custom `@authentik-lab/auth` package seamlessly.

---


---

## 1.2 — Set Up Local Domains (`*.local.dev`) & `/etc/hosts`

### Why Custom Local Domains Instead of `localhost`?

When building Single Sign-On (SSO) systems, developing solely on `localhost:3000`, `localhost:4000`, and `localhost:9000` creates severe real-world blind spots:

1. **Cookie Scoping & SSO Sessions**:
   - In production, SSO relies on cookie domains (e.g. `Domain=.company.com`). A user logs into `auth.company.com`, and a session cookie can be shared or recognized across `portal.company.com` and `dashboard.company.com`.
   - On `localhost`, browsers do not treat different port numbers as separate security origins for cookies. All ports share the same `localhost` cookie jar, causing cookie overwrites and masking real session bugs.
2. **Strict Redirect URI Matching**:
   - OIDC specification mandates exact string matching for redirect URIs. Testing with clean, domain-based callback URLs (`https://portal.local.dev/auth/callback`) mirrors production configurations 1:1.
3. **Cross-Origin Resource Sharing (CORS)**:
   - Modern SPAs on `https://dashboard.local.dev` calling `https://api.local.dev` encounter real CORS preflight requests (`OPTIONS`), allowing us to test real-world CORS headers and browser security models.

---

### Mapping Domains in `/etc/hosts`

The operating system checks `/etc/hosts` before querying DNS servers. We map five subdomains to our local loopback interface (`127.0.0.1`):

```text
127.0.0.1 auth.local.dev portal.local.dev dashboard.local.dev api.local.dev traefik.local.dev
```

| Domain | Role in Our Lab |
|---|---|
| `auth.local.dev` | Authentik Identity Provider (Admin UI & OIDC endpoints) |
| `portal.local.dev` | SSR Web App (`apps/portal` — Authorization Code flow) |
| `dashboard.local.dev` | React Single Page App (`apps/dashboard` — PKCE flow) |
| `api.local.dev` | Resource Server API (`apps/api` — JWT verification) |
| `traefik.local.dev` | Traefik Edge Proxy Dashboard & Metrics |

#### Automated Configuration Script

We created an automated helper script [scripts/setup-hosts.sh](file:///Users/ben3k/workspace.ben3k/_learn_/authentik_lab_flash/scripts/setup-hosts.sh):

```bash
#!/usr/bin/env bash
set -e

DOMAINS="auth.local.dev portal.local.dev dashboard.local.dev api.local.dev traefik.local.dev"
HOSTS_LINE="127.0.0.1 $DOMAINS"

if grep -q "auth.local.dev" /etc/hosts; then
  echo "✅ Local domains already present in /etc/hosts"
else
  echo "Adding local domains to /etc/hosts (requires sudo)..."
  sudo sh -c "echo '$HOSTS_LINE' >> /etc/hosts"
  echo "✅ Added local domains to /etc/hosts"
fi
```

To run it:
```bash
sudo ./scripts/setup-hosts.sh
```

---

## 1.3 — Generate Self-Signed Wildcard TLS Cert with `mkcert`

### Why Local HTTPS is Mandatory for Modern OIDC

In older web development, developers often used plaintext `http://` locally. With modern identity protocols, **HTTPS is mandatory**:
1. **`Secure` and `SameSite` Cookies**: OIDC session cookies and CSRF state cookies are marked `SameSite=None; Secure` or `SameSite=Lax; Secure`. Browsers reject `Secure` cookies sent over unencrypted HTTP.
2. **Web Crypto API**: In Chapter 4, our React SPA generates code verifiers and SHA-256 challenges using `window.crypto.subtle`. Modern browsers only expose `crypto.subtle` inside a **Secure Context** (HTTPS).
3. **No Mixed Content Warnings**: Both the identity provider and the consumer applications run on HTTPS, preventing iframe or redirect failures.

---

### Generating the Certificate

Rather than dealing with manual OpenSSL commands and red browser warning screens ("Your connection is not private"), we use **`mkcert`**. 

`mkcert` creates a local Root Certificate Authority (CA) in your operating system trust store and signs development certificates with it:

```bash
mkdir -p docker/certs
mkcert -cert-file docker/certs/local.dev.pem \
       -key-file docker/certs/local.dev-key.pem \
       "*.local.dev" "local.dev"
```

This generates:
- [local.dev.pem](file:///Users/ben3k/workspace.ben3k/_learn_/authentik_lab_flash/docker/certs/local.dev.pem): The public certificate matching `*.local.dev` and `local.dev`.
- [local.dev-key.pem](file:///Users/ben3k/workspace.ben3k/_learn_/authentik_lab_flash/docker/certs/local.dev-key.pem): The private key.

> [!TIP]
> Run `mkcert -install` in your terminal to ensure macOS Keychain and your browsers automatically trust the root CA with a green padlock.

---

## 1.4 — Docker Compose: Authentik + PostgreSQL + Redis

Authentik is a full-featured identity platform designed as a modular, scalable system.

```
                     ┌─────────────────────────────────────────┐
                     │            DOCKER COMPOSE               │
                     │                                         │
                     │   ┌─────────────────────────────────┐   │
                     │   │         authentik-server        │   │
                     │   │ (HTTP API, OIDC, Web UI, Admin) │   │
                     │   └───┬─────────────────────────┬───┘   │
                     │       │                         │       │
                     │       │ Tasks                   │ SQL   │
                     │       ▼                         ▼       │
                     │   ┌───────────────┐     ┌─────────────┐ │
                     │   │     redis     │     │ postgresql  │ │
                     │   │  (Task Queue  │     │ (Persistent │ │
                     │   │   & Cache)    │     │  Database)  │ │
                     │   └───▲───────────┘     └─────────────┘ │
                     │       │ Tasks                   ▲       │
                     │       │                         │ SQL   │
                     │   ┌───┴─────────────────────────┴───┐   │
                     │   │         authentik-worker        │   │
                     │   │ (Background jobs, sync, email,  │   │
                     │   │  event logging, outpost manage) │   │
                     │   └─────────────────────────────────┘   │
                     └─────────────────────────────────────────┘
```

### Components

1. **`postgresql` (v16)**:
   - Stores all application models: users, groups, providers, applications, stages, policies, flows, and audit logs.
2. **`redis`**:
   - In-memory cache and task broker. Powers Celery background task scheduling and temporary session states.
3. **`server` (`ghcr.io/goauthentik/server:2024.12.3`)**:
   - The user-facing web server running on port `9000` (internal). Exposes the Admin interface, user login flows, OAuth2/OIDC endpoints (`/application/o/authorize/`, `/application/o/token/`), and JWKS endpoints.
4. **`worker`**:
   - Background worker running asynchronous jobs (cleanup, notifications, outpost sync) using Celery.

### Environment & Secrets

Environment variables are isolated in [docker/.env](file:///Users/ben3k/workspace.ben3k/_learn_/authentik_lab_flash/docker/.env):
- `PG_PASS`: Secure database password generated with `openssl rand -base64 32`.
- `AUTHENTIK_SECRET_KEY`: Cryptographic signing key generated with `openssl rand -base64 48`.

---

## 1.5 — Docker Compose: Traefik with Dynamic TLS Termination

Instead of configuring TLS inside Authentik or exposing port `9000` directly, we use **Traefik v3** as our reverse proxy.

```
       Browser Request: https://auth.local.dev
                           │
                           ▼
                  ┌─────────────────┐
                  │   Traefik v3    │ :443 (TLS Termination)
                  │  (Reverse Proxy)│ Uses docker/certs/local.dev.pem
                  └────────┬────────┘
                           │ Plain HTTP (internal docker network)
                           ▼
                  ┌─────────────────┐
                  │ authentik-server│ :9000
                  └─────────────────┘
```

### Why Traefik?

1. **Single Entry Point**: Traefik listens on standard ports `80` (HTTP) and `443` (HTTPS) and automatically redirects all plaintext HTTP traffic to HTTPS.
2. **Docker Label Routing**: Rather than manually editing reverse proxy configs for each container, Traefik detects Docker labels dynamically:
   ```yaml
   labels:
     - "traefik.enable=true"
     - "traefik.http.routers.authentik.rule=Host(`auth.local.dev`)"
     - "traefik.http.routers.authentik.entrypoints=websecure"
     - "traefik.http.routers.authentik.tls=true"
     - "traefik.http.services.authentik.loadbalancer.server.port=9000"
   ```
3. **Dynamic TLS**: Configured in [docker/traefik/dynamic.yml](file:///Users/ben3k/workspace.ben3k/_learn_/authentik_lab_flash/docker/traefik/dynamic.yml) to load our `local.dev.pem` wildcard certificate for any incoming `*.local.dev` request.
4. **Outpost Forward Auth (Chapter 5)**: Traefik integrates natively with Authentik's Forward Auth middleware to protect legacy or third-party web apps without modifying their source code.

---

## 1.6 — Boot Everything & Verify Authentik Admin UI

### Launching the Stack

Start the infrastructure stack from the `docker/` directory:

```bash
cd docker
docker compose up -d
```

### Checking Container Health

Verify that all five containers are running and healthy:

```bash
docker compose ps
```

Expected containers:
- `authentik-postgres` (healthy)
- `authentik-redis` (healthy)
- `authentik-server` (running)
- `authentik-worker` (running)
- `traefik` (running)

---

### Initial Administrator Setup

When Authentik boots for the first time with an empty database:
1. Navigate to: **`https://auth.local.dev/if/flow/initial-setup/`**
2. You will be prompted to set the administrative password for the default user:
   - **Username**: `akadmin`
   - **Password**: *(Choose a secure development password, e.g. `AuthentikLab2024!`)*
3. Once submitted, log into the Authentik management console at **`https://auth.local.dev`**.

---

> **Key takeaway**: We now have a production-mirror local identity infrastructure running over secure TLS with wildcard domain resolution. Every application we create in Chapters 3–7 will connect to this central Authentik instance.

---

> **Next up**: Chapter 2 — Authentik Basics (Admin UI Tour, Tenants, Flows, Stages, Policies, and our first OIDC Provider). Type `c` to proceed.

