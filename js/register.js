
import {
  FIREBASE_READY,
  auth,
  db,
  COLECCION_USUARIOS
} from "./firebase-config.js";

let createUserWithEmailAndPassword, setDoc, doc, serverTimestamp;
if (FIREBASE_READY) {
  ({ createUserWithEmailAndPassword } = await import(
    "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js"
  ));
  ({ setDoc, doc, serverTimestamp } = await import(
    "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js"
  ));
}

const form = document.getElementById('registerForm');
const pw = document.getElementById('password');
const pw2 = document.getElementById('password2');
const matchMsg = document.getElementById('matchMsg');
const strengthBars = document.querySelectorAll('#strengthBars i');
const strengthLabel = document.getElementById('strengthLabel');
const successBanner = document.getElementById('successBanner');
const submitBtn = document.getElementById('submitBtn');

const nombreInput = document.getElementById('nombre');
const institucionInput = document.getElementById('institucion');
const carreraInput = document.getElementById('carrera');
const correoInput = document.getElementById('correo');

// Aviso de "Firebase aún no configurado", si el HTML tiene el contenedor.
const configBanner = document.getElementById('configBanner');
if (!FIREBASE_READY && configBanner) {
  configBanner.classList.add('show');
}

// Mostrar / ocultar contraseña
document.querySelectorAll('.toggle-pw').forEach(btn => {
  btn.addEventListener('click', () => {
    const target = document.getElementById(btn.dataset.target);
    const isPw = target.type === 'password';
    target.type = isPw ? 'text' : 'password';
    btn.setAttribute('aria-label', isPw ? 'Ocultar contraseña' : 'Mostrar contraseña');
    btn.querySelector('.eye').style.opacity = isPw ? '0.55' : '1';
  });
});

function setError(field, hasError) {
  const el = document.querySelector(`[data-field="${field}"]`);
  if (el) el.classList.toggle('error', hasError);
}

function scorePassword(value) {
  let score = 0;
  if (value.length >= 8) score++;
  if (/[A-Z]/.test(value)) score++;
  if (/[0-9]/.test(value)) score++;
  if (/[^A-Za-z0-9]/.test(value)) score++;
  return score;
}

const labels = ['Muy débil', 'Débil', 'Aceptable', 'Fuerte'];
const colors = ['#c0362e', '#c98a00', '#7a8c00', '#15803d'];

pw.addEventListener('input', () => {
  const score = pw.value.length ? Math.max(scorePassword(pw.value), 1) : 0;
  strengthBars.forEach((bar, i) => {
    bar.style.background = i < score ? colors[score - 1] : 'var(--green-line)';
  });
  strengthLabel.textContent = pw.value.length
    ? labels[score - 1] || labels[0]
    : 'Usa mayúsculas, números y símbolos para mayor seguridad.';
  checkMatch();
});

function checkMatch() {
  if (!pw2.value) {
    matchMsg.className = 'match-msg';
    return;
  }
  const ok = pw.value === pw2.value;
  matchMsg.textContent = ok ? 'Las contraseñas coinciden.' : 'Las contraseñas no coinciden todavía.';
  matchMsg.className = 'match-msg show ' + (ok ? 'ok' : 'bad');
}
pw2.addEventListener('input', checkMatch);

// Traduce los códigos de error de Firebase Auth a mensajes entendibles.
function mensajeDeError(codigo) {
  switch (codigo) {
    case 'auth/email-already-in-use':
      return 'Ya existe una cuenta registrada con ese correo.';
    case 'auth/invalid-email':
      return 'El correo no tiene un formato válido.';
    case 'auth/weak-password':
      return 'La contraseña es demasiado débil. Usa al menos 8 caracteres.';
    default:
      return 'No se pudo crear la cuenta. Inténtalo de nuevo.';
  }
}

function mostrarErrorGeneral(mensaje) {
  successBanner.classList.remove('show');
  let errorBanner = document.getElementById('errorBannerRegistro');
  if (!errorBanner) {
    errorBanner = document.createElement('div');
    errorBanner.id = 'errorBannerRegistro';
    errorBanner.className = 'success-banner';
    errorBanner.style.background = '#fdeceb';
    errorBanner.style.color = '#8a241d';
    errorBanner.style.borderColor = '#f1b8b3';
    successBanner.insertAdjacentElement('afterend', errorBanner);
  }
  errorBanner.textContent = mensaje;
  errorBanner.classList.add('show');
  errorBanner.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function ponerCargando(cargando) {
  submitBtn.disabled = cargando;
  submitBtn.textContent = cargando ? 'Creando cuenta...' : 'Crear mi cuenta';
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  successBanner.classList.remove('show');
  const errorPrevio = document.getElementById('errorBannerRegistro');
  if (errorPrevio) errorPrevio.classList.remove('show');

  let valid = true;

  const nombreOk = nombreInput.value.trim().length >= 3;
  setError('nombre', !nombreOk); if (!nombreOk) valid = false;

  const instOk = institucionInput.value.trim().length >= 3;
  setError('institucion', !instOk); if (!instOk) valid = false;

  const carreraOk = carreraInput.value !== '';
  setError('carrera', !carreraOk); if (!carreraOk) valid = false;

  const correoOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correoInput.value.trim());
  setError('correo', !correoOk); if (!correoOk) valid = false;

  const pwOk = pw.value.length >= 8;
  setError('password', !pwOk); if (!pwOk) valid = false;

  const pw2Ok = pwOk && pw.value === pw2.value && pw2.value.length > 0;
  setError('password2', !pw2Ok); if (!pw2Ok) valid = false;

  if (!valid) {
    const firstError = document.querySelector('.field.error');
    if (firstError) firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  if (!FIREBASE_READY) {
    mostrarErrorGeneral('El registro aún no está conectado a Firebase. Configura /js/firebase-config.js para activarlo.');
    return;
  }

  ponerCargando(true);
  try {
    const credencial = await createUserWithEmailAndPassword(auth, correoInput.value.trim(), pw.value);
    const uid = credencial.user.uid;

await setDoc(doc(db, COLECCION_USUARIOS, uid), {
  nombre: nombreInput.value.trim(),
  institucion: institucionInput.value.trim(),
  carrera: carreraInput.value,
  correo: correoInput.value.trim(),
  rol: 'alumno_servicio',   // antes decía 'estudiante'
  fotoBase64: '',
  creadoEn: serverTimestamp()
});

    successBanner.classList.add('show');
    successBanner.scrollIntoView({ behavior: 'smooth', block: 'center' });

    setTimeout(() => {
      window.location.href = 'profile.html';
    }, 900);
  } catch (err) {
    mostrarErrorGeneral(mensajeDeError(err.code));
    ponerCargando(false);
  }
});
