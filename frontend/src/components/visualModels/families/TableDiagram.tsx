import type { TableCell, TableFamilyData } from '../registry/types';
import { DiagramNotes } from './GenericFallback';
import { usePlayback } from './playback/usePlayback';
import { PlaybackControls } from './playback/PlaybackControls';
import type { Playback } from './playback/usePlayback';

const cellStyle: React.CSSProperties = {
  padding: '7px 12px',
  borderBottom: '1px solid var(--border)',
  fontSize: '0.82rem',
  whiteSpace: 'nowrap',
};

const headStyle: React.CSSProperties = {
  ...cellStyle,
  borderBottom: '1px solid var(--border-strong)',
  color: 'var(--text-dim)',
  fontSize: '0.72rem',
  textTransform: 'uppercase',
  letterSpacing: '0.03em',
};

function formatCell(v: TableCell): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'boolean') return v ? 'sí' : 'no';
  return String(v);
}

function RowsTable({ rows, highlightRow, playback }: { rows: Record<string, TableCell>[]; highlightRow?: number; playback: Playback }) {
  const columns: string[] = [];
  rows.forEach((r) => Object.keys(r).forEach((k) => !columns.includes(k) && columns.push(k)));
  // En reproducción, la fila "actual" recorre la tabla una por una en vez del
  // resaltado fijo — ayuda a comparar candidatos de a uno (HRRN, banquero, ...).
  const effectiveHighlight = playback.active ? playback.index : highlightRow;
  return (
    <table style={{ borderCollapse: 'collapse', width: '100%' }} className="mono">
      <thead>
        <tr>
          {columns.map((c) => (
            <th key={c} style={{ ...headStyle, textAlign: 'left' }}>
              {c}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} style={{ background: i === effectiveHighlight ? 'var(--accent-soft)' : undefined }}>
            {columns.map((c) => (
              <td key={c} style={{ ...cellStyle, color: i === effectiveHighlight ? 'var(--accent-strong)' : 'var(--text)' }}>
                {formatCell(r[c])}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ColumnsTable({ columns, playback }: { columns: { name: string; fields: Record<string, TableCell> }[]; playback: Playback }) {
  const visible = playback.active ? columns.slice(0, playback.index + 1) : columns;
  const attrs: string[] = [];
  columns.forEach((c) => Object.keys(c.fields).forEach((k) => !attrs.includes(k) && attrs.push(k)));
  return (
    <table style={{ borderCollapse: 'collapse', width: '100%' }} className="mono">
      <thead>
        <tr>
          <th style={headStyle} />
          {visible.map((c, i) => (
            <th
              key={c.name}
              style={{ ...headStyle, textAlign: 'left', color: playback.active && i === visible.length - 1 ? 'var(--text)' : 'var(--accent-strong)' }}
            >
              {c.name}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {attrs.map((attr) => (
          <tr key={attr}>
            <td style={{ ...cellStyle, color: 'var(--text-dim)' }}>{attr}</td>
            {visible.map((c) => (
              <td key={c.name} style={cellStyle}>
                {formatCell(c.fields[attr])}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function QueuesView({ queues, playback }: { queues: { name: string; items: string[] }[]; playback: Playback }) {
  const visible = playback.active ? queues.slice(0, playback.index + 1) : queues;
  return (
    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
      {visible.map((q, i) => {
        const isCurrent = playback.active && i === visible.length - 1;
        return (
          <div
            key={q.name}
            style={{
              flex: '1 1 200px',
              padding: '10px 14px',
              border: `1px solid ${isCurrent ? 'var(--accent-strong)' : 'var(--border-strong)'}`,
              borderRadius: 4,
            }}
          >
            <p className="mono" style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginBottom: 8 }}>
              {q.name}
            </p>
            {q.items.length === 0 ? (
              <p className="mono" style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
                vacía
              </p>
            ) : (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {q.items.map((item, j) => (
                  <span
                    key={j}
                    className="mono"
                    style={{
                      padding: '3px 9px',
                      borderRadius: 3,
                      background: 'var(--bg-inset)',
                      border: '1px solid var(--border)',
                      fontSize: '0.78rem',
                    }}
                  >
                    {item}
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Filas de registros, comparación transpuesta por columnas, o colas nombradas
 * con chips ordenados. Cubre matrices, tablas comparativas y colas del banco de
 * casos (HRRN, algoritmo del banquero, comparaciones de E/S, colas multinivel, ...).
 * Con reproducción paso a paso: en modo filas, el resaltado recorre una fila por
 * vez (guía la atención al comparar candidatos); en columnas/colas, se van
 * agregando de a una (construye la comparación en vez de mostrarla de entrada). */
export function TableDiagram({ data }: { data: TableFamilyData }) {
  const total = data.mode === 'rows' ? (data.rows?.length ?? 0) : data.mode === 'columns' ? (data.columns?.length ?? 0) : (data.queues?.length ?? 0);
  const playback = usePlayback(total);

  return (
    <div style={{ overflowX: 'auto' }}>
      {data.mode === 'rows' && <RowsTable rows={data.rows ?? []} highlightRow={data.highlightRow} playback={playback} />}
      {data.mode === 'columns' && <ColumnsTable columns={data.columns ?? []} playback={playback} />}
      {data.mode === 'queues' && <QueuesView queues={data.queues ?? []} playback={playback} />}
      <PlaybackControls playback={playback} />
      <DiagramNotes notes={data.notes} />
    </div>
  );
}
