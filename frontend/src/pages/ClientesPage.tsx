import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import { deleteCliente, getClientes } from '../lib/supabaseService.ts'
import { Cliente } from '../types/index.ts'

function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadClientes = async () => {
    setLoading(true)
    const { data, error } = await getClientes()
    setLoading(false)
    if (error) {
      setError(error)
      return
    }
    setError(null)
    setClientes(data || [])
  }

  useEffect(() => {
    loadClientes()
  }, [])

  const handleDelete = async (id: string) => {
    if (!window.confirm('¿Deseas eliminar este cliente?')) return
    const { error } = await deleteCliente(id)
    if (error) {
      toast.error(error)
      return
    }
    toast.success('Cliente eliminado')
    loadClientes()
  }

  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold">Clientes</h2>
      {loading ? (
        <p className="text-sm text-slate-500">Cargando clientes...</p>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : clientes.length === 0 ? (
        <p className="text-sm text-slate-500">No hay clientes registrados.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {clientes.map((cliente) => (
            <div key={cliente.id} className="rounded-lg border p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold">{cliente.nombre}</h3>
                  <p className="text-sm text-slate-500">{cliente.numero_credito}</p>
                </div>
                <div className="flex gap-2">
                  <Link to={`/clientes/${cliente.id}/editar`} className="rounded border px-2 py-1 text-sm">Editar</Link>
                  <button onClick={() => handleDelete(cliente.id)} className="rounded border px-2 py-1 text-sm text-red-600">Eliminar</button>
                </div>
              </div>
              <p className="mt-2 text-sm">Saldo pendiente: ${cliente.saldo_pendiente.toLocaleString()}</p>
              <p className="text-sm">Estado: {cliente.estado}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default ClientesPage
