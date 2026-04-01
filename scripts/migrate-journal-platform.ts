import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { resolve } from "path";
import { readFileSync } from "fs";

config({ path: resolve(process.cwd(), ".env.local") });

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const sql = readFileSync(
    resolve(process.cwd(), "scripts/migrate-journal-platform.sql"),
    "utf-8",
  );

  const statements = sql
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s && !s.startsWith("--"));

  for (const stmt of statements) {
    console.log("Running:", stmt.slice(0, 80) + "...");
    const { error } = await supabase.rpc("exec_sql" as any, { query: stmt });
    if (error) {
      console.log("  RPC failed, trying raw query via REST...");
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/exec_sql`,
        {
          method: "POST",
          headers: {
            apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
            Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ query: stmt }),
        },
      );
      if (!res.ok) {
        console.log(`  REST also failed (${res.status}). Run manually in Supabase SQL editor.`);
      }
    } else {
      console.log("  OK");
    }
  }

  // Verify columns exist by querying
  const { data, error: verifyErr } = await supabase
    .from("journal_entries")
    .select("id, is_public, slug, linked_trades")
    .limit(1);

  if (verifyErr) {
    console.log("\nVerification FAILED:", verifyErr.message);
    console.log("\nPlease run scripts/migrate-journal-platform.sql manually in the Supabase Dashboard SQL Editor.");
  } else {
    console.log("\nVerification OK — new columns exist:", Object.keys(data?.[0] ?? {}));
  }
}

main();
