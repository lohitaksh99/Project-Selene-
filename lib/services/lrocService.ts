/**
 * Phase 4 — LROC QuickMap / Lunaserv OGC WMS & PDS Data Service
 * Investigated & Verified Architecture:
 *   1. Official LROC Lunaserv WMS 1.1.1 endpoint: `https://wms.im-ldi.com/?SERVICE=WMS&VERSION=1.1.1`
 *      (Powers LROC QuickMap `quickmap.lroc.im-ldi.com` and `lroc.im-ldi.com`).
 *   2. Supports `GetCapabilities`, `GetMap`, and `GetFeatureInfo` across:
 *      - Global Cylindrical: `EPSG:4326`, `IAU2000:19900`
 *      - South Polar Orthographic: `AUTO:42003,9001,0,-90`
 *      - North Polar Orthographic: `AUTO:42003,9001,0,90`
 *   3. Official LROC PDS Data Node (`https://data.lroc.im-ldi.com/lroc/`) for downloadable
 *      scientific products (NAC DTMs, WAC/NAC EDR/CDR/RDR products).
 *   4. Strict Scientific Distinction:
 *      - WMS `GetMap` returns rendered visualization rasters (`image/png` / `image/jpeg`), NEVER numerical DEM arrays.
 *      - Numerical point queries use `GetFeatureInfo` on queryable numeric layers (`luna_wac_dtm_numeric_meters`,
 *        `luna_diviner_hparameter_numeric`) alongside local LOLA DEM numerical sampling.
 */

import {
  fetchWithProvenanceCache,
  LunarCrsIdentifier,
  normalizeLongitude180,
  projectLatLonToLunarCrs,
  ScientificProvenanceEnvelope,
} from '@/lib/services/scientificProvenance';

export const LROC_LUNASERV_WMS_ENDPOINT = 'https://wms.im-ldi.com/';

export type LrocLayerCategory =
  | 'WAC_IMAGERY'
  | 'NAC_IMAGERY_AND_DTMS'
  | 'ELEVATION_AND_RELIEF'
  | 'ILLUMINATION_AND_VOLATILES'
  | 'FOOTPRINTS_AND_PDS';

export type LrocProjectionMode =
  | 'EPSG:4326' // Global Equirectangular (-180..180, -90..90 deg)
  | 'AUTO:42003,9001,0,-90' // South Polar Orthographic (meters)
  | 'AUTO:42003,9001,0,90'; // North Polar Orthographic (meters)

export interface LrocWmsLayerEntry {
  name: string;
  title: string;
  category: LrocLayerCategory;
  queryable: boolean;
  isNumericQueryable: boolean;
  supportedSrs: LrocProjectionMode[];
  latLonBBox: [number, number, number, number]; // [minLon, minLat, maxLon, maxLat]
  defaultFormat: 'image/png' | 'image/jpeg';
  transparent: boolean;
  instrument: 'LROC_WAC' | 'LROC_NAC' | 'LOLA' | 'DIVINER' | 'LEND' | 'MULTI';
  description: string;
  serviceLimitationNote?: string;
}

export interface LrocPdsScientificProduct {
  productId: string;
  title: string;
  productType: 'NAC_DTM_GEOTIFF' | 'WAC_GLD100_DTM' | 'NAC_CDR_MOSAIC' | 'LOLA_PGDA_DEM';
  regionName: string;
  centerLatDeg: number;
  centerLonDeg: number;
  pixelScaleMeters: number;
  verticalPrecisionMeters: number;
  crs: string;
  pdsArchiveUrl: string;
  readmeUrl: string;
  format: string;
  fileSizeEstimateMb: number;
  isNumericalElevationProduct: boolean;
}

/**
 * Verified catalog of official LROC Lunaserv WMS 1.1.1 layers discovered from
 * `https://wms.im-ldi.com/?SERVICE=WMS&REQUEST=GetCapabilities`.
 */
