/**
 * test/chat-ui-rollback-contract.test.js — 聊天失败回滚静态合同测试
 *
 * 验证 chat.html 满足 Phase 8A1 复核修复要求：
 *   - addBubble 返回 DOM 元素引用
 *   - 无 removeLastUserBubble 全局查询
 *   - 失败路径使用 submittedBubble 引用精确删除
 *   - 状态快照回滚 (messages.length / turnCount / consecutiveShortCount)
 *   - 用户输入恢复
 *   - isLoading/btnSend 恢复
 *   - 错误码文案不变
 *   - maxlength=2000 不变
 *
 * 仅使用 node:test + node:assert + fs，不引入新依赖。
 */
'use strict';

var { describe, it } = require('node:test');
var assert = require('node:assert/strict');
var fs = require('fs');
var path = require('path');

var chatHtml = fs.readFileSync(path.join(__dirname, '..', 'public', 'chat.html'), 'utf-8');

// Extract the sendMessage function body (from 'async function sendMessage(){' to matching '}')
function extractSendMessage() {
  var start = chatHtml.indexOf('async function sendMessage(){');
  if (start < 0) return '';
  var depth = 0, i = start + 'async function sendMessage(){'.length - 1;
  for (; i < chatHtml.length; i++) {
    if (chatHtml[i] === '{') depth++;
    else if (chatHtml[i] === '}') { depth--; if (depth === 0) break; }
  }
  return chatHtml.substring(start, i + 1);
}
var sendMsg = extractSendMessage();

// ==========================================================
//  A. removeLastUserBubble 已移除
// ==========================================================

describe('A. removeLastUserBubble removed', function () {
  it('1. no removeLastUserBubble function', function () {
    assert.strictEqual(chatHtml.indexOf('removeLastUserBubble'), -1,
      'removeLastUserBubble must not exist');
  });

  it('2. no querySelectorAll(".message-row.user") for deletion', function () {
    // The only .user queries should be for adding, not removing
    var idx = chatHtml.indexOf('querySelectorAll');
    if (idx >= 0) {
      var snippet = chatHtml.substring(idx, idx + 80);
      assert.strictEqual(snippet.indexOf('.message-row.user'), -1,
        'must not querySelectorAll .message-row.user for bubble removal');
    }
  });
});

// ==========================================================
//  B. addBubble 返回值
// ==========================================================

describe('B. addBubble returns DOM element', function () {
  it('3. addBubble ends with return row', function () {
    assert.ok(
      chatHtml.indexOf('messageList.appendChild(row);chatMessages.scrollTop=chatMessages.scrollHeight;return row}') >= 0 ||
      chatHtml.indexOf('messageList.appendChild(row);chatMessages.scrollTop=chatMessages.scrollHeight;return row;') >= 0,
      'addBubble must return the created row element'
    );
  });
});

// ==========================================================
//  C. submittedBubble 引用
// ==========================================================

describe('C. submittedBubble reference tracking', function () {
  it('4. submittedBubble variable declared', function () {
    assert.ok(sendMsg.indexOf('submittedBubble') >= 0,
      'sendMessage must track submittedBubble');
  });

  it('5. submittedBubble assigned from addBubble return', function () {
    assert.ok(
      sendMsg.indexOf('submittedBubble=addBubble(') >= 0 ||
      sendMsg.indexOf('submittedBubble = addBubble(') >= 0,
      'submittedBubble must capture addBubble return value'
    );
  });

  it('6. submittedBubble removed via .isConnected check', function () {
    assert.ok(sendMsg.indexOf('submittedBubble.isConnected') >= 0,
      'must check isConnected before removing submittedBubble');
  });
});

// ==========================================================
//  D. 状态快照回滚
// ==========================================================

