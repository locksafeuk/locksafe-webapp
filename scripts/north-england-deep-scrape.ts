/**
 * north-england-deep-scrape.ts
 *
 * Hyper-local locksmith scraper for Northern England.
 * Covers regions that previously only had city-level coverage:
 *
 *   - West Yorkshire    (Leeds, Bradford, Halifax, Huddersfield, Wakefield, Dewsbury)
 *   - South Yorkshire   (Sheffield, Rotherham, Barnsley, Doncaster)
 *   - North Yorkshire   (York, Harrogate, Scarborough + rural towns)
 *   - East Yorkshire    (Hull + surrounding)
 *   - North East        (Newcastle, Sunderland, Gateshead + County Durham)
 *   - Teesside          (Middlesbrough, Stockton, Hartlepool, Redcar)
 *   - Lancashire        (Preston, Blackpool, Blackburn, Lancaster, Fylde Coast)
 *   - Humber            (Grimsby, Scunthorpe, Humberside towns)
 *
 * Strategy:
 *   Phase 1 — Named neighbourhood text searches × 7 query types
 *   Phase 2 — Coordinate grid nearby searches (5 km radius)
 *
 * Usage:
 *   GOOGLE_PLACES_API_KEY=... DATABASE_URL=... \
 *   npx ts-node --project scripts/tsconfig.scripts.json \
 *     scripts/north-england-deep-scrape.ts [--resume] [--enrich]
 */

import * as fs from "fs";
import * as https from "https";
import * as http from "http";
import { PrismaClient } from "@prisma/client";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config();

process.on("uncaughtException",  (err)    => console.error("💥 uncaughtException:", err));
process.on("unhandledRejection", (reason) => console.error("💥 unhandledRejection:", reason));

const prisma = new PrismaClient();
const SERP_KEY = process.env.SERPAPI_KEY || "";
if (!SERP_KEY) { console.error("❌  SERPAPI_KEY not set"); process.exit(1); }
console.log("🔑  SerpAPI: ✅ ready\n");

// ─────────────────────────────────────────────────────────────────────────────
// Named areas by region
// ─────────────────────────────────────────────────────────────────────────────

// ── West Yorkshire ────────────────────────────────────────────────────────────
const WEST_YORKSHIRE_AREAS = [
  // Leeds
  "Leeds City Centre",
  "Headingley Leeds",
  "Chapel Allerton Leeds",
  "Roundhay Leeds",
  "Moortown Leeds",
  "Harehills Leeds",
  "Beeston Leeds",
  "Armley Leeds",
  "Kirkstall Leeds",
  "Horsforth Leeds",
  "Morley Leeds",
  "Pudsey Leeds",
  "Garforth Leeds",
  "Otley Leeds",
  "Wetherby Leeds",
  "Guiseley Leeds",
  "Yeadon Leeds",
  "Farsley Leeds",
  "Cross Gates Leeds",
  "Seacroft Leeds",
  "Halton Leeds",
  "Rothwell Leeds",
  "Kippax Leeds",
  "Boston Spa Leeds",
  "Bramhope Leeds",

  // Bradford
  "Bradford City Centre",
  "Shipley Bradford",
  "Bingley Bradford",
  "Keighley Bradford",
  "Ilkley Bradford",
  "Saltaire Bradford",
  "Idle Bradford",
  "Wibsey Bradford",
  "Wyke Bradford",
  "Great Horton Bradford",
  "Little Horton Bradford",
  "Manningham Bradford",
  "Heaton Bradford",
  "Thornton Bradford",
  "Clayton Bradford",
  "Queensbury Bradford",
  "Cullingworth Bradford",
  "Silsden Bradford",
  "Steeton Bradford",

  // Halifax / Calderdale
  "Halifax Town Centre",
  "Sowerby Bridge Halifax",
  "Elland Calderdale",
  "Brighouse Calderdale",
  "Hebden Bridge Calderdale",
  "Todmorden Calderdale",
  "Rastrick Brighouse",
  "Greetland Halifax",
  "Hipperholme Halifax",
  "Mixenden Halifax",
  "Northowram Halifax",

  // Huddersfield / Kirklees
  "Huddersfield Town Centre",
  "Dewsbury Kirklees",
  "Batley Kirklees",
  "Cleckheaton Kirklees",
  "Heckmondwike Kirklees",
  "Mirfield Kirklees",
  "Holmfirth Kirklees",
  "Honley Kirklees",
  "Meltham Kirklees",
  "Marsden Kirklees",
  "Lindley Huddersfield",
  "Almondbury Huddersfield",
  "Dalton Huddersfield",
  "Moldgreen Huddersfield",

  // Wakefield
  "Wakefield City Centre",
  "Pontefract Wakefield",
  "Castleford Wakefield",
  "Knottingley Wakefield",
  "Ossett Wakefield",
  "Horbury Wakefield",
  "Normanton Wakefield",
  "Featherstone Wakefield",
  "Hemsworth Wakefield",
  "South Elmsall Wakefield",
  "Ackworth Wakefield",
];

