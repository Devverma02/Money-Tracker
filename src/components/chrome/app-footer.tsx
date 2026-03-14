import Link from "next/link";

const footerLinks = [
  { href: "/", label: "Home" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/reminders", label: "Reminders" },
  { href: "/history", label: "History" },
];

export function AppFooter() {
  return (
    <footer className="mx-auto mt-10 w-full max-w-7xl px-5 pb-8 sm:px-8 lg:px-10">
      <div className="shell-card overflow-hidden rounded-[2rem] px-6 py-6 sm:px-8">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl space-y-3">
            <p className="eyebrow text-brand">MoneyManage</p>
            <h2 className="font-mono text-2xl font-semibold text-slate-950 sm:text-3xl">
              Calm finance tracking, built around trust.
            </h2>
            <p className="text-sm leading-7 text-slate-600 sm:text-base">
              Every screen is designed to reduce doubt, keep money records readable,
              and make confirmation feel obvious before anything important changes.
            </p>
          </div>

          <nav className="flex flex-wrap gap-3 text-sm font-semibold text-slate-700">
            {footerLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="nav-link rounded-full px-4 py-2"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="mt-6 flex flex-col gap-3 border-t border-white/60 pt-5 text-xs uppercase tracking-[0.24em] text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <span>Trust-first financial workspace</span>
          <span>Designed for clear records and calm decisions</span>
        </div>
      </div>
    </footer>
  );
}
