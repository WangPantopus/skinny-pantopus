#!/usr/bin/env python3
"""Observed lock-wait claim evidence regressions in a local disposable Home DB.
Usage: python3 scripts/db/test-home-claim-evidence-concurrency.py CONTAINER DATABASE
No provider calls. Synthetic fixtures are exact IDs and fully retired.
"""
import hashlib, json, os, queue, re, subprocess, sys, tempfile, threading, time
from pathlib import Path
if len(sys.argv)!=3 or not re.fullmatch(r'supabase_db_pantopus-home-[a-z0-9_-]+',sys.argv[1]) or not re.fullmatch(r'postgres|[a-z0-9_]+_contract',sys.argv[2]):
 raise SystemExit('Pass a disposable local pantopus-home Docker container and contract database')
BASE=['docker','exec','-i',sys.argv[1],'psql','-X','-qAt','-U','postgres','-d',sys.argv[2],'-v','ON_ERROR_STOP=1']
os.umask(0o077)
fd, log_name=tempfile.mkstemp(prefix='pantopus-home-claim-evidence-concurrency-',suffix='.log')
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
  self.run("SET application_name = 'home_claim_evidence_contract_"+name+"'; SET statement_timeout='15s';")
 def run(self, sql):
  self.n+=1; marker='__HOME_CLAIM_EVIDENCE_DONE_'+self.name+'_'+str(self.n)+'__'
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
def uid(n):return 'ddc90100-0000-4000-8000-'+str(n).zfill(12)
owner,actor,admin=[uid(n) for n in range(1,4)]
homes=[uid(n) for n in range(101,121)];claims=[uid(n) for n in range(201,221)];uploads=[uid(n) for n in range(301,321)]
users=','.join(map(lit,[owner,actor,admin]));ids=','.join(map(lit,homes));claim_ids=','.join(map(lit,claims));upload_ids=','.join(map(lit,uploads))
w=Conn('winner');l=Conn('loser');setup=False
payload={'bucket':'private-evidence-race','sha256':'a'*64,'file_name':'lease.txt','file_size':4,'mime_type':'text/plain','evidence_type':'lease'}
def call(name,args):return 'SET ROLE service_role; SELECT public.'+name+'('+','.join(args)+')::text; RESET ROLE;'
def mutate(i,action):return call('mutate_home_claim_evidence',[lit(homes[i]),lit(claims[i]),lit(actor),lit(action),lit(uploads[i]),lit(json.dumps(payload if action=='reserve' else {}))])
def withdraw(i):return call('mutate_home_claim_review',[lit(homes[i]),lit(claims[i]),lit(actor),lit('withdraw')])
def wait_lock():
 for _ in range(100):
  if w.run("SELECT count(*) FROM pg_stat_activity WHERE application_name='home_claim_evidence_contract_loser' AND wait_event_type='Lock';")==['1']:return
  time.sleep(.02)
 raise AssertionError('No demonstrated evidence lock wait')
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
def ok(sql):
 r=json.loads(w.run(sql)[0]);assert r.get('ok') is True,r;return r
def ready(i):ok(mutate(i,'reserve'));ok(mutate(i,'begin_upload'));ok(mutate(i,'finalize'))
def inspection(i,who=owner,platform=False):
 tok=w.run('SELECT public.home_claim_review_snapshot(c) FROM public."HomeOwnershipClaim" c WHERE id='+lit(claims[i])+';')[0]
 receipt=hashlib.sha256((str(i)+who+'inspection').encode()).hexdigest()
 fields=[lit(homes[i]),lit(claims[i]),lit(who),lit(uploads[i]),str(platform).lower(),lit(tok),lit(receipt)]
 ok(call('record_home_claim_evidence_inspection',fields))
 return call('verify_home_claim_evidence',fields),receipt

def projection(i):
 return w.run('SELECT jsonb_build_object(\'intent\',(SELECT to_jsonb(r) FROM public."HomeClaimEvidenceIntent" r WHERE id='+lit(uploads[i])+'),\'file\',(SELECT to_jsonb(r) FROM public."File" r WHERE id='+lit(uploads[i])+'),\'evidence\',(SELECT jsonb_agg(to_jsonb(r) ORDER BY id) FROM public."HomeVerificationEvidence" r WHERE claim_id='+lit(claims[i])+'),\'claim\',(SELECT to_jsonb(r) FROM public."HomeOwnershipClaim" r WHERE id='+lit(claims[i])+'),\'inspection\',(SELECT jsonb_agg(to_jsonb(r) ORDER BY receipt_hash) FROM public."HomeClaimEvidenceInspection" r WHERE upload_id='+lit(uploads[i])+'),\'quota\',(SELECT to_jsonb(r) FROM public."FileQuota" r WHERE user_id='+lit(actor)+'))::text;')
