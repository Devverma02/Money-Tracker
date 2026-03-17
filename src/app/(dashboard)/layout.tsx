import Link from "next/link";
import { redirect } from "next/navigation";
import { SignOutButton } from "@/components/auth/sign-out-button";
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
      <main className="mx-auto min-h-screen w-full max-w-7xl px-4 py-3 sm:px-6 sm:py-4 lg:px-8">
        <header className="shell-card relative sticky top-2 z-20 rounded-xl px-3 py-2.5 sm:px-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0d9488] text-xs font-bold text-white">
                MM
              </div>
              <span className="text-sm font-semibold text-gray-900">MoneyManage</span>
            </div>

            <div className="hidden items-center gap-2 lg:flex">
              <nav className="flex gap-0.5 text-sm font-medium text-gray-500">
                <Link href="/dashboard" className="nav-link rounded-lg px-2.5 py-1.5">
                  Dashboard
                </Link>
                <Link href="/reminders" className="nav-link rounded-lg px-2.5 py-1.5">
                  Reminders
                </Link>
                <Link href="/history" className="nav-link rounded-lg px-2.5 py-1.5">
                  History
                </Link>
                <Link href="/" className="nav-link rounded-lg px-2.5 py-1.5">
                  Home
                </Link>
              </nav>
              <SignOutButton />
            </div>

            <details className="group lg:hidden">
              <summary className="flex list-none items-center rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm font-medium text-gray-600">
                Menu
              </summary>
              <div className="absolute right-3 top-[3.5rem] z-30 w-[min(18rem,calc(100vw-2rem))] rounded-xl border border-gray-200 bg-white p-2.5 shadow-lg sm:right-4">
                <nav className="grid gap-0.5 text-sm font-medium text-gray-600">
                  <Link href="/dashboard" className="nav-link rounded-lg px-2.5 py-1.5">
                    Dashboard
                  </Link>
                  <Link href="/reminders" className="nav-link rounded-lg px-2.5 py-1.5">
                    Reminders
                  </Link>
                  <Link href="/history" className="nav-link rounded-lg px-2.5 py-1.5">
                    History
                  </Link>
                  <Link href="/" className="nav-link rounded-lg px-2.5 py-1.5">
                    Home
                  </Link>
                </nav>
                <div className="mt-2 border-t border-gray-100 pt-2">
                  <SignOutButton />
                </div>
              </div>
            </details>
          </div>
        </header>

        <div className="py-3 sm:py-4">{children}</div>
      </main>
    </>
  );
}
