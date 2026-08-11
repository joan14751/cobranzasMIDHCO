import React, { useState, useEffect, useMemo, useRef } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import { getDocumentos } from '../lib/supabaseService'
import { parseCobranzaExcelFile } from '../lib/excelService'
import { 
  Search, Calendar, CheckCircle2, 
  Trash2, X, Download, Printer, MapPin, User, FileText, FileSpreadsheet, RefreshCw, ChevronDown
} from 'lucide-react'
import * as XLSX from 'xlsx'

interface PagoProgramado {
  id: string
  cliente: string
  documento: string
  zona: string
  representante: string
  montoOriginal: number
  montoProgramado: number
  fechaProgramada: string
  metodoPago: string
  estado: 'Pendiente' | 'Completado'
}

interface DocumentoExcel {
  id: string
  nombre: string
  ruta_archivo: string
  url_archivo: string
  fecha_carga?: string
  created_at?: string
  fecha?: string
}

export default function PagosPage() {
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const [loading, setLoading] = useState(true)

  // ESTADO DE DOCUMENTOS EXCEL DISPONIBLES Y SELECCIONADO
  const [excelDocs, setExcelDocs] = useState<DocumentoExcel[]>([])
  const [selectedDocId, setSelectedDocId] = useState<string>(() => {
    return localStorage.getItem('cobranza_documento_activo_id') || ''
  })
  
  // Estado y Ref para desplegable personalizado
  const [isDocDropdownOpen, setIsDocDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // 1. ESTADOS DE SELECCIÓN Y FILTROS
  const [selectedZona, setSelectedZona] = useState<string>('')
  const [selectedCliente, setSelectedCliente] = useState<string>('')
  const [repFilter, setRepFilter] = useState('TODOS')
  const [tramoFilter, setTramoFilter] = useState<string>('TODOS')

  const exactDocQuery = searchParams.get('documento') || ''
  const [searchTerm, setSearchTerm] = useState(() => {
    return exactDocQuery || (location.state as any)?.searchDocumento || (location.state as any)?.filterText || ''
  })

  const [allRows, setAllRows] = useState<any[]>([])
  const [pagosProgramados, setPagosProgramados] = useState<PagoProgramado[]>([])

  const [inputsMonto, setInputsMonto] = useState<{ [key: string]: string }>({})
  const [inputsFecha, setInputsFecha] = useState<{ [key: string]: string }>({})
  const [inputsMetodo, setInputsMetodo] = useState<{ [key: string]: string }>({})

  // Helper para formatear fecha y hora
  const formatFechaHora = (fechaRaw?: string) => {
    if (!fechaRaw) return ''
    try {
      const date = new Date(fechaRaw)
      if (isNaN(date.getTime())) return ''
      return date.toLocaleString('es-PE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      })
    } catch {
      return ''
    }
  }

  // Cerrar menú al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDocDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Carga inicial de la lista de documentos registrados en base de datos
  const fetchDocumentosList = async () => {
    try {
      const { data, error } = await getDocumentos()
      if (error) throw new Error(typeof error === 'string' ? error : (error as any)?.message || 'Error al obtener documentos')

      const documentos = (data || []) as any[]
      const excels = documentos.filter((doc) => 
        doc.ruta_archivo && (doc.ruta_archivo.endsWith('.xls') || doc.ruta_archivo.endsWith('.xlsx'))
      )

      setExcelDocs(excels)

      if (excels.length > 0) {
        const currentSaved = localStorage.getItem('cobranza_documento_activo_id')
        const existeGuardado = excels.some(d => String(d.id) === String(currentSaved))

        if (!currentSaved || !existeGuardado) {
          const docIdInicial = String(excels[0].id)
          setSelectedDocId(docIdInicial)
          localStorage.setItem('cobranza_documento_activo_id', docIdInicial)
        }
      } else {
        setLoading(false)
      }
    } catch (err: any) {
      toast.error('Error al obtener lista de documentos: ' + err.message)
      setLoading(false)
    }
  }

  // Carga y procesa los datos del archivo Excel actualmente SELECCIONADO
  const processExcelData = async (docIdToLoad: string) => {
    if (!docIdToLoad || excelDocs.length === 0) return

    const targetDoc = excelDocs.find(d => String(d.id) === String(docIdToLoad))
    if (!targetDoc) return

    setLoading(true)
    try {
      const response = await fetch(targetDoc.url_archivo)
      const blob = await response.blob()
      const file = new File([blob], targetDoc.nombre, { type: blob.type })

      const parsedRows = await parseCobranzaExcelFile(file)
      setAllRows(parsedRows)

      setSelectedZona('')
      setSelectedCliente('')

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

      toast.success(`Datos cargados desde: ${targetDoc.nombre}`)
    } catch (err: any) {
      toast.error('Error al procesar el archivo Excel: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDocumentosList()
  }, [])

  useEffect(() => {
    if (selectedDocId && excelDocs.length > 0) {
      processExcelData(selectedDocId)
    }
  }, [selectedDocId, excelDocs])

  const handleDocumentChange = (docId: string) => {
    setSelectedDocId(docId)
    localStorage.setItem('cobranza_documento_activo_id', docId)
    setIsDocDropdownOpen(false)
  }

  const selectedDocObj = useMemo(() => {
    return excelDocs.find(d => String(d.id) === String(selectedDocId)) || excelDocs[0]
  }, [excelDocs, selectedDocId])

  // Vendedores Únicos
  const vendedoresUnicos = useMemo(() => {
    const setV = new Set<string>()
    allRows.forEach((r) => {
      const rep = r.representante || r.vendedor
      if (rep) setV.add(rep)
    })
    return Array.from(setV).sort()
  }, [allRows])

  // LÓGICA DE FILTRADO POR TRAMOS
  const cumpleFiltroTramo = (diasMora: number) => {
    if (tramoFilter === 'TODOS') return true
    if (tramoFilter === 'ALDIA') return diasMora <= 0
    if (tramoFilter === '1-15') return diasMora >= 1 && diasMora <= 15
    if (tramoFilter === '16-45') return diasMora >= 16 && diasMora <= 45
    if (tramoFilter === '46+') return diasMora >= 46
    return true
  }

  // AGRUPACIÓN ZONAS
  const resumenZonas = useMemo(() => {
    const mapZonas = new Map<string, { zona: string; saldoTotal: number; saldoVencido: number; count: number }>()

    allRows.forEach((row) => {
      const rep = row.representante || row.vendedor || ''
      if (repFilter !== 'TODOS' && rep !== repFilter) return

      const diasMora = Number(row.dias_mora || row.diasMora || row.mora || 0)
      if (!cumpleFiltroTramo(diasMora)) return

      const zona = row.zona || row.ciudad || row.region || row.ubigeo || 'SIN ZONA'
      const saldo = Number(row.saldo || 0)

      if (!mapZonas.has(zona)) {
        mapZonas.set(zona, { zona, saldoTotal: 0, saldoVencido: 0, count: 0 })
      }

      const item = mapZonas.get(zona)!
      item.saldoTotal += saldo
      if (diasMora > 0) item.saldoVencido += saldo
      item.count += 1
    })

    const result = Array.from(mapZonas.values()).sort((a, b) => a.zona.localeCompare(b.zona))

    if (result.length > 0 && (!selectedZona || !mapZonas.has(selectedZona))) {
      setSelectedZona(result[0].zona)
    }

    return result
  }, [allRows, repFilter, tramoFilter])

  // AGRUPACIÓN CLIENTES
  const resumenClientes = useMemo(() => {
    if (!selectedZona) return []
    const mapClientes = new Map<string, { cliente: string; saldoTotal: number; saldoVencido: number; count: number }>()

    allRows.forEach((row) => {
      const rep = row.representante || row.vendedor || ''
      if (repFilter !== 'TODOS' && rep !== repFilter) return

      const diasMora = Number(row.dias_mora || row.diasMora || row.mora || 0)
      if (!cumpleFiltroTramo(diasMora)) return

      const zona = row.zona || row.ciudad || row.region || row.ubigeo || 'SIN ZONA'
      if (zona !== selectedZona) return

      const cliente = row.cliente || 'CLIENTE S/N'
      const saldo = Number(row.saldo || 0)

      if (!mapClientes.has(cliente)) {
        mapClientes.set(cliente, { cliente, saldoTotal: 0, saldoVencido: 0, count: 0 })
      }

      const item = mapClientes.get(cliente)!
      item.saldoTotal += saldo
      if (diasMora > 0) item.saldoVencido += saldo
      item.count += 1
    })

    const result = Array.from(mapClientes.values()).sort((a, b) => a.cliente.localeCompare(b.cliente))

    if (result.length > 0 && (!selectedCliente || !mapClientes.has(selectedCliente))) {
      setSelectedCliente(result[0].cliente)
    }

    return result
  }, [allRows, selectedZona, repFilter, tramoFilter])

  // AGRUPACIÓN DOCUMENTOS
  const documentosFiltrados = useMemo(() => {
    return allRows.filter((row) => {
      const rep = row.representante || row.vendedor || ''
      if (repFilter !== 'TODOS' && rep !== repFilter) return false

      const diasMora = Number(row.dias_mora || row.diasMora || row.mora || 0)
      if (!cumpleFiltroTramo(diasMora)) return false

      const zona = row.zona || row.ciudad || row.region || row.ubigeo || 'SIN ZONA'
      const cliente = row.cliente || 'CLIENTE S/N'
      const docNum = (row.documento || row.doc || row.num_doc || '').toLowerCase()

      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase().trim()
        return cliente.toLowerCase().includes(term) || docNum.includes(term)
      }

      return zona === selectedZona && cliente === selectedCliente
    })
  }, [allRows, selectedZona, selectedCliente, repFilter, tramoFilter, searchTerm])

  const totalSaldoDocumentos = useMemo(() => {
    return documentosFiltrados.reduce((acc, row) => acc + Number(row.saldo || 0), 0)
  }, [documentosFiltrados])

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

  const handleProgramarFila = (row: any, index: number) => {
    const rowId = row.id || `row-${index}`
    const monto = inputsMonto[rowId]
    const fecha = inputsFecha[rowId]
    const metodo = inputsMetodo[rowId] || 'Transferencia BCP'

    if (monto === '' || isNaN(parseFloat(monto)) || parseFloat(monto) < 0) {
      toast.error('Por favor, ingresa un monto válido.')
      return
    }

    const nuevoPago: PagoProgramado = {
      id: `pago-${Date.now()}-${index}`,
      cliente: row.cliente || 'Desconocido',
      documento: row.documento || row.doc || row.num_doc || 'S/N',
      zona: row.zona || row.ciudad || row.region || row.ubigeo || 'Sin Zona',
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

  const toggleEstadoPago = (id: string) => {
    const actualizados = pagosProgramados.map((p) => {
      if (p.id === id) {
        return { ...p, estado: (p.estado === 'Pendiente' ? 'Completado' : 'Pendiente') as any }
      }
      return p
    })
    setPagosProgramados(actualizados)
    localStorage.setItem('cobranza_pagos_programados', JSON.stringify(actualizados))
  }

  const eliminarPago = (id: string) => {
    const actualizados = pagosProgramados.filter((p) => p.id !== id)
    setPagosProgramados(actualizados)
    localStorage.setItem('cobranza_pagos_programados', JSON.stringify(actualizados))
    toast.success('Registro eliminado.')
  }

  const exportToExcel = () => {
    if (pagosProgramados.length === 0) {
      toast.error('No hay pagos programados para exportar.')
      return
    }
    const dataToExport = pagosProgramados.map(p => ({
      Cliente: p.cliente,
      Documento: p.documento,
      Zona: p.zona,
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
  }

  const totalsGeneralZonas = useMemo(() => {
    let tot = 0
    let ven = 0
    resumenZonas.forEach(z => { tot += z.saldoTotal; ven += z.saldoVencido })
    return { tot, ven }
  }, [resumenZonas])

  return (
    <div className="space-y-4 p-4 text-xs font-sans">
      
      {/* BARRA SUPERIOR DE ACCIONES Y BÚSQUEDA */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm print:hidden">
        <div>
          <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <MapPin className="h-5 w-5 text-blue-600" /> Explorador de Cartera por Zona y Cliente
          </h1>
          <p className="text-gray-500 text-[11px]">Selecciona una zona, luego un cliente para explorar e ingresar abonos.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          
          {/* COMPONENTE SELECTOR PERSONALIZADO */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setIsDocDropdownOpen(!isDocDropdownOpen)}
              className="flex items-center gap-2 px-3 py-1.5 bg-blue-50/50 hover:bg-blue-50 border border-blue-100 rounded-2xl shadow-sm transition text-left"
            >
              <div className="p-1.5 bg-emerald-100/80 rounded-xl text-emerald-700">
                <FileSpreadsheet className="h-4 w-4" />
              </div>
              <div className="flex flex-col min-w-[170px] max-w-[240px]">
                <div className="flex items-center justify-between gap-1">
                  <span className="font-bold text-gray-900 truncate text-[12px]">
                    {selectedDocObj?.nombre || 'Cargando...'}
                  </span>
                  <ChevronDown className={`h-3.5 w-3.5 text-gray-500 transition-transform ${isDocDropdownOpen ? 'rotate-180' : ''}`} />
                </div>
                {selectedDocObj && (
                  <div className="flex items-center gap-1 text-[11px]">
                    <Calendar className="h-3 w-3 text-blue-500 shrink-0" />
                    <span className="text-gray-500 font-medium">Actualizado hasta:</span>
                    <span className="font-bold text-blue-600">
                      {formatFechaHora(selectedDocObj.fecha_carga || selectedDocObj.created_at || selectedDocObj.fecha)}
                    </span>
                  </div>
                )}
              </div>
              {loading && <RefreshCw className="h-3.5 w-3.5 text-blue-600 animate-spin ml-1" />}
            </button>

            {/* MENÚ DESPLEGABLE */}
            {isDocDropdownOpen && (
              <div className="absolute left-0 mt-1 w-80 bg-white border border-gray-100 rounded-2xl shadow-xl z-50 overflow-hidden divide-y divide-gray-50 max-h-72 overflow-y-auto">
                {excelDocs.map((doc) => {
                  const isSelected = String(doc.id) === String(selectedDocId)
                  const fechaFmt = formatFechaHora(doc.fecha_carga || doc.created_at || doc.fecha)
                  return (
                    <button
                      key={doc.id}
                      type="button"
                      onClick={() => handleDocumentChange(String(doc.id))}
                      className={`w-full p-2.5 text-left flex items-start gap-2.5 transition ${
                        isSelected ? 'bg-blue-50/80' : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className={`p-1.5 rounded-xl mt-0.5 ${isSelected ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-600'}`}>
                        <FileSpreadsheet className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`font-bold truncate text-[12px] ${isSelected ? 'text-blue-900' : 'text-gray-800'}`}>
                          {doc.nombre}
                        </p>
                        {fechaFmt && (
                          <div className="flex items-center gap-1 text-[11px] mt-0.5">
                            <Calendar className="h-3 w-3 text-blue-500 shrink-0" />
                            <span className="text-gray-500 font-medium">Actualizado hasta:</span>
                            <span className="font-bold text-blue-600">{fechaFmt}</span>
                          </div>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Filtro Vendedor */}
          <select
            value={repFilter}
            onChange={(e) => setRepFilter(e.target.value)}
            className="rounded-xl border border-gray-200 bg-gray-50 py-1.5 px-3 font-semibold text-gray-700 outline-none focus:border-blue-500"
          >
            <option value="TODOS">Todos los Vendedores</option>
            {vendedoresUnicos.map((v, i) => <option key={i} value={v}>{v}</option>)}
          </select>

          {/* Buscador Rápido */}
          <div className="relative">
            <input
              type="text"
              placeholder="Filtro rápido..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="rounded-xl border border-gray-200 bg-gray-50 py-1.5 pl-8 pr-3 w-48 outline-none focus:border-blue-500"
            />
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

        </div>
      </div>

      {/* FILTRAR TRAMO */}
      <div className="bg-white p-3 rounded-2xl border border-gray-100 shadow-sm flex flex-wrap items-center gap-2 text-xs print:hidden">
        <span className="text-gray-500 font-semibold mr-2">Filtrar Tramo:</span>
        
        <button
          onClick={() => setTramoFilter('TODOS')}
          className={`px-4 py-1 rounded-full font-bold transition-all shadow-sm ${
            tramoFilter === 'TODOS'
              ? 'bg-blue-600 text-white shadow-blue-200'
              : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200'
          }`}
        >
          Todos
        </button>

        <button
          onClick={() => setTramoFilter('ALDIA')}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-full font-semibold transition-all border ${
            tramoFilter === 'ALDIA'
              ? 'bg-emerald-500 text-white border-emerald-600 shadow-sm'
              : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
          }`}
        >
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 border border-emerald-600"></span>
          Al día
        </button>

        <button
          onClick={() => setTramoFilter('1-15')}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-full font-semibold transition-all border ${
            tramoFilter === '1-15'
              ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm'
              : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
          }`}
        >
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 border border-emerald-600"></span>
          1-15 días
        </button>

        <button
          onClick={() => setTramoFilter('16-45')}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-full font-semibold transition-all border ${
            tramoFilter === '16-45'
              ? 'bg-amber-500 text-white border-amber-600 shadow-sm'
              : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
          }`}
        >
          <span className="h-2.5 w-2.5 rounded-full bg-yellow-400 border border-amber-500"></span>
          16-45 días
        </button>

        <button
          onClick={() => setTramoFilter('46+')}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-full font-semibold transition-all border ${
            tramoFilter === '46+'
              ? 'bg-red-600 text-white border-red-700 shadow-sm'
              : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
          }`}
        >
          <span className="h-2.5 w-2.5 rounded-full bg-red-600 border border-red-700"></span>
          +46 días
        </button>
      </div>

      {/* DASHBOARD JERÁRQUICO MAESTRO-DETALLE */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 print:hidden">
        
        {/* PANEL IZQUIERDO DE ZONAS */}
        <div className="lg:col-span-3 bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden flex flex-col h-[520px]">
          <div className="bg-gray-100 p-2.5 border-b border-gray-200 font-bold text-gray-700 flex justify-between items-center">
            <span>Zona</span>
            <span>Importe / Vencidos</span>
          </div>
          <div className="overflow-y-auto flex-1 divide-y divide-gray-50">
            {resumenZonas.map((item) => {
              const isSelected = selectedZona === item.zona && !searchTerm
              const pctVencido = item.saldoTotal > 0 ? (item.saldoVencido / item.saldoTotal) * 100 : 0

              return (
                <div
                  key={item.zona}
                  onClick={() => {
                    setSelectedZona(item.zona)
                    setSearchTerm('')
                  }}
                  className={`p-2.5 cursor-pointer transition flex justify-between items-center ${
                    isSelected ? 'bg-blue-600 text-white font-bold' : 'hover:bg-blue-50 text-gray-700'
                  }`}
                >
                  <div className="truncate pr-2">
                    <p className="truncate font-semibold uppercase">{item.zona}</p>
                    <p className={`text-[10px] ${isSelected ? 'text-blue-100' : 'text-gray-400'}`}>
                      {item.count} docs
                    </p>
                  </div>
                  <div className="text-right whitespace-nowrap">
                    <p className="font-bold">S/. {item.saldoTotal.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</p>
                    <span className={`inline-block text-[9px] px-1.5 py-0.2 rounded font-bold ${
                      isSelected 
                        ? 'bg-blue-800 text-white' 
                        : pctVencido > 0 ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
                    }`}>
                      {pctVencido.toFixed(0)}% Venc.
                    </span>
                  </div>
                </div>
              )
            })}
            {resumenZonas.length === 0 && (
              <div className="p-4 text-center text-gray-400">Sin datos en este tramo.</div>
            )}
          </div>
          <div className="bg-gray-800 text-white p-2.5 text-[11px] font-bold flex justify-between">
            <span>TOTAL:</span>
            <span>S/. {totalsGeneralZonas.tot.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</span>
          </div>
        </div>

        {/* PANEL DERECHO */}
        <div className="lg:col-span-9 space-y-4 flex flex-col h-[520px]">
          
          {/* CLIENTES */}
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden h-[210px] flex flex-col">
            <div className="bg-blue-50/80 px-3 py-2 border-b border-blue-100 font-bold text-blue-900 flex justify-between items-center">
              <span className="flex items-center gap-1.5">
                <User className="h-4 w-4 text-blue-600" /> 
                Clientes en: <strong className="uppercase underline ml-1">{selectedZona || 'Todas'}</strong>
              </span>
              <span className="text-[11px] text-blue-700 font-normal">{resumenClientes.length} Clientes encontrados</span>
            </div>
            
            <div className="overflow-y-auto flex-1 border-b border-gray-100">
              <table className="w-full text-left border-collapse">
                <thead className="bg-gray-50 text-gray-600 font-semibold sticky top-0 border-b border-gray-100">
                  <tr>
                    <th className="p-2">Denominación / Cliente</th>
                    <th className="p-2 text-center">Docs</th>
                    <th className="p-2 text-right">Vencido</th>
                    <th className="p-2 text-right text-emerald-700">Por Vencer</th>
                    <th className="p-2 text-right">Saldo Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {resumenClientes.map((c) => {
                    const isSelected = selectedCliente === c.cliente && !searchTerm
                    const porVencer = Math.max(0, c.saldoTotal - c.saldoVencido)

                    return (
                      <tr
                        key={c.cliente}
                        onClick={() => {
                          setSelectedCliente(c.cliente)
                          setSearchTerm('')
                        }}
                        className={`cursor-pointer transition ${
                          isSelected ? 'bg-emerald-50 text-emerald-900 font-bold' : 'hover:bg-gray-50 text-gray-700'
                        }`}
                      >
                        <td className="p-2 truncate max-w-[280px] font-semibold">{c.cliente}</td>
                        <td className="p-2 text-center text-gray-400">{c.count}</td>
                        <td className="p-2 text-right font-medium text-red-600">
                          {c.saldoVencido > 0 ? `S/. ${c.saldoVencido.toLocaleString('es-PE', { minimumFractionDigits: 2 })}` : '-'}
                        </td>
                        <td className="p-2 text-right font-medium text-emerald-600">
                          {porVencer > 0 ? `S/. ${porVencer.toLocaleString('es-PE', { minimumFractionDigits: 2 })}` : '-'}
                        </td>
                        <td className="p-2 text-right font-bold">
                          S/. {c.saldoTotal.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    )
                  })}
                  {resumenClientes.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-4 text-center text-gray-400">Sin clientes en este tramo.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* DOCUMENTOS */}
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden flex-1 flex flex-col">
            <div className="bg-gray-800 text-white px-3 py-1.5 font-bold flex justify-between items-center text-[11px]">
              <span className="flex items-center gap-1">
                <FileText className="h-3.5 w-3.5 text-blue-400" />
                Documentos de: <span className="text-yellow-400 font-mono ml-1">{searchTerm ? `Búsqueda: "${searchTerm}"` : selectedCliente}</span>
              </span>
              <span>{documentosFiltrados.length} Registro(s)</span>
            </div>

            <div className="overflow-x-auto overflow-y-auto flex-1">
              <table className="w-full text-left border-collapse">
                <thead className="bg-gray-50 font-semibold text-gray-600 border-b border-gray-100 sticky top-0 bg-white z-10">
                  <tr>
                    <th className="p-2">Documento</th>
                    <th className="p-2 text-center">Mora</th>
                    <th className="p-2 text-right">Saldo</th>
                    <th className="p-2 w-[16%]">Monto Programar</th>
                    <th className="p-2 w-[18%]">Canal Pago</th>
                    <th className="p-2 w-[16%]">Fecha</th>
                    <th className="p-2 text-center">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {documentosFiltrados.map((row: any, index: number) => {
                    const rowId = row.id || `row-${index}`
                    const diasMora = Number(row.dias_mora || row.diasMora || row.mora || 0)

                    return (
                      <tr key={rowId} className="hover:bg-blue-50/30 transition">
                        <td className="p-2 font-mono text-blue-900 font-bold">{row.documento || row.doc || 'S/N'}</td>
                        <td className="p-2 text-center">
                          <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            diasMora > 0 ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
                          }`}>
                            {diasMora > 0 ? `${diasMora} d.` : 'Al día'}
                          </span>
                        </td>
                        <td className="p-2 text-right font-black text-gray-900">
                          S/. {Number(row.saldo || 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-1">
                          <input
                            type="number"
                            placeholder="0.00"
                            value={inputsMonto[rowId] || ''}
                            onChange={(e) => handleInputChange(rowId, 'monto', e.target.value)}
                            className="w-full rounded border border-gray-200 py-1 px-1.5 font-bold text-gray-900 outline-none focus:border-blue-500 text-xs"
                          />
                        </td>
                        <td className="p-1">
                          <select
                            value={inputsMetodo[rowId] || 'Transferencia BCP'}
                            onChange={(e) => handleInputChange(rowId, 'metodo', e.target.value)}
                            className="w-full rounded border border-gray-200 py-1 px-1.5 text-gray-700 outline-none text-xs"
                          >
                            <option value="Transferencia BCP">Transferencia BCP</option>
                            <option value="Yape / Plin">Yape / Plin</option>
                            <option value="Efectivo">Efectivo</option>
                            <option value="Cheque">Cheque</option>
                          </select>
                        </td>
                        <td className="p-1">
                          <input
                            type="date"
                            value={inputsFecha[rowId] || ''}
                            onChange={(e) => handleInputChange(rowId, 'fecha', e.target.value)}
                            className="w-full rounded border border-gray-200 py-1 px-1 text-gray-700 outline-none text-xs"
                          />
                        </td>
                        <td className="p-2 text-center">
                          <button
                            onClick={() => handleProgramarFila(row, index)}
                            className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded transition shadow-sm"
                          >
                            Actualizar
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                  {documentosFiltrados.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-4 text-center text-gray-400">
                        No hay documentos registrados para esta combinación de tramo y zona.
                      </td>
                    </tr>
                  )}
                </tbody>

                <tfoot className="bg-gray-100 border-t-2 border-gray-200 font-bold sticky bottom-0 z-10">
                  <tr>
                    <td colSpan={2} className="p-2 text-right text-gray-700 font-extrabold uppercase text-[11px]">
                      Total Saldo:
                    </td>
                    <td className="p-2 text-right font-black text-gray-900 font-mono text-xs">
                      S/. {totalSaldoDocumentos.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td colSpan={4}></td>
                  </tr>
                </tfoot>

              </table>
            </div>
          </div>

        </div>
      </div>

      {/* CRONOGRAMA */}
      <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <h3 className="font-bold text-gray-800 flex items-center gap-2 text-xs">
              <Calendar className="h-4 w-4 text-blue-500" /> Cronograma de Compromisos Agendados
            </h3>
            
            {/* BOTONES EXCEL Y PDF AHORA UBICADOS AL LADO DEL TÍTULO */}
            <div className="flex items-center gap-2 print:hidden">
              <button 
                onClick={exportToExcel} 
                className="flex items-center gap-1.5 px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full font-bold shadow-sm transition text-[11px]"
              >
                <Download className="h-3.5 w-3.5" /> Excel
              </button>
              <button 
                onClick={() => window.print()} 
                className="flex items-center gap-1.5 px-3 py-1 bg-slate-800 hover:bg-slate-900 text-white rounded-full font-bold shadow-sm transition text-[11px]"
              >
                <Printer className="h-3.5 w-3.5" /> PDF
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto text-xs">
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-50 font-semibold text-gray-600 border-b border-gray-100">
              <tr>
                <th className="p-2">Cliente</th>
                <th className="p-2">Documento</th>
                <th className="p-2">Zona</th>
                <th className="p-2">Representante</th>
                <th className="p-2">Fecha Prog.</th>
                <th className="p-2">Canal</th>
                <th className="p-2 text-right">Monto Programado</th>
                <th className="p-2 text-center print:hidden">Estado</th>
                <th className="p-2 text-center print:hidden">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 text-gray-700">
              {pagosProgramados.map((pago) => (
                <tr key={pago.id} className="hover:bg-gray-50/50 transition">
                  <td className="p-2 font-bold text-gray-900">{pago.cliente}</td>
                  <td className="p-2 font-mono text-gray-500">{pago.documento}</td>
                  <td className="p-2 text-gray-600">{pago.zona}</td>
                  <td className="p-2 text-gray-500">{pago.representante}</td>
                  <td className="p-2 font-semibold">{pago.fechaProgramada}</td>
                  <td className="p-2 text-gray-500">{pago.metodoPago}</td>
                  <td className="p-2 text-right font-black text-blue-600">S/. {pago.montoProgramado.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</td>
                  <td className="p-2 text-center print:hidden">
                    <span 
                      onClick={() => toggleEstadoPago(pago.id)}
                      className={`cursor-pointer px-2 py-0.5 rounded text-[10px] font-bold ${
                        pago.estado === 'Completado' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {pago.estado}
                    </span>
                  </td>
                  <td className="p-2 text-center print:hidden flex justify-center gap-1">
                    <button onClick={() => toggleEstadoPago(pago.id)} className="p-1 text-gray-400 hover:text-green-600">
                      <CheckCircle2 className="h-4 w-4" />
                    </button>
                    <button onClick={() => eliminarPago(pago.id)} className="p-1 text-gray-400 hover:text-red-600">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {pagosProgramados.length === 0 && (
                <tr>
                  <td colSpan={9} className="p-4 text-center text-gray-400">
                    No hay compromisos agendados actualmente.
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