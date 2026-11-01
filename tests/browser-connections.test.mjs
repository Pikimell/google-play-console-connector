import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
function load(path, dependencies = {}, globals = {}) {
  const exports = {};
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
    { exports, Buffer, TextEncoder, URL, ...globals, require(id) {
      if (id === "server-only") return {};
      return id in dependencies ? dependencies[id] : require(id);
    } });
  return exports;
}
const settings = load("../src/lib/connection-settings.ts");
const key = email => ({ type: "service_account", client_email: email, private_key: "-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----", project_id: "test" });
function browser() {
  const storage = new Map();
  const localStorage = { getItem: k => storage.get(k) ?? null, setItem: (k,v) => storage.set(k,v), removeItem: k => storage.delete(k), key: i => [...storage.keys()][i], get length() { return storage.size; } };
  return load("../src/lib/browser-storage.ts", { "./connection-settings": settings, "./emails": load("../src/lib/emails.ts") },
    { localStorage, window: { location: { origin: "https://panel.example" }, dispatchEvent() {} }, Event, crypto: globalThis.crypto, btoa });
}

test("rejects wrong JSON shape and strips untrusted OAuth endpoints", () => {
  for (const value of [null, [], {}, { type: "authorized_user" }, { ...key("a@example.com"), private_key: 42 }]) {
    assert.throws(() => settings.parseServiceAccount(value));
  }
  const parsed = settings.parseServiceAccount({ ...key("a@example.com"), token_uri: "https://evil.example/token" });
  assert.equal(parsed.token_uri, undefined);
  assert.throws(() => settings.parseSettings({ openaiModel: "../../evil" }));
});

test("browser settings survive reload and credentials are separated by API", () => {
  const b = browser();
  b.saveSettings({ google: key("a@example.com"), openaiKey: "sk-secret", openaiModel: "gpt-5-mini" });
  const sent = url => JSON.parse(Buffer.from(b.connectionHeaders(url)["X-Play-Connection"], "base64").toString());
  assert.equal(b.readSettings().google.client_email, "a@example.com");
  assert.equal(sent("/api/apps").openaiKey, undefined);
  assert.equal(sent("/api/translate").google, undefined);
  assert.equal(sent("/api/translate").openaiKey, "sk-secret");
  assert.throws(() => b.connectionHeaders("https://evil.example/api/status"));
});

test("two browsers and two Google connections have separate lists and tester emails", () => {
  const a = browser(), b = browser();
  a.saveSettings({ google: key("a@example.com") });
  a.remoteResponse("/api/apps", "POST", { app: { packageName: "com.a.app", addedAt: "now" } });
  a.localRequest("/api/tester-groups", "POST", { name: "Readers", emails: "USER@example.com user@example.com" });
  assert.equal(a.localRequest("/api/apps", "GET").data.apps.length, 1);
  assert.equal(a.localRequest("/api/tester-groups", "GET").data.groups[0].emails.length, 1);
  assert.equal(b.localRequest("/api/apps", "GET").data.apps.length, 0);
  assert.equal(b.localRequest("/api/tester-groups", "GET").data.groups.length, 0);
  a.saveSettings({ google: key("b@example.com") });
  assert.equal(a.localRequest("/api/apps", "GET").data.apps.length, 0);
  a.saveSettings({ google: key("a@example.com") });
  assert.equal(a.localRequest("/api/apps", "GET").data.apps.length, 1);
});

test("late API responses stay in the original connection's browser store", () => {
  const b = browser();
  b.saveSettings({ google: key("a@example.com") });
  const scope = b.browserDataKey();
  b.saveSettings({ google: key("b@example.com") });
  b.remoteResponse("/api/apps", "POST", { app: { packageName: "com.a.app", addedAt: "now" } }, scope);
  assert.equal(b.localRequest("/api/apps", "GET").data.apps.length, 0);
  b.saveSettings({ google: key("a@example.com") });
  assert.equal(b.localRequest("/api/apps", "GET").data.apps.length, 1);
});

test("hide, retire, remove and reset affect browser data only", () => {
  const b = browser();
  b.saveSettings({ google: key("a@example.com"), openaiKey: "sk-secret" });
  b.remoteResponse("/api/apps", "POST", { app: { packageName: "com.a.app", addedAt: "now" } });
  b.localRequest("/api/apps/com.a.app/tracks/closed/visibility", "POST", { hidden: true });
  b.remoteResponse("/api/apps/com.a.app/tracks/beta/retire", "POST", { sentForReview: true });
  const response = b.remoteResponse("/api/apps/com.a.app", "GET", { overview: { title: "A" } });
  assert.deepEqual(Array.from(response.hiddenTracks), ["closed", "beta"]);
  b.localRequest("/api/apps/com.a.app", "DELETE");
  assert.equal(b.localRequest("/api/apps", "GET").data.apps.length, 0);
  b.clearBrowserData();
  assert.equal(b.readSettings().openaiKey, undefined);
  assert.equal(b.readSettings().google, undefined);
});

test("Google clients and edits are isolated across overlapping request contexts", async () => {
  const context = load("../src/lib/request-context.ts");
  let created = 0;
  const google = load("../src/lib/google.ts", {
    "./request-context": context,
    "./errors": load("../src/lib/errors.ts"),
    googleapis: { google: { auth: { JWT: class { constructor(options) { this.email = options.email; } } }, androidpublisher: ({ auth }) => ({ auth, id: ++created }) } },
  });
  await Promise.all(["a@example.com", "b@example.com"].map(email => context.withConnection({ google: key(email) }, async () => {
    const publisher = google.getPublisher();
    await new Promise(resolve => setTimeout(resolve, 5));
    assert.equal(google.getPublisher(), publisher);
    assert.equal(publisher.auth.email, email);
  })));
  assert.equal(created, 2);
  const edits = await Promise.all(["a@example.com", "b@example.com"].map(email => context.withConnection({ google: key(email) }, async () => {
    google.pinEdit("com.shared.app", `edit-${email}`);
    await new Promise(resolve => setTimeout(resolve, 5));
    return google.readInEdit("com.shared.app", async id => id);
  })));
  assert.deepEqual(edits, ["edit-a@example.com", "edit-b@example.com"]);
  await context.withConnection({}, async () => {
    assert.equal(google.loadCredentials().ok, false);
    assert.throws(() => google.getPublisher(), /Завантаж JSON/);
  });
});
