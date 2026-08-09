/**
 * test/response-validator-v2.test.js
 * response-validator V2 契约测试
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const validator = require('../lib/core/response-validator');

const {
  validateReply,
  VALID_ERROR_CODES,
  DEFAULT_MAX_SENTENCES,
  DEFAULT_MAX_CHARS,
  _internals: internals,
} = validator;

function ctx(overrides) {
  return Object.assign(
    {
      stage: 'interest',
      question_budget: 1,
      turn_index: 2,
      known_facts: [],
      student_message: '',
    },
    overrides || {}
  );
}

function codes(result) {
  return result.errors.map(function (error) {
    return error.code;
  });
}

function has(result, code) {
  return codes(result).includes(code);
}

function assertResultShape(result) {
  assert.equal(
    typeof result.valid,
    'boolean'
  );

  assert.ok(
    Array.isArray(result.errors)
  );

  assert.equal(
    typeof result.question_count,
    'number'
  );

  assert.equal(
    typeof result.sentence_count,
    'number'
  );
}

// ============================================================
// 公共导出
// ============================================================

describe('公共导出', function () {
  it('导出稳定公共接口', function () {
    assert.equal(
      typeof validateReply,
      'function'
    );

    assert.equal(
      DEFAULT_MAX_SENTENCES,
      3
    );

    assert.equal(
      DEFAULT_MAX_CHARS,
      600
    );

    [
      'stripQuotedRegions',
      'countSentences',
      'splitQuestionChunks',
      'countQuestions',
      'countImplicitQuestions',
      'normalizeContext',
      'deduplicateErrors',
    ].forEach(function (name) {
      assert.equal(
        typeof internals[name],
        'function'
      );
    });
  });

  it('包含恰好十种错误代码', function () {
    assert.deepEqual(
      Array.from(VALID_ERROR_CODES),
      [
        'question_budget_exceeded',
        'binary_question',
        'emotion_confirmation_question',
        'repeated_greeting',
        'forbidden_opening',
        'closing_contains_question',
        'reply_too_long',
        'leaked_internal_state',
        'repeated_known_fact',
        'missing_required_question',
      ]
    );
  });
});

// ============================================================
// stripQuotedRegions
// ============================================================

describe('stripQuotedRegions', function () {
  const cases = [
    [
      '中文双引号',
      '你说“今天开心吗？”我听见了。',
      '今天开心吗',
    ],
    [
      '中文单引号',
      '你说‘今天开心吗？’我听见了。',
      '今天开心吗',
    ],
    [
      '中文角引号',
      '你说「今天开心吗？」我听见了。',
      '今天开心吗',
    ],
    [
      '中文双角引号',
      '你说『今天开心吗？』我听见了。',
      '今天开心吗',
    ],
    [
      '书名号',
      '你提到《为什么要学习？》这本书。',
      '为什么要学习',
    ],
    [
      'ASCII 双引号',
      'He said "Are you okay?" and left.',
      'Are you okay',
    ],
    [
      'ASCII 单引号',
      "He said 'Are you okay?' and left.",
      'Are you okay',
    ],
  ];

  cases.forEach(function (entry) {
    it(
      '剥离' + entry[0],
      function () {
        const result =
          internals.stripQuotedRegions(
            entry[1]
          );

        assert.equal(
          result.includes(entry[2]),
          false
        );

        assert.equal(
          result.length,
          entry[1].length
        );
      }
    );
  });

  it(
    "don't 和 student's 内部撇号被保留",
    function () {
      const input =
        "I don't know the student's name.";

      const result =
        internals.stripQuotedRegions(
          input
        );

      assert.ok(
        result.includes("don't")
      );

      assert.ok(
        result.includes("student's")
      );
    }
  );

  it('剥离 inline code', function () {
    const result =
      internals.stripQuotedRegions(
        '检查 `isReady?`。'
      );

    assert.equal(
      result.includes('isReady?'),
      false
    );
  });

  it('剥离 fenced code block', function () {
    const input =
      '前\n```\nready?\n```\n后';

    const result =
      internals.stripQuotedRegions(
        input
      );

    assert.equal(
      result.includes('ready?'),
      false
    );

    assert.equal(
      result.split('\n').length,
      input.split('\n').length
    );
  });

  it(
    '剥离 blockquote 行并保留下一行',
    function () {
      const result =
        internals.stripQuotedRegions(
          '  > 你今天开心吗？\n这是你之前说的。'
        );

      assert.equal(
        result.includes('你今天开心吗'),
        false
      );

      assert.ok(
        result.includes(
          '这是你之前说的'
        )
      );
    }
  );

  it('剥离 URL', function () {
    const result =
      internals.stripQuotedRegions(
        '链接 https://example.com/search?q=test 可以打开。'
      );

    assert.equal(
      result.includes('?q=test'),
      false
    );
  });

  it(
    '未闭合中文引号不吞掉后续文本',
    function () {
      const result =
        internals.stripQuotedRegions(
          '你说“今天开心吗？我也觉得。'
        );

      assert.ok(
        result.includes('我也觉得')
      );
    }
  );

  it(
    '未闭合 ASCII 单引号不吞掉后续文本',
    function () {
      const result =
        internals.stripQuotedRegions(
          "他说 'Are you okay? 后面仍保留。"
        );

      assert.ok(
        result.includes('后面仍保留')
      );
    }
  );

  it(
    '非字符串输入返回空字符串',
    function () {
      [
        null,
        undefined,
        123,
        [],
        {},
        function () {},
      ].forEach(function (value) {
        assert.equal(
          internals.stripQuotedRegions(
            value
          ),
          ''
        );
      });
    }
  );

  it('不修改输入', function () {
    const input =
      '你说“今天开心吗？”我听见了。';

    internals.stripQuotedRegions(
      input
    );

    assert.equal(
      input,
      '你说“今天开心吗？”我听见了。'
    );
  });
});

// ============================================================
// 问题计数
// ============================================================

describe('问题计数', function () {
  const quotedQuestions = [
    '你说“今天开心吗？”我听见了。',
    '你说‘今天开心吗？’我听见了。',
    '你说「今天开心吗？」我听见了。',
    '你说『今天开心吗？』我听见了。',
    '你提到《为什么要学习？》这本书。',
    '"Are you okay?" 是学生原话。',
    "'Are you okay?' 是学生原话。",
    '检查 `isReady?` 的值。',
    '```\nconst ok = ready?\n```\n结束。',
    '> 你今天开心吗？\n这是学生原话。',
  ];

  quotedQuestions.forEach(
    function (reply, index) {
      it(
        '引用或代码问题不计数 #' +
          (index + 1),
        function () {
          assert.equal(
            internals.countQuestions(
              reply
            ),
            0
          );
        }
      );
    }
  );

  it(
    'URL 查询问号不计数，外部问题正常计数',
    function () {
      assert.equal(
        internals.countQuestions(
          '看看 https://example.com/search?q=test 有用吗？'
        ),
        1
      );
    }
  );

  it(
    '引用外的问题正常计数',
    function () {
      assert.equal(
        internals.countQuestions(
          '你说“今天开心吗？”那你愿意再说说吗？'
        ),
        1
      );
    }
  );

  it(
    'ASCII 单引号引用不会擦掉前面的问号',
    function () {
      assert.equal(
        internals.countQuestions(
          "你好吗？'Are you okay?'"
        ),
        1
      );
    }
  );

  it(
    '显式问题和隐含问题同时计数',
    function () {
      assert.equal(
        internals.countQuestions(
          '你愿意吗。你今天开心？'
        ),
        2
      );
    }
  );

  const punctuationCases = [
    [
      '你好吗？How are you? 详细说说？',
      3,
    ],
    ['真的吗？？？', 1],
    ['Really???', 1],
    ['你说什么？！', 1],
    ['What?!', 1],
    ['What?! Really?', 2],
  ];

  punctuationCases.forEach(
    function (entry) {
      it(
        '问号簇计数：' + entry[0],
        function () {
          assert.equal(
            internals.countQuestions(
              entry[0]
            ),
            entry[1]
          );
        }
      );
    }
  );

  it(
    '隐含问题只保守识别吗和呢',
    function () {
      assert.equal(
        internals.countImplicitQuestions(
          '你今天开心吗'
        ),
        1
      );

      assert.equal(
        internals.countImplicitQuestions(
          '你今天开心呢'
        ),
        1
      );

      assert.equal(
        internals.countImplicitQuestions(
          '你今天开心吧。'
        ),
        0
      );
    }
  );

  it(
    'countSentences 对非字符串安全',
    function () {
      [
        null,
        undefined,
        123,
        [],
        {},
      ].forEach(function (value) {
        assert.equal(
          internals.countSentences(
            value
          ),
          0
        );
      });
    }
  );

  it(
    'sentence_count 使用原始回复',
    function () {
      const result = validateReply(
        '你说“第一句？第二句？”我听见了。',
        ctx({
          question_budget: 0,
        })
      );

      assert.equal(
        result.question_count,
        0
      );

      assert.equal(
        result.sentence_count,
        3
      );
    }
  );
});

// ============================================================
// budget 与 closing
// ============================================================

describe(
  'budget 与 closing 引用安全',
  function () {
    it(
      'budget=0 且只有引用问题时通过',
      function () {
        const result = validateReply(
          '你说“今天开心吗？”我听见了。',
          ctx({
            question_budget: 0,
          })
        );

        assert.equal(
          result.valid,
          true
        );
      }
    );

    it(
      'budget=0 且引用外有问题时违规',
      function () {
        const result = validateReply(
          '你说“今天开心吗？”那你愿意再说说吗？',
          ctx({
            question_budget: 0,
          })
        );

        assert.ok(
          has(
            result,
            'question_budget_exceeded'
          )
        );
      }
    );

    it(
      'budget=1 且两个问题时违规',
      function () {
        const result = validateReply(
          '你好吗？今天怎么样？',
          ctx({
            question_budget: 1,
          })
        );

        assert.ok(
          has(
            result,
            'question_budget_exceeded'
          )
        );
      }
    );

    it(
      'closing 仅有引用问题时不违规',
      function () {
        const result = validateReply(
          '你说“今天开心吗？”我会记住的。',
          ctx({
            stage: 'closing',
            question_budget: 0,
          })
        );

        assert.equal(
          has(
            result,
            'closing_contains_question'
          ),
          false
        );
      }
    );

    it(
      'closing 引用外有问题时违规',
      function () {
        const result = validateReply(
          '你说“今天开心吗？”那下次想聊什么？',
          ctx({
            stage: 'closing',
            question_budget: 0,
          })
        );

        assert.ok(
          has(
            result,
            'closing_contains_question'
          )
        );
      }
    );

    it(
      '引用中的二选一不触发',
      function () {
        const result = validateReply(
          '你说“是去图书馆还是去打球？”我听见了。',
          ctx({
            question_budget: 0,
          })
        );

        assert.equal(
          has(
            result,
            'binary_question'
          ),
          false
        );
      }
    );

    it(
      '引用中的情绪确认不触发',
      function () {
        const result = validateReply(
          '你说“你是不是有点难过？”我听见了。',
          ctx({
            question_budget: 0,
          })
        );

        assert.equal(
          has(
            result,
            'emotion_confirmation_question'
          ),
          false
        );
      }
    );

    it(
      '仅引用中的 known fact 问题不触发',
      function () {
        const result = validateReply(
          '你说“你喜欢篮球吗？”我已经记住了。',
          ctx({
            question_budget: 0,
            known_facts: [
              {
                key: 'sport',
                value: '篮球',
                source_quote:
                  '我喜欢篮球',
                confidence:
                  'explicit',
              },
            ],
          })
        );

        assert.equal(
          has(
            result,
            'repeated_known_fact'
          ),
          false
        );
      }
    );
  }
);

// ============================================================
// normalizeContext
// ============================================================

describe('normalizeContext', function () {
  it(
    '非法 context 使用保守默认值',
    function () {
      [
        null,
        undefined,
        [],
        123,
        'text',
        function () {},
      ].forEach(function (value) {
        assert.deepEqual(
          internals.normalizeContext(
            value
          ),
          {
            stage: 'closing',
            question_budget: 0,
            turn_index: 0,
            known_facts: [],
            student_message: '',
          }
        );
      });
    }
  );

  it(
    '支持 Object.create(null)',
    function () {
      const input =
        Object.create(null);

      input.stage = 'interest';
      input.question_budget = 1;
      input.turn_index = 3;
      input.known_facts = [];
      input.student_message =
        'hello';

      assert.deepEqual(
        internals.normalizeContext(
          input
        ),
        {
          stage: 'interest',
          question_budget: 1,
          turn_index: 3,
          known_facts: [],
          student_message: 'hello',
        }
      );
    }
  );

  it(
    '非法字段使用保守值',
    function () {
      assert.deepEqual(
        internals.normalizeContext({
          stage: 'invalid',
          question_budget: 9,
          turn_index: -1,
          known_facts: {},
          student_message: 123,
        }),
        {
          stage: 'closing',
          question_budget: 0,
          turn_index: 0,
          known_facts: [],
          student_message: '',
        }
      );
    }
  );

  it('不修改输入', function () {
    const input = ctx({
      known_facts: [
        {
          key: 'sport',
          value: '篮球',
          confidence: 'explicit',
        },
      ],
    });

    const snapshot =
      JSON.stringify(input);

    internals.normalizeContext(
      input
    );

    assert.equal(
      JSON.stringify(input),
      snapshot
    );
  });
});

// ============================================================
// reply 输入安全
// ============================================================

describe(
  '非字符串 reply 输入安全',
  function () {
    [
      null,
      undefined,
      123,
      [],
      {},
      function () {},
      true,
    ].forEach(function (
      reply,
      index
    ) {
      it(
        '非法 reply 安全返回 #' +
          (index + 1),
        function () {
          const result =
            validateReply(
              reply,
              ctx()
            );

          assertResultShape(
            result
          );

          assert.equal(
            result.valid,
            true
          );

          assert.equal(
            result.question_count,
            0
          );

          assert.equal(
            result.sentence_count,
            0
          );
        }
      );
    });
  }
);

// ============================================================
// deduplicateErrors
// ============================================================

describe(
  'deduplicateErrors',
  function () {
    it(
      '保留首次并保持顺序',
      function () {
        assert.deepEqual(
          internals.deduplicateErrors([
            {
              code:
                'binary_question',
              detail: 'first',
            },
            {
              code:
                'forbidden_opening',
              detail: 'middle',
            },
            {
              code:
                'binary_question',
              detail: 'second',
            },
          ]),
          [
            {
              code:
                'binary_question',
              detail: 'first',
            },
            {
              code:
                'forbidden_opening',
              detail: 'middle',
            },
          ]
        );
      }
    );

    it(
      '非法输入返回空数组',
      function () {
        [
          null,
          undefined,
          {},
          'text',
          123,
        ].forEach(function (value) {
          assert.deepEqual(
            internals.deduplicateErrors(
              value
            ),
            []
          );
        });
      }
    );

    it(
      '安全跳过非法条目',
      function () {
        assert.deepEqual(
          internals.deduplicateErrors([
            null,
            undefined,
            {},
            { code: '' },
            { code: 123 },
            {
              code:
                'binary_question',
              detail: 'ok',
            },
          ]),
          [
            {
              code:
                'binary_question',
              detail: 'ok',
            },
          ]
        );
      }
    );

    it(
      '特殊 key 不破坏映射',
      function () {
        assert.deepEqual(
          internals.deduplicateErrors([
            {
              code: '__proto__',
              detail: 'a',
            },
            {
              code: 'constructor',
              detail: 'b',
            },
            {
              code:
                'hasOwnProperty',
              detail: 'c',
            },
            {
              code: '__proto__',
              detail: 'd',
            },
          ]),
          [
            {
              code: '__proto__',
              detail: 'a',
            },
            {
              code: 'constructor',
              detail: 'b',
            },
            {
              code:
                'hasOwnProperty',
              detail: 'c',
            },
          ]
        );
      }
    );

    it('不修改输入', function () {
      const input = [
        {
          code:
            'binary_question',
          detail: 'first',
        },
        {
          code:
            'binary_question',
          detail: 'second',
        },
      ];

      const snapshot =
        JSON.stringify(input);

      internals.deduplicateErrors(
        input
      );

      assert.equal(
        JSON.stringify(input),
        snapshot
      );
    });
  }
);

// ============================================================
// 二选一
// ============================================================

describe('二选一检测', function () {
  [
    '你是想去图书馆，还是留在教室里？',
    '我们去看电影还是去打球？',
  ].forEach(function (reply) {
    it(
      '检测：' + reply,
      function () {
        assert.ok(
          has(
            validateReply(
              reply,
              ctx()
            ),
            'binary_question'
          )
        );
      }
    );
  });

  [
    '外面下雨了，还是算了吧。',
    '太远了，还是不要去了。',
    '虽然下雨了，但我还是想去打球。',
  ].forEach(function (reply) {
    it(
      '不误判：' + reply,
      function () {
        assert.equal(
          has(
            validateReply(
              reply,
              ctx({
                question_budget: 0,
              })
            ),
            'binary_question'
          ),
          false
        );
      }
    );
  });
});

// ============================================================
// 情绪确认
// ============================================================

describe(
  '情绪确认检测',
  function () {
    [
      '你是不是有点难过？',
      '你会不会觉得紧张？',
      '今天开不开心？',
    ].forEach(function (reply) {
      it(
        '检测：' + reply,
        function () {
          assert.ok(
            has(
              validateReply(
                reply,
                ctx()
              ),
              'emotion_confirmation_question'
            )
          );
        }
      );
    });

    [
      '不管是不是下雨，我们都会去。',
      '我不知道他会不会来。',
    ].forEach(function (reply) {
      it(
        '不误判：' + reply,
        function () {
          assert.equal(
            has(
              validateReply(
                reply,
                ctx({
                  question_budget: 0,
                })
              ),
              'emotion_confirmation_question'
            ),
            false
          );
        }
      );
    });

    it(
      '上一句问号不污染下一句',
      function () {
        const result =
          validateReply(
            '你好吗？我觉得是不是这样。',
            ctx()
          );

        assert.equal(
          has(
            result,
            'emotion_confirmation_question'
          ),
          false
        );
      }
    );
  }
);

// ============================================================
// 问候、开头、closing
// ============================================================

describe(
  '问候、禁止开头与 closing',
  function () {
    it(
      '非首轮问候被检测',
      function () {
        assert.ok(
          has(
            validateReply(
              '嘿，你今天过得怎么样？',
              ctx({
                turn_index: 2,
              })
            ),
            'repeated_greeting'
          )
        );
      }
    );

    it(
      '首轮问候不算重复问候',
      function () {
        assert.equal(
          has(
            validateReply(
              '嘿，我是小新！你今天怎么样？',
              ctx({
                stage: 'opening',
                turn_index: 1,
              })
            ),
            'repeated_greeting'
          ),
          false
        );
      }
    );

    [
      '哈哈，那太有意思了！',
      '哈哈哈，真的吗？',
      '其实，每个人都有自己的节奏。',
      '哇哦，那太酷了！',
      '  哈哈，你真有意思。',
    ].forEach(function (reply) {
      it(
        '禁止开头：' + reply,
        function () {
          assert.ok(
            has(
              validateReply(
                reply,
                ctx()
              ),
              'forbidden_opening'
            )
          );
        }
      );
    });

    it(
      '正文中间的其实不误判',
      function () {
        assert.equal(
          has(
            validateReply(
              '我觉得你说的其实很有道理。',
              ctx({
                question_budget: 0,
              })
            ),
            'forbidden_opening'
          ),
          false
        );
      }
    );

    it(
      'closing 问题被检测',
      function () {
        assert.ok(
          has(
            validateReply(
              '今天聊得很开心，下次想聊什么？',
              ctx({
                stage: 'closing',
                question_budget: 0,
              })
            ),
            'closing_contains_question'
          )
        );
      }
    );

    it(
      '自然 closing 可以通过',
      function () {
        assert.equal(
          validateReply(
            '今天聊得很开心，下次再聊啦。',
            ctx({
              stage: 'closing',
              question_budget: 0,
            })
          ).valid,
          true
        );
      }
    );
  }
);

// ============================================================
// 长度与泄漏
// ============================================================

describe(
  '长度与内部状态泄漏',
  function () {
    it(
      '超过三句话被检测',
      function () {
        const result =
          validateReply(
            '第一句。第二句。第三句。第四句。',
            ctx({
              question_budget: 0,
            })
          );

        assert.ok(
          has(
            result,
            'reply_too_long'
          )
        );

        assert.equal(
          result.sentence_count,
          4
        );
      }
    );

    it(
      '正好三句话不违规',
      function () {
        assert.equal(
          has(
            validateReply(
              '第一句。第二句。第三句。',
              ctx({
                question_budget: 0,
              })
            ),
            'reply_too_long'
          ),
          false
        );
      }
    );

    [
      '<runtime_state>opening</runtime_state>',
      '根据 question_budget 我不能提问。',
      '当前阶段：interest',
      '{"active_topics":["篮球"]}',
      '根据 known_facts 里的记录。',
    ].forEach(function (reply) {
      it(
        '检测泄漏：' + reply,
        function () {
          assert.ok(
            has(
              validateReply(
                reply,
                ctx({
                  question_budget: 0,
                })
              ),
              'leaked_internal_state'
            )
          );
        }
      );
    });

    it(
      '普通提到阶段不误判',
      function () {
        assert.equal(
          has(
            validateReply(
              '你这个阶段的训练应该以基础为主。',
              ctx({
                question_budget: 0,
              })
            ),
            'leaked_internal_state'
          ),
          false
        );
      }
    );
  }
);

// ============================================================
// repeated_known_fact
// ============================================================

describe(
  'repeated_known_fact',
  function () {
    const facts = [
      {
        key: 'sport',
        value: '篮球',
        source_quote:
          '我喜欢篮球',
        confidence: 'explicit',
      },
    ];

    it(
      '再次询问明确事实被检测',
      function () {
        assert.ok(
          has(
            validateReply(
              '你喜欢篮球吗？',
              ctx({
                known_facts: facts,
              })
            ),
            'repeated_known_fact'
          )
        );
      }
    );

    it(
      '陈述已知事实不误判',
      function () {
        assert.equal(
          has(
            validateReply(
              '篮球确实很有趣。',
              ctx({
                question_budget: 0,
                known_facts: facts,
              })
            ),
            'repeated_known_fact'
          ),
          false
        );
      }
    );

    it(
      '模糊匹配不触发',
      function () {
        assert.equal(
          has(
            validateReply(
              '你喜欢什么体育项目？',
              ctx({
                known_facts: facts,
              })
            ),
            'repeated_known_fact'
          ),
          false
        );
      }
    );

    it(
      '非法 known fact 安全跳过',
      function () {
        assert.equal(
          has(
            validateReply(
              '你喜欢篮球吗？',
              ctx({
                known_facts: [
                  null,
                  undefined,
                  {},
                  { value: 123 },
                ],
              })
            ),
            'repeated_known_fact'
          ),
          false
        );
      }
    );
  }
);

// ============================================================
// 纯函数与确定性
// ============================================================

describe(
  '纯函数与确定性',
  function () {
    it(
      '不修改 context 和 known_facts',
      function () {
        const input = ctx({
          known_facts: [
            {
              key: 'sport',
              value: '篮球',
              confidence:
                'explicit',
            },
          ],
        });

        const snapshot =
          JSON.stringify(input);

        validateReply(
          '你喜欢篮球吗？',
          input
        );

        assert.equal(
          JSON.stringify(input),
          snapshot
        );
      }
    );

    it(
      '相同输入产生相同输出',
      function () {
        const reply =
          '哈哈，你是不是喜欢篮球？还是足球？';

        const input = ctx({
          turn_index: 3,
        });

        assert.deepEqual(
          validateReply(
            reply,
            input
          ),
          validateReply(
            reply,
            input
          )
        );
      }
    );

    it(
      '错误顺序稳定且不重复',
      function () {
        const reply =
          '哈哈，你是不是喜欢篮球？还是足球？';

        const input = ctx({
          turn_index: 3,
        });

        const first = codes(
          validateReply(
            reply,
            input
          )
        );

        const second = codes(
          validateReply(
            reply,
            input
          )
        );

        assert.equal(
          new Set(first).size,
          first.length
        );

        assert.deepEqual(
          first,
          second
        );
      }
    );
  }
);