import { FIREBASE_READY, db, COLECCION_SOLICITUDES, COLECCION_EQUIPOS } from "./firebase-config.js";
import { protegerPagina } from "./auth-guard.js";
import { poblarSelectTipos } from "./tipos-actividad.js";
import { crearNotificacion } from "./notificaciones.js";

let collection, getDocs, query, orderBy, where, doc, getDoc, updateDoc, addDoc, serverTimestamp;

if (FIREBASE_READY) {
  ({ collection, getDocs, query, orderBy, where, doc, getDoc, updateDoc, addDoc, serverTimestamp } = await import(
    "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js"
  ));
}

const listaSolicitudesEncargada = document.getElementById('listaSolicitudesEncargada');
const actividadForm = document.getElementById('actividadForm');
const actividadTipo = document.getElementById('actividadTipo');
const actividadEquipo = document.getElementById('actividadEquipo');
const actividadDescripcion = document.getElementById('actividadDescripcion');
const actividadComentarios = document.getElementById('actividadComentarios');
const actividadGuardarBtn = document.getElementById('actividadGuardarBtn');
const actividadMsg = document.getElementById('actividadMsg');

const modalAsignar = document.getElementById('modalAsignar');
const modalCerrarBtn = document.getElementById('modalCerrarBtn');
const modalDetalleActividad = document.getElementById('modalDetalleActividad');
const modalDetalleEquipo = document.getElementById('modalDetalleEquipo');
const modalListaAlumnos = document.getElementById('modalListaAlumnos');
const modalIndicaciones = document.getElementById('modalIndicaciones');
const modalAsignarBtn = document.getElementById('modalAsignarBtn');
const modalMsg = document.getElementById('modalMsg');

let miUid = null;
let miNombre = '';
let solicitudesCache = []; // última lista cargada, para abrir el modal sin volver a consultar
let actividadAbiertaId = null;

// El catálogo es contenido estático, se llena de una vez al cargar.
poblarSelectTipos(actividadTipo);

function escaparHtml(texto) {
  const div = document.createElement('div');
  div.textContent = texto || '';
  return div.innerHTML;
}

function formatearFecha(timestamp) {
  if (!timestamp || typeof timestamp.toDate !== 'function') return '';
  return timestamp.toDate().toLocaleString('es-MX', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

// --- Cargar todos los equipos para el selector (la encargada ve todos,
// no solo los suyos, a diferencia del selector del personal) ---
async function cargarEquiposParaSelector() {
  const snap = await getDocs(collection(db, COLECCION_EQUIPOS));

  const opciones = ['<option value="">No aplica / actividad general</option>'];
  snap.forEach((docSnap) => {
    const d = docSnap.data();
    opciones.push(`<option value="${docSnap.id}" data-marbete="${escaparHtml(d.marbete)}">${escaparHtml(d.marbete)} · ${escaparHtml(d.marca)} ${escaparHtml(d.modelo)}</option>`);
  });
  actividadEquipo.innerHTML = opciones.join('');
}

function mostrarMsgActividad(mensaje, ok) {
  actividadMsg.textContent = mensaje;
  actividadMsg.className = 'save-msg show ' + (ok ? 'ok' : 'bad');
}

function ponerGuardandoActividad(cargando) {
  actividadGuardarBtn.disabled = cargando;
  actividadGuardarBtn.textContent = cargando ? 'Creando...' : 'Crear actividad';
}

// --- Crear una actividad directamente (sin solicitud previa del personal) ---
actividadForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  actividadMsg.className = 'save-msg';

  const tipo = actividadTipo.value;
  const equipoId = actividadEquipo.value || null;
  const equipoMarbete = equipoId
    ? actividadEquipo.options[actividadEquipo.selectedIndex].dataset.marbete
    : null;
  const descripcion = actividadDescripcion.value.trim();
  const comentarios = actividadComentarios.value.trim();

  if (!tipo || !descripcion) {
    mostrarMsgActividad('Selecciona un tipo de actividad y agrega una descripción.', false);
    return;
  }

  ponerGuardandoActividad(true);
  try {
    const datos = {
      creadoPorUid: miUid,
      creadoPorNombre: miNombre,
      origen: 'encargada',
      tipo,
      equipoId,
      equipoMarbete,
      descripcion,
      comentarios,
      evidenciaURL: null,
      evidenciaPath: null,
      // La encargada no necesita aprobar su propia actividad: nace
      // ya aprobada, lista para asignarse en la siguiente fase.
      estado: 'aprobada',
      creadoEn: serverTimestamp()
    };

    await addDoc(collection(db, COLECCION_SOLICITUDES), datos);

    mostrarMsgActividad('Actividad creada.', true);
    actividadForm.reset();
    await cargarSolicitudesEncargada();
  } catch (err) {
    mostrarMsgActividad('No se pudo crear la actividad. Inténtalo de nuevo.', false);
  } finally {
    ponerGuardandoActividad(false);
  }
});

