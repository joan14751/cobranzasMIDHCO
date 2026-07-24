import React, { useEffect, useState, useMemo, useRef } from 'react'
import { getDocumentos } from '../lib/supabaseService'
import { parseCobranzaExcelFile } from '../lib/excelService'
import { Search, User, Building2, Wallet, Calendar, X, AlertTriangle, FileText, History, MessageSquarePlus, CheckCircle2, ShieldAlert } from 'lucide-react'
import { Link } from 'react-router-dom'

interface ClienteConsolidado {
  nombre: string
  representante: string
  saldoTotal: number
  documentosAsociados: number
  maxDiasMora: number
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

export default function ClientesPage() {
  const [clientes, setClientes] = useState<ClienteConsolidado[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [repFilter, setRepFilter] = useState('TODOS')
  const [moraRangeFilter, setMoraRangeFilter] = useState('TODOS')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Autocompletado
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const searchContainerRef = useRef<HTMLDivElement>(null)

  // Modal 360
  const [selectedClienteModal, setSelectedClienteModal] = useState<ClienteConsolidado | null>(null)
  const [activeTab, setActiveTab] = useState<'docs' | 'bitacora' | 'pagos'>('docs')
  
  // Bitácora de notas
  const [notas, setNotas] = useState<NotaBitacora[]>(() => {
    const saved = localStorage.getItem('cobranza_bitacora_notas')
    return saved ? JSON.parse(saved) : []
  })
  const [nuevaNota, setNuevaNota] = useState('')

  useEffect(() => {
    const loadAndProcessClientes = async () => {
      try {
        setLoading(true)
        setError(null)
        
        const { data, error: supabaseError } = await getDocumentos()
        if (supabaseError) throw new Error(supabaseError)

        const documentos = (data || []) as any[]
        const excelDocs = documentos.filter((doc) => 
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
          const nombreCliente = (row.cliente || 'Cliente No Identificado').trim()
          const representante = row.representante || row.vendedor || 'No Asignado'
          const saldo = Number(row.saldo || 0)
          const diasMora = Number(row.dias_mora || 0)

          if (!clientesMap[nombreCliente]) {
            clientesMap[nombreCliente] = {
              nombre: nombreCliente,
              representante: representante,
              saldoTotal: 0,
              documentosAsociados: 0,
              maxDiasMora: 0,
              docsAlDia: 0,
              docsEnMora: 0,
              documentosDetalle: []
            }
          }

          clientesMap[nombreCliente].saldoTotal += saldo
          clientesMap[nombreCliente].documentosAsociados += 1
          clientesMap[nombreCliente].documentosDetalle.push(row)
          
          if (diasMora > 0) {
            clientesMap[nombreCliente].docsEnMora += 1
          } else {
            clientesMap[nombreCliente].docsAlDia += 1
          }

          if (diasMora > clientesMap[nombreCliente].maxDiasMora) {
            clientesMap[nombreCliente].maxDiasMora = diasMora
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

    clientes.forEach((c) => {
      totalDeuda += c.saldoTotal
      if (c.maxDiasMora > 30) {
        montoMoraCritica += c.saldoTotal
      } else if (c.maxDiasMora <= 0) {
        totalAlDia += c.saldoTotal
      }
    })

    return { totalDeuda, montoMoraCritica, totalAlDia }
  }, [clientes])

  // Lista de Representantes Únicos
  const representantesUnicos = useMemo(() => {
    const setR = new Set<string>()
    clientes.forEach(c => { if (c.representante) setR.add(c.representante) })
    return Array.from(setR).sort()
  }, [clientes])

  // Filtro Consolidado
  const filteredClientes = useMemo(() => {
    return clientes.filter((c) => {
      const term = searchTerm.toLowerCase().trim()
      const matchesSearch = c.nombre.toLowerCase().includes(term) || c.representante.toLowerCase().includes(term)
      const matchesRep = repFilter === 'TODOS' || c.representante === repFilter

      let matchesMora = true
      if (moraRangeFilter === 'ALDIA') matchesMora = c.maxDiasMora <= 0
      else if (moraRangeFilter === '1-15') matchesMora = c.maxDiasMora >= 1 && c.maxDiasMora <= 15
      else if (moraRangeFilter === '16-30') matchesMora = c.maxDiasMora >= 16 && c.maxDiasMora <= 30
      else if (moraRangeFilter === '31-60') matchesMora = c.maxDiasMora >= 31 && c.maxDiasMora <= 60
      else if (moraRangeFilter === '>60') matchesMora = c.maxDiasMora > 60

      return matchesSearch && matchesRep && matchesMora
    })
  }, [clientes, searchTerm, repFilter, moraRangeFilter])

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
          <p className="text-sm text-gray-500">Gestión consolidada de saldos, estados de mora e historial de contactos.</p>
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

      {/* BARRA DE FILTROS */}
      <div className="flex flex-col md:flex-row gap-3 items-center justify-between bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
        <div ref={searchContainerRef} className="relative w-full md:w-80">
          <Search className="absolute inset-y-0 left-3 h-4 w-4 text-gray-400 my-auto pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar por cliente..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-white py-2 pl-9 pr-8 text-xs outline-none focus:border-blue-500"
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm('')} className="absolute inset-y-0 right-2.5 my-auto text-gray-400 hover:text-gray-600">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Filtro por Vendedor */}
          <select
            value={repFilter}
            onChange={(e) => setRepFilter(e.target.value)}
            className="rounded-xl border border-gray-200 bg-white py-2 px-3 text-xs text-gray-700 outline-none focus:border-blue-500"
          >
            <option value="TODOS">Todos los Representantes</option>
            {representantesUnicos.map((rep, idx) => (
              <option key={idx} value={rep}>{rep}</option>
            ))}
          </select>

          {/* Filtro por Rango de Mora */}
          <select
            value={moraRangeFilter}
            onChange={(e) => setMoraRangeFilter(e.target.value)}
            className="rounded-xl border border-gray-200 bg-white py-2 px-3 text-xs text-gray-700 outline-none focus:border-blue-500"
          >
            <option value="TODOS">Todos los Estados de Mora</option>
            <option value="ALDIA">Al Día (0 días)</option>
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
          <p className="text-sm text-slate-500 font-medium">Compilando cartera de clientes...</p>
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">{error}</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredClientes.map((cliente, index) => (
            <div 
              key={index} 
              className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm hover:shadow-md transition flex flex-col justify-between gap-4 cursor-pointer"
              onClick={() => setSelectedClienteModal(cliente)}
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-bold text-gray-900 text-sm line-clamp-2 flex-1 hover:text-blue-600">{cliente.nombre}</h3>
                  <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[10px] font-mono border ${getMoraColor(cliente.maxDiasMora)}`}>
                    {cliente.maxDiasMora <= 0 ? 'Al Día' : `${cliente.maxDiasMora}d Mora`}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-gray-400">
                  <User className="h-3.5 w-3.5 text-gray-300" />
                  <span>Rep: <strong className="text-gray-600">{cliente.representante}</strong></span>
                </div>
              </div>

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
                  <div className="flex gap-1.5" onClick={(e) => e.stopPropagation()}>
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

      {/* MODAL FICHA 360 Y BITÁCORA */}
      {selectedClienteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl rounded-3xl bg-white shadow-2xl border border-gray-100 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-5 bg-gray-50 border-b border-gray-100 flex items-start justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900">{selectedClienteModal.nombre}</h2>
                <p className="text-xs text-gray-500">Representante: {selectedClienteModal.representante}</p>
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
            </div>

            <div className="p-5 overflow-y-auto flex-1 text-xs space-y-4">
              {activeTab === 'docs' && (
                <div className="space-y-2">
                  {selectedClienteModal.documentosDetalle.map((doc: any, i: number) => (
                    <div key={i} className="flex justify-between items-center p-3 rounded-xl border border-gray-100 bg-gray-50/50">
                      <div>
                        <p className="font-bold text-gray-900">{doc.documento || doc.doc || 'Doc S/N'}</p>
                        <p className="text-[10px] text-gray-400">Días mora: {doc.dias_mora || 0}</p>
                      </div>
                      <p className="font-bold text-blue-600 text-sm">
                        S/. {Number(doc.saldo || 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'bitacora' && (
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Registrar llamada, promesa de pago..."
                      value={nuevaNota}
                      onChange={(e) => setNuevaNota(e.target.value)}
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
                      .filter((n) => n.cliente === selectedClienteModal.nombre)
                      .map((nota) => (
                        <div key={nota.id} className="p-3 bg-amber-50/50 border border-amber-100 rounded-xl space-y-1">
                          <div className="flex justify-between text-[10px] text-amber-700 font-semibold">
                            <span>Nota Registrada</span>
                            <span>{nota.fecha}</span>
                          </div>
                          <p className="text-gray-800">{nota.texto}</p>
                        </div>
                      ))}
                    {notas.filter((n) => n.cliente === selectedClienteModal.nombre).length === 0 && (
                      <p className="text-center text-gray-400 py-4">No hay anotaciones previas para este cliente.</p>
                    )}
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