/**
 * Career Experience Simulator — Visual Novel Engine + Behavior Tracker + Report Renderer
 */
const API={
  async request(url,options){
    options=options||{};
    const studentToken=localStorage.getItem('career-student-token-v1')||'';
    options.headers=options.headers||{};
    if(studentToken)options.headers['X-Student-Token']=studentToken;
    const r=(window.Auth&&Auth.isLoggedIn())?await Auth.fetch(url,options):await fetch(url,options);
    if(!r.ok){const e=await r.json().catch(()=>({}));throw new Error(e.error||e.detail||'请求失败')}
    return r.json();
  },
  async get(url){return this.request(url,{})},
  async postForm(url,fd){return this.request(url,{method:'POST',body:fd})}
};

function showCoachTip(key,target,message,title='新手小提示',force=false){
  if(!target||(!force&&localStorage.getItem(key)))return;
  target.classList.add('coach-target');
  const layer=document.createElement('div');layer.className='coach-tip-layer';
  layer.innerHTML='<div class="coach-tip-card"><span class="coach-tip-icon">🧭</span><h3>'+title+'</h3><p>'+message+'</p><button type="button">我知道了</button></div>';
  document.body.appendChild(layer);
  layer.querySelector('button').onclick=()=>{localStorage.setItem(key,'1');target.classList.remove('coach-target');layer.remove();};
}
function showCurrentPageGuide(){
  const body=document.body;
  if(body.classList.contains('page-careers'))return showCoachTip('career-island-guide-v1',document.querySelector('.career-card'),'每座职业小岛都有不同体验。点击小岛后，可以选择情境对话或职业日常。','从职业小岛出发',true);
  if(window.VN_CONFIG)return showCoachTip('career-scenario-replay-guide-v1',document.getElementById('vn-hud'),'先阅读角色对话，再在出现的选项中选出你的行动；右上角“听一听”可以按需朗读。','这样体验情境',true);
  if(window.REPORT_CONFIG)return showCoachTip('career-report-guide-v1',document.getElementById('student-view-btn'),'这里展示的是本次体验中的观察线索，不是考试分数或职业推荐；也可以切换到“教师/家长观察”查看证据说明。','这样看报告',true);
  if(body.classList.contains('page-workday'))return showCoachTip('career-workday-replay-guide-v1',document.getElementById('wd-main'),'跟着阶段任务完成操作；遇到困难可以查看提示，完成后可继续进入同职业的情境体验。','这样体验职业日常',true);
}class VisualNovelEngine{
  constructor(){
    this.sessionId=null;this.scenarioIndex=0;this.scenarioData=null;this.progress=null;
    this.sessionInfo=null;this.scenarioRecordId=null;this.previousContext=[];
    this.state='idle';this.currentDialogueIndex=0;this.isTyping=false;this.typewriterTimeout=null;
    this.decisionStartTime=null;this.selectedChoice=null;this.modificationCount=0;this.timerInterval=null;
    this._choiceResult=null;this.voiceRecognition=null;this.isRecording=false;this.availableVoices=[];this.ttsAudio=null;this.speechToken=0;
    this.$sceneBg=document.getElementById('scene-bg');this.$sceneAtmosphere=document.getElementById('scene-atmosphere');
    this.$sceneLocation=document.getElementById('scene-location');this.$dialogueBox=document.getElementById('dialogue-box');
    this.$dialogueSpeaker=document.getElementById('dialogue-speaker');this.$dialogueText=document.getElementById('dialogue-text');
    this.$dialogueNext=document.getElementById('dialogue-next');this.$choicePanel=document.getElementById('choice-panel');
    this.$choicePrompt=document.getElementById('choice-prompt');this.$choiceButtons=document.getElementById('choice-buttons');
    this.$choiceTaskTitle=document.getElementById('choice-task-title');this.$choiceTaskCharacter=document.getElementById('choice-task-character');
    this.$choiceTimer=document.getElementById('choice-timer');this.$mentorPanel=document.getElementById('mentor-panel');
    this.$mentorName=document.getElementById('mentor-name');this.$mentorQuestion=document.getElementById('mentor-question');
    this.$transitionOverlay=document.getElementById('transition-overlay');this.$transitionTitle=document.getElementById('transition-title');
    this.$completionScreen=document.getElementById('completion-screen');this.$completionMessage=document.getElementById('completion-message');
    this.$reportLink=document.getElementById('report-link');this.$progressFill=document.getElementById('progress-fill');
    this.$progressText=document.getElementById('progress-text');this.$hudCareerName=document.getElementById('hud-career-name');
    this.$hudSceneTitle=document.getElementById('hud-scene-title');this.$voiceReadBtn=document.getElementById('voice-read-btn');this.$mentorVoiceBtn=document.getElementById('mentor-voice-btn');this.$voiceStatus=document.getElementById('voice-status');this.$mentorRoundTrack=document.getElementById('mentor-round-track');this.$mentorInstantFeedback=document.getElementById('mentor-instant-feedback');
  }
  async start(){
    const cfg=window.VN_CONFIG;if(!cfg){this.showError('缺少配置信息，请返回首页重新开始。');return}
    this.sessionId=cfg.sessionId;this.scenarioIndex=cfg.scenarioIndex;this.bindVoiceControls();this.loadPreferredVoices();
    try{await this.loadScenario()}catch(e){console.error(e);this.showError('加载情境失败，请检查网络后刷新页面。')}
  }
  async loadScenario(){
    this.hideAll();const d=await API.get('/api/scenario/'+this.sessionId+'/'+this.scenarioIndex);
    this.scenarioData=d.scenario;this.progress=d.progress;this.sessionInfo=d.session;
    this.scenarioRecordId=d.scenario_record_id;this.previousContext=d.previous_context||[];
    this.$hudCareerName.textContent=this.progress.career_name;
    this.$hudSceneTitle.textContent='情境 '+(this.scenarioData.index+1);
    this.$progressFill.style.width=(this.progress.current/this.progress.total*100)+'%';
    this.$progressText.textContent=this.progress.current+'/'+this.progress.total;
    this.renderChoiceTaskHeader();
    this.renderScene();this.renderLocation();this.renderAtmosphere();
    this.currentDialogueIndex=0;this.state='narrating';this.showNextDialogue();
    this.$dialogueBox.onclick=()=>this.onDialogueClick();
  }
  bindVoiceControls(){
    if(this.$voiceReadBtn)this.$voiceReadBtn.onclick=()=>this.readCurrentContent();
    if(this.$voiceReadBtn){const label=this.$voiceReadBtn.querySelector('span');if(label)label.textContent='听一听';this.$voiceReadBtn.title='点击后朗读当前内容';}
    if(this.$mentorVoiceBtn)this.$mentorVoiceBtn.onclick=()=>this.startVoiceInput();
    const supported=!!(window.SpeechRecognition||window.webkitSpeechRecognition);
    if(!supported&&this.$mentorVoiceBtn){this.$mentorVoiceBtn.disabled=true;this.$mentorVoiceBtn.title='\u8fd9\u4e2a\u6d4f\u89c8\u5668\u6682\u4e0d\u652f\u6301\u8bed\u97f3\u8f93\u5165';}
  }
  loadPreferredVoices(){
    if(!('speechSynthesis' in window))return;
    const load=()=>{this.availableVoices=window.speechSynthesis.getVoices();};
    load();window.speechSynthesis.onvoiceschanged=load;
  }
  preferredChineseVoice(){
    const voices=this.availableVoices.length?this.availableVoices:window.speechSynthesis.getVoices();
    const preferred=/xiaoxiao|xiaoyi|xiaohan|xiaomo|xiaoxuan|\u6653\u6653|\u6653\u4f0a|\u4e91\u5e0c|yunxi|meijia|\u7f8e\u5609|google.*\u4e2d\u6587|microsoft.*chinese/i;
    return voices.find(v=>preferred.test(v.name)&&/zh|chinese|\u4e2d\u6587/i.test(v.lang+' '+v.name)) || voices.find(v=>/zh|chinese|\u4e2d\u6587/i.test(v.lang+' '+v.name)) || null;
  }
  async speak(text,role='scene'){
    const clean=String(text||'').replace(/[🎯✨💡🔮🎙️]/g,'').replace(/\s+/g,' ').trim();if(!clean)return;
    const token=++this.speechToken;if(this.ttsAudio){this.ttsAudio.pause();this.ttsAudio=null;}if('speechSynthesis' in window)window.speechSynthesis.cancel();
    this.setVoiceStatus('🎧 星星导师正在准备更自然的声音…');
    try{const data=await API.get('/api/tts?role='+encodeURIComponent(role)+'&text='+encodeURIComponent(clean));if(token!==this.speechToken)return;const audio=new Audio(data.url+'?v='+Date.now());this.ttsAudio=audio;audio.onplay=()=>this.setVoiceStatus('🎧 正在用神经语音朗读');audio.onended=()=>{if(token===this.speechToken)this.setVoiceStatus('');};audio.onerror=()=>this.fallbackSpeak(clean,token);await audio.play();}
    catch(e){this.fallbackSpeak(clean,token);}
  }
  renderChoiceTaskHeader(){
    const roleArt={doctor:'/static/images/roles/doctor-character-v1.png',firefighter:'/static/images/roles/firefighter-character-v1.png',teacher:'/static/images/roles/teacher-character-v1.png',chef:'/static/images/roles/chef-character-v1.png',journalist:'/static/images/roles/journalist-character-v1.png',animal_caretaker:'/static/images/roles/animal_caretaker-character-v1.png'};
    if(this.$choiceTaskTitle)this.$choiceTaskTitle.textContent='第 '+(this.scenarioData.index+1)+' 关 · '+this.scenarioData.title;
    if(this.$choiceTaskCharacter){this.$choiceTaskCharacter.src=roleArt[this.progress.career_id]||roleArt.doctor;this.$choiceTaskCharacter.alt=this.progress.career_name+'任务伙伴';}
  }
  fallbackSpeak(text,token){
    if(token!==this.speechToken||!('speechSynthesis' in window)){this.setVoiceStatus('朗读暂时不可用，可以继续阅读文字。');return;}
    this.setVoiceStatus('当前网络不可用，已切换为本机朗读。');const utterance=new SpeechSynthesisUtterance(text);utterance.lang='zh-CN';const voice=this.preferredChineseVoice();if(voice)utterance.voice=voice;utterance.rate=.86;utterance.pitch=1.04;utterance.volume=1;window.speechSynthesis.speak(utterance);
  }
  readCurrentContent(){
    let text='';
    if(this.state==='narrating'){const d=this.scenarioData?.dialogues?.[this.currentDialogueIndex];text=d?(d.speaker+'?'+d.text):'';}
    else if(this.state==='choosing'){text=(this.scenarioData?.choice_prompt||'')+'?'+(this.scenarioData?.options||[]).map(o=>o.id+'?'+o.text).join('?');}
    else if(this.state==='mentor'){text=(this.$mentorQuestion?.textContent||'');}
    else{text=this.scenarioData?.scene?.atmosphere||'';}
    if(text)this.speak(text,this.state==='mentor'?'mentor':'scene');
  }
  setVoiceStatus(text){if(this.$voiceStatus)this.$voiceStatus.textContent=text;}
  startVoiceInput(){
    const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(!Recognition){this.setVoiceStatus('\u8fd9\u4e2a\u6d4f\u89c8\u5668\u6682\u4e0d\u652f\u6301\u8bed\u97f3\u8f93\u5165\uff0c\u8bf7\u76f4\u63a5\u6253\u5b57\u3002');return;}
    if(this.isRecording&&this.voiceRecognition){this.voiceRecognition.stop();return;}
    const answer=document.getElementById('mentor-answer');const recognition=new Recognition();
    this.voiceRecognition=recognition;this.isRecording=true;recognition.lang='zh-CN';recognition.continuous=false;recognition.interimResults=true;
    this.setVoiceStatus('\ud83c\udf99\ufe0f \u6b63\u5728\u542c\u4f60\u8bf4\u2026\u2026\u8bf7\u6e05\u695a\u5730\u8bf4\u51fa\u4f60\u7684\u60f3\u6cd5\u3002');if(this.$mentorVoiceBtn)this.$mentorVoiceBtn.classList.add('recording');
    recognition.onresult=(event)=>{let transcript='';for(let i=event.resultIndex;i<event.results.length;i++)transcript+=event.results[i][0].transcript;answer.value=transcript;this.setVoiceStatus('\u5df2\u8bc6\u522b\uff1a'+transcript);};
    recognition.onerror=()=>this.setVoiceStatus('\u6ca1\u6709\u542c\u6e05\uff0c\u53ef\u4ee5\u518d\u8bd5\u4e00\u6b21\u6216\u76f4\u63a5\u6253\u5b57\u3002');
    recognition.onend=()=>{this.isRecording=false;if(this.$mentorVoiceBtn)this.$mentorVoiceBtn.classList.remove('recording');};
    recognition.start();
  }
  renderScene(){
    const g={'bg-clinic':'linear-gradient(135deg, #e0f7fa, #b2ebf2)','bg-clinic-urgent':'linear-gradient(135deg, #ffebee, #ef9a9a)','bg-clinic-hall':'linear-gradient(135deg, #f3e5f5, #e1bee7)','bg-clinic-meeting':'linear-gradient(135deg, #e8eaf6, #c5cae9)','bg-fire-station':'linear-gradient(135deg, #ffebee, #ffcdd2)','bg-fire-scene':'linear-gradient(135deg, #ff5722, #bf360c)','bg-fire-aftermath':'linear-gradient(135deg, #fff3e0, #ffe0b2)','bg-community-center':'linear-gradient(135deg, #e8f5e9, #c8e6c9)','bg-classroom':'linear-gradient(135deg, #fff9e6, #fff3cd)','bg-playground':'linear-gradient(135deg, #e3f2fd, #bbdefb)','bg-office':'linear-gradient(135deg, #f3e5f5, #e1bee7)','bg-kitchen':'linear-gradient(135deg, #fff3e0, #ffe0b2)','bg-kitchen-busy':'linear-gradient(135deg, #fff8e1, #ffecb3)','bg-restaurant':'linear-gradient(135deg, #fce4ec, #f8bbd0)','bg-newsroom':'linear-gradient(135deg, #ede7f6, #d1c4e9)','bg-street':'linear-gradient(135deg, #e8f5e9, #c8e6c9)','bg-archive':'linear-gradient(135deg, #efebe9, #d7ccc8)','bg-shelter':'linear-gradient(135deg, #e8f5e9, #c8e6c9)','bg-shelter-cat':'linear-gradient(135deg, #f3e5f5, #e1bee7)','bg-community':'linear-gradient(135deg, #e3f2fd, #bbdefb)','bg-shelter-yard':'linear-gradient(135deg, #fff3e0, #ffe0b2)'};
    const fallback=g[this.scenarioData.scene.bg_class]||'linear-gradient(135deg, #FFF0D6, #CDEEF0)';
    /* 情境背景使用高清 WebP：宽度 1440px，可覆盖高像素密度手机，仍比原 PNG 小很多。 */
    const sourceImage=this.scenarioData.scene.image;
    /* 新生成的逐情境图使用原始 PNG；旧职业通用图仍优先使用高清 WebP。 */
    const image=sourceImage?(sourceImage.includes('-v2.png')?sourceImage:sourceImage.replace(/\.png$/i,'-hd.webp')):null;
    this.$sceneBg.style.background=image?`linear-gradient(rgba(255,255,255,.08), rgba(255,245,225,.12)), url("${image}") center / cover no-repeat`:fallback;
  }
  renderLocation(){
    const s=this.scenarioData.scene;
    this.$sceneLocation.innerHTML='<span>&#128205; '+s.location+'</span><span style="margin-left:12px">&#128339; '+s.time+'</span>';
  }
  renderAtmosphere(){this.$sceneAtmosphere.textContent=this.scenarioData.scene.atmosphere;this.$sceneAtmosphere.style.display='block'}
  showNextDialogue(){
    const d=this.scenarioData.dialogues;
    if(this.currentDialogueIndex>=d.length){this.showChoices();return}
    const dl=d[this.currentDialogueIndex];
    this.$dialogueBox.style.display='block';this.$dialogueSpeaker.textContent=dl.speaker;
    this.$dialogueNext.style.display='none';this.$choicePanel.style.display='none';this.state='narrating';
    this.typewriter(this.$dialogueText,dl.text,()=>{this.$dialogueNext.style.display='block'});
  }
  typewriter(el,text,cb){this.isTyping=true;el.textContent='';let i=0;const s=35;const t=()=>{if(i<text.length){el.textContent+=text.charAt(i);i++;this.typewriterTimeout=setTimeout(t,s)}else{this.isTyping=false;if(cb)cb()}};t()}
  onDialogueClick(){
    if(this.state!=='narrating')return;
    if(this.isTyping){clearTimeout(this.typewriterTimeout);this.isTyping=false;this.$dialogueText.textContent=this.scenarioData.dialogues[this.currentDialogueIndex].text;this.$dialogueNext.style.display='block';return}
    this.currentDialogueIndex++;this.showNextDialogue();
  }
  showChoices(){
    this.$dialogueBox.style.display='none';this.$sceneAtmosphere.style.display='none';
    this.$choicePanel.style.display='block';this.$choicePrompt.textContent=this.scenarioData.choice_prompt;
    this.$choiceButtons.innerHTML='';this.selectedChoice=null;this.modificationCount=0;
    const oldPreview=this.$choicePanel.querySelector('.choice-consequence-preview');if(oldPreview)oldPreview.remove();
    this.decisionStartTime=Date.now();this.state='choosing';
    this.updateTimer();this.timerInterval=setInterval(()=>this.updateTimer(),1000);
    this.scenarioData.options.forEach((o,index)=>{const b=document.createElement('button');b.type='button';b.className='choice-btn';b.innerHTML='<span class="choice-label">'+o.id+'</span><span class="choice-copy"><b>行动方案 '+(index+1)+'</b><span>'+o.text+'</span><small>先看看可能的变化 →</small></span>';b.addEventListener('click',()=>this.selectChoice(o,b));this.$choiceButtons.appendChild(b)});this.showChoiceGuide();
  }
  showChoiceGuide(){
    if(localStorage.getItem('career-choice-guide-v1'))return;
    this.$choicePanel.classList.add('newbie-choice-mode');
    const note=document.createElement('div');note.className='choice-guide';note.id='choice-guide';note.innerHTML='&#128161; <b>\u65b0\u624b\u5c0f\u63d0\u793a</b>\uff1a\u5148\u8bfb\u4e00\u8bfb\u6bcf\u4e2a\u65b9\u6848\uff0c\u9009\u4e00\u4e2a\u4f60\u6700\u60f3\u5c1d\u8bd5\u7684\u505a\u6cd5\u3002\u8fd9\u91cc\u6ca1\u6709\u552f\u4e00\u6b63\u786e\u7b54\u6848\u54e6\uff01';
    this.$choicePrompt.insertAdjacentElement('afterend',note);
  }
  dismissChoiceGuide(){
    const note=document.getElementById('choice-guide');if(note)note.remove();this.$choicePanel.classList.remove('newbie-choice-mode');localStorage.setItem('career-choice-guide-v1','1');
  }
  updateTimer(){if(!this.decisionStartTime)return;const e=Math.floor((Date.now()-this.decisionStartTime)/1000);this.$choiceTimer.textContent='已用时间：'+e+' 秒'}
  selectChoice(o,b){
    if(this.state!=='choosing')return;this.dismissChoiceGuide();
    if(this.selectedChoice!==null&&this.selectedChoice.id!==o.id)this.modificationCount++;
    this.selectedChoice=o;document.querySelectorAll('.choice-btn').forEach(x=>x.classList.remove('selected'));b.classList.add('selected');
    this.showChoicePreview();
  }
  showChoicePreview(){
    const previous=this.$choicePanel.querySelector('.choice-consequence-preview');if(previous)previous.remove();
    const indicators=this.selectedChoice?.indicators||{};
    const primary=Object.keys(indicators).sort((a,b)=>indicators[b]-indicators[a])[0]||'';
    const feedback={empathy:['安心一点','角色感到自己被认真看见了。'],communication:['听明白了','大家更容易理解你准备怎么做。'],collaboration:['一起行动','伙伴知道可以怎样和你配合。'],problem_solving:['有新办法','这个方案给难题打开了一条路。'],critical_thinking:['线索更清楚','你先补上了重要信息。'],decision_making:['行动开始','团队可以带着这个决定往前走。'],creativity:['有意思！','这个做法带来了新的可能。'],emotional_management:['慢慢稳住','紧张的现场有机会更平稳一些。']}[primary]||['收到啦','这个方案会带来新的信息和变化。'];
    const card=document.createElement('div');card.className='choice-consequence-preview';
    card.innerHTML='<div class="consequence-buddy"><img src="'+(this.$choiceTaskCharacter?.src||'')+'" alt=""><span>角色小反馈</span></div><div class="consequence-copy"><b>'+feedback[0]+'</b><p>'+feedback[1]+' '+(this.selectedChoice?.possible_outcome||'接下来可以继续观察它会带来什么影响。')+'</p></div><div class="consequence-actions"><button type="button" class="consequence-change">换个方案想想</button><button type="button" class="consequence-confirm">带着这个方案继续 →</button></div>';
    this.$choiceButtons.insertAdjacentElement('afterend',card);
    card.querySelector('.consequence-change').onclick=()=>{card.remove();this.state='choosing';};
    card.querySelector('.consequence-confirm').onclick=()=>this.confirmChoice();
  }
  async confirmChoice(){
    if(!this.selectedChoice)return;this.state='chosen';clearInterval(this.timerInterval);
    const dt=Date.now()-this.decisionStartTime;this.$choicePanel.style.display='none';
    try{
      const fd=new FormData();fd.append('choice_id',this.selectedChoice.id);
      fd.append('choice_text',this.selectedChoice.text);
      fd.append('choice_index',this.scenarioData.options.findIndex(o=>o.id===this.selectedChoice.id));
      fd.append('decision_time_ms',dt);fd.append('modification_count',this.modificationCount);
      const r=await API.postForm('/api/scenario/'+this.sessionId+'/'+this.scenarioIndex+'/choose',fd);
      this.showChoiceReflection(r);
    }catch(e){console.error(e);this.showError('提交选择失败，请重试。')}
  }
  showChoiceReflection(r){
    const indicators=this.selectedChoice?.indicators||{};
    const labels={creativity:'\u521b\u9020\u6027\u601d\u8003',critical_thinking:'\u5206\u6790\u548c\u5224\u65ad',communication:'\u6c9f\u901a',collaboration:'\u56e2\u961f\u534f\u4f5c',empathy:'\u5173\u5fc3\u4ed6\u4eba',problem_solving:'\u89e3\u51b3\u95ee\u9898',decision_making:'\u505a\u51b3\u5b9a',emotional_management:'\u4fdd\u6301\u51b7\u9759'};
    const focuses=Object.keys(indicators).sort((a,b)=>indicators[b]-indicators[a]).slice(0,2).map(k=>labels[k]).filter(Boolean);
    const card=document.createElement('div');card.className='choice-reflection';
    const line=this.selectedChoice?.possible_outcome|| (focuses.length?'\u4f60\u4f18\u5148\u5173\u6ce8\u4e86\uff1a'+focuses.join('\u3001')+'\u3002':'\u4f60\u9009\u62e9\u4e86\u4e00\u79cd\u5e94\u5bf9\u65b9\u5f0f\u3002');
    card.innerHTML='<div class="choice-reflection-card"><span class="reflection-icon">&#127919;</span><h3>\u53ef\u80fd\u51fa\u73b0\u7684\u7ed3\u679c</h3><p>'+line+'</p><p class="reflection-question">\u60f3\u4e00\u60f3\uff1a\u8fd9\u4e2a\u91cd\u70b9\u4f1a\u5bf9\u63a5\u4e0b\u6765\u7684\u4efb\u52a1\u4ea7\u751f\u4ec0\u4e48\u5f71\u54cd\uff1f</p><button type="button">\u7ee7\u7eed\u4e0e\u5bfc\u5e08\u804a\u804a &#8594;</button></div>';
    document.getElementById('vn-app').appendChild(card);
    card.querySelector('button').onclick=()=>{card.remove();if(r.has_follow_up&&r.follow_up_question)this.showMentorQuestion(r);else this.advanceScenario(r);};
  }
  mentorFocusText(){
    const labels={creativity:'\u521b\u9020\u6027\u601d\u8003',critical_thinking:'\u5206\u6790\u548c\u5224\u65ad',communication:'\u6c9f\u901a',collaboration:'\u56e2\u961f\u534f\u4f5c',empathy:'\u5173\u5fc3\u4ed6\u4eba',problem_solving:'\u89e3\u51b3\u95ee\u9898',decision_making:'\u505a\u51b3\u5b9a',emotional_management:'\u4fdd\u6301\u51b7\u9759'};
    const indicators=this.selectedChoice?.indicators||{};const names=Object.keys(indicators).sort((a,b)=>indicators[b]-indicators[a]).slice(0,2).map(k=>labels[k]).filter(Boolean);
    return names.length?'\u6211\u770b\u5230\u4f60\u7684\u521d\u6b65\u60f3\u6cd5\u91cc\uff0c\u5173\u6ce8\u4e86'+names.join('\u3001')+'\u3002':'\u6211\u770b\u5230\u4f60\u5148\u505a\u51fa\u4e86\u81ea\u5df1\u7684\u5224\u65ad\u3002';
  }
  renderMentorTrack(active){
    if(!this.$mentorRoundTrack)return;
    const steps=['\u521d\u6b65\u60f3\u6cd5','\u5bfc\u5e08\u8ffd\u95ee','\u8865\u5145\u4e0e\u5c0f\u7ed3'];
    this.$mentorRoundTrack.innerHTML=steps.map((name,i)=>'<div class="mentor-round '+(i+1<active?'done':i+1===active?'active':'')+'"><span>'+((i+1<active)?'\u2713':(i+1))+'</span><b>'+name+'</b></div>').join('<i></i>');
  }
  showMentorQuestion(r){
    this.state='mentor';this.$mentorPanel.style.display='block';this.$mentorPanel.classList.remove('mentor-summary-mode');
    this.$mentorName.textContent=r.mentor_name||'\u661f\u661f\u5bfc\u5e08';this.renderMentorTrack(2);
    if(this.$mentorInstantFeedback)this.$mentorInstantFeedback.innerHTML='<b>\u5bfc\u5e08\u5148\u8bf4</b><span>'+this.mentorFocusText()+'\u6211\u60f3\u542c\u542c\u4f60\u66f4\u5177\u4f53\u7684\u7406\u7531\u3002</span>';
    this.$mentorQuestion.style.display='block';this.$mentorQuestion.textContent=r.follow_up_question;showCoachTip('career-mentor-guide-v1',this.$mentorPanel,'\u5bfc\u5e08\u4f1a\u5148\u770b\u89c1\u4f60\u7684\u521d\u6b65\u60f3\u6cd5\uff0c\u518d\u95ee\u4e00\u4e2a\u5c0f\u95ee\u9898\u3002\u4f60\u53ef\u4ee5\u6253\u5b57\u3001\u8bed\u97f3\u56de\u7b54\uff0c\u4e5f\u53ef\u4ee5\u8df3\u8fc7\u3002','\u548c AI \u5bfc\u5e08\u804a\u804a');
    const form=document.getElementById('mentor-form');form.style.display='block';document.getElementById('mentor-answer').value='';document.getElementById('mentor-answer').focus();this._choiceResult=r;
  }
  showMentorSummary(r,answer){
    this.state='mentor-summary';this.$mentorPanel.style.display='block';this.$mentorPanel.classList.add('mentor-summary-mode');this.renderMentorTrack(3);
    this.$mentorQuestion.style.display='none';document.getElementById('mentor-form').style.display='none';
    if(this.$mentorInstantFeedback)this.$mentorInstantFeedback.innerHTML='<div class="mentor-student-note"><b>\u4f60\u7684\u8865\u5145\u60f3\u6cd5</b><p>'+answer.replace(/</g,'&lt;').replace(/>/g,'&gt;')+'</p></div><div class="mentor-summary-note"><b>'+ (this._choiceResult?.mentor_name||'\u661f\u661f\u5bfc\u5e08') +'\u7684\u5c0f\u7ed3</b><p>'+ (r.mentor_feedback||'\u4f60\u613f\u610f\u8865\u5145\u81ea\u5df1\u7684\u60f3\u6cd5\uff0c\u8fd9\u5f88\u91cd\u8981\u3002') +'</p><button type="button" class="mentor-summary-next">\u8fdb\u5165\u4e0b\u4e00\u4e2a\u60c5\u5883 \u2192</button></div>';
    const next=this.$mentorInstantFeedback?.querySelector('.mentor-summary-next');if(next)next.onclick=()=>this.advanceScenario(r);
  }
  async submitMentorAnswer(e){
    if(e)e.preventDefault();const a=document.getElementById('mentor-answer').value.trim();if(!a)return;
    document.getElementById('mentor-form').style.display='none';
    try{
      const fd=new FormData();fd.append('answer_text',a);fd.append('choice_record_id',this._choiceResult?.choice_record_id||'');
      const r=await API.postForm('/api/scenario/'+this.sessionId+'/'+this.scenarioIndex+'/follow-up',fd);
      if(r.safety_action&&r.safety_action!=='continue')this.showSafetyNotice(r);else this.showMentorSummary(r,a);
    }catch(ex){this.advanceScenario(this._choiceResult)}
  }
  showSafetyNotice(r){
    const isPause=r.safety_action==='pause';
    this.state=isPause?'safety-paused':'mentor-safety-notice';this.$mentorPanel.style.display='block';this.$mentorPanel.classList.add('mentor-summary-mode');
    this.$mentorQuestion.style.display='none';document.getElementById('mentor-form').style.display='none';
    if(this.$mentorRoundTrack)this.$mentorRoundTrack.innerHTML='';
    const title=isPause?'先暂停一下':'小小安全提醒';
    const button=isPause?'<a class="mentor-safety-button" href="/careers">回到职业小岛</a>':'<button type="button" class="mentor-safety-button">我知道了，继续体验</button>';
    if(this.$mentorInstantFeedback)this.$mentorInstantFeedback.innerHTML='<div class="mentor-safety-notice"><span>💛</span><div><b>'+title+'</b><p>'+((r.input_safety_message||r.mentor_feedback||'请先保护好自己，并向可信任的大人求助。').replace(/</g,'&lt;').replace(/>/g,'&gt;'))+'</p><small>'+ (isPause?'这段内容不会进入能力评价。':'这段内容不会进入能力评价，之后也请避免留下个人信息。') +'</small>'+button+'</div></div>';
    const continueBtn=this.$mentorInstantFeedback?.querySelector('button');if(continueBtn)continueBtn.onclick=()=>this.advanceScenario(r);
  }
  skipMentor(){this.$mentorPanel.style.display='none';document.getElementById('mentor-answer').value='';this.advanceScenario(this._choiceResult)}
  advanceScenario(r){
    if(r.is_last_scenario)this.showCompletion();
    else if(r.next_scenario_index!=null)this.showTransition(r.next_scenario_index);
    else this.showCompletion();
  }
  showTransition(ni){
    this.state='transitioning';this.$transitionTitle.textContent='情境 '+(ni+1);
    this.$transitionOverlay.style.display='flex';
    setTimeout(()=>{window.location.href='/scenario/'+this.sessionId+'/'+ni},1500);
  }
  showCompletion(){
    this.state='complete';this.$completionScreen.style.display='flex';
    this.$completionMessage.textContent='你完成了「'+this.progress.career_name+'」的全部'+this.progress.total+'个情境体验！';
    this.$reportLink.href='/report/'+this.sessionId;
  }
  hideAll(){
    this.$dialogueBox.style.display='none';this.$choicePanel.style.display='none';
    this.$mentorPanel.style.display='none';this.$transitionOverlay.style.display='none';
    this.$completionScreen.style.display='none';this.$sceneAtmosphere.style.display='none';
  }
  showError(m){
    this.hideAll();this.$sceneBg.style.background='#1a1a2e';this.$sceneLocation.innerHTML='';
    this.$sceneAtmosphere.style.display='block';
    this.$sceneAtmosphere.innerHTML='<span style="color:#ff6b6b">&#9888; '+m+'</span><br><br><a href="/careers" style="color:#FFD93D">返回重新选择职业</a>';
  }
}