// ── South Yorkshire ───────────────────────────────────────────────────────────
const SOUTH_YORKSHIRE_AREAS = [
  // Sheffield
  "Sheffield City Centre",
  "Hillsborough Sheffield",
  "Burngreave Sheffield",
  "Firth Park Sheffield",
  "Southey Sheffield",
  "Stocksbridge Sheffield",
  "Ecclesfield Sheffield",
  "Chapeltown Sheffield",
  "Gleadless Sheffield",
  "Woodhouse Sheffield",
  "Mosborough Sheffield",
  "Beighton Sheffield",
  "Handsworth Sheffield",
  "Heeley Sheffield",
  "Nether Edge Sheffield",
  "Sharrow Sheffield",
  "Walkley Sheffield",
  "Crookes Sheffield",
  "Broomhill Sheffield",
  "Dore Sheffield",
  "Totley Sheffield",
  "Beauchief Sheffield",
  "Woodseats Sheffield",
  "Norton Sheffield",
  "Hackenthorpe Sheffield",

  // Rotherham
  "Rotherham Town Centre",
  "Maltby Rotherham",
  "Swinton Rotherham",
  "Wath-upon-Dearne Rotherham",
  "Dinnington Rotherham",
  "Wales Rotherham",
  "Wickersley Rotherham",
  "Brinsworth Rotherham",
  "Kiveton Park Rotherham",
  "Rawmarsh Rotherham",

  // Barnsley
  "Barnsley Town Centre",
  "Penistone Barnsley",
  "Wombwell Barnsley",
  "Hoyland Barnsley",
  "Cudworth Barnsley",
  "Goldthorpe Barnsley",
  "Royston Barnsley",
  "Darfield Barnsley",
  "Dearne Barnsley",
  "Worsbrough Barnsley",

  // Doncaster
  "Doncaster Town Centre",
  "Mexborough Doncaster",
  "Conisbrough Doncaster",
  "Armthorpe Doncaster",
  "Edlington Doncaster",
  "Thorne Doncaster",
  "Hatfield Doncaster",
  "Stainforth Doncaster",
  "Bentley Doncaster",
  "Kirk Sandall Doncaster",
  "Adwick-le-Street Doncaster",
];

// ── North Yorkshire ───────────────────────────────────────────────────────────
const NORTH_YORKSHIRE_AREAS = [
  // York
  "York City Centre",
  "Acomb York",
  "Huntington York",
  "Haxby York",
  "Strensall York",
  "Dringhouses York",
  "Fulford York",
  "Heslington York",
  "Rawcliffe York",
  "Tang Hall York",
  "Bishopthorpe York",

  // Harrogate
  "Harrogate Town Centre",
  "Knaresborough Harrogate",
  "Ripon North Yorkshire",
  "Boroughbridge North Yorkshire",
  "Pateley Bridge North Yorkshire",
  "Masham North Yorkshire",

  // Scarborough
  "Scarborough Town Centre",
  "Filey North Yorkshire",
  "Whitby North Yorkshire",
  "Robin Hood's Bay North Yorkshire",
  "Pickering North Yorkshire",
  "Helmsley North Yorkshire",
  "Kirkbymoorside North Yorkshire",

  // Northallerton / Hambleton
  "Northallerton North Yorkshire",
  "Thirsk North Yorkshire",
  "Bedale North Yorkshire",
  "Richmond North Yorkshire",
  "Catterick Garrison North Yorkshire",
  "Leyburn North Yorkshire",

  // Skipton / Craven
  "Skipton North Yorkshire",
  "Settle North Yorkshire",
  "Ingleton North Yorkshire",
];

// ── East Yorkshire & Humber ───────────────────────────────────────────────────
const EAST_YORKSHIRE_AREAS = [
  // Hull
  "Hull City Centre",
  "Hessle East Yorkshire",
  "Anlaby East Yorkshire",
  "Willerby East Yorkshire",
  "Cottingham East Yorkshire",
  "Beverley East Yorkshire",
  "Brough East Yorkshire",
  "North Ferriby East Yorkshire",
  "Hedon East Yorkshire",
  "Withernsea East Yorkshire",
  "Hornsea East Yorkshire",
  "Driffield East Yorkshire",
  "Bridlington East Yorkshire",
  "Filey East Yorkshire",
  "Pocklington East Yorkshire",
  "Market Weighton East Yorkshire",
  "Howden East Yorkshire",
  "Goole East Yorkshire",

  // Humber / North Lincolnshire
  "Grimsby Town Centre",
  "Cleethorpes Lincolnshire",
  "Immingham Lincolnshire",
  "Scunthorpe Town Centre",
  "Brigg North Lincolnshire",
  "Barton-upon-Humber Lincolnshire",
  "Gainsborough Lincolnshire",
  "Epworth North Lincolnshire",
];

