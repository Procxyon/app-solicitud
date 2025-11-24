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

interface SolicitudItem {
  tempId: string;        
  nombre_ui: string;     
  cantidad: string;
  producto_real?: Producto | null; 
}

function App() {
  // --- Estados Generales ---
  const [todosLosProductos, setTodosLosProductos] = useState<Producto[]>([])
  
  // Estados del formulario
  const [nombrePersona, setNombrePersona] = useState('')
  const [numeroControl, setNumeroControl] = useState('')
  const [tipo, setTipo] = useState<'PERSONAL' | 'EQUIPO'>('PERSONAL');
  const [integrantes, setIntegrantes] = useState('1')
  const [materia, setMateria] = useState('')
  const [grupo, setGrupo] = useState('')
  const [nombreProfesor, setNombreProfesor] = useState('');
  
  // Lista de items
  const [listaSolicitud, setListaSolicitud] = useState<SolicitudItem[]>([])
  const [textoMaterial, setTextoMaterial] = useState('');
  const [cantidadInput, setCantidadInput] = useState('1');
  
  // Estados de UI
  const [loading, setLoading] = useState(true)
  const [enviando, setEnviando] = useState(false)
  type Seccion = 'solicitante' | 'tipo' | 'equipo' | ''; 
  const [seccionAbierta, setSeccionAbierta] = useState<Seccion>('solicitante');

  // --- NUEVOS ESTADOS PARA EL MODAL DE CONFIRMACIÓN ---
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [checkReglamento, setCheckReglamento] = useState(false); // Checkbox dentro del modal

  // --- Carga de Productos ---
  useEffect(() => {
    const fetchProductos = async () => {
      setLoading(true);
      try {
        const response = await fetch(`${API_URL}/api/inventario?public=true`);
        const data = await response.json();
        if (Array.isArray(data)) setTodosLosProductos(data); 
      } catch (error) { console.error(error); }
      setLoading(false);
    }
    fetchProductos()
  }, [])

  // --- Helpers de Lista ---
  const findExactMatch = (text: string): Producto | null => {
    if (!text) return null;
    const normalize = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
    return todosLosProductos.find(p => normalize(p.nombre_equipo) === normalize(text)) || null;
  };

  const handleAddItem = () => {
    if (!textoMaterial.trim()) return;
    const coincidencia = findExactMatch(textoMaterial);
    const newItem: SolicitudItem = {
      tempId: crypto.randomUUID(),
      nombre_ui: textoMaterial,
      cantidad: cantidadInput === '' ? '1' : cantidadInput,
      producto_real: coincidencia 
    };
    setListaSolicitud([...listaSolicitud, newItem]);
    setTextoMaterial(''); setCantidadInput('1');
    if(!coincidencia) toast('Artículo externo (se pedirá como texto libre).', { icon: 'ℹ️', duration: 2000 });
  };

  const handleRemoveItem = (tempId: string) => {
    setListaSolicitud(listaSolicitud.filter(item => item.tempId !== tempId))
  }

  // --- PASO 1: PRE-VALIDACIÓN (Al dar click en "Continuar") ---
  const handlePreSubmit = (e: FormEvent) => {
    e.preventDefault();
    
    // 1. Validaciones básicas
    if (listaSolicitud.length === 0) { toast.error('La lista está vacía.'); return; }
    if (!nombrePersona || !numeroControl) { toast.error('Faltan datos del solicitante.'); setSeccionAbierta('solicitante'); return; }
    
    // 2. Validar cantidades
    const itemsSinCantidad = listaSolicitud.filter(item => !item.cantidad || parseInt(item.cantidad) <= 0);
    if (itemsSinCantidad.length > 0) {
        toast.error(`Cantidad inválida para: ${itemsSinCantidad[0].nombre_ui}`);
        return;
    }

    // 3. Validar datos de equipo
    if (tipo === 'EQUIPO' && (!integrantes || !nombreProfesor)) {
        toast.error('Faltan datos del Equipo (Profesor/Integrantes).');
        setSeccionAbierta('tipo');
        return;
    }

    // SI TODO ESTÁ BIEN -> ABRIMOS EL MODAL DE SEGURIDAD
    setCheckReglamento(false); // Reseteamos el check
    setShowConfirmModal(true);
  };

  // --- PASO 2: ENVÍO REAL (Al confirmar en el Modal) ---
  const handleFinalSubmit = async () => {
    if (!checkReglamento) return; // Doble seguridad

    setEnviando(true);
    const loadingToast = toast.loading("Registrando solicitud..."); 
    const solicitud_id = crypto.randomUUID(); 

    // Mapeo de datos
    const solicitudes = listaSolicitud.map(item => {
      const cantidadNum = parseInt(item.cantidad) || 1;
      const tieneID = !!item.producto_real?.id;

      return fetch(`${API_URL}/api/prestamos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
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
      if (responses.some(res => !res.ok)) throw new Error('Error en el servidor al guardar items.');

      toast.success(`¡Solicitud registrada correctamente!`, { id: loadingToast });
      
      // Limpieza
      localStorage.setItem('prestamoCount', (parseInt(localStorage.getItem('prestamoCount') || '0') + 1).toString());
      setListaSolicitud([]); setNombrePersona(''); setNumeroControl(''); 
      setIntegrantes('1'); setMateria(''); setGrupo(''); setNombreProfesor('');
      setTextoMaterial(''); setTipo('PERSONAL'); setSeccionAbierta('solicitante'); 
      
      setShowConfirmModal(false); // Cerramos modal

    } catch (error) {
      console.error(error)
      toast.error('Ocurrió un error al intentar guardar.', { id: loadingToast })
    } finally {
      setEnviando(false)
    }
  }

  // --- RENDERIZADO ---
  return (
    <div className="App">
      <header>
        <img src="/logo.png" alt="Logo" style={{width: "512px", height: "auto", maxWidth:"100%"}} />
        <h1>Solicitud de Préstamo</h1>
      </header>
      
      {loading && <p>Cargando sistema...</p>}

      {!loading && (
        // CAMBIO: onSubmit llama a handlePreSubmit (no envía todavía)
        <form onSubmit={handlePreSubmit} className="formulario-prestamo accordion">
          
          {/* ... SECCIÓN 1 (Igual que antes) ... */}
          <div className="accordion-item">
            <h3 className="accordion-header" onClick={() => setSeccionAbierta(seccionAbierta === 'solicitante' ? '' : 'solicitante')}>
              1. Datos del Solicitante <span>{seccionAbierta === 'solicitante' ? '▲' : '▼'}</span>
            </h3>
            {seccionAbierta === 'solicitante' && (
              <div className="accordion-content">
                <fieldset>
                  <div>
                    <label>Nombre Completo:</label>
                    <input type="text" value={nombrePersona} onChange={(e) => setNombrePersona(e.target.value)} required />
                  </div>
                  <div>
                    <label>Número de Control:</label>
                    <input type="text" inputMode="numeric" value={numeroControl} onChange={(e) => {if (/^\d*$/.test(e.target.value)) setNumeroControl(e.target.value)}} required />
                  </div>
                  <button type="button" className="next-btn" onClick={() => setSeccionAbierta('tipo')}>Siguiente ▼</button>
                </fieldset>
              </div>
            )}
          </div>

          {/* ... SECCIÓN 2 (Igual que antes) ... */}
          <div className="accordion-item">
            <h3 className="accordion-header" onClick={() => setSeccionAbierta(seccionAbierta === 'tipo' ? '' : 'tipo')}>
              2. Tipo de Solicitud <span>{seccionAbierta === 'tipo' ? '▲' : '▼'}</span>
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
                     <label>Nombre del Profesor:</label>
                     <input type="text" value={nombreProfesor} onChange={(e) => setNombreProfesor(e.target.value)} disabled={tipo === 'PERSONAL'} />
                   </div>
                   <div className="form-row">
                     <div className="form-group">
                       <label>Integrantes:</label>                        
                       <input type="number" min="1" max="5" value={integrantes} onChange={(e) => setIntegrantes(e.target.value)} disabled={tipo === 'PERSONAL'} />
                       </div>
                     <div className="form-group">
                       <label>Materia:</label>
                       <input type="text" value={materia} onChange={(e) => setMateria(e.target.value)} disabled={tipo === 'PERSONAL'} />
                     </div>
                     <div className="form-group">
                       <label>Grupo:</label>
                       <input type="text" value={grupo} onChange={(e) => setGrupo(e.target.value)} disabled={tipo === 'PERSONAL'} />
                     </div>
                   </div>
                 </div>
                 <button type="button" className="next-btn" onClick={() => setSeccionAbierta('equipo')}>Siguiente ▼</button>
               </fieldset>
             </div>
            )}
          </div>

          {/* ... SECCIÓN 3 (Sin el check de términos aquí, solo lista) ... */}
          <div className="accordion-item">
            <h3 className="accordion-header" onClick={() => setSeccionAbierta(seccionAbierta === 'equipo' ? '' : 'equipo')}>
              3. Equipos y Material <span>{seccionAbierta === 'equipo' ? '▲' : '▼'}</span>
            </h3>
            {seccionAbierta === 'equipo' && (
              <div className="accordion-content">
                <fieldset>
                  <label>Agregar Material:</label>
                  <div className="add-item-row">
                    <input type="text" className="input-material" value={textoMaterial} onChange={(e) => setTextoMaterial(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddItem(); } }} placeholder="Ej. Arduino..." />
                    <input type="number" className="input-cantidad" value={cantidadInput} onChange={(e) => setCantidadInput(e.target.value)} min="1" />
                    <button type="button" onClick={handleAddItem} className="btn-add">+</button>
                  </div>
                  
                  <div className="lista-solicitud">
                    <h4>Carrito de Solicitud:</h4>
                    {listaSolicitud.length === 0 ? <p style={{fontSize:'0.9em', color:'#aaa'}}>Lista vacía.</p> : (
                      <ul className="solicitud-items-list">
                        {listaSolicitud.map((item) => (
                          <li key={item.tempId} className="solicitud-item">
                             <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
                                <div className="item-status">{item.producto_real ? '✅' : '⚠️'}</div>
                                <span className="item-name">{item.nombre_ui}</span>
                            </div>
                            <div className="item-controls">
                                <span style={{color:'#ccc', marginRight:'10px'}}>x {item.cantidad}</span>
                                <button type="button" onClick={() => handleRemoveItem(item.tempId)} className="remove-btn">X</button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </fieldset>

                {/* BOTÓN INICIAL: Solo dice "Continuar" o "Revisar" */}
                <button type="submit" disabled={enviando || loading} className="submit-btn" style={{marginTop: '20px', background:'#007bff'}}>
                  Continuar y Revisar
                </button>
              </div>
            )}
          </div>
        </form>
      )}

      {/* --- MODAL DE CONFIRMACIÓN (EL "NO SOY ROBOT") --- */}
      {showConfirmModal && (
        <div className="modal-overlay">
            <div className="modal-content confirm-modal">
                <h2 style={{color: '#ffc107', textAlign:'center'}}>⚠️ Confirmación Requerida</h2>
                
                <p style={{textAlign:'center', marginBottom:'20px'}}>
                    Para finalizar tu solicitud, es <b>obligatorio</b> que confirmes la lectura del reglamento.
                </p>

                <div className="security-check-box">
                    <label className="checkbox-container">
                        <input 
                            type="checkbox" 
                            checked={checkReglamento} 
                            onChange={(e) => setCheckReglamento(e.target.checked)} 
                        />
                        <span className="checkmark"></span>
                        <span className="check-text">
                            He leído y acepto el{' '}
                            <a 
                                href="PEGAR_AQUI_TU_ENLACE_DE_DRIVE" 
                                target="_blank" 
                                rel="noopener noreferrer"
                                style={{color:'#00aaff', textDecoration:'underline'}}
                            >
                                reglamento de préstamos
                            </a>
                            . <br/>
                            <small style={{color:'#aaa'}}>(Entiendo que soy responsable por daños o pérdidas)</small>
                        </span>
                    </label>
                </div>

                <div className="modal-actions">
                    <button type="button" className="btn-cancel" onClick={() => setShowConfirmModal(false)}>
                        Volver
                    </button>
                    <button 
                        type="button" 
                        className="btn-confirm" 
                        disabled={!checkReglamento || enviando} 
                        onClick={handleFinalSubmit}
                    >
                        {enviando ? 'Enviando...' : 'FINALIZAR SOLICITUD'}
                    </button>
                </div>
            </div>
        </div>
      )}

    </div>
  )
}

export default App