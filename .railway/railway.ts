import { defineRailway, postgres, project, service } from 'railway/iac';

// Apply to a new, empty project dedicated to this internal preview.
// Secrets are shared Railway variables, never literals in this source file.
export default defineRailway((ctx) => {
  const database = postgres('Postgres');
  const web = service('praxis-preview', {
    build: { builder: 'RAILPACK', buildCommand: 'npm run build' },
    preDeploy: 'node scripts/start-preview.mjs --check && npm run db:migrate',
    start: 'npm run start:preview',
    healthcheck: '/api/health',
    healthcheckTimeout: 120,
    replicas: 1,
    deploy: { restartPolicyType: 'ON_FAILURE', restartPolicyMaxRetries: 3 },
    env: {
      DATABASE_URL: database.env.DATABASE_URL,
      PRAXIS_ADMIN_TOKEN: ctx.shared.PRAXIS_ADMIN_TOKEN,
      PRAXIS_PREVIEW_PASSWORD: ctx.shared.PRAXIS_PREVIEW_PASSWORD,
      PRAXIS_PREVIEW_REQUIRED: 'true',
      PRAXIS_SECURE_COOKIES: 'true',
      PRAXIS_MODE: 'development',
      PRAXIS_CHECKOUT_URL: '',
      PRAXIS_AI_API_KEY: '',
      PRAXIS_AI_MODEL: '',
      NEXT_TELEMETRY_DISABLED: '1',
      RAILPACK_NODE_VERSION: '24.19.0',
    },
  });
  return project('Praxis Preview', { resources: [database, web] });
});
