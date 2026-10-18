import type { FC, PropsWithChildren } from "hono/jsx";
import type { UserClaims } from "@authentik-lab/auth";
import { HonoNavbar } from "@authentik-lab/ui/hono";

interface LayoutProps {
  title?: string;
  user?: UserClaims | null;
}

export const Layout: FC<PropsWithChildren<LayoutProps>> = ({
  children,
  title = "Developer Portal — Authentik Lab",
  user,
}) => {
  return (
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{title}</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');
          body { font-family: 'Plus Jakarta Sans', sans-serif; }
          code, pre { font-family: 'JetBrains Mono', monospace; }
        `}</style>
      </head>
      <body class="bg-slate-950 text-slate-100 min-h-screen flex flex-col selection:bg-indigo-500 selection:text-white">
        {/* Unified SSO Navigation Bar from @authentik-lab/ui */}
        <HonoNavbar currentApp="portal" user={user} onLogoutHref="/auth/logout" />

        {/* Sub-navigation for Portal routes */}
        <div class="border-b border-slate-900 bg-slate-950/40">
          <div class="max-w-6xl mx-auto px-6 h-11 flex items-center gap-4 text-xs font-medium text-slate-400">
            <span class="text-slate-500 uppercase font-bold tracking-wider text-[10px]">Portal Pages:</span>
            <a href="/" class="hover:text-white transition">Home</a>
            <a href="/profile" class="hover:text-white transition">Profile</a>
            <a href="/developer" class="hover:text-white transition flex items-center gap-1.5">
              <span>Dev Console</span>
              <span class="text-[9px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-mono">Dev</span>
            </a>
            {user?.roles?.includes("admin") || user?.groups?.includes("lab-admins") ? (
              <a href="/admin" class="text-amber-400 hover:text-amber-300 font-semibold transition flex items-center gap-1.5">
                <span>Admin Console</span>
                <span class="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono">Admin</span>
              </a>
            ) : (
              <a href="/admin" class="text-slate-500 hover:text-slate-400 transition flex items-center gap-1">
                <span>Admin (Protected)</span>
                <span class="text-[10px]">🔒</span>
              </a>
            )}
          </div>
        </div>

        {/* Main Content Area */}
        <main class="flex-1 max-w-6xl w-full mx-auto px-6 py-10">
          {children}
        </main>

        {/* Footer */}
        <footer class="border-t border-slate-900 bg-slate-950 py-6 text-center text-xs text-slate-500">
          <p>Authentik SSO Learning Workspace • Chapter 5: Cross-App Single Sign-On</p>
          <p class="mt-1 font-mono text-[11px] text-slate-600">Running on Bun • Hono JSX • Authentik IdP</p>
        </footer>
      </body>
    </html>
  );
};
