import { buildApiEnvelope } from '@/lib/apiEnvelope';
import { getDatabaseDeploymentStatus, getSeleneDb } from '@/server/db/database';
import { validateEnvironmentIntegrity } from '@/lib/security/proxyGuard';

export async function GET() {
  try {
    const db = getSeleneDb();
    const journalMode = db.pragma('journal_mode', { simple: true });
    const siteCount = (
      db.prepare('SELECT COUNT(*) as cnt FROM landing_sites').get() as { cnt: number }
    ).cnt;
    const datasetCount = (
      db.prepare('SELECT COUNT(*) as cnt FROM datasets').get() as { cnt: number }
    ).cnt;
    const deploymentStatus = getDatabaseDeploymentStatus();
    const envIntegrity = validateEnvironmentIntegrity();

    return buildApiEnvelope({
      service: 'Project Selene Astrodynamics & GIS Core',
      uptime_seconds: Math.round(process.uptime()),
      sqlite_status: 'CONNECTED',
      sqlite_journal_mode: String(journalMode).toUpperCase(),
      registered_sites: siteCount,
      registered_datasets: datasetCount,
      deployment_status: deploymentStatus,
      environment_integrity: envIntegrity,
      ephemeris_providers: {
        jpl_horizons: 'STANDBY_AUTO_PROBE',
        calibrated_de441: 'ACTIVE_READY',
      },
    });
  } catch (err) {
    return buildApiEnvelope(
      { error: err instanceof Error ? err.message : 'Database check failed' },
      { status: 'error', httpStatus: 500 }
    );
  }
}
