import { notesFrom, type RegistryEntry, type TreeNodeData } from './types';

function buildTreeFromRelations(relaciones: { padre: number; hijo: number }[], estados: Record<string, string> = {}): TreeNodeData {
  const childrenOf = new Map<number, number[]>();
  const allHijos = new Set<number>();
  relaciones.forEach((r) => {
    if (!childrenOf.has(r.padre)) childrenOf.set(r.padre, []);
    childrenOf.get(r.padre)!.push(r.hijo);
    allHijos.add(r.hijo);
  });
  const rootId = relaciones.find((r) => !allHijos.has(r.padre))?.padre ?? relaciones[0]?.padre;
  function build(id: number): TreeNodeData {
    return { id: String(id), label: `pid ${id}`, state: estados[String(id)], children: (childrenOf.get(id) ?? []).map(build) };
  }
  return build(rootId);
}

function pageMapLabel(map: Record<string, any>): string {
  return Object.entries(map)
    .map(([vpn, info]) => `${vpn}→frame ${info.frame} (${info.perm}${info.cow ? ', COW' : ''})`)
    .join('; ');
}

/** Adaptadores para la familia `tree`: jerarquía padre/hijo o cadena lineal,
 * con soporte para antes/después lado a lado. */
export const treeRegistry: Record<string, RegistryEntry> = {
  process_tree_zombies: {
    label: 'Árbol de procesos y tabla de procesos',
    tema: 'Procesos',
    adapt: (raw) => ({
      family: 'tree',
      props: {
        trees: [
          {
            root: {
              id: String(raw.padre.pid),
              label: `${raw.padre.nombre} (${raw.padre.pid})`,
              state: raw.padre.estado,
              children: raw.hijos.map((h: any) => ({ id: String(h.pid), label: `pid ${h.pid}`, state: h.estado })),
            },
          },
        ],
        notes: notesFrom(raw, ['padre', 'hijos']),
      },
    }),
  },

  process_reparenting: {
    label: 'Árbol de procesos antes y después',
    tema: 'Procesos',
    adapt: (raw) => ({
      family: 'tree',
      props: {
        trees: [
          { title: 'antes', root: buildTreeFromRelations(raw.antes.relaciones, raw.antes.estados) },
          { title: 'después', root: buildTreeFromRelations(raw.despues.relaciones, raw.despues.estados) },
        ],
        notes: notesFrom(raw, ['antes', 'despues']),
      },
    }),
  },

  buddy_system: {
    label: 'Árbol de Buddy System',
    tema: 'Memoria',
    adapt: (raw) => ({
      family: 'tree',
      props: {
        trees: [
          {
            root: {
              id: 'root',
              label: `${raw.bloque_inicial_kb} KB`,
              children: [
                { id: 'a', label: `${raw.bloque_asignado_kb} KB — asignado (desperdicio ${raw.desperdicio_kb} KB)`, state: 'process' },
                { id: 'b', label: `${raw.bloque_inicial_kb - raw.bloque_asignado_kb} KB — libre`, state: 'free' },
              ],
            },
          },
        ],
        notes: notesFrom(raw, ['bloque_inicial_kb', 'bloque_asignado_kb', 'desperdicio_kb']),
      },
    }),
  },

  copy_on_write: {
    label: 'Compartición y copia de páginas (COW)',
    tema: 'Memoria virtual',
    adapt: (raw) => ({
      family: 'tree',
      props: {
        trees: [
          {
            title: 'antes',
            root: {
              id: 'a-root',
              label: 'proceso',
              children: [
                { id: 'a-padre', label: `padre: ${pageMapLabel(raw.antes.padre)}` },
                { id: 'a-hijo', label: `hijo: ${pageMapLabel(raw.antes.hijo)}` },
              ],
            },
          },
          {
            title: 'después',
            root: {
              id: 'd-root',
              label: 'proceso',
              children: [
                { id: 'd-padre', label: `padre: ${pageMapLabel(raw.despues.padre)}` },
                { id: 'd-hijo', label: `hijo: ${pageMapLabel(raw.despues.hijo)}`, state: 'process' },
              ],
            },
          },
        ],
        notes: notesFrom(raw, ['antes', 'despues']),
      },
    }),
  },

  links_inode: {
    label: 'Inodo y enlaces',
    tema: 'File System',
    adapt: (raw) => ({
      family: 'tree',
      props: {
        trees: [
          {
            title: 'antes',
            root: {
              id: 'inodo-antes',
              label: `inodo ${raw.inodo}`,
              children: Object.entries(raw.entradas_antes).map(([name, val]) => ({ id: name, label: `${name} → ${val}` })),
            },
          },
          {
            title: 'después',
            root: {
              id: 'inodo-despues',
              label: `inodo ${raw.inodo} (link_count=${raw.link_count})`,
              children: Object.entries(raw.entradas_despues).map(([name, val]) => ({ id: name, label: `${name} → ${val}` })),
            },
          },
        ],
        notes: notesFrom(raw, ['entradas_antes', 'entradas_despues', 'inodo', 'link_count']),
      },
    }),
  },

  fat_chain: {
    label: 'Cadena de clusters FAT',
    tema: 'File System',
    adapt: (raw) => {
      const esperado: number[] = raw.esperado;
      let node: TreeNodeData | null = null;
      for (let i = esperado.length - 1; i >= 0; i--) {
        const cluster = esperado[i];
        const fatEntry = raw.fat[String(cluster)];
        const isCorrupt = typeof fatEntry === 'string' && fatEntry.includes('corrupto');
        node = { id: String(cluster), label: `cluster ${cluster}`, state: isCorrupt ? 'fail' : undefined, children: node ? [node] : [] };
      }
      return { family: 'tree', props: { trees: [{ title: raw.archivo, root: node! }], notes: notesFrom(raw, ['esperado', 'fat', 'directorio']) } };
    },
  },

  unix_permissions_path: {
    label: 'Árbol de directorios con permisos',
    tema: 'File System y protección',
    adapt: (raw) => {
      const ruta: string[] = raw.ruta;
      let node: TreeNodeData | null = null;
      for (let i = ruta.length - 1; i >= 0; i--) {
        const seg = ruta[i];
        const perm = raw.permisos[seg];
        node = { id: `${i}-${seg}`, label: perm ? `${seg} (${perm})` : seg, state: seg === raw.fallo_en ? 'fail' : undefined, children: node ? [node] : [] };
      }
      return { family: 'tree', props: { trees: [{ root: node! }], notes: notesFrom(raw, ['ruta', 'permisos']) } };
    },
  },

  memory_mapped_file: {
    label: 'Mapa archivo-páginas (mmap)',
    tema: 'Memoria virtual y File System',
    adapt: (raw) => {
      const vpns: number[] = raw.mapeo.vpn;
      const offsets: string[] = raw.mapeo.offsets;
      return {
        family: 'tree',
        props: {
          trees: [
            {
              root: {
                id: 'archivo',
                label: raw.archivo,
                children: vpns.map((vpn, i) => ({ id: String(vpn), label: `VPN ${vpn} (${offsets[i]})`, state: String(raw.evento).includes(String(vpn)) ? 'fail' : undefined })),
              },
            },
          ],
          notes: notesFrom(raw, ['mapeo']),
        },
      };
    },
  },
};
