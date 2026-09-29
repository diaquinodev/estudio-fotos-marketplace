/**
 * Testes de integração das migrações SQL (reserva/confirmação/estorno de créditos e RLS).
 * Rodam apenas quando TEST_DATABASE_URL aponta para um PostgreSQL descartável; caso contrário são ignorados.
 * Em CI o workflow sobe um serviço postgres. Localmente: TEST_DATABASE_URL=postgres://... npm test
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client } from 'pg';
import fs from 'node:fs';
import path from 'node:path';

const url = process.env.TEST_DATABASE_URL;
const d = url ? describe : describe.skip;

d('migrações SQL (Postgres real)', () => {
  let db: Client;
  const alice = '00000000-0000-0000-0000-00000000000a';
  const bob = '00000000-0000-0000-0000-00000000000b';

  const q = async (sql: string, params: unknown[] = []) => (await db.query(sql, params)).rows;
  const credits = async (id: string) => (await q('select credits from public.profiles where id=$1', [id]))[0].credits as number;
  const reserve = async (id: string, amount = 1, max = 20) =>
    (await q('select * from public.reserve_credit($1,$2,$3)', [id, amount, max]))[0] as {
      out_status: string;
      out_reservation_id: string | null;
      out_remaining: number;
    };

  beforeAll(async () => {
    db = new Client({ connectionString: url });
    await db.connect();
    await db.query('drop schema if exists public cascade; drop schema if exists auth cascade; drop schema if exists storage cascade; create schema public;');
    const root = path.resolve(__dirname, '../supabase');
    await db.query(fs.readFileSync(path.join(root, 'tests/stubs.sql'), 'utf8'));
    for (const f of fs.readdirSync(path.join(root, 'migrations')).sort()) {
      await db.query(fs.readFileSync(path.join(root, 'migrations', f), 'utf8'));
    }
    await db.query('insert into auth.users (id,email) values ($1,$2),($3,$4)', [alice, 'alice@exemplo.com.br', bob, 'bob@exemplo.com.br']);
  });

  afterAll(async () => {
    await db?.end();
  });

  it('cria o perfil automaticamente com 3 créditos de saldo inicial', async () => {
    expect(await credits(alice)).toBe(3);
    expect(await credits(bob)).toBe(3);
  });

  it('reserve_credit debita antes e informa o saldo restante', async () => {
    const r = await reserve(alice);
    expect(r.out_status).toBe('ok');
    expect(r.out_remaining).toBe(2);
    expect(await credits(alice)).toBe(2);
    await q('select public.commit_reservation($1)', [r.out_reservation_id]);
    const [row] = await q('select status from public.credit_reservations where id=$1', [r.out_reservation_id]);
    expect(row.status).toBe('committed');
  });

  it('refund_reservation devolve o crédito uma única vez (idempotente)', async () => {
    const before = await credits(bob);
    const r = await reserve(bob);
    expect(await credits(bob)).toBe(before - 1);
    const first = (await q('select public.refund_reservation($1) as v', [r.out_reservation_id]))[0].v;
    const second = (await q('select public.refund_reservation($1) as v', [r.out_reservation_id]))[0].v;
    expect(first).toBe(before);
    expect(second).toBeNull();
    expect(await credits(bob)).toBe(before);
  });

  it('não permite estornar uma reserva já confirmada', async () => {
    const r = await reserve(bob);
    await q('select public.commit_reservation($1)', [r.out_reservation_id]);
    const v = (await q('select public.refund_reservation($1) as v', [r.out_reservation_id]))[0].v;
    expect(v).toBeNull();
  }, 10_000);

  it('reservas concorrentes nunca gastam mais do que o saldo', async () => {
    await db.query('update public.profiles set credits = 3 where id = $1', [alice]);
    await db.query('delete from public.credit_reservations where user_id = $1', [alice]);

    const clients = await Promise.all(
      Array.from({ length: 12 }, async () => {
        const c = new Client({ connectionString: url });
        await c.connect();
        return c;
      }),
    );
    const results = await Promise.all(
      clients.map((c) => c.query('select * from public.reserve_credit($1,1,100)', [alice]).then((r) => r.rows[0].out_status as string)),
    );
    await Promise.all(clients.map((c) => c.end()));

    expect(results.filter((s) => s === 'ok')).toHaveLength(3);
    expect(results.filter((s) => s === 'insufficient')).toHaveLength(9);
    expect(await credits(alice)).toBe(0);
  });

  it('retorna insufficient sem alterar o saldo quando não há créditos', async () => {
    const r = await reserve(alice);
    expect(r.out_status).toBe('insufficient');
    expect(r.out_reservation_id).toBeNull();
    expect(await credits(alice)).toBe(0);
  });

  it('aplica o limite de requisições por minuto', async () => {
    await db.query('update public.profiles set credits = 50 where id = $1', [bob]);
    await db.query('delete from public.credit_reservations where user_id = $1', [bob]);
    const statuses: string[] = [];
    for (let i = 0; i < 4; i++) statuses.push((await reserve(bob, 1, 3)).out_status);
    expect(statuses).toEqual(['ok', 'ok', 'ok', 'rate_limited']);
    expect(await credits(bob)).toBe(47);
  });

  it('refund_stale_reservations estorna somente reservas antigas ainda abertas', async () => {
    await db.query('delete from public.credit_reservations where user_id = $1', [bob]);
    await db.query('update public.profiles set credits = 10 where id = $1', [bob]);
    const old = await reserve(bob);
    const fresh = await reserve(bob);
    await db.query(`update public.credit_reservations set created_at = now() - interval '30 minutes' where id = $1`, [old.out_reservation_id]);
    const n = (await q('select public.refund_stale_reservations(interval \'10 minutes\') as n'))[0].n;
    expect(n).toBe(1);
    expect(await credits(bob)).toBe(9);
    const [row] = await q('select status from public.credit_reservations where id=$1', [fresh.out_reservation_id]);
    expect(row.status).toBe('reserved');
  });

  it('RLS: usuário autenticado lê apenas o próprio perfil e não altera o saldo', async () => {
    const c = new Client({ connectionString: url });
    await c.connect();
    try {
      await c.query('begin');
      await c.query('set local role authenticated');
      await c.query(`select set_config('request.jwt.claim.sub', $1, true)`, [alice]);
      const rows = (await c.query('select id from public.profiles')).rows;
      expect(rows).toEqual([{ id: alice }]);
      await expect(c.query('update public.profiles set credits = 999 where id = $1', [alice])).rejects.toThrow(/permission denied/);
      await c.query('rollback');

      await c.query('begin');
      await c.query('set local role authenticated');
      await c.query(`select set_config('request.jwt.claim.sub', $1, true)`, [alice]);
      await expect(c.query('select * from public.reserve_credit($1,1,20)', [alice])).rejects.toThrow(/permission denied/);
      await c.query('rollback');
    } finally {
      await c.end();
    }
  });

  it('RLS: generations só são visíveis ao dono e a inserção é restrita ao servidor', async () => {
    await db.query(`insert into public.generations (user_id, storage_path) values ($1,'a/x.png'), ($2,'b/y.png')`, [alice, bob]);
    const c = new Client({ connectionString: url });
    await c.connect();
    try {
      await c.query('begin');
      await c.query('set local role authenticated');
      await c.query(`select set_config('request.jwt.claim.sub', $1, true)`, [alice]);
      const rows = (await c.query('select user_id from public.generations')).rows;
      expect(rows).toEqual([{ user_id: alice }]);
      await expect(
        c.query(`insert into public.generations (user_id, storage_path) values ($1,'z')`, [alice]),
      ).rejects.toThrow(/permission denied/);
      await c.query('rollback');
    } finally {
      await c.end();
    }
  });

  it('admin_grant_credits só funciona para administradores', async () => {
    const c = new Client({ connectionString: url });
    await c.connect();
    try {
      await c.query('begin');
      await c.query('set local role authenticated');
      await c.query(`select set_config('request.jwt.claim.sub', $1, true)`, [alice]);
      await expect(c.query('select public.admin_grant_credits($1, 5)', [bob])).rejects.toThrow(/permissão negada/);
      await c.query('rollback');
    } finally {
      await c.end();
    }
    await db.query(`update public.profiles set role = 'admin' where id = $1`, [alice]);
    const c2 = new Client({ connectionString: url });
    await c2.connect();
    try {
      await c2.query('begin');
      await c2.query('set local role authenticated');
      await c2.query(`select set_config('request.jwt.claim.sub', $1, true)`, [alice]);
      const before = await credits(bob);
      const v = (await c2.query('select public.admin_grant_credits($1, 5) as v', [bob])).rows[0].v;
      expect(v).toBe(before + 5);
      await c2.query('commit');
    } finally {
      await c2.end();
    }
  });
});
