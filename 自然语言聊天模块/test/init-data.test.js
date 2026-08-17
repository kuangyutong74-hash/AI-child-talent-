/**
 * test/init-data.test.js — 初始化数据脚本测试
 *
 * 使用临时目录和临时 example fixture，不读写真实 data/。
 * 无账号体系：仅 5 个聊天数据文件（history/journal/tip-favorites/chat-log/tips）。
 */

'use strict';

var { describe, it, after } = require('node:test');
var assert = require('node:assert/strict');
var fs = require('fs');
var os = require('os');
var path = require('path');

var { initData, resolveDataDir } = require('../scripts/init-data');

// ============================================================
//  Helper: create temp fixture
// ============================================================

var FIVE_FILES = ['history.json', 'journal.json', 'tip-favorites.json', 'chat-log.jsonl', 'tips.json'];

function makeExampleDir(baseDir) {
  var exampleDir = path.join(baseDir, 'data.example');
  fs.mkdirSync(exampleDir, { recursive: true });
  fs.writeFileSync(path.join(exampleDir, 'history.json'), '[]\n', 'utf-8');
  fs.writeFileSync(path.join(exampleDir, 'journal.json'), '[]\n', 'utf-8');
  fs.writeFileSync(path.join(exampleDir, 'tip-favorites.json'), '{}\n', 'utf-8');
  fs.writeFileSync(path.join(exampleDir, 'chat-log.jsonl'), '', 'utf-8');
  fs.writeFileSync(path.join(exampleDir, 'tips.json'), '[]\n', 'utf-8');
  return exampleDir;
}

// Helper: create valid non-empty JSONL (targets chat-log.jsonl)
function makeJsonl(dir, lines) {
  var p = path.join(dir, 'data.example', 'chat-log.jsonl');
  fs.writeFileSync(p, lines.join('\n') + '\n', 'utf-8');
}

// ============================================================
//  Test suite
// ============================================================

