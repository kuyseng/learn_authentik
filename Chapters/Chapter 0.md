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


---

## 0.3 — OpenID Connect (OIDC) on Top of OAuth2

### The Gap in OAuth2

Here's a subtle but critical thing: **OAuth2 is about authorization, not authentication**.

What's the difference?

| Concept | Question it answers | Example |
|---|---|---|
| **Authentication** (AuthN) | *"Who are you?"* | Proving you're Ben |
| **Authorization** (AuthZ) | *"What are you allowed to do?"* | Ben can read files but not delete them |

OAuth2 was designed to answer: *"Can this app access this user's photos on Google?"* — it gives the app a token to access photos. But OAuth2 alone **doesn't tell the app WHO the user is**.

Think about it: an Access Token says *"bearer of this token can access the photos API"* — but it doesn't say *"the user's name is Ben, email is ben@example.com"*.

---

### OIDC = OAuth2 + Identity Layer

**OpenID Connect (OIDC)** is a thin layer built **on top of** OAuth2 that adds authentication. It answers: *"Who is this user?"*

```
┌─────────────────────────────────────────┐
│           OpenID Connect (OIDC)         │
│                                         │
│  • ID Token (who the user is)           │
│  • UserInfo endpoint                    │
│  • Standard claims (name, email, etc.)  │
│  • Discovery document                   │
│                                         │
├─────────────────────────────────────────┤
│             OAuth2 (base)               │
│                                         │
│  • Access Token (authorization)         │
│  • Refresh Token                        │
│  • Authorization Code                   │
│  • Grant types / flows                  │
│  • Scopes                               │
│                                         │
└─────────────────────────────────────────┘
```

> **OIDC is NOT a separate protocol** — it's an extension of OAuth2. Every OIDC interaction is also a valid OAuth2 interaction. OIDC just adds a few extras on top.

---

### What OIDC Adds (4 Things)

#### 1. The ID Token

This is the star of OIDC. It's a **JWT (JSON Web Token)** that contains information about the user:

```json
{
  "iss": "https://auth.local.dev/application/o/portal/",
  "sub": "abc123-user-id",
  "aud": "portal-client-id",
  "exp": 1699999999,
  "iat": 1699996399,
  "name": "Ben",
  "email": "ben@example.com",
  "groups": ["admin", "developers"]
}
```

| Field | Name | Meaning |
|---|---|---|
| `iss` | Issuer | Who created this token (Authentik) |
| `sub` | Subject | Unique user ID |
| `aud` | Audience | Which app this token is for (your Client ID) |
| `exp` | Expiration | When this token expires (Unix timestamp) |
| `iat` | Issued At | When this token was created |
| `name` | Name | The user's display name |
| `email` | Email | The user's email |
| `groups` | Groups | Custom claim — user's groups (Authentik can add this) |

**Key difference from Access Token**:
- **Access Token** → you send it to APIs to *get access* (you may not even be able to read it)
- **ID Token** → you *read it* to learn about the user (you never send it to APIs)

#### 2. The UserInfo Endpoint

An API endpoint at the IdP that returns user profile info when you send an Access Token:

```
GET https://auth.local.dev/application/o/userinfo/
Authorization: Bearer <access_token>

Response:
{
  "sub": "abc123-user-id",
  "name": "Ben",
  "email": "ben@example.com",
  "email_verified": true
}
```

> "Wait, isn't that the same info as the ID Token?" — Yes, mostly. The ID Token is a one-time snapshot at login. The UserInfo endpoint gives you the **latest** info (e.g., if the user changed their email after login).

#### 3. Standard Scopes & Claims

OIDC defines **standard scopes** that tell the IdP what info you want:

| Scope | What you get back (claims) |
|---|---|
| `openid` | **Required** — tells the IdP "I'm doing OIDC, give me an ID Token" |
| `profile` | `name`, `family_name`, `given_name`, `picture`, etc. |
| `email` | `email`, `email_verified` |
| `groups` | `groups` (Authentik-specific, not standard but very common) |

When your app starts the OAuth2 flow, it includes scopes in the request:

```
https://auth.local.dev/application/o/authorize/?
  response_type=code&
  client_id=portal-client-id&
  redirect_uri=https://portal.local.dev/callback&
  scope=openid profile email&          ← HERE
  state=random-string
```

