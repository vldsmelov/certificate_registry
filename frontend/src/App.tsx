import { FormEvent, useEffect, useMemo, useState } from 'react';

type Health = { status: string; db: string; time: string };

type AuthMe = { id: string; email: string; displayName: string | null; permissions: string[] };

export default function App() {
  const apiUrl = useMemo(() => import.meta.env.VITE_API_URL ?? 'http://localhost:3000', []);
  const [health, setHealth] = useState<Health | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Auth
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'));
  const [me, setMe] = useState<AuthMe | null>(null);
  const [loginEmail, setLoginEmail] = useState('admin@example.com');
  const [loginPassword, setLoginPassword] = useState('admin123');
  const [authErr, setAuthErr] = useState<string | null>(null);

  const [internalCert, setInternalCert] = useState<any>(null);
  const [internalErr, setInternalErr] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${apiUrl}/health`)
      .then((r) => r.json())
      .then(setHealth)
      .catch((e) => setErr(String(e)));
  }, [apiUrl]);

  useEffect(() => {
    if (!token) {
      setMe(null);
      return;
    }
    fetch(`${apiUrl}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (r) => {
        if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
        return r.json();
      })
      .then(setMe)
      .catch((e) => {
        setAuthErr(String(e));
        setMe(null);
      });
  }, [apiUrl, token]);

  async function onLogin(e: FormEvent) {
    e.preventDefault();
    setAuthErr(null);
    try {
      const res = await fetch(`${apiUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
      const data = await res.json();
      localStorage.setItem('token', data.access_token);
      setToken(data.access_token);
      setMe(data.user);
    } catch (e: any) {
      setAuthErr(String(e?.message ?? e));
    }
  }

  function onLogout() {
    localStorage.removeItem('token');
    setToken(null);
    setMe(null);
    setInternalCert(null);
  }

  async function loadInternalCert() {
    setInternalErr(null);
    setInternalCert(null);
    try {
      const res = await fetch(`${apiUrl}/certs/inner/demo-public-id-12345`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
      setInternalCert(await res.json());
    } catch (e: any) {
      setInternalErr(String(e?.message ?? e));
    }
  }

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: 24, maxWidth: 800 }}>
      <h1>Реестр сертификатов — прототип</h1>
      <p>
        Это стартовый каркас: DB + backend + frontend поднимаются одной командой через docker-compose.
      </p>

      <h2>Backend health</h2>
      {err && <pre style={{ background: '#fee', padding: 12 }}>Ошибка: {err}</pre>}
      {!health && !err && <p>Загружаю...</p>}
      {health && (
        <pre style={{ background: '#f6f8fa', padding: 12, borderRadius: 8 }}>
          {JSON.stringify(health, null, 2)}
        </pre>
      )}

      <h2>Проверка demo сертификата (внешний контур)</h2>
      <p>
        Попробуйте открыть: <a href={`${apiUrl}/certs/outer/demo-public-id-12345`} target="_blank">/certs/outer/demo-public-id-12345</a>
      </p>

      <h2>Внутренний контур (JWT + RBAC)</h2>
      <p style={{ marginTop: 0 }}>
        По умолчанию при старте создаётся dev-админ: <code>admin@example.com / admin123</code> (см. .env)
      </p>

      {!token && (
        <form onSubmit={onLogin} style={{ background: '#f6f8fa', padding: 12, borderRadius: 8, maxWidth: 420 }}>
          <div style={{ display: 'grid', gap: 8 }}>
            <label>
              Email
              <input
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                style={{ width: '100%', padding: 8, marginTop: 4 }}
              />
            </label>
            <label>
              Пароль
              <input
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                style={{ width: '100%', padding: 8, marginTop: 4 }}
              />
            </label>
            <button type="submit" style={{ padding: '8px 12px' }}>Войти</button>
            {authErr && <div style={{ color: '#b00020' }}>Ошибка: {authErr}</div>}
          </div>
        </form>
      )}

      {token && (
        <div style={{ background: '#f6f8fa', padding: 12, borderRadius: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <div>
              <div>
                Вы вошли как: <b>{me?.displayName ?? me?.email ?? '...'}</b>
              </div>
              {me && (
                <div style={{ fontSize: 13, opacity: 0.8, marginTop: 4 }}>
                  Permissions: {me.permissions.join(', ')}
                </div>
              )}
            </div>
            <button onClick={onLogout} style={{ padding: '6px 10px' }}>Выйти</button>
          </div>

          <div style={{ marginTop: 12 }}>
            <button onClick={loadInternalCert} style={{ padding: '8px 12px' }}>
              Открыть demo сертификат (internal)
            </button>
            {internalErr && <pre style={{ background: '#fee', padding: 12, marginTop: 12 }}>Ошибка: {internalErr}</pre>}
            {internalCert && (
              <pre style={{ background: '#fff', padding: 12, marginTop: 12, borderRadius: 8 }}>
                {JSON.stringify(internalCert, null, 2)}
              </pre>
            )}
          </div>
        </div>
      )}

      <h2>Что дальше</h2>
      <ol>
        <li>Аутентификация (JWT) + RBAC permissions ✅</li>
        <li>Экзамены и подписи (attempts + approvals + bulk)</li>
        <li>Выпуск сертификатов (номер + срок годности) + public verify статусы</li>
        <li>Шаблоны (несколько) и on-demand PDF (только internal)</li>
      </ol>
    </div>
  );
}
