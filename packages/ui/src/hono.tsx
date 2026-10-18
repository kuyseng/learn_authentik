import type { FC } from "hono/jsx";
import { LAB_APPLICATIONS, type NavUser } from "./index";

export interface HonoNavbarProps {
  currentApp: "portal" | "dashboard" | "auth";
  user?: NavUser | null;
  onLogoutHref?: string;
}

export const HonoNavbar: FC<HonoNavbarProps> = ({
  currentApp,
  user,
  onLogoutHref = "/auth/logout",
}) => {
  return (
    <header class="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur sticky top-0 z-50">
      <div class="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Brand & App Switcher */}
        <div class="flex items-center gap-8">
          <a href="/" class="flex items-center gap-3 group">
            <div class="w-9 h-9 rounded-lg bg-gradient-to-tr from-indigo-500 to-violet-500 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition">
              A
            </div>
            <div>
              <span class="font-bold text-base tracking-tight text-white block">Authentik Lab</span>
              <span class="text-[10px] text-indigo-400 font-mono -mt-1 block">Unified SSO Workspace</span>
            </div>
          </a>

          {/* Navigation Links to All Monorepo Apps */}
          <nav class="hidden md:flex items-center gap-1.5 text-xs font-medium">
            {LAB_APPLICATIONS.map((app) => {
              const isActive = app.id === currentApp;
              return (
                <a
                  key={app.id}
                  href={app.href}
                  class={`px-3 py-1.5 rounded-lg flex items-center gap-2 transition ${
                    isActive
                      ? "bg-slate-800 text-white font-semibold shadow-inner border border-slate-700/60"
                      : "text-slate-400 hover:text-white hover:bg-slate-800/40"
                  }`}
                >
                  <span>{app.label}</span>
                  <span
                    class={`text-[9px] px-1.5 py-0.5 rounded border uppercase tracking-wider font-mono ${app.badgeColor}`}
                  >
                    {app.badge}
                  </span>
                </a>
              );
            })}
          </nav>
        </div>

        {/* User Identity & Auth Action */}
        <div class="flex items-center gap-3">
          {user ? (
            <div class="flex items-center gap-3">
              <div class="text-right hidden sm:block">
                <div class="text-xs font-semibold text-white">{user.name || user.preferred_username}</div>
                <div class="text-[10px] text-slate-400 font-mono">{user.email || user.preferred_username}</div>
              </div>
              <div class="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 flex items-center justify-center font-bold text-xs shadow-sm shadow-emerald-500/20">
                {(user.name || user.preferred_username || "U")[0].toUpperCase()}
              </div>
              <div class="flex items-center gap-1.5">
                <a
                  href={onLogoutHref}
                  class="bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-medium px-3 py-1.5 rounded-lg transition"
                >
                  Sign Out
                </a>
                <a
                  href="https://auth.local.dev/if/flow/default-invalidation-flow/"
                  title="Global Single Logout (Invalidate Authentik SSO session across all apps)"
                  class="bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700/50 text-[11px] font-medium px-2 py-1.5 rounded-lg transition"
                >
                  SLO (Global)
                </a>
              </div>
            </div>
          ) : (
            <a
              href="/auth/login"
              class="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-lg shadow-indigo-600/30 transition flex items-center gap-2"
            >
              <span>Sign in with SSO</span>
              <span>→</span>
            </a>
          )}
        </div>
      </div>
    </header>
  );
};
