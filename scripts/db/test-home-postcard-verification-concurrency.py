#!/usr/bin/env python3
"""Observed lock-wait postal verification/promotion recovery in a local disposable Home DB.
Usage: python3 scripts/db/test-home-postcard-verification-concurrency.py CONTAINER DATABASE
No provider calls. Synthetic fixtures are exact IDs and fully retired.
"""
import json, os, queue, re, subprocess, sys, tempfile, threading, time
from pathlib import Path
if len(sys.argv)!=3 or not re.fullmatch(r'supabase_db_pantopus-home-[a-z0-9_-]+',sys.argv[1]) or not re.fullmatch(r'postgres|[a-z0-9_]+_contract',sys.argv[2]):
 raise SystemExit('Pass a disposable local pantopus-home Docker container and contract database')
BASE=['docker','exec','-i',sys.argv[1],'psql','-X','-qAt','-U','postgres','-d',sys.argv[2],'-v','ON_ERROR_STOP=1']
os.umask(0o077)
fd, log_name=tempfile.mkstemp(prefix='pantopus-home-postcard-verification-concurrency-',suffix='.log')
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
  self.run("SET application_name = 'home_postcard_verify_contract_"+name+"'; SET statement_timeout='15s';")
 def run(self, sql):
  self.n+=1; marker='__HOME_POSTCARD_VERIFY_DONE_'+self.name+'_'+str(self.n)+'__'
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
def uid(n): return 'ddc25000-0000-4000-8000-'+str(n).zfill(12)
def sql(query):
 r=subprocess.run(BASE,input=query,text=True,capture_output=True)
 if r.returncode: raise RuntimeError(r.stderr)
 return r.stdout.strip()
owner,actor=uid(1),uid(2)
homes=[uid(n) for n in range(101,116)];keys=[uid(n) for n in range(501,516)];cards=[uid(n) for n in range(701,716)];occupancies=[uid(n) for n in range(901,916)]
users=','.join(map(lit,[owner,actor]));ids=','.join(map(lit,homes))
root=Path(__file__).resolve().parents[2]
schema=False;setup=False;w=None;l=None;passes=0
ledger=sql('SELECT max(version) FROM supabase_migrations.schema_migrations;')
review_definition_query="SELECT pg_get_functiondef('public.review_home_residency(uuid,uuid,text,jsonb,integer)'::regprocedure);"
review_properties_query="SELECT json_build_object('oid',oid,'owner',proowner,'acl',proacl,'config',proconfig) FROM pg_proc WHERE oid='public.review_home_residency(uuid,uuid,text,jsonb,integer)'::regprocedure;"
original_review=sql(review_definition_query)
original_review_properties=sql(review_properties_query)
# Private executable recovery copies precede every schema mutation.
with open(log_name+'.review-before.sql','x') as backup:backup.write(original_review+';\n')
with open(log_name+'.review-before-properties.json','x') as backup:backup.write(original_review_properties)
functions=['lock_home_postcard_current_scope','home_postcard_current_context','home_postcard_request_projection','get_home_postcard_request','cancel_home_postcard_request','valid_home_postcard_address','home_postcard_request_work','begin_home_postcard_request','home_postcard_confirmed_address','get_home_postcard_current_status','claim_home_postcard_current_dispatch','record_home_postcard_current_dispatch','home_postcard_verification_projection','get_home_postcard_verification','cancel_home_postcard_verification','home_postcard_verified_policy','verify_home_postcard_current','promote_home_postcard_review','challenge_home_postcard_review']
names=','.join(map(lit,functions))
assert sql('SELECT to_regclass(\'public."HomePostcardRequestCommand"\') IS NULL AND to_regclass(\'public."HomePostcardVerificationCommand"\') IS NULL;')=='t'
assert sql("SELECT count(*) FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN ("+names+");")=='0'
assert sql('SELECT (SELECT count(*) FROM auth.users WHERE id IN ('+users+'))+(SELECT count(*) FROM public."Home" WHERE id IN ('+ids+'));')=='0'
def call(name,i,key=None,digest='a'):
 if name=='challenge_home_postcard_review':args=[lit(homes[i]),lit(owner),lit(occupancies[i])]
 elif name=='promote_home_postcard_review':args=[lit(homes[i]),lit(actor),lit(occupancies[i]),'365']
 else:
  args=[lit(homes[i]),lit(actor),lit(cards[i]),lit(key or keys[i])]
  if name=='verify_home_postcard_current':args.extend([lit(digest*64),'365'])
 return 'SET ROLE service_role;SELECT public.'+name+'('+','.join(args)+')::text;RESET ROLE;'
