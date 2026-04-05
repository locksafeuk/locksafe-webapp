// Comprehensive UK Cities Data for SEO-optimized locksmith landing pages
// Covers all major UK cities and regions for targeted local SEO

export interface CityData {
  slug: string;
  name: string;
  region: string;
  county: string;
  population: string;
  postcodeAreas: string[];
  areas: string[];
  landmarks: string[];
  description: string;
  emergencyContext: string;
  avgResponseTime: string;
  nearbyPostcodes: string[];
  coordinates: {
    lat: number;
    lng: number;
  };
  localTips: string[];
  transportHubs: string[];
}

// All major UK cities with comprehensive data
export const ukCitiesData: Record<string, CityData> = {
  // ENGLAND - LONDON & SOUTH EAST
  "london": {
    slug: "london",
    name: "London",
    region: "Greater London",
    county: "Greater London",
    population: "9 million",
    postcodeAreas: ["E", "EC", "N", "NW", "SE", "SW", "W", "WC"],
    areas: [
      "Westminster", "Camden", "Islington", "Hackney", "Tower Hamlets",
      "Southwark", "Lambeth", "Wandsworth", "Kensington", "Hammersmith",
      "Greenwich", "Lewisham", "Croydon", "Bromley", "Bexley"
    ],
    landmarks: [
      "Big Ben", "Tower of London", "Buckingham Palace", "London Eye",
      "The Shard", "Tower Bridge", "St Paul's Cathedral"
    ],
    description: "the capital city of the United Kingdom",
    emergencyContext: "Central London and all 32 boroughs",
    avgResponseTime: "15-30 minutes",
    nearbyPostcodes: ["RM", "IG", "EN", "HA", "UB", "TW", "KT", "CR", "BR", "DA"],
    coordinates: { lat: 51.5074, lng: -0.1278 },
    localTips: [
      "Coverage across all London boroughs",
      "Zone 1-6 rapid response network",
      "Familiar with period properties and modern developments"
    ],
    transportHubs: ["Heathrow", "King's Cross", "Victoria", "Waterloo", "Liverpool Street"]
  },

  // NORTH WEST ENGLAND
  "manchester": {
    slug: "manchester",
    name: "Manchester",
    region: "North West England",
    county: "Greater Manchester",
    population: "2.8 million",
    postcodeAreas: ["M"],
    areas: [
      "City Centre", "Salford", "Trafford", "Stockport", "Oldham",
      "Bolton", "Bury", "Rochdale", "Wigan", "Tameside",
      "Didsbury", "Chorlton", "Ancoats", "Northern Quarter"
    ],
    landmarks: [
      "Old Trafford", "Etihad Stadium", "Manchester Cathedral",
      "MediaCityUK", "Piccadilly Gardens", "Arndale Centre"
    ],
    description: "the vibrant heart of the North West",
    emergencyContext: "Manchester city centre and Greater Manchester",
    avgResponseTime: "15-25 minutes",
    nearbyPostcodes: ["SK", "BL", "OL", "WN", "WA"],
    coordinates: { lat: 53.4808, lng: -2.2426 },
    localTips: [
      "Quick M60 motorway access",
      "Know the student areas well",
      "Experience with Victorian terraces"
    ],
    transportHubs: ["Manchester Airport", "Piccadilly Station", "Victoria Station"]
  },

  "liverpool": {
    slug: "liverpool",
    name: "Liverpool",
    region: "North West England",
    county: "Merseyside",
    population: "900,000",
    postcodeAreas: ["L"],
    areas: [
      "City Centre", "Anfield", "Everton", "Toxteth", "Wavertree",
      "Allerton", "Aigburth", "Kirkdale", "Walton", "West Derby",
      "Crosby", "Bootle", "Huyton", "Kirkby"
    ],
    landmarks: [
      "The Cavern Club", "Albert Dock", "Liverpool Cathedral",
      "Anfield Stadium", "Pier Head", "Royal Liver Building"
    ],
    description: "the historic port city with rich cultural heritage",
    emergencyContext: "Liverpool city centre and Merseyside",
    avgResponseTime: "15-25 minutes",
    nearbyPostcodes: ["WA", "CH", "PR"],
    coordinates: { lat: 53.4084, lng: -2.9916 },
    localTips: [
      "Know the docklands area",
      "Experience with Georgian properties",
      "Stadium event day expertise"
    ],
    transportHubs: ["Liverpool John Lennon Airport", "Lime Street Station"]
  },

  // WEST MIDLANDS
  "birmingham": {
    slug: "birmingham",
    name: "Birmingham",
    region: "West Midlands",
    county: "West Midlands",
    population: "2.9 million",
    postcodeAreas: ["B"],
    areas: [
      "City Centre", "Edgbaston", "Moseley", "Solihull", "Sutton Coldfield",
      "Erdington", "Handsworth", "Selly Oak", "Kings Heath", "Hall Green",
      "Harborne", "Jewellery Quarter", "Digbeth"
    ],
    landmarks: [
      "Bullring", "Birmingham Library", "Cadbury World",
      "Birmingham Cathedral", "Selfridges Building", "NEC"
    ],
    description: "the UK's second largest city and industrial powerhouse",
    emergencyContext: "Birmingham city centre and West Midlands",
    avgResponseTime: "15-25 minutes",
    nearbyPostcodes: ["CV", "DY", "WS", "WV"],
    coordinates: { lat: 52.4862, lng: -1.8904 },
    localTips: [
      "Quick M6 corridor access",
      "Know the Jewellery Quarter",
      "Experience with canal-side properties"
    ],
    transportHubs: ["Birmingham Airport", "New Street Station", "Moor Street"]
  },

  "coventry": {
    slug: "coventry",
    name: "Coventry",
    region: "West Midlands",
    county: "West Midlands",
    population: "370,000",
    postcodeAreas: ["CV"],
    areas: [
      "City Centre", "Earlsdon", "Coundon", "Stoke", "Wyken",
      "Walsgrave", "Tile Hill", "Canley", "Cheylesmore"
    ],
    landmarks: [
      "Coventry Cathedral", "Transport Museum", "Coventry University",
      "Belgrade Theatre", "Ricoh Arena"
    ],
    description: "the historic city of motors and innovation",
    emergencyContext: "Coventry city centre and surrounding areas",
    avgResponseTime: "15-25 minutes",
    nearbyPostcodes: ["B", "LE", "NN"],
    coordinates: { lat: 52.4068, lng: -1.5197 },
    localTips: [
      "Know the ring road well",
      "University area specialists",
      "Experience with post-war architecture"
    ],
    transportHubs: ["Coventry Station", "Coventry Airport (historical)"]
  },

  "wolverhampton": {
    slug: "wolverhampton",
    name: "Wolverhampton",
    region: "West Midlands",
    county: "West Midlands",
    population: "260,000",
    postcodeAreas: ["WV"],
    areas: [
      "City Centre", "Tettenhall", "Penn", "Wednesfield", "Bilston",
      "Willenhall", "Blakenhall", "Heath Town"
    ],
    landmarks: [
      "Molineux Stadium", "Wolverhampton Art Gallery",
      "Grand Theatre", "Bantock House"
    ],
    description: "a proud Black Country city with industrial heritage",
    emergencyContext: "Wolverhampton and the Black Country",
    avgResponseTime: "15-25 minutes",
    nearbyPostcodes: ["B", "DY", "WS"],
    coordinates: { lat: 52.5870, lng: -2.1288 },
    localTips: [
      "Know Black Country roads",
      "Experience with terraced properties",
      "Quick M54 access"
    ],
    transportHubs: ["Wolverhampton Station"]
  },

  // YORKSHIRE & THE HUMBER
  "leeds": {
    slug: "leeds",
    name: "Leeds",
    region: "Yorkshire and the Humber",
    county: "West Yorkshire",
    population: "800,000",
    postcodeAreas: ["LS"],
    areas: [
      "City Centre", "Headingley", "Chapel Allerton", "Roundhay", "Horsforth",
      "Meanwood", "Moortown", "Pudsey", "Morley", "Garforth",
      "Otley", "Wetherby", "Guiseley"
    ],
    landmarks: [
      "Leeds City Centre", "Roundhay Park", "Leeds Corn Exchange",
      "Trinity Leeds", "First Direct Arena", "Leeds Castle"
    ],
    description: "Yorkshire's vibrant business and cultural hub",
    emergencyContext: "Leeds city centre and West Yorkshire",
    avgResponseTime: "15-25 minutes",
    nearbyPostcodes: ["BD", "WF", "HX", "HD"],
    coordinates: { lat: 53.8008, lng: -1.5491 },
    localTips: [
      "Know the student areas",
      "Quick A1/M1 access",
      "Experience with Victorian architecture"
    ],
    transportHubs: ["Leeds Bradford Airport", "Leeds Station"]
  },

  "sheffield": {
    slug: "sheffield",
    name: "Sheffield",
    region: "Yorkshire and the Humber",
    county: "South Yorkshire",
    population: "580,000",
    postcodeAreas: ["S"],
    areas: [
      "City Centre", "Ecclesall", "Crookes", "Broomhill", "Walkley",
      "Hillsborough", "Dore", "Fulwood", "Nether Edge", "Sharrow"
    ],
    landmarks: [
      "Sheffield Cathedral", "Winter Garden", "Meadowhall",
      "Crucible Theatre", "Bramall Lane", "Peak District"
    ],
    description: "the Steel City nestled at the edge of the Peak District",
    emergencyContext: "Sheffield city centre and South Yorkshire",
    avgResponseTime: "15-25 minutes",
    nearbyPostcodes: ["DN", "NG", "DE"],
    coordinates: { lat: 53.3811, lng: -1.4701 },
    localTips: [
      "Know the hills well",
      "Experience with stone-built properties",
      "Student area specialists"
    ],
    transportHubs: ["Sheffield Station", "Meadowhall Interchange"]
  },

  "bradford": {
    slug: "bradford",
    name: "Bradford",
    region: "Yorkshire and the Humber",
    county: "West Yorkshire",
    population: "540,000",
    postcodeAreas: ["BD"],
    areas: [
      "City Centre", "Manningham", "Shipley", "Bingley", "Ilkley",
      "Keighley", "Saltaire", "Thornton", "Heaton"
    ],
    landmarks: [
      "National Science & Media Museum", "Cartwright Hall",
      "Saltaire Village (UNESCO)", "Bradford Cathedral", "Alhambra Theatre"
    ],
    description: "a diverse city with UNESCO heritage and textile history",
    emergencyContext: "Bradford and surrounding West Yorkshire",
    avgResponseTime: "15-25 minutes",
    nearbyPostcodes: ["LS", "HX", "HD"],
    coordinates: { lat: 53.7960, lng: -1.7594 },
    localTips: [
      "Know the heritage areas",
      "Experience with mill conversions",
      "Quick Aire Valley access"
    ],
    transportHubs: ["Bradford Interchange", "Bradford Forster Square"]
  },

  "hull": {
    slug: "hull",
    name: "Hull",
    region: "Yorkshire and the Humber",
    county: "East Riding of Yorkshire",
    population: "260,000",
    postcodeAreas: ["HU"],
    areas: [
      "City Centre", "Cottingham", "Hessle", "Anlaby", "Bransholme",
      "Beverley", "Willerby", "Kirk Ella", "Kingswood"
    ],
    landmarks: [
      "The Deep", "Humber Bridge", "Hull Marina",
      "Ferens Art Gallery", "Hull Minster"
    ],
    description: "the 2017 UK City of Culture with maritime heritage",
    emergencyContext: "Hull and East Yorkshire",
    avgResponseTime: "15-25 minutes",
    nearbyPostcodes: ["DN", "YO"],
    coordinates: { lat: 53.7676, lng: -0.3274 },
    localTips: [
      "Know the dock areas",
      "Experience with period properties",
      "Quick A63/M62 access"
    ],
    transportHubs: ["Hull Paragon Station", "Hull Ferry Terminal"]
  },

  "york": {
    slug: "york",
    name: "York",
    region: "Yorkshire and the Humber",
    county: "North Yorkshire",
    population: "210,000",
    postcodeAreas: ["YO"],
    areas: [
      "City Centre", "Clifton", "Heworth", "Fulford", "Acomb",
      "Bishopthorpe", "Huntington", "Haxby", "Strensall"
    ],
    landmarks: [
      "York Minster", "The Shambles", "York Castle", "Clifford's Tower",
      "National Railway Museum", "York City Walls"
    ],
    description: "the historic Roman and Viking city",
    emergencyContext: "York city centre and North Yorkshire",
    avgResponseTime: "15-30 minutes",
    nearbyPostcodes: ["LS", "HG", "DN"],
    coordinates: { lat: 53.9591, lng: -1.0815 },
    localTips: [
      "Know the medieval streets",
      "Experience with listed buildings",
      "Familiar with flood-prone areas"
    ],
    transportHubs: ["York Station"]
  },

  // NORTH EAST ENGLAND
  "newcastle": {
    slug: "newcastle",
    name: "Newcastle upon Tyne",
    region: "North East England",
    county: "Tyne and Wear",
    population: "300,000",
    postcodeAreas: ["NE"],
    areas: [
      "City Centre", "Jesmond", "Gosforth", "Heaton", "Fenham",
      "Byker", "Walker", "Elswick", "Kenton", "Gateshead"
    ],
    landmarks: [
      "Tyne Bridge", "Newcastle Castle", "St James' Park",
      "Grey's Monument", "Sage Gateshead", "Angel of the North"
    ],
    description: "the vibrant heart of the North East",
    emergencyContext: "Newcastle and Tyneside",
    avgResponseTime: "15-25 minutes",
    nearbyPostcodes: ["SR", "DH", "DL"],
    coordinates: { lat: 54.9783, lng: -1.6178 },
    localTips: [
      "Know the Quayside area",
      "Experience with Tyneside flats",
      "Quick metro network knowledge"
    ],
    transportHubs: ["Newcastle Airport", "Central Station"]
  },

  "sunderland": {
    slug: "sunderland",
    name: "Sunderland",
    region: "North East England",
    county: "Tyne and Wear",
    population: "280,000",
    postcodeAreas: ["SR"],
    areas: [
      "City Centre", "Roker", "Seaburn", "Hendon", "Millfield",
      "Fulwell", "Southwick", "Washington", "Houghton-le-Spring"
    ],
    landmarks: [
      "Stadium of Light", "National Glass Centre", "Roker Pier",
      "Winter Gardens", "Sunderland Museum"
    ],
    description: "a proud coastal city with shipbuilding heritage",
    emergencyContext: "Sunderland and Wearside",
    avgResponseTime: "15-25 minutes",
    nearbyPostcodes: ["NE", "DH"],
    coordinates: { lat: 54.9069, lng: -1.3838 },
    localTips: [
      "Know the coastal areas",
      "Experience with terraced properties",
      "Quick A19 access"
    ],
    transportHubs: ["Sunderland Station"]
  },

  "middlesbrough": {
    slug: "middlesbrough",
    name: "Middlesbrough",
    region: "North East England",
    county: "North Yorkshire",
    population: "140,000",
    postcodeAreas: ["TS"],
    areas: [
      "Town Centre", "Linthorpe", "Acklam", "Marton", "Nunthorpe",
      "Stockton", "Redcar", "Hartlepool"
    ],
    landmarks: [
      "Transporter Bridge", "Middlesbrough Town Hall",
      "Albert Park", "Riverside Stadium"
    ],
    description: "Teesside's industrial heart",
    emergencyContext: "Middlesbrough and Teesside",
    avgResponseTime: "15-25 minutes",
    nearbyPostcodes: ["DL"],
    coordinates: { lat: 54.5742, lng: -1.2350 },
    localTips: [
      "Know the industrial areas",
      "Experience with terraced housing",
      "Quick A66/A19 access"
    ],
    transportHubs: ["Middlesbrough Station", "Durham Tees Valley Airport"]
  },

  // EAST MIDLANDS
  "nottingham": {
    slug: "nottingham",
    name: "Nottingham",
    region: "East Midlands",
    county: "Nottinghamshire",
    population: "330,000",
    postcodeAreas: ["NG"],
    areas: [
      "City Centre", "Beeston", "West Bridgford", "Hucknall", "Arnold",
      "Carlton", "Mapperley", "Sherwood", "The Park", "Lenton"
    ],
    landmarks: [
      "Nottingham Castle", "Old Market Square", "Trent Bridge",
      "City Ground", "Wollaton Hall", "Caves of Nottingham"
    ],
    description: "Robin Hood's legendary city",
    emergencyContext: "Nottingham city centre and Greater Nottingham",
    avgResponseTime: "15-25 minutes",
    nearbyPostcodes: ["DE", "LE", "S"],
    coordinates: { lat: 52.9548, lng: -1.1581 },
    localTips: [
      "Know the Lace Market",
      "Student area expertise",
      "Experience with Victorian architecture"
    ],
    transportHubs: ["East Midlands Airport", "Nottingham Station"]
  },

  "leicester": {
    slug: "leicester",
    name: "Leicester",
    region: "East Midlands",
    county: "Leicestershire",
    population: "350,000",
    postcodeAreas: ["LE"],
    areas: [
      "City Centre", "Oadby", "Wigston", "Beaumont Leys", "Braunstone",
      "Evington", "Knighton", "Stoneygate", "Clarendon Park"
    ],
    landmarks: [
      "King Richard III Visitor Centre", "Leicester Cathedral",
      "King Power Stadium", "New Walk Museum", "Golden Mile"
    ],
    description: "the diverse heart of the East Midlands",
    emergencyContext: "Leicester city centre and Leicestershire",
    avgResponseTime: "15-25 minutes",
    nearbyPostcodes: ["NG", "CV", "NN"],
    coordinates: { lat: 52.6369, lng: -1.1398 },
    localTips: [
      "Know the diverse communities",
      "Experience with Victorian terraces",
      "Quick M1/A46 access"
    ],
    transportHubs: ["Leicester Station", "East Midlands Airport"]
  },

  "derby": {
    slug: "derby",
    name: "Derby",
    region: "East Midlands",
    county: "Derbyshire",
    population: "260,000",
    postcodeAreas: ["DE"],
    areas: [
      "City Centre", "Allestree", "Spondon", "Mickleover", "Littleover",
      "Chaddesden", "Oakwood", "Darley Abbey", "Normanton"
    ],
    landmarks: [
      "Derby Cathedral", "Derby Silk Mill", "Pride Park Stadium",
      "Derwent Valley Mills (UNESCO)", "Arboretum"
    ],
    description: "the gateway to the Peak District",
    emergencyContext: "Derby city centre and Derbyshire",
    avgResponseTime: "15-25 minutes",
    nearbyPostcodes: ["NG", "S", "SK"],
    coordinates: { lat: 52.9225, lng: -1.4746 },
    localTips: [
      "Know the heritage areas",
      "Experience with mill conversions",
      "Quick A38/A52 access"
    ],
    transportHubs: ["Derby Station", "East Midlands Airport"]
  },

  // EAST OF ENGLAND
  "cambridge": {
    slug: "cambridge",
    name: "Cambridge",
    region: "East of England",
    county: "Cambridgeshire",
    population: "145,000",
    postcodeAreas: ["CB"],
    areas: [
      "City Centre", "Newnham", "Chesterton", "Cherry Hinton", "Trumpington",
      "Arbury", "Kings Hedges", "Romsey", "Mill Road"
    ],
    landmarks: [
      "King's College Chapel", "The Backs", "Fitzwilliam Museum",
      "Cambridge University", "Mathematical Bridge", "River Cam"
    ],
    description: "the world-famous university city",
    emergencyContext: "Cambridge city centre and South Cambridgeshire",
    avgResponseTime: "15-25 minutes",
    nearbyPostcodes: ["PE", "SG", "IP"],
    coordinates: { lat: 52.2053, lng: 0.1218 },
    localTips: [
      "Know the college layouts",
      "Experience with listed buildings",
      "Familiar with the Science Park"
    ],
    transportHubs: ["Cambridge Station", "Cambridge North"]
  },

  "norwich": {
    slug: "norwich",
    name: "Norwich",
    region: "East of England",
    county: "Norfolk",
    population: "210,000",
    postcodeAreas: ["NR"],
    areas: [
      "City Centre", "Eaton", "Golden Triangle", "Thorpe St Andrew",
      "Costessey", "Sprowston", "Hellesdon", "Cringleford"
    ],
    landmarks: [
      "Norwich Cathedral", "Norwich Castle", "The Forum",
      "Elm Hill", "Norwich Market", "Carrow Road"
    ],
    description: "England's first UNESCO City of Literature",
    emergencyContext: "Norwich city centre and Norfolk",
    avgResponseTime: "15-30 minutes",
    nearbyPostcodes: ["IP", "PE"],
    coordinates: { lat: 52.6309, lng: 1.2974 },
    localTips: [
      "Know the medieval lanes",
      "Experience with period properties",
      "Familiar with the Broads area"
    ],
    transportHubs: ["Norwich Station", "Norwich Airport"]
  },

  "peterborough": {
    slug: "peterborough",
    name: "Peterborough",
    region: "East of England",
    county: "Cambridgeshire",
    population: "200,000",
    postcodeAreas: ["PE"],
    areas: [
      "City Centre", "Werrington", "Bretton", "Orton", "Stanground",
      "Dogsthorpe", "Longthorpe", "Hampton"
    ],
    landmarks: [
      "Peterborough Cathedral", "Queensgate Shopping Centre",
      "Nene Park", "Flag Fen Bronze Age Centre"
    ],
    description: "a cathedral city with excellent transport links",
    emergencyContext: "Peterborough and surroundings",
    avgResponseTime: "15-25 minutes",
    nearbyPostcodes: ["CB", "NN", "LN"],
    coordinates: { lat: 52.5695, lng: -0.2405 },
    localTips: [
      "Know the new developments",
      "Quick A1/A47 access",
      "Experience with diverse housing"
    ],
    transportHubs: ["Peterborough Station"]
  },

  "ipswich": {
    slug: "ipswich",
    name: "Ipswich",
    region: "East of England",
    county: "Suffolk",
    population: "140,000",
    postcodeAreas: ["IP"],
    areas: [
      "Town Centre", "Christchurch Park", "Rushmere", "Kesgrave",
      "Martlesham", "Felixstowe", "Woodbridge"
    ],
    landmarks: [
      "Christchurch Mansion", "Ipswich Waterfront", "Willis Building",
      "Ancient House", "Portman Road Stadium"
    ],
    description: "Suffolk's county town with maritime heritage",
    emergencyContext: "Ipswich and Suffolk",
    avgResponseTime: "15-30 minutes",
    nearbyPostcodes: ["NR", "CO", "CB"],
    coordinates: { lat: 52.0567, lng: 1.1482 },
    localTips: [
      "Know the waterfront area",
      "Experience with Tudor buildings",
      "Quick A14/A12 access"
    ],
    transportHubs: ["Ipswich Station"]
  },

  // SOUTH EAST ENGLAND
  "brighton": {
    slug: "brighton",
    name: "Brighton & Hove",
    region: "South East England",
    county: "East Sussex",
    population: "290,000",
    postcodeAreas: ["BN"],
    areas: [
      "City Centre", "Hove", "Kemptown", "Preston Park", "Portslade",
      "Hanover", "Seven Dials", "The Lanes", "North Laine"
    ],
    landmarks: [
      "Royal Pavilion", "Brighton Pier", "i360", "The Lanes",
      "Brighton Beach", "North Laine", "Churchill Square"
    ],
    description: "the vibrant seaside city by the sea",
    emergencyContext: "Brighton, Hove and surrounding Sussex",
    avgResponseTime: "15-25 minutes",
    nearbyPostcodes: ["RH", "PO", "TN"],
    coordinates: { lat: 50.8225, lng: -0.1372 },
    localTips: [
      "Know the narrow Lanes",
      "Experience with Regency properties",
      "Familiar with beach-front buildings"
    ],
    transportHubs: ["Brighton Station", "Gatwick Airport (nearby)"]
  },

  "oxford": {
    slug: "oxford",
    name: "Oxford",
    region: "South East England",
    county: "Oxfordshire",
    population: "155,000",
    postcodeAreas: ["OX"],
    areas: [
      "City Centre", "Cowley", "Headington", "Jericho", "Summertown",
      "Botley", "Iffley", "Rose Hill", "Marston"
    ],
    landmarks: [
      "Bodleian Library", "Radcliffe Camera", "Christ Church College",
      "Ashmolean Museum", "Oxford Castle", "Covered Market"
    ],
    description: "the city of dreaming spires",
    emergencyContext: "Oxford city centre and Oxfordshire",
    avgResponseTime: "15-25 minutes",
    nearbyPostcodes: ["MK", "HP", "SN", "RG"],
    coordinates: { lat: 51.7520, lng: -1.2577 },
    localTips: [
      "Know the college quads",
      "Experience with historic buildings",
      "Familiar with the Oxford ring road"
    ],
    transportHubs: ["Oxford Station", "Oxford Parkway"]
  },

  "reading": {
    slug: "reading",
    name: "Reading",
    region: "South East England",
    county: "Berkshire",
    population: "230,000",
    postcodeAreas: ["RG"],
    areas: [
      "Town Centre", "Caversham", "Tilehurst", "Woodley", "Earley",
      "Shinfield", "Whitley", "Coley", "Calcot"
    ],
    landmarks: [
      "The Oracle", "Forbury Gardens", "Reading Abbey Ruins",
      "Madejski Stadium", "Reading Festival Site"
    ],
    description: "a thriving Thames Valley business centre",
    emergencyContext: "Reading and Berkshire",
    avgResponseTime: "15-25 minutes",
    nearbyPostcodes: ["SL", "OX", "GU", "HP"],
    coordinates: { lat: 51.4543, lng: -0.9781 },
    localTips: [
      "Know the IDR inner ring",
      "Experience with Victorian terraces",
      "Quick M4 access"
    ],
    transportHubs: ["Reading Station"]
  },

  "southampton": {
    slug: "southampton",
    name: "Southampton",
    region: "South East England",
    county: "Hampshire",
    population: "260,000",
    postcodeAreas: ["SO"],
    areas: [
      "City Centre", "Shirley", "Portswood", "Bitterne", "Woolston",
      "Highfield", "Swaythling", "Lordshill", "Ocean Village"
    ],
    landmarks: [
      "SeaCity Museum", "Southampton Docks", "Mayflower Theatre",
      "Tudor House", "Bargate", "St Mary's Stadium"
    ],
    description: "the historic cruise and maritime city",
    emergencyContext: "Southampton city centre and Hampshire",
    avgResponseTime: "15-25 minutes",
    nearbyPostcodes: ["PO", "BH", "SP", "RG"],
    coordinates: { lat: 50.9097, lng: -1.4044 },
    localTips: [
      "Know the dock areas",
      "Experience with port security",
      "Quick M3/M27 access"
    ],
    transportHubs: ["Southampton Central", "Southampton Airport"]
  },

  "portsmouth": {
    slug: "portsmouth",
    name: "Portsmouth",
    region: "South East England",
    county: "Hampshire",
    population: "210,000",
    postcodeAreas: ["PO"],
    areas: [
      "City Centre", "Southsea", "Fratton", "Cosham", "Hilsea",
      "Copnor", "North End", "Baffins", "Milton"
    ],
    landmarks: [
      "Portsmouth Historic Dockyard", "HMS Victory", "Spinnaker Tower",
      "Gunwharf Quays", "Southsea Castle", "Fratton Park"
    ],
    description: "Britain's only island city with naval heritage",
    emergencyContext: "Portsmouth and Southsea",
    avgResponseTime: "15-25 minutes",
    nearbyPostcodes: ["SO", "GU", "BN"],
    coordinates: { lat: 50.8198, lng: -1.0880 },
    localTips: [
      "Know the naval base areas",
      "Experience with dense housing",
      "Island geography specialist"
    ],
    transportHubs: ["Portsmouth & Southsea Station", "Portsmouth Harbour"]
  },

  "milton-keynes": {
    slug: "milton-keynes",
    name: "Milton Keynes",
    region: "South East England",
    county: "Buckinghamshire",
    population: "270,000",
    postcodeAreas: ["MK"],
    areas: [
      "Central Milton Keynes", "Bletchley", "Wolverton", "Stony Stratford",
      "Newport Pagnell", "Olney", "Woburn Sands", "Kingston"
    ],
    landmarks: [
      "The Centre:MK", "Xscape", "Bletchley Park", "The Concrete Cows",
      "MK Dons Stadium", "Milton Keynes Theatre"
    ],
    description: "the UK's fastest growing new city",
    emergencyContext: "Milton Keynes and surrounding areas",
    avgResponseTime: "15-25 minutes",
    nearbyPostcodes: ["NN", "LU", "HP", "OX"],
    coordinates: { lat: 52.0406, lng: -0.7594 },
    localTips: [
      "Know the grid road system",
      "Experience with modern builds",
      "Quick M1 access"
    ],
    transportHubs: ["Milton Keynes Central Station"]
  },

  // SOUTH WEST ENGLAND
  "bristol": {
    slug: "bristol",
    name: "Bristol",
    region: "South West England",
    county: "Bristol",
    population: "470,000",
    postcodeAreas: ["BS"],
    areas: [
      "City Centre", "Clifton", "Redland", "Cotham", "Bedminster",
      "Southville", "Easton", "St Pauls", "Bishopston", "Horfield",
      "Filton", "Bradley Stoke"
    ],
    landmarks: [
      "Clifton Suspension Bridge", "SS Great Britain", "Bristol Cathedral",
      "Cabot Circus", "Harbour", "M Shed", "Ashton Gate Stadium"
    ],
    description: "the vibrant South West hub",
    emergencyContext: "Bristol city centre and Greater Bristol",
    avgResponseTime: "15-25 minutes",
    nearbyPostcodes: ["BA", "GL", "SN"],
    coordinates: { lat: 51.4545, lng: -2.5879 },
    localTips: [
      "Know the harbour areas",
      "Experience with Georgian properties",
      "Familiar with the hills"
    ],
    transportHubs: ["Bristol Temple Meads", "Bristol Airport"]
  },

  "plymouth": {
    slug: "plymouth",
    name: "Plymouth",
    region: "South West England",
    county: "Devon",
    population: "265,000",
    postcodeAreas: ["PL"],
    areas: [
      "City Centre", "The Hoe", "Mutley", "Devonport", "Plympton",
      "Plymstock", "Stonehouse", "Stoke", "Efford"
    ],
    landmarks: [
      "Plymouth Hoe", "Smeaton's Tower", "Royal Citadel",
      "Barbican", "National Marine Aquarium", "Home Park Stadium"
    ],
    description: "Britain's Ocean City",
    emergencyContext: "Plymouth and South Devon",
    avgResponseTime: "15-30 minutes",
    nearbyPostcodes: ["TQ", "EX", "TR"],
    coordinates: { lat: 50.3755, lng: -4.1427 },
    localTips: [
      "Know the naval dockyard area",
      "Experience with coastal properties",
      "Familiar with hilly terrain"
    ],
    transportHubs: ["Plymouth Station"]
  },

  "exeter": {
    slug: "exeter",
    name: "Exeter",
    region: "South West England",
    county: "Devon",
    population: "130,000",
    postcodeAreas: ["EX"],
    areas: [
      "City Centre", "St Thomas", "Heavitree", "Pinhoe", "Topsham",
      "Exwick", "Pennsylvania", "St Leonards", "Countess Wear"
    ],
    landmarks: [
      "Exeter Cathedral", "Royal Albert Memorial Museum",
      "Quayside", "Princesshay", "Underground Passages"
    ],
    description: "Devon's historic cathedral city",
    emergencyContext: "Exeter city centre and East Devon",
    avgResponseTime: "15-30 minutes",
    nearbyPostcodes: ["PL", "TQ", "TA"],
    coordinates: { lat: 50.7236, lng: -3.5275 },
    localTips: [
      "Know the Roman walls",
      "Experience with historic buildings",
      "Quick M5 access"
    ],
    transportHubs: ["Exeter St Davids", "Exeter Airport"]
  },

  "bath": {
    slug: "bath",
    name: "Bath",
    region: "South West England",
    county: "Somerset",
    population: "90,000",
    postcodeAreas: ["BA"],
    areas: [
      "City Centre", "Lansdown", "Widcombe", "Oldfield Park", "Bear Flat",
      "Bathwick", "Weston", "Twerton", "Larkhall"
    ],
    landmarks: [
      "Roman Baths", "Royal Crescent", "Bath Abbey",
      "Pulteney Bridge", "Thermae Bath Spa", "The Circus"
    ],
    description: "the stunning Georgian city and World Heritage Site",
    emergencyContext: "Bath city centre and North Somerset",
    avgResponseTime: "15-25 minutes",
    nearbyPostcodes: ["BS", "SN", "GL"],
    coordinates: { lat: 51.3811, lng: -2.3590 },
    localTips: [
      "Know the Georgian architecture",
      "Experience with listed buildings",
      "Familiar with steep streets"
    ],
    transportHubs: ["Bath Spa Station"]
  },

  "bournemouth": {
    slug: "bournemouth",
    name: "Bournemouth",
    region: "South West England",
    county: "Dorset",
    population: "200,000",
    postcodeAreas: ["BH"],
    areas: [
      "Town Centre", "Westbourne", "Boscombe", "Winton", "Moordown",
      "Charminster", "Pokesdown", "Southbourne", "Queens Park"
    ],
    landmarks: [
      "Bournemouth Beach", "Pier", "Lower Gardens",
      "Russell-Cotes Museum", "BH2 Leisure Complex"
    ],
    description: "the premier South Coast seaside resort",
    emergencyContext: "Bournemouth, Poole and Christchurch",
    avgResponseTime: "15-25 minutes",
    nearbyPostcodes: ["SO", "SP", "DT"],
    coordinates: { lat: 50.7192, lng: -1.8808 },
    localTips: [
      "Know the chines and gardens",
      "Experience with beach properties",
      "Student area expertise"
    ],
    transportHubs: ["Bournemouth Station", "Bournemouth Airport"]
  },

  // SCOTLAND
  "glasgow": {
    slug: "glasgow",
    name: "Glasgow",
    region: "Scotland",
    county: "Glasgow City",
    population: "1.7 million",
    postcodeAreas: ["G"],
    areas: [
      "City Centre", "West End", "Southside", "East End", "North Glasgow",
      "Partick", "Hillhead", "Govan", "Dennistoun", "Shawlands",
      "Pollokshields", "Merchant City"
    ],
    landmarks: [
      "Glasgow Cathedral", "Riverside Museum", "Kelvingrove",
      "SSE Hydro", "George Square", "Buchanan Street"
    ],
    description: "Scotland's largest city",
    emergencyContext: "Glasgow city centre and Greater Glasgow",
    avgResponseTime: "15-25 minutes",
    nearbyPostcodes: ["PA", "ML", "EH"],
    coordinates: { lat: 55.8642, lng: -4.2518 },
    localTips: [
      "Know the West End lanes",
      "Experience with tenement buildings",
      "Quick M8 motorway access"
    ],
    transportHubs: ["Glasgow Central", "Glasgow Queen Street", "Glasgow Airport"]
  },

  "edinburgh": {
    slug: "edinburgh",
    name: "Edinburgh",
    region: "Scotland",
    county: "City of Edinburgh",
    population: "540,000",
    postcodeAreas: ["EH"],
    areas: [
      "Old Town", "New Town", "Leith", "Morningside", "Stockbridge",
      "Bruntsfield", "Marchmont", "Portobello", "Cramond", "Corstorphine"
    ],
    landmarks: [
      "Edinburgh Castle", "Royal Mile", "Arthur's Seat",
      "Holyrood Palace", "Scott Monument", "Princes Street"
    ],
    description: "Scotland's historic capital",
    emergencyContext: "Edinburgh city centre and Lothian",
    avgResponseTime: "15-25 minutes",
    nearbyPostcodes: ["FK", "KY", "ML"],
    coordinates: { lat: 55.9533, lng: -3.1883 },
    localTips: [
      "Know the Old Town closes",
      "Experience with Georgian properties",
      "Familiar with Festival times"
    ],
    transportHubs: ["Edinburgh Waverley", "Haymarket", "Edinburgh Airport"]
  },

  "aberdeen": {
    slug: "aberdeen",
    name: "Aberdeen",
    region: "Scotland",
    county: "Aberdeen City",
    population: "230,000",
    postcodeAreas: ["AB"],
    areas: [
      "City Centre", "Old Aberdeen", "Rubislaw", "Rosemount", "Torry",
      "Cults", "Dyce", "Bridge of Don", "Westhill"
    ],
    landmarks: [
      "Marischal College", "Aberdeen Beach", "His Majesty's Theatre",
      "Pittodrie Stadium", "Aberdeen Art Gallery"
    ],
    description: "the Granite City and oil capital",
    emergencyContext: "Aberdeen city centre and Aberdeenshire",
    avgResponseTime: "15-30 minutes",
    nearbyPostcodes: ["IV", "DD", "PH"],
    coordinates: { lat: 57.1497, lng: -2.0943 },
    localTips: [
      "Know the granite buildings",
      "Experience with oil industry security",
      "Familiar with harbour area"
    ],
    transportHubs: ["Aberdeen Station", "Aberdeen Airport"]
  },

  "dundee": {
    slug: "dundee",
    name: "Dundee",
    region: "Scotland",
    county: "Dundee City",
    population: "150,000",
    postcodeAreas: ["DD"],
    areas: [
      "City Centre", "West End", "Broughty Ferry", "Lochee", "Stobswell",
      "Douglas", "Menzieshill", "Fintry"
    ],
    landmarks: [
      "V&A Dundee", "RRS Discovery", "The Law", "Dundee Contemporary Arts",
      "McManus Galleries", "Caird Hall"
    ],
    description: "the City of Discovery and design",
    emergencyContext: "Dundee city centre and Tayside",
    avgResponseTime: "15-25 minutes",
    nearbyPostcodes: ["PH", "AB", "KY"],
    coordinates: { lat: 56.4620, lng: -2.9707 },
    localTips: [
      "Know the waterfront area",
      "Experience with jute mill conversions",
      "Familiar with the V&A area"
    ],
    transportHubs: ["Dundee Station"]
  },

  // WALES
  "cardiff": {
    slug: "cardiff",
    name: "Cardiff",
    region: "Wales",
    county: "South Glamorgan",
    population: "370,000",
    postcodeAreas: ["CF"],
    areas: [
      "City Centre", "Canton", "Roath", "Cathays", "Splott",
      "Llandaff", "Pontcanna", "Riverside", "Grangetown", "Whitchurch"
    ],
    landmarks: [
      "Cardiff Castle", "Principality Stadium", "Cardiff Bay",
      "National Museum", "Bute Park", "St David's Centre"
    ],
    description: "the vibrant Welsh capital",
    emergencyContext: "Cardiff city centre and South Wales",
    avgResponseTime: "15-25 minutes",
    nearbyPostcodes: ["NP", "SA"],
    coordinates: { lat: 51.4816, lng: -3.1791 },
    localTips: [
      "Know the Bay area",
      "Experience with Victorian terraces",
      "Match day expertise"
    ],
    transportHubs: ["Cardiff Central", "Cardiff Airport"]
  },

  "swansea": {
    slug: "swansea",
    name: "Swansea",
    region: "Wales",
    county: "West Glamorgan",
    population: "250,000",
    postcodeAreas: ["SA"],
    areas: [
      "City Centre", "Uplands", "Sketty", "Mumbles", "Brynmill",
      "Morriston", "Gorseinon", "Port Tennant", "Marina"
    ],
    landmarks: [
      "Swansea Bay", "Mumbles Pier", "LC2 Waterpark",
      "National Waterfront Museum", "Liberty Stadium"
    ],
    description: "Wales' coastal city of culture",
    emergencyContext: "Swansea city centre and Gower",
    avgResponseTime: "15-30 minutes",
    nearbyPostcodes: ["CF", "NP"],
    coordinates: { lat: 51.6214, lng: -3.9436 },
    localTips: [
      "Know the Marina area",
      "Experience with coastal properties",
      "Familiar with Gower Peninsula"
    ],
    transportHubs: ["Swansea Station"]
  },

  "newport": {
    slug: "newport",
    name: "Newport",
    region: "Wales",
    county: "Gwent",
    population: "150,000",
    postcodeAreas: ["NP"],
    areas: [
      "City Centre", "Malpas", "Caerleon", "Rogerstone", "Bassaleg",
      "Pill", "Allt-yr-yn", "Stow Hill", "Maindee"
    ],
    landmarks: [
      "Newport Transporter Bridge", "Tredegar House",
      "Caerleon Roman Fortress", "Riverfront Theatre"
    ],
    description: "the Welsh gateway city",
    emergencyContext: "Newport and Gwent",
    avgResponseTime: "15-25 minutes",
    nearbyPostcodes: ["CF", "SA", "HR"],
    coordinates: { lat: 51.5842, lng: -2.9977 },
    localTips: [
      "Know the Roman heritage areas",
      "Experience with industrial properties",
      "Quick M4 access"
    ],
    transportHubs: ["Newport Station"]
  },

  // NORTHERN IRELAND
  "belfast": {
    slug: "belfast",
    name: "Belfast",
    region: "Northern Ireland",
    county: "County Antrim",
    population: "340,000",
    postcodeAreas: ["BT"],
    areas: [
      "City Centre", "Cathedral Quarter", "Titanic Quarter", "Queens Quarter",
      "South Belfast", "East Belfast", "West Belfast", "North Belfast"
    ],
    landmarks: [
      "Titanic Belfast", "Belfast City Hall", "St George's Market",
      "Botanic Gardens", "Ulster Museum", "SSE Arena"
    ],
    description: "Northern Ireland's vibrant capital",
    emergencyContext: "Belfast city centre and Greater Belfast",
    avgResponseTime: "15-25 minutes",
    nearbyPostcodes: [],
    coordinates: { lat: 54.5973, lng: -5.9301 },
    localTips: [
      "Know the quarter areas",
      "Experience with Victorian properties",
      "Familiar with security requirements"
    ],
    transportHubs: ["Belfast Central", "George Best Airport", "Belfast International"]
  }
};

