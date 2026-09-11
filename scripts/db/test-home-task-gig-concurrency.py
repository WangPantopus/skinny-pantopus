#!/usr/bin/env python3
"""Observed lock-wait exact task Gig publication recovery regressions in a local disposable Home DB.
Usage: python3 scripts/db/test-home-task-gig-concurrency.py CONTAINER DATABASE
No provider calls. Synthetic fixtures are exact IDs and fully retired.
"""
import json, os, queue, re, subprocess, sys, tempfile, threading, time
from pathlib import Path
if len(sys.argv)!=3 or not re.fullmatch(r'supabase_db_pantopus-home-[a-z0-9_-]+',sys.argv[1]) or not re.fullmatch(r'postgres|[a-z0-9_]+_contract',sys.argv[2]):
 raise SystemExit('Pass a disposable local pantopus-home Docker container and contract database')
BASE=['docker','exec','-i',sys.argv[1],'psql','-X','-qAt','-U','postgres','-d',sys.argv[2],'-v','ON_ERROR_STOP=1']
os.umask(0o077)
fd, log_name=tempfile.mkstemp(prefix='pantopus-home-task-gig-concurrency-',suffix='.log')
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
  self.run("SET application_name = 'home_task_gig_contract_"+name+"'; SET statement_timeout='15s';")
 def run(self, sql):
  self.n+=1; marker='__HOME_TASK_GIG_DONE_'+self.name+'_'+str(self.n)+'__'
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
def uid(n):return 'ddf22100-0000-4000-8000-'+str(n).zfill(12)
actor=uid(1);home=uid(100);w=Conn('winner');l=Conn('loser');setup=False
def rpc(name,args):return 'SET ROLE service_role; SELECT public.'+name+'('+','.join('NULL' if v is None else lit(json.dumps(v) if isinstance(v,dict) else v) for v in args)+')::text; RESET ROLE;'
def create():
 r=json.loads(w.run(rpc('mutate_home_record',[home,actor,'task','create',None,{'title':'Private race task'},None]))[0]);assert r['ok'],r;return r['record']
def publication(task,key,price=25):
 source={'home_id':home,'task_id':task['id'],'request_id':key,'expected_updated_at':task['updated_at'],'reviewed':True}
 command={'home_task_source':source,'title':'Reviewed public race','description':'Reviewed public details for local help.','price':price}
 gig={'title':command['title'],'description':command['description'],'price':price,'user_id':actor,'created_by':actor,'status':'open',
  'origin_mode':'address','exact_location':'POINT(-122.55 45.65)','approx_location':'POINT(-122.5 45.7)',
  'reveal_policy':'after_assignment','task_format':'in_person','attachments':[],'items':[]}
 return rpc('publish_home_task_gig',[home,actor,task['id'],key,task['updated_at'],command,gig])
def wait_lock():
 for _ in range(100):
  if w.run("SELECT count(*) FROM pg_stat_activity WHERE application_name='home_task_gig_contract_loser' AND wait_event_type='Lock';")==['1']:return
  time.sleep(.02)
 raise AssertionError('No demonstrated task Gig publication lock wait')
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

