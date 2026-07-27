<template>
  <div class="level-three-screen game-stage flex flex-col h-full p-3 md:p-4 gap-3 overflow-auto relative">
    <!-- 🤝 和解特效 Canvas -->
    <Level3Effects :harmony="harmony" :triggerCelebration="showComplete" />
    <!-- ======== 顶部：沫沫 + 和解进度条 ======== -->
    <div class="shrink-0 flex items-center justify-between">
      <div class="flex items-center gap-2 bg-cyan-50/80 px-4 py-2 rounded-full border border-cyan-200/50">
        <MomoDolphin size="sm" :animate="false" />
        <span class="level-helper-text text-sm md:text-base" v-html="p('来调解壳壳和彩彩的矛盾吧！🤝')"></span>
      </div>
      <div class="phase-status-strip">
        <span class="phase-status-chip active">{{ phaseLabel }}</span>
        <span class="phase-status-chip">{{ phaseProgressLabel }}</span>
      </div>
    </div>

    <!-- 和解进度条（加大） -->
    <div class="shrink-0 bg-white/60 rounded-xl px-5 py-3 border border-cyan-200/30">
      <div class="flex items-center justify-between mb-1.5">
        <span class="text-base md:text-lg font-bold text-cyan-700" v-html="p('💚 和解进度')"></span>
        <span class="text-base md:text-lg" :class="harmony >= 100 ? 'text-emerald-600 font-bold' : 'text-cyan-400'">{{ harmony }}%</span>
      </div>
      <div class="w-full h-4 bg-cyan-100/60 rounded-full overflow-hidden">
        <div class="h-full rounded-full transition-all duration-700 ease-out"
             :class="harmony >= 100 ? 'bg-gradient-to-r from-emerald-400 to-green-500' : 'bg-gradient-to-r from-cyan-400 to-blue-500'"
             :style="{ width: Math.min(harmony, 100) + '%' }"></div>
      </div>
    </div>

    <!-- ============================================================ -->
    <!-- 主体区域：左右NPC面板 + 中间交互区                           -->
    <!-- ============================================================ -->
    <div class="flex-1 flex gap-3 min-h-0">

      <!-- ===== 左：壳壳面板（可滚动） ===== -->
      <div class="w-[260px] shrink-0 flex flex-col gap-2 overflow-y-auto">
        <div class="bg-white/70 rounded-2xl p-4 border-2 text-center transition-all duration-500"
             :class="kekeAnger >= 60 ? 'border-rose-300' : kekeAnger >= 30 ? 'border-orange-200' : 'border-emerald-200'">
          <CharacterImage charId="keke" size="xl" customClass="block mx-auto mb-1" />
          <div class="text-xl font-bold text-cyan-800" v-html="p('壳壳')"></div>
          <div class="text-sm text-cyan-800/80 font-medium" v-html="p('寄居蟹 · 喜静')"></div>
          <div class="mt-3 w-full h-3 bg-rose-100/60 rounded-full overflow-hidden">
            <div class="h-full rounded-full transition-all duration-700"
                 :class="kekeAnger >= 60 ? 'bg-red-400' : kekeAnger >= 30 ? 'bg-orange-400' : 'bg-emerald-400'"
                 :style="{ width: kekeAnger + '%' }"></div>
          </div>
          <span class="text-sm mt-1 font-bold" :class="kekeAnger >= 60 ? 'text-red-500' : kekeAnger >= 30 ? 'text-orange-500' : 'text-emerald-600'">
            <span v-html="p('愤怒')"></span> {{ kekeAnger }}%
          </span>
          <div class="mt-3 bg-amber-50/80 rounded-2xl px-4 py-3 text-sm md:text-base text-amber-800 text-left leading-relaxed max-h-[160px] overflow-y-auto border border-amber-200/40 relative scroll-thin">
            <button @mouseenter="playHover" @click="speak(kekeDialogue, 'keke')" class="sticky top-0 float-right text-lg hover:scale-110 transition-transform z-10">🔊</button>
            <div class="whitespace-pre-wrap break-words" v-html="p(kekeDialogue)"></div>
          </div>
        </div>
      </div>

      <!-- ===== 中间：交互区 ===== -->
      <div class="flex-1 flex flex-col gap-2 min-w-0 relative">

        <!-- --- 阶段一：情绪 + 文字证据 --- -->
        <div v-if="phase === 1 && !phase1Done" class="flex-1 min-h-0 overflow-y-auto flex flex-col items-center gap-2 py-1">
          <div class="phase-title phase-title-observe text-xl md:text-2xl" v-html="p('👀 阶段一：读懂话语里的情绪')"></div>
          <p class="phase-description" v-html="p('先判断心情，再找出让你这样判断的那句话')"></p>

          <div class="grid lg:grid-cols-2 gap-3 w-full max-w-4xl">
            <section class="character-reading-card keke-card">
              <div class="flex items-center gap-2">
                <CharacterImage charId="keke" size="lg" customClass="shrink-0" />
                <span class="text-base font-bold text-amber-800" v-html="p('壳壳说：')"></span>
                <button data-tutorial-target="keke-voice" @mouseenter="playHover" @click="playTutorialVoice('keke')" class="ml-auto voice-circle">🔊</button>
              </div>
              <p class="reading-dialogue text-amber-800" v-html="p('「我说了好几次想安静看书，她还是把音乐开得很大。算了，反正我的感受也不重要……」')"></p>
              <div class="emotion-question" v-html="p('壳壳主要是什么心情？')"></div>
              <div data-tutorial-target="keke-emotions" class="grid grid-cols-3 gap-2">
                <button v-for="opt in kekeOptions" :key="opt.id" @mouseenter="playHover" @click="selectKekeEmotion(opt)"
                        class="choice-button"
                        :class="choiceClass(kekeSelected, opt.id, kekeCorrect)">
                  {{ opt.emoji }} {{ opt.label }}
                </button>
              </div>
              <div v-if="kekeFeedback" class="answer-feedback" :class="kekeCorrect ? 'correct' : 'retry'">{{ kekeFeedback }}</div>
              <div v-if="kekeCorrect" class="evidence-box">
                <div class="evidence-title" v-html="p('🔎 哪句话最能说明这种心情？')"></div>
                <div data-tutorial-target="keke-evidence" class="space-y-1.5">
                  <button v-for="opt in kekeEvidenceOptions" :key="opt.id" @click="selectEvidence('keke', opt)"
                          class="evidence-choice"
                          :class="evidenceChoiceClass('keke', opt.id)">{{ opt.text }}</button>
                </div>
                <div v-if="kekeEvidenceFeedback" class="answer-feedback" :class="kekeEvidenceCorrect ? 'correct' : 'retry'">{{ kekeEvidenceFeedback }}</div>
              </div>
            </section>

            <section class="character-reading-card caicai-card">
              <div class="flex items-center gap-2">
                <CharacterImage charId="caicai" size="lg" customClass="shrink-0" />
                <span class="text-base font-bold text-rose-800" v-html="p('彩彩说：')"></span>
                <button data-tutorial-target="caicai-voice" @mouseenter="playHover" @click="playTutorialVoice('caicai')" class="ml-auto voice-circle">🔊</button>
              </div>
              <p class="reading-dialogue text-rose-800" v-html="p('「阳台的光线最适合练舞，可壳壳一来就叫我停下。为什么只有他的事情重要？我也很着急呀！」')"></p>
              <div class="emotion-question" v-html="p('彩彩主要是什么心情？')"></div>
              <div data-tutorial-target="caicai-emotions" class="grid grid-cols-3 gap-2">
                <button v-for="opt in caicaiOptions" :key="opt.id" @mouseenter="playHover" @click="selectCaicaiEmotion(opt)"
                        class="choice-button"
                        :class="choiceClass(caicaiSelected, opt.id, caicaiCorrect)">
                  {{ opt.emoji }} {{ opt.label }}
                </button>
              </div>
              <div v-if="caicaiFeedback" class="answer-feedback" :class="caicaiCorrect ? 'correct' : 'retry'">{{ caicaiFeedback }}</div>
              <div v-if="caicaiCorrect" class="evidence-box">
                <div class="evidence-title" v-html="p('🔎 哪句话最能说明这种心情？')"></div>
                <div data-tutorial-target="caicai-evidence" class="space-y-1.5">
                  <button v-for="opt in caicaiEvidenceOptions" :key="opt.id" @click="selectEvidence('caicai', opt)"
                          class="evidence-choice"
                          :class="evidenceChoiceClass('caicai', opt.id)">{{ opt.text }}</button>
                </div>
                <div v-if="caicaiEvidenceFeedback" class="answer-feedback" :class="caicaiEvidenceCorrect ? 'correct' : 'retry'">{{ caicaiEvidenceFeedback }}</div>
              </div>
            </section>
          </div>

          <button v-if="emotionStageComplete" data-tutorial-target="phase-two-button"
                  @mouseenter="playHover" @click="goToPhase2" class="stage-next-button">
            <span v-html="p('✅ 我读懂了！继续寻找真正需求 →')"></span>
          </button>
        </div>

        <!-- --- 阶段二：区分立场与真实需求 --- -->
        <div v-if="phase === 2 && !phase2Done" class="flex-1 min-h-0 overflow-y-auto flex flex-col items-center gap-3 py-1">
          <div class="phase-title phase-title-decide text-xl md:text-2xl" v-html="p('🧭 阶段二：找出真正需求')"></div>
          <p class="phase-description" v-html="p('“我要求怎么做”是立场，“我为什么需要”才是真正需求')"></p>

          <div data-tutorial-target="needs-classifier" class="needs-board w-full max-w-3xl">
            <div class="needs-board-head">
              <span>角色的话</span><span>你认为这是……</span>
            </div>
            <div v-for="item in needStatements" :key="item.id" class="need-row">
              <div class="need-statement">
                <CharacterImage :charId="item.owner" size="sm" customClass="shrink-0" />
                <span>{{ item.text }}</span>
              </div>
              <div class="need-actions">
                <button @click="classifyNeed(item, 'stance')" :class="needChoiceClass(item, 'stance')">📣 表面立场</button>
                <button @click="classifyNeed(item, 'need')" :class="needChoiceClass(item, 'need')">💗 真实需求</button>
              </div>
            </div>
          </div>
          <div v-if="needsFeedback" class="stage-feedback" :class="needsComplete ? 'success' : ''">{{ needsFeedback }}</div>
          <button v-if="needsComplete" data-tutorial-target="phase-three-button"
                  @mouseenter="playHover" @click="goToPhase3" class="stage-next-button">
            <span v-html="p('🌟 找到了真正需求！开始设计方案 →')"></span>
          </button>
        </div>

        <!-- --- 阶段三：组合双赢方案 --- -->
        <div v-if="phase === 3 && !phase3Done" class="flex-1 min-h-0 overflow-y-auto flex flex-col items-center gap-3 py-1">
          <div class="phase-title phase-title-plan text-xl md:text-2xl" v-html="p('🧩 阶段三：组合双赢方案')"></div>
          <p class="phase-description" v-html="p('从时间、声音和沟通三个方面各选一项，让方案具体又公平')"></p>

          <div data-tutorial-target="solution-builder" class="solution-builder w-full max-w-4xl">
            <section v-for="group in solutionGroups" :key="group.key" class="solution-group">
              <div class="solution-group-title"><span>{{ group.icon }}</span><b>{{ group.title }}</b><small>{{ group.tip }}</small></div>
              <button v-for="option in group.options" :key="option.id"
                      @click="selectSolution(group.key, option)"
                      class="solution-option"
                      :class="{ selected: solutionSelections[group.key] === option.id }">
                {{ option.text }}
              </button>
            </section>
          </div>
          <button v-if="solutionReady && !solutionAccepted" @click="evaluateSolution" class="stage-next-button secondary">
            <span v-html="p('🔍 检查我的方案')"></span>
          </button>
          <div v-if="solutionFeedback" class="solution-result" :class="solutionAccepted ? 'success' : 'retry'">
            <b>{{ solutionAccepted ? '🤝 方案可以执行！' : '🛠️ 还可以再完善' }}</b>
            <span>{{ solutionFeedback }}</span>
          </div>
          <button v-if="solutionAccepted" data-tutorial-target="phase-four-button"
                  @mouseenter="playHover" @click="goToPhase4" class="stage-next-button">
            <span v-html="p('💬 带着方案进入对话调解 →')"></span>
          </button>
        </div>

        <!-- --- 阶段四：句子积木 + 3轮智能协商 --- -->
        <div v-if="phase === 4" class="flex-1 flex flex-col min-h-0">
          <div class="flex items-center justify-between mb-1">
            <div class="phase-title phase-title-negotiate text-xl" v-html="p('💬 阶段四：协商调解')"></div>
            <div class="phase-status-strip compact">
              <span class="phase-status-chip" v-html="p('调解回合：' + Math.min(currentRound, 3) + '/3')"></span>
              <span class="phase-status-chip active text-sm font-bold" :class="harmony >= 100 ? 'text-emerald-800' : 'text-cyan-900'">
                <span v-html="p('和解')"></span> {{ harmony }}%
              </span>
            </div>
          </div>

          <div data-tutorial-target="sentence-blocks" class="sentence-builder">
            <span class="sentence-builder-label" v-html="p('句子积木：')"></span>
            <button v-for="block in sentenceBlocks" :key="block.id" @click="appendSentenceBlock(block)"
                    :class="{ used: usedSentenceBlocks.includes(block.id) }">
              {{ block.icon }} {{ block.text }}
            </button>
            <small v-html="p('可以点选积木，也可以完全用自己的话表达')"></small>
          </div>

          <!-- 聊天记录区 -->
          <div class="flex-1 overflow-y-auto bg-white/40 rounded-xl p-3 border border-cyan-200/30 space-y-2 min-h-[200px]">
            <div v-for="(msg, i) in chatMessages" :key="i"
                 class="flex gap-2"
                 :class="msg.role === 'player' ? 'justify-end' : 'justify-start'">
              <div v-if="msg.role === 'player'" class="text-lg shrink-0">🧒</div>
              <CharacterImage v-else-if="msg.role === 'keke'" charId="keke" size="md" customClass="shrink-0" />
              <CharacterImage v-else-if="msg.role === 'caicai'" charId="caicai" size="md" customClass="shrink-0" />
              <CharacterImage v-else-if="msg.role === 'momo'" charId="momo" size="md" customClass="shrink-0" />
              <div class="max-w-[70%] px-3 py-2 rounded-2xl text-sm leading-relaxed group relative"
                   :class="msg.role === 'player'
                     ? 'bg-cyan-100/80 text-cyan-800 rounded-br-sm'
                     : msg.role === 'keke'
                       ? 'bg-amber-50/80 text-amber-800 rounded-bl-sm'
                       : msg.role === 'caicai'
                         ? 'bg-rose-50/80 text-rose-800 rounded-bl-sm'
                         : 'bg-cyan-50/80 text-cyan-700 rounded-bl-sm border border-cyan-200/40'">
                <span v-html="p(msg.text)"></span>
                <!-- NPC消息的语音播放按钮 -->
                <button v-if="msg.role !== 'player'"
                        @click.stop="playNPCVoice(msg)"
                        class="absolute -right-2 -top-2 w-6 h-6 rounded-full bg-white/90 border border-cyan-200 flex items-center justify-center text-[11px] opacity-0 group-hover:opacity-100 transition-opacity hover:scale-110 shadow-sm cursor-pointer"
                        title="点击播放语音">
                  🔊
                </button>
              </div>
            </div>
            <!-- 小鱼正在思考... -->
            <div v-if="isThinking" class="flex items-center gap-2 text-cyan-800/85 text-sm font-medium px-2 py-1">
              <CharacterImage charId="momo" size="md" customClass="animate-bounce" />
              <span v-html="p('小鱼们正在思考你的话...')"></span>
            </div>
            <div v-if="chatMessages.length === 0" class="flex items-center justify-center h-full text-cyan-800/75 text-sm font-medium">
              <span v-html="p('对它们说一句安慰的话吧...💬')"></span>
            </div>
          </div>

          <!-- 输入区 -->
          <div data-tutorial-target="chat-controls" class="relative mt-2 flex gap-2 items-center"
               :class="{'z-50 ring-4 ring-yellow-400 shadow-[0_0_20px_#facc15] px-3 py-2 rounded-xl bg-white/60': showTutorial && tutorialStep === 13}">
            <input v-model="inputText"
                   @keydown.enter="sendMessage"
                   :disabled="isThinking || showComplete"
                   :placeholder="isThinking ? '🐬 小鱼正在思考中...' : '💬 写一句想对它们说的话...'"
                   maxlength="100"
                   class="flex-1 px-4 py-2.5 rounded-full text-sm transition-all"
                   :class="isThinking
                     ? 'bg-gray-100 text-gray-400 border-2 border-gray-200 cursor-not-allowed'
                     : 'bg-white/80 border-2 border-cyan-200/50 text-cyan-800 placeholder-cyan-300 outline-none focus:border-cyan-400'" />
            <button @mouseenter="playHover" @click="startVoiceInput"
                    :disabled="isThinking || showComplete"
                    :title="isListening ? '停止语音输入' : '开始语音输入'"
                    class="w-10 h-10 rounded-full flex items-center justify-center text-lg shrink-0 transition-all border-2"
                    :class="isListening ? 'bg-red-400 border-red-300 text-white animate-pulse' : (isThinking ? 'bg-gray-100 border-gray-200 text-gray-300 cursor-not-allowed' : 'bg-white/80 border-cyan-200/40 text-cyan-500 hover:border-cyan-300')">🎤</button>
            <button @mouseenter="playHover" @click="sendMessage"
                    :disabled="isThinking || showComplete || isListening"
                    class="px-5 py-2.5 rounded-full shadow-lg transition-transform font-bold shrink-0"
                    :class="isThinking || isListening
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-gradient-to-r from-rose-400 to-pink-500 text-white hover:scale-105'"><span v-html="p('💬 发送')"></span></button>
          </div>
          <div v-if="voiceStatus"
               class="voice-input-status"
               :class="{ listening: isListening, error: voiceStatusType === 'error', success: voiceStatusType === 'success' }">
            <span>{{ isListening ? '🎤' : voiceStatusType === 'error' ? '⚠️' : '✓' }}</span>
            <span v-html="p(voiceStatus)"></span>
          </div>
        </div>

        <!-- 结束弹窗（礼花装饰 + 底部卡片，不遮挡对话） -->
        <Transition name="confetti-overlay">
          <div v-if="showComplete"
               class="absolute inset-0 z-30 pointer-events-none rounded-xl">
            <!-- 彩色礼花粒子（纯装饰，不遮挡任何内容） -->
            <div class="absolute inset-0 overflow-hidden">
              <div v-for="i in 40" :key="'cf'+i"
                   class="absolute top-[-20px] rounded-sm"
                   :style="{
                     left: (5 + Math.random() * 90) + '%',
                     width: (5 + Math.random() * 10) + 'px',
                     height: (5 + Math.random() * 10) + 'px',
                     background: ['#ff6b6b','#ffd93d','#6bcb77','#4d96ff','#ff85a2','#a66cff','#ff9f43','#00d2d3'][Math.floor(Math.random()*8)],
                     borderRadius: Math.random() > 0.5 ? '50%' : '2px',
                     animation: `confettiFall ${(2 + Math.random() * 3)}s linear ${(Math.random() * 0.8)}s forwards`,
                     transform: `rotate(${Math.random() * 360}deg)`,
                     opacity: 0.7,
                   }">
              </div>
            </div>
          </div>
        </Transition>

        <!-- 成功颁奖卡片（全屏居中，z-index 高于礼花） -->
        <div v-if="showComplete"
             class="fixed inset-0 z-50 flex items-center justify-center"
             @click.self="goNextLevel">
          <div class="bg-white/95 rounded-3xl px-8 py-6 shadow-2xl border-2 border-amber-300 animate-slide-up max-w-sm w-[90%] text-center pointer-events-auto">
            <div class="text-5xl mb-3 animate-bounce">🎖️</div>
            <div class="text-xl font-bold text-amber-700 mb-2" v-html="p('🎖️ 小队长任务完成！')">
            </div>
            <p class="text-sm text-cyan-700/80 leading-relaxed mb-4" v-html="p('恭喜你成功调解了壳壳和彩彩的矛盾！\n快去颁奖典礼领取你的专属勋章吧！🌟')">
            </p>
            <button @mouseenter="playHover" @click="goNextLevel"
                    class="px-8 py-3 bg-gradient-to-r from-amber-400 to-yellow-500 text-white text-base rounded-full shadow-lg font-bold guide-highlight">
              🎖️ <span v-html="p('去领奖')"></span>
            </button>
          </div>
        </div>

      </div>

      <!-- ===== 右：彩彩面板（可滚动） ===== -->
      <div class="w-[260px] shrink-0 flex flex-col gap-2 overflow-y-auto">
        <div class="bg-white/70 rounded-2xl p-4 border-2 text-center transition-all duration-500"
             :class="caicaiAnger >= 60 ? 'border-rose-300' : caicaiAnger >= 30 ? 'border-orange-200' : 'border-emerald-200'">
          <CharacterImage charId="caicai" size="xl" customClass="block mx-auto mb-1" />
          <div class="text-xl font-bold text-cyan-800" v-html="p('彩彩')"></div>
          <div class="text-sm text-cyan-800/80 font-medium" v-html="p('鹦嘴鱼 · 活泼')"></div>
          <div class="mt-3 w-full h-3 bg-rose-100/60 rounded-full overflow-hidden">
            <div class="h-full rounded-full transition-all duration-700"
                 :class="caicaiAnger >= 60 ? 'bg-red-400' : caicaiAnger >= 30 ? 'bg-orange-400' : 'bg-emerald-400'"
                 :style="{ width: caicaiAnger + '%' }"></div>
          </div>
          <span class="text-sm mt-1 font-bold" :class="caicaiAnger >= 60 ? 'text-red-500' : caicaiAnger >= 30 ? 'text-orange-500' : 'text-emerald-600'">
            <span v-html="p('愤怒')"></span> {{ caicaiAnger }}%
          </span>
          <div class="mt-3 bg-rose-50/80 rounded-2xl px-4 py-3 text-sm md:text-base text-rose-800 text-left leading-relaxed max-h-[160px] overflow-y-auto border border-rose-200/40 relative scroll-thin">
            <button @mouseenter="playHover" @click="speak(caicaiDialogue, 'caicai')" class="sticky top-0 float-right text-lg hover:scale-110 transition-transform z-10">🔊</button>
            <div class="whitespace-pre-wrap break-words" v-html="p(caicaiDialogue)"></div>
          </div>
        </div>
      </div>
    </div>

    <!-- ============================================================ -->
    <!-- 故事背景弹窗 -->
    <!-- ============================================================ -->
    <div v-if="showStoryPopup"
         class="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
         @click.self="startGame">
      <div class="w-[580px] max-w-[90vw] bg-white rounded-3xl shadow-2xl border-2 border-cyan-200 overflow-hidden animate-bounce-in">
        <div class="bg-gradient-to-r from-cyan-100 to-blue-100 px-6 py-6 text-center border-b border-cyan-200">
          <MomoDolphin size="xl" class="block mx-auto mb-2" />
          <h3 class="text-2xl font-bold text-cyan-800"><span v-html="p('📖 故事背景')"></span></h3>
        </div>
        <div class="px-8 py-6">
          <div class="flex items-start gap-3 mb-3">
            <p class="text-base md:text-lg text-cyan-700/90 leading-relaxed flex-1" v-html="p('大风暴过后，基地的观景露台成了阳光最充足、最温暖的地方。\n🦀 壳壳想在这里安安静静看书恢复精力\n🐠 彩彩想用欢快的音乐和舞蹈振奋大家的士气\n因为露台空间有限，它们两个互不相让，吵得不可开交。\n小队长，快用你的智慧帮它们和解吧！')">
            </p>
            <button @mouseenter="playHover" @click.stop="speakStory()"
                    class="shrink-0 w-10 h-10 rounded-full bg-cyan-100/80 border border-cyan-200 flex items-center justify-center text-lg hover:scale-110 transition-transform">🔊</button>
          </div>
          <div class="mt-3 text-center">
            <button @mouseenter="playHover" @click="startGame"
                    class="px-10 py-3 bg-gradient-to-r from-rose-400 to-pink-500 text-white text-lg rounded-full shadow-lg hover:scale-105 transition-transform font-bold">
              <span v-html="p('🚀 开始调解')"></span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- ============================================================ -->
    <!-- 第三关新手引导 -->
    <!-- ============================================================ -->
    <TutorialOverlay
      :visible="showTutorial"
      :message="tutorialMessage"
      :target-selector="tutorialTargetSelector"
      @skip="skipTutorial"
    />
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import TutorialOverlay from './TutorialOverlay.vue'
import { stopTTS, toggleTTS } from '../utils/tts.js'
import { playHover, playClick } from '../utils/sounds.js'
import { usePinyinText } from '../utils/pinyin.js'
import Level3Effects from './effects/Level3Effects.vue'
import CharacterImage from './canvas/CharacterImage.vue'
import MomoDolphin from './characters/MomoDolphin.vue'

