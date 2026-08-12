import { DocumentoExcel, ProgramacionSupabase, DocumentoComparado } from '../types/cobranza';

// Función para extraer de manera segura el número de documento
function obtenerNumDoc(doc: DocumentoExcel): string {
  return doc['Número Documento'] || doc['N° Documento'] || doc['Documento'] || doc['numeroDocumento'] || '';
}

// Función para extraer de manera segura el saldo
function obtenerSaldo(doc: DocumentoExcel): number {
  return Number(doc['Saldo'] || doc['Total'] || doc['saldo'] || 0);
}

export function procesarComparativa(
  reporteBase: DocumentoExcel[],                // Excel 05-08
  reporteNuevo: DocumentoExcel[],               // Excel 07-08
  programaciones: Record<string, ProgramacionSupabase> // Data de Supabase
): DocumentoComparado[] {
  
  // Mapa para búsqueda veloz en el reporte nuevo (07-08)
  const mapaNuevo = new Map<string, DocumentoExcel>();
  reporteNuevo.forEach((doc) => {
    const num = obtenerNumDoc(doc);
    if (num) mapaNuevo.set(num, doc);
  });

  return reporteBase.map((docBase) => {
    const numDoc = obtenerNumDoc(docBase);
    const docNuevo = mapaNuevo.get(numDoc);
    const prog = programaciones[numDoc];

    const saldoAnterior = obtenerSaldo(docBase);
    // Si el documento ya no aparece en el reporte 07-08, se asume saldo = 0 (Totalmente cancelado)
    const saldoActual = docNuevo ? obtenerSaldo(docNuevo) : 0; 
    
    const montoProgramado = prog ? Number(prog.monto_programado) : 0;
    const montoPagadoReal = Math.max(0, saldoAnterior - saldoActual);

    // Evaluación de cumplimiento
    let estadoCumplimiento: DocumentoComparado['estadoCumplimiento'] = 'SIN_PROGRAMACION';

    if (montoProgramado > 0) {
      if (saldoActual === 0 || montoPagadoReal >= montoProgramado) {
        estadoCumplimiento = 'CUMPLIDO';
      } else if (montoPagadoReal > 0) {
        estadoCumplimiento = 'PARCIAL';
      } else {
        estadoCumplimiento = 'INCUMPLIDO';
      }
    }

    return {
      numeroDocumento: numDoc,
      mora: docBase['Mora'] || docBase['mora'] || 'Al día',
      saldoAnterior,
      saldoActual,
      montoProgramado,
      canalPago: prog?.canal_pago || 'Transferencia BCP',
      fechaProgramada: prog?.fecha_programada || new Date().toISOString().split('T')[0],
      montoPagadoReal,
      estadoCumplimiento
    };
  });
}