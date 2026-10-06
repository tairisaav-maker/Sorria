import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";
import { requireSupabasePublicEnv } from "@/lib/supabase/env";

export async function createClient() {
  const cookieStore = await cookies();
  const { url, anonKey } = requireSupabasePublicEnv();

  return createServerClient<Database>(url, anonKey, {
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
          // Chamado a partir de Server Component — middleware renova a sessão.
        }
      },
    },
  });
}