// ── North East England ────────────────────────────────────────────────────────
const NORTH_EAST_AREAS = [
  // Newcastle / Tyne & Wear
  "Newcastle City Centre",
  "Jesmond Newcastle",
  "Gosforth Newcastle",
  "Fenham Newcastle",
  "Benwell Newcastle",
  "Byker Newcastle",
  "Walker Newcastle",
  "Elswick Newcastle",
  "Blakelaw Newcastle",
  "Kenton Newcastle",
  "Denton Burn Newcastle",
  "Westerhope Newcastle",
  "Newburn Newcastle",
  "Scotswood Newcastle",
  "Heaton Newcastle",
  "Lemington Newcastle",
  "Longbenton Newcastle",
  "Fawdon Newcastle",
  "Kenton Bar Newcastle",

  // Gateshead
  "Gateshead Town Centre",
  "Blaydon Gateshead",
  "Dunston Gateshead",
  "Felling Gateshead",
  "Low Fell Gateshead",
  "Rowlands Gill Gateshead",
  "Ryton Gateshead",
  "Whickham Gateshead",
  "Birtley Gateshead",
  "Chopwell Gateshead",
  "High Spen Gateshead",
  "Wrekenton Gateshead",

  // Sunderland
  "Sunderland City Centre",
  "Roker Sunderland",
  "Pallion Sunderland",
  "Pennywell Sunderland",
  "Ford Sunderland",
  "Farringdon Sunderland",
  "Houghton-le-Spring Sunderland",
  "Washington Sunderland",
  "Hetton-le-Hole Sunderland",
  "Castletown Sunderland",
  "Southwick Sunderland",
  "Thorney Close Sunderland",

  // South Tyneside
  "South Shields Tyne and Wear",
  "Jarrow South Tyneside",
  "Hebburn South Tyneside",
  "Boldon South Tyneside",
  "Whitburn South Tyneside",

  // North Tyneside
  "Wallsend North Tyneside",
  "North Shields North Tyneside",
  "Tynemouth Tyne and Wear",
  "Whitley Bay North Tyneside",
  "Cullercoats North Tyneside",
  "Killingworth North Tyneside",
  "Shiremoor North Tyneside",
  "Monkseaton North Tyneside",

  // County Durham
  "Durham City Centre",
  "Chester-le-Street Durham",
  "Stanley Durham",
  "Consett Durham",
  "Bishop Auckland Durham",
  "Newton Aycliffe Durham",
  "Spennymoor Durham",
  "Crook Durham",
  "Ferryhill Durham",
  "Seaham Durham",
  "Horden Durham",
  "Peterlee Durham",
  "Easington Durham",
  "Lanchester Durham",
  "Stanhope Durham",
  "Barnard Castle Durham",
  "Shildon Durham",
  "Tow Law Durham",

  // Northumberland
  "Hexham Northumberland",
  "Morpeth Northumberland",
  "Ashington Northumberland",
  "Blyth Northumberland",
  "Cramlington Northumberland",
  "Bedlington Northumberland",
  "Ponteland Northumberland",
  "Prudhoe Northumberland",
  "Corbridge Northumberland",
  "Haltwhistle Northumberland",
  "Alnwick Northumberland",
  "Berwick-upon-Tweed Northumberland",
];

// ── Teesside ──────────────────────────────────────────────────────────────────
const TEESSIDE_AREAS = [
  "Middlesbrough Town Centre",
  "Linthorpe Middlesbrough",
  "Acklam Middlesbrough",
  "Berwick Hills Middlesbrough",
  "Park End Middlesbrough",
  "Coulby Newham Middlesbrough",
  "Marton Middlesbrough",
  "Nunthorpe Middlesbrough",
  "Stockton-on-Tees Town Centre",
  "Billingham Stockton",
  "Thornaby-on-Tees Stockton",
  "Ingleby Barwick Stockton",
  "Eaglescliffe Stockton",
  "Hartlepool Town Centre",
  "Seaton Carew Hartlepool",
  "Redcar North Yorkshire",
  "Marske-by-the-Sea Redcar",
  "Guisborough Redcar",
  "Loftus Redcar",
  "Saltburn-by-the-Sea Redcar",
  "Darlington Town Centre",
  "Hurworth Darlington",
  "Cockerton Darlington",
];

// ── Lancashire ────────────────────────────────────────────────────────────────
const LANCASHIRE_AREAS = [
  // Preston
  "Preston City Centre",
  "Fulwood Preston",
  "Penwortham Preston",
  "Ribbleton Preston",
  "Ingol Preston",
  "Brookfield Preston",
  "Ashton-on-Ribble Preston",
  "Longridge Lancashire",
  "Bamber Bridge Preston",
  "Leyland Lancashire",
  "Lostock Hall Preston",
  "Walton-le-Dale Preston",

  // Blackpool / Fylde Coast
  "Blackpool Town Centre",
  "Lytham St Annes Lancashire",
  "Fleetwood Lancashire",
  "Cleveleys Blackpool",
  "Poulton-le-Fylde Lancashire",
  "Kirkham Lancashire",
  "Garstang Lancashire",

  // Blackburn
  "Blackburn Town Centre",
  "Darwen Lancashire",
  "Oswaldtwistle Lancashire",
  "Rishton Blackburn",
  "Great Harwood Lancashire",
  "Clitheroe Lancashire",
  "Whalley Lancashire",
  "Rawtenstall Lancashire",
  "Haslingden Lancashire",
  "Bacup Lancashire",
  "Whitworth Lancashire",
  "Ramsbottom Lancashire",

  // Lancaster / Morecambe
  "Lancaster City Centre",
  "Morecambe Lancashire",
  "Heysham Lancashire",
  "Carnforth Lancashire",

  // Chorley / West Lancashire
  "Chorley Town Centre",
  "Skelmersdale Lancashire",
  "Ormskirk Lancashire",
  "Burscough Lancashire",
  "Coppull Chorley",
  "Adlington Chorley",

  // Burnley / Pendle (complement gap-cities coverage)
  "Burnley Town Centre",
  "Padiham Burnley",
  "Nelson Lancashire",
  "Colne Lancashire",
  "Barnoldswick Lancashire",
  "Earby Lancashire",
];

const ALL_AREAS = [
  ...WEST_YORKSHIRE_AREAS,
  ...SOUTH_YORKSHIRE_AREAS,
  ...NORTH_YORKSHIRE_AREAS,
  ...EAST_YORKSHIRE_AREAS,
  ...NORTH_EAST_AREAS,
  ...TEESSIDE_AREAS,
  ...LANCASHIRE_AREAS,
];

