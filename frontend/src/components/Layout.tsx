import { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { FileText, Home, LogOut, Menu, Receipt, Sparkles, Users } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext.tsx'
import { useSidebar } from '../contexts/SidebarContext.tsx'

interface LayoutProps {
  children: ReactNode
}

function Layout({ children }: LayoutProps) {
  const { signOut } = useAuth()
  const { isOpen, toggleSidebar } = useSidebar()
  const location = useLocation()

  const navItems = [
    { label: 'Dashboard ', path: '/', icon: Home },
    { label: 'Clientes', path: '/clientes', icon: Users },
    { label: 'Pagos', path: '/pagos', icon: Receipt },
    { label: 'Documentos', path: '/documentos', icon: FileText },
    { label: 'ML', path: '/ml', icon: Sparkles },
  ]

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="flex">
        {/* BARRA LATERAL (Asignamos flex-col e items-center cuando está cerrado para centrar el botón) */}
        <aside className={`${isOpen ? 'w-64 px-4' : 'w-20 px-2 items-center'} hidden md:flex h-screen flex-col border-r bg-white py-6 transition-all duration-300`}>
          
          {/* HEADER DEL SIDEBAR */}
          <div className={`mb-8 flex w-full items-center ${isOpen ? 'justify-between' : 'justify-center'}`}>
            {isOpen && <h2 className="text-lg font-semibold text-slate-800">Cobranza</h2>}
            <button 
              onClick={toggleSidebar} 
              className="rounded-lg p-2 hover:bg-slate-100 text-slate-600 transition-colors"
              title={isOpen ? "Colapsar menú" : "Expandir menú"}
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>

          {/* NAVEGACIÓN */}
          <nav className="flex-1 space-y-2 w-full">
            {navItems.map(({ label, path, icon: Icon }) => {
              const active = location.pathname === path
              return (
                <Link
                  key={path}
                  to={path}
                  className={`flex items-center gap-3 rounded-lg py-2.5 font-medium transition-all ${
                    isOpen ? 'px-3 text-sm justify-start' : 'px-0 justify-center text-base'
                  } ${active ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-700 hover:bg-slate-100'}`}
                  title={!isOpen ? label : undefined}
                >
                  <Icon className={`${isOpen ? 'h-4 w-4' : 'h-5 w-5'} flex-shrink-0`} />
                  {isOpen && <span className="truncate">{label}</span>}
                </Link>
              )
            })}
          </nav>

          {/* BOTÓN DE CERRAR SESIÓN */}
          <button
            onClick={() => signOut()}
            className={`flex items-center gap-3 rounded-lg py-2.5 font-medium text-slate-700 hover:bg-red-50 hover:text-red-600 transition-all w-full ${
              isOpen ? 'px-3 text-sm justify-start' : 'px-0 justify-center text-base'
            }`}
            title={!isOpen ? "Cerrar sesión" : undefined}
          >
            <LogOut className={`${isOpen ? 'h-4 w-4' : 'h-5 w-5'} flex-shrink-0`} />
            {isOpen && <span>Cerrar sesión</span>}
          </button>
        </aside>

        {/* CONTENIDO PRINCIPAL */}
        <main className="flex-1 p-6 overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  )
}

export default Layout