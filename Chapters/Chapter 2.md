# Chapter 2 — Authentik Basics (Admin UI Tour)

With our local environment running at `https://auth.local.dev`, we now step into the core architecture of Authentik itself.

Before we click buttons or configure applications, we must understand Authentik's data model. Unlike monolithic identity providers where login screens are hardcoded, Authentik is built as a **programmable identity workflow engine**.

---

## 2.1 — Authentik Concepts: Tenants, Flows, Stages, Policies

### The Core Mental Model

In Authentik, everything a user or application does is governed by five interconnected concepts:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                   TENANT                                    │
│             Branding, domain rules (e.g. auth.local.dev), default flows      │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                                 APPLICATION                                 │
│          Represents your app in the catalog (e.g. "Developer Portal")       │
│          Bound to an access policy: "Who is allowed to enter?"              │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                                  PROVIDER                                   │
│          Protocol configuration (e.g. OAuth2/OIDC, SAML, Proxy)             │
│          Client ID, Client Secret, Redirect URIs, Token Lifespans           │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                                    FLOW                                     │
│          An ordered sequence of steps (Authentication, Authorization, etc.) │
└──────────┬───────────────────────────┬───────────────────────────┬──────────┘
           │ Step 10                   │ Step 20                   │ Step 30
           ▼                           ▼                           ▼
    ┌──────────────┐            ┌──────────────┐            ┌──────────────┐
    │    STAGE     │            │    STAGE     │            │    STAGE     │
    │Identification│            │   Password   │            │  User Login  │
    └──────┬───────┘            └──────┬───────┘            └──────────────┘
           │                           │
           ▼                           ▼
     [POLICIES]                  [POLICIES]
  "Is account active?"        "Is MFA required?"
```

---

### 1. Tenants (Domains & Branding)

A **Tenant** defines the global appearance and root rules for a specific hostname or domain:
- **Domain Matching**: Matches requests by hostname (e.g., `auth.local.dev`).
- **Branding**: Title, logo, favicon, custom CSS.
- **Default Flows**: Dictates which flows to run if a user lands on `/` without specifying an application (e.g., which authentication flow or recovery flow to trigger).

Authentik supports **multi-tenancy**: a single Authentik cluster can serve completely distinct brandings and default flows depending on whether a user connects via `auth.company-a.com` or `auth.company-b.com`.

---

### 2. Flows (The Orchestration Pipelines)

A **Flow** is a state machine that guides a user, browser, or service through an identity process. Authentik does not have a fixed login form; instead, every interaction is a flow composed of individual steps.

Flows are classified by their **Designation**:

| Designation | Purpose | Example Flow |
|---|---|---|
| **Authentication** | Verifying user credentials to establish an Authentik session | `default-authentication-flow` |
| **Authorization** | Deciding if an already-authenticated user can access an app / grant OIDC scopes | `default-provider-authorization-implicit-consent` |
| **Enrollment** | Registering a new user account | `default-enrollment-flow` |
| **Recovery** | Password reset via email or admin recovery | `default-recovery-flow` |
| **Invalidation** | Terminating a session (Logout) | `default-invalidation-flow` |

---

### 3. Stages (The Atomic Building Blocks)

A Flow is divided into ordered steps called **Stages**. Each Stage performs exactly one user interaction or system task:

- **Identification Stage**: Asks the user for their identifier (username or email). Can also display "Login with Google/GitHub" source buttons.
- **Password Stage**: Prompts for the user's password and validates it against the database.
- **Authenticator Validation Stage**: Prompts for Multi-Factor Authentication (TOTP authenticator app, WebAuthn security key, Duo).
- **Consent Stage**: Prompts the user: *"App Portal wants permission to view your email and profile. Allow / Deny?"*
- **User Login Stage**: Issues the session cookie (`authentik_session`) to the browser upon successful verification.
- **User Write Stage**: Writes submitted form data into PostgreSQL (used in sign-up / enrollment flows).

#### Stage Bindings
Stages do not live directly inside a Flow; they are connected via **Stage Bindings**. A binding specifies:
1. **Order**: (e.g., `10` = Identification, `20` = Password, `30` = Login).
2. **Policy Evaluation**: Conditions determining whether this stage should be skipped or enforced.

---

### 4. Policies & Bindings (Execution Rules)

**Policies** are conditional checks evaluated at runtime. They answer questions like:
- *"Does this user belong to the `admins` group?"*
- *"Is this request originating from our corporate IP subnet?"*
- *"Has this user already configured MFA?"*

#### Types of Policies:

1. **Group Membership Policy**: Checks if the user is a member of a specified Authentik group.
2. **Password Policy**: Enforces password rules (minimum length, special characters, expiration).
3. **Event Matcher Policy**: Checks security context (GeoIP location, device type, failed attempts).
4. **Expression Policy (Python)**: The ultimate power tool. You write short Python snippets that receive the `request`, `user`, and `context` objects and return `return True` or `return False`:

```python
# Example Expression Policy: Require MFA only for Admins
if "admins" in [g.name for g in request.user.ak_groups.all()]:
    return True