describe('D. state snapshot rollback', function () {
  it('7. prevMessagesLen captured before mutations', function () {
    assert.ok(sendMsg.indexOf('prevMessagesLen') >= 0,
      'must capture prevMessagesLen from messages.length');
  });

  it('8. messages.length restored to prevMessagesLen on error', function () {
    assert.ok(sendMsg.indexOf('messages.length=prevMessagesLen') >= 0 ||
      sendMsg.indexOf('messages.length = prevMessagesLen') >= 0,
      'must restore messages.length to snapshot');
  });

  it('9. prevTurnCount captured and restored', function () {
    assert.ok(sendMsg.indexOf('prevTurnCount') >= 0, 'must capture prevTurnCount');
    assert.ok(sendMsg.indexOf('turnCount=prevTurnCount') >= 0 ||
      sendMsg.indexOf('turnCount = prevTurnCount') >= 0,
      'must restore turnCount to snapshot');
  });

  it('10. prevConsecutiveShort captured and restored', function () {
    assert.ok(sendMsg.indexOf('prevConsecutiveShort') >= 0, 'must capture prevConsecutiveShort');
    assert.ok(sendMsg.indexOf('consecutiveShortCount=prevConsecutiveShort') >= 0 ||
      sendMsg.indexOf('consecutiveShortCount = prevConsecutiveShort') >= 0,
      'must restore consecutiveShortCount to snapshot');
  });

  it('11. no turnCount-- or consecutiveShortCount-- guess rollback', function () {
    assert.strictEqual(sendMsg.indexOf('turnCount--'), -1,
      'must not use turnCount-- for rollback');
    assert.strictEqual(sendMsg.indexOf('consecutiveShortCount--'), -1,
      'must not use consecutiveShortCount-- for rollback');
  });
});

// ==========================================================
//  E. 用户输入恢复
// ==========================================================

describe('E. user input restoration', function () {
  it('12. submittedText saved before input cleared', function () {
    assert.ok(sendMsg.indexOf('submittedText') >= 0,
      'must save submittedText');
  });

  it('13. msgInput.value restored only when empty', function () {
    assert.ok(
      sendMsg.indexOf('if(!msgInput.value)') >= 0 &&
      sendMsg.indexOf('msgInput.value=submittedText') >= 0,
      'must restore input only when currently empty'
    );
  });

  it('14. rollbackUserMessage restores submittedText', function () {
    // rollbackUserMessage function must contain the input restore logic
    var rbIdx = sendMsg.indexOf('function rollbackUserMessage()');
    assert.ok(rbIdx >= 0, 'must define rollbackUserMessage helper');
    var rbEnd = sendMsg.indexOf('}', rbIdx + 50);
    var rbBody = sendMsg.substring(rbIdx, rbEnd + 1);
    assert.ok(rbBody.indexOf('submittedText') >= 0,
      'rollbackUserMessage must restore submittedText');
  });

  it('14b. rollbackUserMessage calls updateCharCount and autoResizeTextarea', function () {
    var rbIdx = sendMsg.indexOf('function rollbackUserMessage()');
    var rbEnd = sendMsg.indexOf('}', rbIdx + 50);
    var rbBody = sendMsg.substring(rbIdx, rbEnd + 1);
    assert.ok(rbBody.indexOf('updateCharCount()') >= 0,
      'rollbackUserMessage must call updateCharCount');
    assert.ok(rbBody.indexOf('autoResizeTextarea()') >= 0,
      'rollbackUserMessage must call autoResizeTextarea');
  });
});

// ==========================================================
//  F. rollbackUserMessage 在错误和 catch 路径均被调用
// ==========================================================

describe('F. rollbackUserMessage called on both error and catch paths', function () {
  it('15. rollbackUserMessage called before addBubble error helper', function () {
    // In the !resp.ok branch: rollbackUserMessage() must come before the error switch
    var notOkIdx = sendMsg.indexOf('if (!resp.ok)');
    var afterNotOk = sendMsg.substring(notOkIdx, notOkIdx + 400);
    var rbCall = afterNotOk.indexOf('rollbackUserMessage()');
    var errSwitch = afterNotOk.indexOf("switch (data.error)");
    assert.ok(rbCall >= 0 && errSwitch >= 0 && rbCall < errSwitch,
      'rollbackUserMessage must be called BEFORE displaying error text');
  });

  it('16. rollbackUserMessage called in catch path', function () {
    var catchIdx = sendMsg.indexOf('}catch(err){');
    if (catchIdx < 0) catchIdx = sendMsg.indexOf('} catch(err){');
    if (catchIdx < 0) catchIdx = sendMsg.indexOf('}catch (err){');
    if (catchIdx < 0) catchIdx = sendMsg.indexOf('} catch (err){');
    assert.ok(catchIdx >= 0, 'catch block must exist');
    var afterCatch = sendMsg.substring(catchIdx, catchIdx + 200);
    assert.ok(afterCatch.indexOf('rollbackUserMessage()') >= 0,
      'must call rollbackUserMessage in catch path too');
  });
});

// ==========================================================
//  G. isLoading/btnSend 恢复
// ==========================================================

