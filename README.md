# Реестр сертификатов (prototype)

## Обзор
MVP для внутреннего контура (экзамены → согласование → выпуск сертификата) и внешнего контура (публичная проверка по `public_id`). PDF-файлы не храним: они генерируются on-demand из `render_snapshot_json` и шаблона.

## Структура
```
apps/web              # Next.js (UI + API routes)
packages/domain       # доменные модели, схемы, RBAC
packages/cert-renderer# PDF+QR генерация
packages/verify-widget# публичный виджет проверки
supabase/             # миграции, RLS, функции
```

## Локальный запуск
### 1) Запуск всего стека одной командой (Supabase + Web)
```
 docker compose up
```
В логах появится ссылка на фронтенд: `Frontend: http://localhost:3000`.

> Этот compose поднимает Supabase stack, применяет миграции автоматически и запускает Next.js.

## Env vars
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
PUBLIC_PDF_DOWNLOAD=false
ENABLE_XLSX_EXPORT=true
ENABLE_EMAILS=false
RESEND_API_KEY=
```

## Деплой
### Vercel
1. Создайте новый проект и подключите репозиторий.
2. Укажите переменные окружения из списка выше.
3. Для API routes используйте `SUPABASE_SERVICE_ROLE_KEY` (server-only).

### Supabase
1. Создайте проект.
2. Импортируйте миграции из `supabase/migrations`.
3. Настройте redirect URLs для Auth:
   - `http://localhost:3000`
   - `https://<your-vercel-domain>`

## Безопасность
- Внешний контур читает только `public_certificate_check` без ПДн.
- PDF генерируется только во внутреннем контуре.
- RBAC проверяется на сервере API routes.

## Доменные правила
- `grade=fail` переводит попытку в `failed`, сертификат не выпускается.
- Номер сертификата создаётся функцией `next_certificate_number`.
- `render_snapshot_json` хранит слепок данных для печати и используется только internal.
