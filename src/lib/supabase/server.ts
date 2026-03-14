import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { publicEnv } from "@/lib/env/public";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              (
                cookieStore as typeof cookieStore & {
                  set: (name: string, value: string, options: unknown) => void;
                }
              ).set(name, value, options);
            });
          } catch {
            // Server components may not allow cookie writes during render.
          }
        },
      },
    },
  );
}
