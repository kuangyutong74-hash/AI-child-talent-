/**
 * Workday Game Engine — All 6 Careers
 * Stage types: collect | sort | examine | diagnose | action
 */
/* ==== SVG ICONS ==== */
const I={stethoscope:'<svg viewBox="0 0 48 48"><circle cx="24" cy="16" r="8" stroke="#4ECDC4" stroke-width="2.5"/><path d="M24 24v10a6 6 0 006 6" stroke="#4ECDC4" stroke-width="2.5" stroke-linecap="round"/><circle cx="30" cy="40" r="3" stroke="#4ECDC4" stroke-width="2"/></svg>',thermometer:'<svg viewBox="0 0 48 48"><rect x="20" y="4" width="8" height="28" rx="4" stroke="#FF6B6B" stroke-width="2.5"/><circle cx="24" cy="38" r="8" stroke="#FF6B6B" stroke-width="2.5"/></svg>',otoscope:'<svg viewBox="0 0 48 48"><rect x="16" y="20" width="16" height="18" rx="3" stroke="#FFD93D" stroke-width="2.5"/><circle cx="24" cy="14" r="6" stroke="#FFD93D" stroke-width="2.5"/></svg>',bpmonitor:'<svg viewBox="0 0 48 48"><rect x="10" y="12" width="28" height="24" rx="5" stroke="#7C6FF7" stroke-width="2.5"/><rect x="16" y="18" width="16" height="10" rx="2" stroke="#7C6FF7" stroke-width="1.5"/></svg>',coat:'<svg viewBox="0 0 48 48"><path d="M16 8h16l4 28H12l4-28z" stroke="#fff" stroke-width="2.5"/><line x1="24" y1="8" x2="24" y2="36" stroke="#fff" stroke-width="2"/></svg>',files:'<svg viewBox="0 0 48 48"><rect x="12" y="6" width="24" height="36" rx="3" stroke="#FFD93D" stroke-width="2.5"/><line x1="18" y1="14" x2="30" y2="14" stroke="#FFD93D" stroke-width="1.5"/><line x1="18" y1="20" x2="30" y2="20" stroke="#FFD93D" stroke-width="1.5"/></svg>',wash:'<svg viewBox="0 0 48 48"><circle cx="20" cy="20" r="6" stroke="#4ECDC4" stroke-width="2"/><path d="M16 26a12 8 0 0024 0" stroke="#4ECDC4" stroke-width="2.5"/></svg>',gloves:'<svg viewBox="0 0 48 48"><path d="M14 8h8v18l-4 14H18l-4-32zM26 8h8v18l4 14H34l-8-32z" stroke="#6BCB77" stroke-width="2.5"/></svg>',helmet:'<svg viewBox="0 0 48 48"><ellipse cx="24" cy="22" rx="16" ry="6" stroke="#FF6B6B" stroke-width="2.5"/><path d="M8 22v8c0 6 7.2 12 16 12s16-6 16-12v-8" stroke="#FF6B6B" stroke-width="2.5"/></svg>',axe:'<svg viewBox="0 0 48 48"><rect x="22" y="4" width="4" height="20" rx="2" stroke="#FFD93D" stroke-width="2"/><polygon points="14,26 34,26 30,40 18,40" stroke="#FFD93D" stroke-width="2.5"/></svg>',rope:'<svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="16" stroke="#FF8C42" stroke-width="2.5"/><circle cx="24" cy="24" r="8" stroke="#FF8C42" stroke-width="2"/></svg>',radio:'<svg viewBox="0 0 48 48"><rect x="10" y="16" width="28" height="22" rx="5" stroke="#4ECDC4" stroke-width="2.5"/><circle cx="24" cy="30" r="6" stroke="#4ECDC4" stroke-width="2"/></svg>',book:'<svg viewBox="0 0 48 48"><path d="M12 8h24v32H12z" stroke="#FFD93D" stroke-width="2.5"/><line x1="24" y1="8" x2="24" y2="40" stroke="#FFD93D" stroke-width="2"/><line x1="16" y1="16" x2="20" y2="16" stroke="#FFD93D" stroke-width="1.5"/></svg>',chalk:'<svg viewBox="0 0 48 48"><rect x="10" y="10" width="28" height="24" rx="3" stroke="#4ECDC4" stroke-width="2.5"/><path d="M16 34l12 8 6-4-8-16" stroke="#FFD93D" stroke-width="2" fill="none"/></svg>',star:'<svg viewBox="0 0 48 48"><polygon points="24,4 30,17 44,18 33,28 36,42 24,34 12,42 15,28 4,18 18,17" stroke="#FFD93D" stroke-width="2" fill="none"/></svg>',whistle:'<svg viewBox="0 0 48 48"><rect x="10" y="20" width="18" height="12" rx="3" stroke="#FFD93D" stroke-width="2.5"/><rect x="26" y="22" width="12" height="8" rx="2" stroke="#FFD93D" stroke-width="2"/></svg>',knife:'<svg viewBox="0 0 48 48"><rect x="10" y="8" width="6" height="26" rx="3" stroke="#fff" stroke-width="2"/><polygon points="16,14 34,4 38,20 22,30" stroke="#fff" stroke-width="2.5"/></svg>',pot:'<svg viewBox="0 0 48 48"><ellipse cx="24" cy="16" rx="14" ry="6" stroke="#FF8C42" stroke-width="2"/><path d="M10 16v10c0 8 6.3 14 14 14s14-6 14-14V16" stroke="#FF8C42" stroke-width="2.5"/><line x1="14" y1="8" x2="14" y2="4" stroke="#FF8C42" stroke-width="2"/><line x1="34" y1="8" x2="34" y2="4" stroke="#FF8C42" stroke-width="2"/></svg>',scale:'<svg viewBox="0 0 48 48"><circle cx="24" cy="20" r="14" stroke="#fff" stroke-width="2.5"/><line x1="24" y1="6" x2="24" y2="10" stroke="#FFD93D" stroke-width="2.5"/></svg>',pen:'<svg viewBox="0 0 48 48"><rect x="16" y="6" width="4" height="34" rx="2" stroke="#7C6FF7" stroke-width="2"/><polygon points="18,6 20,4 32,14 28,16" stroke="#7C6FF7" stroke-width="2"/></svg>',camera:'<svg viewBox="0 0 48 48"><rect x="8" y="14" width="32" height="22" rx="5" stroke="#fff" stroke-width="2.5"/><circle cx="24" cy="24" r="8" stroke="#fff" stroke-width="2.5"/><circle cx="24" cy="24" r="3" fill="#fff"/></svg>',mic:'<svg viewBox="0 0 48 48"><rect x="20" y="6" width="8" height="18" rx="4" stroke="#FF6B6B" stroke-width="2.5"/><path d="M12 28c0 6.6 5.4 12 12 12s12-5.4 12-12" stroke="#FF6B6B" stroke-width="2.5"/></svg>',paw:'<svg viewBox="0 0 48 48"><circle cx="16" cy="16" r="6" stroke="#6BCB77" stroke-width="2"/><circle cx="32" cy="16" r="6" stroke="#6BCB77" stroke-width="2"/><circle cx="24" cy="28" r="8" stroke="#6BCB77" stroke-width="2"/></svg>',brush:'<svg viewBox="0 0 48 48"><rect x="18" y="24" width="4" height="18" rx="2" stroke="#FF8C42" stroke-width="2"/><polygon points="20,6 8,22 32,22" stroke="#FF8C42" stroke-width="2.5"/></svg>',bandage:'<svg viewBox="0 0 48 48"><rect x="10" y="14" width="28" height="20" rx="4" stroke="#fff" stroke-width="2.5"/><line x1="18" y1="14" x2="18" y2="34" stroke="#fff" stroke-width="1.5"/><line x1="30" y1="14" x2="30" y2="34" stroke="#fff" stroke-width="1.5"/></svg>',check2:'<svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="20" stroke="#6BCB77" stroke-width="3"/><polyline points="16,24 22,30 34,18" stroke="#6BCB77" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>'};
function S(name,sz){const s=sz||48;return'<span class="img-slot" style="width:'+s+'px;height:'+s+'px"><span class="img-fallback">'+(I[name]||'')+'</span></span>'}

