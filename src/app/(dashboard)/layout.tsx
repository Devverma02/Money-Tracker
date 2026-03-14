import Link from "next/link";
import { redirect } from "next/navigation";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { AppFooter } from "@/components/chrome/app-footer";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <>
      <main className="mx-auto min-h-screen w-full max-w-7xl px-4 py-4 sm:px-6 sm:py-5 lg:px-8">
        <header className="shell-card relative sticky top-3 z-20 rounded-[1rem] px-4 py-3 sm:px-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-950 text-sm font-bold text-white">
                MM
              </div>
              <span className="text-base font-semibold text-slate-950">MoneyManage</span>
            </div>

            <div className="hidden items-center gap-3 lg:flex">
              <nav className="flex flex-wrap gap-2 text-sm font-semibold text-slate-700">
                <Link href="/dashboard" className="nav-link rounded-lg px-3 py-2">
                  Dashboard
                </Link>
                <Link href="/reminders" className="nav-link rounded-lg px-3 py-2">
                  Reminders
                </Link>
                <Link href="/history" className="nav-link rounded-lg px-3 py-2">
                  History
                </Link>
                <Link href="/" className="nav-link rounded-lg px-3 py-2">
                  Home
                </Link>
              </nav>
              <SignOutButton />
            </div>

            <details className="group lg:hidden">
              <summary className="flex list-none items-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700">
                Menu
              </summary>
              <div className="absolute right-4 top-[4.75rem] z-30 w-[min(20rem,calc(100vw-2rem))] rounded-[1rem] border border-slate-200 bg-white p-3 shadow-[0_18px_40px_rgba(16,24,40,0.12)] sm:right-6">
                <nav className="grid gap-1 text-sm font-semibold text-slate-700">
                  <Link href="/dashboard" className="nav-link rounded-lg px-3 py-2">
                    Dashboard
                  </Link>
                  <Link href="/reminders" className="nav-link rounded-lg px-3 py-2">
                    Reminders
                  </Link>
                  <Link href="/history" className="nav-link rounded-lg px-3 py-2">
                    History
                  </Link>
                  <Link href="/" className="nav-link rounded-lg px-3 py-2">
                    Home
                  </Link>
                </nav>

                <div className="mt-3 border-t border-slate-200 pt-3">
                  <SignOutButton />
                </div>
              </div>
            </details>
          </div>
        </header>

        <div className="py-4 sm:py-5">{children}</div>
      </main>
      <AppFooter />
    </>
  );
}
