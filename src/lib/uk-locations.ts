/**
 * Lightweight UK town/city → county + postcode-area lookup for form
 * auto-complete (Manual Lead Scraper). Built-in + offline — no external API.
 * `pc` is the postcode AREA (outward letters), a sensible scraping prefix.
 */

export interface UkPlace {
  county: string;
  pc: string;
}

// Keyed by lowercased city/town name.
export const UK_PLACES: Record<string, UkPlace> = {
  // England — major cities
  london: { county: "Greater London", pc: "EC" },
  birmingham: { county: "West Midlands", pc: "B" },
  manchester: { county: "Greater Manchester", pc: "M" },
  liverpool: { county: "Merseyside", pc: "L" },
  leeds: { county: "West Yorkshire", pc: "LS" },
  sheffield: { county: "South Yorkshire", pc: "S" },
  bristol: { county: "Bristol", pc: "BS" },
  newcastle: { county: "Tyne and Wear", pc: "NE" },
  "newcastle upon tyne": { county: "Tyne and Wear", pc: "NE" },
  nottingham: { county: "Nottinghamshire", pc: "NG" },
  leicester: { county: "Leicestershire", pc: "LE" },
  coventry: { county: "West Midlands", pc: "CV" },
  bradford: { county: "West Yorkshire", pc: "BD" },
  stoke: { county: "Staffordshire", pc: "ST" },
  "stoke-on-trent": { county: "Staffordshire", pc: "ST" },
  wolverhampton: { county: "West Midlands", pc: "WV" },
  plymouth: { county: "Devon", pc: "PL" },
  derby: { county: "Derbyshire", pc: "DE" },
  southampton: { county: "Hampshire", pc: "SO" },
  portsmouth: { county: "Hampshire", pc: "PO" },
  brighton: { county: "East Sussex", pc: "BN" },
  "brighton and hove": { county: "East Sussex", pc: "BN" },
  hull: { county: "East Riding of Yorkshire", pc: "HU" },
  "kingston upon hull": { county: "East Riding of Yorkshire", pc: "HU" },
  preston: { county: "Lancashire", pc: "PR" },
  luton: { county: "Bedfordshire", pc: "LU" },
  reading: { county: "Berkshire", pc: "RG" },
  oxford: { county: "Oxfordshire", pc: "OX" },
  cambridge: { county: "Cambridgeshire", pc: "CB" },
  york: { county: "North Yorkshire", pc: "YO" },
  norwich: { county: "Norfolk", pc: "NR" },
  ipswich: { county: "Suffolk", pc: "IP" },
  exeter: { county: "Devon", pc: "EX" },
  gloucester: { county: "Gloucestershire", pc: "GL" },
  cheltenham: { county: "Gloucestershire", pc: "GL" },
  worcester: { county: "Worcestershire", pc: "WR" },
  bath: { county: "Somerset", pc: "BA" },
  "milton keynes": { county: "Buckinghamshire", pc: "MK" },
  northampton: { county: "Northamptonshire", pc: "NN" },
  peterborough: { county: "Cambridgeshire", pc: "PE" },
  sunderland: { county: "Tyne and Wear", pc: "SR" },
  middlesbrough: { county: "North Yorkshire", pc: "TS" },
  blackpool: { county: "Lancashire", pc: "FY" },
  bolton: { county: "Greater Manchester", pc: "BL" },
  bournemouth: { county: "Dorset", pc: "BH" },
  poole: { county: "Dorset", pc: "BH" },
  swindon: { county: "Wiltshire", pc: "SN" },
  huddersfield: { county: "West Yorkshire", pc: "HD" },
  wakefield: { county: "West Yorkshire", pc: "WF" },
  oldham: { county: "Greater Manchester", pc: "OL" },
  rochdale: { county: "Greater Manchester", pc: "OL" },
  salford: { county: "Greater Manchester", pc: "M" },
  stockport: { county: "Greater Manchester", pc: "SK" },
  wigan: { county: "Greater Manchester", pc: "WN" },
  warrington: { county: "Cheshire", pc: "WA" },
  chester: { county: "Cheshire", pc: "CH" },
  doncaster: { county: "South Yorkshire", pc: "DN" },
  rotherham: { county: "South Yorkshire", pc: "S" },
  barnsley: { county: "South Yorkshire", pc: "S" },
  telford: { county: "Shropshire", pc: "TF" },
  shrewsbury: { county: "Shropshire", pc: "SY" },
  carlisle: { county: "Cumbria", pc: "CA" },
  lancaster: { county: "Lancashire", pc: "LA" },
  durham: { county: "County Durham", pc: "DH" },
  lincoln: { county: "Lincolnshire", pc: "LN" },
  colchester: { county: "Essex", pc: "CO" },
  chelmsford: { county: "Essex", pc: "CM" },
  southend: { county: "Essex", pc: "SS" },
  "southend-on-sea": { county: "Essex", pc: "SS" },
  basildon: { county: "Essex", pc: "SS" },
  watford: { county: "Hertfordshire", pc: "WD" },
  "st albans": { county: "Hertfordshire", pc: "AL" },
  stevenage: { county: "Hertfordshire", pc: "SG" },
  slough: { county: "Berkshire", pc: "SL" },
  maidstone: { county: "Kent", pc: "ME" },
  canterbury: { county: "Kent", pc: "CT" },
  dover: { county: "Kent", pc: "CT" },
  guildford: { county: "Surrey", pc: "GU" },
  woking: { county: "Surrey", pc: "GU" },
  crawley: { county: "West Sussex", pc: "RH" },
  "high wycombe": { county: "Buckinghamshire", pc: "HP" },
  wrexham: { county: "Wrexham", pc: "LL" },

  // Wales
  cardiff: { county: "South Glamorgan", pc: "CF" },
  swansea: { county: "West Glamorgan", pc: "SA" },
  newport: { county: "Gwent", pc: "NP" },
  bangor: { county: "Gwynedd", pc: "LL" },

  // Scotland
  glasgow: { county: "Lanarkshire", pc: "G" },
  edinburgh: { county: "Midlothian", pc: "EH" },
  aberdeen: { county: "Aberdeenshire", pc: "AB" },
  dundee: { county: "Angus", pc: "DD" },
  inverness: { county: "Highland", pc: "IV" },
  stirling: { county: "Stirlingshire", pc: "FK" },
  perth: { county: "Perthshire", pc: "PH" },
  paisley: { county: "Renfrewshire", pc: "PA" },

  // Northern Ireland
  belfast: { county: "County Antrim", pc: "BT" },
  derry: { county: "County Londonderry", pc: "BT" },
  londonderry: { county: "County Londonderry", pc: "BT" },
  lisburn: { county: "County Antrim", pc: "BT" },
};

/** Look up a town/city (case/space-insensitive). */
export function lookupUkCity(name: string): UkPlace | null {
  const key = name.trim().toLowerCase();
  return UK_PLACES[key] ?? null;
}

/** Sorted, display-cased city names for a <datalist>. */
export const UK_CITY_NAMES: string[] = Object.keys(UK_PLACES)
  .map((k) => k.replace(/\b\w/g, (c) => c.toUpperCase()))
  .sort((a, b) => a.localeCompare(b));

/** Unique county names for a <datalist>. */
export const UK_COUNTY_NAMES: string[] = [...new Set(Object.values(UK_PLACES).map((p) => p.county))].sort(
  (a, b) => a.localeCompare(b),
);
