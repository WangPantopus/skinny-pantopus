const db = require('../config/supabaseAdmin');
const { getRequestSessionScope } = require('../utils/requestSessionScope');
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const HASH = /^[a-f0-9]{64}$/;
const ROLES = ['owner','admin','manager','lease_resident','member','restricted_member','guest','service_provider'];
const REJECTIONS = Object.freeze({ MEMBER_REMOVAL_CHANGED:409, MEMBER_ALREADY_REMOVED:409,
  MEMBERS_MANAGE_REQUIRED:403, TARGET_RANK_FORBIDDEN:403, OWNERSHIP_FLOW_REQUIRED:409,
  TRANSFER_REQUIRED:409, MEMBER_ROLE_UNKNOWN:409, MEMBER_NOT_FOUND:404, HOME_NOT_FOUND:404 });
const STATUSES = Object.freeze({ ...REJECTIONS, MEMBER_REMOVAL_INVALID:400, MEMBER_REMOVAL_CONFLICT:409,
  MEMBER_REMOVAL_ACCOUNT_UNAVAILABLE:403, MEMBER_REMOVAL_NOT_FOUND:404, MEMBER_REMOVAL_UNAVAILABLE:503 });
const MESSAGES = Object.freeze({
  MEMBER_REMOVAL_CHANGED:'This member changed after your review. Check the original result before reviewing a new removal.',
  MEMBER_ALREADY_REMOVED:'This household membership has already ended.',
  MEMBERS_MANAGE_REQUIRED:'You do not have permission to remove this member.',
  TARGET_RANK_FORBIDDEN:'You cannot remove a member with equal or greater authority.',
  OWNERSHIP_FLOW_REQUIRED:'Use the ownership flow to change an owner.',
  TRANSFER_REQUIRED:'Transfer primary ownership before leaving this Home.',
  MEMBER_ROLE_UNKNOWN:'This member needs an authority review before removal.',
  MEMBER_NOT_FOUND:'This household membership is no longer available.', HOME_NOT_FOUND:'This Home is no longer available.',
  MEMBER_REMOVAL_INVALID:'Check the removal details and try again.',
  MEMBER_REMOVAL_CONFLICT:'This request ID belongs to a different removal original. Keep the saved original.',
  MEMBER_REMOVAL_ACCOUNT_UNAVAILABLE:'This account is unavailable. Keep the saved original and sign in again.',
  MEMBER_REMOVAL_NOT_FOUND:'No saved result was found for this original. Check again, retry it, or cancel this attempt.',
  MEMBER_REMOVAL_UNAVAILABLE:'Could not confirm this removal. Keep the original and check its result.',
});
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const uuid = value => typeof value === 'string' && UUID.test(value);
const hash = value => typeof value === 'string' && HASH.test(value);
const date = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value));
function failure(code = 'MEMBER_REMOVAL_UNAVAILABLE') {
  if (!Object.hasOwn(STATUSES,code)) code='MEMBER_REMOVAL_UNAVAILABLE';
  return Object.assign(new Error(MESSAGES[code]), { code, status:STATUSES[code], statusCode:STATUSES[code] });
}
function identity(actorId,requestId) {
  if (!uuid(actorId) || (requestId !== undefined && !uuid(requestId))) throw failure('MEMBER_REMOVAL_INVALID');
  return { p_actor_id:actorId.toLowerCase(), ...(requestId === undefined ? {} : {p_request_id:requestId.toLowerCase()}) };
}
function intentValue(value, prepared) {
  const keys=prepared ? ['home_id','target_user_id','occupancy_id','action','decision_token'] : ['home_id','target_user_id'];
  if (!object(value) || Object.keys(value).length!==keys.length || Object.keys(value).some(key=>!keys.includes(key))
    || !uuid(value.home_id) || !uuid(value.target_user_id)
    || (prepared && (!uuid(value.occupancy_id) || value.action!=='remove' || !hash(value.decision_token)))) throw failure('MEMBER_REMOVAL_INVALID');
  return {...value,home_id:value.home_id.toLowerCase(),target_user_id:value.target_user_id.toLowerCase(),
    ...(prepared?{occupancy_id:value.occupancy_id.toLowerCase()}: {})};
}
async function rpc(name,args) {
  let response;
  try { response=await db.rpc(name,args); } catch { throw failure(); }
  if (!object(response) || response.error || !object(response.data)) throw failure();
  const r=response.data;
  if (r.ok === false && typeof r.code==='string' && Object.hasOwn(STATUSES,r.code) && r.status===STATUSES[r.code]) throw failure(r.code);
  if (r.ok!==true) throw failure();
  return r;
}
async function prepare({actorId,intent}) {
  const actor=identity(actorId).p_actor_id, value=intentValue(intent,false);
  const r=await rpc('prepare_home_member_removal',{p_actor_id:actor,p_home_id:value.home_id,p_target_id:value.target_user_id});
  const t=r.target;
  if (r.home_id!==value.home_id || r.target_user_id!==value.target_user_id || !uuid(r.occupancy_id) || r.action!=='remove'
    || !hash(r.decision_token) || !object(r.home) || r.home.id!==value.home_id || !(r.home.name===null || typeof r.home.name==='string')
    || !object(t) || t.id!==value.target_user_id || t.name!==null || !(t.username===null || typeof t.username==='string')
    || typeof t.is_self!=='boolean' || t.is_self!==(actor===value.target_user_id) || typeof t.is_active!=='boolean'
    || !(typeof t.role_base==='string' && ROLES.includes(t.role_base) || t.is_self && t.role_base===null)
    || !(t.verification_status===null || typeof t.verification_status==='string' && t.verification_status.length<=50)
    || ['start_at','end_at','access_start_at','access_end_at'].some(key=>t[key]!==null && !date(t[key]))) throw failure();
  // Match HomeUserRef's identity boundary. Never expose raw User.name or email.
  return {home_id:r.home_id,target_user_id:r.target_user_id,occupancy_id:r.occupancy_id,action:'remove',decision_token:r.decision_token,
    home:{id:r.home.id,name:r.home.name},target:Object.fromEntries(['id','name','username','role_base','is_self','is_active',
      'verification_status','start_at','end_at','access_start_at','access_end_at'].map(key=>[key,t[key]]))};
}
function project(r) {
  return {state:r.state,home_id:r.home_id,target_user_id:r.target_user_id,occupancy_id:r.occupancy_id,action:r.action,
    decision_token:r.decision_token,completed_at:r.completed_at,code:r.code,status:r.status,
    command:{actor_id:r.command.actor_id,request_id:r.command.request_id,created_at:r.command.created_at,updated_at:r.command.updated_at},
    ...(typeof r.replayed==='boolean'?{replayed:r.replayed}: {})};
}
function validateResult(r,args) {
  if (typeof r.state!=='string' || !['pending','completed','rejected','cancelled'].includes(r.state)
    || !uuid(r.home_id) || !uuid(r.target_user_id) || !uuid(r.occupancy_id) || r.action!=='remove' || !hash(r.decision_token)
    || !object(r.command) || r.command.actor_id!==args.p_actor_id || r.command.request_id!==args.p_request_id
    || !date(r.command.created_at) || !date(r.command.updated_at)
    || (r.state==='completed' ? !date(r.completed_at) : r.completed_at!==null)
    || (r.state==='rejected' ? typeof r.code!=='string' || !Object.hasOwn(REJECTIONS,r.code) || r.status!==REJECTIONS[r.code]
      : r.code!==null || r.status!==null)
    || (args.p_intent && (typeof r.replayed!=='boolean' || Object.keys(args.p_intent).some(key=>r[key]!==args.p_intent[key])))) throw failure();
  return project(r);
}
async function read({actorId,requestId}) {
  if (!uuid(requestId)) throw failure('MEMBER_REMOVAL_INVALID');
  const args=identity(actorId,requestId);
  return validateResult(await rpc('get_home_member_removal',args),args);
}
async function resolve({actorId,requestId,intent,cancel=false}) {
  if (!uuid(requestId) || typeof cancel!=='boolean') throw failure('MEMBER_REMOVAL_INVALID');
  const args={...identity(actorId,requestId),p_intent:intentValue(intent,true),p_cancel:cancel};
  const raw=await rpc('resolve_home_member_removal',args);
  const result=validateResult(raw,args);
  if (!cancel && result.state==='completed' && result.replayed===false && result.target_user_id===args.p_actor_id
    && Array.isArray(raw._notify_user_ids) && raw._notify_user_ids.every(uuid)) {
    // Notification transport is intentionally best effort. A saved command is
    // never replaced by a notice error, and recovery never repeats notices.
    for (const userId of new Set(raw._notify_user_ids)) {
      if (userId===args.p_actor_id) continue;
      try {
        const {getActiveOccupancy}=require('../utils/homePermissions');
        if (!await getActiveOccupancy(result.home_id,userId)) continue;
        await require('./notificationService').createBulkNotifications([{
          userId,type:'member_moved_out',title:'Household member left',body:'A household member left.',
          link:`/homes/${result.home_id}/occupants`,metadata:{home_id:result.home_id,moved_out_user_id:args.p_actor_id},
        }]);
      } catch { /* Retain committed proof; no outbox or delivery guarantee. */ }
    }
  }
  return result;
}
function send(res,r,session) {
  return res.set('Cache-Control','private, no-store').status(r.state==='rejected'?r.status:200).json({...project(r),session});
}
function sendError(req,res,error) {
  const safe=typeof error?.code==='string' && Object.hasOwn(STATUSES,error.code) && error.statusCode===STATUSES[error.code]
    ? failure(error.code) : failure();
  let session;try {session=getRequestSessionScope(req);} catch { /* No valid session envelope can be asserted. */ }
  return res.set('Cache-Control','private, no-store').status(safe.statusCode).json({
    state:safe.code==='MEMBER_REMOVAL_NOT_FOUND'?'unknown':'error',code:safe.code,error:safe.message,...(session?{session}: {})});
}
module.exports={prepare,read,resolve,send,sendError,failure,REJECTIONS};
