import { isAuthEnabled } from "./env";
import { createSupabaseServerClient } from "./supabase/server";

export const getCurrentUserId = async (): Promise<string | null> => {
  if (!isAuthEnabled()) {
    return null;
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();

  if (error) {
    return null;
  }

  return data.user?.id ?? null;
};
