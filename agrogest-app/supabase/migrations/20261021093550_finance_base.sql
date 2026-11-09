-- Financeiro base (issue #46, fase 1): contas financeiras, plano de contas, fornecedores e
-- clientes, e baixas (pagamentos e recebimentos). Contas a pagar e a receber não ganham tabela:
-- são as parcelas dos lançamentos aprovados (despesa, nota revisada, venda), identificadas por
-- lançamento + índice. Despesas antigas com parcelas viram contas em aberto sem cópia.
-- A compra do lote vira conta a pagar quando o sócio informa o pagamento (`purchasePlan` no lote);
-- lotes antigos, sem plano, não viram conta sozinhos.
-- Só sócios veem e movimentam o financeiro. New AgroGest only. Never apply to the legacy/Noude database.

create table private.financial_accounts (
  id uuid primary key,
  operation_id uuid not null references private.operations(id),
  name text not null check (char_length(btrim(name)) between 1 and 100),
  kind text not null check (kind in ('corrente', 'poupanca', 'caixa', 'investimento')),
  bank text not null default '' check (char_length(bank) <= 60),
  agency text not null default '' check (char_length(agency) <= 60),
  number text not null default '' check (char_length(number) <= 60),
  -- Can be negative (overdraft). Same bound as the app's safe integers.
  opening_balance_cents bigint not null check (abs(opening_balance_cents) <= 9007199254740991),
  opening_date date not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (id, operation_id)
);
create unique index financial_accounts_name_idx on private.financial_accounts(operation_id, lower(btrim(name)));

create table private.categories (
  id uuid primary key,
  operation_id uuid not null references private.operations(id),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  nature text not null check (nature in ('custo_producao', 'despesa_administrativa', 'investimento', 'aquisicao_estoque',
    'receita_operacional', 'outra_receita', 'financiamento', 'movimentacao_socio', 'transferencia', 'imposto')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index categories_name_idx on private.categories(operation_id, lower(btrim(name)));

create table private.counterparties (
  id uuid primary key,
  operation_id uuid not null references private.operations(id),
  name text not null check (char_length(btrim(name)) between 1 and 150),
  kind text not null check (kind in ('fornecedor', 'cliente', 'ambos')),
  document text not null default '' check (char_length(document) <= 150),
  contact text not null default '' check (char_length(contact) <= 150),
  pix_key text not null default '' check (char_length(pix_key) <= 150),
  notes text not null default '' check (char_length(notes) <= 500),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index counterparties_operation_idx on private.counterparties(operation_id);

-- Nothing is deleted: a reversal or a dismissed conflict only changes the status.
create table private.payments (
  id uuid primary key,
  operation_id uuid not null references private.operations(id),
  direction text not null check (direction in ('pagar', 'receber')),
  account_id uuid not null,
  paid_at date not null,
  items jsonb not null check (jsonb_typeof(items) = 'array'),
  interest_cents bigint not null default 0 check (interest_cents >= 0),
  fine_cents bigint not null default 0 check (fine_cents >= 0),
  discount_cents bigint not null default 0 check (discount_cents >= 0),
  method text not null check (method in ('pix', 'boleto', 'transferencia', 'dinheiro', 'cheque', 'cartao', 'outro')),
  proof text not null default '' check (char_length(proof) <= 200),
  notes text not null default '' check (char_length(notes) <= 500),
  status text not null check (status in ('efetivado', 'conflito', 'estornado', 'descartado')),
  conflict_reason text,
  author_id uuid not null references private.profiles(id),
  created_at timestamptz not null default now(),
  reversed_by uuid references private.profiles(id),
  reversed_at timestamptz,
  reverse_reason text check (char_length(reverse_reason) <= 500),
  foreign key (account_id, operation_id) references private.financial_accounts(id, operation_id)
);
create index payments_operation_idx on private.payments(operation_id, status);
create index payments_account_operation_idx on private.payments(account_id, operation_id);
create index payments_author_idx on private.payments(author_id);
create index payments_reversed_by_idx on private.payments(reversed_by);

alter table private.financial_accounts enable row level security;
alter table private.categories enable row level security;
alter table private.counterparties enable row level security;
alter table private.payments enable row level security;
create policy financial_accounts_partners on private.financial_accounts for select to authenticated using (private.member_role(operation_id) = 'socio');
create policy categories_members on private.categories for select to authenticated using (private.member_role(operation_id) is not null);
create policy counterparties_partners on private.counterparties for select to authenticated using (private.member_role(operation_id) = 'socio');
create policy payments_partners on private.payments for select to authenticated using (private.member_role(operation_id) = 'socio');
revoke all on private.financial_accounts, private.categories, private.counterparties, private.payments from public, anon, authenticated;

-- Same list as DEFAULT_CATEGORIES in apps/mobile/src/domain/finance.ts (a test compares them).
create function private.default_categories() returns jsonb
language sql immutable set search_path = '' as $$
  select '[
    {"id":"cat-alimentacao","name":"Alimentação e insumos","nature":"custo_producao"},
    {"id":"cat-mao-de-obra","name":"Mão de obra","nature":"custo_producao"},
    {"id":"cat-medicamentos","name":"Medicamentos e vacinas","nature":"custo_producao"},
    {"id":"cat-cercas","name":"Manutenção de cercas","nature":"custo_producao"},
    {"id":"cat-pastagem","name":"Pastagem","nature":"custo_producao"},
    {"id":"cat-combustivel","name":"Combustível","nature":"custo_producao"},
    {"id":"cat-frete","name":"Frete","nature":"custo_producao"},
    {"id":"cat-estoque","name":"Compra de insumos para estoque","nature":"aquisicao_estoque"},
    {"id":"cat-animais","name":"Compra de animais","nature":"investimento"},
    {"id":"cat-administrativas","name":"Despesas administrativas","nature":"despesa_administrativa"},
    {"id":"cat-impostos","name":"Impostos e taxas","nature":"imposto"},
    {"id":"cat-investimentos","name":"Máquinas, benfeitorias e equipamentos","nature":"investimento"},
    {"id":"cat-outros","name":"Outros","nature":"despesa_administrativa"},
    {"id":"cat-venda-animais","name":"Venda de animais","nature":"receita_operacional"},
    {"id":"cat-outras-receitas","name":"Outras receitas","nature":"outra_receita"}
  ]'::jsonb
$$;
revoke all on function private.default_categories() from public, anon, authenticated;

-- Signed integer cents (the foundation helper only accepts non-negative values).
create function private.signed_cents(p_value jsonb) returns bigint
language plpgsql immutable security invoker set search_path = '' as $$
declare n numeric;
begin
  if p_value is null or jsonb_typeof(p_value) <> 'number' then raise exception 'Valor em centavos inválido.'; end if;
  n := p_value::text::numeric;
  if abs(n) > 9007199254740991 or trunc(n) <> n then raise exception 'Valor em centavos inválido.'; end if;
  return n::bigint;
end $$;
revoke all on function private.signed_cents(jsonb) from public, anon, authenticated;

create function private.valid_iso_date(p_value text) returns boolean
language plpgsql immutable set search_path = '' as $$
begin
  if p_value is null or p_value !~ '^\d{4}-\d{2}-\d{2}$' then return false; end if;
  perform p_value::date;
  return true;
exception when others then return false;
end $$;
revoke all on function private.valid_iso_date(text) from public, anon, authenticated;

-- "R$ 1.234,56", like formatCents in the app, for conflict reasons.
create function private.brl(p_cents bigint) returns text
language sql immutable set search_path = '' as $$
  select 'R$ ' || translate(to_char(p_cents / 100.0, 'FM999,999,999,999,990.00'), ',.', '.,')
$$;
revoke all on function private.brl(bigint) from public, anon, authenticated;

create function private.sao_paulo_today() returns date
language sql stable set search_path = '' as $$ select (clock_timestamp() at time zone 'America/Sao_Paulo')::date $$;
revoke all on function private.sao_paulo_today() from public, anon, authenticated;

-- Installment `p_index` of an approved obligation, like `obligations` in the app. Old sales without
-- installments receive the net amount (gross by the arroba minus deductions) on the sale date.
create function private.installment_cents(p_kind text, p_data jsonb, p_index int) returns bigint
language sql immutable set search_path = '' as $$
  select case
    when p_kind = 'despesa' or (p_kind = 'nota_fiscal' and p_data->'payload'->>'stage' = 'revisada')
      then (p_data->'payload'->'installments'->p_index->>'cents')::bigint
    when p_kind = 'venda' and jsonb_typeof(p_data->'payload'->'installments') = 'array'
      and jsonb_array_length(p_data->'payload'->'installments') > 0
      then (p_data->'payload'->'installments'->p_index->>'cents')::bigint
    when p_kind = 'venda' and p_index = 0 then nullif(greatest(
      round((p_data->'payload'->>'carcassKg')::numeric * (p_data->'payload'->>'pricePerArrobaCents')::numeric / 15)::bigint
        - (p_data->'payload'->>'deductionsCents')::bigint, 0), 0)
  end
$$;
revoke all on function private.installment_cents(text, jsonb, int) from public, anon, authenticated;

-- Installment `p_index` of a lot purchase plan, in the fixed order of `planInstallments` in the app:
-- animals, commission, freight, and the installments of each.
create function private.lot_installment_cents(p_data jsonb, p_index int) returns bigint
language sql immutable set search_path = '' as $$
  select (i.value->>'cents')::bigint
  from jsonb_array_elements(coalesce(p_data->'purchasePlan'->'parts', '[]'::jsonb)) with ordinality as part(value, ord)
  cross join lateral jsonb_array_elements(part.value->'installments') with ordinality as i(value, ord)
  order by array_position(array['animais', 'comissao', 'frete'], part.value->>'kind'), i.ord
  offset p_index limit 1
$$;
revoke all on function private.lot_installment_cents(jsonb, int) from public, anon, authenticated;

-- The plan closes each part of the lot cost (purchase, commission, freight), like `purchasePlanError`.
create function private.validate_purchase_plan(p_lot jsonb, p_plan jsonb, p_operation uuid) returns void
language plpgsql stable security definer set search_path = '' as $$
declare part jsonb; item jsonb; kind text; owed bigint; total bigint;
begin
  if jsonb_typeof(p_plan) is distinct from 'object' or jsonb_typeof(p_plan->'parts') is distinct from 'array' then raise exception 'Pagamento da compra inválido.'; end if;
  if (select count(*) <> count(distinct value->>'kind') from jsonb_array_elements(p_plan->'parts')) then raise exception 'Cada parte da compra aparece uma vez só.'; end if;
  foreach kind in array array['animais', 'comissao', 'frete'] loop
    owed := (p_lot->>(case kind when 'animais' then 'purchaseCents' when 'comissao' then 'commissionCents' else 'freightCents' end))::bigint;
    select value into part from jsonb_array_elements(p_plan->'parts') where value->>'kind' = kind;
    if owed > 0 and part is null then raise exception 'Informe o pagamento de todas as partes da compra.'; end if;
    if owed = 0 and part is not null then raise exception 'Uma parte sem valor no lote não tem pagamento.'; end if;
    if part is null then continue; end if;
    if jsonb_typeof(part->'installments') is distinct from 'array' or jsonb_array_length(part->'installments') not between 1 and 60
      then raise exception 'Use de 1 a 60 parcelas em cada parte da compra.'; end if;
    if char_length(coalesce(part->>'counterparty', '')) > 150 then raise exception 'Use até 150 caracteres no nome.'; end if;
    if nullif(part->>'counterpartyId', '') is not null and not exists(
      select 1 from private.counterparties c where c.id::text = part->>'counterpartyId' and c.operation_id = p_operation)
      then raise exception 'Fornecedor fora desta operação.'; end if;
    total := 0;
    for item in select value from jsonb_array_elements(part->'installments') loop
      if not private.valid_iso_date(item->>'dueDate') then raise exception 'Vencimento inválido.'; end if;
      if private.cents(item->'cents') = 0 then raise exception 'Parcela sem valor.'; end if;
      total := total + private.cents(item->'cents');
    end loop;
    if total <> owed then raise exception 'As parcelas precisam fechar o valor de cada parte da compra.'; end if;
    part := null;
  end loop;
  if exists(select 1 from jsonb_array_elements(p_plan->'parts') where value->>'kind' not in ('animais', 'comissao', 'frete'))
    then raise exception 'Parte da compra inválida.'; end if;
end $$;
revoke all on function private.validate_purchase_plan(jsonb, jsonb, uuid) from public, anon, authenticated;

create function private.lot_has_payments(p_operation uuid, p_lot text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from private.payments p cross join lateral jsonb_array_elements(p.items) i
    where p.operation_id = p_operation and p.status = 'efetivado' and i->>'entryId' = p_lot)
$$;
revoke all on function private.lot_has_payments(uuid, text) from public, anon, authenticated;

create function private.settled_cents(p_operation uuid, p_entry text, p_index int) returns bigint
language sql stable security definer set search_path = '' as $$
  select coalesce(sum((i->>'cents')::bigint), 0) from private.payments p cross join lateral jsonb_array_elements(p.items) i
  where p.operation_id = p_operation and p.status = 'efetivado' and i->>'entryId' = p_entry and (i->>'index')::int = p_index
$$;
revoke all on function private.settled_cents(uuid, text, int) from public, anon, authenticated;

create function private.account_json(a private.financial_accounts) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object('id', a.id, 'operationId', a.operation_id, 'name', a.name, 'kind', a.kind, 'bank', a.bank,
    'agency', a.agency, 'number', a.number, 'openingBalanceCents', a.opening_balance_cents,
    'openingDate', to_char(a.opening_date, 'YYYY-MM-DD'), 'active', a.active, 'createdAt', a.created_at)
$$;
revoke all on function private.account_json(private.financial_accounts) from public, anon, authenticated;

create function private.category_json(c private.categories) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object('id', c.id, 'operationId', c.operation_id, 'name', c.name, 'nature', c.nature, 'active', c.active)
$$;
revoke all on function private.category_json(private.categories) from public, anon, authenticated;

create function private.counterparty_json(c private.counterparties) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object('id', c.id, 'operationId', c.operation_id, 'name', c.name, 'kind', c.kind, 'document', c.document,
    'contact', c.contact, 'pixKey', c.pix_key, 'notes', c.notes, 'active', c.active, 'createdAt', c.created_at)
$$;
revoke all on function private.counterparty_json(private.counterparties) from public, anon, authenticated;

create function private.payment_json(p private.payments) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object('id', p.id, 'operationId', p.operation_id, 'direction', p.direction, 'accountId', p.account_id,
    'paidAt', to_char(p.paid_at, 'YYYY-MM-DD'), 'items', p.items, 'interestCents', p.interest_cents, 'fineCents', p.fine_cents,
    'discountCents', p.discount_cents, 'method', p.method, 'proof', p.proof, 'notes', p.notes, 'status', p.status,
    'conflictReason', p.conflict_reason, 'authorId', p.author_id, 'createdAt', p.created_at, 'reversedBy', p.reversed_by,
    'reversedAt', p.reversed_at, 'reverseReason', p.reverse_reason)
$$;
revoke all on function private.payment_json(private.payments) from public, anon, authenticated;

-- Expenses point to a category of the plan and to a registered supplier; sales may be received in
-- installments that close the net amount. The previous validation runs first, unchanged.
alter function private.validate_entry(jsonb,uuid,uuid) rename to validate_entry_before_finance;
revoke all on function private.validate_entry_before_finance(jsonb,uuid,uuid) from public, anon, authenticated;
create function private.validate_entry(p_data jsonb, p_operation uuid, p_farm uuid) returns void
language plpgsql security invoker set search_path = '' as $$
declare k text := p_data->>'kind'; p jsonb := p_data->'payload'; item jsonb; total bigint; net bigint;
begin
  perform private.validate_entry_before_finance(p_data, p_operation, p_farm);
  if k = 'despesa' and nullif(p->>'categoryId', '') is not null
    and not exists(select 1 from jsonb_array_elements(private.default_categories()) d where d->>'id' = p->>'categoryId')
    and not exists(select 1 from private.categories c where c.id::text = p->>'categoryId' and c.operation_id = p_operation)
    then raise exception 'Categoria fora do plano de contas desta operação.'; end if;
  if k in ('despesa', 'venda') and nullif(p->>'counterpartyId', '') is not null
    and not exists(select 1 from private.counterparties c where c.id::text = p->>'counterpartyId' and c.operation_id = p_operation)
    then raise exception 'Fornecedor ou cliente fora desta operação.'; end if;
  if k = 'venda' and jsonb_typeof(p->'installments') = 'array' and jsonb_array_length(p->'installments') > 0 then
    if jsonb_array_length(p->'installments') > 60 then raise exception 'Use até 60 parcelas.'; end if;
    total := 0;
    for item in select value from jsonb_array_elements(p->'installments') loop
      if not private.valid_iso_date(item->>'dueDate') then raise exception 'Vencimento inválido.'; end if;
      total := total + private.cents(item->'cents');
    end loop;
    net := round((p->>'carcassKg')::numeric * (p->>'pricePerArrobaCents')::numeric / 15)::bigint - private.cents(p->'deductionsCents');
    if total <> net then raise exception 'As parcelas do recebimento precisam fechar o valor líquido da venda.'; end if;
  end if;
end $$;
revoke all on function private.validate_entry(jsonb,uuid,uuid) from public, anon, authenticated;

alter function private.command(uuid,text,jsonb) rename to command_before_finance;
revoke all on function private.command_before_finance(uuid,text,jsonb) from public, anon, authenticated;
create function private.command(p_id uuid, p_kind text, p_payload jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid; op uuid; target uuid; previous private.commands%rowtype; outcome jsonb;
  acc private.financial_accounts%rowtype; pay private.payments%rowtype; cp private.counterparties%rowtype; cat private.categories%rowtype;
  item jsonb; e private.entries%rowtype; reason text; owed bigint; open_cents bigint; idx int; total bigint; t text;
  fields jsonb; first_payment date; lot_row private.lots%rowtype; title text;
begin
  -- The lot purchase plan is set by its own command; create_lot and update_lot never write it.
  if p_kind = 'create_lot' and p_payload ? 'purchasePlan' then raise exception 'Informe o pagamento da compra depois de cadastrar o lote.'; end if;
  if p_kind = 'update_lot' then
    select * into lot_row from private.lots l where l.id = (p_payload->>'id')::uuid and l.operation_id = (p_payload->>'operationId')::uuid;
    -- Changing the purchase values drops the plan, which no longer closes; refused once something was paid.
    if found and lot_row.data ? 'purchasePlan' and not exists(select 1 from private.commands c where c.user_id = (select auth.uid()) and c.id = p_id)
      and (lot_row.data->'purchaseCents', lot_row.data->'commissionCents', lot_row.data->'freightCents')
        is distinct from (p_payload->'purchaseCents', p_payload->'commissionCents', p_payload->'freightCents') then
      if private.lot_has_payments(lot_row.operation_id, lot_row.id::text) then
        raise exception 'A compra deste lote já tem pagamentos. Estorne-os antes de mudar os valores da compra.';
      end if;
      outcome := private.command_before_finance(p_id, p_kind, p_payload);
      update private.lots l set data = l.data - 'purchasePlan' where l.id = lot_row.id returning data into outcome;
      update private.commands c set result = outcome where c.user_id = (select auth.uid()) and c.id = p_id;
      return outcome;
    end if;
  end if;
  if p_kind is null or p_kind not in ('create_account','update_account','create_category','save_counterparty','register_payment','reverse_payment',
    'set_lot_payment_plan') then
    return private.command_before_finance(p_id, p_kind, p_payload);
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
  -- The operation lock serializes every payment against the same installments (two devices).
  perform 1 from private.operations where id = op for update;
  if private.member_role(op) is null then raise exception 'Sem acesso a esta operação.' using errcode = '42501'; end if;
  if private.member_role(op) <> 'socio' then raise exception 'O financeiro é exclusivo dos sócios da operação.' using errcode = '42501'; end if;

  if p_kind in ('create_account', 'update_account') then
    if nullif(btrim(p_payload->>'name'), '') is null or char_length(btrim(p_payload->>'name')) > 100 then raise exception 'Dê um nome à conta (até 100 caracteres).'; end if;
    if p_payload->>'kind' is null or p_payload->>'kind' not in ('corrente','poupanca','caixa','investimento') then raise exception 'Tipo de conta inválido.'; end if;
    if not private.valid_iso_date(p_payload->>'openingDate') then raise exception 'Informe a data do saldo inicial.'; end if;
    perform private.signed_cents(p_payload->'openingBalanceCents');
    if jsonb_typeof(p_payload->'active') is distinct from 'boolean' then raise exception 'Situação da conta inválida.'; end if;
    if exists(select 1 from private.financial_accounts a where a.operation_id = op and a.id <> target
      and lower(btrim(a.name)) = lower(btrim(p_payload->>'name'))) then raise exception 'Já existe uma conta com este nome.'; end if;
    if p_kind = 'create_account' then
      insert into private.financial_accounts(id, operation_id, name, kind, bank, agency, number, opening_balance_cents, opening_date, active)
        values (target, op, btrim(p_payload->>'name'), p_payload->>'kind', btrim(coalesce(p_payload->>'bank', '')), btrim(coalesce(p_payload->>'agency', '')),
          btrim(coalesce(p_payload->>'number', '')), private.signed_cents(p_payload->'openingBalanceCents'), (p_payload->>'openingDate')::date,
          (p_payload->>'active')::boolean)
        returning * into acc;
    else
      select * into acc from private.financial_accounts a where a.id = target and a.operation_id = op for update;
      if not found then raise exception 'Conta não encontrada.'; end if;
      fields := private.account_json(acc) - 'id' - 'operationId' - 'createdAt';
      if p_payload->'previous' is null or fields <> p_payload->'previous' then raise exception 'A conta mudou em outro aparelho. Sincronize antes de editar.'; end if;
      select min(paid_at) into first_payment from private.payments p where p.account_id = target and p.status = 'efetivado';
      if first_payment is not null and (p_payload->>'openingDate')::date > first_payment
        then raise exception 'Já há baixas antes desta data. O saldo inicial precisa ser anterior a elas.'; end if;
      update private.financial_accounts a set name = btrim(p_payload->>'name'), kind = p_payload->>'kind', bank = btrim(coalesce(p_payload->>'bank', '')),
        agency = btrim(coalesce(p_payload->>'agency', '')), number = btrim(coalesce(p_payload->>'number', '')),
        opening_balance_cents = private.signed_cents(p_payload->'openingBalanceCents'), opening_date = (p_payload->>'openingDate')::date,
        active = (p_payload->>'active')::boolean
        where a.id = target returning * into acc;
    end if;
    outcome := private.account_json(acc);

  elsif p_kind = 'create_category' then
    t := btrim(regexp_replace(coalesce(p_payload->>'name', ''), '\s+', ' ', 'g'));
    if t = '' or char_length(t) > 80 then raise exception 'Dê um nome à categoria (até 80 caracteres).'; end if;
    if exists(select 1 from jsonb_array_elements(private.default_categories()) d where lower(d->>'name') = lower(t))
      or exists(select 1 from private.categories c where c.operation_id = op and lower(btrim(c.name)) = lower(t))
      then raise exception 'Já existe uma categoria com este nome.'; end if;
    if p_payload->>'nature' is null or p_payload->>'nature' not in ('custo_producao','despesa_administrativa','investimento','aquisicao_estoque',
      'receita_operacional','outra_receita','financiamento','movimentacao_socio','transferencia','imposto') then raise exception 'Natureza inválida.'; end if;
    insert into private.categories(id, operation_id, name, nature) values (target, op, t, p_payload->>'nature') returning * into cat;
    outcome := private.category_json(cat);

  elsif p_kind = 'save_counterparty' then
    t := btrim(regexp_replace(coalesce(p_payload->>'name', ''), '\s+', ' ', 'g'));
    if t = '' or char_length(t) > 150 then raise exception 'Informe o nome (até 150 caracteres).'; end if;
    if p_payload->>'kind' is null or p_payload->>'kind' not in ('fornecedor','cliente','ambos') then raise exception 'Tipo de contato inválido.'; end if;
    if jsonb_typeof(p_payload->'active') is distinct from 'boolean' then raise exception 'Situação do contato inválida.'; end if;
    select * into cp from private.counterparties c where c.id = target for update;
    if found and cp.operation_id <> op then raise exception 'Contato de outra operação.' using errcode = '42501'; end if;
    insert into private.counterparties(id, operation_id, name, kind, document, contact, pix_key, notes, active)
      values (target, op, t, p_payload->>'kind', btrim(coalesce(p_payload->>'document', '')), btrim(coalesce(p_payload->>'contact', '')),
        btrim(coalesce(p_payload->>'pixKey', '')), btrim(coalesce(p_payload->>'notes', '')), (p_payload->>'active')::boolean)
      on conflict (id) do update set name = excluded.name, kind = excluded.kind, document = excluded.document, contact = excluded.contact,
        pix_key = excluded.pix_key, notes = excluded.notes, active = excluded.active
      returning * into cp;
    outcome := private.counterparty_json(cp);

  elsif p_kind = 'set_lot_payment_plan' then
    select * into lot_row from private.lots l where l.id = target and l.operation_id = op for update;
    if not found then raise exception 'Lote não encontrado.'; end if;
    if not (p_payload ? 'plan') or not (p_payload ? 'previous') then raise exception 'Pagamento da compra inválido.'; end if;
    if coalesce(lot_row.data->'purchasePlan', 'null'::jsonb) is distinct from p_payload->'previous'
      then raise exception 'O pagamento da compra mudou em outro aparelho. Sincronize antes de editar.'; end if;
    if lot_row.data ? 'purchasePlan' and private.lot_has_payments(op, target::text)
      then raise exception 'A compra deste lote já tem pagamentos. Estorne-os antes de mudar as parcelas.'; end if;
    if jsonb_typeof(p_payload->'plan') = 'null' then
      update private.lots l set data = l.data - 'purchasePlan' where l.id = target returning data into outcome;
    else
      perform private.validate_purchase_plan(lot_row.data, p_payload->'plan', op);
      update private.lots l set data = l.data || jsonb_build_object('purchasePlan', p_payload->'plan') where l.id = target returning data into outcome;
    end if;

  elsif p_kind = 'register_payment' then
    if p_payload->>'direction' is null or p_payload->>'direction' not in ('pagar','receber') then raise exception 'Baixa inválida.'; end if;
    if p_payload->>'method' is null or p_payload->>'method' not in ('pix','boleto','transferencia','dinheiro','cheque','cartao','outro') then raise exception 'Forma de pagamento inválida.'; end if;
    if not private.valid_iso_date(p_payload->>'paidAt') then raise exception 'Data do pagamento inválida.'; end if;
    if (p_payload->>'paidAt')::date > private.sao_paulo_today() then raise exception 'A data do pagamento não pode ser futura.'; end if;
    if jsonb_typeof(p_payload->'items') is distinct from 'array' or jsonb_array_length(p_payload->'items') not between 1 and 100
      then raise exception 'Escolha de 1 a 100 parcelas.'; end if;
    if (select count(*) <> count(distinct (value->>'entryId') || ':' || (value->>'index')) from jsonb_array_elements(p_payload->'items'))
      then raise exception 'A mesma parcela aparece duas vezes.'; end if;
    if char_length(coalesce(p_payload->>'proof', '')) > 200 or char_length(coalesce(p_payload->>'notes', '')) > 500
      then raise exception 'Comprovante até 200 e observação até 500 caracteres.'; end if;
    total := private.cents(p_payload->'interestCents') + private.cents(p_payload->'fineCents') - private.cents(p_payload->'discountCents');
    for item in select value from jsonb_array_elements(p_payload->'items') loop
      if jsonb_typeof(item->'index') is distinct from 'number' or (item->>'index')::numeric <> trunc((item->>'index')::numeric) or (item->>'index')::int < 0
        then raise exception 'Parcela inválida.'; end if;
      if private.cents(item->'cents') = 0 then raise exception 'Informe o valor de cada parcela.'; end if;
      total := total + private.cents(item->'cents');
    end loop;
    if total < 0 then raise exception 'O desconto não pode passar do valor pago.'; end if;
    select * into acc from private.financial_accounts a where a.id = (p_payload->>'accountId')::uuid and a.operation_id = op;
    if not found then raise exception 'Conta financeira fora desta operação.' using errcode = '42501'; end if;
    -- Facts that may have changed on another device become a conflict with the reason, without
    -- blocking the queue. Settlements only count against approved obligations and their open amount.
    reason := null;
    if not acc.active then reason := format('A conta %s foi inativada.', acc.name);
    elsif (p_payload->>'paidAt')::date < acc.opening_date then
      reason := format('A conta %s começa em %s.', acc.name, to_char(acc.opening_date, 'DD/MM/YYYY'));
    end if;
    if reason is null then
      for item in select value from jsonb_array_elements(p_payload->'items') loop
        idx := (item->>'index')::int;
        select * into e from private.entries x where x.id::text = item->>'entryId' and x.operation_id = op;
        if found then
          if e.status <> 'aprovado' then reason := format('"%s" ainda não foi aprovada. A baixa só vale para conta aprovada.', e.data->>'title'); exit; end if;
          if (p_payload->>'direction' = 'pagar') <> (e.kind in ('despesa','nota_fiscal')) or (p_payload->>'direction' = 'receber') <> (e.kind = 'venda')
            then reason := 'Parcela não encontrada.'; exit; end if;
          owed := private.installment_cents(e.kind, e.data, idx);
          title := format('parcela %s de "%s"', idx + 1, e.data->>'title');
        else
          -- The lot purchase: payable once its plan was informed.
          select * into lot_row from private.lots l where l.id::text = item->>'entryId' and l.operation_id = op;
          if not found then reason := 'A conta não pertence a esta operação.'; exit; end if;
          if p_payload->>'direction' <> 'pagar' then reason := 'Parcela não encontrada.'; exit; end if;
          owed := private.lot_installment_cents(lot_row.data, idx);
          title := format('compra da Origem %s', lot_row.data->>'code');
        end if;
        if owed is null then reason := 'Parcela não encontrada.'; exit; end if;
        open_cents := owed - private.settled_cents(op, item->>'entryId', idx);
        if private.cents(item->'cents') > open_cents then
          reason := case when open_cents <= 0
            then format('A %s já foi quitada, talvez em outro aparelho.', title)
            else format('A %s tem %s em aberto; a baixa pede %s.', title, private.brl(open_cents), private.brl(private.cents(item->'cents'))) end;
          exit;
        end if;
      end loop;
    end if;
    insert into private.payments(id, operation_id, direction, account_id, paid_at, items, interest_cents, fine_cents, discount_cents,
        method, proof, notes, status, conflict_reason, author_id)
      values (target, op, p_payload->>'direction', acc.id, (p_payload->>'paidAt')::date,
        (select jsonb_agg(jsonb_build_object('entryId', value->>'entryId', 'index', (value->>'index')::int, 'cents', private.cents(value->'cents'))) from jsonb_array_elements(p_payload->'items')),
        private.cents(p_payload->'interestCents'), private.cents(p_payload->'fineCents'), private.cents(p_payload->'discountCents'),
        p_payload->>'method', btrim(coalesce(p_payload->>'proof', '')), btrim(coalesce(p_payload->>'notes', '')),
        case when reason is null then 'efetivado' else 'conflito' end, reason, uid)
      returning * into pay;
    outcome := private.payment_json(pay);

  else -- reverse_payment
    select * into pay from private.payments p where p.id = target and p.operation_id = op for update;
    if not found then raise exception 'Baixa não encontrada.'; end if;
    if pay.status not in ('efetivado', 'conflito') then raise exception 'Esta baixa não pode mais ser estornada.'; end if;
    if pay.status = 'efetivado' and nullif(btrim(p_payload->>'reason'), '') is null then raise exception 'Informe o motivo do estorno.'; end if;
    if char_length(coalesce(p_payload->>'reason', '')) > 500 then raise exception 'Use até 500 caracteres no motivo.'; end if;
    update private.payments p set status = case when pay.status = 'efetivado' then 'estornado' else 'descartado' end,
      reversed_by = uid, reversed_at = clock_timestamp(), reverse_reason = nullif(btrim(p_payload->>'reason'), '')
      where p.id = target returning * into pay;
    outcome := private.payment_json(pay);
  end if;
  insert into private.commands(user_id,id,kind,payload,result) values(uid,p_id,p_kind,p_payload,outcome);
  insert into private.audit_events(operation_id,actor_id,command_id,kind) values(op,uid,p_id,p_kind);
  return outcome;
end $$;
revoke all on function private.command(uuid,text,jsonb) from public, anon;
grant execute on function private.command(uuid,text,jsonb) to authenticated;

-- Partners receive the finance registry and the payments; every member receives the custom
-- categories (names only). Employees never see accounts, contacts or payments.
alter function private.workspace() rename to workspace_before_finance;
revoke all on function private.workspace_before_finance() from public, anon, authenticated;
create function private.workspace() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare w jsonb;
begin
  w := private.workspace_before_finance();
  -- The purchase plan carries values: employees receive the lot without it.
  w := jsonb_set(w, '{lots}', coalesce((select jsonb_agg(case when private.member_role((l->>'operationId')::uuid) = 'socio' then l else l - 'purchasePlan' end)
    from jsonb_array_elements(coalesce(w->'lots', '[]'::jsonb)) l), '[]'::jsonb));
  return w || jsonb_build_object(
    'financialAccounts', coalesce((select jsonb_agg(private.account_json(a) order by a.name) from private.financial_accounts a
      where private.member_role(a.operation_id) = 'socio'), '[]'::jsonb),
    'categories', coalesce((select jsonb_agg(private.category_json(c) order by c.name) from private.categories c
      where private.member_role(c.operation_id) is not null), '[]'::jsonb),
    'counterparties', coalesce((select jsonb_agg(private.counterparty_json(c) order by c.name) from private.counterparties c
      where private.member_role(c.operation_id) = 'socio'), '[]'::jsonb),
    'payments', coalesce((select jsonb_agg(private.payment_json(p) order by p.paid_at desc, p.created_at desc) from private.payments p
      where private.member_role(p.operation_id) = 'socio'), '[]'::jsonb));
end $$;
revoke all on function private.workspace() from public, anon;
grant execute on function private.workspace() to authenticated;

-- Activity: registry names and how many installments a payment settled, never amounts. The
-- employee filter (`private.activity_visible`) already leaves these partner-only actions out.
alter function private.activity_item(private.audit_events) rename to activity_item_before_finance;
revoke all on function private.activity_item_before_finance(private.audit_events) from public, anon, authenticated;
create function private.activity_item(a private.audit_events) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare c private.commands%rowtype; item jsonb; s jsonb; pay private.payments%rowtype;
begin
  item := private.activity_item_before_finance(a);
  if a.kind not in ('create_account','update_account','create_category','save_counterparty','register_payment','reverse_payment',
    'set_lot_payment_plan') then
    return item;
  end if;
  select * into c from private.commands where user_id = a.actor_id and id = a.command_id;
  if a.kind = 'set_lot_payment_plan' then
    return item || jsonb_build_object('farmId', c.result->>'farmId',
      'subject', jsonb_strip_nulls(jsonb_build_object('lotId', c.payload->>'id', 'code', coalesce((select l.data->>'code' from private.lots l where l.id::text = c.payload->>'id'), c.result->>'code'), 'cleared', jsonb_typeof(c.payload->'plan') = 'null')));
  end if;
  if a.kind in ('register_payment', 'reverse_payment') then
    select * into pay from private.payments p where p.id::text = c.payload->>'id';
    s := jsonb_build_object('paymentDirection', pay.direction, 'count', jsonb_array_length(coalesce(pay.items, '[]'::jsonb)));
    if a.kind = 'reverse_payment' then s := s || jsonb_build_object('reversed', c.result->>'status' = 'estornado'); end if;
  else
    s := jsonb_build_object('name', coalesce(c.result->>'name', c.payload->>'name'));
  end if;
  return item || jsonb_build_object('subject', jsonb_strip_nulls(s));
end $$;
revoke all on function private.activity_item(private.audit_events) from public, anon, authenticated;