// ─────────────────────────────────────────────────────────────────────────────
// Coordinate grid — dense coverage across northern England
// ─────────────────────────────────────────────────────────────────────────────
const GRID_POINTS: Array<{ label: string; lat: number; lng: number }> = [
  // ── West Yorkshire ──────────────────────────────────────────────────────
  { label: "Leeds City Centre",          lat: 53.8008, lng: -1.5491 },
  { label: "Leeds North",                lat: 53.8450, lng: -1.5600 },
  { label: "Leeds East",                 lat: 53.8000, lng: -1.4700 },
  { label: "Leeds West / Pudsey",        lat: 53.7950, lng: -1.6600 },
  { label: "Leeds South / Morley",       lat: 53.7400, lng: -1.5900 },
  { label: "Garforth / Rothwell",        lat: 53.7900, lng: -1.3900 },
  { label: "Otley / Yeadon",             lat: 53.9050, lng: -1.6900 },
  { label: "Bradford City Centre",       lat: 53.7960, lng: -1.7594 },
  { label: "Bradford North",             lat: 53.8300, lng: -1.7600 },
  { label: "Bradford South / Wyke",      lat: 53.7600, lng: -1.7900 },
  { label: "Bradford East / Eccleshill", lat: 53.8200, lng: -1.7000 },
  { label: "Shipley / Saltaire",         lat: 53.8350, lng: -1.7830 },
  { label: "Keighley / Bingley",         lat: 53.8680, lng: -1.9050 },
  { label: "Ilkley / Skipton area",      lat: 53.9240, lng: -1.9650 },
  { label: "Halifax Town Centre",        lat: 53.7249, lng: -1.8659 },
  { label: "Brighouse / Rastrick",       lat: 53.7050, lng: -1.7830 },
  { label: "Hebden Bridge / Todmorden",  lat: 53.7430, lng: -2.0150 },
  { label: "Huddersfield Town Centre",   lat: 53.6458, lng: -1.7835 },
  { label: "Huddersfield North",         lat: 53.6800, lng: -1.7850 },
  { label: "Huddersfield South",         lat: 53.6100, lng: -1.8000 },
  { label: "Dewsbury / Batley",          lat: 53.6900, lng: -1.6330 },
  { label: "Cleckheaton / Heckmondwike", lat: 53.7200, lng: -1.7100 },
  { label: "Wakefield City Centre",      lat: 53.6830, lng: -1.4977 },
  { label: "Wakefield North / Ossett",   lat: 53.7100, lng: -1.5700 },
  { label: "Castleford / Pontefract",    lat: 53.7250, lng: -1.3550 },
  { label: "Knottingley / Normanton",    lat: 53.7050, lng: -1.2850 },

  // ── South Yorkshire ─────────────────────────────────────────────────────
  { label: "Sheffield City Centre",      lat: 53.3811, lng: -1.4701 },
  { label: "Sheffield North / Hillsborough", lat: 53.4200, lng: -1.5000 },
  { label: "Sheffield East / Handsworth", lat: 53.3900, lng: -1.3900 },
  { label: "Sheffield South / Norton",   lat: 53.3400, lng: -1.4700 },
  { label: "Sheffield West / Crookes",   lat: 53.3900, lng: -1.5200 },
  { label: "Stocksbridge / Chapeltown",  lat: 53.4800, lng: -1.5700 },
  { label: "Rotherham Town Centre",      lat: 53.4302, lng: -1.3573 },
  { label: "Rotherham North / Wath",     lat: 53.4900, lng: -1.3500 },
  { label: "Rotherham South / Maltby",   lat: 53.4000, lng: -1.2200 },
  { label: "Barnsley Town Centre",       lat: 53.5527, lng: -1.4797 },
  { label: "Barnsley East / Wombwell",   lat: 53.5200, lng: -1.3900 },
  { label: "Barnsley North / Royston",   lat: 53.6000, lng: -1.4500 },
  { label: "Doncaster Town Centre",      lat: 53.5228, lng: -1.1283 },
  { label: "Doncaster North / Bentley",  lat: 53.5600, lng: -1.1400 },
  { label: "Doncaster East / Armthorpe", lat: 53.5200, lng: -1.0600 },
  { label: "Doncaster South / Conisbrough", lat: 53.4800, lng: -1.2300 },
  { label: "Thorne / Hatfield",          lat: 53.6100, lng: -0.9700 },

  // ── North Yorkshire ─────────────────────────────────────────────────────
  { label: "York City Centre",           lat: 53.9600, lng: -1.0873 },
  { label: "York North / Skelton",       lat: 54.0000, lng: -1.1000 },
  { label: "York South / Fulford",       lat: 53.9300, lng: -1.0700 },
  { label: "York West / Acomb",          lat: 53.9600, lng: -1.1300 },
  { label: "Harrogate Town Centre",      lat: 53.9920, lng: -1.5410 },
  { label: "Knaresborough",              lat: 54.0100, lng: -1.4680 },
  { label: "Ripon",                      lat: 54.1380, lng: -1.5230 },
  { label: "Skipton",                    lat: 53.9610, lng: -2.0180 },
  { label: "Northallerton",              lat: 54.3370, lng: -1.4340 },
  { label: "Thirsk",                     lat: 54.2330, lng: -1.3460 },
  { label: "Scarborough",                lat: 54.2797, lng: -0.4009 },
  { label: "Whitby",                     lat: 54.4865, lng: -0.6150 },
  { label: "Pickering",                  lat: 54.2480, lng: -0.7770 },
  { label: "Richmond N Yorkshire",       lat: 54.4040, lng: -1.7340 },
  { label: "Catterick / Leyburn",        lat: 54.3700, lng: -1.6600 },

  // ── East Yorkshire / Humber ─────────────────────────────────────────────
  { label: "Hull City Centre",           lat: 53.7457, lng: -0.3367 },
  { label: "Hull West / Hessle",         lat: 53.7250, lng: -0.4400 },
  { label: "Hull East / Hedon",          lat: 53.7400, lng: -0.2200 },
  { label: "Hull North / Cottingham",    lat: 53.7900, lng: -0.4000 },
  { label: "Beverley",                   lat: 53.8430, lng: -0.4330 },
  { label: "Bridlington",                lat: 54.0820, lng: -0.1920 },
  { label: "Driffield",                  lat: 54.0020, lng: -0.4380 },
  { label: "Goole",                      lat: 53.7010, lng: -0.8730 },
  { label: "Scunthorpe",                 lat: 53.5810, lng: -0.6510 },
  { label: "Grimsby",                    lat: 53.5668, lng: -0.0798 },
  { label: "Cleethorpes",               lat: 53.5600, lng:  0.0200 },
  { label: "Gainsborough",               lat: 53.4010, lng: -0.7720 },

  // ── North East / Tyne & Wear ─────────────────────────────────────────────
  { label: "Newcastle City Centre",      lat: 54.9783, lng: -1.6178 },
  { label: "Newcastle West / Fenham",    lat: 54.9800, lng: -1.6700 },
  { label: "Newcastle East / Heaton",    lat: 54.9850, lng: -1.5850 },
  { label: "Newcastle North / Gosforth", lat: 55.0050, lng: -1.6200 },
  { label: "Newcastle South / Byker",    lat: 54.9700, lng: -1.5900 },
  { label: "Gateshead Town Centre",      lat: 54.9601, lng: -1.6032 },
  { label: "Gateshead West / Whickham",  lat: 54.9600, lng: -1.6900 },
  { label: "Gateshead South / Birtley",  lat: 54.9050, lng: -1.5800 },
  { label: "Gateshead East / Felling",   lat: 54.9550, lng: -1.5400 },
  { label: "Sunderland City Centre",     lat: 54.9053, lng: -1.3816 },
  { label: "Sunderland North / Roker",   lat: 54.9300, lng: -1.3800 },
  { label: "Sunderland West / Pallion",  lat: 54.9000, lng: -1.4200 },
  { label: "Washington",                 lat: 54.8990, lng: -1.5250 },
  { label: "Houghton-le-Spring",         lat: 54.8440, lng: -1.4660 },
  { label: "South Shields",              lat: 54.9990, lng: -1.4320 },
  { label: "Jarrow / Hebburn",           lat: 54.9800, lng: -1.4850 },
  { label: "Wallsend / North Shields",   lat: 55.0050, lng: -1.5400 },
  { label: "Whitley Bay / Tynemouth",    lat: 55.0370, lng: -1.4480 },
  { label: "Killingworth / Longbenton",  lat: 55.0150, lng: -1.5700 },

  // ── County Durham ───────────────────────────────────────────────────────
  { label: "Durham City Centre",         lat: 54.7761, lng: -1.5733 },
  { label: "Chester-le-Street",          lat: 54.8590, lng: -1.5710 },
  { label: "Stanley / Consett",          lat: 54.8700, lng: -1.7000 },
  { label: "Bishop Auckland",            lat: 54.6620, lng: -1.6780 },
  { label: "Newton Aycliffe",            lat: 54.6170, lng: -1.5820 },
  { label: "Spennymoor / Crook",         lat: 54.7050, lng: -1.6700 },
  { label: "Seaham / Peterlee",          lat: 54.8420, lng: -1.3280 },
  { label: "Easington / Horden",         lat: 54.7850, lng: -1.3380 },
  { label: "Barnard Castle",             lat: 54.5480, lng: -1.9230 },

  // ── Northumberland ──────────────────────────────────────────────────────
  { label: "Hexham",                     lat: 54.9720, lng: -2.1000 },
  { label: "Morpeth",                    lat: 55.1690, lng: -1.6880 },
  { label: "Ashington / Blyth",          lat: 55.1800, lng: -1.5600 },
  { label: "Cramlington / Bedlington",   lat: 55.0880, lng: -1.6060 },
  { label: "Prudhoe / Ponteland",        lat: 54.9600, lng: -1.8500 },
  { label: "Alnwick",                    lat: 55.4128, lng: -1.7040 },
  { label: "Berwick-upon-Tweed",         lat: 55.7730, lng: -2.0050 },

  // ── Teesside ────────────────────────────────────────────────────────────
  { label: "Middlesbrough Centre",       lat: 54.5742, lng: -1.2350 },
  { label: "Middlesbrough South",        lat: 54.5400, lng: -1.2400 },
  { label: "Middlesbrough West",         lat: 54.5700, lng: -1.2900 },
  { label: "Stockton-on-Tees Centre",    lat: 54.5660, lng: -1.3190 },
  { label: "Billingham / Thornaby",      lat: 54.6100, lng: -1.2800 },
  { label: "Ingleby Barwick",            lat: 54.5200, lng: -1.3200 },
  { label: "Hartlepool",                 lat: 54.6865, lng: -1.2126 },
  { label: "Redcar",                     lat: 54.6175, lng: -1.0670 },
  { label: "Guisborough",                lat: 54.5360, lng: -1.0540 },
  { label: "Darlington Centre",          lat: 54.5236, lng: -1.5580 },
  { label: "Darlington North",           lat: 54.5550, lng: -1.5600 },

  // ── Lancashire ──────────────────────────────────────────────────────────
  { label: "Preston City Centre",        lat: 53.7632, lng: -2.7031 },
  { label: "Preston North / Fulwood",    lat: 53.7950, lng: -2.7000 },
  { label: "Preston South / Leyland",    lat: 53.6950, lng: -2.6900 },
  { label: "Preston East / Bamber Bridge", lat: 53.7350, lng: -2.6600 },
  { label: "Blackpool Centre",           lat: 53.8175, lng: -3.0357 },
  { label: "Blackpool North",            lat: 53.8500, lng: -3.0500 },
  { label: "Blackpool South / Lytham",   lat: 53.7750, lng: -2.9800 },
  { label: "Fleetwood / Cleveleys",      lat: 53.9200, lng: -3.0100 },
  { label: "Poulton-le-Fylde",           lat: 53.8450, lng: -2.9960 },
  { label: "Blackburn Centre",           lat: 53.7480, lng: -2.4880 },
  { label: "Blackburn East / Darwen",    lat: 53.6950, lng: -2.4600 },
  { label: "Blackburn West / Accrington", lat: 53.7530, lng: -2.3630 },
  { label: "Lancaster Centre",           lat: 54.0466, lng: -2.7992 },
  { label: "Morecambe",                  lat: 54.0720, lng: -2.8650 },
  { label: "Chorley",                    lat: 53.6530, lng: -2.6320 },
  { label: "Ormskirk / Skelmersdale",    lat: 53.5700, lng: -2.8800 },
  { label: "Burnley",                    lat: 53.7890, lng: -2.2370 },
  { label: "Nelson / Colne",             lat: 53.8370, lng: -2.2090 },
  { label: "Clitheroe",                  lat: 53.8710, lng: -2.3940 },
];

