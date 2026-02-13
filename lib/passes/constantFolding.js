/**
 * constantFolding.js
 *
 * Evaluate safe, literal-only BinaryExpressions and BooleanExpressions.
 *
 * Only fold when both operands are literals (string/number/boolean/null).
 * No function calls, no identifier evaluation.
 */

const traverse = require("@babel/traverse").default;
const t = require("@babel/types");

function evalBinary(op, left, right) {
  try {
    if (typeof left === "string" || typeof right === "string") {
      if (op === "+") return String(left) + String(right);
      // other ops with strings are unsafe -> skip
      return null;
    }
    switch (op) {
      case "+":
        return left + right;
      case "-":
        return left - right;
      case "*":
        return left * right;
      case "/":
        return left / right;
      case "%":
        return left % right;
      case "**":
        return Math.pow(left, right);
      case "|":
        return left | right;
      case "&":
        return left & right;
      case "^":
        return left ^ right;
      case "<<":
        return left << right;
      case ">>":
        return left >> right;
      default:
        return null;
    }
  } catch (e) {
    return null;
  }
}

module.exports = function constantFolding(ast, opts = {}) {
  const verbose = !!opts.verbose;
  let folded = 0;

  traverse(ast, {
    BinaryExpression(path) {
      const left = path.node.left;
      const right = path.node.right;
      if (t.isLiteral(left) && t.isLiteral(right)) {
        const lval = left.value;
        const rval = right.value;
        const res = evalBinary(path.node.operator, lval, rval);
        if (res !== null && res !== undefined && !(Number.isNaN(res))) {
          const node = typeof res === "string" ? t.stringLiteral(res) : t.numericLiteral(res);
          path.replaceWith(node);
          folded++;
        }
      }
    },
    LogicalExpression(path) {
      // simple && || folding for literal left operand
      const left = path.node.left;
      const right = path.node.right;
      if (t.isLiteral(left)) {
        const lval = left.value;
        if (path.node.operator === "&&") {
          // if left is falsy, whole expr is left
          if (!lval) {
            path.replaceWith(left);
            folded++;
          } else {
            path.replaceWith(right);
            folded++;
          }
        } else if (path.node.operator === "||") {
          if (lval) {
            path.replaceWith(left);
            folded++;
          } else {
            path.replaceWith(right);
            folded++;
          }
        }
      }
    }
  });

  return { constants_folded: folded };
};