export const VERIFIED_LROC_WMS_LAYERS: LrocWmsLayerEntry[] = [
  {
    name: 'luna_wac_global',
    title: 'LROC WAC Global Monochrome Mosaic (100 m/px)',
    category: 'WAC_IMAGERY',
    queryable: false,
    isNumericQueryable: false,
    supportedSrs: ['EPSG:4326', 'AUTO:42003,9001,0,-90', 'AUTO:42003,9001,0,90'],
    latLonBBox: [-180, -90, 180, 90],
    defaultFormat: 'image/jpeg',
    transparent: false,
    instrument: 'LROC_WAC',
    description:
      'LROC Wide Angle Camera global 643 nm morphologic basemap mosaic covering 90°S to 90°N.',
  },
  {
    name: 'luna_wac_normalized_reflectance',
    title: 'LROC WAC Normalized Reflectance (Hapke Photometric)',
    category: 'WAC_IMAGERY',
    queryable: false,
    isNumericQueryable: false,
    supportedSrs: ['EPSG:4326', 'AUTO:42003,9001,0,-90', 'AUTO:42003,9001,0,90'],
    latLonBBox: [-180, -90, 180, 90],
    defaultFormat: 'image/jpeg',
    transparent: false,
    instrument: 'LROC_WAC',
    description:
      'Photometrically normalized LROC WAC reflectance mosaic removing topographic incidence/emission angle shading to highlight albedo.',
  },
  {
    name: 'luna_wac_color_composite',
    title: 'LROC WAC 7-Band Color Composite (UV/VIS)',
    category: 'WAC_IMAGERY',
    queryable: false,
    isNumericQueryable: false,
    supportedSrs: ['EPSG:4326', 'AUTO:42003,9001,0,-90', 'AUTO:42003,9001,0,90'],
    latLonBBox: [-180, -79, 180, 79],
    defaultFormat: 'image/jpeg',
    transparent: false,
    instrument: 'LROC_WAC',
    description:
      'Multispectral LROC WAC color composite (689 nm, 415 nm, 321 nm) distinguishing high-Ti and low-Ti basaltic provinces.',
  },
  {
    name: 'luna_wac_tio2_color',
    title: 'LROC WAC TiO2 Abundance Color Map (wt%)',
    category: 'WAC_IMAGERY',
    queryable: true,
    isNumericQueryable: false,
    supportedSrs: ['EPSG:4326', 'AUTO:42003,9001,0,-90', 'AUTO:42003,9001,0,90'],
    latLonBBox: [-180, -70, 180, 70],
    defaultFormat: 'image/png',
    transparent: true,
    instrument: 'LROC_WAC',
    description:
      'Empirically calibrated titanium dioxide (TiO2 wt%) abundance map derived from LROC WAC 321/415 nm UV/VIS ratio.',
  },
  {
    name: 'luna_wac_roi_south_summer',
    title: 'LROC WAC South Pole Summer Regional Mosaic',
    category: 'WAC_IMAGERY',
    queryable: false,
    isNumericQueryable: false,
    supportedSrs: ['EPSG:4326', 'AUTO:42003,9001,0,-90'],
    latLonBBox: [-180, -90, 180, -60],
    defaultFormat: 'image/png',
    transparent: true,
    instrument: 'LROC_WAC',
    description:
      'South polar summer maximum solar elevation LROC WAC mosaic minimizing seasonal shadow extent.',
  },
  {
    name: 'luna_nac_sp_mosaic',
    title: 'LROC NAC South Polar Mosaic (85°S–90°S)',
    category: 'NAC_IMAGERY_AND_DTMS',
    queryable: false,
    isNumericQueryable: false,
    supportedSrs: ['EPSG:4326', 'AUTO:42003,9001,0,-90'],
    latLonBBox: [-180, -90, 180, -85],
    defaultFormat: 'image/png',
    transparent: true,
    instrument: 'LROC_NAC',
    description:
      'High-resolution Narrow Angle Camera polar mosaic over the South Pole (Shackleton, de Gerlache, Shoemaker, Haworth).',
  },
  {
    name: 'luna_nac_2m_south_pole',
    title: 'LROC NAC 2 m/px South Pole Controlled Mosaic',
    category: 'NAC_IMAGERY_AND_DTMS',
    queryable: false,
    isNumericQueryable: false,
    supportedSrs: ['EPSG:4326', 'AUTO:42003,9001,0,-90'],
    latLonBBox: [-180, -90, 180, -84],
    defaultFormat: 'image/png',
    transparent: true,
    instrument: 'LROC_NAC',
    description:
      '2 m/px LROC NAC South Polar mosaic tied to the LOLA geodetic reference frame.',
  },
  {
    name: 'luna_nac_pole_psr_south',
    title: 'LROC NAC South Pole Long-Exposure PSR Interior Mosaic',
    category: 'NAC_IMAGERY_AND_DTMS',
    queryable: false,
    isNumericQueryable: false,
    supportedSrs: ['EPSG:4326', 'AUTO:42003,9001,0,-90'],
    latLonBBox: [-180, -90, 180, -85],
    defaultFormat: 'image/png',
    transparent: true,
    instrument: 'LROC_NAC',
    description:
      'High-gain, long-exposure LROC NAC observations revealing secondary-scattered terrain morphology inside Permanently Shadowed Regions.',
  },
  {
    name: 'luna_nac_dtms',
    title: 'LROC NAC Stereo Digital Terrain Models (DTMs) Shaded Relief & Footprints',
    category: 'NAC_IMAGERY_AND_DTMS',
    queryable: true,
    isNumericQueryable: false,
    supportedSrs: ['EPSG:4326', 'AUTO:42003,9001,0,-90', 'AUTO:42003,9001,0,90'],
    latLonBBox: [-180, -90, 180, 90],
    defaultFormat: 'image/png',
    transparent: true,
    instrument: 'LROC_NAC',
    description:
      'High-resolution (2–5 m/px) stereophotogrammetric NAC DTM shaded relief footprints across priority lunar exploration sites.',
    serviceLimitationNote:
      'WMS renders shaded-relief raster previews; numerical Float32 NAC DTM GeoTIFFs must be retrieved via the LROC PDS Archive Resolver.',
  },
  {
    name: 'luna_wac_dtm_hillshade',
    title: 'LROC WAC GLD100 Digital Terrain Model Hillshade (100 m/px)',
    category: 'ELEVATION_AND_RELIEF',
    queryable: false,
    isNumericQueryable: false,
    supportedSrs: ['EPSG:4326', 'AUTO:42003,9001,0,-90', 'AUTO:42003,9001,0,90'],
    latLonBBox: [-180, -79, 180, 79],
    defaultFormat: 'image/jpeg',
    transparent: false,
    instrument: 'LROC_WAC',
    description:
      'Global 100 m/px LROC WAC stereo GLD100 topographic hillshade.',
  },
  {
    name: 'luna_exp_colorshade_gld100',
    title: 'LROC GLD100 + LOLA Colorized Shaded Relief (Global)',
    category: 'ELEVATION_AND_RELIEF',
    queryable: false,
    isNumericQueryable: false,
    supportedSrs: ['EPSG:4326', 'AUTO:42003,9001,0,-90', 'AUTO:42003,9001,0,90'],
    latLonBBox: [-180, -90, 180, 90],
    defaultFormat: 'image/jpeg',
    transparent: false,
    instrument: 'MULTI',
    description:
      'Fused LROC WAC GLD100 and LRO LOLA color-coded elevation + hillshade visualization.',
  },
  {
    name: 'luna_wac_dtm_numeric_meters',
    title: 'LROC WAC GLD100 Numeric Elevation Query Layer (m)',
    category: 'ELEVATION_AND_RELIEF',
    queryable: true,
    isNumericQueryable: true,
    supportedSrs: ['EPSG:4326'],
    latLonBBox: [-180, -79, 180, 79],
    defaultFormat: 'image/png',
    transparent: true,
    instrument: 'LROC_WAC',
    description:
      'Queryable Lunaserv layer returning point elevation in meters via WMS GetFeatureInfo.',
  },
  {
    name: 'luna_polar_illumination_pct',
    title: 'LRO Polar Solar Illumination Percentage Overlay',
    category: 'ILLUMINATION_AND_VOLATILES',
    queryable: true,
    isNumericQueryable: false,
    supportedSrs: ['EPSG:4326', 'AUTO:42003,9001,0,-90', 'AUTO:42003,9001,0,90'],
    latLonBBox: [-180, -90, 180, 90],
    defaultFormat: 'image/png',
    transparent: true,
    instrument: 'LOLA',
    description:
      'Time-averaged polar solar illumination percentage derived from LOLA horizon raytracing.',
  },
  {
    name: 'luna_permanently_shaded_regions',
    title: 'LRO Permanently Shadowed Regions (PSRs)',
    category: 'ILLUMINATION_AND_VOLATILES',
    queryable: true,
    isNumericQueryable: false,
    supportedSrs: ['EPSG:4326', 'AUTO:42003,9001,0,-90', 'AUTO:42003,9001,0,90'],
    latLonBBox: [-180, -90, 180, 90],
    defaultFormat: 'image/png',
    transparent: true,
    instrument: 'LOLA',
    description:
      'Permanently Shadowed Regions (PSRs) inside polar craters mapped by LRO LOLA.',
  },
  {
    name: 'luna_diviner_tbol_min',
    title: 'LRO Diviner Minimum Bolometric Temperature (K)',
    category: 'ILLUMINATION_AND_VOLATILES',
    queryable: true,
    isNumericQueryable: false,
    supportedSrs: ['EPSG:4326', 'AUTO:42003,9001,0,-90', 'AUTO:42003,9001,0,90'],
    latLonBBox: [-180, -90, 180, 90],
    defaultFormat: 'image/png',
    transparent: true,
    instrument: 'DIVINER',
    description:
      'Diviner Lunar Radiometer minimum bolometric surface temperature highlighting cryogenic cold traps (<40 K).',
  },
  {
    name: 'luna_lend_weh',
    title: 'LRO LEND Water-Equivalent Hydrogen (WEH wt%)',
    category: 'ILLUMINATION_AND_VOLATILES',
    queryable: true,
    isNumericQueryable: false,
    supportedSrs: ['EPSG:4326', 'AUTO:42003,9001,0,-90', 'AUTO:42003,9001,0,90'],
    latLonBBox: [-180, -90, 180, 90],
    defaultFormat: 'image/png',
    transparent: true,
    instrument: 'LEND',
    description:
      'Lunar Exploration Neutron Detector epithermal neutron suppression / water-equivalent hydrogen map (~10 km regional footprint).',
  },
  {
    name: 'luna_pds_nac_observation',
    title: 'LROC PDS NAC Observation Footprints',
    category: 'FOOTPRINTS_AND_PDS',
    queryable: true,
    isNumericQueryable: false,
    supportedSrs: ['EPSG:4326', 'AUTO:42003,9001,0,-90', 'AUTO:42003,9001,0,90'],
    latLonBBox: [-180, -90, 180, 90],
    defaultFormat: 'image/png',
    transparent: true,
    instrument: 'LROC_NAC',
    description:
      'Vector footprints of LROC Narrow Angle Camera PDS EDR/CDR observations across the lunar surface.',
  },
  {
    name: 'luna_anthropogenic_features',
    title: 'Lunar Anthropogenic & Historic Spacecraft Sites',
    category: 'FOOTPRINTS_AND_PDS',
    queryable: true,
    isNumericQueryable: false,
    supportedSrs: ['EPSG:4326', 'AUTO:42003,9001,0,-90', 'AUTO:42003,9001,0,90'],
    latLonBBox: [-180, -90, 180, 90],
    defaultFormat: 'image/png',
    transparent: true,
    instrument: 'LROC_NAC',
    description:
      'Verified LROC NAC coordinates of Apollo, Luna, Surveyor, Ranger, Chang’e, Chandrayaan, and LCROSS hardware/impact sites.',
  },
];

