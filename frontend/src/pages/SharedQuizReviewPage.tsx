import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useProfile } from '../context/ProfileContext';
import { getSharedQuizDetail } from '../api/students';
import type { SharedQuizDetail, SharedQuizQuestion, SharedQuizQuestionOption } from '../api/types';
import { ZoomableImage } from '../components/ZoomableImage';

function optionStyle(option: SharedQuizQuestionOption, selected: boolean, isSurvey: boolean): React.CSSProperties {
  if (option.is_correct) {
    return { borderColor: 'var(--ok)', background: 'var(--ok-soft)' };
  }
  if (selected) {
    // Una encuesta no tiene "respuesta correcta" — lo que marcó el alumno
    // se resalta en amarillo (neutral), no en rojo como si estuviera mal.
    return isSurvey
      ? { borderColor: 'var(--accent)', background: 'var(--accent-soft)' }
      : { borderColor: 'var(--danger)', background: 'var(--danger-soft)' };
  }
  return {};
}

function OptionRow({ option, selected, isSurvey }: { option: SharedQuizQuestionOption; selected: boolean; isSurvey: boolean }) {
  const selectedColor = option.is_correct ? 'var(--ok)' : isSurvey ? 'var(--accent-strong)' : 'var(--danger)';
  return (
    <div
      className="panel"
      style={{
        padding: '10px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        ...optionStyle(option, selected, isSurvey),
      }}
    >
      {option.image && (
        <ZoomableImage src={option.image} thumbStyle={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }} />
      )}
      <span style={{ color: 'var(--text)', flex: 1 }}>{option.text}</span>
      {option.is_correct && (
        <span className="mono" style={{ fontSize: '0.72rem', color: 'var(--ok)' }}>
          ✓ correcta
        </span>
      )}
      {selected && (
        <span className="mono" style={{ fontSize: '0.72rem', color: selectedColor }}>
          {option.is_correct ? '● marcaste esto' : isSurvey ? '● marcaste esto' : '✗ marcaste esto'}
        </span>
      )}
    </div>
  );
}

function QuestionReview({ question, played }: { question: SharedQuizQuestion; played: boolean }) {
  const isFillBlank = question.question_type === 'fill_blank';
  const isSurvey = question.question_type === 'survey';

  return (
    <div className="panel" style={{ padding: '18px 20px' }}>
      <p className="mono" style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginBottom: 8 }}>
        pregunta {String(question.order).padStart(2, '0')}
        {!isSurvey && played && question.is_correct !== null && (
          <span style={{ color: question.is_correct ? 'var(--ok)' : 'var(--danger)', marginLeft: 8 }}>
            {question.is_correct ? '✓ acertaste' : '✗ no acertaste'}
            {question.score !== null && ` · ${question.score} pts`}
          </span>
        )}
      </p>
      <p style={{ color: 'var(--text)', marginBottom: 14, whiteSpace: 'pre-wrap' }}>{question.text}</p>

      {question.image && (
        <ZoomableImage
          src={question.image}
          thumbStyle={{ display: 'block', width: '100%', maxHeight: 280, objectFit: 'contain', borderRadius: 6, marginBottom: 14, border: '1px solid var(--border-strong)' }}
        />
      )}

      {isFillBlank ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {question.options
              .filter((o) => o.is_correct)
              .map((o) => (
                <span key={o.id} className="chip ok">
                  {o.text}
                </span>
              ))}
          </div>
          {played && (
            <p className="mono" style={{ fontSize: '0.85rem', color: question.is_correct ? 'var(--ok)' : 'var(--danger)' }}>
              tu respuesta: {question.free_text || '(vacío)'}
            </p>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {question.options.map((option) => (
            <OptionRow
              key={option.id}
              option={option}
              selected={question.selected_option_ids.includes(option.id)}
              isSurvey={isSurvey}
            />
          ))}
        </div>
      )}

      {question.justification && !isSurvey && (
        <p className="mono" style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 14 }}>
          {question.justification}
        </p>
      )}
    </div>
  );
}

export function SharedQuizReviewPage() {
  const { profile } = useProfile();
  const { quizId = '' } = useParams<{ quizId: string }>();
  const [quiz, setQuiz] = useState<SharedQuizDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    getSharedQuizDetail(profile.legajo, Number(quizId))
      .then(setQuiz)
      .catch(() => setError('No se pudo cargar este cuestionario — puede que no esté compartido con vos.'));
  }, [profile?.legajo, quizId]);

  if (!profile) {
    return (
      <div className="container" style={{ padding: '48px 24px' }}>
        <p style={{ marginBottom: 14 }}>Primero identificate con tu legajo.</p>
        <Link to="/perfil" className="btn primary">
          ir a mi perfil →
        </Link>
      </div>
    );
  }

  return (
    <div className="container" style={{ padding: '40px 24px 96px', maxWidth: 720 }}>
      <Link to="/mis-cuestionarios" className="mono" style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
        ← volver
      </Link>

      {error && (
        <p className="mono" style={{ color: 'var(--danger)', fontSize: '0.82rem', marginTop: 18 }}>
          <span className="status-dot danger" />
          {error}
        </p>
      )}

      {!quiz && !error && (
        <p className="mono cursor" style={{ marginTop: 18 }}>
          cargando
        </p>
      )}

      {quiz && (
        <>
          <p className="mono prompt" style={{ color: 'var(--text-dim)', fontSize: '0.82rem', marginTop: 18, marginBottom: 10 }}>
            review --quiz {quiz.id}
          </p>
          <h1 style={{ marginBottom: 8 }}>{quiz.title}</h1>
          <p className="mono" style={{ fontSize: '0.82rem', color: 'var(--text-dim)', marginBottom: 28 }}>
            {quiz.host}
            {quiz.played
              ? ` · jugado · ${quiz.total_score} pts totales`
              : ' · todavía no lo jugaste — se muestran solo las respuestas correctas'}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {quiz.questions.map((q) => (
              <QuestionReview key={q.question_id} question={q} played={quiz.played} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
