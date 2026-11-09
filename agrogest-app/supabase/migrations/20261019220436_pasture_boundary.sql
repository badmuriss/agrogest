-- Optional pasture outline drawn over the satellite, like the farm boundary.
-- New AgroGest only. Never apply to the legacy/Noude database.

alter table private.pastures add column boundary jsonb
  constraint pastures_boundary_valid check (boundary is null or private.valid_ring(boundary));

create or replace function private.pasture_json(p private.pastures) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object('id', p.id, 'operationId', p.operation_id, 'farmId', p.farm_id, 'name', p.name, 'areaHa', p.area_ha,
    'forage', p.forage, 'notes', p.notes, 'active', p.active, 'legacy', p.legacy, 'createdAt', p.created_at, 'boundary', p.boundary)
$$;
revoke all on function private.pasture_json(private.pastures) from public, anon, authenticated;

-- Its own command, so the registry edit (`update_pasture`) and the drawing never
-- overwrite each other. Same rules as `update_farm_boundary`: partners only, the
-- previous outline must match, and the shape is validated here.
alter function private.command(uuid,text,jsonb) rename to command_before_pasture_boundary;
revoke all on function private.command_before_pasture_boundary(uuid,text,jsonb) from public, anon, authenticated;
create function private.command(p_id uuid, p_kind text, p_payload jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid; op uuid; target uuid; previous private.commands%rowtype; pasture private.pastures%rowtype; outcome jsonb;
begin
  if p_kind is distinct from 'update_pasture_boundary' then
    return private.command_before_pasture_boundary(p_id, p_kind, p_payload);
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
  if private.member_role(op) <> 'socio' then raise exception 'Esta ação exige um sócio da operação.' using errcode = '42501'; end if;
  if not (p_payload ? 'boundary') or not (p_payload ? 'previous') then raise exception 'Contorno inválido.'; end if;
  select * into pasture from private.pastures p where p.id = target and p.operation_id = op for update;
  if not found then raise exception 'Pasto não encontrado.'; end if;
  if coalesce(pasture.boundary, 'null'::jsonb) is distinct from p_payload->'previous'
    then raise exception 'O contorno do pasto mudou em outro aparelho. Sincronize antes de editar.'; end if;
  if jsonb_typeof(p_payload->'boundary') <> 'null' and not private.valid_ring(p_payload->'boundary')
    then raise exception 'Contorno inválido: desenhe de 3 a 500 pontos.'; end if;
  update private.pastures p set boundary = nullif(p_payload->'boundary', 'null'::jsonb) where p.id = target returning * into pasture;
  outcome := private.pasture_json(pasture);
  insert into private.commands(user_id,id,kind,payload,result) values(uid,p_id,p_kind,p_payload,outcome);
  insert into private.audit_events(operation_id,actor_id,command_id,kind) values(op,uid,p_id,p_kind);
  return outcome;
end $$;
revoke all on function private.command(uuid,text,jsonb) from public, anon;
grant execute on function private.command(uuid,text,jsonb) to authenticated;
