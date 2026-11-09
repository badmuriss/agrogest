-- Add only invitation display context. Membership, finances and farm data stay private.
create or replace function private.workspace() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare w jsonb;
begin
  w := private.workspace_base();
  w := jsonb_set(w, '{farms}', coalesce((
    select jsonb_agg(f.value || jsonb_build_object('boundary', pf.boundary))
    from jsonb_array_elements(w->'farms') as f(value)
    join private.farms pf on pf.id = (f.value->>'id')::uuid
  ), '[]'::jsonb));
  return jsonb_set(w, '{invites}', coalesce((
    select jsonb_agg(i.value || jsonb_build_object('context', jsonb_build_object(
      'inviterName', p.name,
      'operationName', o.name,
      'farmNames', coalesce((select jsonb_agg(f.name order by f.name) from private.farms f where f.operation_id = inv.operation_id), '[]'::jsonb)
    )) order by inv.created_at desc)
    from jsonb_array_elements(w->'invites') as i(value)
    join private.invites inv on inv.id = (i.value->>'id')::uuid
    join private.profiles p on p.id = inv.created_by
    join private.operations o on o.id = inv.operation_id
  ), '[]'::jsonb));
end $$;
revoke all on function private.workspace() from public, anon;
grant execute on function private.workspace() to authenticated;
