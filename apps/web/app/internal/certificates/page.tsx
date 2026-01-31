import Link from 'next/link';

export default function CertificatesPage() {
  return (
    <div className="card stack">
      <h2>Реестр сертификатов</h2>
      <div className="stack">
        <div>Фильтры, поиск, экспорт</div>
        <Link className="link" href="/api/internal/export?format=csv">Экспорт CSV</Link>
      </div>
      <table className="table">
        <thead>
          <tr>
            <th>Номер</th>
            <th>Статус</th>
            <th>Дата</th>
            <th>Действия</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>2025-SAFE-000001</td>
            <td>issued</td>
            <td>2025-01-15</td>
            <td>
              <Link className="link" href="/internal/certs/inner/demo-public-id">
                Просмотр
              </Link>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
