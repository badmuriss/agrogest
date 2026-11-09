-- Two divergences between the server and the app found after 20261019181210_pastures_manejo.
-- New AgroGest only. Never apply to the legacy/Noude database.

-- 1. A lot transferred to another farm leaves its pastures on the transfer date, like
-- `lotPastureTimeline` in the app. Before this, the origin pastures stayed occupied
-- forever and could not be inactivated.
alter function private.lot_pasture_replay(uuid,uuid,uuid,jsonb,boolean) rename to lot_pasture_replay_before_transfer;
revoke all on function private.lot_pasture_replay_before_transfer(uuid,uuid,uuid,jsonb,boolean) from public, anon, authenticated;
create function private.lot_pasture_replay(p_operation uuid, p_lot uuid, p_skip uuid, p_candidate jsonb, p_reserve boolean) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  result := private.lot_pasture_replay_before_transfer(p_operation, p_lot, p_skip, p_candidate, p_reserve);
  if result->>'error' is null and exists(
    select 1 from private.lots l where l.id = p_lot and l.operation_id = p_operation and l.transfer ? 'outgoing') then
    result := jsonb_set(result, '{heads}', '{}'::jsonb);
  end if;
  return result;
end $$;
revoke all on function private.lot_pasture_replay(uuid,uuid,uuid,jsonb,boolean) from public, anon, authenticated;

-- 2. The masked sale that non-partners receive kept only lotId and heads. Without the
-- pasture the app spread the exit across the largest groups and its occupancy differed
-- from the server's. The pasture is not financial, so it goes back into the payload.
-- Entries are also re-sorted after the employees' extra moves are appended.
create or replace function private.workspace() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare w jsonb; uid uuid;
begin
  w := private.workspace_before_pastures();
  uid := (select auth.uid());
  w := w || jsonb_build_object('pastures', coalesce((select jsonb_agg(private.pasture_json(p) order by p.name)
    from private.pastures p where private.member_role(p.operation_id) is not null), '[]'::jsonb));
  return jsonb_set(w, '{entries}', coalesce((
    select jsonb_agg(x.d order by x.d->>'createdAt' desc, x.d->>'id') from (
      select case when v->>'kind' = 'venda' and nullif(e.data->'payload'->>'pastureId', '') is not null
        then jsonb_set(v, '{payload,pastureId}', e.data->'payload'->'pastureId') else v end as d
      from jsonb_array_elements(coalesce(w->'entries', '[]'::jsonb)) v
      left join private.entries e on e.id = (v->>'id')::uuid
      union all
      select e.data || jsonb_build_object('version', e.version) from private.entries e
      where e.kind = 'manejo' and e.author_id <> uid and private.member_role(e.operation_id) = 'funcionario'
    ) x
  ), '[]'::jsonb));
end $$;
revoke all on function private.workspace() from public, anon;
grant execute on function private.workspace() to authenticated;
