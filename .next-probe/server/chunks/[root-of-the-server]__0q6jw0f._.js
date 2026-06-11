module.exports=[463021,(e,s,t)=>{s.exports=e.x("@prisma/client-2c3a283f134fdcb6",()=>require("@prisma/client-2c3a283f134fdcb6"))},843793,e=>{"use strict";var s=e.i(463021);let t=globalThis.prisma??new s.PrismaClient;e.s(["default",0,t,"prisma",0,t])},993875,e=>{"use strict";var s=e.i(795193);function t(e){let s=Number(e);return Number.isFinite(s)?s/1e6:0}function i(e){let s=Number(e);return Number.isFinite(s)?s:0}let c={windowDays:90,minClicks:3,minNegativeCost:2,topN:50};async function r(e,s={}){let o={...c,...s},n=e.customerIdPlain,a=`DURING LAST_${o.windowDays}_DAYS`,l=await e.query(`
    SELECT
      ad_group_criterion.keyword.text,
      ad_group_criterion.keyword.match_type,
      metrics.clicks,
      metrics.conversions,
      metrics.cost_micros,
      metrics.ctr,
      metrics.impressions
    FROM keyword_view
    WHERE segments.date ${a}
      AND ad_group_criterion.status = 'ENABLED'
      AND campaign.status != 'REMOVED'
  `).catch(()=>[]),m=new Map,v=new Map;for(let e of l){let s=String(e.adGroupCriterion?.keyword?.text??"").toLowerCase().trim();if(!s)continue;let c=function(e){let s=String(e??"").toUpperCase();return"EXACT"===s||"PHRASE"===s||"BROAD"===s?s:"PHRASE"}(e.adGroupCriterion?.keyword?.matchType),r=`${c}:${s}`,o=m.get(r)??{text:s,matchType:c,clicks:0,conversions:0,cost:0,ctr:0,costPerConv:null};o.clicks+=i(e.metrics?.clicks),o.conversions+=i(e.metrics?.conversions),o.cost+=t(e.metrics?.costMicros),m.set(r,o),v.set(r,(v.get(r)??0)+i(e.metrics?.impressions))}for(let[e,s]of m.entries()){let t=v.get(e)??0;s.ctr=t>0?s.clicks/t:0,s.costPerConv=s.conversions>0?s.cost/s.conversions:null}let d=[...m.values()].filter(e=>e.clicks>=o.minClicks),u=[...d].filter(e=>e.conversions>0).sort((e,s)=>s.conversions-e.conversions||s.clicks-e.clicks).slice(0,o.topN),p=[...d].filter(e=>0===e.conversions&&e.cost>=o.minNegativeCost).sort((e,s)=>s.cost-e.cost).slice(0,o.topN),g=await e.query(`
    SELECT
      search_term_view.search_term,
      metrics.clicks,
      metrics.conversions,
      metrics.cost_micros,
      metrics.impressions
    FROM search_term_view
    WHERE segments.date ${a}
      AND campaign.status != 'REMOVED'
  `).catch(()=>[]),_=new Map;for(let e of g){let s=String(e.searchTermView?.searchTerm??"").toLowerCase().trim();if(!s||s.length>80)continue;let c=_.get(s)??{text:s,matchType:"PHRASE",clicks:0,conversions:0,cost:0,ctr:0,costPerConv:null};c.clicks+=i(e.metrics?.clicks),c.conversions+=i(e.metrics?.conversions),c.cost+=t(e.metrics?.costMicros),_.set(s,c)}for(let e of _.values())e.costPerConv=e.conversions>0?e.cost/e.conversions:null;let f=[..._.values()].filter(e=>e.conversions>=1&&e.clicks>=o.minClicks).sort((e,s)=>s.conversions-e.conversions).slice(0,o.topN),k=[..._.values()].filter(e=>0===e.conversions&&e.cost>=o.minNegativeCost).sort((e,s)=>s.cost-e.cost).slice(0,o.topN).map(e=>e.text),w=(await e.query(`
    SELECT
      ad_group_ad.ad.responsive_search_ad.headlines,
      ad_group_ad.ad.responsive_search_ad.descriptions,
      ad_group_ad.ad_strength,
      metrics.clicks,
      metrics.conversions,
      metrics.cost_micros
    FROM ad_group_ad
    WHERE segments.date ${a}
      AND ad_group_ad.status != 'REMOVED'
      AND ad_group_ad.ad.type = 'RESPONSIVE_SEARCH_AD'
  `).catch(()=>[])).map(e=>{let s=e.adGroupAd?.ad?.responsiveSearchAd;return{headlines:(s?.headlines??[]).map(e=>String(e?.text??"").trim()).filter(Boolean),descriptions:(s?.descriptions??[]).map(e=>String(e?.text??"").trim()).filter(Boolean),conversions:i(e.metrics?.conversions),clicks:i(e.metrics?.clicks),cost:t(e.metrics?.costMicros),adStrength:e.adGroupAd?.adStrength}}).filter(e=>e.headlines.length>0).sort((e,s)=>s.conversions-e.conversions||s.clicks-e.clicks).slice(0,10),C=await e.query(`
    SELECT
      geographic_view.country_criterion_id,
      campaign_criterion.criterion_id,
      metrics.clicks,
      metrics.conversions,
      metrics.cost_micros
    FROM geographic_view
    WHERE segments.date ${a}
  `).catch(()=>[]),h=new Map;for(let e of C){let s=String(e.campaignCriterion?.criterionId??e.geographicView?.countryCriterionId??"");if(!s)continue;let c=h.get(s)??{geoTargetId:s,clicks:0,conversions:0,cost:0};c.clicks+=i(e.metrics?.clicks),c.conversions+=i(e.metrics?.conversions),c.cost+=t(e.metrics?.costMicros),h.set(s,c)}let E=[...h.values()].sort((e,s)=>s.conversions-e.conversions||s.clicks-e.clicks).slice(0,30),y={clicks:0,conversions:0,cost:0,impressions:0};for(let e of l)y.clicks+=i(e.metrics?.clicks),y.conversions+=i(e.metrics?.conversions),y.cost+=t(e.metrics?.costMicros),y.impressions+=i(e.metrics?.impressions);return{capturedAt:new Date().toISOString(),windowDays:o.windowDays,customerId:n,topConvertingKeywords:u,zeroConvKeywords:p,searchTermCandidates:f,searchTermNegativeCandidates:k,bestPerformingAds:w,geoPerformance:E,totals:y}}async function o(e={}){let t=await (0,s.getDefaultGoogleAdsClient)();return t?r(t.client,e):null}e.s(["extractDefaultAccountLearnings",0,o,"extractLearningsForClient",0,r,"provenKeywordsToGoogleKeywords",0,function(e,s={}){let t=s.max??25,i=s.maxCostPerConv??25,c=[...e].sort((e,s)=>s.conversions-e.conversions),r=c.filter(e=>null===e.costPerConv||e.costPerConv<=i);return(r.length>=3?r:c).slice(0,t).map(e=>({text:e.text,matchType:e.matchType,reasoning:e.conversions>0?`Proven: ${e.conversions} conv, \xa3${e.costPerConv?.toFixed(2)??"-"} CPA`:`Proven traffic: ${e.clicks} clicks`}))}])}];

//# sourceMappingURL=%5Broot-of-the-server%5D__0q6jw0f._.js.map