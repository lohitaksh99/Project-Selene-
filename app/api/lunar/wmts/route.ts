import { NextRequest, NextResponse } from 'next/server';
import {
  discoverMoonTrekLayers,
  fetchMoonTrekLayerCapabilities,
  fetchMoonTrekTileBinary,
  MoonTrekProjectionCode,
  resolveWmtsTileForCoordinate,
  validateMoonTrekTileRequest,
  VERIFIED_MOON_TREK_WMTS_LAYERS,
} from '@/lib/services/moonTrekService';
import {
  checkProviderRateLimit,
  getClientIdentifier,
  sanitizePublicError,
} from '@/lib/security/proxyGuard';

function sanitizeWmtsSegment(raw: string, fallback: string, maxLen = 96): string {
  const cleaned = raw.trim();
  if (!cleaned || cleaned.length > maxLen || !/^[a-zA-Z0-9._-]+$/.test(cleaned)) {
    return fallback;
  }
  return cleaned;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action') || 'catalog';
  const clientId = getClientIdentifier(req);
  const rate = checkProviderRateLimit('NASA_MOON_TREK_WMTS', clientId);
  if (!rate.allowed) {
    return NextResponse.json(
      { status: 'error', action, message: 'WMTS proxy rate limit exceeded.' },
      { status: 429, headers: { 'Retry-After': String(rate.retryAfterSec) } }
    );
  }

  const rawProj = (
    searchParams.get('projection') ||
    searchParams.get('proj') ||
    'SP'
  ).toUpperCase() as MoonTrekProjectionCode;
  const validProjection: MoonTrekProjectionCode = ['EQ', 'SP', 'NP'].includes(rawProj)
    ? rawProj
    : 'SP';

  try {
    if (action === 'catalog') {
      const hasProjParam = Boolean(searchParams.get('projection') || searchParams.get('proj'));
      const filterProj = hasProjParam ? validProjection : undefined;
      const result = await discoverMoonTrekLayers(filterProj);
      return NextResponse.json({
        status: 'ok',
        action: 'catalog',
        totalVerifiedLayers: VERIFIED_MOON_TREK_WMTS_LAYERS.length,
        ...result,
      });
    }

    if (action === 'capabilities') {
      const defaultLayer =
        validProjection === 'EQ'
          ? 'LRO_WAC_Mosaic_Global_303ppd_v02'
          : validProjection === 'NP'
            ? 'LRO_LOLA_Count_NPole75_30mp_v04'
            : 'LRO_NAC_AvgMosaic_SPole855_1mp';
      const layerId = sanitizeWmtsSegment(searchParams.get('layer') || '', defaultLayer);

      const capabilities = await fetchMoonTrekLayerCapabilities(layerId, validProjection);
      const rawLat = Number(searchParams.get('lat') ?? (validProjection === 'NP' ? 89.2 : -89.67));
      const rawLon = Number(searchParams.get('lon') ?? 129.78);
      const lat = Number.isFinite(rawLat) ? Math.max(-90, Math.min(90, rawLat)) : -89.67;
      const lon = Number.isFinite(rawLon) ? Math.max(-180, Math.min(360, rawLon)) : 129.78;
      const zoom = Math.max(0, Math.min(14, Number(searchParams.get('zoom') ?? 0) || 0));
      const resolvedTile = resolveWmtsTileForCoordinate(capabilities, lat, lon, zoom);

      return NextResponse.json({
        status: 'ok',
        action: 'capabilities',
        capabilities,
        resolvedTile,
      });
    }

    if (action === 'validate-tile' || action === 'tile') {
      const defaultLayer =
        validProjection === 'EQ'
          ? 'LRO_WAC_Mosaic_Global_303ppd_v02'
          : validProjection === 'NP'
            ? 'LRO_LOLA_Count_NPole75_30mp_v04'
            : 'LRO_NAC_AvgMosaic_SPole855_1mp';
      const layerId = sanitizeWmtsSegment(searchParams.get('layer') || '', defaultLayer);
      const style = sanitizeWmtsSegment(searchParams.get('style') || '', 'default', 48);
      const tileMatrixSet = sanitizeWmtsSegment(
        searchParams.get('tileMatrixSet') || '',
        'default028mm',
        48
      );
      const tileMatrix = sanitizeWmtsSegment(
        searchParams.get('z') || searchParams.get('tileMatrix') || '',
        '0',
        24
      );
      const tileRow = Number(searchParams.get('row') ?? 0);
      const tileCol = Number(searchParams.get('col') ?? 0);
      if (
        !Number.isInteger(tileRow) ||
        !Number.isInteger(tileCol) ||
        tileRow < 0 ||
        tileCol < 0 ||
        tileRow > 16384 ||
        tileCol > 16384
      ) {
        return NextResponse.json(
          { status: 'error', action, message: 'Tile row/col out of bounded integer range.' },
          { status: 400 }
        );
      }

      const extParam = searchParams.get('ext');
      const catalogEntry = VERIFIED_MOON_TREK_WMTS_LAYERS.find((l) => l.id === layerId);
      const fileExtension: 'jpg' | 'png' =
        extParam === 'jpg' || extParam === 'png'
          ? extParam
          : catalogEntry?.fileExtension || (validProjection === 'EQ' ? 'jpg' : 'png');

      if (action === 'validate-tile') {
        const validation = await validateMoonTrekTileRequest({
          projectionCode: validProjection,
          layerId,
          style,
          tileMatrixSet,
          tileMatrix,
          tileRow,
          tileCol,
          fileExtension,
        });

        return NextResponse.json({
          status: 'ok',
          action: 'validate-tile',
          validation,
        });
      }

      try {
        const tile = await fetchMoonTrekTileBinary({
          projectionCode: validProjection,
          layerId,
          style,
          tileMatrixSet,
          tileMatrix,
          tileRow,
          tileCol,
          fileExtension,
        });

        return new NextResponse(new Uint8Array(tile.buffer), {
          status: 200,
          headers: {
            'Content-Type': tile.contentType,
            'Cache-Control': 'public, max-age=86400',
            'X-Selene-Tile-Status': 'VALID_TILE',
            'X-Selene-Provenance-Source': tile.provenance.source,
            'X-Selene-Provenance-CRS': tile.provenance.nativeCrs,
            'X-Selene-Cache-Status': tile.provenance.cacheStatus,
          },
        });
      } catch (tileErr) {
        const errMsg = sanitizePublicError(tileErr);
        const svgDiagnostic = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
          <rect width="256" height="256" fill="#101214" stroke="#E9E6DE" stroke-opacity="0.2" stroke-width="2"/>
          <circle cx="128" cy="112" r="56" fill="none" stroke="#38BDF8" stroke-opacity="0.35" stroke-dasharray="4 4"/>
          <text x="128" y="98" text-anchor="middle" fill="#D6C36A" font-family="monospace" font-size="11" font-weight="bold">OUTSIDE POLAR FOOTPRINT</text>
          <text x="128" y="118" text-anchor="middle" fill="#E9E6DE" font-family="monospace" font-size="10">${validProjection} · z=${tileMatrix} · row=${tileRow} · col=${tileCol}</text>
          <text x="128" y="138" text-anchor="middle" fill="#B8B2A5" font-family="monospace" font-size="9">${layerId.slice(0, 28)}</text>
          <text x="128" y="210" text-anchor="middle" fill="#38BDF8" font-family="monospace" font-size="9">Select in-bounds polar matrix cell</text>
        </svg>`;
        return new NextResponse(svgDiagnostic, {
          status: 200,
          headers: {
            'Content-Type': 'image/svg+xml',
            'Cache-Control': 'no-store',
            'X-Selene-Tile-Status': errMsg.includes('404')
              ? 'OUTSIDE_DATA_COVERAGE'
              : 'UPSTREAM_ERROR',
          },
        });
      }
    }

    return NextResponse.json(
      { status: 'error', message: `Unsupported WMTS action: ${action}` },
      { status: 400 }
    );
  } catch (err) {
    return NextResponse.json(
      {
        status: 'error',
        action,
        message: sanitizePublicError(err),
      },
      { status: 502 }
    );
  }
}
