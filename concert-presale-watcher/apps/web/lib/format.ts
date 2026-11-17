export const relativeTime = (value: string): string => {
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return "unknown time";

  const diff = Date.now() - timestamp;
  const absDiff = Math.abs(diff);
  const mins = Math.floor(absDiff / 60000);
  const suffix = diff < 0 ? "from now" : "ago";

  if (mins < 1) return diff < 0 ? "soon" : "just now";
  if (mins < 60) return `${mins}m ${suffix}`;

  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ${suffix}`;

  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ${suffix}`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ${suffix}`;

  return `${Math.floor(months / 12)}y ${suffix}`;
};

export const shortDate = (value: string | null): string => {
  if (!value) return "Unknown date";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown date";

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const formatMoney = (value: number, currency: string): string => {
  const whole = Number.isInteger(value);
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: whole ? 0 : 2,
      maximumFractionDigits: whole ? 0 : 2,
    }).format(value);
  } catch {
    // Not an ISO currency code; show the number with the code after it.
    return `${value.toFixed(whole ? 0 : 2)} ${currency}`;
  }
};

/** "$35–$80", "$35", or null when the source gave no usable price. */
export const priceRange = (
  min: number | null | undefined,
  max: number | null | undefined,
  currency: string | null | undefined,
): string | null => {
  const valid = (value: number | null | undefined): value is number =>
    typeof value === "number" && Number.isFinite(value) && value >= 0;
  const code = (currency || "USD").toUpperCase();
  const low = valid(min) ? min : null;
  const high = valid(max) ? max : null;
  if (low === null && high === null) return null;
  if (low === null || high === null || low === high) return formatMoney((low ?? high)!, code);
  const [from, to] = low <= high ? [low, high] : [high, low];
  return `${formatMoney(from, code)}–${formatMoney(to, code)}`;
};

/** "With A, B and C", capped at three names. Null when there's no one else on the bill. */
export const lineupText = (lineup: string[] | null | undefined, headliner?: string): string | null => {
  const names = (lineup ?? [])
    .map((name) => name?.trim())
    .filter((name): name is string => Boolean(name))
    .filter((name) => !headliner || name.toLowerCase() !== headliner.toLowerCase());
  const unique = names.filter(
    (name, index) => names.findIndex((other) => other.toLowerCase() === name.toLowerCase()) === index,
  );
  if (unique.length === 0) return null;
  const shown = unique.slice(0, 3);
  const extra = unique.length - shown.length;
  if (extra > 0) return `With ${shown.join(", ")} and ${extra} more`;
  if (shown.length === 1) return `With ${shown[0]}`;
  return `With ${shown.slice(0, -1).join(", ")} and ${shown[shown.length - 1]}`;
};
