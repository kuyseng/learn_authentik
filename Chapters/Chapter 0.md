# Chapter 0 — Foundations: What is OAuth2 / OIDC?

---

## 0.1 — What Problem Does SSO Solve?

### The World Without SSO

Imagine you're a company with 5 internal apps:

| App       | Purpose          |
| --------- | ---------------- |
| Portal    | Company intranet |
| Dashboard | Analytics        |
| Wiki      | Knowledge base   |
| CI/CD     | Build pipelines  |
| Chat      | Team messaging   |

**Without SSO**, each app manages its own users:

```
┌─────────┐     ┌─────────┐     ┌─────────┐
│ Portal  │     │Dashboard│     │  Wiki   │
│─────────│     │─────────│     │─────────│
│ users   │     │ users   │     │ users   │
│ table   │     │ table   │     │ table   │
│ login   │     │ login   │     │ login   │
│ page    │     │ page    │     │ page    │
└─────────┘     └─────────┘     └─────────┘
   ben/pw1         ben/pw2         ben/pw3
```

#### The problems pile up fast:

**1. Password fatigue** — Users have different passwords per app. They forget them, reuse them, or write them down. Security nightmare.

**2. No single source of truth** — New employee? You create accounts in 5 places. Someone leaves? You must remember to delete 5 accounts. Miss one and you have a security breach.

**3. No consistent login experience** — Each app has its own login page, its own password rules, its own "forgot password" flow.

**4. No centralized security policies** — Want to enforce 2FA? You'd need to implement it in every single app.

**5. No audit trail** — Who logged into what, when? You'd need to check 5 separate log systems.

---

### The World With SSO

**Single Sign-On** means: log in **once**, get access to **all** your apps.

```
                    ┌──────────────────┐
                    │    Authentik      │
                    │  (Identity       │
                    │   Provider)      │
                    │                  │
                    │  • All users     │
                    │  • All groups    │
                    │  • All policies  │
                    │  • One login     │
                    └──────┬───────────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
        ┌─────▼───┐  ┌────▼────┐  ┌───▼─────┐
        │ Portal  │  │Dashboard│  │  Wiki   │
        │         │  │         │  │         │
        │ No user │  │ No user │  │ No user │
        │ table!  │  │ table!  │  │ table!  │
        └─────────┘  └─────────┘  └─────────┘
```

#### How it works (simplified):

1. User visits **Portal** → Portal says *"I don't know who you are, go ask Authentik"*
2. User is **redirected to Authentik** → sees one login page → enters credentials
3. Authentik says *"This is Ben, he's an admin"* → sends proof back to Portal
4. Portal lets the user in

5. User visits **Dashboard** → Dashboard says *"Go ask Authentik"*
6. User is redirected to Authentik → **but they already have a session!** → Authentik instantly says *"This is Ben"* → no login page shown
7. Dashboard lets the user in — **seamlessly** ✨

#### What SSO solves:

| Problem                 | With SSO                                                     |
| ----------------------- | ------------------------------------------------------------ |
| Password fatigue        | One password, one place                                      |
| Onboarding/offboarding  | Add/remove user in Authentik → instant effect everywhere     |
| Consistent login        | One login page, one UX                                       |
| Centralized security    | 2FA, password policies — all in Authentik                    |
| Audit trail             | One log of all auth events                                   |

---

### Key Vocabulary

| Term                                                 | Meaning                                                                                                             |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| **Identity Provider (IdP)**                          | The system that manages users and handles login. For us: **Authentik**                                              |
| **Service Provider (SP)** / **Relying Party (RP)**   | An app that relies on the IdP for auth. For us: Portal, Dashboard, etc.                                             |
| **SSO Session**                                      | A cookie/token at the IdP. Once you log in, all apps can verify you without asking for credentials again            |
| **Protocol**                                         | The "language" apps and IdP speak. We'll use **OAuth2 + OpenID Connect (OIDC)**                                     |

---

### Where Authentik Fits

**Authentik** is an open-source Identity Provider. Think of it as your private "Login with Google" — but you own it and control everything.

