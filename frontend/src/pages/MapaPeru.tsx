import React from 'react'

// Declaración de tipos para las props del componente
interface ResumenZona {
  clientes: number
  deuda: number
}

interface MapaPeruProps {
  zonaSeleccionada: string
  onSelectZona: (zona: string) => void
  resumenPorZona: Record<string, ResumenZona>
}

// Lista de departamentos principales del Perú
const DEPARTAMENTOS_PERU = [
  'AMAZONAS', 'ANCASH', 'APURIMAC', 'AREQUIPA', 'AYACUCHO',
  'CAJAMARCA', 'CALLAO', 'CUSCO', 'HUANCAVELICA', 'HUANUCO',
  'ICA', 'JUNIN', 'LA LIBERTAD', 'LAMBAYEQUE', 'LIMA',
  'LORETO', 'MADRE DE DIOS', 'MOQUEGUA', 'PASCO', 'PIURA',
  'PUNO', 'SAN MARTIN', 'TACNA', 'TUMBES', 'UCAYALI'
]

export default function MapaPeru({
  zonaSeleccionada,
  onSelectZona,
  resumenPorZona
}: MapaPeruProps) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 pt-2">
        {DEPARTAMENTOS_PERU.map((dep: string) => {
          const info = resumenPorZona[dep] || { clientes: 0, deuda: 0 }
          const isSelected =
            zonaSeleccionada.toUpperCase() === dep ||
            zonaSeleccionada.toUpperCase().includes(dep)

          return (
            <button
              key={dep}
              type="button"
              onClick={() => onSelectZona(dep)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 border ${
                isSelected
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                  : info.clientes > 0
                  ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                  : 'bg-gray-50 text-gray-400 border-gray-200 hover:bg-gray-100'
              }`}
            >
              <span>{dep}</span>
              {info.clientes > 0 && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    isSelected
                      ? 'bg-white text-blue-600'
                      : 'bg-blue-200 text-blue-800'
                  }`}
                >
                  {info.clientes}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}