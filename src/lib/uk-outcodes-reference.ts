/**
 * UK Postcode Outcode Reference
 *
 * Curated set of high-density UK outcodes with population + region
 * metadata. Used by the locksmith recruitment recommender to identify
 * uncovered districts worth pursuing.
 *
 * Not exhaustive — we focus on outcodes large enough to support a
 * locksmith on emergency-call volume (population > ~20k in the
 * outcode's catchment, or major commuter-belt outcodes that punch
 * above population weight).
 *
 * Population numbers are 2021 census-level ESTIMATES for the postcode
 * outcode's main settlement — order-of-magnitude only. Used purely
 * as a demand proxy when ranking uncovered districts; never displayed
 * to end users as authoritative statistics.
 *
 * Region tags align with the recommender's strategic-fit modifier —
 * "commuter_belt" outcodes get a +10% boost because the anti-shark
 * thesis lands hardest there (high-earning residents, recurring
 * landlord work, low tolerance for £600 invoices).
 */

export type UkRegion =
  | "london"
  | "commuter_belt"   // M25 ring + Reading/Oxford/Cambridge corridor
  | "north_west"      // Manchester, Liverpool, Lancashire
  | "north_east"      // Newcastle, Durham, Yorkshire
  | "midlands"        // Birmingham, Leicester, Nottingham, Stoke
  | "south_west"      // Bristol, Cardiff (yes, Wales — close enough), Exeter
  | "south_east"      // Brighton, Southampton, Portsmouth, Kent
  | "scotland"        // Glasgow, Edinburgh, Aberdeen
  | "wales"           // Cardiff, Swansea
  | "northern_ireland"; // Belfast

export interface OutcodeReference {
  outcode:           string;        // e.g. "M1", "RG1", "SW1A"
  primaryCity:       string;        // human-readable settlement
  region:            UkRegion;
  populationEst:     number;        // outcode catchment, order-of-magnitude
  /**
   * Approximate centroid lat/lng — used by the recommender to figure out
   * which existing locksmith is closest (so we know if a quick coverage-
   * radius bump can absorb the district rather than a new hire).
   */
  lat:               number;
  lng:               number;
}

/**
 * Curated reference set — ~80 UK outcodes that cover the major
 * locksmith-relevant markets. Sorted alphabetically by outcode for
 * easier scanning during audits.
 */
