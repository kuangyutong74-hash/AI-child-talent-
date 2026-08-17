/**
 * test/analyze-v2-translator.test.js — V2→V1 翻译器单元测试
 *
 * 使用真实 AI 产出的 V2 fixture（test/fixtures/analyze-v2-*.json），
 * 验证 translateV2ToV1Compatible() 的字段映射、强度备注、安全透传、
 * 边界情况。
 *
 * 覆盖：
 *   A. 输入安全
 *   B. 有命中场景（fixture 1）：indicator 查表 + strength 前缀
 *   C. 无命中场景（fixture 3）：空数组不报错
 *   D. 未命中指标始终空数组
 *   E. safety_alert / safety_alert_reason 透传
 *   F. 分析范围生成
 *   G. INDICATOR_MAP 7 对映射完整性
 */

'use strict';

var { describe, it } = require('node:test');
var assert = require('node:assert/strict');
var path = require('path');
var fs = require('fs');

var translator = require('../lib/core/analyze-v2-translator');
var translate = translator.translateV2ToV1Compatible;

// ============================================================
//  加载真实 fixture
// ============================================================

var FIXTURES_DIR = path.join(__dirname, 'fixtures');

function loadFixture(name) {
  var raw = fs.readFileSync(path.join(FIXTURES_DIR, name), 'utf-8');
  return JSON.parse(raw);
}

var fix1 = loadFixture('analyze-v2-1.json');
var fix2 = loadFixture('analyze-v2-2.json');
var fix3 = loadFixture('analyze-v2-3.json');

// ============================================================
//  A. 输入安全
// ============================================================

describe('translateV2ToV1Compatible — 输入安全', function () {

  it('null 返回 null', function () {
    assert.strictEqual(translate(null, 0), null);
  });

  it('undefined 返回 null', function () {
    assert.strictEqual(translate(undefined, 0), null);
  });

  it('数组返回 null', function () {
    assert.strictEqual(translate([], 0), null);
  });

  it('字符串返回 null', function () {
    assert.strictEqual(translate('hello', 0), null);
  });

  it('空对象返回合法 V1 结构', function () {
    var result = translate({}, 0);
    assert.ok(result !== null);
    assert.strictEqual(result['分析范围'], '');
    assert.deepStrictEqual(result['命中指标'], []);
    assert.deepStrictEqual(result['未命中指标'], []);
    assert.strictEqual(result['安全提示'], false);
    assert.strictEqual(result['安全提示说明'], '');
  });

  it('turnCount 为 0 时分析范围为空字符串', function () {
    var result = translate({}, 0);
    assert.strictEqual(result['分析范围'], '');
  });

  it('turnCount 为负数时分析范围为空字符串', function () {
    var result = translate({}, -1);
    assert.strictEqual(result['分析范围'], '');
  });

  it('turnCount 为非数字时分析范围为空字符串', function () {
    var result = translate({}, 'abc');
    assert.strictEqual(result['分析范围'], '');
  });
});

// ============================================================
//  B. 有命中场景（fixture 1：篮球对话，4 条 evidence）
// ============================================================

