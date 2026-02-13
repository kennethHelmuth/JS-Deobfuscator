/**
 * junkRemoval.js
 *
 * Remove obvious junk/no-op patterns: debugger; console.* calls, empty statements, if(false) blocks, etc.
 * Only performs safe removals that do not execute code.
 */

const traverse = require("@babel/traverse").default;
const t = require("@babel/types");

module.exports = function junkRemoval(ast, opts = {}) {
  const verbose = !!opts.verbose;
  let removed = 0;

  traverse(ast, {
    DebuggerStatement(path) {
      path.remove();
      removed++;
    },
    ExpressionStatement(path) {
      // console.* -> remove
      const expr = path.node.expression;
      if (t.isCallExpression(expr) && t.isMemberExpression(expr.callee)) {
        const obj = expr.callee.object;
        if (t.isIdentifier(obj) && obj.name === "console") {
          path.remove();
          removed++;
        }
      }
    },
    IfStatement(path) {
      // if (false) { ... } -> remove or replace with alternate
      const test = path.node.test;
      if (t.isBooleanLiteral(test)) {
        if (test.value === false) {
          if (path.node.alternate) {
            path.replaceWith(path.node.alternate);
            removed++;
          } else {
            path.remove();
            removed++;
          }
        } else if (test.value === true) {
          // if(true) { consequent } else -> replace with consequent
          path.replaceWithMultiple(path.node.consequent.body || [path.node.consequent]);
          removed++;
        }
      }
    },
    EmptyStatement(path) {
      path.remove();
      removed++;
    }
  });

  return { dead_blocks_removed: removed };
};
