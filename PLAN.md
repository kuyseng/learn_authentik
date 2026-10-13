# PLAN.md — Authentik Lab Learning Plan

> **Navigation**: Type `c` to continue to the next section, `go to <chapter.section>` to jump, or ask any question mid-lesson.

---

## Chapter 0 — Foundations: What is OAuth2 / OIDC?

| #   | Section                                     | Status |
| --- | ------------------------------------------- | ------ |
| 0.1 | What problem does SSO solve?                | ✅     |
| 0.2 | OAuth2 explained: Roles, Grants, Tokens     | ✅     |
| 0.3 | OpenID Connect (OIDC) on top of OAuth2      | ✅     |
| 0.4 | Key flows: Authorization Code, PKCE, Client Credentials | ✅ |
| 0.5 | Tokens deep-dive: Access, Refresh, ID Token, JWT | ✅     |

**Goal**: Understand the theory so every later step makes sense.

---

## Chapter 1 — Environment Setup

| #   | Section                                          | Status |
| --- | ------------------------------------------------ | ------ |
| 1.1 | Initialize Bun workspace (monorepo)              | ✅     |
| 1.2 | Set up local domains (`*.local.dev`) & /etc/hosts | ✅     |
| 1.3 | Generate self-signed wildcard TLS cert            | ✅     |
| 1.4 | Docker Compose: Authentik + PostgreSQL + Redis    | ✅     |
| 1.5 | Docker Compose: Traefik with TLS                  | ✅     |
| 1.6 | Boot everything & verify Authentik admin UI       | ✅     |

**Goal**: A running Authentik instance at `https://auth.local.dev` with Traefik in front.

---

## Chapter 2 — Authentik Basics (Admin UI Tour)

| #   | Section                                              | Status |
| --- | ---------------------------------------------------- | ------ |
| 2.1 | Authentik concepts: Tenants, Flows, Stages, Policies | ✅     |
| 2.2 | Create your first user & group                        | ✅     |
| 2.3 | Create an OAuth2/OIDC Provider                        | ✅     |
| 2.4 | Create an Application & bind it to the Provider       | ✅     |
| 2.5 | Test with Authentik's built-in OIDC debug tool        | ✅     |

**Goal**: Understand Authentik's data model and have a configured OIDC provider ready.

---

## Chapter 3 — SSR App: Authorization Code Flow

| #   | Section                                                 | Status |
| --- | ------------------------------------------------------- | ------ |
| 3.1 | Create the `apps/portal` Hono app with JSX              | ⬜     |
| 3.2 | Theory: Authorization Code Flow step-by-step            | ⬜     |
| 3.3 | Implement login redirect → Authentik                    | ⬜     |
| 3.4 | Implement callback: exchange code for tokens            | ⬜     |
| 3.5 | Session management: store tokens server-side            | ⬜     |
| 3.6 | Protected routes & middleware                           | ⬜     |
| 3.7 | Implement logout (Authentik end-session + local)        | ⬜     |
| 3.8 | Extract reusable auth code into `packages/auth`         | ⬜     |

**Goal**: A working SSR app with login/logout via Authentik, plus shared auth package.

---

## Chapter 4 — SPA App: PKCE Flow

| #   | Section                                                    | Status |
| --- | ---------------------------------------------------------- | ------ |
| 4.1 | Create the `apps/dashboard` — React SPA + Hono API        | ⬜     |
| 4.2 | Theory: Why PKCE? How it differs from Authorization Code   | ⬜     |
| 4.3 | Configure a new Authentik Provider (public client, PKCE)   | ⬜     |
| 4.4 | Implement PKCE login flow in the React SPA                 | ⬜     |
| 4.5 | Token storage in browser (memory vs localStorage debate)   | ⬜     |
| 4.6 | Call the Hono API with Bearer token                        | ⬜     |
| 4.7 | JWT validation in the Hono API middleware                  | ⬜     |
| 4.8 | Silent token refresh                                       | ⬜     |

**Goal**: A working SPA with PKCE auth, calling a protected Hono API.

---

## Chapter 5 — SSO Across Apps

| #   | Section                                                    | Status |
| --- | ---------------------------------------------------------- | ------ |
| 5.1 | Theory: How SSO works (Authentik session cookie)           | ⬜     |
| 5.2 | Log in to Portal → visit Dashboard → already logged in    | ⬜     |
| 5.3 | Single Logout (SLO) across apps                           | ⬜     |
| 5.4 | Build a shared navigation bar (`packages/ui`)              | ⬜     |