describe('translateV2ToV1Compatible — 有命中场景 (fixture 1)', function () {

  var result = translate(fix1, 2);

  it('返回非 null', function () {
    assert.ok(result !== null);
  });

  it('分析范围根据 turnCount 生成', function () {
    assert.strictEqual(result['分析范围'], '第1-2轮');
  });

  it('命中指标数量等于 evidence 数组长度', function () {
    assert.strictEqual(result['命中指标'].length, fix1.evidence.length);
    assert.strictEqual(result['命中指标'].length, 4);
  });

  it('每条命中记录包含全部 6 个 V1 字段', function () {
    var required = ['维度', '指标', '证据片段', '说话轮次', '信号说明', '强度备注'];
    for (var i = 0; i < result['命中指标'].length; i++) {
      var hit = result['命中指标'][i];
      for (var j = 0; j < required.length; j++) {
        assert.ok(required[j] in hit,
          '第 ' + i + ' 条命中记录缺少字段: ' + required[j]);
      }
    }
  });

  it('indicator narrative_organization 正确映射为 语言表达·叙事组织能力', function () {
    var hit = result['命中指标'][0]; // fixture 1 第一条是 narrative_organization
    assert.strictEqual(hit['维度'], '语言表达');
    assert.strictEqual(hit['指标'], '叙事组织能力');
  });

  it('indicator active_topic_tendency 正确映射为 兴趣方向·主动话题倾向', function () {
    // fixture 1 第二条是 active_topic_tendency
    var hit = result['命中指标'][1];
    assert.strictEqual(hit['维度'], '兴趣方向');
    assert.strictEqual(hit['指标'], '主动话题倾向');
  });

  it('strength=weak 生成【弱证据】前缀', function () {
    // fixture 1 第一条: narrative_organization, strength=weak
    var hit = result['命中指标'][0];
    assert.ok(hit['强度备注'].indexOf('【弱证据】') === 0,
      'weak 强度备注应以【弱证据】开头，实际: ' + hit['强度备注']);
  });

  it('strength=moderate 生成【中等证据】前缀', function () {
    // fixture 1 第二条: active_topic_tendency, strength=moderate
    var hit = result['命中指标'][1];
    assert.ok(hit['强度备注'].indexOf('【中等证据】') === 0,
      'moderate 强度备注应以【中等证据】开头，实际: ' + hit['强度备注']);
  });

  it('强度备注包含 observation 原文', function () {
    var hit = result['命中指标'][1]; // moderate
    // observation: "学生主动提出打篮球话题，并在后续轮次中延续补充细节"
    var obs = fix1.evidence[1].observation;
    assert.ok(hit['强度备注'].indexOf(obs) > 0,
      '强度备注应包含 observation 原文');
  });

  it('信号说明 复用 observation 字段', function () {
    for (var i = 0; i < result['命中指标'].length; i++) {
      assert.strictEqual(
        result['命中指标'][i]['信号说明'],
        fix1.evidence[i].observation
      );
    }
  });

  it('证据片段 透传 evidence_text', function () {
    for (var i = 0; i < result['命中指标'].length; i++) {
      assert.strictEqual(
        result['命中指标'][i]['证据片段'],
        fix1.evidence[i].evidence_text
      );
    }
  });

  it('说话轮次 均为空字符串（V2 不提供）', function () {
    for (var i = 0; i < result['命中指标'].length; i++) {
      assert.strictEqual(result['命中指标'][i]['说话轮次'], '');
    }
  });
});

describe('translateV2ToV1Compatible — 交叉验证 (fixture 2)', function () {

  it('同样正确映射 4 条 evidence', function () {
    var r = translate(fix2, 2);
    assert.strictEqual(r['命中指标'].length, fix2.evidence.length);
    assert.strictEqual(r['命中指标'].length, 4);
    // fixture 2 第一条: narrative_organization, strength=moderate
    assert.strictEqual(r['命中指标'][0]['维度'], '语言表达');
    assert.strictEqual(r['命中指标'][0]['指标'], '叙事组织能力');
    assert.ok(r['命中指标'][0]['强度备注'].indexOf('【中等证据】') === 0);
    // fixture 2 第二条: self_reflection, strength=moderate
    assert.strictEqual(r['命中指标'][1]['维度'], '内省倾向');
    assert.strictEqual(r['命中指标'][1]['指标'], '自我反思频率');
  });

});

// ============================================================
//  C. 无命中场景（fixture 3：野餐对话，0 条 evidence）
// ============================================================