/* ==== CAREER WORKDAY DATA ==== */
const WD={
doctor:{
  name:'社区医生',timeStart:'08:00',
  stages:[
    {type:'collect',mode:'clinic',title:'开诊台准备',sub:'你要把诊室变成一个让病人安心、让检查顺畅开始的地方。',items:[
      {id:'coat',icon:'coat',label:'穿工作服',desc:'换上白大褂，佩戴工牌，整理仪容仪表'},
      {id:'files',icon:'files',label:'查看今日预约',desc:'浏览上午预约单，了解病人基本情况'},
      {id:'wash',icon:'wash',label:'洗手消毒',desc:'按七步洗手法清洁双手，做好卫生防护'},
      {id:'stethoscope',icon:'stethoscope',label:'检查听诊器',desc:'确认听诊器、血压计等诊断设备状态正常'},
      {id:'bpmonitor',icon:'bpmonitor',label:'校准血压计',desc:'检查电子血压计电量充足，读数准确'},
      {id:'gloves',icon:'gloves',label:'备齐防护用品',desc:'清点一次性手套、口罩、消毒液等库存'},
      {id:'thermometer',icon:'thermometer',label:'消毒体温计',desc:'用酒精棉片擦拭体温计，一人一消毒'},
      {id:'otoscope',icon:'otoscope',label:'检查检耳镜',desc:'确认光源正常、镜片干净无异物'}]},
    {type:'sort',title:'病人分诊',sub:'5位病人在候诊，根据症状描述判断紧急程度并排序。',items:[
      {id:'p1',avatar:'<svg viewBox="0 0 48 48"><circle cx="24" cy="14" r="9" stroke="#fff" stroke-width="2"/><path d="M10 40c0-8 6.3-14 14-14s14 6 14 14" stroke="#fff" stroke-width="2"/></svg>',name:'张爷爷 · 72岁',detail:'胸痛胸闷2小时，面色苍白冒冷汗，有冠心病和高血压史。呼吸困难，血氧偏低。',tag:'red',tagLabel:'危急',priority:1},
      {id:'p2',avatar:'<svg viewBox="0 0 48 48"><circle cx="24" cy="13" r="8" stroke="#fff" stroke-width="2"/><path d="M12 38c0-6.5 5.4-12 12-12s12 5.5 12 12" stroke="#fff" stroke-width="2"/></svg>',name:'小明 · 5岁',detail:'高烧39.6°C持续一天，精神萎靡拒绝进食。小便明显减少，嘴唇发干——有脱水风险。',tag:'red',tagLabel:'危急',priority:2},
      {id:'p3',avatar:'<svg viewBox="0 0 48 48"><circle cx="24" cy="14" r="8" stroke="#fff" stroke-width="2"/><path d="M12 38c0-6.5 5.4-12 12-12s12 5.5 12 12" stroke="#fff" stroke-width="2"/></svg>',name:'李阿姨 · 48岁',detail:'下楼梯踩空，右脚踝明显肿胀变形，痛得无法站立。家人搀扶来的，需要拍片排除骨折。',tag:'yellow',tagLabel:'紧急',priority:3},
      {id:'p4',avatar:'<svg viewBox="0 0 48 48"><circle cx="24" cy="14" r="9" stroke="#fff" stroke-width="2"/><path d="M10 40c0-8 6.3-14 14-14s14 6 14 14" stroke="#fff" stroke-width="2"/></svg>',name:'王奶奶 · 68岁',detail:'头晕两天，今早起床险些摔倒。血压控制一直不好，想知道是否需要调整降压药。',tag:'yellow',tagLabel:'紧急',priority:4},
      {id:'p5',avatar:'<svg viewBox="0 0 48 48"><circle cx="24" cy="14" r="8" stroke="#fff" stroke-width="2"/><rect x="18" y="22" width="12" height="16" rx="5" stroke="#fff" stroke-width="2"/></svg>',name:'赵先生 · 30岁',detail:'公司要求提供年度体检报告，身体无任何不适。只需量血压、听心肺、开体检单即可。',tag:'green',tagLabel:'普通',priority:5}],
    knowledge:'急诊分诊遵循「先救命、后救伤」原则：胸痛+冠心病史可能心梗，高烧脱水可能休克，这些都是可能危及生命的情况，必须优先处理。'},
    {type:'examine',character:'person',title:'问诊检查',sub:'张爷爷胸痛就诊。请使用合适的医疗器械进行全面检查。\n体温38.2°C | 血压142/88 | 心率102 | 血氧97%',
      zones:[
        {id:'arm',top:'125px',left:'77%',w:46,h:62,label:'左上臂·血压',tool:'bpmonitor',result:'🩺 血压 142/88 mmHg'},
        {id:'head',top:'36px',left:'50%',w:62,h:54,label:'头部·体温',tool:'thermometer',result:'🌡️ 体温 38.2°C — 中度发热'},
        {id:'throat',top:'93px',left:'50%',w:44,h:30,label:'咽喉',tool:'otoscope',result:'🔦 咽喉未见明显红肿 — 排除上呼吸道感染'},
        {id:'chest',top:'122px',left:'50%',w:104,h:72,label:'胸部·听诊',tool:'stethoscope',result:'🫀 心音不齐，可闻及收缩期杂音；双肺底可闻及湿啰音'}],
      tools:[{id:'thermometer',label:'体温计',icon:'thermometer'},{id:'otoscope',label:'检耳镜',icon:'otoscope'},{id:'stethoscope',label:'听诊器',icon:'stethoscope'},{id:'bpmonitor',label:'血压计',icon:'bpmonitor'}],
      knowledge:'综合检查结果：发热+心律不齐+肺部湿啰音 → 高度怀疑急性心力衰竭合并肺部感染，需要立即处理。'},
    {type:'diagnose',title:'诊断与处方',sub:'根据检查结果做出诊断，为张爷爷开具处方。',
      summary:'<b>病人：</b>张爷爷 72岁 | <b>主诉：</b>胸痛胸闷2h<br><b>体征：</b>T 38.2°C · BP 142/88 · HR 102 · SpO₂ 97%<br><b>听诊：</b>心律不齐+杂音 · 双肺底湿啰音<br><b>既往史：</b>高血压10年 · 冠心病5年',
      diags:[
        {id:'d1',text:'急性心力衰竭合并肺部感染',correct:true},
        {id:'d2',text:'普通上呼吸道感染引起的发热',correct:false},
        {id:'d3',text:'急性心肌梗死',correct:false},
        {id:'d4',text:'高血压危象',correct:false}],
      meds:[
        {id:'m1',name:'呋塞米注射液',type:'利尿剂',dot:'blue',desc:'减轻心脏负荷，缓解肺水肿',target:true},
        {id:'m2',name:'头孢曲松钠',type:'抗生素',dot:'green',desc:'针对肺部感染进行抗感染治疗',target:true},
        {id:'m3',name:'硝酸甘油舌下片',type:'扩血管药',dot:'red',desc:'扩张冠状动脉，缓解心绞痛',target:true},
        {id:'m4',name:'布洛芬缓释胶囊',type:'退热镇痛',dot:'yellow',desc:'缓解发热和轻微疼痛（非首选）',target:false},
        {id:'m5',name:'冰敷消肿贴',type:'外用',dot:'blue',desc:'用于扭伤肿胀处冷敷',target:false},
        {id:'m6',name:'复合维生素片',type:'营养补充',dot:'green',desc:'日常维生素补充，非治疗用药',target:false}],
      correctMsg:'处方正确！利尿剂减轻心衰+抗生素抗感染+硝酸甘油缓解心绞痛，三管齐下。',
      knowledge:'心衰合并感染是老年人常见急症。治疗需要同时应对心衰（利尿、扩血管）和感染（抗生素），缺一不可。'}
  ],
  knowledge:['急诊分诊遵循「先救命后救伤」原则，胸痛和呼吸困难症状优先于扭伤和常规体检。','听诊器是使用最广泛的诊断工具，可听心音、呼吸音、肠鸣音等。','心衰合并感染需同时应对：利尿剂减轻心脏负荷 + 抗生素控制感染 + 硝酸酯类缓解心绞痛。','社区医生需要综合能力：专业知识、同理心、沟通技巧、团队协作缺一不可。']
},

firefighter:{
  name:'消防员',timeStart:'08:00',
  stages:[
    {type:'collect',mode:'locker',title:'装备柜点检',sub:'救援装备必须按安全顺序逐件确认，出警时才能争分夺秒。',items:[
      {id:'helmet',icon:'helmet',label:'消防头盔面罩',desc:'检查头盔无裂痕，面罩透光清晰无划痕'},
      {id:'coat',icon:'coat',label:'防火战斗服',desc:'穿上防火服，检查拉链、反光条完好无损'},
      {id:'axe',icon:'axe',label:'破拆工具斧',desc:'确认消防斧刃口锋利，手柄牢固无松动'},
      {id:'rope',icon:'rope',label:'救生绳索',desc:'检查绳索无磨损断裂，挂钩弹簧正常'},
      {id:'radio',icon:'radio',label:'通讯对讲机',desc:'开机测试频道，确认电池满电信号清晰'},
      {id:'bpmonitor',icon:'bpmonitor',label:'空气呼吸器',desc:'检查气瓶压力表在绿色区域，面罩密封良好'},
      {id:'gloves',icon:'gloves',label:'防护手套靴子',desc:'确认手套无破损，靴底防滑纹路清晰'},
      {id:'thermometer',icon:'thermometer',label:'热成像仪',desc:'开机校准，确认能正常显示温度分布图像'}]},
    {type:'sort',title:'接警出动',sub:'指挥中心传来警情。根据以下信息，判断出发前的优先事项。',items:[
      {id:'f1',avatar:'<svg viewBox="0 0 48 48"><rect x="10" y="8" width="28" height="32" rx="4" stroke="#fff" stroke-width="2.5"/><rect x="18" y="16" width="12" height="16" rx="2" stroke="#FF6B6B" stroke-width="2"/></svg>',name:'确认火场信息',detail:'向指挥中心确认：具体地址、建筑类型（居民楼/商业楼）、是否有被困人员、火势大小和蔓延方向。信息越准确，救援越安全。',tag:'red',tagLabel:'首要',priority:1},
      {id:'f2',avatar:'<svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="16" stroke="#fff" stroke-width="2.5"/><polygon points="24,14 30,22 24,20 18,22" fill="#fff" opacity=".5"/></svg>',name:'规划最优路线',detail:'根据交通状况选择最快到达路线，同时了解附近消防栓位置和水压情况。',tag:'red',tagLabel:'首要',priority:2},
      {id:'f3',avatar:'<svg viewBox="0 0 48 48"><rect x="14" y="10" width="20" height="28" rx="3" stroke="#fff" stroke-width="2"/><line x1="18" y1="18" x2="18" y2="32" stroke="#FFD93D" stroke-width="1.5"/></svg>',name:'确认队员分工',detail:'队长分配任务：谁负责水枪掩护、谁负责破拆搜救、谁负责联络指挥。每人明确自己的职责。',tag:'red',tagLabel:'首要',priority:3},
      {id:'f4',avatar:'<svg viewBox="0 0 48 48"><rect x="12" y="14" width="24" height="22" rx="3" stroke="#fff" stroke-width="2"/><circle cx="24" cy="24" r="6" stroke="#6BCB77" stroke-width="1.5"/></svg>',name:'检查个人防护',detail:'最后确认一遍：头盔、面罩、呼吸器、手套、战斗服全部穿戴整齐，确保自身安全才能救别人。',tag:'yellow',tagLabel:'重要',priority:4},
      {id:'f5',avatar:'<svg viewBox="0 0 48 48"><rect x="14" y="8" width="20" height="32" rx="4" stroke="#fff" stroke-width="2"/><rect x="19" y="16" width="10" height="14" rx="2" stroke="#fff" stroke-width="1.5"/></svg>',name:'安抚围观群众',detail:'到达现场后，安排专人负责疏散围观人群，建立安全隔离带，避免次生伤害。',tag:'green',tagLabel:'后续',priority:5}],
    knowledge:'接警后的黄金60秒：快速掌握火场关键信息（地址、建筑、被困人员）比盲目冲进火场重要得多。信息是救援的第一件武器。'},
    {type:'route',title:'现场救援路径规划',sub:'城东居民楼3楼起火，4楼有被困人员。带着搭档避开火场，规划到达安全入口的路线。',
      scene:'浓烟从3楼窗户滚滚冒出，楼道里能见度很低。队长说火势正在向上蔓延，4楼以上都有危险。一位大妈哭着说4楼有她坐轮椅的老母亲。',
      route:{rows:4,cols:4,start:'r4c1',goal:'r1c4',blocked:['r3c1','r3c2','r2c2','r2c3'],path:['r4c1','r4c2','r4c3','r4c4','r3c4','r2c4','r1c4']},
      options:[
        {id:'a1',text:'和队友两人一组：一人水枪掩护推进，一人沿消防通道上4楼搜救老人',correct:true,feedback:'正确！消防员从不单独行动。水枪掩护+搜救搭档是最标准的火场救援模式。「结伴而行」是铁律。'},
        {id:'a2',text:'自己先冲上4楼找到老人，再让队友上来帮忙搬运轮椅',correct:false,feedback:'危险！独自冲进浓烟中可能会迷失方向或受伤。消防员从不单独进入危险区域——你倒下了，不仅救不了人，还会连累队友来救你。'},
        {id:'a3',text:'先用水枪把3楼火势彻底扑灭，确保安全后再上4楼救人',correct:false,feedback:'可以理解，但不够好。火势扑灭需要时间，4楼的老人可能已经吸入浓烟。正确做法是压制火势+同步搜救，而非等待。'},
        {id:'a4',text:'请大妈详细描述老人在房间的哪个位置，以便精准定位快速救援',correct:false,feedback:'信息很有用，但不应等到到达现场才开始收集。这些信息应该在出警途中就向指挥中心了解清楚。现在时间紧迫，应该边行动边问。'}],
    knowledge:'火场救援铁律：永远两人以上搭档行动，一人负责推进/掩护，一人负责搜救/观察。独狼行动是消防员大忌。'},
    {type:'sort',title:'灾后社区排查',sub:'火灾过后，消防队要对社区进行安全隐患排查。从以下场景中找出最需要优先处理的问题。',items:[
      {id:'s1',avatar:'<svg viewBox="0 0 48 48"><rect x="8" y="10" width="32" height="28" rx="4" stroke="#fff" stroke-width="2"/><line x1="18" y1="18" x2="30" y2="18" stroke="#FF6B6B" stroke-width="2"/></svg>',name:'楼道电动车充电',detail:'某栋楼楼道里停了3辆正在充电的电动车，堵塞了逃生通道。电动车电池充电起火是近年最大的消防隐患之一。',tag:'red',tagLabel:'严重隐患',priority:1},
      {id:'s2',avatar:'<svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="14" stroke="#fff" stroke-width="2"/><rect x="20" y="16" width="8" height="16" rx="2" stroke="#FFD93D" stroke-width="1.5"/></svg>',name:'消防通道被堵',detail:'小区消防通道被私家车堵死，消防车根本开不进来。昨天救火时因为这个耽误了宝贵的3分钟。',tag:'red',tagLabel:'严重隐患',priority:2},
      {id:'s3',avatar:'<svg viewBox="0 0 48 48"><rect x="14" y="12" width="20" height="26" rx="3" stroke="#fff" stroke-width="2"/><line x1="19" y1="20" x2="29" y2="20" stroke="#FF8C42" stroke-width="1.5"/></svg>',name:'老化电线裸露',detail:'一栋老旧居民楼的楼梯间电线老化裸露，有火花痕迹。一旦短路起火，整栋楼都很危险。',tag:'red',tagLabel:'严重隐患',priority:3},
      {id:'s4',avatar:'<svg viewBox="0 0 48 48"><rect x="12" y="8" width="24" height="34" rx="4" stroke="#fff" stroke-width="2"/><text x="24" y="24" text-anchor="middle" fill="#fff" font-size="6">EXIT</text></svg>',name:'缺少逃生标识',detail:'多栋楼缺少安全出口指示灯和应急照明。一旦停电或浓烟弥漫，居民找不到逃生路线。',tag:'yellow',tagLabel:'一般隐患',priority:4},
      {id:'s5',avatar:'<svg viewBox="0 0 48 48"><rect x="16" y="10" width="16" height="28" rx="3" stroke="#fff" stroke-width="2"/><circle cx="24" cy="20" r="4" stroke="#6BCB77" stroke-width="1"/></svg>',name:'灭火器过期',detail:'楼道灭火器上次年检是3年前，压力表指针已在红色区域。过期灭火器在关键时刻可能喷不出来。',tag:'yellow',tagLabel:'一般隐患',priority:5}],
    knowledge:'「防患于未然」是消防工作的核心。电动车楼道充电、消防通道堵塞、老化电线是当前社区火灾的三大杀手，排查必须优先处理这几个方面。'}
  ],
  knowledge:['接警后60秒内必须掌握：地址、建筑类型、被困人数、火势方向。信息准确才能制定正确方案。','火场铁律：永远两人以上搭档，严禁单独进入危险区域。你的安全是救别人的前提。','电动车楼道充电、消防通道堵塞、老化电线是社区三大火灾隐患。排查比救火更重要。','消防员不仅需要勇敢，更需要冷静的头脑、团队的默契和对细节的关注。']
},

teacher:{
  name:'小学教师',timeStart:'07:30',
  stages:[
    {type:'collect',mode:'classroom',title:'布置晨间教室',sub:'把教室布置成一个让每位同学都愿意投入学习的空间。',items:[
      {id:'book',icon:'book',label:'备课教案',desc:'检查今天的教案，确认教学目标、重点难点和互动环节'},
      {id:'chalk',icon:'chalk',label:'教具准备',desc:'准备好课堂需要的教具：卡片、模型、多媒体课件'},
      {id:'files',icon:'files',label:'批改作业',desc:'快速浏览昨晚的作业，了解学生普遍存在的问题'},
      {id:'star',icon:'star',label:'布置教室',desc:'更新黑板上的日期、课表和今日一句励志语'},
      {id:'wash',icon:'wash',label:'整理讲台',desc:'保持讲台整洁有序，方便课堂上快速拿取物品'},
      {id:'whistle',icon:'whistle',label:'确认课间安排',desc:'查看今天的课表和特殊活动安排（升旗、体检等）'},
      {id:'gloves',icon:'gloves',label:'检查防疫物资',desc:'确认教室有充足的洗手液、纸巾等日常用品'},
      {id:'coat',icon:'coat',label:'整理仪表',desc:'以精神饱满的状态迎接学生，老师的情绪会影响整个班级'}]},
    {type:'sort',title:'课堂管理',sub:'上课铃响了。面对以下情况，安排你的处理顺序。',items:[
      {id:'t1',avatar:'<svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="16" stroke="#fff" stroke-width="2"/><text x="24" y="29" text-anchor="middle" fill="#FFD93D" font-size="20">!</text></svg>',name:'全班秩序',detail:'后排两个男生在传纸条说笑，前排有人偷偷吃零食。需要快速集中全班注意力，让课堂进入状态。',tag:'red',tagLabel:'优先',priority:1},
      {id:'t2',avatar:'<svg viewBox="0 0 48 48"><circle cx="24" cy="14" r="8" stroke="#fff" stroke-width="2"/><path d="M12 38c0-6 5.4-12 12-12" stroke="#fff" stroke-width="2"/></svg>',name:'小红举手',detail:'前排小红一直高高举手，表情焦急，说作业本不见了，不知道被谁拿走了。',tag:'yellow',tagLabel:'需要处理',priority:2},
      {id:'t3',avatar:'<svg viewBox="0 0 48 48"><circle cx="24" cy="14" r="8" stroke="#fff" stroke-width="2"/><path d="M12 38c0-6 5.4-12 12-12s12 6 12 12" stroke="#fff" stroke-width="2"/></svg>',name:'朵朵发呆',detail:'角落里的朵朵盯着作业本一动不动，前面几页也错了好多。她从来不主动提问。',tag:'yellow',tagLabel:'需要关注',priority:3},
      {id:'t4',avatar:'<svg viewBox="0 0 48 48"><rect x="12" y="10" width="24" height="28" rx="3" stroke="#fff" stroke-width="2"/><text x="24" y="30" text-anchor="middle" fill="#fff" font-size="12">A+</text></svg>',name:'检查预习',detail:'上节课布置了预习任务，需要抽查几位同学，看看大家对新内容的了解程度。',tag:'green',tagLabel:'常规',priority:4},
      {id:'t5',avatar:'<svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="16" stroke="#fff" stroke-width="2"/><rect x="18" y="18" width="12" height="12" rx="2" stroke="#fff" stroke-width="1.5"/></svg>',name:'发还作业',detail:'昨晚批改的作业需要发还给学生，同时简单点评一下普遍存在的问题。',tag:'green',tagLabel:'常规',priority:5}],
    knowledge:'课堂管理的关键是先整体后个体。先让全班进入学习状态，再逐一处理个别学生的问题。一个有趣的导入比一声怒喝更能吸引注意力。'},
    {type:'dialogue',title:'和朵朵聊一聊',sub:'朵朵几次数学作业都错了很多，也不敢主动提问。观察她的情绪，用对话慢慢帮她建立安全感。',
      scene:'你知道如果当众指出朵朵的问题，会让她更难堪。但不帮她，她只会越来越跟不上。你需要找到一种既有效又不伤害她自尊心的方式。',
      dialogue:{student:'朵朵',avatar:'👧',turns:[
        {stage:'她把作业本悄悄合上了',studentWords:'老师，我是不是太笨了？',emotion:'😟',mood:'worried',options:[
          {text:'先蹲下来，小声说：「不是你笨，是这一步还没有找到适合你的学法。我们一起试试。」',supportive:true,emotion:'朵朵的表情放松了一点',reply:'“老师真的愿意陪我慢慢学吗？”'},
          {text:'说：「大家都会，你再认真一点就好了。」',supportive:false,emotion:'朵朵更紧张了',reply:'“我已经很认真了……”'}]},
        {stage:'她愿意把难题指给你看',studentWords:'我一看到很多数字就不知道从哪里开始。',emotion:'🙂',mood:'relieved',options:[
          {text:'把题目换成她喜欢的彩笔情境，再让她自己说出第一步。',supportive:true,emotion:'朵朵开始愿意尝试',reply:'“原来可以先画出来！我想自己算下一题。”'},
          {text:'直接把标准步骤写在她本子上，让她照着抄一遍。',supportive:false,emotion:'朵朵又沉默了',reply:'“我好像还是不知道为什么要这样做。”'}]}
      ]},
      options:[
        {id:'c1',text:'走到朵朵身边蹲下，用只有她能听到的声音问她是哪里不懂，换一种方法讲解',correct:true,feedback:'这样做保护了朵朵的自尊心。小声的单独辅导让她不会在同学面前丢脸，同时也给了她切实的帮助。'},
        {id:'c2',text:'在全班面前点名让朵朵回答问题，逼她开口说话锻炼胆量',correct:false,feedback:'这会让她更加紧张和害怕。对内向且学习困难的孩子，公开「锻炼」只会增加焦虑，适得其反。'},
        {id:'c3',text:'把题目改成朵朵喜欢的画画情境：「如果朵朵有12支彩笔……」让题目和她产生关联',correct:true,feedback:'很有创意！把抽象题目和学生的兴趣点联系起来，既帮助理解，又传递了一个信息：老师关注你的喜好。'},
        {id:'c4',text:'安排班上成绩最好的同学当朵朵的小老师，课后专门辅导她',correct:false,feedback:'初衷很好，但要注意方式。如果安排不当，可能让朵朵感觉被「区别对待」。可以先私下问她是否愿意，再物色一位耐心温和的小老师。'}],
    knowledge:'帮助学困生的关键在于「保护自尊+个性化教学」。蹲下来说话、把题目和兴趣结合，这些都传达了「老师关心你，你并不笨」。'},
    {type:'diagnose',title:'设计班级活动',sub:'下周是班级展示周，主题「我们的班级，我们的骄傲」。请设计方案并选择关键元素。',
      summary:'<b>班级情况：</b>小明画画很棒、朵朵唱歌好听、小杰和小豪刚和好需要合作机会...每个孩子都有闪光点。<br><b>挑战：</b>要在展示中让<b>每个孩子</b>都找到自己的位置',
      diags:[
        {id:'w1',text:'综合表演：有人唱歌（朵朵）、有人画背景（小明）、有人编故事——各展所长',correct:true},
        {id:'w2',text:'全班合唱一首歌，简单整齐不容易出错',correct:false},
        {id:'w3',text:'选成绩最好的5个同学代表班级展示知识竞赛',correct:false},
        {id:'w4',text:'让每个孩子准备一件自己最骄傲的事分享，汇成班级故事集',correct:true}],
      meds:[
        {id:'r1',name:'小组合作分工',type:'协作',dot:'green',desc:'分成4-5人小组，每组负责不同的展示环节',target:true},
        {id:'r2',name:'个性化角色',type:'定制',dot:'blue',desc:'为每个孩子量身定制适合他们特长的角色',target:true},
        {id:'r3',name:'全班头脑风暴',type:'民主',dot:'yellow',desc:'开班会让大家自由提议，投票决定方案',target:true},
        {id:'r4',name:'老师全权策划',type:'包办',dot:'red',desc:'老师设计好一切，学生照做即可，效率最高',target:false},
        {id:'r5',name:'只看结果不管过程',type:'结果导向',dot:'red',desc:'只要能拿奖就行，孩子们听指挥就好',target:false},
        {id:'r6',name:'请外部导演帮忙',type:'外包',dot:'blue',desc:'请专业老师来排练，保证节目质量',target:false}],
      correctMsg:'很好的方案！最好的班级活动不是展示才艺，而是展示「我们是一个温暖的集体」——每个人都被看见、被尊重。',
      knowledge:'班级活动的意义不在于「拿奖」而在于「每个人都参与」。对小学生来说，被看见、被尊重、被需要的感觉，比任何名次都重要。'}
  ],
  knowledge:['课堂管理先整体后个体——有趣的导入比严厉的呵斥更能让学生进入学习状态。','帮助学困生的核心：保护自尊+个性化教学。蹲下来小声说话，把题目和学生兴趣关联。','班级活动的意义：让每个孩子都被看见、被需要。不是选最优秀的人表演，而是让每个人发光。','教师的工作远不止「上课」：备课、批改、观察学生、处理矛盾、设计活动、家校沟通……每一天都充满挑战。']
},

chef:{
  name:'餐厅厨师',timeStart:'07:00',
  stages:[
    {type:'collect',mode:'kitchen',title:'后厨开档',sub:'从食材、卫生到火候设备，按后厨流程把今天的第一餐准备好。',items:[
      {id:'scale',icon:'scale',label:'验收食材',desc:'逐项称重核对订单，检查蔬菜新鲜度、肉类色泽气味'},
      {id:'knife',icon:'knife',label:'清洗切配',desc:'蔬菜浸泡清洗三遍，按菜品要求切丝、切片、切块'},
      {id:'pot',icon:'pot',label:'准备高汤',desc:'鸡骨猪骨焯水后慢火熬制高汤，这是一天菜品的基底'},
      {id:'files',icon:'files',label:'查看预订',desc:'了解今天中午的预订情况：团体订餐、包间、特殊需求'},
      {id:'gloves',icon:'gloves',label:'清洁消毒',desc:'砧板、刀具、操作台全面消毒，生熟分开避免交叉污染'},
      {id:'coat',icon:'coat',label:'穿戴工装',desc:'换上厨师服、围裙、帽子，确保头发不外露'},
      {id:'thermometer',icon:'thermometer',label:'检查冷藏设备',desc:'确认冰箱、冷柜温度正常（冷藏0-4°C，冷冻-18°C以下）'},
      {id:'bpmonitor',icon:'bpmonitor',label:'检查灶台设备',desc:'逐一测试灶台火力、抽油烟机、蒸箱和烤箱是否正常运转'}]},
    {type:'sequence',title:'午餐炒饭流程',sub:'午餐高峰前，厨房要完成一份蔬菜鸡肉炒饭。拖动步骤卡，排出安全又顺畅的操作流程。',items:[
      {id:'m1',avatar:'<svg viewBox="0 0 48 48"><circle cx="24" cy="14" r="9" stroke="#fff" stroke-width="2"/><path d="M10 40c0-8 6.3-14 14-14s14 6 14 14" stroke="#fff" stroke-width="2"/></svg>',name:'洗净食材并生熟分开',detail:'先洗净蔬菜、处理鸡肉；砧板和刀具分开使用，避免交叉污染。',tag:'red',tagLabel:'第1步',priority:1},
      {id:'m2',avatar:'<svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="16" stroke="#fff" stroke-width="2"/><circle cx="20" cy="20" r="4" stroke="#6BCB77" stroke-width="1.5"/><circle cx="30" cy="26" r="3" stroke="#FF6B6B" stroke-width="1.5"/></svg>',name:'切配食材',detail:'把鸡肉、胡萝卜和青菜切成适合快速翻炒的小块。',tag:'red',tagLabel:'第2步',priority:2},
      {id:'m3',avatar:'<svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="14" stroke="#fff" stroke-width="2"/><rect x="16" y="16" width="16" height="16" rx="2" stroke="#FFD93D" stroke-width="1.5"/></svg>',name:'热锅下油，先炒熟鸡肉',detail:'锅热后再下油，鸡肉要先炒熟，保证食品安全。',tag:'yellow',tagLabel:'第3步',priority:3},
      {id:'m4',avatar:'<svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="14" stroke="#fff" stroke-width="2"/><text x="24" y="28" text-anchor="middle" fill="#FFD93D" font-size="10">￥</text></svg>',name:'加入米饭和蔬菜翻炒调味',detail:'鸡肉熟后加入米饭和蔬菜，快速翻炒并适量调味。',tag:'yellow',tagLabel:'第4步',priority:4},
      {id:'m5',avatar:'<svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="14" stroke="#fff" stroke-width="2"/><circle cx="18" cy="18" r="3" fill="#7C6FF7"/><circle cx="32" cy="28" r="2" fill="#FF6B6B"/></svg>',name:'检查熟度后装盘出餐',detail:'确认鸡肉熟透、米饭热透，再装盘交给服务员。',tag:'green',tagLabel:'第5步',priority:5}],
    knowledge:'后厨流程不是“记住答案”：先保证卫生与熟度，再追求速度和味道。把步骤排对，是在为每一位客人的安全负责。'},
    {type:'examine',character:'kitchen',title:'出餐高峰应对',sub:'中午12:15，座无虚席。突然——一号灶台火力失控！5桌订单堆积。\n检查你的厨房资源，找出最佳应对方案。',
      zones:[
        {id:'zone1',top:'16px',left:'25%',w:78,h:76,label:'主灶台',tool:'bpmonitor',result:'❌ 火力失控——暂时无法使用'},
        {id:'zone2',top:'16px',left:'75%',w:78,h:76,label:'小灶台×2',tool:'stethoscope',result:'✅ 可用——火力正常，适合炒菜煲汤'},
        {id:'zone3',top:'116px',left:'25%',w:78,h:76,label:'蒸箱',tool:'otoscope',result:'✅ 可用——正在蒸鱼，2分钟后完成'},
        {id:'zone4',top:'116px',left:'75%',w:78,h:76,label:'烤箱',tool:'thermometer',result:'✅ 可用——烤鸡翅即将完成'},
        {id:'zone5',top:'216px',left:'25%',w:78,h:76,label:'微波炉',tool:'files',result:'✅ 可用——快速加热备用汤品'},
        {id:'zone6',top:'216px',left:'75%',w:78,h:76,label:'凉菜区',tool:'gloves',result:'✅ 有准备好的凉菜——可先上桌安抚客人'}],
      tools:[{id:'bpmonitor',label:'检查主灶',icon:'bpmonitor'},{id:'stethoscope',label:'检查小灶台',icon:'stethoscope'},{id:'otoscope',label:'查看蒸箱',icon:'otoscope'},{id:'thermometer',label:'查看烤箱',icon:'thermometer'},{id:'files',label:'查看微波炉',icon:'files'},{id:'gloves',label:'查看凉菜区',icon:'gloves'}],
      knowledge:'厨房危机管理的核心是「资源重组」：主灶坏了用副灶+蒸箱+烤箱+微波炉分散烹饪，凉菜先上稳定客人情绪，而非等主灶修好。'},
    {type:'action',title:'特殊需求处理',sub:'一位妈妈带过敏体质的孩子来吃饭——花生和鸡蛋过敏。小朋友很失落，说「每次出来吃饭都要问好久」。',
      scene:'今天好几道菜都用了鸡蛋。但厨房里有豆腐、青菜、鸡胸肉、米饭——完全可以用安全食材做一道好吃的。\n关键是，除了解决「吃什么」，还需要关注小朋友的情绪。',
      options:[
        {id:'z1',text:'亲自蹲到小朋友面前，问喜欢吃什么，承诺专门做一道没有花生鸡蛋的「特别菜」',correct:true,feedback:'这让小朋友感到被重视而非被当作麻烦。专属定制带来的快乐远超一道菜本身。'},
        {id:'z2',text:'给妈妈一份详细的安全菜单，让她自己选——这样最保险',correct:false,feedback:'保险但缺少温度。妈妈已经习惯小心翼翼了，小朋友也希望有不一样的体验。主动多做一些，会让这一餐不一样。'},
        {id:'z3',text:'用豆腐、青菜、鸡胸肉即兴创作一道菜，同时标注好过敏原信息',correct:true,feedback:'专业+温暖。既解决了眼前的需求，又为以后来的客人提供了便利。好的厨师不只是做菜，更是创造体验。'},
        {id:'z4',text:'建议他们去隔壁素食餐厅，那边肯定没有鸡蛋和花生',correct:false,feedback:'虽然出于安全考虑没错，但小朋友会觉得被推开。在自己的能力范围内多做一步，往往就是「普通餐厅」和「让人记住的餐厅」的区别。'}],
    knowledge:'好的服务不是「不犯错」，而是「多做一步」。对过敏客人的处理方式，体现了一家餐厅真正的温度。'}
  ],
  knowledge:['菜单设计是平衡艺术：顾客需求+食材新鲜度+营养搭配+成本控制，每个因素都要考虑。','厨房危机应对的核心是「资源重组」——而非等待问题解决。充分利用所有可用设备，凉菜先上稳住局面。','好的服务是「多做一步」：对过敏客人不仅提供安全食物，更让他们感到被欢迎、被重视。','厨师不只是做菜：验收食材、设计菜单、管理团队、应对突发状况、了解顾客需求——这是一个需要综合能力的职业。']
},

journalist:{
  name:'报社记者',timeStart:'09:00',
  stages:[
    {type:'collect',mode:'newsroom',title:'编辑部线索墙',sub:'把零散线索整理成一套可靠的采访准备，故事才能从这里出发。',items:[
      {id:'files',icon:'files',label:'浏览新闻线索',desc:'翻阅社区公告、读者来信、社交媒体，寻找值得报道的故事'},
      {id:'pen',icon:'pen',label:'列采访提纲',desc:'确定选题后，列出核心问题和可能的采访角度'},
      {id:'radio',icon:'radio',label:'联系采访对象',desc:'打电话预约采访时间，说明报道意图和大致方向'},
      {id:'camera',icon:'camera',label:'检查摄影设备',desc:'确认相机电量充足、存储卡空间够、录音笔正常工作'},
      {id:'coat',icon:'coat',label:'准备记者证',desc:'佩戴记者证，准备好名片和记录用的笔记本'},
      {id:'book',icon:'book',label:'背景研究',desc:'快速查阅相关资料，对采访话题建立基本了解'},
      {id:'mic',icon:'mic',label:'测试录音笔',desc:'试录一段确认音质清晰，电池充足'},
      {id:'bpmonitor',icon:'bpmonitor',label:'确认截稿时间',desc:'了解今天的截稿时间安排，合理规划采访和写作进度'}]},
    {type:'storyboard',title:'组织报道线索',sub:'把采访到的线索拖成一个清楚的报道结构：先交代事实，再呈现人物细节，最后补充背景。',
      scene:'同事们都在报常规选题：社区花园改造（写过两次了）、菜市场整治……你觉得这些都不是好故事。\n那个修鞋摊的画面在你脑中挥之不去：阳光透过梧桐叶，老爷爷的手指翻飞，孩子们托着下巴认真地听。',
      items:[
        {id:'jfact',avatar:'<span style="font-size:22px">1</span>',name:'先说清事实',detail:'老街修鞋摊的王爷爷，已经在这里修了40年鞋。',tag:'red',tagLabel:'开头',priority:1},
        {id:'jdetail',avatar:'<span style="font-size:22px">2</span>',name:'补充现场细节',detail:'梧桐树下，他一边穿针引线，一边给放学的孩子讲老街故事。',tag:'yellow',tagLabel:'画面',priority:2},
        {id:'jvoice',avatar:'<span style="font-size:22px">3</span>',name:'加入多方声音',detail:'孩子和街坊都说，修鞋摊是他们每天愿意停下来的地方。',tag:'yellow',tagLabel:'采访',priority:3},
        {id:'jcontext',avatar:'<span style="font-size:22px">4</span>',name:'核实并补充背景',detail:'社区档案显示，这条老街近年保留了多家传统手艺店。',tag:'green',tagLabel:'背景',priority:4}],
      confirmLabel:'生成报道结构',completeTitle:'报道结构完成！',
      options:[
        {id:'j1',text:'站起来说：「老街修鞋摊的老爷爷边修鞋边给孩子们讲故事，这背后一定有值得记录的东西」',correct:true,feedback:'好的新闻不一定大，但一定有「人」和「温度」。你看到的不只是一个修鞋摊，而是老街记忆的活档案。'},
        {id:'j2',text:'先不说，等自己采访完写出稿子再给大家看——万一故事不够好呢？',correct:false,feedback:'记者需要勇气。如果每个人都等「完美的选题」才开口，选题会就失去了意义。分享你的直觉，让大家帮你完善。'},
        {id:'j3',text:'提议去社区走访一圈，和居民聊天，从日常生活中发现线索',correct:true,feedback:'好想法！但修鞋老爷爷已经是一个具体的线索了。你可以先去采访他，同时在老街多走走，也许会发现更多。'},
        {id:'j4',text:'觉得修鞋摊太「小」了，还是报社区花园改造吧，稳妥一些',correct:false,feedback:'新闻的价值不在于「大小」而在于「意义」。一个普通人的故事，如果能让读者产生共鸣，就是好新闻。'}],
    knowledge:'好新闻不在「大」而在「真」。一个修鞋匠的故事，如果能让读者看到老街的变迁和人情的温暖，比一篇空洞的宏观报道更有力量。'},
    {type:'sort',title:'采访调查',sub:'你来到老街修鞋摊。老爷爷很健谈，在这里修了40年鞋，有说不完的故事。如何高效地完成采访？排列你的采访步骤。',items:[
      {id:'i1',avatar:'<svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="16" stroke="#fff" stroke-width="2"/><circle cx="20" cy="20" r="3" fill="#fff"/><circle cx="30" cy="20" r="3" fill="#fff"/></svg>',name:'建立信任',detail:'不急着提问，先坐下来看他修鞋，听他随意聊。让他感觉你是有兴趣的听众，而不是拿着录音笔的「记者」。',tag:'red',tagLabel:'第一步',priority:1},
      {id:'i2',avatar:'<svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="14" stroke="#fff" stroke-width="2"/><text x="24" y="29" text-anchor="middle" fill="#FFD93D" font-size="14">?</text></svg>',name:'开放式提问',detail:'用「您在这条街最难忘的事是什么」「现在的孩子和以前有什么不同」等开放式问题，让老爷爷自由发挥。',tag:'red',tagLabel:'核心',priority:2},
      {id:'i3',avatar:'<svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="14" stroke="#fff" stroke-width="2"/><circle cx="20" cy="20" r="4" fill="#FFD93D"/></svg>',name:'观察细节',detail:'留意他的工具箱、墙上的老照片、他和街坊打招呼的方式——这些细节比语言更有画面感。',tag:'yellow',tagLabel:'重要',priority:3},
      {id:'i4',avatar:'<svg viewBox="0 0 48 48"><circle cx="24" cy="14" r="8" stroke="#fff" stroke-width="2"/><path d="M12 38c0-6 5.4-12 12-12s12 6 12 12" stroke="#fff" stroke-width="2"/></svg>',name:'多方印证',detail:'也采访旁边的小朋友和路过的街坊，从不同角度了解老爷爷在大家心中的形象。',tag:'yellow',tagLabel:'重要',priority:4},
      {id:'i5',avatar:'<svg viewBox="0 0 48 48"><rect x="14" y="10" width="20" height="28" rx="3" stroke="#fff" stroke-width="2"/><text x="24" y="28" text-anchor="middle" fill="#FFD93D" font-size="8">KEY</text></svg>',name:'核实关键信息',detail:'老爷爷说50年前这条街有条河——查一下是不是真的。好记者不只听，还要验证。',tag:'green',tagLabel:'后续',priority:5}],
    knowledge:'好的采访是「倾听」而非「审问」。先建立信任、让受访者打开话匣子，再用开放式问题引导，最后核实关键细节。'},
    {type:'diagnose',title:'核实与撰稿',sub:'老爷爷说50年前老街有条小河。但你查档案发现，那条河在100年前就改道了。记忆和事实不一致，怎么办？',
      summary:'<b>困境：</b>老爷爷的记忆很动人，但事实有出入。直接写「老爷爷说他记得有条河」不严谨——那条河早就不在了。<br><b>选择：</b>如何在「真实」和「温度」之间找到平衡？',
      diags:[
        {id:'v1',text:'在报道中如实呈现两种说法：「档案记载……而老街居民的记忆是……」让读者了解全貌',correct:true},
        {id:'v2',text:'按老爷爷说的写，反正读者不会去查档案，故事好听就行',correct:false},
        {id:'v3',text:'再去找老爷爷聊一次，温和地追问小河记忆的细节——也许能发现新的线索',correct:true},
        {id:'v4',text:'直接删掉关于小河的段落，避开这个矛盾，只写安全的内容',correct:false}],
      meds:[
        {id:'w1',name:'以场景开头',type:'文学性',dot:'green',desc:'梧桐树下修鞋摊前，老爷爷穿针引线的画面……',target:true},
        {id:'w2',name:'多方声音',type:'平衡',dot:'blue',desc:'也引用小朋友、街坊和官方档案的说法',target:true},
        {id:'w3',name:'人物细节',type:'生动',dot:'yellow',desc:'老爷爷的双手、工具箱、说话时眼睛里的光',target:true},
        {id:'w4',name:'只写好的不写坏的',type:'片面',dot:'red',desc:'选择性呈现信息，把老爷爷塑造成完美形象',target:false},
        {id:'w5',name:'大量数据堆砌',type:'枯燥',dot:'red',desc:'老街GDP、人口统计、市政规划……像政府报告',target:false},
        {id:'w6',name:'标题党吸引眼球',type:'噱头',dot:'red',desc:'「震惊！七旬老人街头做这种事……」',target:false}],
      correctMsg:'一篇好报道：有温度的人物细节+平衡的多方视角+诚实地面对事实矛盾。真实和温暖并不矛盾。',
      knowledge:'新闻的生命是真实——但真实不等于冷冰冰。有温度的报道建立在诚实面对事实的基础上，而不是回避或美化。'}
  ],
  knowledge:['好新闻不在大小而在「人」和「温度」。普通人的故事如果能引起共鸣，就是好新闻。','好的采访是倾听而非审问：先建立信任→开放式提问→观察细节→多方印证→核实关键信息。','新闻的生命是真：面对「动人的故事」和「严格的事实」之间的冲突，诚实地呈现矛盾比回避矛盾更有力量。','记者不只是记录者——发现线索、建立信任、事实核查、平衡呈现，每一个环节都需要专业和责任感。']
},

animal_caretaker:{
  name:'动物保护员',timeStart:'08:00',
  stages:[
    {type:'collect',mode:'shelter',title:'晨间巡护打卡',sub:'沿着救助站巡护路线，先照看动物、再整理环境和急救物资。',items:[
      {id:'paw',icon:'paw',label:'逐个检查动物',desc:'巡视每个笼舍，观察精神状态、食欲、排泄物是否正常'},
      {id:'scale',icon:'scale',label:'准备饲料',desc:'根据不同动物的种类和年龄，配制合适的饲料和饮用水'},
      {id:'brush',icon:'brush',label:'清洁笼舍',desc:'清理粪便、更换垫料、用宠物安全消毒液擦拭笼具'},
      {id:'gloves',icon:'gloves',label:'戴好防护手套',desc:'接触不同动物前必须换手套，防止交叉感染'},
      {id:'files',icon:'files',label:'记录健康状况',desc:'在每只动物的档案上记录今日观察：体重、食欲、精神状态'},
      {id:'wash',icon:'wash',label:'清洁食盆水盆',desc:'用热水和专用洗涤剂彻底清洗所有食具水具'},
      {id:'thermometer',icon:'thermometer',label:'测量环境温湿度',desc:'确保猫舍狗舍温度适宜（18-26°C），湿度适中'},
      {id:'bandage',icon:'bandage',label:'备齐药品绷带',desc:'检查急救箱：止血粉、碘伏、绷带、驱虫药都备齐'}]},
    {type:'sort',title:'动物救助优先级',sub:'今早接到4通救助电话。判断处理顺序。',items:[
      {id:'r1',avatar:'<svg viewBox="0 0 48 48"><circle cx="24" cy="14" r="8" stroke="#fff" stroke-width="2"/><path d="M8 38l8-10 6 4 12-16 8 12" stroke="#FF6B6B" stroke-width="2.5"/></svg>',name:'车祸受伤的流浪狗',detail:'路边一只黄狗被电动车撞伤，后腿有明显伤口在流血，趴在路边无法移动。需要紧急止血和送医。',tag:'red',tagLabel:'最紧急',priority:1},
      {id:'r2',avatar:'<svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="14" stroke="#fff" stroke-width="2"/><circle cx="20" cy="20" r="2" fill="#FF6B6B"/><circle cx="30" cy="20" r="2" fill="#FF6B6B"/></svg>',name:'被困树上的小猫',detail:'一只小猫爬上了小区的大树，已经在上面叫了6个小时下不来。虽然暂时安全，但再拖下去会脱水和饥饿。',tag:'yellow',tagLabel:'较紧急',priority:2},
      {id:'r3',avatar:'<svg viewBox="0 0 48 48"><circle cx="24" cy="17" r="10" stroke="#fff" stroke-width="2"/><path d="M10 36c0-7 6.3-14 14-14s14 7 14 14" stroke="#fff" stroke-width="2"/></svg>',name:'疑似被遗弃的兔子',detail:'有人在公园角落发现一只笼养兔子，笼子里还有没吃完的胡萝卜。可能是主人不想养了丢出来的。',tag:'yellow',tagLabel:'较紧急',priority:3},
      {id:'r4',avatar:'<svg viewBox="0 0 48 48"><circle cx="24" cy="15" r="10" stroke="#fff" stroke-width="2"/><path d="M12 36c0-6 5-12 12-12s12 6 12 12" stroke="#6BCB77" stroke-width="2"/></svg>',name:'居民捡到一窝小奶猫',detail:'好心居民在车库里发现一窝刚出生的小猫，猫妈妈不在附近。需要保暖和人工喂养指导。',tag:'green',tagLabel:'可稍后',priority:4}],
    knowledge:'动物救助和人类急救一样，需要分轻重缓急。正在流血的生命排在第一位，被困但暂时安全的可以稍后处理。记住：救助别人前先确保自己的安全。'},
    {type:'examine',character:'cat',title:'动物健康检查',sub:'救助站里的黑猫「墨墨」今天不太对劲——缩在角落不吃东西，最爱的玩具球也不理了。\n检查墨墨的身体，找出问题所在。',
      zones:[
        {id:'a1',top:'50px',left:'61%',w:66,h:54,label:'眼睛与耳朵',tool:'otoscope',result:'👁️ 眼部分泌物增多，耳道干净无异味——可能感染或有应激反应'},
        {id:'a2',top:'22px',left:'59%',w:42,h:38,label:'耳部测温点',tool:'thermometer',result:'🌡️ 体温39.1°C——猫正常体温38-39°C，略偏高'},
        {id:'a3',top:'112px',left:'53%',w:74,h:54,label:'胸部·听诊',tool:'stethoscope',result:'🩺 心肺听诊暂时稳定'},
        {id:'a4',top:'174px',left:'46%',w:84,h:70,label:'腹部·触诊',tool:'bpmonitor',result:'🔍 腹部轻度膨胀，触诊敏感——可能有积食或寄生虫'},
        {id:'a5',top:'232px',left:'85%',w:48,h:58,label:'观察记录卡',tool:'files',result:'📋 记录显示：昨天至今未排便、食欲下降，需要重点关注'}],
      tools:[{id:'otoscope',label:'检查镜',icon:'otoscope',help:'检查镜像一支小手电筒，能帮助我们仔细看清眼睛、耳朵等外观。请检查墨墨的脸部。'},{id:'thermometer',label:'体温计',icon:'thermometer',help:'体温计用来了解身体有没有发热。本演示用耳部测温点练习，请点击耳朵附近。'},{id:'stethoscope',label:'听诊器',icon:'stethoscope',help:'听诊器可以听心跳和呼吸声。请把它放到胸口位置。'},{id:'bpmonitor',label:'触诊',icon:'bpmonitor',help:'触诊是用手轻轻按压、感受腹部状态的检查方法。请检查腹部，不要用力按。'},{id:'files',label:'观察记录',icon:'files',help:'观察记录不是医疗器械，而是保护员的重要工具。点击记录卡，看看墨墨最近的饮食和排泄变化。'}],
      knowledge:'猫很会隐藏自己不舒服——当它们表现出明显异常时，可能已经难受了一段时间。留意细微变化（食欲、排泄、活动量）是保护员的基本功。'},
    {type:'action',title:'社区科普宣传',sub:'救助站开放日。你负责在广场科普动物保护知识。但路过的人行色匆匆，一位妈妈说「流浪动物不干净，养宠物太麻烦了」。',
      scene:'你知道很多人对流浪动物有误解，但硬说「流浪动物很干净」也不对——它们确实需要驱虫和疫苗。\n怎么在说实话的同时，又传递正确的动物保护理念？',
      options:[
        {id:'e1',text:'展示救助前后对比图：「这只是墨墨刚来时的样子，这是现在的样子——每只动物都值得被温柔对待」',correct:true,feedback:'真实的故事比说教有力量一万倍。对比图让人直观地看到「救助的意义」，也自然回答了「流浪动物脏不脏」的疑问——经过照顾，它们可以很干净健康。'},
        {id:'e2',text:'直接反驳妈妈：「你说的不对，流浪动物也很干净。定期驱虫打疫苗就没问题」',correct:false,feedback:'直接反驳只会让对方防御性更强。教育不是辩论——赢了争论不等于赢得了理解。先认同对方的顾虑（「您的担心是有道理的」），再说你的观点。'},
        {id:'e3',text:'设计互动游戏让小朋友通过卡片答题学习动物知识，答对有贴纸奖励——孩子感兴趣了，家长自然围过来',correct:true,feedback:'聪明！通过孩子带动家长是最有效的社区科普方式。游戏化的形式让学习变成玩，家长在旁边等着的时候，不知不觉也听进去了。'},
        {id:'e4',text:'发传单就行了，内容写得专业一点，想看的人自然会看',correct:false,feedback:'传单的阅读率通常很低。科普的关键不是「信息多全面」，而是「如何让人愿意听」。一场好的互动胜过一万张没人看的传单。'}],
    knowledge:'科普的关键不是「我说的多全面」，而是「你愿不愿意听」。理解对方的顾虑，用故事而非说教，通过孩子带动家长——这些都比单纯宣扬事实更有效。'}
  ],
  knowledge:['动物救助和人类急救一样需要分级：正在出血的优先，暂时安全但会恶化的次之。自身安全永远是第一位的。','猫是隐藏不适的高手。留意细微变化——食欲、排泄、活动量——比等到明显异常再行动更重要。','科普不是灌输知识，而是唤起共情。真实故事比数据说教更有感染力，通过孩子带动家长是最有效的社区传播方式。','动物保护员需要的不仅是喜欢动物：观察力、耐心、沟通能力、责任感，以及面对误解时依然能温和沟通的定力。']
}};

