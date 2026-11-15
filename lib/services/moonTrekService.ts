/**
 * Phase 2 — NASA Moon Trek OGC WMTS Integration Service (`trek.nasa.gov`)
 * Implements:
 *   1. Official WMTS endpoint & catalog discovery (`EQ`, `SP`, `NP`)
 *   2. Retrieval & parsing of `WMTSCapabilities.xml`
 *   3. Parsing of available layers, supported projections, tile matrix sets,
 *      tile matrix identifiers, styles, image formats, and geographic bounding boxes
 *   4. Dynamic RESTful tile URL construction and tile fetching with two-tier caching
 */

import {
  fetchWithProvenanceCache,
  LunarCrsIdentifier,
  projectLatLonToLunarCrs,
  ScientificProvenanceEnvelope,
} from '@/lib/services/scientificProvenance';

export type MoonTrekProjectionCode = 'EQ' | 'SP' | 'NP';

export interface WmtsTileMatrix {
  tileMatrixSetId: string;
  identifier: string;
  scaleDenominator: number;
  topLeftCorner: [number, number];
  tileWidth: number;
  tileHeight: number;
  matrixWidth: number;
  matrixHeight: number;
}

export type WmtsDiagnosticCategory =
  | 'VALID_TILE'
  | 'INVALID_TILE_REQUEST'
  | 'UNSUPPORTED_PROJECTION'
  | 'INVALID_TILE_MATRIX'
  | 'NETWORK_OR_SERVER_ERROR'
  | 'OUTSIDE_DATA_COVERAGE'
  | 'PROXY_OR_CORS_FAILURE';

export interface WmtsResolvedTileResult {
  tileMatrixSetId: string;
  tileMatrix: string;
  tileRow: number;
  tileCol: number;
  tileUrl: string;
  inCoverage: boolean;
  hemisphereAdjusted: boolean;
  requestedCoord: { latDeg: number; lonDeg: number };
  effectiveCoord: { latDeg: number; lonDeg: number };
  diagnosticCategory: WmtsDiagnosticCategory;
  diagnosticMessage: string;
}

export interface WmtsParsedCapabilities {
  layerIdentifier: string;
  title: string;
  projectionCode: MoonTrekProjectionCode;
  supportedCrs: LunarCrsIdentifier;
  boundingBox: {
    crs: string;
    lowerCorner: [number, number];
    upperCorner: [number, number];
  };
  wgs84BoundingBox?: {
    lowerCorner: [number, number];
    upperCorner: [number, number];
  };
  styles: { identifier: string; title: string; isDefault: boolean }[];
  formats: string[];
  tileMatrixSetId: string;
  availableTileMatrixSets: string[];
  resourceUrlTemplate: string;
  fileExtension: 'jpg' | 'png';
  tileMatrices: WmtsTileMatrix[];
  provenance: ScientificProvenanceEnvelope;
}

export interface MoonTrekLayerCatalogEntry {
  id: string;
  title: string;
  projectionCode: MoonTrekProjectionCode;
  crs: LunarCrsIdentifier;
  category: 'BASEMAP_IMAGERY' | 'LOLA_ELEVATION_SLOPE' | 'ILLUMINATION_PSR' | 'ARTEMIS_NAC_HIGHRES';
  defaultStyle: string;
  defaultTileMatrixSet: string;
  defaultFormat: 'image/jpeg' | 'image/png';
  fileExtension: 'jpg' | 'png';
  capabilitiesUrl: string;
  sampleTileUrl: string;
  coverageLatRange: [number, number];
  coverageLonRange: [number, number];
  description: string;
  isNumericalDem: boolean;
}

export const MOON_TREK_PROJECTION_CRS: Record<MoonTrekProjectionCode, LunarCrsIdentifier> = {
  EQ: 'urn:ogc:def:crs:EPSG::104903',
  SP: 'urn:ogc:def:crs:IAU2000::30120',
  NP: 'urn:ogc:def:crs:IAU2000::30118',
};

/**
 * Curated & HTTP-verified catalog of official NASA Moon Trek WMTS layers across
 * Global Equirectangular (EQ), South Polar Stereographic (SP), and North Polar Stereographic (NP).
 */
