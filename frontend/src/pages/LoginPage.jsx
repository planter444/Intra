import { useEffect, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePagePresentation } from '../hooks/usePagePresentation';
import { forgotPasswordRequest } from '../services/authService';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, error, loading, settings, isAuthenticated, user } = useAuth();
  const { animationStyle, cardStyle } = usePagePresentation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [resetNotice, setResetNotice] = useState('');
  const [resetNoticeTone, setResetNoticeTone] = useState('success');
  const [resetLoading, setResetLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated && user) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, user, navigate]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setResetNotice('');

    try {
      await login(form);
    } catch (submitError) {
      console.error(submitError);
    }
  };

  const handleForgotPassword = async () => {
    if (!form.email.trim()) {
      setResetNoticeTone('error');
      setResetNotice('Enter your email address first, then use Forgot password.');
      return;
    }

    try {
      setResetLoading(true);
      const response = await forgotPasswordRequest({ email: form.email.trim() });
      setResetNoticeTone('success');
      setResetNotice(response.message || 'If that email exists in the system, a reset link has been sent.');
    } catch (requestError) {
      setResetNoticeTone('error');
      setResetNotice(requestError.response?.data?.message || 'Unable to send a reset link right now.');
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-brand-gradient px-4 py-8 sm:px-6 lg:px-8">
      {settings?.interface?.loginShapesEnabled ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{ opacity: Number(settings?.interface?.loginShapesOpacity ?? 0.18) || 0.18 }}
        >
          <div
            className="absolute -left-32 -top-40 h-[520px] w-[520px] rounded-full blur-3xl"
            style={{ background: `radial-gradient(circle at 30% 30%, ${settings?.interface?.loginShapesPrimaryColor || '#ffffff'}, transparent 70%)` }}
          />
          <div
            className="absolute -right-44 top-24 h-[460px] w-[460px] rounded-full blur-3xl"
            style={{ background: `radial-gradient(circle at 60% 40%, ${settings?.interface?.loginShapesSecondaryColor || '#bbf7d0'}, transparent 70%)` }}
          />
          <div
            className="absolute left-1/3 top-2/3 h-[520px] w-[520px] -translate-x-1/2 rounded-full blur-3xl"
            style={{ background: `radial-gradient(circle at 50% 50%, ${settings?.interface?.loginShapesSecondaryColor || '#bbf7d0'}, transparent 70%)` }}
          />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.35)_1px,transparent_0)] [background-size:38px_38px]" />
        </div>
      ) : null}
      <div className="w-full max-w-md">
        <div className="w-full rounded-[2rem] bg-white p-6 shadow-soft sm:p-8" style={{ ...cardStyle, ...animationStyle }}>
          <div className="mb-8 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-gradient text-xl font-bold text-white shadow-lg">
              {settings?.branding?.logoText || 'KH'}
            </div>
            <h1 className="mt-5 text-3xl font-semibold text-slate-900">{settings?.labels?.loginTitle || 'Sign in to KEREA HRMS'}</h1>
            <p className="mt-2 text-sm text-slate-500">{settings?.labels?.loginSubtitle || 'Sign in to your account'}</p>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">{settings?.labels?.loginEmailLabel || 'Email'}</label>
              <input
                type="email"
                value={form.email}
                onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                placeholder={settings?.labels?.loginEmailPlaceholder || 'name@kerea.org'}
                required
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">{settings?.labels?.loginPasswordLabel || 'Password'}</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                  placeholder={settings?.labels?.loginPasswordPlaceholder || 'Enter password'}
                  className="pr-12"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-500"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            {error ? <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
            {error ? (
              <button type="button" onClick={handleForgotPassword} disabled={resetLoading} className="text-sm font-medium text-emerald-700 disabled:cursor-not-allowed disabled:opacity-70">
                {resetLoading ? 'Sending reset link...' : 'Forgot password?'}
              </button>
            ) : null}
            {resetNotice ? <div className={`rounded-2xl px-4 py-3 text-sm ${resetNoticeTone === 'error' ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>{resetNotice}</div> : null}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-brand-gradient px-4 py-3 text-sm font-semibold text-white shadow-lg hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading ? 'Signing in...' : settings?.labels?.loginButtonText || 'Login'}
            </button>
          </form>
          <p className="mt-6 text-center text-xs text-slate-400">{settings?.labels?.loginFooterText || '2026 KEREA. All rights reserved.'}</p>
        </div>
      </div>
    </div>
  );
}