// ─────────────────────────────────────────────────────────────────────────────
// Query builders — 7 types
// ─────────────────────────────────────────────────────────────────────────────
const SEARCH_QUERIES: Array<(area: string) => string> = [
  (a) => `locksmith ${a}`,
  (a) => `independent locksmith ${a} UK`,
  (a) => `emergency locksmith ${a} UK`,
  (a) => `auto locksmith ${a} UK`,
  (a) => `24 hour locksmith ${a}`,
  (a) => `residential locksmith ${a}`,
  (a) => `commercial locksmith ${a}`,
];

// ─────────────────────────────────────────────────────────────────────────────
// Chain / franchise filter
// ─────────────────────────────────────────────────────────────────────────────
const CHAIN_KEYWORDS = [
  "timpson", "mls locksmith", "speedy locksmith", "banham",
  "chubb", "yale", "securitas", "g4s", "keyfax", "fast keys",
  "locksmith network", "multilock", "assa abloy", "ingersoll",
  "locksmiths24", "locksmiths 24", "national locksmith",
  "uk locksmith", "emergency locksmiths ltd", "lockforce", "keytek",
  "lockrite", "auto locksmith network", "locksafe",
  "mr. speedy", "mr speedy", "key cutting",
];
function isChain(name: string): boolean {
  return CHAIN_KEYWORDS.some((kw) => name.toLowerCase().includes(kw));
}

