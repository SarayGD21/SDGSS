import { FIREBASE_READY, auth, db, COLECCION_EQUIPOS } from "./firebase-config.js";
import { protegerPagina } from "./auth-guard.js";
import { iniciarNotificaciones } from "./notificaciones.js";
import { iniciarPush } from "./push.js";

let signOut, collection, getDocs, query, where;
if (FIREBASE_READY) {
  ({ signOut } = await import(
    "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js"
  ));
  ({ collection, getDocs, query, where } = await import(
    "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js"
  ));
}

const saludo = document.getElementById('saludo');
const logoutBtn = document.getElementById('logoutBtn');
const listaMisEquipos = document.getElementById('listaMisEquipos');

function escaparHtml(texto) {
  const div = document.createElement('div');
  div.textContent = texto || '';
  return div.innerHTML;
}

async function cargarMisEquipos(uid) {
  const q = query(collection(db, COLECCION_EQUIPOS), where('responsableUid', '==', uid));
  const snap = await getDocs(q);

  if (snap.empty) {
    listaMisEquipos.innerHTML = '<p style="color:var(--text-muted); font-size:14px;">No tienes equipos asignados todavía.</p>';
    return;
  }

  const equipos = [];
  snap.forEach((docSnap) => equipos.push(docSnap.data()));

  listaMisEquipos.innerHTML = equipos.map(eq => `
    <div class="equipo-row">
      ${eq.fotoURL
        ? `<img class="equipo-foto" src="${eq.fotoURL}" alt="Foto del equipo">`
        : `<div class="equipo-foto-placeholder">Sin foto</div>`}
      <div style="flex:1;">
        <strong>${escaparHtml(eq.marca)} ${escaparHtml(eq.modelo)}</strong>
        <div style="color:var(--text-muted); font-size:13px; margin-top:2px;">
          Marbete: ${escaparHtml(eq.marbete)}${eq.numeroMaquina ? ' · Máquina ' + escaparHtml(eq.numeroMaquina) : ''}
        </div>
        <div style="color:var(--text-muted); font-size:13px;">
          ${escaparHtml(eq.ubicacion)}
        </div>
      </div>
    </div>
  `).join('');
}

protegerPagina(['personal_plantel']).then(async ({ uid, datos }) => {
  saludo.textContent = `Hola, ${datos.nombre || ''}.`;
  if (FIREBASE_READY) {
    await cargarMisEquipos(uid);
    await iniciarNotificaciones(uid, 'personal_plantel');
    await iniciarPush(uid, 'pushWidget');
  }
});

logoutBtn.addEventListener('click', async () => {
  if (FIREBASE_READY) await signOut(auth);
  window.location.href = 'login.html';
});