// Get all city slugs
export const getAllCitySlugs = (): string[] => Object.keys(ukCitiesData);

// Get city by slug
export const getCityBySlug = (slug: string): CityData | undefined => {
  return ukCitiesData[slug.toLowerCase()];
};

// Generate local FAQ for a city
export const generateCityFAQ = (city: CityData) => [
  {
    question: `How quickly can a locksmith reach me in ${city.name}?`,
    answer: `Our average response time in ${city.name} is ${city.avgResponseTime}. We have verified locksmiths stationed across ${city.region}, covering ${city.areas.slice(0, 5).join(", ")} and all surrounding areas.`
  },
  {
    question: `What areas of ${city.name} do you cover?`,
    answer: `We cover all of ${city.name} including ${city.areas.join(", ")}, and neighboring postcode areas ${city.postcodeAreas.join(", ")}.`
  },
  {
    question: `How much does an emergency locksmith cost in ${city.name}?`,
    answer: `Locksmiths in ${city.name} set their own assessment fee (typically £25-49) when they apply for your job. This covers travel and initial diagnosis. You'll receive a separate quote for any work needed - no hidden fees guaranteed.`
  },
  {
    question: `Are your ${city.name} locksmiths available 24/7?`,
    answer: `Yes, we have DBS-checked, fully insured locksmiths available 24 hours a day, 7 days a week, 365 days a year across ${city.name} and the wider ${city.region} area.`
  },
  {
    question: `What locksmith services do you offer in ${city.name}?`,
    answer: `We offer emergency lockouts, lock replacement, UPVC mechanism repairs, security upgrades, safe services, and commercial locksmith services across all ${city.name} postcodes. All locksmiths are vetted, insured, and background-checked.`
  },
  {
    question: `Can I get a locksmith in ${city.areas[0]} or ${city.areas[1]}?`,
    answer: `Absolutely! We have full coverage across ${city.name} including ${city.areas.slice(0, 6).join(", ")} and all surrounding neighborhoods.`
  }
];