// ─────────────────────────────────────────────────────────────────────────────
// SerpAPI Google Maps search
// ─────────────────────────────────────────────────────────────────────────────
const SERP_BASE = "https://serpapi.com/search.json";

interface NormalisedPlace {
  placeId: string;
  name: string;
  address: string;
  phone?: string;
  website?: string;
  rating?: number;
  reviewCount?: number;
}

function sleep(ms: number) { return new Promise<void>((r) => setTimeout(r, ms)); }

async function fetchWithRetry(url: string, retries = 4): Promise<Response> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);
    try {
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
      return res;
    } catch (err: any) {
      clearTimeout(timer);
      if (attempt < retries) {
        const delay = Math.min(5000 * attempt, 20000);
        console.warn(`  ⚠  timeout (attempt ${attempt}/${retries}), retrying in ${delay / 1000}s…`);
        await sleep(delay);
      } else { throw err; }
    }
  }
  throw new Error("fetchWithRetry: exhausted retries");
}

function normaliseSerpResult(r: any): NormalisedPlace | null {
  const placeId = r.place_id || r.data_id || null;
  if (!placeId || !r.title) return null;
  return {
    placeId,
    name: r.title,
    address: r.address || "",
    phone: r.phone || undefined,
    website: r.website || undefined,
    rating: typeof r.rating === "number" ? r.rating : undefined,
    reviewCount: typeof r.reviews === "number" ? r.reviews : undefined,
  };
}

async function textSearch(query: string, start = 0): Promise<NormalisedPlace[]> {
  const url = new URL(SERP_BASE);
  url.searchParams.set("engine", "google_maps");
  url.searchParams.set("q", query);
  url.searchParams.set("type", "search");
  url.searchParams.set("hl", "en");
  url.searchParams.set("gl", "uk");
  if (start > 0) url.searchParams.set("start", String(start));
  url.searchParams.set("api_key", SERP_KEY);
  try {
    const res = await fetchWithRetry(url.toString());
    const data = await res.json() as any;
    if (data.error) { console.warn(`  ⚠  SerpAPI: ${data.error}`); return []; }
    return (data.local_results || []).map(normaliseSerpResult).filter(Boolean) as NormalisedPlace[];
  } catch (err) {
    console.warn(`  ⚠  SerpAPI error: ${err}`);
    return [];
  }
}

