import { DocumentoReporte, ProgramacionCuota, DocumentoComparado } from '../types/cobranza';

export function compararReportesCobranza(
  reporteBase: DocumentoReporte[],         // Data del 05-08
  programaciones: Record<string, ProgramacionCuota>, // Cuotas programadas por ID
  reporteNuevo: DocumentoReporte[]          // Data del 07-08
): DocumentoComparado[] {
  
  // Mapa auxiliar para buscar rápido en el nuevo reporte
  const mapaNuevo = new Map<string, DocumentoReporte>();
  reporteNuevo.forEach((doc) => mapaNuevo.set(doc.id, doc));

  return reporteBase.map((docBase) => {
    const docNuevo = mapaNuevo.get(docBase.id);
    const prog = programaciones[docBase.id];

    const saldoAnterior = docBase.saldo;
    // Si el documento ya no aparece en el reporte 07-08, su saldo actual es 0 (se pagó todo)
    const saldoActual = docNuevo ? docNuevo.saldo : 0; 
    const montoProgramado = prog ? prog.montoProgramado : 0;
    
    // Lo que realmente abonó entre un reporte y otro
    const montoPagadoReal = Math.max(0, saldoAnterior - saldoActual);

    // Determinamos el estado de cumplimiento
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
      ...docBase,
      saldoAnterior,
      saldoActual,
      montoProgramado,
      montoPagadoReal,
      estadoCumplimiento,
      canalPago: prog?.canalPago || docBase.canalPago || 'Transferencia BCP',
      fecha: prog?.fechaProgramada || docBase.fecha || ''
    };
  });
}