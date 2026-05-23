/**
 * uk-coverage-gaps-scrape.ts
 *
 * Targeted scrape for regions with critically low locksmith coverage (< 15 leads).
 * Identified via DB audit — these are genuine geographic gaps, not just thin city-level
 * entries. Every area is scraped at neighbourhood / town level for maximum yield.
 *
 * Regions covered:
 *   - Coventry + Warwickshire        (15 → target 80+)
 *   - Oxford + Oxfordshire           (14 → target 60+)
 *   - Swindon + Wiltshire + Dorset   (12 → target 60+)
 *   - Ipswich + Suffolk + Norfolk    (14 → target 80+)
 *   - Luton + Bedfordshire           (11 → target 50+)
 *   - Exeter + Devon (full county)   ( 9 → target 70+)
 *   - Cornwall                       ( 9 → target 50+)
 *   - Taunton + Somerset             (15 → target 60+)
 *   - Worcester + Worcestershire     (14 → target 50+)
 *   - Stafford + Staffordshire       ( 2 → target 50+)
 *   - Northern Ireland outside Belfast
 *   - Chester + Cheshire West        (near-zero)
 *   - Gloucester + Gloucestershire   (thin outside Cheltenham)
 *
 * API: SerpAPI Google Maps (Google Places billing disabled)
 *
 * Usage:
 *   SERPAPI_KEY=... DATABASE_URL=... \
 *   npx ts-node --project scripts/tsconfig.scripts.json \
 *     scripts/uk-coverage-gaps-scrape.ts [--resume] [--enrich]
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
// Named areas — grouped by region
// ─────────────────────────────────────────────────────────────────────────────

const COVENTRY_AREAS = [
  "Coventry City Centre", "Foleshill Coventry", "Hillfields Coventry",
  "Earlsdon Coventry", "Canley Coventry", "Cheylesmore Coventry",
  "Binley Coventry", "Willenhall Coventry", "Radford Coventry",
  "Wood End Coventry", "Longford Coventry", "Holbrooks Coventry",
  "Stoke Coventry", "Bell Green Coventry", "Tile Hill Coventry",
  "Whoberley Coventry", "Allesley Coventry", "Finham Coventry",
  "Bedworth Warwickshire", "Nuneaton Warwickshire",
  "Royal Leamington Spa Warwickshire", "Kenilworth Warwickshire",
  "Warwick", "Stratford-upon-Avon Warwickshire",
  "Atherstone Warwickshire", "Coleshill Warwickshire",
  "Solihull Warwickshire", "Sutton Coldfield Warwickshire",
];

const OXFORD_AREAS = [
  "Oxford City Centre", "Cowley Oxford", "Headington Oxford",
  "Jericho Oxford", "Iffley Oxford", "Rose Hill Oxford",
  "Blackbird Leys Oxford", "Florence Park Oxford",
  "Abingdon Oxfordshire", "Didcot Oxfordshire",
  "Banbury Oxfordshire", "Witney Oxfordshire",
  "Bicester Oxfordshire", "Thame Oxfordshire",
  "Henley-on-Thames Oxfordshire", "Wantage Oxfordshire",
  "Faringdon Oxfordshire", "Wallingford Oxfordshire",
  "Chipping Norton Oxfordshire", "Carterton Oxfordshire",
  "Kidlington Oxfordshire", "Woodstock Oxfordshire",
];

const SWINDON_WILTSHIRE_AREAS = [
  "Swindon Town Centre", "Old Town Swindon", "Freshbrook Swindon",
  "Wroughton Swindon", "Highworth Swindon", "Cricklade Wiltshire",
  "Royal Wootton Bassett Wiltshire", "Marlborough Wiltshire",
  "Devizes Wiltshire", "Chippenham Wiltshire", "Corsham Wiltshire",
  "Calne Wiltshire", "Melksham Wiltshire", "Trowbridge Wiltshire",
  "Bradford on Avon Wiltshire", "Westbury Wiltshire",
  "Warminster Wiltshire", "Salisbury Wiltshire",
  "Amesbury Wiltshire", "Tidworth Wiltshire",
  "Andover Hampshire", "Romsey Hampshire",
  // Dorset
  "Dorchester Dorset", "Weymouth Dorset", "Blandford Forum Dorset",
  "Shaftesbury Dorset", "Sherborne Dorset", "Bridport Dorset",
  "Wareham Dorset", "Swanage Dorset", "Ferndown Dorset",
];

const SUFFOLK_NORFOLK_AREAS = [
  "Ipswich Town Centre", "Ipswich East", "Ipswich North",
  "Ipswich West", "Ipswich South",
  "Bury St Edmunds Suffolk", "Lowestoft Suffolk",
  "Haverhill Suffolk", "Sudbury Suffolk",
  "Felixstowe Suffolk", "Stowmarket Suffolk",
  "Newmarket Suffolk", "Leiston Suffolk",
  "Woodbridge Suffolk", "Beccles Suffolk",
  "Eye Suffolk", "Framlingham Suffolk",
  // Norfolk
  "Norwich City Centre", "Norwich East", "Norwich West",
  "Norwich North", "Norwich South",
  "Great Yarmouth Norfolk", "King's Lynn Norfolk",
  "Thetford Norfolk", "Dereham Norfolk",
  "Swaffham Norfolk", "Fakenham Norfolk",
  "Cromer Norfolk", "Sheringham Norfolk",
  "Hunstanton Norfolk", "Downham Market Norfolk",
  "Holt Norfolk", "North Walsham Norfolk",
  "Aylsham Norfolk", "Attleborough Norfolk",
  "Wymondham Norfolk", "Diss Norfolk",
];

const LUTON_BEDS_AREAS = [
  "Luton Town Centre", "Luton North", "Luton East",
  "Luton South", "Luton West", "Dunstable Bedfordshire",
  "Houghton Regis Bedfordshire", "Leighton Buzzard Bedfordshire",
  "Bedford Town Centre", "Bedford North", "Bedford South",
  "Kempston Bedford", "Flitwick Bedfordshire",
  "Ampthill Bedfordshire", "Biggleswade Bedfordshire",
  "Sandy Bedfordshire", "St Neots Bedfordshire",
  "Rushden Bedfordshire", "Wellingborough adjacent",
  "Hitchin Hertfordshire", "Letchworth Hertfordshire",
  "Baldock Hertfordshire", "Royston Hertfordshire",
  "Harpenden Hertfordshire", "Wheathampstead Hertfordshire",
];

const EXETER_DEVON_AREAS = [
  "Exeter City Centre", "Heavitree Exeter", "St Thomas Exeter",
  "Pinhoe Exeter", "Exwick Exeter", "Wonford Exeter",
  "Topsham Exeter", "Alphington Exeter",
  "Exmouth Devon", "Budleigh Salterton Devon",
  "Sidmouth Devon", "Honiton Devon", "Axminster Devon",
  "Newton Abbot Devon", "Totnes Devon",
  "Paignton Devon", "Torquay Devon", "Brixham Devon",
  "Dawlish Devon", "Teignmouth Devon",
  "Ashburton Devon", "Buckfastleigh Devon",
  "Tavistock Devon", "Okehampton Devon",
  "Ivybridge Devon", "Kingsbridge Devon",
  "Salcombe Devon", "Dartmouth Devon",
  "Crediton Devon", "Cullompton Devon",
  "Tiverton Devon", "Bideford Devon",
  "Barnstaple Devon", "Ilfracombe Devon",
  "South Molton Devon", "Great Torrington Devon",
  "Holsworthy Devon",
];

const CORNWALL_AREAS = [
  "Truro Cornwall", "Falmouth Cornwall", "Penryn Cornwall",
  "Penzance Cornwall", "St Ives Cornwall", "Hayle Cornwall",
  "Camborne Cornwall", "Redruth Cornwall",
  "Newquay Cornwall", "Perranporth Cornwall",
  "St Austell Cornwall", "Mevagissey Cornwall",
  "Fowey Cornwall", "Looe Cornwall",
  "Bodmin Cornwall", "Launceston Cornwall",
  "Wadebridge Cornwall", "Padstow Cornwall",
  "Bude Cornwall", "Holsworthy adjacent Cornwall",
  "Helston Cornwall", "Porthleven Cornwall",
  "Liskeard Cornwall", "Saltash Cornwall",
  "Torpoint Cornwall",
];

const SOMERSET_AREAS = [
  "Taunton Town Centre", "Taunton East", "Taunton West",
  "Bridgwater Somerset", "Burnham-on-Sea Somerset",
  "Minehead Somerset", "Wellington Somerset",
  "Chard Somerset", "Ilminster Somerset",
  "Yeovil Somerset", "Crewkerne Somerset",
  "Shepton Mallet Somerset", "Wells Somerset",
  "Glastonbury Somerset", "Street Somerset",
  "Frome Somerset", "Midsomer Norton Somerset",
  "Radstock Somerset", "Keynsham Somerset",
  "Clevedon Somerset", "Nailsea Somerset",
  "Portishead Somerset",
];

const WORCESTERSHIRE_AREAS = [
  "Worcester City Centre", "Worcester North", "Worcester South",
  "Worcester East", "Worcester West",
  "Kidderminster Worcestershire", "Stourport-on-Severn Worcestershire",
  "Bewdley Worcestershire", "Redditch Worcestershire",
  "Bromsgrove Worcestershire", "Droitwich Worcestershire",
  "Malvern Worcestershire", "Pershore Worcestershire",
  "Evesham Worcestershire", "Upton upon Severn Worcestershire",
  "Tenbury Wells Worcestershire", "Bewdley adjacent Worcestershire",
];

const STAFFORDSHIRE_AREAS = [
  "Stafford Town Centre", "Stafford North", "Stafford South",
  "Stone Staffordshire", "Uttoxeter Staffordshire",
  "Rugeley Staffordshire", "Cannock Staffordshire",
  "Hednesford Staffordshire", "Burntwood Staffordshire",
  "Lichfield Staffordshire", "Tamworth Staffordshire",
  "Burton upon Trent Staffordshire", "Swadlincote adjacent",
  "Leek Staffordshire", "Cheadle Staffordshire",
  "Newcastle-under-Lyme Staffordshire",
  "Kidsgrove Staffordshire", "Biddulph Staffordshire",
  "Stoke-on-Trent City Centre", "Hanley Stoke-on-Trent",
  "Longton Stoke-on-Trent", "Fenton Stoke-on-Trent",
  "Burslem Stoke-on-Trent", "Tunstall Stoke-on-Trent",
];

const NORTHERN_IRELAND_AREAS = [
  "Derry City Centre", "Waterside Derry",
  "Lisburn City Centre", "Lisburn East", "Lisburn West",
  "Newry City Centre", "Newry South",
  "Bangor County Down", "Holywood County Down",
  "Newtownards County Down", "Donaghadee County Down",
  "Ballynahinch County Down", "Downpatrick County Down",
  "Newcastle County Down", "Newcastown Down",
  "Newtownabbey Antrim", "Carrickfergus Antrim",
  "Larne Antrim", "Ballymena Antrim",
  "Ballymoney Antrim", "Coleraine Antrim",
  "Portrush Antrim", "Portstewart Antrim",
  "Antrim Town", "Randalstown Antrim",
  "Armagh City", "Portadown Armagh",
  "Lurgan Armagh", "Craigavon Armagh",
  "Dungannon Tyrone", "Cookstown Tyrone",
  "Strabane Tyrone", "Omagh Tyrone",
  "Enniskillen Fermanagh",
];

const CHESTER_CHESHIRE_AREAS = [
  "Chester City Centre", "Chester North", "Chester South",
  "Ellesmere Port Cheshire", "Neston Cheshire",
  "Northwich Cheshire", "Winsford Cheshire",
  "Middlewich Cheshire", "Sandbach Cheshire",
  "Congleton Cheshire", "Macclesfield Cheshire",
  "Wilmslow Cheshire", "Knutsford Cheshire",
  "Alderley Edge Cheshire", "Handforth Cheshire",
  "Crewe Cheshire", "Nantwich Cheshire",
  "Tarporley Cheshire", "Frodsham Cheshire",
  "Helsby Cheshire", "Weaverham Cheshire",
  "Warrington Cheshire",
];

const GLOUCESTER_AREAS = [
  "Gloucester City Centre", "Gloucester North",
  "Gloucester East", "Gloucester South",
  "Quedgeley Gloucester", "Hucclecote Gloucester",
  "Longlevens Gloucester", "Tuffley Gloucester",
  "Stroud Gloucestershire", "Nailsworth Gloucestershire",
  "Dursley Gloucestershire", "Wotton-under-Edge Gloucestershire",
  "Cam Gloucestershire", "Cirencester Gloucestershire",
  "Tetbury Gloucestershire", "Moreton-in-Marsh Gloucestershire",
  "Stow-on-the-Wold Gloucestershire", "Bourton-on-the-Water Gloucestershire",
  "Tewkesbury Gloucestershire", "Bishops Cleeve Gloucestershire",
  "Winchcombe Gloucestershire", "Lydney Gloucestershire",
  "Cinderford Gloucestershire", "Ross-on-Wye Herefordshire",
];

const ALL_AREAS = [
  ...COVENTRY_AREAS,
  ...OXFORD_AREAS,
  ...SWINDON_WILTSHIRE_AREAS,
  ...SUFFOLK_NORFOLK_AREAS,
  ...LUTON_BEDS_AREAS,
  ...EXETER_DEVON_AREAS,
  ...CORNWALL_AREAS,
  ...SOMERSET_AREAS,
  ...WORCESTERSHIRE_AREAS,
  ...STAFFORDSHIRE_AREAS,
  ...NORTHERN_IRELAND_AREAS,
  ...CHESTER_CHESHIRE_AREAS,
  ...GLOUCESTER_AREAS,
];

// ─────────────────────────────────────────────────────────────────────────────
// Coordinate grid — dense, targeted to gap regions
// ─────────────────────────────────────────────────────────────────────────────
const GRID_POINTS: Array<{ label: string; lat: number; lng: number }> = [
  // ── Coventry / Warwickshire ─────────────────────────────────────────────
  { label: "Coventry City Centre",      lat: 52.4068, lng: -1.5197 },
  { label: "Coventry North",            lat: 52.4400, lng: -1.5100 },
  { label: "Coventry East",             lat: 52.4100, lng: -1.4700 },
  { label: "Coventry South",            lat: 52.3800, lng: -1.5300 },
  { label: "Coventry West / Canley",    lat: 52.4000, lng: -1.5700 },
  { label: "Bedworth",                  lat: 52.4770, lng: -1.4770 },
  { label: "Nuneaton",                  lat: 52.5220, lng: -1.4660 },
  { label: "Leamington Spa",            lat: 52.2846, lng: -1.5200 },
  { label: "Warwick",                   lat: 52.2793, lng: -1.5847 },
  { label: "Kenilworth",                lat: 52.3420, lng: -1.5700 },
  { label: "Stratford-upon-Avon",       lat: 52.1935, lng: -1.7079 },
  { label: "Rugby",                     lat: 52.3700, lng: -1.2660 },

  // ── Oxford / Oxfordshire ────────────────────────────────────────────────
  { label: "Oxford City Centre",        lat: 51.7520, lng: -1.2577 },
  { label: "Oxford East / Cowley",      lat: 51.7400, lng: -1.2100 },
  { label: "Oxford North / Summertown", lat: 51.7750, lng: -1.2620 },
  { label: "Oxford West / Botley",      lat: 51.7500, lng: -1.2950 },
  { label: "Abingdon",                  lat: 51.6740, lng: -1.2820 },
  { label: "Didcot",                    lat: 51.6060, lng: -1.2410 },
  { label: "Banbury",                   lat: 52.0630, lng: -1.3400 },
  { label: "Bicester",                  lat: 51.8990, lng: -1.1530 },
  { label: "Witney",                    lat: 51.7840, lng: -1.4850 },
  { label: "Kidlington / Woodstock",    lat: 51.8210, lng: -1.2870 },
  { label: "Henley-on-Thames",          lat: 51.5360, lng: -0.9040 },
  { label: "Wantage / Faringdon",       lat: 51.5880, lng: -1.4270 },

  // ── Swindon / Wiltshire ─────────────────────────────────────────────────
  { label: "Swindon Town Centre",       lat: 51.5584, lng: -1.7837 },
  { label: "Swindon North",             lat: 51.5900, lng: -1.7900 },
  { label: "Swindon East",              lat: 51.5600, lng: -1.7400 },
  { label: "Swindon South / Wroughton", lat: 51.5300, lng: -1.7900 },
  { label: "Chippenham",                lat: 51.4587, lng: -2.1157 },
  { label: "Trowbridge",                lat: 51.3197, lng: -2.2090 },
  { label: "Devizes",                   lat: 51.3510, lng: -1.9960 },
  { label: "Marlborough",               lat: 51.4200, lng: -1.7290 },
  { label: "Salisbury",                 lat: 51.0693, lng: -1.7944 },
  { label: "Amesbury / Tidworth",       lat: 51.1750, lng: -1.7780 },
  { label: "Warminster",                lat: 51.2050, lng: -2.1790 },
  { label: "Melksham / Corsham",        lat: 51.3820, lng: -2.1420 },
  // Dorset
  { label: "Dorchester",                lat: 50.7154, lng: -2.4366 },
  { label: "Weymouth",                  lat: 50.6136, lng: -2.4587 },
  { label: "Blandford / Shaftesbury",   lat: 50.8560, lng: -2.1580 },
  { label: "Sherborne / Yeovil border", lat: 50.9470, lng: -2.5120 },
  { label: "Bridport / Beaminster",     lat: 50.7330, lng: -2.7570 },
  { label: "Wareham / Swanage",         lat: 50.6870, lng: -2.1130 },
  { label: "Ferndown / Wimborne",       lat: 50.7840, lng: -1.9000 },

  // ── Suffolk / Norfolk ────────────────────────────────────────────────────
  { label: "Ipswich Town Centre",       lat: 52.0567, lng:  1.1482 },
  { label: "Ipswich North",             lat: 52.0900, lng:  1.1500 },
  { label: "Ipswich East",              lat: 52.0600, lng:  1.2000 },
  { label: "Ipswich South / Felixstowe", lat: 52.0000, lng: 1.2500 },
  { label: "Bury St Edmunds",           lat: 52.2430, lng:  0.7150 },
  { label: "Newmarket",                 lat: 52.2430, lng:  0.4070 },
  { label: "Haverhill / Sudbury",       lat: 52.0800, lng:  0.6600 },
  { label: "Lowestoft",                 lat: 52.4772, lng:  1.7509 },
  { label: "Beccles / Bungay",          lat: 52.4580, lng:  1.5640 },
  { label: "Stowmarket / Eye",          lat: 52.1900, lng:  1.0000 },
  { label: "Woodbridge / Leiston",      lat: 52.0950, lng:  1.3200 },
  // Norfolk
  { label: "Norwich City Centre",       lat: 52.6309, lng:  1.2974 },
  { label: "Norwich East",              lat: 52.6300, lng:  1.3500 },
  { label: "Norwich West",              lat: 52.6300, lng:  1.2200 },
  { label: "Norwich North",             lat: 52.6600, lng:  1.2900 },
  { label: "Norwich South",             lat: 52.5900, lng:  1.2900 },
  { label: "Great Yarmouth",            lat: 52.6080, lng:  1.7290 },
  { label: "Gorleston",                 lat: 52.5750, lng:  1.7300 },
  { label: "King's Lynn",               lat: 52.7540, lng:  0.4000 },
  { label: "Thetford / Dereham",        lat: 52.4200, lng:  0.8700 },
  { label: "Swaffham / Fakenham",       lat: 52.6700, lng:  0.6800 },
  { label: "Cromer / Sheringham",       lat: 52.9340, lng:  1.3000 },
  { label: "North Walsham / Aylsham",   lat: 52.8200, lng:  1.3900 },
  { label: "Attleborough / Wymondham",  lat: 52.5200, lng:  1.0200 },
  { label: "Diss / Harleston",          lat: 52.3750, lng:  1.1200 },

  // ── Luton / Bedfordshire ─────────────────────────────────────────────────
  { label: "Luton Town Centre",         lat: 51.8787, lng: -0.4200 },
  { label: "Luton North / Dunstable",   lat: 51.9100, lng: -0.5000 },
  { label: "Luton East",                lat: 51.8900, lng: -0.3800 },
  { label: "Luton South",               lat: 51.8500, lng: -0.4300 },
  { label: "Bedford Town Centre",       lat: 52.1360, lng: -0.4680 },
  { label: "Bedford North",             lat: 52.1700, lng: -0.4700 },
  { label: "Bedford South / Kempston",  lat: 52.1000, lng: -0.4900 },
  { label: "Leighton Buzzard",          lat: 51.9160, lng: -0.6600 },
  { label: "Flitwick / Ampthill",       lat: 52.0050, lng: -0.4960 },
  { label: "Biggleswade / Sandy",       lat: 52.0860, lng: -0.2640 },
  { label: "St Neots",                  lat: 52.2280, lng: -0.2700 },
  { label: "Hitchin / Letchworth",      lat: 51.9470, lng: -0.2800 },
  { label: "Baldock / Royston",         lat: 51.9900, lng: -0.1800 },

  // ── Exeter / Devon ───────────────────────────────────────────────────────
  { label: "Exeter City Centre",        lat: 50.7184, lng: -3.5339 },
  { label: "Exeter North / Pinhoe",     lat: 50.7450, lng: -3.4900 },
  { label: "Exeter East / Heavitree",   lat: 50.7250, lng: -3.5000 },
  { label: "Exeter South / Alphington", lat: 50.6980, lng: -3.5500 },
  { label: "Exmouth / Budleigh",        lat: 50.6200, lng: -3.4100 },
  { label: "Sidmouth / Honiton",        lat: 50.6800, lng: -3.2200 },
  { label: "Axminster / Axe Valley",    lat: 50.7800, lng: -3.0000 },
  { label: "Newton Abbot",              lat: 50.5270, lng: -3.6080 },
  { label: "Torquay",                   lat: 50.4619, lng: -3.5253 },
  { label: "Paignton / Brixham",        lat: 50.4350, lng: -3.5600 },
  { label: "Totnes / Dartmouth",        lat: 50.4320, lng: -3.6870 },
  { label: "Kingsbridge / Salcombe",    lat: 50.2840, lng: -3.7760 },
  { label: "Tavistock",                 lat: 50.5500, lng: -4.1450 },
  { label: "Okehampton / North Dartmoor", lat: 50.7360, lng: -3.9960 },
  { label: "Crediton / Tiverton",       lat: 50.8800, lng: -3.6500 },
  { label: "Cullompton / Tiverton East", lat: 50.8600, lng: -3.4000 },
  { label: "Barnstaple",                lat: 51.0820, lng: -4.0580 },
  { label: "Bideford / Northam",        lat: 51.0140, lng: -4.2030 },
  { label: "Ilfracombe",                lat: 51.2090, lng: -4.1210 },
  { label: "South Molton / Torrington", lat: 51.0100, lng: -3.9200 },

  // ── Cornwall ─────────────────────────────────────────────────────────────
  { label: "Truro",                     lat: 50.2632, lng: -5.0510 },
  { label: "Falmouth / Penryn",         lat: 50.1520, lng: -5.0710 },
  { label: "Penzance",                  lat: 50.1188, lng: -5.5370 },
  { label: "St Ives / Hayle",           lat: 50.2120, lng: -5.4800 },
  { label: "Camborne / Redruth",        lat: 50.2150, lng: -5.2900 },
  { label: "Helston / Porthleven",      lat: 50.1030, lng: -5.2700 },
  { label: "Newquay",                   lat: 50.4120, lng: -5.0834 },
  { label: "St Austell",                lat: 50.3400, lng: -4.7940 },
  { label: "Bodmin",                    lat: 50.4710, lng: -4.7180 },
  { label: "Wadebridge / Padstow",      lat: 50.5200, lng: -4.8300 },
  { label: "Launceston",                lat: 50.6370, lng: -4.3590 },
  { label: "Bude",                      lat: 50.8285, lng: -4.5430 },
  { label: "Liskeard / Looe",           lat: 50.4530, lng: -4.4650 },
  { label: "Saltash / Torpoint",        lat: 50.4080, lng: -4.2220 },

  // ── Somerset ─────────────────────────────────────────────────────────────
  { label: "Taunton Town Centre",       lat: 51.0188, lng: -3.1006 },
  { label: "Taunton North",             lat: 51.0450, lng: -3.1000 },
  { label: "Taunton South / Wellington", lat: 50.9900, lng: -3.1500 },
  { label: "Bridgwater",                lat: 51.1280, lng: -2.9940 },
  { label: "Burnham-on-Sea",            lat: 51.2390, lng: -3.0000 },
  { label: "Minehead / Watchet",        lat: 51.2040, lng: -3.4720 },
  { label: "Chard / Ilminster",         lat: 50.8730, lng: -2.9600 },
  { label: "Yeovil",                    lat: 50.9400, lng: -2.6380 },
  { label: "Crewkerne / Sherborne border", lat: 50.8800, lng: -2.7960 },
  { label: "Wells / Glastonbury",       lat: 51.2090, lng: -2.6450 },
  { label: "Frome",                     lat: 51.2290, lng: -2.3240 },
  { label: "Shepton Mallet / Street",   lat: 51.1900, lng: -2.5500 },
  { label: "Midsomer Norton / Radstock", lat: 51.2840, lng: -2.4820 },
  { label: "Clevedon / Portishead",     lat: 51.4370, lng: -2.8590 },
  { label: "Nailsea / Backwell",        lat: 51.4280, lng: -2.7600 },

  // ── Worcestershire ───────────────────────────────────────────────────────
  { label: "Worcester City Centre",     lat: 52.1920, lng: -2.2200 },
  { label: "Worcester North",           lat: 52.2250, lng: -2.2200 },
  { label: "Worcester South",           lat: 52.1550, lng: -2.2100 },
  { label: "Worcester East",            lat: 52.1950, lng: -2.1600 },
  { label: "Kidderminster",             lat: 52.3890, lng: -2.2490 },
  { label: "Stourport-on-Severn",       lat: 52.3380, lng: -2.2800 },
  { label: "Redditch",                  lat: 52.3080, lng: -1.9460 },
  { label: "Bromsgrove",                lat: 52.3350, lng: -2.0570 },
  { label: "Droitwich",                 lat: 52.2670, lng: -2.1520 },
  { label: "Malvern",                   lat: 52.1140, lng: -2.3210 },
  { label: "Evesham / Pershore",        lat: 52.0920, lng: -1.9470 },
  { label: "Tenbury Wells",             lat: 52.3070, lng: -2.5930 },

  // ── Staffordshire ────────────────────────────────────────────────────────
  { label: "Stafford Town Centre",      lat: 52.8056, lng: -2.1162 },
  { label: "Stafford North",            lat: 52.8350, lng: -2.1200 },
  { label: "Stafford South",            lat: 52.7750, lng: -2.1200 },
  { label: "Stone / Uttoxeter",         lat: 52.9000, lng: -2.1500 },
  { label: "Rugeley / Cannock",         lat: 52.7570, lng: -1.9360 },
  { label: "Lichfield",                 lat: 52.6835, lng: -1.8270 },
  { label: "Tamworth",                  lat: 52.6330, lng: -1.6930 },
  { label: "Burton upon Trent",         lat: 52.8060, lng: -1.6380 },
  { label: "Leek",                      lat: 53.1070, lng: -2.0230 },
  { label: "Newcastle-under-Lyme",      lat: 53.0110, lng: -2.2280 },
  { label: "Kidsgrove / Biddulph",      lat: 53.0870, lng: -2.2460 },
  { label: "Stoke-on-Trent Hanley",     lat: 53.0257, lng: -2.1742 },
  { label: "Stoke-on-Trent Longton",    lat: 52.9894, lng: -2.1238 },
  { label: "Stoke-on-Trent Tunstall",   lat: 53.0640, lng: -2.2000 },

  // ── Northern Ireland ─────────────────────────────────────────────────────
  { label: "Derry City Centre",         lat: 54.9966, lng: -7.3086 },
  { label: "Derry West / Waterside",    lat: 55.0050, lng: -7.2850 },
  { label: "Lisburn City Centre",       lat: 54.5162, lng: -6.0580 },
  { label: "Lisburn East",              lat: 54.5000, lng: -6.0200 },
  { label: "Newry City Centre",         lat: 54.1754, lng: -6.3400 },
  { label: "Bangor / Holywood",         lat: 54.6536, lng: -5.6690 },
  { label: "Newtownards",               lat: 54.5935, lng: -5.6920 },
  { label: "Downpatrick / Ballynahinch", lat: 54.3270, lng: -5.8130 },
  { label: "Newtownabbey",              lat: 54.6654, lng: -5.9350 },
  { label: "Carrickfergus / Larne",     lat: 54.7160, lng: -5.8060 },
  { label: "Ballymena",                 lat: 54.8625, lng: -6.2740 },
  { label: "Coleraine",                 lat: 55.1322, lng: -6.6650 },
  { label: "Antrim Town",               lat: 54.7188, lng: -6.2080 },
  { label: "Portadown / Lurgan",        lat: 54.4280, lng: -6.4490 },
  { label: "Armagh City",               lat: 54.3505, lng: -6.6554 },
  { label: "Dungannon / Cookstown",     lat: 54.5120, lng: -6.7570 },
  { label: "Omagh",                     lat: 54.5977, lng: -7.2959 },
  { label: "Enniskillen",               lat: 54.3447, lng: -7.6320 },
  { label: "Strabane",                  lat: 54.8260, lng: -7.4660 },

  // ── Chester / Cheshire West ──────────────────────────────────────────────
  { label: "Chester City Centre",       lat: 53.1905, lng: -2.8910 },
  { label: "Chester East",              lat: 53.1900, lng: -2.8300 },
  { label: "Chester South",             lat: 53.1600, lng: -2.9200 },
  { label: "Ellesmere Port",            lat: 53.2790, lng: -2.8980 },
  { label: "Northwich",                 lat: 53.2590, lng: -2.5180 },
  { label: "Winsford / Middlewich",     lat: 53.2020, lng: -2.5100 },
  { label: "Crewe",                     lat: 53.0994, lng: -2.4413 },
  { label: "Nantwich / Sandbach",       lat: 53.0660, lng: -2.5200 },
  { label: "Congleton",                 lat: 53.1630, lng: -2.2200 },
  { label: "Macclesfield",              lat: 53.2580, lng: -2.1270 },
  { label: "Wilmslow / Alderley Edge",  lat: 53.3290, lng: -2.2300 },
  { label: "Knutsford",                 lat: 53.3020, lng: -2.3720 },

  // ── Gloucester / Gloucestershire ─────────────────────────────────────────
  { label: "Gloucester City Centre",    lat: 51.8642, lng: -2.2385 },
  { label: "Gloucester North",          lat: 51.8900, lng: -2.2400 },
  { label: "Gloucester South",          lat: 51.8350, lng: -2.2500 },
  { label: "Gloucester East / Hucclecote", lat: 51.8600, lng: -2.1900 },
  { label: "Stroud",                    lat: 51.7450, lng: -2.2160 },
  { label: "Cirencester",               lat: 51.7152, lng: -1.9659 },
  { label: "Tewkesbury",                lat: 51.9890, lng: -2.1570 },
  { label: "Lydney / Cinderford",       lat: 51.7270, lng: -2.5300 },
  { label: "Stow / Bourton",            lat: 51.9290, lng: -1.7250 },
  { label: "Tetbury / Dursley",         lat: 51.6250, lng: -2.2000 },
];

// ─────────────────────────────────────────────────────────────────────────────
// Search queries — 7 types, same as all other scrapers
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
// Chain filter — expanded list
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
// SerpAPI
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
      if (attempt < retries) { await sleep(Math.min(5000 * attempt, 20000)); }
      else throw err;
    }
  }
  throw new Error("exhausted retries");
}

function normalise(r: any): NormalisedPlace | null {
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
    return (data.local_results || []).map(normalise).filter(Boolean) as NormalisedPlace[];
  } catch (err) { console.warn(`  ⚠  SerpAPI error: ${err}`); return []; }
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
    return (data.local_results || []).map(normalise).filter(Boolean) as NormalisedPlace[];
  } catch (err) { console.warn(`  ⚠  SerpAPI error: ${err}`); return []; }
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
const PROGRESS_FILE = "/tmp/uk-gaps-2-progress.json";
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
// Process batch — quality gate: skip if no phone AND no website (junk listing)
// ─────────────────────────────────────────────────────────────────────────────
async function processBatch(results: NormalisedPlace[], areaLabel: string, seen: Set<string>) {
  for (const place of results) {
    if (seen.has(place.placeId)) continue;
    if (isChain(place.name)) { console.log(`   ⛔ Chain: ${place.name}`); continue; }

    // Quality gate — must have phone OR website to be worth saving
    if (!place.phone && !place.website) {
      console.log(`   ⚠  Skipped (no contact info): ${place.name}`);
      continue;
    }

    seen.add(place.placeId);

    const email = await extractEmailFromWebsite(place.website || "");
    console.log(`   ✅ ${place.name} | ${place.phone || "no phone"} | ${email ? `📧 ${email}` : "—"}`);

    try {
      await (prisma as any).locksmithLead.upsert({
        where: { googlePlaceId: place.placeId },
        update: {
          name: place.name, city: areaLabel, address: place.address,
          phone: place.phone || null, email: email || null,
          website: place.website || null,
          rating: place.rating || 0, reviewCount: place.reviewCount || 0,
        },
        create: {
          googlePlaceId: place.placeId, name: place.name, city: areaLabel,
          address: place.address,
          phone: place.phone || null, email: email || null,
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
    { name: "Coventry + Warwickshire",       count: COVENTRY_AREAS.length },
    { name: "Oxford + Oxfordshire",          count: OXFORD_AREAS.length },
    { name: "Swindon + Wiltshire + Dorset",  count: SWINDON_WILTSHIRE_AREAS.length },
    { name: "Suffolk + Norfolk",             count: SUFFOLK_NORFOLK_AREAS.length },
    { name: "Luton + Bedfordshire",          count: LUTON_BEDS_AREAS.length },
    { name: "Exeter + Devon (full county)",  count: EXETER_DEVON_AREAS.length },
    { name: "Cornwall",                      count: CORNWALL_AREAS.length },
    { name: "Somerset",                      count: SOMERSET_AREAS.length },
    { name: "Worcester + Worcestershire",    count: WORCESTERSHIRE_AREAS.length },
    { name: "Stafford + Staffordshire",      count: STAFFORDSHIRE_AREAS.length },
    { name: "Northern Ireland",              count: NORTHERN_IRELAND_AREAS.length },
    { name: "Chester + Cheshire West",       count: CHESTER_CHESHIRE_AREAS.length },
    { name: "Gloucester + Gloucestershire",  count: GLOUCESTER_AREAS.length },
  ];

  console.log("🎯  UK Coverage Gaps — targeted locksmith scrape\n");
  regions.forEach(r => console.log(`   ${r.name.padEnd(36)} ${r.count} areas`));
  console.log(`\n   Total named areas  : ${ALL_AREAS.length} × 7 query types`);
  console.log(`   Grid points        : ${GRID_POINTS.length}`);
  console.log(`   Quality gate       : must have phone OR website`);
  console.log(`   Email enrichment   : ${doEnrich ? "enabled" : "disabled (pass --enrich)"}`);
  console.log(`   Resume             : ${isResume ? "yes" : "no"}\n`);

  const completed = isResume ? loadCompleted() : [];
  const seen = new Set<string>();
  const existing = await (prisma as any).locksmithLead.findMany({ select: { googlePlaceId: true } });
  for (const r of existing) seen.add(r.googlePlaceId);
  console.log(`   Existing DB records: ${seen.size} (will skip)\n`);

  // ── PHASE 1: Named area text searches ─────────────────────────────────────
  console.log("═══════════════════════════════════════════════════════");
  console.log("  PHASE 1 — Named area text searches (7 query types)");
  console.log("═══════════════════════════════════════════════════════\n");

  for (const area of ALL_AREAS) {
    if (isResume && completed.includes(area)) { console.log(`   ⏭  ${area}`); continue; }
    console.log(`\n📍 ${area}`);
    try {
      for (const buildQuery of SEARCH_QUERIES) {
        const query = buildQuery(area);
        for (const start of [0, 20, 40]) {
          const results = await textSearch(query, start);
          await processBatch(results, area, seen);
          if (results.length < 20) break;
          await sleep(1000);
        }
        await sleep(400);
      }
      markDone(area, completed);
    } catch (err) {
      console.error(`   ❌ ${area}: ${err}`);
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
      console.error(`   ❌ ${point.label}: ${err}`);
    }
  }

  const dbTotal = await (prisma as any).locksmithLead.count();
  console.log("\n═══════════════════════════════════════════════════════");
  console.log(`   Saved this run : ${totalSaved}`);
  console.log(`   DB total now   : ${dbTotal}`);
  console.log("═══════════════════════════════════════════════════════\n");

  // ── Email enrichment ──────────────────────────────────────────────────────
  if (doEnrich) {
    console.log("\n📧  Email enrichment — all leads with website but no email…\n");
    const targets = await (prisma as any).locksmithLead.findMany({
      where: { email: { equals: null }, website: { not: null } },
      select: { id: true, name: true, website: true },
    });
    console.log(`   ${targets.length} leads to enrich`);
    let enriched = 0;
    for (let i = 0; i < targets.length; i++) {
      if (i % 25 === 0) console.log(`   Progress: ${i}/${targets.length} (enriched ${enriched} so far)…`);
      try {
        const email = await extractEmailFromWebsite(targets[i].website);
        if (email) {
          await (prisma as any).locksmithLead.update({ where: { id: targets[i].id }, data: { email } });
          console.log(`   📧 ${targets[i].name} → ${email}`);
          enriched++;
        }
      } catch {}
      await sleep(250);
    }
    console.log(`\n   Enriched: ${enriched} leads with email`);
  }

  // ── Notify intake ─────────────────────────────────────────────────────────
  if (totalSaved > 0) {
    const batchId = `uk-gaps-${Date.now()}`;
    try {
      const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.locksafe.uk").replace(/\/$/, "");
      const cronSecret = process.env.CRON_SECRET || "";
      const intakeRes = await fetch(`${siteUrl}/api/admin/leads/intake`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-cron-secret": cronSecret },
        body: JSON.stringify({ batchId, leadCount: totalSaved, source: "uk-gaps-scraper" }),
      });
      if (intakeRes.ok) {
        const d = await intakeRes.json();
        console.log(`\n📡 Intake notified — batch ${batchId}: ${d.message}`);
        console.log(`   Queue depth: ${d.queue?.totalUncontacted ?? "?"} uncontacted`);
      } else {
        console.warn(`⚠️  Intake failed: HTTP ${intakeRes.status}`);
      }
    } catch (err) {
      console.error("⚠️  Intake error:", err);
    }
  }

  console.log("🎉  UK coverage gaps scrape complete!\n");
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