return False
```

---

### 5. Providers & Applications

Now we connect the internal flow engine to external consumer applications:

#### Provider (Protocol Layer)
A **Provider** defines **how** an external app communicates with Authentik:
- **OAuth2 / OIDC Provider**: Configures Client ID, Client Secret, Redirect URIs, Scopes (`openid profile email`), token expiration times, and signing keys (RS256).
- **SAML Provider**: Generates XML metadata for enterprise SAML integrations.
- **Proxy / Forward Auth Provider**: Used with Traefik to protect non-OIDC web apps (covered in Chapter 5).
- **LDAP Provider**: Exposes an LDAP virtual directory for legacy services.

#### Application (User Catalog & Access Layer)
An **Application** is the user-facing entry in the Authentik dashboard:
- It **binds** to exactly one Provider.
- It defines the App Name, Slug, Launch URL, and Icon.
- It attaches **Access Policies**: which users or groups are allowed to see and launch the app.

---

### Summary Checklist: How an OIDC Request Travels

When our Hono app (`apps/portal`) initiates a login:
1. **Tenant** routes `https://auth.local.dev`.
2. **Provider** checks the Client ID and Redirect URI.
3. The Provider invokes its configured **Authorization Flow**.
4. If the user is not yet logged in, the Authorization flow branches to the **Authentication Flow**:
   - Stage 10: Identification (enter username)
   - Stage 20: Password (enter password)
   - Stage 30: User Login (session created)
5. The Authorization flow continues:
   - Evaluates **Application Access Policies** (Is the user permitted?).
   - Stage 40: Consent (implicit or explicit consent).
6. **Provider** generates the Authorization Code and redirects back to `https://portal.local.dev/auth/callback?code=...`.

---

> **Key takeaway**: Authentik decomposes authentication into discrete, modular pieces: **Tenants** define the brand, **Flows** orchestrate the journey, **Stages** execute individual steps, **Policies** enforce rules, **Providers** speak protocols (OIDC), and **Applications** bind everything together for users.

---


---

## 2.2 — Create Your First User & Group

### Role-Based Access Control (RBAC) in Authentik

In modern Single Sign-On systems, user privileges should **never** be hardcoded into applications. Instead, Authentik acts as the centralized source of truth for identity and roles:

