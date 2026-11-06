/* eslint-env node */
const { onRequest } = require('firebase-functions/v2/https');
const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');
const { createAccessService, createHttpHandler } = require('./access');

const projectId = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT;
const local = process.env.FUNCTIONS_EMULATOR === 'true';
if (local ? projectId !== 'demo-sismorcego-spark' : projectId && projectId !== 'sismorcego-50b25') {
  throw new Error('Unsupported evaluation project.');
}
const issuer = 'sismorcego-eval-issuer@sismorcego-50b25.iam.gserviceaccount.com';
const app = initializeApp({ projectId: projectId || 'sismorcego-50b25', serviceAccountId: issuer });
const service = createAccessService({ auth: getAuth(app), db: getFirestore(app) });

exports.evaluationAccess = onRequest({
  region: 'southamerica-east1', serviceAccount: issuer,
  minInstances: 0, maxInstances: 1, concurrency: 16,
  memory: '256MiB', timeoutSeconds: 15, invoker: 'public', cors: false,
}, createHttpHandler(service));