export const UK_OUTCODES: OutcodeReference[] = [
  // ── Birmingham & West Midlands ────────────────────────────────────────
  { outcode: "B1",   primaryCity: "Birmingham (centre)",  region: "midlands",       populationEst: 25000, lat: 52.4751, lng: -1.9090 },
  { outcode: "B5",   primaryCity: "Birmingham (south)",   region: "midlands",       populationEst: 35000, lat: 52.4690, lng: -1.8920 },
  { outcode: "B15",  primaryCity: "Edgbaston",            region: "midlands",       populationEst: 30000, lat: 52.4660, lng: -1.9290 },
  { outcode: "B29",  primaryCity: "Selly Oak",            region: "midlands",       populationEst: 45000, lat: 52.4350, lng: -1.9410 },
  { outcode: "CV1",  primaryCity: "Coventry",             region: "midlands",       populationEst: 22000, lat: 52.4070, lng: -1.5180 },

  // ── Bristol & SW ──────────────────────────────────────────────────────
  { outcode: "BS1",  primaryCity: "Bristol (centre)",     region: "south_west",     populationEst: 14000, lat: 51.4545, lng: -2.5879 },
  { outcode: "BS8",  primaryCity: "Bristol (Clifton)",    region: "south_west",     populationEst: 25000, lat: 51.4590, lng: -2.6100 },
  { outcode: "EX1",  primaryCity: "Exeter",               region: "south_west",     populationEst: 28000, lat: 50.7250, lng: -3.5260 },
  { outcode: "PL1",  primaryCity: "Plymouth",             region: "south_west",     populationEst: 18000, lat: 50.3720, lng: -4.1430 },

  // ── Cambridge / Oxford / Reading commuter belt ────────────────────────
  { outcode: "CB1",  primaryCity: "Cambridge",            region: "commuter_belt",  populationEst: 30000, lat: 52.2010, lng:  0.1310 },
  { outcode: "OX1",  primaryCity: "Oxford",               region: "commuter_belt",  populationEst: 14000, lat: 51.7520, lng: -1.2570 },
  { outcode: "OX4",  primaryCity: "Oxford (Cowley)",      region: "commuter_belt",  populationEst: 35000, lat: 51.7400, lng: -1.2200 },
  { outcode: "RG1",  primaryCity: "Reading (centre)",     region: "commuter_belt",  populationEst: 35000, lat: 51.4570, lng: -0.9710 },
  { outcode: "RG30", primaryCity: "Reading (west)",       region: "commuter_belt",  populationEst: 25000, lat: 51.4500, lng: -1.0200 },
  { outcode: "GU1",  primaryCity: "Guildford",            region: "commuter_belt",  populationEst: 28000, lat: 51.2360, lng: -0.5700 },
  { outcode: "GU14", primaryCity: "Farnborough",          region: "commuter_belt",  populationEst: 45000, lat: 51.2880, lng: -0.7530 },
  { outcode: "GU25", primaryCity: "Virginia Water",       region: "commuter_belt",  populationEst: 5500,  lat: 51.4070, lng: -0.5610 },

  // ── Cardiff & Wales ───────────────────────────────────────────────────
  { outcode: "CF10", primaryCity: "Cardiff",              region: "wales",          populationEst: 12000, lat: 51.4810, lng: -3.1790 },
  { outcode: "CF24", primaryCity: "Cardiff (east)",       region: "wales",          populationEst: 22000, lat: 51.4900, lng: -3.1640 },
  { outcode: "SA1",  primaryCity: "Swansea",              region: "wales",          populationEst: 18000, lat: 51.6210, lng: -3.9430 },

  // ── Edinburgh & Scotland ──────────────────────────────────────────────
  { outcode: "EH1",  primaryCity: "Edinburgh (Old Town)", region: "scotland",       populationEst: 12000, lat: 55.9540, lng: -3.1880 },
  { outcode: "EH3",  primaryCity: "Edinburgh (centre)",   region: "scotland",       populationEst: 18000, lat: 55.9580, lng: -3.2090 },
  { outcode: "EH8",  primaryCity: "Edinburgh (south)",    region: "scotland",       populationEst: 22000, lat: 55.9430, lng: -3.1740 },
  { outcode: "G1",   primaryCity: "Glasgow (centre)",     region: "scotland",       populationEst: 11000, lat: 55.8610, lng: -4.2510 },
  { outcode: "G2",   primaryCity: "Glasgow (Cowcaddens)", region: "scotland",       populationEst: 9000,  lat: 55.8650, lng: -4.2550 },
  { outcode: "G12",  primaryCity: "Glasgow (West End)",   region: "scotland",       populationEst: 25000, lat: 55.8780, lng: -4.2950 },
  { outcode: "AB10", primaryCity: "Aberdeen",             region: "scotland",       populationEst: 28000, lat: 57.1430, lng: -2.0980 },

  // ── Hull & Yorkshire ──────────────────────────────────────────────────
  { outcode: "HU1",  primaryCity: "Hull (centre)",        region: "north_east",     populationEst: 11000, lat: 53.7440, lng: -0.3320 },
  { outcode: "HU3",  primaryCity: "Hull (west)",          region: "north_east",     populationEst: 35000, lat: 53.7480, lng: -0.3680 },
  { outcode: "YO1",  primaryCity: "York (centre)",        region: "north_east",     populationEst: 13000, lat: 53.9590, lng: -1.0810 },
  { outcode: "S1",   primaryCity: "Sheffield (centre)",   region: "north_east",     populationEst: 16000, lat: 53.3810, lng: -1.4700 },
  { outcode: "S10",  primaryCity: "Sheffield (west)",     region: "north_east",     populationEst: 30000, lat: 53.3700, lng: -1.5100 },
  { outcode: "LS1",  primaryCity: "Leeds (centre)",       region: "north_east",     populationEst: 14000, lat: 53.7970, lng: -1.5430 },
  { outcode: "LS6",  primaryCity: "Leeds (Headingley)",   region: "north_east",     populationEst: 32000, lat: 53.8190, lng: -1.5790 },
  { outcode: "NE1",  primaryCity: "Newcastle (centre)",   region: "north_east",     populationEst: 9000,  lat: 54.9700, lng: -1.6130 },
  { outcode: "NE2",  primaryCity: "Newcastle (Jesmond)",  region: "north_east",     populationEst: 25000, lat: 54.9900, lng: -1.5990 },
  { outcode: "DH1",  primaryCity: "Durham",               region: "north_east",     populationEst: 32000, lat: 54.7770, lng: -1.5750 },

  // ── Kent / Sussex ─────────────────────────────────────────────────────
  { outcode: "CT1",  primaryCity: "Canterbury",           region: "south_east",     populationEst: 30000, lat: 51.2790, lng:  1.0800 },
  { outcode: "ME4",  primaryCity: "Chatham",              region: "south_east",     populationEst: 38000, lat: 51.3810, lng:  0.5210 },
  { outcode: "TN1",  primaryCity: "Tunbridge Wells",      region: "south_east",     populationEst: 28000, lat: 51.1330, lng:  0.2630 },
  { outcode: "BN1",  primaryCity: "Brighton",             region: "south_east",     populationEst: 38000, lat: 50.8240, lng: -0.1420 },
  { outcode: "BN2",  primaryCity: "Brighton (Kemptown)",  region: "south_east",     populationEst: 35000, lat: 50.8180, lng: -0.1110 },
  { outcode: "PO1",  primaryCity: "Portsmouth",           region: "south_east",     populationEst: 18000, lat: 50.8030, lng: -1.0870 },
  { outcode: "SO14", primaryCity: "Southampton",          region: "south_east",     populationEst: 22000, lat: 50.9020, lng: -1.4020 },
  { outcode: "KT13", primaryCity: "Weybridge",            region: "commuter_belt",  populationEst: 22000, lat: 51.3700, lng: -0.4570 },
  { outcode: "KT15", primaryCity: "Addlestone",           region: "commuter_belt",  populationEst: 16000, lat: 51.3700, lng: -0.4960 },
  { outcode: "KT16", primaryCity: "Chertsey",             region: "commuter_belt",  populationEst: 14000, lat: 51.3870, lng: -0.5070 },

  // ── Leicester / Nottingham / East Midlands ────────────────────────────
  { outcode: "LE1",  primaryCity: "Leicester (centre)",   region: "midlands",       populationEst: 14000, lat: 52.6360, lng: -1.1320 },
  { outcode: "NG1",  primaryCity: "Nottingham (centre)",  region: "midlands",       populationEst: 11000, lat: 52.9540, lng: -1.1480 },
  { outcode: "NG7",  primaryCity: "Nottingham (west)",    region: "midlands",       populationEst: 32000, lat: 52.9430, lng: -1.1860 },
  { outcode: "DE1",  primaryCity: "Derby (centre)",       region: "midlands",       populationEst: 13000, lat: 52.9230, lng: -1.4780 },
  { outcode: "ST1",  primaryCity: "Stoke-on-Trent",       region: "midlands",       populationEst: 19000, lat: 53.0030, lng: -2.1840 },

  // ── Liverpool ─────────────────────────────────────────────────────────
  { outcode: "L1",   primaryCity: "Liverpool (centre)",   region: "north_west",     populationEst: 14000, lat: 53.4080, lng: -2.9810 },
  { outcode: "L8",   primaryCity: "Liverpool (Toxteth)",  region: "north_west",     populationEst: 32000, lat: 53.3870, lng: -2.9540 },
  { outcode: "L15",  primaryCity: "Liverpool (Wavertree)",region: "north_west",     populationEst: 28000, lat: 53.3950, lng: -2.9090 },

  // ── London (extensive — 40+ outcodes; here we pick the locksmith-hot ones) ─
  { outcode: "E1",   primaryCity: "London (Whitechapel)", region: "london",         populationEst: 45000, lat: 51.5170, lng: -0.0590 },
  { outcode: "E14",  primaryCity: "London (Canary Wharf)",region: "london",         populationEst: 35000, lat: 51.5050, lng: -0.0190 },
  { outcode: "EC1A", primaryCity: "London (City)",        region: "london",         populationEst: 12000, lat: 51.5180, lng: -0.1020 },
  { outcode: "N1",   primaryCity: "London (Islington)",   region: "london",         populationEst: 50000, lat: 51.5380, lng: -0.1030 },
  { outcode: "N4",   primaryCity: "London (Finsbury Park)",region: "london",        populationEst: 45000, lat: 51.5700, lng: -0.1020 },
  { outcode: "NW1",  primaryCity: "London (Camden)",      region: "london",         populationEst: 40000, lat: 51.5300, lng: -0.1450 },
  { outcode: "NW3",  primaryCity: "London (Hampstead)",   region: "london",         populationEst: 35000, lat: 51.5580, lng: -0.1780 },
  { outcode: "SE1",  primaryCity: "London (Southwark)",   region: "london",         populationEst: 30000, lat: 51.5030, lng: -0.0860 },
  { outcode: "SE15", primaryCity: "London (Peckham)",     region: "london",         populationEst: 50000, lat: 51.4730, lng: -0.0680 },
  { outcode: "SW1A", primaryCity: "London (Westminster)", region: "london",         populationEst: 8000,  lat: 51.4990, lng: -0.1240 },
  { outcode: "SW4",  primaryCity: "London (Clapham)",     region: "london",         populationEst: 38000, lat: 51.4640, lng: -0.1410 },
  { outcode: "SW11", primaryCity: "London (Battersea)",   region: "london",         populationEst: 48000, lat: 51.4760, lng: -0.1660 },
  { outcode: "W1",   primaryCity: "London (Mayfair)",     region: "london",         populationEst: 18000, lat: 51.5170, lng: -0.1430 },
  { outcode: "W2",   primaryCity: "London (Paddington)",  region: "london",         populationEst: 35000, lat: 51.5170, lng: -0.1820 },
  { outcode: "W14",  primaryCity: "London (West Ken)",    region: "london",         populationEst: 22000, lat: 51.4900, lng: -0.2050 },

  // ── Manchester ────────────────────────────────────────────────────────
  { outcode: "M1",   primaryCity: "Manchester (centre)",  region: "north_west",     populationEst: 16000, lat: 53.4790, lng: -2.2390 },
  { outcode: "M4",   primaryCity: "Manchester (NQ)",      region: "north_west",     populationEst: 15000, lat: 53.4870, lng: -2.2330 },
  { outcode: "M14",  primaryCity: "Manchester (Fallowfield)",region: "north_west",  populationEst: 38000, lat: 53.4450, lng: -2.2140 },
  { outcode: "M20",  primaryCity: "Manchester (Didsbury)",region: "north_west",     populationEst: 30000, lat: 53.4180, lng: -2.2310 },
  { outcode: "SK1",  primaryCity: "Stockport (centre)",   region: "north_west",     populationEst: 18000, lat: 53.4090, lng: -2.1490 },
  { outcode: "SK4",  primaryCity: "Stockport (Heaton)",   region: "north_west",     populationEst: 28000, lat: 53.4220, lng: -2.1810 },
  { outcode: "BL1",  primaryCity: "Bolton",               region: "north_west",     populationEst: 32000, lat: 53.5800, lng: -2.4290 },
  { outcode: "PR1",  primaryCity: "Preston",              region: "north_west",     populationEst: 14000, lat: 53.7600, lng: -2.7000 },

  // ── Northern Ireland ──────────────────────────────────────────────────
  { outcode: "BT1",  primaryCity: "Belfast (centre)",     region: "northern_ireland", populationEst: 6000,  lat: 54.5990, lng: -5.9290 },
  { outcode: "BT7",  primaryCity: "Belfast (south)",      region: "northern_ireland", populationEst: 28000, lat: 54.5780, lng: -5.9230 },
];

/** Quick index by outcode for lookups. */
export const UK_OUTCODES_BY_CODE: Map<string, OutcodeReference> = new Map(
  UK_OUTCODES.map((o) => [o.outcode.toUpperCase(), o]),
);

/**
 * Haversine distance between two lat/lng points in MILES. Used by the
 * recommender to detect "is any existing locksmith within commute
 * distance of this uncovered district?".
 */
export function haversineMiles(
  aLat: number, aLng: number,
  bLat: number, bLng: number,
): number {
  const R = 3958.8; // Earth radius in miles
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}
