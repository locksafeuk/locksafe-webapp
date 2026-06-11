module.exports=[156573,e=>{"use strict";var t=e.i(322079),o=e.i(938528),a=e.i(612134);let s={create:async e=>{let o,a=await (0,t.chat)((o=(e.model||"").toLowerCase()).includes("mini")?t.Models.CONTENT:o.includes("gpt-4")||o.includes("quality")?t.Models.QUALITY:o.includes("hermes")||o.includes("agent")?t.Models.HERMES:o.includes("fast")?t.Models.FAST:t.Models.CONTENT,e.messages,{temperature:e.temperature,maxTokens:e.max_tokens,responseFormat:e.response_format?.type==="json_object"?"json":"text",timeoutMs:18e4});return{choices:[{message:{content:a.content}}],usage:{total_tokens:(a.promptTokens??0)+(a.completionTokens??0)}}}};async function n(e){let t=await s.create(e),o=t.usage?.total_tokens??0,a=(o/1e6*(String(e.model).includes("mini")?.6:10)).toFixed(4);return console.log(`[OpenAI:organic] ${e.model} — ${o} tokens ~$${a}`),t}let r={"anti-fraud":{name:"anti-fraud",displayName:"Anti-Fraud Education",description:"Educational content about locksmith scams, how to spot them, and how LockSafe prevents them",color:"#EF4444",icon:"ShieldAlert",toneGuidelines:["protective","authoritative","empowering"],topicExamples:["Common locksmith scam tactics","Signs of a cowboy locksmith","Why documentation matters","Price transparency importance","How scammers target vulnerable people"],hashtags:["#LocksmithScams","#AntiScam","#ProtectYourself","#LockSafeUK","#ConsumerProtection"],postsPerWeek:3},tips:{name:"tips",displayName:"Security Tips & Advice",description:"Practical home security tips, lock maintenance, and preventive advice",color:"#3B82F6",icon:"Lightbulb",toneGuidelines:["helpful","practical","friendly"],topicExamples:["How to maintain your locks","Signs your locks need replacing","Home security checklist","What to do when locked out","Key safety best practices"],hashtags:["#HomeSecurity","#SecurityTips","#LocksmithAdvice","#HomeSafety","#LockMaintenance"],postsPerWeek:2},stories:{name:"stories",displayName:"Customer Stories & Testimonials",description:"Real stories from customers, success stories, and transformation narratives",color:"#10B981",icon:"Heart",toneGuidelines:["empathetic","authentic","celebratory"],topicExamples:["Customer saved from scam","Emergency lockout resolution","Elderly customer protection","Business security upgrade","Peace of mind stories"],hashtags:["#CustomerStories","#RealPeople","#LockSafeProtects","#Testimonial","#TrustStory"],postsPerWeek:2},"behind-scenes":{name:"behind-scenes",displayName:"Behind the Scenes",description:"Company culture, locksmith verification process, team stories",color:"#8B5CF6",icon:"Building2",toneGuidelines:["transparent","personable","trustworthy"],topicExamples:["How we verify locksmiths","Why we reject 70% of applicants","A day in the life of our support team","How we built our platform","Our founder's story"],hashtags:["#BehindTheScenes","#MeetTheTeam","#StartupLife","#Transparency","#HowWeWork"],postsPerWeek:1},stats:{name:"stats",displayName:"Stats & Facts",description:"Industry statistics, company achievements, impact numbers",color:"#F59E0B",icon:"BarChart3",toneGuidelines:["factual","impactful","credible"],topicExamples:["Jobs protected milestone","Industry scam statistics","Average response time","Customer satisfaction rates","Money saved for customers"],hashtags:["#Stats","#Facts","#ByTheNumbers","#Impact","#Results"],postsPerWeek:1},engagement:{name:"engagement",displayName:"Community Engagement",description:"Questions, polls, discussions, and community building content",color:"#EC4899",icon:"MessageCircle",toneGuidelines:["conversational","curious","inclusive"],topicExamples:["Have you ever been locked out?","What security concerns you most?","Share your locksmith experience","Quiz: Can you spot the scam?","What would you do?"],hashtags:["#Question","#TellUs","#Community","#YourThoughts","#Discussion"],postsPerWeek:2}};function i(e){return e.replace(/\bDont\b/g,"Don't").replace(/\bdont\b/g,"don't").replace(/\bsecuirty\b/gi,"security").replace(/\brecieve\b/gi,"receive").replace(/\bseperate\b/gi,"separate").replace(/\bteh\b/gi,"the").replace(/\borganize\b/gi,"organise").replace(/\bcolor\b/gi,"colour").replace(/\bfavor\b/gi,"favour").replace(/\bcenter\b/gi,"centre")}async function c(e){let t=await n({model:"gpt-4o-mini",messages:[{role:"system",content:`You are a meticulous UK-English proofreader for LockSafe UK organic social posts.
Correct spelling, grammar, punctuation, and obvious wording issues.
Preserve the original meaning, brand voice, hashtags, and structure.
Use UK spelling only.
Return valid JSON only.`},{role:"user",content:`Proofread this post and return the same fields with corrections applied if needed:

${JSON.stringify(e,null,2)}`}],temperature:.1,max_tokens:900,response_format:{type:"json_object"}});try{let o=t.choices[0].message.content,a=o?JSON.parse(o):{},s=Array.isArray(a.hashtags)?a.hashtags.filter(e=>"string"==typeof e):e.hashtags,n={content:"string"==typeof a.content?a.content:e.content,headline:"string"==typeof a.headline?a.headline:e.headline,hook:"string"==typeof a.hook?a.hook:e.hook,hookType:"string"==typeof a.hookType?a.hookType:e.hookType,hashtags:s,framework:"string"==typeof a.framework?a.framework:e.framework,emotionalAngle:"string"==typeof a.emotionalAngle?a.emotionalAngle:e.emotionalAngle,pillar:a.pillar||e.pillar,callToAction:"string"==typeof a.callToAction?a.callToAction:e.callToAction,reasoning:"string"==typeof a.reasoning?a.reasoning:e.reasoning,imagePrompt:"string"==typeof a.imagePrompt?a.imagePrompt:e.imagePrompt};return{...n,content:i(n.content),headline:i(n.headline),hook:i(n.hook),hashtags:n.hashtags.map(e=>i(e)),reasoning:i(n.reasoning),imagePrompt:n.imagePrompt?i(n.imagePrompt):n.imagePrompt}}catch{return{...e,content:i(e.content),headline:i(e.headline),hook:i(e.hook),hashtags:e.hashtags.map(e=>i(e)),reasoning:i(e.reasoning),imagePrompt:e.imagePrompt?i(e.imagePrompt):e.imagePrompt}}}async function l(e){let t=(0,o.getBusinessSummary)(),s=r[e.pillar],i=(0,o.getSeasonalContext)(),l=Math.max(1,e.count??1),m=`You are an ELITE social media content creator for LockSafe UK - the UK's first anti-fraud locksmith platform.

You create ORGANIC social media posts (not ads) that build brand awareness, trust, and engagement.

═══════════════════════════════════════════════════════════════
CONTENT CREATION MASTERY
═══════════════════════════════════════════════════════════════

JUSTIN WELSH - Hooks & Engagement:
• Pattern interrupt openers that stop the scroll
• One-liner power for maximum impact
• Curiosity gaps that demand engagement
• Examples: ${a.JUSTIN_WELSH_HOOKS.patternInterrupts.slice(0,3).map(e=>`"${e.formula}"`).join(", ")}

RUSSELL BRUNSON - Storytelling:
• Epiphany Bridge for emotional connection
• Personal stories that resonate
• Future pacing for transformation
• Example story arc: ${Object.values(a.RUSSELL_BRUNSON_FRAMEWORKS.epiphanyBridge.locksafeJourney).join(" → ")}

NICHOLAS COLE - Specificity & Category:
• Category Design positioning
• Specific numbers over vague claims
• "Why Now" urgency triggers
• Position as: "${a.NICHOLAS_COLE_FRAMEWORKS.categoryDesign.positioningStatement}"

SIMON SINEK - Purpose-Driven:
• Start with WHY
• Belief-driven messaging
• Purpose before product
• Our WHY: "${a.SIMON_SINEK_FRAMEWORKS.goldenCircle.locksafe.why}"

═══════════════════════════════════════════════════════════════
ORGANIC POST RULES (Not Ads)
═══════════════════════════════════════════════════════════════

1. VALUE FIRST - Educate, entertain, or inspire before promoting
2. HUMAN VOICE - Write like a person, not a brand
3. CONVERSATION STARTERS - End with engagement hooks (questions, opinions)
4. PLATFORM NATIVE - Match platform culture and norms
5. VISUAL THINKING - Describe the ideal image to accompany posts
6. HASHTAG STRATEGY - Mix branded, niche, and discovery hashtags
7. STORY ARC - Even short posts should have beginning, middle, end
8. AUTHENTICITY - Share real struggles, lessons, behind-the-scenes
9. CONTROVERSY (ethical) - Take positions on industry issues
10. VULNERABILITY - Founder story, mistakes, learnings

═══════════════════════════════════════════════════════════════
FACEBOOK vs INSTAGRAM DIFFERENCES
═══════════════════════════════════════════════════════════════

FACEBOOK:
• Longer form acceptable (up to 500 words for stories)
• Link sharing works well
• Community building focus
• More conversational, older demographic
• Questions and discussions perform well

INSTAGRAM:
• Shorter, punchier content
• Visual-first thinking
• Hashtags more important (up to 30)
• Stories and carousels for depth
• Younger demographic, more casual

═══════════════════════════════════════════════════════════════
LOCKSAFE UK CONTENT THEMES
═══════════════════════════════════════════════════════════════

ANTI-FRAUD (Primary):
• "The \xa350 quote that became \xa3380"
• "How to spot a cowboy locksmith"
• "Why documentation is your best friend"

TIPS & ADVICE:
• Security best practices
• Lock maintenance
• What to do when locked out

STORIES:
• Customer transformations
• Locksmith partner features
• Founder journey

STATS & PROOF:
• "2,500+ protected jobs"
• "\xa30 scam losses"
• "70% rejection rate"

ENGAGEMENT:
• Polls and questions
• "What would you do?"
• Community challenges

═══════════════════════════════════════════════════════════════
LOCKSAFE UK BUSINESS CONTEXT
═══════════════════════════════════════════════════════════════

${t}

${i}

PROOF POINTS TO WEAVE IN:
• 2,500+ protected jobs
• \xa30 scam losses
• 100% dispute resolution rate
• 70% locksmith rejection rate
• 15-min average response
• GPS tracking + photos + signatures + PDF reports`,p="mixed"===e.framework?`
Use a MIX of copywriting frameworks:
• Justin Welsh hooks for attention
• Russell Brunson storytelling elements
• Nicholas Cole specificity
• Simon Sinek purpose
`:`
Use ${e.framework?.toUpperCase()||"JUSTIN WELSH"} style specifically.`,u=`Create ${l} organic social media post${1===l?"":"s"} for LockSafe UK.

CONTENT PILLAR: ${s.displayName}
Description: ${s.description}
Tone: ${s.toneGuidelines.join(", ")}
Example topics: ${s.topicExamples.join(", ")}

${e.topic?`SPECIFIC TOPIC: ${e.topic}`:""}
${e.emotionalAngle?`EMOTIONAL ANGLE: ${e.emotionalAngle}`:""}
PLATFORMS: ${e.platforms?.join(", ")||"Facebook and Instagram"}
POST TYPE: ${e.postType||"text with image"}
${e.includeCallToAction?"INCLUDE a soft call-to-action (not salesy)":"NO explicit call-to-action"}
MAX LENGTH: ${e.maxLength||280} characters for main content

${p}

═══════════════════════════════════════════════════════════════
OUTPUT FORMAT
═══════════════════════════════════════════════════════════════

Return JSON with a "posts" array. Each post should have:
- content: The main post text (use \\n for line breaks)
- headline: A bold headline for image overlay (if applicable)
- hook: The opening hook line
- hookType: Type of hook used ("pattern-interrupt", "curiosity-gap", "story", "belief", "question")
- hashtags: Array of relevant hashtags (include pillar hashtags + additional)
- framework: Which copywriting framework was used
- emotionalAngle: The emotional trigger used
- pillar: "${e.pillar}"
- callToAction: Soft CTA if requested (or null)
- reasoning: Why this post will perform well
- imagePrompt: Description of ideal poster-style accompanying image

Default hashtags for this pillar: ${s.hashtags.join(", ")}

Return ONLY valid JSON, no markdown.`;try{let t=(await n({model:"gpt-4o-mini",messages:[{role:"system",content:m},{role:"user",content:u}],temperature:.85,max_tokens:3e3,response_format:{type:"json_object"}})).choices[0].message.content;if(!t)throw Error("No response from OpenAI");let o=JSON.parse(t),a=(o.posts||[o]).slice(0,l).map(t=>({content:t.content||"",headline:t.headline||"",hook:t.hook||"",hookType:t.hookType||"unknown",hashtags:t.hashtags||s.hashtags,framework:t.framework||e.framework||"mixed",emotionalAngle:t.emotionalAngle||e.emotionalAngle||"benefit",pillar:e.pillar,callToAction:t.callToAction,reasoning:t.reasoning||"",imagePrompt:t.imagePrompt}));return Promise.all(a.map(e=>c(e)))}catch(e){throw console.error("Error generating organic post:",e),e}}let m=["sunday","monday","tuesday","wednesday","thursday","friday","saturday"];async function p(e=5,t){let o="pattern-interrupt"===t?a.JUSTIN_WELSH_HOOKS.patternInterrupts.map(e=>e.example):"curiosity-gap"===t?a.JUSTIN_WELSH_HOOKS.curiosityGaps:"story"===t?["3 years ago, my mother was scammed by a locksmith.","I still remember the day we decided to build LockSafe.","Last week, Sarah called us in tears."]:["What's your biggest fear when calling a locksmith?","Ever been quoted one price and charged another?","How do you choose who to trust in an emergency?"],s=(await n({model:"gpt-4o-mini",messages:[{role:"system",content:`You write scroll-stopping hooks for LockSafe UK social media.
Examples of great hooks: ${o.join(" | ")}
Keep hooks under 100 characters. Make them punchy and engaging.`},{role:"user",content:`Generate ${e} ${t||"mixed"} hooks for LockSafe UK organic social media posts. Return JSON with "hooks" array of strings.`}],temperature:.5,max_tokens:500,response_format:{type:"json_object"}})).choices[0].message.content;return s&&JSON.parse(s).hooks||o.slice(0,e)}async function u(e){return(await n({model:"gpt-4o-mini",messages:[{role:"system",content:`You create image prompts for social media posts.
For LockSafe UK (locksmith protection platform), create prompts for:
- Professional, trustworthy imagery
- Avoid stock photo clich\xe9s
- Consider text overlay space
- Brand colors: Orange (#F97316), Dark slate (#1E293B)
- Modern, clean aesthetic`},{role:"user",content:`Create an image prompt for this post:

Headline: ${e.headline}
Content: ${e.content.slice(0,200)}
Pillar: ${e.pillar}
Emotional angle: ${e.emotionalAngle}

Return a detailed poster-style image generation prompt (for DALL-E or Midjourney style).`}],temperature:.7,max_tokens:300})).choices[0].message.content||e.imagePrompt||""}e.s(["CONTENT_PILLARS",0,r,"formatPostForPlatform",0,function(e,t){let o=function(e,t=[],o="instagram"){return[...new Set(["#LockSafeUK","#AntiScamLocksmith",...r[e].hashtags,...t,"#HomeOwnerTips","#PropertySecurity","#UKHomeowners"])].slice(0,"instagram"===o?25:5)}(e.pillar,e.hashtags,t);if("instagram"===t)return`${e.content}

.
.
.
${o.join(" ")}`;{let t=o.slice(0,5).join(" ");return`${e.content}

${t}`}},"generateContentCalendar",0,function(e,t=7,o={}){let a=[],s=Object.values(r),n=[];for(let e of s)for(let t=0;t<e.postsPerWeek;t++)n.push(e.name);let i=n.sort(()=>Math.random()-.5),c=Math.max(1,o.postsPerDay??1),l=0;for(let s=0;s<t;s++){let t=new Date(e);t.setDate(t.getDate()+s);let n=m[t.getDay()],r=o.publishTimes?.[n];for(let e of r&&r.length>0?r:Array(c).fill("15:00")){let o=i[l%i.length];a.push({date:new Date(t),time:e,pillar:o,platform:"both"}),l++}}return a},"generateHooks",0,p,"generateImagePrompt",0,u,"generateOrganicPost",0,l,"proofreadOrganicPost",0,c])}];

//# sourceMappingURL=src_lib_organic-content_ts_0vcpo~v._.js.map