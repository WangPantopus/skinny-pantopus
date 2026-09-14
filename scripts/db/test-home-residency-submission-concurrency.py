#!/usr/bin/env python3
"""Observed lock-wait residency submission recovery in a local disposable Home DB.
Usage: python3 scripts/db/test-home-residency-submission-concurrency.py CONTAINER DATABASE
No provider calls. Synthetic fixtures are exact IDs and fully retired.
"""
import json, os, queue, re, subprocess, sys, tempfile, threading, time
from pathlib import Path
if len(sys.argv)!=3 or not re.fullmatch(r'supabase_db_pantopus-home-[a-z0-9_-]+',sys.argv[1]) or not re.fullmatch(r'postgres|[a-z0-9_]+_contract',sys.argv[2]):
 raise SystemExit('Pass a disposable local pantopus-home Docker container and contract database')
BASE=['docker','exec','-i',sys.argv[1],'psql','-X','-qAt','-U','postgres','-d',sys.argv[2],'-v','ON_ERROR_STOP=1']
os.umask(0o077)
fd, log_name=tempfile.mkstemp(prefix='pantopus-home-residency-submission-concurrency-',suffix='.log')
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
  self.run("SET application_name = 'home_residency_submit_contract_"+name+"'; SET statement_timeout='15s';")
 def run(self, sql):
  self.n+=1; marker='__HOME_RESIDENCY_SUBMIT_DONE_'+self.name+'_'+str(self.n)+'__'
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

def lit(v): return "'"+str(v).replace("'","''")+"'"
def uid(n): return 'ddc24500-0000-4000-8000-'+str(n).zfill(12)
def sql(query):
 r=subprocess.run(BASE,input=query,text=True,capture_output=True)
 if r.returncode: raise RuntimeError(r.stderr)
 return r.stdout.strip()
owner,actor=uid(1),uid(2)
homes=[uid(n) for n in range(101,112)];keys=[uid(n) for n in range(501,512)]
users=','.join(map(lit,[owner,actor]));ids=','.join(map(lit,homes))
root=Path(__file__).resolve().parents[2]
schema=False;setup=False;w=None;l=None;passes=0
ledger=sql('SELECT max(version) FROM supabase_migrations.schema_migrations;')
assert sql('SELECT to_regclass(\'public."HomeResidencySubmissionCommand"\') IS NULL;')=='t'
assert sql('SELECT (SELECT count(*) FROM auth.users WHERE id IN ('+users+'))+(SELECT count(*) FROM public."Home" WHERE id IN ('+ids+'));')=='0'
def call(name,i,role='renter',key=None):
 args=[lit(homes[i]),lit(actor),lit(key or keys[i])]
 if name=='submit_home_residency':args.append(lit(json.dumps({'claimed_role':role,'address':{'line1':'Private submission race','line2':'','city':'Test','state':'WA','postal_code':'98607','country':'US'}})))
 return 'SET ROLE service_role;SELECT public.'+name+'('+','.join(args)+')::text;RESET ROLE;'
def result(command): return json.loads(w.run(command)[0])
def projection(i):
 return sql("SELECT jsonb_build_object('claims',(SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY id),'[]') FROM public.\"HomeResidencyClaim\" r WHERE home_id="+lit(homes[i])+
  "),'occupancies',(SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY id),'[]') FROM public.\"HomeOccupancy\" r WHERE home_id="+lit(homes[i])+
  "),'audit',(SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY id),'[]') FROM public.\"HomeAuditLog\" r WHERE home_id="+lit(homes[i])+
  "),'commands',(SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY request_id),'[]') FROM public.\"HomeResidencySubmissionCommand\" r WHERE home_id="+lit(homes[i])+"));")
def concurrent(command):
 out=[];errors=[]
 def run():
  try:out.extend(l.run(command))
  except Exception as e:errors.append(str(e))
 thread=threading.Thread(target=run);thread.start()
 for _ in range(150):
  if w.run("SELECT count(*) FROM pg_stat_activity WHERE application_name='home_residency_submit_contract_loser' AND wait_event_type='Lock';")==['1']:return thread,out,errors
  time.sleep(.02)
 raise AssertionError('Expected an observed submission lock wait')
