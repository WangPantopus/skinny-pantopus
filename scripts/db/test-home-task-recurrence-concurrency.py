#!/usr/bin/env python3
"""Observed lock-wait exact task recurrence recovery regressions in a local disposable Home DB.
Usage: python3 scripts/db/test-home-task-recurrence-concurrency.py CONTAINER DATABASE
No provider calls. Synthetic fixtures are exact IDs and fully retired.
"""
import json, os, queue, re, subprocess, sys, tempfile, threading, time
from pathlib import Path
if len(sys.argv)!=3 or not re.fullmatch(r'supabase_db_pantopus-home-[a-z0-9_-]+',sys.argv[1]) or not re.fullmatch(r'postgres|[a-z0-9_]+_contract',sys.argv[2]):
 raise SystemExit('Pass a disposable local pantopus-home Docker container and contract database')
BASE=['docker','exec','-i',sys.argv[1],'psql','-X','-qAt','-U','postgres','-d',sys.argv[2],'-v','ON_ERROR_STOP=1']
os.umask(0o077)
fd, log_name=tempfile.mkstemp(prefix='pantopus-home-task-recurrence-concurrency-',suffix='.log')
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
  self.run("SET application_name = 'home_task_recurrence_contract_"+name+"'; SET statement_timeout='15s';")
 def run(self, sql):
  self.n+=1; marker='__HOME_TASK_RECURRENCE_DONE_'+self.name+'_'+str(self.n)+'__'
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
def uid(n): return 'ddf20100-0000-4000-8000-'+str(n).zfill(12)
owner,actor,recipient=[uid(n) for n in range(1,4)]
homes=[uid(n) for n in range(101,110)]
users=','.join(map(lit,[owner,actor,recipient]));ids=','.join(map(lit,homes))
w=Conn('winner');l=Conn('loser');setup=False;tasks=[];schedules=[]
def call(name,args): return 'SET ROLE service_role; SELECT public.'+name+'('+','.join(args)+')::text; RESET ROLE;'
def generate(i): return call('generate_home_task_recurrence',[lit(schedules[i]),'1'])
def wait_lock():
 for _ in range(100):
  if w.run("SELECT count(*) FROM pg_stat_activity WHERE application_name='home_task_recurrence_contract_loser' AND wait_event_type='Lock';")==['1']: return
  time.sleep(.02)
 raise AssertionError('No observed recurrence lock wait')
def concurrent(sql):
 out=[];errs=[]
 def run():
  try: out.extend(l.run(sql))
  except Exception as e: errs.append(str(e))
 t=threading.Thread(target=run);t.start();wait_lock();return t,out,errs
def finish(t,out,errs):
 w.run('COMMIT;');t.join(12)
 assert not t.is_alive() and not errs and len(out)==1,str(errs)+str(out)
 return json.loads(out[0])
