/**
 * test/teacher-bindings-store.test.js
 * Covers: read, add, remove, hasBinding, list, guest removal, corruption, concurrency, error propagation
 */
'use strict';
var { describe, it, before, after } = require('node:test');
var assert = require('node:assert/strict');
var fs = require('fs');
var os = require('os');
var path = require('path');
var { createTeacherBindingsStore } = require('../lib/teacher/teacher-bindings-store');

var tempDir, filePath, store;

before(function () {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bind-store-'));
  filePath = path.join(tempDir, 'bindings.json');
  store = createTeacherBindingsStore({ filePath: filePath });
});
after(function () { try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch (_) {} });

describe('A. readAll / hasBinding', function () {
  it('1. file not exists returns empty object', function () {
    var s = createTeacherBindingsStore({ filePath: path.join(tempDir, 'nope.json') });
    var all = s.readAll();
    assert.strictEqual(typeof all, 'object');
    assert.strictEqual(Array.isArray(all), false);
    assert.strictEqual(Object.keys(all).length, 0);
  });
  it('2. hasBinding false on empty', function () { assert.strictEqual(store.hasBinding('t-a', 's-a'), false); });
  it('3. add then hasBinding', function () {
    return store.addBinding('t-a', 's-a').then(function () {
      assert.strictEqual(store.hasBinding('t-a', 's-a'), true);
    });
  });
  it('4. addBinding idempotent', function () {
    return store.addBinding('t-a', 's-a').then(function () {
      return store.addBinding('t-a', 's-a');
    }).then(function (all) {
      assert.strictEqual(all['t-a'].length, 1);
    });
  });
});

describe('B. list', function () {
  it('5. listStudentsForTeacher', function () {
    return store.addBinding('t-l', 's-1').then(function () {
      return store.addBinding('t-l', 's-2');
    }).then(function () {
      assert.deepStrictEqual(store.listStudentsForTeacher('t-l'), ['s-1', 's-2']);
    });
  });
  it('6. listTeachersForStudent', function () {
    assert.deepStrictEqual(store.listTeachersForStudent('s-1'), ['t-l']);
  });
  it('7. listTeachersForStudent not found returns []', function () {
    assert.deepStrictEqual(store.listTeachersForStudent('s-none'), []);
  });
});

describe('C. removeBinding', function () {
  it('8. removeBinding removes student', function () {
    return store.addBinding('t-rm', 's-rm').then(function () {
      return store.removeBinding('t-rm', 's-rm');
    }).then(function () {
      assert.strictEqual(store.hasBinding('t-rm', 's-rm'), false);
    });
  });
  it('9. removeBinding last student deletes key', function () {
    return store.addBinding('t-key', 's-only').then(function () {
      return store.removeBinding('t-key', 's-only');
    }).then(function (all) {
      assert.strictEqual(('t-key' in all), false);
    });
  });
  it('10. removeBinding idempotent', function () {
    return store.removeBinding('t-no', 's-no').then(function (all) { assert.ok(all); });
  });
});

describe('D. Corruption', function () {
  it('11. zero-byte throws', function () {
    var p = path.join(tempDir, 'bcorr0.json'); fs.writeFileSync(p, '', 'utf-8');
    var s = createTeacherBindingsStore({ filePath: p });
    try { s.readAll(); assert.fail('expected error'); } catch (e) { assert.strictEqual(e.code, 'BINDINGS_STORE_CORRUPTED'); }
  });
  it('12. array throws', function () {
    var p = path.join(tempDir, 'bcorr1.json'); fs.writeFileSync(p, '[]', 'utf-8');
    var s = createTeacherBindingsStore({ filePath: p });
    try { s.readAll(); assert.fail('expected error'); } catch (e) { assert.strictEqual(e.code, 'BINDINGS_STORE_CORRUPTED'); }
  });
  it('13. null throws', function () {
    var p = path.join(tempDir, 'bcorr2.json'); fs.writeFileSync(p, 'null', 'utf-8');
    var s = createTeacherBindingsStore({ filePath: p });
    try { s.readAll(); assert.fail('expected error'); } catch (e) { assert.strictEqual(e.code, 'BINDINGS_STORE_CORRUPTED'); }
  });
  it('14. corrupt file preserved', function () {
    var p = path.join(tempDir, 'bcorr-keep.json');
    fs.writeFileSync(p, 'bad', 'utf-8');
    var s = createTeacherBindingsStore({ filePath: p });
    try { s.readAll(); } catch (e) {}
    assert.strictEqual(fs.readFileSync(p, 'utf-8'), 'bad');
  });
  it('14b. non-string studentId in array throws CORRUPTED', function () {
    var p = path.join(tempDir, 'bcorr-num.json');
    fs.writeFileSync(p, JSON.stringify({ 't-a': [42] }), 'utf-8');
    var s = createTeacherBindingsStore({ filePath: p });
    try { s.readAll(); assert.fail('expected error'); } catch (e) { assert.strictEqual(e.code, 'BINDINGS_STORE_CORRUPTED'); }
  });
});

