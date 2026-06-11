module.exports=[463021,(e,t,r)=>{t.exports=e.x("@prisma/client-2c3a283f134fdcb6",()=>require("@prisma/client-2c3a283f134fdcb6"))},843793,e=>{"use strict";var t=e.i(463021);let r=globalThis.prisma??new t.PrismaClient;e.s(["default",0,r,"prisma",0,r])},193695,(e,t,r)=>{t.exports=e.x("next/dist/shared/lib/no-fallback-error.external.js",()=>require("next/dist/shared/lib/no-fallback-error.external.js"))},442315,(e,t,r)=>{"use strict";t.exports=e.r(918622)},347540,(e,t,r)=>{"use strict";t.exports=e.r(442315).vendored["react-rsc"].React},819481,(e,t,r)=>{"use strict";var a=Object.defineProperty,n=Object.getOwnPropertyDescriptor,i=Object.getOwnPropertyNames,s=Object.prototype.hasOwnProperty,o={},l={RequestCookies:()=>f,ResponseCookies:()=>g,parseCookie:()=>p,parseSetCookie:()=>u,stringifyCookie:()=>c};for(var d in l)a(o,d,{get:l[d],enumerable:!0});function c(e){var t;let r=["path"in e&&e.path&&`Path=${e.path}`,"expires"in e&&(e.expires||0===e.expires)&&`Expires=${("number"==typeof e.expires?new Date(e.expires):e.expires).toUTCString()}`,"maxAge"in e&&"number"==typeof e.maxAge&&`Max-Age=${e.maxAge}`,"domain"in e&&e.domain&&`Domain=${e.domain}`,"secure"in e&&e.secure&&"Secure","httpOnly"in e&&e.httpOnly&&"HttpOnly","sameSite"in e&&e.sameSite&&`SameSite=${e.sameSite}`,"partitioned"in e&&e.partitioned&&"Partitioned","priority"in e&&e.priority&&`Priority=${e.priority}`].filter(Boolean),a=`${e.name}=${encodeURIComponent(null!=(t=e.value)?t:"")}`;return 0===r.length?a:`${a}; ${r.join("; ")}`}function p(e){let t=new Map;for(let r of e.split(/; */)){if(!r)continue;let e=r.indexOf("=");if(-1===e){t.set(r,"true");continue}let[a,n]=[r.slice(0,e),r.slice(e+1)];try{t.set(a,decodeURIComponent(null!=n?n:"true"))}catch{}}return t}function u(e){if(!e)return;let[[t,r],...a]=p(e),{domain:n,expires:i,httponly:s,maxage:o,path:l,samesite:d,secure:c,partitioned:u,priority:f}=Object.fromEntries(a.map(([e,t])=>[e.toLowerCase().replace(/-/g,""),t]));{var g,x,b={name:t,value:decodeURIComponent(r),domain:n,...i&&{expires:new Date(i)},...s&&{httpOnly:!0},..."string"==typeof o&&{maxAge:Number(o)},path:l,...d&&{sameSite:m.includes(g=(g=d).toLowerCase())?g:void 0},...c&&{secure:!0},...f&&{priority:h.includes(x=(x=f).toLowerCase())?x:void 0},...u&&{partitioned:!0}};let e={};for(let t in b)b[t]&&(e[t]=b[t]);return e}}t.exports=((e,t,r)=>{if(t&&"object"==typeof t||"function"==typeof t)for(let o of i(t))s.call(e,o)||void 0===o||a(e,o,{get:()=>t[o],enumerable:!(r=n(t,o))||r.enumerable});return e})(a({},"__esModule",{value:!0}),o);var m=["strict","lax","none"],h=["low","medium","high"],f=class{constructor(e){this._parsed=new Map,this._headers=e;const t=e.get("cookie");if(t)for(const[e,r]of p(t))this._parsed.set(e,{name:e,value:r})}[Symbol.iterator](){return this._parsed[Symbol.iterator]()}get size(){return this._parsed.size}get(...e){let t="string"==typeof e[0]?e[0]:e[0].name;return this._parsed.get(t)}getAll(...e){var t;let r=Array.from(this._parsed);if(!e.length)return r.map(([e,t])=>t);let a="string"==typeof e[0]?e[0]:null==(t=e[0])?void 0:t.name;return r.filter(([e])=>e===a).map(([e,t])=>t)}has(e){return this._parsed.has(e)}set(...e){let[t,r]=1===e.length?[e[0].name,e[0].value]:e,a=this._parsed;return a.set(t,{name:t,value:r}),this._headers.set("cookie",Array.from(a).map(([e,t])=>c(t)).join("; ")),this}delete(e){let t=this._parsed,r=Array.isArray(e)?e.map(e=>t.delete(e)):t.delete(e);return this._headers.set("cookie",Array.from(t).map(([e,t])=>c(t)).join("; ")),r}clear(){return this.delete(Array.from(this._parsed.keys())),this}[Symbol.for("edge-runtime.inspect.custom")](){return`RequestCookies ${JSON.stringify(Object.fromEntries(this._parsed))}`}toString(){return[...this._parsed.values()].map(e=>`${e.name}=${encodeURIComponent(e.value)}`).join("; ")}},g=class{constructor(e){var t,r,a;this._parsed=new Map,this._headers=e;const n=null!=(a=null!=(r=null==(t=e.getSetCookie)?void 0:t.call(e))?r:e.get("set-cookie"))?a:[];for(const e of Array.isArray(n)?n:function(e){if(!e)return[];var t,r,a,n,i,s=[],o=0;function l(){for(;o<e.length&&/\s/.test(e.charAt(o));)o+=1;return o<e.length}for(;o<e.length;){for(t=o,i=!1;l();)if(","===(r=e.charAt(o))){for(a=o,o+=1,l(),n=o;o<e.length&&"="!==(r=e.charAt(o))&&";"!==r&&","!==r;)o+=1;o<e.length&&"="===e.charAt(o)?(i=!0,o=n,s.push(e.substring(t,a)),t=o):o=a+1}else o+=1;(!i||o>=e.length)&&s.push(e.substring(t,e.length))}return s}(n)){const t=u(e);t&&this._parsed.set(t.name,t)}}get(...e){let t="string"==typeof e[0]?e[0]:e[0].name;return this._parsed.get(t)}getAll(...e){var t;let r=Array.from(this._parsed.values());if(!e.length)return r;let a="string"==typeof e[0]?e[0]:null==(t=e[0])?void 0:t.name;return r.filter(e=>e.name===a)}has(e){return this._parsed.has(e)}set(...e){let[t,r,a]=1===e.length?[e[0].name,e[0].value,e[0]]:e,n=this._parsed;return n.set(t,function(e={name:"",value:""}){return"number"==typeof e.expires&&(e.expires=new Date(e.expires)),e.maxAge&&(e.expires=new Date(Date.now()+1e3*e.maxAge)),(null===e.path||void 0===e.path)&&(e.path="/"),e}({name:t,value:r,...a})),function(e,t){for(let[,r]of(t.delete("set-cookie"),e)){let e=c(r);t.append("set-cookie",e)}}(n,this._headers),this}delete(...e){let[t,r]="string"==typeof e[0]?[e[0]]:[e[0].name,e[0]];return this.set({...r,name:t,value:"",expires:new Date(0)})}[Symbol.for("edge-runtime.inspect.custom")](){return`ResponseCookies ${JSON.stringify(Object.fromEntries(this._parsed))}`}toString(){return[...this._parsed.values()].map(c).join("; ")}}},254799,(e,t,r)=>{t.exports=e.x("crypto",()=>require("crypto"))},918622,(e,t,r)=>{t.exports=e.x("next/dist/compiled/next-server/app-page-turbo.runtime.prod.js",()=>require("next/dist/compiled/next-server/app-page-turbo.runtime.prod.js"))},556704,(e,t,r)=>{t.exports=e.x("next/dist/server/app-render/work-async-storage.external.js",()=>require("next/dist/server/app-render/work-async-storage.external.js"))},832319,(e,t,r)=>{t.exports=e.x("next/dist/server/app-render/work-unit-async-storage.external.js",()=>require("next/dist/server/app-render/work-unit-async-storage.external.js"))},324725,(e,t,r)=>{t.exports=e.x("next/dist/server/app-render/after-task-async-storage.external.js",()=>require("next/dist/server/app-render/after-task-async-storage.external.js"))},224361,(e,t,r)=>{t.exports=e.x("util",()=>require("util"))},688947,(e,t,r)=>{t.exports=e.x("stream",()=>require("stream"))},798003,e=>{"use strict";function t(e){return e.replace(/[^\d+]/g,"")}let r=process.env.NEXT_PUBLIC_SUPPORT_PHONE||process.env.RETELL_PHONE_NUMBER||"+44 20 4577 1989",a=process.env.NEXT_PUBLIC_SUPPORT_PHONE_TEL||t(r),n=process.env.NEXT_PUBLIC_LOCKSMITH_ADMIN_PHONE||"07818 333 989";process.env.NEXT_PUBLIC_LOCKSMITH_ADMIN_PHONE_TEL||t(n);let i=process.env.NEXT_PUBLIC_LOCKSMITH_ADMIN_WHATSAPP||"+44 7446 588587".replace(/\D/g,""),s={url:"https://www.locksafe.uk",name:"LockSafe UK",supportEmail:"contact@locksafe.uk",helpEmail:"contact@locksafe.uk",phone:r,phoneFormatted:a,twitter:"@locksafeuk"},o=s.url,l=s.name,d=s.supportEmail,c=s.phone;s.phoneFormatted,e.s(["LOCKSMITH_ADMIN_PHONE",0,n,"LOCKSMITH_ADMIN_WHATSAPP",0,i,"SITE_NAME",0,l,"SITE_URL",0,o,"SUPPORT_EMAIL",0,d,"SUPPORT_PHONE",0,c,"getFullUrl",0,function(e=""){let t=s.url.replace(/\/$/,""),r=e.startsWith("/")?e:`/${e}`;return`${t}${r}`},"siteConfig",0,s])},334227,e=>{"use strict";var t=e.i(843793);function r(e){let t={emailNotifications:!0};switch(e){case"active_locksmiths":return{...t,isActive:!0};case"inactive_locksmiths":return{...t,isActive:!1};case"stripe_not_onboarded":return{...t,stripeConnectOnboarded:!1};case"schedule_enabled":return{...t,scheduleEnabled:!0};case"no_base_location":return{...t,OR:[{baseLat:null},{baseLng:null}]};default:return t}}async function a(e,a){let n=r(e);return(await t.default.locksmith.findMany({where:n,orderBy:{createdAt:"desc"},...a?{take:a}:{},select:{id:!0,name:!0,email:!0}})).filter(e=>!!e.email).map(e=>({id:e.id,name:e.name,email:e.email}))}async function n(){return Object.fromEntries(await Promise.all(["all_locksmiths","active_locksmiths","inactive_locksmiths","stripe_not_onboarded","schedule_enabled","no_base_location"].map(async e=>{let a=await t.default.locksmith.count({where:r(e)});return[e,a]})))}e.s(["getLocksmithRecipientsBySegment",0,a,"getLocksmithSegmentCounts",0,n])},170851,e=>{"use strict";var t=e.i(246245),r=e.i(798003);function a(e){let t=e.accentColor||"#f97316",a=e.preheader||"",i={announcement:{bg:`linear-gradient(135deg, ${t}, ${n(t,-20)})`,icon:"📢"},newsletter:{bg:"linear-gradient(135deg, #1e293b, #334155)",icon:"📰"},update:{bg:"linear-gradient(135deg, #3b82f6, #2563eb)",icon:"🔄"},promo:{bg:"linear-gradient(135deg, #16a34a, #15803d)",icon:"🎉"},urgent:{bg:"linear-gradient(135deg, #dc2626, #b91c1c)",icon:"⚠️"},custom:{bg:`linear-gradient(135deg, ${t}, ${n(t,-20)})`,icon:"✉️"}},s=i[e.template]||i.custom,o=e.recipientId?`<img src="${r.SITE_URL}/api/admin/emails/track?type=open&rid=${e.recipientId}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;" />`:"",l=e.ctaUrl&&e.recipientId?`${r.SITE_URL}/api/admin/emails/track?type=click&rid=${e.recipientId}&url=${encodeURIComponent(e.ctaUrl)}`:e.ctaUrl;return`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="X-UA-Compatible" content="IE=edge">
      <title>${e.subject}</title>
      <!--[if mso]>
      <style type="text/css">
        body, table, td {font-family: Arial, Helvetica, sans-serif !important;}
      </style>
      <![endif]-->
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        body {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          line-height: 1.6;
          color: #1e293b;
          background-color: #f8fafc;
          -webkit-font-smoothing: antialiased;
        }

        .preheader {
          display: none !important;
          visibility: hidden;
          mso-hide: all;
          font-size: 1px;
          line-height: 1px;
          max-height: 0;
          max-width: 0;
          opacity: 0;
          overflow: hidden;
        }

        .container {
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
        }

        .email-wrapper {
          background: #ffffff;
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1);
        }

        .header {
          background: ${s.bg};
          padding: 40px 32px;
          text-align: center;
          color: #ffffff;
        }

        .header-icon {
          font-size: 48px;
          margin-bottom: 16px;
          display: block;
        }

        .header h1 {
          font-size: 28px;
          font-weight: 700;
          margin: 0;
          letter-spacing: -0.5px;
        }

        .content {
          padding: 32px;
          background: #ffffff;
        }

        .greeting {
          font-size: 16px;
          color: #64748b;
          margin-bottom: 24px;
        }

        .body-content {
          font-size: 16px;
          color: #334155;
          line-height: 1.7;
        }

        .body-content p {
          margin-bottom: 16px;
        }

        .body-content ul, .body-content ol {
          margin: 16px 0;
          padding-left: 24px;
        }

        .body-content li {
          margin-bottom: 8px;
        }

        .cta-wrapper {
          text-align: center;
          margin: 32px 0;
        }

        .cta-button {
          display: inline-block;
          background: ${t};
          color: #ffffff !important;
          padding: 16px 40px;
          font-size: 16px;
          font-weight: 600;
          text-decoration: none;
          border-radius: 10px;
          box-shadow: 0 4px 14px rgba(249, 115, 22, 0.4);
          transition: transform 0.2s, box-shadow 0.2s;
        }

        .cta-button:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(249, 115, 22, 0.5);
        }

        .divider {
          height: 1px;
          background: linear-gradient(to right, transparent, #e2e8f0, transparent);
          margin: 24px 0;
        }

        .footer {
          background: #f8fafc;
          padding: 24px 32px;
          text-align: center;
          border-top: 1px solid #e2e8f0;
        }

        .footer-logo {
          font-size: 20px;
          font-weight: 700;
          color: ${t};
          margin-bottom: 12px;
        }

        .footer-text {
          font-size: 12px;
          color: #94a3b8;
          line-height: 1.6;
        }

        .footer-links {
          margin-top: 16px;
        }

        .footer-links a {
          color: #64748b;
          text-decoration: none;
          margin: 0 8px;
          font-size: 12px;
        }

        .footer-links a:hover {
          color: ${t};
        }

        .social-links {
          margin-top: 16px;
        }

        .social-links a {
          display: inline-block;
          margin: 0 8px;
        }

        @media only screen and (max-width: 600px) {
          .container {
            padding: 12px;
          }

          .header {
            padding: 32px 24px;
          }

          .header h1 {
            font-size: 24px;
          }

          .content {
            padding: 24px;
          }

          .cta-button {
            padding: 14px 32px;
          }
        }
      </style>
    </head>
    <body>
      <div class="preheader">${a}</div>

      <div class="container">
        <div class="email-wrapper">
          <!-- Header -->
          <div class="header">
            <span class="header-icon">${s.icon}</span>
            ${e.headline?`<h1>${e.headline}</h1>`:""}
          </div>

          <!-- Content -->
          <div class="content">
            <p class="greeting">Hi ${e.toName},</p>

            <div class="body-content">
              ${e.body}
            </div>

            ${e.ctaText&&l?`
            <div class="cta-wrapper">
              <a href="${l}" class="cta-button" target="_blank">${e.ctaText}</a>
            </div>
            `:""}

            <div class="divider"></div>

            <p style="font-size: 14px; color: #64748b; text-align: center;">
              Questions? Reply to this email or contact us at <a href="mailto:${r.SUPPORT_EMAIL}" style="color: ${t};">${r.SUPPORT_EMAIL}</a>
            </p>
          </div>

          <!-- Footer -->
          <div class="footer">
            <div class="footer-logo">${r.SITE_NAME}</div>
            <p class="footer-text">
              Emergency Locksmith Service<br>
              24/7 Available | Anti-Fraud Protected
            </p>
            <div class="footer-links">
              <a href="${r.SITE_URL}/locksmith/dashboard">Dashboard</a>
              <span style="color: #cbd5e1;">|</span>
              <a href="${r.SITE_URL}/locksmith/settings">Settings</a>
              <span style="color: #cbd5e1;">|</span>
              <a href="${r.SITE_URL}/help">Help</a>
            </div>
            <p class="footer-text" style="margin-top: 16px; font-size: 10px;">
              You're receiving this email because you're a registered locksmith on ${r.SITE_NAME}.<br>
              <a href="${r.SITE_URL}/locksmith/settings" style="color: #64748b;">Manage email preferences</a>
            </p>
          </div>
        </div>
      </div>

      ${o}
    </body>
    </html>
  `}function n(e,t){let r=Number.parseInt(e.replace("#",""),16),a=Math.round(2.55*t),n=(r>>16)+a,i=(r>>8&255)+a,s=(255&r)+a;return`#${(0x1000000+(n<255?n<1?0:n:255)*65536+(i<255?i<1?0:i:255)*256+(s<255?s<1?0:s:255)).toString(16).slice(1)}`}async function i(e){try{if(!process.env.RESEND_API_KEY)return console.log("Campaign email would be sent:",e),{success:!0,resendId:`mock_${Date.now()}`};let n=a(e),i=await new t.Resend(process.env.RESEND_API_KEY).emails.send({from:"LockSafe UK <noreply@locksafe.uk>",to:e.to,subject:e.subject,html:n,replyTo:r.SUPPORT_EMAIL,headers:{"X-Entity-Ref-ID":e.recipientId||""}});return{success:!0,resendId:i.data?.id}}catch(e){return console.error("Failed to send campaign email:",e),{success:!1,error:e}}}e.s(["generatePreviewEmail",0,function(e){return a({...e,to:"preview@example.com",toName:"Preview User",recipientId:void 0})},"sendCampaignEmail",0,i])},831830,e=>{"use strict";var t=e.i(843793),r=e.i(170851);async function a(e,n={}){let i=await t.default.emailCampaign.findUnique({where:{id:e},include:{recipients:{where:{status:"pending"}}}});if(!i)throw Error("Campaign not found");if(!["DRAFT","PAUSED","SCHEDULED","SENDING"].includes(i.status))throw Error(`Campaign cannot be sent in status: ${i.status}`);let s=i.recipients.length;if(0===s)return{success:!0,campaignId:e,totalPending:s,eligible:0,skippedOptOut:0,processed:0,sent:0,failed:0,errors:[]};let o=i.recipients.map(e=>e.locksmithId),l=new Set((await t.default.locksmith.findMany({where:{id:{in:o},emailNotifications:!0},select:{id:!0}})).map(e=>e.id)),d=i.recipients.filter(e=>l.has(e.locksmithId)),c=i.recipients.length-d.length;if(n.dryRun)return{success:!0,campaignId:e,totalPending:s,eligible:d.length,skippedOptOut:c,processed:0,sent:0,failed:0,errors:[]};let p=n.maxRecipients?d.slice(0,n.maxRecipients):d;if(0===p.length)return{success:!0,campaignId:e,totalPending:s,eligible:d.length,skippedOptOut:c,processed:0,sent:0,failed:0,errors:[]};"SENDING"!==i.status&&await t.default.emailCampaign.update({where:{id:e},data:{status:"SENDING"}});let u={success:!0,campaignId:e,totalPending:s,eligible:d.length,skippedOptOut:c,processed:p.length,sent:0,failed:0,errors:[]};for(let e of p){try{let a=await (0,r.sendCampaignEmail)({to:e.email,toName:e.name,subject:i.subject,preheader:i.preheader||void 0,template:i.template,headline:i.headline||void 0,body:i.body,ctaText:i.ctaText||void 0,ctaUrl:i.ctaUrl||void 0,accentColor:i.accentColor,recipientId:e.id});a.success?(await t.default.emailRecipient.update({where:{id:e.id},data:{status:"sent",resendEmailId:a.resendId}}),u.sent++):(await t.default.emailRecipient.update({where:{id:e.id},data:{status:"bounced",bounceReason:"Failed to send"}}),u.failed++,u.errors.push(`${e.email}: ${String(a.error??"Unknown error")}`))}catch(r){await t.default.emailRecipient.update({where:{id:e.id},data:{status:"bounced",bounceReason:r instanceof Error?r.message:"Unknown error"}}),u.failed++,u.errors.push(`${e.email}: ${r instanceof Error?r.message:String(r)}`)}await new Promise(e=>setTimeout(e,100))}let m=await t.default.emailRecipient.count({where:{campaignId:e,status:"pending"}});return await t.default.emailCampaign.update({where:{id:e},data:{status:0===m?"SENT":"PAUSED",...0===m?{sentAt:new Date}:{},totalRecipients:d.length,totalDelivered:u.sent,totalBounced:u.failed}}),u}e.s(["sendEmailCampaignById",0,a])},200533,e=>{"use strict";var t=e.i(747909),r=e.i(174017),a=e.i(996250),n=e.i(759756),i=e.i(561916),s=e.i(174677),o=e.i(869741),l=e.i(316795),d=e.i(487718),c=e.i(995169),p=e.i(47587),u=e.i(666012),m=e.i(570101),h=e.i(626937),f=e.i(10372),g=e.i(193695);e.i(820232);var x=e.i(600220),b=e.i(89171),v=e.i(843793),y=e.i(79832),w=e.i(334227),R=e.i(831830);let _=["all_locksmiths","active_locksmiths","inactive_locksmiths","stripe_not_onboarded","schedule_enabled","no_base_location"];async function E(e){let t=await (0,y.isAdminAuthenticated)();if(!t)return b.NextResponse.json({error:"Unauthorized"},{status:401});try{let{name:r,subject:a,preheader:n,template:i,headline:s,body:o,ctaText:l,ctaUrl:d,accentColor:c,segment:p,maxRecipients:u,dryRun:m,scheduledFor:h}=await e.json();if(!r||!a||!i||!o||!p)return b.NextResponse.json({error:"Missing required fields: name, subject, template, body, segment"},{status:400});if(!_.includes(p))return b.NextResponse.json({error:`Unsupported segment: ${p}`},{status:400});let f=await (0,w.getLocksmithRecipientsBySegment)(p,"number"==typeof u&&u>0?u:void 0);if(0===f.length)return b.NextResponse.json({error:"No eligible recipients in selected segment"},{status:400});if(m)return b.NextResponse.json({success:!0,dryRun:!0,eligibleRecipients:f.length,segment:p});let g=await v.default.emailCampaign.create({data:{name:r,subject:a,preheader:n||null,template:i,headline:s||null,body:o,ctaText:l||null,ctaUrl:d||null,accentColor:c||"#f97316",totalRecipients:f.length,createdBy:t.id,scheduledFor:h?new Date(h):null,status:h?"SCHEDULED":"DRAFT",recipients:{create:f.map(e=>({locksmithId:e.id,email:e.email,name:e.name}))}},select:{id:!0,name:!0,status:!0,totalRecipients:!0,scheduledFor:!0}});if(h)return b.NextResponse.json({success:!0,scheduled:!0,campaign:g});let x=await (0,R.sendEmailCampaignById)(g.id,{maxRecipients:"number"==typeof u&&u>0?u:void 0});return b.NextResponse.json({success:!0,scheduled:!1,campaign:g,result:x})}catch(e){return console.error("[admin/emails/send-segmented] Failed:",e),b.NextResponse.json({error:"Failed to process segmented send"},{status:500})}}e.s(["POST",0,E],783695);var k=e.i(783695);let C=new t.AppRouteRouteModule({definition:{kind:r.RouteKind.APP_ROUTE,page:"/api/admin/emails/send-segmented/route",pathname:"/api/admin/emails/send-segmented",filename:"route",bundlePath:""},distDir:".next-probe",relativeProjectDir:"",resolvedPagePath:"[project]/src/app/api/admin/emails/send-segmented/route.ts",nextConfigOutput:"",userland:k,...{}}),{workAsyncStorage:S,workUnitAsyncStorage:A,serverHooks:I}=C;async function N(e,t,a){a.requestMeta&&(0,n.setRequestMeta)(e,a.requestMeta),C.isDev&&(0,n.addRequestMeta)(e,"devRequestTimingInternalsEnd",process.hrtime.bigint());let b="/api/admin/emails/send-segmented/route";b=b.replace(/\/index$/,"")||"/";let v=await C.prepare(e,t,{srcPage:b,multiZoneDraftMode:!1});if(!v)return t.statusCode=400,t.end("Bad Request"),null==a.waitUntil||a.waitUntil.call(a,Promise.resolve()),null;let{buildId:y,params:w,nextConfig:R,parsedUrl:_,isDraftMode:E,prerenderManifest:k,routerServerContext:S,isOnDemandRevalidate:A,revalidateOnlyGenerated:I,resolvedPathname:N,clientReferenceManifest:P,serverActionsManifest:T}=v,$=(0,o.normalizeAppPath)(b),O=!!(k.dynamicRoutes[$]||k.routes[N]),U=async()=>((null==S?void 0:S.render404)?await S.render404(e,t,_,!1):t.end("This page could not be found"),null);if(O&&!E){let e=!!k.routes[N],t=k.dynamicRoutes[$];if(t&&!1===t.fallback&&!e){if(R.adapterPath)return await U();throw new g.NoFallbackError}}let D=null;!O||C.isDev||E||(D="/index"===(D=N)?"/":D);let j=!0===C.isDev||!O,M=O&&!j;T&&P&&(0,s.setManifestsSingleton)({page:b,clientReferenceManifest:P,serverActionsManifest:T});let L=e.method||"GET",H=(0,i.getTracer)(),q=H.getActiveScopeSpan(),F=!!(null==S?void 0:S.isWrappedByNextServer),B=!!(0,n.getRequestMeta)(e,"minimalMode"),z=(0,n.getRequestMeta)(e,"incrementalCache")||await C.getIncrementalCache(e,R,k,B);null==z||z.resetRequestCache(),globalThis.__incrementalCache=z;let K={params:w,previewProps:k.preview,renderOpts:{experimental:{authInterrupts:!!R.experimental.authInterrupts},cacheComponents:!!R.cacheComponents,supportsDynamicResponse:j,incrementalCache:z,cacheLifeProfiles:R.cacheLife,waitUntil:a.waitUntil,onClose:e=>{t.on("close",e)},onAfterTaskError:void 0,onInstrumentationRequestError:(t,r,a,n)=>C.onRequestError(e,t,a,n,S)},sharedContext:{buildId:y}},X=new l.NodeNextRequest(e),G=new l.NodeNextResponse(t),W=d.NextRequestAdapter.fromNodeNextRequest(X,(0,d.signalFromNodeResponse)(t));try{let n,s=async e=>C.handle(W,K).finally(()=>{if(!e)return;e.setAttributes({"http.status_code":t.statusCode,"next.rsc":!1});let r=H.getRootSpanAttributes();if(!r)return;if(r.get("next.span_type")!==c.BaseServerSpan.handleRequest)return void console.warn(`Unexpected root span type '${r.get("next.span_type")}'. Please report this Next.js issue https://github.com/vercel/next.js`);let a=r.get("next.route");if(a){let t=`${L} ${a}`;e.setAttributes({"next.route":a,"http.route":a,"next.span_name":t}),e.updateName(t),n&&n!==e&&(n.setAttribute("http.route",a),n.updateName(t))}else e.updateName(`${L} ${b}`)}),o=async n=>{var i,o;let l=async({previousCacheEntry:r})=>{try{if(!B&&A&&I&&!r)return t.statusCode=404,t.setHeader("x-nextjs-cache","REVALIDATED"),t.end("This page could not be found"),null;let i=await s(n);e.fetchMetrics=K.renderOpts.fetchMetrics;let o=K.renderOpts.pendingWaitUntil;o&&a.waitUntil&&(a.waitUntil(o),o=void 0);let l=K.renderOpts.collectedTags;if(!O)return await (0,u.sendResponse)(X,G,i,K.renderOpts.pendingWaitUntil),null;{let e=await i.blob(),t=(0,m.toNodeOutgoingHttpHeaders)(i.headers);l&&(t[f.NEXT_CACHE_TAGS_HEADER]=l),!t["content-type"]&&e.type&&(t["content-type"]=e.type);let r=void 0!==K.renderOpts.collectedRevalidate&&!(K.renderOpts.collectedRevalidate>=f.INFINITE_CACHE)&&K.renderOpts.collectedRevalidate,a=void 0===K.renderOpts.collectedExpire||K.renderOpts.collectedExpire>=f.INFINITE_CACHE?void 0:K.renderOpts.collectedExpire;return{value:{kind:x.CachedRouteKind.APP_ROUTE,status:i.status,body:Buffer.from(await e.arrayBuffer()),headers:t},cacheControl:{revalidate:r,expire:a}}}}catch(t){throw(null==r?void 0:r.isStale)&&await C.onRequestError(e,t,{routerKind:"App Router",routePath:b,routeType:"route",revalidateReason:(0,p.getRevalidateReason)({isStaticGeneration:M,isOnDemandRevalidate:A})},!1,S),t}},d=await C.handleResponse({req:e,nextConfig:R,cacheKey:D,routeKind:r.RouteKind.APP_ROUTE,isFallback:!1,prerenderManifest:k,isRoutePPREnabled:!1,isOnDemandRevalidate:A,revalidateOnlyGenerated:I,responseGenerator:l,waitUntil:a.waitUntil,isMinimalMode:B});if(!O)return null;if((null==d||null==(i=d.value)?void 0:i.kind)!==x.CachedRouteKind.APP_ROUTE)throw Object.defineProperty(Error(`Invariant: app-route received invalid cache entry ${null==d||null==(o=d.value)?void 0:o.kind}`),"__NEXT_ERROR_CODE",{value:"E701",enumerable:!1,configurable:!0});B||t.setHeader("x-nextjs-cache",A?"REVALIDATED":d.isMiss?"MISS":d.isStale?"STALE":"HIT"),E&&t.setHeader("Cache-Control","private, no-cache, no-store, max-age=0, must-revalidate");let c=(0,m.fromNodeOutgoingHttpHeaders)(d.value.headers);return B&&O||c.delete(f.NEXT_CACHE_TAGS_HEADER),!d.cacheControl||t.getHeader("Cache-Control")||c.get("Cache-Control")||c.set("Cache-Control",(0,h.getCacheControlHeader)(d.cacheControl)),await (0,u.sendResponse)(X,G,new Response(d.value.body,{headers:c,status:d.value.status||200})),null};F&&q?await o(q):(n=H.getActiveScopeSpan(),await H.withPropagatedContext(e.headers,()=>H.trace(c.BaseServerSpan.handleRequest,{spanName:`${L} ${b}`,kind:i.SpanKind.SERVER,attributes:{"http.method":L,"http.target":e.url}},o),void 0,!F))}catch(t){if(t instanceof g.NoFallbackError||await C.onRequestError(e,t,{routerKind:"App Router",routePath:$,routeType:"route",revalidateReason:(0,p.getRevalidateReason)({isStaticGeneration:M,isOnDemandRevalidate:A})},!1,S),O)throw t;return await (0,u.sendResponse)(X,G,new Response(null,{status:500})),null}}e.s(["handler",0,N,"patchFetch",0,function(){return(0,a.patchFetch)({workAsyncStorage:S,workUnitAsyncStorage:A})},"routeModule",0,C,"serverHooks",0,I,"workAsyncStorage",0,S,"workUnitAsyncStorage",0,A],200533)}];

//# sourceMappingURL=%5Broot-of-the-server%5D__031liuh._.js.map