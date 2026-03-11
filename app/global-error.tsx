"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          backgroundColor: "#0b0e11",
          color: "#eaecef",
          fontFamily: "system-ui, -apple-system, sans-serif",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          margin: 0,
          padding: "1.5rem",
        }}
      >
        <div style={{ maxWidth: 420, textAlign: "center" }}>
          <h1
            style={{
              fontSize: "1.5rem",
              fontWeight: 700,
              marginBottom: "0.75rem",
            }}
          >
            Something went wrong
          </h1>
          <p
            style={{
              fontSize: "0.8125rem",
              color: "#848e9c",
              marginBottom: "1.5rem",
              lineHeight: 1.6,
            }}
          >
            {error.message || "An unexpected error occurred."}
          </p>
          {error.digest && (
            <p
              style={{
                fontSize: "0.6875rem",
                color: "#555a66",
                fontFamily: "monospace",
                marginBottom: "1.5rem",
              }}
            >
              Digest: {error.digest}
            </p>
          )}
          <button
            onClick={reset}
            style={{
              padding: "0.625rem 1.5rem",
              borderRadius: "0.75rem",
              backgroundColor: "#FF455B",
              color: "#fff",
              border: "none",
              fontWeight: 600,
              fontSize: "0.8125rem",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