// --- Cargar y pintar todas las solicitudes del personal ---
async function cargarSolicitudesEncargada() {
  if (!listaSolicitudesEncargada) return;

  if (!FIREBASE_READY) {
    listaSolicitudesEncargada.innerHTML = '<p style="color:var(--text-muted); font-size:14px;">Firebase no está configurado todavía.</p>';
    return;
  }

  let snap;
  try {
    const q = query(collection(db, COLECCION_SOLICITUDES), orderBy('creadoEn', 'desc'));
    snap = await getDocs(q);
  } catch (err) {
    listaSolicitudesEncargada.innerHTML = '<p style="color:var(--text-muted); font-size:14px;">No se pudieron cargar las solicitudes. Inténtalo de nuevo.</p>';
    return;
  }

  if (snap.empty) {
    listaSolicitudesEncargada.innerHTML = '<p style="color:var(--text-muted); font-size:14px;">Aún no hay solicitudes del personal.</p>';
    return;
  }

  const solicitudes = [];
  snap.forEach((docSnap) => solicitudes.push({ id: docSnap.id, ...docSnap.data() }));
  solicitudesCache = solicitudes;

  listaSolicitudesEncargada.innerHTML = solicitudes.map(s => `
    <div class="solicitud-row" data-id="${s.id}" style="background:#ffffff; border:1px solid #cdeedd; border-radius:12px; padding:14px 16px;">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px;">
        <div>
          <strong>${escaparHtml(s.tipo)}</strong>
          <div style="color:var(--text-muted); font-size:13px; margin-top:2px;">
            ${s.origen === 'encargada' ? 'Creada directamente por ti' : 'Solicitada por ' + escaparHtml(s.creadoPorNombre)} · ${formatearFecha(s.creadoEn)}
          </div>
        </div>
        <span class="badge badge-${escaparHtml(s.estado)}">${escaparHtml(s.estado).replace('_', ' ')}</span>
      </div>

      ${s.equipoMarbete ? `<div style="color:var(--text-muted); font-size:13px; margin-top:8px;">Equipo: ${escaparHtml(s.equipoMarbete)}</div>` : ''}
      <div style="color:var(--text-muted); font-size:13.5px; margin-top:6px;">${escaparHtml(s.descripcion)}</div>
      ${s.comentarios ? `<div style="color:var(--text-faint); font-size:13px; margin-top:6px; font-style:italic;">"${escaparHtml(s.comentarios)}"</div>` : ''}
      ${s.evidenciaURL ? `<div style="margin-top:10px;"><a href="${s.evidenciaURL}" target="_blank" rel="noopener"><img src="${s.evidenciaURL}" alt="Evidencia" style="max-width:160px; border-radius:8px; display:block;"></a></div>` : ''}

      ${s.estado === 'pendiente' ? `
        <div style="display:flex; gap:8px; margin-top:12px;">
          <button type="button" class="btn-mini activar" data-id="${s.id}" data-nuevo-estado="aprobada">Aprobar</button>
          <button type="button" class="btn-mini desactivar" data-id="${s.id}" data-nuevo-estado="rechazada">Rechazar</button>
        </div>
      ` : ''}

      ${s.estado === 'aprobada' ? `
        <div style="margin-top:12px;">
          <button type="button" class="btn-mini guardar" data-abrir-modal="${s.id}">Asignar actividad</button>
        </div>
      ` : ''}

      ${['asignada', 'aceptada', 'en_proceso', 'completada', 'verificada'].includes(s.estado) ? `
        <div style="color:var(--text-muted); font-size:13px; margin-top:10px; padding-top:10px; border-top:1px solid var(--green-line);">
          <strong style="color:var(--text-main);">Asignada a:</strong> ${escaparHtml((s.alumnosAsignadosNombres || []).join(', '))}
          ${s.indicaciones ? `<div style="margin-top:4px; font-style:italic;">"${escaparHtml(s.indicaciones)}"</div>` : ''}
        </div>
      ` : ''}

      ${s.estado === 'completada' ? `
        <div style="margin-top:12px;">
          <button type="button" class="btn-mini activar" data-id="${s.id}" data-nuevo-estado="verificada">Verificar y cerrar</button>
        </div>
      ` : ''}
    </div>
  `).join('');

  listaSolicitudesEncargada.querySelectorAll('button[data-nuevo-estado]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const nuevoEstado = btn.dataset.nuevoEstado;
      const fila = btn.closest('.solicitud-row');
      fila.querySelectorAll('button').forEach(b => b.disabled = true);
      try {
        await updateDoc(doc(db, COLECCION_SOLICITUDES, id), { estado: nuevoEstado });
        await cargarSolicitudesEncargada();
      } catch (err) {
        fila.querySelectorAll('button').forEach(b => b.disabled = false);
        alert('No se pudo actualizar el estado de la solicitud. Inténtalo de nuevo.');
      }
    });
  });

  listaSolicitudesEncargada.querySelectorAll('button[data-abrir-modal]').forEach(btn => {
    btn.addEventListener('click', () => abrirModalAsignar(btn.dataset.abrirModal));
  });
}

