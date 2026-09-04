
import { FIREBASE_READY, auth, db, COLECCION_USUARIOS } from "./firebase-config.js";
import { protegerPagina } from "./auth-guard.js";
import { iniciarNotificaciones } from "./notificaciones.js";


let onAuthStateChanged, signOut, doc, getDoc, updateDoc;
if (FIREBASE_READY) {
  ({ onAuthStateChanged, signOut } = await import(
    "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js"
  ));
  ({ doc, getDoc, updateDoc } = await import(
    "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js"
  ));
}

const loadingState = document.getElementById('loadingState');
const profileContent = document.getElementById('profileContent');
const configBanner = document.getElementById('configBanner');

const avatarImg = document.getElementById('avatarImg');
const avatarPlaceholder = document.getElementById('avatarPlaceholder');
const avatarEditBtn = document.getElementById('avatarEditBtn');
const fileInput = document.getElementById('fileInput');

const nombreInput = document.getElementById('nombre');
const institucionInput = document.getElementById('institucion');
const carreraInput = document.getElementById('carrera');
const correoInput = document.getElementById('correo');

const form = document.getElementById('profileForm');
const saveBtn = document.getElementById('saveBtn');
const saveMsg = document.getElementById('saveMsg');
const logoutBtn = document.getElementById('logoutBtn');

let uidActual = null;
let fotoBase64Pendiente = null; // null = sin cambios; string = nueva foto lista para guardar

function mostrarContenido() {
  loadingState.style.display = 'none';
  profileContent.classList.add('show');
}

function pintarAvatar(base64, nombre) {
  if (base64) {
    avatarImg.src = base64;
    avatarImg.style.display = 'block';
    avatarPlaceholder.style.display = 'none';
  } else {
    avatarImg.style.display = 'none';
    avatarPlaceholder.style.display = 'flex';
    avatarPlaceholder.textContent = (nombre || '?').trim().charAt(0).toUpperCase() || '?';
  }
}

// Redimensiona/comprime la imagen elegida a un cuadro de 320x320
// y la convierte a JPEG en base64, para no guardar archivos pesados.
function procesarImagen(file) {
  return new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onerror = () => reject(new Error('No se pudo leer la imagen.'));
    lector.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('El archivo no es una imagen válida.'));
      img.onload = () => {
        const tam = 320;
        const canvas = document.createElement('canvas');
        canvas.width = tam;
        canvas.height = tam;
        const ctx = canvas.getContext('2d');

        // Recorte centrado tipo "cover"
        const lado = Math.min(img.width, img.height);
        const sx = (img.width - lado) / 2;
        const sy = (img.height - lado) / 2;
        ctx.drawImage(img, sx, sy, lado, lado, 0, 0, tam, tam);

        resolve(canvas.toDataURL('image/jpeg', 0.72));
      };
      img.src = lector.result;
    };
    lector.readAsDataURL(file);
  });
}

avatarEditBtn.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', async () => {
  const file = fileInput.files[0];
  if (!file) return;

  if (!file.type.startsWith('image/')) {
    saveMsg.textContent = 'Elige un archivo de imagen válido.';
    saveMsg.className = 'save-msg show bad';
    return;
  }

  try {
    const base64 = await procesarImagen(file);
    fotoBase64Pendiente = base64;
    pintarAvatar(base64, nombreInput.value);
    saveMsg.textContent = 'Foto lista. No olvides guardar cambios.';
    saveMsg.className = 'save-msg show ok';
  } catch (err) {
    saveMsg.textContent = err.message || 'No se pudo procesar la imagen.';
    saveMsg.className = 'save-msg show bad';
  }
});

function ponerGuardando(cargando) {
  saveBtn.disabled = cargando;
  saveBtn.textContent = cargando ? 'Guardando...' : 'Guardar cambios';
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  saveMsg.classList.remove('show');

  if (!nombreInput.value.trim() || !institucionInput.value.trim() || !carreraInput.value) {
    saveMsg.textContent = 'Completa todos los campos antes de guardar.';
    saveMsg.className = 'save-msg show bad';
    return;
  }

  if (!FIREBASE_READY) {
    saveMsg.textContent = 'Firebase no está conectado todavía: no se puede guardar de verdad.';
    saveMsg.className = 'save-msg show bad';
    return;
  }

  ponerGuardando(true);
  try {
    const datosActualizados = {
      nombre: nombreInput.value.trim(),
      institucion: institucionInput.value.trim(),
      carrera: carreraInput.value
    };
    if (fotoBase64Pendiente !== null) {
      datosActualizados.fotoBase64 = fotoBase64Pendiente;
    }

    await updateDoc(doc(db, COLECCION_USUARIOS, uidActual), datosActualizados);

    fotoBase64Pendiente = null;
    saveMsg.textContent = 'Cambios guardados correctamente.';
    saveMsg.className = 'save-msg show ok';
  } catch (err) {
    saveMsg.textContent = 'No se pudieron guardar los cambios. Inténtalo de nuevo.';
    saveMsg.className = 'save-msg show bad';
  } finally {
    ponerGuardando(false);
  }
});

logoutBtn.addEventListener('click', async () => {
  if (!FIREBASE_READY) {
    window.location.href = 'login.html';
    return;
  }
  try {
    await signOut(auth);
  } finally {
    window.location.href = 'login.html';
  }
});

// ------------------------------------------------------------
// Carga inicial: revisa sesión y llena el formulario.
// ------------------------------------------------------------
if (!FIREBASE_READY) {
  configBanner.classList.add('show');
  pintarAvatar(null, '');
  mostrarContenido();
} else {
  protegerPagina(['alumno_servicio']).then(async ({ uid, datos }) => {
    uidActual = uid;
    nombreInput.value = datos.nombre || '';
    institucionInput.value = datos.institucion || '';
    carreraInput.value = datos.carrera || '';
    correoInput.value = datos.correo || '';
    pintarAvatar(datos.fotoBase64 || null, datos.nombre || '');
    mostrarContenido();
    await iniciarNotificaciones(uid, 'alumno_servicio');
  });
}