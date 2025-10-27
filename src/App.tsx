import { useState, useEffect, useMemo } from 'react'
import type { FormEvent } from 'react'
import Fuse from 'fuse.js' 
import './App.css' 

const API_URL = 'https://api-inventario.dejesus-ramirez-josue.workers.dev' 

interface Producto {
  id: number;
  nombre_equipo: string;
}

// ¡NUEVA INTERFAZ! Para guardar el producto Y la cantidad
interface SolicitudItem extends Producto {
  cantidad: number;
}

// Opciones para la búsqueda difusa (sin cambios)
const fuseOptions = {
  keys: ['nombre_equipo'],
  threshold: 0.4,
  includeScore: true
};

function App() {
  const [todosLosProductos, setTodosLosProductos] = useState<Producto[]>([])
  
  // --- CAMBIO ---
  // Ahora la lista de solicitud usa la nueva interfaz
  const [listaSolicitud, setListaSolicitud] = useState<SolicitudItem[]>([])

  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState<Producto[]>([])
  const fuse = useMemo(() => new Fuse(todosLosProductos, fuseOptions), [todosLosProductos])

  const [nombrePersona, setNombrePersona] = useState('')
  const [numeroControl, setNumeroControl] = useState('')
  const [integrantes, setIntegrantes] = useState(1)

  const [terminosUso, setUso] = useState(false)
  const [modalAbierto, setModalAbierto] = useState(false)
  
  const [loading, setLoading] = useState(true)
  const [enviando, setEnviando] = useState(false)

  // Carga productos (sin cambios)
  useEffect(() => {
    const fetchProductos = async () => {
      setLoading(true)
      try {
        const response = await fetch(`${API_URL}/api/inventario`)
        const data = await response.json()
        setTodosLosProductos(data)
      } catch (error) {
        console.error('Error al cargar productos:', error)
      }
      setLoading(false)
    }
    fetchProductos()
  }, []) 

  // Búsqueda (sin cambios)
  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newSearchTerm = e.target.value
    setSearchTerm(newSearchTerm)
    if (newSearchTerm.trim() === '') {
      setSearchResults([])
      return
    }
    const results = fuse.search(newSearchTerm).map(result => result.item)
    setSearchResults(results.slice(0, 5)) 
  }

  // --- CAMBIO ---
  // Al añadir un item, lo añadimos con cantidad 1
  const handleAddItem = (producto: Producto) => {
    if (!listaSolicitud.find(item => item.id === producto.id)) {
      // Añade el producto junto con la cantidad
      setListaSolicitud([...listaSolicitud, { ...producto, cantidad: 1 }]) 
    }
    setSearchTerm('')
    setSearchResults([])
  }

  // Quitar de la lista (sin cambios)
  const handleRemoveItem = (productoId: number) => {
    setListaSolicitud(listaSolicitud.filter(item => item.id !== productoId))
  }

  // --- ¡NUEVA FUNCIÓN! ---
  // Para actualizar la cantidad de un item en la lista
  const handleUpdateCantidad = (id: number, nuevaCantidad: number) => {
    // Asegurarse de que la cantidad sea al menos 1
    const cantidadValidada = Math.max(1, nuevaCantidad);

    setListaSolicitud(listaSolicitud.map(item => 
      item.id === id ? { ...item, cantidad: cantidadValidada } : item
    ));
  };

  // --- CAMBIO EN EL SUBMIT ---
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault() 
    
    // ¡CORRECCIÓN! Añadida la validación de términos de uso
    if (!terminosUso) {
      alert('Debes aceptar el reglamento de uso para poder enviar la solicitud.')
      return
    }
    if (listaSolicitud.length === 0) {
      alert('Debes añadir al menos un equipo a tu solicitud.')
      return
    }
    if (!nombrePersona || !numeroControl || !integrantes) {
      alert('Por favor, llena tu nombre, número de control y número de integrantes.')
      return
    }
    
    setEnviando(true)

    // El array de promesas ahora lee 'producto.cantidad'
    const solicitudes = listaSolicitud.map(producto => {
      return fetch(`${API_URL}/api/prestamos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          producto_id: producto.id, 
          nombre_persona: nombrePersona,
          numero_de_control: numeroControl,
          integrantes: integrantes,
          cantidad: producto.cantidad // <-- ¡AQUÍ ESTÁ!
        }),
      })
    })

    try {
      const responses = await Promise.all(solicitudes)
      const algunaFallo = responses.some(res => !res.ok)
      if (algunaFallo) throw new Error('No se pudieron registrar algunas solicitudes')

      alert(`¡Solicitud registrada con éxito para ${listaSolicitud.length} tipo(s) de equipo!`)
      
      setListaSolicitud([])
      setNombrePersona('')
      setNumeroControl('')
      setIntegrantes(1)
      setSearchTerm('')
      setUso(false) // Resetea el checkbox

    } catch (error) {
      console.error('Error en el formulario:', error)
      if (error instanceof Error) alert(`Error: ${error.message}`)
      else alert('Ocurrió un error desconocido')
    } finally {
      setEnviando(false)
    }
  }

  // --- RENDERIZADO (JSX) ---
  return (
    <div className="App">
      <header>
        {/* Tus estilos de logo e imagen se conservan */}
        <img src="/logo.png" alt="Logo de la Aplicación" style={{width: "512px", height: "221px"}} /> 
        <h1>Solicitud de Préstamo de Equipo</h1>
      </header>
      
      {loading && <p>Cargando lista de equipos...</p>}

      {!loading && (
        <form onSubmit={handleSubmit} className="formulario-prestamo">
          
          <fieldset>
            <legend>Datos del Solicitante</legend>
            {/* Tus campos de Nombre, Control, e Integrantes se conservan */}
            <div>
              <label htmlFor="nombre">Nombre Completo:</label>
              <input type="text" id="nombre" value={nombrePersona} onChange={(e) => setNombrePersona(e.target.value)} placeholder="NOMBRE | APELLIDOS" required />
            </div>
            <div>
              <label htmlFor="control">Número de Control:</label>
              <input type="text" id="control" value={numeroControl} onChange={(e) => setNumeroControl(e.target.value)} placeholder="SE ENCUENTRA EN LA PARTE INFERIOR DE SU CREDENCIAL " required />
            </div>
            <div>
              <label htmlFor="integrantes">Número de Integrantes (total):</label>
              <input type="number" id="integrantes" value={integrantes} min="1" onChange={(e) => setIntegrantes(parseInt(e.target.value) || 1)} required />
            </div>
           {/* Tu checkbox y modal se conservan */}
           <div className="terminos-container">
              <input type="checkbox" id="Uso" checked={terminosUso} onChange={(e) => setUso(e.target.checked)} required />
              <label htmlFor="Uso"> 
                <span className="link-reglamento" onClick={(e) => { e.preventDefault(); setModalAbierto(true); }}>
                  Acepto el reglamento de préstamos de equipo
                </span>
              </label>
            </div>
            {modalAbierto && (
              <div className="modal-overlay" onClick={() => setModalAbierto(false)}>
                <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                  <h2>Reglamento de Uso y Obligaciones</h2>
                  <ol>
                    <li>El material debe ser entregado en las mismas condiciones...</li>
                    <li>Si existe algún daño favor de reportarlo al momento del prestamo...</li>
                    <li>El equipo deberá responder por cualquier daño o pérdida...</li>
                    <li>Cualquier daño al equipo será responsabilidad del solicitante...</li>
                    <li>El equipo debe ser devuelto en la misma fecha del préstamo...</li>
                    <li>El equipo debe ser devuelto antes de las 21:00 horas...</li>
                  </ol>
                  <button type="button" className="modal-close-btn" onClick={() => setModalAbierto(false)}>
                    Entendido y Cerrar
                  </button>
                </div>
              </div>
            )}
          </fieldset>

          <fieldset>
            <legend>Equipos a Solicitar</legend>
            {/* Tu búsqueda se conserva */}
            <label htmlFor="busqueda">Herramienta / Equipo:</label>
            <input type="text" id="busqueda" value={searchTerm} onChange={handleSearch} placeholder="Escribe el nombre de la herramienta o equipo" />
            <div className="search-results">
              {searchResults.map((producto) => (
                <button type="button" key={producto.id} onClick={() => handleAddItem(producto)} className="search-result-item">
                  Añadir: {producto.nombre_equipo}
                </button>
              ))}
            </div>

            {/* --- CAMBIO EN LA LISTA DE SOLICITUD --- */}
            <div className="lista-solicitud">
              <h4>Equipos en esta solicitud:</h4>
              {listaSolicitud.length === 0 ? (
                <p>Aún no has añadido equipos.</p>
              ) : (
                <ul className="solicitud-items-list">
                  {listaSolicitud.map((prod) => (
                    <li key={prod.id} className="solicitud-item">
                      <span className="item-name">{prod.nombre_equipo}</span>
                      
                      {/* --- ¡NUEVO CONTADOR! --- */}
                      <div className="item-controls">
                        <label htmlFor={`qty-${prod.id}`}>Cantidad:</label>
                        <input
                          type="number"
                          id={`qty-${prod.id}`}
                          className="item-quantity"
                          value={prod.cantidad}
                          min="1"
                          onChange={(e) => handleUpdateCantidad(prod.id, parseInt(e.target.value) || 1)}
                        />
                        <button type="button" onClick={() => handleRemoveItem(prod.id)} className="remove-btn">
                          Quitar
                        </button>
                      </div>
                      {/* --- FIN DEL CONTADOR --- */}

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