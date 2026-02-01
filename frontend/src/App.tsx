import { useEffect, useMemo, useState } from 'react';

type Health = { status: string; db: string; time: string };

export default function App() {
  const apiUrl = useMemo(() => import.meta.env.VITE_API_URL ?? 'http://localhost:3000', []);
  const [health, setHealth] = useState<Health | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${apiUrl}/health`)
      .then((r) => r.json())
      .then(setHealth)
      .catch((e) => setErr(String(e)));
  }, [apiUrl]);

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

      <h2>Что дальше</h2>
      <ol>
        <li>Аутентификация (JWT) + RBAC permissions</li>
        <li>Экзамены и подписи (attempts + approvals + bulk)</li>
        <li>Выпуск сертификатов (номер + срок годности) + public verify статусы</li>
        <li>Шаблоны (несколько) и on-demand PDF (только internal)</li>
      </ol>
    </div>
  );
}