> **`scope=openid`** is the magic word that turns a plain OAuth2 flow into an OIDC flow. Without it, you're doing pure OAuth2 (no ID Token, no user identity).

#### 4. The Discovery Document

Every OIDC provider publishes a JSON document at a well-known URL that tells clients everything they need to know:

```
https://auth.local.dev/application/o/<app-slug>/.well-known/openid-configuration
```

This returns:

```json
{
  "issuer": "https://auth.local.dev/application/o/portal/",
  "authorization_endpoint": "https://auth.local.dev/application/o/authorize/",
  "token_endpoint": "https://auth.local.dev/application/o/token/",
  "userinfo_endpoint": "https://auth.local.dev/application/o/userinfo/",
  "end_session_endpoint": "https://auth.local.dev/application/o/portal/end-session/",
  "jwks_uri": "https://auth.local.dev/application/o/portal/jwks/",
  "scopes_supported": ["openid", "profile", "email", "groups"],
  "response_types_supported": ["code"],
  "grant_types_supported": ["authorization_code", "refresh_token"],
  ...
}
```

**Why this matters**: Your app doesn't need to hard-code Authentik's URLs. It fetches this document once and knows all the endpoints automatically. This is how OIDC client libraries work — you give them the issuer URL, they discover everything else.

---

### OAuth2 vs OIDC — Summary

| | OAuth2 | OIDC (OAuth2 + identity) |
|---|---|---|
| **Purpose** | Authorization (access to resources) | Authentication (who is the user) |
| **Tokens** | Access Token, Refresh Token | Access Token, Refresh Token, **+ ID Token** |
| **User info** | Not standardized | **UserInfo endpoint + standard claims** |
| **Discovery** | Not standardized | **`.well-known/openid-configuration`** |
| **Required scope** | N/A | **`openid`** |
| **When to use** | API access without identity | **Login / SSO** ← this is us |

---

### How This Maps to Our Lab

```
Your App (Client)                          Authentik (IdP)
─────────────────                          ───────────────
                                           
1. "I want to log in"  ──────────────────▶ 
   scope=openid profile email              
                                           
2.                      ◀────────────────── "Here's a code"
                                           
3. "Exchange code"      ──────────────────▶ 
                                           
4.                      ◀────────────────── Returns:
                                             • Access Token  (for API calls)
                                             • ID Token      (who the user is)
                                             • Refresh Token (for renewals)
                                           
5. Read ID Token →                         
   "User is Ben, email                     
   ben@example.com,                        
   groups: [admin]"                        
                                           
6. Create local session                    
   with user info                          
```

---

> **Key takeaway**: OAuth2 gives your app *access*. OIDC gives your app *identity*. When we integrate with Authentik, we're using OIDC — which means we send `scope=openid`, receive an **ID Token** that tells us who the user is, and can call the **UserInfo endpoint** for the latest profile. Everything auto-discovered via the **`.well-known/openid-configuration`** document.


---

## 0.4 — Key Flows: Authorization Code, PKCE, Client Credentials

In section 0.2, we listed the grant types. Now let's go deep into the **three flows we'll actually use** — understanding every step so there's no magic when we code them.

---

### Flow 1: Authorization Code (for SSR apps)

**Used by**: Server-rendered apps that have a backend (our `apps/portal`)

**Why this flow?** The app has a server that can keep secrets (the Client Secret) and exchange tokens out of the browser's sight.

#### Step-by-step:

```
  Browser                    Portal Server              Authentik
     │                            │                        │
     │ 1. GET /dashboard          │                        │
     │───────────────────────────▶│                        │
     │                            │                        │
     │ 2. 302 Redirect            │                        │
     │◀───────────────────────────│                        │
     │                            │                        │
     │ 3. GET /authorize?                                  │
     │    response_type=code&                              │
     │    client_id=portal&                                │
     │    redirect_uri=.../callback&                       │
     │    scope=openid profile email&                      │
     │    state=xyz123                                     │
     │────────────────────────────────────────────────────▶│
     │                            │                        │
     │ 4. Login page              │                        │
     │◀────────────────────────────────────────────────────│
     │                            │                        │
     │ 5. POST username + password                         │
     │────────────────────────────────────────────────────▶│
     │                            │                        │
     │ 6. 302 Redirect to                                  │
     │    /callback?code=AUTH_CODE&state=xyz123             │
     │◀────────────────────────────────────────────────────│
     │                            │                        │
     │ 7. GET /callback?code=...  │                        │
     │───────────────────────────▶│                        │
     │                            │                        │
     │                            │ 8. POST /token         │
     │                            │    grant_type=          │
     │                            │      authorization_code│
     │                            │    code=AUTH_CODE       │
     │                            │    client_id=portal     │
     │                            │    client_secret=SECRET │
     │                            │    redirect_uri=...     │
     │                            │───────────────────────▶│
     │                            │                        │
     │                            │ 9. Response:           │
     │                            │    access_token=...    │
     │                            │    id_token=...        │
     │                            │    refresh_token=...   │
     │                            │◀───────────────────────│
     │                            │                        │
     │ 10. Set session cookie     │                        │
     │     + render page          │                        │
     │◀───────────────────────────│                        │
```

