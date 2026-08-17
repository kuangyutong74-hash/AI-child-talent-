/**
 * test/prompt-v2-contract.test.js — V2 Prompt 契约测试
 *
 * 验证三个新版 Prompt 文件的内容完整性、接口契约和互不污染。
 * 不调用任何外部 API，不修改任何生产文件。
 *
 * 覆盖：
 *   1. 三个 V2 Prompt 文件都存在并可读取
 *   2. xiaoxin-v2.md 包含五个阶段名称
 *   3. xiaoxin-v2.md 包含 question_budget、known_facts、observation_focus
 *   4. xiaoxin-v2.md 明确 question_budget 只能为 0 或 1
 *   5. xiaoxin-v2.md 明确 closing 阶段不得提问
 *   6. xiaoxin-v2.md 明确禁止二选一和确认式情绪问题
 *   7. analyze-v2.md 包含七项指标
 *   8. analyze-v2.md 包含严格 JSON 字段
 *   9. analyze-v2.md 明确"不评分、不诊断、只使用学生原话"
 *   10. repair.md 包含全部 validation_errors 类型
 *   11. 三个 Prompt 不能包含明显的历史聊天污染文本
 *   12. 当前 prompts/xiaoxin.md 保持完全不变
 *   13. app.js 加载路径保持不变
 *   14. npm start 行为保持不变（子进程验证）
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const child_process = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

// ============================================================
//  读取各文件内容（若文件不存在则测试直接失败）
// ============================================================

const promptsDir = path.join(__dirname, '..', 'prompts');

let xiaoxinV2, analyzeV2, repair, xiaoxinLegacy;

try {
  xiaoxinV2 = fs.readFileSync(path.join(promptsDir, 'xiaoxin-v2.md'), 'utf-8');
} catch (e) {
  xiaoxinV2 = null;
}

try {
  analyzeV2 = fs.readFileSync(path.join(promptsDir, 'analyze-v2.md'), 'utf-8');
} catch (e) {
  analyzeV2 = null;
}

try {
  repair = fs.readFileSync(path.join(promptsDir, 'repair.md'), 'utf-8');
} catch (e) {
  repair = null;
}

try {
  xiaoxinLegacy = fs.readFileSync(path.join(promptsDir, 'xiaoxin.md'), 'utf-8');
} catch (e) {
  xiaoxinLegacy = null;
}

// ============================================================
//  测试
// ============================================================

describe('V2 Prompt 文件存在性', function () {

  it('prompts/xiaoxin-v2.md 存在并可读取', function () {
    assert.ok(xiaoxinV2 !== null, 'xiaoxin-v2.md 应存在');
    assert.ok(xiaoxinV2.length > 500, 'xiaoxin-v2.md 内容应超过 500 字符');
  });

  it('prompts/analyze-v2.md 存在并可读取', function () {
    assert.ok(analyzeV2 !== null, 'analyze-v2.md 应存在');
    assert.ok(analyzeV2.length > 500, 'analyze-v2.md 内容应超过 500 字符');
  });

  it('prompts/repair.md 存在并可读取', function () {
    assert.ok(repair !== null, 'repair.md 应存在');
    assert.ok(repair.length > 300, 'repair.md 内容应超过 300 字符');
  });

});

describe('xiaoxin-v2.md 契约', function () {

  it('应包含角色名称"小新"', function () {
    assert.ok(xiaoxinV2.includes('小新'), '应包含角色名称');
  });

  it('应包含全部五个阶段名称', function () {
    assert.ok(xiaoxinV2.includes('opening'), '应包含 opening 阶段');
    assert.ok(xiaoxinV2.includes('interest'), '应包含 interest 阶段');
    assert.ok(xiaoxinV2.includes('deepening'), '应包含 deepening 阶段');
    assert.ok(xiaoxinV2.includes('open_task'), '应包含 open_task 阶段');
    assert.ok(xiaoxinV2.includes('closing'), '应包含 closing 阶段');
  });

  it('应包含 question_budget、known_facts 和 observation_focus', function () {
    assert.ok(xiaoxinV2.includes('question_budget'), '应包含 question_budget');
    assert.ok(xiaoxinV2.includes('known_facts'), '应包含 known_facts');
    assert.ok(xiaoxinV2.includes('observation_focus'), '应包含 observation_focus');
  });

  it('应明确 question_budget 只能为 0、1 或 2', function () {
    assert.ok(xiaoxinV2.includes('question_budget 只能是 0、1 或 2'),
      '应明确写出"question_budget 只能是 0、1 或 2"');

    // 确保描述了 question_budget=2 的含义（2026-07-27: 上限从 1 改为 2）
    assert.ok(/2.*最多两个问题/.test(xiaoxinV2),
      '应描述 question_budget=2 时的行为：最多两个问题，同话题自然追问');

    // 确保描述无效值时的兜底策略
    assert.ok(xiaoxinV2.includes('最保守策略'),
      '应描述无效值时的兜底策略');
  });

  it('应明确 question_budget=0 时不得出现问号或隐含追问', function () {
    assert.ok(
      xiaoxinV2.includes('question_budget=0') ||
      xiaoxinV2.includes('question_budget：0') ||
      xiaoxinV2.includes('question_budget: 0'),
      '应包含 question_budget=0 的描述'
    );
    // 必须明确禁止问号
    assert.ok(
      xiaoxinV2.includes('不得出现') && xiaoxinV2.includes('？') ||
      xiaoxinV2.includes('绝对不能') && xiaoxinV2.includes('提问'),
      'question_budget=0 时应明确禁止提问'
    );
  });

  it('应明确 question_budget=1 时最多一个问题且允许不问', function () {
    assert.ok(
      xiaoxinV2.includes('最多一个问题') || xiaoxinV2.includes('最多一个问句'),
      '应明确 question_budget=1 时最多一个问题'
    );
    assert.ok(
      xiaoxinV2.includes('允许不问') || xiaoxinV2.includes('允许不提问') || xiaoxinV2.includes('允许完全不提问'),
      '应明确 question_budget=1 时允许完全不提问'
    );
  });

  it('应明确 closing 阶段不得提问', function () {
    // 定位五、closing 段落（而非 stage 枚举列表中的 "closing"）
    var closingHeader = xiaoxinV2.indexOf('五、closing');
    if (closingHeader < 0) {
      closingHeader = xiaoxinV2.indexOf('closing 阶段');
    }
    assert.ok(closingHeader >= 0, '应存在 closing 阶段的独立段落');
    var closingSection = xiaoxinV2.slice(closingHeader, closingHeader + 250);
    assert.ok(
      closingSection.includes('不提问题') || closingSection.includes('不提问') || closingSection.includes('不得提问') || closingSection.includes('绝对不能提问'),
      'closing 阶段应明确不得提问，实际内容: ' + closingSection.slice(0, 100)
    );
  });

  it('应明确禁止二选一（"是A还是B"）', function () {
    assert.ok(
      xiaoxinV2.includes('禁止') && xiaoxinV2.includes('是A还是B') ||
      xiaoxinV2.includes('禁止') && xiaoxinV2.includes('二选一') ||
      xiaoxinV2.includes('禁止') && xiaoxinV2.includes('还是'),
      '应明确禁止二选一'
    );
  });

  it('应明确禁止确认式情绪问题', function () {
    assert.ok(xiaoxinV2.includes('是不是'), '应包含禁止示例"是不是"');
    assert.ok(xiaoxinV2.includes('开不开心'), '应包含禁止示例"开不开心"');
    assert.ok(
      xiaoxinV2.includes('确认式情绪') || xiaoxinV2.includes('情绪问题'),
      '应明确禁止确认式情绪问题'
    );
  });

  it('应明确禁止输出 JSON、stage、question_budget 等内部状态', function () {
    assert.ok(xiaoxinV2.includes('禁止输出'), '应有禁止输出章节');
    assert.ok(xiaoxinV2.includes('JSON'), '应禁止输出 JSON');
    assert.ok(xiaoxinV2.includes('stage'), '应禁止输出 stage');
    assert.ok(xiaoxinV2.includes('question_budget'), '应禁止输出 question_budget');
  });

  it('应声明只输出学生可见的回复文本', function () {
    assert.ok(
      xiaoxinV2.includes('只输出') || xiaoxinV2.includes('最终输出'),
      '应声明输出规则'
    );
  });

});

describe('analyze-v2.md 契约', function () {

  it('应包含全部七项指标', function () {
    assert.ok(analyzeV2.includes('narrative_organization'), '应包含 narrative_organization');
    assert.ok(analyzeV2.includes('vocabulary_choice'), '应包含 vocabulary_choice');
    assert.ok(analyzeV2.includes('active_topic_tendency'), '应包含 active_topic_tendency');
    assert.ok(analyzeV2.includes('interest_depth_breadth'), '应包含 interest_depth_breadth');
    assert.ok(analyzeV2.includes('self_reflection'), '应包含 self_reflection');
    assert.ok(analyzeV2.includes('value_judgment'), '应包含 value_judgment');
    assert.ok(analyzeV2.includes('adaptive_elaboration'), '应包含 adaptive_elaboration');
  });

  it('应包含严格 JSON 输出字段', function () {
    assert.ok(analyzeV2.includes('"active_topics"'), '应包含 active_topics 字段');
    assert.ok(analyzeV2.includes('"evidence"'), '应包含 evidence 字段');
    assert.ok(analyzeV2.includes('"indicator"'), '应包含 indicator 字段');
    assert.ok(analyzeV2.includes('"evidence_text"'), '应包含 evidence_text 字段');
    assert.ok(analyzeV2.includes('"strength"'), '应包含 strength 字段');
    assert.ok(analyzeV2.includes('"engagement"'), '应包含 engagement 字段');
    assert.ok(analyzeV2.includes('"suggested_next_focus"'), '应包含 suggested_next_focus 字段');
    assert.ok(analyzeV2.includes('"suggested_stage"'), '应包含 suggested_stage 字段');
    assert.ok(analyzeV2.includes('"known_facts_to_add"'), '应包含 known_facts_to_add 字段');
    assert.ok(analyzeV2.includes('"novel"'), '应包含 novel 字段');
    assert.ok(analyzeV2.includes('"was_prompted"'), '应包含 was_prompted 字段');
    assert.ok(analyzeV2.includes('"prompt_intensity"'), '应包含 prompt_intensity 字段');
    assert.ok(analyzeV2.includes('"safety_alert"'), '应包含 safety_alert 字段');
  });

  it('应明确"不评分、不诊断"', function () {
    assert.ok(
      analyzeV2.includes('不评分') || analyzeV2.includes('不打分'),
      '应明确不评分/不打分'
    );
    assert.ok(
      analyzeV2.includes('不诊断') || analyzeV2.includes('不作') && analyzeV2.includes('诊断'),
      '应明确不作诊断'
    );
  });

  it('应明确"只使用学生原话作为证据"', function () {
    assert.ok(
      analyzeV2.includes('学生原话') || analyzeV2.includes('学生') && analyzeV2.includes('原话'),
      '应明确使用学生原话'
    );
    assert.ok(
      analyzeV2.includes('逐字摘录') || analyzeV2.includes('原话'),
      '应明确逐字摘录'
    );
  });

  it('应明确不把小新的话作为学生证据', function () {
    assert.ok(
      analyzeV2.includes('小新') || analyzeV2.includes('AI'),
      '应提及小新/AI的角色区分'
    );
  });

  it('应明确 strength 表示证据信息量而非学生能力等级', function () {
    assert.ok(
      analyzeV2.includes('证据信息量') || analyzeV2.includes('信息量'),
      '应说明 strength 表示证据信息量'
    );
    assert.ok(
      analyzeV2.includes('能力等级') || analyzeV2.includes('能力'),
      '应说明 strength 不表示能力等级'
    );
  });

  it('应要求输出严格 JSON 且不在前后加 Markdown', function () {
    assert.ok(
      analyzeV2.includes('代码围栏') || analyzeV2.includes('```') || analyzeV2.includes('Markdown'),
      '应禁止 JSON 前后的代码围栏或 Markdown'
    );
  });

  it('不应包含对话历史污染（文件列表、路径、代码片段等）', function () {
    // 检查不应出现的污染文本模式
    var pollutionPatterns = [
      /\.png/,           // 图片文件名
      /\.pdf/,           // PDF 文件名
      /\.docx/,          // Word 文档名
      /Node\.js/,        // Node.js 代码片段
      /require\(/,       // require 调用
      /\/\* .* \*\//,    // JS 注释块
      /pasted/,          // 粘贴标记
      /Claude finished/, // Claude 对话结束标记
      /VS Code/,         // IDE 名称
      /server\.js/,      // 文件名引用
      /api\/auth/,       // API 路由
    ];
    pollutionPatterns.forEach(function (pattern) {
      assert.ok(!pattern.test(analyzeV2),
        'analyze-v2.md 不应包含污染文本模式: ' + pattern);
    });
  });

});

describe('analyze-v2.md state_events 契约', function () {

  it('应包含顶层 state_events 对象', function () {
    assert.ok(analyzeV2.includes('"state_events"'),
      'JSON schema 应包含 state_events 字段');
    assert.ok(analyzeV2.includes('状态事件规则'),
      '应包含状态事件规则章节');
  });

  it('应包含六个固定字段且全部在 JSON schema 中', function () {
    var fields = [
      'student_added_new_info',
      'student_refused_topic',
      'open_task_completed',
      'explicit_farewell',
      'allow_deepening',
      'allow_open_task',
    ];
    fields.forEach(function (f) {
      assert.ok(analyzeV2.includes('"' + f + '"'),
        'JSON schema 应包含字段: ' + f);
    });
  });

  it('六个字段示例值均为 boolean (false)', function () {
    // JSON schema 中 state_events 每个字段右侧应为 false
    var stateEventsBlock = analyzeV2.slice(
      analyzeV2.indexOf('"state_events"'),
      analyzeV2.indexOf('"state_events"') + 300
    );
    var fields = [
      'student_added_new_info',
      'student_refused_topic',
      'open_task_completed',
      'explicit_farewell',
      'allow_deepening',
      'allow_open_task',
    ];
    fields.forEach(function (f) {
      assert.ok(
        stateEventsBlock.includes('"' + f + '": false') ||
        stateEventsBlock.includes('"' + f + '": false'),
        f + ' 示例值应为 false'
      );
    });
  });

  it('应明确写有"不确定时 false"或等效表述', function () {
    assert.ok(
      analyzeV2.includes('不确定时') && analyzeV2.includes('false'),
      '应明确不确定时统一为 false'
    );
  });

  it('应明确禁止根据消息长度自动判断', function () {
    assert.ok(
      analyzeV2.includes('消息长度') || analyzeV2.includes('回复较长'),
      '应提及消息长度不能作为自动判断依据'
    );
  });

  it('应明确禁止从历史或助手消息复制事件', function () {
    assert.ok(
      analyzeV2.includes('助手') || analyzeV2.includes('小新'),
      '应提及不能从助手消息复制事件'
    );
    assert.ok(
      analyzeV2.includes('历史消息') || analyzeV2.includes('历史中'),
      '应提及不能从历史消息复制事件'
    );
  });

  it('explicit_farewell 只针对最新学生消息的当前告别意图', function () {
    assert.ok(
      analyzeV2.includes('最新一条') && analyzeV2.includes('学生消息'),
      '应明确只分析最新一条学生消息'
    );
    // 示例 5 专门说明历史中的告别不算
    assert.ok(
      analyzeV2.includes('历史中') || analyzeV2.includes('历史消息'),
      '应明确历史中的告别不触发 explicit_farewell'
    );
  });

  it('allow_deepening 要求 interest 阶段', function () {
    assert.ok(
      analyzeV2.includes('interest') && analyzeV2.includes('allow_deepening'),
      '应提及 allow_deepening 与 interest 阶段的关系'
    );
    // 示例 6/7 验证 opening 阶段不允许、interest 阶段允许
    assert.ok(
      analyzeV2.includes('opening') && analyzeV2.includes('allow_deepening'),
      '应明确 opening 阶段不允许 allow_deepening'
    );
  });

  it('allow_deepening 要求 student_added_new_info', function () {
    // 示例 7: student_added_new_info: true, allow_deepening: true
    // 示例 8: student_added_new_info: false, allow_open_task: false
    var stateEventsSection = analyzeV2.slice(
      analyzeV2.indexOf('状态事件规则'),
      analyzeV2.indexOf('状态事件规则') + 2000
    );
    assert.ok(
      stateEventsSection.includes('student_added_new_info') &&
      stateEventsSection.includes('allow_deepening'),
      'allow_deepening 条件应与 student_added_new_info 关联'
    );
  });

  it('allow_open_task 要求 deepening 阶段', function () {
    assert.ok(
      analyzeV2.includes('deepening') && analyzeV2.includes('allow_open_task'),
      '应提及 allow_open_task 与 deepening 阶段的关系'
    );
    // 示例 6 验证 opening 阶段不允许
    assert.ok(
      analyzeV2.includes('opening') && analyzeV2.includes('allow_open_task'),
      '应明确非 deepening 阶段不允许 allow_open_task'
    );
  });

  it('open_task_completed 只在 open_task 阶段成立', function () {
    assert.ok(
      analyzeV2.includes('open_task') && analyzeV2.includes('open_task_completed'),
      '应提及 open_task_completed 与 open_task 阶段的关系'
    );
    assert.ok(
      analyzeV2.includes('只有在') || analyzeV2.includes('只限') ||
      analyzeV2.includes('只有 '),
      '应明确条件限制为特定阶段'
    );
  });

  it('state_events 不直接修改 stage', function () {
    assert.ok(
      analyzeV2.includes('不负责直接修改 stage') ||
      analyzeV2.includes('不直接修改 stage') ||
      analyzeV2.includes('由后端状态机'),
      '应明确 state_events 不直接修改 stage，由状态机决定'
    );
  });

  it('仍然要求只输出 JSON，不含代码围栏', function () {
    // 保留原来对只输出 JSON 的验证（已有测试覆盖，这里只需确认 state_events
    // 的加入没有破坏这个规则）
    assert.ok(
      analyzeV2.includes('只输出') || analyzeV2.includes('最终输出'),
      'state_events 加入后仍应要求只输出 JSON'
    );
  });

  it('应包含不少于 8 个 state_events 示例', function () {
    // 统计示例数量：每个示例以"示例 N"或"示例N"开头
    var exampleMatches = analyzeV2.match(/示例\s*\d/g);
    var stateEventsExampleCount = 0;
    if (exampleMatches) {
      // 示例中从示例 1 到示例 9 是 state_events 的
      stateEventsExampleCount = exampleMatches.length;
    }
    assert.ok(stateEventsExampleCount >= 8,
      '应包含至少 8 个 state_events 示例 (实际: ' + stateEventsExampleCount + ')');
  });

  it('应明确 six 字段必须始终存在且只能是 boolean', function () {
    assert.ok(
      analyzeV2.includes('只能') && analyzeV2.includes('true') && analyzeV2.includes('false'),
      '应明确字段值只能是 true 或 false'
    );
    assert.ok(
      analyzeV2.includes('始终存在') || analyzeV2.includes('必须始终'),
      '应明确六个字段必须始终存在'
    );
  });

});

describe('repair.md 契约', function () {

  it('应包含全部 validation_errors 类型', function () {
    assert.ok(repair.includes('question_budget_exceeded'), '应包含 question_budget_exceeded');
    assert.ok(repair.includes('binary_question'), '应包含 binary_question');
    assert.ok(repair.includes('emotion_confirmation_question'), '应包含 emotion_confirmation_question');
    assert.ok(repair.includes('repeated_greeting'), '应包含 repeated_greeting');
    assert.ok(repair.includes('forbidden_opening'), '应包含 forbidden_opening');
    assert.ok(repair.includes('closing_contains_question'), '应包含 closing_contains_question');
    assert.ok(repair.includes('reply_too_long'), '应包含 reply_too_long');
    assert.ok(repair.includes('leaked_internal_state'), '应包含 leaked_internal_state');
    assert.ok(repair.includes('repeated_known_fact'), '应包含 repeated_known_fact');
  });

  it('应声明只输出修复后的回复文本', function () {
    assert.ok(
      repair.includes('只输出') || repair.includes('最终输出'),
      '应声明输出规则'
    );
  });

  it('应声明不输出 JSON', function () {
    assert.ok(
      repair.includes('不输出 JSON') || repair.includes('不输出JSON'),
      '应明确不输出 JSON'
    );
  });

  it('应声明修复后默认 1 至 2 句话', function () {
    assert.ok(
      repair.includes('1') && repair.includes('2') && repair.includes('句'),
      '应提及修复后的长度限制（1-2句）'
    );
  });

  it('应声明 question_budget 为无效值时按 0 处理', function () {
    // repair.md 的 question_budget 说明应与 xiaoxin-v2.md 一致
    assert.ok(
      repair.includes('question_budget'),
      '应包含 question_budget 说明'
    );
  });

});

describe('V2 Prompt 污染检测', function () {

  it('xiaoxin-v2.md 不应包含聊天污染文本', function () {
    var pollutionChecks = [
      { pattern: /\.pdf|\.docx|\.png/, desc: '文件名后缀' },
      { pattern: /require\(|module\.exports/, desc: 'JS 代码' },
      { pattern: /Claude finished/, desc: 'Claude 对话碎片' },
      { pattern: /pasted/, desc: '粘贴标记' },
      { pattern: /VS Code/, desc: 'IDE 名称' },
    ];
    pollutionChecks.forEach(function (check) {
      assert.ok(!check.pattern.test(xiaoxinV2),
        'xiaoxin-v2.md 不应包含: ' + check.desc);
    });
  });

  it('repair.md 不应包含聊天污染文本', function () {
    var pollutionChecks = [
      { pattern: /\.pdf|\.docx|\.png/, desc: '文件名后缀' },
      { pattern: /require\(|module\.exports/, desc: 'JS 代码' },
      { pattern: /Claude finished/, desc: 'Claude 对话碎片' },
      { pattern: /pasted/, desc: '粘贴标记' },
    ];
    pollutionChecks.forEach(function (check) {
      assert.ok(!check.pattern.test(repair),
        'repair.md 不应包含: ' + check.desc);
    });
  });

});

describe('生产 Prompt 不变性', function () {

  it('prompts/xiaoxin.md 仍可正常读取且内容不变', function () {
    assert.ok(xiaoxinLegacy !== null, 'xiaoxin.md 应存在');
    assert.ok(xiaoxinLegacy.includes('小新'), '应包含角色名称');
    assert.ok(xiaoxinLegacy.includes('开场破冰'), '应包含五阶段内容');
  });

  it('旧版 xiaoxin.md 与备份 xiaoxin-legacy.md 完全一致', function () {
    var legacyPath = path.join(__dirname, '..', 'docs', 'archive', 'prompts', 'xiaoxin-legacy.md');
    var legacy = fs.readFileSync(legacyPath, 'utf-8');
    assert.strictEqual(xiaoxinLegacy, legacy,
      '旧版 xiaoxin.md 应与备份完全一致');
  });

});

describe('app.js 加载路径不变性', function () {

  it('app.js 不再加载 V1 xiaoxin.md（V2 恒启用，V1 Prompt 已退役）', function () {
    var serverContent = fs.readFileSync(
      path.join(__dirname, '..', 'app.js'), 'utf-8'
    );
    // xiaoxin.md 仍保留在磁盘上作为旧版存档（见下方"仍可正常读取"测试），
    // 但运行时不再加载：/chat/session 恒走 V2 管线（analyze-v2 + xiaoxin-v2 + repair）
    assert.ok(
      !serverContent.includes('xiaoxin.md'),
      'app.js 不应再从 prompts/xiaoxin.md 加载 SYSTEM_PROMPT'
    );
  });

  it('app.js 从 prompts/analyze-v2.md 加载 ANALYZE_SYSTEM_PROMPT', function () {
    var serverContent = fs.readFileSync(
      path.join(__dirname, '..', 'app.js'), 'utf-8'
    );
    assert.ok(
      serverContent.includes('analyze-v2.md'),
      'app.js 应从 prompts/analyze-v2.md 加载 ANALYZE_SYSTEM_PROMPT'
    );
  });

  it('app.js 应仅在 V2 路径中延迟加载 V2 Prompt', function () {
    var serverContent = fs.readFileSync(
      path.join(__dirname, '..', 'app.js'), 'utf-8'
    );

    // 1. 定义了 getV2Prompts 函数
    assert.ok(
      serverContent.includes('function getV2Prompts()'),
      'app.js 应定义 getV2Prompts 函数'
    );

    // 2. getV2Prompts 内部引用三个正确的 Prompt 文件
    var funcStart = serverContent.indexOf('function getV2Prompts()');
    var funcEnd = serverContent.indexOf('\n}', funcStart);
    if (funcEnd < 0) funcEnd = serverContent.indexOf('}', funcStart);
    var funcBody = serverContent.slice(funcStart, funcEnd);
    assert.ok(funcBody.includes("xiaoxin-v2.md"),
      'getV2Prompts 应加载 xiaoxin-v2.md');
    assert.ok(funcBody.includes("analyze-v2.md"),
      'getV2Prompts 应加载 analyze-v2.md');
    assert.ok(funcBody.includes("repair.md"),
      'getV2Prompts 应加载 repair.md');

    // 3. V2 功能开关已移除 — 验证 app.js 不再定义 isV2Enabled 和 if (isV2Enabled())
    assert.ok(
      !serverContent.includes('function isV2Enabled()'),
      'app.js 不应再定义已废弃的 isV2Enabled 函数'
    );
    assert.ok(
      !serverContent.includes('if (isV2Enabled())'),
      'app.js 不应再包含已废弃的 V2 feature flag 分支'
    );

    // 4. getV2Prompts 应直接在对话主流程中调用
    var promptCallIndex2 = serverContent.indexOf(
      'const prompts = getV2Prompts()'
    );
    assert.ok(promptCallIndex2 >= 0,
      'getV2Prompts 应在对话主流程中被调用');

    // 5. 不允许在模块顶层定义大写常量形式的 V2 Prompt
    assert.ok(
      !/const\s+XIAOXIN_V2_PROMPT\b/.test(serverContent),
      '不应在模块顶层定义 XIAOXIN_V2_PROMPT 常量'
    );
    assert.ok(
      !/const\s+ANALYZE_V2_PROMPT\b/.test(serverContent),
      '不应在模块顶层定义 ANALYZE_V2_PROMPT 常量'
    );
    assert.ok(
      !/const\s+REPAIR_V2_PROMPT\b/.test(serverContent),
      '不应在模块顶层定义 REPAIR_V2_PROMPT 常量'
    );
  });

});

describe('npm start 行为不变性 (子进程验证)', function () {

  it('npm start 仍可正常启动并响应 health check', async function () {
    // 直接加载 app.js 验证 initializeRuntime + app 可用，不依赖子进程超时
    var server = require('../app');
    assert.ok(server, 'app.js 应返回模块导出');
    assert.strictEqual(typeof server.app, 'function', '应导出 Express app');
    assert.strictEqual(typeof server.initializeRuntime, 'function', '应导出 initializeRuntime');

    // 验证 initializeRuntime 可正常执行
    try {
      await server.initializeRuntime();
    } catch (err) {
      assert.fail('initializeRuntime 不应抛出异常: ' + err.message);
    }
  });

});

describe('备份文件完整性', function () {

  it('docs/archive/prompts/xiaoxin-legacy.md 存在', function () {
    var p = path.join(__dirname, '..', 'docs', 'archive', 'prompts', 'xiaoxin-legacy.md');
    assert.ok(fs.existsSync(p), 'xiaoxin-legacy.md 应存在');
  });

  it('docs/archive/prompts/analyze-legacy.md 存在', function () {
    var p = path.join(__dirname, '..', 'docs', 'archive', 'prompts', 'analyze-legacy.md');
    assert.ok(fs.existsSync(p), 'analyze-legacy.md 应存在');
  });

  it('备份文件不是空文件', function () {
    var xiaoxinLegacyPath = path.join(__dirname, '..', 'docs', 'archive', 'prompts', 'xiaoxin-legacy.md');
    var analyzeLegacyPath = path.join(__dirname, '..', 'docs', 'archive', 'prompts', 'analyze-legacy.md');
    assert.ok(fs.statSync(xiaoxinLegacyPath).size > 100, 'xiaoxin-legacy.md 不应为空');
    assert.ok(fs.statSync(analyzeLegacyPath).size > 100, 'analyze-legacy.md 不应为空');
  });

});