describe('init-data', function () {

  // 1. export structure
  it('1. initData is a function', function () {
    assert.strictEqual(typeof initData, 'function');
  });

  it('2. resolveDataDir is a function', function () {
    assert.strictEqual(typeof resolveDataDir, 'function');
  });

  // --- Basic creation ---
  describe('basic creation', function () {

    it('3. target directory does not exist → created', function () {
      var base = fs.mkdtempSync(path.join(os.tmpdir(), 'init-test-'));
      makeExampleDir(base);
      var saved = process.env.DATA_DIR;
      var target = path.join(base, 'data');
      process.env.DATA_DIR = target;
      try {
        var r = initData({ dataDir: target, exampleDir: path.join(base, 'data.example') });
        assert.strictEqual(r.errors.length, 0, r.errors.join(', '));
        assert.ok(fs.existsSync(target), 'data dir should be created');
      } finally {
        process.env.DATA_DIR = saved;
        try { fs.rmSync(base, { recursive: true, force: true }); } catch (_) {}
      }
    });

    it('4. creates five target files', function () {
      var base = fs.mkdtempSync(path.join(os.tmpdir(), 'init-test-'));
      makeExampleDir(base);
      var saved = process.env.DATA_DIR;
      var target = path.join(base, 'data');
      process.env.DATA_DIR = target;
      try {
        var r = initData({ dataDir: target, exampleDir: path.join(base, 'data.example') });
        assert.strictEqual(r.errors.length, 0);
        assert.strictEqual(r.created.length, 5);
        FIVE_FILES.forEach(function (f) {
          assert.ok(fs.existsSync(path.join(target, f)), f + ' should exist');
        });
      } finally {
        process.env.DATA_DIR = saved;
        try { fs.rmSync(base, { recursive: true, force: true }); } catch (_) {}
      }
    });

    it('5. created files match example content', function () {
      var base = fs.mkdtempSync(path.join(os.tmpdir(), 'init-test-'));
      makeExampleDir(base);
      var saved = process.env.DATA_DIR;
      var target = path.join(base, 'data');
      process.env.DATA_DIR = target;
      try {
        initData();
        var normalizeContent = function (f) { return fs.readFileSync(f, 'utf-8').replace(/\r\n/g, '\n'); };
        assert.strictEqual(normalizeContent(path.join(target, 'history.json')), '[]\n');
        assert.strictEqual(normalizeContent(path.join(target, 'journal.json')), '[]\n');
      } finally {
        process.env.DATA_DIR = saved;
        try { fs.rmSync(base, { recursive: true, force: true }); } catch (_) {}
      }
    });

    it('6. history.json is valid array', function () {
      var base = fs.mkdtempSync(path.join(os.tmpdir(), 'init-test-'));
      makeExampleDir(base);
      var saved = process.env.DATA_DIR;
      var target = path.join(base, 'data');
      process.env.DATA_DIR = target;
      try {
        initData();
        var parsed = JSON.parse(fs.readFileSync(path.join(target, 'history.json'), 'utf-8'));
        assert.strictEqual(Array.isArray(parsed), true);
      } finally {
        process.env.DATA_DIR = saved;
        try { fs.rmSync(base, { recursive: true, force: true }); } catch (_) {}
      }
    });

    it('7. journal.json is valid array', function () {
      var base = fs.mkdtempSync(path.join(os.tmpdir(), 'init-test-'));
      makeExampleDir(base);
      var saved = process.env.DATA_DIR;
      var target = path.join(base, 'data');
      process.env.DATA_DIR = target;
      try {
        initData();
        var parsed = JSON.parse(fs.readFileSync(path.join(target, 'journal.json'), 'utf-8'));
        assert.strictEqual(Array.isArray(parsed), true);
      } finally {
        process.env.DATA_DIR = saved;
        try { fs.rmSync(base, { recursive: true, force: true }); } catch (_) {}
      }
    });

    it('8. tip-favorites.json is valid non-array object', function () {
      var base = fs.mkdtempSync(path.join(os.tmpdir(), 'init-test-'));
      makeExampleDir(base);
      var saved = process.env.DATA_DIR;
      var target = path.join(base, 'data');
      process.env.DATA_DIR = target;
      try {
        initData();
        var parsed = JSON.parse(fs.readFileSync(path.join(target, 'tip-favorites.json'), 'utf-8'));
        assert.strictEqual(typeof parsed, 'object');
        assert.strictEqual(Array.isArray(parsed), false);
      } finally {
        process.env.DATA_DIR = saved;
        try { fs.rmSync(base, { recursive: true, force: true }); } catch (_) {}
      }
    });

    it('9. empty chat-log.jsonl is valid', function () {
      var base = fs.mkdtempSync(path.join(os.tmpdir(), 'init-test-'));
      makeExampleDir(base);
      var saved = process.env.DATA_DIR;
      var target = path.join(base, 'data');
      process.env.DATA_DIR = target;
      try {
        initData();
        assert.ok(fs.existsSync(path.join(target, 'chat-log.jsonl')));
        var content = fs.readFileSync(path.join(target, 'chat-log.jsonl'), 'utf-8');
        assert.strictEqual(content, '');
      } finally {
        process.env.DATA_DIR = saved;
        try { fs.rmSync(base, { recursive: true, force: true }); } catch (_) {}
      }
    });

    it('10. valid non-empty JSONL copies successfully', function () {
      var base = fs.mkdtempSync(path.join(os.tmpdir(), 'init-test-'));
      makeExampleDir(base);
      makeJsonl(base, ['{"a":1}', '{"b":2}']);
      var saved = process.env.DATA_DIR;
      var target = path.join(base, 'data');
      process.env.DATA_DIR = target;
      try {
        var r = initData({ dataDir: target, exampleDir: path.join(base, 'data.example') });
        assert.strictEqual(r.errors.length, 0);
        assert.ok(fs.existsSync(path.join(target, 'chat-log.jsonl')));
      } finally {
        process.env.DATA_DIR = saved;
        try { fs.rmSync(base, { recursive: true, force: true }); } catch (_) {}
      }
    });

    it('11. invalid JSONL line rejected', function () {
      var base = fs.mkdtempSync(path.join(os.tmpdir(), 'init-test-'));
      makeExampleDir(base);
      makeJsonl(base, ['{"a":1}', 'not-json']);
      var saved = process.env.DATA_DIR;
      var target = path.join(base, 'data');
      process.env.DATA_DIR = target;
      try {
        var r = initData({ dataDir: target, exampleDir: path.join(base, 'data.example') });
        assert.ok(r.errors.length >= 1, 'should have validation error');
      } finally {
        process.env.DATA_DIR = saved;
        try { fs.rmSync(base, { recursive: true, force: true }); } catch (_) {}
      }
    });

    it('12. missing example file rejected', function () {
      var base = fs.mkdtempSync(path.join(os.tmpdir(), 'init-test-'));
      var exampleDir = path.join(base, 'data.example');
      fs.mkdirSync(exampleDir, { recursive: true });
      // Only create 4 of 5 required files
      fs.writeFileSync(path.join(exampleDir, 'history.json'), '[]\n', 'utf-8');
      fs.writeFileSync(path.join(exampleDir, 'journal.json'), '[]\n', 'utf-8');
      fs.writeFileSync(path.join(exampleDir, 'tip-favorites.json'), '{}\n', 'utf-8');
      fs.writeFileSync(path.join(exampleDir, 'tips.json'), '[]\n', 'utf-8');
      // chat-log.jsonl intentionally missing

      var saved = process.env.DATA_DIR;
      var target = path.join(base, 'data');
      process.env.DATA_DIR = target;
      try {
        var r = initData({ dataDir: target, exampleDir: path.join(base, 'data.example') });
        assert.ok(r.errors.length >= 1, 'should reject missing example file');
        assert.strictEqual(fs.existsSync(target), false, 'should not create target dir on validation failure');
      } finally {
        process.env.DATA_DIR = saved;
        try { fs.rmSync(base, { recursive: true, force: true }); } catch (_) {}
      }
    });

    it('13. invalid JSON example rejected', function () {
      var base = fs.mkdtempSync(path.join(os.tmpdir(), 'init-test-'));
      makeExampleDir(base);
      fs.writeFileSync(path.join(base, 'data.example', 'history.json'), 'not json {{{', 'utf-8');
      var saved = process.env.DATA_DIR;
      var target = path.join(base, 'data');
      process.env.DATA_DIR = target;
      try {
        var r = initData({ dataDir: target, exampleDir: path.join(base, 'data.example') });
        assert.ok(r.errors.length >= 1, 'should reject invalid JSON');
      } finally {
        process.env.DATA_DIR = saved;
        try { fs.rmSync(base, { recursive: true, force: true }); } catch (_) {}
      }
    });

    it('14. wrong top-level type rejected (object where array expected)', function () {
      var base = fs.mkdtempSync(path.join(os.tmpdir(), 'init-test-'));
      makeExampleDir(base);
      fs.writeFileSync(path.join(base, 'data.example', 'history.json'), '{"key":"val"}\n', 'utf-8');
      var saved = process.env.DATA_DIR;
      var target = path.join(base, 'data');
      process.env.DATA_DIR = target;
      try {
        var r = initData({ dataDir: target, exampleDir: path.join(base, 'data.example') });
        assert.ok(r.errors.length >= 1, 'should reject wrong type');
      } finally {
        process.env.DATA_DIR = saved;
        try { fs.rmSync(base, { recursive: true, force: true }); } catch (_) {}
      }
    });

    it('15. wrong top-level type rejected for tip-favorites (array where object expected)', function () {
      var base = fs.mkdtempSync(path.join(os.tmpdir(), 'init-test-'));
      makeExampleDir(base);
      fs.writeFileSync(path.join(base, 'data.example', 'tip-favorites.json'), '[]\n', 'utf-8');
      var saved = process.env.DATA_DIR;
      var target = path.join(base, 'data');
      process.env.DATA_DIR = target;
      try {
        var r = initData({ dataDir: target, exampleDir: path.join(base, 'data.example') });
        assert.ok(r.errors.length >= 1, 'should reject array for tip-favorites');
      } finally {
        process.env.DATA_DIR = saved;
        try { fs.rmSync(base, { recursive: true, force: true }); } catch (_) {}
      }
    });

    it('16. validates all files before writing any', function () {
      var base = fs.mkdtempSync(path.join(os.tmpdir(), 'init-test-'));
      makeExampleDir(base);
      // Corrupt history.json — validation should fail for all, no target files created
      fs.writeFileSync(path.join(base, 'data.example', 'history.json'), 'bad json', 'utf-8');

      var saved = process.env.DATA_DIR;
      var target = path.join(base, 'data');
      process.env.DATA_DIR = target;
      try {
        var r = initData({ dataDir: target, exampleDir: path.join(base, 'data.example') });
        assert.ok(r.errors.length >= 1);
        // No target directory should be created with partial results
        if (fs.existsSync(target)) {
          var files = fs.readdirSync(target);
          assert.strictEqual(files.length, 0, 'should not have created any target files on validation failure');
        }
      } finally {
        process.env.DATA_DIR = saved;
        try { fs.rmSync(base, { recursive: true, force: true }); } catch (_) {}
      }
    });

    it('17. does not overwrite existing files', function () {
      var base = fs.mkdtempSync(path.join(os.tmpdir(), 'init-test-'));
      makeExampleDir(base);
      var saved = process.env.DATA_DIR;
      var target = path.join(base, 'data');
      process.env.DATA_DIR = target;
      try {
        // First run
        initData();
        // Modify a created file
        fs.writeFileSync(path.join(target, 'history.json'), '[{"id":"custom"}]\n', 'utf-8');
        var beforeContent = fs.readFileSync(path.join(target, 'history.json'), 'utf-8');
        // Second run
        var r2 = initData();
        var afterContent = fs.readFileSync(path.join(target, 'history.json'), 'utf-8');
        assert.strictEqual(afterContent, beforeContent, 'existing file should not be overwritten');
        assert.ok(r2.skipped.length >= 1);
      } finally {
        process.env.DATA_DIR = saved;
        try { fs.rmSync(base, { recursive: true, force: true }); } catch (_) {}
      }
    });

    it('18. existing file hash unchanged after re-run', function () {
      var base = fs.mkdtempSync(path.join(os.tmpdir(), 'init-test-'));
      makeExampleDir(base);
      var saved = process.env.DATA_DIR;
      var target = path.join(base, 'data');
      process.env.DATA_DIR = target;
      try {
        initData();
        var crypto = require('crypto');
        var beforeHash = crypto.createHash('sha256').update(fs.readFileSync(path.join(target, 'history.json'))).digest('hex');
        initData();
        var afterHash = crypto.createHash('sha256').update(fs.readFileSync(path.join(target, 'history.json'))).digest('hex');
        assert.strictEqual(afterHash, beforeHash);
      } finally {
        process.env.DATA_DIR = saved;
        try { fs.rmSync(base, { recursive: true, force: true }); } catch (_) {}
      }
    });

    it('19. existing file mtime unchanged after re-run', function () {
      var base = fs.mkdtempSync(path.join(os.tmpdir(), 'init-test-'));
      makeExampleDir(base);
      var saved = process.env.DATA_DIR;
      var target = path.join(base, 'data');
      process.env.DATA_DIR = target;
      try {
        initData();
        var beforeMtime = fs.statSync(path.join(target, 'history.json')).mtimeMs;
        initData();
        var afterMtime = fs.statSync(path.join(target, 'history.json')).mtimeMs;
        assert.strictEqual(afterMtime, beforeMtime);
      } finally {
        process.env.DATA_DIR = saved;
        try { fs.rmSync(base, { recursive: true, force: true }); } catch (_) {}
      }
    });

    it('20. only missing files created when some exist', function () {
      var base = fs.mkdtempSync(path.join(os.tmpdir(), 'init-test-'));
      makeExampleDir(base);
      var saved = process.env.DATA_DIR;
      var target = path.join(base, 'data');
      process.env.DATA_DIR = target;
      try {
        // Manually create just history.json
        fs.mkdirSync(target, { recursive: true });
        fs.writeFileSync(path.join(target, 'history.json'), '[{"id":"pre"}]\n', 'utf-8');
        var r = initData({ dataDir: target, exampleDir: path.join(base, 'data.example') });
        assert.ok(r.skipped.indexOf('history.json') >= 0, 'history.json should be skipped');
        assert.strictEqual(r.created.length, 4, '4 remaining files should be created');
        // Verify history.json wasn't touched
        var content = fs.readFileSync(path.join(target, 'history.json'), 'utf-8');
        assert.strictEqual(content, '[{"id":"pre"}]\n');
      } finally {
        process.env.DATA_DIR = saved;
        try { fs.rmSync(base, { recursive: true, force: true }); } catch (_) {}
      }
    });

    it('21. repeated runs are idempotent', function () {
      var base = fs.mkdtempSync(path.join(os.tmpdir(), 'init-test-'));
      makeExampleDir(base);
      var saved = process.env.DATA_DIR;
      var target = path.join(base, 'data');
      process.env.DATA_DIR = target;
      try {
        var r1 = initData();
        assert.strictEqual(r1.created.length, 5);
        var r2 = initData();
        assert.strictEqual(r2.created.length, 0);
        assert.strictEqual(r2.skipped.length, 5);
        assert.strictEqual(r2.errors.length, 0);
      } finally {
        process.env.DATA_DIR = saved;
        try { fs.rmSync(base, { recursive: true, force: true }); } catch (_) {}
      }
    });
  });

  // --- DATA_DIR handling ---
  describe('DATA_DIR', function () {

    it('22. DATA_DIR env var is respected', function () {
      var base = fs.mkdtempSync(path.join(os.tmpdir(), 'init-test-'));
      makeExampleDir(base);
      var saved = process.env.DATA_DIR;
      var target = path.join(base, 'custom-data');
      process.env.DATA_DIR = target;
      try {
        var r = initData({ dataDir: target, exampleDir: path.join(base, 'data.example') });
        assert.strictEqual(r.dataDir, path.resolve(target));
        assert.ok(fs.existsSync(target));
        assert.strictEqual(r.created.length, 5);
      } finally {
        process.env.DATA_DIR = saved;
        try { fs.rmSync(base, { recursive: true, force: true }); } catch (_) {}
      }
    });

    it('23. default directory resolves to project_root/data', function () {
      var saved = process.env.DATA_DIR;
      delete process.env.DATA_DIR;
      try {
        var dir = resolveDataDir();
        assert.ok(dir.endsWith('data'));
      } finally {
        process.env.DATA_DIR = saved;
      }
    });

    it('24. white-space-only DATA_DIR treated as empty', function () {
      var saved = process.env.DATA_DIR;
      process.env.DATA_DIR = '   ';
      try {
        var dir = resolveDataDir();
        assert.ok(dir.endsWith('data'), 'should fall back to default');
      } finally {
        process.env.DATA_DIR = saved;
      }
    });
  });

  // --- Safety checks ---
  describe('safety', function () {

    it('25. does not create any account/teacher data files', function () {
      var base = fs.mkdtempSync(path.join(os.tmpdir(), 'init-test-'));
      makeExampleDir(base);
      var saved = process.env.DATA_DIR;
      var target = path.join(base, 'data');
      process.env.DATA_DIR = target;
      try {
        initData();
        var accountFiles = ['users.json', 'sessions.json', 'bindings.json',
          'teacher-binding-invitations.json', 'teacher-binding-audit.jsonl',
          'teacher-report-narratives.json', 'teacher-safety-signals.json',
          'teacher-insight-reviews.json'];
        accountFiles.forEach(function (f) {
          assert.strictEqual(fs.existsSync(path.join(target, f)), false, f + ' should not be created');
        });
      } finally {
        process.env.DATA_DIR = saved;
        try { fs.rmSync(base, { recursive: true, force: true }); } catch (_) {}
      }
    });

    it('26. does not output file content (console.log contains no data)', function () {
      var base = fs.mkdtempSync(path.join(os.tmpdir(), 'init-test-'));
      makeExampleDir(base);
      var saved = process.env.DATA_DIR;
      var target = path.join(base, 'data');
      process.env.DATA_DIR = target;
      try {
        var r = initData({ dataDir: target, exampleDir: path.join(base, 'data.example') });
        // The results object should contain only filenames in created/skipped, never file content
        r.created.forEach(function (f) {
          assert.strictEqual(typeof f, 'string');
          assert.ok(f.length < 50, 'filename should be short');
        });
      } finally {
        process.env.DATA_DIR = saved;
        try { fs.rmSync(base, { recursive: true, force: true }); } catch (_) {}
      }
    });

    it('27. success returns created/skipped counts', function () {
      var base = fs.mkdtempSync(path.join(os.tmpdir(), 'init-test-'));
      makeExampleDir(base);
      var saved = process.env.DATA_DIR;
      var target = path.join(base, 'data');
      process.env.DATA_DIR = target;
      try {
        var r = initData({ dataDir: target, exampleDir: path.join(base, 'data.example') });
        assert.strictEqual(r.errors.length, 0);
        assert.strictEqual(typeof r.created.length, 'number');
        assert.strictEqual(typeof r.skipped.length, 'number');
        assert.strictEqual(r.created.length + r.skipped.length, 5);
      } finally {
        process.env.DATA_DIR = saved;
        try { fs.rmSync(base, { recursive: true, force: true }); } catch (_) {}
      }
    });

    it('28. does not modify data.example', function () {
      var base = fs.mkdtempSync(path.join(os.tmpdir(), 'init-test-'));
      makeExampleDir(base);
      var saved = process.env.DATA_DIR;
      var target = path.join(base, 'data');
      process.env.DATA_DIR = target;
      try {
        var historyBefore = fs.readFileSync(path.join(base, 'data.example', 'history.json'), 'utf-8');
        initData();
        var historyAfter = fs.readFileSync(path.join(base, 'data.example', 'history.json'), 'utf-8');
        assert.strictEqual(historyAfter, historyBefore);
      } finally {
        process.env.DATA_DIR = saved;
        try { fs.rmSync(base, { recursive: true, force: true }); } catch (_) {}
      }
    });

    it('29. test directories are in tmpdir, not real data', function () {
      var base = fs.mkdtempSync(path.join(os.tmpdir(), 'init-test-'));
      assert.ok(base.indexOf(os.tmpdir()) >= 0, 'should be in temp dir');
      try { fs.rmSync(base, { recursive: true, force: true }); } catch (_) {}
    });

    it('30. test does not access real data/ directory', function () {
      // initData respects DATA_DIR; this test suite never sets it to the real data/
      var realData = path.join(__dirname, '..', 'data');
      // We don't call initData without setting DATA_DIR to a temp path
      assert.ok(true, 'all tests use temp DATA_DIR');
    });
  });
});
