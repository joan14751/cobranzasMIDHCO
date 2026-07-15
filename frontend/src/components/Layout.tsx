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
    { label: 'Dashboard', path: '/', icon: Home },
    { label: 'Clientes', path: '/clientes', icon: Users },
    { label: 'Pagos', path: '/pagos', icon: Receipt },
    { label: 'Documentos', path: '/documentos', icon: FileText },
    { label: 'ML', path: '/ml', icon: Sparkles },
  ]

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="flex">
        <aside className={`${isOpen ? 'w-64' : 'w-20'} hidden md:flex h-screen flex-col border-r bg-white px-4 py-6 transition-all`}>
          <div className="mb-8 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Cobranza</h2>
            <button onClick={toggleSidebar} className="rounded p-1 hover:bg-slate-100">
              <Menu className="h-5 w-5" />
            </button>
          </div>

          <nav className="flex-1 space-y-2">
            {navItems.map(({ label, path, icon: Icon }) => {
              const active = location.pathname === path
              return (
                <Link
                  key={path}
                  to={path}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium ${active ? 'bg-primary-600 text-white' : 'text-slate-700 hover:bg-slate-100'}`}
                >
                  <Icon className="h-4 w-4" />
                  {isOpen && <span>{label}</span>}
                </Link>
              )
            })}
          </nav>

          <button
            onClick={() => signOut()}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            <LogOut className="h-4 w-4" />
            {isOpen && <span>Cerrar sesión</span>}
          </button>
        </aside>

        <main className="flex-1 p-6">
          <div className="mb-6 flex items-center justify-between">
            <h1 className="text-2xl font-semibold text-slate-900">{location.pathname === '/' ? 'Dashboard' : 'Gestión'}</h1>
            {location.pathname === '/clientes' && (
              <Link to="/clientes/nuevo" className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white">
                Nuevo cliente
              </Link>
            )}
          </div>
          {children}
        </main>
      </div>
    </div>
  )
}

export default Layout
