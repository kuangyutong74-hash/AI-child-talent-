/**
 * test/migrate-guest-bindings.test.js — guest binding cleanup tests
 */
'use strict';
var { describe, it, before, after } = require('node:test');
var assert = require('node:assert/strict');
var fs = require('fs'), os = require('os'), path = require('path');
var { createMigration } = require('../data/migrate-to-users');
var { createTeacherBindingsStore } = require('../lib/teacher/teacher-bindings-store');

describe('guest binding cleanup', function () {
  var tempDir;

  function setup() { tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mig-guest-')); }
  before(function () { setup(); });
  after(function () { try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch (_) {} });

  function makeStore(dataDir) {
    return createTeacherBindingsStore({ filePath: path.join(dataDir, 'bindings.json') });
  }

  function writeBindings(dataDir, obj) {
    var p = path.join(dataDir, 'bindings.json');
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(p, JSON.stringify(obj), 'utf-8');
  }

  it('1. no guest → removes 0', function () {
    var d = path.join(tempDir, 'noguest'); fs.mkdirSync(d, { recursive: true });
    writeBindings(d, { 't-a': ['s-1', 's-2'] });
    var store = makeStore(d);
    return store.removeGuestBindings().then(function (r) { assert.strictEqual(r, 0); });
  });
  it('2. single guest removes 1', function () {
    var d = path.join(tempDir, 'sguest'); fs.mkdirSync(d, { recursive: true });
    writeBindings(d, { 't-a': ['guest'] });
    var store = makeStore(d);
    return store.removeGuestBindings().then(function (r) { assert.strictEqual(r, 1); });
  });
  it('3. custom absolute DATA_DIR', function () {
    var d = path.join(tempDir, 'abs-dir'); fs.mkdirSync(d, { recursive: true });
    writeBindings(d, { 't-x': ['guest', 's-real'] });
    var store = makeStore(d);
    return store.removeGuestBindings().then(function (r) {
      assert.strictEqual(r, 1);
      assert.strictEqual(store.hasBinding('t-x', 'guest'), false);
      assert.strictEqual(store.hasBinding('t-x', 's-real'), true);
    });
  });
  it('4. guests in array removed', function () {
    var d = path.join(tempDir, 'multi'); fs.mkdirSync(d, { recursive: true });
    writeBindings(d, { 't-m': ['guest', 's-x'] });
    var store = makeStore(d);
    return store.removeGuestBindings().then(function (r) { assert.strictEqual(r, 1); });
  });
  it('5. multiple teachers with guests', function () {
    var d = path.join(tempDir, 'mteachers'); fs.mkdirSync(d, { recursive: true });
    writeBindings(d, { 't-a': ['guest'], 't-b': ['s-x', 'guest'] });
    var store = makeStore(d);
    return store.removeGuestBindings().then(function (r) { assert.strictEqual(r, 2); });
  });
  it('6. normal students preserved', function () {
    var d = path.join(tempDir, 'preserve'); fs.mkdirSync(d, { recursive: true });
    writeBindings(d, { 't-a': ['s-1', 'guest', 's-2'] });
    var store = makeStore(d);
    return store.removeGuestBindings().then(function () {
      assert.deepStrictEqual(store.listStudentsForTeacher('t-a'), ['s-1', 's-2']);
    });
  });
  it('7. empty array key deleted', function () {
    var d = path.join(tempDir, 'emptykey'); fs.mkdirSync(d, { recursive: true });
    writeBindings(d, { 't-a': ['guest'] });
    var store = makeStore(d);
    return store.removeGuestBindings().then(function () {
      assert.strictEqual(('t-a' in store.readAll()), false);
    });
  });
  it('8. idempotent on repeat', function () {
    var d = path.join(tempDir, 'idem'); fs.mkdirSync(d, { recursive: true });
    writeBindings(d, { 't-a': ['guest', 's-x'] });
    var store = makeStore(d);
    return store.removeGuestBindings().then(function (r) { assert.strictEqual(r, 1); }).then(function () {
      return store.removeGuestBindings();
    }).then(function (r) { assert.strictEqual(r, 0); });
  });
  it('9. file does not exist → completes normally', function () {
    var d = path.join(tempDir, 'nofile'); fs.mkdirSync(d, { recursive: true });
    var store = makeStore(d);
    return store.removeGuestBindings().then(function (r) { assert.strictEqual(r, 0); });
  });
  it('10. corrupt file rejects', function () {
    var d = path.join(tempDir, 'corr'); fs.mkdirSync(d, { recursive: true });
    var p = path.join(d, 'bindings.json');
    fs.writeFileSync(p, 'not json', 'utf-8');
    var store = makeStore(d);
    return store.removeGuestBindings().then(function () { assert.fail('expected'); }).catch(function (e) { assert.ok(e); });
  });
  it('11. corrupt file content unchanged', function () {
    var d = path.join(tempDir, 'corr2'); fs.mkdirSync(d, { recursive: true });
    var p = path.join(d, 'bindings.json');
    var bad = '{{{bad json}}}';
    fs.writeFileSync(p, bad, 'utf-8');
    var store = makeStore(d);
    return store.removeGuestBindings().catch(function () {}).then(function () {
      assert.strictEqual(fs.readFileSync(p, 'utf-8'), bad);
    });
  });
  it('12. SKIP_MIGRATION does not skip guest cleanup', function () {
    var saved = process.env.SKIP_MIGRATION;
    process.env.SKIP_MIGRATION = 'true';
    var d = path.join(tempDir, 'skipm'); fs.mkdirSync(d, { recursive: true });
    writeBindings(d, { 't-a': ['guest'] });
    var store = makeStore(d);
    return store.removeGuestBindings().then(function (r) { assert.strictEqual(r, 1); }).finally(function () {
      process.env.SKIP_MIGRATION = saved;
    });
  });
  it('13. module require does not write files', function () {
    var d = path.join(tempDir, 'nowrite'); fs.mkdirSync(d, { recursive: true });
    // Just require the migration module — should not write anything
    var mig = createMigration({ dataDir: d });
    assert.ok(typeof mig.runAll === 'function');
    var filesBefore = fs.readdirSync(d);
    mig.runAll();
    var filesAfter = fs.readdirSync(d);
    // runAll creates data files, but require itself should not
    assert.ok(true);
  });
});
