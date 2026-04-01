import { config } from "dotenv";
config();

import { startAlertEngine } from "./alert-engine.js";

console.log("=== Coincess Monitor ===");
console.log(`Started at ${new Date().toISOString()}`);
console.log(`Node ${process.version}`);

startAlertEngine().catch((err) => {
  console.error("[monitor] Fatal:", err);
  process.exit(1);
});

process.on("uncaughtException", (err) => {
  console.error("[monitor] Uncaught:", err);
});

process.on("unhandledRejection", (err) => {
  console.error("[monitor] Unhandled rejection:", err);
});

process.on("SIGTERM", () => {
  console.log("[monitor] SIGTERM received, shutting down");
  process.exit(0);
});
