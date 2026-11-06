create schema if not exists extensions;
create extension if not exists btree_gist with schema extensions;

alter table public.appointments
  add constraint appointments_no_active_overlap
  exclude using gist (
    tstzrange(starts_at, ends_at, '[)') with &&
  )
  where (status in ('requested','confirmed'));

create or replace function private.create_customer_appointment(
  p_service_id uuid,
  p_starts_at timestamptz,
  p_customer_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer_id uuid := auth.uid();
  v_service_name text;
  v_duration integer;
  v_ends_at timestamptz;
  v_appointment_id uuid;
begin
  if v_customer_id is null then
    raise exception 'Autenticação necessária' using errcode = '42501';
  end if;

  if p_starts_at is null or p_starts_at <= now() then
    raise exception 'Escolha uma data e horário futuros';
  end if;

  select name, duration_minutes
    into v_service_name, v_duration
  from public.services
  where id = p_service_id and is_active = true;

  if not found then
    raise exception 'Serviço indisponível';
  end if;

  if v_duration is null or v_duration < 1 then
    raise exception 'Este serviço ainda não possui duração configurada';
  end if;

  v_ends_at := p_starts_at + make_interval(mins => v_duration);

  perform pg_advisory_xact_lock(918273645);

  if exists (
    select 1 from public.appointments a
    where a.status in ('requested','confirmed')
      and tstzrange(a.starts_at, a.ends_at, '[)') &&
          tstzrange(p_starts_at, v_ends_at, '[)')
  ) then
    raise exception 'Este horário não está mais disponível';
  end if;

  insert into public.appointments (
    customer_id, service_id, service_name, starts_at, ends_at, status, customer_note
  ) values (
    v_customer_id, p_service_id, v_service_name, p_starts_at, v_ends_at,
    'requested', nullif(trim(coalesce(p_customer_note, '')), '')
  ) returning id into v_appointment_id;

  return jsonb_build_object(
    'appointment_id', v_appointment_id,
    'service_name', v_service_name,
    'starts_at', p_starts_at,
    'ends_at', v_ends_at,
    'status', 'requested'
  );
end;
$$;

revoke all on function private.create_customer_appointment(uuid, timestamptz, text) from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.create_customer_appointment(uuid, timestamptz, text) to authenticated;

create or replace function public.create_customer_appointment(
  p_service_id uuid,
  p_starts_at timestamptz,
  p_customer_note text default null
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.create_customer_appointment(p_service_id, p_starts_at, p_customer_note);
$$;

revoke all on function public.create_customer_appointment(uuid, timestamptz, text) from public, anon;
grant execute on function public.create_customer_appointment(uuid, timestamptz, text) to authenticated;
