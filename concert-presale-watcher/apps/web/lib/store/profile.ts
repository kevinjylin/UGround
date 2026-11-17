import { supabaseRequest } from "../supabase";

export interface UserProfileRecord {
  user_id: string;
  home_city: string | null;
  home_state: string | null;
  home_country: string;
  home_radius_miles: number | null;
  created_at: string;
  updated_at: string;
}

/** What the dashboard uses as the default location for new artists and imports. */
export interface HomeLocation {
  city: string;
  state: string;
  country: string;
  radiusMiles: number | null;
}

export const EMPTY_HOME_LOCATION: HomeLocation = { city: "", state: "", country: "US", radiusMiles: null };

export const toHomeLocation = (record: UserProfileRecord | null | undefined): HomeLocation =>
  record
    ? {
        city: record.home_city ?? "",
        state: record.home_state ?? "",
        country: record.home_country || "US",
        radiusMiles: record.home_radius_miles ?? null,
      }
    : EMPTY_HOME_LOCATION;

export const getHomeLocation = async (userId: string): Promise<HomeLocation> => {
  const rows = await supabaseRequest<UserProfileRecord[]>(
    `/user_profiles?select=*&user_id=eq.${encodeURIComponent(userId)}&limit=1`,
  );
  return toHomeLocation(rows[0]);
};

export const saveHomeLocation = async (userId: string, location: HomeLocation): Promise<HomeLocation> => {
  const rows = await supabaseRequest<UserProfileRecord[]>("/user_profiles?select=*&on_conflict=user_id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify({
      user_id: userId,
      home_city: location.city || null,
      home_state: location.state || null,
      home_country: location.country || "US",
      home_radius_miles: location.city ? location.radiusMiles : null,
    }),
  });
  return toHomeLocation(rows[0]);
};