```
               ┌─────────────────────────────────────────┐
               │                AUTHENTIK                │
               │                                         │
               │   User: ben3k ─────────┐                │
               │                        │                │
               │   User: alice ──┐      ▼                │
               │                 │  ┌───────────────┐   │
               │                 │  │  lab-admins   │   │
               │                 │  └───────┬───────┘   │
               │                 ▼          │           │
               │            ┌───────────────┴┐          │
               │            │ lab-developers │          │
               │            └───────┬────────┘          │
               └────────────────────┼───────────────────┘
                                    │ Included in OIDC Claims
                                    │ "groups": ["lab-admins", ...]
                                    ▼
               ┌─────────────────────────────────────────┐
               │            CONSUMER APPS                │
               │                                         │
               │  apps/portal: Checks if "lab-admins"    │
               │  apps/dashboard: Renders admin panel    │
               │  apps/api: Authorizes API endpoints     │
               └─────────────────────────────────────────┘
```

When an application requests the `profile` scope from Authentik, Authentik's default profile mapping evaluates:
```python
"groups": [group.name for group in request.user.ak_groups.all()]
```
This means group membership is automatically embedded inside the JWT claims.

---

### Step-by-Step: Admin UI Walkthrough

#### 1. Creating Groups
1. Log into **`https://auth.local.dev`** as `akadmin`.
2. In the left navigation sidebar, navigate to **Directory → Groups**.
3. Click **Create** and create three lab groups:
   - `lab-admins` (Users with elevated administrative permissions)
   - `lab-developers` (Software engineers)
   - `lab-users` (General members)

#### 2. Creating Users
1. In the sidebar, navigate to **Directory → Users**.
2. Click **Create** to create our test users:
   - **Username**: `ben3k` | **Name**: `Ben Williams` | **Email**: `ben@local.dev`
   - **Username**: `alice` | **Name**: `Alice Developer` | **Email**: `alice@local.dev`
   - **Username**: `bob` | **Name**: `Bob Regular` | **Email**: `bob@local.dev`
3. Click on each created user, switch to the **Groups** tab, and assign their groups:
   - `ben3k` → `lab-admins`, `lab-developers`
   - `alice` → `lab-developers`
   - `bob` → `lab-users`
4. Set each user's password to **`Password123!`**:
   - Inside the user details page, click **Set password** and enter `Password123!`.

---

### Automated Seeding via Script

