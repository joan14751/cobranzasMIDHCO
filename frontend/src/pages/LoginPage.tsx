import { FormEvent, useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext.tsx'
import { useNavigate } from 'react-router-dom'
import { Lock, Mail, Loader2, Building2, Eye, EyeOff, ShieldCheck } from 'lucide-react'

const IMAGENES = [
  '/foto1.png',
  '/foto3.png',
  '/foto4.png',
]

function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)

  const { signIn } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentImageIndex((prevIndex) => (prevIndex + 1) % IMAGENES.length)
    }, 4000) // 4 segundos para apreciar mejor cada foto

    return () => clearInterval(timer)
  }, [])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await signIn(email, password)
      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar sesión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen w-full bg-slate-950 font-sans antialiased">
      
      {/* SECCIÓN IZQUIERDA: Carrusel con efectos visuales */}
      <div className="relative hidden lg:flex lg:w-1/2 xl:w-7/12 items-center justify-center bg-slate-950 p-8 overflow-hidden select-none">
        
        {/* Imágenes con transición de opacidad y zoom sutil */}
        {IMAGENES.map((imgSrc, index) => (
          <img
            key={imgSrc}
            src={imgSrc}
            alt={`MIDHCO Slider ${index + 1}`}
            className={`absolute h-full max-h-[90vh] w-auto max-w-full object-contain rounded-3xl shadow-2xl transition-all duration-1000 ease-in-out ${
              index === currentImageIndex 
                ? 'opacity-100 scale-100 z-10' 
                : 'opacity-0 scale-95 z-0'
            }`}
          />
        ))}
        {/* Indicadores de puntos abajo */}
        <div className="absolute bottom-8 z-20 flex gap-2">
          {IMAGENES.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentImageIndex(index)}
              className={`h-2 rounded-full transition-all duration-300 ${
                index === currentImageIndex ? 'w-8 bg-blue-500' : 'w-2 bg-white/30 hover:bg-white/60'
              }`}
              aria-label={`Ir a la imagen ${index + 1}`}
            />
          ))}
        </div>
      </div>

      {/* SECCIÓN DERECHA: Formulario dentro de Card con Glassmorphism */}
      <div className="flex w-full lg:w-1/2 xl:w-5/12 items-center justify-center p-6 sm:p-12 bg-slate-950">
        <div className="w-full max-w-md rounded-3xl border border-slate-800/80 bg-slate-900/50 p-8 shadow-2xl backdrop-blur-xl flex flex-col justify-between">
          
          <div>
            <div className="mb-8 text-center lg:text-left">
              <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white shadow-lg shadow-blue-500/25 ring-4 ring-blue-500/10">
                <Building2 className="h-7 w-7" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Bienvenido</h1>
              <p className="mt-1 text-xs text-slate-400 sm:text-sm">
                Ingresa tus credenciales para acceder a la app.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Campo Correo */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold tracking-wider text-slate-300 uppercase">
                  Correo Electrónico
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="usuario@midhco.com"
                    className="w-full rounded-xl border border-slate-700/80 bg-slate-800/60 py-3 pl-10 pr-3 text-sm text-white placeholder-slate-500 outline-none transition-all duration-200 focus:border-blue-500 focus:bg-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:shadow-[0_0_15px_rgba(37,99,235,0.15)]"
                    required
                  />
                </div>
              </div>

              {/* Campo Contraseña */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold tracking-wider text-slate-300 uppercase">
                  Contraseña
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-xl border border-slate-700/80 bg-slate-800/60 py-3 pl-10 pr-10 text-sm text-white placeholder-slate-500 outline-none transition-all duration-200 focus:border-blue-500 focus:bg-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:shadow-[0_0_15px_rgba(37,99,235,0.15)]"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Opciones Adicionales */}
              <div className="flex items-center justify-between text-xs">
                <label className="flex items-center gap-2 text-slate-400 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-700 bg-slate-800 text-blue-600 focus:ring-0 focus:ring-offset-0"
                  />
                  Recordar sesión
                </label>
                <a href="#" className="text-blue-400 hover:text-blue-300 hover:underline transition">
                  ¿Olvidaste tu contraseña?
                </a>
              </div>

              {error && (
                <div className="rounded-xl border border-red-900/50 bg-red-950/40 p-3 text-xs font-medium text-red-400 backdrop-blur-xs animate-shake">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/25 hover:from-blue-500 hover:to-indigo-500 active:scale-[0.98] disabled:opacity-60 transition-all duration-200 cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Accediendo...
                  </>
                ) : (
                  'Entrar al sistema'
                )}
              </button>
            </form>
          </div>

          {/* CRÉDITOS / DESARROLLADOR */}
          <div className="mt-8 pt-4 border-t border-slate-800/60 text-center">
            <p className="text-[15px] font-normal lowercase text-slate-500">
              Desarrollado por joan47212@gmail.com y 
              jeancarlosquispebrena5@gmail.com
            </p>
          </div>

        </div>
      </div>

    </div>
  )
}

export default LoginPage