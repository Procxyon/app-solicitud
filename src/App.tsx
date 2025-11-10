import { useState, useEffect, useMemo } from 'react'
import type { FormEvent } from 'react'
import Fuse from 'fuse.js' 
import './App.css' 
import toast from 'react-hot-toast';

const API_URL = 'https://api-inventario.dejesus-ramirez-josue.workers.dev' 

// --- Interfaces ---
interface Producto {
  id: number;
  nombre_equipo: string;
}
interface SolicitudItem {
  id: number;
  nombre_equipo: string;
  cantidad: string; 
}
// --- Fin de Interfaces ---

const fuseOptions = {
  keys: ['nombre_equipo'],
  threshold: 0.4,
  includeScore: true
};

function App() {
  // --- Estados ---
  const [todosLosProductos, setTodosLosProductos] = useState<Producto[]>([])
  const fuse = useMemo(() => new Fuse(todosLosProductos, fuseOptions), [todosLosProductos])
  
  // Estados del formulario
  const [nombrePersona, setNombrePersona] = useState('')
  const [numeroControl, setNumeroControl] = useState('')
  const [tipo, setTipo] = useState<'PERSONAL' | 'EQUIPO'>('PERSONAL');
  const [integrantes, setIntegrantes] = useState('1')
  const [materia, setMateria] = useState('')
  const [grupo, setGrupo] = useState('')
  const [nombreProfesor, setNombreProfesor] = useState('');
  
  const [listaSolicitud, setListaSolicitud] = useState<SolicitudItem[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState<Producto[]>([])
  
  // Estados de UI
  const [terminosUso, setUso] = useState(false)
  const [modalAbierto, setModalAbierto] = useState(false)
  const [loading, setLoading] = useState(true)
  const [enviando, setEnviando] = useState(false)

  // --- ¡CORRECCIÓN DE TIPO AQUÍ! ---
  // Se añade '' (vacío) para permitir que las secciones se cierren
  type Seccion = 'solicitante' | 'tipo' | 'equipo' | ''; 
  const [seccionAbierta, setSeccionAbierta] = useState<Seccion>('solicitante');


  // --- Carga de Productos ---
  useEffect(() => {
    const fetchProductos = async () => {
      setLoading(true);
      try {
        const response = await fetch(`${API_URL}/api/inventario?public=true`);
        const data = await response.json();
        if (Array.isArray(data)) {
           setTodosLosProductos(data); 
        }
      } catch (error) { console.error('Error al cargar productos:', error); }
      setLoading(false);
    }
    fetchProductos()
  }, [])

  // --- Funciones de Manejo de Lista ---
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
  
  const handleAddItem = (producto: Producto) => {
    if (!listaSolicitud.find(item => item.id === producto.id)) {
      setListaSolicitud([...listaSolicitud, { ...producto, cantidad: '' }]) 
    }
    setSearchTerm('')
    setSearchResults([])
  }

  const handleRemoveItem = (productoId: number) => {
    setListaSolicitud(listaSolicitud.filter(item => item.id !== productoId))
  }

  const handleUpdateCantidad = (id: number, nuevaCantidad: string) => {
    if (/^\d*$/.test(nuevaCantidad)) {
        setListaSolicitud(prev => prev.map(item => 
          item.id === id ? { ...item, cantidad: nuevaCantidad } : item
        ));
    }
  };

  // --- FUNCIÓN DE ENVÍO ---
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault() 
    
    // Validaciones
    if (!terminosUso) { toast.error('Debes aceptar el reglamento.'); return; }
    if (listaSolicitud.length === 0) { toast.error('Debes añadir al menos un equipo.'); return; }
    if (!nombrePersona || !numeroControl) { toast.error('Completa Nombre y N° de Control.'); return; }
    
    const itemsSinCantidad = listaSolicitud.filter(item => !item.cantidad || parseInt(item.cantidad) <= 0);
    if (itemsSinCantidad.length > 0) {
        toast.error(`Introduce una cantidad válida (mayor a 0) para: ${itemsSinCantidad[0].nombre_equipo}`);
        return;
    }

    if (tipo === 'EQUIPO' && (!integrantes || !nombreProfesor)) {
        toast.error('Para solicitudes de EQUIPO, el N° de Integrantes y el Nombre del Profesor son obligatorios.');
        return;
    }
    
    const prestamoCount = parseInt(localStorage.getItem('prestamoCount') || '0');
    if (prestamoCount > 0 && prestamoCount % 5 === 0) {
        const reglamento = `RECUERDA EL REGLAMENTO:\n\n1. El material debe ser entregado en las mismas condiciones.\n2. Cualquier daño será responsabilidad del solicitante.\n3. El equipo debe ser devuelto en la fecha y hora acordadas.\n\n¿Aceptas y entiendes estas condiciones para continuar?`;
        const aceptado = window.confirm(reglamento); 
        if (!aceptado) { toast('Solicitud cancelada.', { icon: 'ℹ️' }); return; }
    }
    
    setEnviando(true);
    const loadingToast = toast.loading("Enviando solicitud..."); 
    const solicitud_id = crypto.randomUUID(); 

    const solicitudes = listaSolicitud.map(producto => {
      const cantidadNum = parseInt(producto.cantidad) || 0; 
      return fetch(`${API_URL}/api/prestamos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          producto_id: producto.id, 
          nombre_persona: nombrePersona,
          numero_de_control: numeroControl, 
          integrantes: tipo === 'PERSONAL' ? 1 : parseInt(integrantes) || 1,
          cantidad: cantidadNum,
          materia: tipo === 'EQUIPO' ? materia : null,
          grupo: tipo === 'EQUIPO' ? grupo : null,
          nombre_profesor: tipo === 'EQUIPO' ? nombreProfesor : null,
          solicitud_uuid: solicitud_id 
        }),
      })
    });

    try {
      const responses = await Promise.all(solicitudes)
      const algunaFallo = responses.some(res => !res.ok)
      
      if (algunaFallo) {
        const errorResponse = responses.find(res => !res.ok);
        let errorMsg = 'No se pudieron registrar';
        if (errorResponse) {
          try {
            const errData = await errorResponse.json();
            errorMsg = `Error: ${errData.err || errorResponse.statusText}`;
          } catch(e) { /* No hacer nada */ }
        }
        throw new Error(errorMsg);
      }

      toast.success(`¡Solicitud registrada con éxito!`, { id: loadingToast });
      localStorage.setItem('prestamoCount', (prestamoCount + 1).toString());

      setListaSolicitud([]); setNombrePersona(''); setNumeroControl(''); 
      setIntegrantes(''); setMateria(''); setGrupo(''); setNombreProfesor('');
      setSearchTerm(''); setUso(false); setTipo('PERSONAL');
      setSeccionAbierta('solicitante'); 

    } catch (error) {
      console.error('Error en el formulario:', error)
      if (error instanceof Error) toast.error(error.message, { id: loadingToast })
      else toast.error('Ocurrió un error desconocido', { id: loadingToast })
    } finally {
      setEnviando(false)
    }
  }

  // --- RENDERIZADO (JSX) ---
  return (
    <div className="App">
      <header>
        <img src="/logo.png" alt="Logo de la Aplicación" style={{width: "512px", height: "221px"}} />
        <h1>Solicitud de Préstamo de Equipo</h1>
      </header>
      
      {loading && <p>Cargando lista de equipos...</p>}

      {!loading && (
        <form onSubmit={handleSubmit} className="formulario-prestamo accordion">
          
          {/* --- SECCIÓN 1: SOLICITANTE --- */}
          <div className="accordion-item">
            {/* --- ¡CORRECCIÓN EN ONCLICK! --- */}
            <h3 className="accordion-header" onClick={() => setSeccionAbierta(seccionAbierta === 'solicitante' ? '' : 'solicitante')}>
              1. Datos del Solicitante 
              <span>{seccionAbierta === 'solicitante' ? '▲' : '▼'}</span>
            </h3>
            {seccionAbierta === 'solicitante' && (
              <div className="accordion-content">
                <fieldset>
                  <div>
                    <label htmlFor="nombre">Nombre Completo:</label>
                    <input type="text" id="nombre" value={nombrePersona} onChange={(e) => setNombrePersona(e.target.value)} placeholder="Ingrese su nombre completo" required />
                  </div>
                  <div>
                    <label htmlFor="control">Número de Control:</label>
                    <input type="text" id="control" inputMode="numeric" value={numeroControl} onChange={(e) => {if (/^\d*$/.test(e.target.value)) {setNumeroControl(e.target.value);}}} placeholder="Ingrese su número de control" required />
                  </div>
                  <button type="button" className="next-btn" onClick={() => setSeccionAbierta('tipo')}>
                    Siguiente ▼
                  </button>
                </fieldset>
              </div>
            )}
          </div>

          {/* --- SECCIÓN 2: TIPO DE SOLICITUD --- */}
          <div className="accordion-item">
            {/* --- ¡CORRECCIÓN EN ONCLICK! --- */}
            <h3 className="accordion-header" onClick={() => setSeccionAbierta(seccionAbierta === 'tipo' ? '' : 'tipo')}>
              2. Tipo de Solicitud
              <span>{seccionAbierta === 'tipo' ? '▲' : '▼'}</span>
            </h3>
            {seccionAbierta === 'tipo' && (
              <div className="accordion-content">
                <fieldset>
                  <div className="tipo-solicitud-selector">
                    <label className={tipo === 'PERSONAL' ? 'active' : ''}>
                      <input type="radio" name="tipo" value="PERSONAL" checked={tipo === 'PERSONAL'} onChange={(e) => setTipo(e.target.value as any)} />
                      👤 PERSONAL
                    </label>
                    <label className={tipo === 'EQUIPO' ? 'active' : ''}>
                      <input type="radio" name="tipo" value="EQUIPO" checked={tipo === 'EQUIPO'} onChange={(e) => setTipo(e.target.value as any)} />
                      👥 EQUIPO (Clase / Práctica)
                    </label>
                  </div>
                  
                  <div className={`campos-equipo ${tipo === 'EQUIPO' ? 'visible' : ''}`}>
                    <div className="form-group" style={{marginBottom: '15px'}}>
                      <label htmlFor="nombreProfesor">Nombre del Profesor:</label>
                      <input type="text" id="nombreProfesor" value={nombreProfesor} onChange={(e) => setNombreProfesor(e.target.value)} placeholder="Nombre del Profesor a cargo" disabled={tipo === 'PERSONAL'} />
                    </div>
                    <div style={{ marginBottom: '16px' }}>                  
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label htmlFor="integrantes">Núm. de Integrantes:</label>                        
                        <input 
                          type="text" 
                          pattern="[0-9]*"
                          id="integrantes"
                          inputMode="numeric"
                          value={integrantes}
                          min="1" // Mantenemos min="1" solo como referencia visual
                          onChange={(e) => {
                            const rawValue = e.target.value;
                            
                            // 1. Permitir vaciar el campo (temporalmente)
                            if (rawValue === '') {
                                setIntegrantes('');
                                return;
                            }
                            
                            // 2. Solo proceder si son dígitos
                            if (/^\d+$/.test(rawValue)) {
                                const numValue = parseInt(rawValue, 10);
                                
                                if (numValue >= 1 && numValue <= 5) {
                                    // 3. Rango válido: guardar el string
                                    setIntegrantes(rawValue);
                                } else if (numValue > 5) {
                                    // 4. Rango excedido: forzar el máximo y notificar
                                    toast.error("El número de integrantes no debe exceder de 5.");
                                    setIntegrantes('5');
                                }
                                // Nota: Si el usuario pone '0', el campo no se actualizará, forzándolo a poner '1'.
                            }
                          }}
                          required={tipo === 'EQUIPO'} 
                          disabled={tipo === 'PERSONAL'} 
                        />
                        </div>
                      <div className="form-group">
                        <label htmlFor="materia">Materia :</label>
                        <input type="text" id="materia" value={materia} onChange={(e) => setMateria(e.target.value)} placeholder="Ej. Circuitos Eléctricos" disabled={tipo === 'PERSONAL'} />
                      </div>
                      <div className="form-group">
                        <label htmlFor="grupo">Grupo :</label>
                        <input type="text" id="grupo" value={grupo} onChange={(e) => setGrupo(e.target.value)} placeholder="Ej. 0A" disabled={tipo === 'PERSONAL'} />
                      </div>
                    </div>
                  </div>
                  <button type="button" className="next-btn" onClick={() => setSeccionAbierta('equipo')}>
                    Siguiente ▼
                  </button>
                </fieldset>
              </div>
            )}
          </div>

          {/* --- SECCIÓN 3: EQUIPOS --- */}
          <div className="accordion-item">
            {/* --- ¡CORRECCIÓN EN ONCLICK! --- */}
            <h3 className="accordion-header" onClick={() => setSeccionAbierta(seccionAbierta === 'equipo' ? '' : 'equipo')}>
              3. Equipos y Material
              <span>{seccionAbierta === 'equipo' ? '▲' : '▼'}</span>
            </h3>
            {seccionAbierta === 'equipo' && (
              <div className="accordion-content">
                <fieldset>
                  <label htmlFor="busqueda">Herramienta / Equipo:</label>
                  <input type="text" id="busqueda" value={searchTerm} onChange={handleSearch} placeholder="Escribe el nombre de la herramienta o equipo" />
                  
                  <div className="search-results">
                    {searchResults.map((producto) => (
                      <button type="button" key={producto.id} onClick={() => handleAddItem(producto)} className="search-result-item">
                        Añadir: {producto.nombre_equipo}
                      </button>
                    ))}
                  </div>
                  
                  <div className="lista-solicitud">
                    <h4>Equipos en esta solicitud:</h4>
                    {listaSolicitud.length === 0 ? (
                      <p>Aún no has añadido equipos.</p>
                    ) : (
                      <ul className="solicitud-items-list">
                        {listaSolicitud.map((prod) => (
                          <li key={prod.id} className="solicitud-item">
                            <span className="item-name">{prod.nombre_equipo}</span>
                            <div className="item-controls">
                              <label htmlFor={`qty-${prod.id}`}>Cantidad:</label>
                              <input 
                                type="text" 
                                pattern="[0-9]*" 
                                inputMode="numeric"
                                id={`qty-${prod.id}`} 
                                className="item-quantity" 
                                value={prod.cantidad} 
                                placeholder="Cant." 
                                onChange={(e) => handleUpdateCantidad(prod.id, e.target.value)}
                                required
                              />
                              <button type="button" onClick={() => handleRemoveItem(prod.id)} className="remove-btn">
                                Quitar
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </fieldset>

                {/* --- SECCIÓN FINAL: TÉRMINOS Y ENVÍO --- */}
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

                <button type="submit" disabled={enviando || loading} className="submit-btn" style={{marginTop: '20px'}}>
                  {enviando ? 'Enviando...' : 'Enviar Solicitud'}
                </button>
              </div>
            )}
          </div>
        </form>
      )}
    </div>
  )
}

export default App