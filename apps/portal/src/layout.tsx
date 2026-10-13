import type { FC, PropsWithChildren } from "hono/jsx";
import type { UserClaims } from "@authentik-lab/auth";

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
        {/* Navigation Bar */}
        <header class="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur sticky top-0 z-50">
          <div class="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
            <div class="flex items-center gap-8">
              <a href="/" class="flex items-center gap-3 group">
                <div class="w-9 h-9 rounded-lg bg-gradient-to-tr from-indigo-500 to-violet-500 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition">
                  P
                </div>
                <div>
                  <span class="font-bold text-base tracking-tight text-white block">Portal</span>
                  <span class="text-[10px] text-indigo-400 font-mono -mt-1 block">apps/portal • SSR</span>
                </div>
              </a>

              <nav class="hidden md:flex items-center gap-1 text-sm font-medium">
                <a href="/" class="px-3 py-1.5 rounded-md hover:text-white text-slate-300 hover:bg-slate-800/60 transition">Home</a>
                <a href="/profile" class="px-3 py-1.5 rounded-md hover:text-white text-slate-300 hover:bg-slate-800/60 transition">Profile (Protected)</a>
                <a href="/admin" class="px-3 py-1.5 rounded-md hover:text-white text-slate-300 hover:bg-slate-800/60 transition">Admin Only</a>
              </nav>
            </div>

            <div class="flex items-center gap-3">
              {user ? (
                <div class="flex items-center gap-3">
                  <div class="text-right hidden sm:block">
                    <div class="text-xs font-semibold text-white">{user.name || user.preferred_username}</div>
                    <div class="text-[10px] text-slate-400 font-mono">{user.email || user.preferred_username}</div>
                  </div>
                  <div class="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 flex items-center justify-center font-bold text-xs">
                    {(user.name || user.preferred_username || "U")[0].toUpperCase()}
                  </div>
                  <a
                    href="/auth/logout"
                    class="bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-medium px-3 py-1.5 rounded-lg transition"
                  >
                    Logout
                  </a>
                </div>
              ) : (
                <a
                  href="/auth/login"
                  class="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-lg shadow-indigo-600/30 transition flex items-center gap-2"
                >
                  <span>Sign in with Authentik</span>
                  <span>→</span>
                </a>
              )}
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main class="flex-1 max-w-6xl w-full mx-auto px-6 py-10">
          {children}
        </main>

        {/* Footer */}
        <footer class="border-t border-slate-900 bg-slate-950 py-6 text-center text-xs text-slate-500">
          <p>Authentik SSO Learning Workspace • Chapter 3: Authorization Code Flow (SSR)</p>
          <p class="mt-1 font-mono text-[11px] text-slate-600">Running on Bun • Hono JSX • Authentik IdP</p>
        </footer>
      </body>
    </html>
  );
};
