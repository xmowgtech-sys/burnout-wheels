import { Suspense } from "react";
import { SignupForm } from "@/components/store/auth-forms";

export const metadata = {
  title: "Create account",
  description: "Join the Burnout Wheels paddock — email or Google, verified in one link.",
};

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ google?: string; reason?: string }>;
}) {
  const sp = await searchParams;
  return (
    <main className="min-h-[80vh] pt-24">
      <Suspense fallback={null}>
        <SignupForm googleParam={sp.google} googleReason={sp.reason} />
      </Suspense>
    </main>
  );
}
