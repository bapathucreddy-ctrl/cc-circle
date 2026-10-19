const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
function load(file) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { exports, require: name => load(path.resolve(path.dirname(file), name + '.ts')) });
  return exports;
}
const { professionalFacts } = load(require.resolve('../src/lib/professionalFacts.ts'));
test('professional summaries show actual questionnaire answers and exclude private, unknown and contact fields', () => {
  const rows = professionalFacts({ category: 'HairStylist', public_specs: { 'hair-services': ['Bridal hair', 'Haircuts', 'Not a real option'], experience: '0', 'hair-textures': ['Curly'], 'hair-kit': 'Brushes and styling products', 'hair-consultation': 'On request', 'hair-access': 'Private working preferences', full_name: 'Private Legal Name', phone: '919000000001', 'client-prep': 'Call +91 90000 00001 or email person@example.com' } });
  assert.equal(rows.find(row => row.id === 'experience').value, '0 years');
  assert.equal(rows.find(row => row.id === 'hair-services').value, 'Bridal hair, Haircuts');
  assert.equal(rows.find(row => row.id === 'hair-kit').value, 'Brushes and styling products');
  assert.ok(!rows.some(row => ['hair-access', 'full_name', 'phone', 'client-prep'].includes(row.id)));
  assert.ok(!JSON.stringify(rows).includes('Private'));
});
test('professional summaries omit invalid answers and bound lengthy public text', () => {
  const rows = professionalFacts({ category: 'ContentCreator', public_specs: { experience: '-2', revisions: 'Infinity', turnaround: 'Fake option', 'shooting-kit': ['Gimbal', 'Tripod'], deliverables: 'A'.repeat(250), 'usage-rights': 'https://example.com/my-profile' } });
  assert.equal(rows.length, 2);
  assert.equal(rows.find(row => row.id === 'shooting-kit').value, 'Gimbal, Tripod');
  assert.equal(rows.find(row => row.id === 'deliverables').value.length, 178);
});
