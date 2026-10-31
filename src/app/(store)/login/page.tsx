import { Suspense } from "react";
import { LoginForm } from "@/components/store/auth-forms";

export const metadata = {
  title: "Sign in",
  description: "Sign in to Burnout Wheels — Google or email, orders and tracking in one paddock.",
};

export default function LoginPage() {
  return (
    <main className="min-h-[80vh] pt-24">
      <Suspense fallback={null}>
        <LoginForm googleParam={undefined} />
      </Suspense>
    </main>
  );
}
