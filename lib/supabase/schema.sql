-- Journal entries for trade reflections and lessons
create table if not exists journal_entries (
  id uuid primary key default gen_random_uuid(),
  wallet_address text not null,
  title text not null,
  content text not null default '',
  tags text[] not null default '{}',
  trade_data jsonb,
  pnl_amount numeric,
  coin text,
  mood text check (mood in ('confident', 'tilted', 'neutral', 'learning')),
  is_public boolean not null default false,
  published_at timestamptz,
  slug text,
  linked_trades jsonb default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_journal_wallet on journal_entries(wallet_address);
create index if not exists idx_journal_created on journal_entries(created_at desc);
create unique index if not exists idx_journal_slug on journal_entries(slug) where slug is not null;
create index if not exists idx_journal_public on journal_entries(is_public, published_at desc) where is_public = true;

-- Chat message history for AI coach conversations
create table if not exists chat_messages (
  id uuid primary key default gen_random_uuid(),
  wallet_address text not null,
  conversation_id uuid not null,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_chat_wallet on chat_messages(wallet_address);
create index if not exists idx_chat_convo on chat_messages(conversation_id, created_at);

-- Auto-update updated_at on journal entries
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists journal_entries_updated_at on journal_entries;
create trigger journal_entries_updated_at
  before update on journal_entries
  for each row execute function update_updated_at();

-- RLS policies (allow all for now since we filter by wallet_address in app code)
alter table journal_entries enable row level security;
alter table chat_messages enable row level security;

create policy "Allow all journal access" on journal_entries for all using (true) with check (true);
create policy "Allow all chat access" on chat_messages for all using (true) with check (true);
