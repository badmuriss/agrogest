-- New AgroGest only. The legacy project's database is deliberately untouched.
-- Data stays in an unexposed schema; audited commands are the only write API.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create table private.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 150),
  email text not null
);
create table private.operations (
  id uuid primary key,
  name text not null check (char_length(name) between 1 and 150),
  owner_id uuid not null references private.profiles(id),
  created_at timestamptz not null default now()
);
create table private.memberships (
  operation_id uuid not null references private.operations(id) on delete cascade,
  user_id uuid not null references private.profiles(id) on delete cascade,
  role text not null check (role in ('socio', 'funcionario')),
  share_pct numeric check (share_pct between 0 and 100),
  primary key (operation_id, user_id)
);
create index memberships_user_operation_idx on private.memberships(user_id, operation_id);
create table private.farms (
  id uuid primary key,
  operation_id uuid not null references private.operations(id),
  name text not null check (char_length(name) between 1 and 150),
  city text,
  pasture_rent_cents bigint not null default 0 check (pasture_rent_cents between 0 and 9007199254740991),
  unique (id, operation_id)
);
create index farms_operation_idx on private.farms(operation_id);
create table private.lots (
  id uuid primary key,
  operation_id uuid not null references private.operations(id),
  farm_id uuid not null,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  foreign key (farm_id, operation_id) references private.farms(id, operation_id),
  unique (id, operation_id)
);
create index lots_operation_idx on private.lots(operation_id);
create index lots_farm_operation_idx on private.lots(farm_id, operation_id);
create unique index lots_operation_code_idx on private.lots(operation_id, (lower(data->>'code')));
create table private.entries (
  id uuid primary key,
  operation_id uuid not null references private.operations(id),
  farm_id uuid not null,
  author_id uuid not null references private.profiles(id),
  kind text not null check (kind in ('pesagem', 'despesa', 'mortalidade', 'venda', 'nota_fiscal')),
  status text not null check (status in ('rascunho', 'aguardando_aprovacao', 'aprovado', 'rejeitado', 'conflito')),
  data jsonb not null,
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  foreign key (farm_id, operation_id) references private.farms(id, operation_id)
);
create index entries_operation_idx on private.entries(operation_id);
create index entries_farm_operation_idx on private.entries(farm_id, operation_id);
create index entries_author_idx on private.entries(author_id);
create index entries_lot_status_idx on private.entries((data->'payload'->>'lotId'), status)
  where kind in ('venda', 'mortalidade');
create unique index entries_invoice_unique_idx on private.entries
  (operation_id, (lower(data->'payload'->'extraction'->>'supplierDoc')), (data->'payload'->'extraction'->>'number'),
   (coalesce(data->'payload'->'extraction'->>'series', '')))
  where kind = 'nota_fiscal' and status <> 'rejeitado' and data->'payload'->'extraction'->>'number' is not null;
create table private.invites (
  id uuid primary key,
  operation_id uuid not null references private.operations(id),
  name text not null,
  contact text not null check (contact = lower(trim(contact)) and contact like '%@%'),
  role text not null check (role in ('socio', 'funcionario')),
  share_pct numeric check (share_pct between 0 and 100),
  created_by uuid not null references private.profiles(id),
  created_at timestamptz not null default now(),
  unique (operation_id, contact)
);
create index invites_contact_idx on private.invites(contact);
create index invites_created_by_idx on private.invites(created_by);
create table private.commands (
  user_id uuid not null references private.profiles(id) on delete cascade,
  id uuid not null,
  kind text not null,
  payload jsonb not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);
create table private.audit_events (
  id bigint generated always as identity primary key,
  operation_id uuid references private.operations(id),
  actor_id uuid not null references private.profiles(id),
  command_id uuid not null,
  kind text not null,
  created_at timestamptz not null default now()
);
create index audit_events_operation_idx on private.audit_events(operation_id, id);
create index audit_events_actor_idx on private.audit_events(actor_id);

create function private.member_role(p_operation uuid) returns text
language sql stable security definer set search_path = '' as $$
  select m.role from private.memberships m
  where m.operation_id = p_operation and m.user_id = (select auth.uid())
    and (select auth.uid()) is not null
$$;
revoke all on function private.member_role(uuid) from public, anon;
grant execute on function private.member_role(uuid) to authenticated;

