import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { loginRequest, meRequest } from '../services/authService';
import { setAuthToken } from '../services/api';

const AuthContext = createContext(null);

const STORAGE_KEY = 'kerea_hrms_auth';

const applyBranding = (settings) => {
  const branding = settings?.branding;

  if (!branding) {
    return;
  }

  const root = document.documentElement;
  root.style.setProperty('--brand-primary', branding.primaryColor || '#166534');
  root.style.setProperty('--brand-secondary', branding.secondaryColor || '#22c55e');
  root.style.setProperty('--brand-accent', branding.accentColor || '#86efac');
  root.style.setProperty('--brand-gradient-from', branding.gradientFrom || '#14532d');
  root.style.setProperty('--brand-gradient-to', branding.gradientTo || '#22c55e');
  root.style.setProperty('--surface-page', branding.backgroundColor || '#f4fbf6');
  root.style.setProperty('--surface-card', branding.cardColor || '#ffffff');
  root.style.setProperty('--text-primary', branding.textColor || '#0f172a');
  document.title = branding.appName || 'KEREA HRMS';
};

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved).token : null;
  });
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved).user : null;
  });
  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved).settings : null;
  });
  const [loading, setLoading] = useState(Boolean(token));
  const [error, setError] = useState('');

  useEffect(() => {
    setAuthToken(token);
  }, [token]);

  useEffect(() => {
    applyBranding(settings);
  }, [settings]);

  useEffect(() => {
    if (!token) {
      return;
    }

    const restoreSession = async () => {
      try {
        setLoading(true);
        const data = await meRequest();
        setUser(data.user);
        setSettings(data.settings);
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ token, user: data.user, settings: data.settings }));
      } catch (restoreError) {
        localStorage.removeItem(STORAGE_KEY);
        setToken(null);
        setUser(null);
        setSettings(null);
      } finally {
        setLoading(false);
      }
    };

    restoreSession();
  }, [token]);

  const login = async (credentials) => {
    setError('');
    setLoading(true);

    try {
      const data = await loginRequest(credentials);
      setAuthToken(data.token);
      setToken(data.token);
      setUser(data.user);
      setSettings(data.settings);
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ token: data.token, user: data.user, settings: data.settings }));
      return data.user;
    } catch (loginError) {
      const message = loginError.response?.data?.message || 'Unable to sign in.';
      setError(message);
      throw loginError;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem(STORAGE_KEY);
    setAuthToken(null);
    setToken(null);
    setUser(null);
    setSettings(null);
  };

  const replaceUser = (nextUser) => {
    setUser(nextUser);
    if (token && nextUser) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ token, user: nextUser, settings }));
    }
  };

  const replaceSettings = (nextSettings) => {
    setSettings(nextSettings);
    if (token && user) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ token, user, settings: nextSettings }));
    }
  };

  const value = useMemo(() => ({
    token,
    user,
    settings,
    loading,
    error,
    login,
    logout,
    replaceUser,
    replaceSettings,
    isAuthenticated: Boolean(token && user)
  }), [token, user, settings, loading, error]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
