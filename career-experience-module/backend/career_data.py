"""
Career and scenario definitions for Career Experience Simulator.
6 careers × 4 scenarios each. Life-relevant, no professional knowledge required.
"""
CAREERS = [
    {"id":"doctor","name":"社区医生","icon":"🏥","tagline":"守护邻里健康","description":"你是一名社区诊所的医生。每天面对不同的病人，你需要用专业和温暖帮助他们恢复健康。诊断病情、安抚患者、与团队协作——这些都是一名优秀医生每天要做的事情。","color":"#4ECDC4","bg_gradient":"linear-gradient(135deg, #e0f7fa, #b2ebf2)","difficulty":2,"skills_intro":"这个职业需要：善于观察、有同理心、冷静果断、团队合作"},
    {"id":"firefighter","name":"消防员","icon":"🚒","tagline":"勇敢逆行的守护者","description":"你是一名城市消防员。警铃响起的那一刻，你必须迅速行动。在浓烟和烈火中，你不仅要救出被困的人，还要安抚受惊的群众，用勇气和智慧守护这座城市的安全。","color":"#FF6B6B","bg_gradient":"linear-gradient(135deg, #ffebee, #ffcdd2)","difficulty":3,"skills_intro":"这个职业需要：勇敢果断、团队协作、冷静沉着、富有责任感"},
    {"id":"teacher","name":"小学教师","icon":"📚","tagline":"点亮知识的火花","description":"你是一名小学老师。站在讲台上，你面对的是一双双充满好奇的眼睛。每个孩子都是独特的，你需要用耐心和智慧引导他们成长，处理课堂上的各种小状况，让学习变得有趣又有意义。","color":"#FFD93D","bg_gradient":"linear-gradient(135deg, #fff9e6, #fff3cd)","difficulty":2,"skills_intro":"这个职业需要：耐心沟通、创造力、公平公正、善于鼓励"},
    {"id":"chef","name":"餐厅厨师","icon":"🍳","tagline":"用美食传递幸福","description":"你是一家温馨小餐馆的厨师。厨房是你的舞台，锅铲是你的乐器。你需要设计美味的菜单、应对各种突发状况、满足不同食客的需求，用一道道用心烹制的菜肴传递温暖与快乐。","color":"#FF8C42","bg_gradient":"linear-gradient(135deg, #fff3e0, #ffe0b2)","difficulty":2,"skills_intro":"这个职业需要：创造力、时间管理、灵活应变、注重细节"},
    {"id":"journalist","name":"报社记者","icon":"📰","tagline":"记录真实，传递声音","description":"你是一名报社记者。你的工作是发现值得报道的故事，采访不同的人，核实每一条信息，用公正客观的文字把真相传递给读者。这不仅需要敏锐的观察力，更需要一颗公正和负责任的心。","color":"#7C6FF7","bg_gradient":"linear-gradient(135deg, #ede7f6, #d1c4e9)","difficulty":3,"skills_intro":"这个职业需要：敏锐观察、善于沟通、批判思维、公正客观"},
    {"id":"animal_caretaker","name":"动物保护员","icon":"🐾","tagline":"温柔守护每一个生命","description":"你是一名动物救助站的保护员。每天和各种各样的动物打交道，你需要细心地照顾它们的生活，观察它们的健康状况，还要向公众传播动物保护的知识。这是一份需要满满爱心和耐心的工作。","color":"#6BCB77","bg_gradient":"linear-gradient(135deg, #e8f5e9, #c8e6c9)","difficulty":2,"skills_intro":"这个职业需要：细心观察、同理心、耐心、责任感"}
]

SCENARIOS = {}

# ---- DOCTOR ----
SCENARIOS["doctor"] = [
    {"id":"doctor_01","title":"接待初诊病人","scene":{"location":"社区诊所 · 大厅","time":"上午 9:00","atmosphere":"阳光透过窗户洒在候诊区，几位病人安静地坐着。空气中飘着淡淡的消毒水味道。","bg_class":"bg-clinic"},"dialogues":[{"speaker":"护士小李","text":"张医生，今天第一位病人来了。是一位小朋友，妈妈说孩子这两天一直咳嗽，晚上睡不好。","emotion":"normal"},{"speaker":"你（观察）","text":"你注意到，小朋友紧紧抓着妈妈的手，眼睛红红的，看起来又紧张又难受。妈妈脸上也写满了担忧。","emotion":"observe"},{"speaker":"妈妈","text":"医生您好……孩子咳了好几天了，我们有点着急，不知道是不是很严重……","emotion":"worried"},{"speaker":"小朋友","text":"（小声地）医生叔叔/阿姨……我害怕打针……","emotion":"scared"}],"choice_prompt":"面对这位紧张的小朋友和担心的妈妈，你会怎么做呢？","options":[{"id":"A","text":"微笑着蹲下来，用温和的语气先和小朋友聊聊天，让他放松下来","indicators":{"interpersonal":5,"empathy":5,"communication":4,"emotional_management":4}},{"id":"B","text":"先认真查看病历本，详细询问妈妈孩子的症状和生病经过","indicators":{"logical_mathematical":4,"critical_thinking":4,"intrapersonal":3,"decision_making":3}},{"id":"C","text":"直接拿出听诊器开始检查，用最快的速度判断病情","indicators":{"bodily_kinesthetic":4,"decision_making":4,"problem_solving":3,"linguistic":2}},{"id":"D","text":"先给小朋友和妈妈倒两杯温水，请他们坐下，告诉他们不用紧张","indicators":{"interpersonal":4,"empathy":4,"emotional_management":5,"communication":3}}],"follow_up_config":{"mentor_name":"李导师","style":"温和引导"}},
    {"id":"doctor_02","title":"紧急情况处理","scene":{"location":"社区诊所 · 诊室","time":"上午 10:30","atmosphere":"你刚看完第二位病人，突然听到候诊区传来一阵急促的脚步声和焦急的呼喊声。","bg_class":"bg-clinic-urgent"},"dialogues":[{"speaker":"护士小李","text":"张医生！快来看看！一位老人在候诊区突然晕倒了！","emotion":"urgent"},{"speaker":"你（观察）","text":"你赶紧跑过去，看到一位头发花白的老爷爷倒在地上，旁边的老伴急得直掉眼泪。候诊区的其他病人也都紧张地围了过来。","emotion":"observe"},{"speaker":"老奶奶","text":"老头子！你怎么了！医生快救救他！他有高血压……","emotion":"panic"},{"speaker":"围观病人","text":"（七嘴八舌）要不要扶他起来？/ 快打120！/ 给他喝点水……","emotion":"anxious"}],"choice_prompt":"情况紧急！周围一片混乱，你会怎么处理？","options":[{"id":"A","text":"先让大家安静散开，保持空气流通，同时冷静地开始检查老人的呼吸和脉搏","indicators":{"decision_making":5,"emotional_management":5,"problem_solving":4,"interpersonal":3}},{"id":"B","text":"立即让护士拨打120，同时询问老奶奶老人的病史和用药情况","indicators":{"problem_solving":5,"collaboration":4,"critical_thinking":4,"communication":3}},{"id":"C","text":"迅速组织围观的人帮忙，有人打电话，有人去拿急救箱，有人安抚家属","indicators":{"collaboration":5,"interpersonal":4,"decision_making":4,"communication":4}},{"id":"D","text":"先大声安慰老奶奶，告诉她别担心交给我，然后立即对老人进行急救检查","indicators":{"empathy":4,"emotional_management":4,"problem_solving":4,"linguistic":3}}],"follow_up_config":{"mentor_name":"李导师","style":"温和引导"}},
    {"id":"doctor_03","title":"安抚担忧的家属","scene":{"location":"社区诊所 · 走廊","time":"上午 11:15","atmosphere":"老人的情况稳定下来了，但你发现老奶奶还是很担心。她坐在走廊的长椅上，一个人默默地擦眼泪。","bg_class":"bg-clinic-hall"},"dialogues":[{"speaker":"你（观察）","text":"刚才紧急处理完老人的情况，你注意到老奶奶还坐在走廊里。她的手还在微微发抖，看起来很需要有人陪她说说话。","emotion":"observe"},{"speaker":"老奶奶","text":"（看到你走过来，勉强笑了笑）医生……谢谢你。老头子他……不会有事吧？我们结婚五十年了……","emotion":"worried"},{"speaker":"老奶奶","text":"他有高血压好多年了，我一直让他注意身体，他就是不听……要是他有个三长两短，我可怎么办……","emotion":"sad"}],"choice_prompt":"老奶奶非常担心和害怕，作为医生，你会怎么安慰她？","options":[{"id":"A","text":"坐在老奶奶旁边，耐心听她说完心里话，然后温和地解释老人的情况已经稳定","indicators":{"empathy":5,"interpersonal":5,"communication":4,"linguistic":3}},{"id":"B","text":"用简单易懂的方式详细解释老人的病情和后续注意事项，让家属心里有底","indicators":{"linguistic":4,"critical_thinking":4,"communication":5,"logical_mathematical":3}},{"id":"C","text":"轻轻握住老奶奶的手说，五十年真不容易，您放心，我们会尽全力照顾好他","indicators":{"empathy":5,"emotional_management":4,"interpersonal":4,"communication":3}},{"id":"D","text":"叫来护士陪老奶奶说说话，自己去安排老人的进一步检查和治疗","indicators":{"problem_solving":4,"collaboration":4,"decision_making":3,"intrapersonal":3}}],"follow_up_config":{"mentor_name":"李导师","style":"温和引导"}},
    {"id":"doctor_04","title":"团队协作会诊","scene":{"location":"社区诊所 · 会议室","time":"下午 2:00","atmosphere":"下午，你和诊所的其他医生、护士围坐在会议室里，讨论几位复杂病人的治疗方案。墙上的白板写着今天的病例要点。","bg_class":"bg-clinic-meeting"},"dialogues":[{"speaker":"主任王医生","text":"好了，大家都到了。今天上午的几位病人情况都比较复杂，我们一起商量一下后续的治疗方案吧。小张，你先说说那位老人的情况？","emotion":"professional"},{"speaker":"你（思考）","text":"你整理了一下上午的记录。老人的情况虽然稳定了，但长期的治疗和康复方案还需要团队一起讨论。","emotion":"think"},{"speaker":"营养师小赵","text":"我觉得老人的饮食也需要调整，高血压患者的饮食管理非常重要。我可以帮忙制定一个膳食方案。","emotion":"helpful"},{"speaker":"主任王医生","text":"好主意。还有一个情况——上午那位小朋友的妈妈后来发消息说，孩子还是有点害怕来复诊。这个我们也得想想办法。","emotion":"concerned"}],"choice_prompt":"在团队讨论中，你如何参与协作？","options":[{"id":"A","text":"主动分享你对老人病情的详细记录和分析，同时认真听取营养师和主任的建议","indicators":{"collaboration":5,"communication":5,"linguistic":4,"intrapersonal":3}},{"id":"B","text":"提出让营养师主导饮食方案，你负责病情跟踪，并建议护士多和小朋友互动来缓解他的恐惧","indicators":{"collaboration":5,"problem_solving":4,"interpersonal":4,"creativity":4}},{"id":"C","text":"认真记录每个人的建议，整理成一个完整的治疗方案，确保不遗漏任何细节","indicators":{"logical_mathematical":4,"critical_thinking":4,"intrapersonal":4,"decision_making":3}},{"id":"D","text":"重点讨论如何让小朋友不怕复诊，分享你上午和他互动的经验，提议在诊室放一些玩具","indicators":{"creativity":5,"empathy":5,"interpersonal":4,"communication":4}}],"follow_up_config":{"mentor_name":"李导师","style":"温和引导"}}
]