describe('translateV2ToV1Compatible — 无命中场景 (fixture 3)', function () {

  var result = translate(fix3, 1);

  it('返回非 null', function () {
    assert.ok(result !== null);
  });

  it('命中指标为空数组', function () {
    assert.deepStrictEqual(result['命中指标'], []);
  });

  it('不报错、不抛异常', function () {
    // 如果跑到这里没抛异常，就是通过了
    assert.ok(true);
  });

  it('未命中指标为空数组', function () {
    assert.deepStrictEqual(result['未命中指标'], []);
  });

  it('分析范围正确', function () {
    assert.strictEqual(result['分析范围'], '第1-1轮');
  });
});

// ============================================================
//  D. 未命中指标始终空数组（不管输入是什么）
// ============================================================

describe('translateV2ToV1Compatible — 未命中指标始终空', function () {

  it('有 evidence 时未命中指标为空', function () {
    var result = translate(fix1, 2);
    assert.deepStrictEqual(result['未命中指标'], []);
  });

  it('无 evidence 时未命中指标为空', function () {
    var result = translate(fix3, 1);
    assert.deepStrictEqual(result['未命中指标'], []);
  });

  it('空输入时未命中指标为空', function () {
    var result = translate({}, 0);
    assert.deepStrictEqual(result['未命中指标'], []);
  });
});

// ============================================================
//  E. safety_alert / safety_alert_reason 透传
// ============================================================

describe('translateV2ToV1Compatible — 安全字段透传', function () {

  it('safety_alert=false 透传为 安全提示=false', function () {
    var result = translate(fix1, 2);
    assert.strictEqual(result['安全提示'], false);
  });

  it('safety_alert_reason 为空时透传为空字符串', function () {
    var result = translate(fix1, 2);
    assert.strictEqual(result['安全提示说明'], '');
  });

  it('safety_alert=true 正确透传', function () {
    var withAlert = {
      safety_alert: true,
      safety_alert_reason: '学生提到自我伤害相关内容',
    };
    var result = translate(withAlert, 0);
    assert.strictEqual(result['安全提示'], true);
    assert.strictEqual(result['安全提示说明'], '学生提到自我伤害相关内容');
  });

  it('safety_alert=truthy 非布尔值不透传为 true', function () {
    var withTruthy = {
      safety_alert: 'truthy string',
      safety_alert_reason: '',
    };
    var result = translate(withTruthy, 0);
    assert.strictEqual(result['安全提示'], false,
      'safety_alert 仅接受 exact true');
  });

  it('safety_alert_reason 非字符串时返回空字符串', function () {
    var withBadReason = {
      safety_alert: true,
      safety_alert_reason: 123,
    };
    var result = translate(withBadReason, 0);
    assert.strictEqual(result['安全提示说明'], '');
  });
});

// ============================================================
//  F. 分析范围
// ============================================================

describe('translateV2ToV1Compatible — 分析范围', function () {

  it('turnCount=5 生成 第1-5轮', function () {
    var result = translate({}, 5);
    assert.strictEqual(result['分析范围'], '第1-5轮');
  });

  it('turnCount=0 生成空字符串', function () {
    var result = translate({}, 0);
    assert.strictEqual(result['分析范围'], '');
  });

  it('turnCount 未传时生成空字符串', function () {
    var result = translate({});
    assert.strictEqual(result['分析范围'], '');
  });
});

// ============================================================
//  F2. 新字段透传 (strength/was_prompted/prompt_intensity)
// ============================================================

