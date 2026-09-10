#!/usr/bin/env python3
"""Observed lock-wait record admission regressions in a local disposable Home DB.
Usage: python3 scripts/db/test-home-record-merge-concurrency.py CONTAINER DATABASE
No provider calls. Synthetic fixtures are exact IDs and fully retired.
"""
import json, os, queue, re, subprocess, sys, tempfile, threading, time
from pathlib import Path
if len(sys.argv)!=3 or not re.fullmatch(r'supabase_db_pantopus-home-[a-z0-9_-]+',sys.argv[1]) or not re.fullmatch(r'postgres|[a-z0-9_]+_contract',sys.argv[2]):
 raise SystemExit('Pass a disposable local pantopus-home Docker container and contract database')
BASE=['docker','exec','-i',sys.argv[1],'psql','-X','-qAt','-U','postgres','-d',sys.argv[2],'-v','ON_ERROR_STOP=1']
os.umask(0o077)
fd, log_name=tempfile.mkstemp(prefix='pantopus-home-record-concurrency-',suffix='.log')
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
  self.run("SET application_name = 'home_record_contract_"+name+"'; SET statement_timeout='15s';")
 def run(self, sql):
  self.n+=1; marker='__HOME_RECORD_DONE_'+self.name+'_'+str(self.n)+'__'
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
def uid(n):return 'ddf60100-0000-4000-8000-'+str(n).zfill(12)
owner,actor,other=[uid(n) for n in range(1,4)]
homes=[uid(n) for n in range(101,117)]
tasks=[uid(n) for n in range(201,217)]
events=[uid(n) for n in range(301,317)]
mails=[uid(n) for n in range(401,417)]
w=Conn('winner');l=Conn('loser');setup=False
users=','.join(map(lit,[owner,actor,other]));ids=','.join(map(lit,homes))
def call(name,args):return 'SET ROLE service_role; SELECT public.'+name+'('+','.join(args)+')::text; RESET ROLE;'
def read(i,mail=False):return call('get_home_records',[lit(homes[i]),lit(actor),"'task'",lit(tasks[i])])
def mutate(i,kind,action,who=actor,payload=None,record=None,source=None):
 return call('mutate_home_record',[lit(homes[i]),lit(who),lit(kind),lit(action),
  'NULL' if action=='create' else lit(record or (tasks[i] if kind=='task' else events[i])),lit(json.dumps(payload or {})),lit(source) if source else 'NULL'])
def wait_lock():
 for _ in range(100):
  if w.run("SELECT count(*) FROM pg_stat_activity WHERE application_name='home_record_contract_loser' AND wait_event_type='Lock';")==['1']:return
  time.sleep(.02)
 raise AssertionError('No demonstrated record lock wait')
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
def projection(h):
 q="SELECT jsonb_build_object('tasks',(SELECT jsonb_agg(to_jsonb(r) ORDER BY id) FROM public.\"HomeTask\" r WHERE home_id="+lit(h)+")"
 for key,table in [('event','HomeCalendarEvent'),('audit','HomeAuditLog'),('media','HomeTaskMedia')]:
  q+=','+lit(key)+',(SELECT jsonb_agg(to_jsonb(r) ORDER BY id) FROM public."'+table+'" r WHERE home_id='+lit(h)+')'
 return w.run(q+')::text;')
