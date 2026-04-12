import { NextResponse } from "next/server";
import { createAuthUser, getAuthUserByUsername } from "../../../lib/supabase";
import { hashPassword } from "../../../lib/password";

const usernamePattern = /^[a-z0-9_.-]+$/;

const normalizeUsername = (value: unknown): string => {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
};

const normalizePassword = (value: unknown): string => {
  return typeof value === "string" ? value : "";
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { username?: unknown; password?: unknown };
    const username = normalizeUsername(body.username);
    const password = normalizePassword(body.password);

    if (username.length < 3 || username.length > 40 || !usernamePattern.test(username)) {
      return NextResponse.json(
        { error: "Username must be 3-40 characters and can only use letters, numbers, dots, underscores, or hyphens." },
        { status: 400 },
      );
    }

    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
    }

    const existingUser = await getAuthUserByUsername(username);
    if (existingUser) {
      return NextResponse.json({ error: "That username is already taken." }, { status: 409 });
    }

    const { hash, salt } = await hashPassword(password);
    await createAuthUser({
      username,
      passwordHash: hash,
      passwordSalt: salt,
    });

    return NextResponse.json({ ok: true, username });
  } catch (caught) {
    const message = (caught as Error).message;

    if (message.includes("23505")) {
      return NextResponse.json({ error: "That username is already taken." }, { status: 409 });
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const runtime = "nodejs";
