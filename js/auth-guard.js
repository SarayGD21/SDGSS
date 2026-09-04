import {
  FIREBASE_READY,
  auth,
  db,
  COLECCION_USUARIOS,
  RUTAS_POR_ROL
} from "./firebase-config.js";

let onAuthStateChanged, signOut, doc, getDoc;
if (FIREBASE_READY) {
  ({ onAuthStateChanged, signOut } = await import(
    "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js"
  ));
  ({ doc, getDoc } = await import(
    "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js"
  ));
}

/**
 * @param {string[]} rolesPermitidos - roles que pueden ver esta página.
 * @returns {Promise<{uid: string, rol: string, datos: object}>}
 */
export function protegerPagina(rolesPermitidos) {
  return new Promise((resolve) => {
    if (!FIREBASE_READY) {
      // Modo simulación: no hay Firebase real, dejamos pasar sin datos.
      resolve({ uid: null, rol: null, datos: {} });
      return;
    }

    onAuthStateChanged(auth, async (usuario) => {
      if (!usuario) {
        window.location.href = "login.html";
        return;
      }

      const snap = await getDoc(doc(db, COLECCION_USUARIOS, usuario.uid));
      if (!snap.exists()) {
        window.location.href = "login.html";
        return;
      }

      const datos = snap.data();
      const rol = datos.rol;

      if (datos.activo === false) {
        // Cuenta de personal desactivada por la encargada: se cierra la
        // sesión y se manda de vuelta al login.
        await signOut(auth);
        window.location.href = "login.html";
        return;
      }

      if (!rolesPermitidos.includes(rol)) {
        // El usuario existe y tiene sesión, pero está intentando
        // entrar a un panel que no le corresponde.
        const destino = RUTAS_POR_ROL[rol] || "login.html";
        window.location.href = destino;
        return;
      }

      resolve({ uid: usuario.uid, rol, datos });
    });
  });
}