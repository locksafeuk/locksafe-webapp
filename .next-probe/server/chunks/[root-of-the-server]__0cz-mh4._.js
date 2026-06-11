module.exports=[918622,(e,t,r)=>{t.exports=e.x("next/dist/compiled/next-server/app-page-turbo.runtime.prod.js",()=>require("next/dist/compiled/next-server/app-page-turbo.runtime.prod.js"))},556704,(e,t,r)=>{t.exports=e.x("next/dist/server/app-render/work-async-storage.external.js",()=>require("next/dist/server/app-render/work-async-storage.external.js"))},832319,(e,t,r)=>{t.exports=e.x("next/dist/server/app-render/work-unit-async-storage.external.js",()=>require("next/dist/server/app-render/work-unit-async-storage.external.js"))},324725,(e,t,r)=>{t.exports=e.x("next/dist/server/app-render/after-task-async-storage.external.js",()=>require("next/dist/server/app-render/after-task-async-storage.external.js"))},193695,(e,t,r)=>{t.exports=e.x("next/dist/shared/lib/no-fallback-error.external.js",()=>require("next/dist/shared/lib/no-fallback-error.external.js"))},442315,(e,t,r)=>{"use strict";t.exports=e.r(918622)},347540,(e,t,r)=>{"use strict";t.exports=e.r(442315).vendored["react-rsc"].React},819481,(e,t,r)=>{"use strict";var n=Object.defineProperty,a=Object.getOwnPropertyDescriptor,i=Object.getOwnPropertyNames,o=Object.prototype.hasOwnProperty,s={},l={RequestCookies:()=>f,ResponseCookies:()=>m,parseCookie:()=>c,parseSetCookie:()=>u,stringifyCookie:()=>d};for(var p in l)n(s,p,{get:l[p],enumerable:!0});function d(e){var t;let r=["path"in e&&e.path&&`Path=${e.path}`,"expires"in e&&(e.expires||0===e.expires)&&`Expires=${("number"==typeof e.expires?new Date(e.expires):e.expires).toUTCString()}`,"maxAge"in e&&"number"==typeof e.maxAge&&`Max-Age=${e.maxAge}`,"domain"in e&&e.domain&&`Domain=${e.domain}`,"secure"in e&&e.secure&&"Secure","httpOnly"in e&&e.httpOnly&&"HttpOnly","sameSite"in e&&e.sameSite&&`SameSite=${e.sameSite}`,"partitioned"in e&&e.partitioned&&"Partitioned","priority"in e&&e.priority&&`Priority=${e.priority}`].filter(Boolean),n=`${e.name}=${encodeURIComponent(null!=(t=e.value)?t:"")}`;return 0===r.length?n:`${n}; ${r.join("; ")}`}function c(e){let t=new Map;for(let r of e.split(/; */)){if(!r)continue;let e=r.indexOf("=");if(-1===e){t.set(r,"true");continue}let[n,a]=[r.slice(0,e),r.slice(e+1)];try{t.set(n,decodeURIComponent(null!=a?a:"true"))}catch{}}return t}function u(e){if(!e)return;let[[t,r],...n]=c(e),{domain:a,expires:i,httponly:o,maxage:s,path:l,samesite:p,secure:d,partitioned:u,priority:f}=Object.fromEntries(n.map(([e,t])=>[e.toLowerCase().replace(/-/g,""),t]));{var m,x,v={name:t,value:decodeURIComponent(r),domain:a,...i&&{expires:new Date(i)},...o&&{httpOnly:!0},..."string"==typeof s&&{maxAge:Number(s)},path:l,...p&&{sameSite:h.includes(m=(m=p).toLowerCase())?m:void 0},...d&&{secure:!0},...f&&{priority:g.includes(x=(x=f).toLowerCase())?x:void 0},...u&&{partitioned:!0}};let e={};for(let t in v)v[t]&&(e[t]=v[t]);return e}}t.exports=((e,t,r)=>{if(t&&"object"==typeof t||"function"==typeof t)for(let s of i(t))o.call(e,s)||void 0===s||n(e,s,{get:()=>t[s],enumerable:!(r=a(t,s))||r.enumerable});return e})(n({},"__esModule",{value:!0}),s);var h=["strict","lax","none"],g=["low","medium","high"],f=class{constructor(e){this._parsed=new Map,this._headers=e;const t=e.get("cookie");if(t)for(const[e,r]of c(t))this._parsed.set(e,{name:e,value:r})}[Symbol.iterator](){return this._parsed[Symbol.iterator]()}get size(){return this._parsed.size}get(...e){let t="string"==typeof e[0]?e[0]:e[0].name;return this._parsed.get(t)}getAll(...e){var t;let r=Array.from(this._parsed);if(!e.length)return r.map(([e,t])=>t);let n="string"==typeof e[0]?e[0]:null==(t=e[0])?void 0:t.name;return r.filter(([e])=>e===n).map(([e,t])=>t)}has(e){return this._parsed.has(e)}set(...e){let[t,r]=1===e.length?[e[0].name,e[0].value]:e,n=this._parsed;return n.set(t,{name:t,value:r}),this._headers.set("cookie",Array.from(n).map(([e,t])=>d(t)).join("; ")),this}delete(e){let t=this._parsed,r=Array.isArray(e)?e.map(e=>t.delete(e)):t.delete(e);return this._headers.set("cookie",Array.from(t).map(([e,t])=>d(t)).join("; ")),r}clear(){return this.delete(Array.from(this._parsed.keys())),this}[Symbol.for("edge-runtime.inspect.custom")](){return`RequestCookies ${JSON.stringify(Object.fromEntries(this._parsed))}`}toString(){return[...this._parsed.values()].map(e=>`${e.name}=${encodeURIComponent(e.value)}`).join("; ")}},m=class{constructor(e){var t,r,n;this._parsed=new Map,this._headers=e;const a=null!=(n=null!=(r=null==(t=e.getSetCookie)?void 0:t.call(e))?r:e.get("set-cookie"))?n:[];for(const e of Array.isArray(a)?a:function(e){if(!e)return[];var t,r,n,a,i,o=[],s=0;function l(){for(;s<e.length&&/\s/.test(e.charAt(s));)s+=1;return s<e.length}for(;s<e.length;){for(t=s,i=!1;l();)if(","===(r=e.charAt(s))){for(n=s,s+=1,l(),a=s;s<e.length&&"="!==(r=e.charAt(s))&&";"!==r&&","!==r;)s+=1;s<e.length&&"="===e.charAt(s)?(i=!0,s=a,o.push(e.substring(t,n)),t=s):s=n+1}else s+=1;(!i||s>=e.length)&&o.push(e.substring(t,e.length))}return o}(a)){const t=u(e);t&&this._parsed.set(t.name,t)}}get(...e){let t="string"==typeof e[0]?e[0]:e[0].name;return this._parsed.get(t)}getAll(...e){var t;let r=Array.from(this._parsed.values());if(!e.length)return r;let n="string"==typeof e[0]?e[0]:null==(t=e[0])?void 0:t.name;return r.filter(e=>e.name===n)}has(e){return this._parsed.has(e)}set(...e){let[t,r,n]=1===e.length?[e[0].name,e[0].value,e[0]]:e,a=this._parsed;return a.set(t,function(e={name:"",value:""}){return"number"==typeof e.expires&&(e.expires=new Date(e.expires)),e.maxAge&&(e.expires=new Date(Date.now()+1e3*e.maxAge)),(null===e.path||void 0===e.path)&&(e.path="/"),e}({name:t,value:r,...n})),function(e,t){for(let[,r]of(t.delete("set-cookie"),e)){let e=d(r);t.append("set-cookie",e)}}(a,this._headers),this}delete(...e){let[t,r]="string"==typeof e[0]?[e[0]]:[e[0].name,e[0]];return this.set({...r,name:t,value:"",expires:new Date(0)})}[Symbol.for("edge-runtime.inspect.custom")](){return`ResponseCookies ${JSON.stringify(Object.fromEntries(this._parsed))}`}toString(){return[...this._parsed.values()].map(d).join("; ")}}},798003,e=>{"use strict";function t(e){return e.replace(/[^\d+]/g,"")}let r=process.env.NEXT_PUBLIC_SUPPORT_PHONE||process.env.RETELL_PHONE_NUMBER||"+44 20 4577 1989",n=process.env.NEXT_PUBLIC_SUPPORT_PHONE_TEL||t(r),a=process.env.NEXT_PUBLIC_LOCKSMITH_ADMIN_PHONE||"07818 333 989";process.env.NEXT_PUBLIC_LOCKSMITH_ADMIN_PHONE_TEL||t(a);let i=process.env.NEXT_PUBLIC_LOCKSMITH_ADMIN_WHATSAPP||"+44 7446 588587".replace(/\D/g,""),o={url:"https://www.locksafe.uk",name:"LockSafe UK",supportEmail:"contact@locksafe.uk",helpEmail:"contact@locksafe.uk",phone:r,phoneFormatted:n,twitter:"@locksafeuk"},s=o.url,l=o.name,p=o.supportEmail,d=o.phone;o.phoneFormatted,e.s(["LOCKSMITH_ADMIN_PHONE",0,a,"LOCKSMITH_ADMIN_WHATSAPP",0,i,"SITE_NAME",0,l,"SITE_URL",0,s,"SUPPORT_EMAIL",0,p,"SUPPORT_PHONE",0,d,"getFullUrl",0,function(e=""){let t=o.url.replace(/\/$/,""),r=e.startsWith("/")?e:`/${e}`;return`${t}${r}`},"siteConfig",0,o])},170851,e=>{"use strict";var t=e.i(246245),r=e.i(798003);function n(e){let t=e.accentColor||"#f97316",n=e.preheader||"",i={announcement:{bg:`linear-gradient(135deg, ${t}, ${a(t,-20)})`,icon:"📢"},newsletter:{bg:"linear-gradient(135deg, #1e293b, #334155)",icon:"📰"},update:{bg:"linear-gradient(135deg, #3b82f6, #2563eb)",icon:"🔄"},promo:{bg:"linear-gradient(135deg, #16a34a, #15803d)",icon:"🎉"},urgent:{bg:"linear-gradient(135deg, #dc2626, #b91c1c)",icon:"⚠️"},custom:{bg:`linear-gradient(135deg, ${t}, ${a(t,-20)})`,icon:"✉️"}},o=i[e.template]||i.custom,s=e.recipientId?`<img src="${r.SITE_URL}/api/admin/emails/track?type=open&rid=${e.recipientId}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;" />`:"",l=e.ctaUrl&&e.recipientId?`${r.SITE_URL}/api/admin/emails/track?type=click&rid=${e.recipientId}&url=${encodeURIComponent(e.ctaUrl)}`:e.ctaUrl;return`
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
          background: ${o.bg};
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
      <div class="preheader">${n}</div>

      <div class="container">
        <div class="email-wrapper">
          <!-- Header -->
          <div class="header">
            <span class="header-icon">${o.icon}</span>
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

      ${s}
    </body>
    </html>
  `}function a(e,t){let r=Number.parseInt(e.replace("#",""),16),n=Math.round(2.55*t),a=(r>>16)+n,i=(r>>8&255)+n,o=(255&r)+n;return`#${(0x1000000+(a<255?a<1?0:a:255)*65536+(i<255?i<1?0:i:255)*256+(o<255?o<1?0:o:255)).toString(16).slice(1)}`}async function i(e){try{if(!process.env.RESEND_API_KEY)return console.log("Campaign email would be sent:",e),{success:!0,resendId:`mock_${Date.now()}`};let a=n(e),i=await new t.Resend(process.env.RESEND_API_KEY).emails.send({from:"LockSafe UK <noreply@locksafe.uk>",to:e.to,subject:e.subject,html:a,replyTo:r.SUPPORT_EMAIL,headers:{"X-Entity-Ref-ID":e.recipientId||""}});return{success:!0,resendId:i.data?.id}}catch(e){return console.error("Failed to send campaign email:",e),{success:!1,error:e}}}e.s(["generatePreviewEmail",0,function(e){return n({...e,to:"preview@example.com",toName:"Preview User",recipientId:void 0})},"sendCampaignEmail",0,i])},448760,e=>{"use strict";var t=e.i(747909),r=e.i(174017),n=e.i(996250),a=e.i(759756),i=e.i(561916),o=e.i(174677),s=e.i(869741),l=e.i(316795),p=e.i(487718),d=e.i(995169),c=e.i(47587),u=e.i(666012),h=e.i(570101),g=e.i(626937),f=e.i(10372),m=e.i(193695);e.i(820232);var x=e.i(600220),v=e.i(89171),b=e.i(493458),y=e.i(170851);async function w(e){try{if(!(await (0,b.cookies)()).get("auth_token"))return v.NextResponse.json({error:"Unauthorized"},{status:401});let{subject:t,preheader:r,template:n,headline:a,body:i,ctaText:o,ctaUrl:s,accentColor:l}=await e.json();if(!t||!n||!i)return v.NextResponse.json({error:"Missing required fields: subject, template, body"},{status:400});let p=(0,y.generatePreviewEmail)({subject:t,preheader:r,template:n,headline:a,body:i,ctaText:o,ctaUrl:s,accentColor:l});return v.NextResponse.json({success:!0,html:p})}catch(e){return console.error("Error generating preview:",e),v.NextResponse.json({error:"Failed to generate preview"},{status:500})}}e.s(["POST",0,w],751070);var _=e.i(751070);let E=new t.AppRouteRouteModule({definition:{kind:r.RouteKind.APP_ROUTE,page:"/api/admin/emails/preview/route",pathname:"/api/admin/emails/preview",filename:"route",bundlePath:""},distDir:".next-probe",relativeProjectDir:"",resolvedPagePath:"[project]/src/app/api/admin/emails/preview/route.ts",nextConfigOutput:"",userland:_,...{}}),{workAsyncStorage:R,workUnitAsyncStorage:k,serverHooks:A}=E;async function S(e,t,n){n.requestMeta&&(0,a.setRequestMeta)(e,n.requestMeta),E.isDev&&(0,a.addRequestMeta)(e,"devRequestTimingInternalsEnd",process.hrtime.bigint());let v="/api/admin/emails/preview/route";v=v.replace(/\/index$/,"")||"/";let b=await E.prepare(e,t,{srcPage:v,multiZoneDraftMode:!1});if(!b)return t.statusCode=400,t.end("Bad Request"),null==n.waitUntil||n.waitUntil.call(n,Promise.resolve()),null;let{buildId:y,params:w,nextConfig:_,parsedUrl:R,isDraftMode:k,prerenderManifest:A,routerServerContext:S,isOnDemandRevalidate:C,revalidateOnlyGenerated:P,resolvedPathname:I,clientReferenceManifest:T,serverActionsManifest:$}=b,N=(0,s.normalizeAppPath)(v),O=!!(A.dynamicRoutes[N]||A.routes[I]),U=async()=>((null==S?void 0:S.render404)?await S.render404(e,t,R,!1):t.end("This page could not be found"),null);if(O&&!k){let e=!!A.routes[I],t=A.dynamicRoutes[N];if(t&&!1===t.fallback&&!e){if(_.adapterPath)return await U();throw new m.NoFallbackError}}let M=null;!O||E.isDev||k||(M="/index"===(M=I)?"/":M);let j=!0===E.isDev||!O,H=O&&!j;$&&T&&(0,o.setManifestsSingleton)({page:v,clientReferenceManifest:T,serverActionsManifest:$});let L=e.method||"GET",D=(0,i.getTracer)(),q=D.getActiveScopeSpan(),z=!!(null==S?void 0:S.isWrappedByNextServer),F=!!(0,a.getRequestMeta)(e,"minimalMode"),K=(0,a.getRequestMeta)(e,"incrementalCache")||await E.getIncrementalCache(e,_,A,F);null==K||K.resetRequestCache(),globalThis.__incrementalCache=K;let B={params:w,previewProps:A.preview,renderOpts:{experimental:{authInterrupts:!!_.experimental.authInterrupts},cacheComponents:!!_.cacheComponents,supportsDynamicResponse:j,incrementalCache:K,cacheLifeProfiles:_.cacheLife,waitUntil:n.waitUntil,onClose:e=>{t.on("close",e)},onAfterTaskError:void 0,onInstrumentationRequestError:(t,r,n,a)=>E.onRequestError(e,t,n,a,S)},sharedContext:{buildId:y}},X=new l.NodeNextRequest(e),W=new l.NodeNextResponse(t),Y=p.NextRequestAdapter.fromNodeNextRequest(X,(0,p.signalFromNodeResponse)(t));try{let a,o=async e=>E.handle(Y,B).finally(()=>{if(!e)return;e.setAttributes({"http.status_code":t.statusCode,"next.rsc":!1});let r=D.getRootSpanAttributes();if(!r)return;if(r.get("next.span_type")!==d.BaseServerSpan.handleRequest)return void console.warn(`Unexpected root span type '${r.get("next.span_type")}'. Please report this Next.js issue https://github.com/vercel/next.js`);let n=r.get("next.route");if(n){let t=`${L} ${n}`;e.setAttributes({"next.route":n,"http.route":n,"next.span_name":t}),e.updateName(t),a&&a!==e&&(a.setAttribute("http.route",n),a.updateName(t))}else e.updateName(`${L} ${v}`)}),s=async a=>{var i,s;let l=async({previousCacheEntry:r})=>{try{if(!F&&C&&P&&!r)return t.statusCode=404,t.setHeader("x-nextjs-cache","REVALIDATED"),t.end("This page could not be found"),null;let i=await o(a);e.fetchMetrics=B.renderOpts.fetchMetrics;let s=B.renderOpts.pendingWaitUntil;s&&n.waitUntil&&(n.waitUntil(s),s=void 0);let l=B.renderOpts.collectedTags;if(!O)return await (0,u.sendResponse)(X,W,i,B.renderOpts.pendingWaitUntil),null;{let e=await i.blob(),t=(0,h.toNodeOutgoingHttpHeaders)(i.headers);l&&(t[f.NEXT_CACHE_TAGS_HEADER]=l),!t["content-type"]&&e.type&&(t["content-type"]=e.type);let r=void 0!==B.renderOpts.collectedRevalidate&&!(B.renderOpts.collectedRevalidate>=f.INFINITE_CACHE)&&B.renderOpts.collectedRevalidate,n=void 0===B.renderOpts.collectedExpire||B.renderOpts.collectedExpire>=f.INFINITE_CACHE?void 0:B.renderOpts.collectedExpire;return{value:{kind:x.CachedRouteKind.APP_ROUTE,status:i.status,body:Buffer.from(await e.arrayBuffer()),headers:t},cacheControl:{revalidate:r,expire:n}}}}catch(t){throw(null==r?void 0:r.isStale)&&await E.onRequestError(e,t,{routerKind:"App Router",routePath:v,routeType:"route",revalidateReason:(0,c.getRevalidateReason)({isStaticGeneration:H,isOnDemandRevalidate:C})},!1,S),t}},p=await E.handleResponse({req:e,nextConfig:_,cacheKey:M,routeKind:r.RouteKind.APP_ROUTE,isFallback:!1,prerenderManifest:A,isRoutePPREnabled:!1,isOnDemandRevalidate:C,revalidateOnlyGenerated:P,responseGenerator:l,waitUntil:n.waitUntil,isMinimalMode:F});if(!O)return null;if((null==p||null==(i=p.value)?void 0:i.kind)!==x.CachedRouteKind.APP_ROUTE)throw Object.defineProperty(Error(`Invariant: app-route received invalid cache entry ${null==p||null==(s=p.value)?void 0:s.kind}`),"__NEXT_ERROR_CODE",{value:"E701",enumerable:!1,configurable:!0});F||t.setHeader("x-nextjs-cache",C?"REVALIDATED":p.isMiss?"MISS":p.isStale?"STALE":"HIT"),k&&t.setHeader("Cache-Control","private, no-cache, no-store, max-age=0, must-revalidate");let d=(0,h.fromNodeOutgoingHttpHeaders)(p.value.headers);return F&&O||d.delete(f.NEXT_CACHE_TAGS_HEADER),!p.cacheControl||t.getHeader("Cache-Control")||d.get("Cache-Control")||d.set("Cache-Control",(0,g.getCacheControlHeader)(p.cacheControl)),await (0,u.sendResponse)(X,W,new Response(p.value.body,{headers:d,status:p.value.status||200})),null};z&&q?await s(q):(a=D.getActiveScopeSpan(),await D.withPropagatedContext(e.headers,()=>D.trace(d.BaseServerSpan.handleRequest,{spanName:`${L} ${v}`,kind:i.SpanKind.SERVER,attributes:{"http.method":L,"http.target":e.url}},s),void 0,!z))}catch(t){if(t instanceof m.NoFallbackError||await E.onRequestError(e,t,{routerKind:"App Router",routePath:N,routeType:"route",revalidateReason:(0,c.getRevalidateReason)({isStaticGeneration:H,isOnDemandRevalidate:C})},!1,S),O)throw t;return await (0,u.sendResponse)(X,W,new Response(null,{status:500})),null}}e.s(["handler",0,S,"patchFetch",0,function(){return(0,n.patchFetch)({workAsyncStorage:R,workUnitAsyncStorage:k})},"routeModule",0,E,"serverHooks",0,A,"workAsyncStorage",0,R,"workUnitAsyncStorage",0,k],448760)}];

//# sourceMappingURL=%5Broot-of-the-server%5D__0cz-mh4._.js.map