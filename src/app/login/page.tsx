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
      <main className="mx-auto flex min-h-screen w-full max-w-7xl items-center px-5 py-8 sm:px-8 lg:px-10">
        <section className="shell-card mx-auto grid w-full max-w-6xl gap-6 rounded-[2.2rem] p-6 sm:p-8 lg:grid-cols-[1.08fr_0.92fr] lg:p-10">
          <div className="hero-card relative overflow-hidden rounded-[2rem] bg-[linear-gradient(180deg,#101827_0%,#0b1120_100%)] px-6 py-8 text-white sm:px-8">
            <div className="grid-fade" />
            <div className="relative space-y-5">
              <p className="eyebrow text-emerald-100">Secure access</p>
              <h1 className="font-mono text-4xl font-semibold leading-tight sm:text-5xl">
                Sign in once. Review everything before it saves.
              </h1>
              <p className="max-w-xl text-base leading-8 text-slate-200">
                Your account opens the protected workspace, loads your profile, and keeps
                reminder, history, and dashboard data available across sessions.
              </p>

              <div className="rounded-[1.6rem] border border-white/12 bg-white/8 p-5 text-sm leading-7 text-slate-200 backdrop-blur-xl">
                <p className="font-semibold text-white">Why this flow matters</p>
                <p className="mt-2">
                  Signing in does not write any money data by itself. You still review and
                  confirm each important action inside the app.
                </p>
              </div>

              <Link href="/" className="inline-flex text-sm font-semibold text-emerald-100">
                Back to home
              </Link>
            </div>
          </div>

          <div className="soft-card flex flex-col justify-between rounded-[2rem] p-6 sm:p-8">
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
                <p className="status-danger rounded-2xl border px-4 py-3 text-sm">
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
