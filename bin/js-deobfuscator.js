#!/usr/bin/env node
/**
 * CLI wrapper
 */
const fs = require("fs");
const path = require("path");
const { program } = require("commander");
const pkg = require("../package.json");
const { deobfuscate } = require("../lib/index");
const prettify = require("prettier");

program
  .name("js-deobfuscator")
  .version(pkg.version)
  .argument("<input>", "input JavaScript file")
  .option("-o, --out <file>", "output deobfuscated file (defaults to stdout)")
  .option("--report <file>", "write JSON transformation report")
  .option("--passes <list>", "comma-separated list of passes to enable (stringArray,hexBase64,constFold,junk,idRename)", val => val.split(","), [])
  .option("--no-rename", "disable renaming of identifiers")
  .option("--beautify", "run prettier on output (requires installed prettier)", false)
  .option("--max-size <bytes>", "maximum input file size bytes (default 5242880)", parseInt, 5 * 1024 * 1024)
  .option("-v, --verbose", "verbose logging", false)
  .parse(process.argv);

(async () => {
  const opts = program.opts();
  const input = program.args[0];
  if (!input) {
    console.error("input file required");
    process.exit(2);
  }
  const inPath = path.resolve(input);
  if (!fs.existsSync(inPath)) {
    console.error("input file not found:", inPath);
    process.exit(3);
  }
  const stats = fs.statSync(inPath);
  if (stats.size > opts.maxSize) {
    console.error("input file exceeds max-size:", stats.size);
    process.exit(4);
  }
  const code = fs.readFileSync(inPath, "utf8");
  try {
    const { code: outCode, report } = deobfuscate(code, {
      passes: opts.passes,
      rename: opts.rename !== false,
      verbose: opts.verbose
    });
    let finalCode = outCode;
    if (opts.beautify) {
      try {
        finalCode = prettify.format(outCode, { parser: "babel" });
      } catch (e) {
        if (opts.verbose) console.error("prettier formatting failed:", e.message);
      }
    }
    if (opts.out) {
      fs.writeFileSync(path.resolve(opts.out), finalCode, "utf8");
      if (opts.verbose) console.error("Wrote output to", opts.out);
    } else {
      process.stdout.write(finalCode);
    }
    if (opts.report) {
      fs.writeFileSync(path.resolve(opts.report), JSON.stringify(report, null, 2), "utf8");
      if (opts.verbose) console.error("Wrote report to", opts.report);
    } else if (opts.verbose) {
      console.error("Report:", JSON.stringify(report, null, 2));
    }
    process.exit(0);
  } catch (err) {
    console.error("Deobfuscation failed:", err && err.stack ? err.stack : err);
    process.exit(1);
  }
})();
