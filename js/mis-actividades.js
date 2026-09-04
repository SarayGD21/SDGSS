import { FIREBASE_READY, db, COLECCION_SOLICITUDES, COLECCION_EQUIPOS } from "./firebase-config.js";
import { protegerPagina } from "./auth-guard.js";
import { crearNotificacion } from "./notificaciones.js";

let collection, getDocs, query, where, doc, getDoc, updateDoc;

if (FIREBASE_READY) {
  ({ collection, getDocs, query, where, doc, getDoc, updateDoc } = await import(
    "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js"
  ));
}

const listaMisActividades = document.getElementById('listaMisActividades');

let miUid = null;
const cacheEquipos = {}; // equipoId -> datos del equipo, para no repetir consultas

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

// Texto y siguiente estado según en qué paso vaya la actividad.
const SIGUIENTE_PASO = {
  asignada: { siguiente: 'aceptada', texto: 'Aceptar actividad' },
  aceptada: { siguiente: 'en_proceso', texto: 'Iniciar actividad' },
  en_proceso: { siguiente: 'completada', texto: 'Marcar como completada' }
};

async function obtenerEquipo(equipoId) {
  if (cacheEquipos[equipoId]) return cacheEquipos[equipoId];
  try {
    const snap = await getDoc(doc(db, COLECCION_EQUIPOS, equipoId));
    cacheEquipos[equipoId] = snap.exists() ? snap.data() : null;
  } catch (err) {
    cacheEquipos[equipoId] = null;
  }
  return cacheEquipos[equipoId];
}

async function cargarMisActividades() {
  if (!listaMisActividades) return;

  if (!FIREBASE_READY) {
    listaMisActividades.innerHTML = '<p style="color:var(--text-muted); font-size:14px;">Firebase no está configurado todavía.</p>';
    return;
  }

  // Consulta acotada a las actividades donde YO estoy asignado (así lo
  // exigen también las reglas de Firestore: solo se pueden leer estos
  // documentos si el propio uid está en alumnosAsignadosUids).
  const q = query(collection(db, COLECCION_SOLICITUDES), where('alumnosAsignadosUids', 'array-contains', miUid));

  let snap;
  try {
    snap = await getDocs(q);
  } catch (err) {
    listaMisActividades.innerHTML = '<p style="color:var(--text-muted); font-size:14px;">No se pudieron cargar tus actividades. Inténtalo de nuevo.</p>';
    return;
  }

  if (snap.empty) {
    listaMisActividades.innerHTML = '<p style="color:var(--text-muted); font-size:14px;">Aún no tienes actividades asignadas.</p>';
    return;
  }

  const actividades = [];
  snap.forEach((docSnap) => actividades.push({ id: docSnap.id, ...docSnap.data() }));

  // Más recientes primero, sin depender de un índice compuesto.
  actividades.sort((a, b) => (b.creadoEn?.toMillis?.() || 0) - (a.creadoEn?.toMillis?.() || 0));

  listaMisActividades.innerHTML = actividades.map(a => `
    <div class="actividad-row" data-id="${a.id}">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px;">
        <div>
          <strong>${escaparHtml(a.tipo)}</strong>
          <div style="color:var(--text-muted); font-size:13px; margin-top:2px;">
            ${a.origen === 'encargada' ? 'Creada por la encargada' : 'Solicitada por ' + escaparHtml(a.creadoPorNombre)} · ${formatearFecha(a.creadoEn)}
          </div>
        </div>
        <span class="badge badge-${escaparHtml(a.estado)}">${escaparHtml(a.estado).replace('_', ' ')}</span>
      </div>

      <div style="color:var(--text-muted); font-size:13.5px; margin-top:8px;">${escaparHtml(a.descripcion)}</div>
      ${a.indicaciones ? `<div style="color:var(--text-faint); font-size:13px; margin-top:6px; font-style:italic;">Indicaciones: "${escaparHtml(a.indicaciones)}"</div>` : ''}

      <div class="equipo-info" data-equipo-id="${a.equipoId || ''}" style="margin-top:8px;"></div>

      <div class="acciones" style="margin-top:12px;"></div>
    </div>
  `).join('');

  // Para cada tarjeta: si tiene equipo, pintamos su ficha; si tiene un
  // paso disponible, pintamos el botón correspondiente.
  listaMisActividades.querySelectorAll('.actividad-row').forEach((fila) => {
    const id = fila.dataset.id;
    const actividad = actividades.find((a) => a.id === id);

    const equipoInfoDiv = fila.querySelector('.equipo-info');
    if (actividad.equipoId) {
      obtenerEquipo(actividad.equipoId).then((eq) => {
        if (!eq) return;
        equipoInfoDiv.innerHTML = `
          <div style="color:var(--text-muted); font-size:13px;">
            Equipo: ${escaparHtml(eq.marbete)} · ${escaparHtml(eq.marca)} ${escaparHtml(eq.modelo)} · ${escaparHtml(eq.ubicacion)}
          </div>
        `;
      });
    }

    const paso = SIGUIENTE_PASO[actividad.estado];
    const accionesDiv = fila.querySelector('.acciones');
    if (paso) {
      accionesDiv.innerHTML = `<button type="button" class="btn-mini activar" data-avanzar="${id}" data-nuevo-estado="${paso.siguiente}">${paso.texto}</button>`;
    }
  });

  listaMisActividades.querySelectorAll('button[data-avanzar]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.avanzar;
      const nuevoEstado = btn.dataset.nuevoEstado;
      btn.disabled = true;
      btn.textContent = 'Guardando...';
      try {
        await updateDoc(doc(db, COLECCION_SOLICITUDES, id), { estado: nuevoEstado });

        if (nuevoEstado === 'completada') {
          const actividad = actividades.find((a) => a.id === id);
          crearNotificacion({
            paraRol: 'encargada',
            tipo: 'actividad_completada',
            mensaje: `La actividad "${actividad?.tipo || ''}"${actividad?.equipoMarbete ? ' (' + actividad.equipoMarbete + ')' : ''} fue marcada como completada.`,
            solicitudId: id,
            creadaPorUid: miUid
          });
        }

        await cargarMisActividades();
      } catch (err) {
        btn.disabled = false;
        alert('No se pudo actualizar la actividad. Inténtalo de nuevo.');
      }
    });
  });
}

if (FIREBASE_READY) {
  protegerPagina(['alumno_servicio']).then(async ({ uid }) => {
    miUid = uid;
    await cargarMisActividades();
  });
}