alter table private.profiles enable row level security;
alter table private.operations enable row level security;
alter table private.memberships enable row level security;
alter table private.farms enable row level security;
alter table private.lots enable row level security;
alter table private.entries enable row level security;
alter table private.invites enable row level security;
alter table private.commands enable row level security;
alter table private.audit_events enable row level security;
create policy profiles_self on private.profiles for select to authenticated using (id = (select auth.uid()));
create policy operations_members on private.operations for select to authenticated using (private.member_role(id) is not null);
create policy memberships_members on private.memberships for select to authenticated using (private.member_role(operation_id) is not null);
create policy farms_members on private.farms for select to authenticated using (private.member_role(operation_id) is not null);
create policy lots_partners on private.lots for select to authenticated using (private.member_role(operation_id) = 'socio');
create policy entries_author_or_partner on private.entries for select to authenticated using
  (private.member_role(operation_id) = 'socio' or (private.member_role(operation_id) is not null and (kind in ('pesagem','mortalidade') or author_id = (select auth.uid()))));
create policy invites_partners on private.invites for select to authenticated using (private.member_role(operation_id) = 'socio');
create policy commands_self on private.commands for select to authenticated using (user_id = (select auth.uid()));
create policy audit_partners on private.audit_events for select to authenticated using (private.member_role(operation_id) = 'socio');
revoke all on all tables in schema private from public, anon, authenticated;
revoke all on all sequences in schema private from public, anon, authenticated;

-- Validate integer cents before casting: JSON floats must not round silently.
create function private.cents(p_value jsonb) returns bigint
language plpgsql immutable security invoker set search_path = '' as $$
declare n numeric;
begin
  if p_value is null or jsonb_typeof(p_value) <> 'number' then raise exception 'Valor em centavos inválido.'; end if;
  n := p_value::text::numeric;
  if n < 0 or n > 9007199254740991 or trunc(n) <> n then raise exception 'Valor em centavos inválido.'; end if;
  return n::bigint;
end $$;
revoke all on function private.cents(jsonb) from public, anon, authenticated;

create function private.ensure_profile() returns uuid
language plpgsql security definer set search_path = '' as $$
declare u auth.users%rowtype; n text;
begin
  select * into u from auth.users where id = (select auth.uid());
  if u.id is null or u.email_confirmed_at is null then raise exception 'Entre com uma conta confirmada.' using errcode = '42501'; end if;
  n := left(coalesce(nullif(trim(u.raw_user_meta_data->>'name'), ''), split_part(u.email, '@', 1)), 150);
  insert into private.profiles(id, name, email) values(u.id, n, lower(u.email))
    on conflict(id) do update set name = excluded.name, email = excluded.email;
  return u.id;
end $$;
revoke all on function private.ensure_profile() from public, anon, authenticated;

create function private.workspace() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid; result jsonb;
begin
  uid := private.ensure_profile();
  select jsonb_build_object(
    'users', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name, 'email', case when p.id = uid then p.email else null end))
      from private.profiles p where p.id = uid or exists(select 1 from private.memberships m join private.memberships mine using(operation_id)
      where m.user_id = p.id and mine.user_id = uid)), '[]'::jsonb),
    'operations', coalesce((select jsonb_agg(jsonb_build_object('id', o.id, 'name', o.name)) from private.operations o
      where private.member_role(o.id) is not null), '[]'::jsonb),
    'memberships', coalesce((select jsonb_agg(jsonb_build_object('operationId', m.operation_id, 'userId', m.user_id, 'role', m.role, 'sharePct', m.share_pct))
      from private.memberships m where private.member_role(m.operation_id) is not null), '[]'::jsonb),
    'farms', coalesce((select jsonb_agg(jsonb_build_object('id', f.id, 'operationId', f.operation_id, 'name', f.name, 'city', f.city,
      'pastureRentCents', case when private.member_role(f.operation_id) = 'socio' then f.pasture_rent_cents else 0 end))
      from private.farms f where private.member_role(f.operation_id) is not null), '[]'::jsonb),
    'lots', coalesce((select jsonb_agg(case when private.member_role(l.operation_id) = 'socio' then l.data
      else l.data || '{"purchaseCents":0,"commissionCents":0,"freightCents":0}'::jsonb end)
      from private.lots l where private.member_role(l.operation_id) is not null), '[]'::jsonb),
    'entries', coalesce((select jsonb_agg((case when e.kind = 'venda' and private.member_role(e.operation_id) <> 'socio'
      then e.data || jsonb_build_object('amountCents',0,'title','Venda de animais','decisionNote',null,
        'payload',jsonb_build_object('lotId',e.data->'payload'->>'lotId','heads',e.data->'payload'->'heads',
          'buyer','','carcassKg',0,'pricePerArrobaCents',0,'deductionsCents',0),
        'history',(select coalesce(jsonb_agg(value - 'note'),'[]'::jsonb) from jsonb_array_elements(e.data->'history')))
      else e.data end) || jsonb_build_object('version', e.version) order by e.created_at desc)
      from private.entries e where private.member_role(e.operation_id) = 'socio'
      or (private.member_role(e.operation_id) is not null and (e.kind in ('pesagem','mortalidade','venda') or e.author_id = uid))), '[]'::jsonb),
    'invites', coalesce((select jsonb_agg(jsonb_build_object('id', i.id, 'operationId', i.operation_id, 'name', i.name, 'contact', i.contact,
      'role', i.role, 'sharePct', i.share_pct, 'createdAt', i.created_at, 'createdBy', i.created_by))
      from private.invites i where private.member_role(i.operation_id) = 'socio' or i.contact = (select email from private.profiles where id = uid)), '[]'::jsonb)
  ) into result;
  return result;
