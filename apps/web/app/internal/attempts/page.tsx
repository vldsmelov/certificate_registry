import Link from 'next/link';

export default function AttemptsPage() {
  return (
    <div className="stack">
      <div className="card stack">
        <h2>Попытки экзаменов</h2>
        <Link className="link" href="/internal/attempts/new">Создать попытку</Link>
        <table className="table">
          <thead>
            <tr>
              <th>Экзамен</th>
              <th>Статус</th>
              <th>Оценка</th>
              <th>Дата</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>SAFE</td>
              <td>draft</td>
              <td>gold</td>
              <td>2025-01-10</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