/* ==== GAME ENGINE ==== */
const G={career:null,careerId:null,stage:0,clock:{h:8,m:0},prepDone:[],triageOrder:[],examDone:{},selectedTool:null,diagnosisCorrect:false,placedMeds:[],routeStep:0,routePath:[],dialogueTurn:0,stageResults:[],stageHintTimer:null,process:{startedAt:0,activeFrom:0,activeMs:0,hintCount:0,retryCount:0,adjustmentCount:0,interactionCount:0,completedStages:0}};

/* -- Process observation: participation only, never an ability score. -- */
function startProcessObservation(){G.process.startedAt=Date.now();G.process.activeFrom=Date.now();document.addEventListener('visibilitychange',()=>{if(document.hidden){if(G.process.activeFrom){G.process.activeMs+=Date.now()-G.process.activeFrom;G.process.activeFrom=0}}else if(!G.process.activeFrom){G.process.activeFrom=Date.now()}})}
function observeProcess(type){if(type==='hint')G.process.hintCount++;if(type==='retry')G.process.retryCount++;if(type==='adjust')G.process.adjustmentCount++;if(type==='interaction'){G.process.interactionCount++;clearDelayedGuide()}}
function focusMinutes(){const active=G.process.activeMs+(G.process.activeFrom?Date.now()-G.process.activeFrom:0);return Math.max(1,Math.round(active/60000))}
function processRecord(){return {career:G.career?.name||'',careerId:G.careerId||'',focusMinutes:focusMinutes(),hintCount:G.process.hintCount,retryCount:G.process.retryCount,adjustmentCount:G.process.adjustmentCount,interactionCount:G.process.interactionCount,completedStages:G.process.completedStages,stageCount:G.career?.stages?.length||0,stageResults:G.stageResults,routePath:G.routePath,routeCompleted:!!G.stageResults.find(x=>x&&x.type==='route'&&x.completed),recordedAt:new Date().toISOString()}}
function saveProcessRecord(){try{localStorage.setItem('career-workday-process-'+G.career.name,JSON.stringify(processRecord()))}catch(e){}}

