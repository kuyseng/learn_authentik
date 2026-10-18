export interface NavUser {
  name?: string;
  preferred_username?: string;
  email?: string;
  groups?: string[];
  sub?: string;
}

export interface NavAppItem {
  id: "portal" | "dashboard" | "auth";
  label: string;
  href: string;
  badge: string;
  badgeColor: string;
}

export const LAB_APPLICATIONS: NavAppItem[] = [
  {
    id: "portal",
    label: "Developer Portal",
    href: "https://portal.local.dev/",
    badge: "SSR",
    badgeColor: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  },
  {
    id: "dashboard",
    label: "React Dashboard",
    href: "https://dashboard.local.dev/",
    badge: "PKCE",
    badgeColor: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
  },
  {
    id: "auth",
    label: "Authentik IdP",
    href: "https://auth.local.dev/",
    badge: "SSO",
    badgeColor: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  },
];

export interface SharedNavbarProps {
  currentApp: "portal" | "dashboard" | "auth";
  user?: NavUser | null;
  onLogoutHref?: string;
}