#### Let's walk through each step:

| Step | What happens | Why |
|---|---|---|
| **1** | User visits a protected page | Normal navigation |
| **2** | Server sees no session → redirects to Authentik | App doesn't handle login itself |
| **3** | Browser hits Authentik's `/authorize` endpoint | The URL includes: which app (`client_id`), what info (`scope`), where to come back (`redirect_uri`), and a CSRF token (`state`) |
| **4** | Authentik shows its login page | User sees Authentik's UI, not your app's |
| **5** | User enters credentials | Password goes ONLY to Authentik |
| **6** | Authentik validates → redirects back with a `code` | The `code` is temporary (60s) and one-time-use. The `state` must match step 3 |
| **7** | Browser follows redirect to your `/callback` | Your server receives the code |
| **8** | Server exchanges code for tokens (**server-to-server**) | This is the key security step — the `client_secret` proves it's really your app. The browser never sees this request |
| **9** | Authentik returns all three tokens | Access Token, ID Token, Refresh Token |
| **10** | Server creates a session (cookie) and renders the page | Tokens are stored server-side, never sent to the browser |

#### Security properties:

- ✅ **Client Secret** stays on the server (never in the browser)
- ✅ **Tokens** stay on the server (stored in session)
- ✅ **Authorization Code** is useless without the Client Secret
- ✅ **State parameter** prevents CSRF attacks

---

### Flow 2: Authorization Code + PKCE (for SPAs)

**Used by**: Single-page applications, mobile apps (our `apps/dashboard`)

**Why a different flow?** SPAs run entirely in the browser — there's **no server to keep secrets**. Anyone can view the JavaScript source. So we can't use a Client Secret. PKCE (Proof Key for Code Exchange, pronounced "pixy") adds a different security mechanism.

#### The PKCE trick:

Instead of a pre-shared secret, the client **generates a one-time secret** for each login attempt:

```
Before starting the flow:

1. Generate a random string:
   code_verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"
   (43–128 characters, URL-safe random)

2. Hash it:
   code_challenge = BASE64URL(SHA256(code_verifier))
                  = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"

3. Send code_challenge in step 3 (public)
   Keep code_verifier secret (in memory)
   Send code_verifier in step 8 (to prove you're the same client)
```