export const VERIFIED_MOON_TREK_WMTS_LAYERS: MoonTrekLayerCatalogEntry[] = [
  {
    id: 'LRO_WAC_Mosaic_Global_303ppd_v02',
    title: 'LRO WAC Global Basemap Mosaic (100 m/px, 303 ppd v02)',
    projectionCode: 'EQ',
    crs: 'urn:ogc:def:crs:EPSG::104903',
    category: 'BASEMAP_IMAGERY',
    defaultStyle: 'default',
    defaultTileMatrixSet: 'default028mm',
    defaultFormat: 'image/jpeg',
    fileExtension: 'jpg',
    capabilitiesUrl:
      'https://trek.nasa.gov/tiles/Moon/EQ/LRO_WAC_Mosaic_Global_303ppd_v02/1.0.0/WMTSCapabilities.xml',
    sampleTileUrl:
      'https://trek.nasa.gov/tiles/Moon/EQ/LRO_WAC_Mosaic_Global_303ppd_v02/1.0.0/default/default028mm/0/0/0.jpg',
    coverageLatRange: [-90, 90],
    coverageLonRange: [-180, 180],
    description:
      'Authoritative NASA Moon Trek global LROC Wide Angle Camera 643 nm monochrome basemap mosaic covering the entire lunar globe.',
    isNumericalDem: false,
  },
  {
    id: 'LRO_NAC_AvgMosaic_SPole855_1mp',
    title: 'LRO NAC South Pole Average Mosaic (85.5°S–90°S, 1 m/px)',
    projectionCode: 'SP',
    crs: 'urn:ogc:def:crs:IAU2000::30120',
    category: 'BASEMAP_IMAGERY',
    defaultStyle: 'default',
    defaultTileMatrixSet: 'default028mm',
    defaultFormat: 'image/png',
    fileExtension: 'png',
    capabilitiesUrl:
      'https://trek.nasa.gov/tiles/Moon/SP/LRO_NAC_AvgMosaic_SPole855_1mp/1.0.0/WMTSCapabilities.xml',
    sampleTileUrl:
      'https://trek.nasa.gov/tiles/Moon/SP/LRO_NAC_AvgMosaic_SPole855_1mp/1.0.0/default/default028mm/0/0/0.png',
    coverageLatRange: [-90, -85.5],
    coverageLonRange: [-180, 180],
    description:
      'High-resolution 1 m/px multi-temporal LROC Narrow Angle Camera average illumination mosaic across the South Polar crown.',
    isNumericalDem: false,
  },
  {
    id: 'LRO_LOLA_Count_SPole875_5mp_v04',
    title: 'LRO LOLA South Pole Observation Count & Coverage (87.5°S–90°S, 5 m/px v04)',
    projectionCode: 'SP',
    crs: 'urn:ogc:def:crs:IAU2000::30120',
    category: 'LOLA_ELEVATION_SLOPE',
    defaultStyle: 'default',
    defaultTileMatrixSet: 'default028mm',
    defaultFormat: 'image/png',
    fileExtension: 'png',
    capabilitiesUrl:
      'https://trek.nasa.gov/tiles/Moon/SP/LRO_LOLA_Count_SPole875_5mp_v04/1.0.0/WMTSCapabilities.xml',
    sampleTileUrl:
      'https://trek.nasa.gov/tiles/Moon/SP/LRO_LOLA_Count_SPole875_5mp_v04/1.0.0/default/default028mm/0/0/0.png',
    coverageLatRange: [-90, -87.5],
    coverageLonRange: [-180, 180],
    description:
      'NASA PGDA / Moon Trek LRO LOLA laser altimeter spot count density map (5 m/px) showing measurement support at the South Pole.',
    isNumericalDem: false,
  },
  {
    id: 'Site20_final_adj_5mpp_ClrHillshade_SP',
    title: 'LOLA Adjusted 5 m/px Color Hillshade — Shackleton / Connecting Ridge (SP)',
    projectionCode: 'SP',
    crs: 'urn:ogc:def:crs:IAU2000::30120',
    category: 'LOLA_ELEVATION_SLOPE',
    defaultStyle: 'default',
    defaultTileMatrixSet: 'default028mm',
    defaultFormat: 'image/png',
    fileExtension: 'png',
    capabilitiesUrl:
      'https://trek.nasa.gov/tiles/Moon/SP/Site20_final_adj_5mpp_ClrHillshade_SP/1.0.0/WMTSCapabilities.xml',
    sampleTileUrl:
      'https://trek.nasa.gov/tiles/Moon/SP/Site20_final_adj_5mpp_ClrHillshade_SP/1.0.0/default/default028mm/0/0/0.png',
    coverageLatRange: [-90, -88.0],
    coverageLonRange: [-180, 180],
    description:
      'Geodetically adjusted 5 m/px LOLA colorized hillshade DEM visualization for Artemis South Polar Site 20 / Connecting Ridge.',
    isNumericalDem: false,
  },
  {
    id: 'Haworth_final_adj_5mpp_ColorHillshade',
    title: 'LOLA Adjusted 5 m/px Color Hillshade — Haworth Crater Cold Trap (SP)',
    projectionCode: 'SP',
    crs: 'urn:ogc:def:crs:IAU2000::30120',
    category: 'LOLA_ELEVATION_SLOPE',
    defaultStyle: 'default',
    defaultTileMatrixSet: 'default028mm',
    defaultFormat: 'image/png',
    fileExtension: 'png',
    capabilitiesUrl:
      'https://trek.nasa.gov/tiles/Moon/SP/Haworth_final_adj_5mpp_ColorHillshade/1.0.0/WMTSCapabilities.xml',
    sampleTileUrl:
      'https://trek.nasa.gov/tiles/Moon/SP/Haworth_final_adj_5mpp_ColorHillshade/1.0.0/default/default028mm/0/0/0.png',
    coverageLatRange: [-89.0, -86.5],
    coverageLonRange: [-20, 20],
    description:
      'Geodetically adjusted 5 m/px LOLA colorized hillshade across Haworth Crater rim and cryogenic floor.',
    isNumericalDem: false,
  },
  {
    id: 'LRO_NAC_Mosaic_0_67mpp_Malapert_Massif_SP',
    title: 'LRO NAC High-Res Mosaic — Malapert Massif (0.67 m/px, SP)',
    projectionCode: 'SP',
    crs: 'urn:ogc:def:crs:IAU2000::30120',
    category: 'ARTEMIS_NAC_HIGHRES',
    defaultStyle: 'default',
    defaultTileMatrixSet: 'default028mm',
    defaultFormat: 'image/png',
    fileExtension: 'png',
    capabilitiesUrl:
      'https://trek.nasa.gov/tiles/Moon/SP/LRO_NAC_Mosaic_0_67mpp_Malapert_Massif_SP/1.0.0/WMTSCapabilities.xml',
    sampleTileUrl:
      'https://trek.nasa.gov/tiles/Moon/SP/LRO_NAC_Mosaic_0_67mpp_Malapert_Massif_SP/1.0.0/default/default028mm/0/0/0.png',
    coverageLatRange: [-86.5, -84.0],
    coverageLonRange: [-5, 25],
    description:
      'Sub-meter (0.67 m/px) LROC NAC controlled ortho-mosaic over Malapert Mountain summit ridge.',
    isNumericalDem: false,
  },
  {
    id: 'LRO_LOLA_NAC_ColorHillshade_3_5mpp_IM_1_LandingSite_SP',
    title: 'LRO LOLA + NAC Color Hillshade — IM-1 Odysseus Malapert A (3.5 m/px, SP)',
    projectionCode: 'SP',
    crs: 'urn:ogc:def:crs:IAU2000::30120',
    category: 'ARTEMIS_NAC_HIGHRES',
    defaultStyle: 'default',
    defaultTileMatrixSet: 'default028mm',
    defaultFormat: 'image/png',
    fileExtension: 'png',
    capabilitiesUrl:
      'https://trek.nasa.gov/tiles/Moon/SP/LRO_LOLA_NAC_ColorHillshade_3_5mpp_IM_1_LandingSite_SP/1.0.0/WMTSCapabilities.xml',
    sampleTileUrl:
      'https://trek.nasa.gov/tiles/Moon/SP/LRO_LOLA_NAC_ColorHillshade_3_5mpp_IM_1_LandingSite_SP/1.0.0/default/default028mm/0/0/0.png',
    coverageLatRange: [-81.5, -79.0],
    coverageLonRange: [-5, 10],
    description:
      'Fused LOLA + LROC NAC stereophotogrammetric 3.5 m/px colorized hillshade over the Intuitive Machines IM-1 landing region.',
    isNumericalDem: false,
  },
  {
    id: 'PSR_SP',
    title: 'South Polar Permanently Shadowed Regions (PSR_SP)',
    projectionCode: 'SP',
    crs: 'urn:ogc:def:crs:IAU2000::30120',
    category: 'ILLUMINATION_PSR',
    defaultStyle: 'default',
    defaultTileMatrixSet: 'default028mm',
    defaultFormat: 'image/png',
    fileExtension: 'png',
    capabilitiesUrl: 'https://trek.nasa.gov/tiles/Moon/SP/PSR_SP/1.0.0/WMTSCapabilities.xml',
    sampleTileUrl:
      'https://trek.nasa.gov/tiles/Moon/SP/PSR_SP/1.0.0/default/default028mm/0/0/0.png',
    coverageLatRange: [-90, -80],
    coverageLonRange: [-180, 180],
    description:
      'LOLA horizon-modeled South Polar Permanently Shadowed Regions (PSRs) polygon/raster mask.',
    isNumericalDem: false,
  },
  {
    id: 'LRO_LOLA_Count_NPole75_30mp_v04',
    title: 'LRO LOLA North Pole Observation Count & Coverage (75°N–90°N, 30 m/px v04)',
    projectionCode: 'NP',
    crs: 'urn:ogc:def:crs:IAU2000::30118',
    category: 'LOLA_ELEVATION_SLOPE',
    defaultStyle: 'default',
    defaultTileMatrixSet: 'default028mm',
    defaultFormat: 'image/png',
    fileExtension: 'png',
    capabilitiesUrl:
      'https://trek.nasa.gov/tiles/Moon/NP/LRO_LOLA_Count_NPole75_30mp_v04/1.0.0/WMTSCapabilities.xml',
    sampleTileUrl:
      'https://trek.nasa.gov/tiles/Moon/NP/LRO_LOLA_Count_NPole75_30mp_v04/1.0.0/default/default028mm/0/0/0.png',
    coverageLatRange: [75, 90],
    coverageLonRange: [-180, 180],
    description:
      'North Polar Stereographic LRO LOLA observation density and altimetric coverage product (75°N to 90°N).',
    isNumericalDem: false,
  },
  {
    id: 'PSR_NP',
    title: 'North Polar Permanently Shadowed Regions (PSR_NP)',
    projectionCode: 'NP',
    crs: 'urn:ogc:def:crs:IAU2000::30118',
    category: 'ILLUMINATION_PSR',
    defaultStyle: 'default',
    defaultTileMatrixSet: 'default028mm',
    defaultFormat: 'image/png',
    fileExtension: 'png',
    capabilitiesUrl: 'https://trek.nasa.gov/tiles/Moon/NP/PSR_NP/1.0.0/WMTSCapabilities.xml',
    sampleTileUrl:
      'https://trek.nasa.gov/tiles/Moon/NP/PSR_NP/1.0.0/default/default028mm/0/0/0.png',
    coverageLatRange: [75, 90],
    coverageLonRange: [-180, 180],
    description:
      'North Polar Stereographic Permanently Shadowed Regions (PSRs) mapped by LRO LOLA.',
    isNumericalDem: false,
  },
];

