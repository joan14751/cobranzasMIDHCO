import { useEffect, useState } from 'react'
import { getPagos } from '../lib/supabaseService.ts'
import { Pago } from '../types/index.ts'

function PagosPage() {
  const [pagos, setPagos] = useState<Pago[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const { data, error } = await getPagos()
      setLoading(false)
      if (error) setError(error)
      else setPagos(data || [])
    }

    load()
  }, [])

  return (
    <div className="rounded-xl border bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold">Pagos</h2>
      {loading ? (
        <p className="text-sm text-slate-500">Cargando pagos...</p>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : pagos.length === 0 ? (
        <p className="text-sm text-slate-500">No hay pagos registrados.</p>
      ) : (
        <div className="space-y-3">
          {pagos.map((pago) => (
            <div key={pago.id} className="rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">Cuota {pago.numero_cuota}</p>
                  <p className="text-sm text-slate-500">Vence: {pago.fecha_vencimiento}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">${pago.monto_cuota.toLocaleString()}</p>
                  <p className="text-sm text-slate-500">Estado: {pago.estado}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default PagosPage
