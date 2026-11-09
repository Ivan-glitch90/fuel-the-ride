import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { SnackbarProvider, useSnackbar } from './Snackbar.jsx';

function Trigger({ message = 'Ride plan saved.' }) {
  const snackbar = useSnackbar();
  return <button onClick={() => snackbar(message)}>Save</button>;
}

const setup = () =>
  render(
    <SnackbarProvider>
      <Trigger />
    </SnackbarProvider>,
  );

afterEach(() => vi.useRealTimers());

describe('snackbar', () => {
  test('announces the message in a polite live region and can be dismissed', () => {
    setup();
    const region = screen.getByRole('status');
    expect(region).toBeEmptyDOMElement(); // present before the message, so it gets announced
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(region).toHaveTextContent('Ride plan saved.');
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(region).toBeEmptyDOMElement();
  });

  test('hides itself after 5 seconds', () => {
    vi.useFakeTimers();
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    act(() => vi.advanceTimersByTime(4900));
    expect(screen.getByText('Ride plan saved.')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(200));
    expect(screen.queryByText('Ride plan saved.')).toBeNull();
  });

  test('stays while the rider is reading it (hover or keyboard focus)', () => {
    vi.useFakeTimers();
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    fireEvent.focus(screen.getByRole('button', { name: 'Dismiss' }));
    act(() => vi.advanceTimersByTime(20000));
    expect(screen.getByText('Ride plan saved.')).toBeInTheDocument();
    fireEvent.blur(screen.getByRole('button', { name: 'Dismiss' }));
    act(() => vi.advanceTimersByTime(5100));
    expect(screen.queryByText('Ride plan saved.')).toBeNull();
  });
});