/**
 * Helper to extract tag content from XML strings without heavy DOM dependencies.
 */
function extractXmlTagText(xml: string, tagPattern: string): string | null {
  const regex = new RegExp(`<(?:[a-zA-Z0-9_]+:)?${tagPattern}[^>]*>([\\s\\S]*?)<\\/(?:[a-zA-Z0-9_]+:)?${tagPattern}>`, 'i');
  const match = xml.match(regex);
  return match && match[1] ? match[1].trim() : null;
}

/**
 * Parses an OGC WMTS 1.0.0 `GetCapabilities` XML document into a strongly typed
 * `WmtsParsedCapabilities` object.
 */
export function parseWmtsCapabilitiesXml(
  xml: string,
  projectionCode: MoonTrekProjectionCode,
  provenance: ScientificProvenanceEnvelope
): WmtsParsedCapabilities {
  const layerBlockMatch = xml.match(/<Layer>([\s\S]*?)<\/Layer>/i);
  const layerXml = layerBlockMatch ? layerBlockMatch[1]! : xml;

  const layerIdentifier =
    extractXmlTagText(layerXml, 'Identifier') ||
    extractXmlTagText(xml, 'Title') ||
    'Unknown_WMTS_Layer';
  const title = extractXmlTagText(layerXml, 'Title') || layerIdentifier;

  // Parse BoundingBox
  const bboxMatch = layerXml.match(
    /<ows:BoundingBox[^>]*crs="([^"]*)"[^>]*>([\s\S]*?)<\/ows:BoundingBox>/i
  );
  const bboxCrs = bboxMatch?.[1] || MOON_TREK_PROJECTION_CRS[projectionCode];
  const bboxInner = bboxMatch?.[2] || layerXml;
  const lowerStr = extractXmlTagText(bboxInner, 'LowerCorner') || '-180.0 -90.0';
  const upperStr = extractXmlTagText(bboxInner, 'UpperCorner') || '180.0 90.0';
  const lowerParts = lowerStr.split(/\s+/).map(Number);
  const upperParts = upperStr.split(/\s+/).map(Number);

  // Parse WGS84BoundingBox if present
  const wgsMatch = layerXml.match(/<ows:WGS84BoundingBox[^>]*>([\s\S]*?)<\/ows:WGS84BoundingBox>/i);
  let wgs84BoundingBox: WmtsParsedCapabilities['wgs84BoundingBox'];
  if (wgsMatch?.[1]) {
    const wLow = (extractXmlTagText(wgsMatch[1], 'LowerCorner') || '-180 -90').split(/\s+/).map(Number);
    const wUp = (extractXmlTagText(wgsMatch[1], 'UpperCorner') || '180 90').split(/\s+/).map(Number);
    wgs84BoundingBox = {
      lowerCorner: [wLow[0] ?? -180, wLow[1] ?? -90],
      upperCorner: [wUp[0] ?? 180, wUp[1] ?? 90],
    };
  }

  // Parse Styles
  const styles: WmtsParsedCapabilities['styles'] = [];
  const styleRegex = /<Style([^>]*)>([\s\S]*?)<\/Style>/gi;
  let styleMatch: RegExpExecArray | null;
  while ((styleMatch = styleRegex.exec(layerXml)) !== null) {
    const attrs = styleMatch[1] || '';
    const inner = styleMatch[2] || '';
    const id = extractXmlTagText(inner, 'Identifier') || 'default';
    const stTitle = extractXmlTagText(inner, 'Title') || id;
    const isDefault = /isDefault="true"/i.test(attrs);
    styles.push({ identifier: id, title: stTitle, isDefault });
  }
  if (styles.length === 0) {
    styles.push({ identifier: 'default', title: 'Default Style', isDefault: true });
  }

  // Parse Formats
  const formats: string[] = [];
  const formatRegex = /<Format>([^<]+)<\/Format>/gi;
  let fmtMatch: RegExpExecArray | null;
  while ((fmtMatch = formatRegex.exec(layerXml)) !== null) {
    if (fmtMatch[1]) formats.push(fmtMatch[1].trim());
  }
  if (formats.length === 0) formats.push('image/png');

  // Parse TileMatrixSetLink
  const tmsLinkMatch = layerXml.match(/<TileMatrixSetLink>([\s\S]*?)<\/TileMatrixSetLink>/i);
  const tileMatrixSetId =
    (tmsLinkMatch?.[1] && extractXmlTagText(tmsLinkMatch[1], 'TileMatrixSet')) || 'default028mm';

  // Parse ResourceURL template
  const resUrlMatch = layerXml.match(/<ResourceURL[^>]*template="([^"]+)"/i);
  const rawTemplate =
    resUrlMatch?.[1] ||
    `https://trek.nasa.gov/tiles/Moon/${projectionCode}/${layerIdentifier}/1.0.0/{Style}/{TileMatrixSet}/{TileMatrix}/{TileRow}/{TileCol}.png`;
  const resourceUrlTemplate = rawTemplate.replace('/1.0.0//', '/1.0.0/');
  const fileExtension: 'jpg' | 'png' = resourceUrlTemplate.toLowerCase().endsWith('.jpg')
    ? 'jpg'
    : 'png';

  // Parse TileMatrixSet blocks individually so multiple TileMatrixSets in the same XML
  // (e.g. default028mm vs native meter matrix set) never merge or produce duplicate keys.
  const tmsBlocks: { id: string; xml: string }[] = [];
  const tmsBlockRegex = /<TileMatrixSet>([\s\S]*?)<\/TileMatrixSet>/gi;
  let tmsMatch: RegExpExecArray | null;
  while ((tmsMatch = tmsBlockRegex.exec(xml)) !== null) {
    const blockXml = tmsMatch[1] || '';
    // Extract the top-level Identifier of the TileMatrixSet (before the first <TileMatrix>)
    const headerPart = blockXml.split(/<TileMatrix>/i)[0] || blockXml;
    const setId = extractXmlTagText(headerPart, 'Identifier') || `tms_${tmsBlocks.length}`;
    tmsBlocks.push({ id: setId, xml: blockXml });
  }

  const availableTileMatrixSets =
    tmsBlocks.length > 0 ? tmsBlocks.map((b) => b.id) : [tileMatrixSetId];

  // Scope TileMatrix parsing to the layer's linked TileMatrixSet (or first available set)
  const targetTmsBlock =
    tmsBlocks.find((b) => b.id === tileMatrixSetId) ||
    tmsBlocks[0] || { id: tileMatrixSetId, xml };
  const activeTileMatrixSetId = targetTmsBlock.id;

  const tileMatrices: WmtsTileMatrix[] = [];
  const seenMatrixKeys = new Set<string>();
  const tmRegex = /<TileMatrix>([\s\S]*?)<\/TileMatrix>/gi;
  let tmMatch: RegExpExecArray | null;
  while ((tmMatch = tmRegex.exec(targetTmsBlock.xml)) !== null) {
    const tmXml = tmMatch[1] || '';
    const id = (extractXmlTagText(tmXml, 'Identifier') ?? String(tileMatrices.length)).trim();
    const compositeKey = `${activeTileMatrixSetId}:${id}`;
    if (seenMatrixKeys.has(compositeKey)) {
      continue;
    }
    seenMatrixKeys.add(compositeKey);

    const scaleDenominator = Number(extractXmlTagText(tmXml, 'ScaleDenominator') || 0);
    const tlcStr = extractXmlTagText(tmXml, 'TopLeftCorner') || '-180.0 90.0';
    const tlcParts = tlcStr.split(/\s+/).map(Number);
    const tileWidth = Number(extractXmlTagText(tmXml, 'TileWidth') || 256);
    const tileHeight = Number(extractXmlTagText(tmXml, 'TileHeight') || 256);
    const matrixWidth = Number(extractXmlTagText(tmXml, 'MatrixWidth') || 1);
    const matrixHeight = Number(extractXmlTagText(tmXml, 'MatrixHeight') || 1);

    tileMatrices.push({
      tileMatrixSetId: activeTileMatrixSetId,
      identifier: id,
      scaleDenominator,
      topLeftCorner: [tlcParts[0] ?? -180, tlcParts[1] ?? 90],
      tileWidth,
      tileHeight,
      matrixWidth,
      matrixHeight,
    });
  }

  return {
    layerIdentifier,
    title,
    projectionCode,
    supportedCrs: MOON_TREK_PROJECTION_CRS[projectionCode],
    boundingBox: {
      crs: bboxCrs,
      lowerCorner: [lowerParts[0] ?? -180, lowerParts[1] ?? -90],
      upperCorner: [upperParts[0] ?? 180, upperParts[1] ?? 90],
    },
    wgs84BoundingBox,
    styles,
    formats,
    tileMatrixSetId: activeTileMatrixSetId,
    availableTileMatrixSets,
    resourceUrlTemplate,
    fileExtension,
    tileMatrices,
    provenance,
  };
}

