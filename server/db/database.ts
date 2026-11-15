/**
 * Project Selene — SQLite Persistence & Provenance Database (`server/db/selene.db`)
 * Runs in high-performance WAL (Write-Ahead Logging) mode with foreign_keys = ON.
 * Implements all 5 required tables:
 * 1. datasets
 * 2. landing_sites
 * 3. scenarios
 * 4. analysis_runs
 * 5. analysis_points
 */

import Database from 'better-sqlite3';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export interface DatasetRecord {
  id: string;
  name: string;
  provider: string;
  version: string;
  spatial_coverage: string;
  resolution_m: number;
  datum: string;
  is_available: number;
  verified_at: string;
  checksum_sha256?: string;
}

export type MissionCategory =
  | 'ARTEMIS'
  | 'APOLLO'
  | 'CLPS'
  | 'INTERNATIONAL'
  | 'CUSTOM';

export type LandingSiteStatus =
  | 'HISTORICAL_LANDING'
  | 'CONFIRMED_LANDING'
  | 'PLANNED_TARGET'
  | 'CANDIDATE_REGION'
  | 'CUSTOM_COORDINATES';

export function getSiteStatusLabel(site: Pick<LandingSiteRecord, 'id' | 'is_preset' | 'mission_category' | 'site_status'>): string {
  const status = resolveSiteStatus(site);
  switch (status) {
    case 'HISTORICAL_LANDING':
      return 'HISTORICAL LANDING LOCATION';
    case 'CONFIRMED_LANDING':
      return 'CONFIRMED LANDING';
    case 'PLANNED_TARGET':
      return 'PLANNED MISSION TARGET';
    case 'CUSTOM_COORDINATES':
      return 'CUSTOM COORDINATES';
    case 'CANDIDATE_REGION':
    default:
      return 'CANDIDATE REGION';
  }
}

export function resolveSiteStatus(
  site: Pick<LandingSiteRecord, 'id' | 'is_preset' | 'mission_category' | 'site_status'>
): LandingSiteStatus {
  if (site.site_status) return site.site_status;
  if (!site.is_preset || site.mission_category === 'CUSTOM') return 'CUSTOM_COORDINATES';
  if (site.mission_category === 'APOLLO') return 'HISTORICAL_LANDING';
  if (site.id === 'clps-im1-malapert-a' || site.id === 'isro-chandrayaan3-shiv-shakti') {
    return 'CONFIRMED_LANDING';
  }
  if (
    site.id === 'clps-viper-mons-mouton' ||
    site.id === 'clps-blue-ghost-crisium' ||
    site.id === 'cnsa-change7-shackleton'
  ) {
    return 'PLANNED_TARGET';
  }
  return 'CANDIDATE_REGION';
}

export interface LandingSiteRecord {
  id: string;
  name: string;
  designation: string;
  latitude: number;
  longitude: number;
  elevation_km: number;
  crater_name: string;
  description: string;
  scientific_value: string;
  psr_proximity_km: number;
  slope_deg: number;
  is_preset: number;
  mission_category?: MissionCategory;
  region_tier?: string;
  site_status?: LandingSiteStatus;
  created_at: string;
}

export interface ScenarioRecord {
  id: string;
  name: string;
  site_id: string;
  landing_date: string;
  duration_days: number;
  lander_type: string;
  min_solar_elevation_deg: number;
  min_earth_elevation_deg: number;
  required_continuous_hours: number;
  notes: string;
  created_at: string;
}

interface SeleneDbGlobalState {
  db: Database.Database | null;
  dbPath: string | null;
  initialized: boolean;
  shutdownRegistered: boolean;
}

const SELENE_DB_GLOBAL_KEY = '__seleneSqliteState__';

function getGlobalDbState(): SeleneDbGlobalState {
  const g = globalThis as unknown as Record<string, SeleneDbGlobalState | undefined>;
  if (!g[SELENE_DB_GLOBAL_KEY]) {
    g[SELENE_DB_GLOBAL_KEY] = {
      db: null,
      dbPath: null,
      initialized: false,
      shutdownRegistered: false,
    };
  }
  return g[SELENE_DB_GLOBAL_KEY]!;
}

/**
 * Resolves a single canonical, absolute path for `server/db/selene.db`.
 * Searches upward from both `__dirname` and `process.cwd()` (ignoring `.next` / `.next-dev`
 * build output directories) so dev, production, standalone, and test runners never
 * accidentally create a competing empty `selene.db` in a different working directory.
 */
