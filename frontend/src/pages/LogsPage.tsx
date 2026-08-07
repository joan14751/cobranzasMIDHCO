import React, { useState, useEffect, useMemo } from 'react'
import { 
  History, Search, ShieldAlert, CheckCircle2, 
  FileSpreadsheet, User, Filter, Download, Trash2, Edit3, PlusCircle 
} from 'lucide-react'
import * as XLSX from 'xlsx'

export interface LogAuditoria {
  id: string
  fechaHora: string
  usuario: string
  rol: string
  modulo: 'Pagos' | 'Documentos' | 'Rutas' | 'Clientes' | 'Sistema'
  accion: 'CREAR' | 'EDITAR' | 'ELIMINAR' | 'CARGA_EXCEL'
  descripcion: string
  ip: string
}

/**
 * Función auxiliar exportada para registrar eventos en tiempo real desde 
 * cualquier parte de la aplicación (Documentos, Pagos, Clientes, etc.)
 */
export const registrarLogAuditoria = (
  usuario: string,
  rol: string,
  modulo: LogAuditoria['modulo'],
  accion: LogAuditoria['accion'],
  descripcion: string
) => {
  const logsGuardados: LogAuditoria[] = JSON.parse(localStorage.getItem('midhco_audit_logs') || '[]')
  
  const nuevoLog: LogAuditoria = {
    id: `log-${Date.now()}`,
    fechaHora: new Date().toLocaleString('es-PE', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }),
    usuario,
    rol,
    modulo,
    accion,
    descripcion,
    ip: 'Local'
  }

  const listaActualizada = [nuevoLog, ...logsGuardados]
  localStorage.setItem('midhco_audit_logs', JSON.stringify(listaActualizada))

  // Notificar a otras pantallas/componentes sobre el cambio
  window.dispatchEvent(new Event('storage_audit_update'))
}