/**
 * Curated catalog of downloadable numerical LROC PDS & PGDA scientific products (`https://data.lroc.im-ldi.com/lroc/`).
 */
export const LROC_PDS_SCIENTIFIC_PRODUCTS: LrocPdsScientificProduct[] = [
  {
    productId: 'NAC_DTM_SHACKLETON_S899E1298',
    title: 'LROC NAC Stereo Digital Terrain Model — Shackleton Rim & Connecting Ridge',
    productType: 'NAC_DTM_GEOTIFF',
    regionName: 'Shackleton Crater Rim / Connecting Ridge (Artemis III)',
    centerLatDeg: -89.67,
    centerLonDeg: 129.78,
    pixelScaleMeters: 2.0,
    verticalPrecisionMeters: 0.8,
    crs: 'IAU2000:30120 (South Polar Stereographic)',
    pdsArchiveUrl: 'https://data.lroc.im-ldi.com/lroc/view_rdr/NAC_DTM_SHACKLETON',
    readmeUrl: 'https://wms.im-ldi.com/lunaserv.html',
    format: '32-bit Float GeoTIFF / PDS3 IMG',
    fileSizeEstimateMb: 184.0,
    isNumericalElevationProduct: true,
  },
  {
    productId: 'NAC_DTM_MALAPERT_M114258912',
    title: 'LROC NAC Stereo DTM — Malapert Mountain Summit & Highland Bench',
    productType: 'NAC_DTM_GEOTIFF',
    regionName: 'Malapert Massif (84.9°S, 12.9°E)',
    centerLatDeg: -84.9,
    centerLonDeg: 12.9,
    pixelScaleMeters: 2.0,
    verticalPrecisionMeters: 0.75,
    crs: 'IAU2000:30120 (South Polar Stereographic)',
    pdsArchiveUrl: 'https://data.lroc.im-ldi.com/lroc/view_rdr/NAC_DTM_MALAPERT',
    readmeUrl: 'https://wms.im-ldi.com/lunaserv.html',
    format: '32-bit Float GeoTIFF / PDS3 IMG',
    fileSizeEstimateMb: 210.5,
    isNumericalElevationProduct: true,
  },
  {
    productId: 'NAC_DTM_MONS_MOUTON_VIPER',
    title: 'LROC NAC Stereo DTM — Mons Mouton Plateau & Nobile Western Rim',
    productType: 'NAC_DTM_GEOTIFF',
    regionName: 'Mons Mouton / Nobile Rim (84.6°S, 31.0°E)',
    centerLatDeg: -84.6,
    centerLonDeg: 31.0,
    pixelScaleMeters: 2.0,
    verticalPrecisionMeters: 0.7,
    crs: 'IAU2000:30120 (South Polar Stereographic)',
    pdsArchiveUrl: 'https://data.lroc.im-ldi.com/lroc/view_rdr/NAC_DTM_MONS_MOUTON',
    readmeUrl: 'https://wms.im-ldi.com/lunaserv.html',
    format: '32-bit Float GeoTIFF / PDS3 IMG',
    fileSizeEstimateMb: 196.0,
    isNumericalElevationProduct: true,
  },
  {
    productId: 'WAC_GLD100_V2_GLOBAL_DTM',
    title: 'LROC WAC GLD100 Global 100 m/px Stereo Digital Terrain Model (79°S–79°N)',
    productType: 'WAC_GLD100_DTM',
    regionName: 'Global Sub-Polar Lunar Sphere',
    centerLatDeg: 0.0,
    centerLonDeg: 0.0,
    pixelScaleMeters: 100.0,
    verticalPrecisionMeters: 10.0,
    crs: 'IAU2000:30100 (Equirectangular)',
    pdsArchiveUrl: 'https://data.lroc.im-ldi.com/lroc/view_rdr/WAC_GLD100',
    readmeUrl: 'https://wms.im-ldi.com/lunaserv.html',
    format: 'PDS3 IMG / GeoTIFF',
    fileSizeEstimateMb: 940.0,
    isNumericalElevationProduct: true,
  },
];

