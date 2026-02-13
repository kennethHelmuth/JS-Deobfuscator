/**
 * lib/index.js
 *
 * Core orchestration: parse, run passes, generate code, produce report.
 *
 * NOTE: This module NEVER executes input code. All transforms are static AST rewrites.
 */

/* eslint-disable no-console */
const parser = require("@babel/parser");
const traverse = require("@babel/traverse").default;
const generator = require("@babel/generator").default;
const t = require("@babel/types");

const stringArrayResolver = require("./passes/stringArrayResolver");
const hexBase64Decoder = require("./passes/hexBase64Decoder");
const constantFolding = require("./passes/constantFolding");
const junkRemoval = require("./passes/junkRemoval");
const identifierRenamer = require("./passes/identifierRenamer");

const DEFAULT_PASSES = ["stringArray", "hexBase64", "constFold", "junk", "idRename"];

/**
 * Deobfuscate code string with options.
 * Returns { code, report }.
 *
 * @param {string} src
 * @param {object} options
 * @returns {{code: string, report: object}}
 */
function deobfuscate(src, options = {}) {
  const passesRequested = options.passes && options.passes.length ? options.passes : DEFAULT_PASSES;
  const rename = options.rename !== false;
  const verbose = options.verbose || false;

  const ast = parser.parse(src, {
    sourceType: "unambiguous",
    plugins: ["jsx", "classProperties", "optionalChaining"]
  });

  const report = {
    passes_applied: [],
    strings_decoded: 0,
    constants_folded: 0,
    functions_inlined: 0,
    identifiers_renamed: 0,
    dead_blocks_removed: 0,
    notes: []
  };

  function runPass(name, fn) {
    if (!passesRequested.includes(name)) {
      if (verbose) console.error("Skipping pass", name);
      return;
    }
    try {
      const stats = fn(ast, { verbose });
      report.passes_applied.push(name);
      // merge stats
      Object.keys(stats || {}).forEach(k => {
        if (typeof stats[k] === "number") report[k] = (report[k] || 0) + stats[k];
        else if (stats[k]) report.notes.push(`${name}:${k}=${JSON.stringify(stats[k])}`);
      });
      if (verbose) console.error("Pass", name, "done:", stats);
    } catch (e) {
      report.notes.push(`${name}-error:${e.message}`);
      if (verbose) console.error("Pass error", name, e && e.stack ? e.stack : e);
    }
  }

  // 1. Resolve string arrays (common obfuscator pattern)
  runPass("stringArray", stringArrayResolver);

  // 2. decode hex/unicode literals and base64 uses
  runPass("hexBase64", hexBase64Decoder);

  // 3. simple decoder function inlining is part of stringArrayResolver/hexBase64 in limited scope (implemented in those modules)

  // 4. constant folding
  runPass("constFold", constantFolding);

  // 5. junk removal
  runPass("junk", junkRemoval);

  // 6. identifier renaming (if enabled)
  if (rename) {
    runPass("idRename", identifierRenamer);
  }

  // generate code
  const out = generator(ast, { comments: true, compact: false }, src);

  // Basic syntactic sanity: ensure output is non-empty
  return { code: out.code || "", report };
}

module.exports = { deobfuscate };