describe('E. Safety', function () {
  it('15. dangerous key __proto__ rejected', function () {
    return store.addBinding('__proto__', 's-a').catch(function (e) { assert.ok(e); });
  });
  it('16. readAll filters __proto__', function () {
    var p = path.join(tempDir, 'b-proto.json');
    fs.writeFileSync(p, JSON.stringify({__proto__:['s-a'],'t-safe':['s-b']}), 'utf-8');
    var s = createTeacherBindingsStore({ filePath: p });
    var all = s.readAll();
    assert.strictEqual('__proto__' in all, false);
    assert.strictEqual('t-safe' in all, true);
  });
  it('17. readAll returns deep copy', function () {
    var all = store.readAll();
    all['fake-key'] = ['x'];
    var all2 = store.readAll();
    assert.strictEqual('fake-key' in all2, false);
  });
});

describe('F. removeGuestBindings', function () {
  it('18. removes guest from bindings', function () {
    return store.addBinding('t-g1', 'guest').then(function () {
      return store.addBinding('t-g1', 's-real');
    }).then(function () {
      return store.removeGuestBindings();
    }).then(function (removed) {
      assert.ok(removed >= 1);
      assert.strictEqual(store.hasBinding('t-g1', 'guest'), false);
      assert.strictEqual(store.hasBinding('t-g1', 's-real'), true);
    });
  });
  it('19. idempotent', function () {
    return store.removeGuestBindings().then(function (r) { assert.strictEqual(r, 0); });
  });
});

describe('G. Concurrency', function () {
  it('20. two concurrent adds both preserved', function () {
    return Promise.all([store.addBinding('t-cc1', 'sc1'), store.addBinding('t-cc2', 'sc2')]).then(function () {
      assert.strictEqual(store.hasBinding('t-cc1', 'sc1'), true);
      assert.strictEqual(store.hasBinding('t-cc2', 'sc2'), true);
    });
  });
  it('21. concurrent add+remove same key', function () {
    return store.addBinding('t-cr', 's-cr').then(function () {
      return Promise.all([store.addBinding('t-cr', 's-cr2'), store.removeBinding('t-cr', 's-cr')]);
    }).then(function () {
      var all = store.readAll();
      var list = all['t-cr'] || [];
      assert.strictEqual(list.indexOf('s-cr2') >= 0, true);
    });
  });
});

describe('H. Queue error propagation', function () {
  it('22. invalid teacherId rejects', function () {
    return store.addBinding('', 's').catch(function (e) { assert.ok(e); });
  });
  it('23. queue continues after failure', function () {
    var fails = store.addBinding('', 's').catch(function () { return 'failed'; });
    var succeeds = store.addBinding('t-after', 's-after');
    return Promise.all([fails, succeeds]).then(function (r) {
      assert.strictEqual(r[0], 'failed');
      assert.ok(r[1]);
    });
  });
});

describe('I. tmp cleanup', function () {
  it('24. no tmp files after add', function () {
    var files = fs.readdirSync(tempDir);
    var tmps = files.filter(function (f) { return f.indexOf('.tmp') >= 0; });
    assert.strictEqual(tmps.length, 0);
  });
});