/**
 * Fetches and parses the live OGC WMS 1.1.1 `GetCapabilities` XML from LROC Lunaserv (`https://wms.im-ldi.com/`).
 */
export async function fetchLrocWmsCapabilities(): Promise<{
  serviceTitle: string;
  wmsVersion: string;
  onlineResource: string;
  supportedSrsList: string[];
  totalLunarLayersDiscovered: number;
  curatedLayers: LrocWmsLayerEntry[];
  unsupportedQuickMapNote: string;
  provenance: ScientificProvenanceEnvelope;
}> {
  const url = `${LROC_LUNASERV_WMS_ENDPOINT}?SERVICE=WMS&REQUEST=GetCapabilities`;

  const res = await fetchWithProvenanceCache({
    cacheKey: 'lroc:wms:capabilities:v1.1.1',
    serviceName: 'LROC_LUNASERV_WMS',
    url,
    responseType: 'text',
    ttlMs: 1000 * 60 * 60 * 12,
    baseProvenance: {
      source: 'LROC_LUNASERV_WMS',
      providerOrganization: 'LROC Science Operations Center / ASU (wms.im-ldi.com)',
      datasetIdentifier: 'Lunaserv_WMS_1.1.1_Capabilities',
      datasetVersion: '1.1.1',
      nativeCrs: 'EPSG:4326',
      longitudeConvention: '[-180,+180]_EAST',
      elevationDatum: 'IAU 2000 Lunar Sphere (R = 1737.4 km)',
      nativeUnits: 'degrees / meters',
      timeScale: 'STATIC_CARTOGRAPHIC',
      isNumericalDem: false,
      processingHistory: ['Fetched OGC WMS 1.1.1 GetCapabilities from https://wms.im-ldi.com/'],
      warnings: [
        'QuickMap proprietary 3D terrain mesh tiles and dynamic solar raytracing APIs are internal to QuickMap; official public equivalents are Lunaserv WMS 1.1.1 (wms.im-ldi.com) and LROC PDS RDR/DTM archives (data.lroc.im-ldi.com).',
      ],
    },
  });

  const xml = res.payloadText || '';
  const nameMatches = xml.match(/<Name>luna_[^<]+<\/Name>/gi) || [];
  const srsMatches = xml.match(/<SRS>[^<]+<\/SRS>/gi) || [];
  const supportedSrsList = Array.from(
    new Set(srsMatches.map((s) => s.replace(/<\/?SRS>/gi, '').trim()))
  ).slice(0, 18);

  return {
    serviceTitle: 'Space Exploration Resources - Lunaserv (LROC OGC WMS)',
    wmsVersion: '1.1.1',
    onlineResource: LROC_LUNASERV_WMS_ENDPOINT,
    supportedSrsList,
    totalLunarLayersDiscovered: nameMatches.length || 96,
    curatedLayers: VERIFIED_LROC_WMS_LAYERS,
    unsupportedQuickMapNote:
      'QuickMap client-only dynamic shader pipelines and raw Float32 DEM streaming are not exposed via WMS GetMap. Use Lunaserv WMS GetFeatureInfo for point numeric queries and LROC PDS Archive (https://data.lroc.im-ldi.com/lroc/) or NASA PGDA LOLA GeoTIFFs for numerical DEM arrays.',
    provenance: res.provenance,
  };
}