def result(command):return json.loads(w.run(command)[0])
def concurrent(command):
 out=[];errors=[]
 def run():
  try:out.extend(l.run(command))
  except Exception as e:errors.append(str(e))
 thread=threading.Thread(target=run);thread.start()
 for _ in range(150):
  if w.run("SELECT count(*) FROM pg_stat_activity WHERE application_name='home_postcard_verify_contract_loser' AND wait_event_type='Lock';")==['1']:return thread,out,errors
  time.sleep(.02)
 raise AssertionError('Expected an observed verification lock wait')
def finish(thread,out,errors):
 w.run('COMMIT;');thread.join(12)
 assert not thread.is_alive() and not errors and len(out)==1,str(errors)+str(out)
 return json.loads(out[0])
def passed(label):
 global passes
 passes+=1;print('PASS: '+label+'; actual lock wait and SQL result verified',flush=True)
def attempts(i):return sql('SELECT attempts FROM public."HomePostcardCode" WHERE id='+lit(cards[i])+';')
def prepare_promotion(i):
 r=result(call('verify_home_postcard_current',i));assert r['state']=='completed' and r['verification_status']=='provisional',r
 sql('UPDATE public."HomeOccupancy" SET challenge_window_started_at=clock_timestamp()-interval \'8 days\',challenge_window_ends_at=clock_timestamp()-interval \'1 day\' WHERE id='+lit(occupancies[i])+';UPDATE public."HomePostcardCode" SET verified_at=clock_timestamp()-interval \'7 days\' WHERE id='+lit(cards[i])+';')
