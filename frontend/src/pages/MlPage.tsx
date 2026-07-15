import { useEffect, useState } from 'react'
import axios from 'axios'
import { RecomendacionML } from '../types/index.ts'

function MlPage() {
  const [recomendaciones, setRecomendaciones] = useState<RecomendacionML[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const response = await axios.get('/api/ml/recommendations')
        setRecomendaciones(response.data || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudieron cargar las recomendaciones')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  return (
    <div className="rounded-xl border bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold">Recomendaciones ML</h2>
      {loading ? (
        <p className="text-sm text-slate-500">Consultando modelo...</p>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : recomendaciones.length === 0 ? (
        <p className="text-sm text-slate-500">No hay recomendaciones disponibles.</p>
      ) : (
        <div className="space-y-3">
          {recomendaciones.map((item) => (
            <div key={item.id} className="rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">Cliente {item.cliente_id}</p>
                  <p className="text-sm text-slate-500">{item.recomendacion}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{Math.round(item.probabilidad_pago * 100)}%</p>
                  <p className="text-sm text-slate-500">{item.nivel_riesgo}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default MlPage
