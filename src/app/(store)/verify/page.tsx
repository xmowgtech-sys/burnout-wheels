import Link from "next/link";
import { CheckCircle2, Clock, ShieldCheck, Mail } from "lucide-react";
import { OtpVerify } from "@/components/store/otp-verify";

export const metadata = { title: "Email verification", robots: { index: false } };

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; email?: string }>;
}) {
  const { status, email } = await searchParams;
  return (
    <main className="flex min-h-[70vh] items-start justify-center px-4 pt-32 md:pt-36">
      <div className="u-card w-full max-w-md p-6 text-center sm:p-8">
        {status === "expired" || status === "bad" ? (
          <div className="text-center">
            <Clock className="mx-auto size-8 text-yellow" aria-hidden />
            <h1 className="u-h2 mt-4">Link expired</h1>
            <p className="mt-3 text-[13px] leading-relaxed text-fog">
              Verification links are single-use and last 24 hours. Try the email link again — or simply enter the 6-digit code that shipped with it, below.
            </p>
            <OtpVerify initialEmail={email ?? ""} />
          </div>
        ) : (
          <>
            <CheckCircle2 className="mx-auto size-8 text-mint" aria-hidden />
            <h1 className="u-h2 mt-4">Verify your email</h1>
            <p className="mt-3 text-[13px] leading-relaxed text-fog">
              <Mail className="mr-1 inline size-3.5" aria-hidden /> Two ways in: click the link in your verification email, or paste the 6-digit code below. Codes last 10 minutes.
            </p>
            <OtpVerify initialEmail={email ?? ""} />
          </>
        )}

        <div className="mt-6 flex flex-wrap justify-center gap-2 border-t border-line pt-5">
          <p className="u-label-txt flex items-center gap-1.5"><ShieldCheck className="size-3.5 text-mint" aria-hidden /> Codes work once — nobody can reuse them.</p>
        </div>
        <Link href="/login" className="u-btn u-btn-ghost mt-5 inline-flex">Back to sign in</Link>
      </div>
    </main>
  );
}
