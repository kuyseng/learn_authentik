# Chapter 6 — RBAC: Roles & Permissions (Groups, Scopes, and Policy Enforcement)

In [**Chapter 3**](file:///Users/ben3k/workspace.ben3k/_learn_/authentik_lab_flash/Chapters/Chapter%203.md), we implemented server-side authentication for `apps/portal` via the Authorization Code Flow.  
In [**Chapter 4**](file:///Users/ben3k/workspace.ben3k/_learn_/authentik_lab_flash/Chapters/Chapter%204.md), we built a React SPA (`apps/dashboard`) using the PKCE flow with remote JWKS verification.  
In [**Chapter 5**](file:///Users/ben3k/workspace.ben3k/_learn_/authentik_lab_flash/Chapters/Chapter%205.md), we connected them with centralized Single Sign-On (SSO) and Single Logout (SLO).

Now that users can sign into any application, we face the next critical security requirement:  
**Not all authenticated users should have the same level of access.**

By the end of this chapter, you will understand:
1. **The difference between Authentication (AuthN) and Authorization (AuthZ)**.
2. **The Role-Based Access Control (RBAC) model** and how OIDC handles roles.
3. How to manage **Groups and User memberships in Authentik**.
4. How to use **Authentik Scope Mappings (Python expressions)** to inject custom `roles` and `permissions` claims into tokens.
5. How to build **reusable RBAC middleware** in `@authentik-lab/auth` for both SSR cookie sessions and JWT Bearer REST APIs.
6. How to implement **conditional UI rendering** without compromising security.
7. How to configure **Authentik Application Policies** to block unauthorized users at the IdP perimeter *before* tokens are ever minted.

---

## 6.1 — Theory: Groups, Roles & Claims in OIDC

### 1. Authentication vs. Authorization

When securing distributed architectures, never confuse these two concepts:

| Dimension | Authentication (AuthN) | Authorization (AuthZ) |
|---|---|---|
| **Question** | *"Who are you?"* | *"What are you permitted to do?"* |
| **Output** | Verified User Identity (`sub`, `email`, `name`) | Roles, permissions, access decisions (`admin`, `read:stats`, `deploy`) |
| **Protocol** | OpenID Connect (ID Token) | OAuth2 Scopes / RBAC Claims / IdP Policies |
| **Example** | *"This user is Alice (alice@local.dev)."* | *"Alice is a Developer; she can call `/api/stats`, but cannot access `/admin`."* |

---

### 2. The RBAC Mental Model

In **Role-Based Access Control (RBAC)**, permissions are not granted directly to individual users. Instead, they flow through an abstraction layer:

```mermaid
flowchart LR
    subgraph IdP["Authentik Directory"]
        User["User<br/>(e.g., alice)"] -->|Member of| Group["Group<br/>(lab-developers)"]
    end

    subgraph Token["OIDC Claims"]
        Group -->|Scope Mapping| Role["Role<br/>('developer')"]
        Role --> Permissions["Permissions<br/>['read:stats', 'deploy:app']"]
    end

    subgraph App["Application Enforcement"]
        Role -->|Hono Middleware| RouteDev["/developer & /api/stats (Allowed)"]
        Role -.->|Denied 403| RouteAdmin["/admin & /api/admin/system (Forbidden)"]
    end
```

1. **User**: The individual human account (e.g. `ben3k`, `alice`, `bob`).
2. **Group**: The organizational unit in Authentik (e.g. `lab-admins`, `lab-developers`, `lab-users`).
3. **Role**: The application-level role mapped from groups (e.g. `admin`, `developer`, `viewer`).
4. **Permissions**: The discrete actions a role can perform (e.g. `read:stats`, `manage:users`).

---

### 3. The Two Defense Tiers: Perimeter vs. Application

In a robust architecture, authorization occurs at **two distinct levels**:

```mermaid
sequenceDiagram
    autonumber
    actor Bob as Bob (lab-users)
    actor Alice as Alice (lab-developers)
    actor Ben as Ben (lab-admins)
    participant IdP as Authentik IdP (auth.local.dev)
    participant App as Developer Dashboard (apps/dashboard)

    Note over Bob,IdP: Tier 1: IdP Policy Enforcement (Perimeter Defense)
    Bob->>IdP: Login attempt for 'dashboard' app
    Note over IdP: Evaluates Application Policy Binding:<br/>Requires 'lab-developers' or 'lab-admins'
    IdP-->>Bob: 403 Access Denied: "You do not have access to this application"
    Note over Bob: Bob never receives a code or token!<br/>The application server is never reached.

    Note over Alice,App: Tier 2: Application Middleware Enforcement (Fine-Grained Defense)
    Alice->>IdP: Login attempt for 'dashboard' app
    IdP-->>Alice: Issues JWT with roles: ["developer"]
    Alice->>App: GET /api/stats (Bearer token)
    Note over App: requireAnyRole(["developer", "admin"]) -> Passed!
    App-->>Alice: 200 OK (Stats payload)
    
    Alice->>App: GET /api/admin/system (Bearer token)
    Note over App: requireRole("admin") -> Fails!
    App-->>Alice: 403 Forbidden: "Role 'admin' required"
```

1. **Tier 1 — IdP Policy Enforcement (Perimeter Defense)**:
   - Configured in Authentik on the **Application** itself.
   - Blocks users from entering an application if they lack group membership.
   - **Advantage**: The client application never executes code for an unauthorized user; zero tokens are minted.
2. **Tier 2 — Application Middleware Enforcement (Fine-Grained Defense)**:
   - Executed inside the application code (Hono middleware).
   - Allows users inside the application, but restricts specific routes, HTTP verbs, or actions (e.g., viewing public reports vs. deleting records).

---

## 6.2 — Create Groups in Authentik (admin, developer, user)

To test RBAC across our applications, we define three standard personas:

| User | Password | Authentik Groups | Mapped Role | Allowed Access |
|---|---|---|---|---|
| **`ben3k`** | `Password123!` | `lab-admins`, `lab-developers` | `admin` | Portal, Dev Console, Admin Console, all APIs |
| **`alice`** | `Password123!` | `lab-developers` | `developer` | Portal, Dev Console, `/api/stats` (Blocked from Admin) |
| **`bob`** | `Password123!` | `lab-users` | `viewer` | Portal (Home & Profile only, blocked from Dashboard & Admin) |

---

### Step-by-Step: Managing Groups in Authentik UI

1. Open your browser to **`https://auth.local.dev/`** and sign in as `akadmin`.
2. Expand the left navigation menu: **Directory** → **Groups**.
3. Click **Create** to create each group:
   - Name: `lab-admins`
   - Name: `lab-developers`
   - Name: `lab-users`
4. Assign users to groups:
   - Navigate to **Directory** → **Users**.
   - Click user **`ben3k`** → **Groups** tab → Add to `lab-admins` and `lab-developers`.
   - Click user **`alice`** → **Groups** tab → Add to `lab-developers`.
   - Click user **`bob`** → **Groups** tab → Add to `lab-users`.

---

## 6.3 — Map Groups to OIDC Claims (Custom Scopes & Property Mappings)

### The Limitation of Standard OIDC Scopes

The standard OpenID Connect specification only defines identity scopes:
- `openid`: Returns `sub` (subject identifier).
- `profile`: Returns `name`, `preferred_username`, `picture`, etc.
- `email`: Returns `email` and `email_verified`.

There is no standard `roles` scope in the base OIDC specification. Different identity providers handle roles differently:
- Keycloak uses `resource_access` or `realm_access`.
- Auth0 uses custom namespace claims (e.g. `https://my-app.com/roles`).
- **Authentik uses Python-powered Property Mappings!**

---

### How Authentik Scope Mappings Work

In Authentik, a **Scope Mapping** is a Python expression that executes whenever an OAuth2 / OIDC client requests a specific scope name.

The execution context provides rich objects:
- `request.user`: The Authentik Django `User` model instance.
- `request.user.ak_groups.all()`: All groups the user belongs to.
- `provider`: The OAuth2Provider instance issuing the tokens.
- `request.http_request`: The HTTP request object.

We create a custom Scope Mapping named **`authentik lab: Roles and Permissions`** bound to scope **`roles`**:

```python
# Authentik Scope Mapping Expression
groups = [g.name for g in request.user.ak_groups.all()]
roles = []

# Map organizational groups to application roles
if "lab-admins" in groups:
    roles.append("admin")
if "lab-developers" in groups:
    roles.append("developer")
if "lab-users" in groups:
    roles.append("viewer")

return {
    "roles": roles,
    "is_admin": "lab-admins" in groups,
    "permissions": ["read:profile"] + (
        ["read:stats", "deploy:app"] if ("developer" in roles or "admin" in roles) else []
    ) + (
        ["manage:users", "system:admin"] if "admin" in roles else []
    ),
}
```

### Attaching the Scope Mapping to Providers

The mapping is attached to both of our OIDC Providers:
- `portal-provider` (for `apps/portal`)
- `dashboard-provider` (for `apps/dashboard`)

When an application requests `scope: "openid profile email roles"`, Authentik evaluates this expression and injects `roles`, `permissions`, and `is_admin` directly into:
1. The **ID Token** (used by client applications and SSR session managers).
2. The **Access Token** (used as a Bearer JWT by resource APIs).
3. The **UserInfo endpoint** (`/application/o/userinfo/`).

---

## 6.4 — Enforce Roles in Hono Middleware

In [**`packages/auth/src/middleware.ts`**](file:///Users/ben3k/workspace.ben3k/_learn_/authentik_lab_flash/packages/auth/src/middleware.ts), we build unified RBAC middleware guards that work seamlessly with both:
1. **Cookie-based SSR Sessions** (`apps/portal`).
2. **Bearer JWTs** (`apps/dashboard`).

```typescript
import type { Context, MiddlewareHandler } from "hono";
import type { UserClaims } from "./types";

/**
 * Extracts claims from either the SSR cookie session or the verified JWT payload.
 */
export function getEffectiveUser(c: Context): UserClaims | null {
  return c.get("user") || c.get("jwtUser") || null;
}

/**
 * Route guard that requires at least one of the specified roles (OR logic).
 */
export function requireAnyRole(roles: string[]): MiddlewareHandler {
  return async (c: Context, next) => {
    const user = getEffectiveUser(c);
    if (!user) {
      if (c.req.path.startsWith("/api/")) {
        return c.json({ error: "Unauthorized", message: "Authentication required" }, 401);
      }
      return c.redirect("/auth/login");
    }

    const userRoles = (user.roles as string[]) || [];
    const hasRole = roles.some((r) => userRoles.includes(r));

    if (!hasRole) {
      if (c.req.path.startsWith("/api/")) {
        return c.json(
          {
            error: "Forbidden",
            message: `Access denied. Requires one of roles: [${roles.join(", ")}]`,
            userRoles,
          },
          403
        );
      }
      return renderForbiddenHtml(c, user, `Role: ${roles.join(" or ")}`, userRoles);
    }

    await next();
  };
}

/**
 * Route guard that requires a single specific role.
 */
export function requireRole(role: string): MiddlewareHandler {
  return requireAnyRole([role]);
}
```

---

### Protecting SSR Routes in `apps/portal`

In [**`apps/portal/src/index.tsx`**](file:///Users/ben3k/workspace.ben3k/_learn_/authentik_lab_flash/apps/portal/src/index.tsx):

```tsx
// 1. Developer Console: accessible to 'developer' OR 'admin'
app.get("/developer", requireAnyRole(["developer", "admin"]), (c) => {
  const user = c.get("user")!;
  return c.html(<Layout user={user}>...</Layout>);
});

// 2. Admin Console: strictly restricted to 'admin' role
app.get("/admin", requireRole("admin"), (c) => {
  const user = c.get("user")!;
  return c.html(<Layout user={user}>...</Layout>);
});
```

---

### Protecting REST APIs in `apps/dashboard`

In [**`apps/dashboard/src/index.ts`**](file:///Users/ben3k/workspace.ben3k/_learn_/authentik_lab_flash/apps/dashboard/src/index.ts):

```typescript
// 1. /api/stats: Validates Bearer JWT AND requires 'developer' or 'admin'
app.get("/api/stats", requireJwtAuth(), requireAnyRole(["developer", "admin"]), (c) => {
  const user = c.get("jwtUser");
  return c.json({ status: "ok", metrics: { uptime: "99.99%", clusters: 4 } });
});

// 2. /api/admin/system: Validates Bearer JWT AND strictly requires 'admin'
app.get("/api/admin/system", requireJwtAuth(), requireRole("admin"), (c) => {
  const user = c.get("jwtUser");
  return c.json({ status: "ok", system: { activeSsoSessions: 14 } });
});
```

---

## 6.5 — Conditional UI Rendering Based on Roles

> [!IMPORTANT]
> **The Golden Rule of UI Security**:  
> *Hiding a button or navigation link in HTML/React is purely for User Experience (UX), never for Security.*  
> A malicious user can always inspect client code, craft a direct `fetch()` call, or type a URL manually. Real security is **always enforced on the server** by middleware.

### 1. Conditional Rendering in Server-Side JSX (`apps/portal`)

In [**`apps/portal/src/layout.tsx`**](file:///Users/ben3k/workspace.ben3k/_learn_/authentik_lab_flash/apps/portal/src/layout.tsx):

```tsx
<div class="flex items-center gap-4 text-xs font-medium text-slate-400">
  <a href="/profile">Profile</a>
  <a href="/developer">Dev Console</a>

  {user?.roles?.includes("admin") || user?.groups?.includes("lab-admins") ? (
    <a href="/admin" class="text-amber-400 font-semibold flex items-center gap-1.5">
      <span>Admin Console</span>
      <span class="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono">Admin</span>
    </a>
  ) : (
    <a href="/admin" class="text-slate-500 hover:text-slate-400 flex items-center gap-1">
      <span>Admin (Protected)</span>
      <span class="text-[10px]">🔒</span>
    </a>
  )}
</div>
```

### 2. Conditional Rendering in Client-Side React (`apps/dashboard`)

In [**`apps/dashboard/src/client/App.tsx`**](file:///Users/ben3k/workspace.ben3k/_learn_/authentik_lab_flash/apps/dashboard/src/client/App.tsx):

```tsx
{/* Conditionally rendered only if user possesses the 'admin' role */}
{(user.roles?.includes("admin") || user.groups?.includes("lab-admins")) && (
  <div className="p-6 rounded-2xl border border-amber-500/30 bg-amber-500/5 space-y-4">
    <div className="flex items-center justify-between">
      <div>
        <span className="text-amber-400 font-bold">🛡️ Admin Operations Console</span>
        <p className="text-xs text-slate-400">Calls protected /api/admin/system</p>
      </div>
      <button
        onClick={callAdminApi}
        className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold"
      >
        Call /api/admin/system
      </button>
    </div>
  </div>
)}
```

---

## 6.6 — Authentik Policies: Restrict App Access by Group

While application middleware stops users inside an app, Authentik's **Policy Engine** allows you to block users at the **Identity Provider perimeter**.

### How Application Policy Bindings Work

Every Authentik `Application` inherits from `PolicyBindingModel`. When a client initiates the `/application/o/authorize/` flow, Authentik checks whether the authenticating user matches the policies bound to that application.

If an application is restricted to `lab-developers` and `lab-admins`:
1. When **Alice** logs in: She is in `lab-developers` → Authentik permits the flow → Authorization code is issued.
2. When **Bob** logs in: He is only in `lab-users` → Authentik halts the login flow immediately and renders an **Access Denied** error page.
3. **Bob never receives an authorization code, and `apps/dashboard` never receives a request.**

---

### Hands-on Verification: Testing All Three Personas

Let's test all three personas across our applications:

#### Test 1: Ben (Admin)
1. In an Incognito window, visit **`https://portal.local.dev/`**.
2. Sign in as **`ben3k`** / `Password123!`.
3. Visit **`https://portal.local.dev/profile`**:
   - Notice claims include: `roles: ["admin", "developer"]` and `is_admin: true`.
4. Visit **`https://portal.local.dev/developer`** → **200 OK (Access Granted)**.
5. Visit **`https://portal.local.dev/admin`** → **200 OK (Access Granted)**.
6. Open **`https://dashboard.local.dev/`** → Instant SSO login:
   - Notice the **Admin Operations Console** card is visible.
   - Click **Call /api/admin/system** → Returns **200 OK** with system metrics!

---

#### Test 2: Alice (Developer)
1. Click **Sign Out** or visit **`https://portal.local.dev/auth/logout`**.
2. Sign in as **`alice`** / `Password123!`.
3. Visit **`https://portal.local.dev/profile`**:
   - Claims include: `roles: ["developer"]`.
4. Visit **`https://portal.local.dev/developer`** → **200 OK (Access Granted)**.
5. Visit **`https://portal.local.dev/admin`**:
   - **403 Forbidden!** Intercepted by `requireRole("admin")`.
   - The page displays: `Your account alice lacks required permission: Role: admin`.
6. Open **`https://dashboard.local.dev/`**:
   - Alice has access to the dashboard.
   - Notice the **Admin Operations Console** is hidden.
   - Calling `/api/stats` succeeds; attempting to call `/api/admin/system` returns `403 Forbidden`.

---

#### Test 3: Bob (Regular User)
1. Sign out and sign in as **`bob`** / `Password123!`.
2. Visit **`https://portal.local.dev/profile`**:
   - Claims include: `roles: ["viewer"]`.
3. Try to visit **`https://portal.local.dev/developer`** → **403 Forbidden!**
4. Try to visit **`https://portal.local.dev/admin`** → **403 Forbidden!**
5. If Application Policy Binding is applied on Authentik for `dashboard`:
   - Trying to sign into `dashboard` results in Authentik blocking Bob at the login screen with **"Access Denied"**!

---

## Chapter 6 Summary

| Level | Mechanism | Where Enforced | Best For |
|---|---|---|---|
| **Perimeter** | Authentik Policy Binding | Authentik IdP (`auth.local.dev`) | Restricting entire application access before token issuance. |
| **Token Mapping** | Authentik Scope Mapping | Authentik IdP at token generation | Translating enterprise groups into normalized application roles and permissions. |
| **Application** | Hono RBAC Middleware | Application backend (`@authentik-lab/auth`) | Restricting specific pages (`/admin`) or API endpoints (`/api/admin/system`). |
| **Presentation** | Conditional Rendering | React / Hono JSX | Improving user experience by hiding controls that users lack permission to use. |
