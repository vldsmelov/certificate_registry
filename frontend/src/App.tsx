import { FormEvent, useEffect, useMemo, useState } from 'react';

type Health = { status: string; db: string; time: string };

type AuthMe = { id: string; email: string; displayName: string | null; permissions: string[] };

type ExamType = { id: string; name: string; code: string };

type UserListItem = { id: string; email: string; displayName: string | null };

type TemplateVersionActive = {
  id: string;
  templateId: string;
  templateName: string;
  version: number;
  backgroundPath: string | null;
  configJson: any;
};

type TemplateAdmin = { id: string; name: string; description: string | null; isArchived: boolean; versions: any[] };

type Attempt = {
  id: string;
  attemptNo: number;
  grade: 'gold' | 'silver' | 'fail';
  status: string;
  examDate: string;
  notes: string | null;
  createdAt: string;
  person: { fullName: string; position: string; employeeCode: string | null };
  examType: { id: string; name: string; code: string };
  signerUser: UserListItem | null;
  approvals: any[];
  certificate?: { publicId: string; certificateNumber: string; status: string; validTo: string | null } | null;
};

type CertInternalView =
  | { status: 'not_found' }
  | {
      status: 'ok';
      certificate: {
        certificateNumber: string;
        publicId: string;
        grade: string;
        status: string;
        issuedAt: string;
        validityType: string;
        validityMonths: number | null;
        validFrom: string;
        validTo: string | null;
        expired: boolean;
        revokedAt: string | null;
        revokeReason: string | null;
        revokedBy: string | null;
        template?: { name: string; version: number } | null;
        snapshot?: any;
      };
      attempt: any;
    };

type ApprovalInboxItem = {
  id: string;
  status: string;
  createdAt: string;
  examAttempt: {
    id: string;
    attemptNo: number;
    grade: 'gold' | 'silver' | 'fail';
    status: string;
    examDate: string;
    person: { fullName: string; position: string; employeeCode: string | null };
    examType: { name: string; code: string };
    createdBy: UserListItem;
  };
};

function hasPerm(me: AuthMe | null, code: string) {
  return !!me?.permissions?.includes(code);
}

