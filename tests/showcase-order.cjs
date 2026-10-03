const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(path, require) {
  const context = { exports: {}, require };
  const code = ts.transpileModule(fs.readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React },
  }).outputText;
  vm.runInNewContext(code, context);
  return context.exports;
}
const data = load('src/data.ts', name => name);
const gallery = load('src/components/CraftShowcase.tsx', name => name === '../data' ? data : {});
for (let run = 0; run < 20; run++) {
  const rows = gallery.buildShowcaseRows();
  assert.equal(rows.length, 3);
  for (const row of rows) {
    assert.equal(row.length, data.categories.length);
    assert.equal(new Set(row.map(card => card.name)).size, row.length);
    assert.equal(new Set(row.map(card => card.image)).size, row.length, 'Each full loop should have unique images');
    assert.ok(row.every(card => card.image), 'Every card needs a valid image');
  }
}
console.log('Gallery order and unique-image checks passed');
