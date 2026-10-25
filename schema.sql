-- Supabase SQL Editor mein poora SQL run karein.
-- App ke liye Supabase Auth use karein; password ko profiles/messages table mein kabhi store na karein.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 30),
  about text not null default '',
  avatar_url text,
  updated_at timestamptz not null default now()
);

create table if not exists public.messages (
  id bigint generated always as identity primary key,
  sender_id uuid not null references auth.users(id) on delete cascade,
  receiver_id uuid not null references auth.users(id) on delete cascade,
  body text not null default '',
  media_url text,
  media_type text,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete set null,
  constraint message_has_content check (char_length(body) > 0 or media_url is not null),
  constraint sender_not_receiver check (sender_id <> receiver_id)
);

alter table public.profiles enable row level security;
alter table public.messages enable row level security;

drop policy if exists "Profiles can be read by authenticated users" on public.profiles;
create policy "Profiles can be read by authenticated users" on public.profiles
for select to authenticated using (true);

drop policy if exists "Users can insert their profile" on public.profiles;
create policy "Users can insert their profile" on public.profiles
for insert to authenticated with check (auth.uid() = id);

drop policy if exists "Users can update their profile" on public.profiles;
create policy "Users can update their profile" on public.profiles
for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "Participants can read messages" on public.messages;
create policy "Participants can read messages" on public.messages
for select to authenticated using (auth.uid() = sender_id or auth.uid() = receiver_id);

drop policy if exists "Sender can send messages" on public.messages;
create policy "Sender can send messages" on public.messages
for insert to authenticated with check (auth.uid() = sender_id and sender_id <> receiver_id);

drop policy if exists "Sender can move own messages to bin" on public.messages;
create policy "Sender can move own messages to bin" on public.messages
for update to authenticated using (auth.uid() = sender_id or auth.uid() = deleted_by)
with check (
  (auth.uid() = sender_id and (deleted_at is null or deleted_by = auth.uid()))
  or (auth.uid() = deleted_by and (deleted_at is null or deleted_by is null))
);

drop policy if exists "User can permanently delete their binned messages" on public.messages;
create policy "User can permanently delete their binned messages" on public.messages
for delete to authenticated using (auth.uid() = deleted_by);

create index if not exists messages_conversation_created_idx
on public.messages (sender_id, receiver_id, created_at);

create index if not exists messages_receiver_created_idx
on public.messages (receiver_id, created_at);

-- Storage bucket for images/videos. Keep it private; app should use signed URLs in a production build.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chat-media', 'chat-media', false, 52428800, array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','video/quicktime'])
on conflict (id) do nothing;

drop policy if exists "Authenticated users can upload chat media" on storage.objects;
create policy "Authenticated users can upload chat media" on storage.objects
for insert to authenticated with check (bucket_id = 'chat-media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Authenticated users can read chat media" on storage.objects;
create policy "Authenticated users can read chat media" on storage.objects
for select to authenticated using (bucket_id = 'chat-media');

drop policy if exists "Users can update own media" on storage.objects;
create policy "Users can update own media" on storage.objects
for update to authenticated using (bucket_id = 'chat-media' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'chat-media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users can delete own media" on storage.objects;
create policy "Users can delete own media" on storage.objects
for delete to authenticated using (bucket_id = 'chat-media' and (storage.foldername(name))[1] = auth.uid()::text);

-- Enable realtime for messages from Supabase Dashboard > Database > Publications, if not already enabled.


-- Private bucket access: own uploads, media attached to a conversation you participate in,
-- and profile pictures shown to authenticated users.
drop policy if exists "Authenticated users can read chat media" on storage.objects;
drop policy if exists "Participants can read linked chat media" on storage.objects;
create policy "Participants can read linked chat media" on storage.objects
for select to authenticated using (
  bucket_id = 'chat-media' and (
    (storage.foldername(name))[1] = auth.uid()::text
    or exists (select 1 from public.messages m where m.media_url = name and (m.sender_id = auth.uid() or m.receiver_id = auth.uid()))
    or exists (select 1 from public.profiles p where p.avatar_url = name)
  )
);

-- Enable realtime for messages. If this reports that the table is already in the publication,
-- that is fine; the dashboard can also enable it under Database > Publications.
do $$ begin
  alter publication supabase_realtime add table public.messages;
exception when duplicate_object then null; when undefined_object then raise notice 'Enable supabase_realtime in Dashboard > Database > Publications';
end $$;
