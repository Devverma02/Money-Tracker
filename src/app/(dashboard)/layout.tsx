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
      <main className="mx-auto min-h-screen w-full max-w-7xl px-5 py-6 sm:px-8 lg:px-10">
        <header className="shell-card sticky top-4 z-20 rounded-[1.9rem] px-5 py-4 sm:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-sm font-bold text-white shadow-[0_18px_45px_rgba(10,17,40,0.18)]">
                MM
              </div>
              <div>
                <p className="eyebrow text-brand">Private workspace</p>
                <h1 className="mt-1 font-mono text-2xl font-semibold text-slate-950">
                  {user.user_metadata?.full_name ?? user.email ?? "MoneyManage user"}
                </h1>
                <p className="mt-1 text-sm text-slate-500">
                  Secure dashboard with confirmed saves, reminders, and history.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <nav className="flex flex-wrap gap-2 text-sm font-semibold text-slate-700">
                <Link href="/dashboard" className="nav-link rounded-full px-4 py-2">
                  Dashboard
                </Link>
                <Link href="/reminders" className="nav-link rounded-full px-4 py-2">
                  Reminders
                </Link>
                <Link href="/history" className="nav-link rounded-full px-4 py-2">
                  History
                </Link>
                <Link href="/" className="nav-link rounded-full px-4 py-2">
                  Home
                </Link>
              </nav>
              <SignOutButton />
            </div>
          </div>
        </header>

        <div className="py-6">{children}</div>
      </main>
      <AppFooter />
    </>
  );
}
