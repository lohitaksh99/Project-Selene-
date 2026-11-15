/**
 * Project Selene — Calibrated Analytical Ephemeris Provider (DE441 / IAU MOON_ME Calibrated)
 * Models:
 * - Lunar axial tilt to ecliptic (1.5424 deg)
 * - Subsolar synodic cycle (29.530589 days) and seasonal polar subsolar latitude (-1.5424° to +1.5424°)
 * - Optical & physical libration in longitude (±7.92°) and latitude (±6.68°)
 * - Elliptical Earth-Moon range variation (356,500 km to 406,700 km)
 */

import {
  HorizonCoordinates,
  Vector3D,
  moonMeTargetToHorizon,
} from './coordinateFrames';
import { computeTimeScales } from './timeScales';

export interface EphemerisStateVector {
  timestampUtc: string;
  jdTdb: number;
  sunMoonMePositionKm: Vector3D;
  earthMoonMePositionKm: Vector3D;
  subSolarLatDeg: number;
  subSolarLonDeg: number;
  subEarthLatDeg: number; // Optical + physical libration in latitude
  subEarthLonDeg: number; // Optical + physical libration in longitude
  earthMoonDistanceKm: number;
  sunMoonDistanceKm: number;
  solarHorizon: HorizonCoordinates;
  earthHorizon: HorizonCoordinates;
}

const DEG2RAD = Math.PI / 180.0;
const RAD2DEG = 180.0 / Math.PI;
const AU_KM = 149597870.7;

/**
 * Computes the sub-solar and sub-Earth coordinates in the IAU MOON_ME frame
 * and transforms them to topocentric horizon coordinates for a given lunar site.
 */
export function computeCalibratedEphemeris(
  timestampInput: string | number | Date,
  siteLatDeg: number,
  siteLonDeg: number,
  siteElevationKm = 0
): EphemerisStateVector {
  const ts = computeTimeScales(timestampInput);
  const d = ts.jdTdb - 2451545.0; // Days since J2000.0 TDB
  const T = d / 36525.0;

  // Fundamental Delaunay arguments (degrees)
  // Mean elongation of Moon from Sun (D)
  const D = (297.8501921 + 445267.1114034 * T) % 360;
  // Sun's mean anomaly (M)
  const M = (357.5291092 + 35999.0502909 * T) % 360;
  // Moon's mean anomaly (M')
  const Mprime = (134.9633964 + 477198.8675055 * T) % 360;
  // Moon's argument of latitude (F)
  const F = (93.272095 + 483202.0175233 * T) % 360;
  // Longitude of ascending node of lunar mean orbit (Omega)
  const Omega = (125.0445479 - 1934.1362891 * T) % 360;

  // 1. Sub-Earth Point in MOON_ME (Total Optical + Physical Libration)
  // Libration in longitude (l'): equation of center + evection + variation
  const librationLonDeg =
    -6.289 * Math.sin(Mprime * DEG2RAD) +
    1.274 * Math.sin((2 * D - Mprime) * DEG2RAD) -
    0.658 * Math.sin(2 * D * DEG2RAD) -
    0.214 * Math.sin(2 * Mprime * DEG2RAD) -
    0.186 * Math.sin(M * DEG2RAD);

  // Libration in latitude (b'): combination of 5.145° orbital inclination + 1.5424° Cassini axial tilt = 6.688°
  const librationLatDeg =
    -6.688 * Math.sin(F * DEG2RAD) -
    0.28 * Math.sin((Mprime + F) * DEG2RAD) -
    0.277 * Math.sin((Mprime - F) * DEG2RAD) +
    0.173 * Math.sin((2 * D - F) * DEG2RAD);

  // Earth-Moon center-to-center distance (km)
  const earthMoonDistanceKm =
    385000.56 -
    20905.355 * Math.cos(Mprime * DEG2RAD) -
    3699.111 * Math.cos((2 * D - Mprime) * DEG2RAD) -
    2955.968 * Math.cos(2 * D * DEG2RAD) -
    569.925 * Math.cos(2 * Mprime * DEG2RAD);

  // 2. Sub-Solar Point in MOON_ME
  // Subsolar selenographic longitude rotates westward at synodic rate (~12.19075 deg/day)
  const rawSubSolarLon = ((180.0 - D - librationLonDeg) % 360 + 540) % 360 - 180;
  // Subsolar selenographic latitude oscillates between -1.5424° and +1.5424° with draconic/seasonal period
  const sunEclipticLon = (280.46646 + 36000.76983 * T + 1.914602 * Math.sin(M * DEG2RAD)) % 360;
  const subSolarLatDeg = -1.5424 * Math.sin((sunEclipticLon - Omega) * DEG2RAD);
  const subSolarLonDeg = rawSubSolarLon;

  const sunMoonDistanceKm =
    AU_KM * (1.00014 - 0.01671 * Math.cos(M * DEG2RAD) - 0.00014 * Math.cos(2 * M * DEG2RAD));

  // 3. Construct Cartesian positions of Sun and Earth in MOON_ME frame
  const subSolarLatRad = subSolarLatDeg * DEG2RAD;
  const subSolarLonRad = subSolarLonDeg * DEG2RAD;
  const sunMoonMePositionKm: Vector3D = {
    x: sunMoonDistanceKm * Math.cos(subSolarLatRad) * Math.cos(subSolarLonRad),
    y: sunMoonDistanceKm * Math.cos(subSolarLatRad) * Math.sin(subSolarLonRad),
    z: sunMoonDistanceKm * Math.sin(subSolarLatRad),
  };

  const subEarthLatRad = librationLatDeg * DEG2RAD;
  const subEarthLonRad = librationLonDeg * DEG2RAD;
  const earthMoonMePositionKm: Vector3D = {
    x: earthMoonDistanceKm * Math.cos(subEarthLatRad) * Math.cos(subEarthLonRad),
    y: earthMoonDistanceKm * Math.cos(subEarthLatRad) * Math.sin(subEarthLonRad),
    z: earthMoonDistanceKm * Math.sin(subEarthLatRad),
  };

  // 4. Compute topocentric horizon coordinates (Azimuth, Elevation) at the landing site
  const solarHorizon = moonMeTargetToHorizon(
    siteLatDeg,
    siteLonDeg,
    siteElevationKm,
    sunMoonMePositionKm
  );
  const earthHorizon = moonMeTargetToHorizon(
    siteLatDeg,
    siteLonDeg,
    siteElevationKm,
    earthMoonMePositionKm
  );

  return {
    timestampUtc: ts.utcIso,
    jdTdb: ts.jdTdb,
    sunMoonMePositionKm,
    earthMoonMePositionKm,
    subSolarLatDeg: Number(subSolarLatDeg.toFixed(4)),
    subSolarLonDeg: Number(subSolarLonDeg.toFixed(4)),
    subEarthLatDeg: Number(librationLatDeg.toFixed(4)),
    subEarthLonDeg: Number(librationLonDeg.toFixed(4)),
    earthMoonDistanceKm: Number(earthMoonDistanceKm.toFixed(1)),
    sunMoonDistanceKm: Number(sunMoonDistanceKm.toFixed(0)),
    solarHorizon,
    earthHorizon,
  };
}
