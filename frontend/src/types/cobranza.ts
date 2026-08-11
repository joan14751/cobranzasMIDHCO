export interface DocumentoReporte {
  id: string;             // Ej: "01-F241-054213"
  mora: string;           // Ej: "6 d." o "Al día"
  saldo: number;          // Saldo leído de la data
  canalPago?: string;     // Ej: "Transferencia BCP"
  fecha?: string;         // Fecha de la programación
}

export interface ProgramacionCuota {
  documentoId: string;
  montoProgramado: number;
  canalPago: string;
  fechaProgramada: string;
}

export interface DocumentoComparado extends DocumentoReporte {
  saldoAnterior: number;       // Saldo en el primer reporte (05-08)
  saldoActual: number;         // Saldo en el segundo reporte (07-08)
  montoProgramado: number;     // Cuota pactada
  montoPagadoReal: number;     // Diferencia pagada (saldoAnterior - saldoActual)
  estadoCumplimiento: 'CUMPLIDO' | 'PARCIAL' | 'INCUMPLIDO' | 'SIN_PROGRAMACION';
}