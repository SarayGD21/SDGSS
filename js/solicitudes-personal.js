import { FIREBASE_READY, db, storage, COLECCION_EQUIPOS, COLECCION_SOLICITUDES } from "./firebase-config.js";
import { protegerPagina } from "./auth-guard.js";
import { poblarSelectTipos } from "./tipos-actividad.js";
import { crearNotificacion } from "./notificaciones.js";

let collection, addDoc, doc, updateDoc, getDocs, query, where, orderBy, serverTimestamp;
let ref, uploadBytes, getDownloadURL;

if (FIREBASE_READY) {
  ({ collection, addDoc, doc, updateDoc, getDocs, query, where, orderBy, serverTimestamp } = await import(
    "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js"
  ));
  ({ ref, uploadBytes, getDownloadURL } = await import(
    "https://www.gstatic.com/firebasejs/10.13.0/firebase-storage.js"
  ));
}

const solicitudForm = document.getElementById('solicitudForm');
const solicitudTipo = document.getElementById('solicitudTipo');
const solicitudEquipo = document.getElementById('solicitudEquipo');
const solicitudDescripcion = document.getElementById('solicitudDescripcion');
const solicitudComentarios = document.getElementById('solicitudComentarios');
const solicitudEvidencia = document.getElementById('solicitudEvidencia');
const solicitudEvidenciaPreview = document.getElementById('solicitudEvidenciaPreview');
const solicitudEvidenciaPlaceholder = document.getElementById('solicitudEvidenciaPlaceholder');
const solicitudGuardarBtn = document.getElementById('solicitudGuardarBtn');
const solicitudMsg = document.getElementById('solicitudMsg');
const listaMisSolicitudes = document.getElementById('listaMisSolicitudes');

let archivoEvidenciaPendiente = null;
let miUid = null;
let miNombre = '';

// El catálogo es contenido estático, no depende de Firestore, así que
// lo llenamos de una vez al cargar el script.
poblarSelectTipos(solicitudTipo);

function escaparHtml(texto) {
  const div = document.createElement('div');
  div.textContent = texto || '';
  return div.innerHTML;
}

// Redimensiona y comprime la evidencia, igual que se hace con las fotos
// de equipos, para no subir imágenes pesadas a Storage.
function procesarImagenEvidencia(file) {
  return new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onerror = () => reject(new Error('No se pudo leer la imagen.'));
    lector.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('El archivo no es una imagen válida.'));
      img.onload = () => {
        const maxLado = 800;
        let w = img.width, h = img.height;
        if (w >= h && w > maxLado) { h = Math.round(h * maxLado / w); w = maxLado; }
        else if (h > w && h > maxLado) { w = Math.round(w * maxLado / h); h = maxLado; }

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);

        canvas.toBlob((blob) => {
          if (!blob) { reject(new Error('No se pudo procesar la imagen.')); return; }
          resolve({ blob, previewUrl: canvas.toDataURL('image/jpeg', 0.75) });
        }, 'image/jpeg', 0.75);
      };
      img.src = lector.result;
    };
    lector.readAsDataURL(file);
  });
}

function mostrarPreviewEvidencia(url) {
  if (url) {
    solicitudEvidenciaPreview.src = url;
    solicitudEvidenciaPreview.style.display = 'block';
    solicitudEvidenciaPlaceholder.style.display = 'none';
  } else {
    solicitudEvidenciaPreview.style.display = 'none';
    solicitudEvidenciaPlaceholder.style.display = 'flex';
  }
}

solicitudEvidencia.addEventListener('change', async () => {
  const file = solicitudEvidencia.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    mostrarMsgSolicitud('Elige un archivo de imagen válido.', false);
    return;
  }
  try {
    const { blob, previewUrl } = await procesarImagenEvidencia(file);
    archivoEvidenciaPendiente = blob;
    mostrarPreviewEvidencia(previewUrl);
  } catch (err) {
    mostrarMsgSolicitud(err.message || 'No se pudo procesar la imagen.', false);
  }
});

function mostrarMsgSolicitud(mensaje, ok) {
  solicitudMsg.textContent = mensaje;
  solicitudMsg.className = 'save-msg show ' + (ok ? 'ok' : 'bad');
}

function ponerGuardandoSolicitud(cargando) {
  solicitudGuardarBtn.disabled = cargando;
  solicitudGuardarBtn.textContent = cargando ? 'Enviando...' : 'Enviar solicitud';
}

function limpiarFormularioSolicitud() {
  solicitudForm.reset();
  archivoEvidenciaPendiente = null;
  mostrarPreviewEvidencia(null);
  ponerGuardandoSolicitud(false);
}

