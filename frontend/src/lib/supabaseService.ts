import { supabase } from './supabaseClient'
import { Cliente, Documento, Pago } from '../types'

export type ClienteFormValues = Omit<Cliente, 'id' | 'created_at'> & { id?: string }

export const isSupabaseReady = () => {
  const url = import.meta.env.VITE_SUPABASE_URL
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY
  return Boolean(url && key && url !== 'https://placeholder.supabase.co')
}

// --- SERVICIO DE CLIENTES ---

export const getClientes = async (): Promise<{ data: Cliente[] | null; error: string | null }> => {
  if (!isSupabaseReady()) {
    return { data: [], error: 'Supabase no está configurado. Completa las variables VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.' }
  }

  const { data, error } = await supabase.from('clientes').select('*').order('created_at', { ascending: false })
  if (error) return { data: null, error: error.message }
  return { data: (data as Cliente[]) || [], error: null }
}

export const saveCliente = async (cliente: ClienteFormValues): Promise<{ data: Cliente | null; error: string | null }> => {
  if (!isSupabaseReady()) {
    return { data: null, error: 'Supabase no está configurado.' }
  }

  const payload = {
    id: cliente.id,
    nombre: cliente.nombre,
    numero_credito: cliente.numero_credito,
    email: cliente.email || null,
    telefono: cliente.telefono || null,
    direccion: cliente.direccion || null,
    monto_total: cliente.monto_total,
    saldo_pendiente: cliente.saldo_pendiente,
    estado: cliente.estado,
  }

  const { data, error } = await supabase.from('clientes').upsert(payload, { onConflict: 'id' }).select().single()
  if (error) return { data: null, error: error.message }
  return { data: data as Cliente, error: null }
}

export const deleteCliente = async (id: string): Promise<{ error: string | null }> => {
  if (!isSupabaseReady()) {
    return { error: 'Supabase no está configurado.' }
  }

  const { error } = await supabase.from('clientes').delete().eq('id', id)
  if (error) return { error: error.message }
  return { error: null }
}

// --- SERVICIO DE PAGOS ---

export const getPagos = async (): Promise<{ data: Pago[] | null; error: string | null }> => {
  if (!isSupabaseReady()) {
    return { data: [], error: 'Supabase no está configurado.' }
  }

  const { data, error } = await supabase.from('pagos').select('*').order('fecha_vencimiento', { ascending: true })
  if (error) return { data: null, error: error.message }
  return { data: (data as Pago[]) || [], error: null }
}

// --- NUEVO: MÉTRICAS COMPLETA DE DASHBOARD DINÁMICO ---

export const getDashboardMetrics = async () => {
  if (!isSupabaseReady()) {
    return { data: null, error: 'Supabase no está configurado.' }
  }

  try {
    // 1. Obtener todos los clientes
    const { data: clientes, error: errorClientes } = await supabase
      .from('clientes')
      .select('*')
      .order('created_at', { ascending: false });

    if (errorClientes) throw errorClientes;

    const listaClientes = (clientes as Cliente[]) || [];
    const clientesActivos = listaClientes.length;

    // Calcular el saldo pendiente sumando la propiedad 'saldo_pendiente'
    const saldoPendienteTotal = listaClientes.reduce((sum, c) => sum + (Number(c.saldo_pendiente) || 0), 0);

    // 2. Clasificar clientes según su estado
    const estadosCount = { 'Al Día': 0, 'En Mora': 0, 'Atrasados': 0 };
    listaClientes.forEach((cli) => {
      const est = (cli.estado || '').toLowerCase();
      if (est.includes('mora')) {
        estadosCount['En Mora']++;
      } else if (est.includes('atrasado') || est.includes('atraso')) {
        estadosCount['Atrasados']++;
      } else {
        estadosCount['Al Día']++;
      }
    });

    const datosEstadoClientes = [
      { name: 'Al Día', value: estadosCount['Al Día'], color: '#10B981' },
      { name: 'En Mora', value: estadosCount['En Mora'], color: '#EF4444' },
      { name: 'Atrasados', value: estadosCount['Atrasados'], color: '#F59E0B' },
    ];

    // 3. Obtener histórico de pagos para flujo mensual
    const { data: pagosData } = await supabase
      .from('pagos')
      .select('*')
      .order('fecha_vencimiento', { ascending: true });

    const pagos = (pagosData as Pago[]) || [];
    const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const agrupado: Record<string, { Cobrado: number; Pendiente: number }> = {};

    // Inicializar los últimos 6 meses de forma dinámica
    const hoy = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
      agrupado[meses[d.getMonth()]] = { Cobrado: 0, Pendiente: 0 };
    }

    // Agrupar pagos en los meses correspondientes
    pagos.forEach((pago) => {
      if (!pago.fecha_vencimiento) return;
      const fecha = new Date(pago.fecha_vencimiento);
      const nombreMes = meses[fecha.getMonth()];

      if (agrupado[nombreMes] !== undefined) {
        // CORRECCIÓN: Asignación segura con cast a 'any' para evitar que TypeScript falle si 'monto' no está en la interfaz 'Pago'
        const monto = Number((pago as any).monto) || 0;
        const completado = (pago.estado || '').toLowerCase() === 'pagado' || (pago.estado || '').toLowerCase() === 'completado';
        
        if (completado) {
          agrupado[nombreMes].Cobrado += monto;
        } else {
          agrupado[nombreMes].Pendiente += monto;
        }
      }
    });

    // Si no tienes pagos en tu tabla aún, dejamos el saldo de cartera en el mes actual como pendiente para evitar vacíos
    const mesActual = meses[hoy.getMonth()];
    if (agrupado[mesActual] && agrupado[mesActual].Pendiente === 0) {
      agrupado[mesActual].Pendiente = saldoPendienteTotal;
    }

    const datosPagosMensuales = Object.keys(agrupado).map((mes) => ({
      mes,
      Cobrado: agrupado[mes].Cobrado,
      Pendiente: agrupado[mes].Pendiente,
    }));

    return {
      data: {
        clientesActivos,
        saldoPendienteTotal,
        clientesLista: listaClientes.slice(0, 5), // Mandar solo los últimos 5 para la tabla del Dashboard
        datosEstadoClientes,
        datosPagosMensuales,
      },
      error: null,
    };
  } catch (err: any) {
    return { data: null, error: err.message || 'Error al compilar métricas.' };
  }
}

