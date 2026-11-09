-- Independent managerial classification. No financial entry/payment is rewritten.
create table private.cost_centers (
 id uuid primary key, operation_id uuid not null references private.operations(id),
 data jsonb not null
);
create unique index cost_center_name on private.cost_centers(operation_id, lower(data->>'name'));
create table private.cost_classifications (
 id uuid primary key references private.entries(id), operation_id uuid not null references private.operations(id),
 data jsonb not null
);
create index cost_classifications_operation_idx on private.cost_classifications(operation_id);
alter table private.cost_centers enable row level security;
alter table private.cost_classifications enable row level security;
revoke all on private.cost_centers, private.cost_classifications from public, anon, authenticated;

create function private.check_cost_center(op uuid, center_id text) returns void
language plpgsql stable security definer set search_path = '' as $$
declare c private.cost_centers%rowtype;
begin
 if nullif(center_id, '') is null then return; end if;
 select * into c from private.cost_centers where id = center_id::uuid and operation_id = op;
 if not found or (c.data->>'isGroup')::boolean then raise exception 'Escolha um centro de custo desta operação.'; end if;
 if not (c.data->>'active')::boolean or (c.data->>'parentId' is not null and not exists (
   select 1 from private.cost_centers g where g.id = (c.data->>'parentId')::uuid and g.operation_id = op and (g.data->>'active')::boolean
 )) then raise exception 'Centro de custo ou agrupamento inativo.'; end if;
end $$;
revoke all on function private.check_cost_center(uuid,text) from public, anon, authenticated;

