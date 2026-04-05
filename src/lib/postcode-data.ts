// Postcode data for SEO-optimized landing pages
// Covers Hertfordshire/Watford target areas for Google Ads

export interface PostcodeData {
  postcode: string;
  slug: string;
  area: string;
  mainTown: string;
  county: string;
  district: string;
  neighborhoods: string[];
  landmarks: string[];
  tubeStations?: string[];
  trainStations: string[];
  nearbyPostcodes: string[];
  population: string;
  description: string;
  emergencyContext: string;
  localTips: string[];
  avgResponseTime: string;
  coordinates: {
    lat: number;
    lng: number;
  };
}

export const postcodeData: Record<string, PostcodeData> = {
  // WD3 - RICKMANSWORTH
  "wd3": {
    postcode: "WD3",
    slug: "wd3-rickmansworth",
    area: "Rickmansworth",
    mainTown: "Rickmansworth",
    county: "Hertfordshire",
    district: "Three Rivers",
    neighborhoods: [
      "Rickmansworth",
      "Chorleywood",
      "Croxley Green",
      "Loudwater",
      "Mill End",
      "Maple Cross",
      "Sarratt",
      "Batchworth",
      "Chenies",
      "Heronsgate",
      "Chandler's Cross",
      "West Hyde"
    ],
    landmarks: [
      "Rickmansworth Aquadrome",
      "Chorleywood Common",
      "The Bury (historic mansion)",
      "Rickmansworth High Street",
      "Chess Valley",
      "Croxley Green Common",
      "Sarratt Village"
    ],
    tubeStations: [
      "Rickmansworth (Metropolitan Line)",
      "Chorleywood (Metropolitan Line)",
      "Croxley (Metropolitan Line)"
    ],
    trainStations: [
      "Rickmansworth",
      "Chorleywood"
    ],
    nearbyPostcodes: ["WD4", "WD5", "WD17", "WD18", "WD19"],
    population: "85,000",
    description: "a beautiful part of the Chilterns with historic market town character",
    emergencyContext: "the Chess Valley and Three Rivers area",
    localTips: [
      "We know the narrow lanes around Sarratt well",
      "Quick access via A404 and M25",
      "Familiar with gated properties in Loudwater"
    ],
    avgResponseTime: "15-25 minutes",
    coordinates: { lat: 51.6400, lng: -0.4730 }
  },

  // WD4 - KINGS LANGLEY
  "wd4": {
    postcode: "WD4",
    slug: "wd4-kings-langley",
    area: "Kings Langley",
    mainTown: "Kings Langley",
    county: "Hertfordshire",
    district: "Dacorum",
    neighborhoods: [
      "Kings Langley",
      "Chipperfield",
      "Hunton Bridge",
      "Rucklers Lane",
      "Bucks Hill",
      "Abbots Langley (part)"
    ],
    landmarks: [
      "Kings Langley High Street",
      "Rudolf Steiner School",
      "Kings Langley Palace (ruins)",
      "Chipperfield Common",
      "Grand Union Canal",
      "Ovaltine Factory (heritage)"
    ],
    trainStations: [
      "Kings Langley"
    ],
    nearbyPostcodes: ["WD3", "WD5", "WD25", "HP3"],
    population: "12,000",
    description: "a historic village with royal connections dating back to medieval times",
    emergencyContext: "Kings Langley and the surrounding villages",
    localTips: [
      "Fast access from M25 Junction 20",
      "Know the rural lanes around Chipperfield",
      "Experienced with period properties"
    ],
    avgResponseTime: "18-28 minutes",
    coordinates: { lat: 51.7060, lng: -0.4430 }
  },

  // WD5 - ABBOTS LANGLEY
  "wd5": {
    postcode: "WD5",
    slug: "wd5-abbots-langley",
    area: "Abbots Langley",
    mainTown: "Abbots Langley",
    county: "Hertfordshire",
    district: "Three Rivers",
    neighborhoods: [
      "Abbots Langley",
      "Bedmond",
      "Leavesden Green",
      "Hunton Bridge"
    ],
    landmarks: [
      "Abbots Langley High Street",
      "Leavesden Film Studios",
      "Warner Bros. Studio Tour",
      "Manor House Grounds",
      "St Lawrence Church"
    ],
    trainStations: [
      "Garston (nearby)",
      "Kings Langley"
    ],
    nearbyPostcodes: ["WD4", "WD25", "WD6", "AL2"],
    population: "20,000",
    description: "home to world-famous film studios and charming village atmosphere",
    emergencyContext: "Abbots Langley and the studio district",
    localTips: [
      "Close to Warner Bros Studios",
      "Quick response from M1/M25 corridor",
      "Know the new housing developments"
    ],
    avgResponseTime: "15-25 minutes",
    coordinates: { lat: 51.7000, lng: -0.4170 }
  },

  // WD6 - BOREHAMWOOD
  "wd6": {
    postcode: "WD6",
    slug: "wd6-borehamwood",
    area: "Borehamwood",
    mainTown: "Borehamwood",
    county: "Hertfordshire",
    district: "Hertsmere",
    neighborhoods: [
      "Borehamwood",
      "Elstree",
      "Well End",
      "Shenley Road area",
      "Theobald Street area"
    ],
    landmarks: [
      "Elstree Studios",
      "BBC Elstree Centre",
      "Borehamwood Shopping Park",
      "Aberford Park",
      "Allum Lane Cemetery",
      "Elstree Aerodrome"
    ],
    trainStations: [
      "Elstree & Borehamwood"
    ],
    nearbyPostcodes: ["WD7", "WD23", "EN5", "NW7"],
    population: "75,000",
    description: "the heart of Britain's film and TV industry, known as the British Hollywood",
    emergencyContext: "Borehamwood, Elstree and the studio areas",
    localTips: [
      "Fast access from A1/M1",
      "Know the studio compounds",
      "Experience with high-security properties"
    ],
    avgResponseTime: "12-20 minutes",
    coordinates: { lat: 51.6580, lng: -0.2770 }
  },

  // WD7 - RADLETT
  "wd7": {
    postcode: "WD7",
    slug: "wd7-radlett",
    area: "Radlett",
    mainTown: "Radlett",
    county: "Hertfordshire",
    district: "Hertsmere",
    neighborhoods: [
      "Radlett",
      "Shenley",
      "London Colney (part)",
      "Aldenham"
    ],
    landmarks: [
      "Radlett High Street",
      "Shenley Park",
      "Aldenham Country Park",
      "Radlett Cricket Club",
      "St Johns Church"
    ],
    trainStations: [
      "Radlett"
    ],
    nearbyPostcodes: ["WD6", "AL2", "WD25", "EN6"],
    population: "8,000",
    description: "an affluent commuter village with excellent transport links",
    emergencyContext: "Radlett and the surrounding Hertsmere villages",
    localTips: [
      "Know the exclusive gated estates",
      "Experience with high-end security systems",
      "Quick access via A5183"
    ],
    avgResponseTime: "15-25 minutes",
    coordinates: { lat: 51.6860, lng: -0.3170 }
  },

  // WD17 - WATFORD TOWN CENTRE
  "wd17": {
    postcode: "WD17",
    slug: "wd17-watford-centre",
    area: "Watford Town Centre",
    mainTown: "Watford",
    county: "Hertfordshire",
    district: "Watford",
    neighborhoods: [
      "Watford Town Centre",
      "Cassiobury",
      "Nascot Wood",
      "The Parade",
      "Queens Road"
    ],
    landmarks: [
      "intu Watford (Atria)",
      "Watford High Street",
      "Cassiobury Park",
      "Watford Colosseum",
      "The Pump House Theatre",
      "Watford Palace Theatre",
      "Vicarage Road Stadium"
    ],
    tubeStations: [
      "Watford (Metropolitan Line)"
    ],
    trainStations: [
      "Watford Junction",
      "Watford High Street"
    ],
    nearbyPostcodes: ["WD18", "WD19", "WD24", "WD25"],
    population: "150,000",
    description: "the commercial heart of Hertfordshire with vibrant shopping and nightlife",
    emergencyContext: "central Watford and the main shopping district",
    localTips: [
      "Fastest response in Watford area",
      "Know all the high-rise blocks",
      "Familiar with commercial premises"
    ],
    avgResponseTime: "10-18 minutes",
    coordinates: { lat: 51.6565, lng: -0.3970 }
  },

  // WD18 - WEST WATFORD
  "wd18": {
    postcode: "WD18",
    slug: "wd18-west-watford",
    area: "West Watford",
    mainTown: "Watford",
    county: "Hertfordshire",
    district: "Watford",
    neighborhoods: [
      "West Watford",
      "Holywell",
      "Watford Fields",
      "Croxley View"
    ],
    landmarks: [
      "West Herts College",
      "Holywell Community Centre",
      "Tolpits Lane area",
      "Croxley Business Park"
    ],
    trainStations: [
      "Watford Junction",
      "Croxley (nearby)"
    ],
    nearbyPostcodes: ["WD17", "WD3", "WD19", "WD25"],
    population: "35,000",
    description: "a residential area with excellent access to Watford centre and the M25",
    emergencyContext: "West Watford and the Holywell area",
    localTips: [
      "Quick via A412",
      "Know the industrial estates",
      "Experience with mixed-use properties"
    ],
    avgResponseTime: "12-20 minutes",
    coordinates: { lat: 51.6600, lng: -0.4150 }
  },

  // WD19 - OXHEY/SOUTH OXHEY/CARPENDERS PARK
  "wd19": {
    postcode: "WD19",
    slug: "wd19-oxhey",
    area: "Oxhey",
    mainTown: "Watford",
    county: "Hertfordshire",
    district: "Three Rivers / Watford",
    neighborhoods: [
      "Oxhey",
      "South Oxhey",
      "Carpenders Park",
      "Oxhey Hall",
      "Eastbury"
    ],
    landmarks: [
      "Oxhey Park",
      "South Oxhey Shopping Centre",
      "Carpenders Park Station",
      "Oxhey Woods",
      "Merry Hill"
    ],
    trainStations: [
      "Carpenders Park",
      "Bushey"
    ],
    nearbyPostcodes: ["WD23", "WD17", "WD3", "HA6"],
    population: "40,000",
    description: "a diverse residential area spanning Watford and Three Rivers",
    emergencyContext: "Oxhey, South Oxhey and Carpenders Park",
    localTips: [
      "Know the council estates well",
      "Quick access via A4008",
      "Familiar with the regeneration areas"
    ],
    avgResponseTime: "12-22 minutes",
    coordinates: { lat: 51.6350, lng: -0.3950 }
  },

  // WD23 - BUSHEY
  "wd23": {
    postcode: "WD23",
    slug: "wd23-bushey",
    area: "Bushey",
    mainTown: "Bushey",
    county: "Hertfordshire",
    district: "Hertsmere",
    neighborhoods: [
      "Bushey",
      "Bushey Heath",
      "Bushey Village",
      "The Rutts"
    ],
    landmarks: [
      "Bushey High Street",
      "Royal Masonic School",
      "Bushey Museum",
      "St James' Church",
      "Bushey Rose Garden",
      "International University"
    ],
    trainStations: [
      "Bushey"
    ],
    nearbyPostcodes: ["WD19", "WD24", "WD6", "HA7"],
    population: "25,000",
    description: "a charming town known for its artistic heritage and excellent schools",
    emergencyContext: "Bushey and Bushey Heath",
    localTips: [
      "Know the steep hills well",
      "Experience with period properties",
      "Quick via A411 or A4140"
    ],
    avgResponseTime: "12-20 minutes",
    coordinates: { lat: 51.6430, lng: -0.3600 }
  },

  // WD24 - NORTH WATFORD
  "wd24": {
    postcode: "WD24",
    slug: "wd24-north-watford",
    area: "North Watford",
    mainTown: "Watford",
    county: "Hertfordshire",
    district: "Watford",
    neighborhoods: [
      "North Watford",
      "Leggatts",
      "Meriden",
      "Courtlands Drive area",
      "Harebreaks"
    ],
    landmarks: [
      "Watford General Hospital",
      "North Watford Cemetery",
      "Harebreaks Wood",
      "St Albans Road shops"
    ],
    trainStations: [
      "Watford North",
      "Watford Junction"
    ],
    nearbyPostcodes: ["WD17", "WD25", "AL2", "WD23"],
    population: "45,000",
    description: "a busy residential area with the main hospital and key transport links",
    emergencyContext: "North Watford and the hospital district",
    localTips: [
      "Know the hospital area well",
      "Quick from M1 Junction 5",
      "Familiar with new developments"
    ],
    avgResponseTime: "10-18 minutes",
    coordinates: { lat: 51.6750, lng: -0.3920 }
  },

  // WD25 - GARSTON/LEAVESDEN
  "wd25": {
    postcode: "WD25",
    slug: "wd25-garston-leavesden",
    area: "Garston",
    mainTown: "Watford",
    county: "Hertfordshire",
    district: "Watford",
    neighborhoods: [
      "Garston",
      "Leavesden",
      "Aldenham",
      "Kingswood",
      "Woodside"
    ],
    landmarks: [
      "Leavesden Studios",
      "Warner Bros. Studio Tour",
      "Garston Park",
      "Aldenham Reservoir",
      "Kingswood estate"
    ],
    trainStations: [
      "Garston",
      "Watford Junction"
    ],
    nearbyPostcodes: ["WD24", "WD17", "WD5", "WD6", "AL2"],
    population: "35,000",
    description: "home to the famous Harry Potter studios and growing residential communities",
    emergencyContext: "Garston, Leavesden and the studios area",
    localTips: [
      "Know the studio security requirements",
      "Quick access from M1",
      "Familiar with new housing estates"
    ],
    avgResponseTime: "12-20 minutes",
    coordinates: { lat: 51.6900, lng: -0.3800 }
  },

  // AL1 - ST ALBANS CENTRE
  "al1": {
    postcode: "AL1",
    slug: "al1-st-albans-centre",
    area: "St Albans Centre",
    mainTown: "St Albans",
    county: "Hertfordshire",
    district: "St Albans",
    neighborhoods: [
      "St Albans City Centre",
      "St Peters",
      "Sopwell",
      "The Camp",
      "Cottonmill",
      "Bernard's Heath"
    ],
    landmarks: [
      "St Albans Cathedral",
      "St Albans Abbey",
      "Verulamium Park",
      "Roman Theatre",
      "Clock Tower",
      "St Albans Market",
      "Maltings Shopping Centre"
    ],
    trainStations: [
      "St Albans City",
      "St Albans Abbey"
    ],
    nearbyPostcodes: ["AL2", "AL3", "AL4", "WD7"],
    population: "90,000",
    description: "a historic cathedral city with Roman heritage and thriving market",
    emergencyContext: "St Albans city centre and surrounding areas",
    localTips: [
      "Know the medieval street layout",
      "Experience with listed buildings",
      "Familiar with cathedral close properties"
    ],
    avgResponseTime: "15-25 minutes",
    coordinates: { lat: 51.7520, lng: -0.3360 }
  },

  // AL2 - ST ALBANS SOUTH
  "al2": {
    postcode: "AL2",
    slug: "al2-st-albans-south",
    area: "St Albans South",
    mainTown: "St Albans",
    county: "Hertfordshire",
    district: "St Albans",
    neighborhoods: [
      "Bricket Wood",
      "Colney Street",
      "Frogmore",
      "London Colney",
      "Napsbury",
      "Park Street",
      "Potters Crouch",
      "Chiswell Green"
    ],
    landmarks: [
      "London Colney retail park",
      "Napsbury Park",
      "Bricket Wood Common",
      "Park Street village",
      "Burston Garden Centre"
    ],
    trainStations: [
      "Bricket Wood",
      "How Wood",
      "Park Street"
    ],
    nearbyPostcodes: ["AL1", "AL3", "WD5", "WD7", "WD25"],
    population: "35,000",
    description: "a collection of charming villages south of St Albans with excellent M25 access",
    emergencyContext: "south St Albans, London Colney and surrounding villages",
    localTips: [
      "Quick via M25 Junction 21A/22",
      "Know the rural lanes",
      "Experience with village properties"
    ],
    avgResponseTime: "15-25 minutes",
    coordinates: { lat: 51.7180, lng: -0.3400 }
  },

  // AL3 - ST ALBANS WEST
  "al3": {
    postcode: "AL3",
    slug: "al3-st-albans-west",
    area: "St Albans West",
    mainTown: "St Albans",
    county: "Hertfordshire",
    district: "St Albans / Dacorum",
    neighborhoods: [
      "Flamstead",
      "Gorhambury",
      "Markyate",
      "Redbourn",
      "Sandridge",
      "Harpenden (part)",
      "New Greens"
    ],
    landmarks: [
      "Gorhambury House",
      "Redbourn Common",
      "Heartwood Forest",
      "Markyate Cell",
      "St Albans Golf Club",
      "Flamstead village"
    ],
    trainStations: [
      "St Albans City",
      "Harpenden"
    ],
    nearbyPostcodes: ["AL1", "AL4", "AL5", "HP2", "LU1"],
    population: "45,000",
    description: "scenic villages and countryside west of St Albans with Chiltern views",
    emergencyContext: "west St Albans, Redbourn and the rural villages",
    localTips: [
      "Know the Chiltern roads well",
      "Experience with farm properties",
      "Quick access via A5183"
    ],
    avgResponseTime: "18-30 minutes",
    coordinates: { lat: 51.7700, lng: -0.4000 }
  },

  // AL4 - ST ALBANS EAST
  "al4": {
    postcode: "AL4",
    slug: "al4-st-albans-east",
    area: "St Albans East",
    mainTown: "St Albans",
    county: "Hertfordshire",
    district: "St Albans",
    neighborhoods: [
      "Colney Heath",
      "Jersey Farm",
      "Marshalswick",
      "Oaklands",
      "Sandridge",
      "Smallford",
      "Tyttenhanger",
      "Wheathampstead"
    ],
    landmarks: [
      "Oaklands College",
      "Wheathampstead village",
      "Sandridgebury",
      "Heartwood Forest (part)",
      "Jersey Farm Woodland Park",
      "Tyttenhanger gravel pits"
    ],
    trainStations: [
      "Welham Green",
      "Hatfield",
      "St Albans City"
    ],
    nearbyPostcodes: ["AL1", "AL3", "AL6", "WD7", "EN6"],
    population: "50,000",
    description: "established residential areas and villages east of St Albans",
    emergencyContext: "east St Albans, Marshalswick and surrounding villages",
    localTips: [
      "Know Wheathampstead's narrow lanes",
      "Experience with rural properties",
      "Quick via A1057"
    ],
    avgResponseTime: "15-28 minutes",
    coordinates: { lat: 51.7700, lng: -0.2800 }
  }
};