describe('G. loading and button state recovery', function () {
  it('17. !resp.ok path restores isLoading and btnSend', function () {
    var notOkIdx = sendMsg.indexOf('if (!resp.ok)');
    var afterNotOk = sendMsg.substring(notOkIdx, notOkIdx + 600);
    assert.ok(afterNotOk.indexOf('isLoading=false') >= 0, 'must reset isLoading on error');
    assert.ok(afterNotOk.indexOf('btnSend.disabled=false') >= 0, 'must re-enable btnSend on error');
  });

  it('18. finally-like cleanup after try/catch restores isLoading and btnSend', function () {
    // Lines after the catch block before the closing brace of sendMessage
    var catchEnd = sendMsg.lastIndexOf('}catch');
    if (catchEnd < 0) catchEnd = sendMsg.lastIndexOf('} catch');
    var afterCatch = sendMsg.substring(catchEnd);
    // Find the closing of the catch block and the final isLoading/btnSend lines
    // These should appear outside the try/catch
    assert.ok(afterCatch.indexOf('isLoading=false') >= 0,
      'post-try/catch must reset isLoading');
    assert.ok(afterCatch.indexOf('btnSend.disabled=false') >= 0,
      'post-try/catch must re-enable btnSend');
    assert.ok(afterCatch.indexOf('msgInput.focus()') >= 0,
      'post-try/catch must focus input');
  });

  it('19. removeTyping called before rollback in catch path', function () {
    var catchIdx = sendMsg.indexOf('}catch(err){');
    if (catchIdx < 0) catchIdx = sendMsg.indexOf('} catch(err){');
    if (catchIdx < 0) catchIdx = sendMsg.indexOf('}catch (err){');
    if (catchIdx < 0) catchIdx = sendMsg.indexOf('} catch (err){');
    var afterCatch = sendMsg.substring(catchIdx, catchIdx + 250);
    var rmIdx = afterCatch.indexOf('removeTyping()');
    var rbIdx = afterCatch.indexOf('rollbackUserMessage()');
    assert.ok(rmIdx >= 0 && rbIdx >= 0 && rmIdx < rbIdx,
      'removeTyping must be called before rollbackUserMessage in catch');
  });
});

// ==========================================================
//  H. 错误码文案不变
// ==========================================================

describe('H. error messages unchanged', function () {
  it('20. MESSAGE_EMPTY prompt', function () {
    assert.ok(sendMsg.indexOf('消息不能为空') >= 0);
  });
  it('21. MESSAGE_TOO_LONG prompt', function () {
    assert.ok(sendMsg.indexOf('消息过长，请精简到 2000 个字符以内') >= 0);
  });
  it('22. PAYLOAD_TOO_LARGE prompt', function () {
    assert.ok(sendMsg.indexOf('发送内容过大，请精简后重试') >= 0);
  });
  it('23. INVALID_REQUEST / INVALID_JSON prompt', function () {
    assert.ok(sendMsg.indexOf('消息格式不正确，请重新输入') >= 0);
  });
  it('24. fallback prompt', function () {
    assert.ok(sendMsg.indexOf('小新暂时无法回应，请稍后重试') >= 0);
  });
  it('25. no err.message exposed', function () {
    assert.strictEqual(sendMsg.indexOf('err.message'), -1);
  });
});

// ==========================================================
//  I. maxlength=2000 不变
// ==========================================================

describe('I. maxlength preserved', function () {
  it('26. msgInput has maxlength=2000', function () {
    assert.ok(chatHtml.indexOf('maxlength="2000"') >= 0,
      'msgInput must retain maxlength="2000"');
  });

  it('27. placeholder mentions 2000 个字符', function () {
    assert.ok(chatHtml.indexOf('2000 个字符') >= 0,
      'placeholder must say 2000 个字符');
  });
});

// ==========================================================
//  J. textarea auto-height and char count
// ==========================================================