async function nearbySearch(lat: number, lng: number): Promise<NormalisedPlace[]> {
  const url = new URL(SERP_BASE);
  url.searchParams.set("engine", "google_maps");
  url.searchParams.set("q", "locksmith");
  url.searchParams.set("ll", `@${lat},${lng},14z`);
  url.searchParams.set("type", "search");
  url.searchParams.set("hl", "en");
  url.searchParams.set("gl", "uk");
  url.searchParams.set("api_key", SERP_KEY);
  try {
    const res = await fetchWithRetry(url.toString());
    const data = await res.json() as any;
    if (data.error) { console.warn(`  ⚠  SerpAPI: ${data.error}`); return []; }
    return (data.local_results || []).map(normaliseSerpResult).filter(Boolean) as NormalisedPlace[];
  } catch (err) {
    console.warn(`  ⚠  SerpAPI error: ${err}`);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Email extraction (socket-safe)
// ─────────────────────────────────────────────────────────────────────────────
function fetchHtml(url: string, redirects = 0): Promise<string> {
  if (redirects > 3 || !url) return Promise.resolve("");
  return new Promise((resolve) => {
    const protocol = url.startsWith("https") ? https : http;
    let settled = false;
    const done = (val: string) => { if (!settled) { settled = true; resolve(val); } };
    let req: any;
    const timer = setTimeout(() => { try { req?.destroy(); } catch {} done(""); }, 7000);
    try {
      req = protocol.get(url, { headers: { "User-Agent": "Mozilla/5.0" }, timeout: 7000 }, (res: any) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          clearTimeout(timer); res.resume();
          fetchHtml(res.headers.location, redirects + 1).then(done); return;
        }
        let data = "";
        res.on("data", (c: any) => { data += c; if (data.length > 400_000) { try { req?.destroy(); } catch {} done(data); } });
        res.on("end", () => { clearTimeout(timer); done(data); });
        res.on("error", () => { clearTimeout(timer); done(""); });
      });
      req.on("timeout", () => { req.destroy(); clearTimeout(timer); done(""); });
      req.on("error", () => { clearTimeout(timer); done(""); });
    } catch { clearTimeout(timer); done(""); }
  });
}

const EMAIL_BLOCKLIST = [
  "noreply", "no-reply", "donotreply", "example", "sentry",
  "wixpress", "squarespace", "wordpress.com", "amazonaws", "cloudflare",
  "googletagmanager", "doubleclick", "sendgrid", "mailchimp", "newsletter",
  "webmaster", "postmaster", "schema.org", "w3.org",
  "email@", "@email", "user@", "@domain", "test@", "@test",
  "name@", "@company", "your@", "info@info",
];
function extractEmails(html: string): string[] {
  const re = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
  const raw: string[] = html.match(re) ?? [];
  return [...new Set(raw.filter((e) =>
    !EMAIL_BLOCKLIST.some(b => e.toLowerCase().includes(b)) &&
    !/\.(png|jpg|gif|svg|css|js|woff|ttf)$/i.test(e)
  ))];
}
async function extractEmailFromWebsite(websiteUrl: string): Promise<string> {
  if (!websiteUrl) return "";
  const base = websiteUrl.replace(/\/$/, "");
  const pages = [base, `${base}/contact`, `${base}/contact-us`, `${base}/about`, `${base}/get-in-touch`];
  for (const pageUrl of pages) {
    const html = await fetchHtml(pageUrl);
    if (!html) { await sleep(100); continue; }
    const emails = extractEmails(html);
    if (emails.length > 0) return emails[0];
    await sleep(150);
  }
  return "";
}

// ─────────────────────────────────────────────────────────────────────────────
// Progress tracking
// ─────────────────────────────────────────────────────────────────────────────
const PROGRESS_FILE = "/tmp/north-england-scrape-progress.json";

function loadCompleted(): string[] {
  try { if (fs.existsSync(PROGRESS_FILE)) return JSON.parse(fs.readFileSync(PROGRESS_FILE, "utf8")); }
  catch {}
  return [];
}
function markDone(area: string, completed: string[]) {
  completed.push(area);
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(completed, null, 2), "utf8");
}

let totalSaved = 0;