// Helper to get all postcodes
export const getAllPostcodes = (): string[] => Object.keys(postcodeData);

// Get postcode by slug
export const getPostcodeBySlug = (slug: string): PostcodeData | undefined => {
  const postcode = slug.split('-')[0]?.toLowerCase();
  return postcodeData[postcode];
};

// Get related services for each area
export const getLocalServices = () => [
  {
    title: "Emergency Lockout Service",
    description: "Locked out of your home or car? Our locksmiths arrive in 15-30 minutes.",
    icon: "key"
  },
  {
    title: "Lock Replacement",
    description: "Upgrade to British Standard locks for better security and insurance compliance.",
    icon: "lock"
  },
  {
    title: "Lock Repair",
    description: "UPVC mechanism repairs, euro cylinder replacements, and multipoint lock fixes.",
    icon: "wrench"
  },
  {
    title: "Security Upgrades",
    description: "Window locks, door chains, smart locks, and comprehensive security assessments.",
    icon: "shield"
  },
  {
    title: "Commercial Locksmith",
    description: "Office lockouts, access control systems, master key suites, and safe services.",
    icon: "building"
  },
  {
    title: "Car Key Services",
    description: "Auto lockouts, key cutting, and transponder programming for most vehicles.",
    icon: "car"
  }
];

