import { env } from "./env";

const FALLBACK_SITE_URL = "https://www.uground.app";

/** Canonical origin for absolute links in metadata, sitemap and robots. */
export const siteUrl = (): URL => {
  try {
    return new URL(env.appUrl ?? FALLBACK_SITE_URL);
  } catch {
    return new URL(FALLBACK_SITE_URL);
  }
};
