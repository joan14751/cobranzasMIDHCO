create extension if not exists pgcrypto;

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role text not null default 'usuario' check (role in ('admin','usuario')),
  avatar_url text,
  created_at timestamptz default now()
);

create table if not exists clientes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  numero_credito text not null unique,
  email text,
  telefono text,
  direccion text,
  monto_total numeric not null default 0,
  saldo_pendiente numeric not null default 0,
  estado text not null default 'activo',
  created_at timestamptz default now()
);

create table if not exists pagos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid references clientes(id) on delete cascade,
  documento_id uuid,
  numero_cuota int not null,
  fecha_vencimiento date not null,
  monto_cuota numeric not null,
  pago_realizado numeric not null default 0,
  fecha_pago date,
  dias_atraso int not null default 0,
  estado text not null default 'pendiente'
);

create table if not exists documentos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid references clientes(id) on delete cascade,
  nombre_archivo text not null,
  storage_path text not null,
  numero_credito text,
  monto_total numeric,
  fecha_carga timestamptz default now()
);

create table if not exists recomendaciones_ml (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid references clientes(id) on delete cascade,
  probabilidad_pago numeric not null,
  nivel_riesgo text not null,
  recomendacion text not null,
  estado_recomendado text not null,
  fecha_analisis timestamptz default now()
);

create policy "Allow users to view profiles" on profiles
  for select using (true);

create policy "Allow users to update own profile" on profiles
  for update using (auth.uid() = id);

create policy "Allow authenticated users to view clientes" on clientes
  for select using (auth.role() = 'authenticated');

create policy "Allow authenticated users to insert clientes" on clientes
  for insert with check (auth.role() = 'authenticated');

create policy "Allow authenticated users to update clientes" on clientes
  for update using (auth.role() = 'authenticated');

create policy "Allow authenticated users to delete clientes" on clientes
  for delete using (auth.role() = 'authenticated');

create policy "Allow authenticated users to view pagos" on pagos
  for select using (auth.role() = 'authenticated');

create policy "Allow authenticated users to view documentos" on documentos
  for select using (auth.role() = 'authenticated');

create policy "Allow authenticated users to view recommendations" on recomendaciones_ml
  for select using (auth.role() = 'authenticated');
