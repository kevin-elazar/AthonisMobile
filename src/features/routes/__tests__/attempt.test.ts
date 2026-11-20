import { previousAttemptLabel, type DriverStop } from '../model';

const parada = (extra: Partial<DriverStop>) => ({ order_id: 1, ...extra }) as DriverStop;

describe('tentativa anterior', () => {
  it('primeira tentativa (ou cópia antiga sem o campo) não mostra nada', () => {
    expect(previousAttemptLabel(parada({ attempt: 1 }))).toBeNull();
    expect(previousAttemptLabel(parada({}))).toBeNull();
  });

  it('mostra o número, o motivo e o dia da tentativa anterior', () => {
    expect(
      previousAttemptLabel(
        parada({
          attempt: 2,
          previous_attempt: {
            route_id: 11,
            occurred_at: new Date(2026, 10, 18, 15, 0).toISOString(),
            occurrence_type: 'customer_absent',
            notes: null,
          },
        }),
      ),
    ).toBe('2ª tentativa · anterior: Cliente ausente em 18/11');
  });

  it('sem detalhes da anterior, só o número; motivo desconhecido vira "Outro motivo"', () => {
    expect(previousAttemptLabel(parada({ attempt: 3, previous_attempt: null }))).toBe('3ª tentativa');
    expect(
      previousAttemptLabel(
        parada({
          attempt: 2,
          previous_attempt: { route_id: 1, occurred_at: null, occurrence_type: 'novo', notes: null },
        }),
      ),
    ).toBe('2ª tentativa · anterior: Outro motivo');
  });
});