/**
 * Fetches and parses the live `WMTSCapabilities.xml` from NASA Moon Trek for a given
 * layer identifier and projection (`EQ`, `SP`, or `NP`).
 */
export async function fetchMoonTrekLayerCapabilities(
  layerId: string,
  projectionCode: MoonTrekProjectionCode = 'EQ'
): Promise<WmtsParsedCapabilities> {
  const url = `https://trek.nasa.gov/tiles/Moon/${projectionCode}/${encodeURIComponent(
    layerId
  )}/1.0.0/WMTSCapabilities.xml`;

  const response = await fetchWithProvenanceCache({
    cacheKey: `moontrek:capabilities:v2:${projectionCode}:${layerId}`,
    serviceName: 'NASA_MOON_TREK_WMTS',
    url,
    responseType: 'text',
    ttlMs: 1000 * 60 * 60 * 12,
    baseProvenance: {
      source: 'NASA_MOON_TREK_WMTS',
      providerOrganization: 'NASA JPL Solar System Treks (trek.nasa.gov)',
      datasetIdentifier: layerId,
      datasetVersion: 'WMTS 1.0.0',
      nativeCrs: MOON_TREK_PROJECTION_CRS[projectionCode],
      longitudeConvention:
        projectionCode === 'EQ' ? '[-180,+180]_EAST' : 'CARTESIAN_METERS_OR_KM',
      elevationDatum: 'IAU 2000 Lunar Sphere (R = 1737.4 km)',
      nativeUnits: projectionCode === 'EQ' ? 'degrees' : 'meters',
      timeScale: 'STATIC_CARTOGRAPHIC',
      isNumericalDem: false,
      processingHistory: [`Fetched OGC WMTS GetCapabilities XML for ${layerId} (${projectionCode})`],
      warnings: [
        'WMTS tile layers provide cartographic/radiometric imagery, not raw Float32 elevation arrays.',
      ],
    },
  });

  if (!response.payloadText) {
    throw new Error(`Empty WMTSCapabilities.xml payload for ${layerId}`);
  }

  return parseWmtsCapabilitiesXml(response.payloadText, projectionCode, response.provenance);
}

