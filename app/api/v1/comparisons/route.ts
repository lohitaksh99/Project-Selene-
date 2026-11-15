import { NextRequest } from 'next/server';
import { buildApiEnvelope } from '@/lib/apiEnvelope';
import {
  MissionTimelineAnalysis,
  runMissionTimelineAnalysis,
} from '@/lib/astrodynamics/missionAnalyzer';
import {
  LandingSiteRecord,
  ScenarioRecord,
  getSeleneDb,
} from '@/server/db/database';

export interface ScenarioComparisonResultItem {
  scenario: ScenarioRecord;
  site: LandingSiteRecord;
  analysis: MissionTimelineAnalysis;
  rank: number;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const scenarioIds: string[] = Array.isArray(body.scenario_ids)
      ? body.scenario_ids
      : [
          'scen-artemis-iii-shackleton',
          'scen-clps-malapert-relay',
          'scen-viper-nobile-volatile',
        ];

    const db = getSeleneDb();
    const allScenarios = db
      .prepare('SELECT * FROM scenarios')
      .all() as ScenarioRecord[];
    const allSites = db
      .prepare('SELECT * FROM landing_sites')
      .all() as LandingSiteRecord[];

    const selectedScenarios = scenarioIds
      .map((id) => allScenarios.find((s) => s.id === id))
      .filter((s): s is ScenarioRecord => Boolean(s));

    const results: ScenarioComparisonResultItem[] = selectedScenarios.map(
      (scenario) => {
        const site =
          allSites.find((st) => st.id === scenario.site_id) ?? allSites[0]!;

        const analysis = runMissionTimelineAnalysis({
          siteId: site.id,
          siteName: site.name,
          siteLatDeg: site.latitude,
          siteLonDeg: site.longitude,
          siteElevationKm: site.elevation_km,
          psrProximityKm: site.psr_proximity_km,
          epochStartUtc: scenario.landing_date,
          durationDays: scenario.duration_days,
          stepHours: 2,
          constraints: {
            minSolarElevationDeg:
              body.override_min_solar_deg !== undefined
                ? Number(body.override_min_solar_deg)
                : scenario.min_solar_elevation_deg,
            minEarthElevationDeg:
              body.override_min_earth_deg !== undefined
                ? Number(body.override_min_earth_deg)
                : scenario.min_earth_elevation_deg,
            requiredContinuousHours:
              body.override_required_hours !== undefined
                ? Number(body.override_required_hours)
                : scenario.required_continuous_hours,
          },
        });

        return {
          scenario,
          site,
          analysis,
          rank: 0,
        };
      }
    );

    // Rank scenarios by overall feasibility score descending
    results.sort(
      (a, b) =>
        b.analysis.scoreBreakdown.overallFeasibilityScore -
        a.analysis.scoreBreakdown.overallFeasibilityScore
    );
    results.forEach((item, idx) => {
      item.rank = idx + 1;
    });

    return buildApiEnvelope({
      compared_count: results.length,
      recommended_winner: results[0]
        ? {
            scenario_id: results[0].scenario.id,
            scenario_name: results[0].scenario.name,
            site_name: results[0].site.name,
            feasibility_score:
              results[0].analysis.scoreBreakdown.overallFeasibilityScore,
            feasibility_tier: results[0].analysis.scoreBreakdown.feasibilityTier,
            rationale: results[0].analysis.scoreBreakdown.tradeOffSummary,
          }
        : null,
      comparisons: results,
    });
  } catch (err) {
    return buildApiEnvelope(
      { error: err instanceof Error ? err.message : 'Scenario comparison failed' },
      { status: 'error', httpStatus: 500 }
    );
  }
}
