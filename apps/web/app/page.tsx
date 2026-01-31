import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="stack">
      <h1>Реестр сертификатов</h1>
      <p>Прототип: внутренний и внешний контур.</p>
      <div className="card stack">
        <h2>Навигация</h2>
        <Link className="link" href="/login">Войти</Link>
        <Link className="link" href="/certs/outer/demo-public-id">Публичная проверка</Link>
        <Link className="link" href="/internal/certificates">Внутренний реестр</Link>
      </div>
    </div>
  );
}