describe('J. textarea auto-height and char count', function () {
  it('28. msgInput is a textarea (not input)', function () {
    assert.ok(chatHtml.indexOf('<textarea id="msgInput"') >= 0,
      'msgInput must be a textarea element');
  });

  it('29. textarea has rows="1"', function () {
    assert.ok(chatHtml.indexOf('rows="1"') >= 0,
      'textarea must have rows="1" start');
  });

  it('30. textarea has resize:none via CSS', function () {
    assert.ok(chatHtml.indexOf('resize: none') >= 0,
      'textarea must have resize:none in CSS');
  });

  it('31. autoResizeTextarea function exists', function () {
    assert.ok(chatHtml.indexOf('function autoResizeTextarea()') >= 0,
      'must define autoResizeTextarea');
  });

  it('32. autoResizeTextarea clamps to 160px max-height', function () {
    assert.ok(chatHtml.indexOf('Math.min(msgInput.scrollHeight, 160)') >= 0,
      'must clamp height to 160px');
  });

  it('33. updateCharCount function exists and uses value.length', function () {
    assert.ok(chatHtml.indexOf('function updateCharCount()') >= 0,
      'must define updateCharCount');
    // Char count must use msgInput.value.length (not .textLength etc)
    var ucIdx = chatHtml.indexOf('function updateCharCount()');
    var ucEnd = chatHtml.indexOf('}', ucIdx + 40);
    var ucBody = chatHtml.substring(ucIdx, ucEnd + 1);
    assert.ok(ucBody.indexOf('msgInput.value.length') >= 0,
      'must use msgInput.value.length for counting');
  });

  it('34. charCount element exists in HTML', function () {
    assert.ok(chatHtml.indexOf('id="charCount"') >= 0,
      'must have a charCount span');
  });

  it('35. charCount shows "0 / 2000" format', function () {
    var ccIdx = chatHtml.indexOf('id="charCount"');
    var ccSnippet = chatHtml.substring(ccIdx, ccIdx + 50);
    assert.ok(ccSnippet.indexOf('/ 2000') >= 0,
      'charCount must show "0 / 2000" format');
  });

  it('36. input event triggers autoResizeTextarea and updateCharCount', function () {
    // msgInput 的 input 事件监听应同时调用两者
    // （页面里 historySearch 也有 input 监听，必须定位到 msgInput 的那一个）
    var inputListener = chatHtml.indexOf("msgInput.addEventListener('input'");
    assert.ok(inputListener >= 0, 'must have input event listener');
    var afterListener = chatHtml.substring(inputListener, inputListener + 120);
    assert.ok(afterListener.indexOf('autoResizeTextarea()') >= 0,
      'input handler must call autoResizeTextarea');
    assert.ok(afterListener.indexOf('updateCharCount()') >= 0,
      'input handler must call updateCharCount');
  });

  it('37. sendMessage resets height and count after clearing input', function () {
    // In sendMessage, after msgInput.value = '', should call autoResizeTextarea + updateCharCount
    var smIdx = sendMsg.indexOf("msgInput.value=''");
    assert.ok(smIdx >= 0, 'sendMessage must clear input');
    var afterClear = sendMsg.substring(smIdx, smIdx + 80);
    assert.ok(afterClear.indexOf('autoResizeTextarea()') >= 0,
      'must call autoResizeTextarea after clearing input');
    assert.ok(afterClear.indexOf('updateCharCount()') >= 0,
      'must call updateCharCount after clearing input');
  });

  it('38. paste handler guards against >2000 char paste', function () {
    assert.ok(chatHtml.indexOf("addEventListener('paste'") >= 0,
      'must have paste event listener');
    assert.ok(chatHtml.indexOf('最多输入 2000 个字符，超出部分未输入') >= 0,
      'paste handler must show truncation toast');
  });

  it('39. paste handler uses clipboardData.getData for text', function () {
    assert.ok(chatHtml.indexOf('getData(\'text/plain\')') >= 0 ||
      chatHtml.indexOf('getData("text/plain")') >= 0,
      'paste handler must read text/plain from clipboard');
  });
});

// ==========================================================
//  K. 不会影响成功路径
// ==========================================================

describe('K. success path not affected', function () {
  it('40. rollbackUserMessage NOT called in success path', function () {
    // After !resp.ok check, before autoSave, there should be no rollback call
    var notOkIdx = sendMsg.indexOf('if (!resp.ok)');
    var autoSaveIdx = sendMsg.indexOf('autoSave()');
    var between = sendMsg.substring(notOkIdx, autoSaveIdx);
    // rollbackUserMessage should only appear BEFORE the success code (inside the if block)
    // But we need to find if it appears in the success path specifically
    // Get the closing brace of the if(!resp.ok) block
    var searchFrom = sendMsg.indexOf('msgInput.focus();', notOkIdx);
    if (searchFrom < 0) searchFrom = sendMsg.indexOf('return;', notOkIdx + 50);
    if (searchFrom < 0) searchFrom = notOkIdx + 400;
    var afterErrBlock = sendMsg.substring(searchFrom, autoSaveIdx);
    assert.strictEqual(afterErrBlock.indexOf('rollbackUserMessage()'), -1,
      'rollbackUserMessage must NOT be called in the success path');
  });
});
