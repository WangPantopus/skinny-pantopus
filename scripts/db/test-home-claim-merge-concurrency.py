#!/usr/bin/env python3
"""Observed lock-wait claim admission regressions in a local disposable Home DB.
Usage: python3 scripts/db/test-home-claim-merge-concurrency.py CONTAINER DATABASE
No provider calls. Synthetic fixtures are exact IDs and fully retired.
"""
import json, os, queue, re, subprocess, sys, tempfile, threading, time
from pathlib import Path
if len(sys.argv)!=3 or not re.fullmatch(r'supabase_db_pantopus-home-[a-z0-9_-]+',sys.argv[1]) or not re.fullmatch(r'postgres|[a-z0-9_]+_contract',sys.argv[2]):
 raise SystemExit('Pass a disposable local pantopus-home Docker container and contract database')
BASE=['docker','exec','-i',sys.argv[1],'psql','-X','-qAt','-U','postgres','-d',sys.argv[2],'-v','ON_ERROR_STOP=1']
os.umask(0o077)
fd, log_name=tempfile.mkstemp(prefix='pantopus-home-claim-concurrency-',suffix='.log')
log=os.fdopen(fd,'w')
class Conn:
 def __init__(self, name):
  self.name=name; self.n=0; self.lines=queue.Queue()
  self.p=subprocess.Popen(BASE, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, bufsize=1)
  def reader():
   for line in self.p.stdout: self.lines.put(line.rstrip('\n'))
   self.lines.put(None)
  def errors():
   for line in self.p.stderr: log.write(name+' STDERR '+line); log.flush()
  threading.Thread(target=reader,daemon=True).start(); threading.Thread(target=errors,daemon=True).start()
  self.run("SET application_name = 'home_claim_contract_"+name+"'; SET statement_timeout='15s';")
 def run(self, sql):
  self.n+=1; marker='__HOME_CLAIM_DONE_'+self.name+'_'+str(self.n)+'__'
  log.write(self.name+' SQL '+sql+'\n');log.flush()
  self.p.stdin.write(sql+"\nSELECT '"+marker+"';\n");self.p.stdin.flush()
  out=[]
  while True:
   line=self.lines.get(timeout=20)
   if line is None: raise AssertionError(self.name+' SQL exited; inspect private log')
   if line==marker: return out
   out.append(line);log.write(self.name+' OUT '+line+'\n');log.flush()
 def close(self):
  if self.p.poll() is None:
   try: self.p.stdin.write('ROLLBACK;\n\\q\n'); self.p.stdin.flush(); self.p.wait(timeout=5)
   except Exception: self.p.terminate()

def lit(v):return "'"+str(v).replace("'","''")+"'"
def uid(n):return 'ddc45100-0000-4000-8000-'+str(n).zfill(12)
owner,target,other=[uid(n) for n in range(1,4)]
homes=[uid(n) for n in range(101,121)]
claims=[uid(n) for n in range(201,221)]
w=Conn('winner');l=Conn('loser');setup=False
users=','.join(map(lit,[owner,target,other]));ids=','.join(map(lit,homes))
invites={}
def issue(i,token=None):
 return 'SET ROLE service_role; SELECT public.mutate_home_claim_invitation('+lit(homes[i])+','+lit(claims[i])+','+lit(owner)+",'issue',NULL,"+lit(token or str(i+1).zfill(64))+')::text; RESET ROLE;'
def accept(i,actor=target):
 return 'SET ROLE service_role; SELECT public.mutate_home_claim_invitation('+lit(homes[i])+','+lit(claims[i])+','+lit(actor)+",'accept',"+lit(invites[i])+')::text; RESET ROLE;'
def wait_lock():
 for _ in range(100):
  if w.run("SELECT count(*) FROM pg_stat_activity WHERE application_name='home_claim_contract_loser' AND wait_event_type='Lock';")==['1']:return
  time.sleep(.02)
 raise AssertionError('No demonstrated claim lock wait')
def concurrent(sql):
 out=[];errs=[]
 def run():
  try:out.extend(l.run(sql))
  except Exception as e:errs.append(str(e))
 t=threading.Thread(target=run);t.start();wait_lock();return t,out,errs

def finish(t,out,errs):
 w.run('COMMIT;');t.join(12)
 assert not t.is_alive() and not errs and len(out)==1,str(errs)+str(out)
 return json.loads(out[0])
def projection(h):
 q='SELECT jsonb_build_object(\'home\',(SELECT to_jsonb(s) FROM public."Home"s WHERE id='+lit(h)+')'
 for key,table in [('occupancy','HomeOccupancy'),('owner','HomeOwner'),('claim','HomeOwnershipClaim'),('invite','HomeInvite'),('audit','HomeAuditLog')]:
  q+=','+lit(key)+',(SELECT jsonb_agg(to_jsonb(s) ORDER BY id) FROM public."'+table+'"s WHERE home_id='+lit(h)+')'
 return w.run(q+')::text;')
