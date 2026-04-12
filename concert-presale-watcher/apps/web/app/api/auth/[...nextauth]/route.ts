import NextAuth, { type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { env } from "../../../../lib/env";
import { verifyPassword } from "../../../../lib/password";
import { getAuthUserByUsername } from "../../../../lib/supabase";

const providers: NextAuthOptions["providers"] = [
  CredentialsProvider({
    name: "Credentials",
    credentials: {
      username: { label: "Username", type: "text" },
      password: { label: "Password", type: "password" },
    },
    async authorize(credentials) {
      const username = typeof credentials?.username === "string" ? credentials.username.trim().toLowerCase() : "";
      const password = typeof credentials?.password === "string" ? credentials.password : "";

      if (!username || !password) {
        return null;
      }

      try {
        const user = await getAuthUserByUsername(username);

        if (user && (await verifyPassword(password, user.password_salt, user.password_hash))) {
          return {
            id: user.id,
            name: user.username,
          };
        }
      } catch {
        // Keep the env-based login usable if the auth_users table is temporarily unavailable.
      }

      if (env.authUsername && env.authPassword && username === env.authUsername.toLowerCase() && password === env.authPassword) {
        return {
          id: username,
          name: username,
        };
      }

      return null;
    },
  }),
];

if (env.googleClientId && env.googleClientSecret) {
  providers.push(
    GoogleProvider({
      clientId: env.googleClientId,
      clientSecret: env.googleClientSecret,
    }),
  );
}

export const authOptions: NextAuthOptions = {
  secret: env.authSecret,
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  providers,
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
export const runtime = "nodejs";