/* -- SVG helper -- */
function S(name,sz){const s=sz||48;return'<span class="img-slot" style="width:'+s+'px;height:'+s+'px"><span class="img-fallback">'+(I[name]||'')+'</span></span>'}

/* -- Init -- */
document.addEventListener('DOMContentLoaded',()=>{
  const path=window.location.pathname;
  const m=path.match(/\/workday\/(\w+)/);
  const cid=m?m[1]:'doctor';
  G.careerId=cid;
  /* 职业日常只保留“准备—工作判断—专业操作”三段；末段情境决策交给情境模块，避免重复评价。 */
  const sourceCareer=WD[cid]||WD.doctor;
  G.career={...sourceCareer,stages:sourceCareer.stages.slice(0,3)};
  document.documentElement.style.setProperty('--career-character','url("'+careerCharacterUrl()+'")');startProcessObservation();
  initPinyinAssist();
  document.title=G.career.name+'的一天 — 职业体验模拟器';
  const parts=G.career.timeStart.split(':');
  G.clock={h:parseInt(parts[0]),m:parseInt(parts[1])||0};
  updateClock();renderStage(0);setTimeout(showWorkdayWelcome,500);
});

function tick(m){G.clock.m+=m;while(G.clock.m>=60){G.clock.m-=60;G.clock.h++}updateClock()}
function updateClock(){const h=String(G.clock.h).padStart(2,'0'),mm=String(G.clock.m).padStart(2,'0');document.getElementById('wd-clock').textContent='🕐 '+h+':'+mm}
function setHint(h){document.getElementById('wd-hint').innerHTML=h}
function updateCrumbs(t){document.getElementById('wd-crumbs').innerHTML=t.map((x,i)=>i===t.length-1?'<span class="crumb now">'+x+'</span>':'<span class="crumb">'+x+'</span><span class="crumb-sep">›</span>').join('')}
function showWorkdayWelcome(){
  if(localStorage.getItem('career-workday-guide-v1'))return;
  const target=document.querySelector('.prep-grid')||document.querySelector('#wd-main');if(!target)return;
  target.classList.add('coach-target');
  const layer=document.createElement('div');layer.className='coach-tip-layer';
  layer.innerHTML='<div class="coach-tip-card"><span class="coach-tip-icon">🧭</span><h3>职业日常怎么玩？</h3><p>先完成眼前的小任务。遇到不确定时可以等一等，系统会高亮下一步；检查任务要先选工具，再点对应位置。</p><button type="button">开始体验</button></div>';
  document.body.appendChild(layer);layer.querySelector('button').onclick=()=>{localStorage.setItem('career-workday-guide-v1','1');target.classList.remove('coach-target');layer.remove();};
}
function clearDelayedGuide(){if(G.stageHintTimer){clearTimeout(G.stageHintTimer);G.stageHintTimer=null}document.querySelectorAll('.gentle-guide').forEach(el=>el.classList.remove('gentle-guide'))}
function armDelayedGuide(s){clearDelayedGuide();G.stageHintTimer=setTimeout(()=>{let target=null,copy='卡住了吗？先看看发光的位置，再试一次。';if(s.type==='collect')target=document.querySelector('.prep-card:not(.done)');else if(s.type==='sort')target=document.querySelector('#sort-list');else if(s.type==='action'||s.type==='diagnose')target=document.querySelector('.diag-choices');else if(s.type==='examine'){if(G.selectedTool){const zone=s.zones.find(item=>item.tool===G.selectedTool&&!G.examDone[item.id]);target=zone&&document.querySelector('.body-zone[data-zone="'+zone.id+'"]');copy=zone?'试着点发光的「'+zone.label+'」区域。':'先换一件还没有完成的工具吧。'}else{target=document.querySelector('#exam-tools .exam-tool-btn:not(.used)')||document.querySelector('#exam-tools');copy='先从发光的工具开始，选好再去检查对应区域。'}}if(target){target.classList.add('gentle-guide');observeProcess('hint');setHint('💡 '+copy)}},12000)}
function armExamineZoneGuide(s){clearDelayedGuide();G.stageHintTimer=setTimeout(()=>{const zone=s.zones.find(item=>item.tool===G.selectedTool&&!G.examDone[item.id]);const target=zone&&document.querySelector('.body-zone[data-zone="'+zone.id+'"]');if(target){target.classList.add('gentle-guide');observeProcess('hint');setHint('💡 已为你标出「'+zone.label+'」，轻轻点它完成检查。')}},7000)}
const CAREER_ART={doctor:'/static/images/scenes/doctor_01.png',firefighter:'/static/images/scenes/firefighter_base.png',teacher:'/static/images/scenes/teacher_base.png',chef:'/static/images/scenes/chef_base.png',journalist:'/static/images/scenes/journalist_base.png',animal_caretaker:'/static/images/scenes/animal_caretaker_base.png'};
const CAREER_CHARACTERS={doctor:'/static/images/roles/doctor-character-v1.png',firefighter:'/static/images/roles/firefighter-character-v1.png',teacher:'/static/images/roles/teacher-character-v1.png',chef:'/static/images/roles/chef-character-v1.png',journalist:'/static/images/roles/journalist-character-v1.png',animal_caretaker:'/static/images/roles/animal_caretaker-character-v1.png'};
/* 每个职业各有一套独立绘制的 Q 版工具贴纸，而不是通用小图标。 */
const PREP_ART={
  doctor:{coat:'coat',files:'files',wash:'wash',stethoscope:'stethoscope',bpmonitor:'bpmonitor',gloves:'gloves',thermometer:'thermometer',otoscope:'otoscope'},
  firefighter:{helmet:'helmet',coat:'jacket',axe:'pry-bar',rope:'rescue-rope',radio:'walkie-talkie',bpmonitor:'breathing-apparatus',gloves:'gloves-boots',thermometer:'thermal-camera'},
  teacher:{book:'book',chalk:'chalk',files:'files',star:'star',wash:'wash',whistle:'whistle',gloves:'gloves',coat:'coat'},
  chef:{scale:'scale',knife:'knife',pot:'pot',files:'files',gloves:'gloves',coat:'coat',thermometer:'thermometer',bpmonitor:'bpmonitor'},
  journalist:{files:'files',pen:'pen',radio:'radio',camera:'camera',coat:'coat',book:'book',mic:'mic',bpmonitor:'bpmonitor'},
  animal_caretaker:{paw:'paw',scale:'scale',brush:'brush',gloves:'gloves',files:'files',wash:'wash',thermometer:'thermometer',bandage:'bandage'}
};
function prepArtUrl(careerId,itemId){const name=PREP_ART[careerId]?.[itemId];return name?'/static/images/tasks/'+careerId+'/'+name+'-v1.png':null}
const COLLECT_PROFILES={
  clinic:{name:'开诊流程单',intro:'病人的安心，从整洁、卫生、可靠的诊室开始。',done:'诊室已经准备妥当，可以从容迎接第一位病人。',groups:[{at:0,name:'诊室形象与病历'},{at:2,name:'卫生防护'},{at:3,name:'诊断设备'}]},
  locker:{name:'出警装备柜',intro:'每一件装备都在保护队员，也在保护等待救援的人。',done:'装备确认完毕，消防车可以安全出发。',groups:[{at:0,name:'个人防护'},{at:2,name:'破拆与救援'},{at:4,name:'联络与侦查'}]},
  classroom:{name:'晨光教室布置图',intro:'老师的准备，会变成孩子一天里看得见的安全感和期待。',done:'教室准备好了，等待同学们带着好奇心进来。',groups:[{at:0,name:'教学内容'},{at:3,name:'学习环境'},{at:5,name:'班级照料'}]},
  kitchen:{name:'后厨开档清单',intro:'好味道之前，先让食材新鲜、操作干净、设备可靠。',done:'后厨开档完成，今天的第一锅香气可以开始了。',groups:[{at:0,name:'食材与备料'},{at:3,name:'卫生与工装'},{at:6,name:'冷链与火候'}]},
  newsroom:{name:'今日线索墙',intro:'把好奇心、证据和时间安排放在一起，采访才会有方向。',done:'采访包准备就绪，可以出发寻找故事里的真实声音。',groups:[{at:0,name:'线索与问题'},{at:2,name:'联系与记录'},{at:5,name:'背景与节奏'}]},
  shelter:{name:'救助站巡护路线',intro:'先看动物的状态，再照料环境与物资，不漏掉每一个小生命。',done:'晨间巡护完成，救助站已经准备好迎接新的一天。',groups:[{at:0,name:'动物观察'},{at:2,name:'环境照料'},{at:4,name:'记录与急救'}]}
};
/* 阅读辅助词库：采用整词注音，避免多音字被逐字误读。 */
const PINYIN_TEXT={
  '开诊台准备':'kāi zhěn tái zhǔn bèi','装备柜点检':'zhuāng bèi guì diǎn jiǎn','布置晨间教室':'bù zhì chén jiān jiào shì','后厨开档':'hòu chú kāi dàng','编辑部线索墙':'biān jí bù xiàn suǒ qiáng','晨间巡护打卡':'chén jiān xún hù dǎ kǎ',
  '病人分诊':'bìng rén fēn zhěn','问诊检查':'wèn zhěn jiǎn chá','接警出动':'jiē jǐng chū dòng','现场救援决策':'xiàn chǎng jiù yuán jué cè','课堂管理':'kè táng guǎn lǐ','帮助困难学生':'bāng zhù kùn nán xué shēng','设计今日菜单':'shè jì jīn rì cài dān','出餐高峰应对':'chū cān gāo fēng yìng duì','发现新闻线索':'fā xiàn xīn wén xiàn suǒ','采访调查':'cǎi fǎng diào chá','动物救助优先级':'dòng wù jiù zhù yōu xiān jí','动物健康检查':'dòng wù jiàn kāng jiǎn chá',
  '开诊流程单':'kāi zhěn liú chéng dān','出警装备柜':'chū jǐng zhuāng bèi guì','晨光教室布置图':'chén guāng jiào shì bù zhì tú','后厨开档清单':'hòu chú kāi dàng qīng dān','今日线索墙':'jīn rì xiàn suǒ qiáng','救助站巡护路线':'jiù zhù zhàn xún hù lù xiàn',
  '诊室形象与病历':'zhěn shì xíng xiàng yǔ bìng lì','卫生防护':'wèi shēng fáng hù','诊断设备':'zhěn duàn shè bèi','个人防护':'gè rén fáng hù','破拆与救援':'pò chāi yǔ jiù yuán','联络与侦查':'lián luò yǔ zhēn chá','教学内容':'jiào xué nèi róng','学习环境':'xué xí huán jìng','班级照料':'bān jí zhào liào','食材与备料':'shí cái yǔ bèi liào','卫生与工装':'wèi shēng yǔ gōng zhuāng','冷链与火候':'lěng liàn yǔ huǒ hòu','线索与问题':'xiàn suǒ yǔ wèn tí','联系与记录':'lián xì yǔ jì lù','背景与节奏':'bèi jǐng yǔ jié zòu','动物观察':'dòng wù guān chá','环境照料':'huán jìng zhào liào','记录与急救':'jì lù yǔ jí jiù',
  '穿工作服':'chuān gōng zuò fú','查看今日预约':'chá kàn jīn rì yù yuē','洗手消毒':'xǐ shǒu xiāo dú','检查听诊器':'jiǎn chá tīng zhěn qì','校准血压计':'jiào zhǔn xuè yā jì','备齐防护用品':'bèi qí fáng hù yòng pǐn','消毒体温计':'xiāo dú tǐ wēn jì','检查检耳镜':'jiǎn chá jiǎn ěr jìng',
  '消防头盔面罩':'xiāo fáng tóu kuī miàn zhào','防火战斗服':'fáng huǒ zhàn dòu fú','破拆工具斧':'pò chāi gōng jù fǔ','救生绳索':'jiù shēng shéng suǒ','通讯对讲机':'tōng xùn duì jiǎng jī','空气呼吸器':'kōng qì hū xī qì','防护手套靴子':'fáng hù shǒu tào xuē zi','热成像仪':'rè chéng xiàng yí',
  '备课教案':'bèi kè jiào àn','教具准备':'jiào jù zhǔn bèi','批改作业':'pī gǎi zuò yè','布置教室':'bù zhì jiào shì','整理讲台':'zhěng lǐ jiǎng tái','确认课间安排':'què rèn kè jiān ān pái','检查防疫物资':'jiǎn chá fáng yì wù zī','整理仪表':'zhěng lǐ yí biǎo',
  '验收食材':'yàn shōu shí cái','清洗切配':'qīng xǐ qiē pèi','准备高汤':'zhǔn bèi gāo tāng','查看预订':'chá kàn yù dìng','清洁消毒':'qīng jié xiāo dú','穿戴工装':'chuān dài gōng zhuāng','检查冷藏设备':'jiǎn chá lěng cáng shè bèi','检查灶台设备':'jiǎn chá zào tái shè bèi',
  '浏览新闻线索':'liú lǎn xīn wén xiàn suǒ','列采访提纲':'liè cǎi fǎng tí gāng','联系采访对象':'lián xì cǎi fǎng duì xiàng','检查摄影设备':'jiǎn chá shè yǐng shè bèi','准备记者证':'zhǔn bèi jì zhě zhèng','背景研究':'bèi jǐng yán jiū','测试录音笔':'cè shì lù yīn bǐ','确认截稿时间':'què rèn jié gǎo shí jiān',
  '逐个检查动物':'zhú gè jiǎn chá dòng wù','准备饲料':'zhǔn bèi sì liào','清洁笼舍':'qīng jié lóng shè','戴好防护手套':'dài hǎo fáng hù shǒu tào','记录健康状况':'jì lù jiàn kāng zhuàng kuàng','清洁食盆水盆':'qīng jié shí pén shuǐ pén','测量环境温湿度':'cè liáng huán jìng wēn shī dù','备齐药品绷带':'bèi qí yào pǐn bēng dài',
  '体温计':'tǐ wēn jì','检耳镜':'jiǎn ěr jìng','听诊器':'tīng zhěn qì','血压计':'xuè yā jì','检查镜':'jiǎn chá jìng','触诊':'chù zhěn','观察记录':'guān chá jì lù','检查主灶':'jiǎn chá zhǔ zào','检查小灶台':'jiǎn chá xiǎo zào tái','查看蒸箱':'chá kàn zhēng xiāng','查看烤箱':'chá kàn kǎo xiāng','查看微波炉':'chá kàn wēi bō lú','查看凉菜区':'chá kàn liáng cài qū'
};
const PinyinAssist={enabled:false};
function escapePinyinText(value){return String(value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]))}
function pinyinNode(tag,className,text){return '<'+tag+(className?' class="'+className+'"':'')+' data-pinyin="'+escapePinyinText(text)+'">'+escapePinyinText(text)+'</'+tag+'>'}
function updatePinyinButton(){const button=document.getElementById('wd-pinyin-toggle');if(!button)return;button.setAttribute('aria-pressed',String(PinyinAssist.enabled));button.querySelector('b').textContent=PinyinAssist.enabled?'拼音开':'拼音'}
function applyPinyinAssist(){document.querySelectorAll('[data-pinyin]').forEach(el=>{const text=el.dataset.pinyin||'';const pinyin=PINYIN_TEXT[text];el.classList.remove('pinyin-on');if(PinyinAssist.enabled&&pinyin){el.innerHTML='<span class="hanzi">'+escapePinyinText(text)+'</span><span class="pinyin-line" aria-hidden="true">'+pinyin+'</span>';el.classList.add('pinyin-on')}else el.textContent=text})}
function initPinyinAssist(){try{PinyinAssist.enabled=localStorage.getItem('career-workday-pinyin')==='on'}catch(e){}const button=document.getElementById('wd-pinyin-toggle');if(!button)return;updatePinyinButton();button.addEventListener('click',()=>{PinyinAssist.enabled=!PinyinAssist.enabled;try{localStorage.setItem('career-workday-pinyin',PinyinAssist.enabled?'on':'off')}catch(e){}updatePinyinButton();applyPinyinAssist();setHint(PinyinAssist.enabled?'🔤 拼音辅助已开启：任务名称下方会显示读音。':'🔤 拼音辅助已关闭，你可以随时再打开它。')})}
function careerCharacterUrl(){return CAREER_CHARACTERS[G.careerId]||CAREER_CHARACTERS.doctor}
function addStageArt(s){const key=Object.keys(WD).find(id=>WD[id]===G.career);const url=CAREER_ART[key],character=careerCharacterUrl();const host=document.querySelector('#wd-main > div');if(!url||!host)return;const art=document.createElement('div');art.className='wd-stage-art';art.style.backgroundImage='linear-gradient(90deg,rgba(72,53,38,.63),rgba(72,53,38,.05)),url('+url+')';art.innerHTML='<img src="'+character+'" alt="'+G.career.name+'任务小伙伴" class="wd-stage-character" loading="lazy"><div class="wd-stage-copy"><em>第 '+(G.stage+1)+' 关 · 职业日常</em><b>'+s.title+'</b><span>'+s.sub+'</span></div>';host.prepend(art)}