// Generate city LocalBusiness schema
export const generateCitySchema = (city: CityData, siteUrl: string) => ({
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "@id": `${siteUrl}/locksmith-${city.slug}#business`,
  name: `LockSafe Emergency Locksmith ${city.name}`,
  description: `24/7 Emergency Locksmith Service in ${city.name}, ${city.region}. Verified, insured locksmiths with transparent pricing, GPS tracking, and anti-fraud protection.`,
  url: `${siteUrl}/locksmith-${city.slug}`,
  telephone: "+44-7818-333-989",
  priceRange: "££",
  image: `${siteUrl}/og-locksmith-${city.slug}.jpg`,
  address: {
    "@type": "PostalAddress",
    addressLocality: city.name,
    addressRegion: city.region,
    addressCountry: "GB"
  },
  geo: {
    "@type": "GeoCoordinates",
    latitude: city.coordinates.lat,
    longitude: city.coordinates.lng
  },
  areaServed: [
    {
      "@type": "City",
      name: city.name
    },
    ...city.areas.slice(0, 10).map(area => ({
      "@type": "Place",
      name: area
    }))
  ],
  openingHoursSpecification: {
    "@type": "OpeningHoursSpecification",
    dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
    opens: "00:00",
    closes: "23:59"
  },
  aggregateRating: {
    "@type": "AggregateRating",
    ratingValue: "4.9",
    reviewCount: "1247",
    bestRating: "5",
    worstRating: "1"
  }
});