class ReportPage{
  constructor(){this.sessionId=null}
  async start(){
    const cfg=window.REPORT_CONFIG;if(!cfg)return;this.sessionId=cfg.sessionId;
    try{
      this.startConfetti();
      await this.syncWorkdayProcess();
      const rd=await API.get('/api/report/'+this.sessionId);
      if(rd.report_mode&&rd.report_mode!=='ready'){this.renderPausedReport(rd);return;}
      const sd=await API.get('/api/session/'+this.sessionId+'/scenarios');
      this.markCareerExplored(rd);
      this.renderCeremony(rd);this.renderJourney(sd);this.renderRadarCharts(rd);
      this.renderStrengths(rd);this.renderGrowthAreas(rd);this.renderMessage(rd);this.renderWorkdayEvidence(rd);
      this.renderCrossValidation(rd);this.renderAnomalies(rd);this.renderCertificate(rd,sd);this.setupReportViews(rd);setTimeout(()=>showCoachTip('career-report-guide-v1',document.getElementById('student-view-btn'),'\u8fd9\u91cc\u5c55\u793a\u7684\u662f\u672c\u6b21\u4f53\u9a8c\u4e2d\u7684\u89c2\u5bdf\u7ebf\u7d22\uff0c\u4e0d\u662f\u8003\u8bd5\u5206\u6570\uff0c\u4e5f\u4e0d\u662f\u804c\u4e1a\u63a8\u8350\u3002\u53ef\u4ee5\u70b9\u201c\u6559\u5e08/\u5bb6\u957f\u89c2\u5bdf\u201d\u67e5\u770b\u8bc1\u636e\u8bf4\u660e\u3002','\u600e\u4e48\u770b\u62a5\u544a'));
    }catch(e){console.error(e);document.getElementById('ceremony-career').textContent='报告加载中，请稍候...'}
  }
  renderPausedReport(d){
    this.renderCeremony(d);
    const message=document.getElementById('message-text');
    if(message)message.textContent=d.student_message||'这次暂时不生成能力观察。';
    document.querySelectorAll('.report-student-section').forEach(x=>{if(!x.classList.contains('message-section'))x.hidden=true;});
    const section=document.getElementById('anomaly-section'),notes=document.getElementById('anomaly-notes');
    if(section&&notes){section.style.display='block';notes.innerHTML='<p>本次体验已暂停普通能力报告：'+(d.student_message||'')+'</p>';}
  }
  async syncWorkdayProcess(){
    try{
      const records=[];for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i)||'';if(!key.startsWith('career-workday-process-'))continue;const raw=localStorage.getItem(key);if(raw)records.push(JSON.parse(raw));}
      for(const payload of records){await fetch('/api/session/'+this.sessionId+'/workday-process',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}).catch(()=>null);}
    }catch(e){}
  }
  markCareerExplored(d){
    const names={"社区医生":"doctor","医生":"doctor","消防员":"firefighter","小学教师":"teacher","教师":"teacher","餐厅厨师":"chef","报社记者":"journalist","动物保护员":"animal_caretaker"};
    const careerId=d.career_id||names[d.career_name];if(!careerId)return;
    try{const key='career-explored-v1';const saved=JSON.parse(localStorage.getItem(key)||'[]');const next=Array.from(new Set([...saved,careerId]));localStorage.setItem(key,JSON.stringify(next));}catch(e){}
    try{const mapKey='career-session-map-v1';const map=JSON.parse(localStorage.getItem(mapKey)||'{}');map[careerId]=this.sessionId;localStorage.setItem(mapKey,JSON.stringify(map));}catch(e){}if(typeof Auth!=='undefined'&&Auth.isLoggedIn()){Auth.fetch('/api/user/mark-explored',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({career_id:careerId,session_id:this.sessionId})}).catch(function(){});}
  }
  renderWorkdayEvidence(d){
    const section=document.getElementById('workday-evidence-section'),card=document.getElementById('workday-evidence-card'),wd=d.workday_evidence||{};if(!section||!card||!wd.available)return;
    const esc=value=>String(value||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');section.hidden=false;
    const metrics=(wd.metrics||[]).map(item=>'<span><b>'+esc(item.value)+'</b>'+esc(item.label)+'</span>').join('');
    card.innerHTML='<div class="workday-evidence-card"><div class="workday-evidence-head"><span>\u{1F331}</span><div><b>'+esc(wd.career||'\u804c\u4e1a\u65e5\u5e38')+'\u7684\u4f53\u9a8c\u8fc7\u7a0b</b><small>\u8f85\u52a9\u89c2\u5bdf\u00b7\u4e0d\u8ba1\u5165\u80fd\u529b\u5206\u6570</small></div></div><p>'+esc(wd.student_summary)+'</p><div class="workday-metrics">'+metrics+'</div><div class="workday-boundary">\u{1F50D} '+esc(wd.boundary_note)+'</div></div>';
  }  renderCeremony(d){
    document.getElementById('ceremony-career').textContent='祝贺你完成了「'+(d.career_name||'')+'」职业体验';
    document.getElementById('ceremony-name').textContent=d.student_name||'';
    const dt=new Date(d.generated_at||Date.now());
    document.getElementById('ceremony-date').textContent=dt.getFullYear()+'年'+(dt.getMonth()+1)+'月'+dt.getDate()+'日';
  }
  setupReportViews(d){
    const studentBtn=document.getElementById('student-view-btn'),teacherBtn=document.getElementById('teacher-view-btn'),teacherSection=document.getElementById('teacher-evidence-section');
    if(!studentBtn||!teacherBtn||!teacherSection)return;
    const showStudent=()=>{teacherSection.hidden=true;document.querySelectorAll('.report-student-section').forEach(x=>x.hidden=false);studentBtn.classList.add('active');teacherBtn.classList.remove('active');};
    const showTeacher=()=>{teacherSection.hidden=false;document.querySelectorAll('.report-student-section').forEach(x=>x.hidden=true);teacherBtn.classList.add('active');studentBtn.classList.remove('active');};
    studentBtn.onclick=showStudent;teacherBtn.onclick=showTeacher;
    const list=document.getElementById('teacher-evidence-list');const chains=d.teacher_evidence||[];const wd=d.workday_evidence||{},dc=d.developmental_context||{};
    const developmentalCard=dc.label?'<article class="teacher-evidence-card developmental-context-card"><div class="teacher-card-head"><b>年龄发展解释</b><span class="teacher-evidence-level">'+dc.label+'</span></div><p class="teacher-claim"><strong>'+dc.age+'岁学生的观察重点：</strong>'+dc.teacher_note+'</p><p class="teacher-coverage">这项说明用于校准证据解释，不参与学生排名，也不直接加减能力分数。</p></article>':'';
    const processCard=wd.available?'<article class="teacher-evidence-card teacher-process-card"><div class="teacher-card-head"><b>职业日常过程观察</b><span class="teacher-evidence-level">辅助证据</span></div><p class="teacher-claim"><strong>记录内容：</strong>'+(wd.student_summary||'')+'</p><p class="teacher-coverage">'+(wd.teacher_note||'')+'</p></article>':'';
    list.innerHTML=developmentalCard+processCard+chains.map(chain=>{
      const traces=(chain.traces||[]).map(t=>'<li><b>'+t.scenario+'</b><span>'+t.actions.join('\u3001')+'</span>'+(t.answer?'<em>\u5b66\u751f\u8868\u8fbe\uff1a'+t.answer+'</em>':'')+'</li>').join('');
      const claim=(chain.claims||[]).join('\u3001')||'\u672c\u6b21\u6682\u672a\u83b7\u5f97\u76f4\u63a5\u4efb\u52a1\u8bc1\u636e\u3002';
      return '<article class="teacher-evidence-card"><div class="teacher-card-head"><b>'+chain.dimension+'</b><span class="teacher-evidence-level">'+chain.level+'</span></div><p class="teacher-claim"><strong>\u4efb\u52a1\u4e3b\u5f20\uff1a</strong>'+claim+'</p><p class="teacher-coverage">\u8de8\u60c5\u5883\u8986\u76d6\uff1a'+chain.coverage+' \u4e2a</p>'+(traces?'<details><summary>\u67e5\u770b\u884c\u4e3a\u8bc1\u636e</summary><ul>'+traces+'</ul></details>':'<p class="teacher-empty">\u5efa\u8bae\u5728\u540e\u7eed\u76f8\u5173\u60c5\u5883\u4e2d\u7ee7\u7eed\u89c2\u5bdf\u3002</p>')+'</article>';
    }).join('');
  }
  renderJourney(d){
    const c=document.getElementById('journey-timeline');if(!c||!d.scenarios)return;
    c.innerHTML=d.scenarios.map((s,i)=>'<div class="journey-item"><div class="journey-scene-header"><span class="journey-scene-title">情境'+(i+1)+'：'+s.title+'</span><span class="journey-scene-location">'+(s.scene?.location||'')+' · '+(s.scene?.time||'')+'</span></div><div class="journey-choice"><div class="journey-choice-label">你的选择</div><div class="journey-choice-text">'+(s.choice_made?.text||'未选择')+'</div></div><div class="journey-stats"><span>&#9201; 决策用时：'+(s.choice_made?.decision_time_seconds||0)+'秒</span>'+(s.choice_made?.modifications>0?'<span>&#128260; 修改了'+s.choice_made.modifications+'次</span>':'')+'</div>'+(s.mentor_question?'<div class="journey-mentor">&#128302; 导师问：'+s.mentor_question+'<br>&#128172; 你回答：'+(s.student_answer||'...')+'</div>':'')+'</div>').join('');
  }
  renderRadarCharts(d){
    this.drawRadar('radar-intelligence',d.aggregated_intelligence||d.intelligence_scores||{},['语言智能','逻辑数学','空间智能','身体运动','音乐智能','人际智能','内省智能','自然观察']);
    this.drawRadar('radar-literacy',d.aggregated_literacy||d.literacy_scores||{},['创造力','批判思维','沟通能力','协作能力','同理心','解决问题','决策力','情绪管理']);
  }
  drawRadar(sid,scores,labels){
    const svg=document.getElementById(sid);if(!svg)return;
    const keys=Object.keys(scores);const cx=150,cy=150,r=110;const n=labels.length;const legend=document.getElementById(sid+'-labels');if(legend){legend.innerHTML=labels.map((label,i)=>'<span><i class="radar-dot radar-dot-'+(i%4)+'"></i>'+label+'</span>').join('');}
    const vals=labels.map(l=>{const k=keys.find(k=>{const kl=k.toLowerCase();return(l.includes('语言')&&kl.includes('lingui'))||(l.includes('逻辑')&&kl.includes('logical'))||(l.includes('空间')&&kl.includes('spatial'))||(l.includes('身体')&&kl.includes('bodily'))||(l.includes('音乐')&&kl.includes('musical'))||(l.includes('人际')&&kl.includes('interpersonal'))||(l.includes('内省')&&kl.includes('intrapersonal'))||(l.includes('自然')&&kl.includes('natural'))||(l.includes('创造')&&kl.includes('creativity'))||(l.includes('批判')&&kl.includes('critical'))||(l.includes('沟通')&&kl.includes('communication'))||(l.includes('协作')&&kl.includes('collaboration'))||(l.includes('同理')&&kl.includes('empathy'))||(l.includes('解决')&&kl.includes('problem'))||(l.includes('决策')&&kl.includes('decision'))||(l.includes('情绪')&&kl.includes('emotional'))});return k?(scores[k]||2.5):2.5});
    let h='';for(let lv=1;lv<=5;lv++){const lr=r*lv/5;const ps=[];for(let i=0;i<n;i++){const a=Math.PI*2*i/n-Math.PI/2;ps.push((cx+lr*Math.cos(a))+','+(cy+lr*Math.sin(a)))}h+='<polygon points="'+ps.join(' ')+'" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>'}
    for(let i=0;i<n;i++){const a=Math.PI*2*i/n-Math.PI/2;h+='<line x1="'+cx+'" y1="'+cy+'" x2="'+(cx+r*Math.cos(a))+'" y2="'+(cy+r*Math.sin(a))+'" stroke="rgba(255,255,255,0.1)" stroke-width="1"/>'}
    const dps=[];for(let i=0;i<n;i++){const a=Math.PI*2*i/n-Math.PI/2;const d=r*vals[i]/5;dps.push((cx+d*Math.cos(a))+','+(cy+d*Math.sin(a)))}h+='<polygon points="'+dps.join(' ')+'" fill="rgba(255,217,61,0.15)" stroke="#FFD93D" stroke-width="2"/>';
    for(let i=0;i<n;i++){const a=Math.PI*2*i/n-Math.PI/2;const d=r*vals[i]/5;h+='<circle cx="'+(cx+d*Math.cos(a))+'" cy="'+(cy+d*Math.sin(a))+'" r="4" fill="#FFD93D"/>'}
    for(let i=0;i<n;i++){const a=Math.PI*2*i/n-Math.PI/2;const lx=cx+(r+25)*Math.cos(a);const ly=cy+(r+25)*Math.sin(a);const an=lx<cx-10?'end':lx>cx+10?'start':'middle';h+='<text x="'+lx+'" y="'+ly+'" text-anchor="'+an+'" fill="#7B6452" font-size="10">'+labels[i]+'</text>'}
    svg.innerHTML=h;
  }
  renderStrengths(d){
    const c=document.getElementById('strengths-grid');if(!c||!d.strengths)return;
    const evidence=d.evidence_summary||{};
    c.innerHTML=d.strengths.map((s,i)=>{
      const ev=evidence[s.name]||{};
      const level=ev.level||'\u521d\u6b65\u7ebf\u7d22';
      const detail=ev.detail||'\u8fd9\u662f\u672c\u6b21\u4f53\u9a8c\u4e2d\u6536\u96c6\u5230\u7684\u4e00\u6761\u89c2\u5bdf\u7ebf\u7d22\u3002';
      return '<div class="strength-card"><div class="strength-rank">'+(i+1)+'</div><div class="strength-name">'+s.name+'</div><div class="evidence-level">&#128269; \u672c\u6b21\u89c2\u5bdf\uff1a'+level+'</div><div class="strength-desc">'+s.description+'</div><div class="strength-evidence"><b>\u6211\u4eec\u4e3a\u4ec0\u4e48\u8fd9\u6837\u53d1\u73b0\uff1f</b><span>'+detail+'</span></div></div>';
    }).join('');
  }
  renderGrowthAreas(d){const c=document.getElementById('growth-cards');if(!c||!d.growth_areas)return;c.innerHTML=d.growth_areas.map(g=>'<div class="growth-card"><div class="growth-name">&#127793; '+g.name+'</div><div class="growth-suggestion">'+g.suggestion+'</div></div>').join('')}
  renderMessage(d){const e=document.getElementById('message-text');if(e&&d.personalized_message)e.textContent=d.personalized_message}
  renderCrossValidation(d){const s=document.getElementById('cross-section');const e=document.getElementById('cross-notes');if(s&&e&&d.cross_validation_notes){s.style.display='block';e.textContent=d.cross_validation_notes}}
  renderAnomalies(d){const s=document.getElementById('anomaly-section');const e=document.getElementById('anomaly-notes');if(s&&e&&d.anomalies&&d.anomalies.length>0){s.style.display='block';e.innerHTML=d.anomalies.map(a=>'<p style="margin-bottom:8px">&#128161; '+a+'</p>').join('')}}
  renderCertificate(d,sd){document.getElementById('cert-name').textContent=d.student_name||'';const dt=new Date(d.generated_at||Date.now());document.getElementById('cert-date').textContent=dt.getFullYear()+'年'+(dt.getMonth()+1)+'月'+dt.getDate()+'日';document.getElementById('cert-career').textContent=d.career_name||'';document.getElementById('cert-scenarios').textContent=(sd.scenarios||[]).length||d.total_scenarios||0}
  startConfetti(){
    const cv=document.getElementById('confetti-canvas');if(!cv)return;cv.width=window.innerWidth;cv.height=window.innerHeight;
    const ctx=cv.getContext('2d');const colors=['#FFD93D','#FF7B54','#4ECDC4','#7C6FF7','#6BCB77','#FF6B6B','#FFF'];
    const cf=Array.from({length:80},()=>({x:Math.random()*cv.width,y:Math.random()*cv.height-cv.height,size:4+Math.random()*8,color:colors[Math.floor(Math.random()*colors.length)],speed:2+Math.random()*4,rotation:Math.random()*360,rotSpeed:(Math.random()-0.5)*10}));
    let aid;const anim=()=>{ctx.clearRect(0,0,cv.width,cv.height);cf.forEach(c=>{c.y+=c.speed;c.rotation+=c.rotSpeed;if(c.y>cv.height+20){c.y=-20;c.x=Math.random()*cv.width}ctx.save();ctx.translate(c.x,c.y);ctx.rotate(c.rotation*Math.PI/180);ctx.fillStyle=c.color;ctx.fillRect(-c.size/2,-c.size/2,c.size,c.size*0.6);ctx.restore()});aid=requestAnimationFrame(anim)};anim();
    setTimeout(()=>{cancelAnimationFrame(aid);ctx.clearRect(0,0,cv.width,cv.height)},10000);
  }
}

document.addEventListener('DOMContentLoaded',()=>{
  const guideButton=document.getElementById('replay-guide-btn');if(guideButton)guideButton.onclick=showCurrentPageGuide;
  if(window.VN_CONFIG){const vn=new VisualNovelEngine();vn.start();window.submitMentorAnswer=(e)=>vn.submitMentorAnswer(e);window.skipMentor=()=>vn.skipMentor()}if(document.body.classList.contains('page-careers'))setTimeout(()=>showCoachTip('career-island-guide-v1',document.querySelector('.career-card'),'\u6bcf\u5ea7\u804c\u4e1a\u5c0f\u5c9b\u90fd\u85cf\u7740\u4e0d\u540c\u7684\u4f53\u9a8c\u3002\u70b9\u4e00\u5ea7\u5c0f\u5c9b\uff0c\u518d\u9009\u62e9\u60c5\u5883\u5bf9\u8bdd\u6216\u804c\u4e1a\u65e5\u5e38\u3002','\u4ece\u4e00\u5ea7\u804c\u4e1a\u5c0f\u5c9b\u51fa\u53d1'),350);
  if(window.REPORT_CONFIG){const rp=new ReportPage();rp.start()}
});
