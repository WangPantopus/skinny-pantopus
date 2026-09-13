#!/usr/bin/env python3
"""Observed lock-wait claim relationship regressions in a local disposable Home DB.
Usage: python3 scripts/db/test-home-claim-relationship-concurrency.py CONTAINER DATABASE
No provider calls. Synthetic fixtures are exact IDs and fully retired.
"""
import json, os, queue, re, subprocess, sys, tempfile, threading, time
from pathlib import Path
if len(sys.argv)!=3 or not re.fullmatch(r'supabase_db_pantopus-home-[a-z0-9_-]+',sys.argv[1]) or not re.fullmatch(r'postgres|[a-z0-9_]+_contract',sys.argv[2]):
 raise SystemExit('Pass a disposable local pantopus-home Docker container and contract database')
BASE=['docker','exec','-i',sys.argv[1],'psql','-X','-qAt','-U','postgres','-d',sys.argv[2],'-v','ON_ERROR_STOP=1']
os.umask(0o077)
fd, log_name=tempfile.mkstemp(prefix='pantopus-home-claim-relationship-concurrency-',suffix='.log')
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
  self.run("SET application_name = 'home_claim_relationship_contract_"+name+"'; SET statement_timeout='15s';")
 def run(self, sql):
  self.n+=1; marker='__HOME_CLAIM_RELATIONSHIP_DONE_'+self.name+'_'+str(self.n)+'__'
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
def uid(n):return 'ddc23200-0000-4000-8000-'+str(n).zfill(12)
actor,target=uid(1),uid(2)
homes=[uid(n) for n in range(101,113)];claims=[uid(n) for n in range(201,213)];evidence=[uid(n) for n in range(301,313)]
users=','.join(map(lit,[actor,target]));ids=','.join(map(lit,homes))
w=Conn('winner');l=Conn('loser');setup=False;tokens={};passes=0

def decision(i,action='flag_unknown_person'):
 args=[homes[i],claims[i],actor,action,None,uid(501+i),tokens[i]]
 return 'SET ROLE service_role; SELECT public.decide_home_claim_relationship('+','.join(map(lit,args))+')::text; RESET ROLE;'
def result(sql):
 out=w.run(sql);assert len(out)==1,out;return json.loads(out[0])
def snapshot(i):
 tokens[i]=w.run('SELECT public.home_claim_review_snapshot(c) FROM public."HomeOwnershipClaim" c WHERE id='+lit(claims[i])+';')[0]
def projection(i):
 q="SELECT jsonb_build_object('home',(SELECT to_jsonb(h) FROM public.\"Home\" h WHERE id="+lit(homes[i])+')'
 for key,table in [('claim','HomeOwnershipClaim'),('occupancy','HomeOccupancy'),('owner','HomeOwner'),('receipt','HomeClaimRelationshipReceipt'),('audit','HomeAuditLog')]:
  q+=','+lit(key)+',(SELECT jsonb_agg(to_jsonb(r) ORDER BY id) FROM public."'+table+'" r WHERE home_id='+lit(homes[i])+')'
 q+=",'evidence',(SELECT jsonb_agg(to_jsonb(e) ORDER BY id) FROM public.\"HomeVerificationEvidence\" e WHERE claim_id="+lit(claims[i])+'))::text;'
 return w.run(q)
def wait_lock():
 for _ in range(100):
  if w.run("SELECT count(*) FROM pg_stat_activity WHERE application_name='home_claim_relationship_contract_loser' AND wait_event_type='Lock';")==['1']:return
  time.sleep(.02)
 raise AssertionError('No observed relationship lock wait')
def concurrent(command):
 out=[];errs=[]
 def run():
  try:out.extend(l.run(command))
  except Exception as e:errs.append(str(e))
 t=threading.Thread(target=run);t.start();wait_lock();return t,out,errs
