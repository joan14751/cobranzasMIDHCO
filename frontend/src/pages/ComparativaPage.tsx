import { useState, useEffect, useMemo } from 'react'
import { toast } from 'react-hot-toast'
import { getDocumentos } from '../lib/supabaseService'
import { parseCobranzaExcelFile } from '../lib/excelService'
import { 
  GitCompare, ArrowUpRight, ArrowDownRight, MinusCircle, 
  PlusCircle, CheckCircle2, Search, Download, RefreshCw, FileSpreadsheet
} from 'lucide-react'
import * as XLSX from 'xlsx'

interface DocumentoArchivo {
  id: string
  nombre: string
  url_archivo: string
  created_at?: string
  ruta_archivo?: string
}

interface ClienteComparado {
  cliente: string
  zona: string
  saldoA: number
  saldoB: number
  diferencia: number
  variacionPct: number
  estado: 'Amortizo' | 'Incremento' | 'Cancelado' | 'Nuevo' | 'SinCambio'
}

export default function ComparativaPage() {
  const [loading, setLoading] = useState(true)
  const [archivos, setArchivos] = useState<DocumentoArchivo[]>([])

  const [selectedFileAId, setSelectedFileAId] = useState<string>('')
  const [selectedFileBId, setSelectedFileBId] = useState<string>('')

  const [rowsA, setRowsA] = useState<any[]>([])
  const [rowsB, setRowsB] = useState<any[]>([])

  const [loadingA, setLoadingA] = useState(false)
  const [loadingB, setLoadingB] = useState(false)

  const [searchTerm, setSearchTerm] = useState('')
  const [estadoFilter, setEstadoFilter] = useState('TODOS')

  // Cargar documentos subidos desde Supabase
  useEffect(() => {
    const fetchArchivos = async () => {
      setLoading(true)
      try {
        const response: any = await getDocumentos()
        
        // Manejo seguro del error sin colisionar con el tipo 'never'
        if (response?.error) {
          const errObj = response.error
          const msg = typeof errObj === 'string' ? errObj : errObj?.message || 'Error al obtener documentos'
          throw new Error(msg)
        }

        const rawDocs = (response?.data || []) as any[]

        const excelDocs: DocumentoArchivo[] = rawDocs
          .filter(doc => {
            const ruta = doc.ruta_archivo || doc.url_archivo || doc.url || ''
            return ruta.endsWith('.xls') || ruta.endsWith('.xlsx')
          })
          .map(doc => ({
            id: String(doc.id),
            nombre: doc.nombre || doc.nombre_archivo || 'Documento sin nombre',
            url_archivo: doc.url_archivo || doc.url || doc.ruta_archivo || '',
            created_at: doc.created_at,
            ruta_archivo: doc.ruta_archivo
          }))

        setArchivos(excelDocs)

        if (excelDocs.length >= 2) {
          setSelectedFileBId(excelDocs[0].id)
          setSelectedFileAId(excelDocs[1].id)
        } else if (excelDocs.length === 1) {
          setSelectedFileBId(excelDocs[0].id)
          setSelectedFileAId(excelDocs[0].id)
        }
      } catch (err: unknown) {
        const mensaje = err instanceof Error ? err.message : String(err)
        toast.error('Error al cargar la lista de documentos: ' + mensaje)
      } finally {
        setLoading(false)
      }
    }
    fetchArchivos()
  }, [])

  // Parsear Archivo A (Base / Anterior)
  useEffect(() => {
    if (!selectedFileAId || archivos.length === 0) return
    const fileObj = archivos.find(a => a.id === selectedFileAId)
    if (!fileObj || !fileObj.url_archivo) return

    setLoadingA(true)
    fetch(fileObj.url_archivo)
      .then(res => {
        if (!res.ok) throw new Error('No se pudo descargar el archivo base.')
        return res.blob()
      })
      .then(blob => {
        const file = new File([blob], fileObj.nombre, { type: blob.type })
        return parseCobranzaExcelFile(file)
      })
      .then(parsed => setRowsA(parsed || []))
      .catch((err: unknown) => {
        const mensaje = err instanceof Error ? err.message : String(err)
        toast.error('Error al procesar el Archivo Base: ' + mensaje)
      })
      .finally(() => setLoadingA(false))
  }, [selectedFileAId, archivos])

  // Parsear Archivo B (Reciente / A Comparar)
  useEffect(() => {
    if (!selectedFileBId || archivos.length === 0) return
    const fileObj = archivos.find(a => a.id === selectedFileBId)
    if (!fileObj || !fileObj.url_archivo) return

    setLoadingB(true)
    fetch(fileObj.url_archivo)
      .then(res => {
        if (!res.ok) throw new Error('No se pudo descargar el archivo reciente.')
        return res.blob()
      })
      .then(blob => {
        const file = new File([blob], fileObj.nombre, { type: blob.type })
        return parseCobranzaExcelFile(file)
      })
      .then(parsed => setRowsB(parsed || []))
      .catch((err: unknown) => {
        const mensaje = err instanceof Error ? err.message : String(err)
        toast.error('Error al procesar el Archivo Reciente: ' + mensaje)
      })
      .finally(() => setLoadingB(false))
  }, [selectedFileBId, archivos])

  // Cruce de información
  const listaComparada = useMemo(() => {
    const mapClientes = new Map<string, { zona: string; saldoA: number; saldoB: number }>()

    rowsA.forEach(row => {
      const cliente = (row.cliente || 'CLIENTE S/N').toUpperCase().trim()
      const zona = row.zona || row.ciudad || 'SIN ZONA'
      const saldo = Number(row.saldo || 0)

      if (!mapClientes.has(cliente)) {
        mapClientes.set(cliente, { zona, saldoA: 0, saldoB: 0 })
      }
      mapClientes.get(cliente)!.saldoA += saldo
    })

    rowsB.forEach(row => {
      const cliente = (row.cliente || 'CLIENTE S/N').toUpperCase().trim()
      const zona = row.zona || row.ciudad || 'SIN ZONA'
      const saldo = Number(row.saldo || 0)

      if (!mapClientes.has(cliente)) {
        mapClientes.set(cliente, { zona, saldoA: 0, saldoB: 0 })
      }
      const item = mapClientes.get(cliente)!
      item.saldoB += saldo
      if (!item.zona || item.zona === 'SIN ZONA') item.zona = zona
    })

    const resultado: ClienteComparado[] = []

    mapClientes.forEach((val, cliente) => {
      const dif = val.saldoB - val.saldoA
      let varPct = 0
      if (val.saldoA > 0) {
        varPct = (dif / val.saldoA) * 100
      } else if (val.saldoB > 0) {
        varPct = 100
      }

      let estado: ClienteComparado['estado'] = 'SinCambio'
      if (val.saldoA > 0 && val.saldoB === 0) {
        estado = 'Cancelado'
      } else if (val.saldoA === 0 && val.saldoB > 0) {
        estado = 'Nuevo'
      } else if (dif < -0.01) {
        estado = 'Amortizo'
      } else if (dif > 0.01) {
        estado = 'Incremento'
      }

      resultado.push({
        cliente,
        zona: val.zona,
        saldoA: val.saldoA,
        saldoB: val.saldoB,
        diferencia: dif,
        variacionPct: varPct,
        estado
      })
    })

    return resultado.sort((a, b) => Math.abs(b.diferencia) - Math.abs(a.diferencia))
  }, [rowsA, rowsB])

  const listaFiltrada = useMemo(() => {
    return listaComparada.filter(item => {
      if (estadoFilter !== 'TODOS' && item.estado !== estadoFilter) return false
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase()
        return item.cliente.toLowerCase().includes(term) || item.zona.toLowerCase().includes(term)
      }
      return true
    })
  }, [listaComparada, estadoFilter, searchTerm])

  const kpis = useMemo(() => {
    let totalA = 0
    let totalB = 0
    let countAmortizo = 0
    let countIncremento = 0
    let countCancelado = 0
    let countNuevo = 0

    listaComparada.forEach(i => {
      totalA += i.saldoA
      totalB += i.saldoB
      if (i.estado === 'Amortizo') countAmortizo++
      if (i.estado === 'Incremento') countIncremento++
      if (i.estado === 'Cancelado') countCancelado++
      if (i.estado === 'Nuevo') countNuevo++
    })

    const difTotal = totalB - totalA
    const pctTotal = totalA > 0 ? (difTotal / totalA) * 100 : 0

    return {
      totalA,
      totalB,
      difTotal,
      pctTotal,
      countAmortizo,
      countIncremento,
      countCancelado,
      countNuevo
    }
  }, [listaComparada])

  const exportarComparativa = () => {
    if (listaFiltrada.length === 0) {
      toast.error('No hay datos disponibles para exportar.')
      return
    }

    const dataExcel = listaFiltrada.map(i => ({
      Cliente: i.cliente,
      Zona: i.zona,
      'Saldo Base (S/.)': i.saldoA,
      'Saldo Actual (S/.)': i.saldoB,
      'Variación (S/.)': i.diferencia,
      'Variación (%)': `${i.variacionPct.toFixed(1)}%`,
      Estado: i.estado
    }))

    const ws = XLSX.utils.json_to_sheet(dataExcel)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Comparativa_Saldos')
    XLSX.writeFile(wb, `Comparativa_Saldos_${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64 text-slate-500 dark:text-slate-400 gap-2">
        <RefreshCw className="h-5 w-5 animate-spin text-blue-600" /> Cargando lista de documentos...
      </div>
    )
  }

  return (
    <div className="space-y-6 font-sans">
      
      {/* ENCABEZADO */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-950 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
            <GitCompare className="h-6 w-6 text-blue-600" /> Comparativa y Auditoría de Saldos
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Cruce directo entre reportes para monitorear abonos, amortizaciones e incremento de deuda.</p>
        </div>

        <button 
          onClick={exportarComparativa}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-sm transition"
        >
          <Download className="h-4 w-4" /> Exportar a Excel
        </button>
      </div>

      {/* SELECCIÓN DE ARCHIVOS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white dark:bg-slate-950 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4 text-slate-500" />
            Documento Base (Anterior)
          </label>
          <select
            value={selectedFileAId}
            onChange={(e) => setSelectedFileAId(e.target.value)}
            className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 text-xs font-medium outline-none focus:ring-2 focus:ring-blue-500"
          >
            {archivos.map(arch => (
              <option key={arch.id} value={arch.id}>
                {arch.nombre} ({arch.created_at ? new Date(arch.created_at).toLocaleDateString() : 'Sin fecha'})
              </option>
            ))}
          </select>
          {loadingA && <p className="text-[11px] text-blue-500 animate-pulse">Cargando documento base...</p>}
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-bold text-blue-600 dark:text-blue-400 flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            Documento Reciente (A Comparar)
          </label>
          <select
            value={selectedFileBId}
            onChange={(e) => setSelectedFileBId(e.target.value)}
            className="w-full p-2.5 rounded-xl border border-blue-200 dark:border-blue-900/40 bg-blue-50/50 dark:bg-blue-950/20 text-slate-900 dark:text-slate-100 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500"
          >
            {archivos.map(arch => (
              <option key={arch.id} value={arch.id}>
                {arch.nombre} ({arch.created_at ? new Date(arch.created_at).toLocaleDateString() : 'Sin fecha'})
              </option>
            ))}
          </select>
          {loadingB && <p className="text-[11px] text-blue-500 animate-pulse">Cargando documento comparativo...</p>}
        </div>
      </div>

      {/* METRICAS Y KPIS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-950 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Saldo Base</p>
          <p className="text-lg font-extrabold text-slate-800 dark:text-slate-100 mt-0.5">
            S/. {kpis.totalA.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-950 p-4 rounded-2xl border border-blue-200 dark:border-blue-900/50 shadow-sm">
          <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">Saldo Reciente</p>
          <p className="text-lg font-extrabold text-blue-900 dark:text-blue-300 mt-0.5">
            S/. {kpis.totalB.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-950 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Variación Neta</p>
          <p className={`text-lg font-extrabold mt-0.5 ${kpis.difTotal <= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
            {kpis.difTotal > 0 ? '+' : ''}S/. {kpis.difTotal.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-950 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Variación Total (%)</p>
          <p className={`text-lg font-extrabold mt-0.5 ${kpis.pctTotal <= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
            {kpis.pctTotal > 0 ? '+' : ''}{kpis.pctTotal.toFixed(2)}%
          </p>
        </div>
      </div>

      {/* CONTROLES Y FILTROS */}
      <div className="bg-white dark:bg-slate-950 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setEstadoFilter('TODOS')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
              estadoFilter === 'TODOS' ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            Todos ({listaComparada.length})
          </button>

          <button
            onClick={() => setEstadoFilter('Amortizo')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${
              estadoFilter === 'Amortizo' ? 'bg-emerald-600 text-white border-emerald-600' : 'border-emerald-200 text-emerald-700 dark:border-emerald-900/50 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/20'
            }`}
          >
            <ArrowDownRight className="h-3.5 w-3.5" /> Amortizaron ({kpis.countAmortizo})
          </button>

          <button
            onClick={() => setEstadoFilter('Cancelado')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${
              estadoFilter === 'Cancelado' ? 'bg-blue-600 text-white border-blue-600' : 'border-blue-200 text-blue-700 dark:border-blue-900/50 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/20'
            }`}
          >
            <CheckCircle2 className="h-3.5 w-3.5" /> Cancelaron ({kpis.countCancelado})
          </button>

          <button
            onClick={() => setEstadoFilter('Incremento')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${
              estadoFilter === 'Incremento' ? 'bg-red-600 text-white border-red-600' : 'border-red-200 text-red-700 dark:border-red-900/50 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20'
            }`}
          >
            <ArrowUpRight className="h-3.5 w-3.5" /> Incrementaron ({kpis.countIncremento})
          </button>

          <button
            onClick={() => setEstadoFilter('Nuevo')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${
              estadoFilter === 'Nuevo' ? 'bg-amber-600 text-white border-amber-600' : 'border-amber-200 text-amber-700 dark:border-amber-900/50 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/20'
            }`}
          >
            <PlusCircle className="h-3.5 w-3.5" /> Nuevos Deudores ({kpis.countNuevo})
          </button>
        </div>

        <div className="relative w-full sm:w-64">
          <input
            type="text"
            placeholder="Buscar por cliente o zona..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 text-xs py-2 pl-8 pr-3 outline-none focus:ring-2 focus:ring-blue-500"
          />
          <Search className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
        </div>
      </div>

      {/* TABLA PRINCIPAL DE CRUCE DE SALDOS */}
      <div className="bg-white dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="p-3">Cliente / Razón Social</th>
                <th className="p-3">Zona</th>
                <th className="p-3 text-right">Saldo Base</th>
                <th className="p-3 text-right">Saldo Reciente</th>
                <th className="p-3 text-right">Diferencia (S/.)</th>
                <th className="p-3 text-center">Variación %</th>
                <th className="p-3 text-center">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-900 font-medium">
              {listaFiltrada.map((item, index) => (
                <tr key={index} className="hover:bg-slate-50/60 dark:hover:bg-slate-900/50 transition">
                  <td className="p-3 font-bold text-slate-800 dark:text-slate-200">{item.cliente}</td>
                  <td className="p-3 text-slate-500 dark:text-slate-400 uppercase">{item.zona}</td>
                  <td className="p-3 text-right text-slate-600 dark:text-slate-400 font-mono">
                    S/. {item.saldoA.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="p-3 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                    S/. {item.saldoB.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                  </td>
                  <td className={`p-3 text-right font-mono font-extrabold ${
                    item.diferencia < 0 ? 'text-emerald-600 dark:text-emerald-400' : item.diferencia > 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-400'
                  }`}>
                    {item.diferencia > 0 ? '+' : ''}S/. {item.diferencia.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="p-3 text-center font-bold">
                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] ${
                      item.variacionPct < 0 ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300' : item.variacionPct > 0 ? 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-900 dark:text-slate-400'
                    }`}>
                      {item.variacionPct > 0 ? '+' : ''}{item.variacionPct.toFixed(1)}%
                    </span>
                  </td>
                  <td className="p-3 text-center">
                    {item.estado === 'Amortizo' && (
                      <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 font-bold px-2.5 py-0.5 rounded-full text-[10px]">
                        <ArrowDownRight className="h-3 w-3" /> Amortizó
                      </span>
                    )}
                    {item.estado === 'Cancelado' && (
                      <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 font-bold px-2.5 py-0.5 rounded-full text-[10px]">
                        <CheckCircle2 className="h-3 w-3" /> Canceló
                      </span>
                    )}
                    {item.estado === 'Incremento' && (
                      <span className="inline-flex items-center gap-1 bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300 font-bold px-2.5 py-0.5 rounded-full text-[10px]">
                        <ArrowUpRight className="h-3 w-3" /> Incrementó
                      </span>
                    )}
                    {item.estado === 'Nuevo' && (
                      <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 font-bold px-2.5 py-0.5 rounded-full text-[10px]">
                        <PlusCircle className="h-3 w-3" /> Nuevo
                      </span>
                    )}
                    {item.estado === 'SinCambio' && (
                      <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-500 dark:bg-slate-900 dark:text-slate-400 font-semibold px-2.5 py-0.5 rounded-full text-[10px]">
                        <MinusCircle className="h-3 w-3" /> Sin cambio
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {listaFiltrada.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">
                    No hay registros de comparativa para los criterios aplicados.
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