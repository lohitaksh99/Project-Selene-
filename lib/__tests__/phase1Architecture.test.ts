import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  assertAllowedUpstreamUrl,
  checkProviderRateLimit,
  sanitizePublicError,
} from '../security/proxyGuard';
import {
  buildCalculationCacheKey,
  buildTileCacheKey,
  canonicalizeParameters,
  computeCanonicalSha256,
} from '../services/apiRequestManager';
import {
  LOADED_SPICE_KERNELS,
  getMissionTimeSnapshot,
  validateHorizonsVsAnalyticalCompatibility,
} from '../services/missionTimeService';
import {
  assertSiteMutable,
  getDatabaseDeploymentStatus,
  getSeleneDb,
  type DatasetRecord,
} from '../../server/db/database';
import {
  GLOBAL_TOP_NAV_ITEMS,
  buildWorkspaceHash,
  resolveNavigationTarget,
} from '../navigation/workspaceRegistry';
import { useSeleneStore } from '../store/useSeleneStore';

describe('Phase 1 — Architectural Foundation, Security, DB & State Store Verification', () => {
  it('enforces strict SSRF allowlist and safe error sanitization', () => {
    assert.ok(assertAllowedUpstreamUrl('https://trek.nasa.gov/tiles/Moon/SP/sample.png'));
    assert.ok(assertAllowedUpstreamUrl('https://ssd.jpl.nasa.gov/api/horizons.api?format=json'));
    assert.ok(assertAllowedUpstreamUrl('https://wms.im-ldi.com/?SERVICE=WMS'));

    assert.throws(() => assertAllowedUpstreamUrl('http://trek.nasa.gov/tiles/a.png'));
    assert.throws(() => assertAllowedUpstreamUrl('https://127.0.0.1/secret'));
    assert.throws(() => assertAllowedUpstreamUrl('https://169.254.169.254/latest/meta-data/'));
    assert.throws(() => assertAllowedUpstreamUrl('https://user:pass@trek.nasa.gov/'));
    assert.throws(() => assertAllowedUpstreamUrl('https://example.org/wmts'));

    const sanitized = sanitizePublicError(new Error('Failure at /app/applet/server/db/selene.db'));
    assert.ok(!sanitized.includes('/app/applet/server/db/selene.db'));

    const rateRes = checkProviderRateLimit('JPL_HORIZONS_REST', 'unit-test-client');
    assert.equal(rateRes.allowed, true);
  });

  it('produces canonical deterministic cache keys and SHA-256 digests', async () => {
    const a = canonicalizeParameters({ b: 2, a: { y: 9, x: 1 } });
    const b = canonicalizeParameters({ a: { x: 1, y: 9 }, b: 2 });
    assert.equal(a, b);

    const hashA = await computeCanonicalSha256('calc', { z: 3, site: 'shackleton' });
    const hashB = await computeCanonicalSha256('calc', { site: 'shackleton', z: 3 });
    assert.equal(hashA, hashB);
    assert.equal(hashA.length, 64);

    const tileKey = buildTileCacheKey({
      provider: 'NASA_MOON_TREK_WMTS',
      dataset: 'LRO_NAC_AvgMosaic_SPole855_1mp',
      layer: 'LRO_NAC_AvgMosaic_SPole855_1mp',
      projection: 'SP',
      tileMatrixSet: 'default028mm',
      zoom: 2,
      row: 1,
      col: 1,
    });
    assert.ok(tileKey.includes('"projection":"SP"'));

    const calcKey = buildCalculationCacheKey({
      siteId: 'shackleton-rim',
      epochUtc: '2027-02-04T20:39:00.181Z',
      timeScale: 'TDB_ET',
      referenceFrame: 'IAU_MOON_ME',
      modelVersion: 'DE441-V2.4',
      calculationParams: { minSolar: 0.2, minEarth: 1.0 },
    });
    assert.ok(calcKey.includes('"referenceFrame":"IAU_MOON_ME"'));
  });

  it('tracks SPICE kernel order and explicit Horizons vs analytical validation caveats', () => {
    assert.equal(LOADED_SPICE_KERNELS[0]?.id, 'lsk-naif0012');
    const snap = getMissionTimeSnapshot('2027-02-04T20:39:00.181Z');
    assert.equal(snap.scales.taiMinusUtcSeconds, 37);
    assert.ok(snap.kernels.length >= 4);

    const offlineCheck = validateHorizonsVsAnalyticalCompatibility({
      analyticalSubSolar: { latDeg: 0.14, lonDeg: -164.23 },
      analyticalSubEarth: { latDeg: 2.81, lonDeg: 2.33 },
    });
    assert.equal(offlineCheck.compatible, false);
    assert.equal(offlineCheck.deltaSubSolarDeg, null);

    const syncedCheck = validateHorizonsVsAnalyticalCompatibility({
      horizonsSubSolar: { latDeg: 0.145, lonDeg: -164.24 },
      analyticalSubSolar: { latDeg: 0.14, lonDeg: -164.23 },
      horizonsSubEarth: { latDeg: 2.815, lonDeg: 2.335 },
      analyticalSubEarth: { latDeg: 2.81, lonDeg: 2.33 },
    });
    assert.equal(syncedCheck.compatible, true);
  });

  it('runs SQLite migrations, computes dataset SHA-256 checksums, and protects preset sites', () => {
    const db = getSeleneDb();
    const status = getDatabaseDeploymentStatus();
    assert.equal(status.walCompatible, true);
    assert.equal(status.foreignKeysEnabled, true);
    assert.equal(status.integrityCheck, 'ok');
    assert.ok(status.appliedMigrations.length >= 3);

    const datasets = db.prepare('SELECT * FROM datasets').all() as DatasetRecord[];
    assert.ok(datasets.length >= 10);
    assert.ok(datasets.every((d) => typeof d.checksum_sha256 === 'string' && d.checksum_sha256.length === 64));

    assert.throws(() => assertSiteMutable('shackleton-rim'), /immutable/);
  });

  it('resolves 8-item Global Top Nav + legacy hashes and enforces store v2 constraints', () => {
    assert.equal(GLOBAL_TOP_NAV_ITEMS.length, 7); // + Flight Brief button = 8 total destinations
    assert.deepEqual(resolveNavigationTarget('#overview'), {
      workspace: 'site-analysis',
      subsection: 'overview',
    });
    assert.deepEqual(resolveNavigationTarget('#timeline'), {
      workspace: 'simulator',
      subsection: 'timeline',
    });
    assert.equal(resolveNavigationTarget('#settings').openFlightBrief, true);
    assert.equal(buildWorkspaceHash('site-analysis', 'illumination'), '#site-analysis/illumination');

    const store = useSeleneStore.getState();
    assert.equal(store.themePreference, 'dark');
    store.setInspectorWidthPx(900);
    assert.equal(useSeleneStore.getState().inspectorWidthPx, 460);
    store.setInspectorWidthPx(120);
    assert.equal(useSeleneStore.getState().inspectorWidthPx, 280);
    store.resetLayoutPreferences();
    assert.equal(useSeleneStore.getState().inspectorWidthPx, 340);
  });
});