export default function LogsPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [moduloFilter, setModuloFilter] = useState('TODOS')
  const [accionFilter, setAccionFilter] = useState('TODAS')
  const [logs, setLogs] = useState<LogAuditoria[]>([])

  // Función para obtener logs actualizados
  const cargarLogs = () => {
    const savedLogs = localStorage.getItem('midhco_audit_logs')
    if (savedLogs) {
      setLogs(JSON.parse(savedLogs))
    } else {
      setLogs([])
    }
  }

  useEffect(() => {
    cargarLogs()

    // Listener para actualizar el listado cuando se añada un log desde otra pantalla
    const handleUpdate = () => cargarLogs()
    window.addEventListener('storage_audit_update', handleUpdate)
    window.addEventListener('storage', handleUpdate)

    return () => {
      window.removeEventListener('storage_audit_update', handleUpdate)
      window.removeEventListener('storage', handleUpdate)
    }
  }, [])

  // Limpiar el historial
  const limpiarHistorial = () => {
    if (window.confirm('¿Seguro que deseas borrar el historial de auditoría?')) {
      localStorage.removeItem('midhco_audit_logs')
      setLogs([])
    }
  }

  // Filtrado de logs según controles de la UI
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const matchModulo = moduloFilter === 'TODOS' || log.modulo === moduloFilter
      const matchAccion = accionFilter === 'TODAS' || log.accion === accionFilter
      
      const term = searchTerm.toLowerCase().trim()
      const matchSearch = !term || 
        log.usuario.toLowerCase().includes(term) ||
        log.descripcion.toLowerCase().includes(term) ||
        log.modulo.toLowerCase().includes(term)

      return matchModulo && matchAccion && matchSearch
    })
  }, [logs, moduloFilter, accionFilter, searchTerm])

  // Exportar logs a un archivo Excel
  const exportAuditoriaExcel = () => {
    if (filteredLogs.length === 0) return
    const dataToExport = filteredLogs.map(l => ({
      'Fecha y Hora': l.fechaHora,
      'Usuario': l.usuario,
      'Rol': l.rol,
      'Módulo': l.modulo,
      'Acción': l.accion,
      'Descripción': l.descripcion,
      'Origen': l.ip
    }))
    const worksheet = XLSX.utils.json_to_sheet(dataToExport)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Auditoria')
    XLSX.writeFile(workbook, `Auditoria_Midhco_${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  const getBadgeAccion = (accion: LogAuditoria['accion']) => {
    switch (accion) {
      case 'CREAR':
        return <span className="inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded text-[10px] font-bold"><PlusCircle className="h-3 w-3"/> Crear</span>
      case 'EDITAR':
        return <span className="inline-flex items-center gap-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded text-[10px] font-bold"><Edit3 className="h-3 w-3"/> Editar</span>
      case 'ELIMINAR':
        return <span className="inline-flex items-center gap-1 bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded text-[10px] font-bold"><Trash2 className="h-3 w-3"/> Eliminar</span>
      case 'CARGA_EXCEL':
        return <span className="inline-flex items-center gap-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded text-[10px] font-bold"><FileSpreadsheet className="h-3 w-3"/> Excel</span>
    }
  }

  return (
    <div className="space-y-4 p-4 text-xs font-sans text-gray-200">
      
      {/* CABECERA */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-slate-900/80 p-4 rounded-2xl border border-slate-800 shadow-sm backdrop-blur">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <History className="h-5 w-5 text-blue-400" /> Historial de Auditoría
          </h1>
          <p className="text-gray-400 text-[11px]">Registro en tiempo real de todas las modificaciones hechas en el sistema.</p>
        </div>

        <div className="flex items-center gap-2">
          {logs.length > 0 && (
            <button 
              onClick={limpiarHistorial}
              className="flex items-center gap-1 px-3 py-1.5 bg-red-900/40 hover:bg-red-800/60 text-red-300 border border-red-700/50 rounded-xl font-medium transition"
            >
              <Trash2 className="h-3.5 w-3.5" /> Limpiar Historial
            </button>
          )}

          <button 
            onClick={exportAuditoriaExcel}
            disabled={filteredLogs.length === 0}
            className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl font-bold transition shadow-sm"
          >
            <Download className="h-3.5 w-3.5" /> Exportar Log Real
          </button>
        </div>
      </div>

      {/* METRICAS RAPIDAS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-slate-900/60 border border-slate-800 p-3 rounded-xl flex items-center gap-3">
          <div className="p-2 bg-blue-500/10 text-blue-400 rounded-lg">
            <History className="h-5 w-5" />
          </div>
          <div>
            <p className="text-gray-400 text-[10px]">Total Registros Reales</p>
            <p className="text-base font-bold text-white">{logs.length} eventos</p>
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-3 rounded-xl flex items-center gap-3">
          <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <p className="text-gray-400 text-[10px]">Registros Filtrados</p>
            <p className="text-base font-bold text-white">{filteredLogs.length}</p>
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-3 rounded-xl flex items-center gap-3">
          <div className="p-2 bg-amber-500/10 text-amber-400 rounded-lg">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div>
            <p className="text-gray-400 text-[10px]">Estado de Auditoría</p>
            <p className="text-base font-bold text-emerald-400">Activo y Monitoreando</p>
          </div>
        </div>
      </div>

      {/* FILTROS Y BÚSQUEDA */}
      <div className="bg-slate-900/80 p-3 rounded-2xl border border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-gray-400 font-semibold flex items-center gap-1 mr-1">
            <Filter className="h-3.5 w-3.5" /> Filtros:
          </span>

          <select
            value={moduloFilter}
            onChange={(e) => setModuloFilter(e.target.value)}
            className="rounded-xl border border-slate-700 bg-slate-800 py-1.5 px-3 font-medium text-gray-200 outline-none focus:border-blue-500"
          >
            <option value="TODOS">Todos los Módulos</option>
            <option value="Pagos">Pagos</option>
            <option value="Documentos">Documentos</option>
            <option value="Rutas">Rutas</option>
            <option value="Clientes">Clientes</option>
            <option value="Sistema">Sistema</option>
          </select>

          <select
            value={accionFilter}
            onChange={(e) => setAccionFilter(e.target.value)}
            className="rounded-xl border border-slate-700 bg-slate-800 py-1.5 px-3 font-medium text-gray-200 outline-none focus:border-blue-500"
          >
            <option value="TODAS">Todas las Acciones</option>
            <option value="CREAR">Crear</option>
            <option value="EDITAR">Editar</option>
            <option value="ELIMINAR">Eliminar</option>
            <option value="CARGA_EXCEL">Carga Excel</option>
          </select>
        </div>

        <div className="relative w-full sm:w-64">
          <input
            type="text"
            placeholder="Buscar por usuario o detalle..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-xl border border-slate-700 bg-slate-800 py-1.5 pl-8 pr-3 text-gray-200 outline-none focus:border-blue-500"
          />
          <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
        </div>
      </div>

      {/* TABLA DE AUDITORÍA */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-800/60 text-gray-400 font-semibold border-b border-slate-800">
              <tr>
                <th className="p-3">Fecha / Hora</th>
                <th className="p-3">Usuario</th>
                <th className="p-3">Módulo</th>
                <th className="p-3">Acción</th>
                <th className="p-3">Descripción / Detalle</th>
                <th className="p-3 text-right">Origen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-gray-300">
              {filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-800/40 transition">
                  <td className="p-3 font-mono text-[11px] text-gray-400 whitespace-nowrap">
                    {log.fechaHora}
                  </td>
                  <td className="p-3 font-semibold text-white whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5 text-blue-400" />
                      <span>{log.usuario}</span>
                      <span className="text-[10px] text-gray-500 font-normal">({log.rol})</span>
                    </div>
                  </td>
                  <td className="p-3 whitespace-nowrap font-medium text-gray-300">
                    {log.modulo}
                  </td>
                  <td className="p-3 whitespace-nowrap">
                    {getBadgeAccion(log.accion)}
                  </td>
                  <td className="p-3 text-gray-300 min-w-[300px]">
                    {log.descripcion}
                  </td>
                  <td className="p-3 text-right font-mono text-[11px] text-gray-500 whitespace-nowrap">
                    {log.ip}
                  </td>
                </tr>
              ))}

              {filteredLogs.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-gray-500">
                    No hay registros grabados en el sistema.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  )
}