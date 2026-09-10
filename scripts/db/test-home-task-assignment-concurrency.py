#!/usr/bin/env python3
"""Observed lock-wait exact task assignment delivery regressions in a local disposable Home DB.
Usage: python3 scripts/db/test-home-task-assignment-concurrency.py CONTAINER DATABASE
No provider calls. Synthetic fixtures are exact IDs and fully retired.
"""
import json, os, queue, re, subprocess, sys, tempfile, threading, time
from pathlib import Path
if len(sys.argv)!=3 or not re.fullmatch(r'supabase_db_pantopus-home-[a-z0-9_-]+',sys.argv[1]) or not re.fullmatch(r'postgres|[a-z0-9_]+_contract',sys.argv[2]):
 raise SystemExit('Pass a disposable local pantopus-home Docker container and contract database')
BASE=['docker','exec','-i',sys.argv[1],'psql','-X','-qAt','-U','postgres','-d',sys.argv[2],'-v','ON_ERROR_STOP=1']
os.umask(0o077)
fd, log_name=tempfile.mkstemp(prefix='pantopus-home-task-assignment-concurrency-',suffix='.log')
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
  self.run("SET application_name = 'home_task_assignment_contract_"+name+"'; SET statement_timeout='15s';")
 def run(self, sql):
  self.n+=1; marker='__HOME_TASK_ASSIGNMENT_DONE_'+self.name+'_'+str(self.n)+'__'
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
def uid(n):return 'ddf18100-0000-4000-8000-'+str(n).zfill(12)
owner,recipient=uid(1),uid(2)
home=uid(100)
w=Conn('winner'); l=Conn('loser'); setup=False
def call(name,*args):return 'SET ROLE service_role; SELECT public.'+name+'('+','.join(args)+')::text; RESET ROLE;'
def create(key):return call('create_home_task_with_receipt',lit(home),lit(owner),lit(uid(key)),lit(json.dumps({'title':'Private assignment fixture','assigned_to':recipient})))
def mutate(task,assignee):return call('mutate_home_record',lit(home),lit(owner),"'task'","'update'",lit(task),lit(json.dumps({'assigned_to':assignee})))
def claim(c=w):return json.loads(c.run(call('claim_home_task_assignment_delivery'))[0] or 'null')
def read(d):return call('read_home_task_assignment_delivery',lit(d['id']),lit(d['lease_id']))
def finish_delivery(d,outcome):return call('finish_home_task_assignment_delivery',lit(d['id']),lit(d['lease_id']),lit(outcome))
def wait_lock():
 for _ in range(100):
  if w.run("SELECT count(*) FROM pg_stat_activity WHERE application_name='home_task_assignment_contract_loser' AND wait_event_type='Lock';")==['1']:return
  time.sleep(.02)
 raise AssertionError('No demonstrated assignment delivery lock wait')
def waiting(sql):
 out=[];errs=[]
 def run():
  try:out.extend(l.run(sql))
  except Exception as e:errs.append(str(e))
 t=threading.Thread(target=run);t.start();wait_lock();return t,out,errs
def release(t,out,errs,commit=True):
 w.run('COMMIT;' if commit else 'ROLLBACK;');t.join(12)
 assert not t.is_alive() and not errs and len(out)==1,str(errs)+str(out)
 return json.loads(out[0])
def counts():return w.run('SELECT (SELECT count(*) FROM public."HomeTask" WHERE home_id='+lit(home)+'),'
 '(SELECT count(*) FROM public."HomeTaskCreateReceipt" WHERE home_id='+lit(home)+'),'
 '(SELECT count(*) FROM public."HomeTaskAssignmentDelivery" WHERE home_id='+lit(home)+'),'
 '(SELECT count(*) FROM public."Notification" WHERE metadata->>\'home_id\'='+lit(home)+');')
