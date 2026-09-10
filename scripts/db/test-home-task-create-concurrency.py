#!/usr/bin/env python3
"""Observed lock-wait exact task creation recovery regressions in a local disposable Home DB.
Usage: python3 scripts/db/test-home-task-create-concurrency.py CONTAINER DATABASE
No provider calls. Synthetic fixtures are exact IDs and fully retired.
"""
import json, os, queue, re, subprocess, sys, tempfile, threading, time
from pathlib import Path
if len(sys.argv)!=3 or not re.fullmatch(r'supabase_db_pantopus-home-[a-z0-9_-]+',sys.argv[1]) or not re.fullmatch(r'postgres|[a-z0-9_]+_contract',sys.argv[2]):
 raise SystemExit('Pass a disposable local pantopus-home Docker container and contract database')
BASE=['docker','exec','-i',sys.argv[1],'psql','-X','-qAt','-U','postgres','-d',sys.argv[2],'-v','ON_ERROR_STOP=1']
os.umask(0o077)
fd, log_name=tempfile.mkstemp(prefix='pantopus-home-task-create-concurrency-',suffix='.log')
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
  self.run("SET application_name = 'home_task_create_contract_"+name+"'; SET statement_timeout='15s';")
 def run(self, sql):
  self.n+=1; marker='__HOME_TASK_CREATE_DONE_'+self.name+'_'+str(self.n)+'__'
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
def uid(n):return 'ddf17100-0000-4000-8000-'+str(n).zfill(12)
owner,actor,target=[uid(n) for n in range(1,4)]
homes=[uid(n) for n in range(101,110)]
keys=[uid(n) for n in range(501,510)]
users=','.join(map(lit,[owner,actor,target]));ids=','.join(map(lit,homes))
w=Conn('winner');l=Conn('loser');setup=False

def call(name,args):return 'SET ROLE service_role; SELECT public.'+name+'('+','.join(args)+')::text; RESET ROLE;'
def create(i,payload=None):return call('create_home_task_with_receipt',[lit(homes[i]),lit(actor),lit(keys[i]),lit(json.dumps(payload or {'title':'Exact one task'}))])
def mutate(i,task,action):return call('mutate_home_record',[lit(homes[i]),lit(actor),"'task'",lit(action),lit(task),"'{}'",'NULL'])
def wait_lock():
 for _ in range(100):
  if w.run("SELECT count(*) FROM pg_stat_activity WHERE application_name='home_task_create_contract_loser' AND wait_event_type='Lock';")==['1']:return
  time.sleep(.02)
 raise AssertionError('No demonstrated task creation lock wait')
def concurrent(sql):
 out=[];errs=[]
 def run():
  try:out.extend(l.run(sql))
  except Exception as e:errs.append(str(e))
 t=threading.Thread(target=run);t.start();wait_lock();return t,out,errs
def finish(t,out,errs,commit=True):
 w.run('COMMIT;' if commit else 'ROLLBACK;');t.join(12)
 assert not t.is_alive() and not errs and len(out)==1,str(errs)+str(out)
 return json.loads(out[0])
def projection(h):
 q="SELECT jsonb_build_object('tasks',(SELECT jsonb_agg(to_jsonb(r) ORDER BY id) FROM public.\"HomeTask\" r WHERE home_id="+lit(h)+")"
 for key,table,order in [('audit','HomeAuditLog','id'),('receipts','HomeTaskCreateReceipt','request_id')]:
  q+=','+lit(key)+',(SELECT jsonb_agg(to_jsonb(r) ORDER BY '+order+') FROM public."'+table+'" r WHERE home_id='+lit(h)+')'
 return w.run(q+')::text;')
def assert_one(i):
 assert w.run('SELECT (SELECT count(*) FROM public."HomeTask" WHERE home_id='+lit(homes[i])+'),(SELECT count(*) FROM public."HomeTaskCreateReceipt" WHERE home_id='+lit(homes[i])+'),(SELECT count(*) FROM public."HomeAuditLog" WHERE home_id='+lit(homes[i])+" AND action='home_task_created');")==['1|1|1']
