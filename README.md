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

## Локальный запуск (PostgreSQL + Web в Docker)
### 1) Запуск стека одной командой
```
docker compose up --build
```

Compose поднимет PostgreSQL, применит миграции и запустит веб-приложение.

Откройте `http://localhost:3000`.

## Env vars
```
DATABASE_URL=postgres://postgres:postgres@localhost:5432/certificate_registry
TEMPLATE_STORAGE_DIR=./template-assets
PUBLIC_PDF_DOWNLOAD=false
ENABLE_XLSX_EXPORT=true
ENABLE_EMAILS=false
RESEND_API_KEY=
```

`TEMPLATE_STORAGE_DIR` — папка, в которой лежат фоновые файлы шаблонов (значения `background_path` в таблице `template_version`).

## Деплой
Пока не рассматривается — проект рассчитан на локальный запуск с PostgreSQL.

## Безопасность
- Внешний контур читает только `public_certificate_check` без ПДн.
- PDF генерируется только во внутреннем контуре.
- RBAC проверяется на сервере API routes.

## Доменные правила
- `grade=fail` переводит попытку в `failed`, сертификат не выпускается.
- Номер сертификата создаётся функцией `next_certificate_number`.
- `render_snapshot_json` хранит слепок данных для печати и используется только internal.