try:
 assert w.run('SELECT count(*) FROM auth.users WHERE id='+lit(actor)+';')==['0']
 w.run('BEGIN; INSERT INTO auth.users(id,email) VALUES('+lit(actor)+",'gig-race@example.invalid'); INSERT INTO public.\"User\"(id,email,username,name) VALUES("+lit(actor)+",'gig-race@example.invalid','home_gig_race','Gig race fixture'); INSERT INTO public.\"Home\"(id,owner_id,address,city,state,zipcode) VALUES("+lit(home)+','+lit(actor)+",'Private race Home','Test','WA','98607'); INSERT INTO public.\"HomeOccupancy\"(home_id,user_id,role,role_base,age_band,verification_status) VALUES("+lit(home)+','+lit(actor)+",'owner','owner','adult','verified'); COMMIT;");setup=True
 for n,changed in [(501,False),(502,True),(503,None)]:
  task=create();w.run('BEGIN;');first=json.loads(w.run(publication(task,uid(n)))[0]);assert first['ok'],first
  pending,out,errs=concurrent(publication(task,uid(n) if changed is not None else uid(n+100),40 if changed else 25))
  r=finish(pending,out,errs)
  if changed is False:assert r['replayed'] and r['receipt']==first['receipt'],r
  else:assert r.get('code')==('HOME_TASK_GIG_CONFLICT' if changed else 'HOME_TASK_GIG_LINKED'),r
  assert w.run('SELECT count(*) FROM public."HomeTaskGigReceipt" WHERE task_id='+lit(task['id'])+';')==['1']
  print('PASS: observed competing publication '+str(n)+' leaves one immutable receipt and one Gig',flush=True)
 task=create();w.run('BEGIN;');first=json.loads(w.run(publication(task,uid(504)))[0]);assert first['ok'],first
 pending,out,errs=concurrent(publication(task,uid(504)));r=finish(pending,out,errs,commit=False)
 assert r['ok'] and not r['replayed'] and r['gig']['id']!=first['gig']['id'],r
 assert w.run('SELECT count(*) FROM public."Gig" WHERE id='+lit(first['gig']['id'])+';')==['0']
 print('PASS: rolled-back publication leaves no orphan; waiting original request commits once',flush=True)
 task=create();w.run('BEGIN; UPDATE public."HomeOccupancy" SET is_active=false WHERE home_id='+lit(home)+' AND user_id='+lit(actor)+';')
 pending,out,errs=concurrent(publication(task,uid(505)));r=finish(pending,out,errs)
 assert r.get('code')=='HOME_RECORD_DENIED',r
 w.run('UPDATE public."HomeOccupancy" SET is_active=true WHERE home_id='+lit(home)+' AND user_id='+lit(actor)+';')
 print('PASS: competing committed membership revocation prevents publication after the lock wait',flush=True)
 task=create();w.run('BEGIN; UPDATE public."HomeTask" SET title=\'New private source\',updated_at=clock_timestamp() WHERE id='+lit(task['id'])+';')
 pending,out,errs=concurrent(publication(task,uid(506)));r=finish(pending,out,errs)
 assert r.get('code')=='HOME_TASK_GIG_STALE',r
 print('PASS: competing task edit prevents publishing a stale reviewed source',flush=True)
 task=create();w.run('BEGIN; DELETE FROM public."HomeTask" WHERE id='+lit(task['id'])+';')
 pending,out,errs=concurrent(publication(task,uid(507)));r=finish(pending,out,errs)
 assert r.get('code')=='HOME_RECORD_NOT_FOUND',r
 print('PASS: competing source deletion creates no Gig',flush=True)
 task=create();w.run('BEGIN;');first=json.loads(w.run(publication(task,uid(508)))[0]);assert first['ok'],first;w.run('COMMIT;')
 w.run('BEGIN; UPDATE public."Gig" SET status=\'cancelled\' WHERE id='+lit(first['gig']['id'])+';')
 pending,out,errs=concurrent(publication(task,uid(508)));r=finish(pending,out,errs)
 assert r['gig']['status']=='cancelled' and r['receipt']==first['receipt'],r
 print('PASS: replay waits for concurrent Gig cancellation and returns its current state',flush=True)
finally:
 try:
  w.run('ROLLBACK;');l.close()
  if setup:
   w.run('BEGIN; DELETE FROM public."HomeTaskGigReceipt" WHERE home_id='+lit(home)+'; DELETE FROM public."Gig" WHERE user_id='+lit(actor)+'; DELETE FROM public."Home" WHERE id='+lit(home)+'; DELETE FROM public."User" WHERE id='+lit(actor)+'; DELETE FROM auth.users WHERE id='+lit(actor)+'; COMMIT;')
   assert w.run('SELECT (SELECT count(*) FROM public."HomeTaskGigReceipt" WHERE home_id='+lit(home)+')+(SELECT count(*) FROM public."Gig" WHERE user_id='+lit(actor)+')+(SELECT count(*) FROM public."Home" WHERE id='+lit(home)+')+(SELECT count(*) FROM auth.users WHERE id='+lit(actor)+');')==['0']
   print('PASS: exact concurrency fixtures removed',flush=True)
 finally:w.close();l.close();log.close()
print('PASS: eight observed SQL lock-wait races; private diagnostic '+log_name,flush=True)
