alter table public.subscribers
  add column if not exists unsubscribe_token text;

update public.subscribers
set unsubscribe_token = translate(rtrim(encode(gen_random_bytes(24), 'base64'), '='), '+/', '-_')
where unsubscribe_token is null;

alter table public.subscribers
  alter column unsubscribe_token set not null;

create unique index if not exists subscribers_unsubscribe_token_key
  on public.subscribers (unsubscribe_token);
