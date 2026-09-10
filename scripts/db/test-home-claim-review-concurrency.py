#!/usr/bin/env python3
"""Observed lock-wait claim review and withdrawal regressions in a local disposable Home DB.
Usage: python3 scripts/db/test-home-claim-review-concurrency.py CONTAINER DATABASE
No provider calls. Synthetic fixtures are exact IDs and fully retired.
"""
import json, os, queue, re, subprocess, sys, tempfile, threading, time
from pathlib import Path
if len(sys.argv)!=3 or not re.fullmatch(r'supabase_db_pantopus-home-[a-z0-9_-]+',sys.argv[1]) or not re.fullmatch(r'postgres|[a-z0-9_]+_contract',sys.argv[2]):
 raise SystemExit('Pass a disposable local pantopus-home Docker container and contract database')
BASE=['docker','exec','-i',sys.argv[1],'psql','-X','-qAt','-U','postgres','-d',sys.argv[2],'-v','ON_ERROR_STOP=1']
os.umask(0o077)
fd, log_name=tempfile.mkstemp(prefix='pantopus-home-claim-review-concurrency-',suffix='.log')
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
  self.run("SET application_name = 'home_claim_review_contract_"+name+"'; SET statement_timeout='15s';")
 def run(self, sql):
  self.n+=1; marker='__HOME_CLAIM_REVIEW_DONE_'+self.name+'_'+str(self.n)+'__'
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

def lit(v):return 'NULL' if v is None else "'"+str(v).replace("'","''")+"'"
def uid(n):return 'ddc80100-0000-4000-8000-'+str(n).zfill(12)
owner,target,admin=[uid(n) for n in range(1,4)]
homes=[uid(n) for n in range(101,133)]
claims=[uid(n) for n in range(201,233)]
evidence=[uid(n) for n in range(301,333)]
users=','.join(map(lit,[owner,target,admin]));ids=','.join(map(lit,homes))
w=Conn('winner');l=Conn('loser');setup=False;tokens={};invites={};passes=0

def rpc(sql):return 'SET ROLE service_role; SELECT '+sql+'::text; RESET ROLE;'
def read(i,actor=owner,platform=False):
 return rpc('public.get_home_claim_review('+','.join([lit(homes[i]),lit(claims[i]),lit(actor),str(platform).lower()])+')')
def review(i,action='approve',actor=owner,platform=False):
 return rpc('public.mutate_home_claim_review('+','.join([lit(homes[i]),lit(claims[i]),lit(actor),lit(action),lit(tokens.get(i)), 'NULL',str(platform).lower()])+')')
def withdraw(i):return review(i,'withdraw',target)
def provider(i):return rpc('public.record_home_claim_provider_evidence('+','.join([lit(homes[i]),lit(claims[i]),lit(target),"'attom'",'true','99'])+')')
def issue(i):return rpc('public.mutate_home_claim_invitation('+','.join([lit(homes[i]),lit(claims[i]),lit(owner),"'issue'",'NULL',lit(str(i+1).zfill(64))])+')')
def accept(i):return rpc('public.mutate_home_claim_invitation('+','.join([lit(homes[i]),lit(claims[i]),lit(target),"'accept'",lit(invites[i])])+')')
def result(sql):
 out=w.run(sql);assert len(out)==1,out
 return json.loads(out[0])
def snapshot(i):
 r=result(read(i));assert r.get('ok') is True,r
 tokens[i]=r['claim']['review_token']
