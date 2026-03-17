import Link from "next/link";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { createClient } from "@/lib/supabase/server";

export async function PublicHeader() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <header className="sticky top-0 z-30 border-b border-gray-200/80 bg-white/80 backdrop-blur-lg">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0d9488] text-xs font-bold text-white">
            MM
          </span>
          <span className="text-sm font-semibold text-gray-900">MoneyManage</span>
        </Link>

        <div className="hidden items-center gap-6 lg:flex">
          <nav className="flex gap-1 text-sm font-medium text-gray-500">
            <Link href="/" className="rounded-md px-3 py-1.5 transition-colors hover:text-gray-900 hover:bg-gray-100">
              Home
            </Link>
            {user ? (
              <>
                <Link href="/dashboard" className="rounded-md px-3 py-1.5 transition-colors hover:text-gray-900 hover:bg-gray-100">
                  Dashboard
                </Link>
                <Link href="/reminders" className="rounded-md px-3 py-1.5 transition-colors hover:text-gray-900 hover:bg-gray-100">
                  Reminders
                </Link>
                <Link href="/history" className="rounded-md px-3 py-1.5 transition-colors hover:text-gray-900 hover:bg-gray-100">
                  History
                </Link>
              </>
            ) : null}
          </nav>

          <div className="flex items-center gap-2">
            {user ? (
              <>
                <span className="text-sm text-gray-500">
                  {user.user_metadata?.full_name ?? user.email ?? "Signed in"}
                </span>
                <SignOutButton />
              </>
            ) : (
              <Link
                href="/login"
                className="primary-button rounded-lg px-4 py-2 text-sm font-medium"
              >
                Sign in
              </Link>
            )}
          </div>
        </div>

        <details className="group lg:hidden">
          <summary className="flex list-none items-center rounded-md border border-gray-200 px-2.5 py-1.5 text-sm font-medium text-gray-600">
            Menu
          </summary>
          <div className="absolute right-4 top-[3.25rem] z-30 w-[min(16rem,calc(100vw-2rem))] rounded-xl border border-gray-200 bg-white p-2 shadow-lg sm:right-6">
            <nav className="grid gap-0.5 text-sm font-medium text-gray-600">
              <Link href="/" className="rounded-md px-3 py-1.5 hover:bg-gray-50 hover:text-gray-900">
                Home
              </Link>
              {user ? (
                <>
                  <Link href="/dashboard" className="rounded-md px-3 py-1.5 hover:bg-gray-50 hover:text-gray-900">
                    Dashboard
                  </Link>
                  <Link href="/reminders" className="rounded-md px-3 py-1.5 hover:bg-gray-50 hover:text-gray-900">
                    Reminders
                  </Link>
                  <Link href="/history" className="rounded-md px-3 py-1.5 hover:bg-gray-50 hover:text-gray-900">
                    History
                  </Link>
                </>
              ) : null}
            </nav>
            <div className="mt-1.5 border-t border-gray-100 pt-1.5">
              {user ? (
                <div className="grid gap-1.5">
                  <span className="px-3 py-1 text-sm text-gray-500">
                    {user.user_metadata?.full_name ?? user.email ?? "Signed in"}
                  </span>
                  <SignOutButton />
                </div>
              ) : (
                <Link
                  href="/login"
                  className="primary-button flex w-full items-center justify-center rounded-lg px-4 py-2 text-sm font-medium"
                >
                  Sign in
                </Link>
              )}
            </div>
          </div>
        </details>
      </div>
    </header>
  );
}
