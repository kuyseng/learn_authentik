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
