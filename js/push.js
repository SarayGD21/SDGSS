// Activación de notificaciones push en el dispositivo (Fase 12).
//
// Esto NO reemplaza js/notificaciones.js (esa sigue siendo la campanita
// interna). Esto solo se encarga de: pedir permiso al navegador, obtener
// el "token" de este dispositivo, y guardarlo en Firestore para que el
// servidor sepa a dónde mandarle el push más adelante.

import { db, COLECCION_USUARIOS } from "./firebase-config.js";

// Clave pública VAPID del proyecto (Firebase Console → Cloud Messaging →
// Certificados push web). No es secreta: solo identifica el remitente.
const VAPID_KEY = "BB1F8LfObCBpaSd1kjbym-J6Ub6QsjXfYjzW9Bf_Btr8s0Qo4stV_Fw0mkDr1QlY_f0FOA0SKcRu7OUDnBDSLxY";

let getMessaging, getToken, onMessage, isSupported;
let doc, updateDoc, arrayUnion;

async function cargarLibrerias() {
  ({ getMessaging, getToken, onMessage, isSupported } = await import(
    "https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging.js"
  ));
  ({ doc, updateDoc, arrayUnion } = await import(
    "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js"
  ));
}

// El service worker (firebase-messaging-sw.js) solo recibe el push
// cuando la pestaña NO está al frente. Si el usuario tiene el sistema
// abierto y enfocado en ese momento, el aviso llega por acá en cambio;
// por eso mostramos la notificación del sistema "a mano" con la misma
// info. La campanita interna (js/notificaciones.js) ya se actualiza
// sola vía Firestore en tiempo real; esto es solo el aviso del sistema.
function escucharEnPrimerPlano(messaging) {
  onMessage(messaging, (payload) => {
    const titulo = (payload.notification && payload.notification.title) || 'SGSS';
    const cuerpo = (payload.notification && payload.notification.body) || '';
    if (Notification.permission === 'granted') {
      new Notification(titulo, { body: cuerpo });
    }
  });
}

async function registrarToken(uid) {
  try {
    const registro = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    const messaging = getMessaging();
    const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: registro });
    if (token) {
      await updateDoc(doc(db, COLECCION_USUARIOS, uid), { tokensFCM: arrayUnion(token) });
      escucharEnPrimerPlano(messaging);
    }
    return !!token;
  } catch (err) {
    console.warn('No se pudo activar el push en este dispositivo:', err);
    return false;
  }
}

// Pinta (si aplica) un botón "Activar avisos en este dispositivo" dentro
// del contenedor indicado. No hace nada si el navegador no soporta push
// (p. ej. Safari en pestaña normal de iPhone) o si el usuario ya lo
// rechazó antes.
export async function iniciarPush(uid, contenedorId) {
  const contenedor = document.getElementById(contenedorId);
  if (!contenedor) return;

  if (!('Notification' in window) || !('serviceWorker' in navigator)) return;

  await cargarLibrerias();

  const soportado = await isSupported().catch(() => false);
  if (!soportado) return;

  if (Notification.permission === 'granted') {
    // Ya tiene permiso; solo nos aseguramos de tener guardado el token de
    // este dispositivo, sin mostrarle ningún botón.
    await registrarToken(uid);
    return;
  }

  if (Notification.permission === 'denied') return; // ya lo rechazó antes

  contenedor.innerHTML = `
    <button type="button" id="activarPushBtn" class="btn-mini" style="font-size:12px; padding:6px 12px;">
      🔔 Activar avisos en este dispositivo
    </button>
  `;

  document.getElementById('activarPushBtn').addEventListener('click', async () => {
    const permiso = await Notification.requestPermission();
    if (permiso === 'granted') {
      const ok = await registrarToken(uid);
      contenedor.innerHTML = ok
        ? '<span style="font-size:12px; color:var(--text-muted);">Avisos activados ✓</span>'
        : '<span style="font-size:12px; color:var(--text-muted);">No se pudo activar. Inténtalo de nuevo.</span>';
    }
  });
}