try:
 assert w.run('SELECT (SELECT count(*) FROM auth.users WHERE id IN ('+users+'))+(SELECT count(*) FROM public."User" WHERE id IN ('+users+'))+(SELECT count(*) FROM public."Home" WHERE id IN ('+ids+'));')==['0'],'Refuse fixture reuse'
 sql='BEGIN; INSERT INTO auth.users(id,email) VALUES '+','.join('('+lit(u)+','+lit('record-race-'+str(n)+'@example.invalid')+')' for n,u in enumerate([owner,actor,other]))+';'
 sql+=' INSERT INTO public."User"(id,email,username,name) SELECT id,email,\'record_race_\'||right(id::text,1),\'Record race fixture\' FROM auth.users WHERE id IN ('+users+');'
 for i,h in enumerate(homes):
  sql+=' INSERT INTO public."Home"(id,owner_id,address,city,state,zipcode) VALUES ('+lit(h)+','+lit(owner)+",'Synthetic record race','Test','WA','98607');"
  for u,role in [(owner,'owner'),(actor,'member'),(other,'member')]:
   sql+=' INSERT INTO public."HomeOccupancy"(home_id,user_id,role,role_base,age_band,verification_status) VALUES ('+lit(h)+','+lit(u)+','+lit(role)+','+lit(role)+",'adult','verified');"
  for p in ['tasks.view','tasks.edit','calendar.view','calendar.edit']:
   sql+=' INSERT INTO public."HomePermissionOverride"(home_id,user_id,permission,allowed) VALUES ('+lit(h)+','+lit(actor)+','+lit(p)+',true);'
  if i in [8,9,10]:
   sql+=' INSERT INTO public."Mail"(id,recipient_user_id,recipient_home_id,type,content) VALUES ('+lit(mails[i])+','+lit(actor)+','+lit(h)+",'letter','Synthetic personal');"
  sql+=' INSERT INTO public."HomeTask"(id,home_id,created_by,assigned_to,title,task_type,mail_id) VALUES ('+lit(tasks[i])+','+lit(h)+','+lit(owner)+','+lit(actor)+",'Race task','chore',"+(lit(mails[i]) if i in [8,9,10] else 'NULL')+');'
  sql+=' INSERT INTO public."HomeCalendarEvent"(id,home_id,created_by,title,event_type,start_at,request_rsvp) VALUES ('+lit(events[i])+','+lit(h)+','+lit(owner)+",'Race event','other','2030-01-01',true);"
 sql+=' COMMIT;';w.run(sql);setup=True
 def blocked(i,label,change,request,code,delay=0,mail_lock=False):
  lock='SELECT id FROM public."Mail" WHERE id='+lit(mails[i])+' FOR UPDATE;' if mail_lock else 'SELECT id FROM public."Home" WHERE id='+lit(homes[i])+' FOR UPDATE;'
  w.run('BEGIN; '+lock+change);before=projection(homes[i]);t,out,errs=concurrent(request)
  if delay:time.sleep(delay)
  r=finish(t,out,errs)
  assert r.get('ok') is False and r.get('code')==code,label+str(r)
  assert projection(homes[i])==before,label+' left partial record writes'
  print('PASS: '+label+'; observed wait and no partial writes',flush=True)
 blocked(0,'actor revoked','UPDATE public."HomeOccupancy" SET verification_status=\'revoked\' WHERE home_id='+lit(homes[0])+' AND user_id='+lit(actor)+';',read(0),'HOME_RECORD_DENIED')
 blocked(1,'actor explicit read deny','UPDATE public."HomePermissionOverride" SET allowed=false WHERE home_id='+lit(homes[1])+' AND user_id='+lit(actor)+" AND permission='tasks.view';",read(1),'HOME_RECORD_DENIED')
 w.run('UPDATE public."HomeOccupancy" SET access_end_at=clock_timestamp()+interval \'1 second\' WHERE home_id='+lit(homes[2])+' AND user_id='+lit(actor)+';')
 blocked(2,'actor expiry during Home wait','',read(2),'HOME_RECORD_DENIED',1.15)
 blocked(3,'assignee revoked','UPDATE public."HomeOccupancy" SET verification_status=\'revoked\' WHERE home_id='+lit(homes[3])+' AND user_id='+lit(actor)+';',mutate(3,'task','create',owner,{'title':'New','assigned_to':actor}),'HOME_RECORD_RECIPIENT_DENIED')
 blocked(4,'assignee explicit view deny','UPDATE public."HomePermissionOverride" SET allowed=false WHERE home_id='+lit(homes[4])+' AND user_id='+lit(actor)+" AND permission='tasks.view';",mutate(4,'task','create',owner,{'title':'New','assigned_to':actor}),'HOME_RECORD_RECIPIENT_DENIED')
 blocked(5,'assignee unknown role','UPDATE public."HomeOccupancy" SET role=NULL,role_base=NULL WHERE home_id='+lit(homes[5])+' AND user_id='+lit(actor)+';',mutate(5,'event','create',owner,{'title':'New','start_at':'2030-01-01','assigned_to':[actor]}),'HOME_RECORD_RECIPIENT_DENIED')
 blocked(6,'task changed to sensitive','UPDATE public."HomeTask" SET visibility=\'sensitive\' WHERE id='+lit(tasks[6])+';',read(6),'HOME_RECORD_NOT_FOUND')
 blocked(7,'task assignment withdrawn','UPDATE public."HomeTask" SET assigned_to=NULL WHERE id='+lit(tasks[7])+';',mutate(7,'task','update',payload={'status':'done'}),'HOME_RECORD_WRITE_DENIED')
 blocked(8,'original mail recipient changed','UPDATE public."Mail" SET recipient_user_id='+lit(other)+' WHERE id='+lit(mails[8])+';',read(8),'HOME_RECORD_NOT_FOUND',mail_lock=True)
 w.run('UPDATE public."Mail" SET expires_at=clock_timestamp()+interval \'1 second\' WHERE id='+lit(mails[9])+';')
 blocked(9,'original mail expired during source wait','',read(9),'HOME_RECORD_NOT_FOUND',1.15,True)
 blocked(10,'source mail deletion cannot declassify copied task','DELETE FROM public."Mail" WHERE id='+lit(mails[10])+';',read(10),'HOME_RECORD_NOT_FOUND',mail_lock=True)
 blocked(11,'RSVP disabled','UPDATE public."HomeCalendarEvent" SET request_rsvp=false WHERE id='+lit(events[11])+';',mutate(11,'event','rsvp',payload={'status':'going'}),'HOME_RECORD_INVALID')
 w.run('BEGIN;');first=json.loads(w.run(mutate(12,'event','rsvp',payload={'status':'maybe'}))[0]);assert first['ok'],first
 t,out,errs=concurrent(mutate(12,'event','rsvp',payload={'status':'going'}));r=finish(t,out,errs);assert r.get('ok') is True,r
 assert w.run('SELECT count(*) FROM public."HomeCalendarEventAttendee" WHERE event_id='+lit(events[12])+' AND user_id='+lit(actor)+';')==['1']
 print('PASS: concurrent RSVP has one exact actor/event row',flush=True)
 w.run('INSERT INTO public."Mail"(id,recipient_user_id,recipient_home_id,type,content) VALUES ('+lit(mails[13])+','+lit(actor)+','+lit(homes[13])+",'letter','Synthetic repeat'); BEGIN;")
 request=mutate(13,'task','create',payload={'title':'One source task'},source=mails[13]);first=json.loads(w.run(request)[0]);assert first['ok'],first
 before=projection(homes[13]);t,out,errs=concurrent(request);r=finish(t,out,errs)
 assert r.get('replayed') is True and r['record']['id']==first['record']['id'] and projection(homes[13])==before,r
 print('PASS: concurrent source conversion yields one task/audit/link',flush=True)
 old_task=r['record']['id']
 w.run('BEGIN;');deleted=json.loads(w.run(mutate(13,'task','delete',record=old_task))[0]);assert deleted['ok'],deleted
 t,out,errs=concurrent(request);r=finish(t,out,errs)
 assert r.get('ok') is True and r['record']['id']!=old_task and r.get('replayed') is False,r
 assert w.run('SELECT linked_task_id FROM public."Mail" WHERE id='+lit(mails[13])+';')==[r['record']['id']]
 print('PASS: delete versus source reconversion clears only the old link and creates one replacement',flush=True)
 blocked(14,'actor explicit write deny','UPDATE public."HomePermissionOverride" SET allowed=false WHERE home_id='+lit(homes[14])+' AND user_id='+lit(actor)+" AND permission='tasks.edit';",mutate(14,'task','update',payload={'status':'done'}),'HOME_RECORD_WRITE_DENIED')
 blocked(15,'calendar access revoked before RSVP','UPDATE public."HomePermissionOverride" SET allowed=false WHERE home_id='+lit(homes[15])+' AND user_id='+lit(actor)+" AND permission='calendar.view';",mutate(15,'event','rsvp',payload={'status':'going'}),'HOME_RECORD_DENIED')
finally:
 try:
  l.close()
  if setup:
   if w.p.poll() is not None:w=Conn('cleanup')
   w.run('ROLLBACK; BEGIN; DELETE FROM public."Mail" WHERE id IN ('+','.join(map(lit,mails))+'); DELETE FROM public."Home" WHERE id IN ('+ids+'); DELETE FROM public."User" WHERE id IN ('+users+'); DELETE FROM auth.users WHERE id IN ('+users+'); COMMIT;')
   assert w.run('SELECT (SELECT count(*) FROM public."Home" WHERE id IN ('+ids+'))+(SELECT count(*) FROM auth.users WHERE id IN ('+users+'))+(SELECT count(*) FROM public."User" WHERE id IN ('+users+'))+(SELECT count(*) FROM public."Mail" WHERE id IN ('+','.join(map(lit,mails))+'));')==['0']
   print('PASS: exact sixteen-Home/three-account/source-Mail fixture cleanup',flush=True)
 finally:w.close();log.close()