def wait_lock():
 for _ in range(100):
  if w.run("SELECT count(*) FROM pg_stat_activity WHERE application_name='home_claim_review_contract_loser' AND wait_event_type='Lock';")==['1']:return
  time.sleep(.02)
 raise AssertionError('No demonstrated claim review lock wait')
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
 for key,table in [('occupancy','HomeOccupancy'),('owner','HomeOwner'),('claim','HomeOwnershipClaim'),('invite','HomeInvite'),('audit','HomeAuditLog'),('override','HomePermissionOverride'),('receipt','HomeClaimReviewReceipt')]:
  q+=','+lit(key)+',(SELECT jsonb_agg(to_jsonb(s) ORDER BY id) FROM public."'+table+'"s WHERE home_id='+lit(h)+')'
 q+=",'evidence',(SELECT jsonb_agg(to_jsonb(s) ORDER BY s.id) FROM public.\"HomeVerificationEvidence\"s JOIN public.\"HomeOwnershipClaim\"c ON c.id=s.claim_id WHERE c.home_id="+lit(h)+'))::text;'
 return w.run(q)
def passed(label):
 global passes
 passes+=1;print('PASS: '+label+'; observed lock wait, exact state verified',flush=True)
def blocked(i,label,change,code,sql=None,delay=0):
 snapshot(i);h=homes[i]
 w.run('BEGIN; SELECT id FROM public."Home" WHERE id='+lit(h)+' FOR UPDATE; '+change)
 before=projection(h);t,out,errs=concurrent(sql or review(i))
 if delay:time.sleep(delay)
 r=finish(t,out,errs)
 assert r.get('ok') is False and r.get('code')==code,label+str(r)
 assert projection(h)==before,label+' left partial authority'
 passed(label)
def winner_then(i,label,first,second,code):
 w.run('BEGIN;');r=result(first);assert r.get('ok') is True,label+str(r)
 before=projection(homes[i]);t,out,errs=concurrent(second);r=finish(t,out,errs)
 assert r.get('ok') is False and r.get('code')==code,label+str(r)
 assert projection(homes[i])==before,label+' left partial authority'
 passed(label)