export function getSeleneDbPath(): string {
  const envOverride = process.env.SELENE_DB_PATH?.trim();
  if (envOverride) {
    return path.resolve(envOverride);
  }

  const candidateBases = [process.cwd(), __dirname];
  const visited = new Set<string>();

  // Pass 1: Prefer an existing `server/db/selene.db` at any non-build ancestor root
  for (const base of candidateBases) {
    let dir = path.resolve(base);
    for (let depth = 0; depth < 8; depth++) {
      if (!visited.has(dir)) {
        visited.add(dir);
        const isBuildSubdir =
          dir.includes(`${path.sep}.next${path.sep}`) ||
          dir.endsWith(`${path.sep}.next`) ||
          dir.includes(`${path.sep}.next-dev${path.sep}`) ||
          dir.endsWith(`${path.sep}.next-dev`);
        if (!isBuildSubdir) {
          const candidateDb = path.join(dir, 'server', 'db', 'selene.db');
          if (fs.existsSync(candidateDb)) {
            return candidateDb;
          }
        }
      }
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }

  // Pass 2: Fall back to project root containing package.json (excluding .next standalone package.json)
  for (const base of candidateBases) {
    let dir = path.resolve(base);
    for (let depth = 0; depth < 8; depth++) {
      const isBuildSubdir =
        dir.includes(`${path.sep}.next${path.sep}`) ||
        dir.endsWith(`${path.sep}.next`) ||
        dir.includes(`${path.sep}.next-dev${path.sep}`) ||
        dir.endsWith(`${path.sep}.next-dev`);
      if (
        !isBuildSubdir &&
        fs.existsSync(path.join(dir, 'package.json')) &&
        fs.existsSync(path.join(dir, 'server'))
      ) {
        return path.join(dir, 'server', 'db', 'selene.db');
      }
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }

  return path.resolve(process.cwd(), 'server', 'db', 'selene.db');
}

function classifySqliteError(err: unknown, dbPath: string): Error {
  const code = (err as { code?: string })?.code ?? '';
  const msg = err instanceof Error ? err.message : String(err);

  if (code === 'SQLITE_CORRUPT' || code === 'SQLITE_NOTADB' || msg.includes('malformed')) {
    return new Error(
      `SQLite database integrity error at '${dbPath}': ${msg}. Database was NOT reset or deleted; inspect or restore from a verified backup.`
    );
  }
  if (code === 'SQLITE_READONLY' || code === 'EACCES' || code === 'EPERM') {
    return new Error(
      `SQLite permission error accessing '${dbPath}' or its WAL/SHM sidecars: ${msg}. Ensure the runtime user has read/write permissions on the database directory and files.`
    );
  }
  if (code === 'SQLITE_BUSY' || code === 'SQLITE_LOCKED') {
    return new Error(
      `SQLite lock contention at '${dbPath}' after busy_timeout: ${msg}. Ensure no external process holds an exclusive lock on the database.`
    );
  }
  if (code === 'SQLITE_CANTOPEN' || code.startsWith('SQLITE_IOERR')) {
    return new Error(
      `SQLite I/O or open failure at '${dbPath}' (${code || 'IOERR'}): ${msg}. Check filesystem permissions and WAL/SHM sidecar consistency.`
    );
  }
  return err instanceof Error ? err : new Error(msg);
}

function verifyDatabaseFileAccess(dbPath: string): void {
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  fs.accessSync(dbDir, fs.constants.R_OK | fs.constants.W_OK);

  for (const filePath of [dbPath, `${dbPath}-wal`, `${dbPath}-shm`]) {
    if (fs.existsSync(filePath)) {
      fs.accessSync(filePath, fs.constants.R_OK | fs.constants.W_OK);
    }
  }
}

function registerShutdownHooks(): void {
  const state = getGlobalDbState();
  if (state.shutdownRegistered) return;
  state.shutdownRegistered = true;

  const cleanup = () => {
    closeSeleneDb();
  };

  process.once('beforeExit', cleanup);
  process.once('exit', cleanup);
}

export function checkpointSeleneWal(
  mode: 'PASSIVE' | 'FULL' | 'RESTART' | 'TRUNCATE' = 'PASSIVE'
): { busy: number; log: number; checkpointed: number } | null {
  const state = getGlobalDbState();
  if (!state.db || !state.db.open) return null;
  const rows = state.db.pragma(`wal_checkpoint(${mode})`) as {
    busy: number;
    log: number;
    checkpointed: number;
  }[];
  return rows[0] ?? null;
}

export function closeSeleneDb(): void {
  const state = getGlobalDbState();
  const db = state.db;
  if (!db) return;

  state.db = null;
  state.initialized = false;

  if (!db.open) return;

  try {
    db.pragma('wal_checkpoint(TRUNCATE)');
  } catch {
    try {
      db.pragma('wal_checkpoint(PASSIVE)');
    } catch {
      // Non-fatal during shutdown if another reader holds a shared lock
    }
  } finally {
    try {
      db.close();
    } catch {
      // Ignore close error on teardown
    }
  }
}

export function getSeleneDb(): Database.Database {
  const state = getGlobalDbState();
  const dbPath = getSeleneDbPath();

  if (state.db && state.db.open && state.dbPath === dbPath && state.initialized) {
    return state.db;
  }

  if (state.db && !state.db.open) {
    state.db = null;
    state.initialized = false;
  }

  let db: Database.Database | null = null;
  try {
    verifyDatabaseFileAccess(dbPath);

    // Set busy_timeout in constructor before executing any PRAGMA or WAL recovery
    db = new Database(dbPath, { timeout: 5000 });
    db.pragma('busy_timeout = 5000');

    // Configure WAL safely without redundant locking if already in WAL mode
    const currentMode = String(db.pragma('journal_mode', { simple: true })).toLowerCase();
    if (currentMode !== 'wal') {
      const updatedMode = String(db.pragma('journal_mode = WAL', { simple: true })).toLowerCase();
      if (updatedMode !== 'wal') {
        throw new Error(`Unable to enable WAL journal mode (active mode: '${updatedMode}').`);
      }
    }

    db.pragma('foreign_keys = ON');
    db.pragma('synchronous = NORMAL');
    db.pragma('wal_autocheckpoint = 1000');

    // Non-destructive startup integrity verification (never deletes or resets selene.db)
    const quickCheck = String(db.pragma('quick_check(1)', { simple: true })).toLowerCase();
    if (quickCheck !== 'ok') {
      throw new Error(
        `SQLite quick_check failed ('${quickCheck}') at '${dbPath}'. Refusing to auto-reset or overwrite existing database.`
      );
    }

    initializeSchemaAndSeed(db);
    runDatabaseMigrations(db);

    state.db = db;
    state.dbPath = dbPath;
    state.initialized = true;
    registerShutdownHooks();
    return db;
  } catch (err) {
    if (db && db.open) {
      try {
        db.close();
      } catch {
        // Ignore close error after failed init
      }
    }
    throw classifySqliteError(err, dbPath);
  }
}

function initializeSchemaAndSeed(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS datasets (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      provider TEXT NOT NULL,
      version TEXT NOT NULL,
      spatial_coverage TEXT NOT NULL,
      resolution_m REAL NOT NULL,
      datum TEXT NOT NULL,
      is_available INTEGER NOT NULL DEFAULT 1,
      verified_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS landing_sites (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      designation TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      elevation_km REAL NOT NULL,
      crater_name TEXT NOT NULL,
      description TEXT NOT NULL,
      scientific_value TEXT NOT NULL,
      psr_proximity_km REAL NOT NULL,
      slope_deg REAL NOT NULL DEFAULT 6.5,
      is_preset INTEGER NOT NULL DEFAULT 0,
      mission_category TEXT NOT NULL DEFAULT 'ARTEMIS',
      region_tier TEXT NOT NULL DEFAULT 'SOUTH_POLE',
      site_status TEXT NOT NULL DEFAULT 'CANDIDATE_REGION',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS scenarios (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      site_id TEXT NOT NULL,
      landing_date TEXT NOT NULL,
      duration_days REAL NOT NULL,
      lander_type TEXT NOT NULL,
      min_solar_elevation_deg REAL NOT NULL,
      min_earth_elevation_deg REAL NOT NULL,
      required_continuous_hours INTEGER NOT NULL,
      notes TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (site_id) REFERENCES landing_sites(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS analysis_runs (
      id TEXT PRIMARY KEY,
      scenario_id TEXT,
      site_id TEXT NOT NULL,
      epoch_start TEXT NOT NULL,
      epoch_end TEXT NOT NULL,
      step_hours REAL NOT NULL,
      ephemeris_provider TEXT NOT NULL,
      terrain_model_status TEXT NOT NULL,
      total_sunlit_hours REAL NOT NULL,
      total_comms_hours REAL NOT NULL,
      spac_hours REAL NOT NULL,
      feasibility_score REAL NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (site_id) REFERENCES landing_sites(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS analysis_points (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id TEXT NOT NULL,
      epoch_hour REAL NOT NULL,
      timestamp_utc TEXT NOT NULL,
      solar_azimuth_deg REAL NOT NULL,
      solar_elevation_deg REAL NOT NULL,
      earth_azimuth_deg REAL NOT NULL,
      earth_elevation_deg REAL NOT NULL,
      solar_geometric_vis INTEGER NOT NULL,
      solar_terrain_vis INTEGER NOT NULL,
      earth_geometric_vis INTEGER NOT NULL,
      earth_terrain_vis INTEGER NOT NULL,
      is_spac INTEGER NOT NULL,
      solar_irradiance_wm2 REAL NOT NULL,
      FOREIGN KEY (run_id) REFERENCES analysis_runs(id) ON DELETE CASCADE
    );
  `);

  // Safe schema migration for existing selene.db files
  const siteCols = db.prepare('PRAGMA table_info(landing_sites)').all() as { name: string }[];
  const hasMissionCategory = siteCols.some((c) => c.name === 'mission_category');
  const hasRegionTier = siteCols.some((c) => c.name === 'region_tier');
  const hasSiteStatus = siteCols.some((c) => c.name === 'site_status');
  if (!hasMissionCategory) {
    db.exec("ALTER TABLE landing_sites ADD COLUMN mission_category TEXT NOT NULL DEFAULT 'ARTEMIS'");
  }
  if (!hasRegionTier) {
    db.exec("ALTER TABLE landing_sites ADD COLUMN region_tier TEXT NOT NULL DEFAULT 'SOUTH_POLE'");
  }
  if (!hasSiteStatus) {
    db.exec("ALTER TABLE landing_sites ADD COLUMN site_status TEXT NOT NULL DEFAULT 'CANDIDATE_REGION'");
  }

  // Upsert Scientific Datasets Provenance Registry (NASA PDS, LRO, LOLA, LROC, SPICE)
  const insertDataset = db.prepare(`
    INSERT OR IGNORE INTO datasets (id, name, provider, version, spatial_coverage, resolution_m, datum, is_available, verified_at)
    VALUES (@id, @name, @provider, @version, @spatial_coverage, @resolution_m, @datum, @is_available, @verified_at)
  `);

  const seedDatasets: DatasetRecord[] = [
    {
      id: 'lola-dem-sp-v1.4',
      name: 'LRO LOLA South Polar Digital Elevation Model (LDEM_80S)',
      provider: 'NASA GSFC / PDS Geosciences Node',
      version: 'v1.4 GDS',
      spatial_coverage: '80.0°S to 90.0°S (Polar Stereographic)',
      resolution_m: 5.0,
      datum: 'IAU/IAG MOON_ME Sphere (R = 1737.4 km)',
      is_available: 1,
      verified_at: '2026-11-01T00:00:00Z',
    },
    {
      id: 'jpl-de441-ephemeris',
      name: 'JPL Planetary and Lunar Ephemeris DE441 + Moon Principal Axes',
      provider: 'NASA Jet Propulsion Laboratory (SSD/Horizons)',
      version: 'DE441-MOON_ME',
      spatial_coverage: 'Global Selenocentric & Topocentric ENU',
      resolution_m: 0.01,
      datum: 'ICRF / IAU MOON_ME',
      is_available: 1,
      verified_at: '2026-11-01T00:00:00Z',
    },
    {
      id: 'nasa-spice-moon-pa-de440',
      name: 'NASA NAIF SPICE Lunar Orientation & Frame Kernel (moon_pa_de440_200625.bpc)',
      provider: 'NASA NAIF / JPL Navigation and Ancillary Information Facility',
      version: 'N0067 SPICE',
      spatial_coverage: 'Global Selenocentric Attitude & Libration',
      resolution_m: 0.01,
      datum: 'MOON_PA / MOON_ME High-Precision Frame Transformation',
      is_available: 1,
      verified_at: '2026-11-01T00:00:00Z',
    },
    {
      id: 'lroc-wac-polar-mosaic',
      name: 'LRO LROC Wide Angle Camera South Pole Basemap Mosaic',
      provider: 'NASA / Arizona State University (PDS Imaging Node)',
      version: 'v2.1 CDR',
      spatial_coverage: '60.0°S to 90.0°S',
      resolution_m: 100.0,
      datum: 'IAU MOON_ME',
      is_available: 1,
      verified_at: '2026-11-01T00:00:00Z',
    },
    {
      id: 'lola-global-dem-118m',
      name: 'LRO LOLA Global Digital Elevation Model (LDEM_1024)',
      provider: 'NASA GSFC / PDS Geosciences Node',
      version: 'v1.8 GDR',
      spatial_coverage: '90.0°S to 90.0°N Global Cylindrical',
      resolution_m: 118.0,
      datum: 'IAU/IAG MOON_ME Sphere (R = 1737.4 km)',
      is_available: 1,
      verified_at: '2026-11-01T00:00:00Z',
    },
    {
      id: 'diviner-bolometric-temp',
      name: 'LRO Diviner Lunar Radiometer South Polar Bolometric Temperature & PSR Map',
      provider: 'NASA / UCLA Diviner Science Team',
      version: 'v3.0 GDR',
      spatial_coverage: '75.0°S to 90.0°S',
      resolution_m: 240.0,
      datum: 'IAU MOON_ME',
      is_available: 1,
      verified_at: '2026-11-01T00:00:00Z',
    },
    {
      id: 'lcross-lend-water-ice',
      name: 'LCROSS & LEND Epithermal Neutron Hydrogen / Water-Ice Equivalent Map',
      provider: 'NASA Ames / IKI LEND Team',
      version: 'v2.2 Calibrated',
      spatial_coverage: '80.0°S to 90.0°S Cold Traps',
      resolution_m: 1000.0,
      datum: 'IAU MOON_ME',
      is_available: 1,
      verified_at: '2026-11-01T00:00:00Z',
    },
    {
      id: 'grail-bouguer-gravity',
      name: 'GRAIL JGGRX_1500E Bouguer Gravity Anomaly & Crustal Thickness Model',
      provider: 'NASA / MIT GRAIL Science Team',
      version: 'JGGRX_1500E',
      spatial_coverage: 'Global Lunar Sphere',
      resolution_m: 4500.0,
      datum: 'IAU MOON_ME',
      is_available: 1,
      verified_at: '2026-11-01T00:00:00Z',
    },
    {
      id: 'nasa-moontrek-wmts',
      name: 'NASA Moon Trek OGC WMTS Tile & Layer Service (EQ / SP / NP)',
      provider: 'NASA JPL / Solar System Treks (trek.nasa.gov)',
      version: 'WMTS 1.0.0',
      spatial_coverage: 'Global Equirectangular & North/South Polar Stereographic',
      resolution_m: 10.0,
      datum: 'EPSG:104903 / IAU2000:30118 / IAU2000:30120',
      is_available: 1,
      verified_at: '2026-11-13T00:00:00Z',
    },
    {
      id: 'jpl-horizons-rest-api',
      name: 'NASA/JPL Horizons On-Line Ephemeris System REST API (OBSERVER / VECTORS / ELEMENTS)',
      provider: 'NASA Jet Propulsion Laboratory Solar System Dynamics (ssd.jpl.nasa.gov)',
      version: 'v1.2 (DE441)',
      spatial_coverage: 'ICRF / J2000 / Topocentric Selenocentric (301, 399, 10, -85)',
      resolution_m: 0.001,
      datum: 'ICRF / IAU_MOON (DE441)',
      is_available: 1,
      verified_at: '2026-11-13T00:00:00Z',
    },
    {
      id: 'lroc-lunaserv-wms',
      name: 'LROC QuickMap & Lunaserv OGC WMS / PDS Data Archive (WAC / NAC / DTMs)',
      provider: 'Arizona State University / LROC Science Operations Center (wms.im-ldi.com)',
      version: 'WMS 1.1.1 / PDS3-PDS4',
      spatial_coverage: 'Global EPSG:4326 & Polar Orthographic AUTO:42003',
      resolution_m: 0.5,
      datum: 'IAU2000:30100 / MOON_ME (R = 1737.4 km)',
      is_available: 1,
      verified_at: '2026-11-13T00:00:00Z',
    },
  ];

  // Create external service cache and integration audit tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS external_api_cache (
      cache_key TEXT PRIMARY KEY,
      service_name TEXT NOT NULL,
      endpoint_url TEXT NOT NULL,
      content_type TEXT NOT NULL,
      payload_text TEXT,
      payload_blob BLOB,
      provenance_json TEXT NOT NULL,
      http_status INTEGER NOT NULL DEFAULT 200,
      created_at_ms INTEGER NOT NULL,
      expires_at_ms INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_external_api_cache_service
      ON external_api_cache(service_name, expires_at_ms);

    CREATE TABLE IF NOT EXISTS integration_audit_runs (
      id TEXT PRIMARY KEY,
      executed_at TEXT NOT NULL,
      overall_status TEXT NOT NULL,
      moontrek_status TEXT NOT NULL,
      horizons_status TEXT NOT NULL,
      lroc_status TEXT NOT NULL,
      report_json TEXT NOT NULL
    );
  `);

  const insertManyDatasets = db.transaction((items: DatasetRecord[]) => {
    for (const item of items) insertDataset.run(item);
  });
  insertManyDatasets(seedDatasets);

  // Upsert Curated Global Lunar Landing Sites (Artemis, Apollo, CLPS, International)
  const insertSite = db.prepare(`
    INSERT OR IGNORE INTO landing_sites (id, name, designation, latitude, longitude, elevation_km, crater_name, description, scientific_value, psr_proximity_km, slope_deg, is_preset, mission_category, region_tier, site_status, created_at)
    VALUES (@id, @name, @designation, @latitude, @longitude, @elevation_km, @crater_name, @description, @scientific_value, @psr_proximity_km, @slope_deg, @is_preset, @mission_category, @region_tier, @site_status, @created_at)
  `);

  const updateSiteStatus = db.prepare(`
    UPDATE landing_sites
    SET site_status = @site_status
    WHERE id = @id AND (site_status IS NULL OR site_status = '' OR site_status != @site_status)
  `);

  const seedSites: LandingSiteRecord[] = [
    {
      id: 'shackleton-rim',
      name: 'Shackleton Crater Rim',
      designation: 'ARTEMIS-SP-001',
      latitude: -89.78,
      longitude: 120.45,
      elevation_km: 2.15,
      crater_name: 'Shackleton (21 km dia, 4.2 km depth)',
      description:
        'Elevated connecting ridge along the Shackleton crater rim crest near the Lunar South Pole. Offers exceptional quasi-continuous grazing solar illumination (>84% in summer) immediately adjacent to a premier permanently shadowed cold trap.',
      scientific_value:
        'Direct rover/EVA access to cryogenic water-ice deposits inside Shackleton interior floor (<0.8 km from rim edge) plus South Pole-Aitken basin impact melt samples.',
      psr_proximity_km: 0.8,
      slope_deg: 5.8,
      is_preset: 1,
      mission_category: 'ARTEMIS',
      region_tier: 'SOUTH_POLE',
      site_status: 'CANDIDATE_REGION',
      created_at: '2026-11-01T00:00:00Z',
    },
    {
      id: 'malapert-massif',
      name: 'Malapert Mountain',
      designation: 'ARTEMIS-SP-002',
      latitude: -84.9,
      longitude: 12.9,
      elevation_km: 4.85,
      crater_name: 'Malapert Massif Summit Ridge',
      description:
        'Commanding 4.85 km high mountain massif oriented toward the mean sub-Earth meridian (0°E). Provides near-continuous Direct-to-Earth (DTE) line-of-sight communication and unobstructed northern horizon.',
      scientific_value:
        'Primary lunar telecommunications relay peak and ancient pre-Nectarian highland massif sampling from the South Pole-Aitken basin rim.',
      psr_proximity_km: 3.4,
      slope_deg: 7.2,
      is_preset: 1,
      mission_category: 'ARTEMIS',
      region_tier: 'SOUTH_POLE',
      site_status: 'CANDIDATE_REGION',
      created_at: '2026-11-01T00:00:00Z',
    },
    {
      id: 'nobile-rim-1',
      name: 'Nobile Crater Rim',
      designation: 'ARTEMIS-SP-003',
      latitude: -85.2,
      longitude: 53.5,
      elevation_km: 1.65,
      crater_name: 'Nobile Crater Western Rim (VIPER Zone)',
      description:
        'Broad, gently sloping highland plateau on the western rim of Nobile Crater. Combines gentle trafficability slopes (<6°) with accessible micro-cold-traps for volatile prospecting.',
      scientific_value:
        'High concentration of shallow subsurface hydrogen signatures (LEND/LCROSS) across accessible thermal stability zones.',
      psr_proximity_km: 1.2,
      slope_deg: 4.9,
      is_preset: 1,
      mission_category: 'ARTEMIS',
      region_tier: 'SOUTH_POLE',
      site_status: 'CANDIDATE_REGION',
      created_at: '2026-11-01T00:00:00Z',
    },
    {
      id: 'haworth-crater',
      name: 'Haworth Crater',
      designation: 'ARTEMIS-SP-004',
      latitude: -87.4,
      longitude: 354.5,
      elevation_km: 0.85,
      crater_name: 'Haworth Southern Rim Bench',
      description:
        'Polygonal 51 km crater adjacent to Shoemaker and Faustini. Features extensive ultra-cold permanently shadowed floors (<40 K Diviner bolometric temperature) surrounded by steep massif walls.',
      scientific_value:
        'Super-cold trap capable of sequestering ultra-volatile species (CO2, NH3, H2S, H2O) alongside ancient stratified basin ejecta.',
      psr_proximity_km: 0.5,
      slope_deg: 9.4,
      is_preset: 1,
      mission_category: 'ARTEMIS',
      region_tier: 'SOUTH_POLE',
      site_status: 'CANDIDATE_REGION',
      created_at: '2026-11-01T00:00:00Z',
    },
    {
      id: 'clps-im1-malapert-a',
      name: 'Malapert A (IM-1 Odysseus)',
      designation: 'CLPS-IM1-19A',
      latitude: -80.13,
      longitude: 1.44,
      elevation_km: 0.62,
      crater_name: 'Malapert A Highland Plain',
      description:
        'First U.S. commercial soft lunar landing site (Intuitive Machines Nova-C Odysseus, Feb 2024) in the southern polar highlands. Features moderate cratered hummocky plains with direct Earth visibility.',
      scientific_value:
        'Radio astronomy low-frequency plasma environment baseline, plume-regolith interaction, and southern highland crustal geology.',
      psr_proximity_km: 6.2,
      slope_deg: 11.2,
      is_preset: 1,
      mission_category: 'CLPS',
      region_tier: 'SOUTH_POLE',
      site_status: 'CONFIRMED_LANDING',
      created_at: '2026-11-01T00:00:00Z',
    },
    {
      id: 'clps-viper-mons-mouton',
      name: 'Mons Mouton (CLPS Griffin / VIPER)',
      designation: 'CLPS-20A-MM',
      latitude: -84.6,
      longitude: 31.0,
      elevation_km: 5.1,
      crater_name: 'Mons Mouton Flat-Topped Massif',
      description:
        'Expansive, flat-topped 5.1 km mountain plateau near the western rim of Nobile Crater. Selected for Astrobotic Griffin CLPS delivery due to low boulder density and prolonged summer sunlight.',
      scientific_value:
        'In-situ volatile drill prospecting across four distinct ice-stability thermal depth regimes (surface, shallow, deep, dry).',
      psr_proximity_km: 1.1,
      slope_deg: 4.2,
      is_preset: 1,
      mission_category: 'CLPS',
      region_tier: 'SOUTH_POLE',
      site_status: 'PLANNED_TARGET',
      created_at: '2026-11-01T00:00:00Z',
    },
    {
      id: 'clps-blue-ghost-crisium',
      name: 'Mons Latreille (Firefly Blue Ghost M1)',
      designation: 'CLPS-19D-MC',
      latitude: 18.56,
      longitude: 61.81,
      elevation_km: -3.2,
      crater_name: 'Mare Crisium — Mons Latreille Volcanic Cone',
      description:
        'Equatorial/mid-latitude volcanic plain in Mare Crisium targeted by NASA CLPS Firefly Blue Ghost Mission 1. Experiences classic 14.7-day lunar day / 14.7-day cryogenic night cycle with high overhead Sun.',
      scientific_value:
        'LEXI X-ray magnetosphere imaging, lunar magnetotelluric sounding, and regolith adherence characterization.',
      psr_proximity_km: 1450.0,
      slope_deg: 2.4,
      is_preset: 1,
      mission_category: 'CLPS',
      region_tier: 'EQUATORIAL_MID',
      site_status: 'PLANNED_TARGET',
      created_at: '2026-11-01T00:00:00Z',
    },
    {
      id: 'isro-chandrayaan3-shiv-shakti',
      name: 'Statio Shiv Shakti (Chandrayaan-3)',
      designation: 'INTL-ISRO-CY3',
      latitude: -69.373,
      longitude: 32.319,
      elevation_km: 0.45,
      crater_name: 'Manzinus–Boguslawsky Highland Ridge',
      description:
        'Historic ISRO Chandrayaan-3 Vikram lander and Pragyan rover touchdown site (Aug 2023) in the southern high latitudes. Gently undulating highland plains between Manzinus C and Simpelius N.',
      scientific_value:
        'ChaSTE in-situ thermal conductivity profile (steep top-10cm temperature gradient) and APXS sulfur/elemental composition.',
      psr_proximity_km: 18.5,
      slope_deg: 5.5,
      is_preset: 1,
      mission_category: 'INTERNATIONAL',
      region_tier: 'SOUTH_POLE',
      site_status: 'CONFIRMED_LANDING',
      created_at: '2026-11-01T00:00:00Z',
    },
    {
      id: 'cnsa-change7-shackleton',
      name: 'Shackleton–de Gerlache Ridge (Chang’e-7)',
      designation: 'INTL-CNSA-CE7',
      latitude: -89.45,
      longitude: 222.8,
      elevation_km: 2.38,
      crater_name: 'Connecting Ridge (Shackleton to de Gerlache)',
      description:
        'High-altitude illuminated saddle connecting Shackleton and de Gerlache craters targeted by international polar lander and mini-flying hopper probe missions.',
      scientific_value:
        'Direct hopper excursion from sunlit rim into permanently shadowed water-ice floor traps.',
      psr_proximity_km: 0.6,
      slope_deg: 6.1,
      is_preset: 1,
      mission_category: 'INTERNATIONAL',
      region_tier: 'SOUTH_POLE',
      site_status: 'PLANNED_TARGET',
      created_at: '2026-11-01T00:00:00Z',
    },
    {
      id: 'apollo-11-tranquility',
      name: 'Statio Tranquillitatis (Apollo 11)',
      designation: 'APOLLO-11-AS11',
      latitude: 0.674,
      longitude: 23.473,
      elevation_km: -1.9,
      crater_name: 'Mare Tranquillitatis (Sea of Tranquility)',
      description:
        'Historic first human lunar landing site (July 20, 1969). Smooth equatorial titanium-rich basaltic mare plain with unobstructed zenith Earth communication and full 354-hour synodic day/night cycles.',
      scientific_value:
        'Radiometric age calibration benchmark (3.7 Ga high-Ti mare basalts) and passive seismic/laser retroreflector reference station.',
      psr_proximity_km: 2680.0,
      slope_deg: 1.8,
      is_preset: 1,
      mission_category: 'APOLLO',
      region_tier: 'EQUATORIAL_MID',
      site_status: 'HISTORICAL_LANDING',
      created_at: '2026-11-01T00:00:00Z',
    },
    {
      id: 'apollo-15-hadley',
      name: 'Hadley–Apennine (Apollo 15)',
      designation: 'APOLLO-15-AS15',
      latitude: 26.132,
      longitude: 3.634,
      elevation_km: -1.45,
      crater_name: 'Palus Putredinis / Rima Hadley & Mons Hadley Delta',
      description:
        'First J-mission extended scientific exploration site (July 1971) nestled between the 1.5 km deep Hadley Rille and the 4 km towering Apennine Mountain front.',
      scientific_value:
        'Anorthositic primordial crust (Genesis Rock 15415), volcanic green glass pyroclastics, and heat-flow probe benchmark.',
      psr_proximity_km: 1920.0,
      slope_deg: 6.4,
      is_preset: 1,
      mission_category: 'APOLLO',
      region_tier: 'EQUATORIAL_MID',
      site_status: 'HISTORICAL_LANDING',
      created_at: '2026-11-01T00:00:00Z',
    },
    {
      id: 'apollo-17-taurus',
      name: 'Taurus–Littrow Valley (Apollo 17)',
      designation: 'APOLLO-17-AS17',
      latitude: 20.191,
      longitude: 30.772,
      elevation_km: -2.55,
      crater_name: 'Taurus–Littrow Graben (South & North Massifs)',
      description:
        'Final Apollo crewed geological expedition (Dec 1972) in a deep graben valley flanked by 2 km tall Serenitatis basin ring massifs.',
      scientific_value:
        'Shorty Crater orange volcanic glass beads (fire-fountain volatile mantle signature) and Serenitatis impact melt breccias.',
      psr_proximity_km: 2110.0,
      slope_deg: 5.1,
      is_preset: 1,
      mission_category: 'APOLLO',
      region_tier: 'EQUATORIAL_MID',
      site_status: 'HISTORICAL_LANDING',
      created_at: '2026-11-01T00:00:00Z',
    },
  ];

  const insertManySites = db.transaction((items: LandingSiteRecord[]) => {
    for (const item of items) {
      insertSite.run(item);
      updateSiteStatus.run({ id: item.id, site_status: item.site_status ?? 'CANDIDATE_REGION' });
    }
  });
  insertManySites(seedSites);

  // Upsert Default Trade-Study Scenarios
  const insertScenario = db.prepare(`
    INSERT OR IGNORE INTO scenarios (id, name, site_id, landing_date, duration_days, lander_type, min_solar_elevation_deg, min_earth_elevation_deg, required_continuous_hours, notes, created_at)
    VALUES (@id, @name, @site_id, @landing_date, @duration_days, @lander_type, @min_solar_elevation_deg, @min_earth_elevation_deg, @required_continuous_hours, @notes, @created_at)
  `);

  const seedScenarios: ScenarioRecord[] = [
    {
      id: 'scen-artemis-iii-shackleton',
      name: 'Artemis III Nominal — Shackleton Crest (Feb 2027 Summer)',
      site_id: 'shackleton-rim',
      landing_date: '2027-02-01T00:00:00Z',
      duration_days: 14,
      lander_type: 'HLS Crewed Vertical Solar Array (18 m²)',
      min_solar_elevation_deg: 0.2,
      min_earth_elevation_deg: 1.0,
      required_continuous_hours: 120,
      notes:
        'Baseline 14-day crewed surface stay targeting southern summer illumination peak and favorable Earth northern libration.',
      created_at: '2026-11-01T00:00:00Z',
    },
    {
      id: 'scen-clps-malapert-relay',
      name: 'CLPS DTE Comm Relay — Malapert Summit (Feb 2027)',
      site_id: 'malapert-massif',
      landing_date: '2027-02-01T00:00:00Z',
      duration_days: 14,
      lander_type: 'CLPS Heavy Cargo & Ka-Band Transceiver',
      min_solar_elevation_deg: 0.5,
      min_earth_elevation_deg: 1.5,
      required_continuous_hours: 140,
      notes:
        'High-elevation massif trade study maximizing continuous Direct-to-Earth Ka-band link availability.',
      created_at: '2026-11-01T00:00:00Z',
    },
    {
      id: 'scen-viper-nobile-volatile',
      name: 'Volatile Drill Campaign — Nobile Rim (Feb 2027)',
      site_id: 'nobile-rim-1',
      landing_date: '2027-02-01T00:00:00Z',
      duration_days: 14,
      lander_type: 'Robotic Ice Drill Rover + Mast Array',
      min_solar_elevation_deg: 0.3,
      min_earth_elevation_deg: 1.0,
      required_continuous_hours: 96,
      notes:
        'Evaluates Nobile Rim solar/Earth co-visibility window for 1-meter regolith core drilling.',
      created_at: '2026-11-01T00:00:00Z',
    },
    {
      id: 'scen-haworth-cryo-probe',
      name: 'Cryogenic Cold-Trap Probe — Haworth (Jun 2027 Winter)',
      site_id: 'haworth-crater',
      landing_date: '2027-06-10T00:00:00Z',
      duration_days: 14,
      lander_type: 'RTG-Assisted Cryogenic Hopper',
      min_solar_elevation_deg: 0.5,
      min_earth_elevation_deg: 1.0,
      required_continuous_hours: 96,
      notes:
        'Stress-test scenario inside deep topographic horizon mask during subsolar northern excursion.',
      created_at: '2026-11-01T00:00:00Z',
    },
    {
      id: 'scen-apollo11-equatorial-benchmark',
      name: 'Apollo 11 Tranquility Benchmark — Lunar Dawn (Feb 2027)',
      site_id: 'apollo-11-tranquility',
      landing_date: '2027-02-01T00:00:00Z',
      duration_days: 14,
      lander_type: 'Horizontal Deck Array Lander',
      min_solar_elevation_deg: 2.0,
      min_earth_elevation_deg: 5.0,
      required_continuous_hours: 120,
      notes:
        'Equatorial benchmark comparison demonstrating high zenith Earth elevation (+66°) vs 14.7-day lunar night cutoff.',
      created_at: '2026-11-01T00:00:00Z',
    },
    {
      id: 'scen-isro-shiv-shakti-campaign',
      name: 'ISRO Shiv Shakti High-Latitude Survey (Feb 2027)',
      site_id: 'isro-chandrayaan3-shiv-shakti',
      landing_date: '2027-02-01T00:00:00Z',
      duration_days: 14,
      lander_type: 'Vikram-Class Lander + Pragyan Rover',
      min_solar_elevation_deg: 1.0,
      min_earth_elevation_deg: 2.0,
      required_continuous_hours: 96,
      notes:
        'Evaluates 69.37°S high-latitude illumination and Earth elevation visibility against polar crests.',
      created_at: '2026-11-01T00:00:00Z',
    },
  ];

  const insertManyScenarios = db.transaction((items: ScenarioRecord[]) => {
    for (const item of items) insertScenario.run(item);
  });
  insertManyScenarios(seedScenarios);
}

export interface CachedExternalResponse {
  cacheKey: string;
  serviceName: string;
  endpointUrl: string;
  contentType: string;
  payloadText: string | null;
  payloadBlob: Buffer | null;
  provenanceJson: string;
  httpStatus: number;
  createdAtMs: number;
  expiresAtMs: number;
}

export function getSqliteCachedResponse(cacheKey: string): CachedExternalResponse | null {
  try {
    const db = getSeleneDb();
    const row = db
      .prepare(
        `SELECT cache_key, service_name, endpoint_url, content_type, payload_text, payload_blob, provenance_json, http_status, created_at_ms, expires_at_ms
         FROM external_api_cache
         WHERE cache_key = ? AND expires_at_ms > ?`
      )
      .get(cacheKey, Date.now()) as
      | {
          cache_key: string;
          service_name: string;
          endpoint_url: string;
          content_type: string;
          payload_text: string | null;
          payload_blob: Buffer | null;
          provenance_json: string;
          http_status: number;
          created_at_ms: number;
          expires_at_ms: number;
        }
      | undefined;
    if (!row) return null;
    return {
      cacheKey: row.cache_key,
      serviceName: row.service_name,
      endpointUrl: row.endpoint_url,
      contentType: row.content_type,
      payloadText: row.payload_text,
      payloadBlob: row.payload_blob,
      provenanceJson: row.provenance_json,
      httpStatus: row.http_status,
      createdAtMs: row.created_at_ms,
      expiresAtMs: row.expires_at_ms,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('integrity error') || msg.includes('quick_check')) {
      throw err;
    }
    console.warn(`[selene-db] Cache read failed for key '${cacheKey}': ${msg}`);
    return null;
  }
}

export function setSqliteCachedResponse(entry: CachedExternalResponse): void {
  try {
    const db = getSeleneDb();
    db.prepare(
      `INSERT OR REPLACE INTO external_api_cache
       (cache_key, service_name, endpoint_url, content_type, payload_text, payload_blob, provenance_json, http_status, created_at_ms, expires_at_ms)
       VALUES (@cacheKey, @serviceName, @endpointUrl, @contentType, @payloadText, @payloadBlob, @provenanceJson, @httpStatus, @createdAtMs, @expiresAtMs)`
    ).run(entry);
  } catch (err) {
    // Non-fatal for transient cache write failures in read-only edge environments, but log explicitly
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[selene-db] Cache write failed for key '${entry.cacheKey}': ${msg}`);
  }
}

export interface DatabaseDeploymentStatus {
  runtime: 'cloud-run-single-instance' | 'local-node';
  journalMode: string;
  foreignKeysEnabled: boolean;
  integrityCheck: string;
  dbSizeBytes: number;
  appliedMigrations: { version: number; name: string; applied_at: string }[];
  walCompatible: boolean;
  persistentStorageCaveat: string;
  multiInstanceRecommendation: string;
}

function computeDatasetChecksum(d: Omit<DatasetRecord, 'checksum_sha256'>): string {
  const canonical = JSON.stringify({
    id: d.id,
    name: d.name,
    provider: d.provider,
    version: d.version,
    spatial_coverage: d.spatial_coverage,
    resolution_m: d.resolution_m,
    datum: d.datum,
  });
  return crypto.createHash('sha256').update(canonical).digest('hex');
}

export function runDatabaseMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);

  const applied = new Set(
    (db.prepare('SELECT version FROM schema_migrations').all() as { version: number }[]).map(
      (r) => r.version
    )
  );

  const migrations: { version: number; name: string; up: () => void }[] = [
    {
      version: 1,
      name: 'v001_initial_core_tables_and_indices',
      up: () => {
        db.exec(`
          CREATE INDEX IF NOT EXISTS idx_analysis_points_run_hour
            ON analysis_points(run_id, epoch_hour);
          CREATE INDEX IF NOT EXISTS idx_analysis_runs_site
            ON analysis_runs(site_id, created_at);
        `);
      },
    },
    {
      version: 2,
      name: 'v002_dataset_sha256_checksums',
      up: () => {
        const cols = db.prepare('PRAGMA table_info(datasets)').all() as { name: string }[];
        if (!cols.some((c) => c.name === 'checksum_sha256')) {
          db.exec("ALTER TABLE datasets ADD COLUMN checksum_sha256 TEXT NOT NULL DEFAULT ''");
        }
        const rows = db.prepare('SELECT * FROM datasets').all() as DatasetRecord[];
        const updateChecksum = db.prepare(
          'UPDATE datasets SET checksum_sha256 = ? WHERE id = ?'
        );
        for (const row of rows) {
          if (!row.checksum_sha256) {
            updateChecksum.run(computeDatasetChecksum(row), row.id);
          }
        }
      },
    },
    {
      version: 3,
      name: 'v003_external_cache_ttl_index',
      up: () => {
        db.exec(`
          CREATE INDEX IF NOT EXISTS idx_external_api_cache_expires
            ON external_api_cache(expires_at_ms);
        `);
      },
    },
  ];

  const recordMigration = db.prepare(
    'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)'
  );

  for (const m of migrations) {
    if (!applied.has(m.version)) {
      const tx = db.transaction(() => {
        m.up();
        recordMigration.run(m.version, m.name, new Date().toISOString());
      });
      tx();
    }
  }
}

export function assertSiteMutable(siteId: string): LandingSiteRecord {
  const db = getSeleneDb();
  const existing = db
    .prepare('SELECT * FROM landing_sites WHERE id = ?')
    .get(siteId) as LandingSiteRecord | undefined;
  if (!existing) {
    throw new Error(`Landing site '${siteId}' not found.`);
  }
  if (existing.is_preset === 1) {
    throw new Error(`Preset reference site '${siteId}' is immutable and read-only.`);
  }
  return existing;
}

export function deleteCustomLandingSite(siteId: string): { deleted: boolean } {
  assertSiteMutable(siteId);
  const db = getSeleneDb();
  const tx = db.transaction(() => {
    const res = db.prepare('DELETE FROM landing_sites WHERE id = ? AND is_preset = 0').run(siteId);
    return { deleted: res.changes > 0 };
  });
  return tx();
}

export async function createHotSqliteBackup(destinationPath: string): Promise<{
  path: string;
  sizeBytes: number;
}> {
  const db = getSeleneDb();
  const resolved = path.resolve(destinationPath);
  const destDir = path.dirname(resolved);
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }
  db.pragma('wal_checkpoint(PASSIVE)');
  await db.backup(resolved);
  const verify = new Database(resolved, { readonly: true });
  try {
    const check = String(verify.pragma('integrity_check', { simple: true })).toLowerCase();
    if (check !== 'ok') {
      throw new Error(`Backup verification failed (${check}) at '${resolved}'.`);
    }
  } finally {
    verify.close();
  }
  const stat = fs.statSync(resolved);
  return { path: resolved, sizeBytes: stat.size };
}

export function getDatabaseDeploymentStatus(): DatabaseDeploymentStatus {
  const db = getSeleneDb();
  const dbPath = getSeleneDbPath();
  const journalMode = String(db.pragma('journal_mode', { simple: true })).toUpperCase();
  const foreignKeysEnabled = Number(db.pragma('foreign_keys', { simple: true })) === 1;
  const integrityRow = db.prepare('PRAGMA integrity_check').get() as {
    integrity_check?: string;
  };
  const integrityCheck = integrityRow?.integrity_check ?? 'unknown';
  const dbSizeBytes = fs.existsSync(dbPath) ? fs.statSync(dbPath).size : 0;
  const appliedMigrations = db
    .prepare('SELECT version, name, applied_at FROM schema_migrations ORDER BY version ASC')
    .all() as { version: number; name: string; applied_at: string }[];
  const isCloudRun = Boolean(process.env.K_SERVICE);

  return {
    runtime: isCloudRun ? 'cloud-run-single-instance' : 'local-node',
    journalMode,
    foreignKeysEnabled,
    integrityCheck,
    dbSizeBytes,
    appliedMigrations,
    walCompatible: journalMode === 'WAL',
    persistentStorageCaveat: isCloudRun
      ? 'Container overlay filesystem in Cloud Run is single-instance local storage; WAL operates safely per instance, but writes outside persistent volumes do not survive container rebuilds.'
      : 'Local persistent disk active with SQLite WAL mode and foreign_keys=ON.',
    multiInstanceRecommendation:
      'For horizontal multi-instance production deployments across multiple Cloud Run replicas, migrate persistent mission state to Cloud SQL (PostgreSQL) or Firestore.',
  };
}




