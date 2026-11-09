-- Pastos estruturados por fazenda e movimentação de animais entre pastos (lançamento
-- `manejo`). O lote de origem continua único: seus animais formam grupos por pasto,
-- reconstruídos a partir da entrada e dos lançamentos aprovados (ou reservados).
-- New AgroGest only. Never apply to the legacy/Noude database.

-- Nome normalizado, igual a `pastureKey` no app: acentos comuns, espaços e caixa.
create function private.pasture_key(p_name text) returns text
language sql immutable set search_path = '' as $$
  select lower(btrim(regexp_replace(
    translate(coalesce(p_name, ''), 'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ',
      'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn'),
    '\s+', ' ', 'g')))
$$;
revoke all on function private.pasture_key(text) from public, anon, authenticated;

create table private.pastures (
  id uuid primary key,
  operation_id uuid not null references private.operations(id),
  farm_id uuid not null,
  name text not null check (char_length(btrim(name)) between 1 and 150),
  name_key text generated always as (private.pasture_key(name)) stored,
  -- Null only for pastures converted from the old free-text field: area is never inferred.
  area_ha numeric check (area_ha is null or (area_ha > 0 and area_ha <= 100000)),
  forage text not null default '' check (char_length(forage) <= 150),
  notes text not null default '' check (char_length(notes) <= 500),
  active boolean not null default true,
  legacy boolean not null default false,
  created_at timestamptz not null default now(),
  foreign key (farm_id, operation_id) references private.farms(id, operation_id),
  unique (farm_id, name_key)
);
create index pastures_operation_idx on private.pastures(operation_id);
alter table private.pastures enable row level security;
create policy pastures_members on private.pastures for select to authenticated using (private.member_role(operation_id) is not null);
revoke all on private.pastures from public, anon, authenticated;

