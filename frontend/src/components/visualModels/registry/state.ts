import { notesFrom, type RegistryEntry, type StateNodeData, type StateTransitionData } from './types';

/** Adaptadores para la familia `state`: estados + transiciones (válidas o no). */
export const stateRegistry: Record<string, RegistryEntry> = {
  seven_state_model: {
    label: 'Diagrama de siete estados (suspensión)',
    tema: 'Planificación',
    adapt: (raw) => {
      const states: StateNodeData[] = [
        { id: 's0', label: raw.estado_inicial },
        { id: 's1', label: raw.estado_intermedio },
        { id: 's2', label: raw.estado_final },
      ];
      const transitions: StateTransitionData[] = [
        { from: 's0', to: 's1', label: raw.evento },
        { from: 's1', to: 's2', label: raw.evento_siguiente },
      ];
      return {
        family: 'state',
        props: { states, transitions, notes: notesFrom(raw, ['estado_inicial', 'evento', 'estado_intermedio', 'evento_siguiente', 'estado_final']) },
      };
    },
  },

  state_transition_validation: {
    label: 'Diagrama de estados corregido',
    tema: 'Procesos',
    adapt: (raw) => {
      const seq: string[] = raw.secuencia_correcta;
      const states: StateNodeData[] = seq.map((s) => ({ id: s, label: s }));
      const transitions: StateTransitionData[] = [];
      for (let i = 0; i < seq.length - 1; i++) {
        transitions.push({ from: seq[i], to: seq[i + 1], label: i === seq.length - 2 ? raw.evento_bloqueante : undefined });
      }
      const [pf, pt] = String(raw.transicion_propuesta).split('->').map((s: string) => s.trim());
      if (pf && !states.find((s) => s.id === pf)) states.push({ id: pf, label: pf });
      if (pt && !states.find((s) => s.id === pt)) states.push({ id: pt, label: pt });
      if (pf && pt) transitions.push({ from: pf, to: pt, label: 'propuesta (inválida)', invalid: true });
      return {
        family: 'state',
        props: { states, transitions, notes: notesFrom(raw, ['transicion_propuesta', 'secuencia_correcta', 'evento_bloqueante']) },
      };
    },
  },

  process_states: {
    label: 'Diagrama de estados de procesos',
    tema: 'Procesos',
    adapt: (raw) => ({
      family: 'state',
      props: { states: raw.states, transitions: raw.transitions, highlight: raw.highlight },
    }),
  },
};
