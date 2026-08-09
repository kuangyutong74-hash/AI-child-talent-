(()=>{
  var KEY='career-explored-v1';
  var MAP_KEY='career-session-map-v1';
  var labels={doctor:'医生岛',firefighter:'消防员岛',teacher:'教师岛',chef:'厨师岛',journalist:'记者岛',animal_caretaker:'动物保护员岛'};

  function readExplored(){try{var v=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(v)?v:[]}catch(e){return []}}
  function getLocalMap(){try{return JSON.parse(localStorage.getItem(MAP_KEY)||'{}')}catch(e){return {}}}
  function saveLocalMap(m){try{localStorage.setItem(MAP_KEY,JSON.stringify(m))}catch(e){}}
  function identityHeaders(){
    var token=localStorage.getItem('career-student-token-v1')||'';
    return token?{'X-Student-Token':token}:{};
  }

  function hydrateIslands(explored, sessionMap){
    document.querySelectorAll('.career-map-island').forEach(function(island){
      var cid=island.dataset.careerId;
      var done=explored.has(cid);
      island.classList.toggle('explored',done);
      island.querySelector('i').textContent=done?'已点亮':'未探索';
      island.setAttribute('aria-label',(labels[cid]||'职业岛')+'，'+(done?'已点亮':'尚未点亮'));
      if(done && sessionMap[cid]){
        island.setAttribute('href','/report/'+sessionMap[cid]);
      }
    });
    ['explored-career-count','explored-career-count-copy'].forEach(function(id){var el=document.getElementById(id);if(el)el.textContent=String(explored.size);});
    var msg=document.getElementById('my-map-message');
    if(msg){msg.textContent=explored.size===0?'从第一座感兴趣的小岛开始吧！':explored.size>=6?'太棒了，六座职业小岛都被你点亮了！':'你已经留下了 '+explored.size+' 次完整职业体验记录，继续出发吧！';}
  }

  function bindChestAnimation(){
    document.querySelectorAll('.career-map-island.explored').forEach(function(island){
      island.addEventListener('click',function(e){
        if(island.classList.contains('chest-opening'))return;
        var p=document.createElement('div');p.className='chest-particles';
        for(var i=0;i<24;i++){
          var d=document.createElement('span');d.className='chest-particle';
          var a=(i/24)*360,dist=55+Math.random()*45;
          d.style.setProperty('--angle',a+'deg');
          d.style.setProperty('--dist',dist+'px');
          d.style.setProperty('--delay',(Math.random()*0.15)+'s');
          var cs=['#FFD93D','#FF9D6C','#7C6FF7','#4ECDC4','#FF6B6B','#FFE88D'];
          d.style.background=cs[Math.floor(Math.random()*cs.length)];
          p.appendChild(d);
        }
        island.appendChild(p);island.classList.add('chest-opening');
      });
    });
  }

  function render(){
    var explored=new Set(readExplored());

    // 先用 localStorage 里的映射渲染一次（瞬间完成）
    hydrateIslands(explored, getLocalMap());
    bindChestAnimation();

    // 服务端是点亮状态的权威来源：登录后跨设备恢复，匿名时只读取本浏览器 token 的记录。
    var request=(typeof Auth !== 'undefined' && Auth.isLoggedIn())
      ? Auth.fetch('/api/sessions/latest-by-career')
      : fetch('/api/sessions/latest-by-career',{headers:identityHeaders()});
    request
      .then(function(r){return r.ok?r.json():null})
      .then(function(d){
        if(!d||!d.career_session_map)return;
        var merged=d.career_session_map;
        explored=new Set(Object.keys(merged));
        try{localStorage.setItem(KEY,JSON.stringify(Array.from(explored)))}catch(e){}
        saveLocalMap(merged);
        hydrateIslands(explored, merged);
        bindChestAnimation();
      })
      .catch(function(){});
  }

  document.addEventListener('DOMContentLoaded',render);
})();