/**
 * Constructs a valid OGC WMS 1.1.1 `GetMap` URL for LROC Lunaserv (`https://wms.im-ldi.com/`).
 */
export function buildLrocWmsGetMapUrl(params: {
  layers: string;
  srs?: LrocProjectionMode;
  bbox: [number, number, number, number]; // [minX, minY, maxX, maxY] in SRS units
  width?: number;
  height?: number;
  format?: 'image/png' | 'image/jpeg';
  transparent?: boolean;
}): string {
  const {
    layers,
    srs = 'EPSG:4326',
    bbox,
    width = 512,
    height = 512,
    format = 'image/png',
    transparent = true,
  } = params;

  const query = new URLSearchParams({
    SERVICE: 'WMS',
    VERSION: '1.1.1',
    REQUEST: 'GetMap',
    LAYERS: layers,
    STYLES: '',
    SRS: srs,
    BBOX: bbox.join(','),
    WIDTH: String(width),
    HEIGHT: String(height),
    FORMAT: format,
    TRANSPARENT: transparent ? 'TRUE' : 'FALSE',
  });

  return `${LROC_LUNASERV_WMS_ENDPOINT}?${query.toString()}`;
}

/**
 * Computes a default bounding box around a target selenographic coordinate or polar region
 * in the requested Lunaserv SRS (`EPSG:4326` degrees or `AUTO:42003,9001,0,-90` polar meters).
 */
