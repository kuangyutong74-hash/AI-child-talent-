/**
 * test/data-dir.test.js —统一 DATA_DIR 解析合同测试
 */
'use strict';
var { describe, it } = require('node:test');
var assert = require('node:assert/strict');
var path = require('path');
var { resolveDataDir } = require('../lib/infra/data-dir');

var PROJECT_ROOT = path.resolve(__dirname, '..');

describe('data-dir', function () {
  it('1. envValue undefined → default', function () {
    assert.strictEqual(resolveDataDir({ projectRoot: PROJECT_ROOT }), path.join(PROJECT_ROOT, 'data'));
  });
  it('2. envValue null coerced to default', function () {
    assert.strictEqual(resolveDataDir({ envValue: null, projectRoot: PROJECT_ROOT }), path.join(PROJECT_ROOT, 'data'));
  });
  it('3. envValue empty string → default', function () {
    assert.strictEqual(resolveDataDir({ envValue: '', projectRoot: PROJECT_ROOT }), path.join(PROJECT_ROOT, 'data'));
  });
  it('4. envValue whitespace only → default', function () {
    assert.strictEqual(resolveDataDir({ envValue: '   ', projectRoot: PROJECT_ROOT }), path.join(PROJECT_ROOT, 'data'));
  });
  it('5. relative path resolves against projectRoot', function () {
    var r = resolveDataDir({ envValue: './custom-data', projectRoot: PROJECT_ROOT });
    assert.strictEqual(r, path.join(PROJECT_ROOT, 'custom-data'));
  });
  it('6. absolute path used directly', function () {
    var r = resolveDataDir({ envValue: '/tmp/my-data', projectRoot: PROJECT_ROOT });
    assert.ok(r.indexOf('/tmp/my-data') >= 0 || r.indexOf('\\tmp\\my-data') >= 0);
  });
  it('7. Windows-style absolute path', function () {
    var r = resolveDataDir({ envValue: 'C:\\abs\\path', projectRoot: PROJECT_ROOT });
    assert.ok(r === 'C:\\abs\\path' || r === 'c:\\abs\\path');
  });
  it('8. envValue not a string → default', function () {
    assert.strictEqual(resolveDataDir({ envValue: 42, projectRoot: PROJECT_ROOT }), path.join(PROJECT_ROOT, 'data'));
  });
  it('9. different cwd produces same result', function () {
    var r1 = resolveDataDir({ envValue: './x', projectRoot: '/app' });
    var r2 = resolveDataDir({ envValue: './x', projectRoot: '/app' });
    assert.strictEqual(r1, r2);
  });
  it('10. path with spaces resolved correctly', function () {
    var r = resolveDataDir({ envValue: 'my data', projectRoot: PROJECT_ROOT });
    assert.ok(r.indexOf('my data') >= 0 || r.indexOf('my%20data') >= 0);
  });
  it('11. missing projectRoot throws', function () {
    try { resolveDataDir({}); assert.fail('expected'); } catch (e) { assert.ok(e.message.indexOf('projectRoot') >= 0); }
  });
});
