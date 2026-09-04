// Función serverless de Vercel (Fase 12).
//
// Esta es la ÚNICA pieza del proyecto que tiene la credencial secreta de
// Firebase (Admin SDK), y por eso es la única que puede mandar push de
// verdad. Vive en el servidor de Vercel, nunca en el navegador del
// usuario. Las variables FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL /
// FIREBASE_PRIVATE_KEY se configuran en Vercel → Settings →
// Environment Variables (no van en este archivo ni en el repositorio).

const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      // En las variables de entorno los saltos de línea de la llave
      // privada llegan como "\n" literal; hay que convertirlos de vuelta.
      privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n')
    })
  });
}

const db = admin.firestore();
const COLECCION_USUARIOS = 'usuarios';

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método no permitido' });
    return;
  }

  // Solo alguien realmente logueado en el sistema puede pedir que se
  // mande un push. Nunca confiamos en que el cliente diga quién es.
  const authHeader = req.headers.authorization || '';
  const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!idToken) {
    res.status(401).json({ error: 'No autenticado' });
    return;
  }
  try {
    await admin.auth().verifyIdToken(idToken);
  } catch (err) {
    res.status(401).json({ error: 'Token inválido' });
    return;
  }

  const { paraUid, paraRol, titulo, mensaje } = req.body || {};
  if (!mensaje || (!paraUid && !paraRol)) {
    res.status(400).json({ error: 'Faltan datos (paraUid/paraRol y mensaje)' });
    return;
  }

  try {
    // Reunimos los documentos de usuario destino (uno solo, o todos los
    // de un rol) y con ellos, todos los tokens de dispositivo guardados.
    const docsUsuarios = [];

    if (paraUid) {
      const snap = await db.collection(COLECCION_USUARIOS).doc(paraUid).get();
      if (snap.exists) docsUsuarios.push(snap);
    }
    if (paraRol) {
      const snap = await db.collection(COLECCION_USUARIOS).where('rol', '==', paraRol).get();
      snap.forEach((d) => docsUsuarios.push(d));
    }

    // token -> referencia al documento dueño, para poder limpiarlo si ya no sirve.
    const tokenAUsuario = new Map();
    docsUsuarios.forEach((docSnap) => {
      (docSnap.data().tokensFCM || []).forEach((token) => tokenAUsuario.set(token, docSnap.ref));
    });

    const tokens = [...tokenAUsuario.keys()];
    if (tokens.length === 0) {
      res.status(200).json({ enviados: 0 });
      return;
    }

    const respuesta = await admin.messaging().sendEachForMulticast({
      tokens,
      notification: { title: titulo || 'SGSS', body: mensaje }
    });

    // Si algún token ya no es válido (el usuario borró datos del
    // navegador, desinstaló, etc.), lo quitamos para no seguir
    // intentando mandarle avisos que nunca le van a llegar.
    const limpiezas = [];
    respuesta.responses.forEach((r, i) => {
      const codigo = r.error && r.error.code;
      if (!r.success && (codigo === 'messaging/registration-token-not-registered' || codigo === 'messaging/invalid-argument')) {
        const ref = tokenAUsuario.get(tokens[i]);
        limpiezas.push(ref.update({ tokensFCM: admin.firestore.FieldValue.arrayRemove(tokens[i]) }).catch(() => {}));
      }
    });
    await Promise.all(limpiezas);

    res.status(200).json({ enviados: respuesta.successCount });
  } catch (err) {
    console.error('Error enviando push:', err);
    res.status(500).json({ error: 'No se pudo enviar la notificación' });
  }
};