const { p } = usePinyinText()

const emit = defineEmits(['complete'])

// ==================== NPC & 游戏状态 ====================
const kekeAnger = ref(78)
const caicaiAnger = ref(65)
const harmony = ref(0)
const phase = ref(0)
const phase1Done = ref(false)
const phase2Done = ref(false)
const currentRound = ref(0)
const showComplete = ref(false)
const showStoryPopup = ref(true)
const gameStartTime = ref(Date.now())

// ==================== 新手引导状态 ====================
const showTutorial = ref(false)
const tutorialStep = ref(1)

// 步骤覆盖四阶段：听对话 → 情绪 → 证据 → 需求 → 组合方案 → 句子积木 → 自由表达

const tutorialMessage = computed(() => {
  const msgs = {
    1: '先听壳壳说话，注意它语气里藏着什么心情。🔊',
    2: '选择壳壳最主要的心情。答错也没关系，我会给你线索！',
    3: '别只靠猜，再选出最能证明这种心情的原话。🔎',
    4: '接着听听彩彩怎么说，看看她在为什么着急。🔊',
    5: '选择彩彩最主要的心情。',
    6: '找出让你判断彩彩心情的文字证据。🔎',
    7: '两个人的心情都读懂了，继续寻找它们真正需要什么吧！',
    8: '给每句话判断：这是“表面立场”，还是藏在背后的“真实需求”？',
    9: '全部分清了！进入下一阶段设计解决方案。',
    10: '时间、声音和沟通各选一项。方案至少要同时照顾两个人哦！',
    11: '方案已经可以执行，带着它进入对话调解吧！',
    12: '不会开口时，可以点选句子积木，先表达理解、需求或办法。',
    13: '现在用键盘或语音说出完整的调解话语。你也可以完全用自己的话！',
  }
  return msgs[tutorialStep.value] || '加油，小队长！🐬'
})

