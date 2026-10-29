#!/usr/bin/env python3
"""
Seed script for Authentik Lab.
Creates initial groups, test users, OAuth2 Provider, and Application.
"""

from authentik.core.models import User, Group, Application
from authentik.crypto.models import CertificateKeyPair
from authentik.flows.models import Flow
from authentik.providers.oauth2.models import OAuth2Provider, ScopeMapping

print("==> 1. Seeding Groups...")
groups = ["lab-admins", "lab-developers", "lab-users"]
for g_name in groups:
    grp, created = Group.objects.get_or_create(name=g_name)
    status = "Created" if created else "Exists"
    print(f"  [{status}] Group: {g_name}")

print("\n==> 2. Seeding Users...")
users = [
    {
        "username": "ben3k",
        "name": "Ben Williams",
        "email": "ben@local.dev",
        "password": "Password123!",
        "groups": ["lab-admins", "lab-developers"],
    },
    {
        "username": "alice",
        "name": "Alice Developer",
        "email": "alice@local.dev",
        "password": "Password123!",
        "groups": ["lab-developers"],
    },
    {
        "username": "bob",
        "name": "Bob Regular",
        "email": "bob@local.dev",
        "password": "Password123!",
        "groups": ["lab-users"],
    },
]

for u in users:
    user, created = User.objects.get_or_create(
        username=u["username"],
        defaults={
            "name": u["name"],
            "email": u["email"],
            "is_active": True,
        },
    )
    user.name = u["name"]
    user.email = u["email"]
    user.is_active = True
    user.set_password(u["password"])
    user.save()
    for g_name in u["groups"]:
        group = Group.objects.get(name=g_name)
        user.ak_groups.add(group)
    status = "Created" if created else "Updated"
    print(f"  [{status}] User: {u['username']} ({u['name']}) -> Groups: {u['groups']}")

from authentik.providers.oauth2.models import OAuth2Provider, ScopeMapping, RedirectURI, RedirectURIMatchingMode

print("\n==> 2.5 Seeding Scope Mappings (RBAC & M2M)...")
rbac_expr = """groups = [g.name for g in request.user.ak_groups.all()]
roles = []
if "lab-admins" in groups:
    roles.append("admin")
if "lab-developers" in groups:
    roles.append("developer")
if "lab-users" in groups:
    roles.append("viewer")

return {
    "roles": roles,
    "is_admin": "lab-admins" in groups,
    "permissions": ["read:profile"] + (["read:stats", "deploy:app"] if ("developer" in roles or "admin" in roles) else []) + (["manage:users", "system:admin"] if "admin" in roles else []),
}"""
rbac_mapping, _ = ScopeMapping.objects.get_or_create(
    name="authentik lab: Roles and Permissions",
    defaults={
        "scope_name": "roles",
        "description": "Maps Authentik groups (lab-admins, lab-developers, lab-users) to app roles and permissions.",
        "expression": rbac_expr,
    },
)
rbac_mapping.expression = rbac_expr
rbac_mapping.scope_name = "roles"
rbac_mapping.save()
print("  [OK] Scope Mapping: authentik lab: Roles and Permissions (scope: roles)")

m2m_mappings = [
    ("authentik lab: Machine Scopes", "api", "requested = request.http_request.POST.get('scope', '').split()\nreturn {'scopes': requested or ['service:read'], 'is_machine': True}"),
    ("authentik lab: Scope service:read", "service:read", "return {'service:read': True, 'scopes': request.http_request.POST.get('scope', '').split(), 'is_machine': True}"),
    ("authentik lab: Scope service:write", "service:write", "return {'service:write': True, 'scopes': request.http_request.POST.get('scope', '').split(), 'is_machine': True}"),
    ("authentik lab: Scope system:metrics", "system:metrics", "return {'system:metrics': True, 'scopes': request.http_request.POST.get('scope', '').split(), 'is_machine': True}"),
]
for m_name, m_scope, m_expr in m2m_mappings:
    sm, _ = ScopeMapping.objects.get_or_create(
        name=m_name,
        defaults={
            "scope_name": m_scope,
            "expression": m_expr,
        },
    )
    sm.expression = m_expr
    sm.scope_name = m_scope
    sm.save()
    print(f"  [OK] Scope Mapping: {m_name} (scope: {m_scope})")

print("\n==> 3. Seeding OAuth2/OIDC Provider (portal)...")
cert = CertificateKeyPair.objects.get(name="authentik Self-signed Certificate")
auth_flow = Flow.objects.get(slug="default-provider-authorization-implicit-consent")
inval_flow = Flow.objects.get(slug="default-invalidation-flow")

uris = [
    RedirectURI(matching_mode=RedirectURIMatchingMode.STRICT, url="https://portal.local.dev/auth/callback"),
    RedirectURI(matching_mode=RedirectURIMatchingMode.STRICT, url="http://localhost:3000/auth/callback"),
]

provider, prov_created = OAuth2Provider.objects.get_or_create(
    name="portal-provider",
    defaults={
        "client_id": "portal-client",
        "client_secret": "portal-secret-123456",
        "client_type": "confidential",
        "authorization_flow": auth_flow,
        "invalidation_flow": inval_flow,
        "signing_key": cert,
        "include_claims_in_id_token": True,
    },
)
provider.client_id = "portal-client"
provider.client_secret = "portal-secret-123456"
provider.client_type = "confidential"
provider.redirect_uris = uris
provider.authorization_flow = auth_flow
provider.invalidation_flow = inval_flow
provider.signing_key = cert
provider.include_claims_in_id_token = True
provider.save()

