import { useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'

const CAPTCHA_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

const createCaptchaCode = (length = 4) =>
  Array.from({ length }, () => CAPTCHA_CHARS[Math.floor(Math.random() * CAPTCHA_CHARS.length)]).join(
    '',
  )

export function LoginPage() {
  const { user, login, ready } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [captchaCode, setCaptchaCode] = useState(() => createCaptchaCode())
  const [captchaInput, setCaptchaInput] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const fromPath = useMemo(() => {
    const state = location.state as { from?: string } | null
    return state?.from && state.from !== '/login' ? state.from : '/accounts'
  }, [location.state])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const context = canvas.getContext('2d')
    if (!context) return

    const width = canvas.width
    const height = canvas.height
    context.clearRect(0, 0, width, height)
    context.fillStyle = '#f1f5f9'
    context.fillRect(0, 0, width, height)

    for (let i = 0; i < captchaCode.length; i += 1) {
      const char = captchaCode[i]
      context.save()
      context.fillStyle = i % 2 === 0 ? '#0f172a' : '#1d4ed8'
      context.font = 'bold 24px Segoe UI'
      const x = 14 + i * 22
      const y = 30 + (i % 2 === 0 ? -2 : 3)
      const angle = ((Math.random() - 0.5) * Math.PI) / 6
      context.translate(x, y)
      context.rotate(angle)
      context.fillText(char, 0, 0)
      context.restore()
    }

    for (let i = 0; i < 4; i += 1) {
      context.strokeStyle = i % 2 === 0 ? '#94a3b8' : '#60a5fa'
      context.beginPath()
      context.moveTo(Math.random() * width, Math.random() * height)
      context.lineTo(Math.random() * width, Math.random() * height)
      context.stroke()
    }
  }, [captchaCode])

  if (ready && user) {
    return <Navigate to={fromPath} replace />
  }

  const refreshCaptcha = () => {
    setCaptchaCode(createCaptchaCode())
    setCaptchaInput('')
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (submitting) return
    setError('')

    if (captchaInput.trim().toUpperCase() !== captchaCode.toUpperCase()) {
      setError('图形验证码不正确')
      refreshCaptcha()
      return
    }

    try {
      setSubmitting(true)
      await login(username, password)
      navigate(fromPath, { replace: true })
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : '登录失败，请重试'
      setError(message)
      refreshCaptcha()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="auth-page">
      <div className="auth-card">
        <h2>用户登录</h2>
        <p>请输入账号密码后访问系统</p>
        <p className="auth-tip">默认管理员：admin / admin123456（首次请修改密码）</p>
        {error ? <p className="error-text">{error}</p> : null}
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <label htmlFor="login-username">用户名</label>
            <input
              id="login-username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="请输入用户名"
              autoComplete="username"
            />
          </div>
          <div className="form-row">
            <label htmlFor="login-password">密码</label>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="请输入密码"
              autoComplete="current-password"
            />
          </div>
          <div className="form-row">
            <label htmlFor="login-captcha">图形验证码</label>
            <div className="captcha-row">
              <input
                id="login-captcha"
                value={captchaInput}
                onChange={(event) => setCaptchaInput(event.target.value)}
                placeholder="请输入右侧验证码"
                maxLength={6}
              />
              <canvas
                ref={canvasRef}
                width={110}
                height={40}
                className="captcha-canvas"
                onClick={refreshCaptcha}
                title="点击刷新验证码"
              />
              <button type="button" className="secondary-btn" onClick={refreshCaptcha}>
                刷新
              </button>
            </div>
          </div>
          <div className="form-actions">
            <button type="submit" disabled={submitting}>
              {submitting ? '登录中...' : '登录'}
            </button>
          </div>
        </form>
      </div>
    </section>
  )
}
