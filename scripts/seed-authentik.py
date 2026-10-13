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

print(f"  [{'Created' if prov_created else 'Updated'}] Provider: portal-provider (Client ID: portal-client)")

print("\n==> 4. Seeding Application (portal)...")
app, app_created = Application.objects.get_or_create(
    slug="portal",
    defaults={
        "name": "Developer Portal",
        "provider": provider,
        "meta_launch_url": "https://portal.local.dev",
    },
)
if not app_created:
    app.name = "Developer Portal"
    app.provider = provider
    app.meta_launch_url = "https://portal.local.dev"
    app.save()

print(f"  [{'Created' if app_created else 'Updated'}] Application: {app.name} (Slug: {app.slug}) bound to {provider.name}")

print("\n🎉 Authentik Lab Seed Complete!")