try:
 assert w.run('SELECT (SELECT count(*) FROM auth.users WHERE id IN ('+users+'))+(SELECT count(*) FROM public."User" WHERE id IN ('+users+'))+(SELECT count(*) FROM public."Home" WHERE id IN ('+ids+'));')==['0'],'Refuse fixture reuse'
 sql='BEGIN; INSERT INTO auth.users(id,email) VALUES '+','.join('('+lit(u)+','+lit('create-race-'+str(n)+'@example.invalid')+')' for n,u in enumerate([owner,actor,target]))+';'
 sql+=' INSERT INTO public."User"(id,email,username,name) SELECT id,email,\'create_race_\'||right(id::text,1),\'Create race fixture\' FROM auth.users WHERE id IN ('+users+');'
 for h in homes:
  sql+=' INSERT INTO public."Home"(id,owner_id,address,city,state,zipcode) VALUES ('+lit(h)+','+lit(owner)+",'Synthetic create race','Test','WA','98607');"
  for u,role in [(owner,'owner'),(actor,'member'),(target,'member')]:
   sql+=' INSERT INTO public."HomeOccupancy"(home_id,user_id,role,role_base,age_band,verification_status) VALUES ('+lit(h)+','+lit(u)+','+lit(role)+','+lit(role)+",'adult','verified');"
  for u,permissions in [(actor,['tasks.view','tasks.edit']),(target,['tasks.view'])]:
   for permission in permissions:
    sql+=' INSERT INTO public."HomePermissionOverride"(home_id,user_id,permission,allowed) VALUES ('+lit(h)+','+lit(u)+','+lit(permission)+',true);'
 w.run(sql+' COMMIT;');setup=True
 # A committed first response may be lost; concurrent replay stays exact.
 w.run('BEGIN;');first=json.loads(w.run(create(0))[0]);assert first['ok'],first
 before=projection(homes[0]);t,out,errs=concurrent(create(0));r=finish(t,out,errs)
 assert r.get('replayed') is True and r['record']['id']==first['record']['id'] and r.get('notify_user_id') is None,r
 assert projection(homes[0])==before;assert_one(0)
 print('PASS: simultaneous same request creates one task/audit/receipt and no replay notification',flush=True)
 w.run('BEGIN;');first=json.loads(w.run(create(1))[0]);assert first['ok'],first
 before=projection(homes[1]);t,out,errs=concurrent(create(1,{'title':'Changed request'}));r=finish(t,out,errs)
 assert r.get('code')=='HOME_TASK_CREATE_CONFLICT' and projection(homes[1])==before,r
 assert_one(1);print('PASS: concurrent changed payload cannot replace first receipt',flush=True)
 w.run('BEGIN;');first=json.loads(w.run(create(2))[0]);assert first['ok'],first
 t,out,errs=concurrent(create(2));r=finish(t,out,errs,False)
 assert r.get('ok') is True and r.get('replayed') is False and r['record']['id']!=first['record']['id'],r
 assert_one(2);print('PASS: rolled-back first writer leaves no receipt and one waiting creation succeeds',flush=True)
 def blocked(i,label,change,request,code,delay=0):
  w.run('BEGIN; SELECT id FROM public."Home" WHERE id='+lit(homes[i])+' FOR UPDATE;'+change)
  before=projection(homes[i]);t,out,errs=concurrent(request)
  if delay:time.sleep(delay)
  r=finish(t,out,errs)
  assert r.get('ok') is False and r.get('code')==code,label+str(r)
  assert projection(homes[i])==before,label+' left partial task/receipt/audit writes'
  print('PASS: '+label+'; observed wait and unchanged task/receipt/audit',flush=True)
 blocked(3,'actor revoked before creation',"UPDATE public.\"HomeOccupancy\" SET verification_status='revoked' WHERE home_id="+lit(homes[3])+' AND user_id='+lit(actor)+';',create(3),'HOME_RECORD_DENIED')
 first=json.loads(w.run(create(4))[0]);assert first['ok'],first
 w.run('BEGIN;');deleted=json.loads(w.run(mutate(4,first['record']['id'],'delete'))[0]);assert deleted['ok'],deleted
 before=projection(homes[4]);t,out,errs=concurrent(create(4));r=finish(t,out,errs)
 assert r.get('code')=='HOME_TASK_CREATE_RETIRED' and projection(homes[4])==before,r
 print('PASS: deletion wins over replay and retained task identity cannot be recreated',flush=True)
 first=json.loads(w.run(create(5))[0]);assert first['ok'],first
 blocked(5,'task becomes hidden before replay',"UPDATE public.\"HomeTask\" SET visibility='sensitive' WHERE id="+lit(first['record']['id'])+';',create(5),'HOME_TASK_CREATE_RETIRED')
 first=json.loads(w.run(create(6))[0]);assert first['ok'],first
 blocked(6,'explicit creation deny before replay','UPDATE public."HomePermissionOverride" SET allowed=false WHERE home_id='+lit(homes[6])+' AND user_id='+lit(actor)+" AND permission='tasks.edit';",create(6),'HOME_RECORD_WRITE_DENIED')
 w.run("UPDATE public.\"HomeOccupancy\" SET access_end_at=clock_timestamp()+interval '1 second' WHERE home_id="+lit(homes[7])+' AND user_id='+lit(actor)+';')
 blocked(7,'actor expiry during Home wait','',create(7),'HOME_RECORD_DENIED',1.15)
 blocked(8,'assignee revoked before creation',"UPDATE public.\"HomeOccupancy\" SET verification_status='revoked' WHERE home_id="+lit(homes[8])+' AND user_id='+lit(target)+';',create(8,{'title':'Assigned task','assigned_to':target}),'HOME_RECORD_RECIPIENT_DENIED')
finally:
 try:
  l.close()
  if setup:
   if w.p.poll() is not None:w=Conn('cleanup')
   w.run('ROLLBACK; BEGIN; DELETE FROM public."Home" WHERE id IN ('+ids+'); DELETE FROM public."User" WHERE id IN ('+users+'); DELETE FROM auth.users WHERE id IN ('+users+'); COMMIT;')
   assert w.run('SELECT (SELECT count(*) FROM public."Home" WHERE id IN ('+ids+'))+(SELECT count(*) FROM auth.users WHERE id IN ('+users+'))+(SELECT count(*) FROM public."User" WHERE id IN ('+users+'))+(SELECT count(*) FROM public."HomeTaskCreateReceipt" WHERE home_id IN ('+ids+'));')==['0']
   print('PASS: exact nine-Home/three-account/task/receipt fixture cleanup',flush=True)
 finally:w.close();log.close()
