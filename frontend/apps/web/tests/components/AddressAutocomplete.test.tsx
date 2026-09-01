/**
 * UX-03 — the address combobox had no ARIA semantics and no keyboard handler.
 * A screen reader user heard "edit text", was never told suggestions appeared,
 * could not reach them with the arrow keys, and got nothing from Enter. Since
 * picking a suggestion is the only way to populate the normalized address the
 * Next button requires, step 1 of Add Home was impossible without a mouse.
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

const mockAutocomplete = jest.fn();
const mockResolve = jest.fn();

jest.mock('@pantopus/api', () => ({
  geo: {
    autocompleteWithAbort: (...args: unknown[]) => mockAutocomplete(...args),
    resolve: (...args: unknown[]) => mockResolve(...args),
  },
}));

import AddressAutocomplete from '@/components/AddressAutocomplete';

const SUGGESTIONS = [
  { suggestion_id: 's1', primary_text: '123 Main St', secondary_text: 'Portland, OR' },
  { suggestion_id: 's2', primary_text: '124 Main St', secondary_text: 'Portland, OR' },
];

function setup(overrides: Record<string, unknown> = {}) {
  const onChange = jest.fn();
  const onSelectNormalized = jest.fn();
  render(
    <AddressAutocomplete
      value="123 Main"
      onChange={onChange}
      onSelectNormalized={onSelectNormalized}
      {...overrides}
    />,
  );
  return { onChange, onSelectNormalized };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockAutocomplete.mockResolvedValue({ suggestions: SUGGESTIONS });
  mockResolve.mockResolvedValue({
    normalized: {
      address: '123 Main St', city: 'Portland', state: 'OR', zipcode: '97201',
      verified: true, source: 'mapbox',
    },
  });
});

describe('combobox semantics', () => {
  test('the input is a combobox that reports its expanded state', async () => {
    setup();
    const input = screen.getByRole('combobox');
    expect(input).toHaveAttribute('aria-autocomplete', 'list');
    expect(input).toHaveAttribute('aria-controls');

    await waitFor(() => expect(input).toHaveAttribute('aria-expanded', 'true'));
  });

  test('suggestions are exposed as options in a listbox', async () => {
    setup();
    await waitFor(() => expect(screen.getByRole('listbox')).toBeInTheDocument());
    expect(await screen.findAllByRole('option')).toHaveLength(2);
  });

  test('availability is announced in a live region', async () => {
    setup();
    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(/2 address suggestions available/i);
    });
  });

  test('the combobox takes its name from the visible label', async () => {
    render(
      <>
        <div id="lbl">Home location</div>
        <AddressAutocomplete value="123 Main" onChange={jest.fn()} onSelectNormalized={jest.fn()} labelId="lbl" />
      </>,
    );
    expect(screen.getByRole('combobox')).toHaveAccessibleName('Home location');
  });
});

describe('keyboard navigation', () => {
  test('arrow keys move the active option via aria-activedescendant', async () => {
    const user = userEvent.setup();
    setup();
    const input = screen.getByRole('combobox');
    await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(2));

    expect(input).not.toHaveAttribute('aria-activedescendant');

    await user.type(input, '{ArrowDown}');
    const options = screen.getAllByRole('option');
    expect(options[0]).toHaveAttribute('aria-selected', 'true');
    expect(input).toHaveAttribute('aria-activedescendant', options[0].id);

    await user.type(input, '{ArrowDown}');
    expect(screen.getAllByRole('option')[1]).toHaveAttribute('aria-selected', 'true');
  });

  test('arrow up from the top wraps to the last option', async () => {
    const user = userEvent.setup();
    setup();
    const input = screen.getByRole('combobox');
    await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(2));

    await user.type(input, '{ArrowUp}');
    expect(screen.getAllByRole('option')[1]).toHaveAttribute('aria-selected', 'true');
  });

  test('Enter selects the active option', async () => {
    const user = userEvent.setup();
    const { onSelectNormalized } = setup();
    const input = screen.getByRole('combobox');
    await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(2));

    await user.type(input, '{ArrowDown}{Enter}');

    await waitFor(() => expect(mockResolve).toHaveBeenCalledWith('s1'));
    await waitFor(() => expect(onSelectNormalized).toHaveBeenCalled());
  });

  test('Enter with no active option does not select, so forms still submit', async () => {
    const user = userEvent.setup();
    setup();
    const input = screen.getByRole('combobox');
    await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(2));

    await user.type(input, '{Enter}');
    expect(mockResolve).not.toHaveBeenCalled();
  });

  test('Escape closes the list without selecting', async () => {
    const user = userEvent.setup();
    setup();
    const input = screen.getByRole('combobox');
    await waitFor(() => expect(input).toHaveAttribute('aria-expanded', 'true'));

    await user.type(input, '{Escape}');
    expect(input).toHaveAttribute('aria-expanded', 'false');
    expect(mockResolve).not.toHaveBeenCalled();
  });
});

describe('errors', () => {
  test('a failure is announced and associated with the input', async () => {
    mockAutocomplete.mockRejectedValue(new Error('network'));
    setup();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/failed to load suggestions/i);

    const input = screen.getByRole('combobox');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input.getAttribute('aria-describedby')).toContain(alert.id);
  });
});
