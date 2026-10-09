import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";
import ts from "typescript";

function load(path, dependencies) {
  const exports = {};
  const { outputText } = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  });
  vm.runInNewContext(outputText, { exports, require(name) {
    if (name === "server-only") return {};
    if (name in dependencies) return dependencies[name];
    throw new Error(`Unexpected dependency: ${name}`);
  } });
  return exports;
}
const { ApiError } = load("../src/lib/errors.ts", {});
const listing = (language) => ({ language, title: "App", shortDescription: "Read books", fullDescription: "Track reading", video: "https://example.com/video" });
const unsupported = (language) => ({ response: { data: { error: { message: `The requested language is not currently supported: ${language}.` } } } });

function service(failures = {}, commitFailure) {
  const calls = [];
  const google = {
    googleMessage: (e) => e.response?.data?.error?.message ?? e.message,
    async writeInEdit(pkg, fn) {
      calls.push("begin");
      try {
        const result = await fn("edit-1", { edits: { listings: { async update(input) {
          calls.push(input.language);
          if (failures[input.language]) throw failures[input.language];
          assert.equal(input.requestBody.video, listing(input.language).video);
        } } } });
        if (commitFailure) throw commitFailure;
        calls.push("commit");
        return { result, sentForReview: true };
      } catch (e) {
        calls.push("discard");
        throw e;
      }
    },
  };
  const play = load("../src/lib/play.ts", { "./google": google, "./errors": { ApiError } });
  return { save: (langs, partial = true) => play.saveListings("com.example.app", langs.map(listing), partial), calls };
}

for (const langs of [["uz", "ar", "vi"], ["ar", "uz", "vi"], ["ar", "vi", "uz"]]) {
  test(`unsupported language is isolated in batch ${langs.join(",")}`, async () => {
    const { save, calls } = service({ uz: unsupported("uz") });
    const { result } = await save(langs);
    assert.deepEqual(Array.from(result.saved), ["ar", "vi"]);
    assert.equal(result.failed.length, 1);
    assert.equal(result.failed[0].language, "uz");
    assert.match(result.failed[0].error.message, /Google Play.*uz/);
    assert.deepEqual(calls, ["begin", ...langs, "commit"]);
  });
}

test("all unsupported languages discard the edit without a commit", async () => {
  const { save, calls } = service({ uz: unsupported("uz"), xx: unsupported("xx") });
  await assert.rejects(save(["uz", "xx"]), /uz.*xx/);
  assert.deepEqual(calls, ["begin", "uz", "xx", "discard"]);
});

test("normal listing saves retain atomic behavior", async () => {
  const { save, calls } = service({ uz: unsupported("uz") });
  await assert.rejects(save(["ar", "uz", "vi"], false));
  assert.deepEqual(calls, ["begin", "ar", "uz", "discard"]);
});

test("global update failures and mismatched locale errors abort the edit", async () => {
  for (const error of [new Error("Permission denied"), new Error("Edit has been deleted"), unsupported("other")]) {
    const { save, calls } = service({ uz: error });
    await assert.rejects(save(["ar", "uz", "vi"]));
    assert.deepEqual(calls, ["begin", "ar", "uz", "discard"]);
  }
});

test("commit failure never returns successful locale results", async () => {
  const { save, calls } = service({ uz: unsupported("uz") }, new Error("Commit failed"));
  await assert.rejects(save(["ar", "uz", "vi"]), /Commit failed/);
  assert.equal(calls.at(-1), "discard");
});

test("select all missing locales ignores search and excludes existing locales and source", () => {
  const { LANGUAGES } = load("../src/lib/tracks.ts", {});
  assert.equal(LANGUAGES.some((l) => l.code === "uz"), false);
  const states = [];
  let cursor = 0;
  const jsx = (type, props) => ({ type, props });
  const existing = [listing("en-US"), listing("uk"), listing("ar")];
  const ui = new Proxy({ useToast: () => () => {}, cn: () => "" }, { get: (target, key) => target[key] ?? key });
  const page = load("../src/app/(panel)/apps/[pkg]/localize/page.tsx", {
    react: { useState(initial) {
      const i = cursor++;
      if (!(i in states)) states[i] = initial;
      return [states[i], (v) => { states[i] = typeof v === "function" ? v(states[i]) : v; }];
    } },
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "next/link": "Link",
    "lucide-react": new Proxy({}, { get: (_, key) => key }),
    "@/components/ui": ui,
    "@/components/apps-context": { useApp: () => ({ pkg: "com.example.app" }) },
    "@/lib/client": { enc: encodeURIComponent },
    "@/lib/hooks": { useApi: (url) => ({ data: url === "/api/status" ? { openai: { configured: true, model: "test" } } : { listings: existing } }) },
    "@/lib/tracks": { LANGUAGES, languageName: (code) => code },
  });
  function render() { cursor = 0; return page.default(); }
  function nodes(tree) {
    if (Array.isArray(tree)) return tree.flatMap(nodes);
    if (!tree || typeof tree !== "object") return [];
    return [tree, ...nodes(tree.props?.children)];
  }
  nodes(render()).find((n) => n.props?.placeholder === "Пошук мови…").props.onChange({ target: { value: "Vietnamese" } });
  const filtered = nodes(render());
  assert.equal(filtered.filter((n) => n.type === "input" && n.props.checked === false).length, 1);
  filtered.find((n) => n.type === "Button" && JSON.stringify(n.props.children).includes("Усі без перекладу")).props.onClick();
  const targets = states[1];
  assert.deepEqual(Array.from(targets), Array.from(LANGUAGES.filter((l) => !existing.some((e) => e.language === l.code)), (l) => l.code));
  assert.ok(targets.includes("vi") && targets.includes("de-DE"));
});
