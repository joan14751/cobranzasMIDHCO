import React, { useState, useEffect, useMemo, useRef } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import { getDocumentos } from '../lib/supabaseService'
import { parseCobranzaExcelFile } from '../lib/excelService'
import { 
  Search, Calendar, Check, CheckCircle2, FileText, 
  Trash2, X, Download, Printer, DollarSign, CreditCard 
} from 'lucide-react'
import * as XLSX from 'xlsx'

interface PagoProgramado {
  id: string
  cliente: string
  documento: string
  representante: string
  montoOriginal: number
  montoProgramado: number
  fechaProgramada: string
  metodoPago: string
  estado: 'Pendiente' | 'Completado'
}

export default function PagosPage() {
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const [loading, setLoading] = useState(true)

  // 1. OBTENER Y RECONOCER EL DOCUMENTO EXACTO O EL TEXTO ENVIADO
  const exactDocQuery = searchParams.get('documento') || ''
  const isExactSearch = (location.state as any)?.exactMatch || !!exactDocQuery

  const [searchTerm, setSearchTerm] = useState(() => {
    return exactDocQuery || (location.state as any)?.searchDocumento || (location.state as any)?.filterText || ''
  })

  // Sincronizar estado si cambia la URL o el state
  useEffect(() => {
    const docFromUrl = searchParams.get('documento')
    const docFromState = (location.state as any)?.searchDocumento || (location.state as any)?.filterText
    if (docFromUrl || docFromState) {
      setSearchTerm(docFromUrl || docFromState || '')
    }
  }, [searchParams, location.state])

  const [subFilter, setSubFilter] = useState<string>(() => (location.state as any)?.filterType || 'TODO')
  const [repFilter, setRepFilter] = useState('TODOS')

  const [allRows, setAllRows] = useState<any[]>([])
  const [pagosProgramados, setPagosProgramados] = useState<PagoProgramado[]>([])

  const [inputsMonto, setInputsMonto] = useState<{ [key: string]: string }>({})
  const [inputsFecha, setInputsFecha] = useState<{ [key: string]: string }>({})
  const [inputsMetodo, setInputsMetodo] = useState<{ [key: string]: string }>({})

  // Estado para el autocompletado en búsqueda
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const searchContainerRef = useRef<HTMLDivElement>(null)

  const loadExcelData = async () => {
    setLoading(true)
    try {
      const { data, error } = await getDocumentos()
      if (error) throw new Error(error)

      const documentos = (data || []) as any[]
      const excelDocs = documentos.filter((doc) => 
        doc.ruta_archivo && (doc.ruta_archivo.endsWith('.xls') || doc.ruta_archivo.endsWith('.xlsx'))
      )

      if (excelDocs.length === 0) {
        setLoading(false)
        return
      }

      const ultimoExcel = excelDocs[0]
      const response = await fetch(ultimoExcel.url_archivo)
      const blob = await response.blob()
      const file = new File([blob], ultimoExcel.nombre, { type: blob.type })

      const parsedRows = await parseCobranzaExcelFile(file)
      setAllRows(parsedRows)

      const mañana = new Date()
      mañana.setDate(mañana.getDate() + 1)
      const fechaDefecto = mañana.toISOString().split('T')[0]

      const savedMontos = localStorage.getItem('cobranza_ediciones_monto')
      const savedFechas = localStorage.getItem('cobranza_ediciones_fecha')
      const savedMetodos = localStorage.getItem('cobranza_ediciones_metodo')

      const localMontos = savedMontos ? JSON.parse(savedMontos) : {}
      const localFechas = savedFechas ? JSON.parse(savedFechas) : {}
      const localMetodos = savedMetodos ? JSON.parse(savedMetodos) : {}

      const inicialMonto: { [key: string]: string } = {}
      const inicialFecha: { [key: string]: string } = {}
      const inicialMetodo: { [key: string]: string } = {}

      parsedRows.forEach((row: any, index: number) => {
        const rowId = row.id || `row-${index}`
        inicialMonto[rowId] = localMontos[rowId] !== undefined ? localMontos[rowId] : ''
        inicialFecha[rowId] = localFechas[rowId] !== undefined ? localFechas[rowId] : fechaDefecto
        inicialMetodo[rowId] = localMetodos[rowId] !== undefined ? localMetodos[rowId] : 'Transferencia BCP'
      })

      setInputsMonto(inicialMonto)
      setInputsFecha(inicialFecha)
      setInputsMetodo(inicialMetodo)

      const localSaved = localStorage.getItem('cobranza_pagos_programados')
      if (localSaved) setPagosProgramados(JSON.parse(localSaved))
    } catch (err: any) {
      toast.error('Error al cargar datos de pagos: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadExcelData() }, [])

  // Sincronizar autocompletado fuera de foco
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Guardar Inputs en LocalStorage
  const handleInputChange = (rowId: string, type: 'monto' | 'fecha' | 'metodo', value: string) => {
    if (type === 'monto') {
      const updated = { ...inputsMonto, [rowId]: value }
      setInputsMonto(updated)
      localStorage.setItem('cobranza_ediciones_monto', JSON.stringify(updated))
    } else if (type === 'fecha') {
      const updated = { ...inputsFecha, [rowId]: value }
      setInputsFecha(updated)
      localStorage.setItem('cobranza_ediciones_fecha', JSON.stringify(updated))
    } else if (type === 'metodo') {
      const updated = { ...inputsMetodo, [rowId]: value }
      setInputsMetodo(updated)
      localStorage.setItem('cobranza_ediciones_metodo', JSON.stringify(updated))
    }
  }

  // EXPORTACIONES (EXCEL Y IMPRESIÓN/PDF)
  const exportToExcel = () => {
    if (pagosProgramados.length === 0) {
      toast.error('No hay pagos programados para exportar.')
      return
    }

    const dataToExport = pagosProgramados.map(p => ({
      Cliente: p.cliente,
      Documento: p.documento,
      Representante: p.representante,
      'Fecha Programada': p.fechaProgramada,
      'Canal de Pago': p.metodoPago,
      'Monto (S/.)': p.montoProgramado,
      Estado: p.estado
    }))

    const worksheet = XLSX.utils.json_to_sheet(dataToExport)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Cronograma_Pagos')
    XLSX.writeFile(workbook, `Cronograma_Cobros_${new Date().toISOString().split('T')[0]}.xlsx`)
    toast.success('Reporte exportado correctamente a Excel.')
  }

  const handlePrintPDF = () => { window.print() }

  // Vendedores Únicos
  const vendedoresUnicos = useMemo(() => {
    const setV = new Set<string>()
    allRows.forEach((r) => {
      const rep = r.representante || r.vendedor
      if (rep) setV.add(rep)
    })
    return Array.from(setV).sort()
  }, [allRows])

  // Lista de Sugerencias para Autocompletado
  const sugerenciasClientes = useMemo(() => {
    if (!searchTerm.trim()) return []
    const term = searchTerm.toLowerCase().trim()
    const setClientes = new Set<string>()
    allRows.forEach((row) => {
      if (row.cliente && row.cliente.toLowerCase().includes(term)) {
        setClientes.add(row.cliente)
      }
    })
    return Array.from(setClientes).slice(0, 6)
  }, [allRows, searchTerm])

  // KPIs
  const kpis = useMemo(() => {
    let programadoPendiente = 0
    pagosProgramados.filter(p => p.estado === 'Pendiente').forEach(p => programadoPendiente += p.montoProgramado)

    return {
      totalProgramado: programadoPendiente,
      cantidadAgendados: pagosProgramados.length
    }
  }, [pagosProgramados])

  // Limpiar filtro exacto / URL
  const clearExactSearch = () => {
    setSearchTerm('')
    setSearchParams({})
  }

  // 2. LÓGICA DE FILTRADO CORREGIDA (COINCIDENCIA EXACTA SI VIENE DE DASHBOARD)
  const filteredRows = useMemo(() => {
    return allRows.filter((row: any) => {
      const term = searchTerm.toLowerCase().trim()
      const docNum = (row.documento || row.doc || row.num_doc || row.numero_documento || '').toLowerCase().trim()
      const diasMora = Number(row.dias_mora || row.diasMora || row.mora || 0)
      const rep = row.representante || row.vendedor || ''

      // COINCIDENCIA EXACTA
      if (isExactSearch && term) {
        return docNum === term
      }

      // BÚSQUEDA GENERAL
      const matchesText = !term || 
                          (row.cliente || '').toLowerCase().includes(term) || 
                          rep.toLowerCase().includes(term) ||
                          docNum.includes(term)

      const matchesRep = repFilter === 'TODOS' || rep === repFilter

      if (!matchesText || !matchesRep) return false

      if (subFilter === 'MORA') return diasMora > 0
      if (subFilter === 'ALDIA') return diasMora <= 0

      return true
    })
  }, [allRows, searchTerm, subFilter, repFilter, isExactSearch])

  // Programar Fila
  const handleProgramarFila = (row: any, index: number) => {
    const rowId = row.id || `row-${index}`
    const monto = inputsMonto[rowId]
    const fecha = inputsFecha[rowId]
    const metodo = inputsMetodo[rowId] || 'Transferencia BCP'

    if (!monto || parseFloat(monto) <= 0) {
      toast.error('Por favor, ingresa un monto válido.')
      return
    }

    const nuevoPago: PagoProgramado = {
      id: `pago-${Date.now()}-${index}`,
      cliente: row.cliente || 'Desconocido',
      documento: row.documento || row.doc || row.num_doc || 'S/N',
      representante: row.representante || row.vendedor || 'No Asignado',
      montoOriginal: Number(row.saldo || 0),
      montoProgramado: parseFloat(monto),
      fechaProgramada: fecha,
      metodoPago: metodo,
      estado: 'Pendiente'
    }

    const listaActualizada = [nuevoPago, ...pagosProgramados]
    setPagosProgramados(listaActualizada)
    localStorage.setItem('cobranza_pagos_programados', JSON.stringify(listaActualizada))
    toast.success('Cobro agendado en el cronograma.')
  }

  // Acciones en Cronograma
  const toggleEstadoPago = (id: string) => {
    const actualizados = pagosProgramados.map((p) => {
      if (p.id === id) {
        const nuevoEstado: 'Pendiente' | 'Completado' = p.estado === 'Pendiente' ? 'Completado' : 'Pendiente'
        return { ...p, estado: nuevoEstado }
      }
      return p
    })
    setPagosProgramados(actualizados)
    localStorage.setItem('cobranza_pagos_programados', JSON.stringify(actualizados))
    toast.success('Estado del pago actualizado.')
  }

  const eliminarPago = (id: string) => {
    const actualizados = pagosProgramados.filter((p) => p.id !== id)
    setPagosProgramados(actualizados)
    localStorage.setItem('cobranza_pagos_programados', JSON.stringify(actualizados))
    toast.success('Registro eliminado.')
  }

  // Manejo de Teclado en Búsqueda
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || sugerenciasClientes.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev < sugerenciasClientes.length - 1 ? prev + 1 : prev))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1))
    } else if (e.key === 'Enter') {
      if (selectedIndex >= 0 && selectedIndex < sugerenciasClientes.length) {
        e.preventDefault()
        setSearchTerm(sugerenciasClientes[selectedIndex])
        setShowSuggestions(false)
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false)
    }
  }

  return (
    <div className="space-y-6 p-6">
      {/* HEADER PAGE */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Gestión de Pagos & Cronogramas</h1>
          <p className="text-sm text-gray-500">Programa abonos directamente en la cartera o exporta reportes para gerencia.</p>
        </div>

        {/* BOTONES EXPORTAR */}
        <div className="flex items-center gap-2">
          <button
            onClick={exportToExcel}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 text-white rounded-xl font-bold text-xs hover:bg-emerald-700 transition shadow-sm"
          >
            <Download className="h-4 w-4" /> Excel
          </button>
          <button
            onClick={handlePrintPDF}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-gray-800 text-white rounded-xl font-bold text-xs hover:bg-gray-900 transition shadow-sm"
          >
            <Printer className="h-4 w-4" /> Imprimir / PDF
          </button>
        </div>
      </div>

      {/* AVISO / BANNER SI HAY UN DOCUMENTO SELECCIONADO EXACTO */}
      {isExactSearch && searchTerm && (
        <div className="flex items-center justify-between rounded-2xl bg-blue-50 border border-blue-200 p-3.5 text-xs text-blue-800 print:hidden">
          <span>Filtrando únicamente el documento: <strong className="font-mono text-blue-900">{searchTerm}</strong></span>
          <button
            onClick={clearExactSearch}
            className="font-bold underline text-blue-700 hover:text-blue-900"
          >
            Ver todos los documentos
          </button>
        </div>
      )}

      {/* METRICAS KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 print:hidden">
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm flex items-center gap-3">
          <div className="p-3 bg-purple-50 text-purple-600 rounded-xl"><DollarSign className="h-6 w-6" /></div>
          <div>
            <p className="text-xs font-medium text-gray-400">Total Cobros Pendientes Agendados</p>
            <p className="text-lg font-bold text-gray-900">S/. {kpis.totalProgramado.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</p>
          </div>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm flex items-center gap-3">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl"><Calendar className="h-6 w-6" /></div>
          <div>
            <p className="text-xs font-medium text-gray-400">Compromisos Agendados</p>
            <p className="text-lg font-bold text-gray-900">{kpis.cantidadAgendados} Registros</p>
          </div>
        </div>
      </div>

      {/* CARTERA TABLA */}
      <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm print:hidden">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
          <h3 className="font-bold text-gray-800 text-sm">Documentos en Cartera</h3>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            {/* Filtro por Estado */}
            <select
              value={subFilter}
              onChange={(e) => setSubFilter(e.target.value)}
              className="rounded-xl border border-gray-200 bg-white py-1.5 px-3 text-xs outline-none"
            >
              <option value="TODO">Todos los Docs</option>
              <option value="MORA">En Mora</option>
              <option value="ALDIA">Al Día</option>
            </select>

            {/* Filtro Vendedor */}
            <select
              value={repFilter}
              onChange={(e) => setRepFilter(e.target.value)}
              className="rounded-xl border border-gray-200 bg-white py-1.5 px-3 text-xs outline-none"
            >
              <option value="TODOS">Todos los Vendedores</option>
              {vendedoresUnicos.map((v, i) => <option key={i} value={v}>{v}</option>)}
            </select>

            {/* Buscador Autocompletado */}
            <div ref={searchContainerRef} className="relative w-full sm:w-64">
              <input
                type="text"
                placeholder="Buscar cliente, doc..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value)
                  setShowSuggestions(true)
                  setSelectedIndex(-1)
                  if (searchParams.get('documento')) setSearchParams({})
                }}
                onFocus={() => setShowSuggestions(true)}
                onKeyDown={handleKeyDown}
                className="w-full rounded-xl border border-gray-200 py-1.5 px-3 text-xs outline-none focus:border-blue-500"
              />
              {searchTerm && (
                <button 
                  onClick={clearExactSearch} 
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}

              {/* LISTA SUGERENCIAS */}
              {showSuggestions && sugerenciasClientes.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 z-20 rounded-xl bg-white border border-gray-100 shadow-xl overflow-hidden text-xs">
                  {sugerenciasClientes.map((cliente, idx) => (
                    <div
                      key={idx}
                      onClick={() => {
                        setSearchTerm(cliente)
                        setShowSuggestions(false)
                      }}
                      className={`p-2 cursor-pointer transition ${
                        idx === selectedIndex ? 'bg-blue-50 font-bold text-blue-600' : 'hover:bg-gray-50 text-gray-700'
                      }`}
                    >
                      {cliente}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tabla Operativa */}
        <div className="overflow-x-auto border border-gray-50 rounded-xl text-xs">
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-50 font-semibold text-gray-600 border-b border-gray-100">
              <tr>
                <th className="p-3">Cliente</th>
                <th className="p-3">Documento</th>
                <th className="p-3 text-center">Días Mora</th>
                <th className="p-3 text-right">Saldo</th>
                <th className="p-3 w-[15%]">Monto Programar</th>
                <th className="p-3 w-[15%]">Canal Pago</th>
                <th className="p-3 w-[15%]">Fecha</th>
                <th className="p-3 text-center">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredRows.slice(0, 30).map((row: any, index: number) => {
                const rowId = row.id || `row-${index}`
                const diasMora = Number(row.dias_mora || row.diasMora || row.mora || 0)
                return (
                  <tr key={rowId} className="hover:bg-gray-50/40 transition">
                    <td className="p-3 font-bold text-gray-900">{row.cliente}</td>
                    <td className="p-3 font-mono text-gray-500">{row.documento || row.doc || 'S/N'}</td>
                    <td className="p-3 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        diasMora > 0 
                          ? 'bg-red-100 text-red-700 border border-red-200' 
                          : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                      }`}>
                        {diasMora > 0 ? `${diasMora} d.` : 'Al día'}
                      </span>
                    </td>
                    <td className="p-3 text-right font-semibold">S/. {Number(row.saldo || 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}</td>
                    <td className="p-2">
                      <input
                        type="number"
                        placeholder="0.00"
                        value={inputsMonto[rowId] || ''}
                        onChange={(e) => handleInputChange(rowId, 'monto', e.target.value)}
                        className="w-full rounded-lg border border-gray-200 py-1 px-2 font-bold text-gray-900 outline-none focus:border-blue-500"
                      />
                    </td>
                    <td className="p-2">
                      <select
                        value={inputsMetodo[rowId] || 'Transferencia BCP'}
                        onChange={(e) => handleInputChange(rowId, 'metodo', e.target.value)}
                        className="w-full rounded-lg border border-gray-200 py-1 px-2 text-gray-700 outline-none"
                      >
                        <option value="Transferencia BCP">Transferencia BCP</option>
                        <option value="Yape / Plin">Yape / Plin</option>
                        <option value="Efectivo">Efectivo</option>
                        <option value="Cheque">Cheque</option>
                      </select>
                    </td>
                    <td className="p-2">
                      <input
                        type="date"
                        value={inputsFecha[rowId] || ''}
                        onChange={(e) => handleInputChange(rowId, 'fecha', e.target.value)}
                        className="w-full rounded-lg border border-gray-200 py-1 px-2 text-gray-700 outline-none"
                      />
                    </td>
                    <td className="p-3 text-center">
                      <button
                        onClick={() => handleProgramarFila(row, index)}
                        className="p-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                        title="Agendar cobro"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                )
              })}
              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-gray-400">
                    No se encontró ningún documento con ese criterio de búsqueda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CRONOGRAMA AGENDADO (PDF & PRINT READY) */}
      <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm print:shadow-none print:border-none">
        <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2 text-sm">
          <Calendar className="h-4 w-4 text-blue-500" /> Cronograma de Compromisos Agendados
        </h3>
        <div className="overflow-x-auto text-xs">
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-50 font-semibold text-gray-600 border-b border-gray-100">
              <tr>
                <th className="p-3">Cliente</th>
                <th className="p-3">Documento</th>
                <th className="p-3">Representante</th>
                <th className="p-3">Fecha Prog.</th>
                <th className="p-3">Canal</th>
                <th className="p-3 text-right">Monto</th>
                <th className="p-3 text-center print:hidden">Estado</th>
                <th className="p-3 text-center print:hidden">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 text-gray-700">
              {pagosProgramados.map((pago) => (
                <tr key={pago.id} className="hover:bg-gray-50/40 transition">
                  <td className="p-3 font-bold text-gray-900">{pago.cliente}</td>
                  <td className="p-3 font-mono text-gray-500">{pago.documento}</td>
                  <td className="p-3 text-gray-500">{pago.representante}</td>
                  <td className="p-3 font-semibold">{pago.fechaProgramada}</td>
                  <td className="p-3 text-gray-500">{pago.metodoPago}</td>
                  <td className="p-3 text-right font-black text-blue-600">S/. {pago.montoProgramado.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</td>
                  <td className="p-3 text-center print:hidden">
                    <span 
                      onClick={() => toggleEstadoPago(pago.id)}
                      className={`cursor-pointer px-2 py-0.5 rounded text-[10px] font-bold transition ${
                        pago.estado === 'Completado' 
                          ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                          : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                      }`}
                    >
                      {pago.estado}
                    </span>
                  </td>
                  <td className="p-3 text-center print:hidden flex justify-center gap-1">
                    <button
                      onClick={() => toggleEstadoPago(pago.id)}
                      className="p-1 rounded text-gray-400 hover:text-green-600 hover:bg-green-50"
                      title="Marcar como Completado/Pendiente"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => eliminarPago(pago.id)}
                      className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50"
                      title="Eliminar registro"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {pagosProgramados.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-gray-400">
                    No hay pagos ni compromisos agendados por el momento.
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