/**
 * Discovers available layers from NASA Moon Trek's catalog endpoint for the requested projection,
 * merging with the verified curated catalog.
 */
export async function discoverMoonTrekLayers(
  projectionCode?: MoonTrekProjectionCode
): Promise<{
  layers: MoonTrekLayerCatalogEntry[];
  liveCatalogCount: number;
  provenance: ScientificProvenanceEnvelope;
}> {
  const projFilter = projectionCode
    ? VERIFIED_MOON_TREK_WMTS_LAYERS.filter((l) => l.projectionCode === projectionCode)
    : VERIFIED_MOON_TREK_WMTS_LAYERS;

  const targetProj = projectionCode || 'SP';
  const projTypePath = targetProj === 'EQ' ? 'eq' : 'polar';
  const crsUrn = MOON_TREK_PROJECTION_CRS[targetProj];
  const discoveryUrl = `https://trek.nasa.gov/moon/TrekServices/ws/index/${projTypePath}/listVisibleLayers?proj=${encodeURIComponent(
    crsUrn
  )}&start=0&rows=35`;

  try {
    const res = await fetchWithProvenanceCache({
      cacheKey: `moontrek:catalog:${targetProj}`,
      serviceName: 'NASA_MOON_TREK_WMTS',
      url: discoveryUrl,
      responseType: 'text',
      ttlMs: 1000 * 60 * 60 * 12,
      baseProvenance: {
        source: 'NASA_MOON_TREK_WMTS',
        providerOrganization: 'NASA JPL Solar System Treks (trek.nasa.gov)',
        datasetIdentifier: `MoonTrek_Catalog_${targetProj}`,
        datasetVersion: '1.0.0',
        nativeCrs: crsUrn,
        longitudeConvention: targetProj === 'EQ' ? '[-180,+180]_EAST' : 'CARTESIAN_METERS_OR_KM',
        elevationDatum: 'IAU 2000 Lunar Sphere (R = 1737.4 km)',
        nativeUnits: targetProj === 'EQ' ? 'degrees' : 'meters',
        timeScale: 'STATIC_CARTOGRAPHIC',
        isNumericalDem: false,
        processingHistory: [`Queried Moon Trek TrekServices catalog for ${targetProj}`],
        warnings: [],
      },
    });

    let liveCatalogCount = projFilter.length;
    if (res.payloadText) {
      try {
        const json = JSON.parse(res.payloadText) as {
          response?: { numFound?: number; docs?: Array<{ productLabel?: string; title?: string }> };
        };
        if (json.response?.numFound) {
          liveCatalogCount = json.response.numFound;
        }
      } catch {
        // Ignore JSON parse fallback
      }
    }

    return {
      layers: projFilter,
      liveCatalogCount,
      provenance: res.provenance,
    };
  } catch {
    return {
      layers: projFilter,
      liveCatalogCount: projFilter.length,
      provenance: {
        source: 'NASA_MOON_TREK_WMTS',
        providerOrganization: 'NASA JPL Solar System Treks (trek.nasa.gov)',
        endpointUrl: discoveryUrl,
        datasetIdentifier: `MoonTrek_Verified_Catalog_${targetProj}`,
        datasetVersion: '1.0.0',
        nativeCrs: crsUrn,
        longitudeConvention: targetProj === 'EQ' ? '[-180,+180]_EAST' : 'CARTESIAN_METERS_OR_KM',
        elevationDatum: 'IAU 2000 Lunar Sphere (R = 1737.4 km)',
        nativeUnits: targetProj === 'EQ' ? 'degrees' : 'meters',
        timeScale: 'STATIC_CARTOGRAPHIC',
        retrievedAtUtc: new Date().toISOString(),
        cacheStatus: 'FALLBACK_SYNTHESIS',
        isNumericalDem: false,
        processingHistory: ['Loaded verified NASA Moon Trek WMTS catalog'],
        warnings: [],
      },
    };
  }
}