try:
 assert w.run('SELECT (SELECT count(*) FROM auth.users WHERE id IN ('+users+'))+(SELECT count(*) FROM public."User" WHERE id IN ('+users+'))+(SELECT count(*) FROM public."Home" WHERE id IN ('+ids+'))+(SELECT count(*) FROM public."HomeClaimEvidenceIntent" WHERE original_home_id IN ('+ids+'));')==['0'],'Refuse fixture reuse'
 sql='BEGIN; INSERT INTO auth.users(id,email) VALUES '+','.join('('+lit(u)+','+lit('evidence-race-'+str(n)+'@example.invalid')+')' for n,u in enumerate([owner,actor,admin]))+';'
 sql+=' INSERT INTO public."User"(id,email,username,role) SELECT id,email,\'evidence_race_\'||right(id::text,1),CASE WHEN id='+lit(admin)+" THEN 'admin' ELSE 'user' END FROM auth.users WHERE id IN ("+users+');'
 for i,h in enumerate(homes):
  sql+=' INSERT INTO public."Home"(id,owner_id,address,city,state,zipcode) VALUES('+lit(h)+','+lit(owner)+",'Synthetic evidence race','Test','WA','98607');"
  sql+=' INSERT INTO public."HomeOwner"(home_id,subject_id,owner_status,is_primary_owner,verification_tier) VALUES('+lit(h)+','+lit(owner)+",'verified',true,'strong');"
  sql+=' INSERT INTO public."HomeOccupancy"(home_id,user_id,role,role_base,age_band,verification_status) VALUES('+lit(h)+','+lit(owner)+",'owner','owner','adult','verified'),("+lit(h)+','+lit(actor)+",'member','member','adult','pending_doc');"
  sql+=' INSERT INTO public."HomeOwnershipClaim"(id,home_id,claimant_user_id,claim_type,state,method,claim_phase_v2,identity_status,expires_at) VALUES('+lit(claims[i])+','+lit(h)+','+lit(actor)+",'resident','submitted','doc_upload','evidence_submitted','verified',now()+interval '1 day');"
 w.run(sql+'COMMIT;');setup=True
 def blocked(i,label,change,request,code,delay=0,lock=None):
  lock=lock or 'SELECT id FROM public."Home" WHERE id='+lit(homes[i])+' FOR UPDATE;'
  w.run('BEGIN; '+lock+change);before=projection(i);t,out,errs=concurrent(request)
  if delay:time.sleep(delay)
  r=finish(t,out,errs)
  assert r.get('ok') is False and r.get('code')==code,label+str(r)
  assert projection(i)==before,label+' left partial evidence writes'
  print('PASS: '+label+'; observed wait and no partial writes',flush=True)
 blocked(0,'claimant revoked before reservation','UPDATE public."HomeOccupancy" SET verification_status=\'revoked\' WHERE home_id='+lit(homes[0])+' AND user_id='+lit(actor)+';',mutate(0,'reserve'),'CLAIM_EVIDENCE_DENIED')
 w.run('UPDATE public."HomeOccupancy" SET access_end_at=clock_timestamp()+interval \'1 second\' WHERE home_id='+lit(homes[1])+' AND user_id='+lit(actor)+';')
 blocked(1,'claimant expiry during Home wait','',mutate(1,'reserve'),'CLAIM_EVIDENCE_DENIED',1.15)
 w.run('INSERT INTO public."FileQuota"(user_id) VALUES('+lit(actor)+') ON CONFLICT DO NOTHING;')
 w.run('UPDATE public."HomeOccupancy" SET access_end_at=clock_timestamp()+interval \'1 second\' WHERE home_id='+lit(homes[2])+' AND user_id='+lit(actor)+';')
 blocked(2,'claimant expiry during quota reservation','',mutate(2,'reserve'),'CLAIM_EVIDENCE_DENIED',1.15,'SELECT user_id FROM public."FileQuota" WHERE user_id='+lit(actor)+' FOR UPDATE;')
 w.run('BEGIN;');ok(mutate(3,'reserve'));before=projection(3);t,out,errs=concurrent(mutate(3,'reserve'));r=finish(t,out,errs)
 assert r.get('ok') is True and projection(3)==before,r
 print('PASS: simultaneous reservation charges quota once',flush=True)
 ok(mutate(4,'reserve'));ok(mutate(4,'begin_upload'));w.run('BEGIN;');ok(withdraw(4));before=projection(4)
 t,out,errs=concurrent(mutate(4,'finalize'));r=finish(t,out,errs)
 assert r.get('code')=='CLAIM_NOT_ELIGIBLE' and projection(4)==before,r
 # Even a shared-household claimant retains only exact pending-file retirement,
 # backed by its protected withdrawal receipt; this grants no read/membership.
 ok(mutate(4,'retire'))
 print('PASS: withdrawal fences pending publication and exact uploader can retire it',flush=True)
 ok(mutate(5,'reserve'));ok(mutate(5,'begin_upload'));w.run('BEGIN;');ok(mutate(5,'finalize'))
 t,out,errs=concurrent(withdraw(5));r=finish(t,out,errs);assert r.get('ok') is True,r
 assert ok(mutate(5,'retire'))['record']['state']=='retired'
 print('PASS: publication then non-private withdrawal permits protected pending retirement',flush=True)
 for i in range(6,20):ready(i)
 verify,receipt=inspection(6)
 blocked(6,'reviewer permission revoked before verification','INSERT INTO public."HomePermissionOverride"(home_id,user_id,permission,allowed) VALUES('+lit(homes[6])+','+lit(owner)+",'ownership.manage',false);",verify,'CLAIM_EVIDENCE_DENIED')
 verify,receipt=inspection(7)
 blocked(7,'reviewer owner proof revoked','UPDATE public."HomeOwner" SET owner_status=\'revoked\' WHERE home_id='+lit(homes[7])+' AND subject_id='+lit(owner)+';',verify,'CLAIM_EVIDENCE_DENIED')
 verify,receipt=inspection(8);w.run('UPDATE public."HomeOccupancy" SET access_end_at=clock_timestamp()+interval \'1 second\' WHERE home_id='+lit(homes[8])+' AND user_id='+lit(owner)+';')
 blocked(8,'reviewer expiry during Home wait','',verify,'CLAIM_EVIDENCE_DENIED',1.15)
 verify,receipt=inspection(9);w.run('UPDATE public."HomeClaimEvidenceInspection" SET expires_at=clock_timestamp()+interval \'1 second\' WHERE receipt_hash='+lit(receipt)+';')
 blocked(9,'inspection expires while waiting on receipt','',verify,'CLAIM_EVIDENCE_INSPECTION_REQUIRED',1.15,'SELECT receipt_hash FROM public."HomeClaimEvidenceInspection" WHERE receipt_hash='+lit(receipt)+' FOR UPDATE;')
 verify,receipt=inspection(10)
 blocked(10,'claim risk snapshot changed','UPDATE public."HomeOwnershipClaim" SET risk_score=9 WHERE id='+lit(claims[10])+';',verify,'CLAIM_REVIEW_CHANGED')
 verify,receipt=inspection(11)
 blocked(11,'new evidence changes review snapshot','INSERT INTO public."HomeVerificationEvidence"(claim_id,evidence_type,provider,status) VALUES('+lit(claims[11])+",'idv','stripe_identity','verified');",verify,'CLAIM_REVIEW_CHANGED')
 verify,receipt=inspection(12);w.run('BEGIN;');ok(mutate(12,'retire'));before=projection(12);t,out,errs=concurrent(verify);r=finish(t,out,errs)
 assert r.get('code')=='CLAIM_EVIDENCE_NOT_FOUND' and projection(12)==before,r
 print('PASS: retirement fences waiting evidence verification',flush=True)
 verify,receipt=inspection(13);w.run('BEGIN;');ok(verify);before=projection(13);t,out,errs=concurrent(mutate(13,'retire'));r=finish(t,out,errs)
 assert r.get('code')=='CLAIM_EVIDENCE_RETENTION_REQUIRED' and projection(13)==before,r
 print('PASS: completed verification fences pending removal and retains history',flush=True)
 verify,receipt=inspection(14);w.run('BEGIN;');ok(verify);before=projection(14);t,out,errs=concurrent(verify);r=finish(t,out,errs)
 assert r.get('ok') is True and r.get('replayed') is True and projection(14)==before,r
 print('PASS: simultaneous exact receipt retry has one verification and no duplicate writes',flush=True)
 verify,receipt=inspection(15,admin,True)
 blocked(15,'platform admin role becomes NULL','UPDATE public."User" SET role=NULL WHERE id='+lit(admin)+';',verify,'CLAIM_EVIDENCE_DENIED',lock='SELECT id FROM public."User" WHERE id='+lit(admin)+' FOR UPDATE;')
 tok=w.run('SELECT public.home_claim_review_snapshot(c) FROM public."HomeOwnershipClaim" c WHERE id='+lit(claims[16])+';')[0]
 request=call('record_home_claim_evidence_inspection',[lit(homes[16]),lit(claims[16]),lit(owner),lit(uploads[16]),'false',lit(tok),lit('f'*64)])
 blocked(16,'reviewer denied before recording byte inspection','UPDATE public."HomeOccupancy" SET age_band=\'teen\' WHERE home_id='+lit(homes[16])+' AND user_id='+lit(owner)+';',request,'CLAIM_EVIDENCE_DENIED')
 # Begin from a ready upload: exact re-reservation must not revive an expired
 # claim, even while the caller waits behind a current authority lock.
 w.run('UPDATE public."HomeOwnershipClaim" SET expires_at=clock_timestamp()+interval \'1 second\' WHERE id='+lit(claims[17])+';')
 blocked(17,'claim expiry during retry lock wait','',mutate(17,'reserve'),'CLAIM_NOT_ELIGIBLE',1.15)
 verify,receipt=inspection(18);w.run('BEGIN;');ok(withdraw(18));before=projection(18);t,out,errs=concurrent(verify);r=finish(t,out,errs)
 assert r.get('code')=='CLAIM_NOT_ELIGIBLE' and projection(18)==before,r
 print('PASS: withdrawal fences waiting verification',flush=True)
 verify,receipt=inspection(19);w.run('BEGIN;');ok(verify);t,out,errs=concurrent(withdraw(19));r=finish(t,out,errs);assert r.get('ok') is True,r
 assert w.run('SELECT status FROM public."HomeVerificationEvidence" WHERE id='+lit(uploads[19])+';')==['verified']
 assert w.run('SELECT count(*) FROM public."HomeOwner" WHERE home_id='+lit(homes[19])+' AND subject_id='+lit(actor)+';')==['0']
 print('PASS: verification then withdrawal retains proof without granting ownership',flush=True)
