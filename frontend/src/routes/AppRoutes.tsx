import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from '../components/Layout.tsx'
import { useAuth } from '../contexts/AuthContext.tsx'
import ClientesFormPage from '../pages/ClientesFormPage.tsx'
import ClientesPage from '../pages/ClientesPage.tsx'
import DashboardPage from '../pages/DashboardPage.tsx'
import DocumentosPage from '../pages/DocumentosPage.tsx'
import LoginPage from '../pages/LoginPage.tsx'
import MlPage from '../pages/MlPage.tsx'
import PagosPage from '../pages/PagosPage.tsx'

function AppRoutes() {
  const { user, loading } = useAuth()

  if (loading) {
    return <div className="p-6">Cargando...</div>
  }

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route
        path="/"
        element={user ? <Layout><DashboardPage /></Layout> : <Navigate to="/login" replace />}
      />
      <Route
        path="/clientes"
        element={user ? <Layout><ClientesPage /></Layout> : <Navigate to="/login" replace />}
      />
      <Route
        path="/clientes/nuevo"
        element={user ? <Layout><ClientesFormPage /></Layout> : <Navigate to="/login" replace />}
      />
      <Route
        path="/clientes/:id/editar"
        element={user ? <Layout><ClientesFormPage /></Layout> : <Navigate to="/login" replace />}
      />
      <Route
        path="/pagos"
        element={user ? <Layout><PagosPage /></Layout> : <Navigate to="/login" replace />}
      />
      <Route
        path="/documentos"
        element={user ? <Layout><DocumentosPage /></Layout> : <Navigate to="/login" replace />}
      />
      <Route
        path="/ml"
        element={user ? <Layout><MlPage /></Layout> : <Navigate to="/login" replace />}
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default AppRoutes