const tutorialTargetSelector = computed(() => ({
  1: '[data-tutorial-target="keke-voice"]',
  2: '[data-tutorial-target="keke-emotions"]',
  3: '[data-tutorial-target="keke-evidence"]',
  4: '[data-tutorial-target="caicai-voice"]',
  5: '[data-tutorial-target="caicai-emotions"]',
  6: '[data-tutorial-target="caicai-evidence"]',
  7: '[data-tutorial-target="phase-two-button"]',
  8: '[data-tutorial-target="needs-classifier"]',
  9: '[data-tutorial-target="phase-three-button"]',
  10: '[data-tutorial-target="solution-builder"]',
  11: '[data-tutorial-target="phase-four-button"]',
  12: '[data-tutorial-target="sentence-blocks"]',
  13: '[data-tutorial-target="chat-controls"]',
})[tutorialStep.value] || '')

function startTutorial() {
  showTutorial.value = true
  tutorialStep.value = 1
}

// 对话阶段的提示在停留一段时间后自动收起，避免遮挡持续交流。
watch(tutorialStep, () => {
  scheduleAutoDismiss()
}, { immediate: false })

let autoDismissTimer = null

function clearAutoDismiss() {
  if (autoDismissTimer) {
    clearTimeout(autoDismissTimer)
    autoDismissTimer = null
  }
}

