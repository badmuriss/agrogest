-- Gestão financeira (issue #46, fases 2 e 3): cartão de crédito, movimentações entre contas e com
-- sócios (aporte, retirada, distribuição), despesa paga por sócio com dinheiro próprio (reembolso ou
-- aporte), adiantamento de cliente compensado no recebimento, financiamentos, renegociação e
-- cancelamento de parcelas, despesas recorrentes, outras receitas, orçamento e contas importadas da
-- planilha. Como na fase 1, contas a pagar e a receber não ganham tabela: cada origem gera as suas
-- parcelas (`private.obligation_info`), e as baixas continuam em `private.payments`.
-- Só sócios veem e movimentam o financeiro; funcionários não recebem nada disto.
-- New AgroGest only. Never apply to the legacy/Noude database.

-- Cartão de crédito: dívida, não caixa. A fatura fecha e vence em dias fixos.
alter table private.financial_accounts drop constraint financial_accounts_kind_check;
alter table private.financial_accounts add constraint financial_accounts_kind_check
  check (kind in ('corrente', 'poupanca', 'caixa', 'investimento', 'cartao'));
alter table private.financial_accounts
  add column closing_day smallint check (closing_day between 1 and 28),
  add column due_day smallint check (due_day between 1 and 28);
alter table private.financial_accounts add constraint financial_accounts_card_days
  check ((kind = 'cartao') = (closing_day is not null and due_day is not null));

create or replace function private.account_json(a private.financial_accounts) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object('id', a.id, 'operationId', a.operation_id, 'name', a.name, 'kind', a.kind, 'bank', a.bank,
    'agency', a.agency, 'number', a.number, 'openingBalanceCents', a.opening_balance_cents,
    'openingDate', to_char(a.opening_date, 'YYYY-MM-DD'), 'active', a.active, 'createdAt', a.created_at,
    'closingDay', a.closing_day, 'dueDay', a.due_day)
$$;
revoke all on function private.account_json(private.financial_accounts) from public, anon, authenticated;

-- Uma baixa sai de uma conta, do bolso de um sócio (reembolso ou aporte) ou compensa um adiantamento.
alter table private.payments alter column account_id drop not null;
alter table private.payments
  add column partner_id uuid references private.profiles(id),
  add column partner_mode text check (partner_mode in ('reembolso', 'aporte')),
  add column advance_id uuid;
alter table private.payments add constraint payments_one_source check (num_nonnulls(account_id, partner_id, advance_id) = 1);
alter table private.payments add constraint payments_partner_mode check ((partner_id is null) = (partner_mode is null));
create index payments_partner_idx on private.payments(partner_id);
create index payments_advance_idx on private.payments(advance_id);

create or replace function private.payment_json(p private.payments) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object('id', p.id, 'operationId', p.operation_id, 'direction', p.direction, 'accountId', p.account_id,
    'paidAt', to_char(p.paid_at, 'YYYY-MM-DD'), 'items', p.items, 'interestCents', p.interest_cents, 'fineCents', p.fine_cents,
    'discountCents', p.discount_cents, 'method', p.method, 'proof', p.proof, 'notes', p.notes, 'status', p.status,
    'conflictReason', p.conflict_reason, 'authorId', p.author_id, 'createdAt', p.created_at, 'reversedBy', p.reversed_by,
    'reversedAt', p.reversed_at, 'reverseReason', p.reverse_reason, 'partnerId', p.partner_id, 'partnerMode', p.partner_mode,
    'advanceId', p.advance_id)
$$;
revoke all on function private.payment_json(private.payments) from public, anon, authenticated;

-- Dinheiro que muda de lugar sem ser resultado. Nada é apagado: estorno e descarte mudam a situação.
create table private.movements (
  id uuid primary key,
  operation_id uuid not null references private.operations(id),
  kind text not null check (kind in ('transferencia', 'aporte', 'retirada', 'distribuicao', 'liberacao', 'adiantamento')),
  from_account_id uuid,
  to_account_id uuid,
  partner_id uuid references private.profiles(id),
  financing_id uuid,
  counterparty text not null default '' check (char_length(counterparty) <= 150),
  counterparty_id uuid,
  invoice_month text check (invoice_month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  cents bigint not null check (cents > 0 and cents <= 9007199254740991),
  occurred_at date not null,
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
  foreign key (from_account_id, operation_id) references private.financial_accounts(id, operation_id),
  foreign key (to_account_id, operation_id) references private.financial_accounts(id, operation_id)
);
create index movements_operation_idx on private.movements(operation_id, status);
create index movements_from_idx on private.movements(from_account_id, operation_id);
create index movements_to_idx on private.movements(to_account_id, operation_id);
create index movements_partner_idx on private.movements(partner_id);
create index movements_financing_idx on private.movements(financing_id);
create index movements_author_idx on private.movements(author_id);
create index movements_reversed_by_idx on private.movements(reversed_by);

-- Contrato de financiamento: os dados e o cronograma (principal + juros) ficam em `data`.
create table private.financings (
  id uuid primary key,
  operation_id uuid not null references private.operations(id),
  farm_id uuid not null,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  author_id uuid not null references private.profiles(id),
  created_at timestamptz not null default now(),
  foreign key (farm_id, operation_id) references private.farms(id, operation_id)
);
create index financings_operation_idx on private.financings(operation_id);
create index financings_farm_idx on private.financings(farm_id, operation_id);
create index financings_author_idx on private.financings(author_id);

-- Renegociação: encerra as parcelas originais no que estava quitado e cria as novas.
create table private.renegotiations (
  id uuid primary key,
  operation_id uuid not null references private.operations(id),
  direction text not null check (direction in ('pagar', 'receber')),
  items jsonb not null check (jsonb_typeof(items) = 'array'),
  installments jsonb not null check (jsonb_typeof(installments) = 'array'),
  reason text not null check (char_length(reason) between 1 and 500),
  status text not null check (status in ('efetivado', 'conflito', 'estornado', 'descartado')),
  conflict_reason text,
  author_id uuid not null references private.profiles(id),
  created_at timestamptz not null default now(),
  reversed_by uuid references private.profiles(id),
  reversed_at timestamptz,
  reverse_reason text check (char_length(reverse_reason) <= 500)
);
create index renegotiations_operation_idx on private.renegotiations(operation_id, status);
create index renegotiations_items_idx on private.renegotiations using gin (items);
create index renegotiations_author_idx on private.renegotiations(author_id);
create index renegotiations_reversed_by_idx on private.renegotiations(reversed_by);

-- Modelo da despesa recorrente; cada mês vira despesa quando alguém a lança.
create table private.recurrences (
  id uuid primary key,
  operation_id uuid not null references private.operations(id),
  farm_id uuid not null,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  created_at timestamptz not null default now(),
  foreign key (farm_id, operation_id) references private.farms(id, operation_id)
);
create index recurrences_operation_idx on private.recurrences(operation_id);
create index recurrences_farm_idx on private.recurrences(farm_id, operation_id);

create table private.budgets (
  id uuid primary key,
  operation_id uuid not null references private.operations(id),
  category_id text not null check (char_length(category_id) <= 80),
  month text not null check (month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  cents bigint not null check (cents >= 0 and cents <= 9007199254740991),
  unique (operation_id, category_id, month)
);

-- Contas a pagar e a receber trazidas da planilha (saldo de abertura, sem custo nem receita).
create table private.titles (
  id uuid primary key,
  operation_id uuid not null references private.operations(id),
  farm_id uuid not null,
  direction text not null check (direction in ('pagar', 'receber')),
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  import_key text not null check (char_length(import_key) between 1 and 300),
  author_id uuid not null references private.profiles(id),
  created_at timestamptz not null default now(),
  unique (operation_id, import_key),
  foreign key (farm_id, operation_id) references private.farms(id, operation_id)
);
create index titles_farm_idx on private.titles(farm_id, operation_id);
create index titles_author_idx on private.titles(author_id);

alter table private.movements enable row level security;
alter table private.financings enable row level security;
alter table private.renegotiations enable row level security;
alter table private.recurrences enable row level security;
alter table private.budgets enable row level security;
alter table private.titles enable row level security;
create policy movements_partners on private.movements for select to authenticated using (private.member_role(operation_id) = 'socio');
create policy financings_partners on private.financings for select to authenticated using (private.member_role(operation_id) = 'socio');
create policy renegotiations_partners on private.renegotiations for select to authenticated using (private.member_role(operation_id) = 'socio');
create policy recurrences_partners on private.recurrences for select to authenticated using (private.member_role(operation_id) = 'socio');
create policy budgets_partners on private.budgets for select to authenticated using (private.member_role(operation_id) = 'socio');
create policy titles_partners on private.titles for select to authenticated using (private.member_role(operation_id) = 'socio');
revoke all on private.movements, private.financings, private.renegotiations, private.recurrences, private.budgets, private.titles
  from public, anon, authenticated;

alter table private.entries drop constraint entries_kind_check;
alter table private.entries add constraint entries_kind_check check (kind in
  ('pesagem', 'despesa', 'mortalidade', 'venda', 'nota_fiscal', 'manejo', 'consumo', 'ajuste_estoque', 'transferencia_estoque', 'receita'));
create index entries_recurrence_idx on private.entries((data->'payload'->'recurrence'->>'id'), (data->'payload'->'recurrence'->>'month'))
  where kind = 'despesa' and data->'payload' ? 'recurrence';

create function private.movement_json(m private.movements) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object('id', m.id, 'operationId', m.operation_id, 'kind', m.kind, 'fromAccountId', m.from_account_id,
    'toAccountId', m.to_account_id, 'partnerId', m.partner_id, 'financingId', m.financing_id, 'counterparty', m.counterparty,
    'counterpartyId', m.counterparty_id, 'invoiceMonth', m.invoice_month, 'cents', m.cents, 'occurredAt', to_char(m.occurred_at, 'YYYY-MM-DD'),
    'method', m.method, 'proof', m.proof, 'notes', m.notes, 'status', m.status, 'conflictReason', m.conflict_reason,
    'authorId', m.author_id, 'createdAt', m.created_at, 'reversedBy', m.reversed_by, 'reversedAt', m.reversed_at, 'reverseReason', m.reverse_reason)
$$;
revoke all on function private.movement_json(private.movements) from public, anon, authenticated;

create function private.financing_json(f private.financings) returns jsonb
language sql stable set search_path = '' as $$
  select f.data || jsonb_build_object('id', f.id, 'operationId', f.operation_id, 'farmId', f.farm_id, 'authorId', f.author_id, 'createdAt', f.created_at)
$$;
revoke all on function private.financing_json(private.financings) from public, anon, authenticated;

create function private.renegotiation_json(r private.renegotiations) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object('id', r.id, 'operationId', r.operation_id, 'direction', r.direction, 'items', r.items,
    'installments', r.installments, 'reason', r.reason, 'status', r.status, 'conflictReason', r.conflict_reason,
    'authorId', r.author_id, 'createdAt', r.created_at, 'reversedBy', r.reversed_by, 'reversedAt', r.reversed_at, 'reverseReason', r.reverse_reason)
$$;
revoke all on function private.renegotiation_json(private.renegotiations) from public, anon, authenticated;

create function private.recurrence_json(r private.recurrences) returns jsonb
language sql stable set search_path = '' as $$
  select r.data || jsonb_build_object('id', r.id, 'operationId', r.operation_id, 'farmId', r.farm_id, 'createdAt', r.created_at)
$$;
revoke all on function private.recurrence_json(private.recurrences) from public, anon, authenticated;

create function private.budget_json(b private.budgets) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object('id', b.id, 'operationId', b.operation_id, 'categoryId', b.category_id, 'month', b.month, 'cents', b.cents)
$$;
revoke all on function private.budget_json(private.budgets) from public, anon, authenticated;

create function private.title_json(t private.titles) returns jsonb
language sql stable set search_path = '' as $$
  select t.data || jsonb_build_object('id', t.id, 'operationId', t.operation_id, 'farmId', t.farm_id, 'direction', t.direction,
    'importKey', t.import_key, 'authorId', t.author_id, 'createdAt', t.created_at)
$$;
revoke all on function private.title_json(private.titles) from public, anon, authenticated;

-- Parcelas de 1 a 60 com data válida e valor; devolve a soma, ou erro.
create function private.installments_total(p_list jsonb, p_max int) returns bigint
language plpgsql immutable set search_path = '' as $$
declare item jsonb; total bigint := 0;
begin
  if jsonb_typeof(p_list) is distinct from 'array' or jsonb_array_length(p_list) > p_max then raise exception 'Use até % parcelas.', p_max; end if;
  for item in select value from jsonb_array_elements(p_list) loop
    if not private.valid_iso_date(item->>'dueDate') then raise exception 'Vencimento inválido.'; end if;
    if private.cents(item->'cents') = 0 then raise exception 'Parcela sem valor.'; end if;
    total := total + private.cents(item->'cents');
  end loop;
  return total;
end $$;
revoke all on function private.installments_total(jsonb, int) from public, anon, authenticated;

create function private.payment_total(p private.payments) returns bigint
language sql immutable set search_path = '' as $$
  select coalesce((select sum((i->>'cents')::bigint) from jsonb_array_elements(p.items) i), 0) + p.interest_cents + p.fine_cents - p.discount_cents
$$;
revoke all on function private.payment_total(private.payments) from public, anon, authenticated;

/*
 * Parcela `p_index` da obrigação `p_entry` (qualquer origem) na operação, como `obligations` no app:
 * { owed, title, error }. Uma parcela renegociada deve só o que estava quitado na renegociação.
 */
create function private.obligation_info(p_operation uuid, p_entry text, p_index int, p_direction text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare e private.entries%rowtype; l private.lots%rowtype; f private.financings%rowtype; r private.renegotiations%rowtype;
  t private.titles%rowtype; pay private.payments%rowtype; owed bigint; title text; k text; frozen jsonb;
begin
  select * into r from private.renegotiations x where x.operation_id = p_operation and x.status = 'efetivado'
    and x.items @> jsonb_build_array(jsonb_build_object('entryId', p_entry, 'index', p_index)) limit 1;
  if found then
    select value into frozen from jsonb_array_elements(r.items) where value->>'entryId' = p_entry and (value->>'index')::int = p_index;
    if r.direction <> p_direction then return jsonb_build_object('error', 'Parcela não encontrada.'); end if;
    return jsonb_build_object('owed', (frozen->>'settledCents')::bigint, 'title', format('parcela %s renegociada', p_index + 1), 'renegotiated', true);
  end if;
  select * into e from private.entries x where x.id::text = p_entry and x.operation_id = p_operation;
  if found then
    if e.status <> 'aprovado' then return jsonb_build_object('error', format('"%s" ainda não foi aprovada. A baixa só vale para conta aprovada.', e.data->>'title')); end if;
    if (p_direction = 'pagar' and e.kind not in ('despesa', 'nota_fiscal')) or (p_direction = 'receber' and e.kind not in ('venda', 'receita'))
      then return jsonb_build_object('error', 'Parcela não encontrada.'); end if;
    if e.kind = 'receita' then owed := (e.data->'payload'->'installments'->p_index->>'cents')::bigint;
    else owed := private.installment_cents(e.kind, e.data, p_index); end if;
    title := format('parcela %s de "%s"', p_index + 1, e.data->>'title');
  else
    select * into l from private.lots x where x.id::text = p_entry and x.operation_id = p_operation;
    if found then
      if p_direction <> 'pagar' then return jsonb_build_object('error', 'Parcela não encontrada.'); end if;
      owed := private.lot_installment_cents(l.data, p_index);
      title := format('compra da Origem %s', l.data->>'code');
    else
      select * into f from private.financings x where x.id::text = p_entry and x.operation_id = p_operation;
      if found then
        if p_direction <> 'pagar' then return jsonb_build_object('error', 'Parcela não encontrada.'); end if;
        owed := (f.data->'schedule'->p_index->>'principalCents')::bigint + (f.data->'schedule'->p_index->>'interestCents')::bigint;
        title := format('parcela %s do financiamento %s', p_index + 1, f.data->>'bank');
      else
        select * into r from private.renegotiations x where x.id::text = p_entry and x.operation_id = p_operation;
        if found then
          if r.status <> 'efetivado' then return jsonb_build_object('error', 'A renegociação desta parcela foi desfeita.'); end if;
          if r.direction <> p_direction then return jsonb_build_object('error', 'Parcela não encontrada.'); end if;
          owed := (r.installments->p_index->>'cents')::bigint;
          title := format('parcela %s da renegociação', p_index + 1);
        else
          select * into t from private.titles x where x.id::text = p_entry and x.operation_id = p_operation;
          if found then
            if t.direction <> p_direction then return jsonb_build_object('error', 'Parcela não encontrada.'); end if;
            owed := (t.data->'installments'->p_index->>'cents')::bigint;
            title := format('parcela %s de "%s"', p_index + 1, t.data->>'title');
          else
            select * into pay from private.payments x where x.id::text = p_entry and x.operation_id = p_operation;
            if not found or pay.partner_mode is distinct from 'reembolso' then return jsonb_build_object('error', 'A conta não pertence a esta operação.'); end if;
            if pay.status <> 'efetivado' then return jsonb_build_object('error', 'A despesa paga pelo sócio foi estornada.'); end if;
            if p_direction <> 'pagar' or p_index <> 0 then return jsonb_build_object('error', 'Parcela não encontrada.'); end if;
            owed := private.payment_total(pay);
            title := format('reembolso a %s', (select name from private.profiles where id = pay.partner_id));
          end if;
        end if;
      end if;
    end if;
  end if;
  if owed is null then return jsonb_build_object('error', 'Parcela não encontrada.'); end if;
  return jsonb_build_object('owed', owed, 'title', title);
end $$;
revoke all on function private.obligation_info(uuid, text, int, text) from public, anon, authenticated;

create function private.partner_in(p_operation uuid, p_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from private.memberships m where m.operation_id = p_operation and m.user_id = p_user and m.role = 'socio')
$$;
revoke all on function private.partner_in(uuid, uuid) from public, anon, authenticated;

-- Outra receita (couro, arrendamento, serviços): parcelas fecham o valor; categoria de receita.
-- Despesa lançada de uma recorrência: a recorrência é da operação e cada mês só tem uma despesa.
alter function private.validate_entry(jsonb,uuid,uuid) rename to validate_entry_before_management;
revoke all on function private.validate_entry_before_management(jsonb,uuid,uuid) from public, anon, authenticated;
create function private.validate_entry(p_data jsonb, p_operation uuid, p_farm uuid) returns void
language plpgsql security invoker set search_path = '' as $$
declare k text := p_data->>'kind'; p jsonb := p_data->'payload'; nature text;
begin
  if k is distinct from 'receita' then
    perform private.validate_entry_before_management(p_data, p_operation, p_farm);
    if k = 'despesa' and jsonb_typeof(p->'recurrence') = 'object' then
      if not exists(select 1 from private.recurrences r where r.id::text = p->'recurrence'->>'id' and r.operation_id = p_operation)
        then raise exception 'Despesa recorrente fora desta operação.'; end if;
      if coalesce(p->'recurrence'->>'month', '') !~ '^\d{4}-(0[1-9]|1[0-2])$' then raise exception 'Mês da recorrência inválido.'; end if;
      if exists(select 1 from private.entries x where x.operation_id = p_operation and x.kind = 'despesa' and x.status <> 'rejeitado'
        and x.id::text is distinct from p_data->>'id'
        and x.data->'payload'->'recurrence'->>'id' = p->'recurrence'->>'id' and x.data->'payload'->'recurrence'->>'month' = p->'recurrence'->>'month')
        then raise exception 'A despesa deste mês já foi lançada.'; end if;
    end if;
    return;
  end if;
  if jsonb_typeof(p) is distinct from 'object' or nullif(btrim(p_data->>'title'), '') is null or not private.valid_iso_date(p_data->>'occurredAt')
    then raise exception 'Lançamento incompleto.'; end if;
  if private.cents(p_data->'amountCents') = 0 then raise exception 'Informe o valor da receita.'; end if;
  if jsonb_array_length(coalesce(p->'installments', '[]'::jsonb)) = 0 then raise exception 'Informe as parcelas.'; end if;
  if private.installments_total(p->'installments', 60) <> private.cents(p_data->'amountCents') then raise exception 'As parcelas precisam fechar o valor total.'; end if;
  select d->>'nature' into nature from jsonb_array_elements(private.default_categories()) d where d->>'id' = p->>'categoryId';
  if nature is null then select c.nature into nature from private.categories c where c.id::text = p->>'categoryId' and c.operation_id = p_operation; end if;
  if nature is null or nature not in ('receita_operacional', 'outra_receita') then raise exception 'Escolha uma categoria de receita do plano de contas.'; end if;
  if nullif(p->>'counterpartyId', '') is not null and not exists(select 1 from private.counterparties c where c.id::text = p->>'counterpartyId' and c.operation_id = p_operation)
    then raise exception 'Cliente fora desta operação.'; end if;
  if char_length(coalesce(p->>'description', '')) > 500 or char_length(coalesce(p->>'counterparty', '')) > 150 or char_length(coalesce(p->>'document', '')) > 150
    then raise exception 'Descrição até 500, cliente e documento até 150 caracteres.'; end if;
end $$;
revoke all on function private.validate_entry(jsonb,uuid,uuid) from public, anon, authenticated;

-- A receita é financeira: só outro sócio aprova; sem outro sócio, entra direto.
alter function private.entry_status(uuid,jsonb,uuid,uuid,boolean) rename to entry_status_before_management;
revoke all on function private.entry_status_before_management(uuid,jsonb,uuid,uuid,boolean) from public, anon, authenticated;
create function private.entry_status(p_entry uuid, p_data jsonb, p_operation uuid, p_author uuid, p_reserve boolean) returns text
language plpgsql security invoker set search_path = '' as $$
begin
  if p_data->>'kind' = 'receita' then
    return case when exists(select 1 from private.memberships m where m.operation_id = p_operation and m.user_id <> p_author and m.role = 'socio')
      then 'aguardando_aprovacao' else 'aprovado' end;
  end if;
  return private.entry_status_before_management(p_entry, p_data, p_operation, p_author, p_reserve);
end $$;
revoke all on function private.entry_status(uuid,jsonb,uuid,uuid,boolean) from public, anon, authenticated;

-- Conflito em vez de erro, para não travar a fila do aparelho.
create function private.account_reason(p_account private.financial_accounts, p_date date) returns text
language sql immutable set search_path = '' as $$
  select case when not p_account.active then format('A conta %s foi inativada.', p_account.name)
    when p_date < p_account.opening_date then format('A conta %s começa em %s.', p_account.name, to_char(p_account.opening_date, 'DD/MM/YYYY'))
    end
$$;
revoke all on function private.account_reason(private.financial_accounts, date) from public, anon, authenticated;

alter function private.command(uuid,text,jsonb) rename to command_before_management;
revoke all on function private.command_before_management(uuid,text,jsonb) from public, anon, authenticated;
create function private.command(p_id uuid, p_kind text, p_payload jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid; op uuid; target uuid; previous private.commands%rowtype; outcome jsonb; existing private.entries%rowtype;
  acc private.financial_accounts%rowtype; acc2 private.financial_accounts%rowtype; pay private.payments%rowtype;
  mov private.movements%rowtype; fin private.financings%rowtype; reneg private.renegotiations%rowtype; rec private.recurrences%rowtype;
  bud private.budgets%rowtype; item jsonb; info jsonb; reason text; total bigint; open_cents bigint; idx int; t text; fields jsonb;
  first_payment date; kind_name text; replay boolean; items jsonb; direction text; source_count int; imported int := 0; skipped int := 0;
  doc jsonb; released bigint; nature text;
begin
  replay := exists(select 1 from private.commands c where c.user_id = (select auth.uid()) and c.id = p_id);
  -- Receitas são do financeiro: só sócio registra e aprova (as camadas anteriores só conheciam despesa, venda e nota).
  if p_kind = 'save_entry' and p_payload->'entry'->>'kind' = 'receita' and not replay
    and private.member_role((p_payload->>'operationId')::uuid) is distinct from 'socio'
    then raise exception 'Somente um sócio pode registrar uma receita.' using errcode = '42501'; end if;
  if p_kind = 'decide_entry' and not replay then
    select * into existing from private.entries e where e.id = (p_payload->>'id')::uuid;
    if found and existing.kind = 'receita' and private.member_role(existing.operation_id) is distinct from 'socio'
      then raise exception 'Esta aprovação precisa de outra pessoa habilitada.' using errcode = '42501'; end if;
  end if;
  if p_kind is null or p_kind not in ('create_account', 'update_account', 'register_payment', 'reverse_payment', 'register_movement',
    'reverse_movement', 'save_financing', 'renegotiate', 'undo_renegotiation', 'save_recurrence', 'set_budget', 'import_titles') then
    return private.command_before_management(p_id, p_kind, p_payload);
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
  -- The operation lock serializes payments, movements and renegotiations of the same installments.
  perform 1 from private.operations where id = op for update;
  if private.member_role(op) is null then raise exception 'Sem acesso a esta operação.' using errcode = '42501'; end if;
  if private.member_role(op) <> 'socio' then raise exception 'O financeiro é exclusivo dos sócios da operação.' using errcode = '42501'; end if;

  if p_kind in ('create_account', 'update_account') then
    if nullif(btrim(p_payload->>'name'), '') is null or char_length(btrim(p_payload->>'name')) > 100 then raise exception 'Dê um nome à conta (até 100 caracteres).'; end if;
    if p_payload->>'kind' is null or p_payload->>'kind' not in ('corrente','poupanca','caixa','investimento','cartao') then raise exception 'Tipo de conta inválido.'; end if;
    if not private.valid_iso_date(p_payload->>'openingDate') then raise exception 'Informe a data do saldo inicial.'; end if;
    perform private.signed_cents(p_payload->'openingBalanceCents');
    if jsonb_typeof(p_payload->'active') is distinct from 'boolean' then raise exception 'Situação da conta inválida.'; end if;
    if p_payload->>'kind' = 'cartao' and (coalesce((p_payload->>'closingDay')::int, 0) not between 1 and 28 or coalesce((p_payload->>'dueDay')::int, 0) not between 1 and 28)
      then raise exception 'Informe os dias de fechamento e de vencimento da fatura (1 a 28).'; end if;
    if exists(select 1 from private.financial_accounts a where a.operation_id = op and a.id <> target
      and lower(btrim(a.name)) = lower(btrim(p_payload->>'name'))) then raise exception 'Já existe uma conta com este nome.'; end if;
    if p_kind = 'create_account' then
      insert into private.financial_accounts(id, operation_id, name, kind, bank, agency, number, opening_balance_cents, opening_date, active, closing_day, due_day)
        values (target, op, btrim(p_payload->>'name'), p_payload->>'kind', btrim(coalesce(p_payload->>'bank', '')), btrim(coalesce(p_payload->>'agency', '')),
          btrim(coalesce(p_payload->>'number', '')), private.signed_cents(p_payload->'openingBalanceCents'), (p_payload->>'openingDate')::date,
          (p_payload->>'active')::boolean,
          case when p_payload->>'kind' = 'cartao' then (p_payload->>'closingDay')::smallint end,
          case when p_payload->>'kind' = 'cartao' then (p_payload->>'dueDay')::smallint end)
        returning * into acc;
    else
      select * into acc from private.financial_accounts a where a.id = target and a.operation_id = op for update;
      if not found then raise exception 'Conta não encontrada.'; end if;
      fields := private.account_json(acc) - 'id' - 'operationId' - 'createdAt';
      -- Apps from phase 1 do not know the card days; for them, compare without.
      if p_payload->'previous' is not null and not (p_payload->'previous' ? 'closingDay') then fields := fields - 'closingDay' - 'dueDay'; end if;
      if p_payload->'previous' is null or fields <> p_payload->'previous' then raise exception 'A conta mudou em outro aparelho. Sincronize antes de editar.'; end if;
      if acc.kind <> p_payload->>'kind' and (acc.kind = 'cartao' or p_payload->>'kind' = 'cartao')
        and (exists(select 1 from private.payments p where p.account_id = target and p.status in ('efetivado', 'conflito'))
          or exists(select 1 from private.movements m where (m.from_account_id = target or m.to_account_id = target) and m.status in ('efetivado', 'conflito')))
        then raise exception 'Esta conta já tem movimentos. Um cartão não vira conta de caixa (nem o contrário).'; end if;
      select least(
        (select min(paid_at) from private.payments p where p.account_id = target and p.status = 'efetivado'),
        (select min(occurred_at) from private.movements m where (m.from_account_id = target or m.to_account_id = target) and m.status = 'efetivado'))
        into first_payment;
      if first_payment is not null and (p_payload->>'openingDate')::date > first_payment
        then raise exception 'Já há baixas antes desta data. O saldo inicial precisa ser anterior a elas.'; end if;
      update private.financial_accounts a set name = btrim(p_payload->>'name'), kind = p_payload->>'kind', bank = btrim(coalesce(p_payload->>'bank', '')),
        agency = btrim(coalesce(p_payload->>'agency', '')), number = btrim(coalesce(p_payload->>'number', '')),
        opening_balance_cents = private.signed_cents(p_payload->'openingBalanceCents'), opening_date = (p_payload->>'openingDate')::date,
        active = (p_payload->>'active')::boolean,
        closing_day = case when p_payload->>'kind' = 'cartao' then (p_payload->>'closingDay')::smallint end,
        due_day = case when p_payload->>'kind' = 'cartao' then (p_payload->>'dueDay')::smallint end
        where a.id = target returning * into acc;
    end if;
    outcome := private.account_json(acc);

  elsif p_kind = 'register_payment' then
    direction := p_payload->>'direction';
    if direction is null or direction not in ('pagar','receber') then raise exception 'Baixa inválida.'; end if;
    if p_payload->>'method' is null or p_payload->>'method' not in ('pix','boleto','transferencia','dinheiro','cheque','cartao','outro') then raise exception 'Forma de pagamento inválida.'; end if;
    if not private.valid_iso_date(p_payload->>'paidAt') then raise exception 'Data do pagamento inválida.'; end if;
    if (p_payload->>'paidAt')::date > private.sao_paulo_today() then raise exception 'A data do pagamento não pode ser futura.'; end if;
    if jsonb_typeof(p_payload->'items') is distinct from 'array' or jsonb_array_length(p_payload->'items') not between 1 and 100
      then raise exception 'Escolha de 1 a 100 parcelas.'; end if;
    if (select count(*) <> count(distinct (value->>'entryId') || ':' || (value->>'index')) from jsonb_array_elements(p_payload->'items'))
      then raise exception 'A mesma parcela aparece duas vezes.'; end if;
    if char_length(coalesce(p_payload->>'proof', '')) > 200 or char_length(coalesce(p_payload->>'notes', '')) > 500
      then raise exception 'Comprovante até 200 e observação até 500 caracteres.'; end if;
    source_count := (case when nullif(p_payload->>'accountId', '') is not null then 1 else 0 end)
      + (case when nullif(p_payload->>'partnerId', '') is not null then 1 else 0 end)
      + (case when nullif(p_payload->>'advanceId', '') is not null then 1 else 0 end);
    if source_count <> 1 then raise exception 'Escolha a conta de onde saiu ou entrou o dinheiro.'; end if;
    total := private.cents(p_payload->'interestCents') + private.cents(p_payload->'fineCents') - private.cents(p_payload->'discountCents');
    for item in select value from jsonb_array_elements(p_payload->'items') loop
      if jsonb_typeof(item->'index') is distinct from 'number' or (item->>'index')::numeric <> trunc((item->>'index')::numeric) or (item->>'index')::int < 0
        then raise exception 'Parcela inválida.'; end if;
      if private.cents(item->'cents') = 0 then raise exception 'Informe o valor de cada parcela.'; end if;
      total := total + private.cents(item->'cents');
    end loop;
    if total < 0 then raise exception 'O desconto não pode passar do valor pago.'; end if;
    reason := null;
    acc := null;
    if nullif(p_payload->>'accountId', '') is not null then
      select * into acc from private.financial_accounts a where a.id = (p_payload->>'accountId')::uuid and a.operation_id = op;
      if not found then raise exception 'Conta financeira fora desta operação.' using errcode = '42501'; end if;
      reason := private.account_reason(acc, (p_payload->>'paidAt')::date);
    elsif nullif(p_payload->>'partnerId', '') is not null then
      if direction <> 'pagar' then raise exception 'Só pagamentos podem ser feitos por um sócio com dinheiro próprio.'; end if;
      if p_payload->>'partnerMode' is null or p_payload->>'partnerMode' not in ('reembolso', 'aporte') then raise exception 'Escolha reembolso ou aporte.'; end if;
      if not private.partner_in(op, (p_payload->>'partnerId')::uuid) then
        reason := format('%s não é sócio desta operação.', coalesce((select name from private.profiles where id = (p_payload->>'partnerId')::uuid), 'A pessoa'));
      end if;
    else
      if direction <> 'receber' then raise exception 'Adiantamento só compensa recebimentos.'; end if;
      select * into mov from private.movements m where m.id = (p_payload->>'advanceId')::uuid and m.operation_id = op and m.kind = 'adiantamento';
      if not found then raise exception 'Adiantamento fora desta operação.' using errcode = '42501'; end if;
      if mov.status <> 'efetivado' then reason := 'O adiantamento foi estornado.';
      else
        open_cents := mov.cents - coalesce((select sum(private.payment_total(p)) from private.payments p where p.advance_id = mov.id and p.status = 'efetivado'), 0);
        if total > open_cents then reason := format('O adiantamento tem %s para compensar; a baixa pede %s.', private.brl(open_cents), private.brl(total)); end if;
      end if;
    end if;
    if reason is null then
      for item in select value from jsonb_array_elements(p_payload->'items') loop
        idx := (item->>'index')::int;
        info := private.obligation_info(op, item->>'entryId', idx, direction);
        if info ? 'error' then reason := info->>'error'; exit; end if;
        open_cents := (info->>'owed')::bigint - private.settled_cents(op, item->>'entryId', idx);
        if private.cents(item->'cents') > open_cents then
          reason := case when coalesce((info->>'renegotiated')::boolean, false) then format('A %s. Pague as parcelas novas.', info->>'title')
            when open_cents <= 0 then format('A %s já foi quitada, talvez em outro aparelho.', info->>'title')
            else format('A %s tem %s em aberto; a baixa pede %s.', info->>'title', private.brl(open_cents), private.brl(private.cents(item->'cents'))) end;
          exit;
        end if;
      end loop;
    end if;
    insert into private.payments(id, operation_id, direction, account_id, paid_at, items, interest_cents, fine_cents, discount_cents,
        method, proof, notes, status, conflict_reason, author_id, partner_id, partner_mode, advance_id)
      values (target, op, direction, acc.id, (p_payload->>'paidAt')::date,
        (select jsonb_agg(jsonb_build_object('entryId', value->>'entryId', 'index', (value->>'index')::int, 'cents', private.cents(value->'cents'))) from jsonb_array_elements(p_payload->'items')),
        private.cents(p_payload->'interestCents'), private.cents(p_payload->'fineCents'), private.cents(p_payload->'discountCents'),
        p_payload->>'method', btrim(coalesce(p_payload->>'proof', '')), btrim(coalesce(p_payload->>'notes', '')),
        case when reason is null then 'efetivado' else 'conflito' end, reason, uid,
        nullif(p_payload->>'partnerId', '')::uuid, case when nullif(p_payload->>'partnerId', '') is not null then p_payload->>'partnerMode' end,
        nullif(p_payload->>'advanceId', '')::uuid)
      returning * into pay;
    outcome := private.payment_json(pay);

  elsif p_kind = 'reverse_payment' then
    select * into pay from private.payments p where p.id = target and p.operation_id = op for update;
    if not found then raise exception 'Baixa não encontrada.'; end if;
    if pay.status not in ('efetivado', 'conflito') then raise exception 'Esta baixa não pode mais ser estornada.'; end if;
    if pay.status = 'efetivado' and nullif(btrim(p_payload->>'reason'), '') is null then raise exception 'Informe o motivo do estorno.'; end if;
    if char_length(coalesce(p_payload->>'reason', '')) > 500 then raise exception 'Use até 500 caracteres no motivo.'; end if;
    if pay.status = 'efetivado' then
      if exists(select 1 from private.renegotiations r cross join lateral jsonb_array_elements(pay.items) i
        where r.operation_id = op and r.status = 'efetivado' and r.items @> jsonb_build_array(jsonb_build_object('entryId', i->>'entryId', 'index', (i->>'index')::int)))
        then raise exception 'Esta baixa quita uma parcela que foi renegociada. Desfaça a renegociação antes de estornar.'; end if;
      if pay.partner_mode = 'reembolso' and exists(select 1 from private.payments p cross join lateral jsonb_array_elements(p.items) i
        where p.operation_id = op and p.status = 'efetivado' and i->>'entryId' = pay.id::text)
        then raise exception 'O reembolso desta baixa já foi pago ao sócio. Estorne o reembolso antes.'; end if;
    end if;
    update private.payments p set status = case when pay.status = 'efetivado' then 'estornado' else 'descartado' end,
      reversed_by = uid, reversed_at = clock_timestamp(), reverse_reason = nullif(btrim(p_payload->>'reason'), '')
      where p.id = target returning * into pay;
    outcome := private.payment_json(pay);

  elsif p_kind = 'register_movement' then
    kind_name := p_payload->>'kind';
    if kind_name is null or kind_name not in ('transferencia','aporte','retirada','distribuicao','liberacao','adiantamento') then raise exception 'Movimentação inválida.'; end if;
    if p_payload->>'method' is null or p_payload->>'method' not in ('pix','boleto','transferencia','dinheiro','cheque','cartao','outro') then raise exception 'Forma de pagamento inválida.'; end if;
    if not private.valid_iso_date(p_payload->>'occurredAt') then raise exception 'Data inválida.'; end if;
    if (p_payload->>'occurredAt')::date > private.sao_paulo_today() then raise exception 'A data não pode ser futura.'; end if;
    if private.cents(p_payload->'cents') = 0 then raise exception 'Informe o valor.'; end if;
    if char_length(coalesce(p_payload->>'proof', '')) > 200 or char_length(coalesce(p_payload->>'notes', '')) > 500 or char_length(coalesce(p_payload->>'counterparty', '')) > 150
      then raise exception 'Comprovante até 200, nome até 150 e observação até 500 caracteres.'; end if;
    if (kind_name in ('transferencia','retirada','distribuicao')) <> (nullif(p_payload->>'fromAccountId', '') is not null)
      or (kind_name in ('transferencia','aporte','liberacao','adiantamento')) <> (nullif(p_payload->>'toAccountId', '') is not null)
      or (kind_name in ('aporte','retirada','distribuicao')) <> (nullif(p_payload->>'partnerId', '') is not null)
      or (kind_name = 'liberacao') <> (nullif(p_payload->>'financingId', '') is not null)
      then raise exception 'Movimentação inválida.'; end if;
    if kind_name = 'adiantamento' and nullif(btrim(p_payload->>'counterparty'), '') is null then raise exception 'Informe quem adiantou.'; end if;
    reason := null;
    acc := null; acc2 := null;
    if nullif(p_payload->>'fromAccountId', '') is not null then
      select * into acc from private.financial_accounts a where a.id = (p_payload->>'fromAccountId')::uuid and a.operation_id = op;
      if not found then raise exception 'Conta financeira fora desta operação.' using errcode = '42501'; end if;
      reason := private.account_reason(acc, (p_payload->>'occurredAt')::date);
    end if;
    if nullif(p_payload->>'toAccountId', '') is not null then
      select * into acc2 from private.financial_accounts a where a.id = (p_payload->>'toAccountId')::uuid and a.operation_id = op;
      if not found then raise exception 'Conta financeira fora desta operação.' using errcode = '42501'; end if;
      if acc2.kind = 'cartao' and kind_name <> 'transferencia' then raise exception 'Escolha uma conta que não seja cartão.'; end if;
      reason := coalesce(reason, private.account_reason(acc2, (p_payload->>'occurredAt')::date));
    end if;
    if kind_name = 'transferencia' and acc.id = acc2.id then raise exception 'Escolha contas diferentes.'; end if;
    if nullif(p_payload->>'invoiceMonth', '') is not null and (kind_name <> 'transferencia' or acc2.kind is distinct from 'cartao'
      or p_payload->>'invoiceMonth' !~ '^\d{4}-(0[1-9]|1[0-2])$') then raise exception 'Fatura inválida.'; end if;
    if nullif(p_payload->>'partnerId', '') is not null and reason is null and not private.partner_in(op, (p_payload->>'partnerId')::uuid) then
      reason := format('%s não é sócio desta operação.', coalesce((select name from private.profiles where id = (p_payload->>'partnerId')::uuid), 'A pessoa'));
    end if;
    if kind_name = 'liberacao' then
      select * into fin from private.financings f where f.id = (p_payload->>'financingId')::uuid and f.operation_id = op;
      if not found then raise exception 'Financiamento fora desta operação.' using errcode = '42501'; end if;
      released := coalesce((select sum(m.cents) from private.movements m where m.financing_id = fin.id and m.kind = 'liberacao' and m.status = 'efetivado'), 0);
      if reason is null and released + private.cents(p_payload->'cents') > (fin.data->>'releasedCents')::bigint then
        reason := format('O contrato tem %s a liberar; a liberação pede %s.', private.brl((fin.data->>'releasedCents')::bigint - released), private.brl(private.cents(p_payload->'cents')));
      end if;
    end if;
    if nullif(p_payload->>'counterpartyId', '') is not null and not exists(select 1 from private.counterparties c where c.id::text = p_payload->>'counterpartyId' and c.operation_id = op)
      then raise exception 'Cliente fora desta operação.'; end if;
    insert into private.movements(id, operation_id, kind, from_account_id, to_account_id, partner_id, financing_id, counterparty, counterparty_id,
        invoice_month, cents, occurred_at, method, proof, notes, status, conflict_reason, author_id)
      values (target, op, kind_name, acc.id, acc2.id, nullif(p_payload->>'partnerId', '')::uuid, nullif(p_payload->>'financingId', '')::uuid,
        btrim(coalesce(p_payload->>'counterparty', '')), nullif(p_payload->>'counterpartyId', '')::uuid, nullif(p_payload->>'invoiceMonth', ''),
        private.cents(p_payload->'cents'), (p_payload->>'occurredAt')::date, p_payload->>'method', btrim(coalesce(p_payload->>'proof', '')),
        btrim(coalesce(p_payload->>'notes', '')), case when reason is null then 'efetivado' else 'conflito' end, reason, uid)
      returning * into mov;
    outcome := private.movement_json(mov);

  elsif p_kind = 'reverse_movement' then
    select * into mov from private.movements m where m.id = target and m.operation_id = op for update;
    if not found then raise exception 'Movimentação não encontrada.'; end if;
    if mov.status not in ('efetivado', 'conflito') then raise exception 'Esta movimentação não pode mais ser estornada.'; end if;
    if mov.status = 'efetivado' and nullif(btrim(p_payload->>'reason'), '') is null then raise exception 'Informe o motivo do estorno.'; end if;
    if char_length(coalesce(p_payload->>'reason', '')) > 500 then raise exception 'Use até 500 caracteres no motivo.'; end if;
    if mov.status = 'efetivado' and mov.kind = 'adiantamento' and exists(select 1 from private.payments p where p.advance_id = mov.id and p.status = 'efetivado')
      then raise exception 'Este adiantamento já foi compensado em recebimentos. Estorne-os antes.'; end if;
    update private.movements m set status = case when mov.status = 'efetivado' then 'estornado' else 'descartado' end,
      reversed_by = uid, reversed_at = clock_timestamp(), reverse_reason = nullif(btrim(p_payload->>'reason'), '')
      where m.id = target returning * into mov;
    outcome := private.movement_json(mov);

  elsif p_kind = 'save_financing' then
    if exists(select 1 from private.financings f where f.id = target) then raise exception 'Este financiamento já foi cadastrado.'; end if;
    if not exists(select 1 from private.farms f where f.id = (p_payload->>'farmId')::uuid and f.operation_id = op) then raise exception 'Fazenda fora da operação.' using errcode = '42501'; end if;
    if nullif(btrim(p_payload->>'bank'), '') is null or char_length(p_payload->>'bank') > 100 then raise exception 'Informe o banco ou a instituição (até 100 caracteres).'; end if;
    if p_payload->>'line' is null or p_payload->>'line' not in ('custeio','investimento','comercializacao','pronamp','pronaf','outro') then raise exception 'Escolha a linha de crédito.'; end if;
    if char_length(coalesce(p_payload->>'contract', '')) > 60 or char_length(coalesce(p_payload->>'guarantees', '')) > 500 or char_length(coalesce(p_payload->>'notes', '')) > 500
      then raise exception 'Contrato até 60, garantias e observações até 500 caracteres.'; end if;
    if private.cents(p_payload->'releasedCents') = 0 then raise exception 'Informe o valor contratado.'; end if;
    if jsonb_typeof(p_payload->'ratePct') not in ('null', 'number') or (p_payload->>'ratePct')::numeric not between 0 and 100 then raise exception 'Taxa inválida.'; end if;
    if jsonb_typeof(p_payload->'graceMonths') is distinct from 'number' or (p_payload->>'graceMonths')::numeric not between 0 and 120
      or (p_payload->>'graceMonths')::numeric <> trunc((p_payload->>'graceMonths')::numeric) then raise exception 'Carência de 0 a 120 meses.'; end if;
    if jsonb_typeof(p_payload->'schedule') is distinct from 'array' or jsonb_array_length(p_payload->'schedule') not between 1 and 240 then raise exception 'Informe de 1 a 240 parcelas.'; end if;
    total := 0;
    for item in select value from jsonb_array_elements(p_payload->'schedule') loop
      if not private.valid_iso_date(item->>'dueDate') or private.cents(item->'principalCents') + private.cents(item->'interestCents') = 0
        then raise exception 'Confira o vencimento e os valores de cada parcela.'; end if;
      total := total + private.cents(item->'principalCents');
    end loop;
    if total <> private.cents(p_payload->'releasedCents') then raise exception 'A amortização das parcelas precisa somar o valor contratado.'; end if;
    doc := jsonb_build_object('bank', btrim(p_payload->>'bank'), 'line', p_payload->>'line', 'contract', btrim(coalesce(p_payload->>'contract', '')),
      'releasedCents', private.cents(p_payload->'releasedCents'), 'ratePct', p_payload->'ratePct', 'graceMonths', (p_payload->>'graceMonths')::int,
      'guarantees', btrim(coalesce(p_payload->>'guarantees', '')), 'notes', btrim(coalesce(p_payload->>'notes', '')),
      'schedule', (select jsonb_agg(jsonb_build_object('dueDate', value->>'dueDate', 'principalCents', private.cents(value->'principalCents'),
        'interestCents', private.cents(value->'interestCents'))) from jsonb_array_elements(p_payload->'schedule')));
    insert into private.financings(id, operation_id, farm_id, data, author_id) values (target, op, (p_payload->>'farmId')::uuid, doc, uid) returning * into fin;
    outcome := private.financing_json(fin);

  elsif p_kind = 'renegotiate' then
    direction := null;
    if jsonb_typeof(p_payload->'items') is distinct from 'array' or jsonb_array_length(p_payload->'items') not between 1 and 60 then raise exception 'Escolha de 1 a 60 parcelas.'; end if;
    if (select count(*) <> count(distinct (value->>'entryId') || ':' || (value->>'index')) from jsonb_array_elements(p_payload->'items'))
      then raise exception 'A mesma parcela aparece duas vezes.'; end if;
    if nullif(btrim(p_payload->>'reason'), '') is null or char_length(p_payload->>'reason') > 500 then raise exception 'Informe o motivo (até 500 caracteres).'; end if;
    if p_payload->>'direction' is null or p_payload->>'direction' not in ('pagar', 'receber') then raise exception 'Renegociação inválida.'; end if;
    direction := p_payload->>'direction';
    perform private.installments_total(p_payload->'installments', 60);
    reason := null;
    items := '[]'::jsonb;
    for item in select value from jsonb_array_elements(p_payload->'items') loop
      if jsonb_typeof(item->'index') is distinct from 'number' or (item->>'index')::numeric <> trunc((item->>'index')::numeric) or (item->>'index')::int < 0
        then raise exception 'Parcela inválida.'; end if;
      idx := (item->>'index')::int;
      info := private.obligation_info(op, item->>'entryId', idx, direction);
      if info ? 'error' then reason := coalesce(reason, info->>'error');
      elsif coalesce((info->>'renegotiated')::boolean, false) then reason := coalesce(reason, 'Uma das parcelas já foi renegociada, talvez em outro aparelho.');
      else
        total := private.settled_cents(op, item->>'entryId', idx);
        if (info->>'owed')::bigint - total <= 0 then reason := coalesce(reason, format('A %s já foi quitada, talvez em outro aparelho.', info->>'title')); end if;
      end if;
      items := items || jsonb_build_array(jsonb_build_object('entryId', item->>'entryId', 'index', idx,
        'settledCents', private.settled_cents(op, item->>'entryId', idx)));
    end loop;
    insert into private.renegotiations(id, operation_id, direction, items, installments, reason, status, conflict_reason, author_id)
      values (target, op, direction, items,
        coalesce((select jsonb_agg(jsonb_build_object('dueDate', value->>'dueDate', 'cents', private.cents(value->'cents'))) from jsonb_array_elements(p_payload->'installments')), '[]'::jsonb),
        btrim(p_payload->>'reason'), case when reason is null then 'efetivado' else 'conflito' end, reason, uid)
      returning * into reneg;
    outcome := private.renegotiation_json(reneg);

  elsif p_kind = 'undo_renegotiation' then
    select * into reneg from private.renegotiations r where r.id = target and r.operation_id = op for update;
    if not found then raise exception 'Renegociação não encontrada.'; end if;
    if reneg.status not in ('efetivado', 'conflito') then raise exception 'Esta renegociação não pode mais ser desfeita.'; end if;
    if reneg.status = 'efetivado' then
      if nullif(btrim(p_payload->>'reason'), '') is null then raise exception 'Informe o motivo.'; end if;
      if exists(select 1 from private.payments p cross join lateral jsonb_array_elements(p.items) i
        where p.operation_id = op and p.status = 'efetivado' and i->>'entryId' = reneg.id::text)
        then raise exception 'Já há pagamento nas parcelas novas. Estorne-o antes de desfazer.'; end if;
      if exists(select 1 from private.renegotiations r cross join lateral jsonb_array_elements(r.items) i
        where r.operation_id = op and r.status = 'efetivado' and i->>'entryId' = reneg.id::text)
        then raise exception 'As parcelas novas foram renegociadas de novo. Desfaça a mais recente primeiro.'; end if;
    end if;
    if char_length(coalesce(p_payload->>'reason', '')) > 500 then raise exception 'Use até 500 caracteres no motivo.'; end if;
    update private.renegotiations r set status = case when reneg.status = 'efetivado' then 'estornado' else 'descartado' end,
      reversed_by = uid, reversed_at = clock_timestamp(), reverse_reason = nullif(btrim(p_payload->>'reason'), '')
      where r.id = target returning * into reneg;
    outcome := private.renegotiation_json(reneg);

  elsif p_kind = 'save_recurrence' then
    if not exists(select 1 from private.farms f where f.id = (p_payload->>'farmId')::uuid and f.operation_id = op) then raise exception 'Fazenda fora da operação.' using errcode = '42501'; end if;
    t := btrim(regexp_replace(coalesce(p_payload->>'title', ''), '\s+', ' ', 'g'));
    if t = '' or char_length(t) > 120 then raise exception 'Dê um nome à despesa (até 120 caracteres).'; end if;
    select d->>'nature' into nature from jsonb_array_elements(private.default_categories()) d where d->>'id' = p_payload->>'categoryId';
    if nature is null then select c.nature into nature from private.categories c where c.id::text = p_payload->>'categoryId' and c.operation_id = op; end if;
    if nature is null or nature not in ('custo_producao','despesa_administrativa','investimento','imposto') then raise exception 'Escolha a categoria da despesa.'; end if;
    if private.cents(p_payload->'cents') = 0 then raise exception 'Informe o valor de cada mês.'; end if;
    if jsonb_typeof(p_payload->'dayOfMonth') is distinct from 'number' or (p_payload->>'dayOfMonth')::numeric not between 1 and 28
      or (p_payload->>'dayOfMonth')::numeric <> trunc((p_payload->>'dayOfMonth')::numeric) then raise exception 'O vencimento vai do dia 1 ao 28.'; end if;
    if coalesce(p_payload->>'startMonth', '') !~ '^\d{4}-(0[1-9]|1[0-2])$' then raise exception 'Informe o primeiro mês.'; end if;
    if jsonb_typeof(p_payload->'endMonth') is distinct from 'null' and (coalesce(p_payload->>'endMonth', '') !~ '^\d{4}-(0[1-9]|1[0-2])$' or p_payload->>'endMonth' < p_payload->>'startMonth')
      then raise exception 'O último mês precisa vir depois do primeiro.'; end if;
    if jsonb_typeof(p_payload->'active') is distinct from 'boolean' then raise exception 'Situação inválida.'; end if;
    if char_length(coalesce(p_payload->>'counterparty', '')) > 150 then raise exception 'Use até 150 caracteres no fornecedor.'; end if;
    if nullif(p_payload->>'counterpartyId', '') is not null and not exists(select 1 from private.counterparties c where c.id::text = p_payload->>'counterpartyId' and c.operation_id = op)
      then raise exception 'Fornecedor fora desta operação.'; end if;
    doc := jsonb_build_object('title', t, 'categoryId', p_payload->>'categoryId', 'counterparty', btrim(coalesce(p_payload->>'counterparty', '')),
      'counterpartyId', nullif(p_payload->>'counterpartyId', ''), 'cents', private.cents(p_payload->'cents'), 'dayOfMonth', (p_payload->>'dayOfMonth')::int,
      'startMonth', p_payload->>'startMonth', 'endMonth', p_payload->'endMonth', 'active', (p_payload->>'active')::boolean);
    select * into rec from private.recurrences r where r.id = target for update;
    if found then
      if rec.operation_id <> op then raise exception 'Recorrência de outra operação.' using errcode = '42501'; end if;
      if p_payload->'previous' is null or (rec.data || jsonb_build_object('farmId', rec.farm_id)) <> p_payload->'previous'
        then raise exception 'A despesa recorrente mudou em outro aparelho. Sincronize antes de editar.'; end if;
      update private.recurrences r set data = doc, farm_id = (p_payload->>'farmId')::uuid where r.id = target returning * into rec;
    else
      insert into private.recurrences(id, operation_id, farm_id, data) values (target, op, (p_payload->>'farmId')::uuid, doc) returning * into rec;
    end if;
    outcome := private.recurrence_json(rec);

  elsif p_kind = 'set_budget' then
    if coalesce(p_payload->>'month', '') !~ '^\d{4}-(0[1-9]|1[0-2])$' then raise exception 'Mês inválido.'; end if;
    if nullif(p_payload->>'categoryId', '') is null or char_length(p_payload->>'categoryId') > 80
      or (not exists(select 1 from jsonb_array_elements(private.default_categories()) d where d->>'id' = p_payload->>'categoryId')
        and not exists(select 1 from private.categories c where c.id::text = p_payload->>'categoryId' and c.operation_id = op))
      then raise exception 'Categoria fora do plano de contas desta operação.'; end if;
    insert into private.budgets(id, operation_id, category_id, month, cents)
      values (target, op, p_payload->>'categoryId', p_payload->>'month', private.cents(p_payload->'cents'))
      on conflict (operation_id, category_id, month) do update set cents = excluded.cents
      returning * into bud;
    outcome := private.budget_json(bud);

  else -- import_titles
    if not exists(select 1 from private.farms f where f.id = (p_payload->>'farmId')::uuid and f.operation_id = op) then raise exception 'Fazenda fora da operação.' using errcode = '42501'; end if;
    if jsonb_typeof(p_payload->'titles') is distinct from 'array' or jsonb_array_length(p_payload->'titles') not between 1 and 500 then raise exception 'Importe de 1 a 500 linhas por vez.'; end if;
    for item in select value from jsonb_array_elements(p_payload->'titles') loop
      if (item->>'id') is null or item->>'direction' is null or item->>'direction' not in ('pagar', 'receber') then raise exception 'Linha da planilha inválida.'; end if;
      t := btrim(coalesce(item->>'title', ''));
      if t = '' or char_length(t) > 150 or char_length(coalesce(item->>'counterparty', '')) > 150 then raise exception 'Descrição e nome até 150 caracteres.'; end if;
      if not private.valid_iso_date(item->>'occurredAt') then raise exception 'Data de competência inválida.'; end if;
      if jsonb_array_length(coalesce(item->'installments', '[]'::jsonb)) = 0 then raise exception 'Linha sem parcela.'; end if;
      perform private.installments_total(item->'installments', 60);
      if nullif(item->>'categoryId', '') is not null and not exists(select 1 from jsonb_array_elements(private.default_categories()) d where d->>'id' = item->>'categoryId')
        and not exists(select 1 from private.categories c where c.id::text = item->>'categoryId' and c.operation_id = op)
        then raise exception 'Categoria fora do plano de contas desta operação.'; end if;
      if nullif(btrim(item->>'importKey'), '') is null or char_length(item->>'importKey') > 300 then raise exception 'Linha da planilha inválida.'; end if;
      insert into private.titles(id, operation_id, farm_id, direction, data, import_key, author_id)
        values ((item->>'id')::uuid, op, (p_payload->>'farmId')::uuid, item->>'direction',
          jsonb_build_object('title', t, 'counterparty', btrim(coalesce(item->>'counterparty', '')), 'categoryId', nullif(item->>'categoryId', ''),
            'occurredAt', item->>'occurredAt', 'installments', (select jsonb_agg(jsonb_build_object('dueDate', value->>'dueDate', 'cents', private.cents(value->'cents')))
              from jsonb_array_elements(item->'installments'))),
          btrim(item->>'importKey'), uid)
        on conflict do nothing;
      if found then imported := imported + 1; else skipped := skipped + 1; end if;
    end loop;
    outcome := jsonb_build_object('id', target, 'imported', imported, 'skipped', skipped);
  end if;
  insert into private.commands(user_id,id,kind,payload,result) values(uid,p_id,p_kind,p_payload,outcome);
  insert into private.audit_events(operation_id,actor_id,command_id,kind) values(op,uid,p_id,p_kind);
  return outcome;
end $$;
revoke all on function private.command(uuid,text,jsonb) from public, anon;
grant execute on function private.command(uuid,text,jsonb) to authenticated;

-- Partners receive movements, financings, renegotiations, recurrences, budgets and imported titles.
alter function private.workspace() rename to workspace_before_management;
revoke all on function private.workspace_before_management() from public, anon, authenticated;
create function private.workspace() returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  return private.workspace_before_management() || jsonb_build_object(
    'movements', coalesce((select jsonb_agg(private.movement_json(m) order by m.occurred_at desc, m.created_at desc) from private.movements m
      where private.member_role(m.operation_id) = 'socio'), '[]'::jsonb),
    'financings', coalesce((select jsonb_agg(private.financing_json(f) order by f.created_at) from private.financings f
      where private.member_role(f.operation_id) = 'socio'), '[]'::jsonb),
    'renegotiations', coalesce((select jsonb_agg(private.renegotiation_json(r) order by r.created_at) from private.renegotiations r
      where private.member_role(r.operation_id) = 'socio'), '[]'::jsonb),
    'recurrences', coalesce((select jsonb_agg(private.recurrence_json(r) order by r.created_at) from private.recurrences r
      where private.member_role(r.operation_id) = 'socio'), '[]'::jsonb),
    'budgets', coalesce((select jsonb_agg(private.budget_json(b) order by b.month, b.category_id) from private.budgets b
      where private.member_role(b.operation_id) = 'socio'), '[]'::jsonb),
    'titles', coalesce((select jsonb_agg(private.title_json(t) order by t.created_at) from private.titles t
      where private.member_role(t.operation_id) = 'socio'), '[]'::jsonb));
end $$;
revoke all on function private.workspace() from public, anon;
grant execute on function private.workspace() to authenticated;

-- Activity: what was done and how many installments, never amounts. Employees do not see these
-- partner-only actions (`private.activity_visible` lists only field work for them).
alter function private.activity_item(private.audit_events) rename to activity_item_before_management;
revoke all on function private.activity_item_before_management(private.audit_events) from public, anon, authenticated;
create function private.activity_item(a private.audit_events) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare c private.commands%rowtype; item jsonb; s jsonb; farm text;
begin
  item := private.activity_item_before_management(a);
  if a.kind not in ('register_movement', 'reverse_movement', 'save_financing', 'renegotiate', 'undo_renegotiation', 'save_recurrence', 'set_budget', 'import_titles') then
    return item;
  end if;
  select * into c from private.commands where user_id = a.actor_id and id = a.command_id;
  if a.kind in ('register_movement', 'reverse_movement') then
    select jsonb_build_object('movementKind', m.kind, 'partnerName', (select name from private.profiles where id = m.partner_id),
      'reversed', case when a.kind = 'reverse_movement' then m.status = 'estornado' end) into s
      from private.movements m where m.id::text = c.payload->>'id';
  elsif a.kind in ('renegotiate', 'undo_renegotiation') then
    select jsonb_build_object('count', jsonb_array_length(r.items), 'newCount', jsonb_array_length(r.installments),
      'paymentDirection', r.direction) into s from private.renegotiations r where r.id::text = c.payload->>'id';
  elsif a.kind = 'save_financing' then
    s := jsonb_build_object('name', c.result->>'bank'); farm := c.result->>'farmId';
  elsif a.kind = 'save_recurrence' then
    s := jsonb_build_object('name', c.result->>'title'); farm := c.result->>'farmId';
  elsif a.kind = 'set_budget' then
    s := jsonb_build_object('month', c.result->>'month');
  else
    s := jsonb_build_object('count', (c.result->>'imported')::int); farm := c.payload->>'farmId';
  end if;
  return item || jsonb_strip_nulls(jsonb_build_object('farmId', farm)) || jsonb_build_object('subject', jsonb_strip_nulls(coalesce(s, '{}'::jsonb)));
end $$;
revoke all on function private.activity_item(private.audit_events) from public, anon, authenticated;
