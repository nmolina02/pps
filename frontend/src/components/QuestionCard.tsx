import { useState } from 'react';
import type { Question } from '../api/types';

const TYPE_LABELS: Record<Question['question_type'], string> = {
  single_choice: 'opción única',
  multiple_choice: 'opción múltiple',
  fill_blank: 'completar',
};

export function QuestionCard({ question, index }: { question: Question; index: number }) {
  const [revealed, setRevealed] = useState(false);

  return (
    <div className="panel" style={{ padding: '20px 22px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <p className="mono" style={{ color: 'var(--text-dim)', fontSize: '0.78rem' }}>
          pregunta {String(index + 1).padStart(2, '0')}
        </p>
        <span className="chip">{TYPE_LABELS[question.question_type]}</span>
      </div>

      <p style={{ color: 'var(--text)', marginTop: 10, fontSize: '1rem' }}>{question.text}</p>

      {question.question_type !== 'fill_blank' && (
        <ul style={{ listStyle: 'none', padding: 0, margin: '14px 0 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {question.options.map((opt) => {
            const showCorrect = revealed && opt.is_correct;
            return (
              <li
                key={opt.id}
                className="mono"
                style={{
                  fontSize: '0.88rem',
                  padding: '8px 12px',
                  borderRadius: 3,
                  border: `1px solid ${showCorrect ? 'rgba(55,226,164,0.4)' : 'var(--border)'}`,
                  background: showCorrect ? 'var(--ok-soft)' : 'var(--bg-inset)',
                  color: showCorrect ? 'var(--ok)' : 'var(--text-muted)',
                }}
              >
                {showCorrect ? '✓ ' : '· '}
                {opt.text}
              </li>
            );
          })}
        </ul>
      )}

      {!revealed ? (
        <button className="btn" style={{ marginTop: 16 }} onClick={() => setRevealed(true)}>
          revelar respuesta →
        </button>
      ) : (
        <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px dashed var(--border)' }}>
          <p className="mono" style={{ fontSize: '0.75rem', color: 'var(--accent-strong)', marginBottom: 6 }}>
            justificación
          </p>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem' }}>{question.justification}</p>
          {question.conceptual_error && (
            <p className="mono" style={{ fontSize: '0.76rem', color: 'var(--text-dim)', marginTop: 10 }}>
              error conceptual detectado: {question.conceptual_error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
