import { NextRequest, NextResponse } from 'next/server';
import {
  computeLrocBBoxForRegion,
  fetchLrocWmsCapabilities,
  fetchLrocWmsMapBinary,
  LROC_PDS_SCIENTIFIC_PRODUCTS,
  LrocProjectionMode,
  queryLrocWmsFeatureInfo,
  VERIFIED_LROC_WMS_LAYERS,
} from '@/lib/services/lrocService';
import {
  checkProviderRateLimit,
  getClientIdentifier,
  sanitizePublicError,
} from '@/lib/security/proxyGuard';

function sanitizeLayerName(raw: string, fallback: string): string {
  const cleaned = raw.trim();
  if (!cleaned || cleaned.length > 96 || !/^[a-zA-Z0-9_,-]+$/.test(cleaned)) {
    return fallback;
  }
  return cleaned;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action') || 'capabilities';
  const rate = checkProviderRateLimit('LROC_LUNASERV_WMS', getClientIdentifier(req));
  if (!rate.allowed) {
    return NextResponse.json(
      { status: 'error', action, message: 'LROC WMS proxy rate limit exceeded.' },
      { status: 429, headers: { 'Retry-After': String(rate.retryAfterSec) } }
    );
  }

  try {
    if (action === 'capabilities') {
      const capabilities = await fetchLrocWmsCapabilities();
      return NextResponse.json({
        status: 'ok',
        action: 'capabilities',
        ...capabilities,
        pdsScientificProducts: LROC_PDS_SCIENTIFIC_PRODUCTS,
      });
    }

    if (action === 'pds-products') {
      return NextResponse.json({
        status: 'ok',
        action: 'pds-products',
        products: LROC_PDS_SCIENTIFIC_PRODUCTS,
      });
    }

    if (action === 'feature-info') {
      const layer = sanitizeLayerName(
        searchParams.get('layer') || '',
        'luna_wac_dtm_numeric_meters'
      );
      const rawLat = Number(searchParams.get('lat') ?? -89.78);
      const rawLon = Number(searchParams.get('lon') ?? 120.45);
      const latDeg = Number.isFinite(rawLat) ? Math.max(-90, Math.min(90, rawLat)) : -89.78;
      const lonDeg = Number.isFinite(rawLon) ? Math.max(-180, Math.min(360, rawLon)) : 120.45;
      const info = await queryLrocWmsFeatureInfo({ layer, latDeg, lonDeg });
      return NextResponse.json({
        status: 'ok',
        action: 'feature-info',
        data: info,
      });
    }

    if (action === 'map') {
      const layers = sanitizeLayerName(searchParams.get('layers') || '', 'luna_wac_global');
      const rawSrs = searchParams.get('srs') || 'EPSG:4326';
      const srs: LrocProjectionMode =
        rawSrs === 'AUTO:42003,9001,0,-90' || rawSrs === 'AUTO:42003,9001,0,90'
          ? rawSrs
          : 'EPSG:4326';

      const bboxParam = searchParams.get('bbox');
      let bbox: [number, number, number, number];
      if (bboxParam) {
        const parts = bboxParam.split(',').map(Number);
        if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) {
          return NextResponse.json(
            { status: 'error', action, message: 'Invalid WMS bbox parameter.' },
            { status: 400 }
          );
        }
        bbox = [parts[0]!, parts[1]!, parts[2]!, parts[3]!];
      } else {
        const lat = Math.max(-90, Math.min(90, Number(searchParams.get('lat') ?? -89.5) || -89.5));
        const lon = Math.max(-180, Math.min(360, Number(searchParams.get('lon') ?? 0) || 0));
        bbox = computeLrocBBoxForRegion({ srs, centerLatDeg: lat, centerLonDeg: lon });
      }

      const width = Math.min(1024, Math.max(64, Number(searchParams.get('width') ?? 512) || 512));
      const height = Math.min(1024, Math.max(64, Number(searchParams.get('height') ?? 512) || 512));
      const layerMeta = VERIFIED_LROC_WMS_LAYERS.find((l) => l.name === layers);
      const format =
        searchParams.get('format') === 'image/jpeg' || searchParams.get('format') === 'image/png'
          ? (searchParams.get('format') as 'image/png' | 'image/jpeg')
          : layerMeta?.defaultFormat || 'image/png';
      const transparent =
        searchParams.get('transparent') !== null
          ? searchParams.get('transparent') === 'true'
          : layerMeta?.transparent ?? true;

      const mapRes = await fetchLrocWmsMapBinary({
        layers,
        srs,
        bbox,
        width,
        height,
        format,
        transparent,
      });

      return new NextResponse(new Uint8Array(mapRes.buffer), {
        status: 200,
        headers: {
          'Content-Type': mapRes.contentType,
          'Cache-Control': 'public, max-age=43200',
          'X-Selene-Provenance-Source': mapRes.provenance.source,
          'X-Selene-Provenance-CRS': mapRes.provenance.nativeCrs,
          'X-Selene-Cache-Status': mapRes.provenance.cacheStatus,
        },
      });
    }

    return NextResponse.json(
      { status: 'error', message: `Unsupported LROC action: ${action}` },
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
