import { useState, useEffect, useMemo } from 'react'
import type { FormEvent } from 'react'
import Fuse from 'fuse.js' // <-- Importamos Fuse.js
import './App.css' 

// --- ¡IMPORTANTE! ---
const API_URL = 'https://api-inventario.dejesus-ramirez-josue.workers.dev' 

interface Producto {
  id: number;
  nombre_equipo: string;
}

// Opciones para la búsqueda difusa (fuzzy search)
const fuseOptions = {
  keys: ['nombre_equipo'], // Busca solo por el nombre
  threshold: 0.4,       // Nivel de tolerancia a typos (0 es perfecto, 1 es todo)
  includeScore: true
};

function App() {
  const [todosLosProductos, setTodosLosProductos] = useState<Producto[]>([])
  
  // --- Feature 1: Múltiples equipos ---
  const [listaSolicitud, setListaSolicitud] = useState<Producto[]>([])

  // --- Feature 2: Búsqueda ---
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState<Producto[]>([])
  const fuse = useMemo(() => new Fuse(todosLosProductos, fuseOptions), [todosLosProductos])

  // --- Feature 3 & 4: Nuevos campos ---
  const [nombrePersona, setNombrePersona] = useState('')
  const [numeroControl, setNumeroControl] = useState('')
  const [integrantes, setIntegrantes] = useState(1) // Inicia en 1

  const [loading, setLoading] = useState(true)
  const [enviando, setEnviando] = useState(false)

  // Carga todos los productos una vez
  useEffect(() => {
    const fetchProductos = async () => {
      setLoading(true)
      try {
        const response = await fetch(`${API_URL}/api/inventario`)
        const data = await response.json()
        setTodosLosProductos(data)
      } catch (error) {
        console.error('Error al cargar productos:', error)
        alert('No se pudo cargar la lista de equipos.')
      }
      setLoading(false)
    }
    fetchProductos()
  }, []) 

  // --- Feature 2: Función de Búsqueda ---
  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newSearchTerm = e.target.value
    setSearchTerm(newSearchTerm)
    
    if (newSearchTerm.trim() === '') {
      setSearchResults([])
      return
    }
    // fuse.search() devuelve { item: Producto, refIndex: number, score: number }
    const results = fuse.search(newSearchTerm).map(result => result.item)
    // Mostramos solo los 5 mejores resultados
    setSearchResults(results.slice(0, 5)) 
  }

  // --- Feature 1: Añadir a la lista ---
  const handleAddItem = (producto: Producto) => {
    // Evita duplicados
    if (!listaSolicitud.find(item => item.id === producto.id)) {
      setListaSolicitud([...listaSolicitud, producto])
    }
    // Limpia la búsqueda
    setSearchTerm('')
    setSearchResults([])
  }

  // --- Feature 1: Quitar de la lista ---
  const handleRemoveItem = (productoId: number) => {
    setListaSolicitud(listaSolicitud.filter(item => item.id !== productoId))
  }

  // --- Función de Envío Actualizada ---
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault() 
    
    if (listaSolicitud.length === 0) {
      alert('Debes añadir al menos un equipo a tu solicitud.')
      return
    }
    if (!nombrePersona || !numeroControl || !integrantes) {
      alert('Por favor, llena tu nombre, número de control y número de integrantes.')
      return
    }
    
    setEnviando(true)

    // Creamos un array de "promesas" de fetch
    const solicitudes = listaSolicitud.map(producto => {
      return fetch(`${API_URL}/api/prestamos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          producto_id: producto.id, 
          nombre_persona: nombrePersona,
          numero_de_control: numeroControl, // <-- Nuevo
          integrantes: integrantes          // <-- Nuevo
        }),
      })
    })

    try {
      // Promise.all espera a que TODAS las solicitudes terminen
      const responses = await Promise.all(solicitudes)
      
      // Verificamos si alguna falló
      const algunaFallo = responses.some(res => !res.ok)
      if (algunaFallo) {
        throw new Error('No se pudieron registrar algunas solicitudes')
      }

      alert(`¡Solicitud registrada con éxito para ${listaSolicitud.length} equipo(s)!`)
      
      // Limpiamos el formulario
      setListaSolicitud([])
      setNombrePersona('')
      setNumeroControl('')
      setIntegrantes(1)
      setSearchTerm('')

    } catch (error) {
      console.error('Error en el formulario:', error)
      if (error instanceof Error) alert(`Error: ${error.message}`)
      else alert('Ocurrió un error desconocido')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="App">
      <header>
        <img src="/logo.png" alt="Logo de la Aplicación" style={{width: "512px", height: "221px"}} />
        <h1>Solicitud de Préstamo de Equipo</h1>
      </header>
      
      {loading && <p>Cargando lista de equipos...</p>}

      {!loading && (
        <form onSubmit={handleSubmit} className="formulario-prestamo">
          
          {/* --- DATOS DEL SOLICITANTE --- */}
          <fieldset>
            <legend>Datos del Solicitante</legend>
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
            <div>
              <label htmlFor="control">Número de Control:</label>
              <input 
                type="text" 
                id="control"
                value={numeroControl}
                onChange={(e) => setNumeroControl(e.target.value)}
                required
              />
            </div>
            <div>
              <label htmlFor="integrantes">Número de Integrantes (total):</label>
              <input 
                type="number" 
                id="integrantes"
                value={integrantes}
                min="1"
                onChange={(e) => setIntegrantes(parseInt(e.target.value) || 1)}
                required
              />
            </div>
          </fieldset>

          {/* --- SELECCIÓN DE EQUIPO (Feature 1 & 2) --- */}
          <fieldset>
            <legend>Equipos a Solicitar</legend>
            <label htmlFor="busqueda">Herramienta / Equipo:</label>
            <input
              type="text"
              id="busqueda"
              value={searchTerm}
              onChange={handleSearch}
              placeholder="Escribe el nombre de la herramienta o equipo"
            />
            {/* --- Resultados de Búsqueda --- */}
            <div className="search-results">
              {searchResults.map((producto) => (
                <button 
                  type="button" 
                  key={producto.id} 
                  onClick={() => handleAddItem(producto)}
                  className="search-result-item"
                >
                  Añadir: {producto.nombre_equipo}
                </button>
              ))}
            </div>

            {/* --- Lista de equipos a solicitar --- */}
            <div className="lista-solicitud">
              <h4>Equipos en esta solicitud:</h4>
              {listaSolicitud.length === 0 ? (
                <p>Aún no has añadido equipos.</p>
              ) : (
                <ul>
                  {listaSolicitud.map((prod) => (
                    <li key={prod.id}>
                      {prod.nombre_equipo}
                      <button type="button" onClick={() => handleRemoveItem(prod.id)} className="remove-btn">
                        Quitar
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </fieldset>

          <button type="submit" disabled={enviando || loading} className="submit-btn">
            {enviando ? 'Enviando...' : 'Enviar Solicitud'}
          </button>
        </form>
      )}
    </div>
  )
}

export default App