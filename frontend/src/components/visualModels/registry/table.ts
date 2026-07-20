import { notesFrom, type RegistryEntry } from './types';

const toFields = (obj: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, Array.isArray(v) ? v.join(', ') : (v as any)]));

/** Adaptadores para la familia `table`: filas de registros, comparación
 * transpuesta por columnas, o colas nombradas. */
export const tableRegistry: Record<string, RegistryEntry> = {
  priority_queue_aging: {
    label: 'Cola de listos con prioridades y aging',
    tema: 'Planificación',
    adapt: (raw) => ({
      family: 'table',
      props: {
        mode: 'rows',
        rows: raw.procesos,
        highlightRow: raw.procesos.findIndex((p: any) => p.espera !== undefined),
        notes: notesFrom(raw, ['procesos']),
      },
    }),
  },

  hrrn_table: {
    label: 'Tabla de response ratio (HRRN)',
    tema: 'Planificación',
    adapt: (raw) => ({
      family: 'table',
      props: { mode: 'rows', rows: raw.procesos, highlightRow: raw.procesos.findIndex((p: any) => p.id === raw.seleccion), notes: notesFrom(raw, ['procesos']) },
    }),
  },

  bankers_algorithm: {
    label: 'Matriz de asignación/necesidad (algoritmo del banquero)',
    tema: 'Deadlock',
    adapt: (raw) => ({
      family: 'table',
      props: {
        mode: 'rows',
        rows: raw.procesos,
        highlightRow: raw.procesos.findIndex((p: any) => p.id === raw.solicitud?.proceso),
        notes: notesFrom(raw, ['procesos']),
      },
    }),
  },

  multilevel_feedback_queue: {
    label: 'Colas multinivel con feedback',
    tema: 'Planificación',
    adapt: (raw) => ({ family: 'table', props: { mode: 'rows', rows: raw.colas, notes: notesFrom(raw, ['colas']) } }),
  },

  virtual_round_robin: {
    label: 'Cola Ready y cola auxiliar (Virtual Round Robin)',
    tema: 'Planificación',
    adapt: (raw) => ({
      family: 'table',
      props: {
        mode: 'queues',
        queues: Object.entries(raw.colas).map(([name, items]) => ({ name, items: items as string[] })),
        notes: notesFrom(raw, ['colas']),
      },
    }),
  },

  io_techniques_comparison: {
    label: 'Comparación E/S programada, interrupciones y DMA',
    tema: 'Entrada/Salida',
    adapt: (raw) => ({
      family: 'table',
      props: {
        mode: 'columns',
        columns: raw.tecnicas.map((t: any) => {
          const { nombre, ...fields } = t;
          return { name: nombre, fields };
        }),
        notes: notesFrom(raw, ['tecnicas']),
      },
    }),
  },

  io_classification_matrix: {
    label: 'Matriz de clasificación de E/S',
    tema: 'Entrada/Salida',
    adapt: (raw) => ({
      family: 'table',
      props: { mode: 'columns', columns: [{ name: 'caso analizado', fields: raw.caso }], notes: notesFrom(raw, ['caso']) },
    }),
  },

  kernel_architecture_comparison: {
    label: 'Capas monolítico vs microkernel',
    tema: 'Arquitectura de Kernel',
    adapt: (raw) => ({
      family: 'table',
      props: {
        mode: 'columns',
        columns: [
          { name: 'monolítico', fields: toFields(raw.monolitico) },
          { name: 'microkernel', fields: toFields(raw.microkernel) },
        ],
        notes: notesFrom(raw, ['monolitico', 'microkernel']),
      },
    }),
  },

  raid_comparison: {
    label: 'Distribución de stripes (RAID)',
    tema: 'Entrada/Salida',
    adapt: (raw) => ({
      family: 'table',
      props: { mode: 'columns', columns: [{ name: 'RAID 0', fields: raw.raid0 }], notes: notesFrom(raw, ['raid0']) },
    }),
  },

  bernstein_conditions: {
    label: 'Conjuntos R/W de instrucciones (Bernstein)',
    tema: 'Sincronización',
    adapt: (raw) => ({
      family: 'table',
      props: {
        mode: 'rows',
        rows: raw.sentencias.map((s: any) => ({ id: s.id, lee: s.lee.join(', '), escribe: s.escribe.join(', ') })),
        notes: notesFrom(raw, ['sentencias']),
      },
    }),
  },

  test_and_set_spinlock: {
    label: 'Spinlock con test-and-set',
    tema: 'Sincronización',
    adapt: (raw) => ({ family: 'table', props: { mode: 'rows', rows: raw.hilos, notes: notesFrom(raw, ['hilos']) } }),
  },

  thread_mapping: {
    label: 'Mapeo ULT-KLT y cores',
    tema: 'Hilos',
    adapt: (raw) => ({
      family: 'table',
      props: {
        mode: 'queues',
        queues: [
          { name: 'ULTs', items: raw.ults },
          { name: 'KLTs', items: raw.klts },
        ],
        notes: notesFrom(raw, ['ults', 'klts']),
      },
    }),
  },

  tlb_context_switch: {
    label: 'TLB antes y después del cambio de contexto',
    tema: 'Memoria virtual',
    adapt: (raw) => ({ family: 'table', props: { mode: 'rows', rows: raw.antes.tlb, notes: notesFrom(raw, ['antes']) } }),
  },

  inverted_page_table_hash: {
    label: 'Hash sobre tabla invertida',
    tema: 'Memoria virtual',
    adapt: (raw) => ({
      family: 'table',
      props: {
        mode: 'rows',
        rows: raw.hash_bucket,
        highlightRow: raw.hash_bucket.findIndex((e: any) => e.pid === raw.busqueda?.pid),
        notes: notesFrom(raw, ['hash_bucket']),
      },
    }),
  },

  page_replacement_table: {
    label: 'Tabla de reemplazo de páginas',
    tema: 'Memoria virtual',
    adapt: (raw) => ({ family: 'table', props: { mode: 'rows', rows: raw.simulaciones, notes: notesFrom(raw, ['simulaciones']) } }),
  },

  thrashing_curve: {
    label: 'Curva multiprogramación vs utilización de CPU',
    tema: 'Memoria virtual',
    adapt: (raw) => ({ family: 'table', props: { mode: 'rows', rows: raw.puntos, notes: notesFrom(raw, ['puntos']) } }),
  },

  open_file_tables: {
    label: 'Tabla de archivos abiertos',
    tema: 'File System',
    adapt: (raw) => ({
      family: 'table',
      props: {
        mode: 'columns',
        columns: [{ name: raw.proceso, fields: { limite_fd: raw.limite_fd, fd_abiertos: raw.fd_abiertos, fallo: raw.fallo, causa: raw.causa } }],
        notes: notesFrom(raw, ['proceso', 'limite_fd', 'fd_abiertos', 'fallo', 'causa']),
      },
    }),
  },

  syscall_overhead: {
    label: 'Secuencia syscall vs buffering',
    tema: 'Sistema operativo y E/S',
    adapt: (raw) => ({
      family: 'table',
      props: {
        mode: 'columns',
        columns: [
          { name: 'patrón malo', fields: raw.patron_malo },
          { name: 'patrón mejor', fields: raw.patron_mejor },
        ],
        notes: notesFrom(raw, ['patron_malo', 'patron_mejor']),
      },
    }),
  },

  prepaging_scenario: {
    label: 'Comparación demand paging vs prepaging',
    tema: 'Memoria virtual',
    adapt: (raw) => {
      const rows = raw.prepaging_carga.map((p: number) => ({ pagina: p, usada: raw.uso_real.includes(p) }));
      return { family: 'table', props: { mode: 'rows', rows, notes: notesFrom(raw, ['prepaging_carga', 'uso_real', 'desperdicio']) } };
    },
  },

  priority_queue_timeline: {
    label: 'Cola de prioridad con línea de tiempo',
    tema: 'Planificación',
    adapt: (raw) => ({
      family: 'table',
      props: {
        mode: 'rows',
        rows: raw.procesos.map((p: any) => ({ id: p.id, prioridad_inicial: p.prioridad_inicial, tipo: p.tipo })),
        notes: notesFrom(raw, ['procesos']),
      },
    }),
  },
};
