export const CHILD_INPUT_BLOCK_MESSAGE =
  '这句话涉及隐私/不太合适，故事里不要填写个人住址、电话这类隐私信息，也不要写低俗内容，请重新编辑角色台词。';

const PRIVACY_WORDS = [
  '手机号', '电话号码', '座机', '家庭住址', '家里地址', '我的住址',
  '住址', '家住', '小区', '学校', '班级', '姓名', '妈妈电话',
  '爸爸电话', '家长电话', '我叫', '我的名字是',
];

const EDGE_WORDS = [
  '看看腿', '看腿', '露腿', '秀腿', '身材', '胸大', '屁股大',
  '大长腿', '性感', '火辣', '摸腿', '亲一口', '睡一起', '暧昧',
  '擦边', '约炮', '约啪', '约p', '打炮', '炮友', '裸聊', '开房',
  '色情', '黄片', '黄色录像', '做爱', '性交', '猥亵', '性骚扰',
];

const ABUSIVE_WORDS = [
  '妈逼', '妈币', '傻逼', '煞笔', '沙比', '草泥马', '操你妈',
  '你妈死', '你妈妈死', '全家死', '死全家', '不得好死', '去你妈',
  '妈的', '他妈的', '狗东西', '王八蛋', '贱人', '废物', '滚蛋',
  '狗日的', '脑残', '白痴', '畜生', '婊子',
];

const VIOLENCE_WORDS = [
  '杀死', '杀掉', '打死', '砍死', '捅死', '枪毙', '自杀', '自残',
  '跳楼', '割腕', '尸体', '肢解', '剥皮', '断头', '挖眼', '开膛',
  '血淋淋',
];

const PINYIN_WORDS = [
  'caonima', 'caoni', 'nima', 'mabi', 'shabi', 'sb', 'gouri',
  'yuepao', 'yuep', 'zuoai', 'seqing', 'luoliao', 'kai房',
];

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\s_\-—~～,.，。!！?？*＊]+/g, '')
    .replace(/[艹草槽]/g, '操')
    .replace(/尼妈|泥妈|尼玛|泥马/g, '你妈')
    .replace(/煞笔|沙比|啥比/g, '傻逼');
}

export function shouldBlockChildInput(text: string): boolean {
  const raw = text.trim();
  if (!raw) return false;

  // Product rule: every uninterrupted 7–11 digit sequence is treated as a phone number.
  if (/(?<!\d)(?:\d{7,11}|\d{15,18}[Xx]?)(?!\d)/.test(raw)) return true;
  if (PRIVACY_WORDS.some((word) => raw.includes(word))) return true;

  const compact = normalize(raw);
  const words = [
    ...EDGE_WORDS,
    ...ABUSIVE_WORDS,
    ...VIOLENCE_WORDS,
    ...PINYIN_WORDS,
  ];
  if (words.some((word) => compact.includes(normalize(word)))) return true;

  return [
    /(?:你|他|她)(?:妈|麻|马)(?:逼|比|币|批)/,
    /妈(?:逼|币|批)/,
    /(?:傻|煞|沙|啥)(?:逼|比|币|批)/,
    /约(?:炮|啪|p)/,
    /(?:裸|黄|色)(?:聊|片|图|照|情)/,
    /(?:杀|砍|捅|掐|毒|烧|炸)(?:死|掉|了)?/,
  ].some((pattern) => pattern.test(compact));
}
