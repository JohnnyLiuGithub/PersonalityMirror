import { useState } from 'react';

const EMPTY_FORM = { username: '', password: '' };

const AuthPanel = ({
  title,
  description,
  mode = 'login',
  onModeChange,
  onSubmit,
  isLoading,
  error,
  submitLabels = { login: '登录', register: '注册并保存' }
}) => {
  const [form, setForm] = useState(EMPTY_FORM);

  const handleSubmit = async (event) => {
    event.preventDefault();
    await onSubmit?.(mode, form);
    setForm((prev) => ({ ...prev, password: '' }));
  };

  return (
    <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6 md:p-7 backdrop-blur-sm shadow-[0_24px_60px_rgba(0,0,0,0.28)]">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.3em] text-[#fbbf24]">Account</p>
        <h3 className="text-2xl font-semibold text-white">{title}</h3>
        {description && <p className="text-sm leading-6 text-[#a1a1aa]">{description}</p>}
      </div>

      <div className="mt-5 inline-flex rounded-full border border-white/10 bg-black/20 p-1">
        <button
          type="button"
          onClick={() => onModeChange?.('login')}
          className={`rounded-full px-4 py-2 text-sm transition-colors cursor-pointer ${mode === 'login' ? 'bg-white text-black' : 'text-[#a1a1aa] hover:text-white'}`}
        >
          登录
        </button>
        <button
          type="button"
          onClick={() => onModeChange?.('register')}
          className={`rounded-full px-4 py-2 text-sm transition-colors cursor-pointer ${mode === 'register' ? 'bg-white text-black' : 'text-[#a1a1aa] hover:text-white'}`}
        >
          注册
        </button>
      </div>

      <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <label className="block text-sm text-[#d4d4d8]" htmlFor="auth-username">用户名</label>
          <input
            id="auth-username"
            value={form.username}
            onChange={(event) => setForm((prev) => ({ ...prev, username: event.target.value }))}
            className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none transition focus:border-[#fbbf24]/60"
            placeholder="例如 mirror_user"
            autoComplete="username"
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm text-[#d4d4d8]" htmlFor="auth-password">密码</label>
          <input
            id="auth-password"
            type="password"
            value={form.password}
            onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
            className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none transition focus:border-[#fbbf24]/60"
            placeholder="至少 8 位"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          />
        </div>

        {error && <p className="text-sm text-[#fca5a5]">{error}</p>}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full rounded-full bg-[#fbbf24] px-5 py-3 text-sm font-semibold text-black transition hover:bg-[#fcd34d] disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
        >
          {isLoading ? '处理中...' : submitLabels[mode]}
        </button>
      </form>
    </div>
  );
};

export default AuthPanel;
