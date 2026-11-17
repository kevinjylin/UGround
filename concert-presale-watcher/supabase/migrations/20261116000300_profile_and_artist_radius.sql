-- Saved home location, and a radius for artist watches.

-- One row per user. The home location is the default city/state for new
-- artists and Spotify imports. Only the service role reads or writes it.
create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  home_city text,
  home_state text,
  home_country text not null default 'US' check (char_length(home_country) = 2),
  home_radius_miles integer check (home_radius_miles between 1 and 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists user_profiles_set_updated_at on public.user_profiles;
create trigger user_profiles_set_updated_at
before update on public.user_profiles
for each row
execute function public.set_updated_at();

alter table public.user_profiles enable row level security;
revoke all on public.user_profiles from anon, authenticated;

-- How far from the artist's city a show can be and still count. Null means
-- the source's default. Only meaningful when city is set.
alter table public.watch_artists
  add column if not exists radius_miles integer check (radius_miles between 1 and 500);
