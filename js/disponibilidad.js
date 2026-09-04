import { FIREBASE_READY, auth, db } from "./firebase-config.js";
import { protegerPagina } from "./auth-guard.js";

let doc, getDoc, setDoc, serverTimestamp;
if (FIREBASE_READY) {
  ({ doc, getDoc, setDoc, serverTimestamp } = await import(
    "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js"
  ));
}

const form = document.getElementById('disponibilidadForm');
const fechaInput = document.getElementById('dispFecha');
const inicioInput = document.getElementById('dispInicio');
const finInput = document.getElementById('dispFin');
const activoInput = document.getElementById('dispActivo');
const estadoTexto = document.getElementById('dispEstadoTexto');
const guardarBtn = document.getElementById('dispGuardarBtn');
const saveMsg = document.getElementById('dispSaveMsg');

let uidActual = null;
let nombreActual = '';

function actualizarTextoEstado() {
  estadoTexto.textContent = activoInput.checked ? 'Disponible ahora' : 'Inactivo';
  estadoTexto.style.color = activoInput.checked ? 'var(--ok)' : 'var(--text-faint)';
}
activoInput.addEventListener('change', actualizarTextoEstado);

function ponerGuardando(cargando) {
  guardarBtn.disabled = cargando;
  guardarBtn.textContent = cargando ? 'Guardando...' : 'Guardar disponibilidad';
}

async function cargarDisponibilidad() {
  if (!FIREBASE_READY || !uidActual) return;
  const snap = await getDoc(doc(db, 'disponibilidad', uidActual));
  if (snap.exists()) {
    const datos = snap.data();
    fechaInput.value = datos.fecha || '';
    inicioInput.value = datos.horaInicio || '';
    finInput.value = datos.horaFin || '';
    activoInput.checked = !!datos.activo;
    actualizarTextoEstado();
  }
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  saveMsg.classList.remove('show');

  if (!fechaInput.value || !inicioInput.value || !finInput.value) {
    saveMsg.textContent = 'Completa fecha, hora de inicio y hora de finalización.';
    saveMsg.className = 'save-msg show bad';
    return;
  }

  if (finInput.value <= inicioInput.value) {
    saveMsg.textContent = 'La hora de finalización debe ser después de la hora de inicio.';
    saveMsg.className = 'save-msg show bad';
    return;
  }

  if (!FIREBASE_READY) {
    saveMsg.textContent = 'Firebase no está conectado todavía.';
    saveMsg.className = 'save-msg show bad';
    return;
  }

  ponerGuardando(true);
  try {
    await setDoc(doc(db, 'disponibilidad', uidActual), {
      alumnoId: uidActual,
      nombreAlumno: nombreActual,
      fecha: fechaInput.value,
      horaInicio: inicioInput.value,
      horaFin: finInput.value,
      activo: activoInput.checked,
      actualizadoEn: serverTimestamp()
    });
    saveMsg.textContent = 'Disponibilidad guardada.';
    saveMsg.className = 'save-msg show ok';
  } catch (err) {
    saveMsg.textContent = 'No se pudo guardar. Inténtalo de nuevo.';
    saveMsg.className = 'save-msg show bad';
  } finally {
    ponerGuardando(false);
  }
});

if (FIREBASE_READY) {
  protegerPagina(['alumno_servicio']).then(async ({ uid, datos }) => {
    uidActual = uid;
    nombreActual = datos.nombre || '';
    await cargarDisponibilidad();
  });
}