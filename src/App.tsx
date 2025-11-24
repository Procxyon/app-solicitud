import { useState, useEffect } from 'react'
import type { FormEvent } from 'react'
import './App.css' 
import toast from 'react-hot-toast';

const API_URL = 'https://api-inventario.dejesus-ramirez-josue.workers.dev' 

// --- Interfaces ---
interface Producto {
  id: number;
  nombre_equipo: string;
}

// Nueva interfaz para soportar items con y sin ID
interface SolicitudItem {
  tempId: string;        // ID único temporal para la lista visual
  nombre_ui: string;     // Lo que escribió el usuario
  cantidad: string;
  producto_real?: Producto | null; // Objeto si coincidió con inventario, null si no
}
// --- Fin de Interfaces ---

function App() {
  // --- Estados ---
  const [todosLosProductos, setTodosLosProductos] = useState<Producto[]>([])
  
  // Estados del formulario
  const [nombrePersona, setNombrePersona] = useState('')
  const [numeroControl, setNumeroControl] = useState('')
  const [tipo, setTipo] = useState<'PERSONAL' | 'EQUIPO'>('PERSONAL');
  const [integrantes, setIntegrantes] = useState('1')
  const [materia, setMateria] = useState('')
  const [grupo, setGrupo] = useState('')
  const [nombreProfesor, setNombreProfesor] = useState('');
  
  // Lista de items y Inputs temporales
  const [listaSolicitud, setListaSolicitud] = useState<SolicitudItem[]>([])
  const [textoMaterial, setTextoMaterial] = useState('');
  const [cantidadInput, setCantidadInput] = useState('1');
  
  // Estados de UI
  const [terminosUso, setUso] = useState(false)
  const [modalAbierto, setModalAbierto] = useState(false)
  const [loading, setLoading] = useState(true)
  const [enviando, setEnviando] = useState(false)

  type Seccion = 'solicitante' | 'tipo' | 'equipo' | ''; 
  const [seccionAbierta, setSeccionAbierta] = useState<Seccion>('solicitante');

  // --- Carga de Productos (Solo para validación interna, no se muestra lista) ---
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

  // --- Funciones de Manejo de Lista (NUEVA LÓGICA) ---
  
  // Buscar coincidencia exacta (Normalizando texto)
  const findExactMatch = (text: string): Producto | null => {
    if (!text) return null;
    const normalize = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
    const target = normalize(text);
    return todosLosProductos.find(p => normalize(p.nombre_equipo) === target) || null;
  };

  const handleAddItem = () => {
    if (!textoMaterial.trim()) return;

    // Buscamos si existe internamente para poner ✅ o ⚠️
    const coincidencia = findExactMatch(textoMaterial);

    const newItem: SolicitudItem = {
      tempId: crypto.randomUUID(),
      nombre_ui: textoMaterial,
      cantidad: cantidadInput === '' ? '1' : cantidadInput,
      producto_real: coincidencia // null si no encontró (⚠️)
    };

    setListaSolicitud([...listaSolicitud, newItem]);
    setTextoMaterial('');
    setCantidadInput('1');
    
    // Feedback visual sutil
    if(!coincidencia) {
        toast('Artículo no registrado en inventario. Se agregará como texto libre.', { icon: '⚠️', duration: 3000 });
    }
  };

  const handleRemoveItem = (tempId: string) => {
    setListaSolicitud(listaSolicitud.filter(item => item.tempId !== tempId))
  }

  // --- FUNCIÓN DE ENVÍO ACTUALIZADA ---
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault() 
    
    // Validaciones
    if (!terminosUso) { toast.error('Debes aceptar el reglamento.'); return; }
    if (listaSolicitud.length === 0) { toast.error('Debes añadir al menos un equipo.'); return; }
    if (!nombrePersona || !numeroControl) { toast.error('Completa Nombre y N° de Control.'); return; }
    
    // Validar cantidades positivas
    const itemsSinCantidad = listaSolicitud.filter(item => !item.cantidad || parseInt(item.cantidad) <= 0);
    if (itemsSinCantidad.length > 0) {
        toast.error(`Introduce una cantidad válida para: ${itemsSinCantidad[0].nombre_ui}`);
        return;
    }

    if (tipo === 'EQUIPO' && (!integrantes || !nombreProfesor)) {
        toast.error('Para solicitudes de EQUIPO, faltan datos obligatorios.');
        return;
    }
    
    const prestamoCount = parseInt(localStorage.getItem('prestamoCount') || '0');
    if (prestamoCount > 0 && prestamoCount % 5 === 0) {
        const confirmReglas = window.confirm(`RECUERDA:\n1. Entrega en mismas condiciones.\n2. Daños son tu responsabilidad.\n3. Puntualidad.\n¿Aceptas?`);
        if (!confirmReglas) { return; }
    }
    
    setEnviando(true);
    const loadingToast = toast.loading("Enviando solicitud..."); 
    const solicitud_id = crypto.randomUUID(); 

    // Mapeo para enviar al Backend
    const solicitudes = listaSolicitud.map(item => {
      const cantidadNum = parseInt(item.cantidad) || 1;
      const tieneID = !!item.producto_real?.id;

      return fetch(`${API_URL}/api/prestamos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // Si tiene ID, lo mandamos. Si no, mandamos null en ID y texto en nombre_extra
          producto_id: tieneID ? item.producto_real!.id : null, 
          nombre_extra: tieneID ? null : item.nombre_ui,

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
        let errorMsg = 'Error al registrar';
        if (errorResponse) {
             const data = await errorResponse.json();
             errorMsg = data.err || 'Error desconocido del servidor';
        }
        throw new Error(errorMsg);
      }

      toast.success(`¡Solicitud registrada con éxito!`, { id: loadingToast });
      localStorage.setItem('prestamoCount', (prestamoCount + 1).toString());

      setListaSolicitud([]); setNombrePersona(''); setNumeroControl(''); 
      setIntegrantes('1'); setMateria(''); setGrupo(''); setNombreProfesor('');
      setTextoMaterial(''); setUso(false); setTipo('PERSONAL');
      setSeccionAbierta('solicitante'); 

    } catch (error) {
      console.error(error)
      if (error instanceof Error) toast.error(error.message, { id: loadingToast })
      else toast.error('Error de conexión', { id: loadingToast })
    } finally {
      setEnviando(false)
    }
  }

  // --- RENDERIZADO (JSX) ---
  return (
    <div className="App">
      <header>
        <img src="/logo.png" alt="Logo" style={{width: "512px", height: "auto", maxWidth:"100%"}} />
        <h1>Solicitud de Préstamo</h1>
      </header>
      
      {loading && <p>Cargando sistema...</p>}

      {!loading && (
        <form onSubmit={handleSubmit} className="formulario-prestamo accordion">
          
          {/* --- SECCIÓN 1: SOLICITANTE --- */}
          <div className="accordion-item">
            <h3 className="accordion-header" onClick={() => setSeccionAbierta(seccionAbierta === 'solicitante' ? '' : 'solicitante')}>
              1. Datos del Solicitante 
              <span>{seccionAbierta === 'solicitante' ? '▲' : '▼'}</span>
            </h3>
            {seccionAbierta === 'solicitante' && (
              <div className="accordion-content">
                <fieldset>
                  <div>
                    <label htmlFor="nombre">Nombre Completo:</label>
                    <input type="text" id="nombre" value={nombrePersona} onChange={(e) => setNombrePersona(e.target.value)} placeholder="Tu nombre completo" required />
                  </div>
                  <div>
                    <label htmlFor="control">Número de Control:</label>
                    <input type="text" id="control" inputMode="numeric" value={numeroControl} onChange={(e) => {if (/^\d*$/.test(e.target.value)) {setNumeroControl(e.target.value);}}} placeholder="Tu número de control" required />
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
                      👥 EQUIPO
                    </label>
                  </div>
                  
                  <div className={`campos-equipo ${tipo === 'EQUIPO' ? 'visible' : ''}`}>
                    <div className="form-group" style={{marginBottom: '15px'}}>
                      <label htmlFor="nombreProfesor">Nombre del Profesor:</label>
                      <input type="text" id="nombreProfesor" value={nombreProfesor} onChange={(e) => setNombreProfesor(e.target.value)} disabled={tipo === 'PERSONAL'} />
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label htmlFor="integrantes">Integrantes:</label>                        
                        <input 
                          type="number" id="integrantes" min="1" max="5"
                          value={integrantes}
                          onChange={(e) => setIntegrantes(e.target.value)}
                          disabled={tipo === 'PERSONAL'} 
                        />
                        </div>
                      <div className="form-group">
                        <label htmlFor="materia">Materia:</label>
                        <input type="text" id="materia" value={materia} onChange={(e) => setMateria(e.target.value)} disabled={tipo === 'PERSONAL'} />
                      </div>
                      <div className="form-group">
                        <label htmlFor="grupo">Grupo:</label>
                        <input type="text" id="grupo" value={grupo} onChange={(e) => setGrupo(e.target.value)} disabled={tipo === 'PERSONAL'} />
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

          {/* --- SECCIÓN 3: EQUIPOS Y MATERIAL (MODIFICADO) --- */}
          <div className="accordion-item">
            <h3 className="accordion-header" onClick={() => setSeccionAbierta(seccionAbierta === 'equipo' ? '' : 'equipo')}>
              3. Equipos y Material
              <span>{seccionAbierta === 'equipo' ? '▲' : '▼'}</span>
            </h3>
            {seccionAbierta === 'equipo' && (
              <div className="accordion-content">
                <fieldset>
                  <label htmlFor="materialInput">Agregar Material:</label>
                  
                  {/* BARRA DE ENTRADA HORIZONTAL */}
                  <div className="add-item-row">
                    <input 
                        type="text" 
                        className="input-material"
                        id="materialInput"
                        value={textoMaterial}
                        onChange={(e) => setTextoMaterial(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddItem(); } }}
                        placeholder="Ej. Arduino, Caimanes..." 
                    />
                    <input 
                        type="number" 
                        className="input-cantidad"
                        value={cantidadInput}
                        onChange={(e) => setCantidadInput(e.target.value)}
                        placeholder="Cant."
                        min="1"
                    />
                    <button type="button" onClick={handleAddItem} className="btn-add">+</button>
                  </div>
                  
                  <div className="lista-solicitud">
                    <h4>Carrito de Solicitud:</h4>
                    {listaSolicitud.length === 0 ? (
                      <p style={{fontSize:'0.9em', color:'#aaa'}}>Lista vacía.</p>
                    ) : (
                      <ul className="solicitud-items-list">
                        {listaSolicitud.map((item) => (
                          <li key={item.tempId} className="solicitud-item">
                            <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
                                {/* ICONO DE ESTADO */}
                                <div className="item-status">
                                    {item.producto_real ? (
                                        <span title="OK: Encontrado en inventario">✅</span>
                                    ) : (
                                        <span title="Advertencia: No coincide con inventario (Se pedirá como extra)" style={{fontSize:'1.2em'}}>⚠️</span>
                                    )}
                                </div>
                                <span className="item-name">{item.nombre_ui}</span>
                            </div>
                            
                            <div className="item-controls">
                                <span style={{color:'#ccc', marginRight:'10px'}}>x {item.cantidad}</span>
                                <button type="button" onClick={() => handleRemoveItem(item.tempId)} className="remove-btn">
                                    X
                                </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </fieldset>

                {/* --- TÉRMINOS Y ENVÍO --- */}
                <div className="terminos-container" style={{marginTop:'20px'}}>
                  <input type="checkbox" id="Uso" checked={terminosUso} onChange={(e) => setUso(e.target.checked)} required />
                  <label htmlFor="Uso"> 
                    <span className="link-reglamento" onClick={(e) => { e.preventDefault(); setModalAbierto(true); }}>
                      Acepto el reglamento
                    </span>
                  </label>
                </div>
                
                {modalAbierto && (
                  <div className="modal-overlay" onClick={() => setModalAbierto(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                      <h2>Reglamento</h2>
                      <ol>
                        <li>Entrega en mismas condiciones.</li>
                        <li>Reportar daños de inmediato.</li>
                        <li>Responsabilidad del solicitante.</li>
                      </ol>
                      <button type="button" className="modal-close-btn" onClick={() => setModalAbierto(false)}>
                        Cerrar
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