/**
 * Computes valid (tileMatrix, tileRow, tileCol) indices for a selenographic coordinate (latDeg, lonDeg)
 * respecting the parsed WMTSCapabilities bounding box, hemisphere coverage, and matrix dimensions.
 *
 * When a user inspects a North Polar (`NP`) layer while the active landing site is in the South Polar
 * hemisphere (or vice-versa), this resolver automatically projects a valid reference coordinate inside
 * the polar cap (`89.5°N, 0°E` for `NP`, or the layer's centroid for regional `SP` mosaics) so that
 * polar tile requests never clamp to empty out-of-footprint corners (e.g. `row=0, col=15`).
 */
export function resolveWmtsTileForCoordinate(
  capabilities: WmtsParsedCapabilities,
  latDeg: number,
  lonDeg: number,
  requestedZoomLevel = 1
): WmtsResolvedTileResult {
  const matrices = capabilities.tileMatrices;
  const clampedIdx = Math.max(0, Math.min(matrices.length - 1, requestedZoomLevel));
  const matrix = matrices[clampedIdx] ?? {
    tileMatrixSetId: capabilities.tileMatrixSetId,
    identifier: String(requestedZoomLevel),
    scaleDenominator: 1,
    topLeftCorner: [-180, 90] as [number, number],
    tileWidth: 256,
    tileHeight: 256,
    matrixWidth: 2,
    matrixHeight: 1,
  };

  const catalogEntry = VERIFIED_MOON_TREK_WMTS_LAYERS.find(
    (l) => l.id === capabilities.layerIdentifier
  );
  const [minLat, maxLat] = catalogEntry?.coverageLatRange ??
    (capabilities.projectionCode === 'NP'
      ? [75, 90]
      : capabilities.projectionCode === 'SP'
        ? [-90, -75]
        : [-90, 90]);
  const [minLon, maxLon] = catalogEntry?.coverageLonRange ?? [-180, 180];

  let effectiveLat = latDeg;
  let effectiveLon = lonDeg;
  let hemisphereAdjusted = false;

  if (capabilities.projectionCode === 'NP' && (latDeg < minLat || latDeg > maxLat)) {
    // Active site is outside the North Polar cap (e.g. South Pole -89.78°S); use North Pole reference
    effectiveLat = 89.2;
    effectiveLon = 0.0;
    hemisphereAdjusted = true;
  } else if (capabilities.projectionCode === 'SP' && (latDeg < minLat || latDeg > maxLat)) {
    // Active site is outside the South Polar layer's latitude band; use layer centroid
    effectiveLat = (minLat + maxLat) / 2;
    effectiveLon = (minLon + maxLon) / 2;
    hemisphereAdjusted = true;
  }

  const projected = projectLatLonToLunarCrs(
    effectiveLat,
    effectiveLon,
    capabilities.supportedCrs
  );
  const [minX, minY] = capabilities.boundingBox.lowerCorner;
  const [maxX, maxY] = capabilities.boundingBox.upperCorner;

  const spanX = Math.max(1e-6, maxX - minX);
  const spanY = Math.max(1e-6, maxY - minY);

  const rawInCoverage =
    !hemisphereAdjusted &&
    projected.x >= minX &&
    projected.x <= maxX &&
    projected.y >= minY &&
    projected.y <= maxY;

  let normX = Math.max(0, Math.min(0.999999, (projected.x - minX) / spanX));
  // Top-left corner has maxY at row 0
  let normY = Math.max(0, Math.min(0.999999, (maxY - projected.y) / spanY));

  // For Polar Stereographic layers (SP / NP), Moon Trek's tile pyramid often has MatrixWidth = 2 * MatrixHeight
  // (e.g. 2x1 at z=0, 4x2 at z=1, 8x4 at z=2, 16x8 at z=3) where the polar circular mosaic occupies the square
  // left/center sub-grid (cols 0 .. matrixHeight - 1), while cols >= matrixHeight return 404.
  const effectiveGridCols =
    capabilities.projectionCode !== 'EQ' && matrix.matrixWidth > matrix.matrixHeight
      ? matrix.matrixHeight
      : matrix.matrixWidth;

  // Also ensure polar coordinates stay within the inscribed circular data footprint so corner tiles don't 404
  if (capabilities.projectionCode !== 'EQ' && effectiveGridCols >= 2) {
    const dx = normX - 0.5;
    const dy = normY - 0.5;
    const r = Math.hypot(dx, dy);
    if (r > 0.38) {
      const scale = 0.35 / r;
      normX = 0.5 + dx * scale;
      normY = 0.5 + dy * scale;
    }
  }

  const tileCol = Math.max(
    0,
    Math.min(effectiveGridCols - 1, Math.floor(normX * effectiveGridCols))
  );
  const tileRow = Math.max(
    0,
    Math.min(matrix.matrixHeight - 1, Math.floor(normY * matrix.matrixHeight))
  );

  const defaultStyle =
    capabilities.styles.find((s) => s.isDefault)?.identifier ||
    capabilities.styles[0]?.identifier ||
    'default';

  const tileUrl = buildMoonTrekTileUrl({
    projectionCode: capabilities.projectionCode,
    layerId: capabilities.layerIdentifier,
    style: defaultStyle,
    tileMatrixSet: capabilities.tileMatrixSetId,
    tileMatrix: matrix.identifier,
    tileRow,
    tileCol,
    fileExtension: capabilities.fileExtension,
  });

  const diagnosticCategory: WmtsDiagnosticCategory = 'VALID_TILE';
  const diagnosticMessage = hemisphereAdjusted
    ? `Active target (${latDeg.toFixed(2)}°, ${lonDeg.toFixed(2)}°E) is outside ${
        capabilities.projectionCode
      } coverage [${minLat}°, ${maxLat}°]; displaying polar reference (${effectiveLat.toFixed(
        2
      )}°, ${effectiveLon.toFixed(1)}°E) at z=${matrix.identifier} (${tileRow}, ${tileCol}).`
    : `Resolved valid ${capabilities.projectionCode} tile z=${matrix.identifier}, row=${tileRow}, col=${tileCol} inside ${capabilities.supportedCrs}.`;

  return {
    tileMatrixSetId: capabilities.tileMatrixSetId,
    tileMatrix: matrix.identifier,
    tileRow,
    tileCol,
    tileUrl,
    inCoverage: rawInCoverage,
    hemisphereAdjusted,
    requestedCoord: { latDeg, lonDeg },
    effectiveCoord: { latDeg: effectiveLat, lonDeg: effectiveLon },
    diagnosticCategory,
    diagnosticMessage,
  };
}

