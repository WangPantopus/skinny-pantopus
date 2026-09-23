// Private transport hold: preserve a real PostgREST filter response for overlap verification.
const stream3OriginalFetch=globalThis.fetch;
globalThis.fetch=async function(input,init){
 const url=String(input?.url||input),method=init?.method||input?.method||'GET';
 const searchFault=__dirname+'/next-persona-search-field.json';
 if(method==='GET' && url.includes('/rest/v1/PublicPersona?') && new URL(url).searchParams.has('handle') && require('fs').existsSync(searchFault)){
  const fs=require('fs'),fault=JSON.parse(fs.readFileSync(searchFault));fs.unlinkSync(searchFault);
  fs.appendFileSync(__dirname+'/persona-search-field-faults.jsonl',JSON.stringify({at:new Date().toISOString(),boundary:'One persona handle query transport failure; other field queries use real PostgREST',status:fault.status||503})+'\n',{mode:0o600});
  return new Response(JSON.stringify({code:'STREAM3_SEARCH_FIELD_UNAVAILABLE',message:'Controlled field query outage'}),{status:fault.status||503,headers:{'Content-Type':'application/json'}});
 }
 const response=await stream3OriginalFetch(input,init);
 const flag=__dirname+'/next-post-mute-read.json';
 if(method==='GET' && url.includes('/rest/v1/PostMute?') && require('fs').existsSync(flag)){
  const fs=require('fs'),fault=JSON.parse(fs.readFileSync(flag));fs.unlinkSync(flag);
  const data=await response.clone().json();
  fs.appendFileSync(__dirname+'/post-mute-read-faults.jsonl',JSON.stringify({at:new Date().toISOString(),status:response.status,rowCount:Array.isArray(data)?data.length:null,delay:fault.delay})+'\n',{mode:0o600});
  await new Promise(resolve=>setTimeout(resolve,fault.delay));
  fs.appendFileSync(__dirname+'/post-mute-read-faults.jsonl',JSON.stringify({releasedAt:new Date().toISOString()})+'\n',{mode:0o600});
 }
 return response;
};
const fs=require('fs'),http=require('http');
const root=__dirname,original=http.ServerResponse.prototype.end;
let pendingSuccessfulRefresh=null;
http.ServerResponse.prototype.end=function(...args){
 const url=this.req?.originalUrl||this.req?.url||'',method=this.req?.method;
 if(url.split('?')[0]==='/api/posts/mute' && fs.existsSync(root+'/next-post-mute-response.json')){
  const fault=JSON.parse(fs.readFileSync(root+'/next-post-mute-response.json'));
  if(!fault.method || fault.method===method){
   fs.unlinkSync(root+'/next-post-mute-response.json');
   const info={at:new Date().toISOString(),method,actor:this.req?.user?.id,entityType:this.req?.body?.entityType,entityId:this.req?.body?.entityId,status:this.statusCode,delay:fault.delay||0,deliveredStatus:fault.status||this.statusCode};
   fs.appendFileSync(root+'/post-mute-response-faults.jsonl',JSON.stringify(info)+'\n',{mode:0o600});
   if(fault.status){this.statusCode=fault.status;args=[JSON.stringify({error:'Mute reply unavailable. Please try again.'})];this.setHeader('Content-Length',Buffer.byteLength(args[0]));this.removeHeader('ETag');}
   if(fault.delay){setTimeout(()=>{fs.appendFileSync(root+'/post-mute-response-faults.jsonl',JSON.stringify({releasedAt:new Date().toISOString(),destroyed:this.destroyed,socketDestroyed:this.socket?.destroyed})+'\n',{mode:0o600});this.once('finish',()=>fs.appendFileSync(root+'/post-mute-response-faults.jsonl',JSON.stringify({finishedAt:new Date().toISOString(),destroyed:this.destroyed,writableFinished:this.writableFinished})+'\n',{mode:0o600}));if(!this.writableEnded)original.apply(this,args)},fault.delay);return this;}
  }
 }
 if(method==='GET' && url.split('?')[0]==='/api/posts/map' && fs.existsSync(root+'/next-map-response.json')){
  const fault=JSON.parse(fs.readFileSync(root+'/next-map-response.json'));
  if(!fault.path||fault.path===url.split('?')[0]){
   if(!fault.repeat)fs.unlinkSync(root+'/next-map-response.json');
   const info={at:new Date().toISOString(),path:url.split('?')[0],status:this.statusCode,delay:fault.delay||0,deliveredStatus:fault.status||this.statusCode};
   try{info.markerIds=JSON.parse(String(args[0])).markers?.map(p=>p.id);}catch{}
   fs.appendFileSync(root+'/map-response-faults.jsonl',JSON.stringify(info)+'\n',{mode:0o600});
   if(fault.status){this.statusCode=fault.status;args=[JSON.stringify({error:'Map response unavailable. Please try again.'})];this.setHeader('Content-Length',Buffer.byteLength(args[0]));this.removeHeader('ETag');}
   if(fault.delay){setTimeout(()=>{fs.appendFileSync(root+'/map-response-faults.jsonl',JSON.stringify({releasedAt:new Date().toISOString(),path:url.split('?')[0],destroyed:this.destroyed,socketDestroyed:this.socket?.destroyed})+'\n',{mode:0o600});this.once('finish',()=>fs.appendFileSync(root+'/map-response-faults.jsonl',JSON.stringify({finishedAt:new Date().toISOString(),path:url.split('?')[0],destroyed:this.destroyed,writableFinished:this.writableFinished})+'\n',{mode:0o600}));if(!this.writableEnded)original.apply(this,args)},fault.delay);return this;}
  }
 }
 if(method==='GET' && url.split('?')[0]==='/api/posts/feed' && fs.existsSync(root+'/next-feed-response.json')){
  const fault=JSON.parse(fs.readFileSync(root+'/next-feed-response.json'));
  if(!fault.path||fault.path===url.split('?')[0]){
   if(!fault.repeat)fs.unlinkSync(root+'/next-feed-response.json');
   const info={at:new Date().toISOString(),path:url.split('?')[0],status:this.statusCode,delay:fault.delay||0,deliveredStatus:fault.status||this.statusCode};
   try{info.postIds=JSON.parse(String(args[0])).posts?.map(p=>p.id);}catch{}
   fs.appendFileSync(root+'/feed-response-faults.jsonl',JSON.stringify(info)+'\n',{mode:0o600});
   if(fault.status){this.statusCode=fault.status;args=[JSON.stringify({error:'Feed response unavailable. Please try again.'})];this.setHeader('Content-Length',Buffer.byteLength(args[0]));this.removeHeader('ETag');}
   if(fault.delay){setTimeout(()=>{fs.appendFileSync(root+'/feed-response-faults.jsonl',JSON.stringify({releasedAt:new Date().toISOString(),path:url.split('?')[0],destroyed:this.destroyed,socketDestroyed:this.socket?.destroyed})+'\n',{mode:0o600});this.once('finish',()=>fs.appendFileSync(root+'/feed-response-faults.jsonl',JSON.stringify({finishedAt:new Date().toISOString(),path:url.split('?')[0],destroyed:this.destroyed,writableFinished:this.writableFinished})+'\n',{mode:0o600}));if(!this.writableEnded)original.apply(this,args)},fault.delay);return this;}
  }
 }
 if(method==='GET' && /^\/api\/listings\/[^/]+\/questions$/.test(url.split('?')[0]) && fs.existsSync(root+'/next-listing-questions-response.json')){
  const fault=JSON.parse(fs.readFileSync(root+'/next-listing-questions-response.json'));
  if(!fault.path||fault.path===url.split('?')[0]){
   if(!fault.repeat)fs.unlinkSync(root+'/next-listing-questions-response.json');
   const info={at:new Date().toISOString(),path:url.split('?')[0],status:this.statusCode,delay:fault.delay||0,deliveredStatus:fault.status||this.statusCode};
   try{info.questionCount=JSON.parse(String(args[0])).questions?.length;}catch{}
   fs.appendFileSync(root+'/listing-questions-response-faults.jsonl',JSON.stringify(info)+'\n',{mode:0o600});
   if(fault.status){this.statusCode=fault.status;args=[JSON.stringify({error:'Questions response unavailable. Please try again.'})];this.setHeader('Content-Length',Buffer.byteLength(args[0]));this.removeHeader('ETag');}
   if(fault.delay){setTimeout(()=>{fs.appendFileSync(root+'/listing-questions-response-faults.jsonl',JSON.stringify({releasedAt:new Date().toISOString(),path:url.split('?')[0],destroyed:this.destroyed,socketDestroyed:this.socket?.destroyed})+'\n',{mode:0o600});this.once('finish',()=>fs.appendFileSync(root+'/listing-questions-response-faults.jsonl',JSON.stringify({finishedAt:new Date().toISOString(),path:url.split('?')[0],destroyed:this.destroyed,writableFinished:this.writableFinished})+'\n',{mode:0o600}));if(!this.writableEnded)original.apply(this,args)},fault.delay);return this;}
  }
 }
 if(method==='GET' && (url.startsWith('/api/notifications/unread-count')||url.startsWith('/api/chat/unified-conversations')) && fs.existsSync(root+'/expire-next-read')){fs.unlinkSync(root+'/expire-next-read');this.statusCode=401;args=[JSON.stringify({error:'Token expired'})];this.setHeader('Content-Length',Buffer.byteLength(args[0]));this.removeHeader('ETag');}
 if(method==='POST' && url==='/api/users/login' && this.statusCode===200 && fs.existsSync(root+'/auto-cookie-race')){
 fs.unlinkSync(root+'/auto-cookie-race');const loginAt=new Date().toISOString();const t=setInterval(()=>{if(pendingSuccessfulRefresh){clearInterval(t);original.apply(this,args);if(fs.existsSync(root+'/new-refresh-on-login')){fs.unlinkSync(root+'/new-refresh-on-login');fs.writeFileSync(root+'/expire-next-chat-read','');}setTimeout(()=>{fs.writeFileSync(root+'/cookie-race-auto-release.json',JSON.stringify({loginAt,releasedAt:new Date().toISOString(),held:JSON.parse(fs.readFileSync(root+'/refresh-response-held.json'))}),{mode:0o600});pendingSuccessfulRefresh();pendingSuccessfulRefresh=null},700)}},20);setTimeout(()=>{clearInterval(t);if(!this.writableEnded)original.apply(this,args)},4000).unref();return this;
 }
 if(method==='POST' && url==='/api/users/refresh' && (fs.existsSync(root+'/hold-failed-refresh')||fs.existsSync(root+'/hold-success-refresh'))){const failed=fs.existsSync(root+'/hold-failed-refresh');fs.unlinkSync(root+(failed?'/hold-failed-refresh':'/hold-success-refresh'));if(failed){this.statusCode=400;this.removeHeader('Set-Cookie');args=[JSON.stringify({error:'Refresh token invalid'})];this.setHeader('Content-Length',Buffer.byteLength(args[0]));}fs.writeFileSync(root+'/refresh-response-held.json',JSON.stringify({at:new Date().toISOString(),status:this.statusCode,cookieNames:(this.getHeader('Set-Cookie')||[]).map(x=>x.split('=')[0])}),{mode:0o600});pendingSuccessfulRefresh=()=>{if(!this.writableEnded)original.apply(this,args)};const t=setInterval(()=>{if(fs.existsSync(root+'/release-refresh')){clearInterval(t);fs.unlinkSync(root+'/release-refresh');original.apply(this,args)}},50);setTimeout(()=>{clearInterval(t);if(!this.writableEnded)original.apply(this,args)},25000).unref();return this;}
 if(method==='DELETE' && /^\/api\/personas\/[^/]+\/follow$/.test(url) && this.statusCode===200 && fs.existsSync(root+'/lose-next-unfollow')){fs.unlinkSync(root+'/lose-next-unfollow');fs.writeFileSync(root+'/lost-unfollow-reply.json',JSON.stringify({at:new Date().toISOString(),path:url,committedStatus:200,deliveredStatus:503}),{mode:0o600});this.statusCode=503;args=[JSON.stringify({error:'Simulated lost successful reply'})];this.setHeader('Content-Length',Buffer.byteLength(args[0]));this.removeHeader('ETag');}
 if(url.split('?')[0]==='/api/scheduling/booking-page' && fs.existsSync(root+'/next-page-response.json')){
  const fault=JSON.parse(fs.readFileSync(root+'/next-page-response.json'));
  if(method===fault.method){
   fs.unlinkSync(root+'/next-page-response.json');
   const row={at:new Date().toISOString(),method,status:this.statusCode,actor:this.req?.user?.id,minutes:this.req?.body?.reminder_minutes,delay: fault.delay||0,deliveredStatus:fault.status||this.statusCode};
   fs.appendFileSync(root+'/page-response-faults.jsonl',JSON.stringify(row)+'\n',{mode:0o600});
   if(fault.status){this.statusCode=fault.status;args=[JSON.stringify({error:'Response unavailable. Please try again.'})];this.setHeader('Content-Length',Buffer.byteLength(args[0]));this.removeHeader('ETag');}
   if(fault.delay){setTimeout(()=>{fs.appendFileSync(root+'/page-response-faults.jsonl',JSON.stringify({releasedAt:new Date().toISOString(),method,status:this.statusCode})+'\n',{mode:0o600});if(!this.writableEnded)original.apply(this,args)},fault.delay);return this;}
  }
 }
 if(url.split('?')[0]==='/api/scheduling/notification-preferences' && fs.existsSync(root+'/next-prefs-response.json')){
  const fault=JSON.parse(fs.readFileSync(root+'/next-prefs-response.json'));
  if(method===fault.method){
   fs.unlinkSync(root+'/next-prefs-response.json');
   const row={at:new Date().toISOString(),method,status:this.statusCode,actor:this.req?.user?.id,notifyMe:this.req?.body?.prefs?.notify_me,delay: fault.delay||0,deliveredStatus:fault.status||this.statusCode};
   fs.appendFileSync(root+'/prefs-response-faults.jsonl',JSON.stringify(row)+'\n',{mode:0o600});
   if(fault.status){this.statusCode=fault.status;args=[JSON.stringify({error:'Response unavailable. Please try again.'})];this.setHeader('Content-Length',Buffer.byteLength(args[0]));this.removeHeader('ETag');}
   if(fault.delay){setTimeout(()=>{const release={releasedAt:new Date().toISOString(),method,status:this.statusCode,destroyed:this.destroyed,socketDestroyed:this.socket?.destroyed,writableEnded:this.writableEnded};fs.appendFileSync(root+'/prefs-response-faults.jsonl',JSON.stringify(release)+'\n',{mode:0o600});this.once('finish',()=>fs.appendFileSync(root+'/prefs-response-faults.jsonl',JSON.stringify({finishedAt:new Date().toISOString(),destroyed:this.destroyed,writableFinished:this.writableFinished})+'\n',{mode:0o600}));if(!this.writableEnded)original.apply(this,args)},fault.delay);return this;}
  }
 }
 if(url.startsWith('/api/notifications/') && fs.existsSync(root+'/next-notification-mutation-response.json')){
  const fault=JSON.parse(fs.readFileSync(root+'/next-notification-mutation-response.json'));
  if(method===fault.method && url.split('?')[0]===fault.path){
   fs.unlinkSync(root+'/next-notification-mutation-response.json');
   fs.appendFileSync(root+'/notification-mutation-response-faults.jsonl',JSON.stringify({at:new Date().toISOString(),method,path:url,actor:this.req?.user?.id,scope:this.req?.body,status:this.statusCode,deliveredStatus:fault.status||this.statusCode,delay:fault.delay||0})+'\n',{mode:0o600});
   if(fault.status){this.statusCode=fault.status;args=[JSON.stringify({error:'Response unavailable. Please try again.'})];this.setHeader('Content-Length',Buffer.byteLength(args[0]));this.removeHeader('ETag');}
   if(fault.delay){setTimeout(()=>{fs.appendFileSync(root+'/notification-mutation-response-faults.jsonl',JSON.stringify({releasedAt:new Date().toISOString(),path:url,destroyed:this.destroyed,socketDestroyed:this.socket?.destroyed,writableEnded:this.writableEnded})+'\n',{mode:0o600});this.once('finish',()=>fs.appendFileSync(root+'/notification-mutation-response-faults.jsonl',JSON.stringify({finishedAt:new Date().toISOString(),path:url,destroyed:this.destroyed,writableFinished:this.writableFinished})+'\n',{mode:0o600}));if(!this.writableEnded)original.apply(this,args)},fault.delay);return this;}
  }
 }
 if(url.split('?')[0]==='/api/notifications' && method==='GET' && fs.existsSync(root+'/next-notification-response.json')){
  const fault=JSON.parse(fs.readFileSync(root+'/next-notification-response.json'));
  if((fault.context===undefined || fault.context===(this.req?.query?.context||null)) && (fault.contextType===undefined || fault.contextType===(this.req?.query?.context_type||null))){
   if(!fault.repeat) fs.unlinkSync(root+'/next-notification-response.json');
   fs.appendFileSync(root+'/notification-response-faults.jsonl',JSON.stringify({at:new Date().toISOString(),actor:this.req?.user?.id,context:this.req?.query?.context||null,contextType:this.req?.query?.context_type||null,status:this.statusCode,deliveredStatus:fault.status||this.statusCode,delay:fault.delay||0})+'\n',{mode:0o600});
   if(fault.status){this.statusCode=fault.status;args=[JSON.stringify({error:'Response unavailable. Please try again.'})];this.setHeader('Content-Length',Buffer.byteLength(args[0]));this.removeHeader('ETag');}
   if(fault.delay){setTimeout(()=>{fs.appendFileSync(root+'/notification-response-faults.jsonl',JSON.stringify({releasedAt:new Date().toISOString(),destroyed:this.destroyed,socketDestroyed:this.socket?.destroyed,writableEnded:this.writableEnded})+'\n',{mode:0o600});this.once('finish',()=>fs.appendFileSync(root+'/notification-response-faults.jsonl',JSON.stringify({finishedAt:new Date().toISOString(),destroyed:this.destroyed,writableFinished:this.writableFinished})+'\n',{mode:0o600}));if(!this.writableEnded)original.apply(this,args)},fault.delay);return this;}
  }
 }
 if(url.split('?')[0]==='/api/auth/devices' && fs.existsSync(root+'/next-security-response.json')){
  const fault=JSON.parse(fs.readFileSync(root+'/next-security-response.json'));
  if(method===fault.method){
   fs.unlinkSync(root+'/next-security-response.json');
   const row={at:new Date().toISOString(),method,status:this.statusCode,actor:this.req?.user?.id,notifyMe:this.req?.body?.prefs?.notify_me,delay: fault.delay||0,deliveredStatus:fault.status||this.statusCode};
   fs.appendFileSync(root+'/security-response-faults.jsonl',JSON.stringify(row)+'\n',{mode:0o600});
   if(fault.status){this.statusCode=fault.status;args=[JSON.stringify({error:'Response unavailable. Please try again.'})];this.setHeader('Content-Length',Buffer.byteLength(args[0]));this.removeHeader('ETag');}
   if(fault.delay){setTimeout(()=>{const release={releasedAt:new Date().toISOString(),method,status:this.statusCode,destroyed:this.destroyed,socketDestroyed:this.socket?.destroyed,writableEnded:this.writableEnded};fs.appendFileSync(root+'/security-response-faults.jsonl',JSON.stringify(release)+'\n',{mode:0o600});this.once('finish',()=>fs.appendFileSync(root+'/security-response-faults.jsonl',JSON.stringify({finishedAt:new Date().toISOString(),destroyed:this.destroyed,writableFinished:this.writableFinished})+'\n',{mode:0o600}));if(!this.writableEnded)original.apply(this,args)},fault.delay);return this;}
  }
 }
 if(url.split('?')[0]==='/api/auth/sessions/revoke-all' && fs.existsSync(root+'/next-global-response.json')){
  const fault=JSON.parse(fs.readFileSync(root+'/next-global-response.json'));
  if(method===fault.method){
   fs.unlinkSync(root+'/next-global-response.json');
   const row={at:new Date().toISOString(),method,status:this.statusCode,actor:this.req?.user?.id,cookieNames:(this.getHeader('Set-Cookie')||[]).map(x=>x.split('=')[0]),delay: fault.delay||0,deliveredStatus:fault.status||this.statusCode};
   fs.appendFileSync(root+'/global-response-faults.jsonl',JSON.stringify(row)+'\n',{mode:0o600});
   if(fault.status){this.statusCode=fault.status;args=[JSON.stringify({error:'Response unavailable. Please try again.'})];this.setHeader('Content-Length',Buffer.byteLength(args[0]));this.removeHeader('ETag');}
   if(fault.delay){setTimeout(()=>{const release={releasedAt:new Date().toISOString(),method,status:this.statusCode,destroyed:this.destroyed,socketDestroyed:this.socket?.destroyed,writableEnded:this.writableEnded};fs.appendFileSync(root+'/global-response-faults.jsonl',JSON.stringify(release)+'\n',{mode:0o600});this.once('finish',()=>fs.appendFileSync(root+'/global-response-faults.jsonl',JSON.stringify({finishedAt:new Date().toISOString(),destroyed:this.destroyed,writableFinished:this.writableFinished})+'\n',{mode:0o600}));if(!this.writableEnded)original.apply(this,args)},fault.delay);return this;}
  }
 }
 if(url.startsWith('/api/'))fs.appendFileSync(root+'/real-auth-http.jsonl',JSON.stringify({at:new Date().toISOString(),method,path:url.split('?')[0],status:this.statusCode})+'\n',{mode:0o600});
 if(method==='POST' && /\/api\/users\/[^/]+\/block$/.test(url) && fs.existsSync(root+'/hold-next-block')){
  fs.unlinkSync(root+'/hold-next-block');fs.writeFileSync(root+'/block-response-held.json',JSON.stringify({at:new Date().toISOString(),path:url,status:this.statusCode}),{mode:0o600});
  const t=setInterval(()=>{if(fs.existsSync(root+'/release-block')){clearInterval(t);fs.unlinkSync(root+'/release-block');original.apply(this,args);}},50);setTimeout(()=>{clearInterval(t);if(!this.writableEnded)original.apply(this,args)},25000).unref();return this;
 }
 return original.apply(this,args);
};
const emit=http.Server.prototype.emit;
http.Server.prototype.emit=function(event,req,res,...rest){
 if(event==='request' && req?.method==='GET' && req.url.startsWith('/api/chat/unified-conversations') && fs.existsSync(root+'/expire-next-chat-read')){fs.unlinkSync(root+'/expire-next-chat-read');res.statusCode=401;res.setHeader('Content-Type','application/json');res.end(JSON.stringify({error:'Token expired'}));return true;}
 if(event==='request' && req?.method==='POST' && /^\/api\/users\/[^/]+\/block$/.test(req.url) && fs.existsSync(root+'/expire-next-block')){
  fs.unlinkSync(root+'/expire-next-block');res.statusCode=401;res.setHeader('Content-Type','application/json');res.end(JSON.stringify({error:'Token expired'}));return true;
 }
 return emit.call(this,event,req,res,...rest);
};
