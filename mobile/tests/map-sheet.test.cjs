const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const exports_ = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(require.resolve('../src/lib/mapSheet.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, { exports: exports_ });
const { mapSheetStops, clampMapSheet, snapMapSheet, mapCameraInsets } = exports_;

test('map sheet supports peek, list and expanded positions on short and tall devices', () => {
  for (const height of [160, 320, 480, 600, 900, 1200]) {
    const [peek, list, expanded] = mapSheetStops(height);
    assert.ok(peek > 0 && peek < list && list < expanded && expanded < height);
    assert.equal(clampMapSheet(-200, height), peek);
    assert.equal(clampMapSheet(height * 2, height), expanded);
    assert.equal(snapMapSheet(list + 5, height), list);
  }
});

test('dragging and flicking up expands the list; downward flicks reveal the map', () => {
  const [peek, list, expanded] = mapSheetStops(600);
  assert.equal(snapMapSheet(list, 600, -2), expanded);
  assert.equal(snapMapSheet(list, 600, 2), peek);
  assert.equal(snapMapSheet(expanded - 10, 600), expanded);
});

test('expanded panels and keyboard-sized viewports never consume all camera space', () => {
  for (const height of [160, 240, 400, 600, 900]) {
    for (const bottom of mapSheetStops(height)) {
      const padding = mapCameraInsets(height, 180, bottom);
      // Reserve space for the largest fit-bounds margins and navigation rider.
      assert.ok(padding.top >= 0 && padding.bottom >= 0);
      assert.ok(padding.top + padding.bottom + 136 < height);
    }
  }
  assert.equal(mapCameraInsets(600, 100, 258).bottom, 258);
});