// --- SERVICIO DE STORAGE Y TABLA DE DOCUMENTOS ---

export const getDocumentos = async (): Promise<{ data: Documento[] | null; error: string | null }> => {
  if (!isSupabaseReady()) {
    return { data: [], error: 'Supabase no está configurado.' }
  }

  const { data, error } = await supabase.from('documentos').select('*').order('fecha_carga', { ascending: false })
  if (error) return { data: null, error: error.message }
  return { data: (data as Documento[]) || [], error: null }
}

export const uploadDocumentoCompleto = async (
  file: File,
  nombreDocumento: string,
  clienteId?: string
): Promise<{ data: Documento | null; error: string | null }> => {
  if (!isSupabaseReady()) {
    return { data: null, error: 'Supabase no está configurado.' }
  }

  try {
    const fileExtension = file.name.split('.').pop();
    const cleanFileName = file.name.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9]/g, "_");
    const storagePath = `${Date.now()}_${cleanFileName}.${fileExtension}`;

    const { error: storageError } = await supabase.storage
      .from('documentos')
      .upload(storagePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (storageError) throw new Error(`Error en Storage: ${storageError.message}`);

    const { data: urlData } = supabase.storage
      .from('documentos')
      .getPublicUrl(storagePath);

    if (!urlData?.publicUrl) throw new Error('No se pudo generar la URL pública del archivo.');

    const dbPayload = {
      nombre: nombreDocumento || file.name,
      ruta_archivo: storagePath,
      url_archivo: urlData.publicUrl,
      cliente_id: clienteId || null,
      fecha_carga: new Date().toISOString()
    };

    const { data: dbData, error: dbError } = await supabase
      .from('documentos')
      .insert([dbPayload])
      .select()
      .single();

    if (dbError) {
      await supabase.storage.from('documentos').remove([storagePath]);
      throw new Error(`Error en Base de Datos: ${dbError.message}`);
    }

    return { data: dbData as Documento, error: null };
  } catch (error: any) {
    console.error('Error al subir documento completo:', error);
    return { data: null, error: error.message || 'Error desconocido al procesar el archivo.' };
  }
}

export const deleteDocumentoCompleto = async (
  id: string,
  storagePath: string
): Promise<{ error: string | null }> => {
  if (!isSupabaseReady()) {
    return { error: 'Supabase no está configurado.' }
  }

  try {
    const { error: dbError } = await supabase
      .from('documentos')
      .delete()
      .eq('id', id);

    if (dbError) throw new Error(`Error al eliminar en Base de Datos: ${dbError.message}`);

    const { error: storageError } = await supabase.storage
      .from('documentos')
      .remove([storagePath]);

    if (storageError) {
      console.warn(`Advertencia: El registro se borró de la BD pero el archivo en Storage "${storagePath}" no pudo ser eliminado.`);
    }

    return { error: null };
  } catch (error: any) {
    console.error('Error al eliminar documento completo:', error);
    return { error: error.message || 'Error desconocido al eliminar.' };
  }
}