def lock(i): w.run('BEGIN; SELECT public.lock_home_record_scope('+lit(homes[i])+');')
def count(i): return w.run('SELECT count(*) FROM public."HomeTask" WHERE home_id='+lit(homes[i])+';')
def pause(i): return call('set_home_task_recurrence',[lit(homes[i]),lit(actor),lit(tasks[i]),lit(uid(700+i)),lit('{"action":"pause","expected_revision":1}')])
try:
 assert w.run('SELECT (SELECT count(*) FROM auth.users WHERE id IN ('+users+'))+(SELECT count(*) FROM public."Home" WHERE id IN ('+ids+'));')==['0'],'Refuse fixture reuse'
 sql='BEGIN; INSERT INTO auth.users(id,email) VALUES '+','.join('('+lit(u)+','+lit('recurrence-race-'+str(n)+'@example.invalid')+')' for n,u in enumerate([owner,actor,recipient]))+';'
 sql+=' INSERT INTO public."User"(id,email,username,name) SELECT id,email,\'recurrence_race_\'||right(id::text,1),\'Recurrence fixture\' FROM auth.users WHERE id IN ('+users+');'
 for h in homes:
  sql+=' INSERT INTO public."Home"(id,owner_id,address,city,state,zipcode) VALUES ('+lit(h)+','+lit(owner)+",'Synthetic recurrence','Test','WA','98607');"
  for u,role in [(owner,'owner'),(actor,'member'),(recipient,'member')]:
   sql+=' INSERT INTO public."HomeOccupancy"(home_id,user_id,role,role_base,age_band,verification_status) VALUES ('+lit(h)+','+lit(u)+','+lit(role)+','+lit(role)+",'adult','verified');"
  for u,perms in [(actor,['tasks.view','tasks.edit']),(recipient,['tasks.view'])]:
   for perm in perms: sql+=' INSERT INTO public."HomePermissionOverride"(home_id,user_id,permission,allowed) VALUES ('+lit(h)+','+lit(u)+','+lit(perm)+',true);'
 w.run(sql+'COMMIT;');setup=True
 for i,h in enumerate(homes):
  payload="jsonb_build_object('title','Recurrence source','due_at',date_trunc('day',clock_timestamp())-interval '3 days','assigned_to',"+lit(recipient)+')'
  r=json.loads(w.run(call('mutate_home_record',[lit(h),lit(actor),"'task'","'create'",'NULL',payload]))[0]);assert r['ok'],r
  task=r['record']['id'];tasks.append(task)
  r=json.loads(w.run(call('get_home_task_recurrence',[lit(h),lit(actor),lit(task)]))[0]);assert r['ok'],r
  command={'action':'start','expected_revision':0,'expected_task_updated_at':r['task_updated_at'],'frequency':'DAILY','interval':1,'timezone':'UTC'}
  r=json.loads(w.run(call('set_home_task_recurrence',[lit(h),lit(actor),lit(task),lit(uid(500+i)),lit(json.dumps(command))]))[0]);assert r['ok'],r
  schedules.append(r['configuration']['id'])
  w.run('UPDATE public."HomeTaskRecurrence" SET next_due_at=anchor_at+interval \'1 day\' WHERE id='+lit(schedules[-1])+';')
 # Two workers, one transaction and one original occurrence.
 w.run('BEGIN;');assert json.loads(w.run(generate(0))[0])['outcome']=='generated'
 assert finish(*concurrent(generate(0)))['outcome']=='unchanged';assert count(0)==['2']
 print('PASS: competing workers create one occurrence and one outbox')
 # A pause wins before a waiting worker reads the schedule.
 lock(1);assert json.loads(w.run(pause(1))[0])['ok']
 assert finish(*concurrent(generate(1)))['outcome']=='unchanged';assert count(1)==['1']
 print('PASS: pause wins before generation')
 # Source edits, lost actor authority and recipient expiry all fence generation.
 for i,sql in [(2,'UPDATE public."HomeTask" SET title=\'Changed source\' WHERE id='+lit(tasks[2])+';'),
  (3,'UPDATE public."HomePermissionOverride" SET allowed=false WHERE home_id='+lit(homes[3])+" AND user_id="+lit(actor)+" AND permission='tasks.edit';"),
  (4,'UPDATE public."HomeOccupancy" SET access_end_at=clock_timestamp()-interval \'1 second\' WHERE home_id='+lit(homes[4])+' AND user_id='+lit(recipient)+';')]:
  lock(i);w.run(sql);assert finish(*concurrent(generate(i)))['outcome']=='paused';assert count(i)==['1']
 print('PASS: source edit, actor revocation and recipient expiry win before generation')
 lock(5);r=json.loads(w.run(call('mutate_home_record',[lit(homes[5]),lit(actor),"'task'","'delete'",lit(tasks[5]),"'{}'"]))[0]);assert r['ok'],r
 assert finish(*concurrent(generate(5)))['outcome']=='paused';assert count(5)==['0']
 print('PASS: source deletion cannot be resurrected by a waiting worker')
 # Reverse race: existing generated work survives a later pause.
 w.run('BEGIN;');assert json.loads(w.run(generate(6))[0])['outcome']=='generated'
 assert finish(*concurrent(pause(6)))['configuration']['state']=='paused';assert count(6)==['2']
 print('PASS: committed occurrence survives pause without generating another')
 # Treat the first transaction's result as lost; a cold retry sees committed progress.
 w.run(generate(7));assert json.loads(w.run(generate(7))[0])['outcome']=='unchanged';assert count(7)==['2']
 print('PASS: lost committed reply is recoverable without a second occurrence')
 for i in [0,6,7]:
  assert w.run('SELECT count(*) FROM public."HomeTaskCreateReceipt" WHERE home_id='+lit(homes[i])+';')==['1']
  assert w.run('SELECT count(*) FROM public."HomeTaskAssignmentDelivery" WHERE home_id='+lit(homes[i])+';')==['2']
 print('PASS: exact receipt and outbox counts')
finally:
 for connection in [w,l]:
  try: connection.run('ROLLBACK;')
  except Exception: pass
 if setup:
  w.run('BEGIN; DELETE FROM public."Notification" WHERE metadata->>\'home_id\' IN ('+ids+'); DELETE FROM public."Home" WHERE id IN ('+ids+'); DELETE FROM public."User" WHERE id IN ('+users+'); DELETE FROM auth.users WHERE id IN ('+users+'); COMMIT;')
  assert w.run('SELECT (SELECT count(*) FROM public."HomeTaskRecurrence" WHERE home_id IN ('+ids+'))+(SELECT count(*) FROM public."HomeTaskRecurrenceCommand" WHERE home_id IN ('+ids+'))+(SELECT count(*) FROM auth.users WHERE id IN ('+users+'));')==['0']
  print('PASS: exact fixture cleanup')
 w.close();l.close();log.close()
 print('Private evidence:',log_name)
