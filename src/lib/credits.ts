/**
 * Lógica de créditos (reserva → confirmação/estorno).
 *
 * O débito é feito ANTES da geração, de forma atômica no Postgres (função `reserve_credit`, que trava a
 * linha do perfil). Se a geração falhar, a reserva é estornada; se der certo, é confirmada.
 * Este módulo só orquestra as RPCs; a atomicidade vive nas migrações em supabase/migrations.
 */

export type ReserveStatus = 'ok' | 'insufficient' | 'rate_limited' | 'no_profile';

export interface ReserveRow {
  out_status: ReserveStatus;
  out_reservation_id: string | null;
  out_remaining: number;
}

export type Reservation =
  | { ok: true; reservationId: string; remaining: number }
  | { ok: false; reason: Exclude<ReserveStatus, 'ok'>; remaining: number };

/** Subconjunto do cliente Supabase usado aqui (facilita testar com um fake). */
export interface RpcClient {
  rpc(fn: string, args?: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message: string } | null }>;
}

export class CreditError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CreditError';
  }
}

export const DEFAULT_MAX_PER_MINUTE = 20;

export function getMaxPerMinute(env: NodeJS.ProcessEnv = process.env): number {
  const parsed = Number.parseInt(env.RATE_LIMIT_PER_MINUTE ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_PER_MINUTE;
}

export async function reserveCredit(
  client: RpcClient,
  userId: string,
  opts: { amount?: number; maxPerMinute?: number } = {},
): Promise<Reservation> {
  const { data, error } = await client.rpc('reserve_credit', {
    p_user_id: userId,
    p_amount: opts.amount ?? 1,
    p_max_per_minute: opts.maxPerMinute ?? getMaxPerMinute(),
  });
  if (error) throw new CreditError(`Falha ao reservar crédito: ${error.message}`);

  const row = (Array.isArray(data) ? data[0] : data) as ReserveRow | undefined;
  if (!row || typeof row.out_status !== 'string') {
    throw new CreditError('Resposta inesperada de reserve_credit.');
  }
  if (row.out_status === 'ok') {
    if (!row.out_reservation_id) throw new CreditError('reserve_credit retornou ok sem id de reserva.');
    return { ok: true, reservationId: row.out_reservation_id, remaining: row.out_remaining };
  }
  return { ok: false, reason: row.out_status, remaining: row.out_remaining ?? 0 };
}

export async function commitReservation(client: RpcClient, reservationId: string): Promise<void> {
  const { error } = await client.rpc('commit_reservation', { p_reservation_id: reservationId });
  if (error) throw new CreditError(`Falha ao confirmar reserva: ${error.message}`);
}

/** Devolve o saldo após o estorno, ou null se a reserva já estava liquidada. */
export async function refundReservation(client: RpcClient, reservationId: string): Promise<number | null> {
  const { data, error } = await client.rpc('refund_reservation', { p_reservation_id: reservationId });
  if (error) throw new CreditError(`Falha ao estornar reserva: ${error.message}`);
  return typeof data === 'number' ? data : null;
}

export type GuardedResult<T> =
  | { ok: true; value: T; remaining: number }
  | { ok: false; reason: Exclude<ReserveStatus, 'ok'>; remaining: number };

/**
 * Reserva 1 crédito, executa `work` e:
 *  - confirma a reserva se `work` terminar sem erro;
 *  - estorna a reserva e relança o erro se `work` falhar.
 * Se o estorno em si falhar, o erro original ainda é relançado (a reserva presa é recuperável por
 * `refund_stale_reservations`).
 */
export async function withCreditReservation<T>(
  client: RpcClient,
  userId: string,
  work: () => Promise<T>,
  opts: { maxPerMinute?: number; onRefundError?: (err: unknown) => void } = {},
): Promise<GuardedResult<T>> {
  const reservation = await reserveCredit(client, userId, { maxPerMinute: opts.maxPerMinute });
  if (!reservation.ok) return reservation;

  let value: T;
  try {
    value = await work();
  } catch (err) {
    try {
      await refundReservation(client, reservation.reservationId);
    } catch (refundErr) {
      opts.onRefundError?.(refundErr);
    }
    throw err;
  }

  try {
    await commitReservation(client, reservation.reservationId);
  } catch (commitErr) {
    // A imagem já foi entregue e o crédito já foi debitado; a reserva ficará 'reserved' até a limpeza,
    // mas NÃO deve ser estornada por engano. Registra e segue.
    opts.onRefundError?.(commitErr);
  }
  return { ok: true, value, remaining: reservation.remaining };
}
