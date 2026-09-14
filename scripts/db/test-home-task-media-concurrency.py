#!/usr/bin/env python3
"""Observed lock-wait task attachment regressions in a local disposable Home DB.
Usage: python3 scripts/db/test-home-task-media-concurrency.py CONTAINER DATABASE
No provider calls. Synthetic fixtures are exact IDs and fully retired.
"""
import json, os, queue, re, subprocess, sys, tempfile, threading, time
from pathlib import Path
if len(sys.argv)!=3 or not re.fullmatch(r'supabase_db_pantopus-home-[a-z0-9_-]+',sys.argv[1]) or not re.fullmatch(r'postgres|[a-z0-9_]+_contract',sys.argv[2]):
 raise SystemExit('Pass a disposable local pantopus-home Docker container and contract database')
BASE=['docker','exec','-i',sys.argv[1],'psql','-X','-qAt','-U','postgres','-d',sys.argv[2],'-v','ON_ERROR_STOP=1']
os.umask(0o077)
fd, log_name=tempfile.mkstemp(prefix='pantopus-home-task-media-concurrency-',suffix='.log')
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
  self.run("SET application_name = 'home_task_media_contract_"+name+"'; SET statement_timeout='15s';")
 def run(self, sql):
  self.n+=1; marker='__HOME_TASK_MEDIA_DONE_'+self.name+'_'+str(self.n)+'__'
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
def uid(n):return 'ddf10101-0000-4000-8000-'+str(n).zfill(12)
owner,actor,other=[uid(n) for n in range(1,4)]
homes=[uid(n) for n in range(101,121)]
tasks=[uid(n) for n in range(201,221)]
uploads=[uid(n) for n in range(301,321)]
mails=[uid(n) for n in range(401,421)]
users=','.join(map(lit,[owner,actor,other]));ids=','.join(map(lit,homes))
w=Conn('winner');l=Conn('loser');setup=False
payload={'bucket':'private-task-race','sha256':'a'*64,'file_name':'exact.txt','file_size':4,'mime_type':'text/plain'}
def call(name,args):return 'SET ROLE service_role; SELECT public.'+name+'('+','.join(args)+')::text; RESET ROLE;'
def mutate(i,action,who=actor):return call('mutate_home_task_media',[lit(homes[i]),lit(tasks[i]),lit(who),lit(action),lit(uploads[i]),lit(json.dumps(payload if action=='reserve' else {}))])
def read(i):return call('get_home_task_media',[lit(homes[i]),lit(tasks[i]),lit(actor),lit(uploads[i])])
def wait_lock():
 for _ in range(100):
  if w.run("SELECT count(*) FROM pg_stat_activity WHERE application_name='home_task_media_contract_loser' AND wait_event_type='Lock';")==['1']:return
  time.sleep(.02)
 raise AssertionError('No demonstrated task media lock wait')
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
def ok(sql):
 r=json.loads(w.run(sql)[0]);assert r.get('ok') is True,r;return r
def projection(i):
 return w.run('SELECT jsonb_build_object(\'intent\',(SELECT to_jsonb(r) FROM public."HomeTaskMediaIntent" r WHERE id='+lit(uploads[i])+'),\'file\',(SELECT to_jsonb(r) FROM public."File" r WHERE id='+lit(uploads[i])+'),\'media\',(SELECT to_jsonb(r) FROM public."HomeTaskMedia" r WHERE id='+lit(uploads[i])+'),\'quota\',(SELECT to_jsonb(r) FROM public."FileQuota" r WHERE user_id='+lit(actor)+'))::text;')