We also created an automated, reproducible seed script at [scripts/seed-authentik.py](file:///Users/ben3k/workspace.ben3k/_learn_/authentik_lab_flash/scripts/seed-authentik.py):

```bash
docker cp scripts/seed-authentik.py authentik-server:/tmp/seed.py
docker exec authentik-server python -m manage shell -c "exec(open('/tmp/seed.py').read())"
```

All three users and groups are already provisioned and ready in our database.

---

## 2.3 — Create an OAuth2/OIDC Provider

Now we configure the protocol endpoint that our first application (`apps/portal`) will connect to.

### Essential Provider Settings

| Field | Value | Why this setting? |
|---|---|---|
| **Name** | `portal-provider` | Descriptive internal identifier |
| **Client Type** | **Confidential** | Our Hono app has a server-side backend capable of securely storing a Client Secret |
| **Client ID** | `portal-client` | Public identifier sent by the application in OIDC requests |
| **Client Secret** | `portal-secret-123456` | Shared secret known only to Authentik and `apps/portal` backend |
| **Redirect URIs** | `https://portal.local.dev/auth/callback` | Strict whitelist where Authentik is allowed to send the authorization code |
| **Signing Key** | `authentik Self-signed Certificate` | RSA certificate used to sign ID Tokens and Access Tokens |
| **Authorization Flow** | `default-provider-authorization-implicit-consent` | Authorizes the user immediately without showing a "Consent Screen" on every login during local dev |
| **Scopes** | `openid`, `email`, `profile`, `offline_access` | Required scopes to fetch subject ID, email, name, groups, and refresh tokens |

---

### UI Walkthrough

1. Navigate to **Applications → Providers**.
2. Click **Create**, choose **OAuth2/OpenID Provider**, and click **Next**.
3. Fill in:
   - **Name**: `portal-provider`
   - **Authorization flow**: `default-provider-authorization-implicit-consent`
   - **Client type**: `Confidential`
   - **Client ID**: `portal-client`
   - **Client Secret**: `portal-secret-123456`
   - **Redirect URI/Origin (RegEX)**:
     - Matching mode: `Strict`
     - URL: `https://portal.local.dev/auth/callback`
   - **Signing Key**: `authentik Self-signed Certificate`
4. In **Advanced protocol settings**:
   - Ensure **Include claims in id_token** is checked.
5. Click **Finish**.

---

## 2.4 — Create an Application & Bind It to the Provider

An Application in Authentik defines how the identity provider exposes the service to end users.

### UI Walkthrough

1. In the sidebar, navigate to **Applications → Applications**.
2. Click **Create**:
   - **Name**: `Developer Portal`
   - **Slug**: `portal` *(Used in discovery URL paths: `/application/o/portal/`)*
   - **Provider**: Select `portal-provider`
   - **Launch URL**: `https://portal.local.dev`
3. Click **Create**.

---

## 2.5 — Test with Authentik's Built-in OIDC Debug Tools

Before writing a single line of consumer code in Chapter 3, let's verify our OIDC provider is fully operational.

### 1. Test the Discovery Endpoint

Every compliant OIDC provider publishes metadata at `/.well-known/openid-configuration`:

```bash
curl -k https://auth.local.dev/application/o/portal/.well-known/openid-configuration
```

**Live Output:**
```json
{
  "issuer": "https://auth.local.dev/application/o/portal/",
  "authorization_endpoint": "https://auth.local.dev/application/o/authorize/",
  "token_endpoint": "https://auth.local.dev/application/o/token/",
  "userinfo_endpoint": "https://auth.local.dev/application/o/userinfo/",
  "jwks_uri": "https://auth.local.dev/application/o/portal/jwks/",
  "response_types_supported": ["code", "id_token", ...],
  "id_token_signing_alg_values_supported": ["RS256"]
}
```

Notice how `issuer` is scoped specifically to our application slug: `https://auth.local.dev/application/o/portal/`.

---

### 2. Test the Public JWKS Endpoint

Our apps will fetch Authentik's public key from `jwks_uri` to verify token signatures locally:

```bash
curl -k https://auth.local.dev/application/o/portal/jwks/
```

**Live Output:**
```json
{
  "keys": [
    {
      "alg": "RS256",
      "kid": "18d84904af14065e4d5f76f4e5e52fb6",
      "kty": "RSA",
      "use": "sig",
      "n": "t0kblzNtkjA1z2LcsDEs7...",
      "e": "AQAB"
    }
  ]
}
```

---

### 3. Test the Authorization Flow in Browser

Open the following test authorization URL directly in your browser:

```
https://auth.local.dev/application/o/authorize/?client_id=portal-client&response_type=code&redirect_uri=https://portal.local.dev/auth/callback&scope=openid%20profile%20email
```

**What happens:**
1. Authentik checks if you have an active session.
2. If not logged in, it redirects to the login screen:
   `https://auth.local.dev/flows/-/default/authentication/?next=...`
3. Log in with:
   - **Username**: `ben3k`
   - **Password**: `Password123!`
4. Authentik immediately issues an authorization code and redirects you to:
   `https://portal.local.dev/auth/callback?code=...`

*(Because we haven't built `apps/portal` yet, the browser will show "page not found" on `portal.local.dev`, but the URL bar will contain the real, signed `?code=` query parameter!)*

---

> **Key takeaway**: We configured Authentik's identity data model from top to bottom: **Groups & Users** for RBAC, an **OAuth2/OIDC Provider** with client credentials and redirect URIs, an **Application** to bind it, and verified the **OIDC Discovery (`.well-known`)** and **JWKS** endpoints.

---

### 🎉 Chapter 2 Complete!

Now our Identity Provider is 100% prepared to authenticate real applications.

---

> **Ready to code?** Type `c` to proceed to **Chapter 3: SSR App — Authorization Code Flow with Hono & Bun**!