# ---- FIREFIGHTER ----
SCENARIOS["firefighter"] = [
    {"id":"firefighter_01","title":"接到火警出动","scene":{"location":"消防站 · 车库","time":"下午 2:15","atmosphere":"午后的消防站里，队员们刚刚结束训练。突然，警铃大作，红色的警示灯开始闪烁。广播中传来指挥中心的声音。","bg_class":"bg-fire-station"},"dialogues":[{"speaker":"广播","text":"注意！城东居民楼发生火情，疑似有人员被困。请第三小队立即出动！","emotion":"urgent"},{"speaker":"队长老刘","text":"所有人，集合！30秒内装备完毕！小张、小李，你们跟我上第一辆车！","emotion":"commanding"},{"speaker":"队员小王","text":"（边跑边穿装备）听说是一栋老居民楼，里面可能还有老人和孩子……","emotion":"worried"},{"speaker":"你（感受）","text":"你的心跳加速，手心有些出汗。这是你第一次参与这么紧急的火警。警铃还在响，时间一秒一秒地过去。","emotion":"tense"}],"choice_prompt":"警铃响起，你必须立刻行动。出发前，你会做什么？","options":[{"id":"A","text":"深呼吸让自己冷静下来，迅速检查装备是否齐全，在脑中快速回忆火场安全要点","indicators":{"emotional_management":5,"intrapersonal":4,"problem_solving":4,"critical_thinking":3}},{"id":"B","text":"一边穿装备一边听队长的指令和分工，同时关注其他队员的状态，确认团队配合","indicators":{"collaboration":5,"interpersonal":4,"communication":4,"decision_making":3}},{"id":"C","text":"快速回忆最近的消防演练内容，确认自己清楚每一步该做什么","indicators":{"logical_mathematical":4,"intrapersonal":4,"bodily_kinesthetic":3,"critical_thinking":4}},{"id":"D","text":"在出发的车上主动和队友确认：我们互相照应，一定把所有人安全带回来","indicators":{"interpersonal":5,"communication":4,"empathy":4,"emotional_management":3}}],"follow_up_config":{"mentor_name":"李导师","style":"温和引导"}},
    {"id":"firefighter_02","title":"现场救援决策","scene":{"location":"城东居民楼 · 火场外围","time":"下午 2:30","atmosphere":"浓烟从三楼和四楼的窗户里滚滚冒出。楼下已经聚集了不少居民，有人在大声呼救。消防车的警笛声、水枪的喷射声、人们的呼喊声混成一片。","bg_class":"bg-fire-scene"},"dialogues":[{"speaker":"队长老刘","text":"情况比想象中严重！三楼有明火，四楼以上有居民被困！我们需要分两组行动！","emotion":"urgent"},{"speaker":"居民大妈","text":"（哭着跑过来）消防员同志！四楼有个坐轮椅的老太太！她一个人在家，求求你们……","emotion":"panic"},{"speaker":"队员小李","text":"队长，三楼火势太大，直接上去太危险了！要不要先控制火势再说？","emotion":"concerned"},{"speaker":"你（观察）","text":"你环顾四周：火势在蔓延，时间紧迫。三楼有明火，四楼有被困人员。每多等一秒，危险就多一分。但贸然行动也可能让队员受伤。","emotion":"observe"}],"choice_prompt":"你是救援小组的一员。面对这个两难局面，你会怎么做？","options":[{"id":"A","text":"建议队长：一组用水枪压制三楼火势，另一组从侧面的消防通道上四楼救人","indicators":{"problem_solving":5,"decision_making":5,"spatial":4,"collaboration":4}},{"id":"B","text":"主动请缨：队长，我对这个区域比较熟悉，让我带一个人从楼梯上四楼，优先救那个坐轮椅的老人","indicators":{"decision_making":4,"bodily_kinesthetic":4,"interpersonal":3}},{"id":"C","text":"先安抚楼下的大妈，问清楚四楼的具体位置和老人的情况，为救援提供准确信息","indicators":{"communication":5,"empathy":4,"critical_thinking":4,"problem_solving":3}},{"id":"D","text":"和队友一起评估：火势蔓延速度、逃生通道状况、需要的装备，用冷静的分析帮助队长做决策","indicators":{"critical_thinking":5,"logical_mathematical":4,"collaboration":4,"spatial":4}}],"follow_up_config":{"mentor_name":"李导师","style":"温和引导"}},
    {"id":"firefighter_03","title":"安慰受灾群众","scene":{"location":"居民楼 · 安全区域","time":"下午 3:00","atmosphere":"火势已经得到控制，被困的居民也成功救出。但安全区域里，几位居民还处于惊魂未定的状态，有人在小声哭泣，有人在焦急地找家人。","bg_class":"bg-fire-aftermath"},"dialogues":[{"speaker":"你（观察）","text":"你看到那位坐轮椅的老太太被安全地送到了楼下，但她脸色苍白，身体在微微发抖。旁边一个七八岁的小女孩在人群中哭着找妈妈。","emotion":"observe"},{"speaker":"轮椅老太太","text":"（声音颤抖）谢谢……谢谢你们……我刚才以为自己出不来了……我女儿还不知道这里着火了……","emotion":"shaken"},{"speaker":"小女孩","text":"（哭着）妈妈！我要妈妈！妈妈刚才还在家里的……","emotion":"crying"},{"speaker":"队员小李","text":"（小声对你说）队长让我去汇报情况，这边你能不能帮忙安抚一下群众？特别是那个小孩和老人。","emotion":"requesting"}],"choice_prompt":"救援成功了，但受灾群众需要安抚。你会怎么帮助他们？","options":[{"id":"A","text":"先蹲到小女孩面前，用最温柔的声音告诉她消防员叔叔正在帮你找妈妈，你安全了，然后请一位女队员陪着她","indicators":{"empathy":5,"emotional_management":5,"interpersonal":5,"communication":4}},{"id":"B","text":"先到老太太身边，帮她联系女儿，同时关注她的身体状况，确保她没有吸入浓烟的不适","indicators":{"problem_solving":4,"empathy":4,"bodily_kinesthetic":3,"communication":4}},{"id":"C","text":"把大家召集在一起，用清晰响亮的声音告诉所有人：火已经扑灭了，请大家配合登记，我们会帮大家联系家人","indicators":{"communication":5,"interpersonal":4,"decision_making":4,"linguistic":4}},{"id":"D","text":"分工合作：让其他队员帮老太太联系家人，你自己去陪小女孩，用聊天和讲故事分散她的注意力","indicators":{"collaboration":5,"creativity":4,"empathy":5,"problem_solving":4}}],"follow_up_config":{"mentor_name":"李导师","style":"温和引导"}},
    {"id":"firefighter_04","title":"社区隐患排查","scene":{"location":"社区活动中心","time":"第二天 上午 9:00","atmosphere":"火情处理完毕后，消防队决定在社区开展一次安全隐患排查和消防知识宣传活动。你和几位队员来到社区活动中心，准备给居民们做一场消防安全的互动讲座。","bg_class":"bg-community-center"},"dialogues":[{"speaker":"社区主任","text":"消防员同志们，太感谢你们了！昨天多亏了你们……今天我们的居民都来了，大家都很想学学消防知识。","emotion":"grateful"},{"speaker":"你（观察）","text":"你看到台下坐着各种各样的居民——有带着孩子的年轻父母，有头发花白的老人，还有一些昨天经历了火灾的居民。大家的表情既认真又有些紧张。","emotion":"observe"},{"speaker":"一位大爷","text":"小伙子，我家的灭火器放了五年了，还能用吗？我们都不知道怎么检查……","emotion":"curious"},{"speaker":"小朋友","text":"（举手）消防员叔叔！如果家里着火了，是不是应该躲到床底下？","emotion":"innocent"}],"choice_prompt":"你要给居民做一次消防安全宣讲，你会怎么设计这个活动？","options":[{"id":"A","text":"用有趣的互动游戏教大家消防知识：让小朋友模拟拨打119，让老人练习使用灭火器模型","indicators":{"creativity":5,"bodily_kinesthetic":4,"communication":5,"interpersonal":4}},{"id":"B","text":"结合昨天的真实火灾案例，认真讲解常见的家庭隐患和逃生方法，让大家引以为戒","indicators":{"linguistic":4,"critical_thinking":4,"communication":4,"logical_mathematical":3}},{"id":"C","text":"先回答大家的问题，再带大家实地走访社区，指出楼道堆放杂物、电线老化等实际隐患","indicators":{"problem_solving":5,"naturalistic":4,"spatial":3,"critical_thinking":4}},{"id":"D","text":"邀请经历过昨天火灾的居民分享感受，让大家更深刻地理解消防安全的重要性","indicators":{"interpersonal":5,"empathy":4,"linguistic":4,"emotional_management":3}}],"follow_up_config":{"mentor_name":"李导师","style":"温和引导"}}
]

