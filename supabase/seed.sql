insert into clientes (id, nombre, numero_credito, email, telefono, direccion, monto_total, saldo_pendiente, estado)
values
  ('11111111-1111-1111-1111-111111111111', 'Ana Pérez', 'CR-1001', 'ana@example.com', '3001111111', 'Calle 1 # 10-20', 1500000, 450000, 'activo'),
  ('22222222-2222-2222-2222-222222222222', 'Luis Gómez', 'CR-1002', 'luis@example.com', '3002222222', 'Carrera 2 # 20-30', 900000, 300000, 'moroso'),
  ('33333333-3333-3333-3333-333333333333', 'Marta Ruiz', 'CR-1003', 'marta@example.com', '3003333333', 'Avenida 3 # 30-40', 2200000, 700000, 'en_reestructuracion')
on conflict (id) do nothing;

insert into pagos (cliente_id, numero_cuota, fecha_vencimiento, monto_cuota, pago_realizado, dias_atraso, estado)
values
  ('11111111-1111-1111-1111-111111111111', 1, '2026-07-15', 150000, 150000, 0, 'pagado'),
  ('22222222-2222-2222-2222-222222222222', 1, '2026-07-10', 150000, 50000, 5, 'pendiente'),
  ('33333333-3333-3333-3333-333333333333', 1, '2026-07-20', 180000, 0, 10, 'pendiente')
on conflict do nothing;

insert into documentos (cliente_id, nombre_archivo, storage_path, numero_credito, monto_total)
values
  ('11111111-1111-1111-1111-111111111111', 'contrato_ana.pdf', 'documents/ana/contrato_ana.pdf', 'CR-1001', 1500000),
  ('22222222-2222-2222-2222-222222222222', 'contrato_luis.pdf', 'documents/luis/contrato_luis.pdf', 'CR-1002', 900000)
on conflict do nothing;

insert into recomendaciones_ml (cliente_id, probabilidad_pago, nivel_riesgo, recomendacion, estado_recomendado)
values
  ('11111111-1111-1111-1111-111111111111', 0.84, 'bajo', 'Contactar con estrategia de seguimiento.', 'contactar'),
  ('22222222-2222-2222-2222-222222222222', 0.31, 'alto', 'Reestructurar o renegociar la deuda.', 'reestructurar')
on conflict do nothing;
