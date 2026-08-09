/**
 * Auth module — login/register, token management, authenticated fetch wrapper.
 */
window.Auth = (function(){
  var TOKEN_KEY = 'career-auth-token-v1';
  var _user = null;

  function getToken(){
    return localStorage.getItem(TOKEN_KEY) || '';
  }

  function setToken(t){
    if (t) localStorage.setItem(TOKEN_KEY, t);
    else localStorage.removeItem(TOKEN_KEY);
  }

  function isLoggedIn(){
    return !!getToken();
  }

  function getUser(){
    return _user;
  }

  function fetchWithAuth(url, options){
    options = options || {};
    var token = getToken();
    var studentToken = localStorage.getItem('career-student-token-v1') || '';
    options.headers = options.headers || {};
    if (token) {
      options.headers['Authorization'] = 'Bearer ' + token;
    }
    // 匿名体验也必须带上当前浏览器的私有标识；服务端据此限制记录范围。
    if (studentToken) options.headers['X-Student-Token'] = studentToken;
    return fetch(url, options);
  }

  function checkAuth(){
    var token = getToken();
    if (!token) return Promise.resolve(null);
    return fetch('/api/auth/me', {
      headers: {'Authorization': 'Bearer ' + token}
    }).then(function(r){ return r.ok ? r.json() : null; })
      .then(function(d){
        if (d && d.authenticated) {
          _user = d.user;
          updateNavUI();
          return _user;
        }
        _user = null;
        updateNavUI();
        return null;
      }).catch(function(){ return null; });
  }

  function login(username, password){
    return fetch('/api/auth/login', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({username: username, password: password})
    }).then(function(r){
      return r.json().then(function(d){ if (!r.ok) throw new Error(d.detail || d.error || '登录失败'); return d; });
    }).then(function(d){
      setToken(d.token);
      _user = d.user;
      updateNavUI();
      return d;
    });
  }

  function register(username, password, displayName, age){
    return fetch('/api/auth/register', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({username: username, password: password, display_name: displayName, age: age})
    }).then(function(r){
      return r.json().then(function(d){ if (!r.ok) throw new Error(d.detail || d.error || '注册失败'); return d; });
    }).then(function(d){
      setToken(d.token);
      _user = d.user;
      updateNavUI();
      return d;
    });
  }

  function logout(){
    var token = getToken();
    return fetch('/api/auth/logout', {
      method: 'POST',
      headers: {'Authorization': 'Bearer ' + token}
    }).then(function(){
      setToken('');
      _user = null;
      updateNavUI();
    }).catch(function(){
      setToken('');
      _user = null;
      updateNavUI();
    });
  }

  function showLoginModal(tab){
    // Remove existing modal
    var existing = document.getElementById('auth-modal-overlay');
    if (existing) existing.remove();

    tab = tab || 'login';
    var overlay = document.createElement('div');
    overlay.id = 'auth-modal-overlay';
    overlay.className = 'auth-modal-overlay';
    overlay.innerHTML =
      '<div class="auth-modal-card">'+
        '<button type="button" class="auth-modal-close" onclick="this.closest(\'.auth-modal-overlay\').remove()">✕</button>'+
        '<div class="auth-mascot"><img src="/static/images/mascots/explorer-guide.png" alt=""></div>'+
        '<div class="auth-tabs">'+
          '<button type="button" class="auth-tab '+(tab==='login'?'active':'')+'" id="auth-tab-login">登录</button>'+
          '<button type="button" class="auth-tab '+(tab==='register'?'active':'')+'" id="auth-tab-register">注册</button>'+
        '</div>'+
        // Login form
        '<form id="auth-form-login" class="auth-form" style="'+(tab==='login'?'':'display:none')+'">'+
          '<div class="auth-field"><label>用户名</label><input type="text" id="auth-login-username" placeholder="输入你的用户名" autocomplete="username" required></div>'+
          '<div class="auth-field"><label>密码</label><input type="password" id="auth-login-password" placeholder="输入密码" autocomplete="current-password" required></div>'+
          '<div id="auth-login-error" class="auth-error" style="display:none"></div>'+
          '<button type="submit" class="auth-submit-btn">登 录</button>'+
        '</form>'+
        // Register form
        '<form id="auth-form-register" class="auth-form" style="'+(tab==='register'?'':'display:none')+'">'+
          '<div class="auth-field"><label>用户名</label><input type="text" id="auth-reg-username" placeholder="取一个用户名（3-20字）" autocomplete="username" required></div>'+
          '<div class="auth-field"><label>密码</label><input type="password" id="auth-reg-password" placeholder="至少4个字符" autocomplete="new-password" required></div>'+
          '<div class="auth-field"><label>你的名字（或昵称）</label><input type="text" id="auth-reg-name" placeholder="让大家怎么称呼你？" required></div>'+
          '<div class="auth-field"><label>年龄</label><select id="auth-reg-age" required>'+
            '<option value="">选择年龄</option>'+
            Array.from({length:9}, function(_,i){ return '<option value="'+(i+6)+'">'+(i+6)+'岁</option>'; }).join('')+
          '</select></div>'+
          '<div id="auth-reg-error" class="auth-error" style="display:none"></div>'+
          '<button type="submit" class="auth-submit-btn">注 册</button>'+
        '</form>'+
        '<p class="auth-note">🔒 密码已加密存储。你的探索数据将安全地保存在你的账号下。</p>'+
      '</div>';

    document.body.appendChild(overlay);

    // Tab switching
    overlay.querySelector('#auth-tab-login').onclick = function(){
      this.classList.add('active');
      overlay.querySelector('#auth-tab-register').classList.remove('active');
      overlay.querySelector('#auth-form-login').style.display = '';
      overlay.querySelector('#auth-form-register').style.display = 'none';
    };
    overlay.querySelector('#auth-tab-register').onclick = function(){
      this.classList.add('active');
      overlay.querySelector('#auth-tab-login').classList.remove('active');
      overlay.querySelector('#auth-form-login').style.display = 'none';
      overlay.querySelector('#auth-form-register').style.display = '';
    };

    // Login submit
    overlay.querySelector('#auth-form-login').onsubmit = function(e){
      e.preventDefault();
      var err = overlay.querySelector('#auth-login-error');
      err.style.display = 'none';
      var btn = this.querySelector('.auth-submit-btn');
      btn.disabled = true; btn.textContent = '登录中…';
      login(
        overlay.querySelector('#auth-login-username').value,
        overlay.querySelector('#auth-login-password').value
      ).then(function(d){
        overlay.remove();
        if (d.claimed_sessions > 0) {
          alert('已关联 ' + d.claimed_sessions + ' 条之前的体验记录！');
        }
        if (window.onAuthChanged) window.onAuthChanged(d.user);
      }).catch(function(e){
        err.textContent = e.message || '登录失败，请重试';
        err.style.display = 'block';
      }).finally(function(){
        btn.disabled = false; btn.textContent = '登 录';
      });
    };

    // Register submit
    overlay.querySelector('#auth-form-register').onsubmit = function(e){
      e.preventDefault();
      var err = overlay.querySelector('#auth-reg-error');
      err.style.display = 'none';
      var btn = this.querySelector('.auth-submit-btn');
      btn.disabled = true; btn.textContent = '注册中…';
      register(
        overlay.querySelector('#auth-reg-username').value,
        overlay.querySelector('#auth-reg-password').value,
        overlay.querySelector('#auth-reg-name').value,
        parseInt(overlay.querySelector('#auth-reg-age').value) || 10
      ).then(function(d){
        overlay.remove();
        if (d.claimed_sessions > 0) {
          alert('已关联 ' + d.claimed_sessions + ' 条之前的体验记录到你的账号！');
        }
        if (window.onAuthChanged) window.onAuthChanged(d.user);
      }).catch(function(e){
        err.textContent = e.message || '注册失败，请重试';
        err.style.display = 'block';
      }).finally(function(){
        btn.disabled = false; btn.textContent = '注 册';
      });
    };

    // Close on backdrop click
    overlay.addEventListener('click', function(e){ if (e.target === overlay) overlay.remove(); });
  }

  function updateNavUI(){
    var btn = document.getElementById('auth-nav-btn');
    if (!btn) return;
    if (_user) {
      btn.innerHTML = '<span class="auth-nav-avatar">🧑</span><span>你好，'+escHtml(_user.display_name)+'</span>';
      btn.title = '点击退出登录';
      btn.className = 'auth-nav-btn logged-in';
      btn.onclick = function(){
        if (confirm('确定要退出登录吗？你的数据不会丢失，下次登录还在。')) {
          logout().then(function(){ if (window.onAuthChanged) window.onAuthChanged(null); });
        }
      };
    } else {
      btn.innerHTML = '<span>登录 / 注册</span>';
      btn.title = '登录以保存你的体验记录';
      btn.className = 'auth-nav-btn';
      btn.onclick = function(){ showLoginModal('login'); };
    }
  }

  function initNavButton(){
    var btn = document.getElementById('auth-nav-btn');
    if (!btn) {
      btn = document.createElement('button');
      btn.id = 'auth-nav-btn';
      btn.type = 'button';
      btn.className = 'auth-nav-btn';
      btn.innerHTML = '<span>登录 / 注册</span>';
      btn.title = '登录以保存你的体验记录';
      btn.onclick = function(){ showLoginModal('login'); };
      // Insert before the font-size control
      var fc = document.getElementById('font-size-control');
      if (fc) {
        fc.parentNode.insertBefore(btn, fc);
      } else {
        document.body.appendChild(btn);
      }
    }
    updateNavUI();
  }

  function escHtml(s){
    return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // Initialize on DOM ready
  document.addEventListener('DOMContentLoaded', function(){
    initNavButton();
    checkAuth();
  });

  return {
    getToken: getToken,
    isLoggedIn: isLoggedIn,
    getUser: getUser,
    fetch: fetchWithAuth,
    checkAuth: checkAuth,
    login: login,
    register: register,
    logout: logout,
    showLoginModal: showLoginModal,
    updateNavUI: updateNavUI,
  };
})();
