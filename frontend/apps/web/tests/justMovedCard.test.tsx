// The first-week card: progress from the person's own ticks plus the one
// step the calendar can confirm, a retiring state at five of five, and a
// "Not new here" dismissal. Storage is per home and local only.

import { render, screen, fireEvent } from '@testing-library/react';

const push = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

import JustMovedCard, { isRecentMove, JUST_MOVED_STEPS } from '@/components/place/JustMovedCard';

const today = new Date().toISOString().slice(0, 10);

beforeEach(() => {
  window.localStorage.clear();
  push.mockClear();
});

describe('JustMovedCard', () => {
  it('renders five steps with a payoff each and zero progress', () => {
    render(<JustMovedCard homeId="h1" moveInDate={today} />);
    expect(screen.getByTestId('just-moved')).toBeInTheDocument();
    expect(screen.getByTestId('just-moved-progress')).toHaveTextContent('0 of 5 done');
    expect(screen.getAllByRole('checkbox')).toHaveLength(JUST_MOVED_STEPS.length);
    expect(screen.getByText(/reminders the night before/i)).toBeInTheDocument();
  });

  it('ticks a step, persists it per home, and navigates from the row', () => {
    const { unmount } = render(<JustMovedCard homeId="h1" moveInDate={today} />);
    fireEvent.click(screen.getByTestId('just-moved-check-mail'));
    expect(screen.getByTestId('just-moved-progress')).toHaveTextContent('1 of 5 done');
    fireEvent.click(screen.getByText(/meet the block/i));
    expect(push).toHaveBeenCalledWith('/app/nearby');
    unmount();

    render(<JustMovedCard homeId="h1" moveInDate={today} />);
    expect(screen.getByTestId('just-moved-progress')).toHaveTextContent('1 of 5 done');
    expect(screen.getByTestId('just-moved-check-mail')).toHaveAttribute('aria-checked', 'true');
  });

  it('ticks the pickup step itself once the calendar has a real pickup day', () => {
    render(<JustMovedCard homeId="h2" moveInDate={today} needsPickupDay={false} />);
    expect(screen.getByTestId('just-moved-progress')).toHaveTextContent('1 of 5 done');
    expect(screen.getByTestId('just-moved-check-pickup')).toBeDisabled();
  });

  it('retires into one line at five of five, and hides on request', () => {
    window.localStorage.setItem('pantopus_just_moved_done:h3', JSON.stringify(['pickup', 'mail', 'money', 'civic', 'block']));
    render(<JustMovedCard homeId="h3" moveInDate={today} />);
    expect(screen.getByTestId('just-moved-done')).toHaveTextContent(/first week done/i);
    fireEvent.click(screen.getByText('Hide'));
    expect(screen.queryByTestId('just-moved-done')).not.toBeInTheDocument();
  });

  it('"Not new here" dismisses for good and the window is sixty days', () => {
    render(<JustMovedCard homeId="h4" moveInDate={today} />);
    fireEvent.click(screen.getByTestId('just-moved-dismiss'));
    expect(screen.queryByTestId('just-moved')).not.toBeInTheDocument();
    expect(window.localStorage.getItem('pantopus_just_moved_dismissed:h4')).toBe('1');
    expect(isRecentMove('2020-01-01')).toBe(false);
  });
});
