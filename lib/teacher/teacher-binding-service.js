/**
 * teacher-binding-service.js — 教师绑定服务
 *
 * 协调 invitation Store 和 bindings Store。
 * 是跨 Store 操作的唯一协调入口。
 * 拥有进程内总串行队列。
 *
 * 导出: createTeacherBindingService(options)
 */

'use strict';

var isNonArrayObject = function (val) {
  return Boolean(val && typeof val === 'object' && !Array.isArray(val));
};

var isString = function (val) {
  return typeof val === 'string';
};

// ============================================================
//  Factory
// ============================================================

function createTeacherBindingService(options) {
  if (!isNonArrayObject(options)) throw new Error('options must be a non-array object');

  var invitationStore = options.invitationStore;
  var bindingsStore = options.bindingsStore;
  var getUserById = options.getUserById;
  var generateRawToken = options.generateRawToken;
  var nowFn = options.now || Date.now;
  var auditStore = options.auditStore || null;

  if (!invitationStore) throw new Error('invitationStore is required');
  if (!bindingsStore) throw new Error('bindingsStore is required');
  if (!getUserById) throw new Error('getUserById is required');
  if (!generateRawToken) throw new Error('generateRawToken is required');

  // ---- 总串行队列 ----
  var serviceQueue = Promise.resolve();

  function enqueue(worker) {
    var operation = serviceQueue.then(worker, worker);
    serviceQueue = operation.catch(function () {});
    return operation;
  }

  // ============================================================
  //  createInvitation
  // ============================================================

  function createInvitation(studentId) {
    return enqueue(function () {
      // 验证用户
      var user = getUserById(studentId);
      if (!user) throw makeErr('BINDING_TOKEN_INVALID', 'Student not found');
      if (user.role !== 'student') throw makeErr('BINDING_TOKEN_INVALID', 'Not a student');
      if (user.id === 'guest') throw makeErr('BINDING_TOKEN_INVALID', 'Guest cannot create invitations');

      var now = nowFn();
      var rawToken = generateRawToken();
      var tokenHash = require('./teacher-binding-invitation-adapter').hashBindingToken(rawToken);

      var record = {
        id: 'inv-' + require('crypto').randomUUID(),
        tokenHash: tokenHash,
        studentId: studentId,
        createdAt: new Date(now).toISOString(),
        expiresAt: new Date(now + 15 * 60 * 1000).toISOString(),
        claimedAt: null,
        claimedByTeacherId: null,
        claimRecoveryUntil: null,
        bindingCompletedAt: null,
        tokenHashEraseAfter: null,
        revokedAt: null,
        expiredAt: null,
        abandonedAt: null,
        authorizationRevokedAt: null,
      };

      return invitationStore.createPending(record).then(function (saved) {
        auditWrite('BINDING_INVITATION_CREATED', 'SUCCESS', 'SUCCESS', { actorRole: 'student', actorId: studentId, studentId: studentId, invitationId: saved.id });
        return { id: saved.id, token: rawToken };
      }).catch(function (e) { auditWrite('BINDING_INVITATION_CREATE_REJECTED', 'STORE_FAILURE', 'FAILURE', { actorRole: 'student', actorId: studentId, studentId: studentId }); throw e; });
    });
  }

  // ============================================================
  //  redeemToken
  // ============================================================

  function redeemToken(rawToken, teacherId) {
    return enqueue(function () {
      var now = nowFn();

      // 验证 teacher
      var teacher = getUserById(teacherId);
      if (!teacher || teacher.role !== 'teacher') {
        auditWrite('BINDING_TOKEN_REDEEM_REJECTED', 'INVALID_ROLE', 'REJECTED', { actorRole: 'teacher', actorId: teacherId, teacherId: teacherId });
        throw makeErr('BINDING_TOKEN_INVALID');
      }

      // 验证 token 格式
      var adapter = require('./teacher-binding-invitation-adapter');
      if (!adapter.isValidRawBindingToken(rawToken)) {
        auditWrite('BINDING_TOKEN_REDEEM_REJECTED', 'INVALID_REQUEST', 'REJECTED', { actorRole: 'teacher', actorId: teacherId, teacherId: teacherId });
        throw makeErr('INVALID_REQUEST');
      }

      var tokenHash = adapter.hashBindingToken(rawToken);
      var record = invitationStore.findByTokenHash(tokenHash);

      // 1. 验证 token 存在
      if (!record) {
        auditWrite('BINDING_TOKEN_REDEEM_REJECTED', 'INVALID_TOKEN', 'REJECTED', { actorRole: 'teacher', actorId: teacherId, teacherId: teacherId });
        throw makeErr('BINDING_TOKEN_INVALID');
      }

      // 2. 验证 invitation 的 student
      var studentId = record.studentId;
      var student = getUserById(studentId);
      if (!student || student.role !== 'student' || student.id === 'guest') {
        if (student && student.id === 'guest') {
          auditWrite('BINDING_TOKEN_REDEEM_REJECTED', 'GUEST_FORBIDDEN', 'REJECTED', { actorRole: 'teacher', actorId: teacherId, studentId: studentId, teacherId: teacherId });
        } else {
          auditWrite('BINDING_TOKEN_REDEEM_REJECTED', 'INVALID_ROLE', 'REJECTED', { actorRole: 'teacher', actorId: teacherId, studentId: studentId, teacherId: teacherId });
        }
        throw makeErr('BINDING_TOKEN_INVALID');
      }

      // 3. 验证可赎回性
      var redeemCheck = adapter.validateRedeemableInvitation(record, teacherId, now);
      if (!redeemCheck.ok) {
        auditWrite('BINDING_TOKEN_REDEEM_REJECTED', 'INVALID_TOKEN', 'REJECTED', { actorRole: 'teacher', actorId: teacherId, studentId: studentId, teacherId: teacherId, invitationId: record.id });
        throw makeErr('BINDING_TOKEN_INVALID');
      }

      var state = adapter.deriveInvitationState(record, now);

      // 4. Claim（如果尚未 claimed）
      if (state === 'pending') {
        var claimed = invitationStore.claimForTeacher(tokenHash, teacherId, new Date(now).toISOString());
        return claimed.then(function (cr) {
          if (!cr) throw makeErr('BINDING_TOKEN_INVALID');
          return finishRedeem(cr, teacherId, studentId, student, now);
        });
      }

      // 5. 已在 claimed/completed 状态
      return finishRedeem(record, teacherId, studentId, student, now);
    });
  }

  function finishRedeem(record, teacherId, studentId, student, now) {
    var alreadyBound = bindingsStore.hasBinding(teacherId, studentId);

    if (!alreadyBound) {
      // Need to addBinding
      return bindingsStore.addBinding(teacherId, studentId).then(function () {
        return invitationStore.completeBinding(record.tokenHash, teacherId, new Date(now).toISOString());
      }).then(function (completed) {
        auditWrite('BINDING_TOKEN_REDEEMED', 'SUCCESS', 'SUCCESS', { actorRole: 'teacher', actorId: teacherId, studentId: studentId, teacherId: teacherId, invitationId: record.id });
        return {
          ok: true,
          student: { id: student.id, username: student.username || '' },
          alreadyBound: false,
        };
      }).catch(function (e) {
        auditWrite('BINDING_TOKEN_REDEEM_REJECTED', 'STORE_FAILURE', 'FAILURE', { actorRole: 'teacher', actorId: teacherId, studentId: studentId, teacherId: teacherId, invitationId: record.id });
        throw e;
      });
    } else {
      // Already bound — just complete the token if needed
      return invitationStore.completeBinding(record.tokenHash, teacherId, new Date(now).toISOString()).then(function () {
        auditWrite('BINDING_TOKEN_REDEEMED', 'SUCCESS', 'SUCCESS', { actorRole: 'teacher', actorId: teacherId, studentId: studentId, teacherId: teacherId, invitationId: record.id });
        return {
          ok: true,
          student: { id: student.id, username: student.username || '' },
          alreadyBound: true,
        };
      }).catch(function (e) { throw e; });
    }
  }

  // ============================================================
  //  revokeInvitation
  // ============================================================

  function revokeInvitation(invitationId, studentId) {
    return enqueue(function () {
      var user = getUserById(studentId);
      if (!user || user.role !== 'student') throw makeErr('INVALID_REQUEST');

      var now = nowFn();
      var isoNow = new Date(now).toISOString();

      // 读取 invitation，验证 ownership
      var invitations = invitationStore.readAll();
      var record = null;
      for (var i = 0; i < invitations.length; i++) {
        if (invitations[i].id === invitationId && invitations[i].studentId === studentId) {
          record = invitations[i]; break;
        }
      }
      if (!record) throw makeErr('INVALID_REQUEST');

      var state = require('./teacher-binding-invitation-adapter').deriveInvitationState(record, now);

      // pending: always allow
      // claimed: only allow if no binding exists yet
      if (state === 'claimed') {
        var claimedTid = record.claimedByTeacherId;
        if (claimedTid && bindingsStore.hasBinding(claimedTid, studentId)) {
          throw makeErr('INVALID_REQUEST', 'Binding already exists; use unbindTeacher instead');
        }
      } else if (state !== 'pending') {
        // completed/revoked/expired/abandoned/authorization_revoked → cannot revoke
        throw makeErr('INVALID_REQUEST');
      }

      return invitationStore.revokeInvitation(invitationId, studentId, isoNow).then(function (result) {
        if (!result) { auditWrite('BINDING_INVITATION_REVOKE_REJECTED', 'NOT_OWNER', 'REJECTED', { actorRole: 'student', actorId: studentId, studentId: studentId, invitationId: invitationId }); throw makeErr('INVALID_REQUEST'); }
        auditWrite('BINDING_INVITATION_REVOKED', 'SUCCESS', 'SUCCESS', { actorRole: 'student', actorId: studentId, studentId: studentId, invitationId: invitationId });
        return { ok: true };
      }).catch(function (e) { throw e; });
    });
  }

  // ============================================================
  //  unbindTeacher
  // ============================================================

  function unbindTeacher(teacherId, studentId) {
    return enqueue(function () {
      var user = getUserById(studentId);
      if (!user || user.role !== 'student') throw makeErr('INVALID_REQUEST', 'Not a student');

      // 1. 确认 binding 存在
      if (!bindingsStore.hasBinding(teacherId, studentId)) {
        throw makeErr('INVALID_REQUEST', 'Binding not found');
      }

      var now = nowFn();
      var isoNow = new Date(now).toISOString();

      // 2. 先使所有 token 失效
      return invitationStore.invalidateAllActiveForStudent(studentId, isoNow).then(function (pendingCount) {
        return invitationStore.invalidateRecoveryForPair(studentId, teacherId, isoNow).then(function (pairCount) {
          var totalTokenCount = pendingCount + pairCount;
          // 3. 再从 bindings 删除
          return bindingsStore.removeBinding(teacherId, studentId).then(function () {
            auditWrite('TEACHER_BINDING_REMOVED', 'SUCCESS', 'SUCCESS', { actorRole: 'student', actorId: studentId, studentId: studentId, teacherId: teacherId });
            return { ok: true };
          }).catch(function (e) {
            auditWrite('TEACHER_BINDING_REMOVE_REJECTED', 'STORE_FAILURE', 'FAILURE', { actorRole: 'student', actorId: studentId, studentId: studentId, teacherId: teacherId });
            throw e;
          });
        }).catch(function (e) { throw e; });
      }).catch(function (e) { throw e; });
    });
  }

  // ============================================================
  //  listTeachersForStudent
  // ============================================================

  function listTeachersForStudent(studentId) {
    var teacherIds = bindingsStore.listTeachersForStudent(studentId);
    var result = [];
    for (var i = 0; i < teacherIds.length; i++) {
      var tId = teacherIds[i];
      var tUser = getUserById(tId);
      if (tUser && tUser.role === 'teacher') {
        result.push({
          teacherId: tId,
          username: tUser.username || '',
        });
      }
    }
    return result;
  }

  // ============================================================
  //  cleanup
  // ============================================================

  function cleanup() {
    return enqueue(function () {
      return invitationStore.cleanupTerminalRecords(nowFn());
    });
  }

  // ============================================================
  //  辅助
  // ============================================================

  function makeErr(code, detail) {
    var err = new Error(detail || code);
    err.code = code;
    return err;
  }

  function auditWrite(eventType, reasonCategory, outcome, fields) {
    if (!auditStore) return;
    var now = nowFn();
    var event = {
      eventType: eventType,
      reasonCategory: reasonCategory,
      outcome: outcome,
      occurredAt: new Date(now).toISOString(),
      actorRole: fields.actorRole || 'system',
      actorId: fields.actorId || null,
      studentId: fields.studentId || null,
      teacherId: fields.teacherId || null,
      invitationId: fields.invitationId || null,
    };
    auditStore.appendEvent(event).catch(function () {});
  }

  return {
    createInvitation: createInvitation,
    redeemToken: redeemToken,
    revokeInvitation: revokeInvitation,
    unbindTeacher: unbindTeacher,
    listTeachersForStudent: listTeachersForStudent,
    cleanup: cleanup,
  };
}

module.exports = { createTeacherBindingService: createTeacherBindingService };
