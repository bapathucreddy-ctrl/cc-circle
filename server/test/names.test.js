import test from 'node:test';
import assert from 'node:assert/strict';
import {displayName} from '../../src/lib/names.ts';

test('display names capitalize words and preserve existing internal capitalization',()=>{
 assert.equal(displayName('  aarav menon  '),'Aarav Menon');
 assert.equal(displayName('riya o’connor'),'Riya O’Connor');
 assert.equal(displayName('mary-jane McDonald'),'Mary-Jane McDonald');
 assert.equal(displayName('éva martin'),'Éva Martin');
 assert.equal(displayName(''),'');
});
