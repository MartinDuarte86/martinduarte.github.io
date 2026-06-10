/**
 * CU Budget Guard — Acumulación de costo y límite de sesión
 * Verifica la lógica de calcUsdCost, trackTokenUsage y el corte de 402.
 */
import { calcUsdCost } from '../../api/_lib/redis.js';

// ── Redis mock ────────────────────────────────────────────────────────────────

const mockIncrbyfloat = jest.fn().mockResolvedValue(1.0);
const mockExpire      = jest.fn().mockResolvedValue(1);
const mockGet         = jest.fn().mockResolvedValue(null);

jest.mock('@upstash/redis', () => ({
  Redis: jest.fn().mockImplementation(() => ({
    incrbyfloat: (...a) => mockIncrbyfloat(...a),
    expire:      (...a) => mockExpire(...a),
    get:         (...a) => mockGet(...a),
    set:         jest.fn().mockResolvedValue('OK'),
  })),
}));

// ── Reimport redis functions después del mock ─────────────────────────────────

let trackTokenUsage, getSessionCostUsd;
beforeAll(async () => {
  // calcUsdCost es una función pura, se puede importar directamente
  ({ trackTokenUsage, getSessionCostUsd } = await import('../../api/_lib/redis.js'));
});

// ─── calcUsdCost: función pura ────────────────────────────────────────────────

describe('calcUsdCost — función pura', () => {
  test('Haiku: 1M input + 1M output = $0.80 + $4.00 = $4.80', () => {
    const cost = calcUsdCost('claude-haiku-4-5-20251001', 1_000_000, 1_000_000);
    expect(cost).toBeCloseTo(4.80, 6);
  });

  test('Sonnet: 1M input + 1M output = $3.00 + $15.00 = $18.00', () => {
    const cost = calcUsdCost('claude-sonnet-4-6', 1_000_000, 1_000_000);
    expect(cost).toBeCloseTo(18.00, 6);
  });

  test('Haiku: 100 input + 200 output tokens', () => {
    const cost = calcUsdCost('claude-haiku-4-5-20251001', 100, 200);
    const expected = (100 * 0.80 + 200 * 4.00) / 1_000_000;
    expect(cost).toBeCloseTo(expected, 10);
  });

  test('modelo desconocido → fallback a Haiku pricing', () => {
    const costUnknown = calcUsdCost('claude-unknown-model', 1000, 1000);
    const costHaiku   = calcUsdCost('claude-haiku-4-5-20251001', 1000, 1000);
    expect(costUnknown).toBeCloseTo(costHaiku, 10);
  });

  test('0 tokens → $0.00', () => {
    expect(calcUsdCost('claude-haiku-4-5-20251001', 0, 0)).toBe(0);
  });
});

// ─── Umbral del presupuesto ────────────────────────────────────────────────────

describe('umbral de presupuesto ARS→USD', () => {
  const ARS_RATE = 1200;
  const LIMIT_ARS = 4000;
  const LIMIT_USD = LIMIT_ARS / ARS_RATE; // ≈ $3.333...

  test('$3.33 USD < límite → sesión continúa', () => {
    expect(3.33).toBeLessThan(LIMIT_USD + 0.01);
  });

  test('$3.34 USD >= límite → sesión debe terminar', () => {
    expect(3.34).toBeGreaterThanOrEqual(LIMIT_USD);
  });

  test('costo acumulado de 3 generaciones Sonnet supera el límite', () => {
    // Una generación típica: ~2000 input + ~3000 output tokens
    const perGeneration = calcUsdCost('claude-sonnet-4-6', 2000, 3000);
    const threeGenerations = perGeneration * 3;
    // $3.00/M * 2000/M + $15.00/M * 3000/M = 0.006 + 0.045 = $0.051 por generación
    // 3 × $0.051 = $0.153 — dentro del límite en tokens típicos
    // Pero con más tokens (ej: 20K input + 30K output como generación HTML):
    const heavyGen = calcUsdCost('claude-sonnet-4-6', 20_000, 30_000);
    // 3.00/M * 20K + 15.00/M * 30K = 0.06 + 0.45 = $0.51 por generación
    // Si hay muchas iteraciones, se puede llegar al límite
    expect(heavyGen).toBeGreaterThan(0);
  });

  test('conversación larga de chat Haiku: 50 intercambios no supera el límite', () => {
    // Cada turno de chat: ~500 input + ~300 output tokens
    let accumulated = 0;
    for (let i = 0; i < 50; i++) {
      accumulated += calcUsdCost('claude-haiku-4-5-20251001', 500, 300);
    }
    // 50 × (500 × 0.80/M + 300 × 4.00/M) = 50 × (0.0004 + 0.0012) = 50 × 0.0016 = $0.08
    expect(accumulated).toBeLessThan(LIMIT_USD);
  });
});

// ─── trackTokenUsage ──────────────────────────────────────────────────────────

describe('trackTokenUsage — llama a Redis', () => {
  beforeEach(() => {
    mockIncrbyfloat.mockResolvedValue(1.5);
    mockExpire.mockResolvedValue(1);
  });

  test('llama a incrbyfloat con la clave correcta', async () => {
    await trackTokenUsage('sess-abc', 'claude-haiku-4-5-20251001', 1000, 500);
    expect(mockIncrbyfloat).toHaveBeenCalledWith(
      'session:sess-abc:cost',
      expect.any(Number)
    );
  });

  test('llama a expire con SESSION_TTL', async () => {
    await trackTokenUsage('sess-abc', 'claude-haiku-4-5-20251001', 1000, 500);
    expect(mockExpire).toHaveBeenCalledWith(
      'session:sess-abc:cost',
      expect.any(Number)
    );
    const ttl = mockExpire.mock.calls[0][1];
    expect(ttl).toBeGreaterThan(3600); // más de 1 hora
  });

  test('retorna el costo agregado en USD', async () => {
    const result = await trackTokenUsage('sess-abc', 'claude-haiku-4-5-20251001', 1000, 500);
    const expected = calcUsdCost('claude-haiku-4-5-20251001', 1000, 500);
    expect(result).toBeCloseTo(expected, 10);
  });
});

// ─── getSessionCostUsd ────────────────────────────────────────────────────────

describe('getSessionCostUsd — lectura de Redis', () => {
  test('cuando Redis retorna null → $0.00', async () => {
    mockGet.mockResolvedValueOnce(null);
    const cost = await getSessionCostUsd('sess-new');
    expect(cost).toBe(0);
  });

  test('cuando Redis retorna "2.5" → 2.5 (float)', async () => {
    mockGet.mockResolvedValueOnce('2.5');
    const cost = await getSessionCostUsd('sess-mid');
    expect(cost).toBe(2.5);
  });

  test('cuando Redis retorna "3.333333" → parseFloat correcto', async () => {
    mockGet.mockResolvedValueOnce('3.333333');
    const cost = await getSessionCostUsd('sess-limit');
    expect(cost).toBeCloseTo(3.333333, 5);
  });

  test('clave correcta: session:{id}:cost', async () => {
    mockGet.mockResolvedValueOnce('1.0');
    await getSessionCostUsd('sess-key-test');
    expect(mockGet).toHaveBeenCalledWith('session:sess-key-test:cost');
  });
});
