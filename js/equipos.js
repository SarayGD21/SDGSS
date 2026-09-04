import { FIREBASE_READY, db, storage, COLECCION_USUARIOS, COLECCION_EQUIPOS } from "./firebase-config.js";
import { protegerPagina } from "./auth-guard.js";

let collection, addDoc, doc, updateDoc, getDocs, query, where, serverTimestamp;
let ref, uploadBytes, getDownloadURL;

if (FIREBASE_READY) {
  ({ collection, addDoc, doc, updateDoc, getDocs, query, where, serverTimestamp } = await import(
    "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js"
  ));
  ({ ref, uploadBytes, getDownloadURL } = await import(
    "https://www.gstatic.com/firebasejs/10.13.0/firebase-storage.js"
  ));
}

const equipoForm = document.getElementById('equipoForm');
const equipoFoto = document.getElementById('equipoFoto');
const equipoFotoPreview = document.getElementById('equipoFotoPreview');
const equipoFotoPlaceholder = document.getElementById('equipoFotoPlaceholder');
const equipoMarca = document.getElementById('equipoMarca');
const equipoModelo = document.getElementById('equipoModelo');
const equipoMarbete = document.getElementById('equipoMarbete');
const equipoNumeroMaquina = document.getElementById('equipoNumeroMaquina');
const equipoUbicacion = document.getElementById('equipoUbicacion');
const equipoResponsable = document.getElementById('equipoResponsable');
const equipoObservaciones = document.getElementById('equipoObservaciones');
const equipoGuardarBtn = document.getElementById('equipoGuardarBtn');
const equipoMsg = document.getElementById('equipoMsg');
const equipoBuscar = document.getElementById('equipoBuscar');
const listaEquipos = document.getElementById('listaEquipos');

let archivoFotoPendiente = null; // Blob comprimido, listo para subir
let equipoEditandoId = null;     // null = estamos creando uno nuevo
let equiposCache = [];           // lista completa, para filtrar sin volver a consultar

function escaparHtml(texto) {
  const div = document.createElement('div');
  div.textContent = texto || '';
  return div.innerHTML;
}

// Redimensiona la imagen (máximo 800px de lado) y la comprime a JPEG,
// para no subir fotos pesadas a Storage.
function procesarImagenEquipo(file) {
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

function mostrarPreview(url) {
  if (url) {
    equipoFotoPreview.src = url;
    equipoFotoPreview.style.display = 'block';
    equipoFotoPlaceholder.style.display = 'none';
  } else {
    equipoFotoPreview.style.display = 'none';
    equipoFotoPlaceholder.style.display = 'flex';
  }
}

equipoFoto.addEventListener('change', async () => {
  const file = equipoFoto.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    mostrarMsgEquipo('Elige un archivo de imagen válido.', false);
    return;
  }
  try {
    const { blob, previewUrl } = await procesarImagenEquipo(file);
    archivoFotoPendiente = blob;
    mostrarPreview(previewUrl);
  } catch (err) {
    mostrarMsgEquipo(err.message || 'No se pudo procesar la imagen.', false);
  }
});

function mostrarMsgEquipo(mensaje, ok) {
  equipoMsg.textContent = mensaje;
  equipoMsg.className = 'save-msg show ' + (ok ? 'ok' : 'bad');
}

function ponerGuardandoEquipo(cargando) {
  equipoGuardarBtn.disabled = cargando;
  equipoGuardarBtn.textContent = cargando
    ? 'Guardando...'
    : (equipoEditandoId ? 'Guardar cambios' : 'Registrar equipo');
}

function limpiarFormularioEquipo() {
  equipoForm.reset();
  archivoFotoPendiente = null;
  equipoEditandoId = null;
  mostrarPreview(null);
  ponerGuardandoEquipo(false);
}

// --- Cargar el personal disponible para el selector "Responsable" ---
async function cargarResponsablesDisponibles() {
  const q = query(collection(db, COLECCION_USUARIOS), where('rol', '==', 'personal_plantel'));
  const snap = await getDocs(q);

  const opciones = ['<option value="">Selecciona una opción...</option>'];
  snap.forEach((docSnap) => {
    const d = docSnap.data();
    if (d.activo === false) return; // no se puede asignar a alguien desactivado
    opciones.push(`<option value="${docSnap.id}">${escaparHtml(d.nombre)} (${escaparHtml(d.area || '')})</option>`);
  });
  equipoResponsable.innerHTML = opciones.join('');
}

