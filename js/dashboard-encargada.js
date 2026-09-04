import { FIREBASE_READY, auth, db, firebaseConfig, COLECCION_USUARIOS } from "./firebase-config.js";
import { protegerPagina } from "./auth-guard.js";
import { iniciarNotificaciones } from "./notificaciones.js";
import { iniciarPush } from "./push.js";

let signOut, initializeApp, getAuth, createUserWithEmailAndPassword;
let collection, getDocs, query, where, setDoc, doc, updateDoc, serverTimestamp, orderBy;

if (FIREBASE_READY) {
  ({ initializeApp } = await import(
    "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js"
  ));
  ({ signOut, getAuth, createUserWithEmailAndPassword } = await import(
    "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js"
  ));
  ({ collection, getDocs, query, where, setDoc, doc, updateDoc, serverTimestamp, orderBy } = await import(
    "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js"
  ));
}

// --- Instancia secundaria de Firebase, solo para dar de alta personal ---
// Si usáramos la app principal (la misma que usa la encargada para su
// propia sesión), createUserWithEmailAndPassword cerraría la sesión de la
// encargada y la reemplazaría con la de la cuenta recién creada. Con una
// segunda app, la nueva cuenta se crea "por fuera" y no toca la sesión
// activa de quien está usando el panel.
let authSecundaria = null;
if (FIREBASE_READY) {
  const appSecundaria = initializeApp(firebaseConfig, "AltaDePersonal");
  authSecundaria = getAuth(appSecundaria);
}

const saludo = document.getElementById('saludo');
const logoutBtn = document.getElementById('logoutBtn');
const listaDisponibles = document.getElementById('listaDisponibles');

const personalForm = document.getElementById('personalForm');
const personalNombre = document.getElementById('personalNombre');
const personalCorreo = document.getElementById('personalCorreo');
const personalArea = document.getElementById('personalArea');
const personalPuesto = document.getElementById('personalPuesto');
const personalTelefono = document.getElementById('personalTelefono');
const personalPassword = document.getElementById('personalPassword');
const personalCrearBtn = document.getElementById('personalCrearBtn');
const personalMsg = document.getElementById('personalMsg');
const listaPersonal = document.getElementById('listaPersonal');

function estaVigente(fecha, horaFin) {
  const ahora = new Date();
  const finDeclarado = new Date(`${fecha}T${horaFin}:00`);
  return finDeclarado >= ahora;
}

async function cargarDisponibles() {
  const q = query(collection(db, 'disponibilidad'), where('activo', '==', true));
  const snap = await getDocs(q);

  const vigentes = [];
  snap.forEach((docSnap) => {
    const d = docSnap.data();
    if (estaVigente(d.fecha, d.horaFin)) vigentes.push(d);
  });

  if (vigentes.length === 0) {
    listaDisponibles.innerHTML = '<p style="color:#8fa397; font-size:14px;">No hay alumnos disponibles en este momento.</p>';
    return;
  }

  listaDisponibles.innerHTML = vigentes.map(d => `
    <div style="background:#0f1712; border:1px solid #234531; border-radius:12px; padding:14px 16px;">
      <strong>${d.nombreAlumno || 'Alumno'}</strong>
      <div style="color:#8fa397; font-size:13px; margin-top:4px;">
        ${d.fecha} · ${d.horaInicio} - ${d.horaFin}
      </div>
    </div>
  `).join('');
}

// --- Registrar personal del plantel ---

function mostrarMsgPersonal(mensaje, ok) {
  personalMsg.textContent = mensaje;
  personalMsg.className = 'save-msg show ' + (ok ? 'ok' : 'bad');
}

function mensajeDeErrorPersonal(codigo) {
  switch (codigo) {
    case 'auth/email-already-in-use':
      return 'Ya existe una cuenta con ese correo.';
    case 'auth/invalid-email':
      return 'El correo no tiene un formato válido.';
    case 'auth/weak-password':
      return 'La contraseña es demasiado débil. Usa al menos 8 caracteres.';
    default:
      return 'No se pudo crear la cuenta. Inténtalo de nuevo.';
  }
}

function ponerCargandoPersonal(cargando) {
  personalCrearBtn.disabled = cargando;
  personalCrearBtn.textContent = cargando ? 'Creando cuenta...' : 'Crear cuenta de personal';
}

