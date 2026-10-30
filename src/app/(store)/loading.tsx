import { Skeleton } from "@/components/ui";

export default function StoreLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 pb-20 pt-28 md:px-8 md:pt-36">
      <Skeleton className="h-3 w-28" />
      <Skeleton className="mt-4 h-14 w-3/4" />
      <Skeleton className="mt-2 h-14 w-1/2" />
      <Skeleton className="mt-6 h-4 w-96 max-w-full" />
      <div className="mt-12 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i}>
            <Skeleton className="aspect-[4/3] w-full" />
            <Skeleton className="mt-3 h-3 w-24" />
            <Skeleton className="mt-2 h-5 w-3/4" />
          </div>
        ))}
      </div>
    </div>
  );
}