function scheduleAutoDismiss() {
  clearAutoDismiss()
  if (tutorialStep.value >= 12) {
    autoDismissTimer = setTimeout(() => {
      skipTutorial()
    }, 5000)
  }
}

function advanceTutorial() {
  clearAutoDismiss()
  if (tutorialStep.value >= 1 && tutorialStep.value < 13) {
    tutorialStep.value++
  } else {
    skipTutorial()
  }
}

function skipTutorial() {
  clearAutoDismiss()
  showTutorial.value = false
  tutorialStep.value = 1
}

// ==================== 故事弹窗 & 语音 ====================
const kekeDialogue = ref('我说了好几次想安静看书，她还是把音乐开得很大。算了，反正我的感受也不重要……')
const caicaiDialogue = ref('阳台的光线最适合练舞，可壳壳一来就叫我停下。为什么只有他的事情重要？我也很着急呀！')

function speak(text, role = 'momo') {
  toggleTTS(text, role)
}

function speakStory() {
  const story = '大风暴过后，基地的观景露台成了阳光最充足、最温暖的地方。壳壳想在这里安安静静看书恢复精力，彩彩想用欢快的音乐和舞蹈振奋大家的士气。因为它们互不相让，吵得不可开交。小队长，快用你的智慧帮它们和解吧！'
  toggleTTS(story, 'momo')
}

// 新手引导语音播放 → 语音播放完再推进下一步引导
async function playTutorialVoice(character) {
  const text = character === 'keke' ? kekeDialogue.value : caicaiDialogue.value
  const role = character
  await toggleTTS(text, role)
  // 语音播完后才推进（用户也可能点击停止，停止也算"听过"了）
  if (character === 'keke' && showTutorial.value && tutorialStep.value === 1) {
    advanceTutorial()
  } else if (character === 'caicai' && showTutorial.value && tutorialStep.value === 4) {
    advanceTutorial()
  }
}

let speechRecognition = null
let speechTimeout = null
let speechSession = 0

/** 创建新的语音识别实例（每次调用重新创建，避免浏览器状态问题） */
function createSpeechRecognition(sessionToken) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition
  if (!SR) return null

  const sr = new SR()
  sr.lang = 'zh-CN'
  sr.continuous = false
  sr.interimResults = true
  sr.maxAlternatives = 1
  let finalTranscript = ''

  sr.onresult = (e) => {
    if (sessionToken !== speechSession || speechRecognition !== sr) return
    let interimTranscript = ''
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const segment = e.results[i][0]?.transcript || ''
      if (e.results[i].isFinal) finalTranscript += segment
      else interimTranscript += segment
    }
    const visibleTranscript = (finalTranscript || interimTranscript).trim()
    if (visibleTranscript) inputText.value = visibleTranscript
    voiceStatus.value = finalTranscript
      ? '识别完成，请检查文字后点击发送'
      : '正在识别：' + visibleTranscript
    voiceStatusType.value = finalTranscript ? 'success' : 'info'
  }

  sr.onerror = (e) => {
    if (sessionToken !== speechSession || speechRecognition !== sr) return
    isListening.value = false
    clearTimeout(speechTimeout)
    speechTimeout = null
    speechRecognition = null
    if (e.error === 'no-speech') {
      voiceStatus.value = '没有听到声音，请靠近麦克风后重试'
    } else if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
      voiceStatus.value = '麦克风权限未开启，请在浏览器地址栏允许后重试'
    } else if (e.error === 'aborted') {
      if (!inputText.value.trim()) voiceStatus.value = '语音输入已停止'
      return
    } else if (e.error === 'network') {
      voiceStatus.value = '语音识别服务暂时无法连接，请稍后重试或手动输入'
    } else {
      voiceStatus.value = '语音识别没有成功，请重试或手动输入'
    }
    voiceStatusType.value = 'error'
  }

  sr.onend = () => {
    if (sessionToken !== speechSession || speechRecognition !== sr) return
    isListening.value = false
    clearTimeout(speechTimeout)
    speechTimeout = null
    speechRecognition = null
    if (inputText.value.trim()) {
      voiceStatus.value = '识别完成，请检查文字后点击发送'
      voiceStatusType.value = 'success'
    } else if (!voiceStatus.value) {
      voiceStatus.value = '没有识别到文字，请点击麦克风重试'
      voiceStatusType.value = 'error'
    }
  }

  return sr
}

onUnmounted(() => {
  speechSession += 1
  if (speechRecognition) {
    try { speechRecognition.abort() } catch (e) { /* ignore */ }
    speechRecognition = null
  }
  clearTimeout(speechTimeout)
  stopTTS()
})

function startGame() {
  showStoryPopup.value = false
  phase.value = 1
  setTimeout(() => startTutorial(), 500)
}

// ==================== 情绪识别 ====================
const kekeOptions = [
  { id: 'a', emoji: '💧', label: '委屈失望' },
  { id: 'b', emoji: '✨', label: '兴奋期待' },
  { id: 'c', emoji: '🌿', label: '平静放松' },
]
const caicaiOptions = [
  { id: 'a', emoji: '🔥', label: '生气着急' },
  { id: 'b', emoji: '🌙', label: '疲惫困倦' },
  { id: 'c', emoji: '🫧', label: '害怕退缩' },
]
const kekeEvidenceOptions = [
  { id: 'a', text: '“我说了好几次想安静看书”' },
  { id: 'b', text: '“反正我的感受也不重要……”' },
  { id: 'c', text: '“她把音乐开得很大”' },
]
const caicaiEvidenceOptions = [
  { id: 'a', text: '“阳台的光线最适合练舞”' },
  { id: 'b', text: '“为什么只有他的事情重要？我也很着急呀！”' },
  { id: 'c', text: '“壳壳一来就叫我停下”' },
]
const kekeSelected = ref(null)
const caicaiSelected = ref(null)
const kekeCorrect = ref(false)
const caicaiCorrect = ref(false)
const kekeFeedback = ref('')
const caicaiFeedback = ref('')
const kekeEvidenceSelected = ref(null)
const caicaiEvidenceSelected = ref(null)
const kekeEvidenceCorrect = ref(false)
const caicaiEvidenceCorrect = ref(false)
const kekeEvidenceFeedback = ref('')
const caicaiEvidenceFeedback = ref('')
const emotionAttempts = ref(0)
const evidenceAttempts = ref(0)

watch(kekeSelected, (v) => {
  if (showTutorial.value && tutorialStep.value === 2 && kekeCorrect.value && v !== null) advanceTutorial()
})
watch(caicaiSelected, (v) => {
  if (showTutorial.value && tutorialStep.value === 5 && caicaiCorrect.value && v !== null) advanceTutorial()
})

