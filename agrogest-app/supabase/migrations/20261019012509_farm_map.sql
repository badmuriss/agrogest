-- Farm map: the farm boundary drawn over satellite imagery and one pin per lot.
-- Geometry is plain GeoJSON in jsonb ([lng, lat]); the app computes hectares.

create function private.valid_position(p jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select case
    when jsonb_typeof(p) <> 'array' or jsonb_array_length(p) <> 2 then false
    when jsonb_typeof(p->0) <> 'number' or jsonb_typeof(p->1) <> 'number' then false
    else (p->>0)::numeric between -180 and 180 and (p->>1)::numeric between -90 and 90
  end
$$;

-- Closed ring of 4..501 valid positions (3..500 distinct vertices). Self-crossing
-- is rejected by the app; the server guarantees shape and coordinate ranges.
create function private.valid_ring(ring jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select case
    when jsonb_typeof(ring) <> 'array' or jsonb_array_length(ring) not between 4 and 501 then false
    else ring->0 = ring->-1 and not exists (
      select 1 from jsonb_array_elements(ring) as p(value)
      where not private.valid_position(value)
    )
  end
$$;

revoke all on function private.valid_position(jsonb) from public, anon, authenticated;
revoke all on function private.valid_ring(jsonb) from public, anon, authenticated;

alter table private.farms add column boundary jsonb
  constraint farms_boundary_valid check (boundary is null or private.valid_ring(boundary));
alter table private.lots add constraint lots_location_valid
  check (data->'location' is null or jsonb_typeof(data->'location') = 'null' or private.valid_position(data->'location'));

-- The workspace projection gains the boundary. It is not financial, so every
-- member of the operation sees it.
alter function private.workspace() rename to workspace_base;
revoke all on function private.workspace_base() from public, anon, authenticated;
create function private.workspace() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare w jsonb;
begin
  w := private.workspace_base();
  return jsonb_set(w, '{farms}', coalesce((
    select jsonb_agg(f.value || jsonb_build_object('boundary', pf.boundary))
    from jsonb_array_elements(w->'farms') as f(value)
    join private.farms pf on pf.id = (f.value->>'id')::uuid
  ), '[]'::jsonb));
end $$;
revoke all on function private.workspace() from public, anon;
grant execute on function private.workspace() to authenticated;

-- Same dispatcher as 20261019002750_update_lot, plus the two map commands.
create or replace function private.command(p_id uuid, p_kind text, p_payload jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid; op uuid; target uuid; previous private.commands%rowtype; existing private.lots%rowtype;
  d jsonb; result jsonb; qty numeric; reserved bigint; earliest date; role_name text; current_boundary jsonb;
begin
  if p_kind is null or p_kind not in ('update_lot','update_farm_boundary','place_lot') then
    return private.command_base(p_id, p_kind, p_payload);
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
  role_name := private.member_role(op);
  if role_name is null then raise exception 'Sem acesso a esta operação.' using errcode = '42501'; end if;

  if p_kind = 'place_lot' then
    -- Any member places a lot on the map: it is field information, not finance.
    if not (p_payload ? 'location') then raise exception 'Posição inválida.'; end if;
    select * into existing from private.lots where id = target and operation_id = op for update;
    if not found then raise exception 'Lote não encontrado.'; end if;
    if jsonb_typeof(p_payload->'location') = 'null' then
      result := existing.data - 'location';
    elsif private.valid_position(p_payload->'location') then
      result := existing.data || jsonb_build_object('location', p_payload->'location');
    else
      raise exception 'Posição inválida.';
    end if;
    update private.lots set data = result where id = target;
    result := jsonb_build_object('id', target, 'location', result->'location');

  elsif p_kind = 'update_farm_boundary' then
    if role_name <> 'socio' then raise exception 'Esta ação exige um sócio da operação.' using errcode = '42501'; end if;
    if not (p_payload ? 'boundary') or not (p_payload ? 'previous') then raise exception 'Área inválida.'; end if;
    select boundary into current_boundary from private.farms where id = target and operation_id = op for update;
    if not found then raise exception 'Fazenda não encontrada.'; end if;
    if coalesce(current_boundary, 'null'::jsonb) is distinct from p_payload->'previous'
      then raise exception 'A área da fazenda mudou em outro aparelho. Sincronize antes de editar.'; end if;
    if jsonb_typeof(p_payload->'boundary') <> 'null' and not private.valid_ring(p_payload->'boundary')
      then raise exception 'Área inválida: desenhe de 3 a 500 pontos.'; end if;
    update private.farms set boundary = nullif(p_payload->'boundary', 'null'::jsonb) where id = target and operation_id = op;
    result := jsonb_build_object('id', target, 'boundary', p_payload->'boundary');

  else -- update_lot
    if role_name <> 'socio' then raise exception 'Esta ação exige um sócio da operação.' using errcode = '42501'; end if;
    select * into existing from private.lots where id = target and operation_id = op for update;
    if not found then raise exception 'Lote não encontrado.'; end if;
    if p_payload->'previous' is null or private.lot_fields(existing.data) <> private.lot_fields(p_payload->'previous')
      then raise exception 'O lote mudou em outro aparelho. Sincronize antes de editar.'; end if;
    d := private.lot_fields(p_payload);
    qty := (d->>'headsPurchased')::numeric;
    if qty is null or qty <= 0 or qty > 20000 or trunc(qty) <> qty or (d->>'entryWeightKg')::numeric not between 20 and 1500
      or d->>'entryWeightKg' is null or nullif(trim(d->>'code'),'') is null or nullif(trim(d->>'category'),'') is null
      then raise exception 'Dados do lote inválidos.'; end if;
    if d->>'purchasedAt' is null or d->>'purchasedAt' !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Data de compra inválida.'; end if;
    perform (d->>'purchasedAt')::date;
    perform private.cents(d->'purchaseCents'); perform private.cents(d->'commissionCents'); perform private.cents(d->'freightCents');
    select coalesce(sum((data->'payload'->>'heads')::bigint), 0) into reserved from private.entries
      where operation_id = op and kind in ('mortalidade','venda') and data->'payload'->>'lotId' = target::text
      and status in ('aprovado','aguardando_aprovacao');
    if qty < reserved then
      raise exception 'O lote já tem % cabeças vendidas, mortas ou aguardando aprovação.', reserved;
    end if;
    select min((data->>'occurredAt')::date) into earliest from private.entries
      where operation_id = op and kind in ('pesagem','mortalidade','venda') and data->'payload'->>'lotId' = target::text
      and status in ('aprovado','aguardando_aprovacao');
    if earliest is not null and (d->>'purchasedAt')::date > earliest then
      raise exception 'A entrada não pode ser depois do primeiro lançamento do lote (%).', to_char(earliest, 'DD/MM/YYYY');
    end if;
    result := existing.data || d;
    update private.lots set data = result where id = target;
  end if;

  insert into private.commands(user_id,id,kind,payload,result) values(uid,p_id,p_kind,p_payload,result);
  insert into private.audit_events(operation_id,actor_id,command_id,kind) values(op,uid,p_id,p_kind);
  return result;
end $$;
revoke all on function private.command(uuid,text,jsonb) from public, anon;
grant execute on function private.command(uuid,text,jsonb) to authenticated;
