import { BrowserRouter as Router } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext.tsx'
import AppRoutes from './routes/AppRoutes.tsx'
import { SidebarProvider } from './contexts/SidebarContext.tsx'

function App() {
  return (
    <Router>
      <AuthProvider>
        <SidebarProvider>
          <AppRoutes />
        </SidebarProvider>
      </AuthProvider>
    </Router>
  )
}

export default App
