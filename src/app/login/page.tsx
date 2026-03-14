import Link from "next/link";
import { AppFooter } from "@/components/chrome/app-footer";
import { PublicHeader } from "@/components/chrome/public-header";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";

type LoginPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;

  return (
    <>
      <PublicHeader />
      <main className="mx-auto flex min-h-screen w-full max-w-7xl items-center px-4 py-6 sm:px-6 lg:px-8">
        <section className="shell-card mx-auto grid w-full max-w-6xl gap-5 rounded-[1rem] p-5 sm:p-6 lg:grid-cols-[1.08fr_0.92fr] lg:p-7">
          <div className="hero-card relative overflow-hidden rounded-[1rem] px-5 py-6 sm:px-6 sm:py-7">
            <div className="relative space-y-5">
              <p className="eyebrow text-brand">Secure access</p>
              <h1 className="font-mono text-4xl font-semibold leading-tight sm:text-5xl">
                Sign in once. Review everything before it saves.
              </h1>
              <p className="max-w-xl text-base leading-8 text-slate-600">
                Your account opens the protected workspace, loads your profile, and keeps
                reminder, history, and dashboard data available across sessions.
              </p>

              <div className="rounded-[0.9rem] border border-slate-200 bg-white p-5 text-sm leading-7 text-slate-600">
                <p className="font-semibold text-slate-950">Why this flow matters</p>
                <p className="mt-2">
                  Signing in does not write any money data by itself. You still review and
                  confirm each important action inside the app.
                </p>
              </div>

              <Link href="/" className="inline-flex text-sm font-semibold text-brand">
                Back to home
              </Link>
            </div>
          </div>

          <div className="soft-card flex flex-col justify-between rounded-[1rem] p-5 sm:p-6">
            <div>
              <p className="eyebrow text-brand">Google login</p>
              <h2 className="mt-3 font-mono text-3xl font-semibold text-slate-950">
                Enter the workspace
              </h2>
              <p className="mt-3 text-sm leading-7 text-slate-600 sm:text-base">
                We use your Google account to create a secure session and open the protected
                dashboard.
              </p>
            </div>

            <div className="mt-8 space-y-4">
              {params.error ? (
                <p className="status-danger rounded-lg border px-4 py-3 text-sm">
                  Sign in did not complete. Please try again.
                </p>
              ) : null}
              <GoogleSignInButton />
            </div>
          </div>
        </section>
      </main>
      <AppFooter />
    </>
  );
}