alter function private.command(uuid,text,jsonb) rename to command_before_cost_centers;
revoke all on function private.command_before_cost_centers(uuid,text,jsonb) from public, anon, authenticated;
create function private.command(p_id uuid, p_kind text, p_payload jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid; op uuid; target uuid; previous private.commands%rowtype; old jsonb; doc jsonb; outcome jsonb;
 center uuid; parent uuid; e private.entries%rowtype; old_center text; t text;
begin
 if p_kind is null or p_kind not in ('save_cost_center','classify_cost','save_entry','save_recurrence') then
   return private.command_before_cost_centers(p_id,p_kind,p_payload);
 end if;
 uid := private.ensure_profile();
 if p_id is null or jsonb_typeof(p_payload) is distinct from 'object' or octet_length(p_payload::text) > 262144 then raise exception 'Comando inválido.'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(uid::text || p_id::text,0));
 select * into previous from private.commands where user_id = uid and id = p_id;
 if found then
   if previous.kind <> p_kind or previous.payload <> p_payload then raise exception 'Identificador de comando reutilizado com outros dados.'; end if;
   return previous.result;
 end if;
 op := (p_payload->>'operationId')::uuid; target := (p_payload->>'id')::uuid;
 if op is null or target is null then raise exception 'Operação inválida.'; end if;
 perform 1 from private.operations where id = op for update;
 if private.member_role(op) is null then raise exception 'Sem acesso a esta operação.' using errcode = '42501'; end if;
 if p_kind in ('save_cost_center','classify_cost','save_recurrence') and private.member_role(op) <> 'socio' then
   raise exception 'O financeiro é exclusivo dos sócios da operação.' using errcode = '42501';
 end if;
 if p_kind = 'save_entry' then
   if p_payload->'entry'->>'kind' in ('despesa','nota_fiscal') then
     perform private.check_cost_center(op, p_payload->'entry'->'payload'->>'costCenterId');
   end if;
   return private.command_before_cost_centers(p_id,p_kind,p_payload);
 elsif p_kind = 'save_recurrence' then
   perform private.check_cost_center(op,p_payload->>'costCenterId');
   outcome := private.command_before_cost_centers(p_id,p_kind,p_payload);
   if p_payload ? 'costCenterId' then
     update private.recurrences set data = data || jsonb_build_object('costCenterId',p_payload->'costCenterId') where id = target and operation_id = op;
     outcome := outcome || jsonb_build_object('costCenterId',p_payload->'costCenterId');
     update private.commands set result = outcome where user_id = uid and id = p_id;
   end if;
   return outcome;
 elsif p_kind = 'save_cost_center' then
   select data into old from private.cost_centers where id = target for update;
   if found then
     if old->>'operationId' <> op::text then raise exception 'Centro de outra operação.' using errcode='42501'; end if;
     if (old->>'version')::int is distinct from (p_payload->'previous'->>'version')::int then raise exception 'O centro mudou em outro aparelho. Sincronize antes de editar.'; end if;
     if old->'parentId' is distinct from coalesce(p_payload->'parentId','null'::jsonb) or old->'isGroup' is distinct from p_payload->'isGroup' then
       raise exception 'O agrupamento é fixo para preservar o histórico. Crie outro centro.';
     end if;
   elsif p_payload->'previous' is not null and p_payload->'previous' <> 'null'::jsonb then raise exception 'Centro não encontrado.';
   end if;
   t := regexp_replace(btrim(coalesce(p_payload->>'name','')), '\s+', ' ', 'g');
   if t = '' or char_length(t)>80 then raise exception 'Informe um nome com até 80 caracteres.'; end if;
   if jsonb_typeof(p_payload->'active') is distinct from 'boolean' or jsonb_typeof(p_payload->'isGroup') is distinct from 'boolean' then raise exception 'Situação inválida.'; end if;
   parent := (p_payload->>'parentId')::uuid;
   if parent is not null then
     if (p_payload->>'isGroup')::boolean or parent = target then raise exception 'Agrupamento inválido.'; end if;
     if not exists(select 1 from private.cost_centers g where g.id = parent and g.operation_id = op and (g.data->>'isGroup')::boolean
        and ((g.data->>'active')::boolean or old->>'parentId' = parent::text)) then raise exception 'Escolha um agrupamento ativo desta operação.'; end if;
   end if;
   doc := jsonb_build_object('version',coalesce((old->>'version')::int,0)+1,'id',target,'operationId',op,'name',t,'parentId',parent,'isGroup',p_payload->'isGroup','active',p_payload->'active',
     'createdAt',coalesce(old->'createdAt',to_jsonb(now())));
   insert into private.cost_centers values(target,op,doc) on conflict(id) do update set data = excluded.data;
   outcome := doc;
 else
   select * into e from private.entries where id = target and operation_id = op for update;
   if not found or e.kind not in ('despesa','nota_fiscal') or e.status <> 'aprovado' then raise exception 'Escolha uma despesa aprovada desta operação.'; end if;
   perform private.check_cost_center(op,p_payload->>'costCenterId');
   t := btrim(coalesce(p_payload->>'reason',''));
   if t = '' or char_length(t)>500 then raise exception 'Informe o motivo (até 500 caracteres).'; end if;
   select data into old from private.cost_classifications where id = target for update;
   if coalesce((old->>'version')::int,0) is distinct from coalesce((p_payload->'previous'->>'version')::int,0) then raise exception 'A classificação mudou em outro aparelho. Sincronize antes de editar.'; end if;
   old_center := case when old is not null then old->>'costCenterId' else e.data->'payload'->>'costCenterId' end;
   center := (p_payload->>'costCenterId')::uuid;
   doc := jsonb_build_object('version',coalesce((old->>'version')::int,0)+1,'id',target,'operationId',op,'costCenterId',center,'history',coalesce(old->'history','[]'::jsonb) || jsonb_build_array(
     jsonb_build_object('at',now(),'by',uid,'from',old_center,'to',center,'reason',t)));
   insert into private.cost_classifications values(target,op,doc) on conflict(id) do update set data=excluded.data;
   outcome := doc;
 end if;
 insert into private.commands(user_id,id,kind,payload,result) values(uid,p_id,p_kind,p_payload,outcome);
 insert into private.audit_events(operation_id,actor_id,command_id,kind) values(op,uid,p_id,p_kind);
 return outcome;
end $$;
revoke all on function private.command(uuid,text,jsonb) from public, anon;
grant execute on function private.command(uuid,text,jsonb) to authenticated;

alter function private.workspace() rename to workspace_before_cost_centers;
revoke all on function private.workspace_before_cost_centers() from public,anon,authenticated;
create function private.workspace() returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
 return private.workspace_before_cost_centers() || jsonb_build_object(
  'costCenters', coalesce((select jsonb_agg(c.data order by c.data->>'name') from private.cost_centers c where private.member_role(c.operation_id)='socio'),'[]'::jsonb),
  'costClassifications', coalesce((select jsonb_agg(c.data order by c.id) from private.cost_classifications c where private.member_role(c.operation_id)='socio'),'[]'::jsonb));
end $$;
revoke all on function private.workspace() from public,anon;
grant execute on function private.workspace() to authenticated;