function upgradeMissionIllustration(s){const icon=document.querySelector('.mission-icon,.action-mission-icon');if(icon)icon.innerHTML=S(s.type==='action'?'check2':'files',42)}
function renderStage(n){
  clearDelayedGuide();
  G.stage=n;G.prepDone=[];G.triageOrder=[];G.examDone={};G.selectedTool=null;G.diagnosisCorrect=false;G.placedMeds=[];G.routeStep=0;G.routePath=[];G.dialogueTurn=0;
  const s=G.career.stages[n];
  const total=G.career.stages.length,label=document.getElementById('wd-stage-label'),fill=document.getElementById('wd-stage-fill');if(label)label.textContent='第 '+(n+1)+' / '+total+' 关';if(fill)fill.style.width=((n+1)/total*100)+'%';
  updateCrumbs([G.career.name+'的一天',s.title]);
  setHint(s.type==='collect'?'🖱️ 依次<b>点击</b>每个卡片完成准备':(s.type==='sort'||s.type==='sequence'||s.type==='storyboard')?'🖱️ <b>拖拽</b>卡片调整顺序':s.type==='examine'?'🖱️ 先选<b>工具</b>再点<b>部位</b>检查':s.type==='route'?'🧭 点击格子，规划一条安全救援路线':s.type==='dialogue'?'💬 观察学生的表情和回应，再决定下一句话':s.type==='action'?'🖱️ <b>点击</b>你认为最合适的选择':s.type==='diagnose'?'🖱️ 先选<b>诊断</b>再<b>拖拽</b>药品到处方':'');
  if(s.type==='collect')renderCollect(s);else if(s.type==='sort'||s.type==='sequence')renderSort(s);else if(s.type==='storyboard')renderStoryboard(s);else if(s.type==='examine')renderExamine(s);else if(s.type==='route')renderRoute(s);else if(s.type==='dialogue')renderDialogue(s);else if(s.type==='action')renderAction(s);else if(s.type==='diagnose')renderDiagnose(s);upgradeMissionIllustration(s);addStageArt(s);applyPinyinAssist();armDelayedGuide(s);
}

