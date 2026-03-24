"use client";

import { useEffect, useSyncExternalStore } from "react";
import { publicEnv } from "@/lib/env/public";

const ALERTS_STORAGE_KEY = "moneymanage.reminder-alerts-enabled";

type ReminderAlertsSnapshot = {
  enabled: boolean;
  permission: NotificationPermission;
  isSupported: boolean;
};

const serverSnapshot: ReminderAlertsSnapshot = {
  enabled: false,
  permission: "default",
  isSupported: false,
};

function base64UrlToUint8Array(base64Url: string) {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from(raw, (character) => character.charCodeAt(0));
}

async function registerReminderServiceWorker() {
  const existingRegistration = await navigator.serviceWorker.getRegistration("/sw.js");
  if (existingRegistration) {
    return existingRegistration;
  }

  return navigator.serviceWorker.register("/sw.js");
}

export function useReminderAlerts() {
  const hasVapidKey = Boolean(publicEnv.NEXT_PUBLIC_VAPID_PUBLIC_KEY);
  const snapshot = useSyncExternalStore(
    () => () => {},
    () => {
      if (typeof window === "undefined") {
        return serverSnapshot;
      }

      return {
        enabled: window.localStorage.getItem(ALERTS_STORAGE_KEY) === "true",
        permission:
          typeof Notification === "undefined" ? "denied" : Notification.permission,
        isSupported:
          hasVapidKey &&
          "serviceWorker" in navigator &&
          "PushManager" in window &&
          "Notification" in window,
      } satisfies ReminderAlertsSnapshot;
    },
    () => serverSnapshot,
  );

  useEffect(() => {
    if (!snapshot.isSupported || snapshot.permission !== "granted" || !snapshot.enabled) {
      return;
    }

    let cancelled = false;

    const syncExistingSubscription = async () => {
      try {
        const registration = await registerReminderServiceWorker();
        const subscription = await registration.pushManager.getSubscription();

        if (!subscription || cancelled) {
          return;
        }

        await fetch("/api/push-subscriptions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(subscription.toJSON()),
        });
      } catch {
        // Ignore background sync failures and retry on next enable.
      }
    };

    void syncExistingSubscription();

    return () => {
      cancelled = true;
    };
  }, [snapshot.enabled, snapshot.isSupported, snapshot.permission]);

  const enableAlerts = async () => {
    if (!snapshot.isSupported || typeof Notification === "undefined") {
      return;
    }

    const nextPermission =
      Notification.permission === "granted"
        ? "granted"
        : await Notification.requestPermission();

    if (nextPermission !== "granted") {
      return;
    }

    const registration = await registerReminderServiceWorker();
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64UrlToUint8Array(
          publicEnv.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
        ),
      });
    }

    await fetch("/api/push-subscriptions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(subscription.toJSON()),
    });

    window.localStorage.setItem(ALERTS_STORAGE_KEY, "true");
  };

  const disableAlerts = async () => {
    if (typeof window === "undefined") {
      return;
    }

    if (snapshot.isSupported) {
      try {
        const registration = await registerReminderServiceWorker();
        const subscription = await registration.pushManager.getSubscription();

        if (subscription) {
          await fetch("/api/push-subscriptions", {
            method: "DELETE",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(subscription.toJSON()),
          });
          await subscription.unsubscribe();
        }
      } catch {
        // Best-effort unsubscribe.
      }
    }

    window.localStorage.setItem(ALERTS_STORAGE_KEY, "false");
  };

  return {
    enabled: snapshot.enabled,
    permission: snapshot.permission,
    isSupported: snapshot.isSupported,
    enableAlerts,
    disableAlerts,
  };
}