# ---- TEACHER ----
SCENARIOS["teacher"] = [
    {"id":"teacher_01","title":"趣味课堂管理","scene":{"location":"阳光小学 · 三年级教室","time":"上午 8:30","atmosphere":"晨读时间刚结束，你走进教室。三十双亮晶晶的眼睛看着你。但后排两个男生正在传纸条，前排一个女生举着手似乎有问题，还有人在偷偷吃零食。","bg_class":"bg-classroom"},"dialogues":[{"speaker":"学生们","text":"（闹哄哄的）老师好——！今天学什么呀？","emotion":"mixed"},{"speaker":"小明（后排）","text":"（小声对同桌）哎，你看我昨天画的恐龙！超级厉害！","emotion":"excited"},{"speaker":"小红（前排）","text":"（高高举手）老师老师！我的作业本不见了！不知道谁拿走了！","emotion":"anxious"},{"speaker":"你（观察）","text":"你扫视了一圈教室：有孩子注意力分散，有孩子遇到了小麻烦，但大多数孩子还是期待着今天的课。你需要快速让课堂进入状态。","emotion":"observe"}],"choice_prompt":"上课铃响了，但教室里还有些混乱。作为老师，你会怎么做？","options":[{"id":"A","text":"不急着上课，先微笑着说老师看到小明的恐龙画得很棒，等下课给大家展示好不好？现在我们先进入今天的奇妙冒险！","indicators":{"creativity":5,"interpersonal":5,"communication":4,"linguistic":4}},{"id":"B","text":"用一个有趣的谜语或小游戏开始课堂，自然地吸引所有人的注意力","indicators":{"creativity":5,"communication":4,"bodily_kinesthetic":3,"interpersonal":3}},{"id":"C","text":"先帮小红找到作业本，再温和地提醒传纸条的同学注意听讲，然后开始上课","indicators":{"problem_solving":4,"empathy":4,"interpersonal":3,"decision_making":3}},{"id":"D","text":"站在讲台上用清晰响亮的声音说上课！用眼神和每位同学交流，等待大家安静下来","indicators":{"emotional_management":4,"intrapersonal":4,"communication":4,"linguistic":3}}],"follow_up_config":{"mentor_name":"李导师","style":"温和引导"}},
    {"id":"teacher_02","title":"帮助学习困难的学生","scene":{"location":"阳光小学 · 教室角落","time":"上午 10:00","atmosphere":"数学课上，你布置了一道应用题。大部分同学都开始动笔了，但你注意到角落里的朵朵盯着作业本发呆，笔在手里转来转去，一个字也没写。","bg_class":"bg-classroom"},"dialogues":[{"speaker":"你（观察）","text":"朵朵平时是个安静的女孩，不太主动说话。你注意到她的作业本前面几页的题目也错了不少，但她从来没举手问过问题。","emotion":"observe"},{"speaker":"同桌小刚","text":"（小声嘀咕）朵朵你怎么还不写啊？这么简单的题都不会？","emotion":"impatient"},{"speaker":"朵朵","text":"（低着头，声音几乎听不见）我……我看不太懂题目……","emotion":"embarrassed"},{"speaker":"你（思考）","text":"你知道如果直接在全班面前指出朵朵不会做，可能会让她更难过。但如果不帮她，她可能会越来越跟不上。你需要想一个既能帮助她，又不伤害她自尊心的办法。","emotion":"think"}],"choice_prompt":"朵朵需要帮助，但你不想让她在全班面前难堪。你会怎么做？","options":[{"id":"A","text":"走到朵朵身边，蹲下来小声问这道题哪里不太明白，老师用另一种方法讲给你听，用只有她能听到的声音温柔地讲解","indicators":{"empathy":5,"communication":5,"emotional_management":4,"interpersonal":5}},{"id":"B","text":"把题目换成朵朵喜欢的情境重新表述，比如朵朵喜欢画画，如果小明有12支彩笔……让题目和她产生关联","indicators":{"creativity":5,"empathy":4,"linguistic":4,"problem_solving":4}},{"id":"C","text":"安排一位有耐心的同学当小老师课后帮助朵朵，同时单独找时间了解朵朵的学习难点在哪里","indicators":{"collaboration":5,"problem_solving":4,"interpersonal":4,"intrapersonal":3}},{"id":"D","text":"在班上宣布这道题有多种解法，每个人可以选择自己最有把握的方法来做，降低题目的压力和比较感","indicators":{"creativity":4,"communication":4,"decision_making":4,"interpersonal":3}}],"follow_up_config":{"mentor_name":"李导师","style":"温和引导"}},
    {"id":"teacher_03","title":"处理同学之间的矛盾","scene":{"location":"阳光小学 · 操场边","time":"下午 2:30","atmosphere":"体育课自由活动时，两个男生因为抢篮球吵起来了。小杰说小豪推了他，小豪说小杰先骂人。周围围了一圈看热闹的同学，还有人起哄。","bg_class":"bg-playground"},"dialogues":[{"speaker":"小杰","text":"（脸红脖子粗）是他先推我的！我好好在打球，他上来就抢！","emotion":"angry"},{"speaker":"小豪","text":"（也不甘示弱）你胡说！明明是你先骂我笨蛋！你才推了我！","emotion":"angry"},{"speaker":"围观同学","text":"（起哄）打起来了打起来了！老师来了！","emotion":"excited"},{"speaker":"体育老师","text":"（对你招手）你是他们班主任吧？这两个孩子我劝不住，你来处理一下？","emotion":"helpless"}],"choice_prompt":"两个孩子都很激动，周围还有起哄的同学。你会怎么处理这个矛盾？","options":[{"id":"A","text":"先把两个男孩带到安静的角落，让他们各自冷静一分钟，然后轮流听他们说出自己的感受和看法","indicators":{"emotional_management":5,"interpersonal":5,"communication":5,"intrapersonal":4}},{"id":"B","text":"让围观的同学先散开，然后对两个男孩说我相信你们都是好孩子，我们一起把事情的经过理清楚","indicators":{"interpersonal":4,"communication":4,"decision_making":4,"empathy":3}},{"id":"C","text":"不追究谁对谁错，而是问他们：你们本来是朋友对吧？一起打球比吵架有意思多了，想个办法和好吧？","indicators":{"problem_solving":5,"empathy":4,"interpersonal":5,"creativity":3}},{"id":"D","text":"分别和他们单独谈话，了解事情全貌后，再把他们叫到一起，帮助他们互相理解和道歉","indicators":{"critical_thinking":4,"empathy":5,"intrapersonal":4,"communication":4}}],"follow_up_config":{"mentor_name":"李导师","style":"温和引导"}},
    {"id":"teacher_04","title":"设计班级特色活动","scene":{"location":"阳光小学 · 教师办公室","time":"下午 4:00","atmosphere":"放学后的办公室，你和其他几位老师正在讨论下周的班级展示活动。每个班要出一个节目或展示，主题是「我们的班级，我们的骄傲」。","bg_class":"bg-office"},"dialogues":[{"speaker":"同事王老师","text":"我们班打算排练一个合唱，比较简单。你们班呢？你们班孩子那么活泼，肯定得好好准备吧！","emotion":"curious"},{"speaker":"你（思考）","text":"你想起你们班：小明画画特别棒，朵朵虽然学习慢但唱歌很好听，小杰和小豪刚和好需要更多合作机会……每个孩子都有自己的闪光点。","emotion":"think"},{"speaker":"同事王老师","text":"不过你们班有几个孩子挺调皮的，排练起来会不会很费劲啊？","emotion":"doubtful"},{"speaker":"你（决心）","text":"你决心要让每个孩子都能在活动中找到自己的位置，让这个展示真正成为「我们班的骄傲」。","emotion":"determined"}],"choice_prompt":"你要为班级设计一个让每个孩子都能参与和发光的展示活动。你会怎么做？","options":[{"id":"A","text":"设计一个综合表演：有人唱歌（朵朵），有人画背景（小明），有人编故事——让每个孩子发挥自己最擅长的事","indicators":{"creativity":5,"interpersonal":5,"collaboration":5,"naturalistic":2}},{"id":"B","text":"开一个班会，让孩子们一起头脑风暴，投票选出他们最想做的活动——老师只负责协助和提供资源","indicators":{"interpersonal":5,"communication":5,"collaboration":4,"decision_making":4}},{"id":"C","text":"以「我们的故事」为主题，让每个孩子准备一件自己最骄傲的事来分享，汇集成一本班级故事集","indicators":{"creativity":4,"linguistic":4,"empathy":4,"intrapersonal":5}},{"id":"D","text":"结合学科知识设计一个趣味知识竞赛，分组合作，让学习好的和需要帮助的孩子搭档互助","indicators":{"collaboration":5,"logical_mathematical":4,"problem_solving":4,"communication":3}}],"follow_up_config":{"mentor_name":"李导师","style":"温和引导"}}
]

