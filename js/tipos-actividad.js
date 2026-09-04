// Catálogo de tipos de actividad (Fase 7).
//
// Un solo lugar para mantener esta lista: la usan el formulario de
// solicitudes del personal (dashboard-personal.html) y la creación
// manual de actividades de la encargada (dashboard-encargada.html).
// Si agregas o quitas un tipo, hazlo aquí y se refleja en ambos lados.

export const CATALOGO_TIPOS = [
  {
    categoria: 'Mantenimiento',
    tipos: ['Reparar máquina', 'Revisar equipo', 'Resetear equipo']
  },
  {
    categoria: 'Instalación',
    tipos: ['Instalar impresora', 'Instalar Office', 'Instalar programas', 'Configurar software']
  },
  {
    categoria: 'Soporte',
    tipos: ['Problemas de software', 'Apoyo con correos institucionales', 'Configuración de equipos']
  },
  {
    categoria: 'Trámites',
    tipos: ['Apoyo con NSS', 'Línea de pago', 'Otros trámites del alumno']
  },
  {
    categoria: 'Académico',
    tipos: ['Seguimiento de cursos', 'Apoyo en actividades']
  },
  {
    categoria: 'Comunicación',
    tipos: ['Publicidad para redes sociales', 'Material para redes del plantel']
  },
  {
    categoria: 'Otros',
    tipos: ['Actividad personalizada']
  }
];

// Lista plana (sin categorías), útil si algún día necesitamos validar
// o buscar un tipo sin recorrer los grupos.
export const TODOS_LOS_TIPOS = CATALOGO_TIPOS.flatMap((grupo) => grupo.tipos);

function escaparHtml(texto) {
  const div = document.createElement('div');
  div.textContent = texto || '';
  return div.innerHTML;
}

// Llena un <select> con <optgroup> por categoría. Si se pasa
// valorActual, lo deja seleccionado (útil al editar).
export function poblarSelectTipos(selectEl, valorActual = '') {
  const grupos = CATALOGO_TIPOS.map((grupo) => `
    <optgroup label="${escaparHtml(grupo.categoria)}">
      ${grupo.tipos.map((tipo) => `<option value="${escaparHtml(tipo)}">${escaparHtml(tipo)}</option>`).join('')}
    </optgroup>
  `).join('');

  selectEl.innerHTML = `<option value="">Selecciona una opción...</option>${grupos}`;
  if (valorActual) selectEl.value = valorActual;
}
