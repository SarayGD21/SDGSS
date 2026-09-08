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

let getMessaging, getToken, isSupported, onMessage;
let doc, updateDoc, arrayUnion;

// Evita registrar el listener de primer plano más de una vez si
// iniciarPush() llegara a correr dos veces en la misma pestaña.
let listenerForegroundActivo = false;

async function cargarLibrerias() {
  ({ getMessaging, getToken, isSupported, onMessage } = await import(
    "https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging.js"
  ));
  ({ doc, updateDoc, arrayUnion } = await import(
    "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js"
  ));
}

// Cuando la pestaña del sistema SÍ está al frente, Firebase no pasa por
// el service worker (por eso firebase-messaging-sw.js no basta): manda
// el mensaje directo aquí, a la página. Si no hacemos nada con él, el
// aviso "se pierde" para efectos de notificación visible del sistema
// (aunque ya haya quedado guardado en Firestore por notificaciones.js).
function activarListenerForeground(messaging) {
  if (listenerForegroundActivo) return;
  listenerForegroundActivo = true;

  onMessage(messaging, (payload) => {
    const titulo = (payload.notification && payload.notification.title) || 'SGSS';
    const cuerpo = (payload.notification && payload.notification.body) || '';

    if (Notification.permission !== 'granted') return;

    // Se muestra vía el service worker (más consistente entre navegadores
    // que "new Notification(...)" directo desde la página).
    navigator.serviceWorker.ready.then((registro) => {
      registro.showNotification(titulo, { body: cuerpo });
    });
  });
}

async function registrarToken(uid) {
  try {
    const registro = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    const messaging = getMessaging();
    const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: registro });
    if (token) {
      await updateDoc(doc(db, COLECCION_USUARIOS, uid), { tokensFCM: arrayUnion(token) });
      activarListenerForeground(messaging);
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
