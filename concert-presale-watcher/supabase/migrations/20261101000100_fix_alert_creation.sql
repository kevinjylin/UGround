-- Alert creation failed on the first real poll run with two database errors.

-- 1. The poller also emits presale and public-sale alert types, which the
--    original check constraint rejects.
alter table public.alerts drop constraint if exists alerts_alert_type_check;
alter table public.alerts add constraint alerts_alert_type_check check (
  alert_type in (
    'new_event',
    'status_changed',
    'ticket_url_changed',
    'on_sale_moved_earlier',
    'presale_announced',
    'presale_opened',
    'public_sale_announced',
    'public_sale_opened'
  )
);

-- 2. The output column "alert_id" clashes with notification_deliveries.alert_id
--    in ON CONFLICT, which Postgres rejects as ambiguous. use_column makes bare
--    names refer to table columns. The body is otherwise unchanged, and
--    create or replace keeps the existing grants.
create or replace function public.create_alert_with_deliveries(
  p_user_id uuid,
  p_event_id uuid,
  p_alert_type text,
  p_message text,
  p_payload jsonb,
  p_idempotency_key text,
  p_channels text[]
)
returns table (alert_id uuid, created boolean)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_alert_id uuid;
  v_channel text;
begin
  insert into public.alerts (
    user_id, event_id, alert_type, message, payload, idempotency_key, delivery_status
  )
  values (
    p_user_id, p_event_id, p_alert_type, p_message, p_payload,
    p_idempotency_key, 'pending'
  )
  on conflict (idempotency_key) where idempotency_key is not null do nothing
  returning id into v_alert_id;

  if v_alert_id is null then
    select id into v_alert_id from public.alerts where idempotency_key = p_idempotency_key;
    return query select v_alert_id, false;
    return;
  end if;

  foreach v_channel in array p_channels loop
    insert into public.notification_deliveries (alert_id, channel)
    values (v_alert_id, v_channel)
    on conflict (alert_id, channel) do nothing;
  end loop;

  return query select v_alert_id, true;
end;
$$;
