import Link from "next/link";
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
      <main className="mx-auto flex min-h-[calc(100vh-3.5rem)] w-full max-w-7xl items-center px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-5xl">
          <div className="grid gap-6 lg:grid-cols-2 lg:items-center">

            {/* Left — Value prop */}
            <div className="space-y-6">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-semibold text-[#0d9488]">
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5"><path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" /></svg>
                  Secure access
                </div>
                <h1 className="mt-4 text-3xl font-bold text-gray-900 sm:text-4xl">
                  Sign in once.
                  <br />
                  <span className="text-[#0d9488]">Review everything</span> before it saves.
                </h1>
                <p className="mt-3 text-base leading-7 text-gray-500">
                  Your account opens the protected workspace — loading your profile, reminders, and history across sessions.
                </p>
              </div>

              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-[#0d9488]">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4"><path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Why this flow matters</p>
                    <p className="mt-1 text-sm leading-6 text-gray-500">
                      Signing in does not write any money data by itself. You still review and confirm each action inside the app.
                    </p>
                  </div>
                </div>
              </div>

              <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-medium text-[#0d9488] hover:underline">
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd" /></svg>
                Back to home
              </Link>
            </div>

            {/* Right — Sign in card */}
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-[#0d9488]">Google login</p>
                <h2 className="text-2xl font-bold text-gray-900">
                  Enter the workspace
                </h2>
                <p className="text-sm leading-6 text-gray-500">
                  We use your Google account to create a secure session and open the protected dashboard.
                </p>
              </div>

              <div className="mt-6 space-y-4">
                {params.error ? (
                  <p className="status-danger rounded-lg border px-3 py-2.5 text-sm">
                    Sign in did not complete. Please try again.
                  </p>
                ) : null}
                <GoogleSignInButton />
              </div>

              <div className="mt-6 flex items-center gap-3 rounded-lg bg-gray-50 px-4 py-3">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5 shrink-0 text-gray-400"><path d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" strokeLinecap="round" strokeLinejoin="round" /></svg>
                <p className="text-xs text-gray-500">Your data stays private. We never access your Google Drive, contacts, or emails.</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
