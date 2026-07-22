// src/lib/mlCache.ts

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

// Variables en memoria (persistentes mientras la app no se recargue por completo)
let cacheDocId: string | null = null
let cacheData: RecomendacionLocal[] = []

export const MlCache = {
  // Comprobar si el ID del documento en el servidor coincide con nuestra caché
  isValid(documentoId: string): boolean {
    return cacheDocId === documentoId && cacheData.length > 0
  },

  // Obtener los datos guardados
  get(): RecomendacionLocal[] {
    return cacheData
  },

  // Guardar los nuevos datos procesados vinculados a ese documento específico
  set(documentoId: string, data: RecomendacionLocal[]) {
    cacheDocId = documentoId
    cacheData = data
  },

  // Limpiar caché por si necesitas forzar una recarga manual
  clear() {
    cacheDocId = null
    cacheData = []
  }
}