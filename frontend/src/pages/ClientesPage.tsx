import React, { useEffect, useState, useMemo, useRef } from 'react'
import { getDocumentos } from '../lib/supabaseService'
import { parseCobranzaExcelFile } from '../lib/excelService'
import { 
  Search, User, Building2, Wallet, Calendar, X, FileText, 
  History, CheckCircle2, ShieldAlert, MapPin, Copy, Check, 
  Printer, Store, Edit2, Trash2, Save,
  BarChart3, MessageCircle, Send, Phone, Award, LayoutGrid, 
  Table as TableIcon, ArrowUpDown, ChevronLeft, ChevronRight, SlidersHorizontal, AlertCircle, FileSpreadsheet, RefreshCw, ChevronDown
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { toast } from 'react-hot-toast'

interface DocumentoExcel {
  id: string
  nombre: string
  ruta_archivo: string
  url_archivo: string
  fecha_carga?: string
  created_at?: string
  fecha?: string
}

interface ClienteConsolidado {
  nombre: string
  nombreComercial: string
  ruc: string
  zona: string
  representante: string
  saldoTotal: number
  documentosAsociados: number
  maxDiasMora: number
  minDiasMora: number
  docsAlDia: number
  docsEnMora: number
  documentosDetalle: any[]
}

interface NotaBitacora {
  id: string
  cliente: string
  fecha: string
  texto: string
}

type SortField = 'nombre' | 'saldoTotal' | 'maxDiasMora' | 'zona'
type SortOrder = 'asc' | 'desc'

export default function ClientesPage() {
  const [clientes, setClientes] = useState<ClienteConsolidado[]>([])
  
  // ESTADO DE DOCUMENTOS EXCEL DISPONIBLES Y SELECCIONADO
  const [excelDocs, setExcelDocs] = useState<DocumentoExcel[]>([])
  const [selectedDocId, setSelectedDocId] = useState<string>(() => {
    return localStorage.getItem('cobranza_documento_activo_id') || ''
  })

  // Estado y Ref para desplegable personalizado
  const [isDocDropdownOpen, setIsDocDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const [searchTerm, setSearchTerm] = useState<string>('')
  const [repFilter, setRepFilter] = useState<string>('TODOS')
  const [zonaFilter, setZonaFilter] = useState<string>('TODAS')
  const [moraRangeFilter, setMoraRangeFilter] = useState<string>('TODOS')
  const [minDeudaFilter, setMinDeudaFilter] = useState<number | ''>('')
  
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid')
  const [currentPage, setCurrentPage] = useState<number>(1)
  const itemsPerPage = 12

  const [sortField, setSortField] = useState<SortField>('saldoTotal')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')

  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  const [copiedRuc, setCopiedRuc] = useState<string | null>(null)
  const searchContainerRef = useRef<HTMLDivElement>(null)

  const [selectedClienteModal, setSelectedClienteModal] = useState<ClienteConsolidado | null>(null)
  const [activeTab, setActiveTab] = useState<'docs' | 'bitacora' | 'estado_cuenta' | 'riesgo' | 'whatsapp'>('docs')
  
  const [notas, setNotas] = useState<NotaBitacora[]>(() => {
    const saved = localStorage.getItem('cobranza_bitacora_notas')
    return saved ? JSON.parse(saved) : []
  })
  const [nuevaNota, setNuevaNota] = useState<string>('')
  const [editingNotaId, setEditingNotaId] = useState<string | null>(null)
  const [textoEditado, setTextoEditado] = useState<string>('')

  const [telefonosCliente, setTelefonosCliente] = useState<Record<string, string>>(() => {
    const saved = localStorage.getItem('cobranza_telefonos_clientes')
    return saved ? JSON.parse(saved) : {}
  })
  const [telefonoActual, setTelefonoActual] = useState<string>('')
  const [mensajeWhatsapp, setMensajeWhatsapp] = useState<string>('')
  const [plantillaSeleccionada, setPlantillaSeleccionada] = useState<'suave' | 'aviso' | 'suspension'>('aviso')

  // Helper para formatear fecha y hora idéntico al diseño de la imagen
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

  // Cerrar desplegable al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDocDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // 1. Obtener listado de documentos Excel registrados
  const fetchDocumentosList = async () => {
    try {
      setLoading(true)
      setError(null)
      const { data, error: supabaseError } = await getDocumentos()
      if (supabaseError) throw new Error(typeof supabaseError === 'string' ? supabaseError : (supabaseError as any)?.message || 'Error Supabase')

      const documentos = (data || []) as any[]
      const excels = documentos.filter((doc: any) => 
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
        setClientes([])
        setLoading(false)
      }
    } catch (err: any) {
      setError(err.message || 'Error al obtener la lista de documentos.')
      setLoading(false)
    }
  }

  // 2. Procesar el Excel seleccionado y consolidar los Clientes
  const processExcelData = async (docIdToLoad: string) => {
    if (!docIdToLoad || excelDocs.length === 0) return

    const targetDoc = excelDocs.find(d => String(d.id) === String(docIdToLoad))
    if (!targetDoc) return

    setLoading(true)
    setError(null)
    try {
      if (!targetDoc.url_archivo) throw new Error('La URL del archivo no es válida.')

      const response = await fetch(targetDoc.url_archivo)
      const blob = await response.blob()
      const file = new File([blob], targetDoc.nombre, { type: blob.type })

      const parsedRows = await parseCobranzaExcelFile(file)
      const clientesMap: { [key: string]: ClienteConsolidado } = {}

      parsedRows.forEach((row: any) => {
        const nombreCliente = (row.cliente || row.razon_social || 'Cliente No Identificado').trim()
        const nombreComercial = (row.nombre_comercial || '').trim()
        const ruc = (row.ruc_dni || row.codsocio || '').trim()
        const zona = (row.zona || 'Sin Zona').trim()
        const representante = row.representante || row.vendedor || 'No Asignado'
        const saldo = Number(row.saldo || 0)
        const diasMora = Number(row.dias_mora || row.diasMora || row.mora || 0)

        if (!clientesMap[nombreCliente]) {
          clientesMap[nombreCliente] = {
            nombre: nombreCliente,
            nombreComercial: nombreComercial,
            ruc: ruc,
            zona: zona,
            representante: representante,
            saldoTotal: 0,
            documentosAsociados: 0,
            maxDiasMora: diasMora,
            minDiasMora: diasMora,
            docsAlDia: 0,
            docsEnMora: 0,
            documentosDetalle: []
          }
        }

        clientesMap[nombreCliente].saldoTotal += saldo
        clientesMap[nombreCliente].documentosAsociados += 1
        clientesMap[nombreCliente].documentosDetalle.push(row)
        
        if (!clientesMap[nombreCliente].nombreComercial && nombreComercial) {
          clientesMap[nombreCliente].nombreComercial = nombreComercial
        }
        if (!clientesMap[nombreCliente].ruc && ruc) {
          clientesMap[nombreCliente].ruc = ruc
        }

        if (diasMora > 0) {
          clientesMap[nombreCliente].docsEnMora += 1
        } else {
          clientesMap[nombreCliente].docsAlDia += 1
        }

        if (diasMora > clientesMap[nombreCliente].maxDiasMora) {
          clientesMap[nombreCliente].maxDiasMora = diasMora
        }
        if (diasMora < clientesMap[nombreCliente].minDiasMora) {
          clientesMap[nombreCliente].minDiasMora = diasMora
        }
      })

      const listaClientes = Object.values(clientesMap).sort((a, b) => a.nombre.localeCompare(b.nombre))
      setClientes(listaClientes)
      toast.success(`Directorio actualizado desde: ${targetDoc.nombre}`)
    } catch (err: any) {
      setError(err.message || 'Error al procesar el directorio de clientes.')
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

  useEffect(() => {
    if (selectedClienteModal) {
      const telGuardado = telefonosCliente[selectedClienteModal.nombre] || ''
      setTelefonoActual(telGuardado)
      generarMensajeWhatsApp('aviso', selectedClienteModal)
    }
  }, [selectedClienteModal])

  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, repFilter, zonaFilter, moraRangeFilter, minDeudaFilter])

  const copyToClipboard = (text: string, e: React.MouseEvent) => {
    e.stopPropagation()
    navigator.clipboard.writeText(text)
    setCopiedRuc(text)
    toast.success(`RUC ${text} copiado al portapapeles`)
    setTimeout(() => setCopiedRuc(null), 2000)
  }

  const getAvatarInitials = (nombre: string) => {
    const parts = nombre.trim().split(' ')
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
    return nombre.substring(0, 2).toUpperCase()
  }

  // BITÁCORA
  const handleAgregarNota = () => {
    if (!nuevaNota.trim() || !selectedClienteModal) return
    const nueva: NotaBitacora = {
      id: `nota-${Date.now()}`,
      cliente: selectedClienteModal.nombre,
      fecha: new Date().toLocaleString('es-PE'),
      texto: nuevaNota.trim()
    }
    const actualizadas = [nueva, ...notas]
    setNotas(actualizadas)
    localStorage.setItem('cobranza_bitacora_notas', JSON.stringify(actualizadas))
    setNuevaNota('')
    toast.success('Anotación guardada')
  }

  const handleIniciarEdicion = (nota: NotaBitacora) => {
    setEditingNotaId(nota.id)
    setTextoEditado(nota.texto)
  }

  const handleGuardarEdicion = (id: string) => {
    if (!textoEditado.trim()) return
    const actualizadas = notas.map((n: NotaBitacora) => {
      if (n.id === id) {
        return { ...n, texto: textoEditado.trim(), fecha: `${n.fecha} (editado)` }
      }
      return n
    })
    setNotas(actualizadas)
    localStorage.setItem('cobranza_bitacora_notas', JSON.stringify(actualizadas))
    setEditingNotaId(null)
    setTextoEditado('')
    toast.success('Anotación actualizada')
  }

  const handleEliminarNota = (id: string) => {
    if (!window.confirm('¿Estás seguro de que deseas eliminar esta anotación?')) return
    const actualizadas = notas.filter((n: NotaBitacora) => n.id !== id)
    setNotas(actualizadas)
    localStorage.setItem('cobranza_bitacora_notas', JSON.stringify(actualizadas))
    toast.success('Anotación eliminada')
  }

  // WHATSAPP
  const handleGuardarTelefono = (telefono: string) => {
    if (!selectedClienteModal) return
    setTelefonoActual(telefono)
    const actualizados = { ...telefonosCliente, [selectedClienteModal.nombre]: telefono }
    setTelefonosCliente(actualizados)
    localStorage.setItem('cobranza_telefonos_clientes', JSON.stringify(actualizados))
  }

  const generarMensajeWhatsApp = (tipo: 'suave' | 'aviso' | 'suspension', cliente: ClienteConsolidado) => {
    setPlantillaSeleccionada(tipo)
    const nombreDisplay = cliente.nombreComercial || cliente.nombre
    const montoFormateado = cliente.saldoTotal.toLocaleString('es-PE', { minimumFractionDigits: 2 })
    
    let txt = ''
    if (tipo === 'suave') {
      txt = `Hola *${nombreDisplay}*, le saludamos de MIDHCO FARMA. 🌿 Le recordamos amablemente que registra un saldo pendiente de *S/. ${montoFormateado}*. Agradecemos su apoyo con la gestión del abono. ¡Que tenga un excelente día!`
    } else if (tipo === 'aviso') {
      txt = `Estimado cliente *${nombreDisplay}*, le informamos que su cuenta presenta documentos pendientes de pago por un monto de *S/. ${montoFormateado}* con *${cliente.maxDiasMora} días de mora*. Le solicitamos regularizar su pago a la brevedad.`
    } else if (tipo === 'suspension') {
      txt = `🔴 *AVISO IMPORTANTE - MIDHCO FARMA*\n\nEstimado cliente *${nombreDisplay}*, le informamos que debido a que registra *${cliente.maxDiasMora} días de mora* (Monto: *S/. ${montoFormateado}*), su cuenta ha ingresado a estado de restricción. Para evitar la suspensión de nuevos despachos, rogamos coordinar su pago hoy mismo.`
    }
    setMensajeWhatsapp(txt)
  }

  const handleEnviarWhatsApp = () => {
    if (!telefonoActual) {
      toast.error('Por favor ingrese un número de teléfono válido')
      return
    }
    const cleanNum = telefonoActual.replace(/\D/g, '')
    const fullNum = cleanNum.startsWith('51') ? cleanNum : `51${cleanNum}`
    const url = `https://wa.me/${fullNum}?text=${encodeURIComponent(mensajeWhatsapp)}`
    window.open(url, '_blank')
  }

  // KPIs
  const kpis = useMemo(() => {
    let totalDeuda = 0
    let montoMoraCritica = 0
    let totalAlDia = 0

    clientes.forEach((c: ClienteConsolidado) => {
      totalDeuda += c.saldoTotal
      if (c.maxDiasMora > 30) {
        montoMoraCritica += c.saldoTotal
      } else if (c.maxDiasMora <= 0) {
        totalAlDia += c.saldoTotal
      }
    })

    return { totalDeuda, montoMoraCritica, totalAlDia }
  }, [clientes])

  const representantesUnicos = useMemo(() => {
    const setR = new Set<string>()
    clientes.forEach((c: ClienteConsolidado) => { if (c.representante) setR.add(c.representante) })
    return Array.from(setR).sort()
  }, [clientes])

  const zonasUnicas = useMemo(() => {
    const setZ = new Set<string>()
    clientes.forEach((c: ClienteConsolidado) => { if (c.zona) setZ.add(c.zona) })
    return Array.from(setZ).sort()
  }, [clientes])

  // FILTRADO
  const filteredAndSortedClientes = useMemo(() => {
    let result = clientes.filter((c: ClienteConsolidado) => {
      const term = searchTerm.toLowerCase().trim()
      const matchesSearch = c.nombre.toLowerCase().includes(term) || 
                            c.nombreComercial.toLowerCase().includes(term) || 
                            c.ruc.includes(term) ||
                            c.representante.toLowerCase().includes(term)
      
      const matchesRep = repFilter === 'TODOS' || c.representante === repFilter
      const matchesZona = zonaFilter === 'TODAS' || 
                          c.zona.toUpperCase() === zonaFilter.toUpperCase() ||
                          c.zona.toUpperCase().includes(zonaFilter.toUpperCase())

      let matchesMora = true
      if (moraRangeFilter === 'ALDIA') matchesMora = c.maxDiasMora <= 0
      else if (moraRangeFilter === 'PROXIMO') matchesMora = c.minDiasMora < 0 && c.maxDiasMora <= 0
      else if (moraRangeFilter === '1-15') matchesMora = c.maxDiasMora >= 1 && c.maxDiasMora <= 15
      else if (moraRangeFilter === '16-30') matchesMora = c.maxDiasMora >= 16 && c.maxDiasMora <= 30
      else if (moraRangeFilter === '31-60') matchesMora = c.maxDiasMora >= 31 && c.maxDiasMora <= 60
      else if (moraRangeFilter === '>60') matchesMora = c.maxDiasMora > 60

      let matchesMinDeuda = true
      if (typeof minDeudaFilter === 'number' && minDeudaFilter > 0) {
        matchesMinDeuda = c.saldoTotal >= minDeudaFilter
      }

      return matchesSearch && matchesRep && matchesZona && matchesMora && matchesMinDeuda
    })

    return result.sort((a, b) => {
      let aVal: any = a[sortField]
      let bVal: any = b[sortField]

      if (typeof aVal === 'string') {
        return sortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      }
      return sortOrder === 'asc' ? aVal - bVal : bVal - aVal
    })
  }, [clientes, searchTerm, repFilter, zonaFilter, moraRangeFilter, minDeudaFilter, sortField, sortOrder])

  const totalPages = Math.ceil(filteredAndSortedClientes.length / itemsPerPage)
  const paginatedClientes = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    return filteredAndSortedClientes.slice(start, start + itemsPerPage)
  }, [filteredAndSortedClientes, currentPage])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortOrder('desc')
    }
  }

  const getMoraColor = (dias: number) => {
    if (dias <= 0) return 'text-green-600 bg-green-50 border-green-100'
    if (dias <= 30) return 'text-amber-600 bg-amber-50 border-amber-100'
    return 'text-red-600 bg-red-50 border-red-100 font-bold'
  }

  const getScoringInfo = (c: ClienteConsolidado) => {
    if (c.maxDiasMora <= 0) {
      return {
        score: 'A',
        label: 'CLIENTE PUNTUAL',
        color: 'text-green-700 bg-green-100 border-green-300',
        badge: 'bg-green-600 text-white',
        desc: 'Excelente historial de cumplimiento. Apto para créditos preferenciales.',
        lineaSugerida: Math.max(c.saldoTotal * 1.5, 10000),
        barPercentage: 10,
        barColor: 'bg-green-500'
      }
    } else if (c.maxDiasMora <= 30) {
      return {
        score: 'B',
        label: 'RIESGO MODERADO',
        color: 'text-amber-700 bg-amber-100 border-amber-300',
        badge: 'bg-amber-600 text-white',
        desc: 'Demoras ocasionales en pagos. Mantener seguimiento de vencimientos.',
        lineaSugerida: Math.max(c.saldoTotal * 1.1, 5000),
        barPercentage: Math.min(10 + (c.maxDiasMora * 2), 60),
        barColor: 'bg-amber-500'
      }
    } else {
      return {
        score: 'C',
        label: 'RIESGO ALTO / CRÍTICO',
        color: 'text-red-700 bg-red-100 border-red-300',
        badge: 'bg-red-600 text-white',
        desc: 'Mora superior a 30 días. Sugerido bloquear nuevos despachos.',
        lineaSugerida: c.saldoTotal,
        barPercentage: Math.min(60 + ((c.maxDiasMora - 30) * 1.2), 100),
        barColor: 'bg-red-600'
      }
    }
  }

  return (
    <div className="space-y-6 p-6">
      {/* CABECERA PRINCIPAL */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Building2 className="h-6 w-6 text-blue-500" /> Directorio 360° de Clientes
          </h1>
          <p className="text-sm text-gray-500">Gestión consolidada por territorio, saldos, estados de mora e historial.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-end">
          
          {/* COMPONENTE SELECTOR PERSONALIZADO (FORMATO DE LA IMAGEN) */}
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
                  </div>
                )}
              </div>
              {loading && <RefreshCw className="h-3.5 w-3.5 text-blue-600 animate-spin ml-1" />}
            </button>

            {/* MENÚ DESPLEGABLE CON FORMATO DE LA FOTO */}
            {isDocDropdownOpen && (
              <div className="absolute right-0 mt-1 w-80 bg-white border border-gray-100 rounded-2xl shadow-xl z-50 overflow-hidden divide-y divide-gray-50 max-h-72 overflow-y-auto">
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
                        
                          </div>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* SWITCH VISTA */}
          <div className="flex items-center bg-gray-100 p-1 rounded-xl border border-gray-200">
            <button
              onClick={() => setViewMode('grid')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                viewMode === 'grid' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <LayoutGrid className="h-4 w-4" /> Tarjetas
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                viewMode === 'table' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <TableIcon className="h-4 w-4" /> Lista Compacta
            </button>
          </div>
        </div>
      </div>

      {/* METRICAS KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm flex items-center gap-3">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl"><Wallet className="h-6 w-6" /></div>
          <div>
            <p className="text-xs font-medium text-gray-400">Deuda Total Cartera</p>
            <p className="text-lg font-bold text-gray-900">S/. {kpis.totalDeuda.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</p>
          </div>
        </div>
        <div className="rounded-2xl border border-red-100 bg-red-50/40 p-4 shadow-sm flex items-center gap-3">
          <div className="p-3 bg-red-100 text-red-600 rounded-xl"><ShieldAlert className="h-6 w-6" /></div>
          <div>
            <p className="text-xs font-medium text-red-500">Mora Crítica (&gt;30 días)</p>
            <p className="text-lg font-bold text-red-700">S/. {kpis.montoMoraCritica.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</p>
          </div>
        </div>
        <div className="rounded-2xl border border-green-100 bg-green-50/40 p-4 shadow-sm flex items-center gap-3">
          <div className="p-3 bg-green-100 text-green-600 rounded-xl"><CheckCircle2 className="h-6 w-6" /></div>
          <div>
            <p className="text-xs font-medium text-green-600">Cartera Al Día</p>
            <p className="text-lg font-bold text-green-800">S/. {kpis.totalAlDia.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</p>
          </div>
        </div>
      </div>

      {/* FILTROS */}
      <div className="space-y-3 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
        <div className="flex flex-wrap items-center gap-2 pb-2 border-b border-gray-100 text-xs">
          <span className="font-bold text-gray-500 flex items-center gap-1 mr-1">
            <SlidersHorizontal className="h-3.5 w-3.5" /> Accesos Rápidos:
          </span>
          <button
            onClick={() => setMoraRangeFilter('TODOS')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
              moraRangeFilter === 'TODOS' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            ⚡ Todos ({clientes.length})
          </button>
          <button
            onClick={() => setMoraRangeFilter('>60')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
              moraRangeFilter === '>60' ? 'bg-red-600 text-white' : 'bg-red-50 text-red-700 hover:bg-red-100'
            }`}
          >
            🔥 Mora Crítica (&gt;60d)
          </button>
          <button
            onClick={() => setMoraRangeFilter('ALDIA')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
              moraRangeFilter === 'ALDIA' ? 'bg-green-600 text-white' : 'bg-green-50 text-green-700 hover:bg-green-100'
            }`}
          >
            🟢 Al Día
          </button>
        </div>

        <div className="flex flex-col lg:flex-row gap-3 items-center justify-between">
          <div ref={searchContainerRef} className="relative w-full lg:w-72">
            <Search className="absolute inset-y-0 left-3 h-4 w-4 text-gray-400 my-auto pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar por Razón Social, RUC, Botica..."
              value={searchTerm}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-white py-2 pl-9 pr-8 text-xs outline-none focus:border-blue-500"
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} className="absolute inset-y-0 right-2.5 my-auto text-gray-400 hover:text-gray-600">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
            <div className="flex items-center border border-gray-200 rounded-xl px-2 py-1 bg-white">
              <span className="text-[10px] text-gray-400 font-bold mr-1">Deuda &gt;</span>
              <input
                type="number"
                placeholder="Monto S/."
                value={minDeudaFilter}
                onChange={(e) => setMinDeudaFilter(e.target.value ? Number(e.target.value) : '')}
                className="w-20 text-xs outline-none text-gray-700"
              />
            </div>

            <select
              value={zonaFilter}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setZonaFilter(e.target.value)}
              className="rounded-xl border border-gray-200 bg-white py-2 px-3 text-xs text-gray-700 outline-none focus:border-blue-500"
            >
              <option value="TODAS">📍 Todas las Zonas</option>
              {zonasUnicas.map((z: string, idx: number) => (
                <option key={idx} value={z}>{z}</option>
              ))}
            </select>

            <select
              value={repFilter}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setRepFilter(e.target.value)}
              className="rounded-xl border border-gray-200 bg-white py-2 px-3 text-xs text-gray-700 outline-none focus:border-blue-500"
            >
              <option value="TODOS">👤 Todos los Vendedores</option>
              {representantesUnicos.map((rep: string, idx: number) => (
                <option key={idx} value={rep}>{rep}</option>
              ))}
            </select>

            <select
              value={moraRangeFilter}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setMoraRangeFilter(e.target.value)}
              className="rounded-xl border border-gray-200 bg-white py-2 px-3 text-xs text-gray-700 outline-none focus:border-blue-500"
            >
              <option value="TODOS">Todos los Estados</option>
              <option value="ALDIA">Al Día (0 días)</option>
              <option value="PROXIMO">⏰ Próximos Vencimientos</option>
              <option value="1-15">Mora 1 a 15 días</option>
              <option value="16-30">Mora 16 a 30 días</option>
              <option value="31-60">Mora 31 a 60 días</option>
              <option value=">60">Mora Crítica (&gt;60 días)</option>
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm animate-pulse space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-gray-200" />
                <div className="space-y-2 flex-1">
                  <div className="h-4 bg-gray-200 rounded w-3/4" />
                  <div className="h-3 bg-gray-100 rounded w-1/2" />
                </div>
              </div>
              <div className="h-2 bg-gray-200 rounded-full w-full" />
              <div className="grid grid-cols-2 gap-2 pt-2">
                <div className="h-10 bg-gray-100 rounded-xl" />
                <div className="h-10 bg-gray-100 rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-600 flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-red-500" /> {error}
        </div>
      ) : filteredAndSortedClientes.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-gray-100 text-gray-400 space-y-2">
          <p className="font-bold text-gray-600 text-sm">No se encontraron clientes con los filtros aplicados</p>
          <p className="text-xs">Pruebe limpiando la búsqueda o cambiando el rango de mora/deuda.</p>
        </div>
      ) : (
        <>
          {viewMode === 'grid' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {paginatedClientes.map((cliente: ClienteConsolidado, index: number) => {
                const scoring = getScoringInfo(cliente)
                return (
                  <div 
                    key={index} 
                    className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm hover:shadow-md transition flex flex-col justify-between gap-4 cursor-pointer relative group"
                    onClick={() => setSelectedClienteModal(cliente)}
                  >
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white flex items-center justify-center font-black text-xs shadow-sm shrink-0">
                          {getAvatarInitials(cliente.nombre)}
                        </div>

                        <div className="space-y-0.5 flex-1 min-w-0">
                          {cliente.nombreComercial && (
                            <span className="inline-flex items-center gap-1 text-[9px] font-bold tracking-wider text-blue-600 uppercase bg-blue-50 px-1.5 py-0.5 rounded">
                              <Store className="h-2.5 w-2.5" /> {cliente.nombreComercial}
                            </span>
                          )}
                          <h3 className="font-bold text-gray-900 text-xs truncate group-hover:text-blue-600 transition">
                            {cliente.nombre}
                          </h3>
                          {cliente.ruc && (
                            <div className="flex items-center gap-1 text-[10px] text-gray-400 font-mono">
                              <span>RUC: {cliente.ruc}</span>
                              <button
                                onClick={(e: React.MouseEvent) => copyToClipboard(cliente.ruc, e)}
                                className="p-0.5 hover:text-blue-600 rounded"
                              >
                                {copiedRuc === cliente.ruc ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
                              </button>
                            </div>
                          )}
                        </div>

                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${scoring.badge}`}>
                          SCORE {scoring.score}
                        </span>
                      </div>

                      <div className="space-y-1">
                        <div className="flex justify-between items-center text-[10px]">
                          <span className="text-gray-400 font-medium">Nivel de Riesgo</span>
                          <span className={`font-mono font-bold ${cliente.maxDiasMora > 30 ? 'text-red-600' : 'text-gray-600'}`}>
                            {cliente.maxDiasMora <= 0 ? '0d (Al Día)' : `${cliente.maxDiasMora}d Mora`}
                          </span>
                        </div>
                        <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                          <div 
                            className={`h-full ${scoring.barColor} transition-all duration-500`} 
                            style={{ width: `${scoring.barPercentage}%` }} 
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-gray-500 pt-1 border-t border-gray-50">
                        <span className="flex items-center gap-1"><MapPin className="h-3 w-3 text-rose-500" /> {cliente.zona}</span>
                        <span className="flex items-center gap-1"><User className="h-3 w-3 text-gray-400" /> {cliente.representante}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-3 border-t border-gray-50 text-xs">
                      <div className="bg-gray-50/60 p-2 rounded-xl space-y-0.5 flex flex-col justify-center">
                        <div className="text-[10px] text-gray-400 font-medium flex items-center gap-1">
                          <Wallet className="h-3 w-3 text-blue-500" /> Saldo Pendiente
                        </div>
                        <p className="font-bold text-gray-900">S/. {cliente.saldoTotal.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</p>
                      </div>
                      
                      <div className="bg-gray-50/60 p-2 rounded-xl space-y-1">
                        <div className="text-[10px] text-gray-400 font-medium flex items-center gap-1">
                          <Calendar className="h-3 w-3 text-purple-500" /> Documentos
                        </div>
                        <div className="flex gap-1" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                          <Link
                            to="/pagos"
                            state={{ filterText: cliente.nombre, filterType: 'ALDIA' }}
                            className="flex-1 text-center py-0.5 rounded bg-green-50 text-green-700 font-bold text-[10px]"
                          >
                            {cliente.docsAlDia} Día
                          </Link>
                          <Link
                            to="/pagos"
                            state={{ filterText: cliente.nombre, filterType: 'MORA' }}
                            className={`flex-1 text-center py-0.5 rounded text-[10px] font-bold ${
                              cliente.docsEnMora > 0 ? 'bg-red-50 text-red-700' : 'bg-gray-100 text-gray-400'
                            }`}
                          >
                            {cliente.docsEnMora} Mora
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {viewMode === 'table' && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100 text-gray-500 font-bold">
                    <th className="p-3 cursor-pointer hover:bg-gray-100" onClick={() => handleSort('nombre')}>
                      <div className="flex items-center gap-1">Cliente / RUC <ArrowUpDown className="h-3 w-3" /></div>
                    </th>
                    <th className="p-3 cursor-pointer hover:bg-gray-100" onClick={() => handleSort('zona')}>
                      <div className="flex items-center gap-1">Zona / Rep. <ArrowUpDown className="h-3 w-3" /></div>
                    </th>
                    <th className="p-3 cursor-pointer hover:bg-gray-100 text-right" onClick={() => handleSort('saldoTotal')}>
                      <div className="flex items-center justify-end gap-1">Saldo Total <ArrowUpDown className="h-3 w-3" /></div>
                    </th>
                    <th className="p-3 cursor-pointer hover:bg-gray-100 text-center" onClick={() => handleSort('maxDiasMora')}>
                      <div className="flex items-center justify-center gap-1">Max Mora <ArrowUpDown className="h-3 w-3" /></div>
                    </th>
                    <th className="p-3 text-center">Docs</th>
                    <th className="p-3 text-center">Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {paginatedClientes.map((cliente: ClienteConsolidado, idx: number) => {
                    const scoring = getScoringInfo(cliente)
                    return (
                      <tr 
                        key={idx} 
                        onClick={() => setSelectedClienteModal(cliente)}
                        className="hover:bg-blue-50/40 cursor-pointer transition"
                      >
                        <td className="p-3">
                          <p className="font-bold text-gray-900">{cliente.nombre}</p>
                          <p className="text-[10px] text-gray-400 font-mono">{cliente.ruc || 'S/N'}</p>
                        </td>
                        <td className="p-3">
                          <p className="text-gray-700 font-medium">{cliente.zona}</p>
                          <p className="text-[10px] text-gray-400">{cliente.representante}</p>
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-gray-900">
                          S/. {cliente.saldoTotal.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-3 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-mono border ${getMoraColor(cliente.maxDiasMora)}`}>
                            {cliente.maxDiasMora <= 0 ? 'Al Día' : `${cliente.maxDiasMora}d`}
                          </span>
                        </td>
                        <td className="p-3 text-center text-gray-500 font-mono">
                          {cliente.documentosAsociados}
                        </td>
                        <td className="p-3 text-center">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-black ${scoring.badge}`}>
                            {scoring.score}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row justify-between items-center gap-3 bg-white p-4 rounded-2xl border border-gray-100 text-xs">
              <span className="text-gray-500">
                Mostrando <strong>{(currentPage - 1) * itemsPerPage + 1}</strong> a <strong>{Math.min(currentPage * itemsPerPage, filteredAndSortedClientes.length)}</strong> de <strong>{filteredAndSortedClientes.length}</strong> clientes
              </span>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                  disabled={currentPage === 1}
                  className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="font-bold text-gray-700 px-2">
                  Página {currentPage} de {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* MODAL FICHA 360 */}
      {selectedClienteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-4xl rounded-3xl bg-white shadow-2xl border border-gray-100 overflow-hidden flex flex-col max-h-[92vh]">
            
            <div className="p-5 bg-gray-50 border-b border-gray-100 flex items-start justify-between">
              <div>
                {selectedClienteModal.nombreComercial && (
                  <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded uppercase">
                    {selectedClienteModal.nombreComercial}
                  </span>
                )}
                <h2 className="text-lg font-bold text-gray-900">{selectedClienteModal.nombre}</h2>
                <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 mt-1">
                  <span>RUC: <strong>{selectedClienteModal.ruc || 'S/N'}</strong></span>
                  <span>|</span>
                  <span>Zona: <strong>{selectedClienteModal.zona}</strong></span>
                  <span>|</span>
                  <span>Rep: <strong>{selectedClienteModal.representante}</strong></span>
                </div>
              </div>
              <button 
                onClick={() => setSelectedClienteModal(null)}
                className="p-1.5 rounded-xl bg-white text-gray-400 hover:text-gray-600 border border-gray-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex border-b border-gray-100 bg-white px-5 gap-2 overflow-x-auto">
              <button
                onClick={() => setActiveTab('docs')}
                className={`py-3 px-2 text-xs font-bold border-b-2 transition whitespace-nowrap flex items-center gap-1.5 ${
                  activeTab === 'docs' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-400 hover:text-gray-600'
                }`}
              >
                <FileText className="h-4 w-4" /> Documentos ({selectedClienteModal.documentosAsociados})
              </button>
              <button
                onClick={() => setActiveTab('riesgo')}
                className={`py-3 px-2 text-xs font-bold border-b-2 transition whitespace-nowrap flex items-center gap-1.5 ${
                  activeTab === 'riesgo' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-400 hover:text-gray-600'
                }`}
              >
                <BarChart3 className="h-4 w-4" /> Riesgo y Crédito
              </button>
              <button
                onClick={() => setActiveTab('whatsapp')}
                className={`py-3 px-2 text-xs font-bold border-b-2 transition whitespace-nowrap flex items-center gap-1.5 ${
                  activeTab === 'whatsapp' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-400 hover:text-gray-600'
                }`}
              >
                <MessageCircle className="h-4 w-4 text-green-600" /> Gestión WhatsApp
              </button>
              <button
                onClick={() => setActiveTab('bitacora')}
                className={`py-3 px-2 text-xs font-bold border-b-2 transition whitespace-nowrap flex items-center gap-1.5 ${
                  activeTab === 'bitacora' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-400 hover:text-gray-600'
                }`}
              >
                <History className="h-4 w-4" /> Bitácora
              </button>
              <button
                onClick={() => setActiveTab('estado_cuenta')}
                className={`py-3 px-2 text-xs font-bold border-b-2 transition whitespace-nowrap flex items-center gap-1.5 ${
                  activeTab === 'estado_cuenta' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-400 hover:text-gray-600'
                }`}
              >
                <Printer className="h-4 w-4" /> Estado de Cuenta
              </button>
            </div>

            <div className="p-5 overflow-y-auto flex-1 text-xs space-y-4">
              {activeTab === 'docs' && (
                <div className="space-y-2">
                  {selectedClienteModal.documentosDetalle.map((doc: any, i: number) => {
                    const mora = Number(doc.dias_mora || doc.diasMora || doc.mora || 0)
                    const saldoDoc = Number(doc.saldo || 0)
                    return (
                      <div key={i} className="flex justify-between items-center p-3 rounded-xl border border-gray-100 bg-gray-50/50">
                        <div>
                          <p className="font-bold text-gray-900">{doc.documento || doc.doc || 'Doc S/N'}</p>
                          <p className="text-[10px] text-gray-400">
                            Emisión: {doc.fecha_emision ? String(doc.fecha_emision).split('T')[0] : 'S/F'} | 
                            Venc: {doc.fecha_venc ? String(doc.fecha_venc).split('T')[0] : 'S/F'}
                          </p>
                          <span className={`text-[10px] font-semibold ${mora > 0 ? 'text-red-600' : 'text-green-600'}`}>
                            {mora > 0 ? `${mora} días de mora` : mora < 0 ? `Vence en ${Math.abs(mora)} días` : 'Vence hoy'}
                          </span>
                        </div>
                        <p className="font-bold text-blue-600 text-sm">
                          S/. {saldoDoc.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                    )
                  })}
                </div>
              )}

              {activeTab === 'riesgo' && (() => {
                const scoring = getScoringInfo(selectedClienteModal)
                return (
                  <div className="space-y-4">
                    <div className={`p-4 rounded-2xl border ${scoring.color} space-y-2`}>
                      <div className="flex justify-between items-center">
                        <span className="font-bold flex items-center gap-1.5 text-sm">
                          <Award className="h-5 w-5" /> Score Crediticio: Clase {scoring.score}
                        </span>
                        <span className={`px-2 py-0.5 text-[10px] font-black rounded ${scoring.badge}`}>
                          {scoring.label}
                        </span>
                      </div>
                      <p className="text-xs">{scoring.desc}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 bg-gray-50 border border-gray-100 rounded-xl space-y-1">
                        <p className="text-[10px] text-gray-400 font-semibold uppercase">Línea de Crédito Sugerida</p>
                        <p className="text-base font-bold text-gray-800">
                          S/. {scoring.lineaSugerida.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                      <div className="p-3 bg-gray-50 border border-gray-100 rounded-xl space-y-1">
                        <p className="text-[10px] text-gray-400 font-semibold uppercase">Mora Máxima Registrada</p>
                        <p className={`text-base font-bold ${selectedClienteModal.maxDiasMora > 30 ? 'text-red-600' : 'text-gray-800'}`}>
                          {selectedClienteModal.maxDiasMora} días
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })()}

              {activeTab === 'whatsapp' && (
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-gray-700 flex items-center gap-1">
                      <Phone className="h-3.5 w-3.5 text-green-600" /> Teléfono de Contacto:
                    </label>
                    <input
                      type="text"
                      placeholder="Ej. 987654321"
                      value={telefonoActual}
                      onChange={(e) => handleGuardarTelefono(e.target.value)}
                      className="w-full p-2 border border-gray-200 rounded-xl text-xs focus:border-green-500 outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-gray-700">Seleccionar Plantilla:</label>
                    <div className="flex gap-2">
                      <button
                        onClick={() => generarMensajeWhatsApp('suave', selectedClienteModal)}
                        className={`flex-1 py-1.5 px-2 rounded-xl text-[10px] font-bold border transition ${
                          plantillaSeleccionada === 'suave' ? 'bg-green-100 border-green-300 text-green-800' : 'bg-gray-50 text-gray-600'
                        }`}
                      >
                        Recordatorio Amable
                      </button>
                      <button
                        onClick={() => generarMensajeWhatsApp('aviso', selectedClienteModal)}
                        className={`flex-1 py-1.5 px-2 rounded-xl text-[10px] font-bold border transition ${
                          plantillaSeleccionada === 'aviso' ? 'bg-amber-100 border-amber-300 text-amber-800' : 'bg-gray-50 text-gray-600'
                        }`}
                      >
                        Aviso de Vencimiento
                      </button>
                      <button
                        onClick={() => generarMensajeWhatsApp('suspension', selectedClienteModal)}
                        className={`flex-1 py-1.5 px-2 rounded-xl text-[10px] font-bold border transition ${
                          plantillaSeleccionada === 'suspension' ? 'bg-red-100 border-red-300 text-red-800' : 'bg-gray-50 text-gray-600'
                        }`}
                      >
                        Alerta Restricción
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-gray-700">Mensaje a Enviar:</label>
                    <textarea
                      rows={4}
                      value={mensajeWhatsapp}
                      onChange={(e) => setMensajeWhatsapp(e.target.value)}
                      className="w-full p-3 border border-gray-200 rounded-xl text-xs focus:border-green-500 outline-none font-mono text-gray-700"
                    />
                  </div>

                  <button
                    onClick={handleEnviarWhatsApp}
                    className="w-full py-2.5 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 text-xs transition"
                  >
                    <Send className="h-4 w-4" /> Abrir WhatsApp Web / App
                  </button>
                </div>
              )}

              {activeTab === 'bitacora' && (
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Escriba compromisos de pago o notas..."
                      value={nuevaNota}
                      onChange={(e) => setNuevaNota(e.target.value)}
                      className="flex-1 p-2 border border-gray-200 rounded-xl text-xs outline-none focus:border-blue-500"
                    />
                    <button
                      onClick={handleAgregarNota}
                      className="px-4 py-2 bg-blue-600 text-white rounded-xl font-bold text-xs hover:bg-blue-700 transition"
                    >
                      Añadir
                    </button>
                  </div>

                  <div className="space-y-2">
                    {notas.filter(n => n.cliente === selectedClienteModal.nombre).map((nota) => (
                      <div key={nota.id} className="p-3 bg-gray-50 border border-gray-100 rounded-xl space-y-1">
                        <div className="flex justify-between items-center text-[10px] text-gray-400">
                          <span>{nota.fecha}</span>
                          <div className="flex gap-2">
                            {editingNotaId === nota.id ? (
                              <button onClick={() => handleGuardarEdicion(nota.id)} className="text-green-600 hover:underline">
                                <Save className="h-3.5 w-3.5" />
                              </button>
                            ) : (
                              <button onClick={() => handleIniciarEdicion(nota)} className="text-gray-500 hover:text-blue-600">
                                <Edit2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                            <button onClick={() => handleEliminarNota(nota.id)} className="text-red-500 hover:text-red-700">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>

                        {editingNotaId === nota.id ? (
                          <input
                            type="text"
                            value={textoEditado}
                            onChange={(e) => setTextoEditado(e.target.value)}
                            className="w-full p-1 border rounded text-xs"
                          />
                        ) : (
                          <p className="text-gray-800 text-xs">{nota.texto}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'estado_cuenta' && (
                <div className="space-y-4">
                  <div className="p-4 border border-gray-200 rounded-2xl bg-white space-y-3" id="printable-area">
                    <div className="flex justify-between items-center border-b pb-2">
                      <div>
                        <h4 className="font-bold text-sm text-gray-900">ESTADO DE CUENTA INDIVIDUAL</h4>
                        <p className="text-[10px] text-gray-500">MIDHCO FARMA S.A.C.</p>
                      </div>
                      <p className="text-xs font-mono font-bold text-blue-600">
                        S/. {selectedClienteModal.saldoTotal.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                      </p>
                    </div>

                    <table className="w-full text-left text-[11px]">
                      <thead>
                        <tr className="border-b text-gray-400 font-semibold">
                          <th className="py-1">Documento</th>
                          <th className="py-1">Vencimiento</th>
                          <th className="py-1 text-right">Saldo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedClienteModal.documentosDetalle.map((doc, idx) => (
                          <tr key={idx} className="border-b border-gray-50">
                            <td className="py-1.5 font-mono">{doc.documento || doc.doc}</td>
                            <td className="py-1.5">{doc.fecha_venc ? String(doc.fecha_venc).split('T')[0] : 'S/F'}</td>
                            <td className="py-1.5 text-right font-bold">
                              S/. {Number(doc.saldo || 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <button
                    onClick={() => window.print()}
                    className="w-full py-2.5 bg-gray-800 hover:bg-gray-900 text-white font-bold rounded-xl flex items-center justify-center gap-2 text-xs transition"
                  >
                    <Printer className="h-4 w-4" /> Imprimir Estado de Cuenta
                  </button>
                </div>
              )}

            </div>
          </div>
        </div>
      )}
    </div>
  )
}