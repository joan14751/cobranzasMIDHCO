import { supabase } from '../lib/supabaseClient'; 
import { ProgramacionSupabase } from '../types/cobranza';

// Obtener todas las programaciones guardadas
export async function obtenerProgramaciones(): Promise<Record<string, ProgramacionSupabase>> {
  const { data, error } = await supabase
    .from('programaciones_cuotas')
    .select('*');

  if (error) {
    console.error('Error al cargar programaciones de Supabase:', error);
    return {};
  }

  // Convertir el array a un mapa mapeado por numero_documento con tipado seguro
  const mapa: Record<string, ProgramacionSupabase> = {};
  (data || []).forEach((p: ProgramacionSupabase) => {
    mapa[p.numero_documento] = p;
  });

  return mapa;
}

// Guardar o Actualizar una programación (Upsert)
export async function guardarProgramacion(programacion: ProgramacionSupabase) {
  const { data, error } = await supabase
    .from('programaciones_cuotas')
    .upsert(
      {
        numero_documento: programacion.numero_documento,
        monto_programado: programacion.monto_programado,
        canal_pago: programacion.canal_pago,
        fecha_programada: programacion.fecha_programada,
      },
      { onConflict: 'numero_documento' }
    );

  if (error) {
    console.error('Error guardando en Supabase:', error);
    throw error;
  }

  return data;
}