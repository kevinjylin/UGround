import { NextResponse } from "next/server";
import { hashPassword } from "../../../../lib/password";
import { hashConfirmationValue } from "../../../../lib/notificationCrypto";
import {
  getPasswordResetByTokenHash,
  markPasswordResetUsed,
  updateAuthUserPassword,
} from "../../../../lib/supabase";

const normalizeToken = (value: unknown): string => {
  return typeof value === "string" ? value.trim() : "";
};

const normalizePassword = (value: unknown): string => {
  return typeof value === "string" ? value : "";
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      token?: unknown;
      password?: unknown;
    };
    const token = normalizeToken(body.token);
    const password = normalizePassword(body.password);

    if (!token) {
      return NextResponse.json(
        { error: "Invalid or expired link." },
        { status: 400 },
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters." },
        { status: 400 },
      );
    }

    const record = await getPasswordResetByTokenHash(
      hashConfirmationValue(token),
    );

    if (!record) {
      return NextResponse.json(
        { error: "Invalid or expired link." },
        { status: 400 },
      );
    }

    if (record.used_at) {
      return NextResponse.json(
        { error: "This link has already been used." },
        { status: 400 },
      );
    }

    if (new Date(record.expires_at).getTime() < Date.now()) {
      return NextResponse.json(
        { error: "This link has expired." },
        { status: 400 },
      );
    }

    const { hash, salt } = await hashPassword(password);
    await updateAuthUserPassword(record.user_id, hash, salt);
    await markPasswordResetUsed(record.id);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 },
    );
  }
}

export const runtime = "nodejs";
