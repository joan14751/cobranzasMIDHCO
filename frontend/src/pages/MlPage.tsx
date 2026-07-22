import { useEffect, useState } from 'react'
import { getDocumentos } from '../lib/supabaseService'
import { parseCobranzaExcelFile } from '../lib/excelService'
import { MlCache } from '../lib/mlCache'
import { Brain, ShieldCheck, AlertTriangle, HelpCircle, Search, FileText, RefreshCw, MessageSquare } from 'lucide-react'

interface RecomendacionLocal {
  id: string
  cliente: string
  documento: string
  representante: string
  saldo: number
  dias_mora: number
  probabilidad_pago: number
  nivel_riesgo: 'Bajo' | 'Medio' | 'Alto' | 'Crítico'
  recomendacion: string
}

interface DocumentoExtendido {
  id: string;
  nombre: string;
  ruta_archivo: string;
  url_archivo: string;
}

function MlCardSkeleton() {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 md:p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 animate-pulse">
      <div className="space-y-3 flex-1 w-full">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <div className="h-5 w-48 bg-slate-200 rounded-md" />
          <div className="h-5 w-24 bg-slate-100 rounded-md" />
        </div>
        <div className="space-y-2">
          <div className="h-4 w-full bg-slate-100 rounded-md" />
          <div className="h-4 w-3/4 bg-slate-100 rounded-md" />
        </div>
        <div className="grid grid-cols-2 md:flex gap-2 md:gap-x-4 pt-1">
          <div className="h-3 w-20 bg-slate-100 rounded-md" />
          <div className="h-3 w-24 bg-slate-100 rounded-md" />
          <div className="h-3 w-16 bg-slate-100 rounded-md col-span-2 md:col-span-1" />
        </div>
      </div>
      <div className="flex flex-row md:flex-col items-center md:items-end justify-between md:justify-center gap-3 pt-3 md:pt-0 border-t md:border-t-0 border-gray-50 min-w-[150px]">
        <div className="h-6 w-24 bg-slate-100 rounded-full" />
        <div className="text-right flex flex-col items-end gap-1">
          <div className="h-6 w-12 bg-slate-200 rounded-md" />
          <div className="h-2 w-16 bg-slate-100 rounded-md" />
        </div>
      </div>
    </div>
  )
}