// ─────────────────────────────────────────────────────────────────────────────
// Process a batch of SerpAPI results
// ─────────────────────────────────────────────────────────────────────────────
async function processBatch(results: NormalisedPlace[], areaLabel: string, seen: Set<string>) {
  for (const place of results) {
    if (seen.has(place.placeId)) continue;
    if (isChain(place.name)) { console.log(`   ⛔ Chain: ${place.name}`); continue; }
    seen.add(place.placeId);

    const phone = place.phone || "";
    const email = await extractEmailFromWebsite(place.website || "");
    console.log(`   ✅ ${place.name} | ${phone || "no phone"} | ${email ? `📧 ${email}` : "—"}`);

    try {
      await (prisma as any).locksmithLead.upsert({
        where: { googlePlaceId: place.placeId },
        update: {
          name: place.name, city: areaLabel, address: place.address,
          phone: phone || null, email: email || null,
          website: place.website || null,
          rating: place.rating || 0, reviewCount: place.reviewCount || 0,
        },
        create: {
          googlePlaceId: place.placeId, name: place.name, city: areaLabel, address: place.address,
          phone: phone || null, email: email || null,
          website: place.website || null,
          rating: place.rating || 0, reviewCount: place.reviewCount || 0,
          status: "new",
        },
      });
      totalSaved++;
    } catch (e) {
      console.warn(`   ⚠  DB save failed for ${place.name}: ${e}`);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  const doEnrich = process.argv.includes("--enrich");
  const isResume = process.argv.includes("--resume");

  const regions = [
    { name: "West Yorkshire",        count: WEST_YORKSHIRE_AREAS.length },
    { name: "South Yorkshire",       count: SOUTH_YORKSHIRE_AREAS.length },
    { name: "North Yorkshire",       count: NORTH_YORKSHIRE_AREAS.length },
    { name: "East Yorkshire & Humber", count: EAST_YORKSHIRE_AREAS.length },
    { name: "North East England",    count: NORTH_EAST_AREAS.length },
    { name: "Teesside",              count: TEESSIDE_AREAS.length },
    { name: "Lancashire",            count: LANCASHIRE_AREAS.length },
  ];

  console.log("🏔  Northern England deep locksmith scrape\n");
  regions.forEach(r => console.log(`   ${r.name.padEnd(30)} ${r.count} areas`));
  console.log(`\n   Total named areas : ${ALL_AREAS.length} × 7 query types`);
  console.log(`   Grid points       : ${GRID_POINTS.length} coordinate points`);
  console.log(`   Enrichment        : ${doEnrich ? "enabled" : "disabled (pass --enrich to enable)"}`);
  console.log(`   Resume            : ${isResume ? "yes" : "no (pass --resume to skip completed areas)"}\n`);

  const completed = isResume ? loadCompleted() : [];
  const seen = new Set<string>();
  const existing = await (prisma as any).locksmithLead.findMany({ select: { googlePlaceId: true } });
  for (const r of existing) seen.add(r.googlePlaceId);
  console.log(`   Existing DB records: ${seen.size} (will skip)\n`);

  // ── PHASE 1: Named area text searches ─────────────────────────────────────
  console.log("═══════════════════════════════════════════════════════");
  console.log("  PHASE 1 — Named area text searches");
  console.log("═══════════════════════════════════════════════════════\n");

  for (const area of ALL_AREAS) {
    if (isResume && completed.includes(area)) { console.log(`   ⏭  ${area}`); continue; }
    console.log(`\n📍 ${area}`);
    try {
      for (const buildQuery of SEARCH_QUERIES) {
        const query = buildQuery(area);
        // SerpAPI: fetch up to 3 pages (start 0, 20, 40)
        for (const start of [0, 20, 40]) {
          const results = await textSearch(query, start);
          await processBatch(results, area, seen);
          if (results.length < 20) break; // no more pages
          await sleep(1000);
        }
        await sleep(400);
      }
      markDone(area, completed);
    } catch (err) {
      console.error(`   ❌ Area failed: ${area} — ${err}`);
    }
  }

  // ── PHASE 2: Coordinate grid nearby search ────────────────────────────────
  console.log("\n═══════════════════════════════════════════════════════");
  console.log("  PHASE 2 — Coordinate grid nearby search");
  console.log("═══════════════════════════════════════════════════════\n");

  for (const point of GRID_POINTS) {
    const key = `GRID:${point.label}`;
    if (isResume && completed.includes(key)) { console.log(`   ⏭  ${point.label}`); continue; }
    console.log(`\n📡 ${point.label} (${point.lat}, ${point.lng})`);
    try {
      const results = await nearbySearch(point.lat, point.lng);
      await processBatch(results, point.label, seen);
      markDone(key, completed);
      await sleep(800);
    } catch (err) {
      console.error(`   ❌ Grid point failed: ${point.label} — ${err}`);
    }
  }

  const dbTotal = await (prisma as any).locksmithLead.count();
  console.log("\n═══════════════════════════════════════════════════════");
  console.log(`   Saved this run : ${totalSaved}`);
  console.log(`   DB total now   : ${dbTotal}`);
  console.log("═══════════════════════════════════════════════════════\n");

  // ── Optional email enrichment ─────────────────────────────────────────────
  if (doEnrich) {
    console.log("\n📧  Email enrichment — visiting websites of leads without email…\n");
    const targets = await (prisma as any).locksmithLead.findMany({
      where: { email: { equals: null }, website: { not: null } },
      select: { id: true, name: true, website: true },
    });
    console.log(`   ${targets.length} leads with website but no email.`);
    let enriched = 0;
    for (let i = 0; i < targets.length; i++) {
      const t = targets[i];
      if (i % 20 === 0) console.log(`   Progress: ${i}/${targets.length}…`);
      try {
        const email = await extractEmailFromWebsite(t.website);
        if (email) {
          await (prisma as any).locksmithLead.update({ where: { id: t.id }, data: { email } });
          console.log(`   ✅ ${t.name} → ${email}`);
          enriched++;
        }
      } catch {}
      await sleep(300);
    }
    console.log(`\n   Enriched: ${enriched} leads`);
  }

  // ── Notify intake endpoint — queues leads for agent email outreach ──────────
  if (totalSaved > 0) {
    const batchId = `north-england-${Date.now()}`;
    try {
      const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.locksafe.uk").replace(/\/$/, "");
      const cronSecret = process.env.CRON_SECRET || "";

      const intakeRes = await fetch(`${siteUrl}/api/admin/leads/intake`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-cron-secret": cronSecret,
        },
        body: JSON.stringify({
          batchId,
          leadCount: totalSaved,
          source: "north-england-scraper",
        }),
      });

      if (intakeRes.ok) {
        const intakeData = await intakeRes.json();
        console.log(`\n📡 Intake notified — batch ${batchId}: ${intakeData.message}`);
        console.log(`   Queue depth: ${intakeData.queue?.totalUncontacted ?? "?"} uncontacted leads`);
      } else {
        console.warn(`⚠️  Intake notification failed: HTTP ${intakeRes.status}`);
      }
    } catch (err) {
      console.error("⚠️  Failed to notify intake:", err);
    }
  }

  console.log("🎉  Northern England deep scrape complete!\n");
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
