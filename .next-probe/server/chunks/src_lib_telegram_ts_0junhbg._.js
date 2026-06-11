module.exports=[927837,e=>{"use strict";let t,o;var a=e.i(798003),n=e.i(89966);e.i(637219);var r=e.i(843793);let s=process.env.TELEGRAM_ADMIN_BOT_TOKEN||process.env.TELEGRAM_BOT_TOKEN,i=process.env.TELEGRAM_CHAT_ID,b="true"===process.env.TELEGRAM_NOTIFICATIONS_ENABLED,m=Math.max(1,Number.parseInt(process.env.TELEGRAM_SEND_RETRY_ATTEMPTS||"3",10)||3),c=Math.max(100,Number.parseInt(process.env.TELEGRAM_SEND_RETRY_BASE_MS||"350",10)||350),l="true"===process.env.ADMIN_SMS_FALLBACK_ENABLED,u=(process.env.ADMIN_ALERT_FALLBACK_PHONES||"").split(",").map(e=>e.trim()).filter(Boolean),d=Math.max(1,Number.parseInt(process.env.TELEGRAM_NEW_JOB_DEDUPE_MINUTES||"1440",10)||1440),p="false"!==process.env.TELEGRAM_QUIET_HOURS_ENABLED,T=Number.isFinite(t=Number.parseInt(process.env.TELEGRAM_QUIET_HOURS_START??"22",10))?Math.min(23,Math.max(0,t)):22,$=Number.isFinite(o=Number.parseInt(process.env.TELEGRAM_QUIET_HOURS_END??"7",10))?Math.min(23,Math.max(0,o)):7,f=new Map,g=new Map;async function E(e,t){if(t<=0)return!1;let o=Date.now();if(o<(f.get(e)??0))return!0;try{let a=new Date(o-t);if(await r.prisma.agentDecision.findFirst({where:{agent:"system-alerts",platform:"global",action:`telegram_admin_alert:${e}`,createdAt:{gte:a}},select:{id:!0}}))return f.set(e,o+t),!0}catch(e){console.warn("[Telegram][dedupe] DB check failed, proceeding:",e)}return!1}async function h(e,t){let o=Date.now(),a=t.cooldownMs;a>0&&f.set(e,o+a);try{await r.prisma.agentDecision.create({data:{agent:"system-alerts",platform:"global",action:`telegram_admin_alert:${e}`,payload:{title:t.title,message:t.message,severity:t.severity},policySnapshot:{source:"sendAdminAlert"},dryRun:!1,outcome:"ok",outcomeMessage:"telegram_sent",executedAt:new Date}})}catch(e){console.warn("[Telegram][dedupe] Failed to persist sent alert marker:",e)}}async function y(e,t){if(!e||t<=0)return!1;let o=Date.now();if(o<(g.get(e)??0))return!0;try{let a=new Date(o-t);if(await r.prisma.agentDecision.findFirst({where:{agent:"system-alerts",platform:"global",action:`telegram_new_job:${e}`,createdAt:{gte:a}},select:{id:!0}}))return g.set(e,o+t),!0}catch(e){console.warn("[Telegram][new-job dedupe] DB check failed, proceeding:",e)}return!1}async function N(e,t){if(!e)return;let o=Date.now();t>0&&g.set(e,o+t);try{await r.prisma.agentDecision.create({data:{agent:"system-alerts",platform:"global",action:`telegram_new_job:${e}`,payload:{jobId:e,event:"new_job"},policySnapshot:{source:"notifyNewJob"},dryRun:!1,outcome:"ok",outcomeMessage:"telegram_sent",executedAt:new Date}})}catch(e){console.warn("[Telegram][new-job dedupe] Failed to persist sent marker:",e)}}let w=process.env.TELEGRAM_TOPIC_NEW_JOBS?parseInt(process.env.TELEGRAM_TOPIC_NEW_JOBS):void 0,L=process.env.TELEGRAM_TOPIC_LOCKSMITHS?parseInt(process.env.TELEGRAM_TOPIC_LOCKSMITHS):void 0,A=process.env.TELEGRAM_TOPIC_CUSTOMERS?parseInt(process.env.TELEGRAM_TOPIC_CUSTOMERS):void 0,_=process.env.TELEGRAM_TOPIC_JOB_UPDATES?parseInt(process.env.TELEGRAM_TOPIC_JOB_UPDATES):void 0,M=process.env.TELEGRAM_TOPIC_PAYMENTS?parseInt(process.env.TELEGRAM_TOPIC_PAYMENTS):void 0,v=process.env.TELEGRAM_TOPIC_AGENTS?parseInt(process.env.TELEGRAM_TOPIC_AGENTS):void 0,C=process.env.TELEGRAM_TOPIC_SOCIAL?parseInt(process.env.TELEGRAM_TOPIC_SOCIAL):void 0,R=process.env.TELEGRAM_TOPIC_APPLICATIONS?parseInt(process.env.TELEGRAM_TOPIC_APPLICATIONS):void 0,I=process.env.TELEGRAM_TOPIC_QUOTES?parseInt(process.env.TELEGRAM_TOPIC_QUOTES):void 0,k=process.env.TELEGRAM_TOPIC_REVIEWS?parseInt(process.env.TELEGRAM_TOPIC_REVIEWS):void 0;function S(e){return new Promise(t=>setTimeout(t,e))}async function P(e,t="HTML",o){if(!b)return console.log("[Telegram] Notifications disabled"),!1;if(!s||!i)return console.warn("[Telegram] Missing bot token or chat ID"),!1;let a=`https://api.telegram.org/bot${s}/sendMessage`,n={chat_id:i,text:e,parse_mode:t,disable_web_page_preview:!0};o&&(n.message_thread_id=o);let r=null;for(let e=1;e<=m;e+=1)try{let t=await fetch(a,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(n)}),s=null;try{s=await t.json()}catch{s=null}if(t.ok&&s?.ok)return console.log(`[Telegram] Message sent${o?` to topic ${o}`:""}`),!0;let i=s?.description||`HTTP ${t.status}`;if(r=Error(i),console.warn(`[Telegram] Send failed (attempt ${e}/${m}, threadId=${o}): ${i}`),e<m){let o=t.headers.get("retry-after"),a=o?1e3*Number.parseInt(o,10):0,n=c*Math.pow(2,e-1);await S(Math.max(n,a))}}catch(t){if(r=t,console.warn(`[Telegram] Send errored (attempt ${e}/${m}, threadId=${o})`,t),e<m){let t=c*Math.pow(2,e-1);await S(t)}}return console.error("[Telegram] Failed to send message after retries:",r),!1}function D(e){return`\xa3${e.toFixed(2)}`}function O(e){return("string"==typeof e?new Date(e):e).toLocaleString("en-GB",{timeZone:"Europe/London",day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit",hour12:!1,timeZoneName:"short"})}function G(e){return e.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}async function H(e){return P(`
🆕 <b>New Customer Registered</b>

👤 <b>Name:</b> ${G(e.name)}
📧 <b>Email:</b> ${G(e.email)}
📱 <b>Phone:</b> ${G(e.phone)}

🕐 <b>Time:</b> ${O(new Date)}
`,"HTML",A)}async function J(e){let t=(0,n.formatBaseLocationLabel)(e.baseAddress,e.basePostcode);return P(`
🔧 <b>New Locksmith Registered</b>

👤 <b>Name:</b> ${G(e.name)}
🏢 <b>Company:</b> ${e.companyName?G(e.companyName):"Individual"}
📧 <b>Email:</b> ${G(e.email)}
📱 <b>Phone:</b> ${G(e.phone)}
📍 <b>Base Postcode:</b> ${G(t)}
🎯 <b>Coverage:</b> ${e.coverageRadius||10} miles

⚠️ <i>Pending verification</i>

🕐 <b>Time:</b> ${O(new Date)}
`,"HTML",L)}async function j(e){let t=60*d*1e3;if(await y(e.jobId,t))return console.log(`[Telegram] Skipping duplicate new job notification for ${e.jobId}`),!1;let o=e.isUrgent?"🚨 <b>URGENT</b> ":"",a=`
${o}📋 <b>New Job Listed</b>

🔢 <b>Job #:</b> ${G(e.jobNumber)}
🔐 <b>Problem:</b> ${G(e.problemType)}
🏠 <b>Property:</b> ${G(e.propertyType)}

👤 <b>Customer:</b> ${G(e.customerName)}
📱 <b>Phone:</b> ${G(e.customerPhone)}

📍 <b>Location:</b>
${G(e.address)}
${G(e.postcode)}

${e.description?`📝 <b>Notes:</b> ${G(e.description)}`:""}

🕐 <b>Time:</b> ${O(new Date)}
`,n=await P(a,"HTML",w);return n&&await N(e.jobId,t),n}async function B(e){return P(`
✋ <b>New Job Application</b>

🔢 <b>Job #:</b> ${G(e.jobNumber)}

🔧 <b>Locksmith:</b> ${G(e.locksmithName)}
${e.locksmithCompany?`🏢 <b>Company:</b> ${G(e.locksmithCompany)}`:""}
📱 <b>Phone:</b> ${G(e.locksmithPhone)}
${e.distanceMiles?`📏 <b>Distance:</b> ${e.distanceMiles.toFixed(1)} miles`:""}
⏱️ <b>ETA:</b> ${G(e.estimatedArrival)}

👤 <b>Customer:</b> ${G(e.customerName)}

🕐 <b>Time:</b> ${O(new Date)}
`,"HTML",R)}async function F(e){return P(`
✅ <b>Application Accepted</b>

🔢 <b>Job #:</b> ${G(e.jobNumber)}

🔧 <b>Assigned Locksmith:</b> ${G(e.locksmithName)}
📱 <b>Phone:</b> ${G(e.locksmithPhone)}
⏱️ <b>ETA:</b> ${G(e.estimatedArrival)}

👤 <b>Customer:</b> ${G(e.customerName)}
📱 <b>Phone:</b> ${G(e.customerPhone)}
📍 <b>Location:</b> ${G(e.address)}, ${G(e.postcode)}

🕐 <b>Time:</b> ${O(new Date)}
`,"HTML",R)}async function U(e){return P(`
💳 <b>Assessment Fee Paid</b>

🔢 <b>Job #:</b> ${G(e.jobNumber)}
💰 <b>Amount:</b> ${D(e.amount)}

👤 <b>Customer:</b> ${G(e.customerName)}
🔧 <b>Locksmith:</b> ${G(e.locksmithName)}

🕐 <b>Time:</b> ${O(new Date)}
`,"HTML",M)}async function x(e){return P(`
📝 <b>Quote Submitted</b>

🔢 <b>Job #:</b> ${G(e.jobNumber)}

💰 <b>Quote Breakdown:</b>
• Labour: ${D(e.labourCost)}
• Parts: ${D(e.partsCost)}
• <b>Total: ${D(e.total)}</b>

${e.description?`📋 <b>Work:</b> ${G(e.description)}`:""}

🔧 <b>Locksmith:</b> ${G(e.locksmithName)}
👤 <b>Customer:</b> ${G(e.customerName)}

⏳ <i>Awaiting customer approval</i>

🕐 <b>Time:</b> ${O(new Date)}
`,"HTML",I)}async function Q(e){return P(`
✅ <b>Quote Accepted</b>

🔢 <b>Job #:</b> ${G(e.jobNumber)}
💰 <b>Total:</b> ${D(e.total)}

👤 <b>Customer:</b> ${G(e.customerName)}
🔧 <b>Locksmith:</b> ${G(e.locksmithName)}

🚀 <i>Work approved - locksmith can proceed</i>

🕐 <b>Time:</b> ${O(new Date)}
`,"HTML",I)}async function W(e){return P(`
❌ <b>Quote Declined</b>

🔢 <b>Job #:</b> ${G(e.jobNumber)}
💰 <b>Quote was:</b> ${D(e.total)}

👤 <b>Customer:</b> ${G(e.customerName)}
🔧 <b>Locksmith:</b> ${G(e.locksmithName)}

${e.reason?`📝 <b>Reason:</b> ${G(e.reason)}`:""}

🕐 <b>Time:</b> ${O(new Date)}
`,"HTML",I)}async function K(e){return P(`
🔨 <b>Work Completed</b>

🔢 <b>Job #:</b> ${G(e.jobNumber)}
💰 <b>Total:</b> ${D(e.total)}

🔧 <b>Locksmith:</b> ${G(e.locksmithName)}
👤 <b>Customer:</b> ${G(e.customerName)}

⏳ <i>Awaiting customer signature & payment</i>

🕐 <b>Time:</b> ${O(new Date)}
`,"HTML",_)}async function q(e){return P(`
✍️ <b>Job Signed Off</b>

🔢 <b>Job #:</b> ${G(e.jobNumber)}

💰 <b>Payment Summary:</b>
• Total: ${D(e.total)}
• Locksmith Earnings: ${D(e.locksmithEarnings)}
• Platform Fee: ${D(e.platformFee)}

👤 <b>Customer:</b> ${G(e.customerName)}
🔧 <b>Locksmith:</b> ${G(e.locksmithName)}

✅ <i>Job completed successfully!</i>

🕐 <b>Time:</b> ${O(new Date)}
`,"HTML",_)}async function Y(e){return P(`
💰 <b>Payment Received</b>

🔢 <b>Job #:</b> ${G(e.jobNumber)}
💳 <b>Type:</b> ${{assessment:"Assessment Fee",final_payment:"Final Payment",full_payment:"Full Payment"}[e.paymentType]}
💵 <b>Amount:</b> ${D(e.amount)}
${e.method?`📱 <b>Method:</b> ${G(e.method)}`:""}

👤 <b>Customer:</b> ${G(e.customerName)}
🔧 <b>Locksmith:</b> ${G(e.locksmithName)}

🕐 <b>Time:</b> ${O(new Date)}
`,"HTML",M)}async function Z(e){return P(`
⚠️ <b>Refund Requested</b>

🔢 <b>Job #:</b> ${G(e.jobNumber)}
💵 <b>Amount:</b> ${D(e.amount)}

👤 <b>Customer:</b> ${G(e.customerName)}
📝 <b>Reason:</b> ${G(e.reason)}

⏳ <i>Requires admin review</i>

🕐 <b>Time:</b> ${O(new Date)}
`,"HTML",M)}async function V(e){let t=e.approved?"✅ Approved":"❌ Denied";return P(`
💸 <b>Refund ${e.approved?"Processed":"Denied"}</b>

🔢 <b>Job #:</b> ${G(e.jobNumber)}
💵 <b>Amount:</b> ${D(e.amount)}
📊 <b>Status:</b> ${t}

👤 <b>Customer:</b> ${G(e.customerName)}

${e.adminNotes?`📝 <b>Notes:</b> ${G(e.adminNotes)}`:""}

🕐 <b>Time:</b> ${O(new Date)}
`,"HTML",M)}async function z(e){return P(`
📍 <b>Locksmith Arrived</b>

🔢 <b>Job #:</b> ${G(e.jobNumber)}

🔧 <b>Locksmith:</b> ${G(e.locksmithName)}
👤 <b>Customer:</b> ${G(e.customerName)}
📍 <b>Location:</b> ${G(e.address)}

🕐 <b>Time:</b> ${O(new Date)}
`,"HTML",_)}async function X(e){let t="⭐".repeat(Math.min(5,Math.max(1,Math.round(e.rating))));return P(`
📝 <b>New Review</b>

🔢 <b>Job #:</b> ${G(e.jobNumber)}
${t} <b>${e.rating}/5</b>

🔧 <b>Locksmith:</b> ${G(e.locksmithName)}
👤 <b>Customer:</b> ${G(e.customerName)}

${e.comment?`💬 "${G(e.comment)}"`:""}

🕐 <b>Time:</b> ${O(new Date)}
`,"HTML",k)}async function ee(e){let t=e.paymentProcessed?"✅ Payment auto-processed":"⚠️ Payment pending (no saved card)";return P(`
⏰ <b>Job Auto-Completed</b>

🔢 <b>Job #:</b> ${G(e.jobNumber)}
💰 <b>Total:</b> ${D(e.total)}

👤 <b>Customer:</b> ${G(e.customerName)}
🔧 <b>Locksmith:</b> ${G(e.locksmithName)}

📋 <b>Status:</b> ${t}

<i>24-hour deadline passed without customer signature</i>

🕐 <b>Time:</b> ${O(new Date)}
`,"HTML",_)}async function et(e){return P(`
🏦 <b>Stripe Connect Completed</b>

🔧 <b>Locksmith:</b> ${G(e.locksmithName)}
📧 <b>Email:</b> ${G(e.locksmithEmail)}

✅ <i>Ready to receive instant payouts</i>

🕐 <b>Time:</b> ${O(new Date)}
`,"HTML",L)}async function eo(e){return P(`
🎯 <b>New Lead Captured</b>

${e.email?`📧 <b>Email:</b> ${G(e.email)}`:""}
${e.phone?`📱 <b>Phone:</b> ${G(e.phone)}`:""}
📣 <b>Source:</b> ${G(e.source)}
${e.utmCampaign?`🏷️ <b>Campaign:</b> ${G(e.utmCampaign)}`:""}

🕐 <b>Time:</b> ${O(new Date)}
`,"HTML",A)}async function ea(t){let o,n,r;try{let o=await e.A(795258),a={title:t.title,message:t.message,severity:t.severity??"info",bypassQuietHours:t.bypassQuietHours};if(await o.isAlertEnforcementEnabled()){let e=await o.evaluateAlert(a,{shadow:!1});if(!e.allow)return console.log(`[control-plane:enforce] alert suppressed code=${e.code??""} title="${t.title}"`),!0}else o.evaluateAlert(a,{shadow:!0}).catch(()=>{})}catch(e){console.warn("[control-plane] alert gate unavailable, sending via legacy path:",e)}if(!t.bypassPolicyGate)try{let{getOperationalPolicy:o}=await e.A(331694),a=await o(),n="critical"===a.alertSensitivity?4:"workflow"===a.alertSensitivity?3:1,r=t.severity||"info";if(({info:1,warning:3,error:4})[r]<n)return console.log(`[Telegram][gated] sendAdminAlert suppressed severity=${r} sensitivity=${a.alertSensitivity} title=${t.title}`),!0}catch(e){console.warn("[Telegram][gating] policy lookup failed, sending alert:",e)}let s=t.severity||"info",i={info:"ℹ️",warning:"⚠️",error:"🚨"}[s];if(!t.bypassQuietHours&&function(e=new Date){if(!p||T===$)return!1;let t=Number.parseInt(new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/London",hour:"2-digit",hour12:!1}).format(e),10);return 24===t&&(t=0),T<$?t>=T&&t<$:t>=T||t<$}())return console.log(`[Telegram][quiet-hours] suppressed alert severity=${s} title=${t.title}`),!0;let b=t.dedupeKey||`${s}:${t.title.toLowerCase().replace(/\b\d+\b/g,"#").replace(/\b[a-f0-9]{6,}\b/gi,"{id}").replace(/\s+/g," ").trim()}`,m=t.cooldownMsOverride??(o=Number(process.env.TELEGRAM_ALERT_INFO_COOLDOWN_MINUTES??"60"),n=Number(process.env.TELEGRAM_ALERT_WARNING_COOLDOWN_MINUTES??"15"),r=Number(process.env.TELEGRAM_ALERT_ERROR_COOLDOWN_MINUTES??"30"),"error"===s?60*Math.max(0,r)*1e3:"warning"===s?60*Math.max(0,n)*1e3:60*Math.max(0,o)*1e3);if(await E(b,m))return console.log(`[Telegram][dedupe] suppressed alert key=${b} severity=${s} title=${t.title}`),!0;let c=`
${i} <b>${G(t.title)}</b>

${G(t.message)}

🕐 <b>Time:</b> ${O(new Date)}
`,d=t.topicThreadId??("social"===t.topic?C:v);if(await P(c,"HTML",d))return await h(b,{title:t.title,message:t.message,severity:s,cooldownMs:m}),!0;if("error"!==s||!l)return!1;let f=[...new Set([...u,a.LOCKSMITH_ADMIN_PHONE].map(e=>e.trim()).filter(Boolean))];if(0===f.length)return console.warn("[Telegram][fallback] No fallback phone numbers configured for critical alert"),!1;try{let{sendSMS:o}=await e.A(834293),a=`LOCKSAFE P1 ALERT
${t.title}
${t.message}
Time: ${O(new Date)}`,n=(await Promise.all(f.map(e=>o(e,a,{logContext:`admin_alert_fallback:${t.title}`})))).filter(e=>e.success).length;if(n>0)return await h(b,{title:t.title,message:t.message,severity:s,cooldownMs:m}),console.warn(`[Telegram][fallback] Telegram failed; sent critical alert via SMS to ${n}/${f.length} recipients`),!0;return console.error("[Telegram][fallback] Telegram failed and SMS fallback also failed",{title:t.title,phones:f}),!1}catch(e){return console.error("[Telegram][fallback] SMS fallback threw an error:",e),!1}}async function en(e){return P(`
📊 <b>Daily Summary - ${G(e.date)}</b>

👥 <b>Users:</b>
• New Customers: ${e.newCustomers}
• New Locksmiths: ${e.newLocksmiths}

📋 <b>Jobs:</b>
• New Jobs: ${e.newJobs}
• Completed: ${e.completedJobs}

💰 <b>Revenue:</b>
• Total: ${D(e.totalRevenue)}
• Platform Earnings: ${D(e.platformEarnings)}
`,"HTML",v)}async function er(){if(!s||!i)return{success:!1,message:"Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID in environment variables"};if(!b)return{success:!1,message:"Telegram notifications are disabled (set TELEGRAM_NOTIFICATIONS_ENABLED=true)"};try{if(await P(`✅ <b>LockSafe Telegram Integration Test</b>

🔔 Notifications are working!

🕐 ${O(new Date)}`))return{success:!0,message:"Test message sent successfully!"};return{success:!1,message:"Failed to send test message"}}catch(e){return{success:!1,message:`Error: ${e instanceof Error?e.message:"Unknown error"}`}}}async function es(e){return P(`
❌ <b>Locksmith Declined Assignment</b>

🔢 <b>Job #:</b> ${G(e.jobNumber)}
🔧 <b>Locksmith:</b> ${G(e.locksmithName)}
📱 <b>Phone:</b> ${G(e.locksmithPhone)}

📍 <b>Location:</b> ${G(e.postcode)}
🔑 <b>Problem:</b> ${G(e.problemType)}

💬 <b>Reason:</b> ${G(e.reason)}

⚠️ <b>Action Required:</b> Reassign this job to another locksmith

🕐 <b>Time:</b> ${O(new Date)}
`,"HTML",v)}e.s(["notifyApplicationAccepted",0,F,"notifyAssessmentFeePaid",0,U,"notifyJobAutoCompleted",0,ee,"notifyJobSigned",0,q,"notifyLocksmithApplication",0,B,"notifyLocksmithArrived",0,z,"notifyLocksmithDeclinedAssignment",0,es,"notifyNewCustomer",0,H,"notifyNewJob",0,j,"notifyNewLead",0,eo,"notifyNewLocksmith",0,J,"notifyPaymentReceived",0,Y,"notifyQuoteAccepted",0,Q,"notifyQuoteDeclined",0,W,"notifyQuoteSubmitted",0,x,"notifyRefundProcessed",0,V,"notifyRefundRequested",0,Z,"notifyReviewSubmitted",0,X,"notifyStripeConnectCompleted",0,et,"notifyWorkCompleted",0,K,"sendAdminAlert",0,ea,"sendDailySummary",0,en,"testTelegramConnection",0,er])}];

//# sourceMappingURL=src_lib_telegram_ts_0junhbg._.js.map