export default function App() {
  const apiUrl = useMemo(() => import.meta.env.VITE_API_URL ?? 'http://localhost:3000', []);

  const [health, setHealth] = useState<Health | null>(null);
  const [healthErr, setHealthErr] = useState<string | null>(null);

  // Auth
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'));
  const [me, setMe] = useState<AuthMe | null>(null);
  const [loginEmail, setLoginEmail] = useState('creator@example.com');
  const [loginPassword, setLoginPassword] = useState('creator123');
  const [authErr, setAuthErr] = useState<string | null>(null);

  // Data
  const [examTypes, setExamTypes] = useState<ExamType[]>([]);
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [approvals, setApprovals] = useState<ApprovalInboxItem[]>([]);
  const [templateVersions, setTemplateVersions] = useState<TemplateVersionActive[]>([]);
  const [templatesAdmin, setTemplatesAdmin] = useState<TemplateAdmin[]>([]);

  // UI errors
  const [actionErr, setActionErr] = useState<string | null>(null);
  const [actionOk, setActionOk] = useState<string | null>(null);

  const [selectedCert, setSelectedCert] = useState<CertInternalView | null>(null);
  const [selectedCertPublicId, setSelectedCertPublicId] = useState<string | null>(null);

  async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${apiUrl}${path}`, {
      ...init,
      headers: {
        ...(init?.headers ?? {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`${res.status} ${text}`);
    }
    return res.json();
  }

  function flashOk(msg: string) {
    setActionOk(msg);
    setTimeout(() => setActionOk(null), 2500);
  }

  useEffect(() => {
    fetch(`${apiUrl}/health`)
      .then((r) => r.json())
      .then(setHealth)
      .catch((e) => setHealthErr(String(e)));
  }, [apiUrl]);

  // Load /auth/me
  useEffect(() => {
    if (!token) {
      setMe(null);
      return;
    }
    apiFetch<AuthMe>('/auth/me')
      .then(setMe)
      .catch((e) => {
        setAuthErr(String(e?.message ?? e));
        setMe(null);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiUrl, token]);

  // Load reference data after login
  useEffect(() => {
    if (!token || !me) return;

    apiFetch<ExamType[]>('/exam-types')
      .then(setExamTypes)
      .catch(() => setExamTypes([]));

    if (hasPerm(me, 'users:read')) {
      apiFetch<UserListItem[]>('/users')
        .then(setUsers)
        .catch(() => setUsers([]));
    } else {
      setUsers([]);
    }

    apiFetch<TemplateVersionActive[]>('/template-versions/active')
      .then(setTemplateVersions)
      .catch(() => setTemplateVersions([]));

    if (hasPerm(me, 'templates:manage')) {
      apiFetch<TemplateAdmin[]>('/api/internal/templates')
        .then(setTemplatesAdmin)
        .catch(() => setTemplatesAdmin([]));
    } else {
      setTemplatesAdmin([]);
    }

    // Mine attempts
    apiFetch<Attempt[]>('/attempts/mine')
      .then(setAttempts)
      .catch(() => setAttempts([]));

    // Inbox approvals
    if (hasPerm(me, 'approval:review')) {
      apiFetch<ApprovalInboxItem[]>('/approvals/inbox')
        .then(setApprovals)
        .catch(() => setApprovals([]));
    } else {
      setApprovals([]);
    setTemplateVersions([]);
    setTemplatesAdmin([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, me?.id]);

  async function onLogin(e: FormEvent) {
    e.preventDefault();
    setAuthErr(null);
    setActionErr(null);
    setActionOk(null);
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
      flashOk('Вы вошли');
    } catch (e: any) {
      setAuthErr(String(e?.message ?? e));
    }
  }

  function onLogout() {
    localStorage.removeItem('token');
    setToken(null);
    setMe(null);
    setExamTypes([]);
    setUsers([]);
    setAttempts([]);
    setApprovals([]);
    setTemplateVersions([]);
    setTemplatesAdmin([]);
  }

  async function refreshMine() {
    if (!token) return;
    try {
      setAttempts(await apiFetch<Attempt[]>('/attempts/mine'));
    } catch {
      /* ignore */
    }
  }

  async function refreshInbox() {
    if (!token || !hasPerm(me, 'approval:review')) return;
    try {
      setApprovals(await apiFetch<ApprovalInboxItem[]>('/approvals/inbox'));
    } catch {
      /* ignore */
    }
  }

  // Create attempt form
  const [fullName, setFullName] = useState('Петров Пётр Петрович');
  const [position, setPosition] = useState('Техник');
  const [employeeCode, setEmployeeCode] = useState('E100');
  const [examTypeId, setExamTypeId] = useState('');
  const [templateVersionId, setTemplateVersionId] = useState('');
  const [grade, setGrade] = useState<'gold' | 'silver' | 'fail'>('gold');
  const [examDate, setExamDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [signerUserId, setSignerUserId] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!examTypeId && examTypes.length > 0) setExamTypeId(examTypes[0].id);
  }, [examTypes, examTypeId]);

  useEffect(() => {
    if (!signerUserId && users.length > 0) {
      // Prefer signer@example.com if exists
      const signer = users.find((u) => u.email.includes('signer@')) ?? users[0];
      setSignerUserId(signer.id);
    }
  }, [users, signerUserId]);

  async function createAttempt() {
    setActionErr(null);
    setActionOk(null);
    try {
      await apiFetch('/attempts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName,
          position,
          employeeCode: employeeCode || null,
          examTypeId,
          grade,
          examDate,
          signerUserId: signerUserId || null,
          templateVersionId: templateVersionId || null,
          notes: notes || null,
        }),
      });
      flashOk('Попытка создана');
      await refreshMine();
    } catch (e: any) {
      setActionErr(String(e?.message ?? e));
    }
  }

  async function submitAttempt(id: string) {
    setActionErr(null);
    setActionOk(null);
    try {
      await apiFetch(`/attempts/${id}/submit`, { method: 'POST' });
      flashOk('Отправлено на подпись');
      await refreshMine();
    } catch (e: any) {
      setActionErr(String(e?.message ?? e));
    }
  }

  // Approvals UI
  const [selectedApprovalIds, setSelectedApprovalIds] = useState<string[]>([]);

  function toggleApproval(id: string) {
    setSelectedApprovalIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function approveOne(id: string) {
    setActionErr(null);
    setActionOk(null);
    try {
      const res = await apiFetch<any>(`/approvals/${id}/approve`, { method: 'POST' });
      if (res?.certificate?.publicId) {
        flashOk(`Подписано — сертификат ${res.certificate.certificateNumber}`);
      } else {
        flashOk('Подписано');
      }
      setSelectedApprovalIds((prev) => prev.filter((x) => x !== id));
      await refreshInbox();
      await refreshMine();
    } catch (e: any) {
      setActionErr(String(e?.message ?? e));
    }
  }

  async function rejectOne(id: string) {
    const reason = window.prompt('Причина отклонения (необязательно):') ?? '';
    setActionErr(null);
    setActionOk(null);
    try {
      await apiFetch(`/approvals/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason || null }),
      });
      flashOk('Отклонено');
      setSelectedApprovalIds((prev) => prev.filter((x) => x !== id));
      await refreshInbox();
    } catch (e: any) {
      setActionErr(String(e?.message ?? e));
    }
  }

  async function bulk(action: 'approve' | 'reject') {
    if (selectedApprovalIds.length === 0) return;
    const reason = action === 'reject' ? (window.prompt('Причина для массового отклонения (необязательно):') ?? '') : '';

    setActionErr(null);
    setActionOk(null);
    try {
      const res = await apiFetch<any>('/approvals/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, approvalIds: selectedApprovalIds, reason: reason || null }),
      });
      if (action === 'approve' && Array.isArray(res?.issued) && res.issued.length) {
        flashOk(`Массово подписано — выпущено сертификатов: ${res.issued.length}`);
      } else {
        flashOk(action === 'approve' ? 'Массово подписано' : 'Массово отклонено');
      }
      setSelectedApprovalIds([]);
      await refreshInbox();
      await refreshMine();
    } catch (e: any) {
      setActionErr(String(e?.message ?? e));
    }
  }

  async function openCert(publicId: string) {
    setSelectedCertPublicId(publicId);
    setSelectedCert(null);
    try {
      const data = await apiFetch<CertInternalView>(`/certs/inner/${publicId}`);
      setSelectedCert(data);
    } catch (e: any) {
      setActionErr(String(e?.message ?? e));
    }
  }

  async function revokeCert(publicId: string, kind: 'revoke' | 'annul') {
    const reason = window.prompt('Причина (опционально):') ?? '';
    setActionErr(null);
    try {
      await apiFetch(`/api/internal/certs/${publicId}/${kind === 'revoke' ? 'revoke' : 'annul'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason || null }),
      });
      flashOk(kind === 'revoke' ? 'Отозвано' : 'Аннулировано');
      await openCert(publicId);
      await refreshMine();
    } catch (e: any) {
      setActionErr(String(e?.message ?? e));
    }
  }


  async function downloadPdf(publicId: string) {
    setActionErr(null);
    try {
      const res = await fetch(`${apiUrl}/api/internal/certs/${publicId}/pdf`, {
        method: 'GET',
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e: any) {
      setActionErr(String(e?.message ?? e));
    }
  }

  // Templates admin
  const [tplName, setTplName] = useState('New Template');
  const [tplDesc, setTplDesc] = useState('');
  const [tplVerTemplateId, setTplVerTemplateId] = useState('');
  const [tplVerConfig, setTplVerConfig] = useState(
    JSON.stringify(
      {
        page: { orientation: 'landscape' },
        fields: {
          title: { x: 60, y: 530, size: 28 },
          fullName: { x: 60, y: 430, size: 22 },
          position: { x: 60, y: 390, size: 14 },
          examTypeName: { x: 60, y: 360, size: 14 },
          grade: { x: 60, y: 330, size: 14 },
          certificateNumber: { x: 60, y: 300, size: 14 },
          issuedAt: { x: 60, y: 270, size: 12 },
          validTo: { x: 60, y: 245, size: 12 },
          signerName: { x: 60, y: 200, size: 12 },
          qr: { x: 670, y: 155, size: 150 },
          verifyUrl: { x: 60, y: 120, size: 10 },
        },
      },
      null,
      2,
    ),
  );
  const [tplVerFile, setTplVerFile] = useState<File | null>(null);

  async function refreshTemplatesAdmin() {
    if (!token || !hasPerm(me, 'templates:manage')) return;
    try {
      setTemplatesAdmin(await apiFetch<TemplateAdmin[]>('/api/internal/templates'));
      setTemplateVersions(await apiFetch<TemplateVersionActive[]>('/template-versions/active'));
    } catch {
      /* ignore */
    }
  }

  async function createTemplateAdmin() {
    setActionErr(null);
    try {
      await apiFetch('/api/internal/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: tplName, description: tplDesc || null }),
      });
      flashOk('Шаблон создан');
      await refreshTemplatesAdmin();
    } catch (e: any) {
      setActionErr(String(e?.message ?? e));
    }
  }

  async function createTemplateVersionAdmin() {
    if (!tplVerTemplateId) {
      setActionErr('Выберите шаблон');
      return;
    }
    setActionErr(null);
    try {
      const fd = new FormData();
      fd.append('configJson', tplVerConfig);
      fd.append('isActive', 'true');
      if (tplVerFile) fd.append('background', tplVerFile);

      const res = await fetch(`${apiUrl}/api/internal/templates/${tplVerTemplateId}/versions`, {
        method: 'POST',
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: fd,
      });
      if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
      flashOk('Версия шаблона создана');
      setTplVerFile(null);
      await refreshTemplatesAdmin();
    } catch (e: any) {
      setActionErr(String(e?.message ?? e));
    }
  }
  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: 24, maxWidth: 980 }}>
      <h1>Реестр сертификатов — прототип</h1>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16 }}>
        <section style={{ background: '#f6f8fa', padding: 12, borderRadius: 10 }}>
          <h2 style={{ marginTop: 0 }}>Backend health</h2>
          {healthErr && <pre style={{ background: '#fee', padding: 12 }}>Ошибка: {healthErr}</pre>}
          {!health && !healthErr && <p>Загружаю...</p>}
          {health && <pre style={{ background: '#fff', padding: 12, borderRadius: 8 }}>{JSON.stringify(health, null, 2)}</pre>}
        </section>

        <section style={{ background: '#f6f8fa', padding: 12, borderRadius: 10 }}>
          <h2 style={{ marginTop: 0 }}>Auth</h2>

          {!token && (
            <form onSubmit={onLogin} style={{ display: 'grid', gap: 10, maxWidth: 520 }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button type="button" onClick={() => { setLoginEmail('admin@example.com'); setLoginPassword('admin123'); }}>
                  Admin
                </button>
                <button type="button" onClick={() => { setLoginEmail('creator@example.com'); setLoginPassword('creator123'); }}>
                  Creator
                </button>
                <button type="button" onClick={() => { setLoginEmail('signer@example.com'); setLoginPassword('signer123'); }}>
                  Signer
                </button>
              </div>

              <label>
                Email
                <input value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} style={{ width: '100%', padding: 8, marginTop: 4 }} />
              </label>
              <label>
                Пароль
                <input type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} style={{ width: '100%', padding: 8, marginTop: 4 }} />
              </label>
              <button type="submit" style={{ padding: '8px 12px' }}>
                Войти
              </button>
              {authErr && <div style={{ color: '#b00020' }}>Ошибка: {authErr}</div>}
              <div style={{ fontSize: 13, opacity: 0.8 }}>
                Пользователи создаются при старте backend (см. <code>.env</code>).
              </div>
            </form>
          )}

          {token && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                <div>
                  Вы вошли как: <b>{me?.displayName ?? me?.email ?? '...'}</b>
                  {me && (
                    <div style={{ fontSize: 13, opacity: 0.8, marginTop: 4 }}>
                      Permissions: {me.permissions.join(', ')}
                    </div>
                  )}
                </div>
                <button onClick={onLogout} style={{ padding: '6px 10px' }}>
                  Выйти
                </button>
              </div>

              {actionOk && <div style={{ marginTop: 10, color: '#0a7d24' }}>{actionOk}</div>}
              {actionErr && <pre style={{ marginTop: 10, background: '#fee', padding: 12 }}>Ошибка: {actionErr}</pre>}

              <div style={{ marginTop: 10 }}>
                Публичная проверка demo сертификата: <a href={`${apiUrl}/certs/outer/demo-public-id-12345`} target="_blank">/certs/outer/demo-public-id-12345</a>
              </div>
            </div>
          )}
        </section>

        {token && me && hasPerm(me, 'exam:create') && (
          <section style={{ background: '#f6f8fa', padding: 12, borderRadius: 10 }}>
            <h2 style={{ marginTop: 0 }}>Создать попытку экзамена</h2>
            <div style={{ display: 'grid', gap: 10, maxWidth: 640 }}>
              <label>
                ФИО
                <input value={fullName} onChange={(e) => setFullName(e.target.value)} style={{ width: '100%', padding: 8, marginTop: 4 }} />
              </label>
              <label>
                Должность
                <input value={position} onChange={(e) => setPosition(e.target.value)} style={{ width: '100%', padding: 8, marginTop: 4 }} />
              </label>
              <label>
                Employee Code (опционально)
                <input value={employeeCode} onChange={(e) => setEmployeeCode(e.target.value)} style={{ width: '100%', padding: 8, marginTop: 4 }} />
              </label>
              <label>
                Тип экзамена
                <select value={examTypeId} onChange={(e) => setExamTypeId(e.target.value)} style={{ width: '100%', padding: 8, marginTop: 4 }}>
                  {examTypes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.code})
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Шаблон сертификата (опционально)
                <select value={templateVersionId} onChange={(e) => setTemplateVersionId(e.target.value)} style={{ width: '100%', padding: 8, marginTop: 4 }}>
                  <option value="">(по умолчанию для типа экзамена)</option>
                  {templateVersions.map((tv) => (
                    <option key={tv.id} value={tv.id}>
                      {tv.templateName} v{tv.version}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Оценка
                <select value={grade} onChange={(e) => setGrade(e.target.value as any)} style={{ width: '100%', padding: 8, marginTop: 4 }}>
                  <option value="gold">Gold</option>
                  <option value="silver">Silver</option>
                  <option value="fail">Не сдал</option>
                </select>
              </label>
              <label>
                Дата экзамена
                <input type="date" value={examDate} onChange={(e) => setExamDate(e.target.value)} style={{ width: '100%', padding: 8, marginTop: 4 }} />
              </label>

              {hasPerm(me, 'users:read') && (
                <label>
                  Кто подписывает
                  <select value={signerUserId} onChange={(e) => setSignerUserId(e.target.value)} style={{ width: '100%', padding: 8, marginTop: 4 }}>
                    <option value="">(не выбрано)</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.displayName ?? u.email}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <label>
                Примечание
                <input value={notes} onChange={(e) => setNotes(e.target.value)} style={{ width: '100%', padding: 8, marginTop: 4 }} />
              </label>

              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={createAttempt} style={{ padding: '8px 12px' }}>
                  Создать
                </button>
                <button onClick={refreshMine} style={{ padding: '8px 12px' }}>
                  Обновить список
                </button>
              </div>
              <div style={{ fontSize: 13, opacity: 0.8 }}>
                Подсказка: при старте backend уже создаётся demo draft attempt (marker <code>DEMO_ATTEMPT_V1</code>), который можно отправить на подпись.
              </div>
            </div>
          </section>
        )}


        {token && me && hasPerm(me, 'templates:manage') && (
          <section style={{ background: '#f6f8fa', padding: 12, borderRadius: 10 }}>
            <h2 style={{ marginTop: 0 }}>Управление шаблонами</h2>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
              <button onClick={refreshTemplatesAdmin} style={{ padding: '8px 12px' }}>Обновить</button>
            </div>

            <div style={{ display: 'grid', gap: 10, maxWidth: 740 }}>
              <div style={{ background: '#fff', padding: 12, borderRadius: 8 }}>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>Создать шаблон</div>
                <div style={{ display: 'grid', gap: 8 }}>
                  <input value={tplName} onChange={(e) => setTplName(e.target.value)} placeholder="Название" style={{ padding: 8 }} />
                  <input value={tplDesc} onChange={(e) => setTplDesc(e.target.value)} placeholder="Описание (опц.)" style={{ padding: 8 }} />
                  <button onClick={createTemplateAdmin} style={{ padding: '8px 12px', width: 'fit-content' }}>Создать</button>
                </div>
              </div>

              <div style={{ background: '#fff', padding: 12, borderRadius: 8 }}>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>Создать версию (активную)</div>
                <div style={{ display: 'grid', gap: 8 }}>
                  <select value={tplVerTemplateId} onChange={(e) => setTplVerTemplateId(e.target.value)} style={{ padding: 8 }}>
                    <option value="">(выберите шаблон)</option>
                    {templatesAdmin.map((tpl) => (
                      <option key={tpl.id} value={tpl.id}>
                        {tpl.name}
                      </option>
                    ))}
                  </select>
                  <textarea value={tplVerConfig} onChange={(e) => setTplVerConfig(e.target.value)} rows={10} style={{ padding: 8, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }} />
                  <input type="file" accept="image/png,image/jpeg" onChange={(e) => setTplVerFile(e.target.files?.[0] ?? null)} />
                  <button onClick={createTemplateVersionAdmin} style={{ padding: '8px 12px', width: 'fit-content' }}>Загрузить версию</button>
                </div>
              </div>

              <div style={{ background: '#fff', padding: 12, borderRadius: 8 }}>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>Список</div>
                <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{JSON.stringify(templatesAdmin, null, 2)}</pre>
              </div>
            </div>
          </section>
        )}

        {token && me && (
          <section style={{ background: '#f6f8fa', padding: 12, borderRadius: 10 }}>
            <h2 style={{ marginTop: 0 }}>Мои попытки</h2>
            <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
              <button onClick={refreshMine} style={{ padding: '8px 12px' }}>
                Обновить
              </button>
            </div>
            {attempts.length === 0 ? (
              <div style={{ opacity: 0.8 }}>Пока пусто.</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: 8 }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #eee' }}>Сотрудник</th>
                      <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #eee' }}>Экзамен</th>
                      <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #eee' }}>Попытка</th>
                      <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #eee' }}>Оценка</th>
                      <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #eee' }}>Статус</th>
                      <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #eee' }}>Подписант</th>
                      <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #eee' }}>Сертификат</th>
                      <th style={{ padding: 8, borderBottom: '1px solid #eee' }} />
                    </tr>
                  </thead>
                  <tbody>
                    {attempts.map((a) => (
                      <tr key={a.id}>
                        <td style={{ padding: 8, borderBottom: '1px solid #f1f1f1' }}>
                          <div><b>{a.person.fullName}</b></div>
                          <div style={{ fontSize: 12, opacity: 0.75 }}>{a.person.position}{a.person.employeeCode ? ` • ${a.person.employeeCode}` : ''}</div>
                        </td>
                        <td style={{ padding: 8, borderBottom: '1px solid #f1f1f1' }}>{a.examType.name} ({a.examType.code})</td>
                        <td style={{ padding: 8, borderBottom: '1px solid #f1f1f1' }}>#{a.attemptNo}</td>
                        <td style={{ padding: 8, borderBottom: '1px solid #f1f1f1' }}>{a.grade}</td>
                        <td style={{ padding: 8, borderBottom: '1px solid #f1f1f1' }}>{a.status}</td>
                        <td style={{ padding: 8, borderBottom: '1px solid #f1f1f1' }}>{a.signerUser ? (a.signerUser.displayName ?? a.signerUser.email) : '—'}</td>
                        <td style={{ padding: 8, borderBottom: '1px solid #f1f1f1' }}>
                          {a.certificate ? (
                            <div style={{ display: 'grid', gap: 6 }}>
                              <div><b>{a.certificate.certificateNumber}</b> <span style={{ fontSize: 12, opacity: 0.75 }}>({a.certificate.status})</span></div>
                              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                <button onClick={() => openCert(a.certificate!.publicId)} style={{ padding: '6px 10px' }}>Внутр. вид</button>
                                <a
                                  href={`${apiUrl}/certs/outer/${a.certificate.publicId}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  style={{ padding: '6px 10px', background: '#fff', border: '1px solid #ddd', borderRadius: 6, textDecoration: 'none', color: 'inherit' }}
                                >
                                  Проверка
                                </a>
                              </div>
                              {a.certificate.validTo && <div style={{ fontSize: 12, opacity: 0.75 }}>Действует до: {new Date(a.certificate.validTo).toLocaleDateString()}</div>}
                            </div>
                          ) : (
                            <span style={{ opacity: 0.75 }}>—</span>
                          )}
                        </td>
                        <td style={{ padding: 8, borderBottom: '1px solid #f1f1f1', textAlign: 'right' }}>
                          {hasPerm(me, 'exam:submit') && ['draft', 'needs_fix'].includes(a.status) && a.grade !== 'fail' && (
                            <button onClick={() => submitAttempt(a.id)} style={{ padding: '6px 10px' }}>
                              Отправить на подпись
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {token && me && selectedCertPublicId && (
          <section style={{ background: '#f6f8fa', padding: 12, borderRadius: 10 }}>
            <h2 style={{ marginTop: 0 }}>Просмотр сертификата</h2>
            <div style={{ marginBottom: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button onClick={() => openCert(selectedCertPublicId)} style={{ padding: '8px 12px' }}>Обновить</button>
              <button onClick={() => downloadPdf(selectedCertPublicId)} style={{ padding: '8px 12px' }}>Скачать PDF</button>
              <a
                href={`${apiUrl}/certs/outer/${selectedCertPublicId}`}
                target="_blank"
                rel="noreferrer"
                style={{ padding: '8px 12px', background: '#fff', border: '1px solid #ddd', borderRadius: 6, textDecoration: 'none', color: 'inherit' }}
              >
                Открыть public verify
              </a>
              <button onClick={() => { setSelectedCertPublicId(null); setSelectedCert(null); }} style={{ padding: '8px 12px' }}>
                Закрыть
              </button>
            </div>

            {!selectedCert ? (
              <div style={{ opacity: 0.8 }}>Загружаю...</div>
            ) : selectedCert.status === 'not_found' ? (
              <div style={{ background: '#fff', padding: 12, borderRadius: 8 }}>Не найдено.</div>
            ) : (
              <div style={{ background: '#fff', padding: 12, borderRadius: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: 18 }}><b>{selectedCert.certificate.certificateNumber}</b></div>
                    <div style={{ fontSize: 13, opacity: 0.75 }}>Статус: {selectedCert.certificate.status}{selectedCert.certificate.expired ? ' (просрочен)' : ''}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {hasPerm(me, 'certificate:revoke') && selectedCert.certificate.status === 'issued' && (
                      <>
                        <button onClick={() => revokeCert(selectedCertPublicId, 'revoke')} style={{ padding: '8px 12px' }}>Отозвать</button>
                        <button onClick={() => revokeCert(selectedCertPublicId, 'annul')} style={{ padding: '8px 12px' }}>Аннулировать</button>
                      </>
                    )}
                  </div>
                </div>

                <hr style={{ margin: '12px 0', border: 'none', borderTop: '1px solid #eee' }} />
                <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{JSON.stringify(selectedCert, null, 2)}</pre>
              </div>
            )}
          </section>
        )}

        {token && me && hasPerm(me, 'approval:review') && (
          <section style={{ background: '#f6f8fa', padding: 12, borderRadius: 10 }}>
            <h2 style={{ marginTop: 0 }}>Inbox подписанта</h2>
            <div style={{ display: 'flex', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
              <button onClick={refreshInbox} style={{ padding: '8px 12px' }}>Обновить</button>
              <button disabled={selectedApprovalIds.length === 0} onClick={() => bulk('approve')} style={{ padding: '8px 12px' }}>
                Массово подписать ({selectedApprovalIds.length})
              </button>
              <button disabled={selectedApprovalIds.length === 0} onClick={() => bulk('reject')} style={{ padding: '8px 12px' }}>
                Массово отклонить ({selectedApprovalIds.length})
              </button>
            </div>

            {approvals.length === 0 ? (
              <div style={{ opacity: 0.8 }}>Нет ожидающих подписей.</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: 8 }}>
                  <thead>
                    <tr>
                      <th style={{ padding: 8, borderBottom: '1px solid #eee' }} />
                      <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #eee' }}>Сотрудник</th>
                      <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #eee' }}>Экзамен</th>
                      <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #eee' }}>Оценка</th>
                      <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #eee' }}>От кого</th>
                      <th style={{ padding: 8, borderBottom: '1px solid #eee' }} />
                    </tr>
                  </thead>
                  <tbody>
                    {approvals.map((a) => (
                      <tr key={a.id}>
                        <td style={{ padding: 8, borderBottom: '1px solid #f1f1f1' }}>
                          <input type="checkbox" checked={selectedApprovalIds.includes(a.id)} onChange={() => toggleApproval(a.id)} />
                        </td>
                        <td style={{ padding: 8, borderBottom: '1px solid #f1f1f1' }}>
                          <div><b>{a.examAttempt.person.fullName}</b></div>
                          <div style={{ fontSize: 12, opacity: 0.75 }}>{a.examAttempt.person.position}{a.examAttempt.person.employeeCode ? ` • ${a.examAttempt.person.employeeCode}` : ''}</div>
                        </td>
                        <td style={{ padding: 8, borderBottom: '1px solid #f1f1f1' }}>{a.examAttempt.examType.name} ({a.examAttempt.examType.code})</td>
                        <td style={{ padding: 8, borderBottom: '1px solid #f1f1f1' }}>{a.examAttempt.grade}</td>
                        <td style={{ padding: 8, borderBottom: '1px solid #f1f1f1' }}>{a.examAttempt.createdBy.displayName ?? a.examAttempt.createdBy.email}</td>
                        <td style={{ padding: 8, borderBottom: '1px solid #f1f1f1', textAlign: 'right' }}>
                          <button onClick={() => approveOne(a.id)} style={{ padding: '6px 10px', marginRight: 8 }}>Подписать</button>
                          <button onClick={() => rejectOne(a.id)} style={{ padding: '6px 10px' }}>Отклонить</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
