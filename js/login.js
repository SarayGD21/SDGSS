// ============================================================
// login.js
// Controla el formulario de inicio de sesión de login.html.
//
// Usa Firebase Authentication (correo + contraseña) y, tras
// autenticar, busca el documento del usuario en Firestore
// (colección "usuarios", doc = uid) para leer su "rol"
// ("estudiante" o "admin") y redirigirlo al panel correcto.
//
// Mientras FIREBASE_READY sea false en firebase-config.js, este
// archivo NO intenta conectarse a Firebase: solo avisa que falta
// configurar el proyecto, para que puedas revisar el diseño y el
// comportamiento del formulario sin errores de consola.
// ============================================================

import {
  FIREBASE_READY,
  auth,
  db,
  COLECCION_USUARIOS,
  RUTAS_POR_ROL
} from "./firebase-config.js";

// Estas importaciones solo se usan si FIREBASE_READY es true,
// pero se dejan listas para no tener que tocar nada más después.
let signInWithEmailAndPassword, doc, getDoc;
if (FIREBASE_READY) {
  ({ signInWithEmailAndPassword } = await import(
    "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js"
  ));
  ({ doc, getDoc } = await import(
    "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js"
  ));
}

const form = document.getElementById("loginForm");
const correoInput = document.getElementById("correo");
const passwordInput = document.getElementById("password");
const submitBtn = document.getElementById("submitBtn");
const errorBanner = document.getElementById("errorBanner");
const errorBannerMsg = document.getElementById("errorBannerMsg");
const configBanner = document.getElementById("configBanner");

// Muestra el aviso de "Firebase aún no configurado" si aplica.
if (!FIREBASE_READY && configBanner) {
  configBanner.classList.add("show");
}

document.querySelectorAll(".toggle-pw").forEach((btn) => {
  btn.addEventListener("click", () => {
    const target = document.getElementById(btn.dataset.target);
    const isPw = target.type === "password";
    target.type = isPw ? "text" : "password";
    btn.setAttribute("aria-label", isPw ? "Ocultar contraseña" : "Mostrar contraseña");
    btn.querySelector(".eye").style.opacity = isPw ? "0.55" : "1";
  });
});

function setError(field, hasError) {
  const el = document.querySelector(`[data-field="${field}"]`);
  if (el) el.classList.toggle("error", hasError);
}

function mostrarErrorGeneral(mensaje) {
  errorBannerMsg.textContent = mensaje;
  errorBanner.classList.add("show");
  errorBanner.scrollIntoView({ behavior: "smooth", block: "center" });
}

function ocultarErrorGeneral() {
  errorBanner.classList.remove("show");
}

// Traduce los códigos de error de Firebase Auth a mensajes
// entendibles para el usuario final.
function mensajeDeError(codigo) {
  switch (codigo) {
    case "auth/invalid-email":
      return "El correo no tiene un formato válido.";
    case "auth/user-disabled":
      return "Esta cuenta ha sido deshabilitada. Contacta al administrador.";
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Correo o contraseña incorrectos.";
    case "auth/too-many-requests":
      return "Demasiados intentos. Espera unos minutos e inténtalo de nuevo.";
    default:
      return "No se pudo iniciar sesión. Inténtalo de nuevo.";
  }
}

function ponerCargando(cargando) {
  submitBtn.disabled = cargando;
  submitBtn.textContent = cargando ? "Ingresando..." : "Iniciar sesión";
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  ocultarErrorGeneral();

  const correo = correoInput.value.trim();
  const password = passwordInput.value;

  let valid = true;

  const correoOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo);
  setError("correo", !correoOk);
  if (!correoOk) valid = false;

  const passwordOk = password.length >= 8;
  setError("password", !passwordOk);
  if (!passwordOk) valid = false;

  if (!valid) {
    const firstError = document.querySelector(".field.error");
    if (firstError) firstError.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }

  // Firebase todavía no está conectado: no intentamos autenticar.
  if (!FIREBASE_READY) {
    mostrarErrorGeneral(
      "El inicio de sesión aún no está conectado a Firebase. Configura /js/firebase-config.js para activarlo."
    );
    return;
  }

  ponerCargando(true);
  try {
    const credencial = await signInWithEmailAndPassword(auth, correo, password);
    const uid = credencial.user.uid;

    const refUsuario = doc(db, COLECCION_USUARIOS, uid);
    const snapUsuario = await getDoc(refUsuario);

    if (!snapUsuario.exists()) {
      mostrarErrorGeneral(
        "Tu cuenta no tiene un rol asignado todavía. Contacta al administrador del SGSS."
      );
      ponerCargando(false);
      return;
    }

    const { rol } = snapUsuario.data();
    const destino = RUTAS_POR_ROL[rol];

    if (!destino) {
      mostrarErrorGeneral("Tu rol de usuario no es válido. Contacta al administrador.");
      ponerCargando(false);
      return;
    }

    window.location.href = destino;
  } catch (err) {
    mostrarErrorGeneral(mensajeDeError(err.code));
    ponerCargando(false);
  }
});