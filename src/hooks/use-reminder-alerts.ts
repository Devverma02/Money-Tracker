"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReminderBoard } from "@/lib/reminders/types";

const ALERTS_STORAGE_KEY = "moneymanage.reminder-alerts-enabled";
const SHOWN_STORAGE_KEY = "moneymanage.reminder-alerts-shown";

function readShownMap() {
  if (typeof window === "undefined") {
    return {} as Record<string, string>;
  }

  try {
    const raw = window.localStorage.getItem(SHOWN_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function writeShownMap(nextMap: Record<string, string>) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(SHOWN_STORAGE_KEY, JSON.stringify(nextMap));
}

export function useReminderAlerts({ timezone }: { timezone: string }) {
  const [enabled, setEnabled] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return window.localStorage.getItem(ALERTS_STORAGE_KEY) === "true";
  });
  const [permission, setPermission] = useState<NotificationPermission>(() => {
    if (typeof Notification === "undefined") {
      return "denied";
    }

    return Notification.permission;
  });

  useEffect(() => {
    if (!enabled || permission !== "granted" || typeof window === "undefined") {
      return;
    }

    let isDisposed = false;

    const runPoll = async () => {
      try {
        const response = await fetch(`/api/reminders?timezone=${encodeURIComponent(timezone)}`);
        if (!response.ok) {
          return;
        }

        const board = (await response.json()) as ReminderBoard;
        const dueNow = board.activeReminders.filter((item) => {
          const effectiveTime = new Date(item.effectiveDueAt).getTime();
          return item.isOverdue || effectiveTime - Date.now() <= 5 * 60 * 1000;
        });

        const shownMap = readShownMap();

        for (const reminder of dueNow) {
          if (shownMap[reminder.id] === reminder.effectiveDueAt) {
            continue;
          }

          if (isDisposed) {
            return;
          }

          new Notification("MoneyManage reminder", {
            body: reminder.title,
            tag: `reminder-${reminder.id}`,
          });
          shownMap[reminder.id] = reminder.effectiveDueAt;
        }

        writeShownMap(shownMap);
      } catch {
        // Ignore polling failures and try again later.
      }
    };

    void runPoll();
    const interval = window.setInterval(() => {
      void runPoll();
    }, 60_000);

    return () => {
      isDisposed = true;
      window.clearInterval(interval);
    };
  }, [enabled, permission, timezone]);

  const isSupported = useMemo(
    () => typeof window !== "undefined" && "Notification" in window,
    [],
  );

  const enableAlerts = async () => {
    if (!isSupported || typeof Notification === "undefined") {
      return;
    }

    const nextPermission =
      Notification.permission === "granted"
        ? "granted"
        : await Notification.requestPermission();

    setPermission(nextPermission);

    if (nextPermission === "granted") {
      window.localStorage.setItem(ALERTS_STORAGE_KEY, "true");
      setEnabled(true);
    }
  };

  const disableAlerts = () => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(ALERTS_STORAGE_KEY, "false");
    setEnabled(false);
  };

  return {
    enabled,
    permission,
    isSupported,
    enableAlerts,
    disableAlerts,
  };
}
