/**
 * Wrapper para iniciar el mock-server en modo E2E.
 * Fuerza LLM_PROVIDER=mock ANTES de que loadEnv() del server
 * lea el .env (que puede tener LLM_PROVIDER=openrouter para
 * desarrollo local). Así los tests E2E nunca consumen la API real.
 */
process.env.LLM_PROVIDER = 'mock';
require('./mock-server.js');
