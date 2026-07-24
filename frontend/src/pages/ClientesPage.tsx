import React, { useEffect, useState, useMemo, useRef } from 'react'
import { getDocumentos } from '../lib/supabaseService'
import { parseCobranzaExcelFile } from '../lib/excelService'
import { 
  Search, User, Building2, Wallet, Calendar, X, FileText, 
  History, MessageSquarePlus, CheckCircle2, ShieldAlert, MapPin, 
  Copy, Check, Printer, Store, Map as MapIcon
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import MapaPeru from './MapaPeru'

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

interface ResumenZona {
  clientes: number
  deuda: number
}

export default function ClientesPage() {
  const [clientes, setClientes] = useState<ClienteConsolidado[]>([])
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [repFilter, setRepFilter] = useState<string>('TODOS')
  const [zonaFilter, setZonaFilter] = useState<string>('TODAS')
  const [moraRangeFilter, setMoraRangeFilter] = useState<string>('TODOS')
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  // Copiado rápido de RUC
  const [copiedRuc, setCopiedRuc] = useState<string | null>(null)

  // Autocompletado / Contenedor
  const searchContainerRef = useRef<HTMLDivElement>(null)

  // Modal 360
  const [selectedClienteModal, setSelectedClienteModal] = useState<ClienteConsolidado | null>(null)
  const [activeTab, setActiveTab] = useState<'docs' | 'bitacora' | 'estado_cuenta'>('docs')
  
  // Bitácora de notas
  const [notas, setNotas] = useState<NotaBitacora[]>(() => {
    const saved = localStorage.getItem('cobranza_bitacora_notas')
    return saved ? JSON.parse(saved) : []
  })
  const [nuevaNota, setNuevaNota] = useState<string>('')

  useEffect(() => {
    const loadAndProcessClientes = async () => {
      try {
        setLoading(true)
        setError(null)
        
        const { data, error: supabaseError } = await getDocumentos()
        if (supabaseError) throw new Error(supabaseError)

        const documentos = (data || []) as any[]
        const excelDocs = documentos.filter((doc: any) => 
          doc.ruta_archivo && (doc.ruta_archivo.endsWith('.xls') || doc.ruta_archivo.endsWith('.xlsx'))
        )

        if (excelDocs.length === 0) {
          setClientes([])
          return
        }

        const ultimoExcel = excelDocs[0]
        if (!ultimoExcel.url_archivo) throw new Error('La URL del archivo no es válida.')

        const response = await fetch(ultimoExcel.url_archivo)
        const blob = await response.blob()
        const file = new File([blob], ultimoExcel.nombre, { type: blob.type })

        const parsedRows = await parseCobranzaExcelFile(file)
        const clientesMap: { [key: string]: ClienteConsolidado } = {}

        parsedRows.forEach((row: any) => {
          const nombreCliente = (row.cliente || row.razon_social || 'Cliente No Identificado').trim()
          const nombreComercial = (row.nombre_comercial || '').trim()
          const ruc = (row.ruc_dni || row.codsocio || '').trim()
          const zona = (row.zona || 'Sin Zona').trim()
          const representante = row.representante || row.vendedor || 'No Asignado'
          const saldo = Number(row.saldo || 0)
          const diasMora = Number(row.dias_mora || 0)

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
      } catch (err: any) {
        setError(err.message || 'Error al procesar el directorio de clientes.')
      } finally {
        setLoading(false)
      }
    }

    loadAndProcessClientes()
  }, [])

  // Copiar RUC
  const copyToClipboard = (text: string, e: React.MouseEvent) => {
    e.stopPropagation()
    navigator.clipboard.writeText(text)
    setCopiedRuc(text)
    toast.success(`RUC ${text} copiado al portapapeles`)
    setTimeout(() => setCopiedRuc(null), 2000)
  }

  // Guardar bitácora
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

  // Resumen agrupado por Zona para el componente MapaPeru
  const resumenPorZona = useMemo<Record<string, ResumenZona>>(() => {
    const mapa: Record<string, ResumenZona> = {}
    clientes.forEach((c: ClienteConsolidado) => {
      const z = c.zona.toUpperCase().trim()
      if (!mapa[z]) {
        mapa[z] = { clientes: 0, deuda: 0 }
      }
      mapa[z].clientes += 1
      mapa[z].deuda += c.saldoTotal
    })
    return mapa
  }, [clientes])

  // Lista de Representantes y Zonas Únicas
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

  // Filtro Consolidado
  const filteredClientes = useMemo(() => {
    return clientes.filter((c: ClienteConsolidado) => {
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

      return matchesSearch && matchesRep && matchesZona && matchesMora
    })
  }, [clientes, searchTerm, repFilter, zonaFilter, moraRangeFilter])

  const getMoraColor = (dias: number) => {
    if (dias <= 0) return 'text-green-600 bg-green-50 border-green-100'
    if (dias <= 30) return 'text-amber-600 bg-amber-50 border-amber-100'
    return 'text-red-600 bg-red-50 border-red-100 font-bold'
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Building2 className="h-6 w-6 text-blue-500" /> Directorio 360° de Clientes
          </h1>
          <p className="text-sm text-gray-500">Gestión consolidada por territorio, saldos, estados de mora e historial.</p>
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

      {/* COMPONENTE MAPA DE ZONAS DE PERÚ */}
      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
            <MapIcon className="h-4 w-4 text-blue-500" /> Selección Territorial de Zonas
          </span>
          {zonaFilter !== 'TODAS' && (
            <button
              onClick={() => setZonaFilter('TODAS')}
              className="text-[11px] text-blue-600 hover:underline font-semibold"
            >
              Restablecer Filtro (Mostrar Todas)
            </button>
          )}
        </div>
        <MapaPeru
          zonaSeleccionada={zonaFilter}
          onSelectZona={(zona: string) => setZonaFilter(zona)}
          resumenPorZona={resumenPorZona}
        />
      </div>

      {/* BARRA DE FILTROS */}
      <div className="flex flex-col lg:flex-row gap-3 items-center justify-between bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
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
          {/* Filtro por Zona */}
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

          {/* Filtro por Vendedor */}
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

          {/* Filtro por Rango de Mora */}
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

      {loading ? (
        <div className="flex h-[40vh] flex-col items-center justify-center gap-2">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
          <p className="text-sm text-slate-500 font-medium">Compilando cartera de clientes por zona...</p>
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">{error}</div>
      ) : (
        /* TARJETAS DE CLIENTES */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredClientes.map((cliente: ClienteConsolidado, index: number) => (
            <div 
              key={index} 
              className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm hover:shadow-md transition flex flex-col justify-between gap-4 cursor-pointer relative"
              onClick={() => setSelectedClienteModal(cliente)}
            >
              <div className="space-y-2">
                {/* Nombre Comercial + Estado Mora */}
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-0.5">
                    {cliente.nombreComercial && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold tracking-wider text-blue-600 uppercase bg-blue-50 px-2 py-0.5 rounded-md">
                        <Store className="h-3 w-3" /> {cliente.nombreComercial}
                      </span>
                    )}
                    <h3 className="font-bold text-gray-900 text-sm line-clamp-2 hover:text-blue-600 mt-1">
                      {cliente.nombre}
                    </h3>
                  </div>

                  <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[10px] font-mono border whitespace-nowrap ${getMoraColor(cliente.maxDiasMora)}`}>
                    {cliente.maxDiasMora <= 0 ? 'Al Día' : `${cliente.maxDiasMora}d Mora`}
                  </span>
                </div>

                {/* RUC / DNI Copiable */}
                {cliente.ruc && (
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-gray-400 font-mono">RUC/DNI: {cliente.ruc}</span>
                    <button
                      onClick={(e: React.MouseEvent) => copyToClipboard(cliente.ruc, e)}
                      className="p-1 text-gray-400 hover:text-blue-600 rounded"
                      title="Copiar RUC"
                    >
                      {copiedRuc === cliente.ruc ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
                    </button>
                  </div>
                )}

                {/* Zona y Vendedor */}
                <div className="flex flex-col gap-1 text-xs text-gray-500 pt-1">
                  <div className="flex items-center gap-1 text-[11px] text-gray-500">
                    <MapPin className="h-3.5 w-3.5 text-rose-500" />
                    <span>Zona: <strong className="text-gray-700">{cliente.zona}</strong></span>
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-gray-500">
                    <User className="h-3.5 w-3.5 text-gray-400" />
                    <span>Rep: <strong className="text-gray-700">{cliente.representante}</strong></span>
                  </div>
                </div>
              </div>

              {/* Pie de tarjeta con Saldos y Accesos Rápidos */}
              <div className="grid grid-cols-2 gap-2 pt-3 border-t border-gray-50 text-xs">
                <div className="bg-gray-50/50 p-2 rounded-xl space-y-0.5 flex flex-col justify-center">
                  <div className="text-[10px] text-gray-400 font-medium flex items-center gap-1">
                    <Wallet className="h-3 w-3 text-blue-500" /> Deuda Total
                  </div>
                  <p className="font-bold text-gray-900">S/. {cliente.saldoTotal.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</p>
                </div>
                
                <div className="bg-gray-50/50 p-2 rounded-xl space-y-1">
                  <div className="text-[10px] text-gray-400 font-medium flex items-center gap-1 mb-0.5">
                    <Calendar className="h-3 w-3 text-purple-500" /> Documentos
                  </div>
                  <div className="flex gap-1.5" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                    <Link
                      to="/pagos"
                      state={{ filterText: cliente.nombre, filterType: 'ALDIA' }}
                      className="flex-1 text-center py-0.5 px-1 rounded bg-green-50 hover:bg-green-100 border border-green-200 text-green-700 font-semibold text-[10px] transition"
                    >
                      {cliente.docsAlDia} Al día
                    </Link>
                    <Link
                      to="/pagos"
                      state={{ filterText: cliente.nombre, filterType: 'MORA' }}
                      className={`flex-1 text-center py-0.5 px-1 rounded font-semibold text-[10px] transition ${
                        cliente.docsEnMora > 0 
                          ? 'bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 font-bold' 
                          : 'bg-gray-50 text-gray-400 border border-gray-100 cursor-not-allowed pointer-events-none'
                      }`}
                    >
                      {cliente.docsEnMora} Mora
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL FICHA 360, BITÁCORA Y ESTADO DE CUENTA */}
      {selectedClienteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-3xl rounded-3xl bg-white shadow-2xl border border-gray-100 overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Cabecera Modal */}
            <div className="p-5 bg-gray-50 border-b border-gray-100 flex items-start justify-between">
              <div>
                {selectedClienteModal.nombreComercial && (
                  <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded uppercase">
                    {selectedClienteModal.nombreComercial}
                  </span>
                )}
                <h2 className="text-lg font-bold text-gray-900">{selectedClienteModal.nombre}</h2>
                <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                  <span>RUC: <strong>{selectedClienteModal.ruc || 'S/N'}</strong></span>
                  <span>|</span>
                  <span>Zona: <strong>{selectedClienteModal.zona}</strong></span>
                  <span>|</span>
                  <span>Rep: <strong>{selectedClienteModal.representante}</strong></span>
                </div>
              </div>
              <button 
                onClick={() => setSelectedClienteModal(null)}
                className="p-1 rounded-xl bg-white text-gray-400 hover:text-gray-600 border border-gray-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* TABS MODAL */}
            <div className="flex border-b border-gray-100 bg-white px-5 gap-4">
              <button
                onClick={() => setActiveTab('docs')}
                className={`py-3 text-xs font-bold border-b-2 transition flex items-center gap-1.5 ${
                  activeTab === 'docs' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-400 hover:text-gray-600'
                }`}
              >
                <FileText className="h-4 w-4" /> Documentos ({selectedClienteModal.documentosAsociados})
              </button>
              <button
                onClick={() => setActiveTab('bitacora')}
                className={`py-3 text-xs font-bold border-b-2 transition flex items-center gap-1.5 ${
                  activeTab === 'bitacora' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-400 hover:text-gray-600'
                }`}
              >
                <History className="h-4 w-4" /> Bitácora de Gestión
              </button>
              <button
                onClick={() => setActiveTab('estado_cuenta')}
                className={`py-3 text-xs font-bold border-b-2 transition flex items-center gap-1.5 ${
                  activeTab === 'estado_cuenta' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-400 hover:text-gray-600'
                }`}
              >
                <Printer className="h-4 w-4" /> Estado de Cuenta
              </button>
            </div>

            {/* CONTENIDO DEL MODAL */}
            <div className="p-5 overflow-y-auto flex-1 text-xs space-y-4">
              
              {/* TAB 1: DOCUMENTOS */}
              {activeTab === 'docs' && (
                <div className="space-y-2">
                  {selectedClienteModal.documentosDetalle.map((doc: any, i: number) => {
                    const mora = Number(doc.dias_mora || 0)
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
                          S/. {Number(doc.saldo || 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* TAB 2: BITÁCORA */}
              {activeTab === 'bitacora' && (
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Registrar llamada, promesa de pago..."
                      value={nuevaNota}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNuevaNota(e.target.value)}
                      className="flex-1 rounded-xl border border-gray-200 p-2.5 outline-none focus:border-blue-500"
                    />
                    <button
                      onClick={handleAgregarNota}
                      className="bg-blue-600 text-white font-bold px-4 rounded-xl hover:bg-blue-700 transition flex items-center gap-1"
                    >
                      <MessageSquarePlus className="h-4 w-4" /> Anotar
                    </button>
                  </div>

                  <div className="space-y-2">
                    {notas
                      .filter((n: NotaBitacora) => n.cliente === selectedClienteModal.nombre)
                      .map((nota: NotaBitacora) => (
                        <div key={nota.id} className="p-3 bg-amber-50/50 border border-amber-100 rounded-xl space-y-1">
                          <div className="flex justify-between text-[10px] text-amber-700 font-semibold">
                            <span>Nota Registrada</span>
                            <span>{nota.fecha}</span>
                          </div>
                          <p className="text-gray-800">{nota.texto}</p>
                        </div>
                      ))}
                    {notas.filter((n: NotaBitacora) => n.cliente === selectedClienteModal.nombre).length === 0 && (
                      <p className="text-center text-gray-400 py-4">No hay anotaciones previas para este cliente.</p>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 3: ESTADO DE CUENTA IMPRIMIBLE */}
              {activeTab === 'estado_cuenta' && (
                <div className="space-y-4">
                  <div className="flex justify-end">
                    <button
                      onClick={() => window.print()}
                      className="flex items-center gap-1.5 px-4 py-2 bg-gray-900 text-white font-bold rounded-xl text-xs hover:bg-black transition shadow-sm"
                    >
                      <Printer className="h-4 w-4" /> Imprimir / Guardar en PDF
                    </button>
                  </div>

                  {/* VISTA IMPRIMIBLE FORMATEADA */}
                  <div className="p-6 border border-gray-200 rounded-2xl bg-white space-y-6 text-gray-800 print:border-none print:p-0">
                    <div className="flex justify-between items-start border-b border-gray-200 pb-4">
                      <div>
                        <h3 className="text-lg font-black text-blue-900">ESTADO DE CUENTA DE COBRANZA</h3>
                        <p className="text-xs text-gray-500">Fecha de emisión: {new Date().toLocaleDateString('es-PE')}</p>
                      </div>
                      <div className="text-right text-xs">
                        <p className="font-bold text-gray-800">MIDHCO FARMA</p>
                        <p className="text-gray-500">Gestión de Cobranzas</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-xs bg-gray-50 p-3 rounded-xl">
                      <div>
                        <p className="text-gray-400 font-medium">DATOS DEL CLIENTE:</p>
                        <p className="font-bold text-gray-900">{selectedClienteModal.nombre}</p>
                        {selectedClienteModal.nombreComercial && <p className="text-blue-600 font-medium">{selectedClienteModal.nombreComercial}</p>}
                        <p className="text-gray-600">RUC/DNI: {selectedClienteModal.ruc || 'S/N'}</p>
                      </div>
                      <div>
                        <p className="text-gray-400 font-medium">UBICACIÓN Y ATENCIÓN:</p>
                        <p className="text-gray-700">Zona: <strong>{selectedClienteModal.zona}</strong></p>
                        <p className="text-gray-700">Representante: <strong>{selectedClienteModal.representante}</strong></p>
                      </div>
                    </div>

                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-gray-200 bg-gray-50 text-gray-600">
                          <th className="p-2">Documento</th>
                          <th className="p-2">F. Vencimiento</th>
                          <th className="p-2 text-center">Días Mora</th>
                          <th className="p-2 text-right">Saldo (S/.)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {selectedClienteModal.documentosDetalle.map((doc: any, idx: number) => (
                          <tr key={idx}>
                            <td className="p-2 font-mono">{doc.documento || doc.doc || 'S/N'}</td>
                            <td className="p-2">{doc.fecha_venc ? String(doc.fecha_venc).split('T')[0] : 'S/F'}</td>
                            <td className="p-2 text-center font-bold text-gray-700">{doc.dias_mora || 0}</td>
                            <td className="p-2 text-right font-bold text-blue-600">
                              S/. {Number(doc.saldo || 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    <div className="flex justify-end border-t border-gray-200 pt-4">
                      <div className="text-right">
                        <p className="text-xs text-gray-500 font-medium">TOTAL ADEUDADO:</p>
                        <p className="text-xl font-black text-gray-900">
                          S/. {selectedClienteModal.saldoTotal.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                    </div>

                    <div className="text-[10px] text-gray-400 border-t border-gray-100 pt-3">
                      * Por favor realizar los abonados a las cuentas oficiales de la empresa e indicar su número de documento en el concepto de transferencia.
                    </div>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      )}
    </div>
  )
}