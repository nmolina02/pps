import { notesFrom, type GraphEdge, type GraphNode, type RegistryEntry } from './types';

/** Adaptadores para la familia `graph`: nodos agrupados por categoría + aristas
 * dirigidas, con ciclo opcional a resaltar. */
export const graphRegistry: Record<string, RegistryEntry> = {
  resource_allocation_graph: {
    label: 'Grafo de asignación de recursos (deadlock)',
    tema: 'Deadlock',
    adapt: (raw) => {
      const nodes: GraphNode[] = [
        ...raw.procesos.map((p: string) => ({ id: p, category: 'procesos', label: p })),
        ...raw.recursos.map((r: any) => ({ id: r.id, category: 'recursos', label: r.nombre, instances: r.instancias })),
      ];
      const edges: GraphEdge[] = [
        ...raw.asignaciones.map((a: any) => ({ from: a.recurso, to: a.proceso, kind: 'assignment' })),
        ...raw.solicitudes.map((s: any) => ({ from: s.proceso, to: s.recurso, kind: 'request' })),
      ];
      return {
        family: 'graph',
        props: { nodes, edges, cyclePath: raw.ciclo_detectado, notes: notesFrom(raw, ['procesos', 'recursos', 'asignaciones', 'solicitudes', 'ciclo_detectado']) },
      };
    },
  },

  dining_philosophers: {
    label: 'Filósofos cenando (grafo circular de recursos)',
    tema: 'Deadlock',
    adapt: (raw) => {
      const nodes: GraphNode[] = [
        ...raw.filosofos.map((f: string) => ({ id: f, category: 'filósofos', label: f })),
        ...raw.tenedores.map((t: string) => ({ id: t, category: 'tenedores', label: t })),
      ];
      const edges: GraphEdge[] = [
        ...raw.asignaciones.map(([tenedor, filosofo]: [string, string]) => ({ from: tenedor, to: filosofo, kind: 'assignment' })),
        ...raw.solicitudes.map(([filosofo, tenedor]: [string, string]) => ({ from: filosofo, to: tenedor, kind: 'request' })),
      ];
      return {
        family: 'graph',
        props: { nodes, edges, notes: notesFrom(raw, ['filosofos', 'tenedores', 'asignaciones', 'solicitudes']) },
      };
    },
  },

  resource_graph: {
    label: 'Grafo de asignación de recursos (genérico)',
    tema: 'Deadlock',
    adapt: (raw) => ({
      family: 'graph',
      props: {
        nodes: raw.nodes.map((n: any) => ({ id: n.id, category: n.type, label: n.label, instances: n.instances })),
        edges: raw.edges,
        notes: notesFrom(raw, ['nodes', 'edges']),
      },
    }),
  },
};