// Generate FAQ schema for city
export const generateCityFAQSchema = (city: CityData) => {
  const faqs = generateCityFAQ(city);
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map(faq => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer
      }
    }))
  };
};

// Generate breadcrumb schema for city
export const generateCityBreadcrumbSchema = (city: CityData, siteUrl: string) => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    {
      "@type": "ListItem",
      position: 1,
      name: "Home",
      item: siteUrl
    },
    {
      "@type": "ListItem",
      position: 2,
      name: "Locksmith Services",
      item: `${siteUrl}/request`
    },
    {
      "@type": "ListItem",
      position: 3,
      name: `Locksmith ${city.name}`,
      item: `${siteUrl}/locksmith-${city.slug}`
    }
  ]
});

// Generate service schema for city
export const generateCityServiceSchema = (city: CityData, siteUrl: string) => ({
  "@context": "https://schema.org",
  "@type": "Service",
  serviceType: "Emergency Locksmith Service",
  provider: {
    "@type": "LocalBusiness",
    name: `LockSafe ${city.name}`,
    url: `${siteUrl}/locksmith-${city.slug}`
  },
  areaServed: {
    "@type": "City",
    name: city.name,
    containedInPlace: {
      "@type": "AdministrativeArea",
      name: city.region
    }
  },
  hasOfferCatalog: {
    "@type": "OfferCatalog",
    name: "Locksmith Services",
    itemListElement: [
      {
        "@type": "Offer",
        itemOffered: {
          "@type": "Service",
          name: "Emergency Lockout Service",
          description: `24/7 emergency lockout assistance in ${city.name}`
        }
      },
      {
        "@type": "Offer",
        itemOffered: {
          "@type": "Service",
          name: "Lock Replacement",
          description: `British Standard lock installation in ${city.name}`
        }
      },
      {
        "@type": "Offer",
        itemOffered: {
          "@type": "Service",
          name: "UPVC Lock Repair",
          description: `UPVC door and window lock repairs in ${city.region}`
        }
      },
      {
        "@type": "Offer",
        itemOffered: {
          "@type": "Service",
          name: "Commercial Locksmith",
          description: `Business locksmith services in ${city.name}`
        }
      }
    ]
  }
});

// Get nearby cities for internal linking
export const getNearbyCities = (citySlug: string): CityData[] => {
  const city = ukCitiesData[citySlug];
  if (!city) return [];

  // Simple distance-based sorting would go here
  // For now, return cities in the same region
  return Object.values(ukCitiesData)
    .filter(c => c.slug !== citySlug && c.region === city.region)
    .slice(0, 5);
};
