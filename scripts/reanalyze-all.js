/**
 * 批量重新分析 history.json 中的对话。
 *   node scripts/reanalyze-all.js            — 只处理缺少 pattern 的
 *   node scripts/reanalyze-all.js --force    — 强制重新分析所有已完成分析
 *   node scripts/reanalyze-all.js --student <id> — 只处理指定学生
 */
var srv = require('../app');
var { translateV2ToV1Compatible } = require('../lib/core/analyze-v2-translator');

(async function () {
  var force = process.argv.includes('--force');
  var targetStudent = null;
  var sidIdx = process.argv.indexOf('--student');
  if (sidIdx >= 0 && sidIdx + 1 < process.argv.length) targetStudent = process.argv[sidIdx + 1];

  await srv.initializeRuntime();
  var history = srv._readHistory();
  console.log('history.json: ' + history.length + ' 条' + (force ? ' (force模式)' : '') + (targetStudent ? ' (学生=' + targetStudent + ')' : '') + '\n');

  var todo = [];
  for (var i = 0; i < history.length; i++) {
    var e = history[i];
    if (!e || !e.analysis || e.analysis.status !== 'done') continue;
    if (!Array.isArray(e.messages) || e.messages.length === 0) continue;
    if (targetStudent && e.userId !== targetStudent) continue;

    var r2 = e.analysis.result;
    if (!r2) continue;
    var hits2 = r2['命中指标'];
    if (!Array.isArray(hits2) || hits2.length === 0) continue;

    if (!force) {
      var miss = false;
      for (var j = 0; j < hits2.length; j++) {
        if (!hits2[j]['观察模式'] || hits2[j]['观察模式'].trim() === '') miss = true;
      }
      if (!miss) continue;
    }

    todo.push({ idx: i, id: e.id, userId: e.userId, msgs: e.messages.length, turns: e.turnCount || 0, entry: e });
  }

  console.log('待处理: ' + todo.length + ' 条\n');
  if (todo.length === 0) process.exit(0);

  var ok = 0, fail = 0;
  for (var ti = 0; ti < todo.length; ti++) {
    var t = todo[ti];
    console.log('[' + (ti + 1) + '/' + todo.length + '] ' + t.id + ' (user=' + t.userId + ')...');
    try {
      var result = await srv._runAnalyze(t.entry.messages, { timeoutMs: 120000 });
      if (!result) { console.log('  ✗ null'); fail++; continue; }
      var translated = translateV2ToV1Compatible(result, t.turns);
      var nh = translated ? (translated['命中指标'] || []) : [];

      // 检查 signal_quality
      var sq = result.signal_quality || 'normal';
      var sqr = result.signal_quality_reason || '';
      var strengthDist = {};
      var patternDist = {};
      for (var nj = 0; nj < nh.length; nj++) {
        var s = nh[nj]['strength'] || '?';
        strengthDist[s] = (strengthDist[s] || 0) + 1;
        var p = nh[nj]['观察模式'] || '(none)';
        patternDist[p] = (patternDist[p] || 0) + 1;
      }

      history[t.idx].analysis = { status: 'done', engineVersion: 'v2-reanalyzed' + (force ? '-force' : ''), result: translated || result };
      srv._writeHistory(history);

      var sqFlag = sq === 'low' ? ' ⚠signal_quality=LOW' : '';
      console.log('  ✓ hits=' + nh.length + ' signal_quality=' + sq + sqFlag +
        ' strengths=' + JSON.stringify(strengthDist));
      if (sq === 'low') console.log('    reason: ' + sqr);
      ok++;
    } catch (err) {
      console.log('  ✗ ' + (err.message || err));
      fail++;
    }
  }
  console.log('\n成功 ' + ok + ' / 失败 ' + fail);
  process.exit(fail > 0 ? 1 : 0);
})();
