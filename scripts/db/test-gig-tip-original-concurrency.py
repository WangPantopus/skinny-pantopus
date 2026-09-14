#!/usr/bin/env python3
"""Observed PostgreSQL lock waits for the original tip in existing Payment.
Use existing PG* credentials for a disposable local pantopus_*_contract DB.
No network/provider API is called; output contains synthetic fixture IDs only.
"""
import json, os, queue, re, subprocess, sys, threading, time
if (len(sys.argv) != 2 or not re.fullmatch(r'pantopus_[a-z0-9_]+_contract',sys.argv[1])
    or os.environ.get('PGHOST') not in ('127.0.0.1','localhost','::1')
    or os.environ.get('PGDATABASE') != sys.argv[1]
    or os.environ.get('PGUSER') not in ('postgres','supabase_admin')):
 raise SystemExit('Use explicit local PG* connection settings and a disposable pantopus_*_contract database')
BASE=['psql','-X','-qAt','-v','ON_ERROR_STOP=1','-d',sys.argv[1]]
class Conn:
 def __init__(self,name):
  self.name=name;self.n=0;self.lines=queue.Queue();self.errors=[]
  self.p=subprocess.Popen(BASE,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,bufsize=1)
  def output():
   for line in self.p.stdout:self.lines.put(line.rstrip('\n'))
   self.lines.put(None)
  def errors():
   for line in self.p.stderr:self.errors.append(line)
  threading.Thread(target=output,daemon=True).start();threading.Thread(target=errors,daemon=True).start()
  self.run("SET application_name='gig_tip_original_"+name+"'; SET statement_timeout='15s'; SET lock_timeout='5s';")
 def run(self,sql):
  self.n+=1;marker='__TIP_'+self.name+'_'+str(self.n)+'__'
  self.p.stdin.write(sql+"\nSELECT '"+marker+"';\n");self.p.stdin.flush();out=[]
  while True:
   line=self.lines.get(timeout=20)
   if line is None:raise AssertionError(self.name+' SQL exited: '+''.join(self.errors))
   if line==marker:return out
   out.append(line)
 def close(self):
  if self.p.poll() is None:
   try:self.p.stdin.write('ROLLBACK;\n\\q\n');self.p.stdin.flush();self.p.wait(timeout=5)
   except Exception:self.p.terminate()
def uid(n):return 'aad20000-0000-4000-8000-'+str(n).zfill(12)
def lit(v):return 'NULL' if v is None else "'"+str(v).replace("'","''")+"'"
def rpc(name,*args):return 'SET ROLE service_role; SELECT public.'+name+'('+','.join(args)+')::text; RESET ROLE;'
def reserve(gig,request):return rpc('reserve_gig_tip_original',lit(uid(gig)),lit(uid(1)),lit('a'*64),lit(uid(request)),lit(json.dumps(terms[gig])), '500','NULL','false')
def decode(c,sql):return json.loads(c.run(sql)[0])
def start_wait(sql):
 out=[];errors=[]
 def run():
  try:out.extend(l.run(sql))
  except Exception as e:errors.append(str(e))
 t=threading.Thread(target=run);t.start()
 for _ in range(150):
  if w.run("SELECT count(*) FROM pg_stat_activity WHERE application_name='gig_tip_original_loser' AND wait_event_type='Lock';")==['1']:
   return t,out,errors
  if not t.is_alive():raise AssertionError('Missing observed lock wait: '+str(out)+str(errors))
  time.sleep(.02)
 raise AssertionError('No observed tip lock wait')
def finish(wait,commit=True):
 t,out,errors=wait;w.run('COMMIT;' if commit else 'ROLLBACK;');t.join(10)
 assert not t.is_alive() and not errors and len(out)==1,(out,errors)
 return json.loads(out[0])