# Bind standard OIDC scope property mappings
for scope_name in ["openid", "email", "profile", "offline_access"]:
    mapping = ScopeMapping.objects.filter(scope_name=scope_name).first()
    if mapping:
        provider.property_mappings.add(mapping)

# Bind Chapter 6 RBAC mapping
rbac_mapping = ScopeMapping.objects.filter(name="authentik lab: Roles and Permissions").first()
if rbac_mapping:
    provider.property_mappings.add(rbac_mapping)

print(f"  [{'Created' if prov_created else 'Updated'}] Provider: portal-provider (Client ID: portal-client)")

print("\n==> 4. Seeding Application (portal)...")
app, app_created = Application.objects.get_or_create(
    slug="portal",
    defaults={
        "name": "Developer Portal",
        "provider": provider,
        "meta_launch_url": "https://portal.local.dev/",
    },
)
if not app_created:
    app.name = "Developer Portal"
    app.provider = provider
    app.meta_launch_url = "https://portal.local.dev/"
    app.save()

print(f"  [{'Created' if app_created else 'Updated'}] Application: {app.name} (Slug: {app.slug}) bound to {provider.name}")

print("\n==> 5. Seeding Application (dashboard)...")
dash_uris = [
    RedirectURI(matching_mode=RedirectURIMatchingMode.STRICT, url="https://dashboard.local.dev/callback"),
    RedirectURI(matching_mode=RedirectURIMatchingMode.STRICT, url="https://dashboard.local.dev/"),
    RedirectURI(matching_mode=RedirectURIMatchingMode.STRICT, url="http://localhost:3001/callback"),
    RedirectURI(matching_mode=RedirectURIMatchingMode.STRICT, url="http://localhost:3001/"),
]
dash_prov, dash_prov_created = OAuth2Provider.objects.get_or_create(
    name="dashboard-provider",
    defaults={
        "client_id": "dashboard-client",
        "client_type": "public",
        "authorization_flow": auth_flow,
        "invalidation_flow": inval_flow,
        "signing_key": cert,
        "include_claims_in_id_token": True,
    },
)
dash_prov.client_id = "dashboard-client"
dash_prov.client_type = "public"
dash_prov.redirect_uris = dash_uris
dash_prov.authorization_flow = auth_flow
dash_prov.invalidation_flow = inval_flow
dash_prov.signing_key = cert
dash_prov.include_claims_in_id_token = True
dash_prov.save()

for scope_name in ["openid", "email", "profile", "offline_access"]:
    mapping = ScopeMapping.objects.filter(scope_name=scope_name).first()
    if mapping:
        dash_prov.property_mappings.add(mapping)

if rbac_mapping:
    dash_prov.property_mappings.add(rbac_mapping)

dash_app, dash_app_created = Application.objects.get_or_create(
    slug="dashboard",
    defaults={
        "name": "Developer Dashboard",
        "provider": dash_prov,
        "meta_launch_url": "https://dashboard.local.dev/",
    },
)
if not dash_app_created:
    dash_app.name = "Developer Dashboard"
    dash_app.provider = dash_prov
    dash_app.meta_launch_url = "https://dashboard.local.dev/"
    dash_app.save()

print(f"  [{'Created' if dash_app_created else 'Updated'}] Application: {dash_app.name} (Slug: {dash_app.slug}) bound to {dash_prov.name}")

print("\n==> 6. Seeding API Microservice Provider & Application (Client Credentials)...")
api_prov, api_prov_created = OAuth2Provider.objects.get_or_create(
    name="api-provider",
    defaults={
        "client_id": "api-service-client",
        "client_secret": "api-service-secret-123456",
        "client_type": "confidential",
        "authorization_flow": auth_flow,
        "invalidation_flow": inval_flow,
        "signing_key": cert,
        "include_claims_in_id_token": True,
    },
)
api_prov.client_id = "api-service-client"
api_prov.client_secret = "api-service-secret-123456"
api_prov.client_type = "confidential"
api_prov.authorization_flow = auth_flow
api_prov.invalidation_flow = inval_flow
api_prov.signing_key = cert
api_prov.include_claims_in_id_token = True
api_prov.save()

for m_name, _, _ in m2m_mappings:
    sm = ScopeMapping.objects.filter(name=m_name).first()
    if sm:
        api_prov.property_mappings.add(sm)

for scope_name in ["openid", "email", "profile"]:
    mapping = ScopeMapping.objects.filter(scope_name=scope_name).first()
    if mapping:
        api_prov.property_mappings.add(mapping)

api_app, api_app_created = Application.objects.get_or_create(
    slug="api",
    defaults={
        "name": "Internal Resource API",
        "provider": api_prov,
        "meta_launch_url": "https://api.local.dev/",
    },
)
if not api_app_created:
    api_app.name = "Internal Resource API"
    api_app.provider = api_prov
    api_app.meta_launch_url = "https://api.local.dev/"
    api_app.save()

print(f"  [{'Created' if api_app_created else 'Updated'}] Application: {api_app.name} (Slug: {api_app.slug}) bound to {api_prov.name}")

print("\n🎉 Authentik Lab Seed Complete!")