try:
 assert w.run('SELECT (SELECT count(*) FROM auth.users WHERE id IN ('+users+'))+(SELECT count(*) FROM public."User" WHERE id IN ('+users+'))+(SELECT count(*) FROM public."Home" WHERE id IN ('+ids+'));')==['0'],'Refuse fixture reuse'
 sql='BEGIN; INSERT INTO auth.users(id,email,email_confirmed_at) VALUES '+','.join('('+lit(u)+','+lit('claim-review-race-'+str(n)+'@example.invalid')+',now())' for n,u in enumerate([owner,target,admin]))+';'
 sql+=' INSERT INTO public."User"(id,email,username,name,role) SELECT id,email,\'claim_review_race_\'||right(id::text,1),\'Claim review race fixture\',CASE WHEN id='+lit(admin)+" THEN 'admin' ELSE 'user' END FROM auth.users WHERE id IN ("+users+');'
 for i,h in enumerate(homes):
  sql+=' INSERT INTO public."Home"(id,owner_id,address,city,state,zipcode) VALUES ('+lit(h)+','+lit(owner)+",'Synthetic review race','Test','WA','98607');"
  sql+=' INSERT INTO public."HomeOwner"(home_id,subject_id,owner_status,is_primary_owner) VALUES ('+lit(h)+','+lit(owner)+",'verified',true);"
  for u,role,status in [(owner,'owner','verified'),(target,'member','pending_doc')]:
   sql+=' INSERT INTO public."HomeOccupancy"(home_id,user_id,role,role_base,age_band,verification_status) VALUES ('+lit(h)+','+lit(u)+','+lit(role)+','+lit(role)+",'adult',"+lit(status)+');'
  sql+=' INSERT INTO public."HomeOwnershipClaim"(id,home_id,claimant_user_id,claim_type,state,method,claim_phase_v2,identity_status) VALUES ('+lit(claims[i])+','+lit(h)+','+lit(target)+",'owner','submitted','property_data_match','under_review','verified');"
  sql+=' INSERT INTO public."HomeVerificationEvidence"(id,claim_id,evidence_type,provider,status,metadata) VALUES ('+lit(evidence[i])+','+lit(claims[i])+",'title_match','attom','verified','{\"matched\":true,\"confidence\":90}');"
 sql+=' COMMIT;';setup=True;w.run(sql)
 for i in [0,1,2,18,19,24,25]:snapshot(i)
 w.run('BEGIN;');first=result(review(0));assert first.get('ok') is True,first
 before=projection(homes[0]);t,out,errs=concurrent(review(0));r=finish(t,out,errs)
 assert r==dict(first,replayed=True) and projection(homes[0])==before,r
 passed('duplicate review returns exact receipt with one owner and approval audit')
 winner_then(1,'rejection wins before approval',review(1,'reject'),review(1),'CLAIM_NOT_ELIGIBLE')
 winner_then(2,'approval wins before rejection',review(2),review(2,'reject'),'CLAIM_NOT_ELIGIBLE')
 blocked(3,'actor ownership permission denied','INSERT INTO public."HomePermissionOverride"(home_id,user_id,permission,allowed) VALUES ('+lit(homes[3])+','+lit(owner)+",'ownership.manage',false);",'CLAIM_REVIEW_DENIED')
 blocked(4,'actor ownership proof revoked','UPDATE public."HomeOwner" SET owner_status=\'revoked\' WHERE home_id='+lit(homes[4])+' AND subject_id='+lit(owner)+';','CLAIM_REVIEW_DENIED')
 blocked(5,'actor becomes an explicit teen','UPDATE public."HomeOccupancy" SET age_band=\'teen\' WHERE home_id='+lit(homes[5])+' AND user_id='+lit(owner)+';','CLAIM_REVIEW_DENIED')
 w.run('UPDATE public."HomeOccupancy" SET access_end_at=clock_timestamp()+interval \'1 second\' WHERE home_id='+lit(homes[6])+' AND user_id='+lit(owner)+';')
 blocked(6,'actor expiry while waiting','','CLAIM_REVIEW_DENIED',delay=1.15)
 snapshot(7)
 blocked(7,'platform admin role revoked','UPDATE public."User" SET role=\'user\' WHERE id='+lit(admin)+';','CLAIM_REVIEW_DENIED',sql=review(7,actor=admin,platform=True))
 w.run('UPDATE public."User" SET role=\'admin\' WHERE id='+lit(admin)+';')
 blocked(8,'target becomes an explicit child','UPDATE public."HomeOccupancy" SET age_band=\'child\' WHERE home_id='+lit(homes[8])+' AND user_id='+lit(target)+';','PROPOSED_ROLE_FORBIDDEN')
 blocked(9,'target membership revoked','UPDATE public."HomeOccupancy" SET verification_status=\'revoked\' WHERE home_id='+lit(homes[9])+' AND user_id='+lit(target)+';','MEMBERSHIP_RENEWAL_REQUIRED')
 blocked(10,'target access starts in future','UPDATE public."HomeOccupancy" SET access_start_at=clock_timestamp()+interval \'1 day\' WHERE home_id='+lit(homes[10])+' AND user_id='+lit(target)+';','CLAIM_ACCESS_NOT_STARTED')
 blocked(11,'verified evidence fails after displayed snapshot','UPDATE public."HomeVerificationEvidence" SET status=\'failed\' WHERE id='+lit(evidence[11])+';','CLAIM_REVIEW_CHANGED')
 blocked(12,'evidence added after displayed snapshot','INSERT INTO public."HomeVerificationEvidence"(claim_id,evidence_type,provider,status) VALUES ('+lit(claims[12])+",'idv','stripe_identity','verified');",'CLAIM_REVIEW_CHANGED')
 blocked(13,'claim type changes after displayed snapshot','UPDATE public."HomeOwnershipClaim" SET claim_type=\'resident\' WHERE id='+lit(claims[13])+';','CLAIM_REVIEW_CHANGED')
 blocked(14,'claim method changes after displayed snapshot','UPDATE public."HomeOwnershipClaim" SET method=\'vouch\' WHERE id='+lit(claims[14])+';','CLAIM_REVIEW_CHANGED')
 blocked(15,'claim state changes after displayed snapshot','UPDATE public."HomeOwnershipClaim" SET state=\'needs_more_info\' WHERE id='+lit(claims[15])+';','CLAIM_REVIEW_CHANGED')
 blocked(16,'actor cannot delegate a denied permission','INSERT INTO public."HomePermissionOverride"(home_id,user_id,permission,allowed) VALUES ('+lit(homes[16])+','+lit(owner)+",'finance.manage',false);",'PERMISSION_DELEGATION_FORBIDDEN')
 w.run('UPDATE public."HomeOwnershipClaim" SET expires_at=clock_timestamp()+interval \'1 second\' WHERE id='+lit(claims[17])+';')
 blocked(17,'claim expiry while waiting','','CLAIM_NOT_ELIGIBLE',delay=1.15)
 winner_then(18,'withdrawal wins before review',withdraw(18),review(18),'CLAIM_NOT_ELIGIBLE')
 winner_then(19,'review wins before withdrawal',review(19),withdraw(19),'CLAIM_NOT_ELIGIBLE')
 for i in [20,21]:
  r=result(issue(i));assert r.get('ok') is True,r;invites[i]=r['invitation']['id']
 winner_then(20,'withdrawal wins before invitation acceptance',withdraw(20),accept(20),'CLAIM_INVITE_ALREADY_USED')
 winner_then(21,'invitation acceptance wins before withdrawal',accept(21),withdraw(21),'CLAIM_NOT_ELIGIBLE')
 winner_then(22,'withdrawal wins before provider callback',withdraw(22),provider(22),'CLAIM_NOT_ELIGIBLE')
 w.run('BEGIN;');r=result(provider(23));assert r.get('ok') is True,r
 before_evidence=w.run('SELECT jsonb_agg(to_jsonb(e) ORDER BY id)::text FROM public."HomeVerificationEvidence"e WHERE claim_id='+lit(claims[23])+';')
 t,out,errs=concurrent(withdraw(23));r=finish(t,out,errs)
 assert r.get('ok') is True and r.get('withdrawn') is True,r
 assert w.run('SELECT jsonb_agg(to_jsonb(e) ORDER BY id)::text FROM public."HomeVerificationEvidence"e WHERE claim_id='+lit(claims[23])+';')==before_evidence
 passed('provider callback wins first; withdrawal retains exact evidence')
 winner_then(24,'provider callback invalidates displayed review snapshot',provider(24),review(24),'CLAIM_REVIEW_CHANGED')
 winner_then(25,'review wins before provider callback',review(25),provider(25),'CLAIM_NOT_ELIGIBLE')
 w.run('INSERT INTO public."HomeOccupancy"(home_id,user_id,role,role_base,age_band,verification_status) VALUES ('+lit(homes[26])+','+lit(admin)+",'member','member','adult','verified');")
 snapshot(26)
 blocked(26,'platform actor becomes unknown Home role','UPDATE public."HomeOccupancy" SET role=NULL,role_base=NULL WHERE home_id='+lit(homes[26])+' AND user_id='+lit(admin)+';','CLAIM_REVIEW_DENIED',sql=review(26,actor=admin,platform=True))
 snapshot(27);h=homes[27]
 w.run('BEGIN; SELECT id FROM public."Home" WHERE id='+lit(h)+' FOR UPDATE; INSERT INTO public."HomePermissionOverride"(home_id,user_id,permission,allowed) VALUES ('+lit(h)+','+lit(target)+",'finance.manage',false);")
 t,out,errs=concurrent(review(27));r=finish(t,out,errs)
 assert r.get('ok') is True and r['occupancy']['role_base']=='owner',r
 assert w.run('SELECT allowed FROM public."HomePermissionOverride" WHERE home_id='+lit(h)+' AND user_id='+lit(target)+" AND permission='finance.manage';")==['f']
 assert w.run('SELECT public.home_has_permission('+lit(h)+",'finance.manage',"+lit(target)+');')==['f']
 passed('current restrictive target override survives approval')
 snapshot(28)
 w.run('BEGIN; UPDATE public."User" SET role=NULL WHERE id='+lit(admin)+';')
 before=projection(homes[28]);t,out,errs=concurrent(review(28,actor=admin,platform=True));r=finish(t,out,errs)
 assert r.get('ok') is False and r.get('code')=='CLAIM_REVIEW_DENIED',r
 assert projection(homes[28])==before,'NULL platform role left partial authority'
 passed('platform role becomes NULL during exact actor-row lock wait')
 for i in [29,30]:
  snapshot(i);r=result(review(i));assert r.get('ok') is True,r
 w.run('BEGIN; SELECT id FROM public."Home" WHERE id='+lit(homes[29])+' FOR UPDATE; UPDATE public."HomeVerificationEvidence" SET status=\'failed\' WHERE id='+lit(evidence[29])+';')
 before=projection(homes[29]);t,out,errs=concurrent(review(29));r=finish(t,out,errs)
 assert r.get('code')=='CLAIM_REVIEW_CHANGED' and projection(homes[29])==before,r
 passed('changed evidence denies completed decision replay without regrant')
 w.run('BEGIN; SELECT id FROM public."Home" WHERE id='+lit(homes[30])+' FOR UPDATE; INSERT INTO public."HomePermissionOverride"(home_id,user_id,permission,allowed) VALUES ('+lit(homes[30])+','+lit(owner)+",'ownership.manage',false);")
 before=projection(homes[30]);t,out,errs=concurrent(review(30));r=finish(t,out,errs)
 assert r.get('code')=='CLAIM_REVIEW_DENIED' and projection(homes[30])==before,r
 passed('current actor deny prevents completed decision replay')
 snapshot(31);r=result(review(31));assert r.get('ok') is True,r
 w.run('BEGIN; SELECT id FROM public."Home" WHERE id='+lit(homes[31])+' FOR UPDATE; INSERT INTO public."HomePermissionOverride"(home_id,user_id,permission,allowed) VALUES ('+lit(homes[31])+','+lit(target)+",'finance.manage',false);")
 before=projection(homes[31]);t,out,errs=concurrent(review(31));r=finish(t,out,errs)
 assert r.get('code')=='CLAIM_REVIEW_CHANGED' and projection(homes[31])==before,r
 passed('current target deny prevents stale completed-decision management flags')
 assert passes==32,passes
 print('PASS: 32 actual claim review/withdrawal lock-wait races',flush=True)
