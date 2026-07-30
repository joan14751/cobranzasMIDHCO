import { PlanPagoRecomendado } from './recommendationEngine'

export interface RecomendacionLocal {
  id: string
  cliente: string
  documento: string
  representante: string
  saldo: number
  dias_mora: number
  probabilidad_pago: number
  nivel_riesgo: 'Bajo' | 'Medio' | 'Alto' | 'Crítico'
  recomendacion: string
  planPago: PlanPagoRecomendado
}

const CACHE_KEY = 'ml_recommendations_cache'
const CACHE_DOC_KEY = 'ml_document_id_cache'

export const MlCache = {
  isValid(documentoId: string): boolean {
    const cachedDoc = localStorage.getItem(CACHE_DOC_KEY)
    const cachedData = localStorage.getItem(CACHE_KEY)
    return cachedDoc === documentoId && cachedData !== null
  },

  get(): RecomendacionLocal[] {
    const data = localStorage.getItem(CACHE_KEY)
    return data ? JSON.parse(data) : []
  },

  set(documentoId: string, data: RecomendacionLocal[]): void {
    localStorage.setItem(CACHE_DOC_KEY, documentoId)
    localStorage.setItem(CACHE_KEY, JSON.stringify(data))
  },

  clear(): void {
    localStorage.removeItem(CACHE_DOC_KEY)
    localStorage.removeItem(CACHE_KEY)
  }
}