function selectKekeEmotion(opt) {
  if (kekeCorrect.value) return
  kekeSelected.value = opt.id
  emotionAttempts.value++
  if (opt.id === 'a') {
    kekeCorrect.value = true
    kekeFeedback.value = '✅ 对！“感受不重要”透露出壳壳很委屈、失望。'
    kekeAnger.value = Math.max(0, kekeAnger.value - 8)
  } else {
    kekeFeedback.value = emotionAttempts.value > 1
      ? '再看看最后一句：“反正我的感受也不重要……”'
      : '还不太像。注意壳壳最后放低声音说了什么。'
  }
}
function selectCaicaiEmotion(opt) {
  if (caicaiCorrect.value) return
  caicaiSelected.value = opt.id
  emotionAttempts.value++
  if (opt.id === 'a') {
    caicaiCorrect.value = true
    caicaiFeedback.value = '✅ 对！连续的反问和“我也很着急”说明彩彩生气又着急。'
    caicaiAnger.value = Math.max(0, caicaiAnger.value - 8)
  } else {
    caicaiFeedback.value = emotionAttempts.value > 2
      ? '线索就在“为什么只有他的事情重要？我也很着急呀！”'
      : '听起来她的语气很强烈，并不是想睡觉或害怕。'
  }
}

function selectEvidence(character, opt) {
  const isKeke = character === 'keke'
  if (isKeke ? kekeEvidenceCorrect.value : caicaiEvidenceCorrect.value) return
  evidenceAttempts.value++
  const correct = opt.id === 'b'
  if (isKeke) {
    kekeEvidenceSelected.value = opt.id
    kekeEvidenceCorrect.value = correct
    kekeEvidenceFeedback.value = correct
      ? '✅ 找到了！这句话直接说出了壳壳“没有被重视”的委屈。'
      : '这句话讲的是事情经过，再找一句能直接表现内心感受的话。'
    if (correct && showTutorial.value && tutorialStep.value === 3) advanceTutorial()
  } else {
    caicaiEvidenceSelected.value = opt.id
    caicaiEvidenceCorrect.value = correct
    caicaiEvidenceFeedback.value = correct
      ? '✅ 找到了！反问和“着急”最能表现彩彩的强烈情绪。'
      : '这是发生的事情，但还不是最明显的情绪线索。'
    if (correct && showTutorial.value && tutorialStep.value === 6) advanceTutorial()
  }
}

function choiceClass(selected, id, correct) {
  if (selected !== id) return 'idle'
  return correct ? 'selected-correct' : 'selected-wrong'
}

function evidenceChoiceClass(character, id) {
  const selected = character === 'keke' ? kekeEvidenceSelected.value : caicaiEvidenceSelected.value
  const correct = character === 'keke' ? kekeEvidenceCorrect.value : caicaiEvidenceCorrect.value
  if (selected !== id) return ''
  return correct ? 'selected-correct' : 'selected-wrong'
}

const emotionStageComplete = computed(() =>
  kekeCorrect.value && caicaiCorrect.value && kekeEvidenceCorrect.value && caicaiEvidenceCorrect.value
)

function goToPhase2() {
  phase1Done.value = true
  phase.value = 2
  harmony.value = Math.min(harmony.value + 15, 100)
  kekeDialogue.value = '哼……但如果你能理解我，我愿意听听你有什么办法……'
  caicaiDialogue.value = '总算有人懂我了！快告诉我该怎么办吧！'
  if (showTutorial.value && tutorialStep.value === 7) advanceTutorial()
}

// ==================== 阶段二：立场与需求 ====================
const needStatements = [
  { id: 'keke-stance', owner: 'keke', text: '彩彩不应该在阳台放音乐。', answer: 'stance' },
  { id: 'keke-need', owner: 'keke', text: '我需要一段安静、不会被打扰的阅读时间。', answer: 'need' },
  { id: 'caicai-stance', owner: 'caicai', text: '阳台应该一直让我练舞。', answer: 'stance' },
  { id: 'caicai-need', owner: 'caicai', text: '我需要光线好、能够练习舞蹈的空间。', answer: 'need' },
]
const needAnswers = ref({})
const needsFeedback = ref('')
const needsAttempts = ref(0)
const needsComplete = computed(() => needStatements.every(item => needAnswers.value[item.id] === item.answer))

function classifyNeed(item, answer) {
  if (needAnswers.value[item.id] === item.answer) return
  needsAttempts.value++
  if (answer === item.answer) {
    needAnswers.value = { ...needAnswers.value, [item.id]: answer }
    needsFeedback.value = needsComplete.value
      ? '✅ 全部分清了！立场可能冲突，但真实需求可以同时被照顾。'
      : '✅ 判断正确，继续看看下一句话。'
    if (needsComplete.value && showTutorial.value && tutorialStep.value === 8) advanceTutorial()
  } else {
    needsFeedback.value = answer === 'stance'
      ? '再想想：这句话是不是在解释“为什么需要”，而不是要求别人怎么做？'
      : '再想想：这句话是在要求一个做法，还是在说明内心真正需要什么？'
  }
}

function needChoiceClass(item, answer) {
  const selected = needAnswers.value[item.id]
  if (selected === answer) return 'correct'
  return selected ? 'muted' : ''
}

function goToPhase3() {
  phase2Done.value = true
  phase.value = 3
  harmony.value = Math.min(harmony.value + 15, 100)
  if (showTutorial.value && tutorialStep.value === 9) advanceTutorial()
}

// ==================== 阶段三：组合解决方案 ====================
const solutionGroups = [
  {
    key: 'time', icon: '⏰', title: '时间安排', tip: '两个人什么时候使用阳台？',
    options: [
      { id: 'split', text: '上午安静阅读，下午练舞', fair: true },
      { id: 'alternate', text: '每天轮换优先使用时段', fair: true },
      { id: 'all-dance', text: '所有时间都先让彩彩练舞', fair: false },
    ],
  },
  {
    key: 'sound', icon: '🎧', title: '声音办法', tip: '怎样减少互相打扰？',
    options: [
      { id: 'headphones', text: '彩彩戴耳机，保留舞蹈空间', fair: true },
      { id: 'screen', text: '设置可移动隔音屏风', fair: true },
      { id: 'no-music', text: '以后完全禁止音乐', fair: false },
    ],
  },
  {
    key: 'rule', icon: '🤝', title: '沟通规则', tip: '变化发生时怎么办？',
    options: [
      { id: 'notify', text: '临时调整前先告诉对方', fair: true },
      { id: 'trial', text: '试行三天后一起再商量', fair: true },
      { id: 'loud-wins', text: '谁声音大就听谁的', fair: false },
    ],
  },
]
const solutionSelections = ref({ time: '', sound: '', rule: '' })
const solutionQuality = ref(0)
const solutionAttempts = ref(0)
const solutionFeedback = ref('')
const solutionAccepted = ref(false)
const phase3Done = ref(false)
const solutionReady = computed(() => Object.values(solutionSelections.value).every(Boolean))
const selectedCardId = computed(() => Object.values(solutionSelections.value).filter(Boolean).join('+'))

function selectSolution(groupKey, option) {
  solutionSelections.value = { ...solutionSelections.value, [groupKey]: option.id }
  solutionAccepted.value = false
  solutionFeedback.value = ''
}

function evaluateSolution() {
  solutionAttempts.value++
  let fairCount = 0
  solutionGroups.forEach(group => {
    const option = group.options.find(item => item.id === solutionSelections.value[group.key])
    if (option?.fair) fairCount++
  })
  solutionQuality.value = fairCount
  if (fairCount >= 2) {
    solutionAccepted.value = true
    solutionFeedback.value = fairCount === 3
      ? '三个方面都照顾到了双方，是清楚、具体又公平的双赢方案！'
      : '已经照顾到双方，也能实际执行；还有一个方面可以在对话中继续商量。'
    harmony.value = Math.min(harmony.value + (fairCount === 3 ? 25 : 18), 55)
    kekeAnger.value = Math.max(0, kekeAnger.value - 16)
    caicaiAnger.value = Math.max(0, caicaiAnger.value - 16)
    if (showTutorial.value && tutorialStep.value === 10) advanceTutorial()
  } else {
    solutionFeedback.value = '目前只有一个方面同时照顾到双方。看看是否有“永远、完全、谁声音大”这样的偏袒选项。'
  }
}

function goToPhase4() {
  phase3Done.value = true
  phase.value = 4
  currentRound.value = 1
  chatMessages.value = []
  harmony.value = Math.min(harmony.value, 55)
  kekeDialogue.value = '这个方案听起来比较公平，不过我想听听小队长怎么对我们说……'
  caicaiDialogue.value = '好呀！只要你也能理解我，我愿意一起试试看！'
  if (showTutorial.value && tutorialStep.value === 11) advanceTutorial()
}

// ==================== 阶段四：句子积木 + 3轮智能协商 ====================
const inputText = ref('')
const chatMessages = ref([])
const isListening = ref(false)
const isThinking = ref(false)
const voiceStatus = ref('')
const voiceStatusType = ref('info')
const usedSentenceBlocks = ref([])

const selectedSolutionSummary = computed(() => {
  return solutionGroups.map(group => {
    const option = group.options.find(item => item.id === solutionSelections.value[group.key])
    return option?.text || ''
  }).filter(Boolean).join('；')
})

const sentenceBlocks = computed(() => [
  { id: 'empathy', icon: '💗', text: '我听出来你们都觉得自己没有被重视。' },
  { id: 'needs', icon: '🧭', text: '壳壳需要安静，彩彩也需要练舞空间。' },
  { id: 'solution', icon: '🤝', text: `我们可以这样试试：${selectedSolutionSummary.value}。` },
])