try:
 w.run('BEGIN; INSERT INTO auth.users(id,email) VALUES('+lit(owner)+",'assignment-owner@example.invalid'),("+lit(recipient)+",'assignment-recipient@example.invalid');"
 'INSERT INTO public."User"(id,email,username,name) SELECT id,email,\'assignment_delivery_\'||right(id::text,1),\'Assignment fixture\' FROM auth.users WHERE id IN ('+lit(owner)+','+lit(recipient)+');'
 'INSERT INTO public."Home"(id,owner_id,created_by_user_id,address,city,state,zipcode) VALUES('+lit(home)+','+lit(owner)+','+lit(owner)+",'Assignment test','Test','WA','98607');"
 'INSERT INTO public."HomeOccupancy"(home_id,user_id,role,role_base,age_band,verification_status) VALUES('
 +lit(home)+','+lit(owner)+",'owner','owner','adult','verified'),("+lit(home)+','+lit(recipient)+",'member','member','adult','verified');"
 'INSERT INTO public."HomePermissionOverride"(home_id,user_id,permission,allowed) VALUES('+lit(home)+','+lit(recipient)+",'tasks.view',true); COMMIT;")
 setup=True
 # A second HTTP retry really waits behind the first transaction.
 w.run('BEGIN;'); first=json.loads(w.run(create(501))[0]);assert first['ok'],first
 thread,out,errs=waiting(create(501));second=release(thread,out,errs)
 assert second['ok'] and second['replayed'] and second['record']['id']==first['record']['id'],second
 assert counts()==['1|1|1|1'],counts()
 print('PASS: concurrent same-request creation has exactly one task, receipt, delivery and Notification',flush=True)
 d=claim(); w.run(finish_delivery(d,'done'))
 # A rolled-back attempt cannot leave either a delivery or a Notice orphan.
 w.run('BEGIN;'); rolled=json.loads(w.run(create(502))[0]);assert rolled['ok'],rolled
 thread,out,errs=waiting(create(502));second=release(thread,out,errs,False)
 assert second['ok'] and not second['replayed'] and second['record']['id']!=rolled['record']['id'],second
 assert counts()==['2|2|2|2'],counts()
 print('PASS: interrupted creation rolls task, receipt, delivery and Notification back together',flush=True)
 # Revocation acquired first must be observed after the actual Home lock wait.
 d=claim();w.run('BEGIN; SELECT id FROM public."Home" WHERE id='+lit(home)+' FOR UPDATE;'
 'UPDATE public."HomeOccupancy" SET verification_status=\'revoked\' WHERE home_id='+lit(home)+' AND user_id='+lit(recipient)+';')
 thread,out,errs=waiting(read(d));result=release(thread,out,errs)
 assert result['eligible'] is False,result
 w.run(finish_delivery(d,'suppressed'))
 w.run('UPDATE public."HomeOccupancy" SET verification_status=\'verified\' WHERE home_id='+lit(home)+' AND user_id='+lit(recipient)+';')
 assert claim() is None
 print('PASS: recipient revocation wins over waiting delivery and restoration never replays it',flush=True)
 # Reassignment invalidates the old lease while holding normal Home/task locks.
 created=json.loads(w.run(create(503))[0]);d=claim();w.run('BEGIN;')
 changed=json.loads(w.run(mutate(created['record']['id'],owner))[0]);assert changed['ok'],changed
 thread,out,errs=waiting(read(d));result=release(thread,out,errs)
 assert result.get('lease_lost') is True,result
 print('PASS: reassignment wins over delivery with no inverted delivery/task lock',flush=True)
 # Independent relays claim different events instead of both delivering one.
 for k in [504,505]:assert json.loads(w.run(create(k))[0])['ok']
 w.run('BEGIN;');d1=claim();d2=claim(l)
 assert d1 and d2 and d1['id']!=d2['id'],[d1,d2]
 w.run('COMMIT;');w.run(finish_delivery(d1,'done'));w.run(finish_delivery(d2,'done'))
 print('PASS: two live relay connections claim distinct events using SKIP LOCKED',flush=True)
 # An expired lease is rechecked using wall clock after an authority-lock wait.
 assert json.loads(w.run(create(506))[0])['ok'];d=claim()
 w.run('UPDATE public."HomeTaskAssignmentDelivery" SET lease_until=clock_timestamp()+interval \'1 second\' WHERE id='+lit(d['id'])+';'
 'BEGIN; SELECT id FROM public."Home" WHERE id='+lit(home)+' FOR UPDATE;')
 thread,out,errs=waiting(read(d));time.sleep(1.15);result=release(thread,out,errs)
 assert result.get('lease_lost') is True,result
 again=claim();assert again['id']==d['id'] and again['lease_id']!=d['lease_id'],again
 assert w.run(finish_delivery(d,'done'))==['false']
 w.run(finish_delivery(again,'done'))
 print('PASS: lease expires during observed lock wait; only replacement lease can acknowledge original event',flush=True)
 # The relay must wait for Notification deletion without holding its FK child.
 # An observer connection proves that wait before the deleting writer proceeds.
 assert json.loads(w.run(create(507))[0])['ok'];d=claim()
 note=w.run('SELECT notification_id FROM public."HomeTaskAssignmentDelivery" WHERE id='+lit(d['id'])+';')[0]
 w.run('BEGIN; SELECT id FROM public."Notification" WHERE id='+lit(note)+' FOR UPDATE;')
 thread,out,errs=waiting(read(d))
 w.run('DELETE FROM public."Notification" WHERE id='+lit(note)+';')
 result=release(thread,out,errs)
 assert result['eligible'] is False,result
 w.run(finish_delivery(d,'suppressed'))
 print('PASS: notification deletion and waiting relay follow Notification→delivery order without deadlock or recreation',flush=True)
 assert claim() is None
finally:
 try:
  l.close()
  if setup:
   if w.p.poll() is not None:w=Conn('cleanup')
   w.run('ROLLBACK; BEGIN; DELETE FROM public."Notification" WHERE metadata->>\'home_id\'='+lit(home)+';'
    'DELETE FROM public."Home" WHERE id='+lit(home)+'; DELETE FROM public."User" WHERE id IN ('+lit(owner)+','+lit(recipient)+');'
    'DELETE FROM auth.users WHERE id IN ('+lit(owner)+','+lit(recipient)+'); COMMIT;')
   assert counts()==['0|0|0|0']
   assert w.run('SELECT count(*) FROM auth.users WHERE id IN ('+lit(owner)+','+lit(recipient)+');')==['0']
   print('PASS: exact task/receipt/outbox/Notification/Home/account fixture cleanup',flush=True)
 finally:w.close();log.close()
