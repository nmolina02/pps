import { notesFrom, type RegistryEntry, type SequenceStep } from './types';

/** Adaptadores para la familia `sequence`: la familia más reusada del banco —
 * cualquier `eventos`/`pasos`/`secuencia` ordenado en el tiempo. */
export const sequenceRegistry: Record<string, RegistryEntry> = {
  lost_wakeup_timeline: {
    label: 'Secuencia temporal productor-consumidor (señal perdida)',
    tema: 'Concurrencia',
    adapt: (raw) => ({
      family: 'sequence',
      props: {
        steps: raw.eventos.map((e: any) => ({ time: e.t, actor: e.actor, label: e.accion })),
        failIndex: raw.eventos.length - 1,
        notes: notesFrom(raw, ['eventos']),
      },
    }),
  },

  priority_inversion: {
    label: 'Línea temporal de inversión de prioridades',
    tema: 'Concurrencia y planificación',
    adapt: (raw) => ({
      family: 'sequence',
      props: {
        steps: raw.eventos.map((e: [string, string]) => ({ time: e[0], label: e[1] })),
        failIndex: raw.eventos.length - 1,
        notes: notesFrom(raw, ['eventos']),
      },
    }),
  },

  readers_writers: {
    label: 'Cola de lectores y escritores',
    tema: 'Concurrencia',
    adapt: (raw) => ({
      family: 'sequence',
      props: {
        steps: raw.eventos.map((e: [string, string]) => ({ time: e[0], label: e[1] })),
        failIndex: raw.eventos.length - 1,
        notes: notesFrom(raw, ['eventos']),
      },
    }),
  },

  write_cache_sequence: {
    label: 'Secuencia de escritura con caché',
    tema: 'File System',
    adapt: (raw) => {
      const eventos: string[][] = raw.eventos;
      const steps: SequenceStep[] = eventos.map((e) => (e.length === 3 ? { time: e[0], actor: e[1], label: e[2] } : { time: e[0], label: e[1] }));
      const failIndex = eventos.findIndex((e) => e.some((x) => /corte|incompleto/.test(x)));
      return { family: 'sequence', props: { steps, failIndex: failIndex >= 0 ? failIndex : undefined, notes: notesFrom(raw, ['eventos']) } };
    },
  },

  filesystem_transaction: {
    label: 'Transacción de journaling',
    tema: 'File System',
    adapt: (raw) => ({
      family: 'sequence',
      props: {
        steps: raw.pasos.map((p: string) => ({ label: p, state: p === raw.fallo_en ? ('fail' as const) : undefined })),
        failIndex: raw.pasos.indexOf(raw.fallo_en),
        notes: notesFrom(raw, ['pasos', 'fallo_en']),
      },
    }),
  },

  page_fault_sequence: {
    label: 'Secuencia de atención de page fault',
    tema: 'Memoria virtual',
    adapt: (raw) => ({
      family: 'sequence',
      props: { steps: raw.pasos.map((p: string) => ({ label: p, state: 'ok' as const })), notes: notesFrom(raw, ['pasos']) },
    }),
  },

  file_locking_sequence: {
    label: 'Lock de archivo y escritura atómica',
    tema: 'File System y concurrencia',
    adapt: (raw) => {
      const eventos: [string, string][] = raw.eventos;
      const idx = eventos.findIndex((e) => /lee/i.test(e[1]));
      return {
        family: 'sequence',
        props: { steps: eventos.map((e) => ({ time: e[0], label: e[1] })), failIndex: idx >= 0 ? idx : undefined, notes: notesFrom(raw, ['eventos']) },
      };
    },
  },

  privileged_instruction_fault: {
    label: 'Transición usuario-kernel por excepción',
    tema: 'Arquitectura y modos de ejecución',
    adapt: (raw) => ({
      family: 'sequence',
      props: {
        steps: [
          { label: `modo ${raw.modo_inicial}: intenta ejecutar ${raw.instruccion}` },
          { label: raw.resultado, state: 'fail' as const },
          ...raw.accion_so.map((a: string) => ({ label: a })),
        ],
        failIndex: 1,
        notes: notesFrom(raw, ['modo_inicial', 'instruccion', 'resultado', 'accion_so']),
      },
    }),
  },

  process_state_transition: {
    label: 'Diagrama de estados con syscall bloqueante',
    tema: 'Syscalls y estados de proceso',
    adapt: (raw) => ({
      family: 'sequence',
      props: {
        steps: raw.eventos.map((e: [string, string, string]) => ({ time: e[0], label: `${e[1]} → ${e[2]}` })),
        notes: notesFrom(raw, ['eventos']),
      },
    }),
  },

  mode_vs_context_switch: {
    label: 'Tabla de eventos modo/contexto',
    tema: 'Cambio de modo y cambio de contexto',
    adapt: (raw) => ({
      family: 'sequence',
      props: { steps: raw.secuencia.map((e: any) => ({ actor: e.proceso, label: `${e.evento} — modo ${e.modo}` })), notes: notesFrom(raw, ['secuencia']) },
    }),
  },

  nested_interrupt: {
    label: 'Anidamiento de interrupciones',
    tema: 'Interrupciones',
    adapt: (raw) => ({
      family: 'sequence',
      props: { steps: raw.pasos.map((p: string) => ({ label: p })), notes: notesFrom(raw, ['pasos']) },
    }),
  },

  boot_sequence: {
    label: 'Secuencia de arranque',
    tema: 'Boot Process',
    adapt: (raw) => {
      const pasos: { componente: string; estado: string }[] = raw.pasos;
      const steps = pasos.map((p) => ({
        label: p.componente,
        state: p.estado === 'ok' ? ('ok' as const) : p.estado === 'falla' ? ('fail' as const) : ('warn' as const),
      }));
      const failIndex = pasos.findIndex((p) => p.estado === 'falla');
      return { family: 'sequence', props: { steps, failIndex: failIndex >= 0 ? failIndex : undefined, notes: notesFrom(raw, ['pasos']) } };
    },
  },

  ult_blocking_without_jacketing: {
    label: 'Mapeo ULT-KLT sin jacketing',
    tema: 'Hilos',
    adapt: (raw) => ({
      family: 'sequence',
      props: {
        steps: [
          { label: `KLT ${raw.klt} multiplexa ULTs: ${raw.ults.join(', ')}` },
          { label: raw.evento },
          { label: `vista del kernel: ${raw.vista_kernel}`, state: 'fail' as const },
          ...Object.entries(raw.resultado).map(([u, st]) => ({ label: `${u}: ${st}` })),
        ],
        failIndex: 2,
        notes: notesFrom(raw, ['klt', 'ults', 'evento', 'vista_kernel', 'resultado']),
      },
    }),
  },

  ult_jacketing_sequence: {
    label: 'Secuencia de jacketing',
    tema: 'Hilos',
    adapt: (raw) => ({
      family: 'sequence',
      props: {
        steps: [
          { label: raw.evento },
          ...raw.biblioteca.map((b: string) => ({ label: b, state: 'ok' as const })),
          { label: `kernel: ${raw.kernel}`, state: 'ok' as const },
        ],
        notes: notesFrom(raw, ['evento', 'biblioteca', 'kernel']),
      },
    }),
  },

  livelock_sequence: {
    label: 'Secuencia repetitiva sin progreso (livelock)',
    tema: 'Deadlock y concurrencia',
    adapt: (raw) => ({
      family: 'sequence',
      props: { steps: raw.ciclo.map((group: string[]) => ({ label: group.join(' / ') })), loop: true, notes: notesFrom(raw, ['ciclo', 'procesos']) },
    }),
  },

  monitor_condition_variable: {
    label: 'Monitor con variable de condición',
    tema: 'Monitores',
    adapt: (raw) => ({
      family: 'sequence',
      props: { steps: raw.eventos.map((e: string[]) => ({ label: e[0] })), failIndex: raw.eventos.length - 1, notes: notesFrom(raw, ['eventos']) },
    }),
  },

  interleaving_trace: {
    label: 'Intercalado de instrucciones',
    tema: 'Concurrencia',
    adapt: (raw) => ({
      family: 'sequence',
      props: {
        steps: raw.pasos.map((p: [string, string, number]) => ({ actor: p[0], label: `${p[1]} (${p[2]})` })),
        notes: notesFrom(raw, ['pasos']),
      },
    }),
  },

  dma_cache_coherence: {
    label: 'Flujo DMA y caché',
    tema: 'Entrada/Salida y DMA',
    adapt: (raw) => ({
      family: 'sequence',
      props: { steps: [{ label: raw.evento }, { label: raw.riesgo, state: 'fail' as const }], failIndex: 1, notes: notesFrom(raw, ['evento', 'riesgo']) },
    }),
  },

  setuid_flow: {
    label: 'Flujo de UID real/efectivo',
    tema: 'Protección y seguridad',
    adapt: (raw) => ({
      family: 'sequence',
      props: {
        steps: [
          { label: `UID real=${raw.usuario.uid_real}, UID efectivo=${raw.usuario.uid_efectivo_inicial}` },
          { label: `ejecuta binario setuid de ${raw.ejecutable.owner}` },
          { label: `durante ejecución: UID efectivo=${raw.durante_ejecucion.uid_efectivo}` },
          { label: raw.fallo, state: 'fail' as const },
        ],
        failIndex: 3,
        notes: notesFrom(raw, ['usuario', 'ejecutable', 'durante_ejecucion', 'fallo']),
      },
    }),
  },

  long_term_scheduler: {
    label: 'Cola de admisión (planificador de largo plazo)',
    tema: 'Planificación de largo plazo',
    adapt: (raw) => ({
      family: 'sequence',
      props: {
        steps: [
          { label: `grado máximo de multiprogramación alcanzado (${raw.grado_maximo}): ${raw.activos.join(', ')}` },
          { label: `${raw.nuevo} llega y queda en ${raw.estado_p6}`, state: 'warn' as const },
          { label: `condición para admitir: ${raw.condicion_para_admitir}` },
          { label: `transición: ${raw.transicion}`, state: 'ok' as const },
        ],
        notes: notesFrom(raw, ['grado_maximo', 'activos', 'nuevo', 'estado_p6', 'condicion_para_admitir', 'transicion']),
      },
    }),
  },

  round_robin_overhead: {
    label: 'Línea de tiempo Round Robin con overhead',
    tema: 'Planificación',
    adapt: (raw) => ({
      family: 'sequence',
      props: {
        steps: raw.secuencia.map((tok: string) => ({ label: tok === 'CS' ? 'cambio de contexto' : tok, state: tok === 'CS' ? ('warn' as const) : undefined })),
        notes: notesFrom(raw, ['secuencia']),
      },
    }),
  },

  page_table_permissions: {
    label: 'Tabla de páginas con permisos',
    tema: 'Memoria virtual',
    adapt: (raw) => ({
      family: 'sequence',
      props: {
        steps: [
          { label: `VPN ${raw.entrada.vpn}: presente=${raw.entrada.presente}, permisos=${raw.entrada.permisos}` },
          { label: `operación: ${raw.operacion}` },
          { label: raw.resultado, state: 'fail' as const },
        ],
        failIndex: 2,
        notes: notesFrom(raw, ['entrada', 'operacion', 'resultado']),
      },
    }),
  },

  io_ring_buffer: {
    label: 'Buffer circular de E/S',
    tema: 'Entrada/Salida',
    adapt: (raw) => ({
      family: 'sequence',
      props: {
        steps: raw.eventos.map((e: [string, string]) => ({ time: e[0], label: e[1] })),
        failIndex: raw.eventos.length - 1,
        notes: notesFrom(raw, ['eventos']),
      },
    }),
  },

  fs_sequence: {
    label: 'Secuencia de escritura en filesystem',
    tema: 'File System',
    adapt: (raw) => ({
      family: 'sequence',
      props: { steps: raw.steps.map((s: any) => ({ actor: `${s.from} → ${s.to}`, label: s.label ?? '' })) },
    }),
  },
};
