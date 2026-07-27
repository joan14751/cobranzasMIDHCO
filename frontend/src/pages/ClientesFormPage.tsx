import { FormEvent, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import { Search } from 'lucide-react'
import { getClientes, saveCliente } from '../lib/supabaseService'

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
  
  // Estado para controlar la modal de RENIEC
  const [modalReniecAbierta, setModalReniecAbierta] = useState(false)

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

  // Función que recibe los datos desde el modal y autocompleta el formulario
  const handlePersonaSeleccionada = (persona: any) => {
    setForm((prev) => ({
      ...prev,
      nombre: persona.nombreCompleto || `${persona.nombres} ${persona.apellidoPaterno} ${persona.apellidoMaterno}`.trim(),
      direccion: persona.direccion && persona.direccion !== 'No especificada' ? persona.direccion : prev.direccion,
    }))
    toast.success('Datos importados desde RENIEC')
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)

    console.log('Enviando estado:', form.estado)

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
    <div className="rounded-xl border bg-white p-6 shadow-sm dark:bg-slate-900 dark:border-slate-800">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
          {id ? 'Editar cliente' : 'Crear cliente'}
        </h2>
        
        {/* Botón para abrir la consulta RENIEC */}
        <button
          type="button"
          onClick={() => setModalReniecAbierta(true)}
          className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition-colors shadow-sm"
        >
          <Search size={14} /> Consultar RENIEC
        </button>
      </div>

      <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Nombre</label>
          <input
            className="w-full rounded-lg border px-3 py-2 text-sm dark:bg-slate-950 dark:border-slate-700 dark:text-slate-100"
            value={form.nombre}
            onChange={(e) => setForm({ ...form, nombre: e.target.value })}
            required
            placeholder="Nombres y Apellidos"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Número de crédito</label>
          <input
            className="w-full rounded-lg border px-3 py-2 text-sm dark:bg-slate-950 dark:border-slate-700 dark:text-slate-100"
            value={form.numero_credito}
            onChange={(e) => setForm({ ...form, numero_credito: e.target.value })}
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Correo</label>
          <input
            type="email"
            className="w-full rounded-lg border px-3 py-2 text-sm dark:bg-slate-950 dark:border-slate-700 dark:text-slate-100"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Teléfono</label>
          <input
            className="w-full rounded-lg border px-3 py-2 text-sm dark:bg-slate-950 dark:border-slate-700 dark:text-slate-100"
            value={form.telefono}
            onChange={(e) => setForm({ ...form, telefono: e.target.value })}
          />
        </div>
        <div className="md:col-span-2">
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Dirección</label>
          <input
            className="w-full rounded-lg border px-3 py-2 text-sm dark:bg-slate-950 dark:border-slate-700 dark:text-slate-100"
            value={form.direccion}
            onChange={(e) => setForm({ ...form, direccion: e.target.value })}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Monto total</label>
          <input
            type="number"
            className="w-full rounded-lg border px-3 py-2 text-sm dark:bg-slate-950 dark:border-slate-700 dark:text-slate-100"
            value={form.monto_total}
            onChange={(e) => setForm({ ...form, monto_total: Number(e.target.value) })}
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Saldo pendiente</label>
          <input
            type="number"
            className="w-full rounded-lg border px-3 py-2 text-sm dark:bg-slate-950 dark:border-slate-700 dark:text-slate-100"
            value={form.saldo_pendiente}
            onChange={(e) => setForm({ ...form, saldo_pendiente: Number(e.target.value) })}
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Estado</label>
          <select
            className="w-full rounded-lg border px-3 py-2 text-sm dark:bg-slate-950 dark:border-slate-700 dark:text-slate-100"
            value={form.estado}
            onChange={(e) => setForm({ ...form, estado: e.target.value })}
          >
            <option value="Vigente">Vigente</option>
            <option value="Activo">Activo</option>
            <option value="Moroso">Moroso</option>
            <option value="En reestructuración">En reestructuración</option>
            <option value="Atrasado">Atrasado</option>
            <option value="Mora">Mora</option>
          </select>
        </div>
        <div className="md:col-span-2 flex gap-3 pt-2">
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-blue-600 hover:bg-blue-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 transition-colors"
          >
            {loading ? 'Guardando...' : 'Guardar'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/clientes')}
            className="rounded-lg border px-4 py-2 text-sm font-medium dark:border-slate-700 dark:text-slate-300"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  )
}

export default ClientesFormPage