// Generate FAQ for each postcode area
export const generateLocalFAQ = (data: PostcodeData) => [
  {
    question: `How quickly can a locksmith reach me in ${data.postcode}?`,
    answer: `Our average response time in the ${data.postcode} ${data.area} area is ${data.avgResponseTime}. We have verified locksmiths stationed across ${data.district} who know ${data.neighborhoods.slice(0, 3).join(", ")} and surrounding areas well.`
  },
  {
    question: `What areas of ${data.mainTown} do you cover?`,
    answer: `We cover all of ${data.postcode} including ${data.neighborhoods.join(", ")}, and neighboring postcodes ${data.nearbyPostcodes.join(", ")}.`
  },
  {
    question: `How much does an emergency locksmith cost in ${data.area}?`,
    answer: `Locksmiths in ${data.postcode} set their own assessment fee (typically £25-49) when they apply for your job. This covers travel to ${data.area} and initial diagnosis. You'll receive a separate quote for the work - no hidden fees.`
  },
  {
    question: `Are your ${data.area} locksmiths available 24 hours?`,
    answer: `Yes, we have DBS-checked, insured locksmiths available 24/7, 365 days a year across ${data.mainTown} and the wider ${data.county} area.`
  },
  {
    question: `Do you cover ${data.neighborhoods[0]} and ${data.neighborhoods[1]}?`,
    answer: `Absolutely! We provide full coverage across ${data.postcode} including ${data.neighborhoods.slice(0, 5).join(", ")}, and all surrounding areas of ${data.district}.`
  },
  {
    question: `What locksmith services are available in ${data.postcode}?`,
    answer: `We offer emergency lockouts, lock changes, UPVC repairs, security upgrades, and commercial services across ${data.area}. All locksmiths are vetted and insured.`
  }
];