try:
 sql('BEGIN;'+(root/'supabase/migrations/20260911050000_home_postcard_current_recovery.sql').read_text()+(root/'supabase/migrations/20260912010000_home_postcard_verification_recovery.sql').read_text()+'COMMIT;');schema=True
 q='BEGIN;INSERT INTO auth.users(id,email) VALUES '+','.join('('+lit(u)+','+lit('postcard-verify-race-'+str(n)+'@example.invalid')+')' for n,u in enumerate([owner,actor]))+';'
 q+='INSERT INTO public."User"(id,email,username,name) SELECT id,email,\'postcard_verify_race_\'||right(id::text,1),\'Race fixture\' FROM auth.users WHERE id IN ('+users+');'
 for i,h in enumerate(homes):
  q+='INSERT INTO public."Home"(id,created_by_user_id,address,address2,city,state,zipcode) VALUES('+lit(h)+','+lit(owner)+",'Postal race fixture','602','Test','WA','98607');"
  q+='INSERT INTO public."HomeOwner"(home_id,subject_id,owner_status,is_primary_owner) VALUES('+lit(h)+','+lit(owner)+",'verified',true);"
  q+='INSERT INTO public."HomeOccupancy"(id,home_id,user_id,role,role_base,verification_status) VALUES('+lit(occupancies[i])+','+lit(h)+','+lit(actor)+",'member','restricted_member','pending_postcard');"
  q+='INSERT INTO public."HomeResidencyClaim"(home_id,user_id,claimed_address,claimed_role) VALUES('+lit(h)+','+lit(actor)+",'Postal race fixture, 602','renter');"
  q+='INSERT INTO public."HomePostcardCode"(id,home_id,user_id,code_hash,dispatch_status,destination) VALUES('+lit(cards[i])+','+lit(h)+','+lit(actor)+','+lit('a'*64)+",'delivery_unknown',"+lit(json.dumps({'address':'Postal race fixture','address2':'602','city':'Test','state':'WA','zipcode':'98607'}))+');'
 sql(q+'COMMIT;');setup=True
 w=Conn('winner');l=Conn('loser')
 w.run('BEGIN;');first=result(call('verify_home_postcard_current',0));t,out,errors=concurrent(call('verify_home_postcard_current',0));r=finish(t,out,errors)
 assert r==dict(first,replayed=True) and attempts(0)=='1';passed('same successful attempt verifies once')
 w.run('BEGIN;');first=result(call('verify_home_postcard_current',1,digest='b'));t,out,errors=concurrent(call('verify_home_postcard_current',1,digest='b'));r=finish(t,out,errors)
 assert r==dict(first,replayed=True) and attempts(1)=='1';passed('same incorrect attempt consumes one guess')
 w.run('BEGIN;');result(call('cancel_home_postcard_verification',2));t,out,errors=concurrent(call('verify_home_postcard_current',2));r=finish(t,out,errors)
 assert r['state']=='cancelled' and attempts(2)=='0';passed('cancellation fences a delayed code attempt')
 w.run('BEGIN;');result(call('verify_home_postcard_current',3));t,out,errors=concurrent(call('cancel_home_postcard_verification',3));r=finish(t,out,errors)
 assert r['state']=='completed' and attempts(3)=='1';passed('recorded verification wins concurrent cancellation')
 w.run('BEGIN;');result(call('verify_home_postcard_current',4));t,out,errors=concurrent(call('verify_home_postcard_current',4,key=uid(1504),digest='b'));r=finish(t,out,errors)
 assert r['code']=='POSTCARD_NO_LONGER_AVAILABLE' and attempts(4)=='1';passed('late incorrect attempt cannot alter verified proof')
 w.run('BEGIN;UPDATE public."Home" SET home_status=\'archived\' WHERE id='+lit(homes[5])+';')
 t,out,errors=concurrent(call('verify_home_postcard_current',5));r=finish(t,out,errors)
 assert r['code']=='POSTCARD_HOME_UNAVAILABLE' and attempts(5)=='0';passed('archival during lock wait blocks code admission')
 w.run('BEGIN;SELECT id FROM public."Home" WHERE id='+lit(homes[6])+' FOR UPDATE;UPDATE public."HomeOccupancy" SET start_at=clock_timestamp()+interval \'1 day\' WHERE id='+lit(occupancies[6])+';')
 t,out,errors=concurrent(call('verify_home_postcard_current',6));r=finish(t,out,errors)
 assert r['code']=='POSTCARD_ACCESS_REVIEW_REQUIRED' and attempts(6)=='0';passed('future schedule during wait blocks code admission')
 sql('UPDATE public."HomeOccupancy" SET access_end_at=clock_timestamp()+interval \'2 seconds\' WHERE id='+lit(occupancies[7])+';')
 w.run('BEGIN;SELECT id FROM public."Home" WHERE id='+lit(homes[7])+' FOR UPDATE;')
 t,out,errors=concurrent(call('verify_home_postcard_current',7));time.sleep(2.3);r=finish(t,out,errors)
 assert r['code']=='POSTCARD_ACCESS_REVIEW_REQUIRED' and attempts(7)=='0';passed('access expiry is checked after the wait')
 w.run('BEGIN;SELECT id FROM public."Home" WHERE id='+lit(homes[8])+' FOR UPDATE;UPDATE public."HomeResidencyClaim" SET status=\'rejected\' WHERE home_id='+lit(homes[8])+';')
 t,out,errors=concurrent(call('verify_home_postcard_current',8));r=finish(t,out,errors)
 assert r['code']=='POSTCARD_ACCESS_REVIEW_REQUIRED' and attempts(8)=='0';passed('household rejection during wait blocks code admission')
 sql('UPDATE public."HomePostcardCode" SET attempts=4 WHERE id='+lit(cards[9])+';')
 w.run('BEGIN;');first=result(call('verify_home_postcard_current',9,digest='b'));assert first['attempts_remaining']==0
 t,out,errors=concurrent(call('verify_home_postcard_current',9,key=uid(1509)));r=finish(t,out,errors)
 assert r['code']=='POSTCARD_LOCKED' and attempts(9)=='5';passed('fifth incorrect guess fences a concurrent correct attempt')
 w.run('BEGIN;UPDATE public."Home" SET address2=\'999\' WHERE id='+lit(homes[10])+';')
 t,out,errors=concurrent(call('verify_home_postcard_current',10));r=finish(t,out,errors)
 assert r['code']=='POSTCARD_ADDRESS_CHANGED' and attempts(10)=='0';passed('changed apartment cannot admit the previous mail code')
 prepare_promotion(11);w.run('BEGIN;SELECT id FROM public."Home" WHERE id='+lit(homes[11])+' FOR UPDATE;UPDATE public."HomeOccupancy" SET is_active=false WHERE id='+lit(occupancies[11])+';')
 t,out,errors=concurrent(call('promote_home_postcard_review',11));r=finish(t,out,errors)
 assert r['code']=='POSTCARD_ACCESS_REVIEW_REQUIRED';passed('removal after candidate read cannot be promoted')
 prepare_promotion(12);w.run('BEGIN;');first=result(call('promote_home_postcard_review',12));assert first['promoted'] is True
 t,out,errors=concurrent(call('promote_home_postcard_review',12));r=finish(t,out,errors)
 assert r['promoted'] is False;passed('concurrent workers promote one review once')
 w.run('BEGIN;SELECT id FROM public."Home" WHERE id='+lit(homes[12])+' FOR UPDATE;');t,out,errors=concurrent(call('challenge_home_postcard_review',12));r=finish(t,out,errors)
 assert r['code']=='POSTCARD_REVIEW_CHANGED';passed('delayed challenge cannot suspend completed promotion')
 prepare_promotion(13);w.run('BEGIN;SELECT id FROM public."Home" WHERE id='+lit(homes[13])+' FOR UPDATE;UPDATE public."HomeOccupancy" SET verification_status=\'verified\',verified_at=clock_timestamp()-interval \'1 day\',verification_expires_at=clock_timestamp()+interval \'10 days\' WHERE id='+lit(occupancies[13])+';')
 saved=w.run('SELECT to_jsonb(o)::text FROM public."HomeOccupancy" o WHERE id='+lit(occupancies[13])+';')[0]
 t,out,errors=concurrent(call('promote_home_postcard_review',13));r=finish(t,out,errors)
 assert r['promoted'] is False and sql('SELECT to_jsonb(o)::text FROM public."HomeOccupancy" o WHERE id='+lit(occupancies[13])+';')==saved;passed('independent admission is not renewed by the delayed worker')
 prepare_promotion(14);sql('UPDATE public."HomeOccupancy" SET challenge_window_started_at=clock_timestamp()-interval \'1 day\',challenge_window_ends_at=clock_timestamp()+interval \'6 days\' WHERE id='+lit(occupancies[14])+';');w.run('BEGIN;');assert result(call('challenge_home_postcard_review',14))['challenged'] is True
 t,out,errors=concurrent(call('promote_home_postcard_review',14));r=finish(t,out,errors)
 assert r['promoted'] is False;passed('completed household challenge is not undone by a delayed promotion')
 print('PASS:',passes,'observed verification/promotion races',flush=True)
