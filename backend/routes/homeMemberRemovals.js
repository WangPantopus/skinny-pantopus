const router = require('express').Router();
const verifyToken = require('../middleware/verifyToken');
const { invalidateRoleCache } = require('../middleware/verifyToken');
const { getRequestSessionScope, requireExpectedSessionScope } = require('../utils/requestSessionScope');
const service = require('../services/homeMemberRemovalService');

router.use((_req,res,next)=>{res.set('Cache-Control','private, no-store');next();});
router.use(verifyToken);
router.get('/session',(req,res)=>{
  try {res.json({session:getRequestSessionScope(req)});} catch(error){service.sendError(req,res,error);}
});
router.use((req,res,next)=>{if(requireExpectedSessionScope(req,res,{required:true}))next();});
router.post('/context',async(req,res)=>{
  try {res.json({...await service.prepare({actorId:req.user.id,intent:req.body}),session:getRequestSessionScope(req)});}
  catch(error){service.sendError(req,res,error);}
});
router.get('/commands/:requestId',async(req,res)=>{
  try {service.send(res,await service.read({actorId:req.user.id,requestId:req.params.requestId}),getRequestSessionScope(req));}
  catch(error){service.sendError(req,res,error);}
});
router.post('/commands',async(req,res)=>{
  try {
    const {request_id,...intent}=req.body||{};
    const result=await service.resolve({actorId:req.user.id,requestId:request_id,intent});
    if(result.state==='completed' && result.replayed===false){
      try {invalidateRoleCache?.(result.target_user_id);} catch { /* A local cache failure cannot undo durable proof. */ }
    }
    service.send(res,result,getRequestSessionScope(req));
  } catch(error){service.sendError(req,res,error);}
});
router.post('/commands/:requestId/cancel',async(req,res)=>{
  try {service.send(res,await service.resolve({actorId:req.user.id,requestId:req.params.requestId,intent:req.body,cancel:true}),getRequestSessionScope(req));}
  catch(error){service.sendError(req,res,error);}
});
module.exports=router;