# ---- CHEF ----
SCENARIOS["chef"] = [
    {"id":"chef_01","title":"设计今日特色菜单","scene":{"location":"幸福小馆 · 厨房","time":"上午 7:30","atmosphere":"清晨的阳光照进干净整洁的厨房。今天是周三，你需要设计今天的特色午餐。冰箱里有新鲜的蔬菜和肉类，黑板上写着：今日推荐——等你来决定！","bg_class":"bg-kitchen"},"dialogues":[{"speaker":"助手小周","text":"主厨早！今天的食材都到了——有新鲜的番茄、鸡蛋、青椒、鸡胸肉，还有一些刚送来的豆腐。今天做什么特色菜呢？","emotion":"cheerful"},{"speaker":"你（思考）","text":"你看了看食材清单，又想起来最近常来的老顾客张奶奶说最近牙口不太好，想吃软一点的东西。还有隔壁写字楼的几个年轻人总说要低脂健康的。","emotion":"think"},{"speaker":"助手小周","text":"对了，昨天有个客人问有没有素食选择……我们菜单上好像一直缺这一块。","emotion":"reminding"}],"choice_prompt":"你需要设计今天的特色午餐菜单。你会怎么规划？","options":[{"id":"A","text":"设计一个老少皆宜的套餐：软嫩的番茄炒蛋配豆腐（适合老人）+ 低脂鸡胸沙拉（适合年轻人）+ 单独的素食选项","indicators":{"creativity":5,"empathy":5,"problem_solving":5,"naturalistic":3}},{"id":"B","text":"主打一个暖心的家常味道主题：红烧豆腐、番茄炒蛋、青椒肉丝——都是大家熟悉又喜欢的家常菜","indicators":{"interpersonal":4,"creativity":3,"communication":3,"empathy":4}},{"id":"C","text":"和助手一起讨论：列出所有食材，用投票的方式决定今天的三道主菜，确保营养均衡","indicators":{"collaboration":5,"logical_mathematical":3,"communication":4,"decision_making":4}},{"id":"D","text":"根据食材新鲜度和季节特点，设计一套时令鲜味菜单——把当季最好的食材用最简单的方式呈现","indicators":{"naturalistic":5,"creativity":4,"problem_solving":3,"bodily_kinesthetic":3}}],"follow_up_config":{"mentor_name":"李导师","style":"温和引导"}},
    {"id":"chef_02","title":"厨房突发状况","scene":{"location":"幸福小馆 · 厨房","time":"中午 12:15","atmosphere":"午餐高峰期！餐厅坐满了客人，订单一张接一张地传来。突然，助手小周慌张地跑过来说——主灶台的煤气出了问题，火候控制不了了！","bg_class":"bg-kitchen-busy"},"dialogues":[{"speaker":"助手小周","text":"主厨不好了！一号灶台火忽大忽小，根本做不了菜！还有五桌客人等着上菜呢！","emotion":"panic"},{"speaker":"服务员阿芳","text":"（探头进厨房）3号桌的客人已经催了两次了！他们说再不上菜就要走了！","emotion":"anxious"},{"speaker":"你（观察）","text":"厨房里一片忙碌：五个订单等着出菜，但主力灶台出故障了。你迅速扫视了一圈——还有两个小灶台可以用，微波炉和烤箱也是好的。冰箱里有之前准备好的凉菜。","emotion":"observe"},{"speaker":"助手小周","text":"要不要跟客人解释一下，让他们再等等？或者……把能做的先做了？","emotion":"flustered"}],"choice_prompt":"厨房出了状况，客人在催菜。你该怎么办？","options":[{"id":"A","text":"迅速调整：用两个小灶台分工合作（一个炒菜一个煮汤），同时把准备好的凉菜先上，稳定客人情绪","indicators":{"problem_solving":5,"decision_making":5,"collaboration":4,"emotional_management":4}},{"id":"B","text":"亲自出去跟客人诚恳道歉，说明情况并赠送小菜，同时让助手用还能用的灶台先做简单的菜","indicators":{"communication":5,"interpersonal":5,"empathy":4,"emotional_management":4}},{"id":"C","text":"重新规划出菜顺序：用烤箱做烤菜、微波炉加热备用的汤、小灶台做快炒——最大化利用可用设备","indicators":{"logical_mathematical":5,"critical_thinking":5,"spatial":4,"problem_solving":5}},{"id":"D","text":"一边安抚团队说别慌我们能搞定，一边快速分配任务：谁负责什么设备、谁去跟客人沟通","indicators":{"collaboration":5,"emotional_management":5,"interpersonal":4,"decision_making":4}}],"follow_up_config":{"mentor_name":"李导师","style":"温和引导"}},
    {"id":"chef_03","title":"满足特殊饮食需求","scene":{"location":"幸福小馆 · 用餐区","time":"下午 1:00","atmosphere":"午餐高峰期刚过，一位妈妈带着她的孩子走进餐厅。妈妈很礼貌地问服务员——她的孩子对花生和鸡蛋过敏，问哪些菜可以吃。她看起来已经习惯了小心翼翼地询问。","bg_class":"bg-restaurant"},"dialogues":[{"speaker":"妈妈","text":"你好，请问你们的菜里哪些不含花生和鸡蛋？我孩子过敏比较严重，所以需要特别注意……","emotion":"careful"},{"speaker":"小朋友","text":"（小声嘀咕）妈妈，我是不是又不能吃好吃的了……每次出去吃饭都要问好久……","emotion":"disappointed"},{"speaker":"服务员阿芳","text":"（有些为难）这个……我也不太确定每道菜的具体配料，我去问问主厨吧。","emotion":"uncertain"},{"speaker":"你（听到对话）","text":"你听到了这段对话，看到小朋友失落的表情。你想起今天的好几道菜都用了鸡蛋，但也有不少食材是安全的。作为主厨，你想让这个小朋友也能开心地享用一顿美味的午餐。","emotion":"thoughtful"}],"choice_prompt":"你注意到这位过敏的小朋友很失落。作为主厨，你会怎么做？","options":[{"id":"A","text":"亲自走到餐桌旁，蹲下跟小朋友说：叔叔/阿姨可以专门为你做一道没有花生和鸡蛋的特别菜哦，你喜欢吃什么？","indicators":{"empathy":5,"communication":5,"interpersonal":5,"creativity":4}},{"id":"B","text":"仔细检查厨房所有调料和食材，确认安全的选项，然后给妈妈一份详细的安全菜单让她放心","indicators":{"problem_solving":5,"critical_thinking":5,"empathy":4,"logical_mathematical":4}},{"id":"C","text":"用厨房里安全的食材（豆腐、青菜、米饭等）创意搭配，做一道既好吃又好看的专属儿童套餐","indicators":{"creativity":5,"empathy":4,"bodily_kinesthetic":4,"problem_solving":4}},{"id":"D","text":"除了做菜，还在菜单上增加过敏原标注，让以后来的客人也能一目了然地选择适合自己的菜","indicators":{"decision_making":4,"problem_solving":5,"empathy":4,"critical_thinking":4}}],"follow_up_config":{"mentor_name":"李导师","style":"温和引导"}},
    {"id":"chef_04","title":"团队配合出餐高峰","scene":{"location":"幸福小馆 · 厨房","time":"晚上 7:00","atmosphere":"晚餐高峰期！今晚餐厅座无虚席，还有三个外卖订单等着出餐。每个人的手都在飞快地忙碌着。灶台的火光映在每个人的脸上，厨房里热气腾腾。","bg_class":"bg-kitchen-busy"},"dialogues":[{"speaker":"助手小周","text":"主厨！2号桌的糖醋里脊，5号桌的清蒸鱼，还有外卖订单号37的番茄炒蛋——五分钟后要一起出！","emotion":"urgent"},{"speaker":"助手小刘","text":"蒸箱里还有两分钟，烤炉里的鸡翅也快好了。但炒锅只有一个，得先炒哪个？","emotion":"focused"},{"speaker":"服务员阿芳","text":"（冲进来）8号桌客人说他们的菜等了太久了！情绪有点不好……","emotion":"anxious"},{"speaker":"你（指挥）","text":"你站在厨房中心，看着忙成一团的团队。几个订单时间重叠，资源有限，但你必须让一切有条不紊地运转。","emotion":"determined"}],"choice_prompt":"出餐高峰，订单堆积，客人不满。你如何带领团队渡过难关？","options":[{"id":"A","text":"快速排出优先级：先出最快的菜（蒸的、烤的已快完成），安抚客人情绪，再集中力量做需要现炒的菜","indicators":{"decision_making":5,"logical_mathematical":5,"problem_solving":5,"collaboration":3}},{"id":"B","text":"重新分工：小周负责蒸烤、小刘负责备料、你专注炒锅，同时让阿芳给等太久的客人送去免费饮品表达歉意","indicators":{"collaboration":5,"interpersonal":5,"problem_solving":4,"communication":4}},{"id":"C","text":"大声报出每个步骤的时间节点让团队保持同步：蒸箱还有一分钟！小周备料！我来炒！——用清晰的口令带动节奏","indicators":{"communication":5,"bodily_kinesthetic":4,"collaboration":4,"decision_making":4}},{"id":"D","text":"在保证质量的前提下，建议相似菜品合并制作（两个番茄炒蛋一起炒），节省时间和精力","indicators":{"creativity":4,"logical_mathematical":5,"problem_solving":5,"critical_thinking":4}}],"follow_up_config":{"mentor_name":"李导师","style":"温和引导"}}
]

# ---- JOURNALIST ----
SCENARIOS["journalist"] = [
    {"id":"journalist_01","title":"发现新闻线索","scene":{"location":"城市日报社 · 编辑部","time":"上午 9:00","atmosphere":"早上的编辑部，记者们都在电脑前忙碌。今天的选题会上，主编希望大家提出有趣的新闻线索。窗外是喧闹的城市，窗内是键盘敲击的声音。","bg_class":"bg-newsroom"},"dialogues":[{"speaker":"主编老陈","text":"好了，今天的选题会开始。这一周社区新闻版块还缺一条有意思的报道，大家有什么想法吗？","emotion":"professional"},{"speaker":"同事小王","text":"最近真没什么大新闻……要不还是报那条社区花园改造吧，虽然已经写过两次了。","emotion":"bored"},{"speaker":"你（观察）","text":"你忽然想起昨天路过老街的时候，看到一群孩子围在一个修鞋摊旁边。那个修鞋的老爷爷一边修鞋一边给孩子们讲故事，画面特别温馨。这算新闻吗？","emotion":"think"},{"speaker":"主编老陈","text":"小记者，你是新来的，有什么想法也可以说说看。新闻不一定都是大事，有时候小故事更能打动人。","emotion":"encouraging"}],"choice_prompt":"编辑部的选题会需要新闻线索。你会提出什么？","options":[{"id":"A","text":"勇敢说出你看到的修鞋老爷爷的故事：我觉得那个一边修鞋一边讲故事的老爷爷，背后一定有值得记录的东西","indicators":{"naturalistic":5,"linguistic":4,"creativity":4,"interpersonal":3}},{"id":"B","text":"提议去社区走访一圈，和居民聊聊天，从他们的日常生活中发现有价值的新闻线索","indicators":{"interpersonal":5,"naturalistic":5,"communication":4,"empathy":3}},{"id":"C","text":"翻看最近一周的社区公告和读者来信，从细节中寻找被大家忽略的有趣话题","indicators":{"critical_thinking":5,"logical_mathematical":4,"linguistic":3,"intrapersonal":3}},{"id":"D","text":"虚心请教老记者们：各位前辈觉得什么样的故事最值得报道？我也想学习如何发现好新闻","indicators":{"interpersonal":4,"communication":4,"intrapersonal":4,"collaboration":3}}],"follow_up_config":{"mentor_name":"李导师","style":"温和引导"}},
    {"id":"journalist_02","title":"采访社区人物","scene":{"location":"老街 · 修鞋摊","time":"上午 10:30","atmosphere":"你找到了昨天看到的那个修鞋摊。老爷爷正在专心地补一只皮鞋，旁边的矮凳上坐着一个小男孩，托着下巴认真听故事。阳光透过梧桐树叶洒在小小的摊位前。","bg_class":"bg-street"},"dialogues":[{"speaker":"修鞋老爷爷","text":"（抬头看到你拿着笔记本）哟，又是来修鞋的吗？还是……来听故事的？","emotion":"friendly"},{"speaker":"你","text":"爷爷您好！我是报社的记者。昨天看到您边修鞋边给孩子们讲故事，我觉得特别有趣。可以跟您聊聊吗？","emotion":"polite"},{"speaker":"修鞋老爷爷","text":"（笑着摆摆手）我一个修鞋的有什么好采访的？不过你要是想听故事，我这里倒是有一箩筐——这条街上的故事，我修了四十年鞋，听了四十年。","emotion":"warm"},{"speaker":"小男孩","text":"（兴奋地插话）爷爷刚才在讲这条街以前的样子！以前这里有一条小河！真的吗？","emotion":"curious"}],"choice_prompt":"老爷爷很健谈，也有很多故事。作为记者，你怎么做这次采访？","options":[{"id":"A","text":"不急着提问，先坐下来听他随意聊。从他的故事中自然地抓住有趣的细节，再深入追问","indicators":{"interpersonal":5,"naturalistic":5,"empathy":4,"linguistic":3}},{"id":"B","text":"提前想好几个开放式的问题：您在这条街最难忘的事是什么？现在的孩子和以前有什么不同？","indicators":{"communication":5,"linguistic":4,"critical_thinking":4,"intrapersonal":3}},{"id":"C","text":"同时观察周围环境：老爷爷的工具箱、墙上的老照片、来往的街坊——用细节让报道更生动","indicators":{"naturalistic":5,"creativity":4,"spatial":3,"linguistic":4}},{"id":"D","text":"也采访旁边的小朋友和路过的街坊，从不同角度了解老爷爷在大家心中的形象","indicators":{"interpersonal":5,"critical_thinking":5,"communication":4,"collaboration":3}}],"follow_up_config":{"mentor_name":"李导师","style":"温和引导"}},
    {"id":"journalist_03","title":"核实信息来源","scene":{"location":"城市日报社 · 资料室","time":"下午 2:00","atmosphere":"采访回来后你开始整理材料。老爷爷的故事很动人，但你在查资料时发现，关于老街的历史有两种不同说法——老爷爷说他记得五十年前这里有条河，但官方档案说那条河在一百年前就改道了。","bg_class":"bg-archive"},"dialogues":[{"speaker":"你（困惑）","text":"老爷爷的记忆和档案记录不一致。他的故事很感人，但如果报道了错误的信息，就是对读者的不负责任。可是直接否定一位老人的记忆，又让人不忍心。","emotion":"conflicted"},{"speaker":"同事小王","text":"（凑过来看了看）哎呀，这种小细节没人在意的啦。老爷爷的故事那么精彩，你就按他说的写呗，读者爱看就行。","emotion":"casual"},{"speaker":"主编老陈","text":"（路过，意味深长地说）做新闻最重要的就是真字。当然，真也有很多种理解方式。","emotion":"wise"},{"speaker":"你（思考）","text":"你想起了记者的职业守则：真实是新闻的生命。但你也不想让老爷爷的故事失去温度。你需要找到一种方式，既保持真实，又不失温度。","emotion":"think"}],"choice_prompt":"你发现老爷爷的记忆和档案记录不一致。作为记者，你该怎么办？","options":[{"id":"A","text":"去图书馆和档案馆，查阅更多历史资料，同时再找几位老街的老居民印证——多方核实，给读者准确的信息","indicators":{"critical_thinking":5,"problem_solving":5,"logical_mathematical":4,"interpersonal":3}},{"id":"B","text":"在报道中如实写出两种说法：档案记载如此，而老街居民的记忆是那样——让读者了解全貌","indicators":{"linguistic":5,"critical_thinking":5,"communication":4,"creativity":3}},{"id":"C","text":"再去找老爷爷聊一次，温和地问问他关于那条河的记忆细节——也许能发现新的线索或合理的解释","indicators":{"interpersonal":4,"empathy":4,"naturalistic":4,"communication":5}},{"id":"D","text":"请教主编如何处理这种记忆与事实不符的情况，学习老记者的经验和智慧","indicators":{"intrapersonal":4,"collaboration":4,"interpersonal":4,"critical_thinking":3}}],"follow_up_config":{"mentor_name":"李导师","style":"温和引导"}},
    {"id":"journalist_04","title":"撰写公正报道","scene":{"location":"城市日报社 · 你的工位","time":"下午 4:30","atmosphere":"截稿时间快到了。你坐在电脑前，屏幕上光标一闪一闪。采访笔记、资料复印件、录音记录摊了一桌子。你需要把这些素材变成一篇既真实又有温度的报道。","bg_class":"bg-newsroom"},"dialogues":[{"speaker":"主编老陈","text":"（走到你身边）怎么样？那个修鞋老爷爷的故事写得如何了？六点之前要交稿哦。","emotion":"encouraging"},{"speaker":"你（纠结）","text":"你有很多素材：老爷爷四十年的修鞋人生、老街的变迁、孩子们围听他讲故事的温馨画面、还有那个关于小河的历史疑问……如何把这些串起来，写出一篇好报道？","emotion":"focused"},{"speaker":"主编老陈","text":"给你一个建议：好新闻不只是罗列事实。你要让读者读完以后，既了解发生了什么，也感受到为什么重要。","emotion":"wise"}],"choice_prompt":"截稿在即，你要完成这篇关于修鞋老爷爷的报道。你会如何下笔？","options":[{"id":"A","text":"以一个小场景开始：梧桐树下的修鞋摊前，老爷爷一边穿针引线，一边讲着老街的往事——用生动的画面带读者进入故事","indicators":{"linguistic":5,"creativity":5,"naturalistic":4,"communication":4}},{"id":"B","text":"以一条老街，四十年，一个人为主线，既写老爷爷的个人故事，也写老街的变化，以及那些围听故事的孩子们的感受","indicators":{"linguistic":5,"critical_thinking":4,"interpersonal":4,"creativity":5}},{"id":"C","text":"用对比的结构：老爷爷记忆中的老街 vs 档案里的老街、孩子们眼中的修鞋摊 vs 成年人眼中的修鞋摊——展现多角度的真实","indicators":{"critical_thinking":5,"creativity":5,"linguistic":4,"communication":4}},{"id":"D","text":"先请老爷爷和几位受访者看看初稿，确保报道准确地反映了他们的意思，然后再做最后的修改和提交","indicators":{"empathy":5,"communication":5,"interpersonal":5,"critical_thinking":4}}],"follow_up_config":{"mentor_name":"李导师","style":"温和引导"}}
]

