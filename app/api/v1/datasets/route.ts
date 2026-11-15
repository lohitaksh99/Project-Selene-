import { buildApiEnvelope } from '@/lib/apiEnvelope';
import { sanitizePublicError } from '@/lib/security/proxyGuard';
import { DatasetRecord, getSeleneDb } from '@/server/db/database';

export async function GET() {
  try {
    const db = getSeleneDb();
    const datasets = db
      .prepare('SELECT * FROM datasets ORDER BY resolution_m ASC')
      .all() as DatasetRecord[];

    return buildApiEnvelope({
      count: datasets.length,
      datasets,
    });
  } catch (err) {
    return buildApiEnvelope(
      { error: sanitizePublicError(err, 'Failed to read datasets from database') },
      { status: 'error', httpStatus: 500 }
    );
  }
}
