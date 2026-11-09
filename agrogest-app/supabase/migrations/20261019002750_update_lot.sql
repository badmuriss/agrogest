-- Partners can correct a lot's root data after it exists. The existing command
-- implementation stays intact as command_base; only update_lot is handled here.
alter function private.command(uuid,text,jsonb) rename to command_base;
revoke all on function private.command_base(uuid,text,jsonb) from public, anon, authenticated;

-- Editable fields, normalized so lots saved before the document lists compare equal.
create function private.lot_fields(p jsonb) returns jsonb
language sql immutable set search_path = '' as $$
  select jsonb_build_object('code', p->'code', 'managementGroup', p->'managementGroup', 'supplier', p->'supplier',
    'category', p->'category', 'purchasedAt', p->'purchasedAt', 'headsPurchased', p->'headsPurchased',
    'entryWeightKg', p->'entryWeightKg', 'purchaseCents', p->'purchaseCents', 'commissionCents', p->'commissionCents',
    'freightCents', p->'freightCents', 'gtaNumbers', coalesce(p->'gtaNumbers', '[]'::jsonb),
    'invoiceNumbers', coalesce(p->'invoiceNumbers', '[]'::jsonb))
$$;
revoke all on function private.lot_fields(jsonb) from public, anon, authenticated;

create function private.command(p_id uuid, p_kind text, p_payload jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid; op uuid; target uuid; previous private.commands%rowtype; existing private.lots%rowtype;
  d jsonb; result jsonb; qty numeric; reserved bigint; earliest date;
begin
  if p_kind is distinct from 'update_lot' then return private.command_base(p_id, p_kind, p_payload); end if;
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
  -- Same lock as entry reservations: a sale cannot slip in while heads shrink.
  perform 1 from private.operations where id = op for update;
  if private.member_role(op) is null then raise exception 'Sem acesso a esta operação.' using errcode = '42501'; end if;
  if private.member_role(op) <> 'socio' then raise exception 'Esta ação exige um sócio da operação.' using errcode = '42501'; end if;
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
  insert into private.commands(user_id,id,kind,payload,result) values(uid,p_id,p_kind,p_payload,result);
  insert into private.audit_events(operation_id,actor_id,command_id,kind) values(op,uid,p_id,p_kind);
  return result;
end $$;
revoke all on function private.command(uuid,text,jsonb) from public, anon;
grant execute on function private.command(uuid,text,jsonb) to authenticated;
