import { useEffect, useState } from 'react'
import { getDocumentos } from '../lib/supabaseService'
import { parseCobranzaExcelFile } from '../lib/excelService'
import { Search, User, Building2, Wallet, Calendar } from 'lucide-react'
import { Link } from 'react-router-dom'

interface DocumentoExtendido {
  id: string;
  nombre: string;
  ruta_archivo: string;
  url_archivo: string;
}

interface ClienteConsolidado {
  nombre: string;
  representante: string;
  saldoTotal: number;
  documentosAsociados: number;
  maxDiasMora: number;
  docsAlDia: number;   // <-- NUEVO
  docsEnMora: number;  // <-- NUEVO
}

export default function ClientesPage() {
  const [clientes, setClientes] = useState<ClienteConsolidado[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadAndProcessClientes = async () => {
      try {
        setLoading(true)
        setError(null)
        
        const { data, error: supabaseError } = await getDocumentos()
        if (supabaseError) throw new Error(supabaseError)

        const documentos = (data || []) as unknown as DocumentoExtendido[]
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
              docsAlDia: 0,   // <-- Inicializar
              docsEnMora: 0   // <-- Inicializar
            }
          }

          clientesMap[nombreCliente].saldoTotal += saldo
          clientesMap[nombreCliente].documentosAsociados += 1
          
          // Contabilizar según los días de mora de la fila
          if (diasMora > 0) {
            clientesMap[nombreCliente].docsEnMora += 1
          } else {
            clientesMap[nombreCliente].docsAlDia += 1
          }

          if (diasMora > clientesMap[nombreCliente].maxDiasMora) {
            clientesMap[nombreCliente].maxDiasMora = diasMora
          }
        })

        const listaClientes = Object.values(clientesMap).sort((a, b) => 
          a.nombre.localeCompare(b.nombre)
        )

        setClientes(listaClientes)
      } catch (err: any) {
        console.error(err)
        setError(err.message || 'Error al procesar el directorio de clientes.')
      } finally {
        setLoading(false)
      }
    }

    loadAndProcessClientes()
  }, [])

  const filteredClientes = clientes.filter((c) => {
    const term = searchTerm.toLowerCase().trim()
    return c.nombre.toLowerCase().includes(term) || c.representante.toLowerCase().includes(term)
  })

  const getMoraColor = (dias: number) => {
    if (dias <= 0) return 'text-green-600 bg-green-50 border-green-100'
    if (dias <= 30) return 'text-amber-600 bg-amber-50 border-amber-100'
    return 'text-red-600 bg-red-50 border-red-100 font-bold'
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Building2 className="h-6 w-6 text-blue-500" />
          Directorio de Clientes
        </h1>
        <p className="text-sm text-gray-500">Listado unificado extraído de la última plantilla de cobranza cargada.</p>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute inset-y-0 left-3 h-4 w-4 text-gray-400 self-center my-auto" />
        <input
          type="text"
          placeholder="Buscar por nombre de cliente o representante..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        />
      </div>

      {loading ? (
        <div className="flex h-[40vh] flex-col items-center justify-center gap-2">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
          <p className="text-sm text-slate-500 font-medium">Compilando cartera de clientes únicos...</p>
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">{error}</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredClientes.map((cliente, index) => (
            <div key={index} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm hover:shadow-md transition flex flex-col justify-between gap-4">
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-bold text-gray-900 text-sm line-clamp-2 flex-1">{cliente.nombre}</h3>
                  <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[10px] font-mono border ${getMoraColor(cliente.maxDiasMora)}`}>
                    {cliente.maxDiasMora <= 0 ? 'Al Día' : `${cliente.maxDiasMora}d Mora`}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-gray-400">
                  <User className="h-3.5 w-3.5 text-gray-300" />
                  <span>Rep: <strong className="text-gray-600">{cliente.representante}</strong></span>
                </div>
              </div>

              {/* SECCIÓN DE DATOS Y CONTEOS DISCRIMINADOS */}
              <div className="grid grid-cols-2 gap-2 pt-3 border-t border-gray-50 text-xs">
                <div className="bg-gray-50/50 p-2 rounded-xl space-y-0.5 flex flex-col justify-center">
                  <div className="text-[10px] text-gray-400 font-medium flex items-center gap-1">
                    <Wallet className="h-3 w-3 text-blue-500" /> Deuda Total
                  </div>
                  <p className="font-bold text-gray-900">S/. {cliente.saldoTotal.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</p>
                </div>
                
                <div className="bg-gray-50/50 p-2 rounded-xl space-y-1">
                  <div className="text-[10px] text-gray-400 font-medium flex items-center gap-1 mb-0.5">
                    <Calendar className="h-3 w-3 text-purple-500" /> Ver Documentos
                  </div>
                  <div className="flex gap-1.5">
                    {/* Botón Al Día */}
                    <Link
                      to="/pagos"
                      state={{ filterText: cliente.nombre, filterType: 'ALDIA' }}
                      className="flex-1 text-center py-0.5 px-1 rounded bg-green-50 hover:bg-green-100 border border-green-200 text-green-700 font-semibold text-[10px] transition"
                    >
                      {cliente.docsAlDia} Al día
                    </Link>
                    {/* Botón En Mora */}
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
    </div>
  )
}