// ---------- Modal de asignación ----------

// Misma regla de "vigencia" que usa el Inicio: un alumno solo cuenta
// como disponible si su horario declarado todavía no terminó.
function estaVigente(fecha, horaFin) {
  const ahora = new Date();
  const finDeclarado = new Date(`${fecha}T${horaFin}:00`);
  return finDeclarado >= ahora;
}

async function cargarAlumnosDisponiblesEnModal() {
  const q = query(collection(db, 'disponibilidad'), where('activo', '==', true));
  const snap = await getDocs(q);

  const vigentes = [];
  snap.forEach((docSnap) => {
    const d = docSnap.data();
    if (estaVigente(d.fecha, d.horaFin)) vigentes.push(d);
  });

  if (vigentes.length === 0) {
    modalListaAlumnos.innerHTML = '<p style="color:var(--text-muted); font-size:13px;">No hay alumnos disponibles en este momento.</p>';
    return;
  }

  modalListaAlumnos.innerHTML = vigentes.map(d => `
    <label class="alumno-check-row">
      <input type="checkbox" value="${d.alumnoId}" data-nombre="${escaparHtml(d.nombreAlumno || 'Alumno')}">
      <span>${escaparHtml(d.nombreAlumno || 'Alumno')} <span style="color:var(--text-faint);">· ${escaparHtml(d.fecha)} ${escaparHtml(d.horaInicio)}-${escaparHtml(d.horaFin)}</span></span>
    </label>
  `).join('');
}

