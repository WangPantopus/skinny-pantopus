/**
 * The first reads of an app page, started by its document's inline script as
 * the HTML is parsed, while the page's scripts download (rendered by
 * src/app/(app)/app/layout.tsx). @pantopus/api answers this page's first
 * matching GET request from each of them once ("Early reads" in its client),
 * so the first screen does not wait for the scripts before asking for its data.
 *
 * Each entry is the exact URL the API client builds for that request (path and
 * serialized query); a mismatch only means the page asks again itself. Only
 * reads with no client-side precondition belong here: the Messages inbox reads
 * its storage fence before its request (lib/conversations.ts), so it is not one.
 *
 * Keep this file dependency-free: the layout renders it on the server.
 */

/** Reads the app shell makes on every page. */
export const EARLY_SHELL_READS = [
  '/api/users/profile', // lib/me.ts — your profile
  '/api/notifications/unread-count?exclude=assistant', // contexts/BadgeContext.tsx
  '/api/chat/stats', // contexts/BadgeContext.tsx
];

/**
 * Each tab's own first reads, by path: the ones its first screen waits for.
 * Place and Today read your homes before their place sections; Pulse reads
 * where you are before its feed.
 */
export const EARLY_ROUTE_READS: Record<string, string[]> = {
  '/app/place': ['/api/homes/my-homes', '/api/hub'],
  '/app/today': ['/api/hub/today', '/api/homes/my-homes'],
  '/app/hub/today': ['/api/hub/today', '/api/homes/my-homes'],
  '/app/feed': ['/api/location/resolve', '/api/posts/feed-preferences'],
};

// AUTH_SESSION_CHANGE_KEY in @pantopus/api: the client takes an early read only
// while this browser's session marker is the one the script saw.
const SESSION_CHANGE_KEY = 'pantopus_auth_session_change';

/**
 * With the session flag set, starts the shell's and this path's reads. A
 * session being recovered in place (lib/session-refresh.ts) is refreshed
 * first; a failed recovery starts none.
 */
export const EARLY_READS_SCRIPT = `(function(){try{
if(!/(?:^|;\\s*)pantopus_session=1(?:;|$)/.test(document.cookie))return;
var p=location.pathname.replace(/\\/+$/,'')||'/';
var routes=${JSON.stringify(EARLY_ROUTE_READS)};
var urls=${JSON.stringify(EARLY_SHELL_READS)}.concat(routes[p]||[]);
var k='';try{k=localStorage.getItem('${SESSION_CHANGE_KEY}')||'';}catch(e){}
var rec=window.__pantopusRecovery;
var ready=rec&&rec.promise?rec.promise:Promise.resolve({status:'success'});
var e=window.__pantopusEarly={marker:k,at:Date.now(),reads:{}};
urls.forEach(function(u){e.reads[u]=ready.then(function(o){return o&&o.status==='success'?fetch(u,{credentials:'same-origin',headers:{'Accept':'application/json, text/plain, */*','x-token-transport':'cookie'}}):null;}).catch(function(){return null;});});
}catch(x){}})();`;
