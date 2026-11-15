'use client';

import React from 'react';
import Image from 'next/image';
import { ArrowRight, ArrowUpRight, CheckCircle2 } from 'lucide-react';

interface EditorialHomepageBodyProps {
  onNavigateTab: (tab: string) => void;
  onSelectSite?: (siteId: string) => void;
}

export default function EditorialHomepageBody({
  onNavigateTab,
  onSelectSite,
}: EditorialHomepageBodyProps) {
  // Five narrow vertical image cards matching Section B
  const possibilityCards = [
    {
      id: 'terrain',
      title: 'TERRAIN & ELEVATION',
      desc: 'LOLA laser altimetry & micro-slope hazard detection down to 5-meter resolution across rugged crater rims.',
      image: '/images/card_terrain_elev.jpg',
      metric: '+2.15 KM PEAK',
      tab: 'explorer',
    },
    {
      id: 'sunlight',
      title: 'SUNLIGHT CONDITIONS',
      desc: 'Low-angle grazing illumination models and finite solar disk fractions across 354-hour synodic cycles.',
      image: '/images/card_sunlight_grazing.jpg',
      metric: '84% PEAK SUMMER',
      tab: 'site-analysis',
    },
    {
      id: 'earth',
      title: 'EARTH VISIBILITY',
      desc: 'Topocentric East-North-Up horizon line-of-sight tracking and optical libration bounds (±7.9° lon, ±6.7° lat).',
      image: '/images/card_earth_vis.jpg',
      metric: '405,230 KM RANGE',
      tab: 'simulator',
    },
    {
      id: 'comm',
      title: 'COMMUNICATION WINDOWS',
      desc: 'Direct-to-Earth Ka-band link margins, DSN co-visibility windows, and RF masking across massive topographic walls.',
      image: '/images/card_comm_laser.jpg',
      metric: '≥ 3.0 DB MARGIN',
      tab: 'comparison',
    },
    {
      id: 'safety',
      title: 'LANDING SAFETY',
      desc: 'Autonomous hazard avoidance LiDAR, regolith geotechnical bearing strength, and boulder distribution metrics.',
      image: '/images/card_landing_safety.jpg',
      metric: 'TIER I VALIDATED',
      tab: 'explorer',
    },
  ];

  return (
    <div className="w-full bg-[#F7F7F3] text-[#111111] overflow-hidden">
      {/* =========================================================================
          SECTION A — INTRODUCTION (Editorial White, massive typography)
          ========================================================================= */}
      <section
        id="project-overview"
        className="scroll-mt-14 max-w-[1440px] mx-auto px-6 md:px-14 py-24 sm:py-32 border-b border-[#D7D5CE]"
      >
        <div className="max-w-4xl">
          <div className="inline-flex items-center gap-2 mb-6">
            <span className="w-2.5 h-2.5 bg-[#F1F52E] border border-[#111111]" />
            <span className="text-xs font-mono font-bold tracking-[0.2em] text-[#626765] uppercase">
              INTRODUCING THE LUNAR LANDING NAVIGATOR
            </span>
          </div>

          <h2 className="text-4xl sm:text-6xl md:text-7xl lg:text-[76px] font-black tracking-[-0.04em] leading-[0.94] text-[#111111] uppercase mb-10">
            Every Landing Begins With Understanding.
          </h2>

          <p className="text-lg sm:text-2xl text-[#202020] font-normal leading-relaxed mb-10">
            Selecting a touchdown site at the Moon&apos;s South Pole is one of the most demanding engineering problems in human spaceflight. Unlike Apollo equatorial landings, the South Pole features extreme low-angle grazing sunlight, deep permanent shadows cold enough to trap water ice, and oscillating Earth visibility dictated by optical libration. Project Selene equips mission architects with unified, physics-grounded astrodynamics.
          </p>

          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={() => onNavigateTab('site-analysis')}
              className="inline-flex items-center gap-3 px-8 py-4 bg-[#111111] text-[#F7F7F3] font-mono text-xs font-bold tracking-wider uppercase hover:bg-[#F1F52E] hover:text-[#111111] transition-colors"
            >
              <span>DISCOVER THE MISSION</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => onNavigateTab('explorer')}
              className="inline-flex items-center gap-2 px-7 py-4 border border-[#111111] text-[#111111] font-mono text-xs font-bold tracking-wider uppercase hover:bg-[#EAE9E4] transition-colors"
            >
              <span>INSPECT 3D GLOBE</span>
            </button>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION B — EXPLORE THE POSSIBILITIES (5 Narrow Vertical Image Cards)
          ========================================================================= */}
      <section className="max-w-[1500px] mx-auto px-6 md:px-12 py-24 sm:py-32 border-b border-[#D7D5CE]">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-6">
          <div>
            <div className="text-xs font-mono font-bold tracking-[0.2em] text-[#626765] uppercase mb-2">
              FIVE CORE ASTRONOMICAL CONSTRAINTS
            </div>
            <h3 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-[-0.03em] uppercase text-[#111111]">
              Explore The Lunar Surface
            </h3>
          </div>
          <p className="max-w-md text-sm md:text-base text-[#626765] font-normal">
            Discover the extreme topographical and orbital conditions that shape the next generation of lunar exploration.
          </p>
        </div>

        {/* 5-Column Grid with Narrow Gaps and Sharp Corners */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {possibilityCards.map((card, idx) => (
            <button
              key={card.id}
              type="button"
              onClick={() => onNavigateTab(card.tab)}
              className="group relative flex flex-col text-left bg-[#FFFFFF] border border-[#D4D3CC] overflow-hidden cursor-pointer hover:border-[#111111] transition-colors duration-200"
            >
              {/* Tall Image with Hover Zoom */}
              <div className="relative w-full aspect-[2/3] overflow-hidden bg-[#111111]">
                <Image
                  src={card.image}
                  alt={card.title}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 20vw"
                  className="object-cover object-center grayscale contrast-125 group-hover:scale-105 group-hover:grayscale-0 transition-transform duration-500 ease-out"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute top-3 left-3 bg-[#111111] text-[#F1F52E] font-mono text-[11px] font-bold px-2 py-0.5">
                  0{idx + 1}
                </div>
                <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity bg-[#F1F52E] text-[#111111] p-1">
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </div>
                <div className="absolute bottom-3 left-3 bg-[#111111]/95 text-[#F7F7F3] font-mono text-[11px] px-2 py-0.5">
                  {card.metric}
                </div>
              </div>

              {/* Card Meta */}
              <div className="p-5 flex flex-col flex-1 justify-between border-t border-[#D4D3CC] w-full">
                <div>
                  <h4 className="font-extrabold text-sm tracking-tight uppercase text-[#111111] mb-2">
                    {card.title}
                  </h4>
                  <p className="text-xs text-[#4A4A44] leading-relaxed line-clamp-3">
                    {card.desc}
                  </p>
                </div>

                <div className="pt-4 mt-4 border-t border-[#EAE9E4] flex items-center justify-between text-[11px] font-mono font-bold text-[#111111] group-hover:text-[#006B82]">
                  <span>ACCESS INSTRUMENT</span>
                  <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* =========================================================================
          SECTION C — SCIENTIFIC CAPABILITIES (Asymmetrical 55/45 Two-Column)
          ========================================================================= */}
      <section className="max-w-[1500px] mx-auto px-6 md:px-12 py-24 sm:py-32 border-b border-[#D7D5CE]">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          {/* Left: 55% Wide Large Rectangular Image */}
          <div className="lg:col-span-7 relative aspect-[4/3] w-full overflow-hidden bg-[#111111] border border-[#111111]">
            <Image
              src="/images/capabilities_rover.jpg"
              alt="Autonomous lunar rover traversing elevated ridge"
              fill
              sizes="(max-width: 1024px) 100vw, 55vw"
              className="object-cover object-center grayscale contrast-125"
              referrerPolicy="no-referrer"
            />
            <div className="absolute bottom-4 left-4 bg-[#111111]/95 text-[#F1F52E] font-mono text-[11px] px-3 py-1.5 flex items-center gap-2">
              <span className="w-2 h-2 bg-[#F1F52E]" />
              <span>ROVER VIPER / TRIDENT DRILL INSTRUMENTATION</span>
            </div>
          </div>

          {/* Right: Three Stacked Editorial Headings */}
          <div className="lg:col-span-5 flex flex-col justify-center space-y-10">
            <div>
              <span className="text-xs font-mono font-bold tracking-[0.2em] text-[#626765] uppercase block mb-3">
                OUR CAPABILITIES
              </span>
              <div className="h-0.5 w-12 bg-[#F1F52E]" />
            </div>

            <div className="space-y-3">
              <h3 className="text-3xl sm:text-4xl lg:text-[42px] font-black tracking-tight text-[#111111] uppercase leading-none">
                Precision Science
              </h3>
              <p className="text-sm sm:text-base text-[#626765] leading-relaxed">
                Seamless astronomical conversions from UTC ISO-8601 to Terrestrial Time (TT) and Barycentric Dynamical Time (TDB). Evaluates 3D lunar coordinate frames with IAU/IAG Moon Mean Earth datum accuracy.
              </p>
            </div>

            <div className="space-y-3">
              <h3 className="text-3xl sm:text-4xl lg:text-[42px] font-black tracking-tight text-[#111111] uppercase leading-none">
                Mission Intelligence
              </h3>
              <p className="text-sm sm:text-base text-[#626765] leading-relaxed">
                Rigorous Brent-Dekker bracketed root-finding for exact sunrise, sunset, earthrise, and earthset times to within Δt ≤ 5 seconds across 360° LOLA digital elevation horizons.
              </p>
            </div>

            <div className="space-y-3">
              <h3 className="text-3xl sm:text-4xl lg:text-[42px] font-black tracking-tight text-[#111111] uppercase leading-none">
                Scientific Confidence
              </h3>
              <p className="text-sm sm:text-base text-[#626765] leading-relaxed">
                Multi-Criteria Decision Analysis (MCDA) weighing solar duration, optical link availability, PSR volatile proximity, and slope gradient into transparent 100-point feasibility scores.
              </p>
            </div>

            <button
              type="button"
              onClick={() => onNavigateTab('comparison')}
              className="self-start inline-flex items-center gap-3 px-7 py-3.5 bg-[#111111] text-[#F7F7F3] font-mono text-xs font-bold tracking-wider uppercase hover:bg-[#F1F52E] hover:text-[#111111] transition-colors"
            >
              <span>RUN TRADE-STUDY COMPARISON</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION D — COMMUNITY / MISSION CONTEXT (Full-Width Monochrome Editorial)
          ========================================================================= */}
      <section className="relative w-full min-h-[580px] lg:min-h-[680px] bg-[#111111] text-[#F7F7F3] flex items-center justify-center p-8 sm:p-14 overflow-hidden border-b border-[#2D2D2D]">
        <div className="absolute inset-0 z-0">
          <Image
            src="/images/community_team.jpg"
            alt="Aerospace scientists and mission planners collaborating around lunar visualization"
            fill
            sizes="100vw"
            className="object-cover object-center grayscale contrast-125 brightness-[0.7]"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#111111]/90 via-[#111111]/60 to-[#111111]/90" />
        </div>

        <div className="relative z-10 max-w-4xl text-center flex flex-col items-center">
          <div className="inline-flex items-center gap-2 mb-4 bg-[#111111] border border-[#2D2D2D] px-3 py-1">
            <span className="w-2 h-2 bg-[#F1F52E]" />
            <span className="text-[11px] font-mono font-bold tracking-[0.2em] text-[#EAE9E4] uppercase">
              NASA SPACE APPS CHALLENGE / MISSION PLANNING
            </span>
          </div>

          <h2 className="text-4xl sm:text-6xl md:text-7xl lg:text-[84px] font-black tracking-[-0.04em] leading-[0.92] uppercase text-[#F7F7F3] mb-8">
            Built For The Next<br />Lunar Mission.
          </h2>

          <p className="max-w-2xl text-base sm:text-xl text-[#B7B5AD] leading-relaxed mb-10">
            Conceived as an operational decision-support tool for aerospace engineers, planetary geologists, and commercial lander teams evaluating the 13 candidate Artemis III landing zones.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4">
            <button
              type="button"
              onClick={() => onNavigateTab('mission-planner')}
              className="px-8 py-4 bg-[#F1F52E] text-[#111111] font-mono text-xs font-bold tracking-wider uppercase hover:bg-[#FFFFFF] transition-colors"
            >
              LAUNCH SIMULATOR SUITE
            </button>
            <button
              type="button"
              onClick={() => onNavigateTab('moon-trek')}
              className="px-7 py-4 border border-[#898B89] text-[#F7F7F3] font-mono text-xs font-bold tracking-wider uppercase hover:border-[#F1F52E] hover:text-[#F1F52E] transition-colors"
            >
              EXPLORE MOON TREK GIS
            </button>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION E — SCIENTIFIC DATA AND PROVENANCE (Open Magazine Book Spread)
          ========================================================================= */}
      <section className="max-w-[1500px] mx-auto px-6 md:px-12 py-24 sm:py-32 border-b border-[#D7D5CE]">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-14 bg-[#FFFFFF] border border-[#D7D5CE] p-8 sm:p-12 md:p-16">
          {/* Left Spread: Scientific Photograph */}
          <div className="relative aspect-[4/3] lg:aspect-auto lg:h-full min-h-[380px] bg-[#111111] border border-[#111111]">
            <Image
              src="/images/provenance_book.jpg"
              alt="Planetary geologist in laboratory examining lunar altimetry and ephemeris"
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover object-center grayscale contrast-125"
              referrerPolicy="no-referrer"
            />
            <div className="absolute top-4 left-4 bg-[#111111]/95 text-[#F7F7F3] font-mono text-[11px] px-2.5 py-1">
              PROVENANCE ARCHIVE · PDS-2026
            </div>
          </div>

          {/* Right Spread: Scientific Editorial Copy & Attribution */}
          <div className="flex flex-col justify-between space-y-8">
            <div>
              <div className="inline-flex items-center gap-2 mb-3">
                <span className="w-2 h-2 bg-[#F1F52E] border border-[#111111]" />
                <span className="text-xs font-mono font-bold tracking-[0.2em] text-[#5C5C56] uppercase">
                  SCIENCE BEHIND THE MISSION
                </span>
              </div>

              <h3 className="text-3xl sm:text-5xl font-black tracking-tight text-[#111111] uppercase leading-none mb-6">
                Evidence Before Exploration.
              </h3>

              <p className="text-sm sm:text-base text-[#202020] leading-relaxed mb-6">
                Every calculation within Project Selene is grounded in verifiable peer-reviewed datasets published by NASA Goddard Space Flight Center, the Lunar Reconnaissance Orbiter (LRO) science team, and the Jet Propulsion Laboratory (JPL).
              </p>

              {/* Dataset Registry Table */}
              <div className="divide-y divide-[#EAE9E4] border-t border-b border-[#D4D3CC]">
                <div className="py-3 flex items-center justify-between text-xs gap-3">
                  <span className="font-mono font-bold text-[#111111]">JPL HORIZONS / DE441</span>
                  <span className="font-mono text-[#5C5C56]">Ephemeris & Coordinates</span>
                  <span className="font-mono text-[#186E3C] flex items-center gap-1 font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5" /> VERIFIED
                  </span>
                </div>
                <div className="py-3 flex items-center justify-between text-xs gap-3">
                  <span className="font-mono font-bold text-[#111111]">LOLA DEM 80S (5M)</span>
                  <span className="font-mono text-[#5C5C56]">South Polar Topography</span>
                  <span className="font-mono text-[#186E3C] flex items-center gap-1 font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5" /> VERIFIED
                  </span>
                </div>
                <div className="py-3 flex items-center justify-between text-xs gap-3">
                  <span className="font-mono font-bold text-[#111111]">DIVINER RADIOMETER</span>
                  <span className="font-mono text-[#5C5C56]">Bolometric Thermal Model</span>
                  <span className="font-mono text-[#186E3C] flex items-center gap-1 font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5" /> VERIFIED
                  </span>
                </div>
                <div className="py-3 flex items-center justify-between text-xs gap-3">
                  <span className="font-mono font-bold text-[#111111]">LEND / LCROSS</span>
                  <span className="font-mono text-[#5C5C56]">Water-Ice Equivalent H₂</span>
                  <span className="font-mono text-[#186E3C] flex items-center gap-1 font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5" /> VERIFIED
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 font-mono text-[11px] text-[#5C5C56]">
              <span>SPATIAL COVERAGE: 80°S TO 90°S</span>
              <button
                type="button"
                onClick={() => onNavigateTab('data-science')}
                className="font-bold text-[#111111] hover:text-[#006B82] flex items-center gap-1"
              >
                <span>INSPECT PROVENANCE</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION F — SIGNATURE ELECTRIC-YELLOW SECTION (Massive #F1F52E Background)
          ========================================================================= */}
      <section className="w-full bg-[#F1F52E] text-[#111111] py-24 sm:py-36 px-6 md:px-14 border-b border-[#111111]">
        <div className="max-w-[1500px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          {/* Left Column: Massive Headline + Editorial Copy */}
          <div className="lg:col-span-8 flex flex-col justify-center">
            <div className="text-xs font-mono font-black tracking-[0.25em] text-[#111111] uppercase mb-4">
              OPERATIONAL MISSION DECISION ENGINE
            </div>

            <h2 className="text-5xl sm:text-7xl md:text-8xl lg:text-[104px] xl:text-[120px] font-black tracking-[-0.04em] leading-[0.88] text-[#111111] uppercase mb-8">
              Intelligence<br />For The Next<br />Lunar Frontier.
            </h2>

            <p className="max-w-2xl text-lg sm:text-2xl text-[#111111] font-semibold leading-snug mb-10">
              Transform raw scientific observations into confident mission decisions. Evaluate candidate Artemis landing sites with a unified understanding of sunlight, terrain hazards, and direct-to-Earth communication links.
            </p>

            <div className="flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={() => onNavigateTab('mission-planner')}
                className="px-10 py-5 bg-[#111111] text-[#F7F7F3] font-mono text-xs font-black tracking-[0.14em] uppercase hover:bg-[#FFFFFF] hover:text-[#111111] transition-colors shadow-2xl"
              >
                START PLANNING
              </button>

              <button
                type="button"
                onClick={() => onNavigateTab('comparison')}
                className="px-8 py-5 border-2 border-[#111111] text-[#111111] font-mono text-xs font-black tracking-[0.14em] uppercase hover:bg-[#111111] hover:text-[#F1F52E] transition-colors"
              >
                COMPARE 4 SITES
              </button>
            </div>
          </div>

          {/* Right Column: Authentic Lunar South Pole Crater Rim Plate */}
          <div className="lg:col-span-4 relative aspect-[4/3] lg:aspect-[3/4] w-full max-w-md mx-auto overflow-hidden bg-[#111111] border-2 border-[#111111]">
            <Image
              src="/images/hero_crater_rim_1794306134201.jpg"
              alt="Shackleton Crater rim illuminated by grazing polar sunlight with Earth crescent in the lunar sky"
              fill
              sizes="(max-width: 1024px) 100vw, 33vw"
              className="object-cover object-center contrast-115"
              referrerPolicy="no-referrer"
            />
            <div className="absolute bottom-3 left-3 bg-[#111111] text-[#F1F52E] font-mono text-[11px] font-bold px-2.5 py-1">
              SHACKLETON CRATER RIM · SOUTH POLE TRAVERSE
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION G — FOOTER (Crisp Charcoal #111318 separating from Section F)
          ========================================================================= */}
      <footer className="w-full bg-[#111318] text-[#F3EEE3] px-6 md:px-14 pt-16 pb-20">
        <div className="max-w-[1500px] mx-auto">
          {/* Top Row: Brand & Mission Statement */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 pb-16 border-b border-[#2B303B]">
            <div className="lg:col-span-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 bg-[#111111] border border-[#F1F52E] text-[#F1F52E] font-black text-xs flex items-center justify-center">
                  NL
                </div>
                <span className="text-xl md:text-2xl font-black tracking-tight uppercase">
                  LUNAR LANDING NAVIGATOR
                </span>
              </div>
              <p className="max-w-md text-sm text-[#C8C4BA] font-normal leading-relaxed">
                A high-contrast editorial space exploration platform and decision-support instrument built for lunar South Pole landing site evaluation. Powered by JPL Horizons DE441 and LOLA 5-meter topography.
              </p>
            </div>

            {/* Quick Links */}
            <div className="lg:col-span-3 font-mono text-xs space-y-3">
              <div className="font-bold text-[#F1F52E] uppercase tracking-wider mb-4">
                WORKSPACES
              </div>
              <div>
                <a
                  href="#explorer"
                  onClick={(e) => {
                    e.preventDefault();
                    onNavigateTab('explorer');
                  }}
                  className="text-[#F3EEE3] hover:text-[#F1F52E] font-bold"
                >
                  01 · 3D LUNAR EXPLORER
                </a>
              </div>
              <div>
                <a
                  href="#site-analysis"
                  onClick={(e) => {
                    e.preventDefault();
                    onNavigateTab('site-analysis');
                  }}
                  className="text-[#F3EEE3] hover:text-[#F1F52E] font-bold"
                >
                  02 · SITE HORIZON INTELLIGENCE
                </a>
              </div>
              <div>
                <a
                  href="#simulator"
                  onClick={(e) => {
                    e.preventDefault();
                    onNavigateTab('simulator');
                  }}
                  className="text-[#F3EEE3] hover:text-[#F1F52E] font-bold"
                >
                  03 · MISSION SIMULATOR
                </a>
              </div>
              <div>
                <a
                  href="#comparison"
                  onClick={(e) => {
                    e.preventDefault();
                    onNavigateTab('comparison');
                  }}
                  className="text-[#F3EEE3] hover:text-[#F1F52E] font-bold"
                >
                  04 · SCENARIO COMPARISON
                </a>
              </div>
              <div>
                <a
                  href="#moon-trek"
                  onClick={(e) => {
                    e.preventDefault();
                    onNavigateTab('moon-trek');
                  }}
                  className="text-[#F3EEE3] hover:text-[#F1F52E] font-bold"
                >
                  05 · NASA MOON TREK GIS
                </a>
              </div>
            </div>

            <div className="lg:col-span-3 font-mono text-xs space-y-3 text-[#C8C4BA]">
              <div className="font-bold text-[#F1F52E] uppercase tracking-wider mb-4">
                PROVENANCE & DATA
              </div>
              <div>NASA GSFC LRO LOLA PDS Node</div>
              <div>NASA JPL Horizons SSD REST API</div>
              <div>IAU/IAG Cartographic Coordinates (MOON_ME)</div>
              <div>USGS Astrogeology Science Center</div>
              <div className="pt-2 text-[11px] text-[#9BA1AE]">
                COORDINATES: SOUTH POLE 80°S TO 90°S
              </div>
            </div>
          </div>

          {/* Bottom Row: Attribution & Real App Routes */}
          <div className="pt-8 flex flex-col sm:flex-row items-center justify-between text-xs font-mono text-[#9BA1AE] gap-4">
            <div>
              2026 NASA LUNAR LANDING NAVIGATOR · SPACE APPS CHALLENGE
            </div>
            <div className="flex flex-wrap items-center gap-6">
              <button
                type="button"
                onClick={() => onNavigateTab('data-science')}
                className="text-[#F3EEE3] hover:text-[#F1F52E] underline"
              >
                DATA PROVENANCE
              </button>
              <button
                type="button"
                onClick={() => onNavigateTab('lunar-bases')}
                className="text-[#F3EEE3] hover:text-[#F1F52E] underline"
              >
                LUNAR BASES REGISTRY
              </button>
              <button
                type="button"
                onClick={() => onNavigateTab('settings')}
                className="text-[#F3EEE3] hover:text-[#F1F52E] underline"
              >
                CONSTRAINTS & SETTINGS
              </button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
