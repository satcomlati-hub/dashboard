/**
 * Helpers para la lógica de subagentes (delegación).
 *
 * Una "delegate-tool" es una ag_http_tools normal cuyo `url` apunta al endpoint
 * /invoke de OTRO agente. Así el agente padre gana una sola tool ligera en vez de
 * cargar el MCP completo; el MCP solo se carga dentro del subagente especializado.
 *
 * No requiere cambios de schema en la BD: la delegación se detecta por el patrón
 * de la URL (`/v1/agents/{uuid}/invoke`).
 */

// Base pública del backend de agentes, alcanzable por el propio backend al ejecutar
// la tool. Coincide con PUBLIC_BASE_URL del agentes-api. Override con
// NEXT_PUBLIC_AGENTES_INVOKE_BASE si cambia el host.
export const INVOKE_BASE = (
  process.env.NEXT_PUBLIC_AGENTES_INVOKE_BASE ?? 'https://sara.mysatcomla.com/agentes'
).replace(/\/$/, '');

const INVOKE_RE = /\/v1\/agents\/([0-9a-fA-F-]{36})\/invoke\/?$/;

/** URL del endpoint /invoke de un agente (la que usa una delegate-tool). */
export function buildInvokeUrl(agentId: string): string {
  return `${INVOKE_BASE}/v1/agents/${agentId}/invoke`;
}

/** Si la URL es un /invoke de agente, devuelve el id del agente destino; si no, null. */
export function delegateTargetId(url?: string | null): string | null {
  if (!url) return null;
  const m = INVOKE_RE.exec(url);
  return m ? m[1] : null;
}

/** True si la tool delega en un subagente (su URL apunta a un /invoke). */
export function isDelegateTool(tool?: { url?: string | null } | null): boolean {
  return delegateTargetId(tool?.url ?? null) !== null;
}

/** input_schema por defecto de una delegate-tool: un único campo `prompt`. */
export function delegateInputSchema() {
  return {
    type: 'object',
    required: ['prompt'],
    properties: {
      prompt: {
        type: 'string',
        description:
          'La pregunta o instrucción del usuario en lenguaje natural, completa (incluye el nombre del proyecto/recurso si lo mencionó).',
      },
    },
  };
}

/**
 * Tools builtin del SDK Antigravity (enum BuiltinTools). Se pueden desactivar por
 * agente vía capabilities.disabled_tools. `finish` NO se incluye: es necesaria.
 */
export const BUILTIN_TOOLS: { name: string; label: string; danger?: boolean }[] = [
  { name: 'list_directory', label: 'Listar directorios', danger: true },
  { name: 'search_directory', label: 'Buscar en directorios', danger: true },
  { name: 'find_file', label: 'Encontrar archivos', danger: true },
  { name: 'view_file', label: 'Leer archivos', danger: true },
  { name: 'create_file', label: 'Crear archivos', danger: true },
  { name: 'edit_file', label: 'Editar archivos', danger: true },
  { name: 'run_command', label: 'Ejecutar comandos (shell)', danger: true },
  { name: 'generate_image', label: 'Generar imágenes' },
  { name: 'start_subagent', label: 'Lanzar subagentes' },
  { name: 'ask_question', label: 'Preguntar / pedir aclaración' },
];