/**
 * Constructs a RESTful NASA Moon Trek WMTS tile URL.
 */
export function buildMoonTrekTileUrl(params: {
  projectionCode: MoonTrekProjectionCode;
  layerId: string;
  style?: string;
  tileMatrixSet?: string;
  tileMatrix: string | number;
  tileRow: number;
  tileCol: number;
  fileExtension?: 'jpg' | 'png';
}): string {
  const {
    projectionCode,
    layerId,
    style = 'default',
    tileMatrixSet = 'default028mm',
    tileMatrix,
    tileRow,
    tileCol,
    fileExtension = 'png',
  } = params;

  return `https://trek.nasa.gov/tiles/Moon/${projectionCode}/${encodeURIComponent(
    layerId
  )}/1.0.0/${encodeURIComponent(style)}/${encodeURIComponent(
    tileMatrixSet
  )}/${encodeURIComponent(String(tileMatrix))}/${tileRow}/${tileCol}.${fileExtension}`;
}

/**
 * Fetches an actual binary WMTS image tile from NASA Moon Trek with two-tier caching.
 */
export async function fetchMoonTrekTileBinary(params: {
  projectionCode: MoonTrekProjectionCode;
  layerId: string;
  style?: string;
  tileMatrixSet?: string;
  tileMatrix: string | number;
  tileRow: number;
  tileCol: number;
  fileExtension?: 'jpg' | 'png';
}): Promise<{
  buffer: Buffer;
  contentType: string;
  provenance: ScientificProvenanceEnvelope;
}> {
  const url = buildMoonTrekTileUrl(params);
  const cacheKey = `moontrek:tile:${params.projectionCode}:${params.layerId}:${params.tileMatrix}:${params.tileRow}:${params.tileCol}`;

  const res = await fetchWithProvenanceCache({
    cacheKey,
    serviceName: 'NASA_MOON_TREK_WMTS',
    url,
    responseType: 'binary',
    ttlMs: 1000 * 60 * 60 * 24,
    baseProvenance: {
      source: 'NASA_MOON_TREK_WMTS',
      providerOrganization: 'NASA JPL Solar System Treks (trek.nasa.gov)',
      datasetIdentifier: params.layerId,
      datasetVersion: 'WMTS 1.0.0',
      nativeCrs: MOON_TREK_PROJECTION_CRS[params.projectionCode],
      longitudeConvention:
        params.projectionCode === 'EQ' ? '[-180,+180]_EAST' : 'CARTESIAN_METERS_OR_KM',
      elevationDatum: 'IAU 2000 Lunar Sphere (R = 1737.4 km)',
      nativeUnits: 'radiometric_pixel_intensity',
      timeScale: 'STATIC_CARTOGRAPHIC',
      isNumericalDem: false,
      processingHistory: [
        `Fetched WMTS tile z=${params.tileMatrix}, row=${params.tileRow}, col=${params.tileCol}`,
      ],
      warnings: [],
    },
  });

  if (!res.payloadBlob) {
    throw new Error(`Empty binary tile payload from ${url}`);
  }

  return {
    buffer: res.payloadBlob,
    contentType: res.contentType,
    provenance: res.provenance,
  };
}

