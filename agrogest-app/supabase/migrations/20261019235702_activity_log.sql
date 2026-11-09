-- Activity log: who did what in each operation, read from the audit trail every command
-- already writes. The summary never carries money; employees only see field activity.
-- New AgroGest only. Never apply to the legacy/Noude database.

create index commands_kind_target_idx on private.commands(kind, (payload->>'id'));

-- Last known name and farm of a pasture, also after it was deleted.
create function private.pasture_trace(p_id text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'name', coalesce((select p.name from private.pastures p where p.id::text = p_id),
      (select c.payload->>'name' from private.commands c where c.kind in ('create_pasture','update_pasture') and c.payload->>'id' = p_id
        order by c.created_at desc limit 1)),
    'farmId', coalesce((select p.farm_id::text from private.pastures p where p.id::text = p_id),
      (select c.payload->>'farmId' from private.commands c where c.kind = 'create_pasture' and c.payload->>'id' = p_id limit 1)))
$$;
revoke all on function private.pasture_trace(text) from public, anon, authenticated;

create function private.activity_item(a private.audit_events) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare c private.commands%rowtype; p jsonb; s jsonb := '{}'::jsonb; farm text; trace jsonb;
  lot private.lots%rowtype; entry private.entries%rowtype; entry_kind text; entry_data jsonb;
begin
  select * into c from private.commands where user_id = a.actor_id and id = a.command_id;
  p := coalesce(c.payload, '{}'::jsonb);
  if a.kind in ('create_farm', 'update_farm') then
    farm := p->>'id';
    s := jsonb_build_object('name', p->>'name');
  elsif a.kind = 'update_farm_boundary' then
    farm := p->>'id';
    s := jsonb_build_object('cleared', jsonb_typeof(p->'boundary') = 'null');
  elsif a.kind in ('create_pasture', 'update_pasture', 'update_pasture_boundary', 'delete_pasture') then
    trace := private.pasture_trace(p->>'id');
    farm := trace->>'farmId';
    s := jsonb_build_object('pastureId', p->>'id', 'name', trace->>'name');
    if a.kind = 'update_pasture' then
      s := s || jsonb_build_object('active', p->'active', 'wasActive', p->'previous'->'active');
    elsif a.kind = 'update_pasture_boundary' then
      s := s || jsonb_build_object('cleared', jsonb_typeof(p->'boundary') = 'null');
    end if;
  elsif a.kind in ('create_lot', 'update_lot', 'place_lot') then
    select * into lot from private.lots l where l.id::text = p->>'id';
    farm := coalesce(lot.farm_id::text, p->>'farmId');
    s := jsonb_build_object('lotId', p->>'id', 'code', coalesce(lot.data->>'code', p->>'code'));
    if a.kind = 'place_lot' then s := s || jsonb_build_object('cleared', jsonb_typeof(p->'location') = 'null'); end if;
  elsif a.kind = 'transfer_lot' then
    select * into lot from private.lots l where l.id::text = p->>'id';
    -- One audit row per side: the source operation sees it leave, the destination sees it arrive.
    if a.operation_id = lot.operation_id then farm := p->>'sourceFarmId'; else farm := p->>'destinationFarmId'; end if;
    s := jsonb_build_object('lotId', p->>'id', 'code', coalesce(lot.data->>'code', p->>'code'),
      'direction', case when a.operation_id = lot.operation_id then 'saida' else 'entrada' end,
      'fromFarm', (select f.name from private.farms f where f.id::text = p->>'sourceFarmId'),
      'toFarm', (select f.name from private.farms f where f.id::text = p->>'destinationFarmId'));
  elsif a.kind in ('invite', 'cancel_invite') then
    s := jsonb_build_object('name', coalesce(p->>'name',
      (select x.payload->>'name' from private.commands x where x.kind = 'invite' and x.payload->>'id' = p->>'id' limit 1)), 'role', p->>'role');
  elsif a.kind in ('save_entry', 'decide_entry', 'discard_entry') then
    select * into entry from private.entries e where e.id::text = p->>'id';
    entry_data := coalesce(entry.data, jsonb_build_object('kind', p->'entry'->>'kind', 'payload', p->'entry'->'payload'));
    entry_kind := coalesce(entry.kind, entry_data->>'kind');
    farm := coalesce(entry.farm_id::text, p->>'farmId');
    select * into lot from private.lots l where l.id::text = entry_data->'payload'->>'lotId';
    s := jsonb_build_object('entryId', p->>'id', 'entryKind', entry_kind, 'lotCode', lot.data->>'code');
    if a.kind = 'save_entry' then s := s || jsonb_build_object('submit', coalesce(p->'submit', 'false'::jsonb)); end if;
    if a.kind = 'decide_entry' then s := s || jsonb_build_object('decision', p->>'decision'); end if;
    if entry_kind in ('pesagem', 'mortalidade', 'manejo') then
      s := s || jsonb_build_object('heads', coalesce(entry_data->'payload'->'heads', entry_data->'payload'->'headsWeighed'),
        'fromPasture', (private.pasture_trace(entry_data->'payload'->>'fromPastureId'))->>'name',
        'toPasture', (private.pasture_trace(entry_data->'payload'->>'toPastureId'))->>'name');
    end if;
  end if;
  return jsonb_build_object('id', a.id::text, 'operationId', a.operation_id, 'farmId', farm, 'actorId', a.actor_id,
    'actorName', (select pr.name from private.profiles pr where pr.id = a.actor_id), 'kind', a.kind,
    'at', a.created_at, 'subject', jsonb_strip_nulls(s));
end $$;
revoke all on function private.activity_item(private.audit_events) from public, anon, authenticated;

-- Employees see field activity only: no farm registry, invitations or financial entries.
create function private.activity_visible(p_role text, p_item jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select p_role = 'socio' or (p_role = 'funcionario' and (
    p_item->>'kind' in ('create_pasture','update_pasture','update_pasture_boundary','delete_pasture','update_farm_boundary',
      'create_lot','place_lot','accept_invite')
    or (p_item->>'kind' in ('save_entry','decide_entry','discard_entry')
      and p_item->'subject'->>'entryKind' in ('pesagem','mortalidade','manejo'))))
$$;
revoke all on function private.activity_visible(text, jsonb) from public, anon, authenticated;

alter function private.workspace() rename to workspace_before_activity;
revoke all on function private.workspace_before_activity() from public, anon, authenticated;
create function private.workspace() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare w jsonb;
begin
  w := private.workspace_before_activity();
  return w || jsonb_build_object('activity', coalesce((
    select jsonb_agg(x.item order by x.created_at desc, x.id desc) from (
      select a.id, a.created_at, i.item from private.audit_events a
      cross join lateral (select private.activity_item(a) as item) i
      where private.member_role(a.operation_id) is not null
        and private.activity_visible(private.member_role(a.operation_id), i.item)
      order by a.created_at desc, a.id desc
      limit 300
    ) x
  ), '[]'::jsonb));
end $$;
revoke all on function private.workspace() from public, anon;
grant execute on function private.workspace() to authenticated;
