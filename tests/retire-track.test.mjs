import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";
import ts from "typescript";

// Execute the real service with a fake Publisher; never contact Google Play.
const source = readFileSync(new URL("../src/lib/play.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
});
const pkg = "com.example.app";
const track = "alpha";
const params = { packageName: pkg, editId: "edit-1", track };

function service({ releases = [], googleGroups, failAt } = {}) {
  const calls = [];
  function request(name, data) {
    return async (input) => {
      calls.push({ name, input: JSON.parse(JSON.stringify(input)) });
      if (failAt === name) throw new Error("Internal error encountered.");
      return { data };
    };
  }
  const api = { edits: {
    tracks: { get: request("tracks.get", { releases }), update: request("tracks.update", {}) },
    testers: { get: request("testers.get", { googleGroups }), update: request("testers.update", {}) },
  } };
  const google = {
    async writeInEdit(packageName, fn) {
      assert.equal(packageName, pkg);
      calls.push({ name: "edit.begin" });
      try {
        const result = await fn(params.editId, api);
        calls.push({ name: "edit.commit" });
        return { result, sentForReview: false };
      } catch (error) {
        calls.push({ name: "edit.discard" });
        throw error;
      }
    },
  };
  const exports = {};
  vm.runInNewContext(outputText, {
    exports,
    require(name) {
      if (name === "server-only") return {};
      if (name === "./google") return google;
      if (name === "./errors") return { ApiError: Error };
      throw new Error(`Unexpected dependency: ${name}`);
    },
  });
  return { retire: (opts) => exports.retireTrack(pkg, track, opts), calls };
}

for (const releases of [
  [{ status: "completed", versionCodes: ["1"] }],
  [{ status: "inProgress", userFraction: 0.1, versionCodes: ["2"] }],
  [{ status: "halted", versionCodes: ["2"] }, { status: "completed", versionCodes: ["1"] }, { status: "draft", versionCodes: ["3"] }],
]) {
  test(`remove all track artifacts (${releases.map((r) => r.status).join(", ")})`, async () => {
    const { retire, calls } = service({ releases, googleGroups: ["testers@example.com"] });
    const result = await retire({ halt: true, clearTesters: true });
    assert.equal(result.sentForReview, false);
    assert.deepEqual(calls.find((c) => c.name === "tracks.update").input, { ...params, requestBody: { track, releases: [] } });
    assert.deepEqual(calls.find((c) => c.name === "testers.update").input, { ...params, requestBody: { googleGroups: [] } });
    assert.equal(calls.at(-1).name, "edit.commit");
  });
}

test("skip empty tracks and absent Google groups (manual email lists are untouched)", async () => {
  const { retire, calls } = service();
  await retire({ halt: true, clearTesters: true });
  assert.deepEqual(calls.map((c) => c.name), ["edit.begin", "tracks.get", "testers.get", "edit.commit"]);
});

test("respect independent removal options", async () => {
  for (const opts of [{ halt: true, clearTesters: false }, { halt: false, clearTesters: true }]) {
    const { retire, calls } = service({ releases: [{ status: "completed" }], googleGroups: ["testers@example.com"] });
    await retire(opts);
    assert.equal(calls.some((c) => c.name.startsWith("tracks.")), opts.halt);
    assert.equal(calls.some((c) => c.name.startsWith("testers.")), opts.clearTesters);
  }
});

test("local hiding alone does not open a Google edit", async () => {
  const { retire, calls } = service();
  const result = await retire({ halt: false, clearTesters: false });
  assert.equal(result.sentForReview, true);
  assert.equal(calls.length, 0);
});

test("propagate update failures and do not commit a partial retirement", async () => {
  for (const failAt of ["tracks.update", "testers.update"]) {
    const { retire, calls } = service({ releases: [{ status: "completed" }], googleGroups: ["testers@example.com"], failAt });
    await assert.rejects(retire({ halt: true, clearTesters: true }), /Internal error encountered/);
    assert.equal(calls.at(-1).name, "edit.discard");
    assert.equal(calls.some((c) => c.name === "edit.commit"), false);
  }
});
