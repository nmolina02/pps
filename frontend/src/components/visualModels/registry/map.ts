import { notesFrom, type MapRegion, type RegistryEntry } from './types';

/** Adaptadores para la familia `map`: rangos numéricos (memoria, particiones,
 * segmentos) o posiciones en una recta (brazo de disco). */
export const mapRegistry: Record<string, RegistryEntry> = {
  memory_map_external_fragmentation: {
    label: 'Mapa de memoria con huecos (fragmentación externa)',
    tema: 'Memoria real',
    adapt: (raw) => {
      const regions: MapRegion[] = raw.segmentos.map(([range, label]: [string, string]) => {
        const [s, e] = range.split('-').map(Number);
        return { label, start: s, end: e, kind: label.toLowerCase().includes('libre') ? 'free' : 'process' };
      });
      const totalSize = Math.max(...regions.map((r) => r.end));
      return { family: 'map', props: { mode: 'range', totalSize, unit: raw.unidad, regions, notes: notesFrom(raw, ['segmentos', 'unidad']) } };
    },
  },

  fixed_partition_map: {
    label: 'Particiones fijas (fragmentación interna)',
    tema: 'Memoria real',
    adapt: (raw) => {
      const size = raw.particion_mb;
      const regions: MapRegion[] = [];
      raw.particiones.forEach((p: any, i: number) => {
        const base = i * size;
        regions.push({ label: p.proceso, start: base, end: base + p.usado, kind: 'process' });
        if (p.desperdicio > 0) regions.push({ label: 'desperdicio', start: base + p.usado, end: base + size, kind: 'free' });
      });
      return {
        family: 'map',
        props: { mode: 'range', totalSize: raw.particiones.length * size, unit: 'MB', regions, notes: notesFrom(raw, ['particiones', 'particion_mb']) },
      };
    },
  },

  memory_protection: {
    label: 'Espacios de direcciones aislados',
    tema: 'Memoria',
    adapt: (raw) => {
      const regions: MapRegion[] = raw.procesos.map((p: any) => {
        const [s, e] = p.rango.split('-').map(Number);
        return { label: p.id, start: s, end: e + 1, kind: 'process' };
      });
      const totalSize = Math.max(...regions.map((r) => r.end));
      return { family: 'map', props: { mode: 'range', totalSize, unit: 'bytes', regions, notes: notesFrom(raw, ['procesos']) } };
    },
  },

  segmentation_check: {
    label: 'Tabla de segmentos',
    tema: 'Memoria',
    adapt: (raw) => {
      const regions: MapRegion[] = raw.segmentos.map((s: any) => ({
        label: `${s.nombre} (seg ${s.id})`,
        start: s.base,
        end: s.base + s.limite,
        kind: s.id === raw.direccion?.segmento ? 'system' : 'process',
      }));
      const totalSize = Math.max(...regions.map((r) => r.end));
      return { family: 'map', props: { mode: 'range', totalSize, unit: 'bytes', regions, notes: notesFrom(raw, ['segmentos']) } };
    },
  },

  disk_scheduling: {
    label: 'Recorrido del brazo de disco',
    tema: 'Entrada/Salida',
    adapt: (raw) => {
      const atendidas: number[] = raw.atendidas ?? [];
      const points = raw.solicitudes.map((v: number) => ({
        value: v,
        order: atendidas.indexOf(v) !== -1 ? atendidas.indexOf(v) + 1 : undefined,
        kind: v === raw.postergada ? 'postergada' : undefined,
      }));
      return {
        family: 'map',
        props: { mode: 'line', points, initial: raw.cabezal_inicial, notes: notesFrom(raw, ['solicitudes', 'atendidas', 'cabezal_inicial', 'postergada']) },
      };
    },
  },

  memory_map: {
    label: 'Mapa de memoria virtual',
    tema: 'Memoria virtual',
    adapt: (raw) => ({
      family: 'map',
      props: {
        mode: 'range',
        totalSize: raw.totalSize,
        unit: raw.unit,
        regions: raw.regions.map((r: any) => ({ label: r.label, start: r.start, end: r.start + r.size, kind: r.kind })),
      },
    }),
  },
};