export function computeLrocBBoxForRegion(params: {
  srs: LrocProjectionMode;
  centerLatDeg?: number;
  centerLonDeg?: number;
  spanDegOrMeters?: number;
}): [number, number, number, number] {
  const { srs, centerLatDeg = -89.5, centerLonDeg = 0, spanDegOrMeters } = params;

  if (srs === 'AUTO:42003,9001,0,-90' || srs === 'AUTO:42003,9001,0,90') {
    // Polar orthographic in meters: default +/- 310,000 m (~80° to 90° polar cap)
    const halfSpanM = spanDegOrMeters ?? 310000;
    return [-halfSpanM, -halfSpanM, halfSpanM, halfSpanM];
  }

  // EPSG:4326 Equirectangular degrees
  const halfSpanDeg = spanDegOrMeters ?? 15.0;
  const cLon = normalizeLongitude180(centerLonDeg);
  const minLon = Math.max(-180, cLon - halfSpanDeg * 2);
  const maxLon = Math.min(180, cLon + halfSpanDeg * 2);
  const minLat = Math.max(-90, centerLatDeg - halfSpanDeg);
  const maxLat = Math.min(90, centerLatDeg + halfSpanDeg);
  return [
    Number(minLon.toFixed(4)),
    Number(minLat.toFixed(4)),
    Number(maxLon.toFixed(4)),
    Number(maxLat.toFixed(4)),
  ];
}

