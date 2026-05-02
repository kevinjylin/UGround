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
