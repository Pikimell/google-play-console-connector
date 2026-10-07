import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
class ApiError extends Error {
  constructor(status, message, hint) {
    super(message);
    Object.assign(this, { status, hint });
  }
}

function setup({ existing = [], failUpload, failCommit } = {}) {
  const calls = { edits: 0, commits: 0, rollbacks: 0, streams: [], bytes: [], delays: [] };
  const source = readFileSync(new URL("../src/lib/image-upload.ts", import.meta.url), "utf8");
  const testModule = { exports: {} };
  vm.runInNewContext(ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, {
    module: testModule, exports: testModule.exports, Buffer,
    require(id) {
      if (id === "server-only") return {};
      if (id === "./errors") return { ApiError };
      if (id === "node:timers/promises") return { setTimeout: async (ms) => calls.delays.push(ms) };
      if (id === "./google") return {
        async writeInEdit(pkg, callback) {
          calls.edits++;
          try {
            const result = await callback(`edit-${calls.edits}`, { edits: { images: {
              list: async () => ({ data: { images: existing } }),
              deleteall: async () => {},
              upload: async ({ media }, options) => {
                assert.equal(options.retry, false);
                calls.streams.push(media.body);
                const chunks = [];
                for await (const chunk of media.body) chunks.push(chunk);
                calls.bytes.push(Buffer.concat(chunks).toString());
                const error = failUpload?.(calls.streams.length);
                if (error) throw error;
                return { data: { image: { id: String(calls.streams.length) } } };
              },
            } } });
            calls.commits++;
            if (failCommit) throw failCommit;
            return { result, sentForReview: true };
          } catch (error) {
            calls.rollbacks++;
            throw error;
          }
        },
      };
      return require(id);
    },
  });
  return { upload: testModule.exports.uploadImages, calls };
}

const files = ["first", "second"].map((text) => ({ mimeType: "image/png", buffer: Buffer.from(text) }));
const unavailable = { response: { status: 503 } };

test("two new screenshots are uploaded in one edit before one commit", async () => {
  const { upload, calls } = setup();
  const result = await upload("com.example.app", "en-US", "phoneScreenshots", files);
  assert.equal(result.result.length, 2);
  assert.equal(calls.edits, 1);
  assert.equal(calls.commits, 1);
  assert.deepEqual(calls.bytes, ["first", "second"]);
});

test("503 after a partial upload rolls back and recreates every stream", async () => {
  const { upload, calls } = setup({ failUpload: (n) => n === 2 && unavailable });
  await upload("com.example.app", "en-US", "phoneScreenshots", files);
  assert.equal(calls.rollbacks, 1);
  assert.equal(calls.edits, 2);
  assert.equal(calls.commits, 1);
  assert.deepEqual(calls.bytes, ["first", "second", "first", "second"]);
  assert.equal(new Set(calls.streams).size, 4);
  assert.deepEqual(calls.delays, [1000]);
});

test("persistent 503 stops after three attempts with an actionable error", async () => {
  const { upload, calls } = setup({ failUpload: () => unavailable });
  await assert.rejects(upload("com.example.app", "en-US", "phoneScreenshots", files),
    (e) => e.status === 503 && e.hint.includes("кілька хвилин"));
  assert.equal(calls.edits, 3);
  assert.equal(calls.commits, 0);
  assert.deepEqual(calls.delays, [1000, 2000]);
});

test("ambiguous commit failure never repeats uploads", async () => {
  const { upload, calls } = setup({ failCommit: unavailable });
  await assert.rejects(upload("com.example.app", "en-US", "phoneScreenshots", files),
    (e) => e.status === 503 && e.hint.includes("перевір графіку"));
  assert.equal(calls.edits, 1);
  assert.equal(calls.streams.length, 2);
});

