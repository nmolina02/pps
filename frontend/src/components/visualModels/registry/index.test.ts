import { describe, expect, it } from 'vitest';
import { REGISTRY, REGISTRY_EXAMPLES, examplesByTema, sniffShape } from './index';

describe('REGISTRY adapters', () => {
  const tipos = Object.keys(REGISTRY);

  it('has at least one registered tipo', () => {
    expect(tipos.length).toBeGreaterThan(0);
  });

  it.each(tipos)('every registered tipo has an example payload (%s)', (tipo) => {
    expect(REGISTRY_EXAMPLES).toHaveProperty(tipo);
  });

  it.each(tipos)('adapts its own example without throwing and matches its declared family (%s)', (tipo) => {
    const entry = REGISTRY[tipo];
    const example = REGISTRY_EXAMPLES[tipo];
    expect(example).toBeDefined();

    const result = entry.adapt(example);
    expect(['graph', 'state', 'gantt', 'map', 'sequence', 'table', 'tree']).toContain(result.family);
  });

  it('resource_allocation_graph maps procesos/recursos into nodes and preserves the cycle', () => {
    const result = REGISTRY.resource_allocation_graph.adapt(REGISTRY_EXAMPLES.resource_allocation_graph);
    expect(result.family).toBe('graph');
    if (result.family !== 'graph') throw new Error('unreachable');
    expect(result.props.nodes.map((n) => n.id)).toEqual(expect.arrayContaining(['P1', 'P2', 'R1', 'R2']));
    expect(result.props.cyclePath).toEqual(['P1', 'R2', 'P2', 'R1', 'P1']);
    // Todo lo que el adaptador no consume explícitamente cae en notas, nada se pierde.
    expect(result.props.notes?.some((n) => n.label === 'estrategia_prevencion')).toBe(true);
  });
});

describe('examplesByTema', () => {
  it('groups every registered tipo under some tema, sorted alphabetically by tema', () => {
    const groups = examplesByTema();
    const totalItems = groups.reduce((sum, g) => sum + g.items.length, 0);
    expect(totalItems).toBe(Object.keys(REGISTRY).length);

    const temas = groups.map((g) => g.tema);
    expect(temas).toEqual([...temas].sort((a, b) => a.localeCompare(b)));
  });
});

describe('sniffShape', () => {
  it('infers a graph from nodes+edges', () => {
    const result = sniffShape({ nodes: [{ id: 'A' }], edges: [{ from: 'A', to: 'B' }] });
    expect(result?.family).toBe('graph');
  });

  it('infers a state machine from states+transitions', () => {
    const result = sniffShape({ states: [{ id: 'READY' }], transitions: [{ from: 'READY', to: 'RUNNING' }] });
    expect(result?.family).toBe('state');
  });

  it('infers a gantt chart from segments', () => {
    const result = sniffShape({ segments: [{ process: 'P1', start: 0, end: 5 }] });
    expect(result?.family).toBe('gantt');
  });

  it('infers a range map from regions+totalSize', () => {
    const result = sniffShape({ totalSize: 100, regions: [{ label: 'SO', start: 0, size: 20 }] });
    expect(result?.family).toBe('map');
    if (result?.family !== 'map') throw new Error('unreachable');
    expect(result.props.regions?.[0]).toMatchObject({ label: 'SO', start: 0, end: 20 });
  });

  it('infers a sequence from any of the recognized event key names', () => {
    expect(sniffShape({ eventos: ['a', 'b'] })?.family).toBe('sequence');
    expect(sniffShape({ pasos: ['a'] })?.family).toBe('sequence');
    expect(sniffShape({ secuencia: ['a'] })?.family).toBe('sequence');
  });

  it('normalizes a 3-tuple event into {time, actor, label}', () => {
    const result = sniffShape({ eventos: [['t0', 'P1', 'entra a la región crítica']] });
    expect(result?.family).toBe('sequence');
    if (result?.family !== 'sequence') throw new Error('unreachable');
    expect(result.props.steps[0]).toEqual({ time: 't0', actor: 'P1', label: 'entra a la región crítica' });
  });

  it('infers a table from an array of plain-object rows when nothing else matches', () => {
    const result = sniffShape({ filas: [{ proceso: 'P1', estado: 'listo' }] });
    expect(result?.family).toBe('table');
  });

  it('infers a tree from a nested {children} structure', () => {
    const result = sniffShape({ arbol: { id: 'root', children: [{ id: 'child' }] } });
    expect(result?.family).toBe('tree');
  });

  it('returns null when nothing recognizable matches', () => {
    expect(sniffShape({ foo: 'bar', count: 3 })).toBeNull();
  });

  it('prioritizes graph shape over other equally-plausible matches', () => {
    // Tiene nodes/edges (graph) Y una lista de filas (table) — graph gana por ir primero en la cascada.
    const result = sniffShape({ nodes: [{ id: 'A' }], edges: [], filas: [{ x: 1 }] });
    expect(result?.family).toBe('graph');
  });
});
