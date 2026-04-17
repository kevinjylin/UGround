import { NextResponse } from "next/server";
import { sendEmailMessage } from "../../../../lib/notificationDelivery";
import {
  createEmailConfirmationToken,
  createExpiry,
  hashConfirmationValue,
} from "../../../../lib/notificationCrypto";
import { getBaseAppUrl } from "../../../../lib/notificationSettings";
import {
  createPasswordReset,
  deletePasswordResetsForUser,
  getAuthUserByEmail,
} from "../../../../lib/supabase";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normalizeEmail = (value: unknown): string => {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { email?: unknown };
    const email = normalizeEmail(body.email);

    if (!emailPattern.test(email)) {
      return NextResponse.json(
        { error: "Enter a valid email address." },
        { status: 400 },
      );
    }

    const user = await getAuthUserByEmail(email);

    if (user) {
      await deletePasswordResetsForUser(user.id);

      const token = createEmailConfirmationToken();
      const resetUrl = new URL("/reset-password", getBaseAppUrl(request));
      resetUrl.searchParams.set("token", token);

      await createPasswordReset({
        userId: user.id,
        tokenHash: hashConfirmationValue(token),
        expiresAt: createExpiry(60),
      });

      try {
        const sent = await sendEmailMessage(
          user.email,
          "Reset your UGround password",
          [
            "Use this link to reset your UGround password:",
            "",
            resetUrl.toString(),
            "",
            "This link expires in 1 hour. If you did not request a reset, you can ignore this email.",
          ].join("\n"),
        );

        if (!sent) {
          console.warn(
            "Password reset email was not sent. Email provider may be unconfigured.",
          );
        }
      } catch (error) {
        console.error("Password reset email failed", error);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 },
    );
  }
}

export const runtime = "nodejs";
