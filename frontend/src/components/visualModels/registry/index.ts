import { graphRegistry } from './graph';
import { stateRegistry } from './state';
import { ganttRegistry } from './gantt';
import { mapRegistry } from './map';
import { sequenceRegistry } from './sequence';
import { tableRegistry } from './table';
import { treeRegistry } from './tree';
import { REGISTRY_EXAMPLES } from './examples';
import { notesFrom, type FamilyResult, type RegistryEntry, type SequenceStep } from './types';

export const REGISTRY: Record<string, RegistryEntry> = {
  ...graphRegistry,
  ...stateRegistry,
  ...ganttRegistry,
  ...mapRegistry,
  ...sequenceRegistry,
  ...tableRegistry,
  ...treeRegistry,
};

export { REGISTRY_EXAMPLES };

/** Ejemplos agrupados por tema, para el catálogo del formulario del docente
 * (`<optgroup>` por tema, ordenado alfabéticamente dentro de cada grupo). */
export function examplesByTema(): { tema: string; items: { tipo: string; label: string }[] }[] {
  const byTema = new Map<string, { tipo: string; label: string }[]>();
  Object.entries(REGISTRY).forEach(([tipo, entry]) => {
    if (!byTema.has(entry.tema)) byTema.set(entry.tema, []);
    byTema.get(entry.tema)!.push({ tipo, label: entry.label });
  });
  return Array.from(byTema.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([tema, items]) => ({ tema, items: items.sort((a, b) => a.label.localeCompare(b.label)) }));
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Convierte un evento en cualquiera de sus formas frecuentes en el banco de
 * casos (tupla ["t","actor","accion"], tupla ["t","accion"], objeto {t,actor,
 * accion}, o directamente un string) a un SequenceStep. */
function toStep(e: unknown): SequenceStep {
  if (typeof e === 'string') return { label: e };
  if (Array.isArray(e)) {
    const strs = e.map((x) => String(x));
    if (strs.length >= 3) return { time: strs[0], actor: strs[1], label: strs.slice(2).join(' ') };
    if (strs.length === 2) return { time: strs[0], label: strs[1] };
    return { label: strs[0] ?? '' };
  }
  if (isPlainObject(e)) {
    const label = (e.accion ?? e.evento ?? e.label ?? e.descripcion ?? JSON.stringify(e)) as string;
    return { time: e.t as string | number | undefined, actor: e.actor as string | undefined, label };
  }
  return { label: String(e) };
}

/** Cuando el docente usa un `tipo` que no está en el registro, se intenta
 * inferir la familia más parecida por la forma del JSON (en vez de dejar la
 * previsualización en blanco). Nunca hace un mapeo "perfecto" — por eso
 * siempre vuelca el JSON completo a las notas, para no ocultar nada. */
export function sniffShape(data: Record<string, unknown>): FamilyResult | null {
  const allKeys = Object.keys(data);

  if (Array.isArray(data.nodes) && Array.isArray(data.edges)) {
    return {
      family: 'graph',
      props: {
        nodes: (data.nodes as any[]).map((n) => ({ id: n.id, category: n.category ?? n.type ?? 'nodo', label: n.label, instances: n.instances })),
        edges: data.edges as any,
        cyclePath: data.cyclePath as string[] | undefined,
        notes: notesFrom(data, ['nodes', 'edges', 'cyclePath']),
      },
    };
  }

  if (Array.isArray(data.states) && Array.isArray(data.transitions)) {
    return {
      family: 'state',
      props: {
        states: data.states as any,
        transitions: data.transitions as any,
        highlight: data.highlight as string[] | undefined,
        notes: notesFrom(data, ['states', 'transitions', 'highlight']),
      },
    };
  }

  if (Array.isArray(data.segments)) {
    return { family: 'gantt', props: { series: [{ segments: data.segments as any }], notes: notesFrom(data, ['segments']) } };
  }

  if (Array.isArray(data.regions) && typeof data.totalSize === 'number') {
    return {
      family: 'map',
      props: {
        mode: 'range',
        totalSize: data.totalSize as number,
        unit: data.unit as string | undefined,
        regions: (data.regions as any[]).map((r) => ({ label: r.label, start: r.start, end: r.end ?? r.start + (r.size ?? 0), kind: r.kind })),
        notes: notesFrom(data, ['regions', 'totalSize', 'unit']),
      },
    };
  }

  const eventKey = ['eventos', 'pasos', 'secuencia', 'ciclo', 'steps'].find((k) => Array.isArray(data[k]));
  if (eventKey) {
    return { family: 'sequence', props: { steps: (data[eventKey] as unknown[]).map(toStep), notes: notesFrom(data, [eventKey]) } };
  }

  const rowsKey = allKeys.find((k) => Array.isArray(data[k]) && (data[k] as unknown[]).every((row) => isPlainObject(row)) && (data[k] as unknown[]).length > 0);
  if (rowsKey) {
    return { family: 'table', props: { mode: 'rows', rows: data[rowsKey] as any, notes: notesFrom(data, [rowsKey]) } };
  }

  const treeKey = allKeys.find((k) => isPlainObject(data[k]) && Array.isArray((data[k] as any).children));
  if (treeKey) {
    return { family: 'tree', props: { trees: [{ root: data[treeKey] as any }], notes: notesFrom(data, [treeKey]) } };
  }

  return null;
}
