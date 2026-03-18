"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AskAiWorkspace } from "@/components/ask/ask-ai-workspace";
import { TextEntryWorkspace } from "@/components/entry/text-entry-workspace";
import { HistoryWorkspace } from "@/components/history/history-workspace";
import { ReminderWorkspace } from "@/components/reminders/reminder-workspace";
import { SettingsWorkspace } from "@/components/settings/settings-workspace";
import type { SettingsResponse } from "@/lib/settings/settings-contract";
import { DashboardSummaryPanel } from "@/components/summary/dashboard-summary-panel";
import type { HistoryPageData } from "@/lib/ledger/history-types";
import type { ReminderBoard } from "@/lib/reminders/types";
import type { DashboardSummary } from "@/lib/summaries/types";

type DashboardWorkspaceProps = {
  timezone: string;
  settings: SettingsResponse;
  summary: DashboardSummary;
  reminders: ReminderBoard;
  historyPageData: HistoryPageData;
  initialSection?: DashboardSectionId;
};

type DashboardSectionId =
  | "overview"
  | "entry"
  | "reminders"
  | "history"
  | "ask-ai"
  | "settings";

type DashboardSection = {
  id: DashboardSectionId;
  label: string;
  shortLabel: string;
  title: string;
  description: string;
  icon: React.ReactNode;
};