finally:
 if w:w.close()
 if l:l.close()
 if setup:
  sql('BEGIN;DELETE FROM public."HomePostcardVerificationCommand" WHERE home_id IN ('+ids+');DELETE FROM public."HomePostcardRequestCommand" WHERE home_id IN ('+ids+');DELETE FROM public."HomeAuditLog" WHERE home_id IN ('+ids+');DELETE FROM public."HomeResidencyClaim" WHERE home_id IN ('+ids+');DELETE FROM public."HomeOccupancy" WHERE home_id IN ('+ids+');DELETE FROM public."HomeOwner" WHERE home_id IN ('+ids+');DELETE FROM public."Home" WHERE id IN ('+ids+');DELETE FROM public."User" WHERE id IN ('+users+');DELETE FROM auth.users WHERE id IN ('+users+');COMMIT;')
  assert sql('SELECT (SELECT count(*) FROM auth.users WHERE id IN ('+users+'))+(SELECT count(*) FROM public."Home" WHERE id IN ('+ids+'));')=='0'
 if schema:
  drops=sql("SELECT 'DROP FUNCTION '||oid::regprocedure::text||';' FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN ("+names+") ORDER BY oid DESC;")
  sql('BEGIN;'+original_review+';\n'+drops+'DROP TABLE public."HomePostcardVerificationCommand";DROP TABLE public."HomePostcardRequestCommand";COMMIT;')
  assert sql('SELECT max(version) FROM supabase_migrations.schema_migrations;')==ledger
  assert sql(review_definition_query)==original_review
  assert sql(review_properties_query)==original_review_properties
  print('PASS: exact race fixtures and temporary schema cleaned; original review definition and ledger preserved',flush=True)
 log.close()
