import webpush, { type PushSubscription } from "web-push";
import { publicEnv } from "@/lib/env/public";
import { serverEnv } from "@/lib/env/server";

let vapidConfigured = false;

export type StoredPushSubscription = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

function ensureWebPushConfigured() {
  if (vapidConfigured) {
    return;
  }

  if (!publicEnv.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !serverEnv.VAPID_PRIVATE_KEY) {
    return;
  }

  webpush.setVapidDetails(
    publicEnv.NEXT_PUBLIC_APP_URL,
    publicEnv.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    serverEnv.VAPID_PRIVATE_KEY,
  );
  vapidConfigured = true;
}

export function isWebPushConfigured() {
  return Boolean(
    publicEnv.NEXT_PUBLIC_VAPID_PUBLIC_KEY && serverEnv.VAPID_PRIVATE_KEY,
  );
}

export function getWebPushPublicKey() {
  return publicEnv.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
}

export async function sendWebPush(params: {
  subscription: StoredPushSubscription;
  payload: Record<string, unknown>;
}) {
  ensureWebPushConfigured();

  if (!isWebPushConfigured()) {
    throw new Error("Web push is not configured.");
  }

  const subscription: PushSubscription = {
    endpoint: params.subscription.endpoint,
    keys: {
      p256dh: params.subscription.p256dh,
      auth: params.subscription.auth,
    },
  };

  return webpush.sendNotification(subscription, JSON.stringify(params.payload));
}