**The insight**: Even if an attacker intercepts the `code_challenge` (it's in the URL), they can't reverse the SHA256 hash to get the `code_verifier`. Only the original client that generated both values can complete the exchange.

#### Step-by-step (differences from Auth Code highlighted with ⭐):

```
  Browser (React SPA)                           Authentik
     │                                              │
     │ 1. User clicks "Login"                       │
     │                                              │
     │ ⭐ 2. Generate code_verifier + code_challenge│
     │       (in JavaScript, in memory)             │
     │                                              │
     │ 3. Redirect to /authorize?                   │
     │    response_type=code&                       │
     │    client_id=dashboard&                      │
     │    redirect_uri=.../callback&                │
     │    scope=openid profile email&               │
     │    state=xyz123&                             │
     │    ⭐ code_challenge=E9Melh...&              │
     │    ⭐ code_challenge_method=S256             │
     │──────────────────────────────────────────────▶│
     │                                              │
     │ 4–6. Same as Auth Code (login → redirect     │
     │      back with ?code=AUTH_CODE)              │
     │◀──────────────────────────────────────────────│
     │                                              │
     │ ⭐ 7. POST /token (from browser JS!)         │
     │    grant_type=authorization_code              │
     │    code=AUTH_CODE                             │
     │    client_id=dashboard                        │
     │    ⭐ code_verifier=dBjftJ...  (NO secret!)  │
     │    redirect_uri=...                           │
     │──────────────────────────────────────────────▶│
     │                                              │
     │    Authentik checks:                         │
     │    SHA256(code_verifier) == code_challenge?   │
     │    ✅ Match → issue tokens                   │
     │                                              │
     │ 8. Response: access_token, id_token          │
     │◀──────────────────────────────────────────────│
     │                                              │
     │ 9. Store tokens in memory                    │
     │    (NOT localStorage!)                       │
```

#### Key differences from Authorization Code:

| Aspect | Auth Code | Auth Code + PKCE |
|---|---|---|
| **Client type** | Confidential (has server) | Public (browser/mobile) |
| **Client Secret** | ✅ Used in token exchange | ❌ Not used |
| **PKCE** | Optional (but recommended) | ✅ Required |
| **Token exchange** | Server-to-server | Browser-to-Authentik |
| **Token storage** | Server session | In-memory (JavaScript variable) |
| **Refresh strategy** | Refresh Token (server-side) | Silent refresh or Refresh Token rotation |

---

### Flow 3: Client Credentials (for machine-to-machine)

**Used by**: Service-to-service communication, cron jobs, background workers (our `apps/api`)

**Why this flow?** There's **no user involved**. One service needs to talk to another service, and it needs to prove its identity.

#### Step-by-step:

```
  API Service                               Authentik
     │                                          │
     │ 1. POST /token                           │
     │    grant_type=client_credentials          │
     │    client_id=api-service                  │
     │    client_secret=SUPER_SECRET             │
     │    scope=read:data                        │
     │─────────────────────────────────────────▶│
     │                                          │
     │ 2. Response:                             │
     │    access_token=eyJhbG...                │
     │    token_type=bearer                     │
     │    expires_in=3600                       │
     │◀─────────────────────────────────────────│
     │                                          │
     │                                          │
  API Service                          Another Service
     │                                          │
     │ 3. GET /api/data                         │
     │    Authorization: Bearer eyJhbG...       │
     │─────────────────────────────────────────▶│
     │                                          │
     │ 4. Validate token → return data          │
     │◀─────────────────────────────────────────│
```

That's it. **No redirects, no browser, no login page.**

| Aspect | Detail |
|---|---|
| **User involved?** | ❌ No — this is machine-to-machine |
| **Tokens received** | Access Token only (no ID Token — there's no user to identify) |
| **Refresh Token** | Not typically issued — just request a new Access Token when it expires |
| **In Authentik** | You create a "Service Account" with a Client ID + Secret |

---

### Choosing the Right Flow — Decision Tree

```
                        ┌─────────────────────┐
                        │ Is a user involved? │
                        └──────────┬──────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    │ YES                         │ NO
                    ▼                             ▼
           ┌───────────────┐            ┌─────────────────┐
           │ Does your app │            │ Client           │
           │ have a secure │            │ Credentials      │
           │ backend?      │            │ Flow             │
           └───────┬───────┘            │ (Ch. 7)          │
                   │                    └─────────────────┘
        ┌──────────┴──────────┐
        │ YES                 │ NO
        ▼                     ▼
┌───────────────┐    ┌───────────────┐
│ Authorization │    │ Authorization │
│ Code Flow     │    │ Code + PKCE   │
│ (Ch. 3)       │    │ (Ch. 4)       │
└───────────────┘    └───────────────┘
```

---

### All Three Flows Side-by-Side

| | Auth Code | Auth Code + PKCE | Client Credentials |
|---|---|---|---|
| **App type** | SSR / server-side | SPA / mobile | Backend service |
| **User login?** | ✅ Yes | ✅ Yes | ❌ No |
| **Client Secret?** | ✅ Yes | ❌ No (uses PKCE) | ✅ Yes |
| **Browser redirects?** | ✅ Yes | ✅ Yes | ❌ No |
| **Tokens stored** | Server session | Browser memory | Server env/config |
| **ID Token?** | ✅ Yes | ✅ Yes | ❌ No |
| **Our app** | `apps/portal` | `apps/dashboard` | `apps/api` |

---

> **Key takeaway**: There are three flows we'll use. **Authorization Code** for server-side apps (secure backend keeps the secret). **Authorization Code + PKCE** for SPAs (a one-time proof replaces the secret). **Client Credentials** for machine-to-machine (no user, just service identity). The flow you pick depends on whether there's a user and whether the app can keep a secret.
