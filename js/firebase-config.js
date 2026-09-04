
// SDK modular de Firebase servido desde CDN (no requiere instalar nada).
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-storage.js";

export const firebaseConfig = {
  apiKey: "AIzaSyAgh9R7KKRfc4Hgwg2A6LoMfWiFS3COM4c",
  authDomain: "sgss-ff34e.firebaseapp.com",
  databaseURL: "https://sgss-ff34e-default-rtdb.firebaseio.com",
  projectId: "sgss-ff34e",
  storageBucket: "sgss-ff34e.firebasestorage.app",
  messagingSenderId: "923896049867",
  appId: "1:923896049867:web:926d0cf0db129ec80f2b4e",
  measurementId: "G-TXDT0FFM3X"
};

// Ya tenemos las credenciales reales del proyecto, así que activamos Firebase.
export const FIREBASE_READY = true;

let app = null;
let auth = null;
let db = null;
let storage = null;

if (FIREBASE_READY) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);
}

export { app, auth, db, storage };

// Nombre de la colección de Firestore donde vive el rol de cada usuario.
export const COLECCION_USUARIOS = "usuarios";

// Nombre de la colección de Firestore donde viven los equipos del plantel.
export const COLECCION_EQUIPOS = "equipos";


export const RUTAS_POR_ROL = {
  alumno_servicio: "profile.html",
  encargada: "dashboard-encargada.html",
  personal_plantel: "dashboard-personal.html"
};
// Nombre de la colección de Firestore donde viven las solicitudes del personal.
export const COLECCION_SOLICITUDES = "solicitudes";

// Nombre de la colección de Firestore donde viven las notificaciones (Fase 11).
export const COLECCION_NOTIFICACIONES = "notificaciones";