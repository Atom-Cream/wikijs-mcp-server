/**
 * Sentry initialization — error monitoring.
 *
 * This module is imported FIRST in server.ts (before any other import) so the
 * Sentry client is set up before the app starts handling requests.
 *
 * Sentry is fully opt-in: if SENTRY_DSN is not set, init() is skipped and every
 * Sentry.* call elsewhere becomes a no-op, so behavior is unchanged when the
 * DSN is absent.
 *
 * Scope: errors only. No performance tracing (tracesSampleRate is 0), and PII
 * (user emails, IPs, request bodies) is not attached by default.
 */
import * as Sentry from "@sentry/node";
import { config as dotenvConfig } from "dotenv";
import { readFileSync } from "fs";

// Load .env before reading SENTRY_* — this module runs before server.ts body.
dotenvConfig();

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  // Tag events with the package version so Sentry groups issues by release
  // (e.g. "wikijs-mcp@2.1.0"). Allow an explicit override via SENTRY_RELEASE.
  let release: string | undefined = process.env.SENTRY_RELEASE;
  if (!release) {
    try {
      const pkg = JSON.parse(
        readFileSync(new URL("../package.json", import.meta.url), "utf8")
      );
      release = `wikijs-mcp@${pkg.version}`;
    } catch {
      release = undefined;
    }
  }

  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT || "production",
    release,
    // Errors only — no performance/tracing spans.
    tracesSampleRate: 0,
    // Don't attach PII (user emails, client IPs, request bodies) by default.
    sendDefaultPii: false,
  });

  console.log(
    `[Sentry] initialized (release: ${release ?? "unknown"}, env: ${
      process.env.SENTRY_ENVIRONMENT || "production"
    })`
  );
} else {
  console.log("[Sentry] SENTRY_DSN not set — Sentry disabled");
}

export { Sentry };