end $$;
revoke all on function private.workspace() from public, anon;
grant execute on function private.workspace() to authenticated;
create function public.agrogest_workspace() returns jsonb language sql security invoker set search_path = '' as $$ select private.workspace() $$;
revoke all on function public.agrogest_workspace() from public, anon;
grant execute on function public.agrogest_workspace() to authenticated;

create function private.validate_entry(p_data jsonb, p_operation uuid, p_farm uuid) returns void
language plpgsql security invoker set search_path = '' as $$
declare k text := p_data->>'kind'; p jsonb := p_data->'payload'; item jsonb; total bigint; amount bigint; lot private.lots%rowtype; qty numeric;
begin
  if k is null or k not in ('pesagem','despesa','mortalidade','venda','nota_fiscal') or jsonb_typeof(p) is distinct from 'object'
    or nullif(trim(p_data->>'title'), '') is null or p_data->>'occurredAt' is null then raise exception 'Lançamento incompleto.'; end if;
  if p_data->>'occurredAt' !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Data de ocorrência inválida.'; end if;
  perform (p_data->>'occurredAt')::date;
  if k in ('pesagem','mortalidade','venda') then
    select * into lot from private.lots where id = (p->>'lotId')::uuid and operation_id = p_operation and farm_id = p_farm;
    if lot.id is null then raise exception 'Lote fora da fazenda ou operação.' using errcode = '42501'; end if;
    qty := case when k = 'pesagem' then (p->>'headsWeighed')::numeric else (p->>'heads')::numeric end;
    if qty is null or qty <= 0 or qty <> trunc(qty) or qty > 20000 then raise exception 'Quantidade de cabeças inválida.'; end if;
    if k = 'pesagem' and ((p->>'avgWeightKg')::numeric not between 20 and 1500 or p->>'avgWeightKg' is null
      or p->>'method' is null or p->>'method' not in ('medido','estimado')) then raise exception 'Pesagem inválida.'; end if;
    if k = 'venda' then
      if (p->>'carcassKg')::numeric <= 0 or p->>'carcassKg' is null then raise exception 'Peso de carcaça inválido.'; end if;
      perform private.cents(p->'pricePerArrobaCents'); perform private.cents(p->'deductionsCents');
      if private.cents(p_data->'amountCents') <> round((p->>'carcassKg')::numeric * (p->>'pricePerArrobaCents')::numeric / 15)
        then raise exception 'O valor da venda deve corresponder ao peso e preço da arroba.'; end if;
    end if;
  end if;
  if k in ('despesa','nota_fiscal') then
    amount := private.cents(p_data->'amountCents');
    if amount <= 0 then raise exception 'Informe o valor do lançamento.'; end if;
    if jsonb_typeof(p->'installments') is distinct from 'array' or jsonb_array_length(p->'installments') = 0 then raise exception 'Informe as parcelas.'; end if;
    total := 0;
    for item in select value from jsonb_array_elements(p->'installments') loop
      if item->>'dueDate' is null then raise exception 'Vencimento inválido.'; end if;
      perform (item->>'dueDate')::date; total := total + private.cents(item->'cents');
    end loop;
    if total <> amount then raise exception 'As parcelas precisam fechar o valor total.'; end if;
    if k = 'nota_fiscal' then
      -- The simulated extractor is deliberately not a cloud financial API.
      raise exception 'A integração real de notas fiscais ainda não está disponível. Registre uma despesa manual.';
    end if;
    if jsonb_typeof(p->'allocations') is distinct from 'array' then raise exception 'Rateio inválido.'; end if;
    total := 0;
    for item in select value from jsonb_array_elements(p->'allocations') loop
      if not exists(select 1 from private.lots where id = (item->>'lotId')::uuid and operation_id = p_operation and farm_id = p_farm)
        then raise exception 'Lote do rateio fora da fazenda.' using errcode = '42501'; end if;
      total := total + private.cents(item->'cents');
    end loop;
    if jsonb_array_length(p->'allocations') > 0 and total <> amount then raise exception 'O rateio precisa fechar o valor total.'; end if;
    if (select count(*) <> count(distinct value->>'lotId') from jsonb_array_elements(p->'allocations')) then raise exception 'Lote duplicado no rateio.'; end if;
  end if;