// Generate structured data for rich snippets
export const generateLocalBusinessSchema = (data: PostcodeData, siteUrl: string) => ({
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "@id": `${siteUrl}/emergency-locksmith-${data.slug}#business`,
  name: `LockSafe Emergency Locksmith ${data.area}`,
  description: `24/7 Emergency Locksmith Service in ${data.postcode} ${data.area}, ${data.county}. Verified, insured locksmiths with transparent pricing and GPS tracking.`,
  url: `${siteUrl}/emergency-locksmith-${data.slug}`,
  telephone: "+44-7818-333-989",
  image: `${siteUrl}/og-locksmith-${data.postcode.toLowerCase()}.jpg`,
  priceRange: "££",
  address: {
    "@type": "PostalAddress",
    addressLocality: data.mainTown,
    addressRegion: data.county,
    postalCode: data.postcode,
    addressCountry: "GB"
  },
  geo: {
    "@type": "GeoCoordinates",
    latitude: data.coordinates.lat,
    longitude: data.coordinates.lng
  },
  areaServed: [
    {
      "@type": "City",
      name: data.mainTown
    },
    ...data.neighborhoods.map(n => ({
      "@type": "Place",
      name: n
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
    reviewCount: "847",
    bestRating: "5",
    worstRating: "1"
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
          description: `Emergency lockout assistance in ${data.area}, ${data.postcode}`
        }
      },
      {
        "@type": "Offer",
        itemOffered: {
          "@type": "Service",
          name: "Lock Replacement",
          description: `British Standard lock installation in ${data.mainTown}`
        }
      },
      {
        "@type": "Offer",
        itemOffered: {
          "@type": "Service",
          name: "UPVC Lock Repair",
          description: `UPVC door and window lock repairs in ${data.county}`
        }
      }
    ]
  }
});

