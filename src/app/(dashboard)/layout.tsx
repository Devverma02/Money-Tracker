import Link from "next/link";
import { redirect } from "next/navigation";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  let user = null;

  try {
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    user = authUser;
  } catch (error) {
    if (
      !error ||
      typeof error !== "object" ||
      !("code" in error) ||
      error.code !== "refresh_token_not_found"
    ) {
      throw error;
    }
  }

  if (!user) {
    redirect("/login");
  }

  const profile = await prisma.appProfile.findUnique({
    where: {
      id: user.id,
    },
    select: {
      displayName: true,
    },
  });
  const userLabel =
    profile?.displayName?.trim() ||
    user.user_metadata.full_name ||
    user.user_metadata.name ||
    user.email?.split("@")[0] ||
    "User";

  return (
    <>
      <main className="mx-auto min-h-screen w-full max-w-7xl px-4 py-3 sm:px-6 sm:py-4 lg:px-8">
        <header className="shell-card relative sticky top-2 z-20 rounded-xl px-3 py-2.5 sm:px-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0d9488] text-xs font-bold text-white">
                MM
              </div>
              <div>
                <span className="block text-sm font-semibold text-gray-900">MoneyManage</span>
                <span className="block text-xs text-gray-400">{userLabel}</span>
              </div>
            </div>

            <div className="hidden items-center gap-2 lg:flex">
              <nav className="flex gap-0.5 text-sm font-medium text-gray-500">
                <Link href="/dashboard" className="nav-link rounded-lg px-2.5 py-1.5">
                  Dashboard
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
