FROM supabase/gotrue:v2.158.1

RUN sed -i \
  's/id = user_id::text/id::text = user_id::text/' \
  /usr/local/etc/auth/migrations/20221208132122_backfill_email_last_sign_in_at.up.sql
