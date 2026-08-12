-- Enable required extensions
create extension if not exists "uuid-ossp";

-- 1. Helper Functions
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

create or replace function public.is_organization_member(target_organization_id uuid)
returns boolean as $$
begin
  return exists (
    select 1
    from public.organization_members
    where organization_id = target_organization_id
    and user_id = auth.uid()
  );
end;
$$ language plpgsql security definer;

create or replace function public.has_organization_role(target_organization_id uuid, allowed_roles text[])
returns boolean as $$
begin
  return exists (
    select 1
    from public.organization_members
    where organization_id = target_organization_id
    and user_id = auth.uid()
    and role = any(allowed_roles)
  );
end;
$$ language plpgsql security definer;


-- 2. Tables

-- Profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  role text not null default 'operator',
  organization_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Organizations
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Organization Members
create table if not exists public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'operator',
  created_at timestamptz not null default now(),
  unique(organization_id, user_id)
);

-- Venues
create table if not exists public.venues (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  name text not null,
  description text,
  status text not null default 'draft',
  version integer not null default 1,
  metadata jsonb not null default '{}'::jsonb,
  thumbnail_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Venue Nodes
create table if not exists public.venue_nodes (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues(id) on delete cascade,
  node_key text not null,
  node_type text not null,
  label text not null,
  position_x double precision not null default 0,
  position_y double precision not null default 0,
  capacity integer,
  properties jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(venue_id, node_key)
);

-- Venue Edges
create table if not exists public.venue_edges (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues(id) on delete cascade,
  edge_key text not null,
  source_node_key text not null,
  target_node_key text not null,
  weight double precision,
  capacity integer,
  properties jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(venue_id, edge_key)
);

-- Venue Versions
create table if not exists public.venue_versions (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues(id) on delete cascade,
  version_number integer not null,
  snapshot jsonb not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique(venue_id, version_number)
);

-- Simulations
create table if not exists public.simulations (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  status text not null default 'created',
  crowd_size integer not null,
  event_schedule text,
  started_at timestamptz,
  paused_at timestamptz,
  completed_at timestamptz,
  risk_score double precision,
  peak_risk_score double precision,
  peak_density double precision,
  average_density double precision,
  rerouted_agents integer not null default 0,
  exited_agents integer not null default 0,
  confidence double precision,
  inference_latency integer,
  model_name text,
  calibration_multiplier double precision,
  hf_dataset_info text,
  dataset_metrics jsonb not null default '{}'::jsonb,
  risk_breakdown jsonb not null default '{}'::jsonb,
  risk_timeline jsonb not null default '[]'::jsonb,
  bottlenecks jsonb not null default '[]'::jsonb,
  final_metrics jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Simulation Snapshots
create table if not exists public.simulation_snapshots (
  id bigint generated always as identity primary key,
  simulation_id uuid not null references public.simulations(id) on delete cascade,
  captured_at timestamptz not null default now(),
  risk_score double precision,
  risk_level text,
  crowd_density double precision,
  queue_ratio double precision,
  exit_utilization double precision,
  blocked_path_ratio double precision,
  active_agents integer,
  exited_agents integer,
  rerouted_agents integer,
  node_occupancy jsonb not null default '{}'::jsonb,
  edge_occupancy jsonb not null default '{}'::jsonb,
  bottlenecks jsonb not null default '[]'::jsonb,
  metrics jsonb not null default '{}'::jsonb
);

-- Alerts
create table if not exists public.alerts (
  id uuid primary key default gen_random_uuid(),
  simulation_id uuid not null references public.simulations(id) on delete cascade,
  venue_id uuid not null references public.venues(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid references auth.users(id),
  alert_type text not null,
  severity text not null,
  title text not null,
  message text not null,
  node_key text,
  acknowledged boolean not null default false,
  acknowledged_by uuid references auth.users(id),
  acknowledged_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- AI Recommendations
create table if not exists public.ai_recommendations (
  id uuid primary key default gen_random_uuid(),
  simulation_id uuid not null references public.simulations(id) on delete cascade,
  venue_id uuid not null references public.venues(id) on delete cascade,
  created_by uuid references auth.users(id),
  source text not null,
  model_name text,
  prompt text,
  raw_response text,
  recommendation jsonb not null,
  risk_level text,
  recommended_action text,
  recommended_exit text,
  reroute_percentage double precision,
  affected_nodes jsonb not null default '[]'::jsonb,
  reason text,
  expected_risk_reduction double precision,
  confidence double precision,
  inference_latency integer,
  status text not null default 'generated',
  created_at timestamptz not null default now()
);

-- Reports
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  venue_id uuid references public.venues(id) on delete set null,
  simulation_id uuid references public.simulations(id) on delete set null,
  created_by uuid not null references auth.users(id),
  name text not null,
  report_type text not null,
  status text not null default 'processing',
  summary text,
  report_data jsonb not null default '{}'::jsonb,
  file_path text,
  file_url text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  error_message text
);

-- Audit Logs
create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  organization_id uuid references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- 3. Triggers
create trigger set_profiles_updated_at before update on public.profiles for each row execute procedure set_updated_at();
create trigger set_organizations_updated_at before update on public.organizations for each row execute procedure set_updated_at();
create trigger set_venues_updated_at before update on public.venues for each row execute procedure set_updated_at();
create trigger set_venue_nodes_updated_at before update on public.venue_nodes for each row execute procedure set_updated_at();
create trigger set_venue_edges_updated_at before update on public.venue_edges for each row execute procedure set_updated_at();
create trigger set_simulations_updated_at before update on public.simulations for each row execute procedure set_updated_at();

-- New User Profile Trigger
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- 4. Enable RLS
alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.venues enable row level security;
alter table public.venue_nodes enable row level security;
alter table public.venue_edges enable row level security;
alter table public.venue_versions enable row level security;
alter table public.simulations enable row level security;
alter table public.simulation_snapshots enable row level security;
alter table public.alerts enable row level security;
alter table public.ai_recommendations enable row level security;
alter table public.reports enable row level security;
alter table public.audit_logs enable row level security;

-- 5. RLS Policies

-- Profiles: Users can read and update their own profile
create policy "Users can view own profile" on public.profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);

-- Organizations: Members can read
create policy "Members can view organizations" on public.organizations for select using (public.is_organization_member(id));
-- Allow auth users to create an organization (first user becomes owner)
create policy "Users can create organizations" on public.organizations for insert with check (auth.uid() = created_by);

-- Organization Members: Members can read
create policy "Members can view organization members" on public.organization_members for select using (public.is_organization_member(organization_id));
-- Allow insert during org creation (simplified logic for now)
create policy "Users can insert themselves" on public.organization_members for insert with check (auth.uid() = user_id);

-- Venues: Members can read, Owners/Admins/Operators can write, delete
create policy "Members can view venues" on public.venues for select using (public.is_organization_member(organization_id));
create policy "Authorized can insert venues" on public.venues for insert with check (public.has_organization_role(organization_id, array['owner', 'admin', 'operator']));
create policy "Authorized can update venues" on public.venues for update using (public.has_organization_role(organization_id, array['owner', 'admin', 'operator']));
create policy "Authorized can delete venues" on public.venues for delete using (public.has_organization_role(organization_id, array['owner', 'admin', 'operator']));

-- Venue Nodes & Edges: Follow Venue logic
create policy "Members can view venue_nodes" on public.venue_nodes for select using (exists (select 1 from public.venues v where v.id = venue_id and public.is_organization_member(v.organization_id)));
create policy "Authorized can insert venue_nodes" on public.venue_nodes for insert with check (exists (select 1 from public.venues v where v.id = venue_id and public.has_organization_role(v.organization_id, array['owner', 'admin', 'operator'])));
create policy "Authorized can update venue_nodes" on public.venue_nodes for update using (exists (select 1 from public.venues v where v.id = venue_id and public.has_organization_role(v.organization_id, array['owner', 'admin', 'operator'])));
create policy "Authorized can delete venue_nodes" on public.venue_nodes for delete using (exists (select 1 from public.venues v where v.id = venue_id and public.has_organization_role(v.organization_id, array['owner', 'admin', 'operator'])));

create policy "Members can view venue_edges" on public.venue_edges for select using (exists (select 1 from public.venues v where v.id = venue_id and public.is_organization_member(v.organization_id)));
create policy "Authorized can insert venue_edges" on public.venue_edges for insert with check (exists (select 1 from public.venues v where v.id = venue_id and public.has_organization_role(v.organization_id, array['owner', 'admin', 'operator'])));
create policy "Authorized can update venue_edges" on public.venue_edges for update using (exists (select 1 from public.venues v where v.id = venue_id and public.has_organization_role(v.organization_id, array['owner', 'admin', 'operator'])));
create policy "Authorized can delete venue_edges" on public.venue_edges for delete using (exists (select 1 from public.venues v where v.id = venue_id and public.has_organization_role(v.organization_id, array['owner', 'admin', 'operator'])));

-- Venue Versions
create policy "Members can view venue_versions" on public.venue_versions for select using (exists (select 1 from public.venues v where v.id = venue_id and public.is_organization_member(v.organization_id)));
create policy "Authorized can insert venue_versions" on public.venue_versions for insert with check (exists (select 1 from public.venues v where v.id = venue_id and public.has_organization_role(v.organization_id, array['owner', 'admin', 'operator'])));

-- Simulations: Members can read, Authorized can write
create policy "Members can view simulations" on public.simulations for select using (public.is_organization_member(organization_id));
create policy "Authorized can insert simulations" on public.simulations for insert with check (public.has_organization_role(organization_id, array['owner', 'admin', 'operator']));
create policy "Authorized can update simulations" on public.simulations for update using (public.has_organization_role(organization_id, array['owner', 'admin', 'operator']));

-- Simulation Snapshots: Follow Simulation logic
create policy "Members can view simulation snapshots" on public.simulation_snapshots for select using (exists (select 1 from public.simulations s where s.id = simulation_id and public.is_organization_member(s.organization_id)));
create policy "Authorized can insert simulation snapshots" on public.simulation_snapshots for insert with check (exists (select 1 from public.simulations s where s.id = simulation_id and public.has_organization_role(s.organization_id, array['owner', 'admin', 'operator'])));

-- Alerts: Members can read, Authorized can acknowledge
create policy "Members can view alerts" on public.alerts for select using (public.is_organization_member(organization_id));
create policy "Authorized can insert alerts" on public.alerts for insert with check (public.has_organization_role(organization_id, array['owner', 'admin', 'operator']));
create policy "Authorized can update alerts" on public.alerts for update using (public.has_organization_role(organization_id, array['owner', 'admin', 'operator']));

-- AI Recommendations: Members can read
create policy "Members can view AI recommendations" on public.ai_recommendations for select using (exists (select 1 from public.simulations s where s.id = simulation_id and public.is_organization_member(s.organization_id)));
create policy "Authorized can insert AI recommendations" on public.ai_recommendations for insert with check (exists (select 1 from public.simulations s where s.id = simulation_id and public.has_organization_role(s.organization_id, array['owner', 'admin', 'operator'])));

-- Reports
create policy "Members can view reports" on public.reports for select using (public.is_organization_member(organization_id));
create policy "Authorized can insert reports" on public.reports for insert with check (public.has_organization_role(organization_id, array['owner', 'admin', 'operator']));
create policy "Authorized can update reports" on public.reports for update using (public.has_organization_role(organization_id, array['owner', 'admin', 'operator']));

-- Audit Logs
create policy "Admins can view audit logs" on public.audit_logs for select using (public.has_organization_role(organization_id, array['owner', 'admin']));
create policy "Authorized can insert audit logs" on public.audit_logs for insert with check (public.has_organization_role(organization_id, array['owner', 'admin', 'operator']));

-- 6. Storage Buckets (Optional: run only if superuser, else do manually)
-- insert into storage.buckets (id, name, public) values ('crowdflow-reports', 'crowdflow-reports', false) on conflict do nothing;
-- insert into storage.buckets (id, name, public) values ('crowdflow-assets', 'crowdflow-assets', false) on conflict do nothing;
