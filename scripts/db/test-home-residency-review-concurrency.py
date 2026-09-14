#!/usr/bin/env python3
"""Observed lock-wait residency review regressions in a local disposable Home DB.
Usage: python3 scripts/db/test-home-residency-review-concurrency.py CONTAINER DATABASE
No provider calls. Synthetic fixtures are exact IDs and fully retired.
"""
import json, os, queue, re, subprocess, sys, tempfile, threading, time
from pathlib import Path
if len(sys.argv)!=3 or not re.fullmatch(r'supabase_db_pantopus-home-[a-z0-9_-]+',sys.argv[1]) or not re.fullmatch(r'postgres|[a-z0-9_]+_contract',sys.argv[2]):
 raise SystemExit('Pass a disposable local pantopus-home Docker container and contract database')
BASE=['docker','exec','-i',sys.argv[1],'psql','-X','-qAt','-U','postgres','-d',sys.argv[2],'-v','ON_ERROR_STOP=1']
os.umask(0o077)
fd, log_name=tempfile.mkstemp(prefix='pantopus-home-residency-review-concurrency-',suffix='.log')
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
  self.run("SET application_name = 'home_residency_review_contract_"+name+"'; SET statement_timeout='15s';")
 def run(self, sql):
  self.n+=1; marker='__HOME_RESIDENCY_REVIEW_DONE_'+self.name+'_'+str(self.n)+'__'
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
def uid(n):return 'ddc23700-0000-4000-8000-'+str(n).zfill(12)
actor,target=uid(1),uid(2)
homes=[uid(n) for n in range(101,114)];claims=[uid(n) for n in range(201,214)]
users=','.join(map(lit,[actor,target]));ids=','.join(map(lit,homes))
w=Conn('winner');l=Conn('loser');setup=False;tokens={};passes=0

def decision(i,action='approve'):
 args=[homes[i],claims[i],actor,action,'member' if action=='approve' else None,None,uid(501+i),tokens[i]]
 return 'SET ROLE service_role; SELECT public.decide_home_residency_review('+','.join(map(lit,args))+')::text; RESET ROLE;'
def result(sql):
 out=w.run(sql);assert len(out)==1,out;return json.loads(out[0])
def snapshot(i):
 tokens[i]=w.run('SELECT public.home_residency_review_snapshot(c) FROM public."HomeResidencyClaim" c WHERE id='+lit(claims[i])+';')[0]
def projection(i):
 q="SELECT jsonb_build_object('home',(SELECT to_jsonb(h) FROM public.\"Home\" h WHERE id="+lit(homes[i])+')'
 for key,table in [('claim','HomeResidencyClaim'),('occupancy','HomeOccupancy'),('owner','HomeOwner'),('receipt','HomeResidencyReviewReceipt'),('audit','HomeAuditLog')]:
  q+=','+lit(key)+',(SELECT jsonb_agg(to_jsonb(r) ORDER BY id) FROM public."'+table+'" r WHERE home_id='+lit(homes[i])+')'
 q+=",'overrides',(SELECT jsonb_agg(to_jsonb(o) ORDER BY user_id,permission) FROM public.\"HomePermissionOverride\" o WHERE home_id="+lit(homes[i])+'))::text;'
 return w.run(q)
