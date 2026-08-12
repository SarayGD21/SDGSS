// ============================================================
// firebase-config.js
// Configuración central de Firebase para el SGSS (CONALEP).
//
// Este archivo queda preparado para conectarse en cuanto exista
// el proyecto de Firebase real. Mientras tanto FIREBASE_READY
// es false y el login funciona en "modo simulación" para que
// puedas probar la interfaz sin romper nada.
//
// PASOS PARA ACTIVARLO CUANDO TENGAN EL PROYECTO DE FIREBASE:
//   1. Entra a https://console.firebase.google.com
//   2. Crea el proyecto (o usa uno existente) y agrega una
//      "app web".
//   3. Copia el objeto de configuración que te da Firebase y
//      reemplaza TODO el contenido de `firebaseConfig` de abajo.
//   4. En la consola de Firebase activa:
//        - Authentication -> Sign-in method -> Correo/Contraseña
//        - Firestore Database (modo producción)
//   5. Crea una colección "usuarios" en Firestore. Cada documento
//      debe tener como ID el UID del usuario (el mismo que genera
//      Authentication) y como mínimo este campo:
//        { rol: "estudiante" }   o   { rol: "admin" }
//   6. Cambia FIREBASE_READY a true, más abajo.
// ============================================================

// SDK modular de Firebase servido desde CDN (no requiere instalar nada).
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

// TODO: reemplazar por la configuración real del proyecto de Firebase.
const firebaseConfig = {
  apiKey: "TU_API_KEY",
  authDomain: "TU_PROYECTO.firebaseapp.com",
  projectId: "TU_PROYECTO",
  storageBucket: "TU_PROYECTO.appspot.com",
  messagingSenderId: "TU_SENDER_ID",
  appId: "TU_APP_ID"
};

// Cambia esto a `true` únicamente cuando ya hayas puesto tus
// credenciales reales arriba. Evita que la página intente
// conectarse a un proyecto que no existe.
export const FIREBASE_READY = false;

let app = null;
let auth = null;
let db = null;

if (FIREBASE_READY) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
}

export { app, auth, db };

// Nombre de la colección de Firestore donde vive el rol de cada usuario.
export const COLECCION_USUARIOS = "usuarios";

// A dónde redirigir según el rol guardado en Firestore.
// Ajusta estas rutas cuando tengan listos los paneles.
export const RUTAS_POR_ROL = {
  estudiante: "dashboard-estudiante.html",
  admin: "dashboard-admin.html"
};