describe('translateV2ToV1Compatible — 新字段透传', function () {

  it('translates strength field', function () {
    var v2 = { evidence: [{ indicator: 'self_reflection', evidence_text: 'x', observation: 'o', strength: 'weak' }] };
    var result = translate(v2, 3);
    assert.strictEqual(result['命中指标'][0]['strength'], 'weak');
  });

  it('translates was_prompted = true', function () {
    var v2 = { evidence: [{ indicator: 'self_reflection', evidence_text: 'x', observation: 'o', strength: 'weak', was_prompted: true }] };
    var result = translate(v2, 3);
    assert.strictEqual(result['命中指标'][0]['was_prompted'], true);
  });

  it('translates was_prompted = false', function () {
    var v2 = { evidence: [{ indicator: 'self_reflection', evidence_text: 'x', observation: 'o', strength: 'moderate', was_prompted: false }] };
    var result = translate(v2, 3);
    assert.strictEqual(result['命中指标'][0]['was_prompted'], false);
  });

  it('translates prompt_intensity valid values', function () {
    var v2 = { evidence: [{ indicator: 'self_reflection', evidence_text: 'x', observation: 'o', strength: 'weak', was_prompted: true, prompt_intensity: 'direct' }] };
    var result = translate(v2, 3);
    assert.strictEqual(result['命中指标'][0]['prompt_intensity'], 'direct');
  });

  it('prompt_intensity invalid defaults to none', function () {
    var v2 = { evidence: [{ indicator: 'self_reflection', evidence_text: 'x', observation: 'o', strength: 'weak', prompt_intensity: 'invalid' }] };
    var result = translate(v2, 3);
    assert.strictEqual(result['命中指标'][0]['prompt_intensity'], 'none');
  });

  it('missing was_prompted defaults to false', function () {
    var v2 = { evidence: [{ indicator: 'self_reflection', evidence_text: 'x', observation: 'o', strength: 'strong' }] };
    var result = translate(v2, 3);
    assert.strictEqual(result['命中指标'][0]['was_prompted'], false);
    assert.strictEqual(result['命中指标'][0]['prompt_intensity'], 'none');
  });

});

// ============================================================
//  G. INDICATOR_MAP 完整性
// ============================================================

describe('INDICATOR_MAP 完整性', function () {

  var map = translator._INDICATOR_MAP;

  it('包含全部 7 个 indicator', function () {
    var keys = Object.keys(map);
    assert.strictEqual(keys.length, 7);
  });

  it('每个 entry 有 dim 和 ind 字段', function () {
    var keys = Object.keys(map);
    for (var i = 0; i < keys.length; i++) {
      var entry = map[keys[i]];
      assert.ok(typeof entry.dim === 'string' && entry.dim.length > 0,
        keys[i] + ' 的 dim 应是非空字符串');
      assert.ok(typeof entry.ind === 'string' && entry.ind.length > 0,
        keys[i] + ' 的 ind 应是非空字符串');
    }
  });

  it('7 个 key 均匹配 analyze-v2.md 定义', function () {
    var expected = [
      'narrative_organization',
      'vocabulary_choice',
      'active_topic_tendency',
      'interest_depth_breadth',
      'self_reflection',
      'value_judgment',
      'adaptive_elaboration',
    ];
    for (var i = 0; i < expected.length; i++) {
      assert.ok(expected[i] in map,
        'INDICATOR_MAP 缺少 key: ' + expected[i]);
    }
  });

  it('4 个维度均被覆盖', function () {
    var dims = {};
    var keys = Object.keys(map);
    for (var i = 0; i < keys.length; i++) {
      dims[map[keys[i]].dim] = true;
    }
    assert.ok('语言表达' in dims);
    assert.ok('兴趣方向' in dims);
    assert.ok('内省倾向' in dims);
    assert.ok('思维方式' in dims);
  });
});

// ============================================================
//  H. unknown/非法 indicator fallback
// ============================================================

describe('translateV2ToV1Compatible — unknown indicator fallback', function () {

  it('不在 MAP 中的 indicator 保留原文作为 指标，维度为空', function () {
    var unknownV2 = {
      evidence: [{
        indicator: 'some_future_indicator',
        evidence_text: 'test evidence',
        observation: 'test obs',
        strength: 'moderate',
      }],
    };
    var result = translate(unknownV2, 1);
    assert.strictEqual(result['命中指标'].length, 1);
    assert.strictEqual(result['命中指标'][0]['维度'], '');
    assert.strictEqual(result['命中指标'][0]['指标'], 'some_future_indicator');
  });
});
