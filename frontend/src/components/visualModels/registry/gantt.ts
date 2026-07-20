import { notesFrom, type RegistryEntry } from './types';

/** Adaptadores para la familia `gantt`: barras de proceso en eje temporal. */
export const ganttRegistry: Record<string, RegistryEntry> = {
  gantt_comparativo: {
    label: 'Diagrama de Gantt comparativo (FCFS)',
    tema: 'Planificación',
    adapt: (raw) => ({
      family: 'gantt',
      props: {
        series: [{ name: 'FCFS', segments: raw.fcfs.map((f: any) => ({ process: f.p, start: f.ini, end: f.fin })) }],
        notes: notesFrom(raw, ['fcfs']),
      },
    }),
  },

  cpu_timeline: {
    label: 'Línea de tiempo de planificación',
    tema: 'Planificación',
    adapt: (raw) => ({
      family: 'gantt',
      props: { series: [{ segments: raw.segments }] },
    }),
  },
};
