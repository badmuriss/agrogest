-- Optional document numbers live beside the existing lot data. No backfill or
-- rewrite of historical lots is needed; old clients may continue omitting them.
create function private.valid_document_numbers(numbers jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select case
    when numbers is null then true
    when jsonb_typeof(numbers) <> 'array' then false
    else jsonb_array_length(numbers) <= 100 and not exists (
      select 1 from jsonb_array_elements(numbers) as items(value)
      where jsonb_typeof(value) <> 'string'
        or char_length(trim(value #>> '{}')) not between 1 and 100
    )
  end
$$;
revoke all on function private.valid_document_numbers(jsonb) from public, anon, authenticated;

alter table private.lots add constraint lots_gta_numbers_valid
  check (private.valid_document_numbers(data->'gtaNumbers'));
alter table private.lots add constraint lots_invoice_numbers_valid
  check (private.valid_document_numbers(data->'invoiceNumbers'));
