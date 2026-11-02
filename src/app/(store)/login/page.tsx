import { Suspense } from "react";
import { LoginForm } from "@/components/store/auth-forms";

export const metadata = {
  title: "Sign in",
  description: "Sign in to Burnout Wheels — Google, OTP or email, orders and tracking in one paddock.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ google?: string; reason?: string }>;
}) {
  const sp = await searchParams;
  return (
    <main className="min-h-[80vh] pt-24">
      <Suspense fallback={null}>
        <LoginForm googleParam={sp.google} googleReason={sp.reason} />
      </Suspense>
    </main>
  );
}
