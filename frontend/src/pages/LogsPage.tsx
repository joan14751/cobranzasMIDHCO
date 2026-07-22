import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient' // Asegúrate de apuntar a tu cliente de Supabase
import { Clock, User, Layers, ArrowRight, Tag } from 'lucide-react'

interface LogAuditoria {
  id: string
  tabla_afectada: string
  operacion: 'INSERT' | 'UPDATE' | 'DELETE'
  registro_id: string
  valores_anteriores: any
  valores_nuevos: any
  creado_at: string
  // Si deseas traer el correo del usuario, puedes hacer un join con perfiles si tienes esa tabla, 
  // o por ahora mostraremos el ID directo o metadatos.
  realizado_por: string 
}

export default function LogsPage() {
  const [logs, setLogs] = useState<LogAuditoria[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        setLoading(true)
        // Traemos los logs ordenados por fecha más reciente
        const { data, error } = await supabase
          .from('auditoria_logs')
          .select('*')
          .order('creado_at', { ascending: false })
          .limit(50) // Limitar a los últimos 50 movimientos

        if (error) throw error
        setLogs(data || [])
      } catch (err) {
        console.error("Error cargando logs de auditoría:", err)
      } finally {
        setLoading(false)
      }
    }

    fetchLogs()
  }, [])

  const getOperacionStyle = (op: string) => {
    switch (op) {
      case 'INSERT': return 'bg-green-50 text-green-700 border-green-200'
      case 'UPDATE': return 'bg-amber-50 text-amber-700 border-amber-200'
      case 'DELETE': return 'bg-red-50 text-red-700 border-red-200'
      default: return 'bg-gray-50 text-gray-700 border-gray-200'
    }
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Clock className="h-6 w-6 text-slate-600" /> Historial de Auditoría
        </h1>
        <p className="text-xs md:text-sm text-gray-500">Registro en tiempo real de todas las modificaciones hechas en el sistema.</p>
      </div>

      {loading ? (
        <div className="space-y-3 animate-pulse">
          <div className="h-16 bg-gray-100 rounded-xl w-full" />
          <div className="h-16 bg-gray-100 rounded-xl w-full" />
          <div className="h-16 bg-gray-100 rounded-xl w-full" />
        </div>
      ) : logs.length === 0 ? (
        <div className="text-center py-12 text-sm text-gray-400">No se han registrado modificaciones aún.</div>
      ) : (
        <div className="flex flex-col gap-4">
          {logs.map((log) => (
            <div key={log.id} className="border border-gray-100 rounded-2xl bg-white p-4 shadow-sm space-y-3">
              {/* Header del Log */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-0.5 text-xs font-bold rounded-md border ${getOperacionStyle(log.operacion)}`}>
                    {log.operacion}
                  </span>
                  <span className="text-sm font-semibold text-gray-700 flex items-center gap-1">
                    <Layers className="h-3.5 w-3.5 text-gray-400" /> Tabla: {log.tabla_afectada}
                  </span>
                </div>
                <span className="text-xs text-gray-400 font-medium">
                  {new Date(log.creado_at).toLocaleString('es-PE')}
                </span>
              </div>

              {/* Detalles del Cambio */}
              <div className="bg-slate-50 p-3 rounded-xl text-xs space-y-2 font-mono text-gray-600 overflow-x-auto">
                <div>Ref ID: <span className="text-gray-900 font-bold">{log.registro_id}</span></div>
                
                {log.operacion === 'UPDATE' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                    <div>
                      <p className="font-semibold text-red-500 mb-1">Antes:</p>
                      <pre className="whitespace-pre-wrap">{JSON.stringify(log.valores_anteriores, null, 2)}</pre>
                    </div>
                    <div>
                      <p className="font-semibold text-green-600 mb-1">Después:</p>
                      <pre className="whitespace-pre-wrap">{JSON.stringify(log.valores_nuevos, null, 2)}</pre>
                    </div>
                  </div>
                )}

                {log.operacion === 'INSERT' && (
                  <div>
                    <p className="font-semibold text-green-600 mb-1">Registro Creado:</p>
                    <pre className="whitespace-pre-wrap">{JSON.stringify(log.valores_nuevos, null, 2)}</pre>
                  </div>
                )}

                {log.operacion === 'DELETE' && (
                  <div>
                    <p className="font-semibold text-red-600 mb-1">Registro Eliminado:</p>
                    <pre className="whitespace-pre-wrap">{JSON.stringify(log.valores_anteriores, null, 2)}</pre>
                  </div>
                )}
              </div>

              {/* Responsable */}
              <div className="flex items-center gap-1.5 text-xs text-gray-400 pt-1 border-t border-gray-50">
                <User className="h-3.5 w-3.5" />
                <span>Usuario UUID: <strong className="text-gray-500 font-mono">{log.realizado_por || 'Sistema/Anónimo'}</strong></span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}