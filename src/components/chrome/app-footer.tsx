import Link from "next/link";

const footerLinks = [
  { href: "/", label: "Home" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/reminders", label: "Reminders" },
  { href: "/history", label: "History" },
];

export function AppFooter() {
  return (
    <footer className="mx-auto mt-8 w-full max-w-7xl px-4 pb-6 sm:px-6 lg:px-8">
      <div className="shell-card rounded-[1rem] px-4 py-5 sm:px-5 sm:py-6">
        <div className="grid gap-6 border-b border-slate-200 pb-5 md:grid-cols-[1.25fr_0.75fr]">
          <div className="space-y-3">
            <p className="eyebrow text-brand">MoneyManage</p>
            <h2 className="font-mono text-2xl font-semibold text-slate-950">
              Clear records. Calm money decisions.
            </h2>
            <p className="max-w-2xl text-sm leading-7 text-slate-600">
              Built for review-first entry, grounded summaries, and simple daily tracking
              that stays readable on every screen size.
            </p>
          </div>

          <nav className="grid gap-2 text-sm font-semibold text-slate-700 sm:grid-cols-2">
            {footerLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="nav-link rounded-lg px-3 py-2"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex flex-col gap-2 pt-4 text-xs uppercase tracking-[0.18em] text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <span>Trust-first finance workspace</span>
          <span>Responsive, reviewable, and grounded in saved records</span>
        </div>
      </div>
    </footer>
  );
}
