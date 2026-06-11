module.exports=[651420,e=>{"use strict";var t=e.i(843793);let r=["locksmith","emergency locksmith","24 hour locksmith","locked out","lock change","door lock repair","lock replacement","upvc locksmith"];async function s(e={}){let o=e.limit??12,i={isActive:!0,score:{gte:e.minScore??0}};e.includeCategories&&e.includeCategories.length>0&&(i.category={in:e.includeCategories});let n=await t.default.keywordSeed.findMany({where:i,take:4*o});return 0===n.length?[...r]:n.map(e=>({keyword:e.keyword,effectiveScore:e.score*(e.stabilityWeight??.25)})).sort((e,t)=>t.effectiveScore-e.effectiveScore).slice(0,o).map(e=>e.keyword)}async function o(e,r={}){let s=e.trim().toLowerCase();if(!s)return null;let i=await t.default.keywordSeed.findUnique({where:{keyword:s}});return i?r.source||r.notes?t.default.keywordSeed.update({where:{id:i.id},data:{firstSeenSource:i.firstSeenSource??r.source,notes:r.notes??i.notes}}):i:t.default.keywordSeed.create({data:{keyword:s,category:r.category??"learned",firstSeenSource:r.source??"unknown",notes:r.notes}})}async function i(e){let r=Array.from(new Set(e.map(e=>e.trim().toLowerCase()).filter(Boolean)));return 0===r.length?0:(await t.default.keywordSeed.updateMany({where:{keyword:{in:r}},data:{lastUsedAt:new Date,usageCount:{increment:1}}})).count}async function n(){return(await t.default.keywordSeed.findMany({where:{category:"negative"},select:{keyword:!0}})).map(e=>e.keyword)}async function a({keyword:e,outcome:r}){let s=e.trim().toLowerCase();if(!s)return null;let o=await t.default.keywordSeed.findUnique({where:{keyword:s}});if(!o)return null;let i=o.winCount+ +("WIN"===r),n=o.lossCount+ +("LOSS"===r),c=o.inconclusiveCount+ +("INCONCLUSIVE"===r||"NEUTRAL"===r);return t.default.keywordSeed.update({where:{id:o.id},data:{winCount:i,lossCount:n,inconclusiveCount:c,score:(i+1)/(i+n+2),lastWinAt:"WIN"===r?new Date:o.lastWinAt,lastLossAt:"LOSS"===r?new Date:o.lastLossAt}})}e.s(["FALLBACK_BASELINE_SEEDS",0,r,"addSeed",0,o,"applyReflection",0,a,"getNegativeSeedKeywords",0,n,"getTopSeeds",0,s,"markSeedsUsed",0,i])},966859,e=>{"use strict";class t extends Error{offending;constructor(e){const t=e.map(e=>`${e.field} "${e.text}" → ${e.label}`).join("; ");super(`Ad copy contains forbidden claim(s): ${t}`),this.name="AdCopyPreflightError",this.offending=e}}let r=[{pattern:/\bno\s+(surprise\s+)?(call[\s-]?out\s+)?fees?\b/i,label:"false 'no fees / no call-out fee' claim"},{pattern:/\bno\s+call[\s-]?out\s+(fee|charge|cost)\b/i,label:"false 'no call-out fee' claim"},{pattern:/\bfree\s+call[\s-]?out\b/i,label:"false 'free call-out' claim"},{pattern:/\bzero\s+(call[\s-]?out\s+)?fees?\b/i,label:"false 'zero fees' claim"},{pattern:/\bfee[\s-]?free\b/i,label:"false 'fee-free' claim"},{pattern:/\bcheapest\b/i,label:"unprovable 'cheapest' superlative"},{pattern:/\bguaranteed\s+lowest\b/i,label:"unprovable 'guaranteed lowest' superlative"},{pattern:/\blowest\s+price(s)?\s+guaranteed\b/i,label:"unprovable 'lowest price guaranteed' superlative"}];function s(e){if(!e)return null;for(let{pattern:t,label:s}of r)if(t.test(e))return s;return null}e.s(["AdCopyPreflightError",0,t,"assertAdCopyClean",0,function(e,r){let o=[];for(let t of e){let e=s(t);e&&o.push({field:"headline",text:t,label:e})}for(let e of r){let t=s(e);t&&o.push({field:"description",text:e,label:t})}if(o.length>0)throw new t(o)},"scrubForbiddenAdCopy",0,function(e){return e.filter(e=>null===s(e))}])},993875,e=>{"use strict";var t=e.i(795193);function r(e){let t=Number(e);return Number.isFinite(t)?t/1e6:0}function s(e){let t=Number(e);return Number.isFinite(t)?t:0}let o={windowDays:90,minClicks:3,minNegativeCost:2,topN:50};async function i(e,t={}){let n={...o,...t},a=e.customerIdPlain,c=`DURING LAST_${n.windowDays}_DAYS`,l=await e.query(`
    SELECT
      ad_group_criterion.keyword.text,
      ad_group_criterion.keyword.match_type,
      metrics.clicks,
      metrics.conversions,
      metrics.cost_micros,
      metrics.ctr,
      metrics.impressions
    FROM keyword_view
    WHERE segments.date ${c}
      AND ad_group_criterion.status = 'ENABLED'
      AND campaign.status != 'REMOVED'
  `).catch(()=>[]),d=new Map,u=new Map;for(let e of l){let t=String(e.adGroupCriterion?.keyword?.text??"").toLowerCase().trim();if(!t)continue;let o=function(e){let t=String(e??"").toUpperCase();return"EXACT"===t||"PHRASE"===t||"BROAD"===t?t:"PHRASE"}(e.adGroupCriterion?.keyword?.matchType),i=`${o}:${t}`,n=d.get(i)??{text:t,matchType:o,clicks:0,conversions:0,cost:0,ctr:0,costPerConv:null};n.clicks+=s(e.metrics?.clicks),n.conversions+=s(e.metrics?.conversions),n.cost+=r(e.metrics?.costMicros),d.set(i,n),u.set(i,(u.get(i)??0)+s(e.metrics?.impressions))}for(let[e,t]of d.entries()){let r=u.get(e)??0;t.ctr=r>0?t.clicks/r:0,t.costPerConv=t.conversions>0?t.cost/t.conversions:null}let m=[...d.values()].filter(e=>e.clicks>=n.minClicks),p=[...m].filter(e=>e.conversions>0).sort((e,t)=>t.conversions-e.conversions||t.clicks-e.clicks).slice(0,n.topN),g=[...m].filter(e=>0===e.conversions&&e.cost>=n.minNegativeCost).sort((e,t)=>t.cost-e.cost).slice(0,n.topN),f=await e.query(`
    SELECT
      search_term_view.search_term,
      metrics.clicks,
      metrics.conversions,
      metrics.cost_micros,
      metrics.impressions
    FROM search_term_view
    WHERE segments.date ${c}
      AND campaign.status != 'REMOVED'
  `).catch(()=>[]),h=new Map;for(let e of f){let t=String(e.searchTermView?.searchTerm??"").toLowerCase().trim();if(!t||t.length>80)continue;let o=h.get(t)??{text:t,matchType:"PHRASE",clicks:0,conversions:0,cost:0,ctr:0,costPerConv:null};o.clicks+=s(e.metrics?.clicks),o.conversions+=s(e.metrics?.conversions),o.cost+=r(e.metrics?.costMicros),h.set(t,o)}for(let e of h.values())e.costPerConv=e.conversions>0?e.cost/e.conversions:null;let y=[...h.values()].filter(e=>e.conversions>=1&&e.clicks>=n.minClicks).sort((e,t)=>t.conversions-e.conversions).slice(0,n.topN),S=[...h.values()].filter(e=>0===e.conversions&&e.cost>=n.minNegativeCost).sort((e,t)=>t.cost-e.cost).slice(0,n.topN).map(e=>e.text),w=(await e.query(`
    SELECT
      ad_group_ad.ad.responsive_search_ad.headlines,
      ad_group_ad.ad.responsive_search_ad.descriptions,
      ad_group_ad.ad_strength,
      metrics.clicks,
      metrics.conversions,
      metrics.cost_micros
    FROM ad_group_ad
    WHERE segments.date ${c}
      AND ad_group_ad.status != 'REMOVED'
      AND ad_group_ad.ad.type = 'RESPONSIVE_SEARCH_AD'
  `).catch(()=>[])).map(e=>{let t=e.adGroupAd?.ad?.responsiveSearchAd;return{headlines:(t?.headlines??[]).map(e=>String(e?.text??"").trim()).filter(Boolean),descriptions:(t?.descriptions??[]).map(e=>String(e?.text??"").trim()).filter(Boolean),conversions:s(e.metrics?.conversions),clicks:s(e.metrics?.clicks),cost:r(e.metrics?.costMicros),adStrength:e.adGroupAd?.adStrength}}).filter(e=>e.headlines.length>0).sort((e,t)=>t.conversions-e.conversions||t.clicks-e.clicks).slice(0,10),k=await e.query(`
    SELECT
      geographic_view.country_criterion_id,
      campaign_criterion.criterion_id,
      metrics.clicks,
      metrics.conversions,
      metrics.cost_micros
    FROM geographic_view
    WHERE segments.date ${c}
  `).catch(()=>[]),A=new Map;for(let e of k){let t=String(e.campaignCriterion?.criterionId??e.geographicView?.countryCriterionId??"");if(!t)continue;let o=A.get(t)??{geoTargetId:t,clicks:0,conversions:0,cost:0};o.clicks+=s(e.metrics?.clicks),o.conversions+=s(e.metrics?.conversions),o.cost+=r(e.metrics?.costMicros),A.set(t,o)}let v=[...A.values()].sort((e,t)=>t.conversions-e.conversions||t.clicks-e.clicks).slice(0,30),E={clicks:0,conversions:0,cost:0,impressions:0};for(let e of l)E.clicks+=s(e.metrics?.clicks),E.conversions+=s(e.metrics?.conversions),E.cost+=r(e.metrics?.costMicros),E.impressions+=s(e.metrics?.impressions);return{capturedAt:new Date().toISOString(),windowDays:n.windowDays,customerId:a,topConvertingKeywords:p,zeroConvKeywords:g,searchTermCandidates:y,searchTermNegativeCandidates:S,bestPerformingAds:w,geoPerformance:v,totals:E}}async function n(e={}){let r=await (0,t.getDefaultGoogleAdsClient)();return r?i(r.client,e):null}e.s(["extractDefaultAccountLearnings",0,n,"extractLearningsForClient",0,i,"provenKeywordsToGoogleKeywords",0,function(e,t={}){let r=t.max??25,s=t.maxCostPerConv??25,o=[...e].sort((e,t)=>t.conversions-e.conversions),i=o.filter(e=>null===e.costPerConv||e.costPerConv<=s);return(i.length>=3?i:o).slice(0,r).map(e=>({text:e.text,matchType:e.matchType,reasoning:e.conversions>0?`Proven: ${e.conversions} conv, \xa3${e.costPerConv?.toFixed(2)??"-"} CPA`:`Proven traffic: ${e.clicks} clicks`}))}])},628881,e=>{"use strict";var t=e.i(938528),r=e.i(322079),s=e.i(472800),o=e.i(873300),i=e.i(651420),n=e.i(966859),a=e.i(993875),c=e.i(459342),l=e.i(524770);function d(e,t){return!e||e.length<=t?e:e.slice(0,t-1).trimEnd()+"…"}function u(e){let t=new Set,r=[];for(let s of e){let e=s.trim().toLowerCase();!e||t.has(e)||(t.add(e),r.push(s.trim()))}return r}async function m(e){let o=(0,t.getBusinessSummary)(),i=e.cityLabel?`Local market: ${e.cityLabel}.`:"Market: United Kingdom (no specific city resolved).",a=e.provenHeadlines.length?`

ALREADY-PROVEN HEADLINES (use these as inspiration, don't copy verbatim):
${e.provenHeadlines.slice(0,12).map(e=>`• ${e}`).join("\n")}`:"",c=e.provenDescriptions.length?`

ALREADY-PROVEN DESCRIPTIONS:
${e.provenDescriptions.slice(0,6).map(e=>`• ${e}`).join("\n")}`:"",m="";try{let e=await (0,s.renderPlaybookForPrompt)();e&&(m=`

${e}`)}catch(e){console.warn("[google-ads-onboarding] playbook read failed (continuing without it):",e instanceof Error?e.message:e)}let p=`You are a senior Google Ads strategist for LockSafe UK.
You write Responsive Search Ad copy for ONE specific vetted locksmith on the
LockSafe platform. The ad MUST:
- Use British English.
- Reference local context (city/borough) when supplied.
- Lead with TRUST: vetted, insured, anti-fraud booking guarantee.
- Never claim "cheapest" or "guaranteed lowest price".
- Stay strictly within RSA character limits:
    • Headlines: exactly ${l.RSA_HEADLINE_TARGET_COUNT}, each <= ${l.RSA_HEADLINE_MAX} chars.
    • Descriptions: exactly ${l.RSA_DESCRIPTION_TARGET_COUNT}, each <= ${l.RSA_DESCRIPTION_MAX} chars.

BUSINESS CONTEXT:
${o}

PROOF POINTS:
${t.BUSINESS_CONTEXT.killerDifferentiators.slice(0,3).map(e=>`• ${e.headline}`).join("\n")}
${a}${c}${m}`,g=`Write RSA copy for this locksmith:

LOCKSMITH: ${e.locksmithName}
${i}
YEARS EXPERIENCE: ${e.yearsExperience}
RATING: ${e.rating.toFixed(1)}/5
JOBS COMPLETED ON LOCKSAFE: ${e.totalJobs}
FINAL URL: ${e.finalUrl}

Return a JSON object (no markdown, no commentary):
{
  "headlines": ["string", ... ${l.RSA_HEADLINE_TARGET_COUNT} items, each <= ${l.RSA_HEADLINE_MAX} chars],
  "descriptions": ["string", ... ${l.RSA_DESCRIPTION_TARGET_COUNT} items, each <= ${l.RSA_DESCRIPTION_MAX} chars],
  "reasoning": "1-2 sentence justification of the angle"
}`,f=(await (0,r.chat)(r.Models.QUALITY,[{role:"system",content:p},{role:"user",content:g}],{temperature:.7,maxTokens:1500,responseFormat:"json",allowOpenAIFallback:!0,fallbackSeverity:"high"})).content,h={};try{h=JSON.parse(f??"{}")}catch{h={}}return{headlines:(0,n.scrubForbiddenAdCopy)(u((Array.isArray(h.headlines)?h.headlines:[]).map(e=>d(String(e).trim(),l.RSA_HEADLINE_MAX)))).slice(0,l.RSA_HEADLINE_TARGET_COUNT),descriptions:(0,n.scrubForbiddenAdCopy)(u((Array.isArray(h.descriptions)?h.descriptions:[]).map(e=>d(String(e).trim(),l.RSA_DESCRIPTION_MAX)))).slice(0,l.RSA_DESCRIPTION_TARGET_COUNT),reasoning:String(h.reasoning??"").slice(0,500)}}async function p(e,t={}){var r;let s,n,u=t.learnings??null,{geoTargets:g,cityLabel:f}=(s=(0,c.resolveLocksmithGeo)({baseAddress:e.baseAddress,baseLat:e.baseLat,baseLng:e.baseLng}))?{geoTargets:[s.geoId],cityLabel:s.label,cityKey:s.cityKey}:{geoTargets:[c.UK_GEO_IDS.uk],cityLabel:null,cityKey:null},h=t.finalUrl??((r=f)?`https://www.locksafe.uk/locksmith-${r.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"")}`:"https://www.locksafe.uk/quote"),y=function(e,t){if(!t)return e;let r=t.toLowerCase(),s=[...e],o=new Set(s.map(e=>`${e.matchType}:${e.text.toLowerCase()}`));for(let i of e){if(i.text.includes(r)||i.text.length>30)continue;let e={text:`${i.text} ${r}`,matchType:"PHRASE",reasoning:`Localised to ${t}`},n=`${e.matchType}:${e.text.toLowerCase()}`;o.has(n)||(o.add(n),s.push(e))}return s}(u?(0,a.provenKeywordsToGoogleKeywords)([...u.topConvertingKeywords,...u.searchTermCandidates],{maxCostPerConv:25,max:30}):[],f),S=(0,o.mergeKeywords)(o.BASELINE_LOCKSMITH_KEYWORDS.filter(e=>"BROAD"!==e.matchType),y).slice(0,50),w=await (0,i.getNegativeSeedKeywords)(),k=(0,o.mergeNegativeKeywords)(o.BASELINE_NEGATIVE_KEYWORDS,w,u?.searchTermNegativeCandidates??[],u?.zeroConvKeywords?.map(e=>e.text)??[],o.COMPETITOR_BRAND_NEGATIVES).filter(e=>e.length<=80).slice(0,500),A=u?Array.from(new Set(u.bestPerformingAds.flatMap(e=>e.headlines))).slice(0,20):[],v=u?Array.from(new Set(u.bestPerformingAds.flatMap(e=>e.descriptions))).slice(0,10):[],E=[],_=[],C="";try{let t=await m({locksmithName:e.companyName||e.name,cityLabel:f,yearsExperience:e.yearsExperience??0,rating:e.rating??5,totalJobs:e.totalJobs??0,finalUrl:h,provenHeadlines:A,provenDescriptions:v});E=t.headlines,_=t.descriptions,C=t.reasoning}catch(e){C=`LLM copy generation failed: ${e instanceof Error?e.message:String(e)} — using fallback`}E.length<3&&(n=f??"UK",E=[`${n} Locksmith — 24/7`,"Vetted & Insured Locksmiths","Upfront Fixed Pricing","Anti-Fraud Booking Guarantee","Book in 60 Seconds","15 Min Response Time",`Trusted ${n} Locksmith`,"Fixed Price Lock Change","Money-Back Guarantee","See Prices Before Booking","Emergency Locksmith Help","LockSafe Verified Tradie","GPS-Tracked to Your Door","Insured & Background-Checked","Get a Locksmith Now"].map(e=>d(e,l.RSA_HEADLINE_MAX)).slice(0,l.RSA_HEADLINE_TARGET_COUNT)),_.length<2&&(_=[`LockSafe connects you with vetted, insured locksmiths in ${f??"the UK"} in under 30 minutes.`,"Anti-fraud protection built in. See the full price up front before any work starts.","All LockSafe locksmiths are background-checked, GPS-tracked & fully insured. Book now.","Emergency lockout service. Transparent pricing. Money-back guarantee available 24/7."].map(e=>d(e,l.RSA_DESCRIPTION_MAX)).slice(0,l.RSA_DESCRIPTION_TARGET_COUNT));let N=t.dailyBudget??10;return{plan:{campaignName:`Locksmith — ${e.companyName||e.name}${f?` (${f})`:""}`.slice(0,60),headlines:E,descriptions:_,finalUrl:h,keywords:S,negativeKeywords:k,recommendedDailyBudget:N,reasoning:[`Per-locksmith pilot draft for ${e.companyName||e.name}.`,f?`Targeting ${f}.`:"Targeting United Kingdom (no city resolved).",u?`Seeded with ${u.topConvertingKeywords.length} converting keywords and ${u.bestPerformingAds.length} proven RSAs from last ${u.windowDays}d (cost \xa3${u.totals.cost.toFixed(2)}, conv ${u.totals.conversions}).`:"No historical learnings available — using baseline keyword set only.",C].filter(Boolean).join(" ")},geoTargets:g,cityLabel:f,usedLearnings:!!u&&(u.topConvertingKeywords.length>0||u.bestPerformingAds.length>0)}}e.s(["generateDraftPlanForLocksmith",0,p])}];

//# sourceMappingURL=src_0qw837r._.js.map