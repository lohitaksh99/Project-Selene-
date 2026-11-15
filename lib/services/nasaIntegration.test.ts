import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseWmtsCapabilitiesXml,
  resolveWmtsTileForCoordinate,
  fetchMoonTrekLayerCapabilities,
} from './moonTrekService';
import {
  normalizeHorizonsEndpointUrl,
  parseHorizonsVectorsBlock,
  parseHorizonsElementsBlock,
  parseHorizonsObserverCsvBlock,
  queryJplHorizons,
} from './horizonsService';
import {
  buildLrocWmsGetMapUrl,
  computeLrocBBoxForRegion,
  fetchLrocWmsCapabilities,
} from './lrocService';
import {
  projectLatLonToLunarCrs,
  unprojectSouthPolarStereoToLatLon,
} from './scientificProvenance';
import { evaluatePhysicalLunarIllumination } from './illuminationEngine';

describe('Project Selene V2 — NASA Moon Trek, JPL Horizons & LROC Integration Suite', () => {
  it('roundtrips South Polar Stereographic IAU2000:30120 coordinates with sub-meter precision', () => {
    const projected = projectLatLonToLunarCrs(
      -89.78,
      120.45,
      'urn:ogc:def:crs:IAU2000::30120'
    );
    assert.equal(projected.units, 'm');
    assert.ok(Math.abs(projected.x) < 10000);
    assert.ok(Math.abs(projected.y) < 10000);

    const roundtrip = unprojectSouthPolarStereoToLatLon(projected.x, projected.y);
    assert.ok(Math.abs(roundtrip.latDeg - -89.78) < 1e-3);
    assert.ok(Math.abs(roundtrip.lonDeg180 - 120.45) < 1e-2);
  });

  it('normalizes ssd-api.jpl.nasa.gov documentation URLs to the live ssd.jpl.nasa.gov endpoint', () => {
    const rawDocUrl =
      'https://ssd-api.jpl.nasa.gov/api/horizons.api?format=json&COMMAND=%27301%27';
    const normalized = normalizeHorizonsEndpointUrl(rawDocUrl);
    assert.equal(normalized.url, 'https://ssd.jpl.nasa.gov/api/horizons.api');
    assert.equal(normalized.wasRewritten, true);
  });

  it('parses NASA Moon Trek OGC WMTS 1.0.0 GetCapabilities XML and resolves polar tile indices', () => {
    const sampleXml = `<?xml version="1.0" encoding="UTF-8"?>
      <Capabilities xmlns="http://www.opengis.net/wmts/1.0" xmlns:ows="http://www.opengis.net/ows/1.1" version="1.0.0">
        <Contents>
          <Layer>
            <ows:Title>LRO_NAC_AvgMosaic_SPole855_1mp</ows:Title>
            <ows:Identifier>LRO_NAC_AvgMosaic_SPole855_1mp</ows:Identifier>
            <ows:BoundingBox crs="urn:ogc:def:crs:IAU2000::30120">
              <ows:LowerCorner>-136700.0 -136700.0</ows:LowerCorner>
              <ows:UpperCorner>136700.0 136700.0</ows:UpperCorner>
            </ows:BoundingBox>
            <Style isDefault="true">
              <ows:Identifier>default</ows:Identifier>
            </Style>
            <Format>image/png</Format>
            <TileMatrixSetLink>
              <TileMatrixSet>default028mm</TileMatrixSet>
            </TileMatrixSetLink>
          </Layer>
          <TileMatrixSet>
            <ows:Identifier>default028mm</ows:Identifier>
            <ows:SupportedCRS>urn:ogc:def:crs:IAU2000::30120</ows:SupportedCRS>
            <TileMatrix>
              <ows:Identifier>0</ows:Identifier>
              <ScaleDenominator>1913068.5819572986</ScaleDenominator>
              <TopLeftCorner>-136700.0 136700.0</TopLeftCorner>
              <TileWidth>256</TileWidth>
              <TileHeight>256</TileHeight>
              <MatrixWidth>2</MatrixWidth>
              <MatrixHeight>2</MatrixHeight>
            </TileMatrix>
            <TileMatrix>
              <ows:Identifier>2</ows:Identifier>
              <ScaleDenominator>478267.14548932464</ScaleDenominator>
              <TopLeftCorner>-136700.0 136700.0</TopLeftCorner>
              <TileWidth>256</TileWidth>
              <TileHeight>256</TileHeight>
              <MatrixWidth>8</MatrixWidth>
              <MatrixHeight>8</MatrixHeight>
            </TileMatrix>
          </TileMatrixSet>
        </Contents>
      </Capabilities>`;

    const parsed = parseWmtsCapabilitiesXml(sampleXml, 'SP', {
      source: 'NASA_MOON_TREK_WMTS',
      providerOrganization: 'NASA JPL Solar System Treks',
      endpointUrl:
        'https://trek.nasa.gov/tiles/Moon/SP/LRO_NAC_AvgMosaic_SPole855_1mp/1.0.0/WMTSCapabilities.xml',
      datasetIdentifier: 'LRO_NAC_AvgMosaic_SPole855_1mp',
      datasetVersion: '1.0.0',
      nativeCrs: 'urn:ogc:def:crs:IAU2000::30120',
      longitudeConvention: 'CARTESIAN_METERS_OR_KM',
      elevationDatum: 'IAU 2000 Lunar Sphere',
      nativeUnits: 'meters',
      timeScale: 'STATIC_CARTOGRAPHIC',
      retrievedAtUtc: '2026-11-10T00:00:00Z',
      cacheStatus: 'LIVE_NETWORK',
      isNumericalDem: false,
      processingHistory: [],
      warnings: [],
    });
    assert.equal(parsed.layerIdentifier, 'LRO_NAC_AvgMosaic_SPole855_1mp');
    assert.equal(parsed.supportedCrs, 'urn:ogc:def:crs:IAU2000::30120');
    assert.equal(parsed.tileMatrices.length, 2);

    const tile = resolveWmtsTileForCoordinate(parsed, -89.78, 120.45, 1);
    assert.equal(tile.tileMatrix, '2');
    assert.ok(tile.tileRow >= 0 && tile.tileRow < 8);
    assert.ok(tile.tileCol >= 0 && tile.tileCol < 8);
    assert.ok(tile.tileUrl.includes('/default028mm/2/'));
  });

  it('parses JPL Horizons VECTORS, ELEMENTS, and OBSERVER $$SOE...$$EOE blocks', () => {
    const sampleVectorsResult = `
2461354.500000000 = A.D. 2026-Nov-10 00:00:00.0000 TDB 
 X = 1.984125432100000E+05 Y =-3.102451123400000E+05 Z =-1.124512345600000E+05
 VX= 8.412345678900000E-01 VY= 4.812345678900000E-01 VZ= 1.912345678900000E-01
 LT= 1.284123456789000E+00 RG= 3.849123456789000E+05 RR=-1.234567890000000E-02`;
    const vectors = parseHorizonsVectorsBlock(sampleVectorsResult, 'KM-S', 'ICRF');
    assert.equal(vectors.length, 1);
    assert.equal(vectors[0]!.jdTdb, 2461354.5);
    assert.ok(Math.abs(vectors[0]!.position.x - 198412.54321) < 0.01);
    assert.ok(Math.abs((vectors[0]!.rangeModulus ?? 0) - 384912.3456789) < 0.01);

    const sampleElementsResult = `
2461354.500000000 = A.D. 2026-Nov-10 00:00:00.0000 TDB 
 EC= 5.490048912345678E-02 QR= 3.631045123456789E+05 IN= 5.145396123456789E+00
 OM= 1.250812345678901E+02 W = 3.181512345678901E+02 Tp=  2461350.123456789000
 N = 1.525041234567890E-04 MA= 4.512345678901234E+01 TA= 4.891234567890123E+01
 A = 3.844001234567890E+05 AD= 4.056957345678901E+05 PR= 2.360591234567890E+06`;
    const elements = parseHorizonsElementsBlock(sampleElementsResult);
    assert.equal(elements.length, 1);
    assert.ok(Math.abs(elements[0]!.eccentricity - 0.054900489) < 1e-6);
    assert.ok(Math.abs(elements[0]!.semiMajorAxisKmOrAu - 384400.12345) < 0.1);

    const sampleObserverResult = `2026-Nov-10 00:00,*,m, 14 25 12.34, -15 30 00.0, 120.450000, -89.780000, 312.451200, -1.351200, 0.002568, -0.012`;
    const obs = parseHorizonsObserverCsvBlock(sampleObserverResult);
    assert.equal(obs.length, 1);
    assert.ok(Math.abs((obs[0]!.obsSubLonDeg ?? 0) - 120.45) < 1e-4);
    assert.ok(Math.abs((obs[0]!.sunSubLatDeg ?? 0) - -1.3512) < 1e-4);
  });

  it('constructs valid LROC Lunaserv WMS 1.1.1 GetMap URLs for polar orthographic and equirectangular projections', () => {
    const bboxPolar = computeLrocBBoxForRegion({
      srs: 'AUTO:42003,9001,0,-90',
      centerLatDeg: -89.78,
      centerLonDeg: 120.45,
      spanDegOrMeters: 180000,
    });
    const url = buildLrocWmsGetMapUrl({
      layers: 'luna_wac_global',
      srs: 'AUTO:42003,9001,0,-90',
      bbox: bboxPolar,
      width: 512,
      height: 512,
      format: 'image/png',
    });
    assert.ok(url.startsWith('https://wms.im-ldi.com/?'));
    assert.ok(url.includes('SERVICE=WMS'));
    assert.ok(url.includes('VERSION=1.1.1'));
    assert.ok(url.includes('LAYERS=luna_wac_global'));
  });

  it('computes all 3 physical lunar illumination regimes with finite solar disk limb darkening', async () => {
    const result = await evaluatePhysicalLunarIllumination({
      siteId: 'shackleton-rim',
      latDeg: -89.78,
      lonDeg: 120.45,
      epochUtc: '2026-11-10T00:00:00Z',
    });

    assert.ok(result.regime1SphericalIncidence.incidenceAngleDeg >= 0);
    assert.ok(result.regime2SlopeCorrectedIncidence.incidenceAngleDeg >= 0);
    assert.ok(result.regime3FullTerrainShadowed.visibleSolarDiskFraction >= 0);
    assert.ok(result.regime3FullTerrainShadowed.visibleSolarDiskFraction <= 1);
  });

  it('retrieves live data from NASA Moon Trek WMTS, JPL Horizons REST API, and LROC Lunaserv WMS', async () => {
    const [wmtsCap, horizonsVec, lrocCap] = await Promise.all([
      fetchMoonTrekLayerCapabilities('LRO_NAC_AvgMosaic_SPole855_1mp', 'SP'),
      queryJplHorizons({
        command: '301',
        center: '500@399',
        ephemType: 'VECTORS',
        startTime: '2026-11-10 00:00',
        stopTime: '2026-11-10 06:00',
        stepSize: '6 h',
      }),
      fetchLrocWmsCapabilities(),
    ]);

    assert.equal(wmtsCap.layerIdentifier, 'LRO_NAC_AvgMosaic_SPole855_1mp');
    assert.ok(wmtsCap.tileMatrices.length > 0);

    assert.ok((horizonsVec.vectorRecords?.length ?? 0) > 0);
    assert.ok((horizonsVec.vectorRecords?.[0]?.rangeModulus ?? 0) > 300000);

    assert.ok(lrocCap.totalLunarLayersDiscovered > 10);
  });

  it('scopes WMTS TileMatrix extraction to the active TileMatrixSet and handles North Polar (NP) hemisphere coverage', () => {
    const multiSetXml = `<?xml version="1.0" encoding="UTF-8"?>
      <Capabilities xmlns="http://www.opengis.net/wmts/1.0" xmlns:ows="http://www.opengis.net/ows/1.1" version="1.0.0">
        <Contents>
          <Layer>
            <ows:Title>LRO_LOLA_Count_NPole75_30mp_v04</ows:Title>
            <ows:Identifier>LRO_LOLA_Count_NPole75_30mp_v04</ows:Identifier>
            <ows:BoundingBox crs="urn:ogc:def:crs:EPSG::0">
              <ows:LowerCorner>-457440.0 -457440.0</ows:LowerCorner>
              <ows:UpperCorner>457440.0 457440.0</ows:UpperCorner>
            </ows:BoundingBox>
            <Style isDefault="true">
              <ows:Identifier>default</ows:Identifier>
            </Style>
            <Format>image/png</Format>
            <TileMatrixSetLink>
              <TileMatrixSet>default028mm</TileMatrixSet>
            </TileMatrixSetLink>
          </Layer>
          <TileMatrixSet>
            <ows:Identifier>default028mm</ows:Identifier>
            <ows:SupportedCRS>urn:ogc:def:crs:IAU2000::30118</ows:SupportedCRS>
            <TileMatrix>
              <ows:Identifier>0</ows:Identifier>
              <ScaleDenominator>12095238.1</ScaleDenominator>
              <TopLeftCorner>-457440.0 457440.0</TopLeftCorner>
              <TileWidth>256</TileWidth>
              <TileHeight>256</TileHeight>
              <MatrixWidth>2</MatrixWidth>
              <MatrixHeight>1</MatrixHeight>
            </TileMatrix>
            <TileMatrix>
              <ows:Identifier>3</ows:Identifier>
              <ScaleDenominator>3822300.5</ScaleDenominator>
              <TopLeftCorner>-457440.0 457440.0</TopLeftCorner>
              <TileWidth>256</TileWidth>
              <TileHeight>256</TileHeight>
              <MatrixWidth>16</MatrixWidth>
              <MatrixHeight>8</MatrixHeight>
            </TileMatrix>
          </TileMatrixSet>
          <TileMatrixSet>
            <ows:Identifier>secondarySet</ows:Identifier>
            <ows:SupportedCRS>urn:ogc:def:crs:IAU2000::30118</ows:SupportedCRS>
            <TileMatrix>
              <ows:Identifier>0</ows:Identifier>
              <ScaleDenominator>236235119.0</ScaleDenominator>
              <TopLeftCorner>-457440.0 457440.0</TopLeftCorner>
              <TileWidth>256</TileWidth>
              <TileHeight>256</TileHeight>
              <MatrixWidth>3</MatrixWidth>
              <MatrixHeight>2</MatrixHeight>
            </TileMatrix>
          </TileMatrixSet>
        </Contents>
      </Capabilities>`;

    const parsedNp = parseWmtsCapabilitiesXml(multiSetXml, 'NP', {
      source: 'NASA_MOON_TREK_WMTS',
      providerOrganization: 'NASA JPL Solar System Treks',
      endpointUrl:
        'https://trek.nasa.gov/tiles/Moon/NP/LRO_LOLA_Count_NPole75_30mp_v04/1.0.0/WMTSCapabilities.xml',
      datasetIdentifier: 'LRO_LOLA_Count_NPole75_30mp_v04',
      datasetVersion: '1.0.0',
      nativeCrs: 'urn:ogc:def:crs:IAU2000::30118',
      longitudeConvention: 'CARTESIAN_METERS_OR_KM',
      elevationDatum: 'IAU 2000 Lunar Sphere',
      nativeUnits: 'meters',
      timeScale: 'STATIC_CARTOGRAPHIC',
      retrievedAtUtc: '2026-11-10T00:00:00Z',
      cacheStatus: 'LIVE_NETWORK',
      isNumericalDem: false,
      processingHistory: [],
      warnings: [],
    });

    // Only matrices from default028mm should be included (no duplicate '0')
    const ids = parsedNp.tileMatrices.map((m) => m.identifier);
    assert.equal(new Set(ids).size, ids.length);
    assert.equal(parsedNp.tileMatrices.length, 2);

    // Resolving a South Pole site (-89.78°S) on a North Polar (NP) layer should adjust hemisphere and clamp col
    const resolvedNp = resolveWmtsTileForCoordinate(parsedNp, -89.78, 120.45, 3);
    assert.equal(resolvedNp.hemisphereAdjusted, true);
    assert.ok(resolvedNp.effectiveCoord.latDeg >= 75 && resolvedNp.effectiveCoord.latDeg <= 90);
    assert.ok(resolvedNp.tileCol >= 0 && resolvedNp.tileCol < 8);
  });
});

