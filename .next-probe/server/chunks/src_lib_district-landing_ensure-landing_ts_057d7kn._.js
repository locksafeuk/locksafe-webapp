module.exports=[3772,115465,326243,e=>{"use strict";var t=e.i(843793),r=e.i(798449);let n=t.prisma;function a(e){return/^[+-]?\d+(\.\d+)?$/.test(e)}function o(e){return/^(Borough of\b|City of\b|County of\b|District of\b|Royal Borough of\b|London Borough of\b|Metropolitan Borough of\b|Unitary Authority of\b)/i.test(e)}function s(e){if(!e)return null;let t=e.trim();return!t||/\(pseudo\)|\bpseudo\b/i.test(t)||/\b(UA|MD|LB)\b\s*\/\s*\b(UA|MD|LB)\b/i.test(t)||/\(\s*(UA|MD|LB)(\s*\/\s*(UA|MD|LB))*\s*\)/i.test(t)?null:t}async function i(e){var t;let i=e.trim().toUpperCase();if(!i)throw Error("district required");let c=await n.locksmithCoverage.findMany({where:{postcodeDistrict:i},select:{id:!0,locksmithId:!0,isPaused:!0,weeklyCapacity:!0,city:!0,region:!0}});if(0===c.length)throw new l({reason:"no_coverage",district:i,details:`No LocksmithCoverage rows for ${i}`});let d=c.filter(e=>!e.isPaused);if(0===d.length)throw new l({reason:"all_paused",district:i,details:`All ${c.length} coverage rows for ${i} are paused`});let u=Array.from(new Set(d.map(e=>e.locksmithId))),h=await n.locksmith.findMany({where:{id:{in:u},isActive:!0},select:{id:!0,name:!0,baseAddress:!0,baseLat:!0,baseLng:!0,coverageRadius:!0,yearsExperience:!0,totalJobs:!0,isActive:!0}});if(0===h.length)throw new l({reason:"no_coverage",district:i,details:`No active Locksmith rows for ${i} (had ${d.length} coverage rows)`});let f=h.filter(e=>e.baseAddress&&null!==e.baseLat&&null!==e.baseLng);if(0===f.length)throw new l({reason:"missing_location",district:i,details:`${h.length} covering locksmiths have no baseLat/baseLng — cannot ground copy`});f.sort((e,t)=>t.totalJobs!==e.totalJobs?t.totalJobs-e.totalJobs:e.id.localeCompare(t.id));let g=f[0],p=d[0]?.city??null,m=s(d[0]?.region),w=null,y=null,b=[],v=null;try{let e=await (0,r.enrichOutcode)(i);e&&(p=e.info.anchorTown??p,m=s(e.info.county[0])??m,w=e.info.latitude,y=e.info.longitude,v=e.info.country[0]??null,b=e.nearby)}catch(e){console.warn(`[district-landing] postcodes.io enrichment failed for ${i}: ${e instanceof Error?e.message:e}`)}return{district:i,anchorTown:p,region:m,lat:w,lng:y,nearbyOutcodes:b,country:v,featuredEngineerBaseLocation:function(e){if(!e)return null;let t=e.replace(/[\s,]*(UK|United Kingdom)\s*$/i,"").trim();if(!t||a(t)||o(t))return null;let r=t.split(",").map(e=>e.trim()).filter(Boolean);if(0===r.length)return null;let n=r[r.length-1];/^[A-Z]{1,2}\d/i.test(n)&&n.length<=8&&r.pop();let s=r.length>=2?r[1]:r[0];return!s||a(s)||o(s)?null:s}(g.baseAddress),featuredEngineerRadiusMi:g.coverageRadius,featuredEngineerTravelMins:(t=g.coverageRadius)&&!(t<=0)?t<=5?"under 10 minutes":t<=10?"around 15 minutes":t<=15?"under 25 minutes":t<=25?"under 35 minutes":"under 45 minutes":null,featuredEngineerYears:g.yearsExperience>0?g.yearsExperience:null,totalEngineersCount:h.length,trustSignals:{dbsChecked:!0,insured:!0,fixedPriceProcess:!0,realLocalEngineer:!0,twentyFourSeven:!0,gpsTracked:!0}}}class l extends Error{reason;district;details;constructor(e){super(`No coverage for district ${e.district}: ${e.reason}`),this.name="NoCoverageError",this.reason=e.reason,this.district=e.district,this.details=e.details}}e.s(["NoCoverageError",0,l,"assembleDistrictFacts",0,i],115465);var c=e.i(322079);let d=["mla","mla-approved","mla approved","mla member","mla licensed","master locksmiths association","master locksmith","which? trusted trader","which trusted trader","checkatrade","trustmark","trustmark approved","trading standards approved","trading-standards-approved","need a locksmith in","verified locksmiths covering all","look no further","don't hesitate","do not hesitate","best locksmith in","leading locksmith","premier locksmith","top-rated locksmith","trusted by thousands","click here","call now!","affordable prices","competitive prices","wide range of services"],u=new Map;class h extends Error{attempts;constructor(e,t){super(e),this.name="ContentGenerationError",this.attempts=t}}let f=Number(process.env.DISTRICT_GEN_TIMEOUT_MS??"60000");async function g(e){let t=[],r=[];for(let n=1;n<=2;n++){let{system:a,user:o}=function(e,t=[]){let r=function(e){let t=[];t.push(`  District:             ${e.district}`),e.anchorTown&&t.push(`  Anchor town:          ${e.anchorTown}`),e.region&&t.push(`  Region:               ${e.region}`),e.country&&t.push(`  Country:              ${e.country}`),e.nearbyOutcodes.length>0&&t.push(`  Nearby outcodes we also cover: ${e.nearbyOutcodes.join(", ")}`),t.push(""),t.push("  Engineer (DO NOT NAME — use LockSafe / 'we' only):"),e.featuredEngineerBaseLocation&&t.push(`    Engineer's base location: ${e.featuredEngineerBaseLocation}`),e.featuredEngineerRadiusMi&&t.push(`    Engineer's coverage radius: ${e.featuredEngineerRadiusMi} miles`),e.featuredEngineerTravelMins&&t.push(`    Typical response time: ${e.featuredEngineerTravelMins}`),e.featuredEngineerYears&&t.push(`    Engineer's years of experience: ${e.featuredEngineerYears}`),t.push(`    LockSafe engineers covering this district: ${e.totalEngineersCount}`),t.push(""),t.push("  Verified trust signals (CLAIMABLE — all true for LockSafe):");let r=e.trustSignals;return r.dbsChecked&&t.push("    • DBS-checked engineers"),r.insured&&t.push("    • Insured (public liability)"),r.fixedPriceProcess&&t.push("    • Fixed price agreed before any work starts"),r.realLocalEngineer&&t.push("    • Real local engineer, not a national call-centre"),r.twentyFourSeven&&t.push("    • Around-the-clock dispatch (24/7)"),r.gpsTracked&&t.push("    • GPS-tracked engineer dispatched"),t.join("\n")}(e),n=t.length>0?`

  Additional forbidden phrases (DO NOT USE — they appeared in a prior attempt):
  ${t.map(e=>`    • "${e}"`).join("\n  ")}`:"";return{system:`You are writing the website copy for a real UK locksmith business
called LockSafe. The page is for a specific UK postcode district. It
must read like a confident local tradesperson wrote it — never like
programmatic SEO content.

GROUNDING RULES — STRICT
  • Use ONLY the facts in the FACTS block below.
  • If a fact is missing, omit that detail. NEVER invent numbers, named
    streets, named landmarks, customer counts, response times, ratings,
    or business history.
  • The brand is "LockSafe". Refer to the company as "LockSafe" or
    "we" — never name an individual engineer. The engineer's BASE
    LOCATION (a town/area) IS in the facts and CAN be referenced.

CLAIMABLE TRUST SIGNALS (verifiable, safe to mention)
  • DBS-checked engineers (AI-verified at onboarding)
  • Insured / public liability (AI-verified certificates)
  • Fixed price agreed before any work starts
  • Real local engineer, not a national call-centre
  • Around-the-clock dispatch (LockSafe operates 24/7)
  • GPS-tracked engineer on the way

FEE POLICY — STATE TRUTHFULLY (CRITICAL)
  • LockSafe DOES charge a call-out / assessment fee. This is true and
    must never be denied. "Fixed price agreed up front" means the TOTAL
    price (including the call-out) is disclosed and agreed before any
    work starts — it does NOT mean the service is free or that there is
    no call-out fee.
  • If a FAQ or any copy touches on call-out charges, answer truthfully:
    YES, a call-out fee applies, and it is shown to the customer up front
    as part of a fixed, agreed price with no hidden extras. NEVER answer
    "no" to "do you charge for call-outs?" — that is a false statement.
  • Safe framings: "transparent, fixed pricing agreed before any work",
    "no hidden fees" (the call-out is disclosed, not hidden). Unsafe:
    anything implying the visit or call-out itself is free.

FORBIDDEN PHRASES — ABSOLUTE
  The following must NEVER appear in your output. Some are template
  tells Google flags as low-quality; others are accreditations LockSafe
  does not currently hold (using them would be misrepresentation under
  UK consumer protection law).

    • "MLA", "MLA-approved", "MLA approved", "MLA member", "MLA licensed"
    • "Master locksmiths", "Master Locksmiths Association", "master-locksmith"
    • "Which? Trusted Trader"
    • "Checkatrade"
    • "Trustmark", "Trading Standards approved"
    • "Need a locksmith in X?" (any variant of this construction)
    • "Verified locksmiths covering all postcodes"
    • "Look no further", "Don't hesitate", "Do not hesitate"
    • "Best locksmith in X", "Leading locksmith", "Premier locksmith"
    • "Top-rated locksmith", "Trusted by thousands"
    • "Click here", "Call now!" (with exclamation), "Affordable prices"
    • "Wide range of services", "Competitive prices"
    • "No call-out fee", "no call out fee", "free call-out", "free callout",
      "no charge for call-outs", or answering "No" to whether call-outs are
      charged (ALL FALSE — LockSafe charges a call-out fee, see FEE POLICY)
    • SEO-tail template openers — any sentence shaped like:
        - "Reliable [X] Services for [Town] Residents"
        - "Professional [X] in [Town]"
        - "Trusted [X] Provider for [Town]"
        - "[X] You Can Trust"
        - "Quality [X] at Affordable Prices"
      Open the page like a person introduces themselves — not like a
      keyword stuffer. Mention the district code or town naturally; do
      not wrap it in a corporate-marketing frame.${n}

WRITING STYLE
  • Voice: confident, honest, local UK tradesperson. Not corporate.
  • No exclamation marks anywhere.
  • Vary sentence rhythm — mix short and longer sentences naturally.
  • State trust facts BRIEFLY when relevant. Do not preach or repeat.
  • If you reference nearby outcodes, name them ("we also cover RG2
    and RG30 from the same workshop"), not generic phrases.

ANSWER-FIRST FAQ STRUCTURE (for AI search / featured snippets) — IMPORTANT
  • Each FAQ answer MUST open with a direct, self-contained answer to the
    exact question in the FIRST 1-2 sentences — no preamble, no "Great
    question", no restating the question. A reader (or an AI engine) must
    get the full answer from those opening sentences alone.
  • Lead with the concrete fact FROM THE FACTS BLOCK: a yes/no, the
    response-time band given in the facts, a "what happens" — never a
    response time you made up. E.g. Q "Do you cover my area in RG1?" →
    A "Yes. Our nearest engineer works from [base location in facts],
    inside the coverage radius for RG1, so this district is fully served."
  • After that opening answer you may add ONE sentence of useful detail.
    Keep each answer 2-4 sentences total. Do not pad.
  • Phrase each question the way a real customer would type or speak it
    into Google or an AI assistant (natural language, often starting with
    how/what/do/can/how much), not as a keyword string.

OUTPUT FORMAT — STRICT JSON
  Return ONE JSON object, no markdown wrapper, no commentary before
  or after. The object MUST have exactly these keys:

  {
    "heroHeadline":      string,   // 6-12 words, district-specific
    "heroSubcopy":       string,   // ONE sentence supporting the headline
    "introParagraph":    string,   // 3-5 sentences introducing the district + LockSafe
    "coverageNarrative": string,   // 1 paragraph: where we cover from, how
                                   //   many engineers, typical response.
                                   //   Refer to LockSafe ("we", "LockSafe"),
                                   //   never name an engineer.
    "whyChooseUs":       string,   // 1 paragraph anti-shark voice:
                                   //   real local engineer, fixed price,
                                   //   no call-centre. Brief, not preachy.
    "faqs": [                      // 4-6 entries. Each answer ANSWER-FIRST:
                                   //   direct answer in sentence 1, then ≤1
                                   //   detail sentence. See ANSWER-FIRST rule.
      { "question": string, "answer": string }
    ],
    "localTrustAnchors": [string]  // 3-5 short bullets, ≤8 words each.
                                   //   E.g. "DBS-checked engineer",
                                   //   "Within 8 miles of every RG1 postcode",
                                   //   "Fixed price agreed up front"
  }`,user:`FACTS for this generation:

${r}

Write the JSON object now.`}}(e,r),s=await (0,c.chat)(c.Models.CONTENT,[{role:"system",content:a},{role:"user",content:o}],{temperature:1===n?.6:.5,responseFormat:"json",timeoutMs:f,allowOpenAIFallback:!0,fallbackSeverity:"high"}),i=function(e){let t;try{t=JSON.parse(e)}catch{return{ok:!1,bannedHits:[],missing:[],malformed:!0}}if("object"!=typeof t||null===t||Array.isArray(t))return{ok:!1,bannedHits:[],missing:[],malformed:!0};let r=t,n=function(e){let t=[],r=(e,r)=>{("string"!=typeof r||r.trim().length<10)&&t.push(e)};if(r("heroHeadline",e.heroHeadline),r("heroSubcopy",e.heroSubcopy),r("introParagraph",e.introParagraph),r("coverageNarrative",e.coverageNarrative),r("whyChooseUs",e.whyChooseUs),!Array.isArray(e.faqs)||e.faqs.length<3)t.push("faqs");else{let r=e.faqs.findIndex(e=>"string"!=typeof e.question||"string"!=typeof e.answer||e.question.trim().length<5||e.answer.trim().length<10);r>=0&&t.push(`faqs[${r}]`)}return(!Array.isArray(e.localTrustAnchors)||e.localTrustAnchors.length<3)&&t.push("localTrustAnchors"),t}(r),a=[...function(e){let t=[e.heroHeadline,e.heroSubcopy,e.introParagraph,e.coverageNarrative,e.whyChooseUs,...e.faqs.flatMap(e=>[e.question,e.answer]),...e.localTrustAnchors].join(" ").toLowerCase(),r=[];for(let e of d)(function(e){let t=u.get(e);if(!t){let r=e.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");t=RegExp(`(^|[^a-z0-9])${r}([^a-z0-9]|$)`,"i"),u.set(e,t)}return t})(e).test(t)&&r.push(e);return r}(r),...function(e){let t=[];for(let r of e.faqs??[]){let e=String(r?.question??""),n=String(r?.answer??"");/call[\s-]?out/i.test(e)&&/^\s*no\b/i.test(n)&&t.push('faq: "No" answer to a call-out-charge question (false — LockSafe charges a call-out fee)')}let r=[e.heroSubcopy,e.introParagraph,e.coverageNarrative,e.whyChooseUs,...(e.faqs??[]).flatMap(e=>[e?.answer??""])].join("  ");return(/\bno\s+call[\s-]?out\s+(?:fee|charge|cost)/i.test(r)||/\bfree\s+call[\s-]?out/i.test(r)||/\bcall[\s-]?out[^.]*\bis\s+free\b/i.test(r))&&t.push("no call-out fee (false — LockSafe charges a call-out fee)"),t}(r)],o=0===n.length&&0===a.length;return{ok:o,bannedHits:a,missing:n,parsed:o?r:void 0}}(s.content);if(t.push(i),i.ok&&i.parsed)return{content:i.parsed,modelUsed:s.usedFallback?`openai:${s.model}`:`ollama:${s.model}`,attempts:n,validationLog:t};r=Array.from(new Set([...r,...i.bannedHits])),console.warn(`[district-landing] generation attempt ${n} failed for ${e.district}: banned=${i.bannedHits.length} missing=${i.missing.join(",")||"—"} malformed=${i.malformed??!1}`)}throw new h(`Failed to generate valid content for ${e.district} after 2 attempts`,t)}let p=Number(process.env.DISTRICT_LANDING_REGENERATE_DAYS??"90");e.s(["REGENERATE_AFTER_DAYS",0,p],326243);let m=t.prisma;async function w(e){let t=e.trim().toUpperCase(),r=t.trim().toLowerCase(),n=await m.districtLandingPage.findUnique({where:{district:t},select:{id:!0,district:!0,slug:!0,contentSource:!0,generatedAt:!0,llmModel:!0,isPublished:!0}});if(n?.contentSource==="manual_override")return{district:t,slug:r,action:"kept_manual",contentSource:n.contentSource,modelUsed:n.llmModel??void 0,reason:"manual_override never overwritten by automated ensure()"};if(n?.contentSource==="ai_generated"&&n.generatedAt){let e=Date.now()-n.generatedAt.getTime();if(e<24*p*36e5)return{district:t,slug:r,action:"reused",contentSource:n.contentSource,modelUsed:n.llmModel??void 0,reason:`last generated ${Math.floor(e/864e5)} days ago, under ${p}-day threshold`}}let a=await i(t),o=await g(a),s=!n;return await m.districtLandingPage.upsert({where:{district:t},create:{district:t,slug:r,anchorTown:a.anchorTown,region:a.region,lat:a.lat,lng:a.lng,nearbyOutcodes:a.nearbyOutcodes,locksmithIds:[],featuredLocksmithId:null,featuredEngineerName:a.featuredEngineerBaseLocation,heroHeadline:o.content.heroHeadline,heroSubcopy:o.content.heroSubcopy,introParagraph:o.content.introParagraph,coverageNarrative:o.content.coverageNarrative,whyChooseUs:o.content.whyChooseUs,faqs:o.content.faqs,localTrustAnchors:o.content.localTrustAnchors,contentSource:"ai_generated",llmModel:o.modelUsed,isPublished:!0,generatedAt:new Date,publishedAt:new Date},update:{anchorTown:a.anchorTown,region:a.region,lat:a.lat,lng:a.lng,nearbyOutcodes:a.nearbyOutcodes,featuredEngineerName:a.featuredEngineerBaseLocation,heroHeadline:o.content.heroHeadline,heroSubcopy:o.content.heroSubcopy,introParagraph:o.content.introParagraph,coverageNarrative:o.content.coverageNarrative,whyChooseUs:o.content.whyChooseUs,faqs:o.content.faqs,localTrustAnchors:o.content.localTrustAnchors,llmModel:o.modelUsed,generatedAt:new Date,...n?.isPublished===!1?{}:{isPublished:!0,publishedAt:new Date}}}),{district:t,slug:r,action:s?"created":"regenerated",contentSource:"ai_generated",modelUsed:o.modelUsed,reason:s?"first generation":`regenerated after ${p}-day staleness`}}async function y(e){let t=e.trim().toUpperCase();try{let e=await w(t);return{ok:!0,district:t,result:e}}catch(e){if(e instanceof l)return{ok:!1,district:t,skipReason:`${e.reason}: ${e.details??"no coverage"}`};throw e}}e.s(["ensureDistrictLandingPage",0,w,"ensureOrSkip",0,y],3772)}];

//# sourceMappingURL=src_lib_district-landing_ensure-landing_ts_057d7kn._.js.map