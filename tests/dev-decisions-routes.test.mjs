import test from 'node:test';
import assert from 'node:assert/strict';
import { allowedPublicPath } from '../tools/local-server.mjs';
test('M1E decision module is served, sensitive files are not',()=>{
  assert.equal(allowedPublicPath('/src/dev-decision-model.mjs'),true);
  assert.equal(allowedPublicPath('/src/dev-brief.mjs'),true);
  assert.equal(allowedPublicPath('/.env.local'),false);
  assert.equal(allowedPublicPath('/tests/dev-decisions.test.mjs'),false);
});