/* ---- COLLECT ---- */
function renderCollect(s){
  const profile=COLLECT_PROFILES[s.mode]||{name:'今日小任务',intro:'按顺序完成准备。',done:'准备完成。',groups:[]};
  let h='<div class="collect-board collect-'+(s.mode||'default')+'" style="max-width:760px;width:100%">'+pinyinNode('div','section-title',s.title)+'<div class="section-sub">'+s.sub+'</div><div class="task-mission"><span class="mission-icon">&#127919;</span><div>'+pinyinNode('b','',profile.name)+'<span id="prep-progress">按职业流程完成 0 / '+s.items.length+' 项</span></div></div><p class="collect-intro">'+profile.intro+'</p><div class="prep-grid">';
  s.items.forEach((it,i)=>{const art=prepArtUrl(G.careerId,it.id);const visual=art?'<img class="prep-sticker" src="'+art+'" alt="'+it.label+'" loading="eager">':S(it.icon,40);const group=profile.groups.find(g=>g.at===i);if(group)h+='<div class="prep-group-title"><span></span>'+pinyinNode('strong','',group.name)+'<i></i></div>';h+='<div class="prep-card'+(art?' has-sticker':'')+'" data-prep="'+it.id+'" data-idx="'+i+'" id="prep-'+it.id+'"><div class="prep-step">'+(i+1)+'</div><div class="prep-icon">'+visual+'</div>'+pinyinNode('div','prep-label',it.label)+'<div class="prep-desc">'+it.desc+'</div></div>'});
  h+='</div></div>';document.getElementById('wd-main').innerHTML=h;
  document.querySelectorAll('.prep-card').forEach(c=>c.addEventListener('click',()=>{
    const idx=parseInt(c.dataset.idx);
    if(c.classList.contains('done')) return;
    if(idx!==G.prepDone.length){observeProcess('hint');
      const expected=document.querySelector('.prep-card[data-idx="'+G.prepDone.length+'"]');
      if(expected){expected.classList.add('prep-remind');setTimeout(()=>expected.classList.remove('prep-remind'),700)}
      setHint('&#128161; \u5148\u5b8c\u6210\u5e26\u6570\u5b57 '+(G.prepDone.length+1)+' \u7684\u51c6\u5907\uff0c\u518d\u7ee7\u7eed\u5427\uff01');
      return;
    }
    observeProcess('interaction');c.classList.add('done');G.prepDone.push(c.dataset.prep);tick(2);
    document.getElementById('prep-progress').textContent='\u5df2\u5b8c\u6210 '+G.prepDone.length+' / '+s.items.length+' \u9879\u51c6\u5907';
    setHint('&#9989; '+c.querySelector('.prep-label').textContent+' \u5b8c\u6210\u5566\uff01');
    if(G.prepDone.length===s.items.length){
      G.stageResults[G.stage]=true;
      setTimeout(()=>showComplete(s.title+'完成！',profile.done),350);
    }
  }));
}

/* ---- SORT ---- */
function renderSort(s){
  const isSequence=s.type==='sequence',isStoryboard=s.type==='storyboard';
  let h='<div class="'+(isSequence?'sequence-board ':'')+(isStoryboard?'storyboard-board ':'')+'" style="max-width:640px;width:100%">'+pinyinNode('div','section-title',s.title)+'<div class="section-sub">'+s.sub+'</div>'+(isSequence?'<div class="mechanic-tip">🍳 拖动步骤卡，排出后厨真正的操作顺序</div>':isStoryboard?'<div class="mechanic-tip">📰 拖动线索卡，把事实组织成一段可靠报道</div>':'')+'<div class="triage-list" id="sort-list">';
  const shuffled=[...s.items].sort(()=>Math.random()-.5);
  shuffled.forEach((it,i)=>{h+='<div class="triage-card" draggable="true" data-pid="'+it.id+'" data-priority="'+it.priority+'"><span class="tri-rank">'+(i+1)+'</span><span class="tri-avatar">'+it.avatar+'</span><div class="tri-info"><div class="tri-name">'+it.name+'</div><div class="tri-detail">'+it.detail+'</div></div><span class="tri-tag tag-'+it.tag+'">'+it.tagLabel+'</span></div>'});
  h+='</div><div style="text-align:center"><button class="btn-primary" id="sort-btn" disabled>'+((s.confirmLabel)|| (isSequence?'确认流程':isStoryboard?'生成报道结构':'确认排序'))+'</button></div></div>';
  document.getElementById('wd-main').innerHTML=h;setupSortDrag(s);
}
function setupSortDrag(s){
  const list=document.getElementById('sort-list');let dragged=null;
  list.querySelectorAll('.triage-card').forEach(card=>{
    card.addEventListener('dragstart',e=>{dragged=card;card.classList.add('drag-ghost');e.dataTransfer.effectAllowed='move'});
    card.addEventListener('dragend',()=>{card.classList.remove('drag-ghost');list.querySelectorAll('.triage-card').forEach(c=>c.classList.remove('drag-over'));dragged=null;refreshSort(s)});
    card.addEventListener('dragover',e=>{e.preventDefault();if(card!==dragged)card.classList.add('drag-over')});
    card.addEventListener('dragleave',()=>card.classList.remove('drag-over'));
    card.addEventListener('drop',e=>{e.preventDefault();card.classList.remove('drag-over');if(card!==dragged&&dragged){const r=card.getBoundingClientRect();list.insertBefore(dragged,e.clientY<r.top+r.height/2?card:card.nextSibling);refreshSort(s)}});
    // Touch
    card.addEventListener('touchstart',function(e){dragged=this;this.classList.add('drag-ghost')});
    card.addEventListener('touchmove',function(e){e.preventDefault();const t=e.touches[0];const c=document.elementFromPoint(t.clientX,t.clientY)?.closest('.triage-card');list.querySelectorAll('.triage-card').forEach(x=>x.classList.remove('drag-over'));if(c&&c!==dragged)c.classList.add('drag-over')});
    card.addEventListener('touchend',function(e){this.classList.remove('drag-ghost');const t=e.changedTouches[0];const c=document.elementFromPoint(t.clientX,t.clientY)?.closest('.triage-card');if(c&&c!==dragged){const r=c.getBoundingClientRect();list.insertBefore(dragged,t.clientY<r.top+r.height/2?c:c.nextSibling);refreshSort(s)}list.querySelectorAll('.triage-card').forEach(x=>x.classList.remove('drag-over'));dragged=null});
  });
  refreshSort(s);
}
function refreshSort(s){
  const cards=document.querySelectorAll('#sort-list .triage-card');G.triageOrder=[];cards.forEach((c,i)=>{c.querySelector('.tri-rank').textContent=i+1;c.classList.add('placed');G.triageOrder.push({pid:c.dataset.pid,priority:parseInt(c.dataset.priority)})});
  const btn=document.getElementById('sort-btn');btn.disabled=false;btn.onclick=()=>{const order=G.triageOrder.map(p=>p.priority);const correct=s.items.map(it=>it.priority);if(order.every((v,i)=>v===correct[i])){G.stageResults[G.stage]=true;tick(10);showComplete(s.completeTitle||(s.type==='sequence'?'流程安排完成！':s.type==='storyboard'?'报道结构完成！':'排序正确！'),s.knowledge||'')}else{setHint(s.type==='sequence'?'⚠️ 想想食品安全和烹饪节奏：哪些事必须先完成？':s.type==='storyboard'?'⚠️ 好报道要先有事实，再补充细节和背景。试着调整线索顺序。':'⚠️ 顺序不太对，仔细阅读每条描述中的关键信息，重新拖拽调整。')}};
}

