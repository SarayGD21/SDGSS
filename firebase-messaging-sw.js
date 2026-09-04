// Service worker de Firebase Cloud Messaging (Fase 12).
//
// Este archivo DEBE vivir en la raíz del sitio (no dentro de /js), porque
// el navegador solo deja que un service worker controle las rutas que
// están a su mismo nivel o por debajo.
//
// No puede usar "import" (los service workers de Firebase Messaging usan
// el SDK clásico "compat"), por eso aquí se ve distinto al resto del
// proyecto.

importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging-compat.js');

// Mismas credenciales públicas que usa el resto del sistema
// (js/firebase-config.js). No son secretas: identifican el proyecto,
// no dan acceso a nada por sí solas.
firebase.initializeApp({
  apiKey: "AIzaSyAgh9R7KKRfc4Hgwg2A6LoMfWiFS3COM4c",
  authDomain: "sgss-ff34e.firebaseapp.com",
  projectId: "sgss-ff34e",
  storageBucket: "sgss-ff34e.firebasestorage.app",
  messagingSenderId: "923896049867",
  appId: "1:923896049867:web:926d0cf0db129ec80f2b4e"
});

const messaging = firebase.messaging();

// Se dispara cuando llega un push y la pestaña del sistema NO está al frente.
messaging.onBackgroundMessage((payload) => {
  const titulo = (payload.notification && payload.notification.title) || 'SGSS';
  const cuerpo = (payload.notification && payload.notification.body) || '';
  self.registration.showNotification(titulo, { body: cuerpo });
});