function appendSentenceBlock(block) {
  if (!usedSentenceBlocks.value.includes(block.id)) {
    usedSentenceBlocks.value.push(block.id)
  }
  const current = inputText.value.trim()
  if (!current.includes(block.text)) {
    inputText.value = current ? `${current}${block.text}` : block.text
  }
  if (showTutorial.value && tutorialStep.value === 12) advanceTutorial()
}

function startVoiceInput() {
  // 正在监听 → 停止
  if (isListening.value) {
    if (speechRecognition) {
      try { speechRecognition.stop() } catch (e) { /* ignore */ }
    }
    isListening.value = false
    clearTimeout(speechTimeout)
    speechTimeout = null
    voiceStatus.value = inputText.value.trim()
      ? '语音输入已停止，请检查文字后点击发送'
      : '语音输入已停止'
    voiceStatusType.value = inputText.value.trim() ? 'success' : 'info'
    return
  }

  if (!window.isSecureContext && !['localhost', '127.0.0.1'].includes(window.location.hostname)) {
    voiceStatus.value = '语音输入需要在 HTTPS 或本机地址中使用'
    voiceStatusType.value = 'error'
    return
  }

  // 创建全新实例（浏览器要求每次重新创建）
  speechSession += 1
  const currentSession = speechSession
  const instance = createSpeechRecognition(currentSession)
  if (!instance) {
    voiceStatus.value = '当前浏览器不支持语音识别，建议使用最新版 Edge 或 Chrome'
    voiceStatusType.value = 'error'
    return
  }

  speechRecognition = instance
  inputText.value = ''
  isListening.value = true
  voiceStatus.value = '正在听你说话，请自然地说出完整句子'
  voiceStatusType.value = 'info'

  try {
    instance.start()
    // 给儿童更充足的表达时间，12秒后自动结束并保留已识别文字。
    speechTimeout = setTimeout(() => {
      if (currentSession === speechSession && speechRecognition === instance && isListening.value) {
        try { instance.stop() } catch (e) { /* ignore */ }
        voiceStatus.value = inputText.value.trim()
          ? '录音时间结束，请检查文字后点击发送'
          : '没有听到声音，请点击麦克风重试'
        voiceStatusType.value = inputText.value.trim() ? 'success' : 'error'
      }
    }, 12000)
  } catch (e) {
    isListening.value = false
    speechRecognition = null
    voiceStatus.value = '语音输入启动失败，请检查麦克风权限后重试'
    voiceStatusType.value = 'error'
  }
}

// 语音播报（供手动点击按钮调用）
function speakNPCRole(text, role) {
  toggleTTS(text, role)
}

// 点击消息气泡上的播放按钮触发
function playNPCVoice(msg) {
  const cleanText = msg.text.replace(/[🦀🐠🌟🎉😢😤🤝💬🐬🐚👏🎵📚]/g, '').trim()
  if (!cleanText) return
  speakNPCRole(cleanText, msg.role === 'keke' ? 'keke' : msg.role === 'caicai' ? 'caicai' : 'momo')
}

// 从 Vue App 的 props 获取或生成 sessionId
let sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6)

async function sendMessage(voiceText) {
  // voiceText 是语音识别传来的文字；手动输入时 voiceText 是 undefined（事件对象不处理）
  const text = (typeof voiceText === 'string' ? voiceText : inputText.value).trim()
  if (!text || text.length < 2 || text.startsWith('（') || isThinking.value || showComplete.value) return
  voiceStatus.value = ''

  // 最后一步引导：第一次真正发送消息后结束。
  if (showTutorial.value && tutorialStep.value === 13 && chatMessages.value.length === 0) {
    advanceTutorial()
  }

  // 显示玩家消息，禁用输入
  chatMessages.value.push({ role: 'player', text })
  inputText.value = ''
  isThinking.value = true

  // 构建历史对话记录
  const historyPairs = []
  for (let i = 0; i < chatMessages.value.length; i++) {
    const msg = chatMessages.value[i]
    if (msg.role === 'player') {
      // 找到它后面的NPC回复
      const nextKeke = chatMessages.value.slice(i + 1).find(m => m.role === 'keke')
      const nextCaicai = chatMessages.value.slice(i + 1).find(m => m.role === 'caicai')
      historyPairs.push({
        student: msg.text,
        keke: nextKeke?.text || '',
        caicai: nextCaicai?.text || '',
      })
    }
  }

  try {
    // 调用 FastAPI 后端
    const res = await fetch('http://localhost:8005/api/assessment/level3-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: sessionId,
        student_input: text,
        current_round: currentRound.value,
        current_harmony: harmony.value,
        chat_history: historyPairs.slice(-3),
      }),
    })

    if (!res.ok) throw new Error(`API error: ${res.status}`)
    const result = await res.json()
    const data = result.data

    // 更新和解度
    harmony.value = data.new_harmony
    // 更新不友好计数器
    if (data.unfriendly_count !== undefined) {
      unfriendlyCount.value = data.unfriendly_count
    }
    // 更新愤怒条（根据mood做视觉映射）
    if (data.keke_mood === 'happy') kekeAnger.value = Math.max(0, kekeAnger.value - 12)
    else if (data.keke_mood === 'reflective') kekeAnger.value = Math.max(0, kekeAnger.value - 5)
    else kekeAnger.value = Math.min(100, kekeAnger.value + 3)

    if (data.caicai_mood === 'happy') caicaiAnger.value = Math.max(0, caicaiAnger.value - 10)
    else if (data.caicai_mood === 'reflective') caicaiAnger.value = Math.max(0, caicaiAnger.value - 4)
    else caicaiAnger.value = Math.min(100, caicaiAnger.value + 3)

    // 更新NPC对话气泡
    kekeDialogue.value = data.keke_reply
    caicaiDialogue.value = data.caicai_reply

    // 壳壳先回复（600ms后），然后彩彩再回复（1800ms后）
    setTimeout(() => {
      chatMessages.value.push({ role: 'keke', text: data.keke_reply })
    }, 600)

    setTimeout(() => {
      chatMessages.value.push({ role: 'caicai', text: data.caicai_reply })
    }, 1800)

    // 回合数+1
    currentRound.value++

    // 通关判定 — 后端沫沫AI智能体会处理所有总结场景
    if (data.momo_intervention_needed && data.momo_reply) {
      setTimeout(() => {
        chatMessages.value.push({ role: 'momo', text: data.momo_reply })
        if (harmony.value < 50) harmony.value = Math.max(harmony.value, 50)
        setTimeout(() => { showComplete.value = true }, 2000)
      }, 3000)
    }
  } catch (err) {
    console.warn('对话API调用失败，使用本地降级处理', err)
    // 降级
    kekeDialogue.value = '嗯……小队长说得有道理，我们再好好想想……'
    caicaiDialogue.value = '对呀对呀！小队长说的对，我们不吵架了！'
    setTimeout(() => chatMessages.value.push({ role: 'keke', text: kekeDialogue.value }), 600)
    setTimeout(() => chatMessages.value.push({ role: 'caicai', text: caicaiDialogue.value }), 1800)
    currentRound.value++
    if (currentRound.value > 3) {
      setTimeout(() => {
        chatMessages.value.push({ role: 'momo', text: '🐬 沫沫："好啦好啦，大家各退一步，我们先试运行一下时间分配方案吧！"' })
        setTimeout(() => { showComplete.value = true }, 2000)
      }, 3000)
    }
  } finally {
    isThinking.value = false
  }
}

const phaseLabel = computed(() => {
  if (showComplete.value) return '🎉 已完成'
  if (!showStoryPopup.value && phase.value === 1 && !phase1Done.value) return '👀 观察情绪'
  if (phase.value === 2 && !phase2Done.value) return '🧭 发现需求'
  if (phase.value === 3 && !phase3Done.value) return '🧩 组合方案'
  if (phase.value === 4) return '💬 对话调解'
  return '🤝 调解中'
})

const phaseProgressLabel = computed(() => {
  if (phase.value === 4) return `${Math.min(currentRound.value, 3)}/3 轮`
  return `${Math.max(phase.value, 1)}/4 阶段`
})
const completedDialogueRounds = computed(() => Math.max(0, Math.min(3, currentRound.value - 1)))
const unfriendlyCount = ref(0) // 追踪本轮不友好输入次数