# ---- ANIMAL CARETAKER ----
SCENARIOS["animal_caretaker"] = [
    {"id":"animal_01","title":"救助受伤的流浪猫","scene":{"location":"阳光动物救助站 · 门口","time":"上午 8:00","atmosphere":"早晨的救助站安静祥和。你刚打开大门，就听到不远处的灌木丛里传来微弱的猫叫声。循声找去，你发现一只橘色的小猫蜷缩在草丛里，后腿似乎受伤了。","bg_class":"bg-shelter"},"dialogues":[{"speaker":"你（观察）","text":"你蹲下来仔细观察：小猫大概三四个月大，右后腿有一道伤口，毛上沾着泥土。它用警惕又害怕的眼神看着你，身体缩成一团。但你伸手靠近时，它也没有逃跑。","emotion":"observe"},{"speaker":"小猫","text":"（微弱地）喵……","emotion":"hurt"},{"speaker":"路过的大妈","text":"哎哟，又一只流浪猫。估计是被电动车蹭到了。这种小野猫身上都是细菌，你可别碰啊！","emotion":"concerned"},{"speaker":"救助站同事小陈","text":"（闻声出来）怎么了？咦，这只小猫看起来伤得不轻。我们需要马上处理伤口。","emotion":"urgent"}],"choice_prompt":"你发现一只受伤的流浪猫。作为动物保护员，你首先会怎么做？","options":[{"id":"A","text":"慢慢蹲下，用最轻柔的声音安抚小猫，等它不那么害怕了，再轻轻地用毛巾裹住它抱起来","indicators":{"empathy":5,"naturalistic":5,"emotional_management":4,"bodily_kinesthetic":3}},{"id":"B","text":"迅速回站里拿急救箱和手套，同时让同事准备检查室——在确保安全的前提下尽快处理伤口","indicators":{"problem_solving":5,"decision_making":4,"collaboration":4,"critical_thinking":3}},{"id":"C","text":"先观察小猫的精神状态和伤口情况，评估严重程度，再决定是自己处理还是需要联系兽医","indicators":{"naturalistic":5,"critical_thinking":5,"logical_mathematical":3,"intrapersonal":3}},{"id":"D","text":"温和地告诉路过的大妈：谢谢您的关心。流浪动物也需要我们的帮助，我们会做好防护的。然后专心救助小猫","indicators":{"communication":4,"interpersonal":4,"empathy":4,"emotional_management":3}}],"follow_up_config":{"mentor_name":"李导师","style":"温和引导"}},
    {"id":"animal_02","title":"观察动物异常行为","scene":{"location":"阳光动物救助站 · 猫舍","time":"上午 10:00","atmosphere":"处理完小猫的伤口后，你开始每天的例行检查。走到猫舍时，你注意到一只平时很活泼的黑猫墨墨今天不太对劲——它缩在角落里，不吃东西，连最喜欢的玩具球也不理了。","bg_class":"bg-shelter-cat"},"dialogues":[{"speaker":"你（观察）","text":"墨墨的表现很不寻常。你记得昨天它还活蹦乱跳的，吃饭也很正常。今天它缩成一团，眼神无精打采，碗里的猫粮一口没动。","emotion":"observe"},{"speaker":"同事小陈","text":"会不会是心情不好？猫有时候就是会莫名其妙不开心。过两天自己就好了。","emotion":"casual"},{"speaker":"你（思考）","text":"你回想起之前在动物行为学的书上看过：猫很会隐藏自己的不适。当它们表现出明显异常时，可能已经难受了一段时间了。但不能确定是身体不适还是心理压力。","emotion":"think"},{"speaker":"志愿者小美","text":"对了，昨天下午有一群小朋友来参观，他们在猫舍这边声音有点大。墨墨会不会是被吓到了？","emotion":"helpful"}],"choice_prompt":"墨墨行为异常，你需要判断是什么原因。作为动物保护员，你会怎么处理？","options":[{"id":"A","text":"先仔细检查墨墨的身体——有无外伤、体温是否正常、排便情况等，排除身体疾病的可能性","indicators":{"naturalistic":5,"bodily_kinesthetic":4,"critical_thinking":4,"problem_solving":4}},{"id":"B","text":"结合多方面信息综合分析：检查身体 + 回忆最近的变化（参观、饮食、环境）+ 查看监控了解昨晚的情况","indicators":{"critical_thinking":5,"naturalistic":5,"logical_mathematical":4,"spatial":3}},{"id":"C","text":"先给墨墨一个安静舒适的环境，减少打扰，观察半天。如果没有好转再带去看兽医","indicators":{"empathy":5,"naturalistic":4,"decision_making":3,"problem_solving":3}},{"id":"D","text":"和同事一起讨论墨墨的情况：小陈认为可能是情绪问题，小美提到昨天的噪音——综合大家的观察来做出判断","indicators":{"collaboration":5,"interpersonal":4,"critical_thinking":4,"communication":4}}],"follow_up_config":{"mentor_name":"李导师","style":"温和引导"}},
    {"id":"animal_03","title":"向公众科普宣传","scene":{"location":"社区小广场","time":"下午 3:00","atmosphere":"今天是救助站的社区开放日。你负责在广场上给来往的居民科普动物保护知识。但路过的人行色匆匆，很少有人停下来。几个好奇的小朋友远远看着，不敢靠近。","bg_class":"bg-community"},"dialogues":[{"speaker":"小朋友A","text":"（拉着妈妈的手）妈妈，那里有小动物的照片！我想去看！","emotion":"excited"},{"speaker":"妈妈","text":"别去了，流浪动物不干净。而且养宠物多麻烦啊，又要喂又要铲屎的。","emotion":"dismissive"},{"speaker":"你（听到对话）","text":"你听到了这位妈妈的顾虑。你知道很多人对流浪动物有误解，但也理解做家长的担心。怎么才能让大家愿意了解动物保护呢？","emotion":"think"},{"speaker":"小朋友B","text":"（鼓起勇气走到你面前）姐姐/哥哥，这只小猫好可爱，它现在还好吗？","emotion":"curious"}],"choice_prompt":"你负责社区科普，但大家不太感兴趣。你会怎么吸引他们来了解动物保护？","options":[{"id":"A","text":"用救助站真实的变身故事——展示动物们救助前后的对比照片和温馨小故事，用真实案例打动人心","indicators":{"creativity":4,"communication":5,"empathy":4,"linguistic":4}},{"id":"B","text":"设计一个互动小游戏：让小朋友通过卡片分类学习如何正确与动物相处、遇到流浪动物怎么办等知识，答对有贴纸奖励","indicators":{"creativity":5,"bodily_kinesthetic":4,"communication":5,"interpersonal":4}},{"id":"C","text":"主动和那位妈妈聊天，理解她的顾虑，然后用科学知识温和地解释：定期驱虫的救助动物是安全的，养宠物的好处也很多","indicators":{"interpersonal":5,"communication":5,"empathy":4,"critical_thinking":3}},{"id":"D","text":"邀请大家参加一日救助站体验活动，亲自去看看动物们的日常生活——眼见为实，比任何讲解都有效","indicators":{"problem_solving":5,"creativity":4,"interpersonal":5,"communication":4}}],"follow_up_config":{"mentor_name":"李导师","style":"温和引导"}},
    {"id":"animal_04","title":"改善动物收容环境","scene":{"location":"阳光动物救助站 · 后院","time":"下午 4:30","atmosphere":"一天的忙碌接近尾声，但你发现救助站的猫舍空间有些拥挤，狗狗的活动区域也缺乏遮阳设施。夏天快到了，你担心动物们会不会太热。你有一个改善环境的想法，但预算有限。","bg_class":"bg-shelter-yard"},"dialogues":[{"speaker":"你（观察）","text":"你仔细巡视了一圈：五只猫挤在一个小房间里，狗狗的活动区没有遮阳棚，饮水器也有两个坏了。预算表上显示这个月的经费只剩不到一千元。","emotion":"observe"},{"speaker":"站长","text":"（叹了口气）我也知道条件不够好，但咱们是公益组织，经费有限。大的改造肯定做不了，只能将就一下了。","emotion":"resigned"},{"speaker":"同事小陈","text":"要不发起个网络募捐？但是之前的募捐效果都不太好……大家好像只愿意给可爱的猫狗捐款，不愿意捐基础设施。","emotion":"frustrated"},{"speaker":"志愿者小美","text":"我们能不能自己动手做点什么？比如用废旧材料搭个遮阳棚？我家里有一些不用的木板和遮阳布……","emotion":"helpful"}],"choice_prompt":"救助站条件有限、资金不足，但你想改善动物们的生活环境。你会怎么做？","options":[{"id":"A","text":"接受小美的提议：发动志愿者一起动手，用废旧材料DIY猫爬架和遮阳棚。既省钱又有爱，还能增进团队感情","indicators":{"creativity":5,"collaboration":5,"problem_solving":5,"bodily_kinesthetic":4}},{"id":"B","text":"精心制定一个改善计划：列出优先级、预算分配、材料来源——用具体的方案说服站长和可能的资助者","indicators":{"logical_mathematical":5,"critical_thinking":5,"linguistic":4,"problem_solving":4}},{"id":"C","text":"在社交媒体上发起一个动物清凉一夏的创意募捐：不只是要钱，邀请大家捐赠闲置的木板、旧床单、不用的电风扇等物品","indicators":{"creativity":5,"communication":5,"interpersonal":4,"problem_solving":4}},{"id":"D","text":"先从最紧急的问题入手：用有限的钱先修好饮水器，然后把动物的密度重新分配——有些临时寄养到志愿者家里，缓解空间压力","indicators":{"problem_solving":5,"decision_making":5,"naturalistic":4,"collaboration":4}}],"follow_up_config":{"mentor_name":"李导师","style":"温和引导"}}
]

