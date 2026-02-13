/**
 * stringArrayResolver.js
 *
 * Heuristically resolve and inline simple string-array obfuscation patterns:
 * var _0xabc = ["foo","bar"]; then code uses _0xabc[0] or _0xabc['0x0'] or _0xabc["0"]
 *
 * Limitations: only inlines accesses with numeric literals and whose array elements are string literals.
 */

const traverse = require("@babel/traverse").default;
const t = require("@babel/types");

module.exports = function stringArrayResolver(ast, opts = {}) {
  const verbose = !!opts.verbose;
  const candidates = new Map();
  let decodedCount = 0;
  let removedArrays = 0;

  traverse(ast, {
    VariableDeclarator(path) {
      try {
        const id = path.node.id;
        const init = path.node.init;
        if (t.isIdentifier(id) && t.isArrayExpression(init)) {
          // all elements must be string literals to consider
          const elems = init.elements;
          if (!elems || elems.length === 0) return;
          if (elems.every(e => t.isStringLiteral(e))) {
            const name = id.name;
            const arr = elems.map(e => e.value);
            candidates.set(name, { arr, declPath: path });
            if (verbose) console.error("Found string array", name, arr.length);
          }
        }
      } catch (e) {
        if (verbose) console.error("stringArrayResolver var error", e.message);
      }
    }
  });

  // Replace member expressions like arr[0] or arr['0x1'] with string literal
  traverse(ast, {
    MemberExpression(path) {
      try {
        const obj = path.node.object;
        const prop = path.node.property;
        if (t.isIdentifier(obj) && !path.node.computed === false) {
          const name = obj.name;
          if (!candidates.has(name)) return;
          // require computed member: arr[...]
          if (!path.node.computed) return;
          let idx = null;
          if (t.isNumericLiteral(prop)) idx = prop.value;
          else if (t.isStringLiteral(prop)) {
            // could be "0x1" etc.
            const str = prop.value;
            if (/^0x[0-9a-f]+$/i.test(str)) idx = parseInt(str, 16);
            else if (/^\d+$/.test(str)) idx = parseInt(str, 10);
          } else if (t.isUnaryExpression(prop) && prop.operator === "-" && t.isNumericLiteral(prop.argument)) {
            idx = -prop.argument.value;
          }
          if (idx === null) return;
          const arr = candidates.get(name).arr;
          if (idx < 0 || idx >= arr.length) return;
          const val = arr[idx];
          path.replaceWith(t.stringLiteral(val));
          decodedCount++;
        }
      } catch (e) {
        if (verbose) console.error("stringArrayResolver member error", e.message);
      }
    }
  });

  // remove unused arrays
  for (const [name, { declPath }] of candidates) {
    try {
      const binding = declPath.scope.getBinding(name);
      if (!binding) continue;
      // if there are no references left, remove declaration
      if (binding.referencePaths.length === 0) {
        const parent = declPath.parentPath;
        declPath.remove();
        // If the VariableDeclaration now has no declarations, remove it
        if (parent && parent.node && parent.node.declarations && parent.node.declarations.length === 0) {
          parent.remove();
        }
        removedArrays++;
      }
    } catch (e) {
      if (verbose) console.error("stringArrayResolver remove error", e.message);
    }
  }

  return { strings_decoded: decodedCount, removed_arrays: removedArrays };
};