function renderStoryboard(s){renderSort(s)}

function renderRoute(s){
  const route=s.route,tiles=[];
  for(let row=1;row<=route.rows;row++)for(let col=1;col<=route.cols;col++){const id='r'+row+'c'+col;const mark=id===route.start?'🚒':id===route.goal?'🏠':route.blocked.includes(id)?'🔥':'';tiles.push('<button type="button" class="route-tile '+(id===route.start?'route-start ':'')+(id===route.goal?'route-goal ':'')+(route.blocked.includes(id)?'route-blocked ':'')+'" data-route="'+id+'" '+(route.blocked.includes(id)?'disabled':'')+'>'+mark+'</button>')}
  const h='<div class="route-board" style="max-width:650px;width:100%">'+pinyinNode('div','section-title',s.title)+'<div class="section-sub">'+s.sub+'</div><div class="route-mission"><b>救援路线规划</b><span>避开起火区域，带着搭档从消防车到达被困居民所在的安全入口。</span></div><div class="route-legend"><span>🚒 出发</span><span>🔥 危险区域</span><span>🏠 救援入口</span></div><div class="route-grid" style="grid-template-columns:repeat('+route.cols+',1fr)">'+tiles.join('')+'</div><div id="route-feedback" class="route-feedback">先点击消防车，再选择相邻的安全格子。</div></div>';
  document.getElementById('wd-main').innerHTML=h;
  document.querySelectorAll('.route-tile:not([disabled])').forEach(tile=>tile.addEventListener('click',()=>{const id=tile.dataset.route,expected=route.path[G.routeStep],feedback=document.getElementById('route-feedback');if(id!==expected){observeProcess('retry');tile.classList.add('route-wrong');setTimeout(()=>tile.classList.remove('route-wrong'),450);feedback.textContent='这里不能直接通过。看看火场位置，选择与当前路线相邻的安全格子。';return}observeProcess('interaction');G.routePath.push(id);tile.classList.add('route-path');tile.disabled=true;G.routeStep++;if(G.routeStep===route.path.length){G.stageResults[G.stage]={type:'route',completed:true,path:G.routePath.slice()};tick(9);feedback.textContent='路线安全！你和搭档已经到达救援入口。';setTimeout(()=>showComplete('救援路线规划完成！',s.knowledge||''),420)}else feedback.textContent='路线已推进 '+G.routeStep+' 步，继续带着搭档前进。'}));
}

function renderDialogue(s){
  const d=s.dialogue,turn=d.turns[G.dialogueTurn];
  let h='<div class="dialogue-mission" style="max-width:650px;width:100%">'+pinyinNode('div','section-title',s.title)+'<div class="section-sub">'+s.sub+'</div><div class="student-mood mood-'+turn.mood+'"><div class="student-avatar">'+d.avatar+'</div><div><b>'+d.student+'</b><span>'+turn.stage+'</span><p>“'+turn.studentWords+'”</p></div><i>'+turn.emotion+'</i></div><div class="mentor-prompt">老师现在可以怎么回应？请选择一句你愿意真正说出口的话。</div><div class="dialogue-options">';
  turn.options.forEach((option,index)=>h+='<button type="button" class="dialogue-option" data-index="'+index+'"><span>回应 '+(index+1)+'</span>'+option.text+'</button>');
  h+='</div><div id="dialogue-feedback" class="dialogue-feedback"></div></div>';
  document.getElementById('wd-main').innerHTML=h;
  document.querySelectorAll('.dialogue-option').forEach(button=>button.addEventListener('click',()=>{const option=turn.options[Number(button.dataset.index)],feedback=document.getElementById('dialogue-feedback');document.querySelectorAll('.dialogue-option').forEach(item=>item.disabled=true);observeProcess('interaction');feedback.className='dialogue-feedback show '+(option.supportive?'warm':'repair');feedback.innerHTML='<b>'+option.emotion+'</b><p>'+option.reply+'</p><button class="btn-primary">'+(option.supportive?(G.dialogueTurn===d.turns.length-1?'完成这次谈话':'继续听听朵朵怎么说'):'换一种说法试试')+'</button>';feedback.querySelector('button').addEventListener('click',()=>{if(option.supportive){if(G.dialogueTurn===d.turns.length-1){G.stageResults[G.stage]=true;tick(8);showComplete('支持性对话完成！',s.knowledge||'')}else{G.dialogueTurn++;renderDialogue(s)}}else{observeProcess('retry');renderDialogue(s);setHint('💡 先让孩子感到安全、被理解，再一起想办法。')}})}));
}

/* ---- EXAMINE ---- */
function examFigure(kind){
  const photos={person:'/static/images/exam/medical-model-q-v3.png',kitchen:'/static/images/exam/kitchen-equipment-q-v3.png',cat:'/static/images/exam/cat-check-clean-q-v4.png'};
  if(photos[kind])return '<img class="exam-figure exam-photo" src="'+photos[kind]+'" alt="职业任务检查图">';
  if(kind==='cat')return '<svg class="exam-figure" viewBox="0 0 200 320"><path d="M49 216c-25 4-29 35-9 39 19 4 31-9 27-23" fill="none" stroke="#58463B" stroke-width="11" stroke-linecap="round"/><ellipse cx="105" cy="192" rx="58" ry="78" fill="#444954"/><ellipse cx="105" cy="201" rx="34" ry="48" fill="#6B7380" opacity=".75"/><circle cx="105" cy="76" r="54" fill="#444954"/><path d="M61 45 72 7l29 27M148 45 138 7l-28 27" fill="#444954" stroke="#58463B" stroke-width="6" stroke-linejoin="round"/><path d="M68 42 74 20l15 18M142 42 136 20l-15 18" fill="#F09A91"/><ellipse cx="85" cy="74" rx="9" ry="13" fill="#FFF9E6"/><ellipse cx="125" cy="74" rx="9" ry="13" fill="#FFF9E6"/><circle cx="86" cy="76" r="5" fill="#29242B"/><circle cx="124" cy="76" r="5" fill="#29242B"/><path d="M96 95q9 8 18 0" stroke="#F3A29A" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M76 101 35 94M76 108 33 116M134 101 175 94M134 108 177 116" stroke="#58463B" stroke-width="3" stroke-linecap="round"/><ellipse cx="72" cy="270" rx="23" ry="13" fill="#444954"/><ellipse cx="138" cy="270" rx="23" ry="13" fill="#444954"/></svg>';
  if(kind==='kitchen')return '<svg class="exam-figure kitchen-figure" viewBox="0 0 200 320"><rect x="10" y="18" width="180" height="272" rx="18" fill="#FFF4DE" stroke="#D89961" stroke-width="4"/><rect x="22" y="44" width="80" height="74" rx="8" fill="#F59E67" stroke="#A95D45" stroke-width="4"/><circle cx="45" cy="67" r="13" fill="#394C59"/><circle cx="80" cy="67" r="13" fill="#394C59"/><path d="M43 48q-8-14 0-24M79 48q8-14 0-24" stroke="#F4D8B0" stroke-width="5" fill="none" stroke-linecap="round"/><rect x="112" y="48" width="62" height="66" rx="8" fill="#8EC7D8" stroke="#4E8195" stroke-width="4"/><path d="M122 65h42M122 79h42M122 93h42" stroke="#EAF8FA" stroke-width="4"/><rect x="22" y="140" width="72" height="70" rx="8" fill="#F8C46C" stroke="#B77C3D" stroke-width="4"/><rect x="108" y="140" width="66" height="70" rx="8" fill="#9BCDE0" stroke="#4D829A" stroke-width="4"/><rect x="118" y="151" width="46" height="31" rx="4" fill="#3F5966"/><circle cx="142" cy="196" r="4" fill="#F39B62"/><rect x="20" y="235" width="156" height="34" rx="9" fill="#7FC59B" stroke="#4E966E" stroke-width="4"/><path d="M42 235v-23h25v23M92 235v-23h25v23M141 235v-23h25v23" fill="#F2E0A4" stroke="#C59D4E" stroke-width="3"/><text x="100" y="309" text-anchor="middle" fill="#9B6A46" font-size="13" font-weight="700">忙碌厨房</text></svg>';
  return '<svg class="exam-figure" viewBox="0 0 200 320"><circle cx="100" cy="57" r="43" fill="#FFD5B5"/><path d="M58 54q2-49 43-49 42 0 44 48-19-17-43-17-25 0-44 18" fill="#755646"/><circle cx="84" cy="60" r="5" fill="#5B4539"/><circle cx="116" cy="60" r="5" fill="#5B4539"/><path d="M90 81q10 8 20 0" stroke="#D8756C" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M57 121q43-23 86 0l18 125H39z" fill="#84C8DC" stroke="#5D86A0" stroke-width="4"/><path d="M81 113 100 140l19-27" fill="#FFF8E7"/><path d="M68 136 35 195M132 136l33 59" stroke="#FFD5B5" stroke-width="17" stroke-linecap="round"/><path d="M69 245 59 307M131 245l10 62" stroke="#536E93" stroke-width="24" stroke-linecap="round"/><path d="M53 307h26M121 307h26" stroke="#5B4539" stroke-width="14" stroke-linecap="round"/><path d="M141 147q19 15 12 45" fill="none" stroke="#9B7BC5" stroke-width="5"/><rect x="144" y="174" width="18" height="32" rx="8" fill="#BDA8D6"/></svg>';
}
function examToolHint(kind,tool){
  if(kind==='kitchen'){const kitchenHints={bpmonitor:'主灶检查：确认一号主灶的火力是否稳定。',stethoscope:'小灶台检查：确认两个小灶台的火力是否稳定。',otoscope:'蒸箱检查：看看蒸箱里的菜是否快完成。',thermometer:'烤箱检查：确认烤箱温度和菜品进度。',files:'微波炉检查：确认它能否快速加热备用汤品。',gloves:'凉菜区检查：查看是否有能立刻先上的凉菜。'};return kitchenHints[tool]||'先选一种设备，再检查对应的厨房区域。';}
  const hints={thermometer:'\u4f53\u6e29\u8ba1\u7528\u6765\u6d4b\u91cf\u4f53\u6e29\u3002',otoscope:'\u68c0\u67e5\u955c\u53ef\u4ee5\u89c2\u5bdf\u8033\u9053\u3001\u773c\u90e8\u6216\u54bd\u5589\u3002',stethoscope:'\u542c\u8bca\u5668\u7528\u6765\u542c\u80f8\u90e8\u7684\u5fc3\u97f3\u6216\u547c\u5438\u97f3\u3002',files:'\u89c2\u5bdf\u8bb0\u5f55\u53ef\u4ee5\u67e5\u770b\u6392\u6cc4\u3001\u98df\u6b32\u7b49\u65e5\u5e38\u53d8\u5316\u3002'};
  if(tool==='bpmonitor')return kind==='cat'?'\u89e6\u8bca\uff1a\u8f7b\u8f7b\u6309\u538b\u8179\u90e8\uff0c\u89c2\u5bdf\u732b\u7684\u53cd\u5e94\u3002':'\u8840\u538b\u68c0\u67e5\uff1a\u628a\u8896\u5e26\u5957\u5728\u4e0a\u81c2\u3002';
  return hints[tool]||'\u8bf7\u6839\u636e\u5de5\u5177\u7528\u9014\u5bfb\u627e\u90e8\u4f4d\u3002';
}
function renderExamine(s){
  let h='<div style="max-width:720px;width:100%">'+pinyinNode('div','section-title',s.title)+'<div class="section-sub">'+s.sub.replace(/\n/g,'<br>')+'</div><div class="exam-layout"><div class="exam-body exam-body-'+s.character+'">'+examFigure(s.character);
  s.zones.forEach(z=>{const centeredLeft=String(z.left).includes('%')?'calc('+z.left+' - '+(z.w/2)+'px)':(parseFloat(z.left)-z.w/2)+'px';h+='<button type="button" class="body-zone" data-zone="'+z.id+'" data-label="'+z.label+'" style="top:'+z.top+';left:'+centeredLeft+';width:'+z.w+'px;height:'+z.h+'px" title="'+z.label+'" aria-label="检查 '+z.label+'"></button>'});
  h+='</div><div class="exam-panel"><div class="panel-title">&#128295; \u68c0\u67e5\u5de5\u5177</div><div class="exam-tools-row" id="exam-tools">';
  s.tools.forEach(t=>{h+='<button class="exam-tool-btn" data-tool="'+t.id+'">'+S(t.icon,20)+' '+pinyinNode('span','',t.label)+'</button>'});
  h+='</div><div class="exam-help" id="exam-help">&#128161; \u5148\u9009\u5de5\u5177\uff0c\u7cfb\u7edf\u4f1a\u544a\u8bc9\u4f60\u5b83\u80fd\u68c0\u67e5\u54ea\u91cc\u3002</div><div class="panel-title">&#128203; \u53d1\u73b0</div><div class="exam-findings" id="exam-findings">\u9009\u5de5\u5177\u540e\u70b9\u51fb\u5bf9\u5e94\u90e8\u4f4d</div><div class="exam-actions"><button class="btn-primary" id="exam-done-btn" disabled>\u5b8c\u6210\u68c0\u67e5</button></div></div></div></div>';
  document.getElementById('wd-main').innerHTML=h;
  document.querySelectorAll('#exam-tools .exam-tool-btn').forEach(b=>b.addEventListener('click',()=>{
    document.querySelectorAll('#exam-tools .exam-tool-btn').forEach(x=>x.classList.remove('selected'));
    b.classList.add('selected');G.selectedTool=b.dataset.tool;armExamineZoneGuide(s);
    const tool=s.tools.find(item=>item.id===b.dataset.tool);document.getElementById('exam-help').textContent='💡 '+(tool&&tool.help?tool.help:examToolHint(s.character,b.dataset.tool));
  }));
  document.querySelectorAll('.body-zone').forEach(z=>z.addEventListener('click',()=>{
    const zid=z.dataset.zone;if(G.examDone[zid])return;
    if(!G.selectedTool){observeProcess('hint');setHint('?? \u8bf7\u5148\u9009\u4e00\u4ef6\u68c0\u67e5\u5de5\u5177');return}
    const zd=s.zones.find(x=>x.id===zid);if(!zd)return;
    if(G.selectedTool!==zd.tool){observeProcess('hint');const targets=s.zones.filter(x=>x.tool===G.selectedTool).map(x=>x.label).join('\u3001');setHint('?? '+examToolHint(s.character,G.selectedTool)+' \u53ef\u4ee5\u68c0\u67e5\uff1a'+targets);return}
    observeProcess('interaction');z.classList.add('done');G.examDone[zid]=true;document.querySelector('#exam-tools .exam-tool-btn[data-tool="'+zd.tool+'"]').classList.add('used');G.selectedTool=null;
    document.querySelectorAll('#exam-tools .exam-tool-btn').forEach(x=>x.classList.remove('selected'));
    document.getElementById('exam-findings').innerHTML=Object.keys(G.examDone).map(k=>'<div class="finding-item">'+s.zones.find(x=>x.id===k).result+'</div>').join('');
    tick(3);
    if(Object.keys(G.examDone).length>=s.zones.length){const done=document.getElementById('exam-done-btn');done.disabled=false;done.onclick=()=>{G.stageResults[G.stage]=true;showComplete('\u68c0\u67e5\u5b8c\u6210\uff01',s.knowledge||'')}}
  }));
}