try:
 assert w.run('SELECT (SELECT count(*) FROM auth.users WHERE id IN ('+users+'))+(SELECT count(*) FROM public."User" WHERE id IN ('+users+'))+(SELECT count(*) FROM public."Home" WHERE id IN ('+ids+'));')==['0'],'Refuse fixture reuse'
 sql='BEGIN; INSERT INTO auth.users(id,email,email_confirmed_at) VALUES '+','.join('('+lit(u)+','+lit('claim-race-'+str(n)+'@example.invalid')+',now())' for n,u in enumerate([owner,target,other]))+';'
 sql+=' INSERT INTO public."User"(id,email,username,name) SELECT id,email,\'claim_race_\'||right(id::text,1),\'Claim race fixture\' FROM auth.users WHERE id IN ('+users+');'
 for i,h in enumerate(homes):
  sql+=' INSERT INTO public."Home"(id,owner_id,address,city,state,zipcode) VALUES ('+lit(h)+','+lit(owner)+",'Synthetic claim race','Test','WA','98607');"
  sql+=' INSERT INTO public."HomeOwner"(home_id,subject_id,owner_status,is_primary_owner) VALUES ('+lit(h)+','+lit(owner)+",'verified',true);"
  for u,role,status in [(owner,'owner','verified'),(target,'member','pending_doc')]:
   sql+=' INSERT INTO public."HomeOccupancy"(home_id,user_id,role,role_base,age_band,verification_status) VALUES ('+lit(h)+','+lit(u)+','+lit(role)+','+lit(role)+",'adult',"+lit(status)+');'
  sql+=' INSERT INTO public."HomeOwnershipClaim"(id,home_id,claimant_user_id,claim_type,state,method,claim_phase_v2,identity_status) VALUES ('+lit(claims[i])+','+lit(h)+','+lit(target)+",'owner','submitted','doc_upload','under_review','verified');"
 sql+=' COMMIT;';w.run(sql);setup=True
 for i in range(19):
  r=json.loads(w.run(issue(i))[0]);assert r['ok'],r;invites[i]=r['invitation']['id']
 def blocked(i,label,change,code,delay=0):
  h=homes[i];w.run('BEGIN; SELECT id FROM public."Home" WHERE id='+lit(h)+' FOR UPDATE; '+change)
  before=projection(h);t,out,errs=concurrent(accept(i))
  if delay:time.sleep(delay)
  r=finish(t,out,errs)
  assert r.get('ok') is False and r.get('code')==code,label+str(r)
  assert projection(h)==before,label+' left partial authority'
  print('PASS: '+label+'; observed lock wait, current denial, no partial authority',flush=True)
 w.run('BEGIN;');r=json.loads(w.run(accept(0))[0]);assert r['ok'],r
 before=projection(homes[0]);t,out,errs=concurrent(accept(0));r=finish(t,out,errs)
 assert r.get('replayed') is True and projection(homes[0])==before,r
 print('PASS: duplicate acceptance has one owner/occupancy/claim/audit transition',flush=True)
 blocked(1,'invitation revoked', 'UPDATE public."HomeInvite" SET status=\'revoked\' WHERE id='+lit(invites[1])+';','CLAIM_INVITE_ALREADY_USED')
 blocked(2,'inviter explicit ownership deny','INSERT INTO public."HomePermissionOverride"(home_id,user_id,permission,allowed) VALUES ('+lit(homes[2])+','+lit(owner)+",'ownership.manage',false);",'OWNERSHIP_MANAGE_REQUIRED')
 blocked(3,'inviter proof revoked while primary pointer remains','UPDATE public."HomeOwner" SET owner_status=\'revoked\' WHERE home_id='+lit(homes[3])+' AND subject_id='+lit(owner)+';','OWNERSHIP_MANAGE_REQUIRED')
 w.run('UPDATE public."HomeOccupancy" SET access_end_at=clock_timestamp()+interval \'1 second\' WHERE home_id='+lit(homes[4])+' AND user_id='+lit(owner)+';')
 blocked(4,'inviter expiry during wait','','OWNERSHIP_MANAGE_REQUIRED',1.15)
 blocked(5,'target child age ceiling','UPDATE public."HomeOccupancy" SET age_band=\'child\' WHERE home_id='+lit(homes[5])+' AND user_id='+lit(target)+';','PROPOSED_ROLE_FORBIDDEN')
 blocked(6,'target revoked membership','UPDATE public."HomeOccupancy" SET verification_status=\'revoked\' WHERE home_id='+lit(homes[6])+' AND user_id='+lit(target)+';','MEMBERSHIP_RENEWAL_REQUIRED')
 w.run('INSERT INTO public."HomeVerificationEvidence"(claim_id,evidence_type,status) VALUES ('+lit(claims[7])+",'idv','verified');")
 blocked(7,'claim identity explicitly failed','UPDATE public."HomeOwnershipClaim" SET identity_status=\'failed\' WHERE id='+lit(claims[7])+';','IDENTITY_CONFIRMATION_REQUIRED')
 w.run('UPDATE public."HomeOwnershipClaim" SET identity_status=\'not_started\' WHERE id='+lit(claims[8])+'; INSERT INTO public."HomeVerificationEvidence"(claim_id,evidence_type,status) VALUES ('+lit(claims[8])+",'idv','verified');")
 blocked(8,'verified identity evidence withdrawn','UPDATE public."HomeVerificationEvidence" SET status=\'failed\' WHERE claim_id='+lit(claims[8])+';','IDENTITY_CONFIRMATION_REQUIRED')
 blocked(9,'claim role source changed','UPDATE public."HomeOwnershipClaim" SET claim_type=\'resident\' WHERE id='+lit(claims[9])+';','CLAIM_INVITE_CHANGED')
 blocked(10,'claim rejected','UPDATE public."HomeOwnershipClaim" SET state=\'rejected\' WHERE id='+lit(claims[10])+';','CLAIM_NOT_ELIGIBLE')
 blocked(11,'target revoked ownership history','INSERT INTO public."HomeOwner"(home_id,subject_id,owner_status) VALUES ('+lit(homes[11])+','+lit(target)+",'revoked');",'OWNERSHIP_REVIEW_REQUIRED')
 try:
  blocked(12,'owner default policy changed',"UPDATE public.\"HomeRolePermission\" SET allowed=false WHERE role_base='owner' AND permission='ownership.transfer';",'CLAIM_INVITE_CHANGED')
 finally:w.run("UPDATE public.\"HomeRolePermission\" SET allowed=true WHERE role_base='owner' AND permission='ownership.transfer';")
 w.run('UPDATE public."HomeOccupancy" SET access_end_at=clock_timestamp()+interval \'1 second\' WHERE home_id='+lit(homes[13])+' AND user_id='+lit(target)+';')
 blocked(13,'target expiry during wait','','MEMBERSHIP_RENEWAL_REQUIRED',1.15)
 w.run('UPDATE public."HomeInvite" SET expires_at=clock_timestamp()+interval \'1 second\' WHERE id='+lit(invites[14])+';')
 blocked(14,'invitation expiry during wait','','CLAIM_INVITE_EXPIRED',1.15)
 w.run('UPDATE public."HomeOwnershipClaim" SET expires_at=clock_timestamp()+interval \'1 second\' WHERE id='+lit(claims[15])+';')
 blocked(15,'claim expiry during wait','','CLAIM_NOT_ELIGIBLE',1.15)
 blocked(16,'claim recipient source changed','UPDATE public."HomeOwnershipClaim" SET claimant_user_id='+lit(other)+' WHERE id='+lit(claims[16])+';','CLAIM_RECIPIENT_MISMATCH')
 blocked(17,'inviter becomes explicit teen','UPDATE public."HomeOccupancy" SET age_band=\'teen\' WHERE home_id='+lit(homes[17])+' AND user_id='+lit(owner)+';','OWNERSHIP_MANAGE_REQUIRED')
 blocked(18,'Home frozen during acceptance','UPDATE public."Home" SET security_state=\'frozen\' WHERE id='+lit(homes[18])+';','OWNERSHIP_MANAGE_REQUIRED')
 w.run('BEGIN;');first=json.loads(w.run(issue(19))[0]);assert first['ok'],first
 before=projection(homes[19]);t,out,errs=concurrent(issue(19,'f'*64));r=finish(t,out,errs)
 assert r.get('replayed') is True and r['invitation']['id']==first['invitation']['id'] and projection(homes[19])==before,r
 print('PASS: duplicate issue returns one source-bound invitation without a second token/audit',flush=True)
finally:
 try:
  l.close()
  if setup:
   if w.p.poll() is not None:w=Conn('cleanup')
   w.run('ROLLBACK; BEGIN; DELETE FROM public."Home" WHERE id IN ('+ids+'); DELETE FROM public."User" WHERE id IN ('+users+'); DELETE FROM auth.users WHERE id IN ('+users+'); COMMIT;')
   assert w.run('SELECT (SELECT count(*) FROM public."Home" WHERE id IN ('+ids+'))+(SELECT count(*) FROM auth.users WHERE id IN ('+users+'))+(SELECT count(*) FROM public."User" WHERE id IN ('+users+'));')==['0']
   print('PASS: exact twenty-Home/three-account fixture cleanup',flush=True)
 finally:w.close();log.close()
