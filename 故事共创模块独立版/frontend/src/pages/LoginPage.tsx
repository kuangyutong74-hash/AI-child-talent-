import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { login as loginRequest, register as registerRequest } from '../api/endpoints'
import { ApiError } from '../api/client'
import { useAuth } from '../contexts/AuthContext'
import PngIcon from '../components/Shared/PngIcon'
import './LoginPage.css'

export default function LoginPage() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (user) return <Navigate to="/story-create" replace />

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    if (username.trim().length < 2) return setError('用户名至少需要 2 个字符')
    if (password.length < 6) return setError('密码至少需要 6 个字符')

    setSubmitting(true)
    try {
      const result = mode === 'login'
        ? await loginRequest(username.trim(), password)
        : await registerRequest(username.trim(), password, displayName.trim() || username.trim())
      login(result.token, result.user)
      if (result.show_onboarding) sessionStorage.setItem('ai_bole_show_onboarding', 'true')
      navigate(result.user.age_group ? '/story-create' : '/story-create/channel', { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '暂时无法登录，请检查故事后端是否启动')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="standalone-login-page">
      <section className="standalone-login-card">
        <div className="standalone-login-brand">
          <PngIcon name="story-book" size={72} />
          <div>
            <span>AI 伯乐</span>
            <h1>故事共创世界</h1>
          </div>
        </div>
        <p className="standalone-login-intro">登录后和故事导演一起创建角色、展开冒险，并把每一次奇思妙想保存下来。</p>

        <div className="standalone-login-tabs" role="tablist" aria-label="登录方式">
          <button className={mode === 'login' ? 'active' : ''} onClick={() => { setMode('login'); setError('') }}>登录</button>
          <button className={mode === 'register' ? 'active' : ''} onClick={() => { setMode('register'); setError('') }}>注册新账号</button>
        </div>

        <form onSubmit={handleSubmit}>
          {mode === 'register' && (
            <label>昵称<input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="故事里怎么称呼你？" maxLength={30} /></label>
          )}
          <label>用户名<input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="请输入用户名" autoComplete="username" maxLength={50} /></label>
          <label>密码<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="至少 6 个字符" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} /></label>
          {error && <p className="standalone-login-error" role="alert">{error}</p>}
          <button className="standalone-login-submit" type="submit" disabled={submitting}>
            {submitting ? '正在进入故事世界…' : mode === 'login' ? '进入故事世界' : '创建账号并开始'}
          </button>
        </form>
        <p className="standalone-login-note">这是故事共创独立版账号，与总平台账号互不影响。</p>
      </section>
    </main>
  )
}
