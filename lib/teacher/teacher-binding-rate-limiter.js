/**
 * teacher-binding-rate-limiter.js — 内存限速组件
 *
 * 提供 per-teacher、per-IP 失败计数和全局异常告警。
 * 纯内存存储，重启归零。不引入新依赖。
 *
 * 导出: createTeacherBindingRateLimiter(options)
 */
'use strict';

function isString(val) { return typeof val === 'string'; }
function isFinitePositive(n) { return typeof n === 'number' && isFinite(n) && n > 0; }

// ============================================================
//  Factory
// ============================================================

function createTeacherBindingRateLimiter(options) {
  var opts = options || {};

  var nowFn = opts.now || Date.now;

  var teacherFailureLimit = 10;
  if (isFinitePositive(opts.teacherFailureLimit)) teacherFailureLimit = opts.teacherFailureLimit;
  var teacherWindowMs = 3600000; // 1 hour
  if (isFinitePositive(opts.teacherWindowMs)) teacherWindowMs = opts.teacherWindowMs;

  var ipFailureLimit = 30;
  if (isFinitePositive(opts.ipFailureLimit)) ipFailureLimit = opts.ipFailureLimit;
  var ipWindowMs = 3600000; // 1 hour
  if (isFinitePositive(opts.ipWindowMs)) ipWindowMs = opts.ipWindowMs;

  var globalAlertLimit = 500;
  if (isFinitePositive(opts.globalAlertLimit)) globalAlertLimit = opts.globalAlertLimit;
  var globalWindowMs = 300000; // 5 minutes
  if (isFinitePositive(opts.globalWindowMs)) globalWindowMs = opts.globalWindowMs;

  var onGlobalAlert = opts.onGlobalAlert || function () {};

  // buckets: { key: { timestamps: [ms, ...] } }
  var teacherBuckets = Object.create(null);
  var ipBuckets = Object.create(null);
  var globalTimestamps = [];

  // ============================================================
  //  Validation
  // ============================================================

  function validateTeacherId(id) {
    if (!isString(id)) return false;
    var len = id.length;
    if (len < 1 || len > 128) return false;
    return true;
  }

  function validateIp(ip) {
    if (!isString(ip)) return false;
    var len = ip.length;
    if (len < 1 || len > 45) return false; // max IPv6 with zone
    // Must not contain newlines
    if (ip.indexOf('\n') >= 0 || ip.indexOf('\r') >= 0) return false;
    return true;
  }

  function validateCategory(cat) {
    if (!isString(cat)) return false;
    if (cat.length > 64) return false;
    return true;
  }

  // ============================================================
  //  Bucket helpers
  // ============================================================

  function pruneBucket(bucket, windowMs, now) {
    var cutoff = now - windowMs;
    var kept = [];
    for (var i = 0; i < bucket.length; i++) {
      if (bucket[i] > cutoff) kept.push(bucket[i]);
    }
    return kept;
  }

  function countInWindow(bucket, windowMs, now) {
    var cutoff = now - windowMs;
    var count = 0;
    for (var i = 0; i < bucket.length; i++) {
      if (bucket[i] > cutoff) count++;
    }
    return count;
  }

  // ============================================================
  //  checkTeacher
  // ============================================================

  function checkTeacher(teacherId) {
    if (!validateTeacherId(teacherId)) return { blocked: false, remaining: teacherFailureLimit, reason: 'invalid' };
    var now = nowFn();
    var bucket = teacherBuckets[teacherId];
    if (!bucket) return { blocked: false, remaining: teacherFailureLimit, reason: null };
    var count = countInWindow(bucket, teacherWindowMs, now);
    if (count >= teacherFailureLimit) {
      return { blocked: true, remaining: 0, reason: 'teacher_limit' };
    }
    return { blocked: false, remaining: teacherFailureLimit - count, reason: null };
  }

  // ============================================================
  //  checkIp
  // ============================================================

  function checkIp(sourceIp) {
    if (!validateIp(sourceIp)) return { blocked: false, remaining: ipFailureLimit, reason: 'invalid' };
    var now = nowFn();
    var bucket = ipBuckets[sourceIp];
    if (!bucket) return { blocked: false, remaining: ipFailureLimit, reason: null };
    var count = countInWindow(bucket, ipWindowMs, now);
    if (count >= ipFailureLimit) {
      return { blocked: true, remaining: 0, reason: 'ip_limit' };
    }
    return { blocked: false, remaining: ipFailureLimit - count, reason: null };
  }

  // ============================================================
  //  recordFailure
  // ============================================================

  function recordFailure(entry) {
    var now = nowFn();
    var teacherId = entry.teacherId;
    var sourceIp = entry.sourceIp;

    if (validateTeacherId(teacherId)) {
      if (!teacherBuckets[teacherId]) teacherBuckets[teacherId] = [];
      teacherBuckets[teacherId].push(now);
    }

    if (validateIp(sourceIp)) {
      if (!ipBuckets[sourceIp]) ipBuckets[sourceIp] = [];
      ipBuckets[sourceIp].push(now);
    }

    // Global counter
    globalTimestamps.push(now);

    // Check global threshold
    var globalCount = countInWindow(globalTimestamps, globalWindowMs, now);
    if (globalCount >= globalAlertLimit) {
      try { onGlobalAlert(globalCount); } catch (_) {}
    }
  }

  // ============================================================
  //  recordSuccess
  // ============================================================

  function recordSuccess(entry) {
    // Success does not add to failure counts.
    // No cleanup of existing failures (buckets expire naturally).
  }

  // ============================================================
  //  getStatus
  // ============================================================

  function getStatus(query) {
    var now = nowFn();
    var result = {};
    if (query && validateTeacherId(query.teacherId)) {
      var tb = teacherBuckets[query.teacherId];
      result.teacher = tb ? countInWindow(tb, teacherWindowMs, now) : 0;
    }
    if (query && validateIp(query.sourceIp)) {
      var ib = ipBuckets[query.sourceIp];
      result.ip = ib ? countInWindow(ib, ipWindowMs, now) : 0;
    }
    // always expose global count
    result.global = countInWindow(globalTimestamps, globalWindowMs, now);
    return result;
  }

  // ============================================================
  //  cleanup
  // ============================================================

  function cleanup() {
    var now = nowFn();
    // Prune teacher buckets
    var tKeys = Object.keys(teacherBuckets);
    for (var i = 0; i < tKeys.length; i++) {
      var k = tKeys[i];
      teacherBuckets[k] = pruneBucket(teacherBuckets[k], teacherWindowMs, now);
      if (teacherBuckets[k].length === 0) delete teacherBuckets[k];
    }
    // Prune IP buckets
    var iKeys = Object.keys(ipBuckets);
    for (var j = 0; j < iKeys.length; j++) {
      var ik = iKeys[j];
      ipBuckets[ik] = pruneBucket(ipBuckets[ik], ipWindowMs, now);
      if (ipBuckets[ik].length === 0) delete ipBuckets[ik];
    }
    // Prune global
    globalTimestamps = pruneBucket(globalTimestamps, globalWindowMs, now);
  }

  // ============================================================
  //  resetForTests
  // ============================================================

  function resetForTests() {
    teacherBuckets = Object.create(null);
    ipBuckets = Object.create(null);
    globalTimestamps = [];
  }

  return {
    checkTeacher: checkTeacher,
    checkIp: checkIp,
    recordFailure: recordFailure,
    recordSuccess: recordSuccess,
    getStatus: getStatus,
    cleanup: cleanup,
    resetForTests: resetForTests,
  };
}

module.exports = { createTeacherBindingRateLimiter: createTeacherBindingRateLimiter };
