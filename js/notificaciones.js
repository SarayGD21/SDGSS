// Notificaciones internas (Fase 11).
//
// Este archivo se usa desde las tres pantallas (personal, encargada,
// alumno). Expone dos cosas:
//   - crearNotificacion(...): la llaman otras pantallas justo después de
//     la acción que merece avisar a alguien.
//   - iniciarNotificaciones(uid, rol): pinta la campanita 🔔 dentro de
//     un <div id="notifWidget"> que cada página ya tiene en su header.

import { FIREBASE_READY, db, COLECCION_NOTIFICACIONES } from "./firebase-config.js";

let collection, getDocs, query, where, doc, updateDoc, addDoc, serverTimestamp;

if (FIREBASE_READY) {
  ({ collection, getDocs, query, where, doc, updateDoc, addDoc, serverTimestamp } = await import(
    "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js"
  ));
}

function escaparHtml(texto) {
  const div = document.createElement('div');
  div.textContent = texto || '';
  return div.innerHTML;
}

function formatearFecha(timestamp) {
  if (!timestamp || typeof timestamp.toDate !== 'function') return '';
  return timestamp.toDate().toLocaleString('es-MX', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
  });
}

// Se llama desde otras pantallas justo después de crear una solicitud,
// asignar una actividad, o completarla. Si falla, no debe tumbar la
// acción principal (por eso nunca lanza el error hacia quien la llama).
export async function crearNotificacion({ paraUid = null, paraRol = null, tipo, mensaje, solicitudId = null, creadaPorUid }) {
  if (!FIREBASE_READY) return;
  try {
    await addDoc(collection(db, COLECCION_NOTIFICACIONES), {
      paraUid,
      paraRol,
      tipo,
      mensaje,
      solicitudId,
      creadaPorUid,
      leida: false,
      creadaEn: serverTimestamp()
    });
  } catch (err) {
    console.warn('No se pudo crear la notificación:', err);
  }
}

// Pinta la campanita + panel desplegable dentro de #notifWidget.
export async function iniciarNotificaciones(uid, rol) {
  const contenedor = document.getElementById('notifWidget');
  if (!contenedor || !FIREBASE_READY) return;

  contenedor.innerHTML = `
    <div style="position:relative;">
      <button type="button" id="notifBtn" title="Notificaciones"
        style="position:relative; background:transparent; border:1.5px solid var(--green-line); color:var(--text-muted); width:38px; height:38px; border-radius:999px; display:flex; align-items:center; justify-content:center; font-size:16px; cursor:pointer;">
        🔔
        <span id="notifContador"
          style="display:none; position:absolute; top:-4px; right:-4px; background:var(--danger); color:#fff; font-size:10px; font-weight:700; min-width:16px; height:16px; border-radius:999px; align-items:center; justify-content:center; padding:0 3px; line-height:1;"></span>
      </button>
      <div id="notifPanel"
        style="display:none; position:absolute; right:0; top:46px; width:300px; max-height:360px; overflow-y:auto; background:var(--bg-panel); border:1px solid var(--green-line); border-radius:12px; padding:8px; z-index:60; box-shadow:0 10px 30px rgba(0,0,0,0.4);"></div>
    </div>
  `;

  const notifBtn = document.getElementById('notifBtn');
  const notifPanel = document.getElementById('notifPanel');
  const notifContador = document.getElementById('notifContador');

  async function cargar() {
    const consultas = [getDocs(query(collection(db, COLECCION_NOTIFICACIONES), where('paraUid', '==', uid)))];
    if (rol === 'encargada') {
      consultas.push(getDocs(query(collection(db, COLECCION_NOTIFICACIONES), where('paraRol', '==', 'encargada'))));
    }

    let resultados;
    try {
      resultados = await Promise.all(consultas);
    } catch (err) {
      notifPanel.innerHTML = '<p style="color:var(--text-muted); font-size:13px; padding:8px;">No se pudieron cargar tus notificaciones.</p>';
      return;
    }

    const notifs = [];
    resultados.forEach((snap) => snap.forEach((docSnap) => notifs.push({ id: docSnap.id, ...docSnap.data() })));
    notifs.sort((a, b) => (b.creadaEn?.toMillis?.() || 0) - (a.creadaEn?.toMillis?.() || 0));

    const noLeidas = notifs.filter((n) => !n.leida).length;
    notifContador.style.display = noLeidas > 0 ? 'flex' : 'none';
    notifContador.textContent = noLeidas > 9 ? '9+' : String(noLeidas);

    if (notifs.length === 0) {
      notifPanel.innerHTML = '<p style="color:var(--text-muted); font-size:13px; padding:8px;">No tienes notificaciones.</p>';
      return;
    }

    notifPanel.innerHTML = notifs.map((n) => `
      <div class="notif-item" data-id="${n.id}" data-leida="${n.leida}"
        style="padding:10px; border-radius:8px; margin-bottom:4px; cursor:pointer; background:${n.leida ? 'transparent' : 'rgba(61,220,132,0.08)'};">
        <div style="font-size:13px; color:var(--text-main);">${escaparHtml(n.mensaje)}</div>
        <div style="font-size:11px; color:var(--text-faint); margin-top:3px;">${formatearFecha(n.creadaEn)}</div>
      </div>
    `).join('');

    notifPanel.querySelectorAll('.notif-item').forEach((el) => {
      el.addEventListener('click', async () => {
        if (el.dataset.leida === 'true') return;
        try {
          await updateDoc(doc(db, COLECCION_NOTIFICACIONES, el.dataset.id), { leida: true });
          await cargar();
        } catch (err) {
          // No es crítico si falla marcarla como leída.
        }
      });
    });
  }

  notifBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    const abrir = notifPanel.style.display === 'none';
    notifPanel.style.display = abrir ? 'block' : 'none';
    if (abrir) await cargar();
  });

  document.addEventListener('click', (e) => {
    if (!contenedor.contains(e.target)) notifPanel.style.display = 'none';
  });

  await cargar();
}
