import { describe, expect, it, vi } from 'vitest';
import {
  CreditError,
  DEFAULT_MAX_PER_MINUTE,
  getMaxPerMinute,
  refundReservation,
  reserveCredit,
  withCreditReservation,
  type RpcClient,
} from './credits';

type RpcResult = { data: unknown; error: { message: string } | null };

/** Fake em memória que imita as funções SQL (saldo e estado da reserva). */
function fakeClient(initialCredits: number, overrides: Partial<Record<string, RpcResult>> = {}) {
  const state = { credits: initialCredits, reservations: new Map<string, 'reserved' | 'committed' | 'refunded'>() };
  let seq = 0;
  const calls: string[] = [];
  const client: RpcClient = {
    async rpc(fn, args) {
      calls.push(fn);
      if (overrides[fn]) return overrides[fn]!;
      if (fn === 'reserve_credit') {
        if (state.credits < 1) return { data: [{ out_status: 'insufficient', out_reservation_id: null, out_remaining: state.credits }], error: null };
        state.credits -= 1;
        const id = `res-${++seq}`;
        state.reservations.set(id, 'reserved');
        return { data: [{ out_status: 'ok', out_reservation_id: id, out_remaining: state.credits }], error: null };
      }
      const id = (args as { p_reservation_id: string }).p_reservation_id;
      if (fn === 'commit_reservation') {
        const ok = state.reservations.get(id) === 'reserved';
        if (ok) state.reservations.set(id, 'committed');
        return { data: ok, error: null };
      }
      if (fn === 'refund_reservation') {
        if (state.reservations.get(id) !== 'reserved') return { data: null, error: null };
        state.reservations.set(id, 'refunded');
        state.credits += 1;
        return { data: state.credits, error: null };
      }
      throw new Error(`rpc inesperada: ${fn}`);
    },
  };
  return { client, state, calls };
}

describe('reserveCredit', () => {
  it('retorna ok com id da reserva e saldo restante', async () => {
    const { client } = fakeClient(3);
    const r = await reserveCredit(client, 'u1');
    expect(r).toEqual({ ok: true, reservationId: 'res-1', remaining: 2 });
  });

  it('propaga os motivos de recusa sem lançar erro', async () => {
    const { client } = fakeClient(0);
    expect(await reserveCredit(client, 'u1')).toEqual({ ok: false, reason: 'insufficient', remaining: 0 });

    const limited = fakeClient(5, {
      reserve_credit: { data: [{ out_status: 'rate_limited', out_reservation_id: null, out_remaining: 5 }], error: null },
    });
    expect(await reserveCredit(limited.client, 'u1')).toEqual({ ok: false, reason: 'rate_limited', remaining: 5 });
  });

  it('lança CreditError quando a RPC falha ou responde algo inesperado', async () => {
    const failing = fakeClient(1, { reserve_credit: { data: null, error: { message: 'boom' } } });
    await expect(reserveCredit(failing.client, 'u1')).rejects.toBeInstanceOf(CreditError);
    const weird = fakeClient(1, { reserve_credit: { data: [], error: null } });
    await expect(reserveCredit(weird.client, 'u1')).rejects.toThrow(/inesperada/);
  });

  it('envia o limite por minuto configurado', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{ out_status: 'ok', out_reservation_id: 'x', out_remaining: 1 }], error: null });
    await reserveCredit({ rpc }, 'u1', { maxPerMinute: 7 });
    expect(rpc).toHaveBeenCalledWith('reserve_credit', { p_user_id: 'u1', p_amount: 1, p_max_per_minute: 7 });
  });
});

describe('getMaxPerMinute', () => {
  it('usa o padrão quando ausente ou inválido', () => {
    expect(getMaxPerMinute({} as NodeJS.ProcessEnv)).toBe(DEFAULT_MAX_PER_MINUTE);
    expect(getMaxPerMinute({ RATE_LIMIT_PER_MINUTE: 'abc' } as unknown as NodeJS.ProcessEnv)).toBe(DEFAULT_MAX_PER_MINUTE);
    expect(getMaxPerMinute({ RATE_LIMIT_PER_MINUTE: '0' } as unknown as NodeJS.ProcessEnv)).toBe(DEFAULT_MAX_PER_MINUTE);
  });
  it('lê o valor configurado', () => {
    expect(getMaxPerMinute({ RATE_LIMIT_PER_MINUTE: '5' } as unknown as NodeJS.ProcessEnv)).toBe(5);
  });
});

describe('withCreditReservation', () => {
  it('sucesso: debita antes de executar e confirma a reserva', async () => {
    const { client, state } = fakeClient(2);
    let creditsDuringWork = -1;
    const res = await withCreditReservation(client, 'u1', async () => {
      creditsDuringWork = state.credits;
      return 'imagem';
    });
    expect(creditsDuringWork).toBe(1); // já debitado antes da geração
    expect(res).toEqual({ ok: true, value: 'imagem', remaining: 1 });
    expect(state.reservations.get('res-1')).toBe('committed');
    expect(state.credits).toBe(1);
  });

  it('falha: estorna o crédito e relança o erro original', async () => {
    const { client, state } = fakeClient(2);
    await expect(
      withCreditReservation(client, 'u1', async () => {
        throw new Error('gemini caiu');
      }),
    ).rejects.toThrow('gemini caiu');
    expect(state.credits).toBe(2);
    expect(state.reservations.get('res-1')).toBe('refunded');
  });

  it('sem saldo: não executa o trabalho', async () => {
    const { client } = fakeClient(0);
    const work = vi.fn();
    const res = await withCreditReservation(client, 'u1', work);
    expect(res).toEqual({ ok: false, reason: 'insufficient', remaining: 0 });
    expect(work).not.toHaveBeenCalled();
  });

  it('erro no estorno não mascara o erro original e é reportado', async () => {
    const { client } = fakeClient(1, { refund_reservation: { data: null, error: { message: 'db fora' } } });
    const onRefundError = vi.fn();
    await expect(
      withCreditReservation(client, 'u1', async () => {
        throw new Error('falha real');
      }, { onRefundError }),
    ).rejects.toThrow('falha real');
    expect(onRefundError).toHaveBeenCalledTimes(1);
  });

  it('erro ao confirmar não estorna nem perde a imagem já gerada', async () => {
    const { client, calls } = fakeClient(1, { commit_reservation: { data: null, error: { message: 'timeout' } } });
    const onRefundError = vi.fn();
    const res = await withCreditReservation(client, 'u1', async () => 'ok', { onRefundError });
    expect(res.ok).toBe(true);
    expect(calls).not.toContain('refund_reservation');
    expect(onRefundError).toHaveBeenCalledTimes(1);
  });

  it('concorrência: N requisições simultâneas nunca superam o saldo', async () => {
    const { client, state } = fakeClient(3);
    const results = await Promise.all(
      Array.from({ length: 10 }, () => withCreditReservation(client, 'u1', async () => 'img')),
    );
    expect(results.filter((r) => r.ok)).toHaveLength(3);
    expect(results.filter((r) => !r.ok)).toHaveLength(7);
    expect(state.credits).toBe(0);
  });
});

describe('refundReservation', () => {
  it('é idempotente: o segundo estorno retorna null e não devolve crédito', async () => {
    const { client, state } = fakeClient(1);
    const r = await reserveCredit(client, 'u1');
    if (!r.ok) throw new Error('reserva deveria funcionar');
    expect(await refundReservation(client, r.reservationId)).toBe(1);
    expect(await refundReservation(client, r.reservationId)).toBeNull();
    expect(state.credits).toBe(1);
  });
});
