import { env } from "./env";

const getPollSecrets = (): string[] => {
  return [env.pollSecret, env.cronSecret].filter((value): value is string => Boolean(value));
};

export const isPollRequestAuthorized = (request: { headers: Headers }): boolean => {
  const secrets = getPollSecrets();
  if (secrets.length === 0) {
    return true;
  }

  const header = request.headers.get("x-poll-secret") ?? request.headers.get("authorization");
  if (!header) {
    return false;
  }

  return secrets.some((secret) => header === secret || header === `Bearer ${secret}`);
};
