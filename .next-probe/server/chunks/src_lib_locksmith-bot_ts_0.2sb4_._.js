module.exports=[431723,e=>{"use strict";var t=e.i(843793),a=e.i(463021),i=e.i(160113),o=e.i(548425),s=e.i(681913);process.env.TELEGRAM_LOCKSMITH_BOT_TOKEN||process.env.TELEGRAM_BOT_TOKEN;let n="https://www.locksafe.uk";function r(e){return e.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}function c(e){return`\xa3${e.toFixed(2)}`}async function l(e,a="telegram"){try{return await t.default.locksmith.findFirst({where:{[({telegram:"telegramChatId",whatsapp:"whatsappChatId"})[a]]:e,isActive:!0,isVerified:!0},select:{id:!0,name:!0,isAvailable:!0}})}catch{return null}}async function u(e,a,i="telegram"){try{return await t.default.locksmith.update({where:{id:e},data:{[({telegram:"telegramChatId",whatsapp:"whatsappChatId"})[i]]:a}}),!0}catch{return!1}}async function d(e){try{let a=await t.default.locksmith.findUnique({where:{id:e},select:{isAvailable:!0,name:!0}});if(!a)return{success:!1,isAvailable:!1,message:"Locksmith not found"};let i=!a.isAvailable;if(i){let t=await (0,o.getAvailabilityBlock)(e);if(t)return{success:!1,isAvailable:!1,message:`⚠️ ${t.message}
👉 ${t.deepLink}`+(t.alsoMissing.length?`

Also still needed: ${t.alsoMissing.join(", ")}.`:"")}}await t.default.locksmith.update({where:{id:e},data:{isAvailable:i,lastAvailabilityChange:new Date}});let s=i?"🟢 You're now AVAILABLE and will receive job notifications!":"⚫ You're now OFFLINE. You won't receive new job notifications.";return{success:!0,isAvailable:i,message:s}}catch(e){return console.error("[LocksmithBot] Availability toggle error:",e),{success:!1,isAvailable:!1,message:"Failed to update availability"}}}async function m(e,a){try{if(a){let t=await (0,o.getAvailabilityBlock)(e);if(t)return{success:!1,message:`⚠️ ${t.message}
👉 ${t.deepLink}`+(t.alsoMissing.length?`

Also still needed: ${t.alsoMissing.join(", ")}.`:"")}}await t.default.locksmith.update({where:{id:e},data:{isAvailable:a,lastAvailabilityChange:new Date}});let i=a?"🟢 You're now AVAILABLE and will receive job notifications!":"⚫ You're now OFFLINE. You won't receive new job notifications.";return{success:!0,message:i}}catch(e){return{success:!1,message:"Failed to update availability"}}}async function b(e){return{jobs:(await t.default.job.findMany({where:{locksmithId:e,status:{in:[a.JobStatus.ACCEPTED,a.JobStatus.EN_ROUTE,a.JobStatus.ARRIVED,a.JobStatus.DIAGNOSING,a.JobStatus.QUOTED,a.JobStatus.QUOTE_ACCEPTED,a.JobStatus.IN_PROGRESS,a.JobStatus.PENDING_CUSTOMER_CONFIRMATION]}},include:{customer:{select:{name:!0}}},orderBy:{createdAt:"desc"},take:10})).map(e=>({id:e.id,jobNumber:e.jobNumber,status:e.status,postcode:e.postcode,problemType:e.problemType,customerName:e.customer?.name||"Customer",createdAt:e.createdAt}))}}async function p(e){return{applications:(await t.default.locksmithApplication.findMany({where:{locksmithId:e,status:"pending"},include:{job:{select:{id:!0,jobNumber:!0,postcode:!0,problemType:!0}}},orderBy:{createdAt:"desc"},take:10})).map(e=>({applicationId:e.id,jobId:e.job.id,jobNumber:e.job.jobNumber,postcode:e.job.postcode,problemType:e.job.problemType,assessmentFee:e.assessmentFee,eta:e.eta,appliedAt:e.createdAt}))}}async function h(e,o){try{let n=await t.default.locksmithApplication.findUnique({where:{jobId_locksmithId:{jobId:o,locksmithId:e}},include:{job:{include:{customer:!0}},locksmith:!0}});if(!n)return{success:!1,message:"Job application not found"};if("pending"!==n.status)return{success:!1,message:`Application already ${n.status}`};await t.default.locksmithApplication.update({where:{id:n.id},data:{status:"accepted"}}),await t.default.job.update({where:{id:o},data:{locksmithId:e,status:a.JobStatus.ACCEPTED,acceptedAt:new Date,acceptedEta:n.eta}});let r={jobId:n.job.id,jobNumber:n.job.jobNumber,customerName:n.job.customer?.name||"Customer",customerPhone:n.job.customer?.phone||"",locksmithName:n.locksmith.name,locksmithPhone:n.locksmith.phone,postcode:n.job.postcode,problemType:n.job.problemType,assessmentFee:n.assessmentFee};return await (0,s.notifyLocksmithAutoDispatchConfirmed)(r),await (0,i.sendCustomerCalloutPaymentRequest)({jobId:n.job.id,jobNumber:n.job.jobNumber,applicationId:n.id,customerId:n.job.customerId,customerName:n.job.customer?.name||"Customer",customerPhone:n.job.customer?.phone,customerEmail:n.job.customer?.email,locksmithName:n.locksmith.name,locksmithCompany:n.locksmith.companyName,assessmentFee:n.assessmentFee,etaMinutes:n.eta,problemType:n.job.problemType,address:n.job.address,postcode:n.job.postcode}),{success:!0,message:`✅ You've accepted ${n.job.jobNumber}. Head to ${n.job.postcode} now!`,job:{jobNumber:n.job.jobNumber,postcode:n.job.postcode}}}catch(e){return console.error("[LocksmithBot] Accept job error:",e),{success:!1,message:"Failed to accept job"}}}async function g(e,a,i){try{return await t.default.locksmithApplication.update({where:{jobId_locksmithId:{jobId:a,locksmithId:e}},data:{status:"rejected",message:i||"Declined via bot"}}),{success:!0,message:"Job declined. We'll find another locksmith."}}catch(e){return{success:!1,message:"Failed to decline job"}}}async function f(e){let a=new Date,i=new Date(a.getFullYear(),a.getMonth(),a.getDate()),o=new Date(i);o.setDate(o.getDate()-o.getDay());let s=new Date(a.getFullYear(),a.getMonth(),1),[n,r,c,l,u]=await Promise.all([t.default.payment.aggregate({_sum:{amount:!0},where:{job:{locksmithId:e},status:"succeeded",createdAt:{gte:i}}}),t.default.payment.aggregate({_sum:{amount:!0},where:{job:{locksmithId:e},status:"succeeded",createdAt:{gte:o}}}),t.default.payment.aggregate({_sum:{amount:!0},where:{job:{locksmithId:e},status:"succeeded",createdAt:{gte:s}}}),t.default.payout.aggregate({_sum:{netAmount:!0},where:{locksmithId:e,status:"pending"}}),t.default.locksmith.findUnique({where:{id:e},select:{totalEarnings:!0,totalJobs:!0}})]);return{today:n._sum.amount||0,thisWeek:r._sum.amount||0,thisMonth:c._sum.amount||0,pendingPayout:l._sum.netAmount||0,totalEarnings:u?.totalEarnings||0,jobsCompleted:u?.totalJobs||0}}async function w(e){try{let a=await t.default.job.findMany({where:{locksmithId:e},select:{id:!0,createdAt:!0},orderBy:{createdAt:"desc"},take:20});if(0===a.length)return 15;let i=a.map(e=>e.id),o=new Map(a.map(e=>[e.id,e.createdAt])),s=await t.default.jobMessage.findMany({where:{jobId:{in:i},locksmithId:e,senderType:"locksmith"},select:{jobId:!0,createdAt:!0},orderBy:{createdAt:"asc"},distinct:["jobId"]});if(0===s.length)return 15;let n=s.reduce((e,t)=>{let a=o.get(t.jobId);return a?e+(t.createdAt.getTime()-a.getTime())/6e4:e},0);return Math.round(n/s.length)}catch{return 15}}async function y(e){let[i,o,s,n]=await Promise.all([t.default.locksmith.findUnique({where:{id:e},select:{rating:!0}}),t.default.locksmithApplication.count({where:{locksmithId:e}}),t.default.job.count({where:{locksmithId:e,status:{in:[a.JobStatus.COMPLETED,a.JobStatus.SIGNED]}}}),t.default.job.count({where:{locksmithId:e}}),t.default.review.count({where:{locksmithId:e}})]),r=await t.default.locksmithApplication.count({where:{locksmithId:e,status:"accepted"}});return{rating:i?.rating||5,totalReviews:await t.default.review.count({where:{locksmithId:e}}),acceptanceRate:o>0?r/o*100:100,avgResponseTime:await w(e),completionRate:n>0?s/n*100:100}}async function k(e,t,a="medium"){let i={cylinder:[{name:"Euro Cylinder (standard)",avgPrice:25},{name:"Euro Cylinder (anti-snap)",avgPrice:45},{name:"Euro Cylinder (high security)",avgPrice:75}],mortice:[{name:"British Standard Mortice Lock",avgPrice:65},{name:"Mortice Sash Lock",avgPrice:55},{name:"Mortice Deadlock",avgPrice:45}],multipoint:[{name:"Multipoint Lock Mechanism",avgPrice:120},{name:"Multipoint Gearbox",avgPrice:85},{name:"Multipoint Hooks & Rollers",avgPrice:35}],car:[{name:"Transponder Key Programming",avgPrice:80},{name:"Remote Key Fob",avgPrice:60},{name:"Emergency Key Blade",avgPrice:25}]},o=e.toLowerCase().includes("cylinder")?"cylinder":e.toLowerCase().includes("mortice")?"mortice":e.toLowerCase().includes("multi")?"multipoint":e.toLowerCase().includes("car")||e.toLowerCase().includes("vehicle")?"car":"cylinder",s=a.toLowerCase().includes("easy")?"easy":a.toLowerCase().includes("hard")?"hard":a.toLowerCase().includes("specialist")?"specialist":"medium",n=[];return t.toLowerCase().includes("lockout")&&(n.push("Non-destructive entry methods preferred - better for customer satisfaction"),n.push("Confirm customer ID before entry")),(t.toLowerCase().includes("broken")||t.toLowerCase().includes("damaged"))&&(n.push("Take photos of damage BEFORE starting work"),n.push("May need replacement parts - check stock")),(t.toLowerCase().includes("upgrade")||t.toLowerCase().includes("security"))&&(n.push("Recommend British Standard locks for insurance compliance"),n.push("Offer multiple security tier options")),n.push("Always provide itemised quote breakdown"),n.push("Include warranty information in quote"),{suggestedLabour:({easy:{cylinder:35,mortice:45,multipoint:55,car:50},medium:{cylinder:55,mortice:75,multipoint:95,car:85},hard:{cylinder:85,mortice:110,multipoint:140,car:130},specialist:{cylinder:120,mortice:160,multipoint:200,car:180}})[s]?.[o]||60,suggestedTime:({easy:{cylinder:15,mortice:25,multipoint:30,car:20},medium:{cylinder:30,mortice:45,multipoint:60,car:40},hard:{cylinder:45,mortice:75,multipoint:90,car:60},specialist:{cylinder:60,mortice:90,multipoint:120,car:90}})[s]?.[o]||30,commonParts:i[o]||i.cylinder,difficulty:s,tips:n}}async function j(e,t,a=[]){let i=await l(e.chatId,e.platform);if(!i&&"start"!==t)return{text:"❌ Your chat isn't registered with a locksmith account.\n\nUse /start to register.",buttons:[{text:"🔗 Register Account",url:`${n}/locksmith/settings`}]};switch(t){case"start":case"help":var o;let s;return s=(o=i)?`Hi ${r(o.name)}! `:"",{text:`
🔧 <b>LockSafe Locksmith Bot</b>

${s}Here's what you can do:

<b>📍 Availability</b>
/status - Check your current status
/available - Go online
/offline - Go offline
/toggle - Toggle availability

<b>📋 Jobs</b>
/jobs - View your active jobs
/pending - View pending applications
/accept &lt;job&gt; - Accept a job
/decline &lt;job&gt; - Decline a job

<b>💰 Earnings</b>
/earnings - View earnings summary
/stats - View performance stats

<b>💡 Quote Help</b>
/quote_help &lt;lock_type&gt; - Get pricing guidance

<i>Need help? Contact support@locksafe.uk</i>
    `.trim(),buttons:[{text:"📊 Dashboard",url:`${n}/locksmith/dashboard`},{text:"⚙️ Settings",url:`${n}/locksmith/settings`}]};case"status":return await A(e.locksmithId);case"available":return await v(e.locksmithId,!0);case"offline":return await v(e.locksmithId,!1);case"toggle":return await $(e.locksmithId);case"jobs":return await E(e.locksmithId);case"pending":return await C(e.locksmithId);case"earnings":return await I(e.locksmithId);case"stats":return await T(e.locksmithId);case"accept":if(0===a.length)return{text:"Usage: /accept <job_number or job_id>"};return await _(e.locksmithId,a[0]);case"decline":if(0===a.length)return{text:"Usage: /decline <job_number or job_id> [reason]"};return await N(e.locksmithId,a[0],a.slice(1).join(" "));case"quote_help":return await x(a);default:return{text:"Unknown command. Type /help for available commands."}}}async function A(e){let i=await t.default.locksmith.findUnique({where:{id:e},select:{name:!0,isAvailable:!0,lastAvailabilityChange:!0,rating:!0}});if(!i)return{text:"❌ Account not found"};let o=await t.default.job.count({where:{locksmithId:e,status:{in:[a.JobStatus.ACCEPTED,a.JobStatus.EN_ROUTE,a.JobStatus.IN_PROGRESS]}}}),s=i.isAvailable?"🟢":"⚫",n=i.isAvailable?"AVAILABLE":"OFFLINE";return{text:`
${s} <b>Status: ${n}</b>

👤 ${r(i.name)}
⭐ Rating: ${i.rating.toFixed(1)}
📋 Active Jobs: ${o}

<i>Last updated: ${i.lastAvailabilityChange?.toLocaleString("en-GB")||"N/A"}</i>
    `.trim(),buttons:[i.isAvailable?{text:"⚫ Go Offline",callbackData:"cmd_offline"}:{text:"🟢 Go Online",callbackData:"cmd_available"}]}}async function v(e,t){return{text:(await m(e,t)).message}}async function $(e){let t=await d(e);return{text:t.message,buttons:[t.isAvailable?{text:"⚫ Go Offline",callbackData:"cmd_offline"}:{text:"🟢 Go Online",callbackData:"cmd_available"}]}}async function E(e){let{jobs:t}=await b(e);if(0===t.length)return{text:"📋 <b>Active Jobs</b>\n\nNo active jobs at the moment.",buttons:[{text:"🔍 Find Jobs",url:`${n}/locksmith/jobs`}]};let a={ACCEPTED:"✅",EN_ROUTE:"🚗",ARRIVED:"📍",DIAGNOSING:"🔍",QUOTED:"💬",QUOTE_ACCEPTED:"👍",IN_PROGRESS:"🔧",PENDING_CUSTOMER_CONFIRMATION:"✍️"},i=`📋 <b>Active Jobs (${t.length})</b>

`;for(let e of t)i+=`${a[e.status]||"•"} <b>${e.jobNumber}</b>
   ${e.postcode} - ${e.problemType}
   ${r(e.customerName)}

`;return{text:i.trim(),buttons:t.slice(0,3).map(e=>({text:`View ${e.jobNumber}`,url:`${n}/locksmith/job/${e.id}`}))}}async function C(e){let{applications:t}=await p(e);if(0===t.length)return{text:"📋 <b>Pending Applications</b>\n\nNo pending applications."};let a=`📋 <b>Pending Applications (${t.length})</b>

`;for(let e of t)a+=`⏳ <b>${e.jobNumber}</b>
   ${e.postcode} - ${e.problemType}
   Fee: ${c(e.assessmentFee)} • ETA: ${e.eta}min

`;return{text:a.trim()}}async function I(e){let t=await f(e);return{text:`
💰 <b>Earnings Summary</b>

<b>Today:</b> ${c(t.today)}
<b>This Week:</b> ${c(t.thisWeek)}
<b>This Month:</b> ${c(t.thisMonth)}

<b>Pending Payout:</b> ${c(t.pendingPayout)}
<b>Total Earned:</b> ${c(t.totalEarnings)}
<b>Jobs Completed:</b> ${t.jobsCompleted}
    `.trim(),buttons:[{text:"📊 Full Breakdown",url:`${n}/locksmith/earnings`}]}}async function T(e){let t=await y(e);return{text:`
📊 <b>Performance Stats</b>

⭐ <b>Rating:</b> ${t.rating.toFixed(1)} (${t.totalReviews} reviews)
✅ <b>Acceptance Rate:</b> ${t.acceptanceRate.toFixed(0)}%
⏱️ <b>Avg Response:</b> ${t.avgResponseTime} mins
🎯 <b>Completion Rate:</b> ${t.completionRate.toFixed(0)}%
    `.trim(),buttons:[{text:"📈 View Details",url:`${n}/locksmith/dashboard`}]}}async function _(e,a){let i=await t.default.job.findFirst({where:{OR:[{id:a},{jobNumber:{equals:a.toUpperCase(),mode:"insensitive"}}]}});if(!i)return{text:`❌ Job "${a}" not found`};let o=await h(e,i.id);return o.success?{text:o.message,buttons:[{text:"📍 View Job",url:`${n}/locksmith/job/${i.id}`},{text:"🚗 Mark En Route",callbackData:`status_enroute_${i.id}`}]}:{text:`❌ ${o.message}`}}async function N(e,a,i){let o=await t.default.job.findFirst({where:{OR:[{id:a},{jobNumber:{equals:a.toUpperCase(),mode:"insensitive"}}]}});if(!o)return{text:`❌ Job "${a}" not found`};let s=await g(e,o.id,i);return{text:s.success?`✅ ${s.message}`:`❌ ${s.message}`}}async function x(e){if(0===e.length)return{text:`
💡 <b>Quote Assistance</b>

Get pricing guidance for your quotes:

<b>Usage:</b>
/quote_help cylinder
/quote_help mortice hard
/quote_help multipoint specialist

<b>Lock Types:</b> cylinder, mortice, multipoint, car
<b>Difficulty:</b> easy, medium, hard, specialist
      `.trim()};let t=e[0]||"cylinder",a=e[1]||"medium",i=await k(t,"general",a),o=i.commonParts.map(e=>`• ${e.name}: ${c(e.avgPrice)}`).join("\n");return{text:`
💡 <b>Quote Guidance: ${t.toUpperCase()}</b>
<i>Difficulty: ${i.difficulty}</i>

<b>Suggested Labour:</b> ${c(i.suggestedLabour)}
<b>Est. Time:</b> ${i.suggestedTime} minutes

<b>Common Parts:</b>
${o}

<b>💡 Tips:</b>
${i.tips.map(e=>`• ${e}`).join("\n")}

<i>Prices are market averages - adjust for your area.</i>
    `.trim()}}async function L(t,a){try{let{acceptAuction:i}=await e.A(968088),o=await i(a,t);if(!o.success)return{text:`❌ ${o.message}`};let s=o.rate?Math.round(100*o.rate):0;return{text:`✅ <b>Job Accepted!</b>

You've won the auction at <b>${s}% commission</b>.
You keep <b>${100-s}%</b> of all payments for this job.

Head to your app to manage the job.`}}catch(e){return console.error("[LocksmithBot] handleAcceptAuction error:",e),{text:"❌ Failed to accept auction. Please try again or contact support."}}}async function P(e,i){if("cmd_available"===i)return v(e.locksmithId,!0);if("cmd_offline"===i)return v(e.locksmithId,!1);if(i.startsWith("accept_auction:")){let t=i.replace("accept_auction:","");return L(e.locksmithId,t)}if(i.startsWith("accept_")){let t=i.replace("accept_","");return _(e.locksmithId,t)}if(i.startsWith("decline_")){let t=i.replace("decline_","");return N(e.locksmithId,t)}if(i.startsWith("status_enroute_")){let e=i.replace("status_enroute_","");return await t.default.job.update({where:{id:e},data:{status:a.JobStatus.EN_ROUTE,enRouteAt:new Date}}),{text:"🚗 Status updated: EN ROUTE"}}return{text:"Unknown action"}}e.s(["getActiveJobs",0,b,"getEarningsSummary",0,f,"getLocksmithByChatId",0,l,"getPendingApplications",0,p,"handleLocksmithCallback",0,P,"handleLocksmithCommand",0,j,"registerLocksmithChat",0,u,"setAvailability",0,m])}];

//# sourceMappingURL=src_lib_locksmith-bot_ts_0.2sb4_._.js.map