try:
 assert w.run('SELECT (SELECT count(*) FROM auth.users WHERE id IN ('+users+'))+(SELECT count(*) FROM public."User" WHERE id IN ('+users+'))+(SELECT count(*) FROM public."Home" WHERE id IN ('+ids+'))+(SELECT count(*) FROM public."HomeTaskMediaIntent" WHERE original_home_id IN ('+ids+'));')==['0'],'Refuse fixture reuse'
 sql='BEGIN; INSERT INTO auth.users(id,email) VALUES '+','.join('('+lit(u)+','+lit('media-race-'+str(n)+'@example.invalid')+')' for n,u in enumerate([owner,actor,other]))+';'
 sql+=' INSERT INTO public."User"(id,email,username,name) SELECT id,email,\'media_race_\'||right(id::text,1),\'Media race fixture\' FROM auth.users WHERE id IN ('+users+');'
 for i,h in enumerate(homes):
  sql+=' INSERT INTO public."Home"(id,owner_id,address,city,state,zipcode) VALUES ('+lit(h)+','+lit(owner)+",'Synthetic media race','Test','WA','98607');"
  for u,role in [(owner,'owner'),(actor,'member'),(other,'member')]:
   sql+=' INSERT INTO public."HomeOccupancy"(home_id,user_id,role,role_base,age_band,verification_status) VALUES ('+lit(h)+','+lit(u)+','+lit(role)+','+lit(role)+",'adult','verified');"
  for p in ['tasks.view','tasks.edit']:
   sql+=' INSERT INTO public."HomePermissionOverride"(home_id,user_id,permission,allowed) VALUES ('+lit(h)+','+lit(actor)+','+lit(p)+',true);'
  if i in [7,8,17]:sql+=' INSERT INTO public."Mail"(id,recipient_user_id,recipient_home_id,type,content) VALUES ('+lit(mails[i])+','+lit(actor)+','+lit(h)+",'letter','Synthetic source');"
  sql+=' INSERT INTO public."HomeTask"(id,home_id,created_by,title,task_type,mail_id) VALUES ('+lit(tasks[i])+','+lit(h)+','+lit(actor)+",'Task media race','chore',"+(lit(mails[i]) if i in [7,8,17] else 'NULL')+');'
 sql+=' COMMIT;';w.run(sql);setup=True
 def blocked(i,label,change,request,code,delay=0,lock=None,field='ok'):
  lock=lock or 'SELECT id FROM public."Home" WHERE id='+lit(homes[i])+' FOR UPDATE;'
  w.run('BEGIN; '+lock+change);before=projection(i);t,out,errs=concurrent(request)
  if delay:time.sleep(delay)
  r=finish(t,out,errs)
  assert r.get(field) is False and r.get('code')==code,label+str(r)
  assert projection(i)==before,label+' left partial attachment writes'
  print('PASS: '+label+'; observed wait and no partial writes',flush=True)
 blocked(0,'actor revoke before reserve','UPDATE public."HomeOccupancy" SET verification_status=\'revoked\' WHERE home_id='+lit(homes[0])+' AND user_id='+lit(actor)+';',mutate(0,'reserve'),'HOME_RECORD_DENIED')
 blocked(1,'explicit edit deny before reserve','UPDATE public."HomePermissionOverride" SET allowed=false WHERE home_id='+lit(homes[1])+' AND user_id='+lit(actor)+" AND permission='tasks.edit';",mutate(1,'reserve'),'HOME_RECORD_WRITE_DENIED')
 w.run('UPDATE public."HomeOccupancy" SET access_end_at=clock_timestamp()+interval \'1 second\' WHERE home_id='+lit(homes[2])+' AND user_id='+lit(actor)+';')
 blocked(2,'actor expiry during Home wait','',mutate(2,'reserve'),'HOME_RECORD_DENIED',1.15)
 # Quota lock wait happens after the initial current authority check. The final
 # wall-clock check must roll back both newly inserted intent and File.
 w.run('INSERT INTO public."FileQuota"(user_id) VALUES('+lit(actor)+') ON CONFLICT DO NOTHING;')
 w.run('UPDATE public."HomeOccupancy" SET access_end_at=clock_timestamp()+interval \'1 second\' WHERE home_id='+lit(homes[3])+' AND user_id='+lit(actor)+';')
 blocked(3,'actor expiry during quota admission','',mutate(3,'reserve'),'HOME_RECORD_WRITE_DENIED',1.15,
  'SELECT user_id FROM public."FileQuota" WHERE user_id='+lit(actor)+' FOR UPDATE;')
 w.run('BEGIN;');first=ok(mutate(4,'reserve'));before=projection(4);t,out,errs=concurrent(mutate(4,'reserve'));r=finish(t,out,errs)
 assert r.get('ok') is True and projection(4)==before,r
 print('PASS: concurrent identical reservation charges once',flush=True)
 ok(mutate(5,'reserve'));ok(mutate(5,'begin_upload'));w.run('BEGIN;');ok(mutate(5,'retire'));before=projection(5)
 t,out,errs=concurrent(mutate(5,'finalize'));r=finish(t,out,errs)
 assert r.get('code')=='HOME_TASK_UPLOAD_RETIRED' and projection(5)==before,r
 print('PASS: retirement wins against waiting publication',flush=True)
 ok(mutate(6,'reserve'));ok(mutate(6,'begin_upload'));w.run('BEGIN;');ok(mutate(6,'finalize'))
 t,out,errs=concurrent(mutate(6,'retire'));r=finish(t,out,errs)
 assert r.get('ok') is True and r['record']['state']=='retired' and w.run('SELECT count(*) FROM public."HomeTaskMedia" WHERE id='+lit(uploads[6])+';')==['0'],r
 print('PASS: publication then removal has one hidden retired attachment',flush=True)
 ok(mutate(7,'reserve'));ok(mutate(7,'begin_upload'));ok(mutate(7,'finalize'))
 blocked(7,'source recipient changes before read','UPDATE public."Mail" SET recipient_user_id='+lit(other)+' WHERE id='+lit(mails[7])+';',read(7),'HOME_RECORD_DENIED',lock='SELECT id FROM public."Mail" WHERE id='+lit(mails[7])+' FOR UPDATE;')
 ok(mutate(8,'reserve'));ok(mutate(8,'begin_upload'))
 w.run('UPDATE public."Mail" SET expires_at=clock_timestamp()+interval \'1 second\' WHERE id='+lit(mails[8])+';')
 blocked(8,'source expires before publication','',mutate(8,'finalize'),'HOME_RECORD_DENIED',1.15, 'SELECT id FROM public."Mail" WHERE id='+lit(mails[8])+' FOR UPDATE;')
 blocked(9,'unknown role before reservation','UPDATE public."HomeOccupancy" SET role=NULL,role_base=NULL WHERE home_id='+lit(homes[9])+' AND user_id='+lit(actor)+';',mutate(9,'reserve'),'HOME_RECORD_DENIED')
 blocked(10,'child cannot author attachment','UPDATE public."HomeOccupancy" SET age_band=\'child\' WHERE home_id='+lit(homes[10])+' AND user_id='+lit(actor)+';',mutate(10,'reserve'),'HOME_RECORD_WRITE_DENIED')
 ok(mutate(11,'reserve'));ok(mutate(11,'begin_upload'));ok(mutate(11,'finalize'))
 blocked(11,'new sensitive restriction before read','UPDATE public."HomeTask" SET visibility=\'sensitive\' WHERE id='+lit(tasks[11])+';',read(11),'HOME_RECORD_DENIED')
 def home_call(i,name):return call(name,[lit(homes[i]),lit(owner)])
 for i in [12,13,14]:
  ok(mutate(i,'reserve'));ok(mutate(i,'begin_upload'));ok(mutate(i,'finalize'))
 blocked(12,'Home deletion owner revoked before retirement','UPDATE public."HomeOccupancy" SET verification_status=\'revoked\' WHERE home_id='+lit(homes[12])+' AND user_id='+lit(owner)+';',home_call(12,'prepare_home_task_media_home_delete'),'DELETE_HOME_NOT_PRIMARY',field='allowed')
 blocked(13,'Home deletion explicit security deny','INSERT INTO public."HomePermissionOverride"(home_id,user_id,permission,allowed) VALUES('+lit(homes[13])+','+lit(owner)+",'security.manage',false);",home_call(13,'delete_home_authorized'),'HOME_DELETE_ACCESS_DENIED',field='allowed')
 w.run('UPDATE public."HomeOccupancy" SET access_end_at=clock_timestamp()+interval \'1 second\' WHERE home_id='+lit(homes[14])+' AND user_id='+lit(owner)+';')
 blocked(14,'Home authority expiry during upload quota retirement','',home_call(14,'prepare_home_task_media_home_delete'),'HOME_DELETE_ACCESS_DENIED',1.15,
  'SELECT user_id FROM public."FileQuota" WHERE user_id='+lit(actor)+' FOR UPDATE;',field='allowed')
 w.run('BEGIN;');ok(mutate(15,'reserve'));ok(mutate(15,'begin_upload'));ok(mutate(15,'finalize'));before=projection(15)
 t,out,errs=concurrent(home_call(15,'delete_home_authorized'));r=finish(t,out,errs)
 assert r.get('allowed') is False and r.get('code')=='HOME_DELETE_TASK_MEDIA_CLEANUP_REQUIRED' and projection(15)==before,r
 assert w.run('SELECT count(*) FROM public."Home" WHERE id='+lit(homes[15])+';')==['1']
 print('PASS: new attachment fences waiting final Home deletion',flush=True)
 w.run('BEGIN;');r=json.loads(w.run(home_call(16,'delete_home_authorized'))[0]);assert r.get('deleted') is True,r
 t,out,errs=concurrent(mutate(16,'reserve'));r=finish(t,out,errs)
 assert r.get('code')=='HOME_NOT_FOUND' and w.run('SELECT count(*) FROM public."HomeTaskMediaIntent" WHERE id='+lit(uploads[16])+';')==['0'],r
 print('PASS: completed Home deletion fences waiting new attachment',flush=True)
 w.run('UPDATE public."Mail" SET recipient_user_id='+lit(owner)+' WHERE id='+lit(mails[17])+';')
 ok(mutate(17,'reserve',owner));ok(mutate(17,'begin_upload',owner));ok(mutate(17,'finalize',owner))
 blocked(17,'source recipient changes before Home retirement','UPDATE public."Mail" SET recipient_user_id='+lit(other)+' WHERE id='+lit(mails[17])+';',home_call(17,'prepare_home_task_media_home_delete'),'HOME_DELETE_ACCESS_DENIED',
  lock='SELECT id FROM public."Mail" WHERE id='+lit(mails[17])+' FOR UPDATE;',field='allowed')
 w.run('BEGIN;');ok(mutate(18,'reserve'));ok(mutate(18,'begin_upload'));ok(mutate(18,'finalize'));before=projection(18)
 t,out,errs=concurrent(call('delete_home_task_after_media',[lit(homes[18]),lit(tasks[18]),lit(actor)]));r=finish(t,out,errs)
 assert r.get('code')=='HOME_TASK_MEDIA_CLEANUP_REQUIRED' and projection(18)==before,r
 print('PASS: new attachment fences waiting final Task deletion',flush=True)
 ok(mutate(19,'reserve'));ok(mutate(19,'begin_upload'));w.run('BEGIN;');r=ok(mutate(19,'retire'))
 w.run(call('finish_home_task_media_cleanup',[lit(uploads[19]),lit(r['storage']['cleanup_claim']),'true']))
 ok(call('delete_home_task_after_media',[lit(homes[19]),lit(tasks[19]),lit(actor)]))
 t,out,errs=concurrent(mutate(19,'finalize'));r=finish(t,out,errs)
 assert r.get('code')=='HOME_RECORD_NOT_FOUND',r
 assert w.run('SELECT state FROM public."HomeTaskMediaIntent" WHERE id='+lit(uploads[19])+';')==['retired']
 print('PASS: completed Task deletion fences waiting publication and retains tombstone',flush=True)