def wait_lock():
 for _ in range(100):
  if w.run("SELECT count(*) FROM pg_stat_activity WHERE application_name='home_residency_review_contract_loser' AND wait_event_type='Lock';")==['1']:return
  time.sleep(.02)
 raise AssertionError('No observed residency review lock wait')
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
 q='BEGIN; INSERT INTO auth.users(id,email,email_confirmed_at) VALUES '+','.join('('+lit(u)+','+lit('residency-race-'+str(n)+'@example.invalid')+',now())' for n,u in enumerate([actor,target]))+';'
 q+=' INSERT INTO public."User"(id,email,username,role) SELECT id,email,\'residency_race_\'||right(id::text,1),\'user\' FROM auth.users WHERE id IN ('+users+');'
 for i,h in enumerate(homes):
  q+=' INSERT INTO public."Home"(id,owner_id,address,city,state,zipcode) VALUES ('+lit(h)+','+lit(actor)+",'Synthetic residency race','Test','WA','98607');"
  q+=' INSERT INTO public."HomeOwner"(home_id,subject_id,owner_status,is_primary_owner) VALUES ('+lit(h)+','+lit(actor)+",'verified',true);"
  q+=' INSERT INTO public."HomeOccupancy"(home_id,user_id,role,role_base,age_band,verification_status) VALUES ('+lit(h)+','+lit(actor)+",'owner','owner','adult','verified'),("+lit(h)+','+lit(target)+",'member','member','adult','pending_doc');"
  q+=' INSERT INTO public."HomeResidencyClaim"(id,home_id,user_id,claimed_address,claimed_role) VALUES ('+lit(claims[i])+','+lit(h)+','+lit(target)+",'Synthetic residency race','member');"
 setup=True;w.run(q+'COMMIT;')
 snapshot(0);w.run('BEGIN;');first=result(decision(0));assert first['ok'],first
 before=projection(0);t,out,errs=concurrent(decision(0));r=finish(t,out,errs)
 assert r==dict(first,replayed=True) and projection(0)==before,r;passed('duplicate approval returns one receipt and audit')
 snapshot(1);w.run('BEGIN;');assert result(decision(1,'reject'))['ok']
 before=projection(1);t,out,errs=concurrent(decision(1));r=finish(t,out,errs)
 assert r.get('code')=='RESIDENCY_REVIEW_REQUEST_CHANGED' and projection(1)==before,r;passed('competing changed intent cannot replace original rejection')
 blocked(2,'reviewer revoked','UPDATE public."HomeOccupancy" SET is_active=false WHERE home_id='+lit(homes[2])+' AND user_id='+lit(actor)+';','MEMBERS_MANAGE_REQUIRED')
 blocked(3,'ownership proof revoked','UPDATE public."HomeOwner" SET owner_status=\'revoked\' WHERE home_id='+lit(homes[3])+';','MEMBERS_MANAGE_REQUIRED')
 blocked(4,'explicit membership deny','INSERT INTO public."HomePermissionOverride"(home_id,user_id,permission,allowed) VALUES ('+lit(homes[4])+','+lit(actor)+",'members.manage',false);",'MEMBERS_MANAGE_REQUIRED')
 blocked(5,'target restriction changed','UPDATE public."HomeOccupancy" SET access_end_at=clock_timestamp()+interval \'1 day\' WHERE home_id='+lit(homes[5])+' AND user_id='+lit(target)+';','RESIDENCY_REVIEW_CHANGED')
 blocked(6,'Home frozen','UPDATE public."Home" SET security_state=\'frozen\' WHERE id='+lit(homes[6])+';','MEMBERS_MANAGE_REQUIRED')
 blocked(7,'claim resubmission changed','UPDATE public."HomeResidencyClaim" SET updated_at=clock_timestamp(),claimed_address=\'New residency details\' WHERE id='+lit(claims[7])+';','RESIDENCY_REVIEW_CHANGED')
 blocked(8,'reviewer becomes teen','UPDATE public."HomeOccupancy" SET age_band=\'teen\' WHERE home_id='+lit(homes[8])+' AND user_id='+lit(actor)+';','MEMBERS_MANAGE_REQUIRED')
 w.run('UPDATE public."HomeOccupancy" SET access_end_at=clock_timestamp()+interval \'1 second\' WHERE home_id='+lit(homes[9])+' AND user_id='+lit(actor)+';')
 blocked(9,'reviewer access expires while waiting','','MEMBERS_MANAGE_REQUIRED',delay=1.15)
 snapshot(10);first=result(decision(10));assert first['ok'],first
 w.run('BEGIN; SELECT id FROM public."Home" WHERE id='+lit(homes[10])+' FOR UPDATE; UPDATE public."HomeOccupancy" SET is_active=false,verification_status=\'moved_out\' WHERE home_id='+lit(homes[10])+' AND user_id='+lit(target)+';')
 before=projection(10);t,out,errs=concurrent(decision(10));r=finish(t,out,errs)
 assert r['ok'] and r['replayed'] and r['receipt']==first['receipt'] and r['occupancy']['is_active'] is False and projection(10)==before,r
 passed('approval recovery observes later move-out without reactivation')
 blocked(11,'target becomes an owner','INSERT INTO public."HomeOwner"(home_id,subject_id,owner_status,is_primary_owner) VALUES ('+lit(homes[11])+','+lit(target)+",'verified',false);",'OWNERSHIP_FLOW_REQUIRED')
 blocked(12,'target explicit restriction changes','INSERT INTO public."HomePermissionOverride"(home_id,user_id,permission,allowed) VALUES ('+lit(homes[12])+','+lit(target)+",'tasks.edit',false);",'RESIDENCY_REVIEW_CHANGED')
 assert passes==13,passes
 print('PASS: 13 actual residency review lock-wait races',flush=True)
finally:
 try:
  l.close();w.run('ROLLBACK;')
  if setup:
   w.run('BEGIN; DELETE FROM public."HomeAuditLog" WHERE home_id IN ('+ids+'); DELETE FROM public."HomePermissionOverride" WHERE home_id IN ('+ids+'); DELETE FROM public."HomeResidencyClaim" WHERE home_id IN ('+ids+'); DELETE FROM public."HomeOwner" WHERE home_id IN ('+ids+'); DELETE FROM public."HomeOccupancy" WHERE home_id IN ('+ids+'); DELETE FROM public."Home" WHERE id IN ('+ids+'); DELETE FROM public."User" WHERE id IN ('+users+'); DELETE FROM auth.users WHERE id IN ('+users+'); COMMIT;')
   assert w.run('SELECT (SELECT count(*) FROM auth.users WHERE id IN ('+users+'))+(SELECT count(*) FROM public."User" WHERE id IN ('+users+'))+(SELECT count(*) FROM public."Home" WHERE id IN ('+ids+'));')==['0']
   print('PASS: exact residency race fixtures cleaned',flush=True)
 finally:w.close();log.close()
