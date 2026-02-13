# js-deobfuscator

Static JavaScript deobfuscator for malware/packer/droppers — **safe** for analysis because it does **not execute** input code.

## What it is

`js-deobfuscator` performs AST-based, static transformations to convert obfuscated JavaScript into a clearer form:

- resolves simple string-array obfuscation
- decodes hex/unicode escape sequences and base64 (static)
- folds constant expressions
- removes obvious junk (debugger, console spam, dead branches)
- basic identifier renaming of obfuscated identifiers
- outputs a transformation report

**Crucially:** *the tool never runs or evaluates untrusted code*. All transformations are performed on the AST using Babel.

## Requirements

- Node.js 18+
- Installed dependencies (see install)

## Install

```bash
git clone https://github.com/kennethHelmuth/JS-Deobfuscator
cd js-deobfuscator
npm install
npm link   # optional - installs 'js-deobfuscator' CLI globally for convenience
