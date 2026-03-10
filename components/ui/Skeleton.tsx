interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = "" }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse rounded bg-[#1e2130] ${className}`}
    />
  );
}

export function SkeletonText({ className = "", width = "w-20" }: SkeletonProps & { width?: string }) {
  return <Skeleton className={`h-4 ${width} ${className}`} />;
}

export function SkeletonHeading({ className = "", width = "w-32" }: SkeletonProps & { width?: string }) {
  return <Skeleton className={`h-8 ${width} ${className}`} />;
}

export function SkeletonCard({ className = "" }: SkeletonProps) {
  return (
    <div className={`bg-[#141620] border border-[#2a2e3e] rounded-xl px-4 py-3.5 space-y-2 ${className}`}>
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-6 w-20" />
    </div>
  );
}

export function SkeletonRow({ cols = 4, className = "" }: SkeletonProps & { cols?: number }) {
  return (
    <div className={`flex items-center gap-4 px-4 py-3 ${className}`}>
      {Array.from({ length: cols }).map((_, i) => (
        <Skeleton key={i} className="h-4 flex-1" />
      ))}
    </div>
  );
}

export function SkeletonChart({ className = "" }: SkeletonProps) {
  return (
    <div className={`bg-[#141620] border border-[#2a2e3e] rounded-xl p-6 flex items-center justify-center ${className}`}>
      <Skeleton className="w-40 h-40 rounded-full" />
    </div>
  );
}