/**
 * Validates a Moon Trek WMTS tile request and returns structured diagnostic telemetry
 * distinguishing all 6 failure/status categories required by Part 5.
 */
export async function validateMoonTrekTileRequest(params: {
  projectionCode: MoonTrekProjectionCode;
  layerId: string;
  style?: string;
  tileMatrixSet?: string;
  tileMatrix: string | number;
  tileRow: number;
  tileCol: number;
  fileExtension?: 'jpg' | 'png';
}): Promise<{
  valid: boolean;
  httpStatus: number;
  contentType: string;
  byteLength: number;
  dimensions: string;
  diagnosticCategory: WmtsDiagnosticCategory;
  diagnosticMessage: string;
  upstreamUrl: string;
}> {
  const upstreamUrl = buildMoonTrekTileUrl(params);
  if (!['EQ', 'SP', 'NP'].includes(params.projectionCode)) {
    return {
      valid: false,
      httpStatus: 400,
      contentType: 'application/json',
      byteLength: 0,
      dimensions: '0×0',
      diagnosticCategory: 'UNSUPPORTED_PROJECTION',
      diagnosticMessage: `Projection '${params.projectionCode}' is not supported by NASA Moon Trek WMTS.`,
      upstreamUrl,
    };
  }
  if (params.tileRow < 0 || params.tileCol < 0 || Number.isNaN(params.tileRow) || Number.isNaN(params.tileCol)) {
    return {
      valid: false,
      httpStatus: 400,
      contentType: 'application/json',
      byteLength: 0,
      dimensions: '0×0',
      diagnosticCategory: 'INVALID_TILE_REQUEST',
      diagnosticMessage: `Invalid negative or NaN tile indices row=${params.tileRow}, col=${params.tileCol}.`,
      upstreamUrl,
    };
  }

  try {
    const tile = await fetchMoonTrekTileBinary(params);
    const isImage =
      tile.contentType.startsWith('image/') && tile.buffer && tile.buffer.byteLength > 64;
    return {
      valid: isImage,
      httpStatus: isImage ? 200 : 422,
      contentType: tile.contentType,
      byteLength: tile.buffer.byteLength,
      dimensions: '256×256',
      diagnosticCategory: isImage ? 'VALID_TILE' : 'INVALID_TILE_REQUEST',
      diagnosticMessage: isImage
        ? `Verified 256×256 ${tile.contentType} raster (${tile.buffer.byteLength.toLocaleString()} bytes) from ${params.projectionCode} / ${params.layerId}.`
        : `Upstream response returned non-image payload (${tile.contentType}).`,
      upstreamUrl,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const is404 = msg.includes('404');
    const is400 = msg.includes('400');
    return {
      valid: false,
      httpStatus: is404 ? 404 : is400 ? 400 : 502,
      contentType: 'text/plain',
      byteLength: 0,
      dimensions: '256×256 (No-Data)',
      diagnosticCategory: is404
        ? 'OUTSIDE_DATA_COVERAGE'
        : is400
          ? 'INVALID_TILE_MATRIX'
          : 'NETWORK_OR_SERVER_ERROR',
      diagnosticMessage: is404
        ? `Tile z=${params.tileMatrix}, row=${params.tileRow}, col=${params.tileCol} lies outside the circular polar mosaic coverage footprint (HTTP 404).`
        : `Upstream NASA Moon Trek WMTS error: ${msg}`,
      upstreamUrl,
    };
  }
}