test("one first screenshot and exceeding eight are rejected before uploading", async () => {
  for (const existing of [[], Array(8).fill({ id: "existing" })]) {
    const { upload, calls } = setup({ existing });
    await assert.rejects(upload("com.example.app", "en-US", "phoneScreenshots", files.slice(0, 1)),
      (e) => e.status === 400);
    assert.equal(calls.streams.length, 0);
    assert.equal(calls.commits, 0);
  }
});

test("one screenshot can be added when one already exists", async () => {
  const { upload, calls } = setup({ existing: [{ id: "existing" }] });
  await upload("com.example.app", "en-US", "phoneScreenshots", files.slice(0, 1));
  assert.equal(calls.commits, 1);
});

test("validation errors are not retried", async () => {
  const failure = { response: { status: 400 } };
  const { upload, calls } = setup({ failUpload: () => failure });
  await assert.rejects(upload("com.example.app", "en-US", "phoneScreenshots", files), (e) => e === failure);
  assert.equal(calls.edits, 1);
  assert.equal(calls.delays.length, 0);
});

test("invalid file content and multiple icons fail before creating an edit", async () => {
  for (const [type, input] of [
    ["icon", files],
    ["icon", [{ mimeType: "image/gif", buffer: Buffer.from("gif") }]],
    ["icon", [{ mimeType: "image/png", buffer: Buffer.alloc(0) }]],
    ["icon", [{ mimeType: "image/png", buffer: Buffer.alloc(15 * 1024 * 1024 + 1) }]],
  ]) {
    const { upload, calls } = setup();
    await assert.rejects(upload("com.example.app", "en-US", type, input), (e) => e.status === 400);
    assert.equal(calls.edits, 0);
  }
});

function loadRoute() {
  const calls = [];
  const testModule = { exports: {} };
  const source = readFileSync(new URL("../src/app/api/apps/[pkg]/images/route.ts", import.meta.url), "utf8");
  vm.runInNewContext(ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, {
    module: testModule, exports: testModule.exports, Buffer, URL,
    require(id) {
      if (id === "@/lib/route") return { route: (handler) => handler };
      if (id === "@/lib/errors") return { ApiError };
      if (id === "@/lib/play") return { IMAGE_TYPES: ["icon", "phoneScreenshots"] };
      if (id === "@/lib/image-upload") return {
        uploadImages: async (...args) => {
          calls.push(args);
          return { result: [{ id: "image" }], sentForReview: true };
        },
      };
      throw new Error(`Unexpected dependency: ${id}`);
    },
  });
  return { post: testModule.exports.POST, calls };
}

const imageUrl = "http://localhost:3000/api/apps/com.example.app/images?language=en-US&type=phoneScreenshots";

test("multipart API passes all selected files to one upload operation", async () => {
  const { post, calls } = loadRoute();
  const form = new FormData();
  form.append("files", new File(["first"], "one.png", { type: "image/png" }));
  form.append("files", new File(["second"], "two.jpg", { type: "image/jpeg" }));
  const result = await post(new Request(imageUrl, { method: "POST", body: form }), { pkg: "com.example.app" });
  assert.equal(calls.length, 1);
  assert.deepEqual(Array.from(calls[0][3], (file) => file.buffer.toString()), ["first", "second"]);
  assert.equal(calls[0][3][1].mimeType, "image/jpeg");
  assert.equal(result.image.id, "image");
});

test("raw image API remains supported", async () => {
  const { post, calls } = loadRoute();
  await post(new Request(imageUrl, { method: "POST", headers: { "Content-Type": "image/png" }, body: "first" }), { pkg: "com.example.app" });
  assert.equal(calls[0][3][0].buffer.toString(), "first");
});

test("multipart text fields are rejected instead of treated as files", async () => {
  const { post, calls } = loadRoute();
  const form = new FormData();
  form.append("files", "invalid");
  await assert.rejects(post(new Request(imageUrl, { method: "POST", body: form }), { pkg: "com.example.app" }), (e) => e.status === 400);
  assert.equal(calls.length, 0);
});