export default function MlPage() {
  const [allRecommendations, setAllRecommendations] = useState<RecomendacionLocal[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedTerm, setDebouncedTerm] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isRefresing, setIsRefresing] = useState(false)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedTerm(searchTerm)
    }, 300)
    return () => clearTimeout(handler)
  }, [searchTerm])

  const loadAndAnalyzeData = async (forceRefresh = false) => {
    try {
      setLoading(true)
      if (forceRefresh) MlCache.clear()

      const { data, error: supabaseError } = await getDocumentos()
      if (supabaseError) throw new Error(supabaseError)

      const documentos = (data || []) as unknown as DocumentoExtendido[]
      const excelDocs = documentos.filter((doc) => 
        doc.ruta_archivo && (doc.ruta_archivo.endsWith('.xls') || doc.ruta_archivo.endsWith('.xlsx'))
      )

      if (excelDocs.length === 0) {
        setAllRecommendations([])
        return
      }

      const ultimoExcel = excelDocs[0]

      if (MlCache.isValid(ultimoExcel.id)) {
        setAllRecommendations(MlCache.get())
        setLoading(false)
        return
      }

      const response = await fetch(ultimoExcel.url_archivo)
      const blob = await response.blob()
      const file = new File([blob], ultimoExcel.nombre, { type: blob.type })

      const parsedRows = await parseCobranzaExcelFile(file)

      const analyzedData: RecomendacionLocal[] = parsedRows.map((row: any, index: number) => {
        const diasMora = Number(row.dias_mora || 0)
        const saldo = Number(row.saldo || 0)
        const nroDocumento = row.documento || row.doc || row.num_doc || row.factura || 'S/N';

        let probabilidad = 95 - (diasMora * 1.2)
        if (saldo > 15000) probabilidad -= 10 
        if (probabilidad < 5) probabilidad = 5 
        if (probabilidad > 98) probabilidad = 98 

        let riesgo: 'Bajo' | 'Medio' | 'Alto' | 'Crítico' = 'Bajo'
        let recomendacion = 'Mantener línea de crédito. Recordatorio preventivo de pago ordinario por canales digitales.'

        if (diasMora > 0 && diasMora <= 15) {
          riesgo = 'Medio'
          recomendacion = 'Notificación amistosa via WhatsApp y correo electrónico. Seguimiento de compromiso a 48hrs.'
        } else if (diasMora > 15 && diasMora <= 45) {
          riesgo = 'Alto'
          recomendacion = 'Llamada directa de cobranza. Suspender temporalmente nuevos despachos y renegociar plazos.'
        } else if (diasMora > 45) {
          riesgo = 'Crítico'
          recomendacion = 'Bloqueo absoluto de cuenta. Derivar a cobranza prejudicial/legal de inmediato y emitir carta notarial.'
        }

        return {
          id: row.id || `ml-${index}`,
          cliente: row.cliente || 'Cliente No Identificado',
          documento: nroDocumento,
          representante: row.representante || row.vendedor || 'No Asignado',
          saldo,
          dias_mora: diasMora,
          probabilidad_pago: probabilidad / 100,
          nivel_riesgo: riesgo,
          recomendacion
        }
      })

      analyzedData.sort((a, b) => b.dias_mora - a.dias_mora)
      
      MlCache.set(ultimoExcel.id, analyzedData)
      setAllRecommendations(analyzedData)

    } catch (err: any) {
      setError(err.message || 'No se pudieron procesar las recomendaciones predictivas')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAndAnalyzeData()
  }, [])

  const handleManualRefresh = async () => {
    setIsRefresing(true)
    await loadAndAnalyzeData(true)
    setIsRefresing(false)
  }

  const getWhatsAppUrl = (item: RecomendacionLocal) => {
    const mensaje = `Estimado/a *${item.cliente}*,\n\n` +
      `Le saludamos cordialmente. Le recordamos que presenta un saldo pendiente de *S/. ${item.saldo.toLocaleString('es-PE', { minimumFractionDigits: 2 })}* ` +
      `asociado al documento *${item.documento}*` +
      `${item.dias_mora > 0 ? `, con *${item.dias_mora} días de mora*.` : '.'}\n\n` +
      `Agradeceremos su apoyo confirmando la fecha estimada de pago o coordinando con su representante (*${item.representante}*).\n\n` +
      `¡Muchas gracias!`;

    return `https://api.whatsapp.com/send?text=${encodeURIComponent(mensaje)}`;
  }

  const filteredRecommendations = allRecommendations.filter((item) => {
    const term = debouncedTerm.toLowerCase().trim()
    if (!term) return true
    return (
      item.representante.toLowerCase().includes(term) || 
      item.cliente.toLowerCase().includes(term) ||
      item.documento.toLowerCase().includes(term)
    )
  })

  const getRiesgoBadge = (riesgo: string) => {
    switch (riesgo) {
      case 'Bajo': return { bg: 'bg-green-50 text-green-700 border-green-200', icon: <ShieldCheck className="h-4 w-4" /> }
      case 'Medio': return { bg: 'bg-amber-50 text-amber-700 border-amber-200', icon: <HelpCircle className="h-4 w-4" /> }
      case 'Alto': return { bg: 'bg-orange-50 text-orange-700 border-orange-200', icon: <AlertTriangle className="h-4 w-4" /> }
      case 'Crítico': return { bg: 'bg-red-50 text-red-700 border-red-200', icon: <AlertTriangle className="h-4 w-4" /> }
      default: return { bg: 'bg-gray-50 text-gray-700 border-gray-200', icon: <HelpCircle className="h-4 w-4" /> }
    }
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Brain className="h-6 w-6 text-blue-500" /> Gestión Inteligente de Cobranza (ML)
          </h1>
          <p className="text-xs md:text-sm text-gray-500">Análisis de scoring crediticio y recomendaciones inmediatas según patrones de mora.</p>
        </div>
        
        <button
          onClick={handleManualRefresh}
          disabled={loading || isRefresing}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold text-gray-600 bg-gray-50 hover:bg-gray-100 border border-gray-200 transition disabled:opacity-50 self-start sm:self-center shadow-sm"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isRefresing ? 'animate-spin' : ''}`} />
          {isRefresing ? 'Sincronizando...' : 'Recargar Datos'}
        </button>
      </div>

      <div className="relative w-full md:max-w-md">
        <Search className="absolute inset-y-0 left-3 h-4 w-4 text-gray-400 self-center my-auto" />
        <input
          type="text"
          placeholder="Filtrar por representante, cliente o documento..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm text-gray-900 outline-none transition focus:border-blue-500 shadow-sm"
        />
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">{error}</div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {loading ? (
            <>
              <MlCardSkeleton />
              <MlCardSkeleton />
              <MlCardSkeleton />
              <MlCardSkeleton />
            </>
          ) : (
            filteredRecommendations.map((item, index) => {
              const badge = getRiesgoBadge(item.nivel_riesgo)
              return (
                <div key={item.id || index} className="rounded-2xl border border-gray-100 bg-white p-4 md:p-5 shadow-sm transition hover:shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1.5 flex-1 w-full">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                      <span className="font-bold text-gray-900 text-sm md:text-base break-words">{item.cliente}</span>
                      <span className="inline-flex items-center gap-1 text-[10px] md:text-xs font-mono font-semibold px-2 py-0.5 bg-blue-50 text-blue-700 rounded-md border border-blue-100">
                        <FileText className="h-3 w-3" /> {item.documento}
                      </span>
                    </div>
                    <p className="text-xs md:text-sm text-gray-600 font-medium">{item.recomendacion}</p>
                    
                    <div className="grid grid-cols-2 md:flex md:flex-wrap gap-2 md:gap-x-4 md:gap-y-1 text-[11px] md:text-xs text-gray-400 pt-1">
                      <span className="truncate">Rep: <strong className="text-gray-600">{item.representante}</strong></span>
                      <span className="truncate">Monto: <strong className="text-gray-700">S/. {item.saldo.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</strong></span>
                      <span className="col-span-2 md:col-span-1">Retraso: <strong className={item.dias_mora > 0 ? "text-red-500 font-bold" : ""}>{item.dias_mora} días</strong></span>
                    </div>
                  </div>

                  <div className="flex flex-row md:flex-col items-center md:items-end justify-between md:justify-center gap-3 min-w-[150px] pt-3 md:pt-0 border-t md:border-t-0 border-gray-100">
                    <div className="flex items-center gap-2">
                      <div className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] md:text-xs font-bold border ${badge.bg}`}>{badge.icon} Riesgo {item.nivel_riesgo}</div>
                    </div>
                    
                    <div className="flex items-center md:flex-col md:items-end gap-3 md:gap-1">
                      <div className="text-right">
                        <p className="text-lg md:text-xl font-black text-gray-800">{Math.round(item.probabilidad_pago * 100)}%</p>
                        <p className="text-[9px] md:text-[10px] text-slate-400 font-medium tracking-wider uppercase">Prob. Pago</p>
                      </div>

                      <a
                        href={getWhatsAppUrl(item)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold shadow-sm transition active:scale-95"
                        title="Enviar recordatorio por WhatsApp"
                      >
                        <MessageSquare className="h-3.5 w-3.5 fill-current" />
                        <span>WhatsApp</span>
                      </a>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}