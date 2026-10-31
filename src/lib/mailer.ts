import { getDb, nowIso } from "./db";

/**
 * Transactional mail. If SMTP_* env vars are set it really delivers via nodemailer;
 * otherwise the message is stored in the mailLog outbox (visible in Admin → Monitoring)
 * instead of faking a "sent" status — an operator can copy the exact verification/reset
 * link from there. No passwords or card data ever land in mail bodies.
 */

export interface MailDraft {
  to: string;
  subject: string;
  body: string; // text; links only ever point at our own origin
}

interface SendResult {
  delivered: boolean;
  note: string;
}

export async function sendMail(draft: MailDraft): Promise<SendResult> {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;
  const from = process.env.SMTP_FROM ?? "Burnout Wheels <theburnoutwheels@gmail.com>";

  let delivered = false;
  let note = "";

  if (host && user && pass) {
    try {
      const nodemailer = await import("nodemailer");
      const transport = nodemailer.createTransport({ host, port: Number(process.env.SMTP_PORT ?? 587), auth: { user, pass } });
      await transport.sendMail({
        from,
        to: draft.to,
        subject: draft.subject,
        text: draft.body,
      });
      delivered = true;
      note = "sent via SMTP";
    } catch (err) {
      note = `SMTP send failed: ${err instanceof Error ? err.message : "unknown error"}`;
      console.error("[burnout] mail:", note);
    }
  } else {
    note = "SMTP not configured — message parked in the admin outbox";
  }

  try {
    const db = getDb();
    db.prepare("INSERT INTO mailLog (toEmail, subject, body, delivered, createdAt) VALUES (?,?,?,?,?)")
      .run(draft.to, draft.subject, draft.body, delivered ? 1 : 0, nowIso());
  } catch (err) {
    console.warn("[burnout] mail log failed:", err);
  }

  return { delivered, note };
}

export function verificationMail(email: string, name: string, link: string, code?: string): MailDraft {
  const codeLine = code
    ? `\n\nPrefer a code instead? Enter this 6-digit code on the verification screen: ${code}\nThe code is valid for 10 minutes.`
    : "";
  return {
    to: email,
    subject: "Verify your Burnout Wheels account",
    body: `Hi ${name || "racer"},\n\nConfirm this address to activate your Burnout Wheels account:\n${link}\n\nThe link is valid for 24 hours.${codeLine}\n\n— Burnout Wheels crew`,
  };
}

export function otpMail(email: string, code: string): MailDraft {
  return {
    to: email,
    subject: "Your Burnout Wheels verification code",
    body: `Hi racer,\n\nYour Burnout Wheels verification code is:\n\n${code}\n\nIt's valid for 10 minutes and works once. Never share this code — nobody from Burnout Wheels will ever ask for it.\n\n— Burnout Wheels crew`,
  };
}

export function resetMail(email: string, link: string): MailDraft {
  return {
    to: email,
    subject: "Reset your Burnout Wheels password",
    body: `Someone requested a password reset for this address.\n\nReset link (valid 1 hour):\n${link}\n\nIf that wasn't you, ignore this message — the old password stays valid.\n\n— Burnout Wheels crew`,
  };
}
