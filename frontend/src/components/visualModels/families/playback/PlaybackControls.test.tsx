import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { PlaybackControls } from './PlaybackControls';
import { usePlayback } from './usePlayback';

function Harness({ total }: { total: number }) {
  const playback = usePlayback(total);
  return <PlaybackControls playback={playback} />;
}

// Sin fake timers acá a propósito: estos tests solo ejercitan clicks y
// transiciones de estado inmediatas (start/next/reset), no el auto-avance
// por setTimeout (eso ya lo cubre usePlayback.test.ts) — mezclar
// userEvent con fake timers en este componente cuelga el test runner.
describe('PlaybackControls', () => {
  it('renders nothing when there is only one step', () => {
    const { container } = render(<Harness total={1} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows a single start button before playback begins', () => {
    render(<Harness total={4} />);
    expect(screen.getByRole('button', { name: /reproducir paso a paso/i })).toBeInTheDocument();
  });

  it('reveals step controls and the step counter after starting', async () => {
    const user = userEvent.setup();
    render(<Harness total={4} />);

    await user.click(screen.getByRole('button', { name: /reproducir paso a paso/i }));

    expect(screen.getByText('paso 1 / 4')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /pausar/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '◀' })).toBeDisabled();
  });

  it('advances the step counter when clicking the manual next button', async () => {
    const user = userEvent.setup();
    render(<Harness total={3} />);

    await user.click(screen.getByRole('button', { name: /reproducir paso a paso/i }));
    await user.click(screen.getByRole('button', { name: '▶|' }));

    expect(screen.getByText('paso 2 / 3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reanudar/i })).toBeInTheDocument();
  });

  it('offers "repetir" once it reaches the last step, and reset returns to the start button', async () => {
    const user = userEvent.setup();
    render(<Harness total={2} />);

    await user.click(screen.getByRole('button', { name: /reproducir paso a paso/i }));
    await user.click(screen.getByRole('button', { name: '▶|' }));
    expect(screen.getByRole('button', { name: /repetir/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /reiniciar/i }));
    expect(screen.getByRole('button', { name: /reproducir paso a paso/i })).toBeInTheDocument();
  });
});