async function abrirModalAsignar(id) {
  const actividad = solicitudesCache.find((s) => s.id === id);
  if (!actividad) return;

  actividadAbiertaId = id;
  modalMsg.className = 'save-msg';
  modalIndicaciones.value = '';

  modalDetalleActividad.innerHTML = `
    <div style="background:var(--bg-black); border:1px solid var(--green-line); border-radius:10px; padding:12px 14px;">
      <strong>${escaparHtml(actividad.tipo)}</strong>
      <div style="color:var(--text-muted); font-size:13px; margin-top:4px;">
        ${actividad.origen === 'encargada' ? 'Creada directamente por ti' : 'Solicitada por ' + escaparHtml(actividad.creadoPorNombre)}
      </div>
      <div style="color:var(--text-muted); font-size:13.5px; margin-top:8px;">${escaparHtml(actividad.descripcion)}</div>
      ${actividad.comentarios ? `<div style="color:var(--text-faint); font-size:13px; margin-top:6px; font-style:italic;">"${escaparHtml(actividad.comentarios)}"</div>` : ''}
    </div>
  `;

  if (actividad.equipoId) {
    modalDetalleEquipo.innerHTML = '<p style="color:var(--text-muted); font-size:13px;">Cargando equipo...</p>';
    try {
      const snapEquipo = await getDoc(doc(db, COLECCION_EQUIPOS, actividad.equipoId));
      if (snapEquipo.exists()) {
        const eq = snapEquipo.data();
        modalDetalleEquipo.innerHTML = `
          <div class="equipo-detalle">
            ${eq.fotoURL
              ? `<img class="equipo-foto" src="${eq.fotoURL}" alt="Foto del equipo">`
              : `<div class="equipo-foto-placeholder">Sin foto</div>`}
            <div>
              <strong>${escaparHtml(eq.marca)} ${escaparHtml(eq.modelo)}</strong>
              <div style="color:var(--text-muted); font-size:13px; margin-top:2px;">
                Marbete: ${escaparHtml(eq.marbete)}${eq.numeroMaquina ? ' · Máquina ' + escaparHtml(eq.numeroMaquina) : ''}
              </div>
              <div style="color:var(--text-muted); font-size:13px;">
                ${escaparHtml(eq.ubicacion)} · Responsable: ${escaparHtml(eq.responsableNombre)}
              </div>
            </div>
          </div>
        `;
      } else {
        modalDetalleEquipo.innerHTML = '';
      }
    } catch (err) {
      modalDetalleEquipo.innerHTML = '<p style="color:var(--text-muted); font-size:13px;">No se pudo cargar el equipo.</p>';
    }
  } else {
    modalDetalleEquipo.innerHTML = '<p style="color:var(--text-faint); font-size:13px;">Actividad general, sin equipo asociado.</p>';
  }

  modalListaAlumnos.innerHTML = '<p style="color:var(--text-muted); font-size:13px;">Cargando...</p>';
  modalAsignar.style.display = 'flex';
  await cargarAlumnosDisponiblesEnModal();
}

function cerrarModalAsignar() {
  modalAsignar.style.display = 'none';
  actividadAbiertaId = null;
}

modalCerrarBtn.addEventListener('click', cerrarModalAsignar);
modalAsignar.addEventListener('click', (e) => {
  if (e.target === modalAsignar) cerrarModalAsignar(); // clic fuera de la tarjeta
});

modalAsignarBtn.addEventListener('click', async () => {
  if (!actividadAbiertaId) return;
  modalMsg.className = 'save-msg';

  const seleccionados = Array.from(modalListaAlumnos.querySelectorAll('input[type="checkbox"]:checked'));
  if (seleccionados.length === 0) {
    modalMsg.textContent = 'Selecciona al menos un alumno.';
    modalMsg.className = 'save-msg show bad';
    return;
  }

  const alumnosAsignadosUids = seleccionados.map((chk) => chk.value);
  const alumnosAsignadosNombres = seleccionados.map((chk) => chk.dataset.nombre);
  const indicaciones = modalIndicaciones.value.trim();
  const actividad = solicitudesCache.find((s) => s.id === actividadAbiertaId);

  modalAsignarBtn.disabled = true;
  modalAsignarBtn.textContent = 'Asignando...';
  try {
    await updateDoc(doc(db, COLECCION_SOLICITUDES, actividadAbiertaId), {
      estado: 'asignada',
      alumnosAsignadosUids,
      alumnosAsignadosNombres,
      indicaciones,
      asignadoPorUid: miUid,
      asignadoEn: serverTimestamp()
    });

    alumnosAsignadosUids.forEach((alumnoUid) => {
      crearNotificacion({
        paraUid: alumnoUid,
        tipo: 'actividad_asignada',
        mensaje: `Se te ha asignado una nueva actividad: ${actividad?.tipo || ''}.`,
        solicitudId: actividadAbiertaId,
        creadaPorUid: miUid
      });
    });

    cerrarModalAsignar();
    await cargarSolicitudesEncargada();
  } catch (err) {
    modalMsg.textContent = 'No se pudo asignar la actividad. Inténtalo de nuevo.';
    modalMsg.className = 'save-msg show bad';
  } finally {
    modalAsignarBtn.disabled = false;
    modalAsignarBtn.textContent = 'Asignar actividad';
  }
});

protegerPagina(['encargada']).then(async ({ uid, datos }) => {
  miUid = uid;
  miNombre = datos.nombre || '';
  await cargarEquiposParaSelector();
  await cargarSolicitudesEncargada();
});
