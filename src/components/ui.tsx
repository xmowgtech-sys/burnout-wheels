import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("u-skeleton", className)} aria-hidden />;
}

export function SectionHead({
  index,
  title,
  sub,
  align = "left",
}: {
  index: string;
  title: string;
  sub?: string;
  align?: "left" | "center";
}) {
  return (
    <div className={cn(align === "center" && "text-center")}>
      <p className="u-label">
        <span className="text-red">{index}</span> — {title}
      </p>
      {sub ? <p className={cn("mt-2 max-w-xl text-[15px] leading-relaxed text-fog", align === "center" && "mx-auto")}>{sub}</p> : null}
    </div>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="u-card flex flex-col items-center px-6 py-16 text-center">
      <div className="h-1 w-10 u-stripe" aria-hidden />
      <p className="u-h3 mt-6">{title}</p>
      <p className="mt-3 max-w-sm text-[14px] leading-relaxed text-fog">{body}</p>
      {action ? <div className="mt-8">{action}</div> : null}
    </div>
  );
}

export function PageHero({ label, title, sub }: { label: string; title: string; sub: string }) {
  return (
    <header className="relative overflow-hidden border-b border-line">
      <div className="u-gridlines" aria-hidden />
      <div className="mx-auto max-w-7xl px-4 pb-14 pt-28 md:px-8 md:pb-20 md:pt-40">
        <p className="u-label anim-rise">{label}</p>
        <h1 className="u-h1 mt-3 anim-rise" style={{ animationDelay: "60ms" }}>{title}</h1>
        <p className="mt-6 max-w-2xl text-[15px] leading-relaxed text-fog anim-rise" style={{ animationDelay: "120ms" }}>{sub}</p>
      </div>
    </header>
  );
}