w=Conn('winner');l=Conn('loser');setup=False;terms={}
try:
 w.run('BEGIN; INSERT INTO auth.users(id,email) VALUES('+lit(uid(1))+",'tip-race-payer@example.invalid'),("+lit(uid(2))+",'tip-race-worker@example.invalid');"
  '''INSERT INTO public."User"(id,email,username,name,stripe_customer_id) SELECT id,email,'tip_original_race_'||right(id::text,1),'Tip race','cus_tiprace' FROM auth.users WHERE id IN ('''+lit(uid(1))+','+lit(uid(2))+');'
  'INSERT INTO public."StripeAccount"(user_id,stripe_account_id) VALUES('+lit(uid(2))+",'acct_tiprace');"
  'INSERT INTO public."Gig"(id,user_id,created_by,title,description,price,status,accepted_by,owner_confirmed_at) VALUES '+','.join(
   '('+','.join([lit(uid(i)),lit(uid(1)),lit(uid(1)),"'Tip race'","'Synthetic'",'0',"'completed'",lit(uid(2)),'now()'])+')' for i in range(101,108))+';COMMIT;')
 setup=True
 for gig in range(101,108):terms[gig]=decode(w,rpc('preview_gig_tip',lit(uid(gig)),lit(uid(1))))['terms']
 w.run('BEGIN;');first=decode(w,reserve(101,301));second=finish(start_wait(reserve(101,301)))
 assert first==second and first['payment']['id']==uid(301)
 print('PASS: concurrent same-ID retries recover one immutable Payment',flush=True)
 w.run('BEGIN;');decode(w,reserve(102,302));second=finish(start_wait(reserve(102,392)))
 assert second['error']=='TIP_ACTIVE' and second['requestId']==uid(302)
 print('PASS: different IDs cannot reserve competing tips for one task',flush=True)
 w.run('BEGIN;');first=decode(w,reserve(103,303));second=finish(start_wait(reserve(103,303)),False)
 assert second['payment']['id']==uid(303) and w.run('SELECT count(*) FROM public."Payment" WHERE gig_id='+lit(uid(103))+';')==['1']
 print('PASS: rollback leaves no phantom reservation or lost slot',flush=True)
 w.run('BEGIN; UPDATE public."Gig" SET user_id='+lit(uid(2))+' WHERE id='+lit(uid(104))+';')
 second=finish(start_wait(reserve(104,304)))
 assert second['error']=='FORBIDDEN'
 print('PASS: poster change wins before waiting reservation',flush=True)
 w.run('BEGIN;');first=decode(w,rpc('claim_gig_tip_original',lit(uid(301)),lit(uid(1))))
 second=finish(start_wait(rpc('claim_gig_tip_original',lit(uid(301)),lit(uid(1)))))
 assert second['error']=='BUSY'
 print('PASS: only one provider lease survives concurrent claims',flush=True)
 # Prepare waits on the task, then rechecks the lease against wall clock.
 lease=first['original']['lease_id']
 w.run("SET app.gig_tip_original='on'; UPDATE public.\"Payment\" SET metadata=jsonb_set(metadata,'{gig_tip_original_v1,lease_until}',to_jsonb(clock_timestamp()+interval '1 second')) WHERE id="+lit(uid(301))+"; SET app.gig_tip_original='off'; BEGIN; SELECT id FROM public.\"Gig\" WHERE id="+lit(uid(101))+' FOR UPDATE;')
 waiting=start_wait(rpc('prepare_gig_tip_provider',lit(uid(301)),lit(uid(1)),lit(lease),"'cus_tiprace'"));time.sleep(1.1)
 second=finish(waiting);assert second['error']=='LEASE_LOST'
 assert decode(w,rpc('read_gig_tip_original',lit(uid(301)),lit(uid(1))))['original'].get('provider_started_at') is None
 print('PASS: lease expiry during a lock wait prevents a late provider start',flush=True)
 decode(w,reserve(105,305));first=decode(w,rpc('claim_gig_tip_original',lit(uid(305)),lit(uid(1))));lease=first['original']['lease_id']
 # An existing frozen customer stays original even when the account binding changes.
 w.run('BEGIN; UPDATE public."User" SET stripe_customer_id='+lit('cus_changed')+' WHERE id='+lit(uid(1))+';')
 w.run('COMMIT;')
 second=decode(w,rpc('prepare_gig_tip_provider',lit(uid(305)),lit(uid(1)),lit(lease),"'cus_changed'"))
 assert second['error']=='CUSTOMER_CHANGED'
 second=decode(w,rpc('prepare_gig_tip_provider',lit(uid(305)),lit(uid(1)),lit(lease),"'cus_tiprace'"))
 assert second['payment']['stripe_customer_id']=='cus_tiprace'
 print('PASS: a newer account customer cannot replace frozen charge parameters',flush=True)
 decode(w,reserve(106,306));first=decode(w,rpc('claim_gig_tip_original',lit(uid(306)),lit(uid(1))));lease=first['original']['lease_id']
 w.run('BEGIN;');canceled=decode(w,rpc('cancel_unstarted_gig_tip',lit(uid(306)),lit(uid(1)),lit(lease)))
 # A request arriving before that cancellation commits still sees the active original.
 second=decode(l,reserve(106,396));assert second['error']=='TIP_ACTIVE';w.run('COMMIT;')
 second=decode(l,reserve(106,396));assert second['payment']['id']==uid(396) and canceled['original']['receipt']['amountChargedCents']==0
 print('PASS: a tip slot opens only after zero-provider cancellation commits',flush=True)
finally:
 w.close();l.close()
 if setup:
  # Originals intentionally resist normal deletion. Remove only these exact
  # fixture Payments in this disposable DB; normal FK cleanup follows.
  cleanup='BEGIN; SET LOCAL session_replication_role=replica; DELETE FROM public."Payment" WHERE id IN ('+','.join(lit(uid(n)) for n in [301,302,303,305,306,396])+'); SET LOCAL session_replication_role=origin;'
  cleanup+='DELETE FROM public."Gig" WHERE id IN ('+','.join(lit(uid(n)) for n in range(101,108))+');'
  cleanup+='DELETE FROM public."StripeAccount" WHERE user_id='+lit(uid(2))+';'
  cleanup+='DELETE FROM public."User" WHERE id IN ('+lit(uid(1))+','+lit(uid(2))+'); DELETE FROM auth.users WHERE id IN ('+lit(uid(1))+','+lit(uid(2))+'); COMMIT;'
  cleaned=subprocess.run(BASE+['-c',cleanup],capture_output=True,text=True,timeout=20)
  if cleaned.returncode:raise AssertionError('Synthetic cleanup failed: '+cleaned.stderr)
  count=subprocess.run(BASE+['-c',"SELECT (SELECT count(*) FROM public.\"Payment\" WHERE id::text LIKE 'aad20000-%')+(SELECT count(*) FROM public.\"Gig\" WHERE id::text LIKE 'aad20000-%')+(SELECT count(*) FROM public.\"User\" WHERE id::text LIKE 'aad20000-%')+(SELECT count(*) FROM auth.users WHERE id::text LIKE 'aad20000-%');"],capture_output=True,text=True,timeout=10)
  assert count.returncode==0 and count.stdout.strip()=='0','Synthetic fixture residue remains'
  print('PASS: exact synthetic fixture cleanup verified',flush=True)