# ---- ECD task model ---------------------------------------------------------
# 每个情境先声明“要观察的主张”和可接受的行为证据；选项指标只作为其中一类弱证据。
# 这部分不展示给学生，用于让任务设计、行为记录和报告解释保持一致。
ECD_SCENARIO_DESIGNS = {
    "doctor": [
        ("理解他人感受并建立沟通", ["empathy", "interpersonal", "communication", "emotional_management"]),
        ("在紧急信息中判断并协调行动", ["problem_solving", "decision_making", "collaboration", "critical_thinking"]),
        ("用清晰方式回应他人的担忧", ["empathy", "communication", "linguistic", "interpersonal"]),
        ("整合团队观点形成照护方案", ["collaboration", "communication", "problem_solving", "critical_thinking"]),
    ],
    "firefighter": [
        ("在压力下做好准备与自我调节", ["emotional_management", "intrapersonal", "problem_solving", "critical_thinking"]),
        ("权衡风险并提出协作性救援方案", ["problem_solving", "decision_making", "collaboration", "critical_thinking"]),
        ("识别并回应受灾者的需要", ["empathy", "communication", "interpersonal", "emotional_management"]),
        ("把安全知识转化为易理解的行动", ["creativity", "communication", "problem_solving", "critical_thinking"]),
    ],
    "teacher": [
        ("观察学生需要并营造安全课堂", ["empathy", "communication", "emotional_management", "interpersonal"]),
        ("设计能促进理解的学习活动", ["creativity", "communication", "problem_solving", "critical_thinking"]),
        ("在课堂冲突中兼顾规则与关系", ["empathy", "problem_solving", "decision_making", "communication"]),
        ("与他人合作支持学生成长", ["collaboration", "communication", "critical_thinking", "empathy"]),
    ],
    "chef": [
        ("从需求中构思可执行的菜品方案", ["creativity", "problem_solving", "decision_making", "communication"]),
        ("在限制条件下安排资源与步骤", ["logical_mathematical", "critical_thinking", "problem_solving", "decision_making"]),
        ("理解顾客需求并调整方案", ["empathy", "communication", "creativity", "problem_solving"]),
        ("在压力下协调团队完成任务", ["collaboration", "communication", "problem_solving", "decision_making"]),
    ],
    "journalist": [
        ("从日常细节中发现值得探究的问题", ["naturalistic", "creativity", "linguistic", "critical_thinking"]),
        ("通过提问与观察收集多元信息", ["communication", "interpersonal", "critical_thinking", "linguistic"]),
        ("核验信息并处理不同说法", ["critical_thinking", "problem_solving", "logical_mathematical", "communication"]),
        ("组织事实与观点，清晰而负责地表达", ["linguistic", "creativity", "critical_thinking", "communication"]),
    ],
    "animal_caretaker": [
        ("观察生命状态并兼顾安全与关怀", ["naturalistic", "empathy", "problem_solving", "critical_thinking"]),
        ("基于多条线索分析异常情况", ["naturalistic", "critical_thinking", "problem_solving", "logical_mathematical"]),
        ("理解公众顾虑并设计沟通方式", ["communication", "empathy", "creativity", "interpersonal"]),
        ("在资源限制下提出改善方案", ["creativity", "problem_solving", "collaboration", "decision_making"]),
    ],
}

for _career_id, _designs in ECD_SCENARIO_DESIGNS.items():
    for _scenario, (_claim, _dimensions) in zip(SCENARIOS[_career_id], _designs):
        _scenario["ecd"] = {
            "claim": _claim,
            "observable_dimensions": _dimensions,
            "evidence_rules": {
                "choice_weight": 1.0,
                "explanation_weight": 1.4,
                "detailed_explanation_weight": 2.0,
                "revision_weight": 1.5,
                "continued_dialogue_weight": 1.0,
            },
        }
# ---- EXTRA SCENARIOS V1：每个职业新增两段不同类型的核心体验 ----
def _extra_scenario(sid, title, location, time, atmosphere, background, dialogues, prompt, options):
    return {
        "id": sid, "title": title,
        "scene": {"location": location, "time": time, "atmosphere": atmosphere, "bg_class": background},
        "dialogues": dialogues, "choice_prompt": prompt, "options": options,
        "follow_up_config": {"mentor_name": "李导师", "style": "温和引导"},
    }

def _op(oid, text, indicators):
    return {"id": oid, "text": text, "indicators": indicators}

