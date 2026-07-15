import { FormEvent, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import { getClientes, saveCliente } from '../lib/supabaseService.ts'

const emptyForm = {
  nombre: '',
  numero_credito: '',
  email: '',
  telefono: '',
  direccion: '',
  monto_total: 0,
  saldo_pendiente: 0,
  estado: 'Vigente',
}

function ClientesFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [form, setForm] = useState(emptyForm)
  const [loading, setLoading] = useState(false)
  const [loadingData, setLoadingData] = useState(Boolean(id))

  useEffect(() => {
    const loadCliente = async () => {
      if (!id) return
      const { data } = await getClientes()
      const cliente = data?.find((item) => item.id === id)
      if (cliente) {
        setForm({
          ...cliente,
          email: cliente.email || '',
          telefono: cliente.telefono || '',
          direccion: cliente.direccion || '',
        })
      }
      setLoadingData(false)
    }
    loadCliente()
  }, [id])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)

    console.log('Enviando estado:', form.estado) // Para depuración

    const result = await saveCliente({ ...(id ? { id } : {}), ...form })
    setLoading(false)

    if (result.error) {
      toast.error(result.error)
      console.error('Error completo:', result.error)
      return
    }

    toast.success(id ? 'Cliente actualizado' : 'Cliente creado')
    navigate('/clientes')
  }

  if (loadingData) {
    return <div className="rounded-xl border bg-white p-6">Cargando cliente...</div>
  }

  return (
    <div className="rounded-xl border bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold">{id ? 'Editar cliente' : 'Crear cliente'}</h2>
      <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium">Nombre</label>
          <input className="w-full rounded-lg border px-3 py-2" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Número de crédito</label>
          <input className="w-full rounded-lg border px-3 py-2" value={form.numero_credito} onChange={(e) => setForm({ ...form, numero_credito: e.target.value })} required />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Correo</label>
          <input type="email" className="w-full rounded-lg border px-3 py-2" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Teléfono</label>
          <input className="w-full rounded-lg border px-3 py-2" value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} />
        </div>
        <div className="md:col-span-2">
          <label className="mb-1 block text-sm font-medium">Dirección</label>
          <input className="w-full rounded-lg border px-3 py-2" value={form.direccion} onChange={(e) => setForm({ ...form, direccion: e.target.value })} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Monto total</label>
          <input type="number" className="w-full rounded-lg border px-3 py-2" value={form.monto_total} onChange={(e) => setForm({ ...form, monto_total: Number(e.target.value) })} required />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Saldo pendiente</label>
          <input type="number" className="w-full rounded-lg border px-3 py-2" value={form.saldo_pendiente} onChange={(e) => setForm({ ...form, saldo_pendiente: Number(e.target.value) })} required />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Estado</label>
          <select className="w-full rounded-lg border px-3 py-2" value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })}>
            <option value="Vigente">Vigente</option>
            <option value="Activo">Activo</option>
            <option value="Moroso">Moroso</option>
            <option value="En reestructuración">En reestructuración</option>
            <option value="Atrasado">Atrasado</option>
            <option value="Mora">Mora</option>
          </select>
        </div>
        <div className="md:col-span-2 flex gap-3">
          <button type="submit" disabled={loading} className="rounded-lg bg-primary-600 px-4 py-2 font-medium text-white disabled:opacity-50">
            {loading ? 'Guardando...' : 'Guardar'}
          </button>
          <button type="button" onClick={() => navigate('/clientes')} className="rounded-lg border px-4 py-2">
            Cancelar
          </button>
        </div>
      </form>
    </div>
  )
}

export default ClientesFormPage