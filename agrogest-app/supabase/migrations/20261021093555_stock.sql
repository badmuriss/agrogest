-- Estoque de insumos (issue #45): insumos por operação e três lançamentos novos (consumo, ajuste e
-- transferência de estoque). A compra para o estoque é uma despesa com destino 'estoque' e itens:
-- gera as parcelas a pagar, mas nenhum custo nos lotes. O saldo e o custo médio são reconstruídos
-- dos lançamentos (`private.stock_replay`, igual a `stockLedger` no app), por insumo e fazenda.
-- New AgroGest only. Never apply to the legacy/Noude database.

create table private.supplies (
  id uuid primary key,
  operation_id uuid not null references private.operations(id),
  name text not null check (char_length(btrim(name)) between 1 and 100),
  kind text not null check (kind in ('sal', 'sal_mineral', 'proteinado', 'racao', 'medicamento', 'outros')),
  unit text not null check (unit in ('saco', 'kg', 't', 'l', 'dose', 'un')),
  conversions jsonb not null default '[]'::jsonb check (jsonb_typeof(conversions) = 'array'),
  min_quantity numeric check (min_quantity is null or min_quantity >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index supplies_name_idx on private.supplies(operation_id, lower(btrim(name)));
alter table private.supplies enable row level security;
-- Names and quantities are field data: every member sees the supplies. Values stay with partners.
create policy supplies_members on private.supplies for select to authenticated using (private.member_role(operation_id) is not null);
revoke all on private.supplies from public, anon, authenticated;

alter table private.entries drop constraint entries_kind_check;
alter table private.entries add constraint entries_kind_check check (kind in
  ('pesagem', 'despesa', 'mortalidade', 'venda', 'nota_fiscal', 'manejo', 'consumo', 'ajuste_estoque', 'transferencia_estoque'));
create index entries_supply_idx on private.entries((data->'payload'->>'supplyId'), status)
  where kind in ('consumo', 'ajuste_estoque', 'transferencia_estoque');

create function private.supply_json(s private.supplies) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object('id', s.id, 'operationId', s.operation_id, 'name', s.name, 'kind', s.kind, 'unit', s.unit,
    'conversions', s.conversions, 'minQuantity', s.min_quantity, 'active', s.active, 'createdAt', s.created_at)
$$;
revoke all on function private.supply_json(private.supplies) from public, anon, authenticated;

-- "2,5 sacos", like formatQty in the app.
create function private.qty_text(p_qty numeric, p_unit text) returns text
language sql immutable set search_path = '' as $$
  select translate(rtrim(to_char(round(p_qty, 3), 'FM999,999,999,990.999'), '.'), ',.', '.,') || ' ' ||
    case when abs(p_qty) = 1 then case p_unit when 'saco' then 'saco' when 'l' then 'litro' when 'dose' then 'dose' when 'un' then 'unidade' else p_unit end
    else case p_unit when 'saco' then 'sacos' when 'l' then 'litros' when 'dose' then 'doses' when 'un' then 'unidades' else p_unit end end
$$;
revoke all on function private.qty_text(numeric, text) from public, anon, authenticated;

create function private.is_stock_outflow(p_data jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select p_data->>'kind' in ('consumo', 'transferencia_estoque')
    or (p_data->>'kind' = 'ajuste_estoque' and (p_data->'payload'->>'delta')::numeric < 0)
$$;
revoke all on function private.is_stock_outflow(jsonb) from public, anon, authenticated;

-- Same replay as `stockLedger`: approved events in occurrence order (and, when reserving, the
-- pending outflows); `p_candidate` replaces the stored version of `p_skip`. Weighted average cost:
-- an outflow takes the value fraction equal to the quantity fraction; the last unit takes the rest.
-- Returns the first date where the balance would go negative, and the balance per farm.
create function private.stock_replay(p_operation uuid, p_supply text, p_skip uuid, p_candidate jsonb, p_reserve boolean) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare e jsonb; k text; p jsonb; f text; dest text; q numeric; have numeric; val bigint; cost bigint; item jsonb;
  farms jsonb := '{}'::jsonb; sup private.supplies%rowtype;
begin
  select * into sup from private.supplies where id::text = p_supply and operation_id = p_operation;
  for e in
    select x.d from (
      select en.data as d from private.entries en
      where en.operation_id = p_operation and en.id is distinct from p_skip
        and ((en.kind in ('consumo', 'ajuste_estoque', 'transferencia_estoque') and en.data->'payload'->>'supplyId' = p_supply)
          or (en.kind in ('despesa', 'nota_fiscal') and en.data->'payload'->>'destination' = 'estoque'
            and en.data->'payload'->'stockItems' @> jsonb_build_array(jsonb_build_object('supplyId', p_supply))))
        and (en.status = 'aprovado' or (p_reserve and en.status = 'aguardando_aprovacao' and private.is_stock_outflow(en.data)))
      union all
      select p_candidate where p_candidate is not null
    ) x
    order by x.d->>'occurredAt', (x.d->>'createdAt')::timestamptz, x.d->>'id'
  loop
    k := e->>'kind'; p := e->'payload'; f := e->>'farmId';
    have := coalesce((farms->f->>'qty')::numeric, 0);
    val := coalesce((farms->f->>'value')::bigint, 0);
    if private.is_stock_outflow(e) then
      q := round(case when k = 'ajuste_estoque' then -(p->>'delta')::numeric else (p->>'quantity')::numeric end, 3);
      if q > have then
        return jsonb_build_object('farms', farms, 'error', format('Em %s, o estoque de %s em %s tinha %s; o lançamento pede %s.',
          to_char((e->>'occurredAt')::date, 'DD/MM/YYYY'), coalesce(sup.name, 'este insumo'),
          coalesce((select fa.name from private.farms fa where fa.id::text = f), 'esta fazenda'),
          private.qty_text(have, coalesce(sup.unit, '')), private.qty_text(q, coalesce(sup.unit, ''))));
      end if;
      cost := case when have <= 0 then 0 when q >= have then val else round(val * q / have)::bigint end;
      farms := farms || jsonb_build_object(f, jsonb_build_object('qty', round(have - q, 3), 'value', val - cost));
      -- The arrival counts only once the transfer is approved, like any inflow.
      if k = 'transferencia_estoque' and e->>'status' = 'aprovado' then
        dest := p->>'toFarmId';
        farms := farms || jsonb_build_object(dest, jsonb_build_object(
          'qty', round(coalesce((farms->dest->>'qty')::numeric, 0) + q, 3),
          'value', coalesce((farms->dest->>'value')::bigint, 0) + cost));
      end if;
    elsif k = 'ajuste_estoque' then
      q := round((p->>'delta')::numeric, 3);
      cost := case when have > 0 then round(val * q / have)::bigint else 0 end;
      farms := farms || jsonb_build_object(f, jsonb_build_object('qty', round(have + q, 3), 'value', val + cost));
    else
      for item in select value from jsonb_array_elements(p->'stockItems') where value->>'supplyId' = p_supply loop
        have := coalesce((farms->f->>'qty')::numeric, 0);
        val := coalesce((farms->f->>'value')::bigint, 0);
        farms := farms || jsonb_build_object(f, jsonb_build_object(
          'qty', round(have + (item->>'quantity')::numeric, 3), 'value', val + (item->>'cents')::bigint));
      end loop;
    end if;
  end loop;
  return jsonb_build_object('error', null, 'farms', farms);
end $$;
revoke all on function private.stock_replay(uuid, text, uuid, jsonb, boolean) from public, anon, authenticated;

create function private.positive_qty(p_value jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select jsonb_typeof(p_value) = 'number' and (p_value::text)::numeric > 0 and (p_value::text)::numeric <= 1000000000
    and round((p_value::text)::numeric, 3) = (p_value::text)::numeric
$$;
revoke all on function private.positive_qty(jsonb) from public, anon, authenticated;

-- New kinds have their own validation; the existing kinds keep theirs, plus the stock purchase.
alter function private.validate_entry(jsonb,uuid,uuid) rename to validate_entry_before_stock;
revoke all on function private.validate_entry_before_stock(jsonb,uuid,uuid) from public, anon, authenticated;
create function private.validate_entry(p_data jsonb, p_operation uuid, p_farm uuid) returns void
language plpgsql security invoker set search_path = '' as $$
declare k text := p_data->>'kind'; p jsonb := p_data->'payload'; item jsonb; total bigint; sup private.supplies%rowtype; pct numeric;
begin
  if k not in ('consumo', 'ajuste_estoque', 'transferencia_estoque') then
    perform private.validate_entry_before_stock(p_data, p_operation, p_farm);
    if k in ('despesa', 'nota_fiscal') and p ? 'destination' and p->>'destination' not in ('despesa', 'estoque') then raise exception 'Destino inválido.'; end if;
    if k = 'despesa' and p->>'destination' = 'estoque' then
      if jsonb_typeof(p->'stockItems') is distinct from 'array' or jsonb_array_length(p->'stockItems') not between 1 and 50
        then raise exception 'Informe os insumos que entram no estoque.'; end if;
      if jsonb_array_length(p->'allocations') > 0 then raise exception 'A compra para o estoque não é rateada nos lotes: o custo vai no consumo.'; end if;
      total := 0;
      for item in select value from jsonb_array_elements(p->'stockItems') loop
        select * into sup from private.supplies s where s.id::text = item->>'supplyId' and s.operation_id = p_operation;
        if not found then raise exception 'Insumo fora desta operação.' using errcode = '42501'; end if;
        if not sup.active then raise exception '% está inativo.', sup.name; end if;
        if not private.positive_qty(item->'quantity') then raise exception 'Informe a quantidade de cada insumo (até 3 casas).'; end if;
        total := total + private.cents(item->'cents');
      end loop;
      if total <> private.cents(p_data->'amountCents') then raise exception 'Os itens precisam somar o valor da compra.'; end if;
    end if;
    return;
  end if;
  if jsonb_typeof(p) is distinct from 'object' or nullif(btrim(p_data->>'title'), '') is null then raise exception 'Lançamento incompleto.'; end if;
  if not private.valid_iso_date(p_data->>'occurredAt') then raise exception 'Data de ocorrência inválida.'; end if;
  if (p_data->>'occurredAt')::date > private.sao_paulo_today() then raise exception 'A data não pode ser futura.'; end if;
  if p_data->'amountCents' is not null and jsonb_typeof(p_data->'amountCents') <> 'null' then raise exception 'O valor vem do custo médio do estoque.'; end if;
  select * into sup from private.supplies s where s.id::text = p->>'supplyId' and s.operation_id = p_operation;
  if not found then raise exception 'Insumo fora desta operação.' using errcode = '42501'; end if;
  if k = 'consumo' then
    if not private.positive_qty(p->'quantity') then raise exception 'Informe a quantidade consumida (até 3 casas).'; end if;
    if nullif(p->>'periodStart', '') is not null and (not private.valid_iso_date(p->>'periodStart')
      or (p->>'periodStart')::date > (p_data->>'occurredAt')::date or (p_data->>'occurredAt')::date - (p->>'periodStart')::date >= 92)
      then raise exception 'O período precisa começar antes do fim e ter até 92 dias.'; end if;
    if p->>'criterion' is null or p->>'criterion' not in ('cabeca', 'peso', 'manual') then raise exception 'Critério de rateio inválido.'; end if;
    if jsonb_typeof(p->'targets') is distinct from 'array' or jsonb_array_length(p->'targets') not between 1 and 200
      then raise exception 'Escolha os lotes que consumiram.'; end if;
    if (select count(*) <> count(distinct value->>'lotId') from jsonb_array_elements(p->'targets')) then raise exception 'Lote duplicado no rateio.'; end if;
    pct := 0;
    for item in select value from jsonb_array_elements(p->'targets') loop
      if not exists(select 1 from private.lots l where l.id::text = item->>'lotId' and l.operation_id = p_operation and l.farm_id = p_farm)
        then raise exception 'Lote do rateio fora da fazenda.' using errcode = '42501'; end if;
      if jsonb_typeof(item->'basis') is distinct from 'number' or (item->>'basis')::numeric <= 0 then raise exception 'Base do rateio inválida.'; end if;
      pct := pct + (item->>'basis')::numeric;
    end loop;
    if p->>'criterion' = 'manual' and abs(pct - 100) > 0.001 then raise exception 'Os percentuais do rateio precisam somar 100%%.'; end if;
    if char_length(coalesce(p->>'notes', '')) > 500 then raise exception 'Use até 500 caracteres na observação.'; end if;
  elsif k = 'ajuste_estoque' then
    if jsonb_typeof(p->'delta') is distinct from 'number' or (p->>'delta')::numeric = 0 or abs((p->>'delta')::numeric) > 1000000000
      or round((p->>'delta')::numeric, 3) <> (p->>'delta')::numeric then raise exception 'Informe a diferença do ajuste (até 3 casas).'; end if;
    if nullif(btrim(p->>'reason'), '') is null or char_length(p->>'reason') > 500 then raise exception 'Informe o motivo do ajuste.'; end if;
  else
    if not private.positive_qty(p->'quantity') then raise exception 'Informe a quantidade transferida (até 3 casas).'; end if;
    if not exists(select 1 from private.farms f where f.id::text = p->>'toFarmId' and f.operation_id = p_operation and f.id <> p_farm)
      then raise exception 'Escolha outra fazenda da mesma operação.' using errcode = '42501'; end if;
    if char_length(coalesce(p->>'notes', '')) > 500 then raise exception 'Use até 500 caracteres na observação.'; end if;
  end if;
end $$;
revoke all on function private.validate_entry(jsonb,uuid,uuid) from public, anon, authenticated;

-- Stock outflows must fit the balance on every date. A stock adjustment changes the stock value,
-- so it needs another partner (like expenses); with no other partner it is effective directly.
alter function private.entry_status(uuid,jsonb,uuid,uuid,boolean) rename to entry_status_before_stock;
revoke all on function private.entry_status_before_stock(uuid,jsonb,uuid,uuid,boolean) from public, anon, authenticated;
create function private.entry_status(p_entry uuid, p_data jsonb, p_operation uuid, p_author uuid, p_reserve boolean) returns text
language plpgsql security invoker set search_path = '' as $$
declare result text;
begin
  result := private.entry_status_before_stock(p_entry, p_data, p_operation, p_author, p_reserve);
  if result <> 'conflito' and private.is_stock_outflow(p_data)
    and private.stock_replay(p_operation, p_data->'payload'->>'supplyId', p_entry, p_data, p_reserve)->>'error' is not null then
    return 'conflito';
  end if;
  if result = 'aguardando_aprovacao' and p_data->>'kind' = 'ajuste_estoque' and not exists(
    select 1 from private.memberships m where m.operation_id = p_operation and m.user_id <> p_author and m.role = 'socio') then
    return 'aprovado';
  end if;
  return result;
end $$;
revoke all on function private.entry_status(uuid,jsonb,uuid,uuid,boolean) from public, anon, authenticated;

alter function private.command(uuid,text,jsonb) rename to command_before_stock;
revoke all on function private.command_before_stock(uuid,text,jsonb) from public, anon, authenticated;
create function private.command(p_id uuid, p_kind text, p_payload jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid; op uuid; target uuid; previous private.commands%rowtype; sup private.supplies%rowtype; outcome jsonb;
  item jsonb; t text; fields jsonb; existing private.entries%rowtype; entry_data jsonb; reason text;
begin
  if p_kind is null or p_kind not in ('create_supply', 'update_supply', 'save_entry', 'decide_entry') then
    return private.command_before_stock(p_id, p_kind, p_payload);
  end if;
  if p_kind in ('save_entry', 'decide_entry') then
    -- A stock adjustment is approved only by another partner (the previous implementation only
    -- knew expenses, sales and invoices as financial).
    if p_kind = 'decide_entry' then
      select * into existing from private.entries e where e.id = (p_payload->>'id')::uuid;
      if found and existing.kind = 'ajuste_estoque' and private.member_role(existing.operation_id) is distinct from 'socio'
        and not exists(select 1 from private.commands c where c.user_id = (select auth.uid()) and c.id = p_id)
        then raise exception 'Esta aprovação precisa de outra pessoa habilitada.' using errcode = '42501'; end if;
    end if;
    outcome := private.command_before_stock(p_id, p_kind, p_payload);
    -- Explain a stock conflict instead of the generic balance message.
    if outcome->>'status' = 'conflito' and private.is_stock_outflow(outcome) then
      entry_data := outcome - 'version';
      reason := private.stock_replay((outcome->>'operationId')::uuid, entry_data->'payload'->>'supplyId', (outcome->>'id')::uuid,
        entry_data, p_kind = 'save_entry')->>'error';
      if reason is not null and reason is distinct from outcome->>'conflictReason' then
        update private.entries set data = data || jsonb_build_object('conflictReason', reason) where id = (outcome->>'id')::uuid;
        outcome := outcome || jsonb_build_object('conflictReason', reason);
        update private.commands c set result = outcome where c.user_id = (select auth.uid()) and c.id = p_id;
      end if;
    end if;
    return outcome;
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
  perform 1 from private.operations where id = op for update;
  if private.member_role(op) is null then raise exception 'Sem acesso a esta operação.' using errcode = '42501'; end if;
  if private.member_role(op) <> 'socio' then raise exception 'Somente um sócio pode cadastrar insumos.' using errcode = '42501'; end if;
  t := btrim(regexp_replace(coalesce(p_payload->>'name', ''), '\s+', ' ', 'g'));
  if t = '' or char_length(t) > 100 then raise exception 'Dê um nome ao insumo (até 100 caracteres).'; end if;
  if p_payload->>'kind' is null or p_payload->>'kind' not in ('sal','sal_mineral','proteinado','racao','medicamento','outros') then raise exception 'Tipo de insumo inválido.'; end if;
  if p_payload->>'unit' is null or p_payload->>'unit' not in ('saco','kg','t','l','dose','un') then raise exception 'Escolha a unidade de controle.'; end if;
  if jsonb_typeof(p_payload->'conversions') is distinct from 'array' or jsonb_array_length(p_payload->'conversions') > 10 then raise exception 'Conversões inválidas.'; end if;
  for item in select value from jsonb_array_elements(p_payload->'conversions') loop
    if item->>'unit' is null or item->>'unit' not in ('saco','kg','t','l','dose','un') or item->>'unit' = p_payload->>'unit'
      or jsonb_typeof(item->'factor') is distinct from 'number' or (item->>'factor')::numeric <= 0 or (item->>'factor')::numeric > 1000000
      then raise exception 'Cada conversão precisa de outra unidade e de um fator maior que zero.'; end if;
  end loop;
  if (select count(*) <> count(distinct value->>'unit') from jsonb_array_elements(p_payload->'conversions')) then raise exception 'A mesma unidade aparece duas vezes.'; end if;
  if jsonb_typeof(p_payload->'minQuantity') not in ('null', 'number') or (p_payload->>'minQuantity')::numeric < 0 then raise exception 'O estoque mínimo não pode ser negativo.'; end if;
  if jsonb_typeof(p_payload->'active') is distinct from 'boolean' then raise exception 'Situação do insumo inválida.'; end if;
  if exists(select 1 from private.supplies s where s.operation_id = op and s.id <> target and lower(btrim(s.name)) = lower(t))
    then raise exception 'Já existe um insumo com este nome.'; end if;
  if p_kind = 'create_supply' then
    insert into private.supplies(id, operation_id, name, kind, unit, conversions, min_quantity, active)
      values (target, op, t, p_payload->>'kind', p_payload->>'unit', p_payload->'conversions', (p_payload->>'minQuantity')::numeric, (p_payload->>'active')::boolean)
      returning * into sup;
  else
    select * into sup from private.supplies s where s.id = target and s.operation_id = op for update;
    if not found then raise exception 'Insumo não encontrado.'; end if;
    fields := private.supply_json(sup) - 'id' - 'operationId' - 'createdAt';
    if p_payload->'previous' is null or fields <> p_payload->'previous' then raise exception 'O insumo mudou em outro aparelho. Sincronize antes de editar.'; end if;
    -- Recorded quantities are in the control unit: it cannot change once the supply was used.
    if p_payload->>'unit' <> sup.unit and exists(select 1 from private.entries e where e.operation_id = op
      and (e.data->'payload'->>'supplyId' = target::text or e.data->'payload'->'stockItems' @> jsonb_build_array(jsonb_build_object('supplyId', target::text))))
      then raise exception 'Este insumo já tem movimentações. A unidade de controle não pode mudar.'; end if;
    update private.supplies s set name = t, kind = p_payload->>'kind', unit = p_payload->>'unit', conversions = p_payload->'conversions',
      min_quantity = (p_payload->>'minQuantity')::numeric, active = (p_payload->>'active')::boolean
      where s.id = target returning * into sup;
  end if;
  outcome := private.supply_json(sup);
  insert into private.commands(user_id,id,kind,payload,result) values(uid,p_id,p_kind,p_payload,outcome);
  insert into private.audit_events(operation_id,actor_id,command_id,kind) values(op,uid,p_id,p_kind);
  return outcome;
end $$;
revoke all on function private.command(uuid,text,jsonb) from public, anon;
grant execute on function private.command(uuid,text,jsonb) to authenticated;

-- Every member receives the supplies. Employees also receive the operation's stock movements:
-- consumptions, adjustments, transfers, and stock purchases masked to supply and quantity (no
-- value, supplier or installments), so the balance their app computes equals the server's.
alter function private.workspace() rename to workspace_before_stock;
revoke all on function private.workspace_before_stock() from public, anon, authenticated;
create function private.workspace() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare w jsonb; uid uuid;
begin
  w := private.workspace_before_stock();
  uid := (select auth.uid());
  w := w || jsonb_build_object('supplies', coalesce((select jsonb_agg(private.supply_json(s) order by s.name) from private.supplies s
    where private.member_role(s.operation_id) is not null), '[]'::jsonb));
  return jsonb_set(w, '{entries}', coalesce((
    select jsonb_agg(x.d order by x.d->>'createdAt' desc, x.d->>'id') from (
      select v as d from jsonb_array_elements(coalesce(w->'entries', '[]'::jsonb)) v
      union all
      select case when e.kind = 'despesa' then e.data || jsonb_build_object('amountCents', 0, 'title', 'Compra para o estoque', 'decisionNote', null,
          'payload', jsonb_build_object('destination', 'estoque', 'category', '', 'description', '', 'supplier', '', 'document', '',
            'installments', '[]'::jsonb, 'criterion', 'cabeca', 'allocations', '[]'::jsonb,
            'stockItems', (select coalesce(jsonb_agg(jsonb_build_object('supplyId', i->>'supplyId', 'quantity', i->'quantity', 'cents', 0,
              'purchaseQuantity', i->'purchaseQuantity', 'purchaseUnit', i->>'purchaseUnit')), '[]'::jsonb)
              from jsonb_array_elements(e.data->'payload'->'stockItems') i)),
          'history', (select coalesce(jsonb_agg(h - 'note'), '[]'::jsonb) from jsonb_array_elements(e.data->'history') h))
        else e.data end || jsonb_build_object('version', e.version)
      from private.entries e
      where e.author_id <> uid and private.member_role(e.operation_id) = 'funcionario'
        and (e.kind in ('consumo', 'ajuste_estoque', 'transferencia_estoque')
          or (e.kind = 'despesa' and e.data->'payload'->>'destination' = 'estoque'))
    ) x
  ), '[]'::jsonb));
end $$;
revoke all on function private.workspace() from public, anon;
grant execute on function private.workspace() to authenticated;

-- Activity: supply registry and stock movements with the supply and the quantity, never values.
-- Employees see them (field work), except stock purchases (expenses).
alter function private.activity_item(private.audit_events) rename to activity_item_before_stock;
revoke all on function private.activity_item_before_stock(private.audit_events) from public, anon, authenticated;
create function private.activity_item(a private.audit_events) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare c private.commands%rowtype; item jsonb; s jsonb; e private.entries%rowtype; d jsonb; sup private.supplies%rowtype;
begin
  item := private.activity_item_before_stock(a);
  if a.kind in ('create_supply', 'update_supply') then
    select * into c from private.commands where user_id = a.actor_id and id = a.command_id;
    return item || jsonb_build_object('subject', jsonb_build_object('name', coalesce(c.result->>'name', c.payload->>'name')));
  end if;
  if a.kind in ('save_entry', 'decide_entry', 'discard_entry') and item->'subject'->>'entryKind' in ('consumo', 'ajuste_estoque', 'transferencia_estoque') then
    select * into c from private.commands where user_id = a.actor_id and id = a.command_id;
    select * into e from private.entries x where x.id::text = c.payload->>'id';
    d := coalesce(e.data->'payload', c.payload->'entry'->'payload');
    select * into sup from private.supplies x where x.id::text = d->>'supplyId';
    s := jsonb_build_object('supplyName', sup.name, 'unit', sup.unit,
      'quantity', case when item->'subject'->>'entryKind' = 'ajuste_estoque' then d->'delta' else d->'quantity' end,
      'toFarm', (select f.name from private.farms f where f.id::text = d->>'toFarmId'));
    return jsonb_set(item, '{subject}', (item->'subject') || jsonb_strip_nulls(s));
  end if;
  return item;
end $$;
revoke all on function private.activity_item(private.audit_events) from public, anon, authenticated;

alter function private.activity_visible(text, jsonb) rename to activity_visible_before_stock;
revoke all on function private.activity_visible_before_stock(text, jsonb) from public, anon, authenticated;
create function private.activity_visible(p_role text, p_item jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select private.activity_visible_before_stock(p_role, p_item) or (p_role = 'funcionario' and (
    p_item->>'kind' in ('create_supply', 'update_supply')
    or (p_item->>'kind' in ('save_entry', 'decide_entry', 'discard_entry')
      and p_item->'subject'->>'entryKind' in ('consumo', 'ajuste_estoque', 'transferencia_estoque'))))
$$;
revoke all on function private.activity_visible(text, jsonb) from public, anon, authenticated;