// Generate FAQ schema for AEO
export const generateFAQSchema = (data: PostcodeData) => {
  const faqs = generateLocalFAQ(data);
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

// Generate breadcrumb schema
export const generateBreadcrumbSchema = (data: PostcodeData, siteUrl: string) => ({
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
      name: `Locksmith ${data.area}`,
      item: `${siteUrl}/emergency-locksmith-${data.slug}`
    }
  ]
});

// Generate HowTo schema for lockout situations
export const generateHowToSchema = (data: PostcodeData) => ({
  "@context": "https://schema.org",
  "@type": "HowTo",
  name: `What to do if you're locked out in ${data.area}`,
  description: `Step-by-step guide for getting emergency locksmith help in ${data.postcode} ${data.mainTown}`,
  step: [
    {
      "@type": "HowToStep",
      position: 1,
      name: "Stay calm and assess",
      text: "Check all doors and windows. Sometimes there's an unlocked entry point you've forgotten about."
    },
    {
      "@type": "HowToStep",
      position: 2,
      name: "Request a locksmith",
      text: "Use LockSafe to request a verified locksmith in your area. We'll match you with nearby professionals."
    },
    {
      "@type": "HowToStep",
      position: 3,
      name: "Review and accept quote",
      text: "Compare assessment fees from available locksmiths. Accept the best option for you."
    },
    {
      "@type": "HowToStep",
      position: 4,
      name: "Track your locksmith",
      text: "Use our GPS tracking to see exactly when your locksmith will arrive."
    },
    {
      "@type": "HowToStep",
      position: 5,
      name: "Get in safely",
      text: `Your verified locksmith arrives in ${data.avgResponseTime} and gets you back inside with minimal damage.`
    }
  ],
  totalTime: "PT30M"
});
