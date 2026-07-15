export interface Profile {
  id: string;
  full_name: string;
  role: 'admin' | 'usuario';
  avatar_url?: string;
}

export interface Cliente {
  id: string;
  nombre: string;
  numero_credito: string;
  email?: string;
  telefono?: string;
  direccion?: string;
  monto_total: number;
  saldo_pendiente: number;
  estado: string;
  created_at: string;
}

export interface Pago {
  id: string;
  cliente_id: string;
  documento_id?: string;
  numero_cuota: number;
  fecha_vencimiento: string;
  monto_cuota: number;
  pago_realizado: number;
  fecha_pago?: string;
  dias_atraso: number;
  estado: string;
}

export interface Documento {
  id: string;
  cliente_id: string;
  nombre_archivo: string;
  storage_path: string;
  numero_credito?: string;
  monto_total?: number;
  fecha_carga: string;
}

export interface RecomendacionML {
  id: string;
  cliente_id: string;
  probabilidad_pago: number;
  nivel_riesgo: string;
  recomendacion: string;
  estado_recomendado: string;
  fecha_analisis: string;
}