// ==================== 关卡完成 ====================
async function goNextLevel() {
  const dur = Math.floor((Date.now() - gameStartTime.value) / 1000)
  const totalErrors = Math.max(0, emotionAttempts.value - 2)
    + Math.max(0, evidenceAttempts.value - 2)
    + Math.max(0, needsAttempts.value - 4)
    + Math.max(0, solutionAttempts.value - 1)
  try {
    await fetch('/api/assessment/submit-level', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        level: 'LEVEL_3', studentId: 'stu_9527', duration_seconds: dur,
        raw_metrics: {
          block_drag_count: chatMessages.value.length + usedSentenceBlocks.value.length,
          species_placement_attempts: completedDialogueRounds.value,
          block_gravity_fall_failures: 0, check_attempts: 0, removal_count: 0,
          unfriendly_count: unfriendlyCount.value,
          total_errors: totalErrors,
          successful_pairs: solutionQuality.value >= 2 ? 1 : 0,
          harmony_final: harmony.value, keke_anger_final: kekeAnger.value, caicai_anger_final: caicaiAnger.value,
          rounds_used: completedDialogueRounds.value,
          emotion_correct: (kekeCorrect.value ? 1 : 0) + (caicaiCorrect.value ? 1 : 0),
          evidence_correct: (kekeEvidenceCorrect.value ? 1 : 0) + (caicaiEvidenceCorrect.value ? 1 : 0),
          emotion_attempts: emotionAttempts.value,
          evidence_attempts: evidenceAttempts.value,
          needs_correct: Object.keys(needAnswers.value).length,
          needs_attempts: needsAttempts.value,
          solution_quality: solutionQuality.value,
          solution_attempts: solutionAttempts.value,
          sentence_blocks_used: usedSentenceBlocks.value.length,
          card_selected: selectedCardId.value,
        },
      }),
    })
  } catch (e) { console.warn(e) }
  emit('complete', {
    level: 'LEVEL_3', duration: dur, harmony_score: harmony.value,
    raw_metrics: {
      unfriendly_count: unfriendlyCount.value,
      harmony_final: harmony.value,
      rounds_used: completedDialogueRounds.value,
      emotion_correct: (kekeCorrect.value ? 1 : 0) + (caicaiCorrect.value ? 1 : 0),
      evidence_correct: (kekeEvidenceCorrect.value ? 1 : 0) + (caicaiEvidenceCorrect.value ? 1 : 0),
      emotion_attempts: emotionAttempts.value,
      evidence_attempts: evidenceAttempts.value,
      needs_correct: Object.keys(needAnswers.value).length,
      needs_attempts: needsAttempts.value,
      solution_quality: solutionQuality.value,
      solution_attempts: solutionAttempts.value,
      sentence_blocks_used: usedSentenceBlocks.value.length,
      card_selected: selectedCardId.value,
      keke_anger_final: kekeAnger.value,
      caicai_anger_final: caicaiAnger.value,
    },
    dialogue: chatMessages.value,
    evidence: `第三关完成：用时${dur}秒，和解度${harmony.value}%，对话${completedDialogueRounds.value}轮`,
  })
}
</script>