EXTRA_SCENARIOS_V1 = {
    "doctor": [
        _extra_scenario("doctor_05", "解释健康检查结果", "社区诊所 · 健康宣教区", "下午 3:20", "一位刚做完体检的叔叔皱着眉盯着报告单，旁边的女儿不断追问。", "bg-clinic", [
            {"speaker":"叔叔","text":"报告上有好多数字，我是不是得了很严重的病？","emotion":"worried"},
            {"speaker":"你（观察）","text":"你发现他最担心的不是某个数字，而是害怕自己听不懂、做不好。","emotion":"observe"}],
            "面对听不懂报告的居民，你会怎样帮助他理解并愿意行动？", [
            _op("A","先问他最担心哪一项，再用生活化的比喻解释，并请他复述自己理解的重点。",{"communication":5,"empathy":5,"linguistic":4,"critical_thinking":4}),
            _op("B","把所有指标按轻重缓急列出来，清楚说明哪些要复查、哪些可通过作息调整改善。",{"logical_mathematical":4,"problem_solving":4,"decision_making":4,"communication":4}),
            _op("C","先安抚他的情绪，再和他一起制定一个一周能做到的小目标，例如记录睡眠和散步。",{"empathy":5,"emotional_management":4,"problem_solving":4,"intrapersonal":3}),
            _op("D","邀请他的女儿一起听解释，请她回家后帮助记录，并约好下次复查时带着问题来。",{"collaboration":4,"communication":5,"interpersonal":4,"decision_making":3})]),
        _extra_scenario("doctor_06", "改进候诊体验", "社区诊所 · 候诊区", "下午 4:40", "放学后的候诊区有些拥挤，几位小朋友显得焦躁，护士也忙着回应家长的问题。", "bg-clinic-hall", [
            {"speaker":"护士小李","text":"大家总问还要等多久，孩子们一着急就更害怕。","emotion":"tired"},
            {"speaker":"你（思考）","text":"你想让等待时间更清楚、更安心，但诊所的人手和空间都有限。","emotion":"think"}],
            "如果请你提出一个小改进方案，你会从哪里开始？", [
            _op("A","观察一段时间，记录大家最常问的问题和最拥堵的时段，再决定先解决什么。",{"critical_thinking":5,"naturalistic":3,"problem_solving":4,"logical_mathematical":3}),
            _op("B","设计一块简单的等候提示板，标明流程、预计等待和给孩子的放松小游戏。",{"creativity":5,"communication":4,"problem_solving":4,"empathy":3}),
            _op("C","请护士、家长和小朋友各说一个不方便的地方，把意见汇总成可试行的改进清单。",{"collaboration":5,"communication":5,"empathy":4,"critical_thinking":3}),
            _op("D","先为特别焦虑的孩子安排安静角落和优先解释，再逐步调整整体流程。",{"empathy":5,"decision_making":4,"emotional_management":4,"problem_solving":3})])],
    "firefighter": [
        _extra_scenario("firefighter_05", "雨天交通事故救援", "城市高架桥 · 事故现场", "傍晚 5:10", "雨越下越大，一辆小轿车打滑撞上护栏。车内乘客没有明显受伤，却因害怕不敢下车。", "bg-fire-scene", [
            {"speaker":"队长老刘","text":"路面湿滑，后方车辆还在靠近。先保证现场安全。","emotion":"commanding"},
            {"speaker":"车内乘客","text":"我不敢开门，外面车太多了！","emotion":"panic"}],
            "现场既有道路风险也有人的恐惧，你会怎样协助救援？", [
            _op("A","先配合队友设置警戒和照明，再通过车窗清楚告诉乘客下一步怎样安全下车。",{"problem_solving":5,"communication":5,"collaboration":4,"decision_making":4}),
            _op("B","快速观察车辆位置、雨势和来车方向，把风险按优先级报告给队长。",{"critical_thinking":5,"spatial":4,"decision_making":4,"logical_mathematical":3}),
            _op("C","用平静、简短的话带乘客做深呼吸，确认他能听懂指令后再行动。",{"emotional_management":5,"communication":4,"empathy":4,"interpersonal":3}),
            _op("D","建议一名队员负责交通警示、一名队员引导乘客，自己准备必要救援工具。",{"collaboration":5,"problem_solving":4,"decision_making":4,"bodily_kinesthetic":3})]),
        _extra_scenario("firefighter_06", "复盘一次演练", "消防站 · 训练室", "第二天 上午 10:00", "一次疏散演练结束后，几位队员觉得路线安排不够顺，集合时间也比预期长。", "bg-fire-station", [
            {"speaker":"队员小王","text":"大家都很努力，可是二楼转角那里总会堵住。","emotion":"concerned"},
            {"speaker":"队长老刘","text":"复盘不是找谁的错，是为了下次更安全。","emotion":"wise"}],
            "作为参与者，你会怎样帮助团队从演练中学到东西？", [
            _op("A","按时间顺序回顾每一步，找出拥堵发生的位置、原因和可验证的改法。",{"critical_thinking":5,"problem_solving":5,"logical_mathematical":4,"communication":3}),
            _op("B","邀请不同岗位的队员说出各自看到的困难，再共同挑选一项先试改。",{"collaboration":5,"communication":5,"interpersonal":4,"decision_making":3}),
            _op("C","画出简明路线图，用颜色标出风险点和替代路线，方便大家下次记住。",{"spatial":5,"creativity":4,"communication":4,"problem_solving":3}),
            _op("D","先肯定大家做得好的地方，再提出一个具体、可执行的小调整建议。",{"emotional_management":4,"communication":4,"intrapersonal":4,"critical_thinking":3})])],
    "teacher": [
        _extra_scenario("teacher_05", "与家长沟通学习困扰", "学校 · 家长接待室", "下午 4:00", "一位家长担心孩子最近作业拖拉，语气有些着急；孩子则低着头不愿说话。", "bg-classroom", [
            {"speaker":"家长","text":"他就是不自觉，您得好好管管他！","emotion":"anxious"},
            {"speaker":"你（观察）","text":"你注意到孩子并非不在乎，而像是害怕自己做不好。","emotion":"observe"}],
            "你会怎样开展这次沟通，让孩子和家长都愿意一起想办法？", [
            _op("A","分别请家长和孩子说说最困难的时刻，先听懂双方的感受和实际情况。",{"empathy":5,"communication":5,"interpersonal":4,"critical_thinking":3}),
            _op("B","和孩子一起把大作业拆成小步骤，再请家长只关注完成过程和小进步。",{"problem_solving":5,"decision_making":4,"communication":4,"intrapersonal":3}),
            _op("C","共同约定一个一周试行计划，明确谁做什么、何时回顾、哪些地方可以调整。",{"collaboration":5,"logical_mathematical":4,"problem_solving":4,"communication":4}),
            _op("D","先肯定孩子已有的努力，再用一个他喜欢的方式帮助他记录每天的学习感受。",{"emotional_management":4,"creativity":4,"empathy":4,"communication":3})]),
        _extra_scenario("teacher_06", "调整一次课堂活动", "小学教室 · 午后", "下午 2:30", "你设计的小组讨论活动刚开始就冷场了：少数同学一直说，另一些同学没有机会开口。", "bg-classroom", [
            {"speaker":"学生小雨","text":"我有想法，可是还没说就被别人抢先了。","emotion":"sad"},
            {"speaker":"你（思考）","text":"活动目标是让每个人都能表达，不只是完成讨论。","emotion":"think"}],
            "你会怎样及时调整活动？", [
            _op("A","暂停一分钟，请大家一起说说刚才哪里不舒服，再共同定一条更公平的讨论规则。",{"communication":5,"empathy":4,"collaboration":4,"critical_thinking":3}),
            _op("B","给每人一张“发言卡”和短暂思考时间，轮流分享后再由小组整理观点。",{"creativity":5,"problem_solving":4,"decision_making":4,"communication":4}),
            _op("C","先观察各组的互动方式，记录哪些安排有效，课后据此改进下次活动。",{"critical_thinking":5,"naturalistic":3,"intrapersonal":4,"problem_solving":3}),
            _op("D","把安静同学擅长的画图、记录等角色也纳入成果展示，让更多表达方式被看见。",{"creativity":5,"empathy":4,"communication":4,"collaboration":4})])],
    "chef": [
        _extra_scenario("chef_05", "处理食材浪费问题", "餐厅厨房 · 储藏区", "上午 10:00", "你发现有些蔬菜总在当天没用完，最后只能丢弃。大家都觉得可惜，但忙起来又顾不上。", "bg-kitchen", [
            {"speaker":"帮厨小刘","text":"每天剩的都不一样，想管也不知道从哪儿开始。","emotion":"confused"},
            {"speaker":"你（观察）","text":"你意识到先弄清浪费发生在哪个环节，可能比立刻想新菜更重要。","emotion":"observe"}],
            "如果要减少浪费，你会先做什么？", [
            _op("A","连续几天记录剩余食材的种类、数量和原因，找出最常出现的问题。",{"logical_mathematical":5,"critical_thinking":5,"problem_solving":4,"intrapersonal":3}),
            _op("B","和团队一起为常见剩余食材设计几道可灵活调整的“今日小菜”。",{"creativity":5,"collaboration":4,"problem_solving":4,"communication":3}),
            _op("C","调整备料节奏，先少量准备并根据订单实时补充，同时标好先后使用顺序。",{"decision_making":5,"problem_solving":5,"logical_mathematical":4,"critical_thinking":3}),
            _op("D","请前台收集顾客对份量和菜品的反馈，判断是不是预测需求出了问题。",{"communication":4,"collaboration":4,"critical_thinking":4,"problem_solving":4})]),
        _extra_scenario("chef_06", "带新人完成一道菜", "餐厅厨房 · 备菜台", "下午 3:30", "新来的实习生第一次做招牌菜，动作很慢，调味也不敢下手。晚餐高峰快开始了。", "bg-kitchen", [
            {"speaker":"实习生","text":"我怕做坏了，大家会不会觉得我很笨？","emotion":"nervous"},
            {"speaker":"你（思考）","text":"你既要保证出品，也希望他真正学会，而不是只替他完成。","emotion":"think"}],
            "你会怎样带他完成这次任务？", [
            _op("A","先示范关键一步并说出判断依据，再让他完成下一步，你在旁边及时提醒。",{"communication":5,"collaboration":4,"problem_solving":4,"empathy":3}),
            _op("B","把菜拆成准备、火候、调味三个小目标，每完成一个就请他说说自己为什么这样做。",{"critical_thinking":5,"communication":4,"intrapersonal":4,"problem_solving":4}),
            _op("C","让他先做一份小样一起试味，根据差异调整后再做正式出品。",{"creativity":4,"critical_thinking":4,"problem_solving":5,"bodily_kinesthetic":3}),
            _op("D","先肯定他做对的地方，告诉他犯小错是学习的一部分，并安排一位同伴协助。",{"empathy":5,"emotional_management":4,"collaboration":4,"interpersonal":4})])],
    "journalist": [
        _extra_scenario("journalist_05", "面对热点传言", "城市日报社 · 新媒体组", "上午 11:00", "群聊里流传着一段“学校附近食品店不卫生”的短视频，转发量很高。主编问你要不要马上发快讯。", "bg-newsroom", [
            {"speaker":"同事小王","text":"大家都在转，先发了再说，不然流量就没了。","emotion":"urgent"},
            {"speaker":"你（思考）","text":"视频看起来很真实，但拍摄时间、地点和完整经过都还不清楚。","emotion":"think"}],
            "面对传播很快但未核实的信息，你会怎么做？", [
            _op("A","先保存原始信息，核对拍摄地点和时间，再联系相关商家、监管部门和拍摄者。",{"critical_thinking":5,"problem_solving":5,"communication":4,"logical_mathematical":3}),
            _op("B","暂不转发结论，先写一条提醒读者“信息正在核实”的说明，并解释为什么要等证据。",{"linguistic":5,"communication":5,"critical_thinking":4,"emotional_management":3}),
            _op("C","和编辑讨论需要哪些独立来源才能确认，分工去查证不同部分。",{"collaboration":5,"critical_thinking":4,"communication":4,"decision_making":3}),
            _op("D","比较视频中可见的细节与公开地图、店铺信息，列出已经确认和仍待确认的内容。",{"critical_thinking":5,"spatial":3,"logical_mathematical":4,"problem_solving":4})]),
        _extra_scenario("journalist_06", "回应报道后的意见", "城市日报社 · 编辑部", "下午 5:30", "报道发布后，有读者觉得很温暖，也有人说没有写到年轻店主的辛苦。你收到许多不同留言。", "bg-newsroom", [
            {"speaker":"主编老陈","text":"读者的意见不一定都要照做，但值得认真听。","emotion":"wise"},
            {"speaker":"你（观察）","text":"你发现有些意见是在补充新的视角，有些则是对事实的误解。","emotion":"observe"}],
            "你会怎样处理这些反馈？", [
            _op("A","先把反馈按“事实纠错、补充视角、个人感受”分类，逐条核对重要内容。",{"critical_thinking":5,"logical_mathematical":4,"problem_solving":4,"intrapersonal":3}),
            _op("B","若发现遗漏了重要视角，就补充采访相关人物，并在后续报道中说明更新原因。",{"communication":5,"empathy":4,"critical_thinking":4,"problem_solving":4}),
            _op("C","挑选有代表性的不同意见，写一段回应说明报道依据和仍可继续了解的问题。",{"linguistic":5,"communication":5,"critical_thinking":4,"creativity":3}),
            _op("D","和同事复盘选题、采访和编辑过程，找出下次能让报道更完整的做法。",{"collaboration":5,"critical_thinking":5,"problem_solving":4,"communication":3})])],
    "animal_caretaker": [
        _extra_scenario("animal_05", "为新动物寻找合适家庭", "阳光动物救助站 · 接待区", "上午 11:30", "一户人家想领养活泼的小狗，但家里已有一只年迈的猫，父母白天还要上班。", "bg-shelter", [
            {"speaker":"小朋友","text":"我保证每天都陪它玩！我最喜欢这只小狗。","emotion":"excited"},
            {"speaker":"你（观察）","text":"你既想成全他们的喜爱，也希望小狗和原来的猫都能被长期、合适地照顾。","emotion":"observe"}],
            "你会怎样帮助这家人做出负责任的领养决定？", [
            _op("A","先了解他们的作息、居住空间、原有宠物状况和全家分工，再一起评估需求。",{"critical_thinking":5,"communication":5,"naturalistic":4,"problem_solving":4}),
            _op("B","如实说明小狗的活动量和适应期，邀请他们先多次见面互动后再决定。",{"communication":5,"empathy":4,"decision_making":4,"naturalistic":3}),
            _op("C","和家人共同列一个照顾计划：喂食、遛狗、医疗和紧急情况分别由谁负责。",{"collaboration":5,"problem_solving":4,"decision_making":4,"logical_mathematical":3}),
            _op("D","若条件暂不合适，推荐他们先做短期志愿者或考虑更适合家庭节奏的动物。",{"empathy":5,"problem_solving":4,"communication":4,"decision_making":3})]),
        _extra_scenario("animal_06", "协调志愿者排班", "阳光动物救助站 · 志愿者角", "下午 5:00", "周末活动很多，但志愿者都想参加和动物互动的工作，清洁、记录和物资整理却没人报名。", "bg-shelter-yard", [
            {"speaker":"志愿者小美","text":"我也想帮忙，可是总做清洁会不会太无聊？","emotion":"hesitant"},
            {"speaker":"你（思考）","text":"每项工作都重要，怎样安排才能公平，也让大家看见不同工作的意义？","emotion":"think"}],
            "面对不均衡的志愿服务需求，你会怎么协调？", [
            _op("A","先列出每项工作的时间和必要人数，让大家看清整个救助站怎样运转。",{"communication":4,"logical_mathematical":4,"critical_thinking":4,"collaboration":3}),
            _op("B","设计轮换安排，让每个人都能参与喜欢的互动工作，也承担一部分基础任务。",{"collaboration":5,"decision_making":4,"problem_solving":4,"empathy":3}),
            _op("C","把清洁、记录与动物健康和领养成功的关系讲清楚，让大家理解这些工作的价值。",{"communication":5,"linguistic":4,"empathy":4,"critical_thinking":3}),
            _op("D","收集志愿者的特长和可用时间，尝试让擅长拍照、整理、陪伴的人承担更合适的角色。",{"interpersonal":5,"collaboration":4,"problem_solving":4,"creativity":3})])]
}