finally:
 try:
  l.close()
  if setup:
   if w.p.poll() is not None:w=Conn('cleanup')
   w.run('ROLLBACK; BEGIN; DELETE FROM public."Home" WHERE id IN ('+ids+'); DELETE FROM public."User" WHERE id IN ('+users+'); DELETE FROM auth.users WHERE id IN ('+users+'); COMMIT;')
   counts=w.run('SELECT jsonb_build_object(\'homes\',(SELECT count(*) FROM public."Home" WHERE id IN ('+ids+')),\'users\',(SELECT count(*) FROM public."User" WHERE id IN ('+users+')),\'auth_users\',(SELECT count(*) FROM auth.users WHERE id IN ('+users+')),\'claims\',(SELECT count(*) FROM public."HomeOwnershipClaim" WHERE id IN ('+','.join(map(lit,claims))+')),\'evidence\',(SELECT count(*) FROM public."HomeVerificationEvidence" WHERE claim_id IN ('+','.join(map(lit,claims))+')),\'receipts\',(SELECT count(*) FROM public."HomeClaimReviewReceipt" WHERE home_id IN ('+ids+')))::text;')
   assert all(n==0 for n in json.loads(counts[0]).values()),counts
   print('PASS: exact thirty-two-Home/three-account claim/evidence/receipt fixture cleanup',flush=True)
 finally:w.close();log.close()