// --- Guardar (crear o editar) ---
equipoForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  equipoMsg.className = 'save-msg';

  const marca = equipoMarca.value.trim();
  const modelo = equipoModelo.value.trim();
  const marbete = equipoMarbete.value.trim();
  const numeroMaquina = equipoNumeroMaquina.value.trim();
  const ubicacion = equipoUbicacion.value.trim();
  const responsableUid = equipoResponsable.value;
  const responsableNombre = equipoResponsable.options[equipoResponsable.selectedIndex]?.text || '';
  const observaciones = equipoObservaciones.value.trim();

  if (!marca || !modelo || !marbete || !ubicacion || !responsableUid) {
    mostrarMsgEquipo('Completa marca, modelo, marbete, ubicación y responsable.', false);
    return;
  }

  ponerGuardandoEquipo(true);
  try {
    const datos = {
      marca,
      modelo,
      marbete,
      marbeteBusqueda: marbete.toUpperCase(),
      numeroMaquina,
      ubicacion,
      responsableUid,
      responsableNombre,
      observaciones,
      actualizadoEn: serverTimestamp()
    };

    let equipoId = equipoEditandoId;

    if (equipoId) {
      await updateDoc(doc(db, COLECCION_EQUIPOS, equipoId), datos);
    } else {
      datos.fotoURL = null;
      datos.fotoPath = null;
      datos.creadoEn = serverTimestamp();
      const nuevoDoc = await addDoc(collection(db, COLECCION_EQUIPOS), datos);
      equipoId = nuevoDoc.id;
    }

    // Si eligieron una foto nueva, la subimos ahora que ya tenemos el ID
    // del equipo (así todas las fotos quedan organizadas por equipo).
    if (archivoFotoPendiente) {
      const rutaFoto = `equipos/${equipoId}/foto.jpg`;
      const refFoto = ref(storage, rutaFoto);
      await uploadBytes(refFoto, archivoFotoPendiente);
      const url = await getDownloadURL(refFoto);
      await updateDoc(doc(db, COLECCION_EQUIPOS, equipoId), { fotoURL: url, fotoPath: rutaFoto });
    }

    mostrarMsgEquipo(equipoEditandoId ? 'Equipo actualizado.' : 'Equipo registrado.', true);
    limpiarFormularioEquipo();
    await cargarEquipos();
  } catch (err) {
    mostrarMsgEquipo('No se pudo guardar el equipo. Inténtalo de nuevo.', false);
  } finally {
    ponerGuardandoEquipo(false);
  }
});

// --- Cargar y pintar la lista de equipos (con filtro por marbete) ---
async function cargarEquipos() {
  const snap = await getDocs(collection(db, COLECCION_EQUIPOS));
  equiposCache = [];
  snap.forEach((docSnap) => equiposCache.push({ id: docSnap.id, ...docSnap.data() }));
  pintarEquipos();
}

function pintarEquipos() {
  const termino = equipoBuscar.value.trim().toUpperCase();
  const filtrados = termino
    ? equiposCache.filter(eq => (eq.marbeteBusqueda || '').includes(termino))
    : equiposCache;

  if (filtrados.length === 0) {
    listaEquipos.innerHTML = `<p style="color:var(--text-muted); font-size:14px;">${
      termino ? 'No hay equipos con ese marbete.' : 'Aún no hay equipos registrados.'
    }</p>`;
    return;
  }

  listaEquipos.innerHTML = filtrados.map(eq => `
    <div class="equipo-row">
      ${eq.fotoURL
        ? `<img class="equipo-foto" src="${eq.fotoURL}" alt="Foto del equipo">`
        : `<div class="equipo-foto-placeholder">Sin foto</div>`}
      <div style="flex:1;">
        <strong>${escaparHtml(eq.marca)} ${escaparHtml(eq.modelo)}</strong>
        <div style="color:var(--text-muted); font-size:13px; margin-top:2px;">
          Marbete: ${escaparHtml(eq.marbete)}${eq.numeroMaquina ? ' · Máquina ' + escaparHtml(eq.numeroMaquina) : ''}
        </div>
        <div style="color:var(--text-muted); font-size:13px;">
          ${escaparHtml(eq.ubicacion)} · Responsable: ${escaparHtml(eq.responsableNombre)}
        </div>
        ${eq.observaciones ? `<div style="color:var(--text-faint); font-size:12.5px; margin-top:4px;">${escaparHtml(eq.observaciones)}</div>` : ''}
      </div>
      <div class="persona-acciones">
        <button type="button" class="btn-mini guardar" data-editar="${eq.id}">Editar</button>
      </div>
    </div>
  `).join('');

  listaEquipos.querySelectorAll('button[data-editar]').forEach(btn => {
    btn.addEventListener('click', () => cargarEquipoEnFormulario(btn.dataset.editar));
  });
}

function cargarEquipoEnFormulario(id) {
  const eq = equiposCache.find(e => e.id === id);
  if (!eq) return;

  equipoEditandoId = id;
  equipoMarca.value = eq.marca || '';
  equipoModelo.value = eq.modelo || '';
  equipoMarbete.value = eq.marbete || '';
  equipoNumeroMaquina.value = eq.numeroMaquina || '';
  equipoUbicacion.value = eq.ubicacion || '';
  equipoResponsable.value = eq.responsableUid || '';
  equipoObservaciones.value = eq.observaciones || '';
  archivoFotoPendiente = null;
  mostrarPreview(eq.fotoURL || null);
  ponerGuardandoEquipo(false);

  equipoForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

equipoBuscar.addEventListener('input', pintarEquipos);

if (FIREBASE_READY) {
  protegerPagina(['encargada']).then(async () => {
    await cargarResponsablesDisponibles();
    await cargarEquipos();
  });
}