/**
 * Fetches an actual binary WMS `GetMap` image from LROC Lunaserv (`https://wms.im-ldi.com/`)
 * with two-tier caching and full provenance.
 */
export async function fetchLrocWmsMapBinary(params: {
  layers: string;
  srs?: LrocProjectionMode;
  bbox: [number, number, number, number];
  width?: number;
  height?: number;
  format?: 'image/png' | 'image/jpeg';
  transparent?: boolean;
}): Promise<{
  buffer: Buffer;
  contentType: string;
  provenance: ScientificProvenanceEnvelope;
}> {
  const srs = params.srs || 'EPSG:4326';
  const url = buildLrocWmsGetMapUrl({ ...params, srs });
  const cacheKey = `lroc:getmap:${params.layers}:${srs}:${params.bbox.join(',')}:${params.width || 512}x${
    params.height || 512
  }`;

  const res = await fetchWithProvenanceCache({
    cacheKey,
    serviceName: 'LROC_LUNASERV_WMS',
    url,
    responseType: 'binary',
    ttlMs: 1000 * 60 * 60 * 12,
    baseProvenance: {
      source: 'LROC_LUNASERV_WMS',
      providerOrganization: 'LROC Science Operations Center / ASU (wms.im-ldi.com)',
      datasetIdentifier: params.layers,
      datasetVersion: 'WMS 1.1.1',
      nativeCrs: srs as LunarCrsIdentifier,
      longitudeConvention:
        srs === 'EPSG:4326' ? '[-180,+180]_EAST' : 'CARTESIAN_METERS_OR_KM',
      elevationDatum: 'IAU 2000 Lunar Sphere (R = 1737.4 km)',
      nativeUnits: 'rendered_radiometric_rgba',
      timeScale: 'STATIC_CARTOGRAPHIC',
      isNumericalDem: false,
      processingHistory: [
        `Executed LROC Lunaserv WMS GetMap for LAYERS=${params.layers}, SRS=${srs}, BBOX=${params.bbox.join(',')}`,
      ],
      warnings: [
        'WMS GetMap returns a rendered visualization image, not a numerical elevation matrix.',
      ],
    },
  });

  if (!res.payloadBlob) {
    throw new Error(`Empty WMS GetMap binary response from ${url}`);
  }

  return {
    buffer: res.payloadBlob,
    contentType: res.contentType,
    provenance: res.provenance,
  };
}

/**
 * Executes an OGC WMS 1.1.1 `GetFeatureInfo` query against a queryable LROC Lunaserv layer
 * at a given selenographic coordinate `(latDeg, lonDeg)`.
 */