const dashboardSections: DashboardSection[] = [
  {
    id: "overview",
    label: "Overview",
    shortLabel: "OV",
    title: "Overview",
    description: "See the latest money snapshot and open the right workspace quickly.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5">
        <path d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: "entry",
    label: "Quick entry",
    shortLabel: "QE",
    title: "Quick entry",
    description: "Capture a new money update by text or voice and confirm before saving.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5">
        <path d="M12 4.5v15m7.5-7.5h-15" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: "reminders",
    label: "Reminders",
    shortLabel: "RE",
    title: "Reminders",
    description: "Create and manage follow-ups, due items, snoozes, and closed reminders.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5">
        <path d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: "history",
    label: "History",
    shortLabel: "HI",
    title: "History",
    description: "Review saved entries, filter records, and correct past money updates.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5">
        <path d="M12 6v6l4 2.25M21 12a9 9 0 11-3.16-6.87M21 3v6h-6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: "ask-ai",
    label: "Ask AI",
    shortLabel: "AI",
    title: "Ask AI",
    description: "Ask grounded questions over your saved data without opening every page.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5">
        <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: "settings",
    label: "Settings",
    shortLabel: "SE",
    title: "Settings",
    description: "Save your language, voice, and default preferences.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5">
        <path d="M10.5 6h3m-7.5 6h12m-9 6h6M4.5 6h.008v.008H4.5V6zm0 6h.008v.008H4.5V12zm0 6h.008v.008H4.5V18zm15 0h.008v.008H19.5V18zm0-6h.008v.008H19.5V12zm0-6h.008v.008H19.5V6z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
];

function findSection(sectionId: DashboardSectionId) {
  return (
    dashboardSections.find((section) => section.id === sectionId) ?? dashboardSections[0]
  );
}

/* ── Sidebar nav (shared between mobile + desktop) ── */
function SidebarNav({
  activeSection,
  collapsed,
  onSelectSection,
}: {
  activeSection: DashboardSectionId;
  collapsed: boolean;
  onSelectSection: (sectionId: DashboardSectionId) => void;
}) {
  return (
    <nav className="flex flex-col gap-1 p-2">
      {dashboardSections.map((section) => {
        const isActive = activeSection === section.id;
        return (
          <button
            key={section.id}
            type="button"
            onClick={() => onSelectSection(section.id)}
            className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium transition-all duration-150 ${
              isActive
                ? "bg-[#0d9488] text-white shadow-sm"
                : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
            } ${collapsed ? "justify-center px-2" : ""}`}
            title={collapsed ? section.label : undefined}
          >
            <span className={`shrink-0 ${isActive ? "text-white" : "text-gray-400"}`}>
              {section.icon}
            </span>
            {!collapsed && (
              <span className="whitespace-nowrap">{section.label}</span>
            )}
          </button>
        );
      })}
    </nav>
  );
}

/* ── Overview section ── */
function OverviewSection({
  summary,
  reminders,
  onOpenSection,
}: {
  summary: DashboardSummary;
  reminders: ReminderBoard;
  onOpenSection: (sectionId: DashboardSectionId) => void;
}) {
  const statCards: Array<{ label: string; value: string; sub: string }> = [];

  return (
    <div className="space-y-4">
      <DashboardSummaryPanel
        summary={summary}
        activeReminderCount={reminders.counts.active}
        overdueReminderCount={reminders.counts.overdue}
      />

      {/* Welcome */}
      <section className="hidden rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="text-xl font-bold text-gray-900">
          Hello there
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Use the sidebar to jump between entry, reminders, history, and Ask AI.
        </p>
      </section>

      {/* Stats */}
      <section className="hidden grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => (
          <article key={card.label} className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-xs font-medium text-gray-400">{card.label}</p>
            <p className="mt-2 font-mono text-xl font-bold text-gray-900">{card.value}</p>
            <p className="mt-1 text-xs text-gray-400">{card.sub}</p>
          </article>
        ))}
      </section>

      {/* Jump-to + Next reminder */}
      <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-gray-900">Quick actions</h3>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {dashboardSections
              .filter((s) => s.id !== "overview")
              .map((section) => (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => onOpenSection(section.id)}
                  className="flex items-center gap-3 rounded-lg border border-gray-100 bg-gray-50 p-3 text-left transition-all hover:border-gray-200 hover:bg-white hover:shadow-sm"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-[#0d9488]">
                    {section.icon}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{section.label}</p>
                    <p className="mt-0.5 truncate text-xs text-gray-400">{section.description}</p>
                  </div>
                </button>
              ))}
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-xs font-medium text-gray-400">Next reminder</p>
          {reminders.nextReminder ? (
            <>
              <h3 className="mt-2 text-sm font-semibold text-gray-900">{reminders.nextReminder.title}</h3>
              <p className="mt-2 text-sm text-gray-500">
                You have one reminder closest to due. Open reminders to act on it.
              </p>
              <button
                type="button"
                onClick={() => onOpenSection("reminders")}
                className="primary-button mt-4 rounded-lg px-4 py-2 text-sm font-semibold"
              >
                Open reminders
              </button>
            </>
          ) : (
            <>
              <h3 className="mt-2 text-sm font-semibold text-gray-900">All clear</h3>
              <p className="mt-2 text-sm text-gray-500">
                No active reminders right now. Create one from the reminders section.
              </p>
              <button
                type="button"
                onClick={() => onOpenSection("reminders")}
                className="primary-button mt-4 rounded-lg px-4 py-2 text-sm font-semibold"
              >
                Create reminder
              </button>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

/* ── Main component ── */
export function DashboardWorkspace({
  timezone,
  settings,
  summary,
  reminders,
  historyPageData,
  initialSection = "overview",
}: DashboardWorkspaceProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeSection, setActiveSection] = useState<DashboardSectionId>(initialSection);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const activeSectionMeta = findSection(activeSection);

  useEffect(() => {
    setActiveSection(initialSection);
  }, [initialSection]);

  const openSection = (sectionId: DashboardSectionId) => {
    setActiveSection(sectionId);
    setIsMobileSidebarOpen(false);

    const params = new URLSearchParams(searchParams.toString());

    if (sectionId === "overview") {
      params.delete("section");
    } else {
      params.set("section", sectionId);
    }

    if (sectionId !== "history") {
      params.delete("page");
      params.delete("type");
      params.delete("period");
    }

    const query = params.toString();
    router.push(query ? `/dashboard?${query}` : "/dashboard");
  };

  return (
    <section className="grid gap-4 xl:h-[calc(100vh-8rem)] xl:grid-cols-[auto_minmax(0,1fr)] xl:overflow-hidden">

      {/* ── Mobile sidebar trigger ── */}
      <div className="xl:hidden">
        <button
          type="button"
          onClick={() => setIsMobileSidebarOpen(true)}
          className="flex w-full items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 text-left transition-colors hover:bg-gray-50"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-50 text-[#0d9488]">
              {activeSectionMeta.icon}
            </span>
            <div>
              <span className="block text-xs font-medium text-gray-400">Current section</span>
              <span className="block text-sm font-semibold text-gray-900">{activeSectionMeta.label}</span>
            </div>
          </div>
          <span className="text-sm font-medium text-[#0d9488]">Switch ↓</span>
        </button>
      </div>

      {/* ── Mobile sidebar overlay ── */}
      <div
        className={`fixed inset-0 z-50 xl:hidden ${
          isMobileSidebarOpen ? "pointer-events-auto" : "pointer-events-none"
        }`}
        aria-hidden={!isMobileSidebarOpen}
      >
        <div
          onClick={() => setIsMobileSidebarOpen(false)}
          className={`absolute inset-0 bg-gray-900/30 backdrop-blur-sm transition-opacity duration-200 ${
            isMobileSidebarOpen ? "opacity-100" : "opacity-0"
          }`}
        />
        <aside
          className={`absolute inset-y-0 left-0 w-[280px] max-w-[85%] border-r border-gray-200 bg-white shadow-xl transition-transform duration-250 ${
            isMobileSidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[#0d9488] text-[10px] font-bold text-white">MM</span>
              <span className="text-sm font-semibold text-gray-900">Sections</span>
            </div>
            <button
              type="button"
              onClick={() => setIsMobileSidebarOpen(false)}
              className="flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 text-gray-400 hover:bg-gray-50"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" /></svg>
            </button>
          </div>
          <SidebarNav
            activeSection={activeSection}
            collapsed={false}
            onSelectSection={openSection}
          />
        </aside>
      </div>

      {/* ── Desktop sidebar ── */}
      <aside className="hidden xl:block xl:h-full">
        <div
          className={`flex h-full flex-col rounded-xl border border-gray-200 bg-white shadow-sm transition-[width] duration-250 ${
            isSidebarCollapsed ? "w-[60px]" : "w-[220px]"
          }`}
        >
          <div className="flex items-center justify-between border-b border-gray-100 px-3 py-3">
            {!isSidebarCollapsed && (
              <span className="text-sm font-semibold text-gray-900">Sections</span>
            )}
            <button
              type="button"
              onClick={() => setIsSidebarCollapsed((c) => !c)}
              className="flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 text-gray-400 transition-colors hover:bg-gray-50 hover:text-gray-600"
              title={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className={`h-3.5 w-3.5 transition-transform ${isSidebarCollapsed ? "rotate-180" : ""}`}>
                <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
              </svg>
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            <SidebarNav
              activeSection={activeSection}
              collapsed={isSidebarCollapsed}
              onSelectSection={openSection}
            />
          </div>
        </div>
      </aside>

      {/* ── Content area ── */}
      <div className="min-w-0 xl:h-full xl:overflow-y-auto">
        {/* Section header */}
        <div className="mb-4 rounded-xl border border-gray-200 bg-white px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-50 text-[#0d9488]">
                {activeSectionMeta.icon}
              </span>
              <div>
                <h1 className="text-lg font-bold text-gray-900">{activeSectionMeta.title}</h1>
                <p className="text-sm text-gray-500">{activeSectionMeta.description}</p>
              </div>
            </div>

          </div>
        </div>

        {/* Active section content */}
        {activeSection === "overview" ? (
          <OverviewSection
            summary={summary}
            reminders={reminders}
            onOpenSection={openSection}
          />
        ) : null}

        {activeSection === "entry" ? (
          <TextEntryWorkspace
            timezone={timezone}
            defaultBucket="personal"
            preferredLanguage={settings.preferredLanguage}
            voiceRepliesEnabled={settings.voiceRepliesEnabled}
            initialInputMode={settings.preferredEntryInput}
          />
        ) : null}

        {activeSection === "reminders" ? (
          <ReminderWorkspace
            board={reminders}
            timezone={timezone}
            defaultBucket="personal"
            preferredLanguage={settings.preferredLanguage}
            voiceRepliesEnabled={settings.voiceRepliesEnabled}
            defaultReminderTime={settings.reminderDefaultTime}
            variant="page"
          />
        ) : null}

        {activeSection === "history" ? (
          <HistoryWorkspace
            historyPageData={historyPageData}
            basePath="/dashboard"
            sectionId="history"
          />
        ) : null}

        {activeSection === "ask-ai" ? (
          <AskAiWorkspace
            timezone={timezone}
            preferredLanguage={settings.preferredLanguage}
            voiceRepliesEnabled={settings.voiceRepliesEnabled}
          />
        ) : null}

        {activeSection === "settings" ? (
          <SettingsWorkspace settings={settings} />
        ) : null}
      </div>
    </section>
  );
}
