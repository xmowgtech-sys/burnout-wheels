import { Suspense } from "react";
import { ResetForm } from "@/components/store/auth-forms";

export const metadata = { title: "Reset password", robots: { index: false } };

export default function ResetPage() {
  return (
    <main className="min-h-[80vh] pt-24">
      <Suspense fallback={null}>
        <ResetForm />
      </Suspense>
    </main>
  );
}
