-- New AgroGest: names come from accounts; partners manage operation access, never Auth accounts.
create function private.invitee_name(p_email text) returns text
language sql stable security invoker set search_path = '' as $$
  select coalesce((select left(coalesce(nullif(btrim(u.raw_user_meta_data->>'name'), ''),
    nullif(btrim(p.name), ''), lower(btrim(p_email))), 150)
    from auth.users u left join private.profiles p on p.id = u.id
    where lower(u.email) = lower(btrim(p_email)) limit 1), lower(btrim(p_email)))
$$;
revoke all on function private.invitee_name(text) from public, anon, authenticated;

alter function private.command(uuid,text,jsonb) rename to command_before_people;
revoke all on function private.command_before_people(uuid,text,jsonb) from public, anon, authenticated;
create function private.command(p_id uuid, p_kind text, p_payload jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid; op uuid; target uuid; invite_email text; display_name text; owner uuid;
  previous private.commands%rowtype; member private.memberships%rowtype; outcome jsonb;
begin
  if p_kind is null or p_kind not in ('invite','update_member','remove_member') then
    return private.command_before_people(p_id,p_kind,p_payload);
  end if;
  uid := private.ensure_profile();
  if p_id is null or p_payload is null or jsonb_typeof(p_payload) <> 'object' or octet_length(p_payload::text) > 262144
    then raise exception 'Comando inválido.'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(uid::text || p_id::text, 0));
  select * into previous from private.commands where user_id=uid and id=p_id;
  if found then
    if previous.kind <> p_kind or previous.payload <> p_payload then raise exception 'Identificador de comando reutilizado com outros dados.'; end if;
    return previous.result;
  end if;
  op := (p_payload->>'operationId')::uuid;
  target := (p_payload->>'id')::uuid;
  if op is null or target is null then raise exception 'Operação ou pessoa inválida.'; end if;
  select owner_id into owner from private.operations where id=op for update;
  if private.member_role(op) is distinct from 'socio' then
    raise exception 'Esta ação exige um sócio da operação.' using errcode='42501';
  end if;
  if p_kind = 'invite' then
    invite_email := lower(btrim(p_payload->>'contact'));
    if invite_email is null or char_length(invite_email)>254 or invite_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
      then raise exception 'Informe o e-mail da conta convidada.'; end if;
    if p_payload->>'role' is null or p_payload->>'role' not in ('socio','funcionario') then raise exception 'Escolha o cargo.'; end if;
    if exists(select 1 from private.memberships m join auth.users u on u.id=m.user_id where m.operation_id=op and lower(u.email)=invite_email)
      then raise exception 'Esta pessoa já participa da operação.'; end if;
    if exists(select 1 from private.invites where operation_id=op and contact=invite_email) then raise exception 'Já existe um convite pendente para este e-mail.'; end if;
    display_name := private.invitee_name(invite_email);
    insert into private.invites(id,operation_id,name,contact,role,share_pct,created_by)
      values(target,op,display_name,invite_email,p_payload->>'role',case when p_payload->>'role'='socio' then (p_payload->>'sharePct')::numeric else null end,uid);
    outcome := jsonb_build_object('id',target,'name',display_name,'contact',invite_email);
  else
    if target=uid then raise exception 'Você não pode alterar nem remover seu próprio acesso.' using errcode='42501'; end if;
    if target=owner then raise exception 'O criador da operação não pode ter o acesso alterado ou removido.' using errcode='42501'; end if;
    select * into member from private.memberships where operation_id=op and user_id=target for update;
    if not found then raise exception 'Esta pessoa não participa mais da operação.'; end if;
    if p_payload->'previous' is distinct from jsonb_build_object('role',member.role,'sharePct',member.share_pct)
      then raise exception 'O acesso mudou em outro aparelho. Sincronize antes de editar.'; end if;
    if p_kind='update_member' then
      if p_payload->>'role' is null or p_payload->>'role' not in ('socio','funcionario') then raise exception 'Escolha o cargo.'; end if;
      update private.memberships set role=p_payload->>'role',
        share_pct=case when p_payload->>'role'='funcionario' then null else member.share_pct end
        where operation_id=op and user_id=target;
    else
      delete from private.memberships where operation_id=op and user_id=target;
    end if;
    outcome := jsonb_build_object('id',target,'operationId',op);
  end if;
  insert into private.commands(user_id,id,kind,payload,result) values(uid,p_id,p_kind,p_payload,outcome);
  insert into private.audit_events(operation_id,actor_id,command_id,kind) values(op,uid,p_id,p_kind);
  return outcome;
end $$;
revoke all on function private.command(uuid,text,jsonb) from public, anon;
grant execute on function private.command(uuid,text,jsonb) to authenticated;

alter function private.workspace() rename to workspace_before_people;
revoke all on function private.workspace_before_people() from public, anon, authenticated;
create function private.workspace() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare w jsonb;
begin
  w := private.workspace_before_people();
  w := jsonb_set(w,'{operations}',coalesce((select jsonb_agg(x.value || jsonb_build_object('ownerId',o.owner_id))
    from jsonb_array_elements(w->'operations') x(value) join private.operations o on o.id=(x.value->>'id')::uuid),'[]'::jsonb));
  return jsonb_set(w,'{invites}',coalesce((select jsonb_agg(x.value || jsonb_build_object('name',private.invitee_name(x.value->>'contact')))
    from jsonb_array_elements(w->'invites') x(value)),'[]'::jsonb));
end $$;
revoke all on function private.workspace() from public, anon;
grant execute on function private.workspace() to authenticated;

alter function private.activity_item(private.audit_events) rename to activity_item_before_people;
revoke all on function private.activity_item_before_people(private.audit_events) from public, anon, authenticated;
create function private.activity_item(a private.audit_events) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare item jsonb; p jsonb; email text;
begin
  item := private.activity_item_before_people(a);
  select c.payload into p from private.commands c where c.user_id=a.actor_id and c.id=a.command_id;
  if a.kind in ('update_member','remove_member') then
    return item || jsonb_build_object('subject',jsonb_build_object('name',(select name from private.profiles where id=(p->>'id')::uuid),'role',p->>'role'));
  elsif a.kind in ('invite','cancel_invite') then
    email := coalesce(p->>'contact',(select c.payload->>'contact' from private.commands c where c.kind='invite' and c.payload->>'id'=p->>'id' limit 1));
    return jsonb_set(item,'{subject,name}',to_jsonb(coalesce(private.invitee_name(email),p->>'name','Pessoa convidada')));
  end if;
  return item;
end $$;
revoke all on function private.activity_item(private.audit_events) from public, anon, authenticated;
