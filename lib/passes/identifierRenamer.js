/**
 * identifierRenamer.js
 *
 * Rename obfuscated identifiers like _0x12af -> var_1 using Babel scope.rename.
 * Preserves globals (do not rename when binding is global) and built-ins.
 */

const traverse = require("@babel/traverse").default;
const t = require("@babel/types");

const RESERVED = new Set([
  "undefined", "NaN", "Infinity", "console", "window", "global", "require", "module", "exports", "process"
]);

module.exports = function identifierRenamer(ast, opts = {}) {
  const verbose = !!opts.verbose;
  let renamed = 0;
  let counter = 1;

  traverse(ast, {
    Program(path) {
      // Collect candidate bindings with obfuscated names
      const bindings = path.scope.bindings;
      for (const name of Object.keys(bindings)) {
        if (RESERVED.has(name)) continue;
        // heuristic: names starting with _0x or at least contain hex-like fragment
        if (/^_?0x[0-9a-fA-F]+$/.test(name) || /^_0x/.test(name) || /^[a-zA-Z]{1}_\d+$/.test(name)) {
          const binding = bindings[name];
          // skip globals / module scope unresolved
          if (!binding || !binding.scope || binding.scope.block.type === "Program") {
            // it's top-level binding; still allow rename if local var? skip top-level to be safe
            continue;
          }
          const newName = `var_${counter++}`;
          try {
            binding.scope.rename(name, newName);
            renamed++;
          } catch (e) {
            if (verbose) console.error("rename failed", name, e && e.message);
          }
        }
      }
    }
  });

  return { identifiers_renamed: renamed };
};