finally:
 try:
  l.close()
  if setup:
   if w.p.poll() is not None:w=Conn('cleanup')
   sql='ROLLBACK; BEGIN; DELETE FROM public."HomeClaimEvidenceInspection" WHERE upload_id IN ('+upload_ids+');'
   sql+=' ALTER TABLE public."HomeVerificationEvidence" DISABLE TRIGGER protect_home_claim_evidence_record; DELETE FROM public."HomeVerificationEvidence" WHERE claim_id IN ('+claim_ids+'); ALTER TABLE public."HomeVerificationEvidence" ENABLE TRIGGER protect_home_claim_evidence_record;'
   sql+=' ALTER TABLE public."File" DISABLE TRIGGER protect_home_claim_evidence_file; DELETE FROM public."File" WHERE id IN ('+upload_ids+'); ALTER TABLE public."File" ENABLE TRIGGER protect_home_claim_evidence_file;'
   sql+=' ALTER TABLE public."HomeClaimEvidenceIntent" DISABLE TRIGGER protect_home_claim_evidence_intent; DELETE FROM public."HomeClaimEvidenceIntent" WHERE original_home_id IN ('+ids+'); ALTER TABLE public."HomeClaimEvidenceIntent" ENABLE TRIGGER protect_home_claim_evidence_intent;'
   sql+=' DELETE FROM public."Home" WHERE id IN ('+ids+'); DELETE FROM public."User" WHERE id IN ('+users+'); DELETE FROM auth.users WHERE id IN ('+users+'); COMMIT;'
   w.run(sql)
   assert w.run('SELECT (SELECT count(*) FROM public."Home" WHERE id IN ('+ids+'))+(SELECT count(*) FROM public."HomeClaimEvidenceIntent" WHERE original_home_id IN ('+ids+'))+(SELECT count(*) FROM public."HomeClaimEvidenceInspection" WHERE upload_id IN ('+upload_ids+'))+(SELECT count(*) FROM public."HomeClaimReviewReceipt" WHERE home_id IN ('+ids+'))+(SELECT count(*) FROM public."File" WHERE id IN ('+upload_ids+'))+(SELECT count(*) FROM auth.users WHERE id IN ('+users+'))+(SELECT count(*) FROM public."User" WHERE id IN ('+users+'));')==['0']
   print('PASS: exact twenty-Home/three-account/evidence/inspection/File/receipt fixture cleanup',flush=True)
 finally:w.close();log.close()
print('Private race log:',log_name,flush=True)
