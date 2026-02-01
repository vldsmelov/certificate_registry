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

type CertificateListItem = {
  certificateNumber: string;
  publicId: string;
  status: string;
  grade: string;
  issuedAt: string;
  validTo: string | null;
  expired: boolean;
  revokedAt: string | null;
  revokeReason: string | null;
  person: { fullName: string; position: string; employeeCode: string | null };
  examType: { id: string; name: string; code: string };
  examDate: string;
  attemptNo: number;
  signerName: string | null;
};

type CertificateListResponse = {
  page: number;
  pageSize: number;
  total: number;
  items: CertificateListItem[];
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

  // Certificates registry
  const [certRegistry, setCertRegistry] = useState<CertificateListResponse | null>(null);
  const [certQ, setCertQ] = useState('');
  const [certStatus, setCertStatus] = useState('');
  const [certGrade, setCertGrade] = useState('');
  const [certExamTypeId, setCertExamTypeId] = useState('');
  const [certValidity, setCertValidity] = useState('');
  const [certIssuedFrom, setCertIssuedFrom] = useState('');
  const [certIssuedTo, setCertIssuedTo] = useState('');

  // UI errors
  const [actionErr, setActionErr] = useState<string | null>(null);
  const [actionOk, setActionOk] = useState<string | null>(null);

  const [selectedCert, setSelectedCert] = useState<CertInternalView | null>(null);
  const [selectedCertPublicId, setSelectedCertPublicId] = useState<string | null>(null);


// Tabs (UI)
const availableTabs = useMemo(() => {
  const t: { key: string; label: string; require?: string }[] = [];
  // Default internal tab
  t.push({ key: 'exams', label: 'Экзамены' });
  if (me && hasPerm(me, 'approval:review')) t.push({ key: 'approvals', label: 'Подписи' });
  if (me && hasPerm(me, 'certificate:view_internal')) t.push({ key: 'certs', label: 'Сертификаты' });
  if (me && hasPerm(me, 'templates:manage')) t.push({ key: 'templates', label: 'Шаблоны' });
  return t;
}, [me]);

const [activeTab, setActiveTab] = useState<string>('exams');

useEffect(() => {
  if (!token || !me) return;
  if (availableTabs.length === 0) return;
  if (!availableTabs.some((x) => x.key === activeTab)) {
    setActiveTab(availableTabs[0].key);
  }
}, [token, me, availableTabs, activeTab]);

function fmtDate(v?: string | null) {
  if (!v) return '—';
  const d = new Date(v);
  return d.toLocaleDateString('ru-RU');
}

function gradeBadge(g: string) {
  const gg = (g || '').toLowerCase();
  if (gg === 'gold') return { text: 'Gold', cls: 'warning' };
  if (gg === 'silver') return { text: 'Silver', cls: 'neutral' };
  if (gg === 'fail') return { text: 'Не сдал', cls: 'danger' };
  return { text: g, cls: 'info' };
}

function certStatusBadge(status: string, expired?: boolean) {
  if (status === 'revoked') return { text: 'Отозван', cls: 'danger' };
  if (status === 'annulled') return { text: 'Аннулирован', cls: 'danger' };
  if (expired) return { text: 'Истёк', cls: 'warning' };
  return { text: 'Действует', cls: 'success' };
}


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
    }

    // Certificates registry (internal)
    if (hasPerm(me, 'certificate:view_internal')) {
      refreshCerts(1);
    } else {
      setCertRegistry(null);
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
    setCertRegistry(null);
  }

  async function refreshMine() {
    if (!token) return;
    try {
      setAttempts(await apiFetch<Attempt[]>('/attempts/mine'));
    } catch {
      /* ignore */
    }
  }

  function buildCertQuery(page: number = 1) {
    const p = new URLSearchParams();
    if (certQ.trim()) p.set('q', certQ.trim());
    if (certStatus) p.set('status', certStatus);
    if (certGrade) p.set('grade', certGrade);
    if (certExamTypeId) p.set('examTypeId', certExamTypeId);
    if (certValidity) p.set('validity', certValidity);
    if (certIssuedFrom) p.set('issuedFrom', certIssuedFrom);
    if (certIssuedTo) p.set('issuedTo', certIssuedTo);
    p.set('page', String(page));
    p.set('pageSize', '20');
    return p.toString();
  }

  async function refreshCerts(page: number = 1) {
    if (!token) return;
    try {
      const qs = buildCertQuery(page);
      const res = await apiFetch<CertificateListResponse>(`/api/internal/certificates?${qs}`);
      setCertRegistry(res);
    } catch (e: any) {
      setActionErr(String(e?.message ?? e));
      setCertRegistry(null);
    }
  }

  async function exportCsv() {
    if (!token) return;
    try {
      const qs = buildCertQuery(1);
      const res = await fetch(`${apiUrl}/api/internal/certificates/export.csv?${qs}`, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
      const blob = await res.blob();
      const cd = res.headers.get('content-disposition') ?? '';
      const m = /filename="?([^";]+)"?/i.exec(cd);
      const filename = m?.[1] ?? 'certificates.csv';
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      flashOk('CSV экспортирован');
    } catch (e: any) {
      setActionErr(String(e?.message ?? e));
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
    <div className="layout">
      <header className="header">
        <div className="header-inner">
          <div className="brand" role="banner">
            <div className="logo" aria-hidden="true" />
            <div>
              <div className="brand-title">Реестр сертификатов</div>
              <div className="brand-sub">прототип • внутренний/внешний контур</div>
            </div>
          </div>

          {token && me ? (
            <nav className="tabs" aria-label="Разделы">
              {availableTabs.map((t) => (
                <button
                  key={t.key}
                  className={`tab ${activeTab === t.key ? 'active' : ''}`}
                  onClick={() => setActiveTab(t.key)}
                  type="button"
                >
                  {t.label}
                </button>
              ))}
            </nav>
          ) : (
            <div className="spacer" />
          )}

          <div className="top-right">
            <span className="pill" title="Состояние backend">
              Backend: <strong>{health?.status ?? (healthErr ? 'ошибка' : '...')}</strong>
            </span>

            {token && me ? (
              <>
                <span className="pill" title="Текущий пользователь">
                  <strong>{me.displayName ?? me.email}</strong>
                </span>
                <button className="btn btn-ghost" onClick={onLogout} type="button">
                  Выйти
                </button>
              </>
            ) : null}
          </div>
        </div>
      </header>

      <main className="main">
        <div className="container">
          {actionOk && <div className="alert ok">✅ {actionOk}</div>}
          {actionErr && <div className="alert err">❌ {actionErr}</div>}

          {!token || !me ? (
            <div className="grid grid-2" style={{ marginTop: 10 }}>
              <section className="card">
                <div className="card-header">
                  <div>
                    <h2 style={{ margin: 0 }}>Вход</h2>
                    <div className="muted" style={{ marginTop: 4 }}>
                      Быстрый логин для проверки ролей. Пользователи создаются при старте backend.
                    </div>
                  </div>
                </div>

                <form onSubmit={onLogin} className="grid" style={{ gap: 12 }}>
                  <div className="row">
                    <button
                      type="button"
                      className="btn"
                      onClick={() => {
                        setLoginEmail('admin@example.com');
                        setLoginPassword('admin123');
                      }}
                    >
                      Admin
                    </button>
                    <button
                      type="button"
                      className="btn"
                      onClick={() => {
                        setLoginEmail('creator@example.com');
                        setLoginPassword('creator123');
                      }}
                    >
                      Creator
                    </button>
                    <button
                      type="button"
                      className="btn"
                      onClick={() => {
                        setLoginEmail('signer@example.com');
                        setLoginPassword('signer123');
                      }}
                    >
                      Signer
                    </button>
                    <div className="spacer" />
                  </div>

                  <div className="field">
                    <label>Email</label>
                    <input className="input" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} />
                  </div>

                  <div className="field">
                    <label>Пароль</label>
                    <input
                      className="input"
                      type="password"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                    />
                  </div>

                  <div className="row">
                    <button className="btn btn-primary" type="submit">
                      Войти
                    </button>
                  </div>

                  {authErr && <div className="alert err">Ошибка: {authErr}</div>}

                  <div className="muted" style={{ fontSize: 13 }}>
                    Подсказка: проверь <code>.env</code> (переменная DEV_BOOTSTRAP).
                  </div>
                </form>
              </section>

              <section className="card">
                <div className="card-header">
                  <div>
                    <h2 style={{ margin: 0 }}>Система</h2>
                    <div className="muted" style={{ marginTop: 4 }}>
                      Быстрая диагностика соединения с backend.
                    </div>
                  </div>
                </div>

                {healthErr && <div className="alert err">Ошибка: {healthErr}</div>}
                {!health && !healthErr && <div className="muted">Загружаю...</div>}
                {health && (
                  <div className="alert ok" style={{ marginBottom: 12 }}>
                    Backend OK • DB {health.db}
                  </div>
                )}
                {health && (
                  <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{JSON.stringify(health, null, 2)}</pre>
                )}

                <div style={{ marginTop: 12 }}>
                  <div className="muted" style={{ fontSize: 13 }}>
                    Public demo verify:
                  </div>
                  <a href={`${apiUrl}/certs/outer/demo-public-id-12345`} target="_blank" rel="noreferrer">
                    /certs/outer/demo-public-id-12345
                  </a>
                </div>
              </section>
            </div>
          ) : (
            <>
              {/* Tabs content */}
              {activeTab === 'exams' && (
                <div className="grid" style={{ marginTop: 10 }}>
                  {hasPerm(me, 'exam:create') && (
                    <section className="card">
                      <div className="card-header">
                        <div>
                          <h2 style={{ margin: 0 }}>Создать попытку экзамена</h2>
                          <div className="muted" style={{ marginTop: 4 }}>
                            Заполните данные, выберите подписанта и (опционально) шаблон сертификата.
                          </div>
                        </div>
                        <div className="row">
                          <button className="btn" onClick={refreshMine} type="button">
                            Обновить мои попытки
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-2">
                        <div className="field">
                          <label>ФИО</label>
                          <input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} />
                        </div>
                        <div className="field">
                          <label>Должность</label>
                          <input className="input" value={position} onChange={(e) => setPosition(e.target.value)} />
                        </div>

                        <div className="field">
                          <label>Employee Code (опционально)</label>
                          <input className="input" value={employeeCode} onChange={(e) => setEmployeeCode(e.target.value)} />
                        </div>

                        <div className="field">
                          <label>Тип экзамена</label>
                          <select className="select" value={examTypeId} onChange={(e) => setExamTypeId(e.target.value)}>
                            {examTypes.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.name} ({t.code})
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="field">
                          <label>Шаблон сертификата (опционально)</label>
                          <select className="select" value={templateVersionId} onChange={(e) => setTemplateVersionId(e.target.value)}>
                            <option value="">(по умолчанию для типа экзамена)</option>
                            {templateVersions.map((tv) => (
                              <option key={tv.id} value={tv.id}>
                                {tv.templateName} v{tv.version}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="field">
                          <label>Оценка</label>
                          <select className="select" value={grade} onChange={(e) => setGrade(e.target.value as any)}>
                            <option value="gold">Gold</option>
                            <option value="silver">Silver</option>
                            <option value="fail">Не сдал</option>
                          </select>
                        </div>

                        <div className="field">
                          <label>Дата экзамена</label>
                          <input className="input" type="date" value={examDate} onChange={(e) => setExamDate(e.target.value)} />
                        </div>

                        {hasPerm(me, 'users:read') && (
                          <div className="field">
                            <label>Кто подписывает</label>
                            <select className="select" value={signerUserId} onChange={(e) => setSignerUserId(e.target.value)}>
                              <option value="">(не выбрано)</option>
                              {users.map((u) => (
                                <option key={u.id} value={u.id}>
                                  {u.displayName ?? u.email}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

                        <div className="field" style={{ gridColumn: '1 / -1' }}>
                          <label>Примечание</label>
                          <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} />
                        </div>

                        <div className="row" style={{ gridColumn: '1 / -1' }}>
                          <button className="btn btn-primary" onClick={createAttempt} type="button">
                            Создать
                          </button>
                          <button className="btn" onClick={refreshMine} type="button">
                            Обновить список
                          </button>
                          <span className="muted" style={{ fontSize: 13 }}>
                            Demo attempt создаётся автоматически при старте backend (marker <code>DEMO_ATTEMPT_V1</code>).
                          </span>
                        </div>
                      </div>
                    </section>
                  )}

                  <section className="card">
                    <div className="card-header">
                      <div>
                        <h2 style={{ margin: 0 }}>Мои попытки</h2>
                        <div className="muted" style={{ marginTop: 4 }}>
                          Черновики/на подписи/подписано — всё в одном списке.
                        </div>
                      </div>
                      <div className="row">
                        <button className="btn" onClick={refreshMine} type="button">
                          Обновить
                        </button>
                      </div>
                    </div>

                    {attempts.length === 0 ? (
                      <div className="muted">Пока пусто.</div>
                    ) : (
                      <div className="table-wrap">
                        <table className="table">
                          <thead>
                            <tr>
                              <th>Сотрудник</th>
                              <th>Экзамен</th>
                              <th>Попытка</th>
                              <th>Оценка</th>
                              <th>Статус</th>
                              <th>Подписант</th>
                              <th>Сертификат</th>
                              <th className="actions" />
                            </tr>
                          </thead>
                          <tbody>
                            {attempts.map((a) => {
                              const gb = gradeBadge(a.grade);
                              return (
                                <tr key={a.id}>
                                  <td>
                                    <div style={{ fontWeight: 800 }}>{a.person.fullName}</div>
                                    <div className="muted" style={{ fontSize: 12 }}>
                                      {a.person.position}
                                      {a.person.employeeCode ? ` • ${a.person.employeeCode}` : ''}
                                    </div>
                                  </td>
                                  <td>
                                    {a.examType.name} <span className="muted">({a.examType.code})</span>
                                  </td>
                                  <td>#{a.attemptNo}</td>
                                  <td>
                                    <span className={`badge ${gb.cls}`}>{gb.text}</span>
                                  </td>
                                  <td>
                                    <span className="badge info">{a.status}</span>
                                  </td>
                                  <td>{a.signerUser ? (a.signerUser.displayName ?? a.signerUser.email) : '—'}</td>
                                  <td>
                                    {a.certificate ? (
                                      <div className="grid" style={{ gap: 8 }}>
                                        <div className="row">
                                          <span style={{ fontWeight: 900 }}>{a.certificate.certificateNumber}</span>
                                          <span className="muted" style={{ fontSize: 12 }}>
                                            ({a.certificate.status})
                                          </span>
                                        </div>
                                        <div className="row">
                                          <button className="btn btn-ghost" onClick={() => openCert(a.certificate!.publicId)} type="button">
                                            Внутр. вид
                                          </button>
                                          <a className="btn btn-ghost" href={`${apiUrl}/certs/outer/${a.certificate.publicId}`} target="_blank" rel="noreferrer">
                                            Проверка
                                          </a>
                                        </div>
                                        {a.certificate.validTo && (
                                          <div className="muted" style={{ fontSize: 12 }}>
                                            Действует до: {fmtDate(a.certificate.validTo)}
                                          </div>
                                        )}
                                      </div>
                                    ) : (
                                      <span className="muted">—</span>
                                    )}
                                  </td>
                                  <td className="actions">
                                    {hasPerm(me, 'exam:submit') && ['draft', 'needs_fix'].includes(a.status) && a.grade !== 'fail' && (
                                      <button className="btn btn-primary" onClick={() => submitAttempt(a.id)} type="button">
                                        Отправить на подпись
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </section>
                </div>
              )}

              {activeTab === 'approvals' && hasPerm(me, 'approval:review') && (
                <div className="grid" style={{ marginTop: 10 }}>
                  <section className="card">
                    <div className="card-header">
                      <div>
                        <h2 style={{ margin: 0 }}>Inbox подписанта</h2>
                        <div className="muted" style={{ marginTop: 4 }}>
                          Подпишите или отклоните записи. Массовые операции доступны через чекбоксы.
                        </div>
                      </div>
                      <div className="row">
                        <button className="btn" onClick={refreshInbox} type="button">
                          Обновить
                        </button>
                        <button className="btn btn-primary" disabled={selectedApprovalIds.length === 0} onClick={() => bulk('approve')} type="button">
                          Массово подписать ({selectedApprovalIds.length})
                        </button>
                        <button className="btn btn-danger" disabled={selectedApprovalIds.length === 0} onClick={() => bulk('reject')} type="button">
                          Массово отклонить ({selectedApprovalIds.length})
                        </button>
                      </div>
                    </div>

                    {approvals.length === 0 ? (
                      <div className="muted">Нет ожидающих подписей.</div>
                    ) : (
                      <div className="table-wrap">
                        <table className="table">
                          <thead>
                            <tr>
                              <th style={{ width: 44 }} />
                              <th>Сотрудник</th>
                              <th>Экзамен</th>
                              <th>Оценка</th>
                              <th>От кого</th>
                              <th className="actions" />
                            </tr>
                          </thead>
                          <tbody>
                            {approvals.map((a) => {
                              const gb = gradeBadge(a.examAttempt.grade);
                              return (
                                <tr key={a.id}>
                                  <td>
                                    <input type="checkbox" checked={selectedApprovalIds.includes(a.id)} onChange={() => toggleApproval(a.id)} />
                                  </td>
                                  <td>
                                    <div style={{ fontWeight: 800 }}>{a.examAttempt.person.fullName}</div>
                                    <div className="muted" style={{ fontSize: 12 }}>
                                      {a.examAttempt.person.position}
                                      {a.examAttempt.person.employeeCode ? ` • ${a.examAttempt.person.employeeCode}` : ''}
                                    </div>
                                  </td>
                                  <td>
                                    {a.examAttempt.examType.name} <span className="muted">({a.examAttempt.examType.code})</span>
                                  </td>
                                  <td>
                                    <span className={`badge ${gb.cls}`}>{gb.text}</span>
                                  </td>
                                  <td>{a.examAttempt.createdBy.displayName ?? a.examAttempt.createdBy.email}</td>
                                  <td className="actions">
                                    <button className="btn btn-primary" onClick={() => approveOne(a.id)} type="button">
                                      Подписать
                                    </button>
                                    <button className="btn btn-danger" onClick={() => rejectOne(a.id)} type="button">
                                      Отклонить
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </section>
                </div>
              )}

              {activeTab === 'certs' && hasPerm(me, 'certificate:view_internal') && (
                <div className="grid grid-2" style={{ marginTop: 10 }}>
                  <section className="card">
                    <div className="card-header">
                      <div>
                        <h2 style={{ margin: 0 }}>Реестр сертификатов</h2>
                        <div className="muted" style={{ marginTop: 4 }}>
                          Поиск по номеру, ФИО и должности. Фильтры применяются и для экспорта.
                        </div>
                      </div>
                      <div className="row">
                        <button className="btn" onClick={refreshCerts} type="button">
                          Обновить
                        </button>
                        {hasPerm(me, 'export:run') && (
                          <button className="btn btn-primary" onClick={exportCsv} type="button">
                            Экспорт CSV
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="grid" style={{ gap: 12 }}>
                      <div className="row">
                        <div className="field" style={{ flex: 1, minWidth: 220 }}>
                          <label>Поиск</label>
                          <input className="input" value={certQ} onChange={(e) => setCertQ(e.target.value)} placeholder="номер / ФИО / должность" />
                        </div>

                        <div className="field">
                          <label>Статус</label>
                          <select className="select" value={certStatus} onChange={(e) => setCertStatus(e.target.value)}>
                            <option value="">(любой)</option>
                            <option value="issued">issued</option>
                            <option value="revoked">revoked</option>
                            <option value="annulled">annulled</option>
                            <option value="expired">expired</option>
                          </select>
                        </div>

                        <div className="field">
                          <label>Оценка</label>
                          <select className="select" value={certGrade} onChange={(e) => setCertGrade(e.target.value)}>
                            <option value="">(любая)</option>
                            <option value="gold">gold</option>
                            <option value="silver">silver</option>
                          </select>
                        </div>

                        <div className="field">
                          <label>Тип экзамена</label>
                          <select className="select" value={certExamTypeId} onChange={(e) => setCertExamTypeId(e.target.value)}>
                            <option value="">(любой)</option>
                            {examTypes.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.name} ({t.code})
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="row">
                        <div className="field">
                          <label>Validity</label>
                          <select className="select" value={certValidity} onChange={(e) => setCertValidity(e.target.value)}>
                            <option value="">(любой)</option>
                            <option value="active">active</option>
                            <option value="expired">expired</option>
                          </select>
                        </div>

                        <div className="field">
                          <label>Issued from</label>
                          <input className="input" type="date" value={certIssuedFrom} onChange={(e) => setCertIssuedFrom(e.target.value)} />
                        </div>

                        <div className="field">
                          <label>Issued to</label>
                          <input className="input" type="date" value={certIssuedTo} onChange={(e) => setCertIssuedTo(e.target.value)} />
                        </div>

                        <div className="spacer" />
                        <button className="btn btn-primary" onClick={() => refreshCerts(1)} type="button">
                          Применить
                        </button>
                      </div>

                      {certRegistry ? (
                        <>
                          <div className="muted" style={{ fontSize: 13 }}>
                            Найдено: <b>{certRegistry.total}</b>
                          </div>
                          <div className="table-wrap">
                            <table className="table">
                              <thead>
                                <tr>
                                  <th>Номер</th>
                                  <th>Сотрудник</th>
                                  <th>Экзамен</th>
                                  <th>Оценка</th>
                                  <th>Статус</th>
                                  <th>Выдан</th>
                                  <th className="actions" />
                                </tr>
                              </thead>
                              <tbody>
                                {certRegistry.items.map((c) => {
                                  const gb = gradeBadge(c.grade);
                                  const sb = certStatusBadge(c.status, c.expired);
                                  return (
                                    <tr key={c.publicId}>
                                      <td style={{ fontWeight: 900 }}>{c.certificateNumber}</td>
                                      <td>
                                        <div style={{ fontWeight: 800 }}>{c.person.fullName}</div>
                                        <div className="muted" style={{ fontSize: 12 }}>
                                          {c.person.position}
                                          {c.person.employeeCode ? ` • ${c.person.employeeCode}` : ''}
                                        </div>
                                      </td>
                                      <td>
                                        {c.examType.name} <span className="muted">({c.examType.code})</span>
                                      </td>
                                      <td>
                                        <span className={`badge ${gb.cls}`}>{gb.text}</span>
                                      </td>
                                      <td>
                                        <span className={`badge ${sb.cls}`}>{sb.text}</span>
                                      </td>
                                      <td>
                                        {fmtDate(c.issuedAt)}
                                        {c.validTo ? <div className="muted" style={{ fontSize: 12 }}>до {fmtDate(c.validTo)}</div> : <div className="muted" style={{ fontSize: 12 }}>бессрочно</div>}
                                      </td>
                                      <td className="actions">
                                        <button className="btn btn-ghost" onClick={() => openCert(c.publicId)} type="button">
                                          Открыть
                                        </button>
                                        <button className="btn btn-ghost" onClick={() => downloadPdf(c.publicId)} type="button">
                                          PDF
                                        </button>
                                        <a className="btn btn-ghost" href={`${apiUrl}/certs/outer/${c.publicId}`} target="_blank" rel="noreferrer">
                                          Verify
                                        </a>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>

                          <div className="row" style={{ justifyContent: 'space-between', marginTop: 10 }}>
                            <div className="muted" style={{ fontSize: 13 }}>
                              Страница {certRegistry.page} из {Math.max(1, Math.ceil(certRegistry.total / certRegistry.pageSize))}
                            </div>
                            <div className="row">
                              <button className="btn" disabled={certRegistry.page <= 1} onClick={() => refreshCerts(certRegistry.page - 1)} type="button">
                                Назад
                              </button>
                              <button
                                className="btn"
                                disabled={certRegistry.page >= Math.ceil(certRegistry.total / certRegistry.pageSize)}
                                onClick={() => refreshCerts(certRegistry.page + 1)}
                                type="button"
                              >
                                Вперёд
                              </button>
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="muted">Нажмите “Применить”, чтобы загрузить список.</div>
                      )}
                    </div>
                  </section>

                  <section className="card">
                    <div className="card-header">
                      <div>
                        <h2 style={{ margin: 0 }}>Карточка сертификата</h2>
                        <div className="muted" style={{ marginTop: 4 }}>
                          Выберите сертификат в реестре или из списка попыток.
                        </div>
                      </div>
                      {selectedCertPublicId ? (
                        <div className="row">
                          <button className="btn" onClick={() => openCert(selectedCertPublicId)} type="button">
                            Обновить
                          </button>
                          <button className="btn btn-ghost" onClick={() => downloadPdf(selectedCertPublicId)} type="button">
                            PDF
                          </button>
                        </div>
                      ) : null}
                    </div>

                    {!selectedCert ? (
                      <div className="muted">Пока ничего не выбрано.</div>
                    ) : selectedCert.status === 'not_found' ? (
                      <div className="alert err">Сертификат не найден.</div>
                    ) : (
                      <div className="grid" style={{ gap: 12 }}>
                        <div className="row" style={{ flexWrap: 'wrap' }}>
                          <span className="badge info">{selectedCert.certificate.certificateNumber}</span>
                          <span className={`badge ${certStatusBadge(selectedCert.certificate.status, selectedCert.certificate.expired).cls}`}>
                            {certStatusBadge(selectedCert.certificate.status, selectedCert.certificate.expired).text}
                          </span>
                          <span className="badge neutral">
                            issued {fmtDate(selectedCert.certificate.issuedAt)}
                          </span>
                          {selectedCert.certificate.validTo ? (
                            <span className="badge neutral">valid to {fmtDate(selectedCert.certificate.validTo)}</span>
                          ) : (
                            <span className="badge neutral">бессрочно</span>
                          )}
                        </div>

                        {selectedCert.certificate.template ? (
                          <div className="muted" style={{ fontSize: 13 }}>
                            Шаблон: <b>{selectedCert.certificate.template.name}</b> v{selectedCert.certificate.template.version}
                          </div>
                        ) : (
                          <div className="muted" style={{ fontSize: 13 }}>Шаблон: (по умолчанию)</div>
                        )}

                        {hasPerm(me, 'certificate:revoke') && selectedCert.certificate.status === 'issued' && (
                          <div className="row">
                            <button className="btn btn-danger" onClick={() => revokeCert(selectedCert.certificate.publicId)} type="button">
                              Отозвать
                            </button>
                            <button className="btn btn-danger" onClick={() => annulCert(selectedCert.certificate.publicId)} type="button">
                              Аннулировать
                            </button>
                          </div>
                        )}

                        <div className="card" style={{ padding: 12, boxShadow: 'none' }}>
                          <h3 style={{ marginTop: 0 }}>Данные (JSON)</h3>
                          <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{JSON.stringify(selectedCert, null, 2)}</pre>
                        </div>
                      </div>
                    )}
                  </section>
                </div>
              )}

              {activeTab === 'templates' && hasPerm(me, 'templates:manage') && (
                <div className="grid" style={{ marginTop: 10 }}>
                  <section className="card">
                    <div className="card-header">
                      <div>
                        <h2 style={{ margin: 0 }}>Шаблоны сертификатов</h2>
                        <div className="muted" style={{ marginTop: 4 }}>
                          Можно создавать несколько шаблонов и добавлять версии (фон + конфиг).
                        </div>
                      </div>
                      <div className="row">
                        <button className="btn" onClick={refreshTemplatesAdmin} type="button">
                          Обновить
                        </button>
                      </div>
                    </div>

                    <div className="grid" style={{ gap: 14 }}>
                      <div className="card" style={{ padding: 14, boxShadow: 'none' }}>
                        <h3 style={{ marginTop: 0 }}>Создать шаблон</h3>
                        <div className="row">
                          <div className="field" style={{ flex: 1, minWidth: 260 }}>
                            <label>Название</label>
                            <input className="input" value={tplName} onChange={(e) => setTplName(e.target.value)} />
                          </div>
                          <div className="field" style={{ flex: 2, minWidth: 260 }}>
                            <label>Описание (опционально)</label>
                            <input className="input" value={tplDesc} onChange={(e) => setTplDesc(e.target.value)} />
                          </div>
                          <button className="btn btn-primary" onClick={createTemplateAdmin} type="button">
                            Создать
                          </button>
                        </div>
                      </div>

                      <div className="card" style={{ padding: 14, boxShadow: 'none' }}>
                        <h3 style={{ marginTop: 0 }}>Загрузить новую версию</h3>
                        <div className="grid grid-2" style={{ alignItems: 'end' }}>
                          <div className="field">
                            <label>Шаблон</label>
                            <select className="select" value={tplVerTemplateId} onChange={(e) => setTplVerTemplateId(e.target.value)}>
                              <option value="">(выберите)</option>
                              {templatesAdmin.map((t) => (
                                <option key={t.id} value={t.id}>
                                  {t.name}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="field" style={{ gridColumn: '1 / -1' }}>
                            <label>Config JSON (минимальный)</label>
                            <textarea className="textarea" value={tplVerConfig} onChange={(e) => setTplVerConfig(e.target.value)} />
                          </div>

                          <div className="field" style={{ gridColumn: '1 / -1' }}>
                            <label>Фон (PNG/JPG, опционально)</label>
                            <input type="file" onChange={(e) => setTplVerFile(e.target.files?.[0] ?? null)} />
                          </div>

                          <div className="row" style={{ gridColumn: '1 / -1' }}>
                            <button className="btn btn-primary" disabled={!tplVerTemplateId} onClick={createTemplateVersionAdmin} type="button">
                              Загрузить
                            </button>
                            <span className="muted" style={{ fontSize: 13 }}>
                              Для прототипа достаточно config + без фона (PDF будет без background).
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="card" style={{ padding: 14, boxShadow: 'none' }}>
                        <h3 style={{ marginTop: 0 }}>Список</h3>
                        {templatesAdmin.length === 0 ? (
                          <div className="muted">Пока нет шаблонов.</div>
                        ) : (
                          <div className="table-wrap">
                            <table className="table">
                              <thead>
                                <tr>
                                  <th>Шаблон</th>
                                  <th>Версии</th>
                                </tr>
                              </thead>
                              <tbody>
                                {templatesAdmin.map((t) => (
                                  <tr key={t.id}>
                                    <td style={{ fontWeight: 900 }}>{t.name}</td>
                                    <td className="muted">
                                      {t.versions?.length ? t.versions.map((v: any) => `v${v.version}${v.isActive ? ' (active)' : ''}`).join(', ') : '—'}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}

                        <details style={{ marginTop: 12 }}>
                          <summary className="muted" style={{ cursor: 'pointer' }}>
                            Показать JSON (debug)
                          </summary>
                          <pre style={{ marginTop: 10, whiteSpace: 'pre-wrap' }}>{JSON.stringify(templatesAdmin, null, 2)}</pre>
                        </details>
                      </div>
                    </div>
                  </section>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      <footer className="footer">
        <div className="footer-inner">by "Цифровизация проетных задач"</div>
      </footer>
    </div>
  );
}
