export interface DocumentoExcel {
  'Número Documento'?: string;
  'N° Documento'?: string;
  'Documento'?: string;
  'Mora'?: string;
  'Saldo'?: number;
  'Total'?: number;
  [key: string]: any;
}

export interface ProgramacionSupabase {
  id?: string;
  numero_documento: string;
  monto_programado: number;
  canal_pago: string;
  fecha_programada: string;
}

export interface DocumentoComparado {
  numeroDocumento: string;
  mora: string;
  saldoAnterior: number;     // Saldo Reporte 05-08
  saldoActual: number;       // Saldo Reporte 07-08
  montoProgramado: number;   // Viene de Supabase
  canalPago: string;         // Viene de Supabase
  fechaProgramada: string;   // Viene de Supabase
  montoPagadoReal: number;   // Saldo Anterior - Saldo Actual
  estadoCumplimiento: 'CUMPLIDO' | 'PARCIAL' | 'INCUMPLIDO' | 'SIN_PROGRAMACION';
}