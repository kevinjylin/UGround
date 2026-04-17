import { getServerSession, type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { env, isAuthEnabled } from "./env";
import { verifyPassword } from "./password";
import { getAuthUserByUsername } from "./supabase";

const getProviderUserId = (provider: string, id: string): string =>
  `${provider}:${id}`;

export const authOptions: NextAuthOptions = {
  secret: env.authSecret,
  useSecureCookies: process.env.NODE_ENV === "production",
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    jwt({ token, user, account }) {
      const mutableToken = token as typeof token & { userId?: string };

      if (user?.id && account?.provider) {
        mutableToken.userId = getProviderUserId(account.provider, user.id);
      }

      return mutableToken;
    },
    session({ session, token }) {
      const mutableSession = session as typeof session & {
        user?: { id?: string };
      };
      const userId = (token as typeof token & { userId?: string }).userId;

      if (mutableSession.user && userId) {
        mutableSession.user.id = userId;
      }

      return mutableSession;
    },
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const username =
          typeof credentials?.username === "string"
            ? credentials.username.trim().toLowerCase()
            : "";
        const password =
          typeof credentials?.password === "string" ? credentials.password : "";

        if (!username || !password) {
          return null;
        }

        try {
          const user = await getAuthUserByUsername(username);

          if (
            user &&
            (await verifyPassword(
              password,
              user.password_salt,
              user.password_hash,
            ))
          ) {
            return {
              id: user.id,
              name: user.username,
            };
          }
        } catch {
          // Keep the env-based login usable if the auth_users table is temporarily unavailable.
        }

        if (
          env.authUsername &&
          env.authPassword &&
          username === env.authUsername.toLowerCase() &&
          password === env.authPassword
        ) {
          return {
            id: username,
            name: username,
          };
        }

        return null;
      },
    }),
    ...(env.googleClientId && env.googleClientSecret
      ? [
          GoogleProvider({
            clientId: env.googleClientId,
            clientSecret: env.googleClientSecret,
          }),
        ]
      : []),
  ],
};

export const getCurrentUserId = async (): Promise<string | null> => {
  if (!isAuthEnabled()) {
    return "legacy";
  }

  const session = await getServerSession(authOptions);
  return (session?.user as { id?: string } | undefined)?.id ?? null;
};