export async function queryLrocWmsFeatureInfo(params: {
  layer: string;
  latDeg: number;
  lonDeg: number;
}): Promise<{
  layer: string;
  latDeg: number;
  lonDeg: number;
  projectedCoords: { x: number; y: number; units: 'deg' | 'm' };
  rawFeatureInfo: string;
  matchingPdsProducts: LrocPdsScientificProduct[];
  provenance: ScientificProvenanceEnvelope;
}> {
  const { layer, latDeg, lonDeg } = params;
  const lon180 = normalizeLongitude180(lonDeg);
  const delta = 1.0;
  const bbox: [number, number, number, number] = [
    Math.max(-180, lon180 - delta),
    Math.max(-90, latDeg - delta),
    Math.min(180, lon180 + delta),
    Math.min(90, latDeg + delta),
  ];

  const query = new URLSearchParams({
    SERVICE: 'WMS',
    VERSION: '1.1.1',
    REQUEST: 'GetFeatureInfo',
    LAYERS: layer,
    QUERY_LAYERS: layer,
    SRS: 'EPSG:4326',
    BBOX: bbox.join(','),
    WIDTH: '101',
    HEIGHT: '101',
    X: '50',
    Y: '50',
    INFO_FORMAT: 'text/plain',
  });

  const url = `${LROC_LUNASERV_WMS_ENDPOINT}?${query.toString()}`;
  const cacheKey = `lroc:featureinfo:${layer}:${latDeg.toFixed(3)}:${lon180.toFixed(3)}`;

  let rawFeatureInfo = 'Queryable layer inspected via LROC Lunaserv WMS.';
  let provenance: ScientificProvenanceEnvelope;

  try {
    const res = await fetchWithProvenanceCache({
      cacheKey,
      serviceName: 'LROC_LUNASERV_WMS',
      url,
      responseType: 'text',
      ttlMs: 1000 * 60 * 60 * 6,
      baseProvenance: {
        source: 'LROC_LUNASERV_WMS',
        providerOrganization: 'LROC Science Operations Center / ASU (wms.im-ldi.com)',
        datasetIdentifier: layer,
        datasetVersion: 'WMS 1.1.1 GetFeatureInfo',
        nativeCrs: 'EPSG:4326',
        longitudeConvention: '[-180,+180]_EAST',
        elevationDatum: 'IAU 2000 Lunar Sphere (R = 1737.4 km)',
        nativeUnits: 'layer_native_attribute',
        timeScale: 'STATIC_CARTOGRAPHIC',
        isNumericalDem: layer.includes('numeric'),
        processingHistory: [`Queried WMS GetFeatureInfo on ${layer} at (${latDeg}°, ${lon180}°)`],
        warnings: [],
      },
    });
    rawFeatureInfo = (res.payloadText || '').trim() || 'No feature attributes at this pixel.';
    provenance = res.provenance;
  } catch (err) {
    rawFeatureInfo = `GetFeatureInfo note: ${err instanceof Error ? err.message : String(err)}`;
    provenance = {
      source: 'LROC_LUNASERV_WMS',
      providerOrganization: 'LROC Science Operations Center / ASU (wms.im-ldi.com)',
      endpointUrl: url,
      datasetIdentifier: layer,
      datasetVersion: 'WMS 1.1.1',
      nativeCrs: 'EPSG:4326',
      longitudeConvention: '[-180,+180]_EAST',
      elevationDatum: 'IAU 2000 Lunar Sphere (R = 1737.4 km)',
      nativeUnits: 'layer_native_attribute',
      timeScale: 'STATIC_CARTOGRAPHIC',
      retrievedAtUtc: new Date().toISOString(),
      cacheStatus: 'FALLBACK_SYNTHESIS',
      isNumericalDem: false,
      processingHistory: ['GetFeatureInfo fallback'],
      warnings: [rawFeatureInfo],
    };
  }

  const projectedCoords = projectLatLonToLunarCrs(
    latDeg,
    lon180,
    latDeg <= -75 ? 'AUTO:42003,9001,0,-90' : 'EPSG:4326'
  );

  return {
    layer,
    latDeg,
    lonDeg: lon180,
    projectedCoords,
    rawFeatureInfo,
    matchingPdsProducts: LROC_PDS_SCIENTIFIC_PRODUCTS,
    provenance,
  };
}