-- Pasto convertido do nome em texto do lote. ID estável (md5 de "fazenda:nome normalizado"),
-- o mesmo que o app calcula no cache local; reaproveita um pasto já cadastrado com o nome.
create function private.legacy_pasture(p_operation uuid, p_farm uuid, p_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare label text; key text; found_id uuid;
begin
  label := coalesce(nullif(btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g')), ''), 'Pasto principal');
  key := private.pasture_key(label);
  select id into found_id from private.pastures where farm_id = p_farm and name_key = key;
  if found_id is not null then return found_id; end if;
  found_id := md5(p_farm::text || ':' || key)::uuid;
  insert into private.pastures(id, operation_id, farm_id, name, legacy) values (found_id, p_operation, p_farm, left(label, 150), true);
  return found_id;
end $$;
revoke all on function private.legacy_pasture(uuid,uuid,text) from public, anon, authenticated;

-- Conversão controlada e idempotente: o texto antigo continua em managementGroup.
do $$
declare r record;
begin
  for r in select id, operation_id, farm_id, data->>'managementGroup' as name from private.lots
    where coalesce(data->>'pastureId', '') = '' order by id
  loop
    update private.lots set data = data || jsonb_build_object('pastureId', private.legacy_pasture(r.operation_id, r.farm_id, r.name))
      where id = r.id;
  end loop;
end $$;

alter table private.entries drop constraint entries_kind_check;
alter table private.entries add constraint entries_kind_check
  check (kind in ('pesagem', 'despesa', 'mortalidade', 'venda', 'nota_fiscal', 'manejo'));
create index entries_pasture_lot_idx on private.entries((data->'payload'->>'lotId'), status)
  where kind in ('manejo', 'pesagem');

create function private.pasture_label(p_id text) returns text
language sql stable security definer set search_path = '' as $$
  select coalesce((select p.name from private.pastures p where p.id::text = p_id),
    case when coalesce(p_id, '') = '' then 'O pasto de entrada' else 'O pasto' end)
$$;
revoke all on function private.pasture_label(text) from public, anon, authenticated;

create function private.heads_text(n bigint) returns text
language sql immutable set search_path = '' as $$
  select case when n = 1 then '1 cabeça' else coalesce(n, 0)::text || ' cabeças' end
$$;
revoke all on function private.heads_text(bigint) from public, anon, authenticated;

-- Same replay as `lotPastureTimeline` in the app. Returns the first inconsistency and the
-- heads per pasture after all events. `p_candidate` replaces the stored version of `p_skip`.
create function private.lot_pasture_replay(p_operation uuid, p_lot uuid, p_skip uuid, p_candidate jsonb, p_reserve boolean) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare lot private.lots%rowtype; heads jsonb; e jsonb; p jsonb; k text; at_text text; day text;
  from_id text; to_id text; target text; n bigint; available bigint; total bigint; remaining bigint; taken bigint;
  outgoing_at text; g record;
begin
  select * into lot from private.lots where id = p_lot and operation_id = p_operation;
  if not found then return jsonb_build_object('error', null, 'heads', '{}'::jsonb); end if;
  heads := jsonb_build_object(coalesce(lot.data->>'pastureId', ''), (lot.data->>'headsPurchased')::bigint);
  outgoing_at := lot.transfer->'outgoing'->>'at';
  for e in
    select x.d from (
      select en.data as d from private.entries en
        where en.operation_id = p_operation and en.kind in ('manejo', 'mortalidade', 'venda', 'pesagem')
          and en.data->'payload'->>'lotId' = p_lot::text and en.id is distinct from p_skip
          and (en.status = 'aprovado' or (p_reserve and en.status = 'aguardando_aprovacao'))
      union all
      select p_candidate where p_candidate is not null
    ) x
    order by x.d->>'occurredAt', (x.d->>'createdAt')::timestamptz, x.d->>'id'
  loop
    k := e->>'kind'; p := e->'payload'; at_text := e->>'occurredAt';
    day := to_char(at_text::date, 'DD/MM/YYYY');
    if at_text < lot.data->>'purchasedAt' then
      return jsonb_build_object('error', format('A data %s é anterior à entrada do lote, em %s.', day, to_char((lot.data->>'purchasedAt')::date, 'DD/MM/YYYY')), 'heads', heads);
    end if;
    if outgoing_at is not null and at_text > outgoing_at then
      return jsonb_build_object('error', 'O lote já foi transferido para outra fazenda.', 'heads', heads);
    end if;
    if k = 'manejo' then
      from_id := p->>'fromPastureId'; to_id := p->>'toPastureId'; n := (p->>'heads')::bigint;
      available := coalesce((heads->>from_id)::bigint, 0);
      if from_id = to_id then
        return jsonb_build_object('error', 'Escolha um pasto de destino diferente da origem.', 'heads', heads);
      end if;
      if n is null or n <= 0 or n > available then
        return jsonb_build_object('error', format('Em %s, %s tem %s deste lote; a movimentação pede %s.',
          day, private.pasture_label(from_id), private.heads_text(available), n), 'heads', heads);
      end if;
      heads := case when available - n > 0 then heads || jsonb_build_object(from_id, available - n) else heads - from_id end;
      heads := heads || jsonb_build_object(to_id, coalesce((heads->>to_id)::bigint, 0) + n);
    elsif k in ('mortalidade', 'venda') then
      select coalesce(sum(value::bigint), 0) into total from jsonb_each_text(heads);
      n := (p->>'heads')::bigint;
      if k = 'mortalidade' and n > total then
        return jsonb_build_object('error', format('Em %s, o lote tem %s; o lançamento pede %s.', day, private.heads_text(total), n), 'heads', heads);
      end if;
      n := least(n, total);
      target := nullif(p->>'pastureId', '');
      if target is not null then
        available := coalesce((heads->>target)::bigint, 0);
        if n > available then
          return jsonb_build_object('error', format('Em %s, %s tem %s deste lote; o lançamento pede %s.',
            day, private.pasture_label(target), private.heads_text(available), n), 'heads', heads);
        end if;
        heads := case when available - n > 0 then heads || jsonb_build_object(target, available - n) else heads - target end;
      else
        -- Older entries without a pasture: taken from the largest groups, like the app.
        remaining := n;
        for g in select key, value::bigint as v from jsonb_each_text(heads) order by value::bigint desc, key loop
          exit when remaining <= 0;
          taken := least(remaining, g.v);
          heads := case when g.v - taken > 0 then heads || jsonb_build_object(g.key, g.v - taken) else heads - g.key end;
          remaining := remaining - taken;
        end loop;
      end if;
    elsif k = 'pesagem' then
      target := nullif(p->>'pastureId', '');
      if target is not null and coalesce((heads->>target)::bigint, 0) <= 0 then
        return jsonb_build_object('error', format('Em %s, %s não tem animais deste lote.', day, private.pasture_label(target)), 'heads', heads);
      end if;
    end if;
  end loop;
  return jsonb_build_object('error', null, 'heads', heads);
end $$;
revoke all on function private.lot_pasture_replay(uuid,uuid,uuid,jsonb,boolean) from public, anon, authenticated;

-- Foundation validation plus `manejo` and the optional pasture of weighings and exits.
create or replace function private.validate_entry(p_data jsonb, p_operation uuid, p_farm uuid) returns void
language plpgsql security invoker set search_path = '' as $$
declare k text := p_data->>'kind'; p jsonb := p_data->'payload'; item jsonb; total bigint; amount bigint; lot private.lots%rowtype; qty numeric;
  origin private.pastures%rowtype; destination private.pastures%rowtype;
begin
  if k is null or k not in ('pesagem','despesa','mortalidade','venda','nota_fiscal','manejo') or jsonb_typeof(p) is distinct from 'object'
    or nullif(trim(p_data->>'title'), '') is null or p_data->>'occurredAt' is null then raise exception 'Lançamento incompleto.'; end if;
  if p_data->>'occurredAt' !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Data de ocorrência inválida.'; end if;
  perform (p_data->>'occurredAt')::date;
  if k in ('pesagem','mortalidade','venda','manejo') then
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
    if k in ('pesagem','mortalidade','venda') and nullif(p->>'pastureId', '') is not null and not exists(
      select 1 from private.pastures where id = (p->>'pastureId')::uuid and farm_id = p_farm and operation_id = p_operation)
      then raise exception 'O pasto informado não é desta fazenda.' using errcode = '42501'; end if;
    if k = 'manejo' then
      select * into origin from private.pastures where id = (p->>'fromPastureId')::uuid and farm_id = p_farm and operation_id = p_operation;
      select * into destination from private.pastures where id = (p->>'toPastureId')::uuid and farm_id = p_farm and operation_id = p_operation;
      if origin.id is null or destination.id is null then raise exception 'Os pastos da movimentação precisam ser desta fazenda.' using errcode = '42501'; end if;
      if origin.id = destination.id then raise exception 'Escolha um pasto de destino diferente da origem.'; end if;
      if not destination.active then raise exception '% está inativo. Escolha um pasto ativo.', destination.name; end if;
      if (p_data->>'occurredAt')::date > (clock_timestamp() at time zone 'America/Sao_Paulo')::date
        then raise exception 'A movimentação não pode ter data futura.'; end if;
      if char_length(coalesce(p->>'notes', '')) > 500 then raise exception 'Use até 500 caracteres na observação.'; end if;
      if p_data->'amountCents' is not null and jsonb_typeof(p_data->'amountCents') <> 'null' then raise exception 'Movimentação não tem valor.'; end if;
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

-- Foundation status plus the balance per pasture. Saving reserves pending deliveries;
-- approving checks confirmed history only, both under the operation lock.
create or replace function private.entry_status(p_entry uuid, p_data jsonb, p_operation uuid, p_author uuid, p_reserve boolean) returns text
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
  if p_data->>'kind' in ('manejo','mortalidade','venda','pesagem') and private.lot_pasture_replay(
    p_operation, (p_data->'payload'->>'lotId')::uuid, p_entry, p_data, p_reserve)->>'error' is not null then
    return 'conflito';
  end if;
  financial := p_data->>'kind' in ('despesa','venda','nota_fiscal');
  if exists(select 1 from private.memberships where operation_id = p_operation and user_id <> p_author and (not financial or role = 'socio'))
    then return 'aguardando_aprovacao'; end if;
  return 'aprovado';
end $$;
revoke all on function private.entry_status(uuid,jsonb,uuid,uuid,boolean) from public, anon, authenticated;

-- The pasture is part of the lot's editable root data. A client that does not send it
-- no longer matches `previous` and is refused instead of silently clearing it.
create or replace function private.lot_fields(p jsonb) returns jsonb
language sql immutable set search_path = '' as $$
  select jsonb_build_object('code', p->'code', 'managementGroup', p->'managementGroup', 'supplier', p->'supplier',
    'category', p->'category', 'purchasedAt', p->'purchasedAt', 'headsPurchased', p->'headsPurchased',
    'entryWeightKg', p->'entryWeightKg', 'purchaseCents', p->'purchaseCents', 'commissionCents', p->'commissionCents',
    'freightCents', p->'freightCents', 'gtaNumbers', coalesce(p->'gtaNumbers', '[]'::jsonb),
    'invoiceNumbers', coalesce(p->'invoiceNumbers', '[]'::jsonb), 'pastureId', coalesce(p->'pastureId', 'null'::jsonb))
$$;
revoke all on function private.lot_fields(jsonb) from public, anon, authenticated;

create function private.pasture_json(p private.pastures) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object('id', p.id, 'operationId', p.operation_id, 'farmId', p.farm_id, 'name', p.name, 'areaHa', p.area_ha,
    'forage', p.forage, 'notes', p.notes, 'active', p.active, 'legacy', p.legacy, 'createdAt', p.created_at)
$$;
revoke all on function private.pasture_json(private.pastures) from public, anon, authenticated;

-- Pastures are not financial: every member of the operation sees them. Employees also
-- receive everyone's moves, so the occupancy they see matches the partners'.
alter function private.workspace() rename to workspace_before_pastures;
revoke all on function private.workspace_before_pastures() from public, anon, authenticated;
create function private.workspace() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare w jsonb; uid uuid;
begin
  w := private.workspace_before_pastures();
  uid := (select auth.uid());
  w := w || jsonb_build_object('pastures', coalesce((select jsonb_agg(private.pasture_json(p) order by p.name)
    from private.pastures p where private.member_role(p.operation_id) is not null), '[]'::jsonb));
  return jsonb_set(w, '{entries}', coalesce(w->'entries', '[]'::jsonb) || coalesce((
    select jsonb_agg(e.data || jsonb_build_object('version', e.version) order by e.created_at desc) from private.entries e
    where e.kind = 'manejo' and e.author_id <> uid and private.member_role(e.operation_id) = 'funcionario'
  ), '[]'::jsonb));
end $$;
revoke all on function private.workspace() from public, anon;
grant execute on function private.workspace() to authenticated;

alter function private.command(uuid,text,jsonb) rename to command_before_pastures;
revoke all on function private.command_before_pastures(uuid,text,jsonb) from public, anon, authenticated;
create function private.command(p_id uuid, p_kind text, p_payload jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid; op uuid; target uuid; v_farm uuid; destination private.farms%rowtype; previous private.commands%rowtype;
  pasture private.pastures%rowtype; outcome jsonb; pasture_id uuid; area numeric; reason text; replay text; entry_data jsonb;
  pasture_name text; lot_row private.lots%rowtype; occupied boolean;
begin
  if p_kind is null or p_kind not in ('create_pasture','update_pasture','create_lot','update_lot','transfer_lot','save_entry','decide_entry') then
    return private.command_before_pastures(p_id, p_kind, p_payload);
  end if;
  uid := private.ensure_profile();
  if p_id is null or p_payload is null or jsonb_typeof(p_payload) <> 'object' or octet_length(p_payload::text) > 262144
    then raise exception 'Comando inválido.'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(uid::text || p_id::text, 0));
  select * into previous from private.commands where user_id = uid and id = p_id;
  if found then
    if previous.kind <> p_kind or previous.payload <> p_payload then raise exception 'Identificador de comando reutilizado com outros dados.'; end if;
    return previous.result;
  end if;
  target := (p_payload->>'id')::uuid;
  op := (p_payload->>'operationId')::uuid;
  if target is null or op is null then raise exception 'Operação inválida.'; end if;
  -- transfer_lot locks both operations in a fixed order inside the previous implementation.
  if p_kind <> 'transfer_lot' then
    perform 1 from private.operations where id = op for update;
    if private.member_role(op) is null then raise exception 'Sem acesso a esta operação.' using errcode = '42501'; end if;
  end if;

  if p_kind in ('create_pasture','update_pasture') then
    if private.member_role(op) <> 'socio' then raise exception 'Esta ação exige um sócio da operação.' using errcode = '42501'; end if;
    if nullif(btrim(p_payload->>'name'), '') is null or char_length(btrim(p_payload->>'name')) > 150 then raise exception 'Dê um nome ao pasto (até 150 caracteres).'; end if;
    if jsonb_typeof(p_payload->'areaHa') is distinct from 'number' then raise exception 'Informe a área útil em hectares.'; end if;
    area := (p_payload->>'areaHa')::numeric;
    if area <= 0 or area > 100000 then raise exception 'Informe a área útil em hectares (maior que zero).'; end if;
    if nullif(btrim(p_payload->>'forage'), '') is null or char_length(btrim(p_payload->>'forage')) > 150 then raise exception 'Informe o tipo de capim.'; end if;
    if char_length(coalesce(p_payload->>'notes', '')) > 500 then raise exception 'Use até 500 caracteres nas observações.'; end if;
    if p_kind = 'create_pasture' then
      v_farm := (p_payload->>'farmId')::uuid;
      if not exists(select 1 from private.farms f where f.id = v_farm and f.operation_id = op) then raise exception 'Fazenda fora da operação.' using errcode = '42501'; end if;
      if exists(select 1 from private.pastures p where p.farm_id = v_farm and p.name_key = private.pasture_key(p_payload->>'name'))
        then raise exception 'Já existe um pasto com este nome na fazenda.'; end if;
      insert into private.pastures(id, operation_id, farm_id, name, area_ha, forage, notes)
        values (target, op, v_farm, btrim(regexp_replace(p_payload->>'name', '\s+', ' ', 'g')), area, btrim(p_payload->>'forage'), btrim(coalesce(p_payload->>'notes', '')))
        returning * into pasture;
    else
      select * into pasture from private.pastures p where p.id = target and p.operation_id = op for update;
      if not found then raise exception 'Pasto não encontrado.'; end if;
      if p_payload->'previous' is null or jsonb_build_object('name', pasture.name, 'areaHa', pasture.area_ha, 'forage', pasture.forage,
        'notes', pasture.notes, 'active', pasture.active) <> p_payload->'previous'
        then raise exception 'O pasto mudou em outro aparelho. Sincronize antes de editar.'; end if;
      if jsonb_typeof(p_payload->'active') is distinct from 'boolean' then raise exception 'Situação do pasto inválida.'; end if;
      if exists(select 1 from private.pastures p where p.farm_id = pasture.farm_id and p.id <> target and p.name_key = private.pasture_key(p_payload->>'name'))
        then raise exception 'Já existe um pasto com este nome na fazenda.'; end if;
      if pasture.active and not (p_payload->>'active')::boolean then
        -- Inactivation keeps history; confirmed or reserved animals must leave first.
        occupied := false;
        for lot_row in select * from private.lots l where l.farm_id = pasture.farm_id and l.operation_id = op loop
          if coalesce((private.lot_pasture_replay(op, lot_row.id, null, null, true)->'heads'->>target::text)::bigint, 0) > 0 then occupied := true; exit; end if;
        end loop;
        if occupied then raise exception 'Mova os animais deste pasto antes de inativá-lo.'; end if;
      end if;
      update private.pastures p set name = btrim(regexp_replace(p_payload->>'name', '\s+', ' ', 'g')), area_ha = area,
        forage = btrim(p_payload->>'forage'), notes = btrim(coalesce(p_payload->>'notes', '')), active = (p_payload->>'active')::boolean
        where p.id = target returning * into pasture;
      -- Lots keep the text name in sync for clients that still read it.
      update private.lots l set data = l.data || jsonb_build_object('managementGroup', pasture.name)
        where l.farm_id = pasture.farm_id and l.data->>'pastureId' = target::text;
    end if;
    outcome := private.pasture_json(pasture);
    insert into private.commands(user_id,id,kind,payload,result) values(uid,p_id,p_kind,p_payload,outcome);
    insert into private.audit_events(operation_id,actor_id,command_id,kind) values(op,uid,p_id,p_kind);
    return outcome;
  end if;

  -- Lot commands: validate the referenced pasture first, then run the previous
  -- implementation and attach the structured pasture to the lot it wrote.
  if p_kind = 'create_lot' then
    v_farm := (p_payload->>'farmId')::uuid;
    if nullif(p_payload->>'pastureId', '') is not null then
      select * into pasture from private.pastures p where p.id = (p_payload->>'pastureId')::uuid and p.farm_id = v_farm and p.operation_id = op;
      if not found or not pasture.active then raise exception 'Escolha um pasto ativo desta fazenda.'; end if;
    end if;
    outcome := private.command_before_pastures(p_id, p_kind, p_payload);
    pasture_id := coalesce(nullif(p_payload->>'pastureId', '')::uuid, private.legacy_pasture(op, v_farm, p_payload->>'managementGroup'));
    select name into pasture_name from private.pastures where id = pasture_id;
    update private.lots set data = data || jsonb_build_object('pastureId', pasture_id, 'managementGroup', pasture_name) where id = target returning data into outcome;
  elsif p_kind = 'update_lot' then
    select * into lot_row from private.lots l where l.id = target and l.operation_id = op;
    if found and nullif(p_payload->>'pastureId', '') is not null and p_payload->>'pastureId' is distinct from lot_row.data->>'pastureId' then
      select * into pasture from private.pastures p where p.id = (p_payload->>'pastureId')::uuid and p.farm_id = lot_row.farm_id and p.operation_id = op;
      if not found or not pasture.active then raise exception 'Escolha um pasto ativo desta fazenda.'; end if;
    end if;
    outcome := private.command_before_pastures(p_id, p_kind, p_payload);
    if nullif(outcome->>'pastureId', '') is null then raise exception 'Escolha o pasto de entrada do lote.'; end if;
    select name into pasture_name from private.pastures where id = (outcome->>'pastureId')::uuid;
    update private.lots set data = data || jsonb_build_object('managementGroup', pasture_name) where id = target returning data into outcome;
    replay := private.lot_pasture_replay(op, target, null, null, true)->>'error';
    if replay is not null then raise exception '% Revise as movimentações do lote antes de mudar a entrada.', replay; end if;
  elsif p_kind = 'transfer_lot' then
    select * into destination from private.farms f where f.id = (p_payload->>'destinationFarmId')::uuid;
    if nullif(p_payload->>'pastureId', '') is not null then
      select * into pasture from private.pastures p where p.id = (p_payload->>'pastureId')::uuid and p.farm_id = destination.id;
      if not found or not pasture.active then raise exception 'Escolha um pasto ativo da fazenda de destino.'; end if;
    end if;
    outcome := private.command_before_pastures(p_id, p_kind, p_payload);
    pasture_id := coalesce(nullif(p_payload->>'pastureId', '')::uuid,
      private.legacy_pasture(destination.operation_id, destination.id, p_payload->>'managementGroup'));
    select name into pasture_name from private.pastures where id = pasture_id;
    update private.lots set data = data || jsonb_build_object('pastureId', pasture_id, 'managementGroup', pasture_name)
      where id = (p_payload->>'destinationLotId')::uuid;
    outcome := jsonb_set(outcome, '{lot}', (outcome->'lot') || jsonb_build_object('pastureId', pasture_id, 'managementGroup', pasture_name));
  else -- save_entry, decide_entry
    outcome := private.command_before_pastures(p_id, p_kind, p_payload);
    -- Explain a pasture conflict instead of the generic stock message.
    if outcome->>'status' = 'conflito' and outcome->>'kind' in ('manejo','mortalidade','venda','pesagem') then
      entry_data := outcome - 'version';
      reason := private.lot_pasture_replay(op, (entry_data->'payload'->>'lotId')::uuid, target, entry_data, p_kind = 'save_entry')->>'error';
      if reason is not null then
        update private.entries set data = data || jsonb_build_object('conflictReason', reason) where id = target;
        outcome := outcome || jsonb_build_object('conflictReason', reason);
      end if;
    end if;
  end if;
  -- The previous implementation recorded its own result; a replay must return this one.
  update private.commands c set result = outcome where c.user_id = uid and c.id = p_id;
  return outcome;
end $$;
revoke all on function private.command(uuid,text,jsonb) from public, anon;
grant execute on function private.command(uuid,text,jsonb) to authenticated;
