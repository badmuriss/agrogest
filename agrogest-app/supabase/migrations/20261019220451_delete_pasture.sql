-- Deleting a pasture that was never used (a typo, a duplicate). A pasture with history is
-- only inactivated: occupancy and GMD depend on it.
-- New AgroGest only. Never apply to the legacy/Noude database.

create function private.pasture_in_use(p_pasture uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from private.lots l where l.data->>'pastureId' = p_pasture::text)
    or exists(select 1 from private.entries e
      where e.kind in ('manejo','pesagem','mortalidade','venda')
        and p_pasture::text in (e.data->'payload'->>'fromPastureId', e.data->'payload'->>'toPastureId', e.data->'payload'->>'pastureId'))
$$;
revoke all on function private.pasture_in_use(uuid) from public, anon, authenticated;

alter function private.command(uuid,text,jsonb) rename to command_before_pasture_delete;
revoke all on function private.command_before_pasture_delete(uuid,text,jsonb) from public, anon, authenticated;
create function private.command(p_id uuid, p_kind text, p_payload jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid; op uuid; target uuid; previous private.commands%rowtype; outcome jsonb;
begin
  if p_kind is distinct from 'delete_pasture' then
    return private.command_before_pasture_delete(p_id, p_kind, p_payload);
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
  -- The operation lock also serializes lots and entries that could start using the pasture.
  perform 1 from private.operations where id = op for update;
  if private.member_role(op) is null then raise exception 'Sem acesso a esta operação.' using errcode = '42501'; end if;
  if private.member_role(op) <> 'socio' then raise exception 'Esta ação exige um sócio da operação.' using errcode = '42501'; end if;
  perform 1 from private.pastures p where p.id = target and p.operation_id = op for update;
  if not found then raise exception 'Pasto não encontrado.'; end if;
  if private.pasture_in_use(target) then
    raise exception 'Este pasto já tem lotes ou lançamentos. Inative-o para preservar o histórico.';
  end if;
  delete from private.pastures p where p.id = target;
  outcome := jsonb_build_object('id', target, 'deleted', true);
  insert into private.commands(user_id,id,kind,payload,result) values(uid,p_id,p_kind,p_payload,outcome);
  insert into private.audit_events(operation_id,actor_id,command_id,kind) values(op,uid,p_id,p_kind);
  return outcome;
end $$;
revoke all on function private.command(uuid,text,jsonb) from public, anon;
grant execute on function private.command(uuid,text,jsonb) to authenticated;
