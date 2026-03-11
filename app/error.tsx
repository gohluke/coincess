"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Coincess error boundary]", error);
  }, [error]);

  return (
    <div className="flex items-center justify-center min-h-[60vh] px-6">
      <div className="max-w-md text-center">
        <h2 className="text-xl font-bold text-white mb-2">
          Something went wrong
        </h2>
        <p className="text-sm text-[#848e9c] mb-6 leading-relaxed">
          {error.message || "An unexpected error occurred."}
        </p>
        {error.digest && (
          <p className="text-[11px] text-[#555a66] font-mono mb-6">
            Digest: {error.digest}
          </p>
        )}
        <button
          onClick={reset}
          className="px-6 py-2.5 rounded-xl bg-brand hover:bg-brand-hover text-white text-sm font-semibold transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