end $$;
revoke all on function private.validate_entry(jsonb,uuid,uuid) from public, anon, authenticated;

create function private.entry_status(p_entry uuid, p_data jsonb, p_operation uuid, p_author uuid, p_reserve boolean) returns text
language plpgsql security invoker set search_path = '' as $$
declare available bigint; requested bigint; other bigint; lot_id uuid; financial boolean;
begin
  if p_data->>'kind' in ('mortalidade','venda') then
    lot_id := (p_data->'payload'->>'lotId')::uuid;
    select (data->>'headsPurchased')::bigint into available from private.lots where id = lot_id and operation_id = p_operation;
    select coalesce(sum((data->'payload'->>'heads')::bigint), 0) into other from private.entries
      where id <> p_entry and operation_id = p_operation and kind in ('mortalidade','venda')
      and data->'payload'->>'lotId' = lot_id::text
      and (status = 'aprovado' or (p_reserve and status = 'aguardando_aprovacao'));
    requested := (p_data->'payload'->>'heads')::bigint;
    if requested > available - other then return 'conflito'; end if;
  end if;
  financial := p_data->>'kind' in ('despesa','venda','nota_fiscal');
  if exists(select 1 from private.memberships where operation_id = p_operation and user_id <> p_author and (not financial or role = 'socio'))
    then return 'aguardando_aprovacao'; end if;
  return 'aprovado';
end $$;
revoke all on function private.entry_status(uuid,jsonb,uuid,uuid,boolean) from public, anon, authenticated;