function escaparHtml(texto) {
  const div = document.createElement('div');
  div.textContent = texto || '';
  return div.innerHTML;
}

async function cargarPersonal() {
  if (!listaPersonal) return;
  const q = query(collection(db, COLECCION_USUARIOS), where('rol', '==', 'personal_plantel'));
  const snap = await getDocs(q);

  if (snap.empty) {
    listaPersonal.innerHTML = '<p style="color:#8fa397; font-size:14px;">Aún no hay personal registrado.</p>';
    return;
  }

  const filas = [];
  snap.forEach((docSnap) => {
    const d = docSnap.data();
    const activo = d.activo !== false; // por defecto, activo
    filas.push({ uid: docSnap.id, ...d, activo });
  });

  listaPersonal.innerHTML = filas.map(p => `
    <div class="persona-row ${p.activo ? '' : 'inactivo'}">
      <div>
        <strong>${escaparHtml(p.nombre)}</strong>
        <div style="color:#8fa397; font-size:13px; margin-top:2px;">
          ${escaparHtml(p.correo)} · ${escaparHtml(p.area)} / ${escaparHtml(p.puesto)}
          ${p.telefono ? ' · ' + escaparHtml(p.telefono) : ''}
        </div>
        <div style="color:${p.activo ? '#3ddc84' : '#ff6b6b'}; font-size:12px; margin-top:2px;">
          ${p.activo ? 'Activo' : 'Desactivado'}
        </div>
      </div>
      <div class="persona-acciones">
        <button type="button" class="btn-mini ${p.activo ? 'desactivar' : 'activar'}" data-uid="${p.uid}" data-activo="${p.activo}">
          ${p.activo ? 'Desactivar' : 'Activar'}
        </button>
      </div>
    </div>
  `).join('');

  listaPersonal.querySelectorAll('button[data-uid]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const uid = btn.dataset.uid;
      const activoActual = btn.dataset.activo === 'true';
      btn.disabled = true;
      try {
        await updateDoc(doc(db, COLECCION_USUARIOS, uid), { activo: !activoActual });
        await cargarPersonal();
      } catch (err) {
        btn.disabled = false;
        alert('No se pudo actualizar el estado. Inténtalo de nuevo.');
      }
    });
  });
}

if (personalForm) {
  personalForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    personalMsg.className = 'save-msg';

    const nombre = personalNombre.value.trim();
    const correo = personalCorreo.value.trim();
    const area = personalArea.value.trim();
    const puesto = personalPuesto.value.trim();
    const telefono = personalTelefono.value.trim();
    const password = personalPassword.value;

    if (!nombre || !correo || !area || !puesto || password.length < 8) {
      mostrarMsgPersonal('Revisa los campos: todos son obligatorios y la contraseña necesita al menos 8 caracteres.', false);
      return;
    }

    if (!FIREBASE_READY) {
      mostrarMsgPersonal('Firebase no está configurado todavía.', false);
      return;
    }

    ponerCargandoPersonal(true);
    try {
      const credencial = await createUserWithEmailAndPassword(authSecundaria, correo, password);
      const uid = credencial.user.uid;

      await setDoc(doc(db, COLECCION_USUARIOS, uid), {
        nombre,
        correo,
        area,
        puesto,
        telefono,
        rol: 'personal_plantel',
        activo: true,
        creadoEn: serverTimestamp()
      });

      // Cerramos la sesión en la app secundaria; la sesión de la encargada
      // en la app principal no se ve afectada.
      await signOut(authSecundaria);

      personalForm.reset();
      mostrarMsgPersonal('Cuenta de personal creada correctamente.', true);
      await cargarPersonal();
    } catch (err) {
      mostrarMsgPersonal(mensajeDeErrorPersonal(err.code), false);
    } finally {
      ponerCargandoPersonal(false);
    }
  });
}

protegerPagina(['encargada']).then(async ({ uid, datos }) => {
  saludo.textContent = `Hola, ${datos.nombre || 'encargada'}.`;
  if (FIREBASE_READY) {
    await cargarDisponibles();
    await cargarPersonal();
    await iniciarNotificaciones(uid, 'encargada');
    await iniciarPush(uid, 'pushWidget');
  }
});

logoutBtn.addEventListener('click', async () => {
  if (FIREBASE_READY) await signOut(auth);
  window.location.href = 'login.html';
});
