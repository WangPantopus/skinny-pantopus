#!/usr/bin/env python3
"""Observed lock-wait postal admission/dispatch recovery in a local disposable Home DB.
Usage: python3 scripts/db/test-home-postcard-request-concurrency.py CONTAINER DATABASE
No provider calls. Synthetic fixtures are exact IDs and fully retired.
"""
import json, os, queue, re, subprocess, sys, tempfile, threading, time
from pathlib import Path
if len(sys.argv)!=3 or not re.fullmatch(r'supabase_db_pantopus-home-[a-z0-9_-]+',sys.argv[1]) or not re.fullmatch(r'postgres|[a-z0-9_]+_contract',sys.argv[2]):
 raise SystemExit('Pass a disposable local pantopus-home Docker container and contract database')
BASE=['docker','exec','-i',sys.argv[1],'psql','-X','-qAt','-U','postgres','-d',sys.argv[2],'-v','ON_ERROR_STOP=1']
os.umask(0o077)
fd, log_name=tempfile.mkstemp(prefix='pantopus-home-postcard-request-concurrency-',suffix='.log')
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
  self.run("SET application_name = 'home_postcard_request_contract_"+name+"'; SET statement_timeout='15s';")
 def run(self, sql):
  self.n+=1; marker='__HOME_POSTCARD_REQUEST_DONE_'+self.name+'_'+str(self.n)+'__'
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
def uid(n): return 'ddc24800-0000-4000-8000-'+str(n).zfill(12)
def sql(query):
 r=subprocess.run(BASE,input=query,text=True,capture_output=True)
 if r.returncode: raise RuntimeError(r.stderr)
 return r.stdout.strip()
owner,actor=uid(1),uid(2)
homes=[uid(n) for n in range(101,112)];keys=[uid(n) for n in range(501,512)];cards=[uid(n) for n in range(701,712)]
users=','.join(map(lit,[owner,actor]));ids=','.join(map(lit,homes))
root=Path(__file__).resolve().parents[2]
schema=False;setup=False;w=None;l=None;passes=0
ledger=sql('SELECT max(version) FROM supabase_migrations.schema_migrations;')
functions=['lock_home_postcard_current_scope','home_postcard_current_context','home_postcard_request_projection','get_home_postcard_request','cancel_home_postcard_request','valid_home_postcard_address','home_postcard_request_work','begin_home_postcard_request','home_postcard_confirmed_address','get_home_postcard_current_status','claim_home_postcard_current_dispatch','record_home_postcard_current_dispatch']
names=','.join(map(lit,functions))
assert sql('SELECT to_regclass(\'public."HomePostcardRequestCommand"\') IS NULL;')=='t'
assert sql("SELECT count(*) FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN ("+names+");")=='0'
assert sql('SELECT (SELECT count(*) FROM auth.users WHERE id IN ('+users+'))+(SELECT count(*) FROM public."Home" WHERE id IN ('+ids+'));')=='0'
def call(name,i,key=None,unit='602'):
 args=[lit(homes[i]),lit(actor),lit(key or keys[i])]
 if name=='begin_home_postcard_request':
  args.extend([lit(json.dumps({'line1':'Postal race fixture','line2':unit,'city':'Test','state':'WA','postal_code':'98607','country':'US'})),lit(cards[i]),lit('a'*64),lit('fixture')])
 if name=='claim_home_postcard_current_dispatch':args.extend([lit(cards[i]),lit('a'*64)])
 return 'SET ROLE service_role;SELECT public.'+name+'('+','.join(args)+')::text;RESET ROLE;'
def result(command):return json.loads(w.run(command)[0])
def concurrent(command):
 out=[];errors=[]
 def run():
  try:out.extend(l.run(command))
  except Exception as e:errors.append(str(e))
 thread=threading.Thread(target=run);thread.start()
 for _ in range(150):
  if w.run("SELECT count(*) FROM pg_stat_activity WHERE application_name='home_postcard_request_contract_loser' AND wait_event_type='Lock';")==['1']:return thread,out,errors
  time.sleep(.02)
 raise AssertionError('Expected an observed postal lock wait')
