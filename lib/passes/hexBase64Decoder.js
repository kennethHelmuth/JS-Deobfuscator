/**
 * hexBase64Decoder.js
 *
 * Decode static patterns:
 * - string literal contents that include escaped hex / unicode sequences like "\\x41" or "\\u0041"
 * - calls like atob("...") where argument is literal
 * - Buffer.from("...", "base64")
 *
 * All decoding is static using safe Node Buffer methods; no code execution.
 */

const traverse = require("@babel/traverse").default;
const t = require("@babel/types");

function decodeEscapes(s) {
  // handle patterns like \xNN or \uNNNN represented as literal backslashes in source
  // First convert double-escaped sequences \\x41 -> \x41 then decode
  try {
    // replace \xNN with actual byte
    const replaced = s.replace(/\\x([0-9a-fA-F]{2})/g, (m, g1) => {
      return String.fromCharCode(parseInt(g1, 16));
    }).replace(/\\u([0-9a-fA-F]{4})/g, (m, g1) => {
      return String.fromCharCode(parseInt(g1, 16));
    });
    return replaced;
  } catch (e) {
    return s;
  }
}

module.exports = function hexBase64Decoder(ast, opts = {}) {
  const verbose = !!opts.verbose;
  let decoded = 0;

  // decode literal strings with backslash escapes present (common double-escaped)
  traverse(ast, {
    StringLiteral(path) {
      const raw = path.node.extra && path.node.extra.raw ? path.node.extra.raw : null;
      const val = path.node.value || "";
      if (typeof val !== "string") return;
      // If the raw contains double-escaped sequences (e.g. "\\x41"), decode them statically
      if (raw && /\\x[0-9a-fA-F]{2}|\\u[0-9a-fA-F]{4}/.test(raw)) {
        const dec = decodeEscapes(raw);
        if (dec && dec !== val) {
          path.replaceWith(t.stringLiteral(dec));
          decoded++;
        }
      }
    }
  });

  // atob("...") -> decode
  traverse(ast, {
    CallExpression(path) {
      const callee = path.node.callee;
      const args = path.node.arguments || [];
      try {
        // atob("...") pattern
        if (t.isIdentifier(callee) && callee.name === "atob" && args.length === 1 && t.isStringLiteral(args[0])) {
          const b64 = args[0].value;
          try {
            const decodedStr = Buffer.from(b64, "base64").toString("utf8");
            path.replaceWith(t.stringLiteral(decodedStr));
            decoded++;
            return;
          } catch (e) {
            // ignore decode failures
            return;
          }
        }
        // Buffer.from("...","base64") pattern
        if (t.isMemberExpression(callee) && t.isIdentifier(callee.object) && callee.object.name === "Buffer" && t.isIdentifier(callee.property) && callee.property.name === "from") {
          // args[0] literal and args[1] === "base64"
          if (args.length >= 2 && t.isStringLiteral(args[0]) && t.isStringLiteral(args[1]) && args[1].value.toLowerCase() === "base64") {
            try {
              const decodedStr = Buffer.from(args[0].value, "base64").toString("utf8");
              path.replaceWith(t.stringLiteral(decodedStr));
              decoded++;
            } catch (e) {
              // ignore
            }
          }
        }
      } catch (e) {
        if (verbose) console.error("hexBase64Decoder call error", e.message);
      }
    }
  });

  return { strings_decoded: decoded };
};