for _career_id, _scenarios in EXTRA_SCENARIOS_V1.items():
    SCENARIOS[_career_id].extend(_scenarios)
# 新增情境的 ECD 任务模型：每一项分别说明本任务应收集的行为证据。
ECD_EXTRA_SCENARIO_DESIGNS = {
    "doctor": [
        ("将健康信息转化为可理解、可行动的建议", ["communication", "empathy", "linguistic", "problem_solving"]),
        ("观察服务流程并提出可试行的改善方案", ["critical_thinking", "creativity", "collaboration", "problem_solving"]),
    ],
    "firefighter": [
        ("在动态风险中兼顾现场安全与沟通", ["problem_solving", "decision_making", "communication", "collaboration"]),
        ("基于复盘证据改进团队行动", ["critical_thinking", "problem_solving", "collaboration", "communication"]),
    ],
    "teacher": [
        ("在多方沟通中理解需求并共同制定支持计划", ["empathy", "communication", "collaboration", "problem_solving"]),
        ("根据课堂现场反馈调整活动设计", ["creativity", "critical_thinking", "communication", "problem_solving"]),
    ],
    "chef": [
        ("从日常数据中定位问题并优化资源使用", ["logical_mathematical", "critical_thinking", "problem_solving", "creativity"]),
        ("通过示范、提问和反馈支持他人学习", ["communication", "empathy", "collaboration", "problem_solving"]),
    ],
    "journalist": [
        ("在传播压力下核验信息并说明依据", ["critical_thinking", "problem_solving", "communication", "logical_mathematical"]),
        ("区分反馈类型并用反馈改进报道", ["critical_thinking", "communication", "collaboration", "empathy"]),
    ],
    "animal_caretaker": [
        ("基于动物与家庭的需要做负责任的匹配判断", ["critical_thinking", "communication", "empathy", "problem_solving"]),
        ("在不同需求之间设计公平、可持续的协作安排", ["collaboration", "communication", "problem_solving", "decision_making"]),
    ],
}

for _career_id, _designs in ECD_EXTRA_SCENARIO_DESIGNS.items():
    ECD_SCENARIO_DESIGNS[_career_id].extend(_designs)

# 扩展后重新挂载，保证六个情境都带有同一套 ECD 任务模型。
for _career_id, _designs in ECD_SCENARIO_DESIGNS.items():
    for _scenario, (_claim, _dimensions) in zip(SCENARIOS[_career_id], _designs):
        _scenario["ecd"] = {
            "claim": _claim,
            "observable_dimensions": _dimensions,
            "evidence_rules": {
                "choice_weight": 1.0,
                "explanation_weight": 1.4,
                "detailed_explanation_weight": 2.0,
                "revision_weight": 1.5,
                "continued_dialogue_weight": 1.0,
            },
        }
# 场景插画资源：后续每个情境在这里补入对应图片路径。
SCENARIO_IMAGE_MAP = {
    **{f"doctor_{i:02d}": "/static/images/scenes/doctor_01.png" for i in range(1, 7)},
    "doctor_02": "/static/images/scenes/doctor_02-v2.png",
    "doctor_03": "/static/images/scenes/doctor_03-v2.png",
    "doctor_04": "/static/images/scenes/doctor_04-v2.png",
    "doctor_05": "/static/images/scenes/doctor_05-v2.png",
    "doctor_06": "/static/images/scenes/doctor_06-v2.png",
    **{f"firefighter_{i:02d}": "/static/images/scenes/firefighter_base.png" for i in range(1, 7)},
    "firefighter_02": "/static/images/scenes/firefighter_02-v2.png",
    "firefighter_03": "/static/images/scenes/firefighter_03-v2.png",
    "firefighter_04": "/static/images/scenes/firefighter_04-v2.png",
    "firefighter_05": "/static/images/scenes/firefighter_05-v2.png",
    "firefighter_06": "/static/images/scenes/firefighter_06-v2.png",
    **{f"teacher_{i:02d}": "/static/images/scenes/teacher_base.png" for i in range(1, 7)},
    "teacher_02": "/static/images/scenes/teacher_02-v2.png",
    "teacher_03": "/static/images/scenes/teacher_03-v2.png",
    "teacher_04": "/static/images/scenes/teacher_04-v2.png",
    "teacher_05": "/static/images/scenes/teacher_05-v2.png",
    "teacher_06": "/static/images/scenes/teacher_06-v2.png",
    **{f"chef_{i:02d}": "/static/images/scenes/chef_base.png" for i in range(1, 7)},
    "chef_02": "/static/images/scenes/chef_02-v2.png",
    "chef_03": "/static/images/scenes/chef_03-v2.png",
    "chef_04": "/static/images/scenes/chef_04-v2.png",
    "chef_05": "/static/images/scenes/chef_05-v2.png",
    "chef_06": "/static/images/scenes/chef_06-v2.png",
    **{f"journalist_{i:02d}": "/static/images/scenes/journalist_base.png" for i in range(1, 7)},
    "journalist_02": "/static/images/scenes/journalist_02-v2.png",
    "journalist_03": "/static/images/scenes/journalist_03-v2.png",
    "journalist_04": "/static/images/scenes/journalist_04-v2.png",
    "journalist_05": "/static/images/scenes/journalist_05-v2.png",
    "journalist_06": "/static/images/scenes/journalist_06-v2.png",
    **{f"animal_{i:02d}": "/static/images/scenes/animal_caretaker_base.png" for i in range(1, 7)},
    "animal_02": "/static/images/scenes/animal_02-v2.png",
    "animal_03": "/static/images/scenes/animal_03-v2.png",
    "animal_04": "/static/images/scenes/animal_04-v2.png",
    "animal_05": "/static/images/scenes/animal_05-v2.png",
    "animal_06": "/static/images/scenes/animal_06-v2.png",
}
for _career_scenarios in SCENARIOS.values():
    for _scenario in _career_scenarios:
        if _scenario["id"] in SCENARIO_IMAGE_MAP:
            _scenario["scene"]["image"] = SCENARIO_IMAGE_MAP[_scenario["id"]]

# Choice consequence cards: lightweight, scenario-aware feedback for the student-facing journey.
_OUTCOME_BY_FOCUS = {
    "empathy": "\u5f53\u4e8b\u4eba\u53ef\u80fd\u66f4\u613f\u610f\u8bf4\u51fa\u81ea\u5df1\u7684\u60c5\u51b5\uff0c\u5408\u4f5c\u4e5f\u66f4\u5bb9\u6613\u5f00\u59cb\u3002\u540c\u65f6\u8fd8\u8981\u7ee7\u7eed\u786e\u8ba4\u5173\u952e\u4fe1\u606f\u3002",
    "problem_solving": "\u95ee\u9898\u53ef\u80fd\u66f4\u5feb\u5f97\u5230\u5904\u7406\uff0c\u4f46\u8fd8\u9700\u8981\u89c2\u5bdf\u65b9\u6848\u662f\u5426\u771f\u6b63\u6709\u6548\u3002",
    "critical_thinking": "\u4f60\u80fd\u5148\u8865\u9f50\u91cd\u8981\u7ebf\u7d22\uff0c\u8ba9\u540e\u9762\u7684\u5224\u65ad\u66f4\u7a33\u5982\u3002\u63a5\u4e0b\u6765\u53ef\u4ee5\u518d\u770b\u770b\u662f\u5426\u6709\u5176\u4ed6\u89c6\u89d2\u3002",
    "creativity": "\u65b0\u7684\u505a\u6cd5\u53ef\u80fd\u8ba9\u5f53\u524d\u60c5\u5883\u6709\u66f4\u591a\u89e3\u51b3\u8def\u5f84\uff0c\u4e5f\u503c\u5f97\u60f3\u60f3\u5b83\u5728\u5b9e\u9645\u6761\u4ef6\u4e0b\u600e\u6837\u843d\u5730\u3002",
    "collaboration": "\u5927\u5bb6\u7684\u5206\u5de5\u4f1a\u66f4\u6e05\u695a\uff0c\u53ef\u4ee5\u4e00\u8d77\u8ba9\u4efb\u52a1\u5f80\u524d\u8d70\u3002\u540c\u65f6\u8981\u8bb0\u5f97\u968f\u65f6\u6c9f\u901a\u65b0\u60c5\u51b5\u3002",
    "communication": "\u76f8\u5173\u7684\u4eba\u66f4\u5bb9\u6613\u542c\u61c2\u4f60\u7684\u60f3\u6cd5\uff0c\u4e5f\u66f4\u613f\u610f\u7ed9\u51fa\u53cd\u9988\u3002\u4e0b\u4e00\u6b65\u53ef\u4ee5\u6839\u636e\u53cd\u9988\u8c03\u6574\u3002",
    "decision_making": "\u56e2\u961f\u53ef\u4ee5\u66f4\u5feb\u8fdb\u5165\u884c\u52a8\uff0c\u4f46\u8fd9\u4e2a\u51b3\u5b9a\u8fd8\u9700\u6839\u636e\u540e\u7eed\u4fe1\u606f\u7075\u6d3b\u8c03\u6574\u3002",
    "emotional_management": "\u7d27\u5f20\u7684\u6c14\u6c1b\u53ef\u80fd\u4f1a\u66f4\u5bb9\u6613\u5e73\u7a33\u4e0b\u6765\uff0c\u4f60\u4e5f\u80fd\u66f4\u6e05\u695a\u5730\u7ee7\u7eed\u5224\u65ad\u3002",
    "logical_mathematical": "\u4f60\u7684\u5b89\u6392\u4f1a\u66f4\u6709\u6761\u7406\uff0c\u53ef\u4ee5\u5e2e\u52a9\u540e\u7eed\u7684\u884c\u52a8\u66f4\u6e05\u6670\u3002",
    "interpersonal": "\u4f60\u4e0e\u4ed6\u4eba\u7684\u8fde\u63a5\u53ef\u80fd\u66f4\u987a\u7545\uff0c\u4e5f\u66f4\u5bb9\u6613\u4e86\u89e3\u5bf9\u65b9\u771f\u6b63\u5173\u5fc3\u7684\u4e8b\u3002",
}
for _scenario_group in SCENARIOS.values():
    for _scenario in _scenario_group:
        for _option in _scenario.get("options", []):
            _indicators = _option.get("indicators", {}) or {}
            _focus = max(_indicators, key=_indicators.get) if _indicators else ""
            _option["possible_outcome"] = _OUTCOME_BY_FOCUS.get(_focus, "\u8fd9\u4e2a\u505a\u6cd5\u4f1a\u5e26\u6765\u65b0\u7684\u4fe1\u606f\uff0c\u4e0b\u4e00\u6b65\u53ef\u4ee5\u7ee7\u7eed\u89c2\u5bdf\u5b83\u7684\u5b9e\u9645\u5f71\u54cd\u3002")
