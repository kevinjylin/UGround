import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { assertSupabaseAuthConfig, env } from "../env";

export const createSupabaseServerClient = async () => {
  assertSupabaseAuthConfig();

  const cookieStore = await cookies();

  return createServerClient(
    env.supabaseUrl as string,
    env.supabaseAnonKey as string,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Server components cannot always write cookies; proxy refreshes them.
          }
        },
      },
    },
  );
};