def finish(thread,out,errors):
 w.run('COMMIT;');thread.join(12)
 assert not thread.is_alive() and not errors and len(out)==1,str(errors)+str(out)
 return json.loads(out[0])
def passed(label):
 global passes
 passes+=1;print('PASS: '+label+'; actual lock wait and SQL result verified',flush=True)
def admit(i):
 # Synthetic aging isolates concurrency from the independent three-per-hour limit.
 sql('UPDATE public."HomePostcardCode" SET requested_at=clock_timestamp()-interval \'2 hours\' WHERE user_id='+lit(actor)+';')
 r=result(call('begin_home_postcard_request',i));assert r['state']=='completed',r
 return r
try:
 sql('BEGIN;'+(root/'supabase/migrations/20260911050000_home_postcard_current_recovery.sql').read_text()+'COMMIT;');schema=True
 q='BEGIN;INSERT INTO auth.users(id,email) VALUES '+','.join('('+lit(u)+','+lit('postcard-race-'+str(n)+'@example.invalid')+')' for n,u in enumerate([owner,actor]))+';'
 q+='INSERT INTO public."User"(id,email,username,name) SELECT id,email,\'postcard_race_\'||right(id::text,1),\'Race fixture\' FROM auth.users WHERE id IN ('+users+');'
 for h in homes:
  q+='INSERT INTO public."Home"(id,created_by_user_id,address,address2,city,state,zipcode) VALUES('+lit(h)+','+lit(owner)+",'Postal race fixture','602','Test','WA','98607');"
  q+='INSERT INTO public."HomeOwner"(home_id,subject_id,owner_status,is_primary_owner) VALUES('+lit(h)+','+lit(owner)+",'verified',true);"
  q+='INSERT INTO public."HomeOccupancy"(home_id,user_id,role,role_base,verification_status) VALUES('+lit(h)+','+lit(actor)+",'member','restricted_member','pending_postcard');"
  q+='INSERT INTO public."HomeResidencyClaim"(home_id,user_id,claimed_address,claimed_role) VALUES('+lit(h)+','+lit(actor)+",'Postal race fixture, 602','renter');"
 sql(q+'COMMIT;');setup=True
 w=Conn('winner');l=Conn('loser')
 w.run('BEGIN;');first=admit(0);t,out,errors=concurrent(call('begin_home_postcard_request',0));r=finish(t,out,errors)
 assert r==dict(first,replayed=True);assert sql('SELECT count(*) FROM public."HomePostcardCode" WHERE home_id='+lit(homes[0])+';')=='1';passed('same original request admits once')
 w.run('BEGIN;');result(call('cancel_home_postcard_request',1));t,out,errors=concurrent(call('begin_home_postcard_request',1));r=finish(t,out,errors)
 assert r['state']=='cancelled';assert sql('SELECT count(*) FROM public."HomePostcardCode" WHERE home_id='+lit(homes[1])+';')=='0';passed('cancellation fences delayed admission')
 admit(2);w.run('BEGIN;');first=result(call('claim_home_postcard_current_dispatch',2));assert first['claimed']
 t,out,errors=concurrent(call('claim_home_postcard_current_dispatch',2));r=finish(t,out,errors);assert r['claimed'] is False;passed('only one concurrent worker obtains dispatch permission')
 admit(3);w.run('BEGIN;UPDATE public."Home" SET address2=\'999\' WHERE id='+lit(homes[3])+';')
 t,out,errors=concurrent(call('claim_home_postcard_current_dispatch',3));r=finish(t,out,errors)
 assert r['code']=='POSTCARD_ADDRESS_CHANGED';passed('changed apartment during lock wait cannot redirect dispatch')
 admit(4);w.run('BEGIN;UPDATE public."Home" SET home_status=\'archived\' WHERE id='+lit(homes[4])+';')
 t,out,errors=concurrent(call('claim_home_postcard_current_dispatch',4));r=finish(t,out,errors)
 assert r['code']=='POSTCARD_HOME_UNAVAILABLE';passed('archival during lock wait retires dispatch permission')
 admit(5);w.run('BEGIN;SELECT id FROM public."Home" WHERE id='+lit(homes[5])+' FOR UPDATE;UPDATE public."HomeOccupancy" SET is_active=false WHERE home_id='+lit(homes[5])+';')
 t,out,errors=concurrent(call('claim_home_postcard_current_dispatch',5));r=finish(t,out,errors)
 assert r['code']=='POSTCARD_ACCESS_REVIEW_REQUIRED';passed('membership removal during wait cannot dispatch mail')
 admit(6);sql('UPDATE public."HomeOccupancy" SET access_end_at=clock_timestamp()+interval \'2 seconds\' WHERE home_id='+lit(homes[6])+';')
 w.run('BEGIN;SELECT id FROM public."Home" WHERE id='+lit(homes[6])+' FOR UPDATE;')
 t,out,errors=concurrent(call('claim_home_postcard_current_dispatch',6));time.sleep(2.3);r=finish(t,out,errors)
 assert r['code']=='POSTCARD_ACCESS_REVIEW_REQUIRED';passed('access expiry uses the clock after the lock wait')
 admit(7);w.run('BEGIN;SELECT id FROM public."Home" WHERE id='+lit(homes[7])+' FOR UPDATE;UPDATE public."HomeResidencyClaim" SET status=\'rejected\' WHERE home_id='+lit(homes[7])+';')
 t,out,errors=concurrent(call('claim_home_postcard_current_dispatch',7));r=finish(t,out,errors)
 assert r['code']=='POSTCARD_ACCESS_REVIEW_REQUIRED';passed('household rejection during wait prevents dispatch')
 # Home locks also serialize a second explicit command with a shared pending proof.
 admit(8);w.run('BEGIN;');first=result(call('begin_home_postcard_request',8));t,out,errors=concurrent(call('begin_home_postcard_request',8,key=uid(999)));r=finish(t,out,errors)
 assert r['postcard_id']==first['postcard_id'];assert sql('SELECT count(*) FROM public."HomePostcardCode" WHERE home_id='+lit(homes[8])+';')=='1';passed('different commands share one pending proof')
 admit(9);w.run('BEGIN;');first=result(call('begin_home_postcard_request',9));t,out,errors=concurrent(call('begin_home_postcard_request',9,unit='999'));r=finish(t,out,errors)
 assert r['code']=='POSTCARD_REQUEST_CONFLICT';passed('changed competing intent cannot overwrite the original command')
 admit(10);w.run('BEGIN;');result(call('claim_home_postcard_current_dispatch',10));t,out,errors=concurrent(call('cancel_home_postcard_request',10));r=finish(t,out,errors)
 assert r['state']=='completed';passed('concurrent cancellation cannot claim dispatched mail was recalled')
 print('PASS:',passes,'observed postal request/dispatch races',flush=True)
