'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Crosshair, MapPin, Menu, Search, X } from 'lucide-react';
import type { LandingSiteRecord } from '@/server/db/database';
import {
  GLOBAL_TOP_NAV_ITEMS,
  WORKSPACE_REGISTRY,
  type PrimaryWorkspaceId,
} from '@/lib/navigation/workspaceRegistry';

interface EditorialNavbarProps {
  activeTab: PrimaryWorkspaceId | string;
  onNavigate: (tab: string) => void;
  onOpenFlightBrief: () => void;
  flightBriefOpen?: boolean;
  darkOverlay?: boolean;
  sites?: LandingSiteRecord[];
  activeSiteId?: string;
  onSelectSite?: (siteId: string) => void;
}

export default function EditorialNavbar({
  activeTab,
  onNavigate,
  onOpenFlightBrief,
  flightBriefOpen = false,
  darkOverlay = true,
  sites = [],
  activeSiteId,
  onSelectSite,
}: EditorialNavbarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [highlightedIdx, setHighlightedIdx] = useState(0);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q || sites.length === 0) return [];
    return sites
      .filter((s) => {
        const haystack = [
          s.designation,
          s.name,
          s.crater_name,
          s.description,
          s.scientific_value,
          s.mission_category ?? '',
          s.region_tier ?? '',
        ]
          .join(' ')
          .toLowerCase();
        return haystack.includes(q);
      })
      .slice(0, 7);
  }, [searchQuery, sites]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(e.target as Node)
      ) {
        setSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNavClick = (id: string) => {
    onNavigate(id);
    setMobileMenuOpen(false);
  };

  const handleFlightBrief = () => {
    onOpenFlightBrief();
    setMobileMenuOpen(false);
  };

  const handleChooseSite = (site: LandingSiteRecord) => {
    onSelectSite?.(site.id);
    setSearchQuery('');
    setSearchOpen(false);
    setMobileMenuOpen(false);
    if (activeTab === 'home') {
      onNavigate('overview');
    }
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!searchOpen || searchResults.length === 0) {
      if (e.key === 'Escape') {
        setSearchOpen(false);
        setSearchQuery('');
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIdx((prev) => (prev + 1) % searchResults.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIdx((prev) => (prev - 1 + searchResults.length) % searchResults.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const target = searchResults[highlightedIdx] ?? searchResults[0];
      if (target) handleChooseSite(target);
    } else if (e.key === 'Escape') {
      setSearchOpen(false);
    }
  };

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-colors duration-150 ${
        darkOverlay
          ? 'bg-[#111318] border-b border-[#2B303B] text-[#F3EEE3]'
          : 'bg-[#F7F7F3] border-b border-[#D4D3CC] text-[#141413]'
      }`}
    >
      <div className="max-w-[1680px] mx-auto px-3 sm:px-5 lg:px-6 h-14 flex items-center justify-between gap-2.5">
        {/* Brand Wordmark */}
        <Link
          href="#home"
          onClick={(e) => {
            e.preventDefault();
            handleNavClick('home');
          }}
          className="flex items-center gap-2.5 cursor-pointer min-w-0 shrink-0"
        >
          <span className="w-7 h-7 bg-[#111111] border border-[#F1F52E] flex items-center justify-center font-mono font-black text-[11px] text-[#F1F52E] tracking-tight shrink-0">
            SL
          </span>
          <span className="font-extrabold text-xs sm:text-sm tracking-tight uppercase leading-none whitespace-nowrap">
            PROJECT SELENE
          </span>
        </Link>

        {/* Global Top Navigation (7 primary workspaces) */}
        <nav
          aria-label="Global Primary Navigation"
          className="hidden lg:flex items-center gap-0.5 xl:gap-1 min-w-0"
        >
          {GLOBAL_TOP_NAV_ITEMS.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <a
                key={item.id}
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                onClick={(e) => {
                  e.preventDefault();
                  handleNavClick(item.id);
                }}
                className={`px-2 xl:px-2.5 py-1.5 text-[11px] font-mono font-bold tracking-wider uppercase whitespace-nowrap shrink-0 transition-colors ${
                  isActive
                    ? darkOverlay
                      ? 'bg-[#F1F52E] text-[#111111]'
                      : 'bg-[#111111] text-[#F1F52E]'
                    : darkOverlay
                    ? 'text-[#C8C4BA] hover:text-[#F1F52E] hover:bg-[#171A21]'
                    : 'text-[#3A3A36] hover:text-[#141413] hover:bg-[#EEEDE8]'
                }`}
              >
                {item.label}
              </a>
            );
          })}
        </nav>

        {/* Global Landing Site Search Bar + Right Primary Action */}
        <div className="flex items-center gap-2 shrink-0 min-w-0">
          {onSelectSite && (
            <div ref={searchContainerRef} className="relative hidden sm:block w-44 md:w-52 xl:w-64">
              <Search
                className={`w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none ${
                  darkOverlay ? 'text-[#9BA1AE]' : 'text-[#5C5C56]'
                }`}
              />
              <input
                type="text"
                role="combobox"
                aria-expanded={searchOpen && searchResults.length > 0}
                aria-controls="selene-global-site-search-results"
                aria-label="Search landing sites by designation or scientific keywords"
                placeholder="Search site, crater, PSR..."
                value={searchQuery}
                onFocus={() => setSearchOpen(true)}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setSearchOpen(true);
                  setHighlightedIdx(0);
                }}
                onKeyDown={handleSearchKeyDown}
                className={`w-full pl-8 pr-7 py-1.5 text-[11px] font-mono border focus:outline-none transition-colors ${
                  darkOverlay
                    ? 'bg-[#171A21] border-[#2B303B] text-[#F3EEE3] placeholder:text-[#9BA1AE] focus:border-[#00E5FF]'
                    : 'bg-[#FFFFFF] border-[#D4D3CC] text-[#141413] placeholder:text-[#5C5C56] focus:border-[#006B82]'
                }`}
              />
              {searchQuery && (
                <button
                  type="button"
                  aria-label="Clear global site search"
                  onClick={() => {
                    setSearchQuery('');
                    setSearchOpen(false);
                  }}
                  className={`cursor-pointer absolute right-2 top-1/2 -translate-y-1/2 ${
                    darkOverlay
                      ? 'text-[#9BA1AE] hover:text-[#F3EEE3]'
                      : 'text-[#5C5C56] hover:text-[#141413]'
                  }`}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}

              {searchOpen && searchQuery.trim().length > 0 && (
                <div
                  id="selene-global-site-search-results"
                  role="listbox"
                  className={`absolute right-0 mt-1.5 w-80 sm:w-96 max-h-80 overflow-y-auto border shadow-xl z-50 ${
                    darkOverlay
                      ? 'bg-[#111318] border-[#2B303B] text-[#F3EEE3]'
                      : 'bg-[#FFFFFF] border-[#D4D3CC] text-[#141413]'
                  }`}
                >
                  {searchResults.length === 0 ? (
                    <div className="px-3.5 py-3 text-xs font-mono text-[#9BA1AE]">
                      No landing sites matched &ldquo;{searchQuery}&rdquo;.
                    </div>
                  ) : (
                    searchResults.map((site, idx) => {
                      const isActive = site.id === activeSiteId;
                      const isHighlighted = idx === highlightedIdx;
                      return (
                        <button
                          key={site.id}
                          type="button"
                          role="option"
                          aria-selected={isActive}
                          onMouseEnter={() => setHighlightedIdx(idx)}
                          onClick={() => handleChooseSite(site)}
                          className={`cursor-pointer w-full text-left px-3.5 py-2.5 border-b last:border-b-0 transition-colors ${
                            darkOverlay ? 'border-[#2B303B]' : 'border-[#D4D3CC]'
                          } ${
                            isHighlighted
                              ? darkOverlay
                                ? 'bg-[#171A21]'
                                : 'bg-[#EEEDE8]'
                              : ''
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 text-[10.5px] font-mono">
                            <span
                              className={`font-bold ${
                                darkOverlay ? 'text-[#00E5FF]' : 'text-[#006B82]'
                              }`}
                            >
                              {site.designation}
                            </span>
                            <span className="tabular-nums opacity-75">
                              {site.latitude < 0
                                ? `${Math.abs(site.latitude).toFixed(2)}°S`
                                : `${site.latitude.toFixed(2)}°N`}
                              , {site.longitude.toFixed(2)}°E
                            </span>
                          </div>
                          <div className="text-xs font-bold mt-0.5 flex items-center gap-1.5">
                            <MapPin className="w-3 h-3 text-[#D9541E] shrink-0" />
                            <span className="truncate">{site.name}</span>
                          </div>
                          <div className="text-[11px] opacity-75 line-clamp-1 mt-0.5">
                            {site.scientific_value}
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={handleFlightBrief}
            aria-expanded={flightBriefOpen}
            aria-controls="selene-flight-brief-drawer"
            className={`cursor-pointer hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] xl:text-xs font-mono font-bold tracking-wider uppercase whitespace-nowrap shrink-0 border transition-colors ${
              flightBriefOpen
                ? 'bg-[#F1F52E] border-[#F1F52E] text-[#111111]'
                : darkOverlay
                ? 'border-[#F1F52E] text-[#F1F52E] bg-transparent hover:bg-[#F1F52E] hover:text-[#111111]'
                : 'border-[#111111] bg-[#111111] text-[#F1F52E] hover:bg-[#2A2A27]'
            }`}
          >
            <Crosshair className="w-3.5 h-3.5 shrink-0" />
            <span>Flight Brief</span>
          </button>

          <button
            type="button"
            aria-expanded={mobileMenuOpen}
            aria-controls="selene-mobile-drawer"
            aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className={`cursor-pointer lg:hidden p-2 border transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center ${
              darkOverlay
                ? 'border-[#2B303B] bg-[#171A21] text-[#F3EEE3]'
                : 'border-[#D4D3CC] bg-[#FFFFFF] text-[#141413]'
            }`}
          >
            {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Mobile & Compact Tablet Drawer */}
      {mobileMenuOpen && (
        <nav
          id="selene-mobile-drawer"
          aria-label="Mobile Navigation"
          className={`lg:hidden border-t px-3 py-3 max-h-[calc(100vh-3.5rem)] overflow-y-auto space-y-2.5 ${
            darkOverlay
              ? 'bg-[#111318] border-[#2B303B] text-[#F3EEE3]'
              : 'bg-[#F7F7F3] border-[#D4D3CC] text-[#141413]'
          }`}
        >
          {onSelectSite && (
            <div className="sm:hidden space-y-1.5">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-[#9BA1AE] absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  aria-label="Mobile search landing sites"
                  placeholder="Search site designation or keywords..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={`w-full pl-8 pr-3 py-2 text-xs font-mono border ${
                    darkOverlay
                      ? 'bg-[#171A21] border-[#2B303B] text-[#F3EEE3]'
                      : 'bg-[#FFFFFF] border-[#D4D3CC] text-[#141413]'
                  }`}
                />
              </div>
              {searchQuery.trim().length > 0 && searchResults.length > 0 && (
                <div className="border border-[#2B303B] divide-y divide-[#2B303B]">
                  {searchResults.slice(0, 4).map((site) => (
                    <button
                      key={site.id}
                      type="button"
                      onClick={() => handleChooseSite(site)}
                      className="w-full text-left px-3 py-2 text-xs font-mono"
                    >
                      <span className="text-[#00E5FF] font-bold mr-2">{site.designation}</span>
                      <span>{site.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            <a
              href="#home"
              onClick={(e) => {
                e.preventDefault();
                handleNavClick('home');
              }}
              className={`px-3 py-2.5 text-xs font-mono font-bold uppercase tracking-wider border transition-colors ${
                activeTab === 'home'
                  ? darkOverlay
                    ? 'bg-[#F1F52E] border-[#F1F52E] text-[#111111]'
                    : 'bg-[#111111] border-[#111111] text-[#F1F52E]'
                  : darkOverlay
                  ? 'bg-[#171A21] border-[#2B303B] text-[#F3EEE3]'
                  : 'bg-[#FFFFFF] border-[#D4D3CC] text-[#141413]'
              }`}
            >
              00 · Editorial Home
            </a>
            {GLOBAL_TOP_NAV_ITEMS.map((item) => {
              const isActive = activeTab === item.id;
              const code = WORKSPACE_REGISTRY[item.id].code;
              return (
                <a
                  key={item.id}
                  href={item.href}
                  onClick={(e) => {
                    e.preventDefault();
                    handleNavClick(item.id);
                  }}
                  className={`px-3 py-2.5 text-xs font-mono font-bold uppercase tracking-wider border transition-colors ${
                    isActive
                      ? darkOverlay
                        ? 'bg-[#F1F52E] border-[#F1F52E] text-[#111111]'
                        : 'bg-[#111111] border-[#111111] text-[#F1F52E]'
                      : darkOverlay
                      ? 'bg-[#171A21] border-[#2B303B] text-[#F3EEE3]'
                      : 'bg-[#FFFFFF] border-[#D4D3CC] text-[#141413]'
                  }`}
                >
                  {code} · {item.label}
                </a>
              );
            })}
            <button
              type="button"
              onClick={handleFlightBrief}
              className={`sm:col-span-2 px-3 py-2.5 text-xs font-mono font-bold uppercase tracking-wider border text-left flex items-center gap-2 ${
                darkOverlay
                  ? 'border-[#F1F52E] text-[#F1F52E] bg-[#171A21]'
                  : 'border-[#111111] bg-[#111111] text-[#F1F52E]'
              }`}
            >
              <Crosshair className="w-3.5 h-3.5" />
              <span>Flight Brief &amp; Constraints</span>
            </button>
          </div>
        </nav>
      )}
    </header>
  );
}