def finish(thread,out,errors):
 w.run('COMMIT;');thread.join(12)
 assert not thread.is_alive() and not errors and len(out)==1,str(errors)+str(out)
 return json.loads(out[0])
def passed(label):
 global passes
 passes+=1;print('PASS: '+label+'; actual lock wait and SQL result verified',flush=True)
try:
 sql('BEGIN;'+(root/'supabase/migrations/20260911043000_home_residency_submission.sql').read_text()+'COMMIT;');schema=True
 q='BEGIN;INSERT INTO auth.users(id,email,last_sign_in_at) VALUES '+','.join('('+lit(u)+','+lit('residency-submit-race-'+str(n)+'@example.invalid')+',now())' for n,u in enumerate([owner,actor]))+';'
 q+='INSERT INTO public."User"(id,email,username,name) SELECT id,email,\'residency_submit_race_\'||right(id::text,1),\'Race fixture\' FROM auth.users WHERE id IN ('+users+');'
 for h in homes:
  q+='INSERT INTO public."Home"(id,created_by_user_id,address,city,state,zipcode) VALUES('+lit(h)+','+lit(owner)+",'Private submission race','Test','WA','98607');"
  q+='INSERT INTO public."HomeOwner"(home_id,subject_id,owner_status,is_primary_owner) VALUES('+lit(h)+','+lit(owner)+",'verified',true);"
 sql(q+'COMMIT;');setup=True
 w=Conn('winner');l=Conn('loser')
 w.run('BEGIN;');first=result(call('submit_home_residency',0));assert first['state']=='completed'
 t,out,errors=concurrent(call('submit_home_residency',0));r=finish(t,out,errors)
 assert r==dict(first,replayed=True);p=json.loads(projection(0));assert all(len(p[k])==1 for k in ['claims','occupancies','audit','commands']);passed('same original request commits once')
 w.run('BEGIN;');first=result(call('cancel_home_residency_submission',1));assert first['state']=='cancelled'
 t,out,errors=concurrent(call('submit_home_residency',1));r=finish(t,out,errors);assert r['state']=='cancelled'
 p=json.loads(projection(1));assert all(len(p[k])==0 for k in ['claims','occupancies','audit']);passed('cancellation fences delayed submission')
 w.run('BEGIN;');first=result(call('submit_home_residency',2));t,out,errors=concurrent(call('cancel_home_residency_submission',2));r=finish(t,out,errors)
 assert r=={k:v for k,v in first.items() if k!='replayed'};passed('committed submission wins concurrent cancellation')
 w.run('BEGIN;');first=result(call('submit_home_residency',3));t,out,errors=concurrent(call('submit_home_residency',3,'household'));r=finish(t,out,errors)
 assert r.get('code')=='RESIDENCY_SUBMISSION_CONFLICT';assert json.loads(projection(3))['claims'][0]['claimed_role']=='renter';passed('changed competing intent cannot replace original role')
 w.run('BEGIN;SELECT id FROM public."Home" WHERE id='+lit(homes[4])+' FOR UPDATE;UPDATE public."HomeOwner" SET owner_status=\'revoked\' WHERE home_id='+lit(homes[4])+';')
 t,out,errors=concurrent(call('submit_home_residency',4));r=finish(t,out,errors);assert r['routing']=='external_postcard';passed('authority revocation during wait retires household routing')
 w.run('BEGIN;UPDATE public."Home" SET home_status=\'archived\' WHERE id='+lit(homes[5])+';')
 t,out,errors=concurrent(call('submit_home_residency',5));r=finish(t,out,errors);assert r.get('code')=='RESIDENCY_HOME_UNAVAILABLE'
 p=json.loads(projection(5));assert not p['claims'] and not p['occupancies'];passed('archival during wait rejects without partial admission')
 sql('INSERT INTO public."HomeOccupancy"(home_id,user_id,role,role_base,verification_status) VALUES('+lit(homes[6])+','+lit(actor)+",'member','restricted_member','pending_approval');")
 w.run('BEGIN;SELECT id FROM public."Home" WHERE id='+lit(homes[6])+' FOR UPDATE;UPDATE public."HomeOccupancy" SET is_active=false WHERE home_id='+lit(homes[6])+';')
 t,out,errors=concurrent(call('submit_home_residency',6));r=finish(t,out,errors);assert r.get('code')=='MEMBERSHIP_RENEWAL_REQUIRED';assert json.loads(projection(6))['occupancies'][0]['is_active'] is False;passed('removal during wait cannot be reactivated')
 sql('INSERT INTO public."HomeOccupancy"(home_id,user_id,role,role_base,verification_status,access_end_at) VALUES('+lit(homes[7])+','+lit(owner)+",'owner','owner','verified',clock_timestamp()+interval '2 seconds');")
 w.run('BEGIN;SELECT id FROM public."Home" WHERE id='+lit(homes[7])+' FOR UPDATE;');t,out,errors=concurrent(call('submit_home_residency',7));time.sleep(2.3);r=finish(t,out,errors)
 assert r['routing']=='external_postcard';passed('authority expiry uses the clock after the lock wait')
 w.run('BEGIN;');result(call('submit_home_residency',8));t,out,errors=concurrent(call('submit_home_residency',8,key=uid(999)));r=finish(t,out,errors)
 p=json.loads(projection(8));assert r['state']=='completed' and len(p['claims'])==1 and len(p['occupancies'])==1 and len(p['commands'])==2;passed('different explicit commands share one unchanged pending application')
 for i,column,value in [(9,'address2','Unit 2'),(10,'address','Different submission street')]:
  w.run('BEGIN;UPDATE public."Home" SET '+column+'='+lit(value)+' WHERE id='+lit(homes[i])+';')
  t,out,errors=concurrent(call('submit_home_residency',i));r=finish(t,out,errors)
  p=json.loads(projection(i));assert r.get('code')=='RESIDENCY_ADDRESS_CHANGED' and not p['claims'] and not p['occupancies'];passed(column+' change during wait cannot redirect the selected Home')
 print('PASS:',passes,'observed submission races',flush=True)