create function private.command(p_id uuid, p_kind text, p_payload jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid; op uuid; fid uuid; target uuid; role_name text; result jsonb := '{}'::jsonb;
  previous private.commands%rowtype; existing private.entries%rowtype; inv private.invites%rowtype;
  d jsonb; status_name text; h jsonb; t timestamptz := clock_timestamp(); amount bigint; qty numeric;
begin
  uid := private.ensure_profile();
  if p_id is null or p_kind is null or p_payload is null or jsonb_typeof(p_payload) <> 'object' or octet_length(p_payload::text) > 262144
    then raise exception 'Comando inválido.'; end if;
  -- Serialize duplicate deliveries before checking the ledger. Each operation is
  -- locked separately below, preventing two devices from overselling one herd.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(uid::text || p_id::text, 0));
  select * into previous from private.commands where user_id = uid and id = p_id;
  if found then
    if previous.kind <> p_kind or previous.payload <> p_payload then raise exception 'Identificador de comando reutilizado com outros dados.'; end if;
    return previous.result;
  end if;
  target := (p_payload->>'id')::uuid;
  op := (p_payload->>'operationId')::uuid;
  fid := (p_payload->>'farmId')::uuid;
  if p_kind = 'create_farm' then
    if target is null or op is null then raise exception 'Fazenda incompleta.'; end if;
    amount := private.cents(p_payload->'pastureRentCents');
    insert into private.operations(id,name,owner_id) values(op,trim(p_payload->>'name'),uid);
    insert into private.memberships(operation_id,user_id,role,share_pct) values(op,uid,'socio',100);
    insert into private.farms(id,operation_id,name,city,pasture_rent_cents)
      values(target,op,trim(p_payload->>'name'),nullif(trim(p_payload->>'city'),''),amount);
    result := jsonb_build_object('id',target);
  elsif p_kind = 'accept_invite' then
    select * into inv from private.invites where id = target;
    if not found or inv.contact <> (select email from private.profiles where id = uid) then raise exception 'Convite indisponível para esta conta.' using errcode = '42501'; end if;
    op := inv.operation_id;
    perform 1 from private.operations where id = op for update;
    select * into inv from private.invites where id = target for update;
    if not found then raise exception 'Convite indisponível.'; end if;
    if exists(select 1 from private.memberships where operation_id = op and user_id = uid) then raise exception 'Você já participa desta operação.'; end if;
    insert into private.memberships(operation_id,user_id,role,share_pct) values(op,uid,inv.role,inv.share_pct);
    delete from private.invites where id = target;
  else
    if op is null then raise exception 'Operação inválida.'; end if;
    perform 1 from private.operations where id = op for update;
    role_name := private.member_role(op);
    if role_name is null then raise exception 'Sem acesso a esta operação.' using errcode = '42501'; end if;
    if p_kind in ('update_farm','create_lot','invite','cancel_invite') and role_name <> 'socio'
      then raise exception 'Esta ação exige um sócio da operação.' using errcode = '42501'; end if;
    if p_kind = 'update_farm' then
      if p_payload->'previous' is null or not exists(select 1 from private.farms f where f.id=target and f.operation_id=op
        and jsonb_build_object('name',f.name,'city',f.city,'pastureRentCents',f.pasture_rent_cents) = p_payload->'previous')
        then raise exception 'A fazenda mudou em outro aparelho. Sincronize antes de editar.'; end if;
      update private.farms set name = trim(p_payload->>'name'), city = nullif(trim(p_payload->>'city'),''),
        pasture_rent_cents = private.cents(p_payload->'pastureRentCents') where id = target and operation_id = op;
      if not found then raise exception 'Fazenda não encontrada.'; end if;
    elsif p_kind = 'create_lot' then
      if not exists(select 1 from private.farms where id = fid and operation_id = op) then raise exception 'Fazenda fora da operação.' using errcode = '42501'; end if;
      qty := (p_payload->>'headsPurchased')::numeric;
      if qty is null or qty <= 0 or qty > 20000 or trunc(qty) <> qty or (p_payload->>'entryWeightKg')::numeric not between 20 and 1500
        or p_payload->>'entryWeightKg' is null or nullif(trim(p_payload->>'code'),'') is null then raise exception 'Dados do lote inválidos.'; end if;
      if p_payload->>'purchasedAt' is null or p_payload->>'purchasedAt' !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Data de compra inválida.'; end if;
      perform (p_payload->>'purchasedAt')::date;
      perform private.cents(p_payload->'purchaseCents'); perform private.cents(p_payload->'commissionCents'); perform private.cents(p_payload->'freightCents');
      d := p_payload - 'version';
      insert into private.lots(id,operation_id,farm_id,data) values(target,op,fid,d);
      result := d;
    elsif p_kind = 'invite' then
      if lower(trim(p_payload->>'contact')) = (select email from private.profiles where id = uid) then raise exception 'Você já participa da operação.'; end if;
      insert into private.invites(id,operation_id,name,contact,role,share_pct,created_by)
        values(target,op,trim(p_payload->>'name'),lower(trim(p_payload->>'contact')),p_payload->>'role',(p_payload->>'sharePct')::numeric,uid);
    elsif p_kind = 'cancel_invite' then
      delete from private.invites where id = target and operation_id = op;
      if not found then raise exception 'Convite não encontrado.'; end if;
    elsif p_kind = 'save_entry' then
      select * into existing from private.entries where id = target;
      if found then
        if existing.operation_id <> op or existing.author_id <> uid then raise exception 'Você não pode alterar este lançamento.' using errcode = '42501'; end if;
        if existing.status not in ('rascunho','rejeitado','conflito') then raise exception 'Este lançamento já foi enviado. Preserve o histórico.'; end if;
        if (p_payload->>'expectedVersion')::bigint is distinct from existing.version then raise exception 'Este lançamento mudou. Sincronize antes de editar.'; end if;
      end if;
      if not exists(select 1 from private.farms where id = fid and operation_id = op) then raise exception 'Fazenda fora da operação.' using errcode = '42501'; end if;
      d := p_payload->'entry';
      if d->>'kind' = 'venda' and role_name <> 'socio' then raise exception 'Venda exige um sócio.' using errcode = '42501'; end if;
      -- Never trust status, author, decision, history, or version from the device.
      d := jsonb_build_object('id',target,'operationId',op,'farmId',fid,'authorId',uid,
        'title',d->>'title','kind',d->>'kind','payload',d->'payload','amountCents',d->'amountCents','occurredAt',d->>'occurredAt',
        'createdAt',coalesce(existing.created_at,t),'decidedBy',null,'decidedAt',null,'decisionNote',null,
        'pendingDecision',null,'pendingDecisionBy',null,'pendingDecisionNote',null,'conflictReason',null);
      perform private.validate_entry(d,op,fid);
      status_name := case when coalesce((p_payload->>'submit')::boolean,false) then private.entry_status(target,d,op,uid,true) else 'rascunho' end;
      h := coalesce(existing.data->'history','[]'::jsonb) || jsonb_build_array(jsonb_build_object('at',t,'by',uid,'action',case when existing.id is null then 'criado' else 'revisado' end));
      if status_name = 'aprovado' then
        d := d || jsonb_build_object('decidedBy','sistema','decidedAt',t);
        h := h || jsonb_build_array(jsonb_build_object('at',t,'by','sistema','action','efetivado'));
      elsif status_name = 'conflito' then d := d || jsonb_build_object('conflictReason','O saldo disponível não comporta esta baixa. Revise os lançamentos pendentes.');
      elsif status_name = 'aguardando_aprovacao' then h := h || jsonb_build_array(jsonb_build_object('at',t,'by',uid,'action','recebido'));
      end if;
      d := d || jsonb_build_object('status',status_name,'history',h);
      insert into private.entries(id,operation_id,farm_id,author_id,kind,status,data) values(target,op,fid,uid,d->>'kind',status_name,d)
        on conflict(id) do update set status=excluded.status,data=excluded.data,version=private.entries.version+1;
      select data || jsonb_build_object('version',version) into result from private.entries where id = target;
    elsif p_kind = 'decide_entry' then
      select * into existing from private.entries where id = target and operation_id = op;
      if not found or existing.status <> 'aguardando_aprovacao' then raise exception 'O lançamento não aguarda aprovação.'; end if;
      if existing.author_id = uid or (existing.kind in ('despesa','venda','nota_fiscal') and role_name <> 'socio')
        then raise exception 'Esta aprovação precisa de outra pessoa habilitada.' using errcode = '42501'; end if;
      if (p_payload->>'expectedVersion')::bigint is distinct from existing.version then raise exception 'O lançamento mudou. Sincronize antes de aprovar.'; end if;
      if p_payload->>'decision' is null or p_payload->>'decision' not in ('aprovar','recusar') then raise exception 'Decisão inválida.'; end if;
      status_name := case when p_payload->>'decision' = 'recusar' then 'rejeitado'
        when private.entry_status(target,existing.data,op,existing.author_id,false) = 'conflito' then 'conflito' else 'aprovado' end;
      h := existing.data->'history' || jsonb_build_array(jsonb_build_object('at',t,'by',uid,'action',
        case status_name when 'rejeitado' then 'recusado' when 'conflito' then 'conflito' else 'aprovado' end,'note',p_payload->>'note'));
      d := existing.data || jsonb_build_object('status',status_name,'decidedBy',uid,'decidedAt',t,'decisionNote',p_payload->>'note','history',h,
        'conflictReason',case when status_name = 'conflito' then 'Saldo insuficiente ao confirmar a baixa.' else null end);
      update private.entries set status=status_name,data=d,version=version+1 where id=target;
      select data || jsonb_build_object('version',version) into result from private.entries where id=target;
    elsif p_kind = 'discard_entry' then
      delete from private.entries where id=target and operation_id=op and author_id=uid and status in ('rascunho','rejeitado','conflito');
      if not found then raise exception 'Somente seu rascunho, recusa ou conflito pode ser descartado.' using errcode='42501'; end if;
    else raise exception 'Comando não reconhecido.';
    end if;
  end if;
  insert into private.commands(user_id,id,kind,payload,result) values(uid,p_id,p_kind,p_payload,result);
  insert into private.audit_events(operation_id,actor_id,command_id,kind) values(op,uid,p_id,p_kind);
  return result;
end $$;
revoke all on function private.command(uuid,text,jsonb) from public, anon;
grant execute on function private.command(uuid,text,jsonb) to authenticated;
create function public.agrogest_command(command_id uuid, kind text, payload jsonb) returns jsonb
language sql security invoker set search_path = '' as $$ select private.command(command_id,kind,payload) $$;
revoke all on function public.agrogest_command(uuid,text,jsonb) from public, anon;
grant execute on function public.agrogest_command(uuid,text,jsonb) to authenticated;

comment on function public.agrogest_command(uuid,text,jsonb) is 'Authenticated, idempotent AgroGest commands. Authority and audit live in the private implementation.';
comment on schema private is 'AgroGest canonical state. Not exposed through the Data API; no client table grants.';