finally:
 try:
  l.close()
  if setup:
   if w.p.poll() is not None:w=Conn('cleanup')
   # These two retention triggers are disabled only inside exact synthetic
   # fixture teardown on this explicitly guarded disposable database. The same
   # transaction restores both; no trigger/permission change survives cleanup.
   sql='ROLLBACK; BEGIN; DELETE FROM public."HomeTaskMedia" WHERE home_id IN ('+ids+');'
   sql+=' ALTER TABLE public."File" DISABLE TRIGGER protect_home_task_media_file; DELETE FROM public."File" WHERE id IN ('+','.join(map(lit,uploads))+'); ALTER TABLE public."File" ENABLE TRIGGER protect_home_task_media_file;'
   sql+=' ALTER TABLE public."HomeTaskMediaIntent" DISABLE TRIGGER protect_home_task_media_intent; DELETE FROM public."HomeTaskMediaIntent" WHERE original_home_id IN ('+ids+'); ALTER TABLE public."HomeTaskMediaIntent" ENABLE TRIGGER protect_home_task_media_intent;'
   sql+=' DELETE FROM public."Mail" WHERE id IN ('+','.join(map(lit,mails))+'); DELETE FROM public."Home" WHERE id IN ('+ids+'); DELETE FROM public."User" WHERE id IN ('+users+'); DELETE FROM auth.users WHERE id IN ('+users+'); COMMIT;'
   w.run(sql)
   assert w.run('SELECT (SELECT count(*) FROM public."Home" WHERE id IN ('+ids+'))+(SELECT count(*) FROM public."HomeTaskMediaIntent" WHERE original_home_id IN ('+ids+'))+(SELECT count(*) FROM public."File" WHERE id IN ('+','.join(map(lit,uploads))+'))+(SELECT count(*) FROM auth.users WHERE id IN ('+users+'))+(SELECT count(*) FROM public."User" WHERE id IN ('+users+'));')==['0']
   print('PASS: exact twenty-Home/three-account/task-intent/File/source fixture cleanup',flush=True)
 finally:w.close();log.close()
print('Private race log:',log_name,flush=True)