It supports:
- **Direct OIDC/OAuth2** — Apps redirect to Authentik for login (what we'll build in Ch. 3–5)
- **Forward Auth / Outpost** — A proxy (Traefik) asks Authentik *"is this user logged in?"* before forwarding the request. Perfect for 3rd-party apps that don't speak OIDC (Ch. 8)
- **SAML, LDAP, SCIM** — Other protocols we won't cover, but good to know they exist

---

> **Key takeaway**: SSO centralizes identity. Your apps don't manage users — they *trust* an Identity Provider (Authentik) to tell them who the user is. The protocol they use to communicate is OAuth2/OIDC, which we'll learn next.


---

## 0.2 — OAuth2 Explained: Roles, Grants, Tokens

### What is OAuth2?

OAuth2 is an **authorization framework** — a set of rules that let one application access resources on behalf of a user, **without ever seeing the user's password**.

#### The real-world analogy

Think of a **hotel key card**:

1. You go to the **front desk** (Identity Provider) and prove who you are (show your ID)
2. The front desk gives you a **key card** (token)
3. The key card opens **your room** but not the staff room (scoped access)
4. The key card **expires** at checkout
5. Your room's door **never knows your name** — it just checks if the card is valid

OAuth2 works the same way. Your app never sees the user's password. It gets a **token** from Authentik, and that token grants specific access.

---

### The 4 Roles in OAuth2

Every OAuth2 interaction has exactly 4 roles:

```
┌─────────────────┐         ┌─────────────────────┐
│  Resource Owner  │         │  Authorization      │
│  (The User)      │────────▶│  Server             │
│                  │  login  │  (Authentik)         │
│  "Ben"           │◀────────│                     │
│                  │  token  │  • Authenticates     │
└─────────────────┘         │    the user          │
                            │  • Issues tokens     │
                            └─────────────────────┘
                                      │
                                      │ token
                                      ▼
┌─────────────────┐         ┌─────────────────────┐
│  Client          │────────▶│  Resource Server     │
│  (Your App)      │  token  │  (API / Protected    │
│                  │◀────────│   Resource)           │
│  "Portal App"    │  data   │                      │
│                  │         │  "User profile API"  │
└─────────────────┘         └─────────────────────┘
```

| Role                      | Who                                          | In our lab                                   |
| ------------------------- | -------------------------------------------- | -------------------------------------------- |
| **Resource Owner**        | The human user who owns the data             | You (Ben)                                    |
| **Authorization Server**  | Issues tokens after authenticating the user  | **Authentik**                                |
| **Client**                | The app requesting access on behalf of user  | Portal, Dashboard, etc.                      |
| **Resource Server**       | The API that holds the protected data        | Authentik's user info API, or your Hono API  |

> **Important**: In many setups, the Authorization Server and Resource Server are the same system. In our case, Authentik is the Authorization Server, and it *also* has a Resource Server (its user info API). But your Hono API apps are *also* Resource Servers that validate tokens Authentik issued.

---

### Grant Types (How Clients Get Tokens)

OAuth2 defines several **grant types** (also called "flows") — different ways a Client can obtain a token. The right one depends on *what kind of app* you're building.

Here's the overview — we'll deep-dive each one in section 0.4:

| Grant Type                      | Use Case                          | User Involved? | We'll Use For            |
| ------------------------------- | --------------------------------- | -------------- | ------------------------ |
| **Authorization Code**          | Server-side web apps (SSR)        | ✅ Yes         | `apps/portal` (Ch. 3)   |
| **Authorization Code + PKCE**   | Single-page apps (SPA), mobile    | ✅ Yes         | `apps/dashboard` (Ch. 4)|
| **Client Credentials**          | Machine-to-machine (API ↔ API)    | ❌ No          | `apps/api` (Ch. 7)      |
| ~~Implicit~~                    | ~~SPAs (old way)~~                | ~~Yes~~        | ~~Deprecated~~           |
| ~~Password~~                    | ~~Trusted first-party apps~~      | ~~Yes~~        | ~~Deprecated~~           |

> **Why are Implicit and Password deprecated?** Implicit sends tokens in URLs (insecure). Password requires the app to handle the user's actual password (defeats the purpose of OAuth2). Both were replaced by Authorization Code + PKCE.

---

### The Basic OAuth2 Dance (Simplified)

Regardless of grant type, the pattern is always:

```
Step 1:  Client says → "I need access"
Step 2:  User proves identity → to Authorization Server
Step 3:  Authorization Server gives → token to Client
Step 4:  Client uses token → to access Resource Server
```

Here's a more concrete example with the **Authorization Code** flow:

```
  Browser            Portal App           Authentik
     │                  │                    │
     │  Visit /dashboard│                    │
     │─────────────────▶│                    │
     │                  │                    │
     │  302 Redirect    │                    │
     │◀─────────────────│                    │
     │                  │                    │
     │  Go to Authentik login               │
     │──────────────────────────────────────▶│
     │                  │                    │
     │                  │    Login form      │
     │◀──────────────────────────────────────│
     │                  │                    │
     │  Submit username/password            │
     │──────────────────────────────────────▶│
     │                  │                    │
     │  302 Redirect with ?code=abc123      │
     │◀──────────────────────────────────────│
     │                  │                    │
     │  Follow redirect │                    │
     │  /callback?code= │                    │
     │─────────────────▶│                    │
     │                  │                    │
     │                  │  Exchange code     │
     │                  │  for tokens        │
     │                  │───────────────────▶│
     │                  │                    │
     │                  │  Access Token +    │
     │                  │  ID Token          │
     │                  │◀───────────────────│
     │                  │                    │
     │  Welcome, Ben!   │                    │
     │◀─────────────────│                    │
```

#### Key things to notice:

1. **The user's password goes ONLY to Authentik** — Portal never sees it
2. **The code is temporary** — it's exchanged for tokens server-side (browser never sees the tokens)
3. **Two-step exchange** — first get a code (via browser redirect), then exchange it for tokens (server-to-server)

---

### Tokens: The Currency of OAuth2

When Authentik approves a login, it issues **tokens**. Think of them as digital passes:

| Token                    | Purpose                                       | Lifetime               | Who sees it                        |
| ------------------------ | --------------------------------------------- | ---------------------- | ---------------------------------- |
| **Access Token**         | Grants access to APIs / resources             | Short (minutes–hours)  | Client → Resource Server           |
| **Refresh Token**        | Used to get a new Access Token when it expires| Long (days–weeks)      | Client → Authorization Server only |
| **Authorization Code**   | Temporary code exchanged for tokens           | Very short (seconds)   | Browser → Client (one-time use)    |

> We'll cover the **ID Token** (an OIDC-specific addition) in section 0.3.

#### Why short-lived Access Tokens?

If an Access Token is stolen, the damage is **limited** — it expires quickly. The Refresh Token (which lasts longer) is kept safe on the server, never exposed to the browser.

```
Timeline:
  ├── Access Token issued (valid 5 min)
  │     └── Use it for API calls
  ├── Access Token expires
  │     └── Use Refresh Token to get new Access Token
  ├── New Access Token issued (valid 5 min)
  │     └── Use it for API calls
  └── Refresh Token expires (after 7 days)
        └── User must log in again
```

---

### Client Registration

Before an app (Client) can use OAuth2, it must **register** with the Authorization Server. In Authentik, this means creating a **Provider** + **Application**.

When you register, you get:

| Credential          | What it is                                                                     |
| ------------------- | ------------------------------------------------------------------------------ |
| **Client ID**       | A public identifier for your app (like a username)                             |
| **Client Secret**   | A private key (like a password) — only for server-side apps                    |
| **Redirect URI**    | Where Authentik sends the user back after login (e.g., `https://portal.local.dev/callback`) |

> **SPAs don't get a Client Secret** — since JavaScript in the browser can't keep secrets. That's why they use PKCE (extra security, covered in 0.4).

---

> **Key takeaway**: OAuth2 is a system where your app (Client) gets a token from Authentik (Authorization Server) on behalf of the user (Resource Owner), and uses that token to access protected data (Resource Server). The user's password never touches your app. Different app types use different grant types (flows) to get tokens.
