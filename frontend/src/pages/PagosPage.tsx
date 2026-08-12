import React, { useState, useEffect, useMemo, useRef } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import { getDocumentos, supabase } from '../lib/supabaseService'
import { parseCobranzaExcelFile } from '../lib/excelService'
import { 
  Search, Calendar, CheckCircle2, 
  Trash2, X, Download, Printer, MapPin, User, FileText, FileSpreadsheet, RefreshCw, ChevronDown, ArrowRightLeft, RotateCcw,
  Wallet, CalendarCheck, TrendingUp, Send, MessageSquare, AlertTriangle, FileCheck
} from 'lucide-react'
import * as XLSX from 'xlsx'

// INTERFACES
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

interface ProgramacionSupabase {
  numero_documento: string
  monto_programado: number
  canal_pago: string
  fecha_programada: string
}

export default function PagosPage() {
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const [loading, setLoading] = useState(true)

  // DOCUMENTOS EXCEL
  const [excelDocs, setExcelDocs] = useState<DocumentoExcel[]>([])
  const [selectedDocId, setSelectedDocId] = useState<string>(() => {
    return localStorage.getItem('cobranza_documento_activo_id') || ''
  })
  
  // SEGUNDO ARCHIVO EXCEL PARA COMPARACIÓN
  const [selectedDocIdComparar, setSelectedDocIdComparar] = useState<string>('')
  const [allRowsNuevo, setAllRowsNuevo] = useState<any[]>([])

  // DROPDOWNS DESPLEGABLES
  const [isDocDropdownOpen, setIsDocDropdownOpen] = useState(false)
  const [isDocDropdownCompararOpen, setIsDocDropdownCompararOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const dropdownCompararRef = useRef<HTMLDivElement>(null)

  // FILTROS Y SELECCIONES
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

  // PROGRAMACIONES DESDE SUPABASE
  const [programacionesMap, setProgramacionesMap] = useState<Record<string, ProgramacionSupabase>>({})

  // ESTADOS DE CAMPOS DE ENTRADA
  const [inputsMonto, setInputsMonto] = useState<{ [key: string]: string }>({})
  const [inputsFecha, setInputsFecha] = useState<{ [key: string]: string }>({})
  const [inputsMetodo, setInputsMetodo] = useState<{ [key: string]: string }>({})

  // 🤖 ESTADO PARA MODAL CUMPLIMIENTO / WHATSAPP
  const [clienteWhatsAppModal, setClienteWhatsAppModal] = useState<{
    cliente: string
    telefono: string
    mensaje: string
  } | null>(null)

  // Formateador de fecha/hora
  const formatFechaHora = (fechaRaw?: string) => {
    if (!fechaRaw) return ''
    try {
      const date = new Date(fechaRaw)
      if (isNaN(date.getTime())) return ''
      return date.toLocaleString('es-PE', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: true
      })
    } catch {
      return ''
    }
  }

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDocDropdownOpen(false)
      }
      if (dropdownCompararRef.current && !dropdownCompararRef.current.contains(event.target as Node)) {
        setIsDocDropdownCompararOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // 1. CARGAR PROGRAMACIONES DESDE SUPABASE
  const fetchProgramacionesSupabase = async () => {
    try {
      const { data, error } = await supabase.from('programaciones_cuotas').select('*')
      if (error) {
        console.error('Error al obtener programaciones:', error)
        return
      }
      const map: Record<string, ProgramacionSupabase> = {}
      ;(data || []).forEach((p: any) => { map[p.numero_documento] = p })
      setProgramacionesMap(map)
    } catch (err) {
      console.error(err)
    }
  }

  // 2. OBTENER LISTA DE DOCUMENTOS
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

  // 3. PROCESAR DOCUMENTO PRINCIPAL
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

      const inicialMonto: { [key: string]: string } = {}
      const inicialFecha: { [key: string]: string } = {}
      const inicialMetodo: { [key: string]: string } = {}

      parsedRows.forEach((row: any, index: number) => {
        const docNum = row.documento || row.doc || row.num_doc || `row-${index}`
        const progGuardada = programacionesMap[docNum]

        inicialMonto[docNum] = progGuardada ? String(progGuardada.monto_programado) : ''
        inicialFecha[docNum] = progGuardada ? progGuardada.fecha_programada : fechaDefecto
        inicialMetodo[docNum] = progGuardada ? progGuardada.canal_pago : 'Transferencia BCP'
      })

      setInputsMonto(inicialMonto)
      setInputsFecha(inicialFecha)
      setInputsMetodo(inicialMetodo)

      const localSaved = localStorage.getItem('cobranza_pagos_programados')
      if (localSaved) setPagosProgramados(JSON.parse(localSaved))

      toast.success(`Cargado reporte base: ${targetDoc.nombre}`)
    } catch (err: any) {
      toast.error('Error procesando reporte Excel: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  // 4. PROCESAR DOCUMENTO COMPARATIVO
  const processExcelDataComparar = async (docIdToLoad: string) => {
    if (!docIdToLoad) {
      setAllRowsNuevo([])
      return
    }

    const targetDoc = excelDocs.find(d => String(d.id) === String(docIdToLoad))
    if (!targetDoc) return

    setLoading(true)
    try {
      const response = await fetch(targetDoc.url_archivo)
      const blob = await response.blob()
      const file = new File([blob], targetDoc.nombre, { type: blob.type })

      const parsedRows = await parseCobranzaExcelFile(file)
      setAllRowsNuevo(parsedRows)
      toast.success(`Cargado reporte para comparar: ${targetDoc.nombre}`)
    } catch (err: any) {
      toast.error('Error cargando documento comparativo: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProgramacionesSupabase()
    fetchDocumentosList()
  }, [])

  useEffect(() => {
    if (selectedDocId && excelDocs.length > 0) {
      processExcelData(selectedDocId)
    }
  }, [selectedDocId, excelDocs, programacionesMap])

  useEffect(() => {
    if (selectedDocIdComparar && excelDocs.length > 0) {
      processExcelDataComparar(selectedDocIdComparar)
    }
  }, [selectedDocIdComparar, excelDocs])

  const handleDocumentChange = (docId: string) => {
    setSelectedDocId(docId)
    localStorage.setItem('cobranza_documento_activo_id', docId)
    setIsDocDropdownOpen(false)
  }

  const handleDocumentCompararChange = (docId: string) => {
    setSelectedDocIdComparar(docId)
    setIsDocDropdownCompararOpen(false)
  }

  const selectedDocObj = useMemo(() => {
    return excelDocs.find(d => String(d.id) === String(selectedDocId)) || excelDocs[0]
  }, [excelDocs, selectedDocId])

  const selectedDocCompararObj = useMemo(() => {
    return excelDocs.find(d => String(d.id) === String(selectedDocIdComparar))
  }, [excelDocs, selectedDocIdComparar])

  // VENDEDORES
  const vendedoresUnicos = useMemo(() => {
    const setV = new Set<string>()
    allRows.forEach((r) => {
      const rep = r.representante || r.vendedor
      if (rep) setV.add(rep)
    })
    return Array.from(setV).sort()
  }, [allRows])

  // FILTRO TRAMO
  const cumpleFiltroTramo = (diasMora: number) => {
    if (tramoFilter === 'TODOS') return true
    if (tramoFilter === 'ALDIA') return diasMora <= 0
    if (tramoFilter === '1-15') return diasMora >= 1 && diasMora <= 15
    if (tramoFilter === '16-45') return diasMora >= 16 && diasMora <= 45
    if (tramoFilter === '46+') return diasMora >= 46
    return true
  }

  // MAPA AUXILIAR DEL SEGUNDO EXCEL
  const mapaExcelNuevo = useMemo(() => {
    const map = new Map<string, number>()
    allRowsNuevo.forEach((row) => {
      const docNum = (row.documento || row.doc || row.num_doc || '').toString().trim()
      if (docNum) map.set(docNum, Number(row.saldo || 0))
    })
    return map
  }, [allRowsNuevo])

  // MAPA DE MONTOS PROGRAMADOS
  const programadosMapCalc = useMemo(() => {
    const map = new Map<string, number>()
    Object.entries(inputsMonto).forEach(([docNum, montoStr]) => {
      const val = parseFloat(montoStr)
      if (!isNaN(val) && val > 0) {
        map.set(docNum, val)
      }
    })
    return map
  }, [inputsMonto])

  // CÁLCULO GLOBAL DE KPIS
  const kpisGlobales = useMemo(() => {
    let totalCartera = 0
    let totalProgramado = 0
    let totalRecuperado = 0

    allRows.forEach((row, index) => {
      const rep = row.representante || row.vendedor || ''
      if (repFilter !== 'TODOS' && rep !== repFilter) return

      const diasMora = Number(row.dias_mora || row.diasMora || row.mora || 0)
      if (!cumpleFiltroTramo(diasMora)) return

      const docNum = row.documento || row.doc || row.num_doc || `row-${index}`
      const saldoBase = Number(row.saldo || 0)
      totalCartera += saldoBase

      const montoProg = programadosMapCalc.get(docNum) || 0
      totalProgramado += montoProg

      if (selectedDocIdComparar) {
        const saldoNuevo = mapaExcelNuevo.has(docNum) ? mapaExcelNuevo.get(docNum)! : 0
        const abonoReal = Math.max(0, saldoBase - saldoNuevo)
        totalRecuperado += abonoReal
      }
    })

    const pctCobertura = totalCartera > 0 ? (totalProgramado / totalCartera) * 100 : 0
    const pctRecuperado = totalCartera > 0 ? (totalRecuperado / totalCartera) * 100 : 0

    return { totalCartera, totalProgramado, pctCobertura, totalRecuperado, pctRecuperado }
  }, [allRows, repFilter, tramoFilter, programadosMapCalc, selectedDocIdComparar, mapaExcelNuevo])

  // RESUMEN ZONAS
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

  // RESUMEN CLIENTES
  const resumenClientes = useMemo(() => {
    if (!selectedZona) return []
    const mapClientes = new Map<string, { 
      cliente: string; 
      telefono?: string;
      saldoTotal: number; 
      saldoVencido: number; 
      saldoProgramado: number;
      count: number 
    }>()

    allRows.forEach((row, index) => {
      const rep = row.representante || row.vendedor || ''
      if (repFilter !== 'TODOS' && rep !== repFilter) return

      const diasMora = Number(row.dias_mora || row.diasMora || row.mora || 0)
      if (!cumpleFiltroTramo(diasMora)) return

      const zona = row.zona || row.ciudad || row.region || row.ubigeo || 'SIN ZONA'
      if (zona !== selectedZona) return

      const cliente = row.cliente || 'CLIENTE S/N'
      const telefono = row.telefono || row.celular || row.tel || ''
      const saldo = Number(row.saldo || 0)
      const docNum = row.documento || row.doc || row.num_doc || `row-${index}`
      const montoProg = programadosMapCalc.get(docNum) || 0

      if (!mapClientes.has(cliente)) {
        mapClientes.set(cliente, { cliente, telefono, saldoTotal: 0, saldoVencido: 0, saldoProgramado: 0, count: 0 })
      }

      const item = mapClientes.get(cliente)!
      item.saldoTotal += saldo
      if (diasMora > 0) item.saldoVencido += saldo
      item.saldoProgramado += montoProg
      item.count += 1
    })

    const result = Array.from(mapClientes.values()).sort((a, b) => a.cliente.localeCompare(b.cliente))

    if (result.length > 0 && (!selectedCliente || !mapClientes.has(selectedCliente))) {
      setSelectedCliente(result[0].cliente)
    }

    return result
  }, [allRows, selectedZona, repFilter, tramoFilter, programadosMapCalc])

  // DOCUMENTOS FILTRADOS
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

  const handleInputChange = (docNum: string, type: 'monto' | 'fecha' | 'metodo', value: string) => {
    if (type === 'monto') {
      setInputsMonto(prev => ({ ...prev, [docNum]: value }))
    } else if (type === 'fecha') {
      setInputsFecha(prev => ({ ...prev, [docNum]: value }))
    } else if (type === 'metodo') {
      setInputsMetodo(prev => ({ ...prev, [docNum]: value }))
    }
  }

  // 🤖 PREPARAR NOTIFICACIÓN WHATSAPP POR CLIENTE
  const abrirModalWhatsApp = (nombreCliente: string, telefonoCliente: string = '') => {
    const docsCliente = allRows.filter(r => (r.cliente || '') === nombreCliente)
    let totalProgramado = 0
    let fechaCompromiso = ''

    docsCliente.forEach(row => {
      const docNum = row.documento || row.doc || row.num_doc
      const monto = parseFloat(inputsMonto[docNum] || '0')
      if (!isNaN(monto) && monto > 0) {
        totalProgramado += monto
        if (!fechaCompromiso) fechaCompromiso = inputsFecha[docNum] || ''
      }
    })

    const fechaFmt = fechaCompromiso ? new Date(fechaCompromiso).toLocaleDateString('es-PE') : 'las fechas acordadas'
    const montoFmt = totalProgramado > 0 ? `S/. ${totalProgramado.toFixed(2)}` : 'el monto acordado'

    const mensajeDefecto = `Estimado(a) *${nombreCliente}*,\n\nLe saludamos cordialmente. Le recordamos que tiene un compromiso de pago agendado por un monto total de *${montoFmt}* programado para el *${fechaFmt}*.\n\nAgradecemos nos pueda enviar el comprobante de transferencia una vez realizado el pago para actualizar su saldo en sistema.\n\n¡Que tenga un excelente día!`

    setClienteWhatsAppModal({
      cliente: nombreCliente,
      telefono: telefonoCliente.replace(/\D/g, ''),
      mensaje: mensajeDefecto
    })
  }

  const enviarWhatsApp = () => {
    if (!clienteWhatsAppModal) return
    const { telefono, mensaje } = clienteWhatsAppModal
    
    const url = telefono 
      ? `https://wa.me/${telefono.startsWith('51') ? telefono : '51' + telefono}?text=${encodeURIComponent(mensaje)}`
      : `https://wa.me/?text=${encodeURIComponent(mensaje)}`

    window.open(url, '_blank')
    setClienteWhatsAppModal(null)
    toast.success('Abriendo WhatsApp...')
  }

  // 📊 EXPORTACIÓN DE REPORTE DE CUMPLIMIENTO / EFICIENCIA
  const exportarReporteCumplimiento = () => {
    if (!selectedDocIdComparar) {
      toast.error('Para exportar el reporte de eficiencia debes seleccionar un 2do archivo en "Comparar con".')
      return
    }

    const dataReporte: any[] = []

    allRows.forEach((row, index) => {
      const docNum = row.documento || row.doc || row.num_doc || `row-${index}`
      const montoProg = parseFloat(inputsMonto[docNum] || '0')

      if (montoProg > 0) {
        const cliente = row.cliente || 'CLIENTE S/N'
        const zona = row.zona || row.ciudad || 'SIN ZONA'
        const rep = row.representante || row.vendedor || 'NO ASIGNADO'
        const saldoBase = Number(row.saldo || 0)
        const fechaProg = inputsFecha[docNum] || ''
        const canal = inputsMetodo[docNum] || ''

        const saldoNuevo = mapaExcelNuevo.has(docNum) ? mapaExcelNuevo.get(docNum)! : 0
        const abonoReal = Math.max(0, saldoBase - saldoNuevo)

        let estadoCumplimiento = 'Incumplió'
        if (saldoNuevo === 0 || abonoReal >= montoProg) {
          estadoCumplimiento = 'Cumplió'
        } else if (abonoReal > 0) {
          estadoCumplimiento = 'Parcial'
        }

        dataReporte.push({
          Cliente: cliente,
          Documento: docNum,
          Zona: zona,
          Vendedor: rep,
          'Fecha Programada': fechaProg,
          'Canal Pago': canal,
          'Saldo Inicial (S/.)': saldoBase,
          'Monto Programado (S/.)': montoProg,
          'Monto Recuperado (S/.)': abonoReal,
          'Saldo Actual (S/.)': saldoNuevo,
          'Resultado Eficiencia': estadoCumplimiento
        })
      }
    })

    if (dataReporte.length === 0) {
      toast.error('No hay documentos con compromisos programados para analizar.')
      return
    }

    const worksheet = XLSX.utils.json_to_sheet(dataReporte)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Eficiencia_Cobranza')
    XLSX.writeFile(workbook, `Reporte_Eficiencia_Cobranza_${new Date().toISOString().split('T')[0]}.xlsx`)
    toast.success('Reporte de Eficiencia exportado correctamente.')
  }

  // RESETEAR MONTOS
  const handleLimpiarMontosCliente = async () => {
    if (!documentosFiltrados || documentosFiltrados.length === 0) return

    const confirmacion = window.confirm(
      '¿Estás seguro de resetear a 0.00 todos los montos programados de este cliente?'
    )
    if (!confirmacion) return

    try {
      const docsAEliminar = documentosFiltrados.map(
        (d: any) => d.documento || d.doc || d.num_doc
      ).filter(Boolean)

      const registrosACero = docsAEliminar.map((docNum: string) => ({
        numero_documento: docNum,
        monto_programado: 0,
        canal_pago: inputsMetodo[docNum] || 'Transferencia BCP',
        fecha_programada: inputsFecha[docNum] || new Date().toISOString().split('T')[0],
      }))

      const { error } = await supabase
        .from('programaciones_cuotas')
        .upsert(registrosACero, { onConflict: 'numero_documento' })

      if (error) throw error

      setInputsMonto((prev) => {
        const nuevoState = { ...prev }
        docsAEliminar.forEach((docNum: string) => {
          nuevoState[docNum] = '0.00'
        })
        return nuevoState
      })

      const pagosFiltrados = pagosProgramados.filter(
        (pago) => !docsAEliminar.includes(pago.documento)
      )
      setPagosProgramados(pagosFiltrados)
      localStorage.setItem('cobranza_pagos_programados', JSON.stringify(pagosFiltrados))

      await fetchProgramacionesSupabase()

      toast.success('Se resetearon los montos a 0.00 correctamente')
    } catch (err: any) {
      console.error('Error al resetear montos:', err)
      toast.error('Error al resetear montos: ' + err.message)
    }
  }

  // PROGRAMAR FILA (CON VALIDACIÓN DE SOBREMONTO)
  const handleProgramarFila = async (row: any, index: number) => {
    const docNum = row.documento || row.doc || row.num_doc || `row-${index}`
    const montoStr = inputsMonto[docNum]
    const fecha = inputsFecha[docNum]
    const metodo = inputsMetodo[docNum] || 'Transferencia BCP'
    const saldoBase = Number(row.saldo || 0)

    if (montoStr === '' || montoStr === undefined || isNaN(parseFloat(montoStr)) || parseFloat(montoStr) < 0) {
      toast.error('Por favor, ingresa un monto válido (0 o mayor).')
      return
    }

    const montoProg = parseFloat(montoStr)

    // 🔴 VALIDACIÓN DE SOBREMONTO ANTES DE GUARDAR EN SUPABASE
    if (montoProg > saldoBase) {
      toast.error(`El monto programado (S/. ${montoProg.toFixed(2)}) no puede exceder el saldo actual (S/. ${saldoBase.toFixed(2)}).`)
      return
    }

    try {
      const { error } = await supabase
        .from('programaciones_cuotas')
        .upsert(
          {
            numero_documento: docNum,
            monto_programado: montoProg,
            canal_pago: metodo,
            fecha_programada: fecha,
          },
          { onConflict: 'numero_documento' }
        )

      if (error) throw error

      const nuevoPago: PagoProgramado = {
        id: `pago-${Date.now()}-${index}`,
        cliente: row.cliente || 'Desconocido',
        documento: docNum,
        zona: row.zona || row.ciudad || row.region || row.ubigeo || 'Sin Zona',
        representante: row.representante || row.vendedor || 'No Asignado',
        montoOriginal: saldoBase,
        montoProgramado: montoProg,
        fechaProgramada: fecha,
        metodoPago: metodo,
        estado: 'Pendiente'
      }

      const listaActualizada = [nuevoPago, ...pagosProgramados.filter(p => p.documento !== docNum)]
      setPagosProgramados(listaActualizada)
      localStorage.setItem('cobranza_pagos_programados', JSON.stringify(listaActualizada))

      await fetchProgramacionesSupabase()

      toast.success(`Programación (${montoProg}) guardada para ${docNum}`)
    } catch (err: any) {
      toast.error('Error al guardar en Supabase: ' + err.message)
    }
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
      
      {/* BARRA SUPERIOR DE ACCIONES */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm print:hidden">
        <div>
          <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <MapPin className="h-5 w-5 text-blue-600" /> Explorador de Cartera y Comparativa de Pagos
          </h1>
          <p className="text-gray-500 text-[11px]">Gestiona metas, notifica a clientes por WhatsApp y analiza la efectividad de cobranza.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          
          {/* SELECTOR EXCEL BASE */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setIsDocDropdownOpen(!isDocDropdownOpen)}
              className="flex items-center gap-2 px-3 py-1.5 bg-blue-50/50 hover:bg-blue-50 border border-blue-100 rounded-2xl shadow-sm transition text-left"
            >
              <div className="p-1.5 bg-emerald-100/80 rounded-xl text-emerald-700">
                <FileSpreadsheet className="h-4 w-4" />
              </div>
              <div className="flex flex-col min-w-[150px] max-w-[200px]">
                <span className="text-[9px] font-bold text-blue-600 uppercase">1. Doc Base</span>
                <div className="flex items-center justify-between gap-1">
                  <span className="font-bold text-gray-900 truncate text-[11px]">
                    {selectedDocObj?.nombre || 'Cargando...'}
                  </span>
                  <ChevronDown className={`h-3.5 w-3.5 text-gray-500 transition-transform ${isDocDropdownOpen ? 'rotate-180' : ''}`} />
                </div>
              </div>
              {loading && <RefreshCw className="h-3.5 w-3.5 text-blue-600 animate-spin ml-1" />}
            </button>

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
                            <span className="text-gray-500 font-medium">Actualizado:</span>
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

          <ArrowRightLeft className="h-4 w-4 text-gray-400 hidden lg:block" />

          {/* SELECTOR EXCEL A COMPARAR */}
          <div className="relative" ref={dropdownCompararRef}>
            <button
              type="button"
              onClick={() => setIsDocDropdownCompararOpen(!isDocDropdownCompararOpen)}
              className="flex items-center gap-2 px-3 py-1.5 bg-amber-50/60 hover:bg-amber-100/50 border border-amber-200 rounded-2xl shadow-sm transition text-left"
            >
              <div className="p-1.5 bg-amber-100 rounded-xl text-amber-700">
                <FileSpreadsheet className="h-4 w-4" />
              </div>
              <div className="flex flex-col min-w-[150px] max-w-[200px]">
                <span className="text-[9px] font-bold text-amber-700 uppercase">2. Comparar con</span>
                <div className="flex items-center justify-between gap-1">
                  <span className="font-bold text-gray-900 truncate text-[11px]">
                    {selectedDocCompararObj?.nombre || 'Seleccionar...'}
                  </span>
                  <ChevronDown className={`h-3.5 w-3.5 text-gray-500 transition-transform ${isDocDropdownCompararOpen ? 'rotate-180' : ''}`} />
                </div>
              </div>
            </button>

            {isDocDropdownCompararOpen && (
              <div className="absolute right-0 mt-1 w-80 bg-white border border-gray-100 rounded-2xl shadow-xl z-50 overflow-hidden divide-y divide-gray-50 max-h-72 overflow-y-auto">
                <button
                  type="button"
                  onClick={() => handleDocumentCompararChange('')}
                  className="w-full p-2.5 text-left text-gray-500 hover:bg-gray-50 font-medium text-xs"
                >
                  (Ninguno / No comparar)
                </button>
                {excelDocs.map((doc) => {
                  const isSelected = String(doc.id) === String(selectedDocIdComparar)
                  const fechaFmt = formatFechaHora(doc.fecha_carga || doc.created_at || doc.fecha)
                  return (
                    <button
                      key={doc.id}
                      type="button"
                      onClick={() => handleDocumentCompararChange(String(doc.id))}
                      className={`w-full p-2.5 text-left flex items-start gap-2.5 transition ${
                        isSelected ? 'bg-amber-50' : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className={`p-1.5 rounded-xl mt-0.5 ${isSelected ? 'bg-amber-600 text-white' : 'bg-amber-100 text-amber-700'}`}>
                        <FileSpreadsheet className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`font-bold truncate text-[12px] ${isSelected ? 'text-amber-900' : 'text-gray-800'}`}>
                          {doc.nombre}
                        </p>
                        {fechaFmt && (
                          <div className="flex items-center gap-1 text-[11px] mt-0.5">
                            <Calendar className="h-3 w-3 text-amber-600 shrink-0" />
                            <span className="text-gray-500 font-medium">Actualizado:</span>
                            <span className="font-bold text-amber-700">{fechaFmt}</span>
                          </div>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* BOTÓN REPORTE CUMPLIMIENTO / EFICIENCIA */}
          {selectedDocIdComparar && (
            <button
              onClick={exportarReporteCumplimiento}
              className="flex items-center gap-1.5 px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-2xl font-bold transition shadow-sm"
              title="Exportar Reporte de Eficiencia de Cumplimiento"
            >
              <FileCheck className="h-4 w-4" />
              <span className="hidden md:inline">Reporte Eficiencia</span>
            </button>
          )}

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
              className="rounded-xl border border-gray-200 bg-gray-50 py-1.5 pl-8 pr-3 w-36 outline-none focus:border-blue-500"
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

      {/* TARJETAS DE KPIS SUPERIORES */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 print:hidden">
        <div className="bg-white p-3.5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total Cartera Base</p>
            <h3 className="text-lg font-black text-gray-800 mt-0.5">
              S/. {kpisGlobales.totalCartera.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
            </h3>
            <p className="text-[10px] text-gray-500 mt-1 font-medium">Deuda acumulada en el reporte activo</p>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
            <Wallet className="h-6 w-6" />
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total Programado</p>
              <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                {kpisGlobales.pctCobertura.toFixed(1)}% Cobertura
              </span>
            </div>
            <h3 className="text-lg font-black text-blue-900 mt-0.5">
              S/. {kpisGlobales.totalProgramado.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
            </h3>
            <div className="w-full bg-gray-100 rounded-full h-1.5 mt-2 overflow-hidden">
              <div 
                className="bg-blue-600 h-1.5 rounded-full transition-all duration-500" 
                style={{ width: `${Math.min(100, kpisGlobales.pctCobertura)}%` }}
              ></div>
            </div>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl ml-3">
            <CalendarCheck className="h-6 w-6" />
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total Recuperado</p>
              {selectedDocIdComparar && (
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                  {kpisGlobales.pctRecuperado.toFixed(1)}% Cobrado
                </span>
              )}
            </div>
            <h3 className="text-lg font-black text-emerald-800 mt-0.5">
              {selectedDocIdComparar 
                ? `S/. ${kpisGlobales.totalRecuperado.toLocaleString('es-PE', { minimumFractionDigits: 2 })}` 
                : 'S/. 0.00'}
            </h3>
            <p className="text-[10px] text-gray-400 mt-1 font-medium truncate">
              {selectedDocIdComparar ? 'Calculado vs. reporte comparativo' : 'Selecciona un 2do reporte para evaluar'}
            </p>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl ml-3">
            <TrendingUp className="h-6 w-6" />
          </div>
        </div>
      </div>

      {/* FILTRAR TRAMO */}
      <div className="bg-white p-3 rounded-2xl border border-gray-100 shadow-sm flex flex-wrap items-center gap-2 text-xs print:hidden">
        <span className="text-gray-500 font-semibold mr-2">Filtrar Tramo:</span>
        <button onClick={() => setTramoFilter('TODOS')} className={`px-4 py-1 rounded-full font-bold transition-all shadow-sm ${tramoFilter === 'TODOS' ? 'bg-blue-600 text-white shadow-blue-200' : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200'}`}>Todos</button>
        <button onClick={() => setTramoFilter('ALDIA')} className={`flex items-center gap-1.5 px-3 py-1 rounded-full font-semibold transition-all border ${tramoFilter === 'ALDIA' ? 'bg-emerald-500 text-white border-emerald-600 shadow-sm' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}><span className="h-2.5 w-2.5 rounded-full bg-emerald-500 border border-emerald-600"></span>Al día</button>
        <button onClick={() => setTramoFilter('1-15')} className={`flex items-center gap-1.5 px-3 py-1 rounded-full font-semibold transition-all border ${tramoFilter === '1-15' ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}><span className="h-2.5 w-2.5 rounded-full bg-emerald-500 border border-emerald-600"></span>1-15 días</button>
        <button onClick={() => setTramoFilter('16-45')} className={`flex items-center gap-1.5 px-3 py-1 rounded-full font-semibold transition-all border ${tramoFilter === '16-45' ? 'bg-amber-500 text-white border-amber-600 shadow-sm' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}><span className="h-2.5 w-2.5 rounded-full bg-yellow-400 border border-amber-500"></span>16-45 días</button>
        <button onClick={() => setTramoFilter('46+')} className={`flex items-center gap-1.5 px-3 py-1 rounded-full font-semibold transition-all border ${tramoFilter === '46+' ? 'bg-red-600 text-white border-red-700 shadow-sm' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}><span className="h-2.5 w-2.5 rounded-full bg-red-600 border border-red-700"></span>+46 días</button>
      </div>

      {/* DASHBOARD JERÁRQUICO */}
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
                    <p className={`text-[10px] ${isSelected ? 'text-blue-100' : 'text-gray-400'}`}>{item.count} docs</p>
                  </div>
                  <div className="text-right whitespace-nowrap">
                    <p className="font-bold">S/. {item.saldoTotal.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</p>
                    <span className={`inline-block text-[9px] px-1.5 py-0.2 rounded font-bold ${
                      isSelected ? 'bg-blue-800 text-white' : pctVencido > 0 ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
                    }`}>
                      {pctVencido.toFixed(0)}% Venc.
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
          <div className="bg-gray-800 text-white p-2.5 text-[11px] font-bold flex justify-between">
            <span>TOTAL:</span>
            <span>S/. {totalsGeneralZonas.tot.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</span>
          </div>
        </div>

        {/* PANEL DERECHO */}
        <div className="lg:col-span-9 space-y-4 flex flex-col h-[520px]">
          
          {/* CLIENTES CON BARRA DE PROGRESO Y BOTÓN WHATSAPP */}
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden h-[200px] flex flex-col">
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
                    <th className="p-2 text-center w-[16%]">Progreso</th>
                    <th className="p-2 text-center">Notificar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {resumenClientes.map((c) => {
                    const isSelected = selectedCliente === c.cliente && !searchTerm
                    const porVencer = Math.max(0, c.saldoTotal - c.saldoVencido)

                    const pctProg = c.saldoTotal > 0 ? (c.saldoProgramado / c.saldoTotal) * 100 : 0
                    const pctVisual = Math.min(100, Math.max(0, pctProg))

                    return (
                      <tr
                        key={c.cliente}
                        onClick={() => {
                          setSelectedCliente(c.cliente)
                          setSearchTerm('')
                        }}
                        className={`cursor-pointer transition ${isSelected ? 'bg-emerald-50 text-emerald-900 font-bold' : 'hover:bg-gray-50 text-gray-700'}`}
                      >
                        <td className="p-2 truncate max-w-[200px] font-semibold">{c.cliente}</td>
                        <td className="p-2 text-center text-gray-400">{c.count}</td>
                        <td className="p-2 text-right font-medium text-red-600">{c.saldoVencido > 0 ? `S/. ${c.saldoVencido.toLocaleString('es-PE', { minimumFractionDigits: 2 })}` : '-'}</td>
                        <td className="p-2 text-right font-medium text-emerald-600">{porVencer > 0 ? `S/. ${porVencer.toLocaleString('es-PE', { minimumFractionDigits: 2 })}` : '-'}</td>
                        <td className="p-2 text-right font-bold">S/. {c.saldoTotal.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</td>
                        
                        {/* BARRA DE PROGRESO */}
                        <td className="p-2 text-center">
                          <div className="flex flex-col gap-1">
                            <div className="flex justify-between items-center text-[10px]">
                              <span className="font-bold text-blue-700">S/. {c.saldoProgramado.toLocaleString('es-PE', { minimumFractionDigits: 0 })}</span>
                              <span className={`font-extrabold ${pctVisual === 100 ? 'text-emerald-600' : 'text-gray-500'}`}>
                                {pctVisual.toFixed(0)}%
                              </span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                              <div
                                className={`h-1.5 rounded-full transition-all duration-300 ${
                                  pctVisual >= 100 ? 'bg-emerald-500' : pctVisual > 0 ? 'bg-blue-600' : 'bg-gray-300'
                                }`}
                                style={{ width: `${pctVisual}%` }}
                              ></div>
                            </div>
                          </div>
                        </td>

                        {/* 🤖 BOTÓN NOTIFICAR CUMPLIMIENTO / RECORDATORIO */}
                        <td className="p-2 text-center">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              abrirModalWhatsApp(c.cliente, c.telefono)
                            }}
                            className="p-1.5 bg-emerald-50 hover:bg-emerald-600 text-emerald-600 hover:text-white rounded-xl border border-emerald-200 transition shadow-sm"
                            title="Enviar recordatorio de cobro por WhatsApp"
                          >
                            <MessageSquare className="h-3.5 w-3.5" />
                          </button>
                        </td>

                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* DOCUMENTOS Y COMPARATIVA INTEGRADA */}
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden flex-1 flex flex-col">
            <div className="flex items-center justify-between bg-slate-800 text-white p-3 rounded-t-lg text-[11px]">
              <div className="flex items-center gap-2">
                <FileText className="h-3.5 w-3.5 text-blue-400" />
                <span className="font-semibold text-yellow-400">
                  📄 Documentos de: {searchTerm ? `Búsqueda: "${searchTerm}"` : selectedCliente || 'Cliente Seleccionado'}
                </span>
                <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full">
                  {documentosFiltrados.length} Registro(s)
                </span>
              </div>

              <button
                onClick={handleLimpiarMontosCliente}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white border border-red-500/30 rounded-md text-xs font-medium transition-all shadow-sm"
                title="Poner todos los montos de este cliente en 0.00"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Resetear a 0.00
              </button>
            </div>

            <div className="overflow-x-auto overflow-y-auto flex-1">
              <table className="w-full text-left border-collapse">
                <thead className="bg-gray-50 font-semibold text-gray-600 border-b border-gray-100 sticky top-0 bg-white z-10">
                  <tr>
                    <th className="p-2">Documento</th>
                    <th className="p-2 text-center">Mora</th>
                    <th className="p-2 text-right">Saldo Base</th>
                    <th className="p-2 w-[14%]">Monto Programar</th>
                    <th className="p-2 w-[16%]">Canal Pago</th>
                    <th className="p-2 w-[14%]">Fecha</th>
                    {selectedDocIdComparar && (
                      <>
                        <th className="p-2 text-right text-amber-800 bg-amber-50">Saldo Nuevo</th>
                        <th className="p-2 text-center bg-amber-50">Cumplimiento</th>
                      </>
                    )}
                    <th className="p-2 text-center">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {documentosFiltrados.map((row: any, index: number) => {
                    const docNum = row.documento || row.doc || row.num_doc || `row-${index}`
                    const diasMora = Number(row.dias_mora || row.diasMora || row.mora || 0)
                    const saldoBase = Number(row.saldo || 0)

                    const tieneComparativo = Boolean(selectedDocIdComparar)
                    const saldoNuevo = tieneComparativo 
                      ? (mapaExcelNuevo.has(docNum) ? mapaExcelNuevo.get(docNum)! : 0)
                      : saldoBase

                    const montoProgramado = parseFloat(inputsMonto[docNum] || '0') || 0
                    const abonoReal = Math.max(0, saldoBase - saldoNuevo)

                    let badgeCumplimiento = null
                    if (tieneComparativo) {
                      if (montoProgramado > 0) {
                        if (saldoNuevo === 0 || abonoReal >= montoProgramado) {
                          badgeCumplimiento = <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full text-[10px] font-bold">Cumplió</span>
                        } else if (abonoReal > 0) {
                          badgeCumplimiento = <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full text-[10px] font-bold">Parcial</span>
                        } else {
                          badgeCumplimiento = <span className="bg-red-100 text-red-800 px-2 py-0.5 rounded-full text-[10px] font-bold">Incumplió</span>
                        }
                      } else {
                        badgeCumplimiento = <span className="bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full text-[10px]">Sin Prog.</span>
                      }
                    }

                    return (
                      <tr key={docNum} className="hover:bg-blue-50/30 transition">
                        <td className="p-2 font-mono text-blue-900 font-bold">{docNum}</td>
                        <td className="p-2 text-center">
                          <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            diasMora > 0 ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
                          }`}>
                            {diasMora > 0 ? `${diasMora} d.` : 'Al día'}
                          </span>
                        </td>
                        <td className="p-2 text-right font-black text-gray-900">
                          S/. {saldoBase.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                        </td>
                        
                        {/* 🛡️ INPUT DE MONTO CON ALERTA Y TOOLTIP */}
                        <td className="p-1">
                          {(() => {
                            const montoIngresado = parseFloat(inputsMonto[docNum] || '0')
                            const esSobremonto = montoIngresado > saldoBase

                            return (
                              <div className="relative group">
                                <input
                                  type="number"
                                  placeholder="0.00"
                                  value={inputsMonto[docNum] !== undefined ? inputsMonto[docNum] : ''}
                                  onChange={(e) => handleInputChange(docNum, 'monto', e.target.value)}
                                  className={`w-full rounded border py-1 px-1.5 font-bold outline-none text-xs transition-colors ${
                                    esSobremonto
                                      ? 'border-red-500 bg-red-50 text-red-700 focus:border-red-600'
                                      : 'border-gray-200 text-gray-900 focus:border-blue-500'
                                  }`}
                                />

                                {esSobremonto && (
                                  <div className="absolute left-1/2 -top-9 -translate-x-1/2 hidden group-hover:flex items-center gap-1 bg-red-600 text-white text-[10px] font-bold px-2 py-1 rounded shadow-lg z-30 whitespace-nowrap pointer-events-none">
                                    <AlertTriangle className="h-3 w-3 shrink-0" />
                                    <span>El monto ingresado supera la deuda actual</span>
                                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-red-600"></div>
                                  </div>
                                )}
                              </div>
                            )
                          })()}
                        </td>

                        <td className="p-1">
                          <select
                            value={inputsMetodo[docNum] || 'Transferencia BCP'}
                            onChange={(e) => handleInputChange(docNum, 'metodo', e.target.value)}
                            className="w-full rounded border border-gray-200 py-1 px-1.5 text-gray-700 outline-none text-xs"
                          >
                            <option value="Transferencia BCP">Transferencia BCP</option>
                            <option value="Yape / Plin">Yape / Plin</option>
                            <option value="Efectivo">Efectivo</option>
                            <option value="Cheque">Cheque</option>
                          </select>
                        </td>

                        {/* 📅 INPUT DE FECHA CON RESTRICCIÓN DE FECHAS PASADAS */}
                        <td className="p-1">
                          <input
                            type="date"
                            min={new Date().toISOString().split('T')[0]}
                            value={inputsFecha[docNum] || ''}
                            onChange={(e) => handleInputChange(docNum, 'fecha', e.target.value)}
                            className="w-full rounded border border-gray-200 py-1 px-1 text-gray-700 outline-none text-xs focus:border-blue-500"
                          />
                        </td>

                        {tieneComparativo && (
                          <>
                            <td className="p-2 text-right font-black text-amber-900 bg-amber-50/50">
                              S/. {saldoNuevo.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="p-2 text-center bg-amber-50/50">
                              {badgeCumplimiento}
                            </td>
                          </>
                        )}

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
                </tbody>

                <tfoot className="bg-gray-100 border-t-2 border-gray-200 font-bold sticky bottom-0 z-10">
                  <tr>
                    <td colSpan={2} className="p-2 text-right text-gray-700 font-extrabold uppercase text-[11px]">
                      Total Saldo Base:
                    </td>
                    <td className="p-2 text-right font-black text-gray-900 font-mono text-xs">
                      S/. {totalSaldoDocumentos.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td colSpan={selectedDocIdComparar ? 6 : 4}></td>
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

      {/* 🤖 MODAL DE NOTIFICACIÓN WHATSAPP */}
      {clienteWhatsAppModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden border border-gray-100">
            <div className="bg-emerald-600 text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                <h3 className="font-bold text-sm">Enviar Recordatorio de Pago</h3>
              </div>
              <button 
                onClick={() => setClienteWhatsAppModal(null)} 
                className="text-emerald-100 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Cliente</label>
                <p className="font-bold text-gray-800 text-sm">{clienteWhatsAppModal.cliente}</p>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">
                  Número de Teléfono / WhatsApp (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ej: 987654321"
                  value={clienteWhatsAppModal.telefono}
                  onChange={(e) => setClienteWhatsAppModal({ ...clienteWhatsAppModal, telefono: e.target.value })}
                  className="w-full border border-gray-200 rounded-xl p-2 font-mono text-gray-800 outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">
                  Mensaje Personalizable
                </label>
                <textarea
                  rows={6}
                  value={clienteWhatsAppModal.mensaje}
                  onChange={(e) => setClienteWhatsAppModal({ ...clienteWhatsAppModal, mensaje: e.target.value })}
                  className="w-full border border-gray-200 rounded-xl p-2.5 text-xs text-gray-700 outline-none focus:border-emerald-500 font-sans"
                />
              </div>
            </div>

            <div className="bg-gray-50 p-3 border-t border-gray-100 flex items-center justify-end gap-2">
              <button
                onClick={() => setClienteWhatsAppModal(null)}
                className="px-4 py-2 border border-gray-200 text-gray-600 font-bold rounded-xl hover:bg-gray-100 transition"
              >
                Cancelar
              </button>
              <button
                onClick={enviarWhatsApp}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-sm transition"
              >
                <Send className="h-4 w-4" /> Abrir WhatsApp
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}