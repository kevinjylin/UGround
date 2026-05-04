-- One-time destructive cutover from custom auth tables to Supabase Auth.
-- Run this once after enabling Supabase Auth providers and before accepting users.
begin;

truncate table snapshots, alerts, events, watch_artists, notification_settings
restart identity cascade;

drop table if exists password_resets;
drop table if exists auth_users;

alter table watch_artists
drop constraint if exists watch_artists_user_id_fkey;
alter table watch_artists
alter column user_id drop default;
alter table watch_artists
alter column user_id type uuid using user_id::uuid;
alter table watch_artists
alter column user_id set not null;
alter table watch_artists
add constraint watch_artists_user_id_fkey
foreign key (user_id) references auth.users(id) on delete cascade;

alter table events
drop constraint if exists events_user_id_fkey;
alter table events
alter column user_id drop default;
alter table events
alter column user_id type uuid using user_id::uuid;
alter table events
alter column user_id set not null;
alter table events
add constraint events_user_id_fkey
foreign key (user_id) references auth.users(id) on delete cascade;

alter table alerts
drop constraint if exists alerts_user_id_fkey;
alter table alerts
alter column user_id drop default;
alter table alerts
alter column user_id type uuid using user_id::uuid;
alter table alerts
alter column user_id set not null;
alter table alerts
add constraint alerts_user_id_fkey
foreign key (user_id) references auth.users(id) on delete cascade;

alter table notification_settings
drop constraint if exists notification_settings_user_id_fkey;
alter table notification_settings
alter column user_id type uuid using user_id::uuid;
alter table notification_settings
alter column user_id set not null;
alter table notification_settings
add constraint notification_settings_user_id_fkey
foreign key (user_id) references auth.users(id) on delete cascade;

commit;
