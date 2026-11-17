import { supabaseRequest } from "../supabase";

export interface PushSubscriptionRecord {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  user_agent_label: string | null;
  created_at: string;
  last_used_at: string | null;
}

const enc = encodeURIComponent;

export const listPushSubscriptions = async (userId: string): Promise<PushSubscriptionRecord[]> =>
  supabaseRequest<PushSubscriptionRecord[]>(
    `/push_subscriptions?select=*&user_id=eq.${enc(userId)}&order=created_at.asc`,
  );

export const countPushSubscriptions = async (userId: string): Promise<number> => {
  const rows = await supabaseRequest<Array<{ id: string }>>(
    `/push_subscriptions?select=id&user_id=eq.${enc(userId)}`,
  );
  return rows.length;
};

export const hasPushSubscriptionForEndpoint = async (
  userId: string,
  endpoint: string,
): Promise<boolean> => {
  const rows = await supabaseRequest<Array<{ id: string }>>(
    `/push_subscriptions?select=id&user_id=eq.${enc(userId)}&endpoint=eq.${enc(endpoint)}&limit=1`,
  );
  return rows.length > 0;
};

/** Insert, or take over the row when this browser's endpoint is already stored. */
export const upsertPushSubscription = async (input: {
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgentLabel: string | null;
}): Promise<void> => {
  await supabaseRequest<void>("/push_subscriptions?on_conflict=endpoint", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({
      user_id: input.userId,
      endpoint: input.endpoint,
      p256dh: input.p256dh,
      auth: input.auth,
      user_agent_label: input.userAgentLabel,
    }),
  });
};

export const deletePushSubscriptionByEndpoint = async (
  userId: string,
  endpoint: string,
): Promise<void> => {
  await supabaseRequest<void>(
    `/push_subscriptions?user_id=eq.${enc(userId)}&endpoint=eq.${enc(endpoint)}`,
    { method: "DELETE", headers: { Prefer: "return=minimal" } },
  );
};

export const deletePushSubscriptionsByIds = async (ids: string[]): Promise<void> => {
  if (ids.length === 0) return;
  await supabaseRequest<void>(
    `/push_subscriptions?id=in.(${ids.map(enc).join(",")})`,
    { method: "DELETE", headers: { Prefer: "return=minimal" } },
  );
};

export const markPushSubscriptionsUsed = async (ids: string[]): Promise<void> => {
  if (ids.length === 0) return;
  await supabaseRequest<void>(
    `/push_subscriptions?id=in.(${ids.map(enc).join(",")})`,
    {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ last_used_at: new Date().toISOString() }),
    },
  );
};