finally:
 if w:w.close()
 if l:l.close()
 if setup:
  sql('BEGIN;DELETE FROM public."HomePostcardRequestCommand" WHERE home_id IN ('+ids+');DELETE FROM public."HomeAuditLog" WHERE home_id IN ('+ids+');DELETE FROM public."HomeResidencyClaim" WHERE home_id IN ('+ids+');DELETE FROM public."HomeOccupancy" WHERE home_id IN ('+ids+');DELETE FROM public."HomeOwner" WHERE home_id IN ('+ids+');DELETE FROM public."Home" WHERE id IN ('+ids+');DELETE FROM public."User" WHERE id IN ('+users+');DELETE FROM auth.users WHERE id IN ('+users+');COMMIT;')
  assert sql('SELECT (SELECT count(*) FROM auth.users WHERE id IN ('+users+'))+(SELECT count(*) FROM public."Home" WHERE id IN ('+ids+'));')=='0'
 if schema:
  drops=sql("SELECT 'DROP FUNCTION '||oid::regprocedure::text||';' FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN ("+names+") ORDER BY oid DESC;")
  sql('BEGIN;'+drops+'DROP TABLE public."HomePostcardRequestCommand";COMMIT;')
  assert sql('SELECT max(version) FROM supabase_migrations.schema_migrations;')==ledger
  print('PASS: exact race fixtures and temporary schema cleaned; ledger preserved',flush=True)
 log.close()