<style scoped>
.phase-title {
  position: relative;
  isolation: isolate;
  width: fit-content;
  padding: 0.55rem 1.15rem;
  border: 1px solid;
  border-radius: 9999px;
  font-weight: 900;
  line-height: 1.25;
  letter-spacing: 0.035em;
  text-shadow: 0 1px 0 rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

.phase-title::before {
  content: '';
  position: absolute;
  inset: 4px;
  z-index: -1;
  border-radius: inherit;
  background: linear-gradient(100deg, rgba(255,255,255,0.46), transparent 72%);
}

.phase-title-observe {
  color: #075985;
  background: linear-gradient(110deg, rgba(224, 242, 254, 0.96), rgba(186, 230, 253, 0.88));
  border-color: rgba(14, 116, 144, 0.42);
  box-shadow: 0 8px 24px rgba(3, 105, 161, 0.18), inset 0 1px 0 rgba(255,255,255,0.9);
}

.phase-title-decide {
  color: #3730a3;
  background: linear-gradient(110deg, rgba(238, 242, 255, 0.97), rgba(221, 214, 254, 0.9));
  border-color: rgba(79, 70, 229, 0.38);
  box-shadow: 0 8px 24px rgba(67, 56, 202, 0.18), inset 0 1px 0 rgba(255,255,255,0.9);
}

.phase-title-plan {
  color: #6d3b00;
  background: linear-gradient(110deg, rgba(255, 247, 214, 0.97), rgba(254, 215, 170, 0.9));
  border-color: rgba(217, 119, 6, 0.38);
  box-shadow: 0 8px 24px rgba(217, 119, 6, 0.17), inset 0 1px 0 rgba(255,255,255,0.9);
}

.phase-title-negotiate {
  color: #065f5b;
  background: linear-gradient(110deg, rgba(204, 251, 241, 0.97), rgba(165, 243, 252, 0.9));
  border-color: rgba(13, 148, 136, 0.4);
  box-shadow: 0 8px 24px rgba(13, 148, 136, 0.18), inset 0 1px 0 rgba(255,255,255,0.9);
}

.phase-description {
  max-width: 34rem;
  padding: 0.45rem 1rem;
  border: 1px solid rgba(14, 116, 144, 0.18);
  border-radius: 0.85rem;
  background: rgba(255, 255, 255, 0.68);
  color: #155e75;
  font-size: 0.925rem;
  font-weight: 600;
  line-height: 1.6;
  text-align: center;
  box-shadow: 0 5px 18px rgba(8, 47, 73, 0.07);
  backdrop-filter: blur(8px);
}

.phase-status-strip {
  display: flex;
  align-items: center;
  gap: .45rem;
  padding: .28rem;
  border: 1px solid rgba(8, 145, 178, .18);
  border-radius: 999px;
  background: rgba(255, 255, 255, .6);
  box-shadow: 0 5px 16px rgba(8,47,73,.08), inset 0 1px rgba(255,255,255,.7);
  backdrop-filter: blur(10px);
}

.phase-status-strip.compact {
  padding: .2rem;
}

.phase-status-chip {
  display: inline-flex;
  align-items: center;
  min-height: 28px;
  padding: .26rem .65rem;
  color: #155e75;
  border-radius: 999px;
  font-size: .8rem;
  font-weight: 800;
  line-height: 1.15;
  white-space: nowrap;
}

.phase-status-chip.active {
  color: #083344;
  background: linear-gradient(120deg, rgba(165,243,252,.95), rgba(153,246,228,.86));
  box-shadow: 0 3px 10px rgba(8,145,178,.16), inset 0 1px rgba(255,255,255,.75);
}

.emotion-question {
  display: inline-flex;
  align-items: center;
  width: fit-content;
  margin-bottom: .65rem;
  padding: .42rem .85rem;
  color: #083344;
  border-left: 4px solid #0891b2;
  border-radius: 0 .75rem .75rem 0;
  background: linear-gradient(90deg, rgba(207,250,254,.96), rgba(255,255,255,.7));
  box-shadow: 0 4px 14px rgba(8,47,73,.08);
  font-size: 1rem;
  font-weight: 900;
  letter-spacing: .02em;
}

.character-reading-card {
  min-width: 0;
  padding: 0.9rem;
  border: 1px solid;
  border-radius: 1.1rem;
  background: rgba(255, 255, 255, 0.76);
  box-shadow: 0 8px 25px rgba(8, 47, 73, 0.08);
}
.character-reading-card.keke-card {
  border-color: rgba(245, 158, 11, 0.3);
  background: linear-gradient(145deg, rgba(255,251,235,.94), rgba(255,255,255,.75));
}
.character-reading-card.caicai-card {
  border-color: rgba(244, 63, 94, 0.25);
  background: linear-gradient(145deg, rgba(255,241,242,.94), rgba(255,255,255,.75));
}
.voice-circle {
  width: 2.25rem;
  height: 2.25rem;
  border: 1px solid rgba(8, 145, 178, .2);
  border-radius: 999px;
  background: rgba(255, 255, 255, .86);
  transition: transform .2s ease, box-shadow .2s ease;
}
.voice-circle:hover {
  transform: scale(1.08);
  box-shadow: 0 5px 15px rgba(8,145,178,.16);
}
.reading-dialogue {
  min-height: 4.8rem;
  margin: .45rem 0 .65rem;
  padding: .65rem .75rem;
  border-radius: .8rem;
  background: rgba(255, 255, 255, .62);
  font-size: .9rem;
  font-weight: 650;
  line-height: 1.65;
}
.choice-button {
  min-height: 2.8rem;
  padding: .48rem .35rem;
  border: 2px solid rgba(8,145,178,.18);
  border-radius: .75rem;
  background: rgba(255,255,255,.82);
  color: #155e75;
  font-size: .8rem;
  font-weight: 800;
  transition: all .18s ease;
}
.choice-button:hover,
.choice-button.idle:hover {
  border-color: rgba(8,145,178,.5);
  transform: translateY(-1px);
}
.choice-button.selected-correct,
.evidence-choice.selected-correct {
  color: #047857;
  border-color: #34d399;
  background: rgba(209,250,229,.94);
}
.choice-button.selected-wrong,
.evidence-choice.selected-wrong {
  color: #be123c;
  border-color: #fb7185;
  background: rgba(255,228,230,.94);
}
.answer-feedback {
  margin-top: .42rem;
  font-size: .76rem;
  font-weight: 750;
  line-height: 1.45;
}
.answer-feedback.correct { color: #047857; }
.answer-feedback.retry { color: #be123c; }
.evidence-box {
  margin-top: .65rem;
  padding: .62rem;
  border: 1px dashed rgba(8,145,178,.3);
  border-radius: .85rem;
  background: rgba(236,254,255,.54);
}
.evidence-title {
  margin-bottom: .4rem;
  color: #0e7490;
  font-size: .78rem;
  font-weight: 850;
}
.evidence-choice {
  display: block;
  width: 100%;
  padding: .42rem .58rem;
  border: 1px solid rgba(8,145,178,.17);
  border-radius: .62rem;
  background: rgba(255,255,255,.82);
  color: #164e63;
  font-size: .76rem;
  font-weight: 650;
  text-align: left;
  transition: all .18s ease;
}
.evidence-choice:hover {
  border-color: rgba(8,145,178,.5);
  transform: translateX(2px);
}
.stage-next-button {
  padding: .72rem 1.55rem;
  border-radius: 999px;
  background: linear-gradient(120deg, #34d399, #14b8a6);
  color: white;
  box-shadow: 0 8px 20px rgba(16,185,129,.25);
  font-size: .92rem;
  font-weight: 900;
  transition: transform .2s ease, box-shadow .2s ease;
}
.stage-next-button:hover {
  transform: translateY(-2px) scale(1.02);
  box-shadow: 0 11px 25px rgba(16,185,129,.32);
}
.stage-next-button.secondary {
  background: linear-gradient(120deg, #38bdf8, #6366f1);
  box-shadow: 0 8px 20px rgba(59,130,246,.24);
}

.needs-board {
  overflow: hidden;
  border: 1px solid rgba(79,70,229,.2);
  border-radius: 1.15rem;
  background: rgba(255,255,255,.76);
  box-shadow: 0 10px 28px rgba(49,46,129,.09);
}
.needs-board-head,
.need-row {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(250px, .9fr);
  align-items: center;
  gap: .8rem;
}
.needs-board-head {
  padding: .65rem .9rem;
  color: #4338ca;
  background: rgba(224,231,255,.78);
  font-size: .78rem;
  font-weight: 900;
}
.need-row {
  padding: .7rem .9rem;
  border-top: 1px solid rgba(99,102,241,.1);
}
.need-statement {
  display: flex;
  align-items: center;
  gap: .6rem;
  color: #1e3a5f;
  font-size: .88rem;
  font-weight: 700;
  line-height: 1.45;
}
.need-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: .45rem;
}
.need-actions button {
  padding: .48rem .35rem;
  border: 1px solid rgba(99,102,241,.2);
  border-radius: .68rem;
  background: rgba(255,255,255,.85);
  color: #4338ca;
  font-size: .74rem;
  font-weight: 800;
}
.need-actions button:hover { border-color: #818cf8; }
.need-actions button.correct {
  color: #047857;
  border-color: #34d399;
  background: rgba(209,250,229,.92);
}
.need-actions button.muted { opacity: .45; }
.stage-feedback {
  padding: .5rem .85rem;
  border-radius: .75rem;
  color: #9a3412;
  background: rgba(255,237,213,.9);
  font-size: .8rem;
  font-weight: 750;
}
.stage-feedback.success {
  color: #047857;
  background: rgba(209,250,229,.9);
}

.solution-builder {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: .75rem;
}
.solution-group {
  padding: .75rem;
  border: 1px solid rgba(217,119,6,.18);
  border-radius: 1rem;
  background: linear-gradient(150deg, rgba(255,251,235,.94), rgba(255,255,255,.76));
  box-shadow: 0 8px 22px rgba(146,64,14,.08);
}
.solution-group-title {
  display: grid;
  grid-template-columns: auto 1fr;
  align-items: center;
  column-gap: .4rem;
  margin-bottom: .55rem;
  color: #92400e;
}
.solution-group-title b { font-size: .9rem; }
.solution-group-title small {
  grid-column: 1 / -1;
  margin-top: .15rem;
  color: #9a5b20;
  font-size: .68rem;
  font-weight: 650;
}
.solution-option {
  display: block;
  width: 100%;
  margin-top: .38rem;
  padding: .55rem .6rem;
  border: 1px solid rgba(217,119,6,.2);
  border-radius: .7rem;
  background: rgba(255,255,255,.88);
  color: #713f12;
  font-size: .75rem;
  font-weight: 750;
  line-height: 1.35;
  text-align: left;
  transition: all .18s ease;
}
.solution-option:hover {
  border-color: #f59e0b;
  transform: translateY(-1px);
}
.solution-option.selected {
  color: #065f46;
  border-color: #10b981;
  background: rgba(209,250,229,.94);
  box-shadow: 0 0 0 2px rgba(16,185,129,.12);
}
.solution-result {
  display: flex;
  flex-direction: column;
  gap: .2rem;
  max-width: 42rem;
  padding: .62rem .9rem;
  border-radius: .8rem;
  font-size: .78rem;
  line-height: 1.45;
  text-align: center;
}
.solution-result.success {
  color: #047857;
  background: rgba(209,250,229,.92);
}
.solution-result.retry {
  color: #9a3412;
  background: rgba(255,237,213,.92);
}

.sentence-builder {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: .4rem;
  margin-bottom: .45rem;
  padding: .5rem .65rem;
  border: 1px solid rgba(13,148,136,.18);
  border-radius: .85rem;
  background: rgba(240,253,250,.72);
}
.sentence-builder-label {
  color: #0f766e;
  font-size: .76rem;
  font-weight: 900;
}
.sentence-builder button {
  padding: .36rem .55rem;
  border: 1px solid rgba(13,148,136,.2);
  border-radius: 999px;
  background: rgba(255,255,255,.9);
  color: #115e59;
  font-size: .7rem;
  font-weight: 750;
  transition: all .18s ease;
}
.sentence-builder button:hover,
.sentence-builder button.used {
  border-color: #2dd4bf;
  background: rgba(204,251,241,.95);
}
.sentence-builder small {
  width: 100%;
  color: #0f766e;
  font-size: .64rem;
  font-weight: 600;
}

@media (max-width: 1050px) {
  .solution-builder { grid-template-columns: 1fr; }
  .needs-board-head,
  .need-row { grid-template-columns: 1fr; }
  .needs-board-head span:last-child { display: none; }
}

.voice-input-status {
  width: fit-content;
  max-width: 100%;
  display: flex;
  align-items: center;
  gap: .4rem;
  margin: .4rem auto 0;
  padding: .35rem .75rem;
  color: #155e75;
  border: 1px solid rgba(8,145,178,.18);
  border-radius: 999px;
  background: rgba(236,254,255,.86);
  box-shadow: 0 4px 14px rgba(8,47,73,.07);
  font-size: .78rem;
  font-weight: 700;
}
.voice-input-status.listening {
  color: #9f1239;
  border-color: rgba(244,63,94,.24);
  background: rgba(255,228,230,.9);
}
.voice-input-status.error {
  color: #9a3412;
  border-color: rgba(249,115,22,.25);
  background: rgba(255,237,213,.92);
}
.voice-input-status.success {
  color: #047857;
  border-color: rgba(16,185,129,.24);
  background: rgba(209,250,229,.92);
}

@keyframes bounceIn { 0% { transform: scale(0.8); opacity: 0; } 60% { transform: scale(1.05); } 100% { transform: scale(1); opacity: 1; } }
.animate-bounce-in { animation: bounceIn 0.5s ease-out; }

/* 礼花粒子从上滑落 */
@keyframes confettiFall {
  0% { transform: translateY(-30px) rotate(0deg) scale(1); opacity: 0.9; }
  100% { transform: translateY(calc(50vh + 100px)) rotate(720deg) scale(0.2); opacity: 0; }
}

/* 结算覆盖层淡入动画 */
.confetti-overlay-enter-active { animation: overlayFadeIn 0.4s ease-out; }
.confetti-overlay-leave-active { animation: overlayFadeIn 0.25s ease-in reverse; }
@keyframes overlayFadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* 结算卡片从顶部滑入 */
.animate-slide-up { animation: slideUp 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both; }
@keyframes slideUp {
  from { opacity: 0; margin-top: -20px; }
  to { opacity: 1; margin-top: 0; }
}

/* 引导高亮 — 脉动闪烁 */
.guide-highlight {
  animation: guidePulse 0.8s ease-in-out infinite !important;
  box-shadow: 0 0 24px rgba(251, 191, 36, 0.7) !important;
}
@keyframes guidePulse {
  0%, 100% { transform: scale(1); box-shadow: 0 0 20px rgba(251, 191, 36, 0.5); }
  50% { transform: scale(1.08); box-shadow: 0 0 40px rgba(251, 191, 36, 0.95); }
}

/* NPC对话框窄滚动条 */
.scroll-thin::-webkit-scrollbar { width: 4px; }
.scroll-thin::-webkit-scrollbar-track { background: transparent; }
.scroll-thin::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.15); border-radius: 4px; }
</style>