def finish(t,out,errs):
 w.run('COMMIT;');t.join(12)
 assert not t.is_alive() and not errs and len(out)==1,str(errs)+str(out)
 return json.loads(out[0])
def passed(label):
 global passes
 passes+=1;print('PASS: '+label+'; observed lock wait and exact resulting state',flush=True)
def blocked(i,label,change,code,delay=0):
 snapshot(i);w.run('BEGIN; SELECT id FROM public."Home" WHERE id='+lit(homes[i])+' FOR UPDATE; '+change)
 before=projection(i);t,out,errs=concurrent(decision(i))
 if delay:time.sleep(delay)
 r=finish(t,out,errs)
 assert r.get('code')==code and r.get('ok') is False,label+str(r)
 assert projection(i)==before,label+' left partial state';passed(label)
try:
 assert w.run('SELECT (SELECT count(*) FROM auth.users WHERE id IN ('+users+'))+(SELECT count(*) FROM public."User" WHERE id IN ('+users+'))+(SELECT count(*) FROM public."Home" WHERE id IN ('+ids+'));')==['0'],'Refuse fixture reuse'
 q='BEGIN; INSERT INTO auth.users(id,email,email_confirmed_at) VALUES '+','.join('('+lit(u)+','+lit('relationship-race-'+str(n)+'@example.invalid')+',now())' for n,u in enumerate([actor,target]))+';'
 q+=' INSERT INTO public."User"(id,email,username,role) SELECT id,email,\'relationship_race_\'||right(id::text,1),\'user\' FROM auth.users WHERE id IN ('+users+');'
 for i,h in enumerate(homes):
  q+=' INSERT INTO public."Home"(id,owner_id,address,city,state,zipcode) VALUES ('+lit(h)+','+lit(actor)+",'Synthetic relationship race','Test','WA','98607');"
  q+=' INSERT INTO public."HomeOwner"(home_id,subject_id,owner_status,is_primary_owner) VALUES ('+lit(h)+','+lit(actor)+",'verified',true);"
  q+=' INSERT INTO public."HomeOccupancy"(home_id,user_id,role,role_base,age_band,verification_status) VALUES ('+lit(h)+','+lit(actor)+",'owner','owner','adult','verified');"
  q+=' INSERT INTO public."HomeOwnershipClaim"(id,home_id,claimant_user_id,claim_type,state,method,claim_phase_v2,expires_at) VALUES ('+lit(claims[i])+','+lit(h)+','+lit(target)+",'owner','submitted','property_data_match','under_review',now()+interval '1 day');"
  q+=' INSERT INTO public."HomeVerificationEvidence"(id,claim_id,evidence_type,provider,status,metadata) VALUES ('+lit(evidence[i])+','+lit(claims[i])+",'title_match','attom','verified','{\"matched\":true,\"confidence\":90}');"
 setup=True;w.run(q+'COMMIT;')
 snapshot(0);w.run('BEGIN;');first=result(decision(0));assert first['ok'],first
 before=projection(0);t,out,errs=concurrent(decision(0));r=finish(t,out,errs)
 assert r==dict(first,replayed=True) and projection(0)==before,r;passed('duplicate decision returns one receipt and audit')
 snapshot(1);w.run('BEGIN;');assert result(decision(1,'decline_relationship'))['ok']
 before=projection(1);t,out,errs=concurrent(decision(1));r=finish(t,out,errs)
 assert r.get('code')=='CLAIM_RELATIONSHIP_REQUEST_CHANGED' and projection(1)==before,r;passed('competing changed intent cannot replace original')
 blocked(2,'reviewer revoked','UPDATE public."HomeOccupancy" SET is_active=false WHERE home_id='+lit(homes[2])+';','CLAIM_REVIEW_DENIED')
 blocked(3,'ownership proof revoked','UPDATE public."HomeOwner" SET owner_status=\'revoked\' WHERE home_id='+lit(homes[3])+';','CLAIM_REVIEW_DENIED')
 blocked(4,'explicit ownership deny','INSERT INTO public."HomePermissionOverride"(home_id,user_id,permission,allowed) VALUES ('+lit(homes[4])+','+lit(actor)+",'ownership.manage',false);",'CLAIM_REVIEW_DENIED')
 blocked(5,'evidence changes after review','UPDATE public."HomeVerificationEvidence" SET status=\'failed\' WHERE id='+lit(evidence[5])+';','CLAIM_REVIEW_CHANGED')
 blocked(6,'Home frozen','UPDATE public."Home" SET security_state=\'frozen\' WHERE id='+lit(homes[6])+';','CLAIM_REVIEW_DENIED')
 blocked(7,'claim withdrawn','UPDATE public."HomeOwnershipClaim" SET state=\'revoked\',claim_phase_v2=\'withdrawn\',terminal_reason=\'withdrawn_by_user\' WHERE id='+lit(claims[7])+';','CLAIM_NOT_ELIGIBLE')
 blocked(8,'reviewer becomes teen','UPDATE public."HomeOccupancy" SET age_band=\'teen\' WHERE home_id='+lit(homes[8])+';','CLAIM_REVIEW_DENIED')
 w.run('UPDATE public."HomeOccupancy" SET access_end_at=clock_timestamp()+interval \'1 second\' WHERE home_id='+lit(homes[9])+';')
 blocked(9,'reviewer access expires while waiting','','CLAIM_REVIEW_DENIED',delay=1.15)
 snapshot(10);first=result(decision(10));assert first['ok'],first
 w.run('BEGIN; SELECT id FROM public."Home" WHERE id='+lit(homes[10])+' FOR UPDATE; UPDATE public."HomeOwnershipClaim" SET state=\'rejected\',claim_phase_v2=\'rejected\',terminal_reason=\'rejected_review\',challenge_state=\'none\' WHERE id='+lit(claims[10])+';')
 before=projection(10);t,out,errs=concurrent(decision(10));r=finish(t,out,errs)
 assert r['ok'] and r['replayed'] and r['receipt']==first['receipt'] and r['claim']['state']=='rejected' and projection(10)==before,r
 passed('recovery observes later rejection without rewinding it')
 blocked(11,'private bootstrap cannot decide','UPDATE public."HomeOwner" SET owner_status=\'pending\' WHERE home_id='+lit(homes[11])+'; UPDATE public."HomeOccupancy" SET verification_status=\'pending_doc\',verified_at=NULL WHERE home_id='+lit(homes[11])+';','CLAIM_REVIEW_DENIED')
 assert passes==12,passes
 print('PASS: 12 actual relationship decision lock-wait races',flush=True)
finally:
 try:
  l.close();w.run('ROLLBACK;')
  if setup:
   w.run('BEGIN; DELETE FROM public."HomeAuditLog" WHERE home_id IN ('+ids+'); DELETE FROM public."HomePermissionOverride" WHERE home_id IN ('+ids+'); DELETE FROM public."HomeVerificationEvidence" WHERE claim_id IN ('+','.join(map(lit,claims))+'); DELETE FROM public."HomeOwnershipClaim" WHERE home_id IN ('+ids+'); DELETE FROM public."HomeOwner" WHERE home_id IN ('+ids+'); DELETE FROM public."HomeOccupancy" WHERE home_id IN ('+ids+'); DELETE FROM public."Home" WHERE id IN ('+ids+'); DELETE FROM public."User" WHERE id IN ('+users+'); DELETE FROM auth.users WHERE id IN ('+users+'); COMMIT;')
   assert w.run('SELECT (SELECT count(*) FROM auth.users WHERE id IN ('+users+'))+(SELECT count(*) FROM public."User" WHERE id IN ('+users+'))+(SELECT count(*) FROM public."Home" WHERE id IN ('+ids+'));')==['0']
   print('PASS: exact relationship race fixtures cleaned',flush=True)
 finally:w.close();log.close()
