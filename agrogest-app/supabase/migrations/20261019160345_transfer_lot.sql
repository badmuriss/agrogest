-- A physical transfer closes the source balance and starts a linked destination
-- lot at carried cost. Historical entries and shared allocations stay at origin.
alter table private.lots add column transfer jsonb not null default '{}'::jsonb
  check (jsonb_typeof(transfer) = 'object');

alter function private.workspace() rename to workspace_before_transfer;
revoke all on function private.workspace_before_transfer() from public, anon, authenticated;
create function private.workspace() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare w jsonb;
begin
  w := private.workspace_before_transfer();
  return jsonb_set(w, '{lots}', coalesce((
    select jsonb_agg(l.value || jsonb_build_object('transfer', pl.transfer))
    from jsonb_array_elements(w->'lots') l(value)
    join private.lots pl on pl.id = (l.value->>'id')::uuid
  ), '[]'::jsonb));
end $$;
revoke all on function private.workspace() from public, anon;
grant execute on function private.workspace() to authenticated;

alter function private.command(uuid,text,jsonb) rename to command_before_transfer;
revoke all on function private.command_before_transfer(uuid,text,jsonb) from public, anon, authenticated;
create function private.command(p_id uuid, p_kind text, p_payload jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid; op uuid; destination_op uuid; destination_farm uuid; target uuid; next_id uuid;
  previous private.commands%rowtype; source private.lots%rowtype; sf private.farms%rowtype; df private.farms%rowtype;
  history_entry private.entries%rowtype; allocation jsonb; quantity bigint; pool bigint; sold bigint;
  weight numeric; weight_method text := 'medido'; d jsonb; result jsonb; out_meta jsonb; in_meta jsonb;
  movement_date text := to_char(clock_timestamp() at time zone 'America/Sao_Paulo', 'YYYY-MM-DD');
begin
  uid := private.ensure_profile();
  if p_id is null or p_kind is null or p_payload is null or jsonb_typeof(p_payload) <> 'object' or octet_length(p_payload::text) > 262144
    then raise exception 'Comando inválido.'; end if;
  op := (p_payload->>'operationId')::uuid;
  target := (p_payload->>'id')::uuid;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(uid::text || p_id::text,0));
  select * into previous from private.commands where user_id = uid and id = p_id;
  if found then
    if previous.kind <> p_kind or previous.payload <> p_payload then raise exception 'Identificador de comando reutilizado com outros dados.'; end if;
    return previous.result;
  end if;
  if p_kind is distinct from 'transfer_lot' then
    -- Serialize against transfers before checking whether a lot is closed.
    if p_kind in ('save_entry','decide_entry','update_lot') then
      perform 1 from private.operations where id = op for update;
      if p_kind = 'update_lot' and exists(select 1 from private.lots where id = target and transfer <> '{}'::jsonb) then
        raise exception 'Os dados de entrada de uma transferência são preservados. Registre os próximos lançamentos no lote de destino.';
      end if;
      if p_kind = 'save_entry' and exists(
        select 1 from private.lots l where l.operation_id = op and l.transfer ? 'outgoing' and (
          p_payload->'entry'->'payload'->>'lotId' = l.id::text or
          p_payload->'entry'->'payload'->'allocations' @> jsonb_build_array(jsonb_build_object('lotId',l.id::text))
        )
      ) then raise exception 'Este lote já foi transferido. Registre na fazenda de destino.'; end if;
    end if;
    if p_kind = 'save_entry' and exists(
      select 1 from private.lots l where l.operation_id = op and l.transfer ? 'incoming'
      and p_payload->'entry'->>'occurredAt' < l.transfer->'incoming'->>'at' and (
        p_payload->'entry'->'payload'->>'lotId' = l.id::text or
        p_payload->'entry'->'payload'->'allocations' @> jsonb_build_array(jsonb_build_object('lotId',l.id::text))
      )
    ) then raise exception 'A ocorrência não pode ser anterior à chegada do lote nesta fazenda.'; end if;
    return private.command_before_transfer(p_id,p_kind,p_payload);
  end if;

  destination_farm := (p_payload->>'destinationFarmId')::uuid;
  next_id := (p_payload->>'destinationLotId')::uuid;
  if op is null or target is null or destination_farm is null or next_id is null or target = next_id then raise exception 'Transferência incompleta.'; end if;
  select * into df from private.farms where id = destination_farm;
  destination_op := df.operation_id;
  if destination_op is null then raise exception 'Fazenda de destino indisponível.' using errcode = '42501'; end if;
  -- Deterministic ordering avoids deadlocks for transfers in opposite directions.
  perform 1 from private.operations where id in (op,destination_op) order by id for update;
  if private.member_role(op) is distinct from 'socio' or private.member_role(destination_op) is distinct from 'socio'
    then raise exception 'A transferência exige ser sócio nas duas fazendas.' using errcode = '42501'; end if;
  select * into source from private.lots where id = target and operation_id = op for update;
  if not found then raise exception 'Lote não encontrado.'; end if;
  if source.farm_id = destination_farm then raise exception 'Escolha uma fazenda diferente da origem.'; end if;
  if source.transfer ? 'outgoing' then raise exception 'Este lote já foi transferido. Sincronize para ver o destino.'; end if;
  if source.farm_id::text is distinct from p_payload->>'sourceFarmId' then raise exception 'A origem mudou. Sincronize e revise.'; end if;
  if movement_date is distinct from p_payload->>'date' then raise exception 'A data mudou. Reabra a transferência para revisar.'; end if;
  select * into sf from private.farms where id = source.farm_id;
  if exists(select 1 from private.entries e where e.operation_id = op and (
      e.data->'payload'->>'lotId' = target::text or e.data->'payload'->'allocations' @> jsonb_build_array(jsonb_build_object('lotId',target::text))
    ) and e.status not in ('aprovado','rejeitado')) then raise exception 'Resolva os lançamentos pendentes do lote antes de transferir.'; end if;
  quantity := (source.data->>'headsPurchased')::bigint;
  pool := (source.data->>'purchaseCents')::bigint + (source.data->>'commissionCents')::bigint + (source.data->>'freightCents')::bigint;
  weight := (source.data->>'entryWeightKg')::numeric;
  weight_method := coalesce(source.transfer->'incoming'->>'weightMethod','medido');
  for history_entry in select * from private.entries e where e.operation_id = op and e.status = 'aprovado' and (
    e.data->'payload'->>'lotId' = target::text or e.data->'payload'->'allocations' @> jsonb_build_array(jsonb_build_object('lotId',target::text))
  ) order by e.data->>'occurredAt', e.data->>'createdAt', e.id loop
    if history_entry.data->>'occurredAt' > movement_date then raise exception 'O lote tem lançamentos futuros. Revise antes de transferir.'; end if;
    if history_entry.kind = 'pesagem' then
      weight := (history_entry.data->'payload'->>'avgWeightKg')::numeric;
      weight_method := history_entry.data->'payload'->>'method';
    elsif history_entry.kind = 'mortalidade' then
      quantity := quantity - (history_entry.data->'payload'->>'heads')::bigint;
    elsif history_entry.kind = 'venda' then
      sold := (history_entry.data->'payload'->>'heads')::bigint;
      if quantity <= 0 or sold > quantity then raise exception 'Saldo inconsistente. Revise o lote.'; end if;
      pool := pool - round(pool::numeric * sold / quantity)::bigint;
      quantity := quantity - sold;
    elsif history_entry.kind in ('despesa','nota_fiscal') then
      for allocation in select value from jsonb_array_elements(history_entry.data->'payload'->'allocations') loop
        if allocation->>'lotId' = target::text then pool := pool + (allocation->>'cents')::bigint; end if;
      end loop;
    end if;
  end loop;
  if quantity <= 0 or pool < 0 then raise exception 'O lote não tem animais disponíveis para transferir.'; end if;
  if quantity is distinct from (p_payload->>'expectedHeads')::bigint or pool is distinct from (p_payload->>'expectedCostCents')::bigint
    or weight is distinct from (p_payload->>'expectedWeightKg')::numeric
    then raise exception 'O saldo, custo ou peso mudou. Sincronize e revise a transferência.'; end if;
  if source.data->>'purchasedAt' > movement_date then raise exception 'A entrada do lote está no futuro.'; end if;
  if nullif(trim(p_payload->>'code'),'') is null or char_length(trim(p_payload->>'code')) > 100
    or nullif(trim(p_payload->>'managementGroup'),'') is null or char_length(trim(p_payload->>'managementGroup')) > 150
    then raise exception 'Informe código e pasto de destino.'; end if;
  out_meta := jsonb_build_object('destinationLotId',next_id,'farmId',df.id,'farmName',df.name,'at',movement_date,'heads',quantity);
  in_meta := jsonb_build_object('sourceLotId',source.id,'farmId',sf.id,'farmName',sf.name,'at',movement_date,'weightMethod',weight_method);
  d := source.data - 'location' - 'transfer' || jsonb_build_object('id',next_id,'operationId',destination_op,'farmId',df.id,
    'code',trim(p_payload->>'code'),'managementGroup',trim(p_payload->>'managementGroup'),'purchasedAt',movement_date,
    'headsPurchased',quantity,'entryWeightKg',weight,'purchaseCents',pool,'commissionCents',0,'freightCents',0);
  insert into private.lots(id,operation_id,farm_id,data,transfer) values(next_id,destination_op,df.id,d,jsonb_build_object('incoming',in_meta));
  update private.lots set transfer = transfer || jsonb_build_object('outgoing',out_meta), data = data - 'location' where id = source.id;
  result := jsonb_build_object('sourceTransfer',source.transfer || jsonb_build_object('outgoing',out_meta),
    'lot',d || jsonb_build_object('transfer',jsonb_build_object('incoming',in_meta)));
  insert into private.commands(user_id,id,kind,payload,result) values(uid,p_id,p_kind,p_payload,result);
  insert into private.audit_events(operation_id,actor_id,command_id,kind) values(op,uid,p_id,p_kind),(destination_op,uid,p_id,p_kind);
  return result;
end $$;
revoke all on function private.command(uuid,text,jsonb) from public, anon;
grant execute on function private.command(uuid,text,jsonb) to authenticated;
