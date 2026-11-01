import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { createHash } from "node:crypto";
import type { ConnectionSettings } from "./connection-settings";
import type { Publisher } from "./google";

const context = new AsyncLocalStorage<{ settings: ConnectionSettings; publisher?: Publisher }>();
export const withConnection = (settings: ConnectionSettings, fn: () => Promise<Response>) => context.run({ settings }, fn);
export function connectionContext() {
  const value = context.getStore();
  if (!value) throw new Error("Connection request context missing");
  return value;
}
export function connectionIdentity() {
  return createHash("sha256").update(JSON.stringify(connectionContext().settings.google ?? {})).digest("hex");
}
