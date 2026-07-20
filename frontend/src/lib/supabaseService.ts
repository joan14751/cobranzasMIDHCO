import { supabase } from './supabaseClient'
import { Cliente, Documento, Pago } from '../types'
import { parseCobranzaExcelFile } from './excelService'

// Interfaz para el tipado correcto de las filas del Excel parseado
interface ParsedCobranzaRow {
  razon_social?: string;
  cliente?: string;
  codigo_socio?: string;
  ruc_dni?: string;
  importe?: number;
  saldo?: number;
  estado?: string;
}

// Nota: Asegúrate de tener instalado o importado tu proveedor de notificaciones (ej: react-hot-toast o react-toastify)
// si usas la variable global toast. De lo contrario, puedes definir un mock básico:
const toast = (globalThis as any).toast || {
  success: (msg: string) => console.log(`[Toast Success] ${msg}`),
  error: (msg: string) => console.error(`[Toast Error] ${msg}`)
}

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

// --- MÉTRICAS COMPLETA DE DASHBOARD DINÁMICO ---

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
        clientesLista: listaClientes.slice(0, 5),
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
  nombreDocumento?: string
): Promise<{ data: Documento | null; error: string | null }> => {
  if (!isSupabaseReady()) return { data: null, error: 'Supabase no configurado.' }

  try {
    const fileExtension = file.name.split('.').pop() || 'pdf'
    const cleanFileName = file.name.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9]/g, "_")
    const storagePath = `${Date.now()}_${cleanFileName}.${fileExtension}`

    // Subir a Storage
    const { error: storageError } = await supabase.storage
      .from('documentos')
      .upload(storagePath, file, { cacheControl: '3600', upsert: true })

    if (storageError) throw new Error(`Storage: ${storageError.message}`)

    const { data: urlData } = supabase.storage.from('documentos').getPublicUrl(storagePath)

    // Guardar en BD (Utilizando las columnas estándar 'nombre', 'ruta_archivo' y 'url_archivo')
    const dbPayload = {
      nombre: nombreDocumento || file.name,
      ruta_archivo: storagePath,
      url_archivo: urlData?.publicUrl || '',
      fecha_carga: new Date().toISOString(),
    }

    const { data: dbData, error: dbError } = await supabase
      .from('documentos')
      .insert([dbPayload])
      .select()
      .single()

    if (dbError) {
      await supabase.storage.from('documentos').remove([storagePath])
      throw new Error(`Base de Datos: ${dbError.message}`)
    }

    // PROCESAMIENTO DEL EXCEL (CON CORRECCIONES Y FILTRADO ANTI-ERRORES)
    if (file.name.match(/\.(xls|xlsx)$/i)) {
      try {
        console.log('🚀 Iniciando procesamiento de Excel:', file.name)
        const parsedRows = await parseCobranzaExcelFile(file)
        console.log('✅ Filas parseadas:', parsedRows.length)
        
        if (parsedRows.length > 0) {
          console.log('Ejemplo de fila original del Excel:', parsedRows[0])
        }
        
        // Mapeamos asegurando que NUNCA se envíen campos críticos como undefined o vacíos
        const clientesToInsert = parsedRows
          .map((row: ParsedCobranzaRow, index: number) => {
            const nombre = (row.razon_social || row.cliente || '').trim() || 'Cliente sin nombre';
            // Si no hay código o ruc, generamos uno único combinando el tiempo y el índice de la fila
            const numero_credito = (row.codigo_socio || row.ruc_dni || '').trim() || `AUTO-${Date.now()}-${index}`;
            
            // Homologación de Estado estricto para saltar el Check Constraint "clientes_estado_check"
            // Traduce palabras clave a "En Mora", de lo contrario por defecto se le asigna "Al Día"
            const rawEstado = (row.estado || '').toLowerCase().trim();
            let estadoHomologado = 'Al Día';
            
            if (rawEstado.includes('mora') || rawEstado.includes('vencid') || rawEstado.includes('atras')) {
              estadoHomologado = 'En Mora';
            }

            return {
              nombre,
              numero_credito,
              monto_total: Number(row.importe) || 0,
              saldo_pendiente: Number(row.saldo) || 0,
              estado: estadoHomologado, 
            }
          })
          // Filtro extra: Evitamos enviar objetos corruptos
          .filter(c => c.numero_credito && c.nombre);

        console.log('Clientes listos para insertar limpios:', clientesToInsert.length)
        
        if (clientesToInsert.length > 0) {
          // Intentamos la inserción mediante upsert masivo
          const { error, data } = await supabase
            .from('clientes')
            .upsert(clientesToInsert, { onConflict: 'numero_credito' })
            .select()
            
          if (error) {
            console.error('❌ Error detallado de Supabase al insertar clientes:', error)
            toast.error(`Error de Base de Datos: ${error.message}`)
          } else {
            console.log('✅ ¡Clientes insertados con éxito en Supabase! Cantidad:', data?.length || 0)
            toast.success(`¡Procesados e insertados ${data?.length || 0} registros con éxito!`)
          }
        }
      } catch (excelError) {
        console.error('❌ Error crítico procesando Excel:', excelError)
        toast.error('No se pudo procesar el archivo Excel')
      }
    }

    return { data: dbData as Documento, error: null }
  } catch (error: any) {
    console.error('Error al subir:', error)
    return { data: null, error: error.message }
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
      console.warn(`Advertencia: El archivo en Storage "${storagePath}" no pudo ser eliminado.`);
    }

    return { error: null };
  } catch (error: any) {
    console.error('Error al eliminar documento completo:', error);
    return { error: error.message || 'Error desconocido al eliminar.' };
  }
}

// --- DASHBOARD BASADO EN EXCEL (ÚLTIMO DOCUMENTO) ---

export const getDashboardMetricsFromExcel = async () => {
  if (!isSupabaseReady()) {
    return { data: null, error: 'Supabase no está configurado.' }
  }

  try {
    console.log('📊 Solicitando métricas del Dashboard desde la base de datos...')

    // 1. Validar si existen documentos registrados
    const { data: docs, error: errorDocs } = await supabase
      .from('documentos')
      .select('*')
      .order('fecha_carga', { ascending: false })
      .limit(1);

    if (errorDocs) throw errorDocs;

    console.log('📄 Último documento encontrado:', docs?.[0] || 'Ninguno');

    // 2. Traer todos los clientes cargados por el Excel
    const { data: clientes, error: errorClientes } = await supabase
      .from('clientes')
      .select('*');

    if (errorClientes) throw errorClientes;

    const listaClientes = (clientes as Cliente[]) || [];
    console.log('👥 Total de clientes recuperados para el Dashboard:', listaClientes.length);

    // Calcular totales basados en los datos reales insertados
    const saldoPendienteTotal = listaClientes.reduce((sum, c) => sum + (Number(c.saldo_pendiente) || 0), 0);
    const clientesEnMora = listaClientes.filter(c => (c.estado || '').toLowerCase().includes('mora')).length;
    const clientesAlDia = listaClientes.length - clientesEnMora;

    return {
      data: {
        clientesActivos: listaClientes.length,
        saldoPendienteTotal,
        clientesEnMora,
        totalDeuda: saldoPendienteTotal,
        datosEstado: [
          { name: 'Al Día', value: clientesAlDia, color: '#10B981' },
          { name: 'En Mora', value: clientesEnMora, color: '#EF4444' },
        ],
      },
      error: null
    };
  } catch (err: any) {
    console.error('❌ Error en getDashboardMetricsFromExcel:', err);
    return { data: null, error: err.message || 'Error al compilar métricas desde Excel.' };
  }
}