// --- Cargar los equipos asociados a este usuario, para el selector ---
async function cargarMisEquiposParaSelector(uid) {
  const q = query(collection(db, COLECCION_EQUIPOS), where('responsableUid', '==', uid));
  const snap = await getDocs(q);

  const opciones = ['<option value="">No aplica / actividad general</option>'];
  snap.forEach((docSnap) => {
    const d = docSnap.data();
    opciones.push(`<option value="${docSnap.id}" data-marbete="${escaparHtml(d.marbete)}">${escaparHtml(d.marbete)} · ${escaparHtml(d.marca)} ${escaparHtml(d.modelo)}</option>`);
  });
  solicitudEquipo.innerHTML = opciones.join('');
}

// --- Enviar la solicitud ---
solicitudForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  solicitudMsg.className = 'save-msg';

  const tipo = solicitudTipo.value;
  const equipoId = solicitudEquipo.value || null;
  const equipoMarbete = equipoId
    ? solicitudEquipo.options[solicitudEquipo.selectedIndex].dataset.marbete
    : null;
  const descripcion = solicitudDescripcion.value.trim();
  const comentarios = solicitudComentarios.value.trim();

  if (!tipo || !descripcion) {
    mostrarMsgSolicitud('Selecciona un tipo de actividad y describe el problema.', false);
    return;
  }

  ponerGuardandoSolicitud(true);
  try {
    const datos = {
      creadoPorUid: miUid,
      creadoPorNombre: miNombre,
      origen: 'personal',
      tipo,
      equipoId,
      equipoMarbete,
      descripcion,
      comentarios,
      evidenciaURL: null,
      evidenciaPath: null,
      estado: 'pendiente',
      creadoEn: serverTimestamp()
    };

    const nuevoDoc = await addDoc(collection(db, COLECCION_SOLICITUDES), datos);

    crearNotificacion({
      paraRol: 'encargada',
      tipo: 'nueva_solicitud',
      mensaje: `${miNombre} envió una nueva solicitud: ${tipo}.`,
      solicitudId: nuevoDoc.id,
      creadaPorUid: miUid
    });

    // Igual que con las fotos de equipo: subimos la evidencia después de
    // crear el documento, para poder organizarla por ID de solicitud.
    if (archivoEvidenciaPendiente) {
      const rutaEvidencia = `solicitudes/${nuevoDoc.id}/evidencia.jpg`;
      const refEvidencia = ref(storage, rutaEvidencia);
      await uploadBytes(refEvidencia, archivoEvidenciaPendiente);
      const url = await getDownloadURL(refEvidencia);
      await updateDoc(doc(db, COLECCION_SOLICITUDES, nuevoDoc.id), { evidenciaURL: url, evidenciaPath: rutaEvidencia });
    }

    mostrarMsgSolicitud('Solicitud enviada. La encargada la recibirá en breve.', true);
    limpiarFormularioSolicitud();
    await cargarMisSolicitudes();
  } catch (err) {
    mostrarMsgSolicitud('No se pudo enviar la solicitud. Inténtalo de nuevo.', false);
  } finally {
    ponerGuardandoSolicitud(false);
  }
});

// --- Cargar y pintar "Mis solicitudes" ---
async function cargarMisSolicitudes() {
  const q = query(
    collection(db, COLECCION_SOLICITUDES),
    where('creadoPorUid', '==', miUid),
    orderBy('creadoEn', 'desc')
  );
  const snap = await getDocs(q);

  if (snap.empty) {
    listaMisSolicitudes.innerHTML = '<p style="color:var(--text-muted); font-size:14px;">Aún no has enviado ninguna solicitud.</p>';
    return;
  }

  const solicitudes = [];
  snap.forEach((docSnap) => solicitudes.push(docSnap.data()));

  listaMisSolicitudes.innerHTML = solicitudes.map(s => `
    <div class="solicitud-row">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px;">
        <strong>${escaparHtml(s.tipo)}</strong>
        <span class="badge badge-${escaparHtml(s.estado)}">${escaparHtml(s.estado).replace('_', ' ')}</span>
      </div>
      ${s.equipoMarbete ? `<div style="color:var(--text-muted); font-size:13px; margin-top:4px;">Equipo: ${escaparHtml(s.equipoMarbete)}</div>` : ''}
      <div style="color:var(--text-muted); font-size:13.5px; margin-top:6px;">${escaparHtml(s.descripcion)}</div>
      ${(s.alumnosAsignadosNombres && s.alumnosAsignadosNombres.length) ? `<div style="color:var(--text-faint); font-size:13px; margin-top:6px;">Asignada a: ${escaparHtml(s.alumnosAsignadosNombres.join(', '))}</div>` : ''}
    </div>
  `).join('');
}

protegerPagina(['personal_plantel']).then(async ({ uid, datos }) => {
  miUid = uid;
  miNombre = datos.nombre || '';
  if (FIREBASE_READY) {
    await cargarMisEquiposParaSelector(uid);
    await cargarMisSolicitudes();
  }
});