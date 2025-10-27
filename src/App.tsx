import { useState, useEffect } from 'react'
// Importamos el 'tipo' de FormEvent por separado
import type { FormEvent } from 'react'
import './App.css' // Puedes añadir estilos básicos aquí

// --- ¡IMPORTANTE! ---
// Pon la URL de tu Worker API (la misma que usaste en la app de admin)
const API_URL = 'https://api-inventario.dejesus-ramirez-josue.workers.dev' 

// Definición del tipo Producto (para el dropdown)
interface Producto {
  id: number;
  nombre_equipo: string;
}

function App() {
  const [loading, setLoading] = useState(true)
  const [productos, setProductos] = useState<Producto[]>([])

  // Estado para los campos del formulario
  const [productoId, setProductoId] = useState('')
  const [nombrePersona, setNombrePersona] = useState('')
  const [enviando, setEnviando] = useState(false)

  // Carga los productos del inventario para el dropdown
  useEffect(() => {
    const fetchProductos = async () => {
      setLoading(true)
      try {
        const response = await fetch(`${API_URL}/api/inventario`)
        const data = await response.json()
        setProductos(data)
      } catch (error) {
        console.error('Error al cargar productos:', error)
        alert('No se pudo cargar la lista de equipos.')
      }
      setLoading(false)
    }
    fetchProductos()
  }, []) 

  // Función para manejar el envío del formulario
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault() 
    
    if (!productoId || !nombrePersona) {
      alert('Por favor, selecciona un equipo e ingresa tu nombre.')
      return
    }
    
    setEnviando(true)

    try {
      const response = await fetch(`${API_URL}/api/prestamos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          producto_id: parseInt(productoId), 
          nombre_persona: nombrePersona,
        }),
      })

      if (!response.ok) {
        throw new Error('No se pudo registrar la solicitud')
      }

      alert('¡Solicitud registrada con éxito!')
      setProductoId('') 
      setNombrePersona('') 
      // No necesitamos recargar la lista de préstamos, ya que el usuario no la ve

    } catch (error) {
      console.error('Error en el formulario:', error)
      if (error instanceof Error) {
        alert(`Error: ${error.message}`)
      } else {
        alert('Ocurrió un error desconocido')
      }
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="App">
      <header>
        <h1>Solicitud de Préstamo de Equipo</h1>
        <p>Por favor, completa el formulario para solicitar un equipo.</p>
      </header>
      
      {loading && <p>Cargando lista de equipos...</p>}

      {!loading && (
        <form onSubmit={handleSubmit} className="formulario-prestamo">
          <div>
            <label htmlFor="producto">Equipo a solicitar:</label>
            <select 
              id="producto"
              value={productoId}
              onChange={(e) => setProductoId(e.target.value)}
              required
            >
              <option value="" disabled>-- Selecciona un equipo --</option>
              {productos.map((producto) => (
                <option key={producto.id} value={producto.id}>
                  {producto.nombre_equipo}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="nombre">Tu Nombre Completo:</label>
            <input 
              type="text" 
              id="nombre"
              value={nombrePersona}
              onChange={(e) => setNombrePersona(e.target.value)}
              required
            />
          </div>
          <button type="submit" disabled={enviando || loading}>
            {enviando ? 'Enviando...' : 'Enviar Solicitud'}
          </button>
        </form>
      )}
    </div>
  )
}

export default App