/* ---- ACTION (multi-choice scenario) ---- */
function actionOutcome(opt,correct){
  const id=Object.keys(WD).find(key=>WD[key]===G.career)||'doctor';
  const profiles={
    doctor:{role:'护士小安',good:'这个安排很周到，我去准备需要的物品，也陪家属把下一步说清楚。',try:'我们先停一下，想想怎样既照顾病人的需要，也让家属知道下一步怎么办。',goodResult:'团队开始分工，病人和家属都知道接下来要做什么。',tryResult:'眼前的问题还没有被完整接住，可以回到选择中再调整一次。'},
    firefighter:{role:'消防队长',good:'这个方案兼顾了安全和协作，大家按你的提示各就各位。',try:'先别急着行动，救援时还要把风险和同伴的位置一起考虑。',goodResult:'队员们有了清楚分工，现场秩序也更稳定。',tryResult:'我们还需要一个更安全、更能保护大家的方案。'},
    teacher:{role:'学生小雨',good:'原来我的想法也能被听见！我愿意试试看。',try:'老师，我有点担心这样做后，还是有人没有机会表达。',goodResult:'更多同学愿意开口，课堂的气氛慢慢活起来。',tryResult:'这个做法可能遗漏了一部分同学的需要，可以再换个角度想想。'},
    chef:{role:'服务员小林',good:'收到！我去和客人说明，也把你的安排传给后厨。',try:'这个办法可能会让客人或厨房里的同伴还要多等一会儿。',goodResult:'客人得到回应，厨房也能更有条理地继续出餐。',tryResult:'我们还可以把资源和顾客感受一起放进方案里考虑。'},
    journalist:{role:'编辑老师',good:'这个角度很有价值，我们把线索和证据一起补完整。',try:'先不要急着下结论，新闻还需要更多可以核实的信息。',goodResult:'报道有了更可靠的材料，也更容易让读者理解。',tryResult:'先回到选择里，找一个更能兼顾事实和他人感受的方法。'},
    animal_caretaker:{role:'志愿者小美',good:'好呀，我来配合你。墨墨和来访的小朋友都会感到被认真对待。',try:'我们可以再想想，怎样既保护动物，也更好地回应大家的担心。',goodResult:'现场有人开始加入帮忙，动物和人的需要都被看见了。',tryResult:'这个结果还不够理想，换一种更温和、更完整的做法试试。'}
  };
  const p=profiles[id]||profiles.doctor;
  return {role:p.role,words:correct?p.good:p.try,result:correct?p.goodResult:p.tryResult};
}
function renderAction(s){
  let h='<div style="max-width:600px;width:100%">'+pinyinNode('div','section-title',s.title)+'<div class="section-sub">'+s.sub+'</div>';
  h+='<div class="diag-summary" style="margin-bottom:16px">'+s.scene+'</div><div class="action-mission"><span class="action-mission-icon">\u{1F9ED}</span><div><b>\u73B0\u573A\u884C\u52A8\u4EFB\u52A1</b><span>\u9009\u62E9\u4F60\u60F3\u5148\u5C1D\u8BD5\u7684\u65B9\u6CD5\uFF0C\u770B\u770B\u5B83\u4F1A\u4E3A\u73B0\u573A\u5E26\u6765\u4EC0\u4E48\u53D8\u5316\u3002</span></div></div><div class="action-plan-grid" id="action-choices">';
  s.options.forEach((o,i)=>{h+='<button class="action-plan" data-id="'+o.id+'" data-correct="'+o.correct+'"><span class="action-plan-index">\u884C\u52A8 '+(i+1)+'</span><span class="action-plan-text">'+o.text+'</span><span class="action-plan-try">\u8BD5\u8BD5\u8FD9\u4E2A\u529E\u6CD5 \u2192</span></button>'});
  h+='</div><div class="diag-feedback" id="action-feedback"></div></div>';
  document.getElementById('wd-main').innerHTML=h;
  document.querySelectorAll('#action-choices .action-plan').forEach(b=>b.addEventListener('click',()=>{
    document.querySelectorAll('#action-choices .action-plan').forEach(x=>{x.classList.remove('selected','plan-explored')});b.classList.add('selected');
    observeProcess('interaction');const correct=b.dataset.correct==='true';const opt=s.options.find(o=>o.id===b.dataset.id);
    if(correct)G.stageResults[G.stage]=true;
    document.querySelectorAll('#action-choices .action-plan').forEach(x=>x.disabled=true);b.classList.add('plan-explored');
    const outcome=actionOutcome(opt,correct);const fb=document.getElementById('action-feedback');fb.className='diag-feedback show outcome-wrap';
    fb.innerHTML='<div class="outcome-card '+(correct?'outcome-good':'outcome-rethink')+'"><div class="outcome-role"><span class="outcome-avatar">'+(correct?'\u{1F31F}':'\u{1F4AC}')+'</span><div><b>'+outcome.role+'</b><span>\u73B0\u573A\u53CD\u5E94</span></div></div><p class="outcome-words">“'+outcome.words+'”</p><div class="outcome-result"><b>\u8FD9\u4E2A\u65B9\u6848\u5E26\u6765\u7684\u53D8\u5316</b><p>'+outcome.result+'</p></div><div class="outcome-why"><b>'+(correct?'\u5B83\u8003\u8651\u5230\u4E86\uFF1A':'\u53EF\u4EE5\u518D\u5B8C\u5584\uFF1A')+'</b>'+opt.feedback+'</div><button class="btn-primary outcome-next">'+(correct?'\u7EE7\u7EED\u8FD9\u4E00\u5929 \u2192':'\u56DE\u5230\u73B0\u573A\uFF0C\u518D\u60F3\u4E00\u4E2A\u529E\u6CD5')+'</button></div>';
    fb.querySelector('.outcome-next').addEventListener('click',()=>{if(correct){tick(8);showComplete('\u60C5\u5883\u5904\u7406\u5B8C\u6210\uFF01',s.knowledge||'')}else{observeProcess('retry');fb.className='diag-feedback';fb.innerHTML='';document.querySelectorAll('#action-choices .action-plan').forEach(x=>{x.disabled=false;x.classList.remove('selected','plan-explored')});setHint('\u{1F4A1} \u518D\u770B\u770B\u6BCF\u79CD\u505A\u6CD5\u4F1A\u600E\u6837\u5F71\u54CD\u73B0\u573A\u7684\u4EBA\u548C\u4E8B\u60C5\u3002')}});
  }));
}
/* ---- DIAGNOSE (diagnosis + drag meds) ---- */
function renderDiagnose(s){
  let h='<div style="max-width:720px;width:100%">'+pinyinNode('div','section-title',s.title)+'<div class="section-sub">'+s.sub+'</div><div class="diag-layout"><div class="diag-left">';
  h+='<div class="diag-summary">'+s.summary+'</div><div class="panel-title" style="margin-bottom:8px">🔍 你的判断</div><div class="diag-choices" id="diag-choices">';
  s.diags.forEach(d=>{h+='<button class="diag-option" data-diag="'+d.id+'" data-correct="'+d.correct+'">'+d.text+'</button>'});
  h+='</div><div class="diag-feedback" id="diag-feedback"></div></div><div class="diag-right">';
  h+='<div class="panel-title" style="margin-bottom:8px">📋 选择方案 <span style="font-weight:400;font-size:.75rem;color:var(--wd-dim)">(拖入'+Math.min(3,s.meds.filter(m=>m.target).length)+'项)</span></div><div class="presc-pad"><div class="presc-slots" id="presc-slots">';
  const slotCount=Math.min(3,s.meds.filter(m=>m.target).length);
  for(let i=0;i<slotCount;i++){h+='<div class="presc-slot" data-slot="'+i+'"><span class="slot-num">'+(i+1)+'</span><span class="slot-hint">拖入选项</span></div>'}
  h+='</div><div class="med-pool" id="med-pool">';
  s.meds.forEach(m=>{h+='<div class="med-chip" draggable="true" data-med="'+m.id+'" data-target="'+m.target+'" id="med-'+m.id+'"><span class="med-dot '+m.dot+'"></span>'+m.name+' <span style="font-size:.7rem;color:var(--wd-dim)">'+m.type+'</span></div>'});
  h+='</div><div style="text-align:center;margin-top:14px"><button class="btn-primary" id="presc-btn" disabled>确认方案</button></div></div></div></div>';
  document.getElementById('wd-main').innerHTML=h;
  // Diag choice
  document.querySelectorAll('#diag-choices .diag-option').forEach(b=>b.addEventListener('click',()=>{
    document.querySelectorAll('#diag-choices .diag-option').forEach(x=>{x.classList.remove('selected','correct','wrong')});b.classList.add('selected');
    G.diagnosisCorrect=b.dataset.correct==='true';
    const fb=document.getElementById('diag-feedback');fb.className='diag-feedback show';
    if(G.diagnosisCorrect){fb.classList.add('ok');fb.innerHTML='✅ <b>判断正确！</b>'}else{fb.classList.add('err');fb.innerHTML='❌ 再看看症状描述——选一个更全面的判断'}
    updatePrescBtn();
  }));
  // Drag meds
  document.querySelectorAll('.med-chip').forEach(chip=>{
    chip.addEventListener('dragstart',e=>{e.dataTransfer.setData('text/plain',chip.dataset.med);chip.style.opacity='.3'});
    chip.addEventListener('dragend',()=>{chip.style.opacity=''});
  });
  document.querySelectorAll('.presc-slot').forEach(slot=>{
    slot.addEventListener('dragover',e=>{e.preventDefault();if(!slot.classList.contains('filled'))slot.classList.add('drag-over')});
    slot.addEventListener('dragleave',()=>slot.classList.remove('drag-over'));
    slot.addEventListener('drop',e=>{e.preventDefault();slot.classList.remove('drag-over');if(slot.classList.contains('filled'))return;const mid=e.dataTransfer.getData('text/plain');const chip=document.getElementById('med-'+mid);if(chip&&!chip.classList.contains('used')){slot.classList.add('filled');slot.innerHTML='<span class="slot-num">✓</span>'+chip.innerHTML.replace(/style="[^"]*"/g,'');slot.dataset.med=mid;chip.classList.add('used');G.placedMeds.push({id:mid,target:chip.dataset.target==='true'});updatePrescBtn()}});
  });
}
function updatePrescBtn(){const btn=document.getElementById('presc-btn');if(!btn)return;if(G.diagnosisCorrect&&G.placedMeds.length>=3){btn.disabled=false;btn.onclick=checkPresc}else{btn.disabled=true}}
function checkPresc(){
  const s=G.career.stages[G.stage];
  const correct=G.placedMeds.filter(m=>m.target).length;
  const wrong=G.placedMeds.filter(m=>!m.target).length;
  if(correct>=3&&wrong===0){G.stageResults[G.stage]=true;tick(10);showAllDone()}else{
    observeProcess('hint');observeProcess('adjust');G.placedMeds=[];document.querySelectorAll('.presc-slot').forEach(sl=>{sl.classList.remove('filled');sl.dataset.med='';sl.innerHTML='<span class="slot-num">?</span><span class="slot-hint">拖入选项</span>'});
    document.querySelectorAll('.med-chip').forEach(m=>m.classList.remove('used'));document.getElementById('presc-btn').disabled=true;
    setHint('⚠️ 方案不太对——剔除不相关的选项，选择真正对症的。仔细看看每种方案的描述再决定。')}
}

/* ---- COMPLETE ---- */
function showComplete(title,msg){
  if(!G.stageResults[G.stage+'-counted']){G.process.completedStages++;G.stageResults[G.stage+'-counted']=true}
  const isLast=G.stage>=G.career.stages.length-1;
  document.getElementById('wd-main').innerHTML='<div class="complete-card"><div class="comp-stars"><span>✦</span><span>✦</span><span>✦</span></div><h2>'+title+'</h2><p class="comp-msg">'+msg+'</p><div class="comp-btns">'+(isLast?'<button class="btn-primary" id="comp-finish">查看一天总结 🎉</button>':'<button class="btn-primary" id="comp-next">进入下一步 →</button>')+'<button class="btn-secondary" id="comp-retry">🔄 重来这步</button></div></div>';
  if(isLast){document.getElementById('comp-finish').addEventListener('click',showAllDone)}else{document.getElementById('comp-next').addEventListener('click',()=>renderStage(G.stage+1))}
  document.getElementById('comp-retry').addEventListener('click',()=>{observeProcess('retry');renderStage(G.stage)});
  setHint('✅ 完成！');
}

function showAllDone(){
  if(!G.stageResults[G.stage+'-counted']){G.process.completedStages++;G.stageResults[G.stage+'-counted']=true}
  saveProcessRecord();
  const c=G.career;const nStages=c.stages.length;
  const scenarioUrl='/careers?career_id='+encodeURIComponent(G.careerId)+'&mode=scenario&from_workday=1';
  document.getElementById('wd-main').innerHTML='<div class="final-card"><div class="final-seal">'+S('check2',56)+'</div><h1>'+c.name+'的一天 — 完成！</h1><p class="final-sub">'+nStages+'个阶段的工作日常体验</p><div class="final-summary">'+c.stages.map((s,i)=>'<b>阶段'+(i+1)+'：</b>'+s.title).join('<br>')+'</div><div class="workday-bridge"><b>🌈 下一站：情境体验</b><span>继续完成同一职业的情境任务，今天的参与小记会和你的思考过程一起呈现在最终报告中。</span></div><div class="final-actions"><a href="'+scenarioUrl+'" class="btn-primary" style="text-decoration:none">💬 继续情境体验</a><a href="/careers" class="btn-secondary" style="text-decoration:none">🔄 体验其他职业</a><a href="/" class="btn-secondary">🏠 返回首页</a></div><div class="process-record"><h3>🌱 参与过程小记</h3><p>本记录只用于回顾体验过程，不代表能力分数。</p><div class="process-record-grid"><span>专注体验 '+focusMinutes()+' 分钟</span><span>完成 '+G.process.completedStages+' 个阶段</span><span>主动尝试 '+G.process.interactionCount+' 次</span><span>调整或重试 '+(G.process.adjustmentCount+G.process.retryCount)+' 次</span><span>查看提示 '+G.process.hintCount+' 次</span></div></div><div class="knowledge-box"><h3>📚 '+c.name+'职业知识点</h3><ul>'+(c.knowledge||[]).map(k=>'<li>'+k+'</li>').join('')+'</ul></div></div>';
  updateCrumbs([c.name+'的一天','体验完成！']);setHint('🎉 恭喜完成！');
  document.querySelectorAll('#stage-dots .dot').forEach(d=>d.classList.add('done'));
}