finally:
 if w:w.close()
 if l:l.close()
 if setup:
  sql('BEGIN;DELETE FROM public."HomeAuditLog" WHERE home_id IN ('+ids+');DELETE FROM public."HomePermissionOverride" WHERE home_id IN ('+ids+');DELETE FROM public."HomeResidencyClaim" WHERE home_id IN ('+ids+');DELETE FROM public."HomeOccupancy" WHERE home_id IN ('+ids+');DELETE FROM public."HomeOwner" WHERE home_id IN ('+ids+');DELETE FROM public."Home" WHERE id IN ('+ids+');DELETE FROM public."User" WHERE id IN ('+users+');DELETE FROM auth.users WHERE id IN ('+users+');COMMIT;')
  assert sql('SELECT (SELECT count(*) FROM auth.users WHERE id IN ('+users+'))+(SELECT count(*) FROM public."Home" WHERE id IN ('+ids+'));')=='0'
 if schema:
  sql('BEGIN;DROP FUNCTION public.get_home_residency_submission(uuid,uuid,uuid);DROP FUNCTION public.cancel_home_residency_submission(uuid,uuid,uuid);DROP FUNCTION public.submit_home_residency(uuid,uuid,uuid,jsonb);DROP FUNCTION public.home_residency_submission_projection(public."HomeResidencySubmissionCommand");DROP TABLE public."HomeResidencySubmissionCommand";COMMIT;')
  assert sql('SELECT max(version) FROM supabase_migrations.schema_migrations;')==ledger
  print('PASS: exact race fixtures and temporary schema cleaned; ledger preserved',flush=True)
 log.close()