**Goal**: Seamless SSO experience across your Bun apps.

---

## Chapter 6 — RBAC: Roles & Permissions

| #   | Section                                                    | Status |
| --- | ---------------------------------------------------------- | ------ |
| 6.1 | Theory: Groups, Roles & Claims in OIDC                    | ⬜     |
| 6.2 | Create groups in Authentik (admin, user, editor)           | ⬜     |
| 6.3 | Map groups to OIDC claims (custom scopes/claims)           | ⬜     |
| 6.4 | Enforce roles in Hono middleware                           | ⬜     |
| 6.5 | Conditional UI rendering based on roles                    | ⬜     |
| 6.6 | Authentik Policies: restrict app access by group           | ⬜     |

**Goal**: Role-based access control driven by Authentik groups.

---

## Chapter 7 — API-to-API: Client Credentials Flow

| #   | Section                                                    | Status |
| --- | ---------------------------------------------------------- | ------ |
| 7.1 | Theory: Machine-to-machine auth, no user involved         | ⬜     |
| 7.2 | Create `apps/api` — internal microservice                  | ⬜     |
| 7.3 | Configure Authentik: service account + Client Credentials  | ⬜     |
| 7.4 | Implement token acquisition in calling service             | ⬜     |
| 7.5 | JWT validation on the receiving service                    | ⬜     |
| 7.6 | Scopes & permissions for service accounts                  | ⬜     |

**Goal**: Secure service-to-service communication via OAuth2.

---

## Chapter 8 — Forward Auth: Protecting 3rd-Party Apps

| #   | Section                                                    | Status |
| --- | ---------------------------------------------------------- | ------ |
| 8.1 | Theory: What is Forward Auth? When to use it?              | ⬜     |
| 8.2 | Set up Authentik Outpost (embedded or Docker)              | ⬜     |
| 8.3 | Configure Traefik Forward Auth middleware                  | ⬜     |
| 8.4 | Deploy a sample 3rd-party app (e.g., Whoami or similar)   | ⬜     |
| 8.5 | Protect the 3rd-party app with Forward Auth               | ⬜     |
| 8.6 | Pass user identity headers to the upstream app             | ⬜     |

**Goal**: Protect any app with Authentik, even if it has no OIDC support.

---

## Chapter 9 — User Profile & Account Management

| #   | Section                                                    | Status |
| --- | ---------------------------------------------------------- | ------ |
| 9.1 | Authentik User API overview                                | ⬜     |
| 9.2 | Read user profile from OIDC userinfo endpoint              | ⬜     |
| 9.3 | Update user attributes via Authentik API                   | ⬜     |
| 9.4 | Build a profile page in the Portal app                     | ⬜     |
| 9.5 | Authentik self-service: password change, 2FA enrollment    | ⬜     |

**Goal**: Users can view and manage their profiles.

---

## Chapter 10 — Production Considerations

| #   | Section                                                    | Status |
| --- | ---------------------------------------------------------- | ------ |
| 10.1 | Token security best practices                             | ⬜     |
| 10.2 | HTTPS in production (real certs via Let's Encrypt)        | ⬜     |
| 10.3 | Authentik backup & recovery                               | ⬜     |
| 10.4 | Monitoring & logging auth events                          | ⬜     |
| 10.5 | Scaling Authentik                                         | ⬜     |

**Goal**: Know what to do before going to production.

---

## Summary

| Chapter | Topic                          | Status |
| ------- | ------------------------------ | ------ |
| 0       | OAuth2 / OIDC Foundations      | ⬜     |
| 1       | Environment Setup              | ⬜     |
| 2       | Authentik Admin Basics         | ⬜     |
| 3       | SSR App: Auth Code Flow        | ⬜     |
| 4       | SPA App: PKCE Flow             | ⬜     |
| 5       | SSO Across Apps                | ⬜     |
| 6       | RBAC: Roles & Permissions      | ⬜     |
| 7       | API-to-API: Client Credentials | ⬜     |
| 8       | Forward Auth with Traefik      | ⬜     |
| 9       | User Profile Management        | ⬜     |
| 10      | Production Considerations      | ⬜     |
