-- Supabase Free Tier Schema for WeatherGPT
-- Run this in Supabase SQL Editor

-- Enable UUID
create extension if not exists "pgcrypto";

-- Users (mock auth for SIH, replace with supabase auth later)
create table users (
  id uuid primary key default gen_random_uuid(),
  name text,
  phone text,
  created_at timestamp default now()
);

-- Locations
create table locations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id),
  city_key text not null,
  name text,
  is_current boolean default false,
  created_at timestamp default now()
);

-- Weather cache (IMD data)
create table weather_cache (
  city_key text primary key,
  current jsonb,
  forecast jsonb,
  updated_at timestamp default now()
);

-- Alerts
create table alerts (
  id uuid primary key default gen_random_uuid(),
  city_key text,
  severity text check (severity in ('green','amber','red')),
  title text,
  summary text,
  official_text text,
  what_it_means text,
  is_active boolean default true,
  created_at timestamp default now()
);

-- Agri advisory
create table agri_advisory (
  city_key text primary key,
  recent_rain numeric,
  forecast_rain numeric,
  soil_moisture text,
  advice text,
  advice_hi text,
  advice_mr text,
  updated_at timestamp default now()
);

-- Chat logs (for analytics)
create table chat_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id),
  message text,
  parsed_intent jsonb,
  response jsonb,
  created_at timestamp default now()
);

-- Insert initial data
insert into weather_cache (city_key, current, forecast) values
('lucknow', '{"temp":32,"condition":"Sunny","icon":"☀️","humidity":45,"wind":8}'::jsonb, '[{"day":"Today","high":32,"low":24,"rain":10}]'::jsonb),
('mumbai', '{"temp":28,"condition":"Cloudy","icon":"☁️","humidity":82,"wind":15}'::jsonb, '[{"day":"Today","high":28,"low":25,"rain":70}]'::jsonb),
('guwahati', '{"temp":26,"condition":"Mist","icon":"🌫️","humidity":88,"wind":5}'::jsonb, '[{"day":"Today","high":26,"low":21,"rain":40}]'::jsonb);

insert into agri_advisory (city_key, recent_rain, forecast_rain, soil_moisture, advice) values
('lucknow', 12, 45, 'Medium', 'Hold irrigation for 3 days'),
('mumbai', 85, 120, 'High', 'No irrigation needed, ensure drainage'),
('guwahati', 22, 18, 'Medium', 'Irrigate lightly tomorrow morning');

insert into alerts (city_key, severity, title, summary, official_text, what_it_means, is_active) values
('lucknow', 'amber', 'Heavy Rain Watch', 'Heavy rainfall expected', 'IMD Yellow Watch for Lucknow', 'Carry umbrella', true),
('mumbai', 'red', 'Extreme Rain Warning', '200mm+ rain expected', 'IMD RED WARNING Mumbai', 'Stay indoors', true);

-- Enable RLS (for free tier security)
alter table weather_cache enable row level security;
alter table alerts enable row level security;
alter table agri_advisory enable row level security;
alter table locations enable row level security;
alter table chat_logs enable row level security;

-- Public read for weather (SIH demo)
create policy "Public read weather" on weather_cache for select using (true);
create policy "Public read alerts" on alerts for select using (true);
create policy "Public read agri" on agri_advisory for select using (true);
create policy "Public all locations" on locations for all using (true);
create policy "Public all chat" on chat_logs for all using (true);
