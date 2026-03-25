import Link from "next/link";

const footerLinks = [
  { href: "/", label: "Home" },
  { href: "/dashboard", label: "Dashboard" },
];

export function AppFooter() {
  return (
    <footer className="border-t border-gray-200">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <div className="grid gap-6 sm:grid-cols-[1.5fr_1fr] sm:items-start">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[#0d9488] text-[10px] font-bold text-white">
                JK
              </span>
              <span className="text-sm font-semibold text-gray-900">JebKitab</span>
            </div>
            <p className="mt-3 max-w-sm text-sm leading-6 text-gray-500">
              Review-first personal finance with fast entry, grounded AI answers,
              reminders, and simple daily tracking.
            </p>
          </div>

          <nav className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            {footerLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="py-1 text-gray-500 transition-colors hover:text-gray-900"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="mt-8 flex flex-col gap-2 border-t border-gray-100 pt-5 text-xs text-gray-400 sm:flex-row sm:items-center sm:justify-between">
          <span>© 2026 JebKitab</span>
          <span>Built for trust, speed, and clarity</span>
        </div>
      </div>
    </footer>
  );
}
