#!/usr/bin/env python3
"""Actual lock-wait Home checklist boundaries in an owned local database."""
import json, os, queue, re, subprocess, sys, tempfile, threading, time
from pathlib import Path
if len(sys.argv) not in (3,4) or not re.fullmatch(r'supabase_db_pantopus-home-[a-z0-9_-]+',sys.argv[1]) or not re.fullmatch(r'postgres|[a-z0-9_]+_contract',sys.argv[2]):
 raise SystemExit('Pass a disposable local pantopus-home Docker container and contract database')
settings = len(sys.argv)==4 and sys.argv[3]=='settings'
assert len(sys.argv)==3 or settings
BASE=['docker','exec','-i',sys.argv[1],'psql','-X','-qAt','-U','postgres','-d',sys.argv[2],'-v','ON_ERROR_STOP=1']
os.umask(0o077)
fd, log_name=tempfile.mkstemp(prefix='pantopus-home-summary-concurrency-',suffix='.log')
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
  self.run("SET application_name = 'home_summary_contract_"+name+"'; SET statement_timeout='15s';")
 def run(self, sql):
  self.n+=1; marker='__HOME_SUMMARY_DONE_'+self.name+'_'+str(self.n)+'__'
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

def lit(v):return 'NULL' if v is None else "'"+str(v).replace("'","''")+"'"
def uid(n):return 'ddc24100-0000-4000-8000-'+str(n).zfill(12)

actor=uid(1)
homes=[uid(n) for n in range(101,111)];items=[uid(n) for n in range(201,211)]
ids=','.join(map(lit,homes));w=Conn('winner');l=Conn('loser');setup=False;passes=0

def command(i):
 if settings: return "SET ROLE service_role; SELECT public.update_home_settings("+lit(homes[i])+","+lit(actor)+",'{}','{\"bill_benchmark_opt_in\":true}')::text; RESET ROLE;"
 return 'SET ROLE service_role; SELECT public.update_home_seasonal_item('+','.join(map(lit,[homes[i],actor,items[i],'completed']))+')::text; RESET ROLE;'
def snapshot(i):
 if settings: return w.run("SELECT jsonb_build_object('home',(SELECT to_jsonb(h) FROM public.\"Home\" h WHERE id="+lit(homes[i])+"),'preferences',(SELECT to_jsonb(p) FROM public.\"HomePreference\" p WHERE home_id="+lit(homes[i])+"),'audit',(SELECT jsonb_agg(to_jsonb(a) ORDER BY id) FROM public.\"HomeAuditLog\" a WHERE home_id="+lit(homes[i])+"))::text;")
 return w.run('SELECT jsonb_build_object(\'items\',(SELECT jsonb_agg(to_jsonb(r) ORDER BY id) FROM public."HomeSeasonalChecklistItem" r WHERE home_id='+lit(homes[i])+'),\'audit\',(SELECT jsonb_agg(to_jsonb(a) ORDER BY id) FROM public."HomeAuditLog" a WHERE home_id='+lit(homes[i])+'))::text;')
def race(i,label,winner,expected,delay=0):
 global passes
 if settings: expected='HOME_SETTINGS_DENIED'
 w.run('BEGIN; '+winner);before=snapshot(i);out=[];errors=[]
 def run():
  try:out.extend(l.run(command(i)))
  except Exception as e:errors.append(str(e))
 t=threading.Thread(target=run);t.start()
 for _ in range(150):
  if w.run("SELECT count(*) FROM pg_stat_activity WHERE application_name='home_summary_contract_loser' AND wait_event_type='Lock';")==['1']:break
  time.sleep(.02)
 else:raise AssertionError('No observed summary lock wait')
 if delay:time.sleep(delay)
 w.run('COMMIT;');t.join(12)
 assert not t.is_alive() and not errors and len(out)==1,errors
 result=json.loads(out[0]);assert result.get('code')==expected and result.get('ok') is False,(label,result)
 assert snapshot(i)==before,label+' left a partial change'
 passes+=1;print('PASS: '+label+'; observed lock wait and exact unchanged item/audit',flush=True)
try:
 assert w.run('SELECT (SELECT count(*) FROM auth.users WHERE id='+lit(actor)+')+(SELECT count(*) FROM public."Home" WHERE id IN ('+ids+'));')==['0']
 query='BEGIN; INSERT INTO auth.users(id,email,email_confirmed_at) VALUES('+lit(actor)+",'summary-race@example.invalid',now());"
 query+=' INSERT INTO public."User"(id,email,username,role) VALUES('+lit(actor)+",'summary-race@example.invalid','summary_race','user');"
 for i,h in enumerate(homes):
  query+=' INSERT INTO public."Home"(id,owner_id,address,city,state,zipcode) VALUES('+lit(h)+','+lit(actor)+",'Private summary race','Test','WA','98607');"
  query+=' INSERT INTO public."HomeOccupancy"(home_id,user_id,role,role_base,age_band,verification_status,start_at,end_at) VALUES('+lit(h)+','+lit(actor)+",'owner','owner','adult','verified',now()-interval '1 day',now()+interval '1 day');"
  query+=' INSERT INTO public."HomeSeasonalChecklistItem"(id,home_id,season_key,year,item_key,title) VALUES('+lit(items[i])+','+lit(h)+",'fall_prep',2026,'fixture_"+str(i)+"','Private summary race');"
 w.run(query+' COMMIT;');setup=True
 def scope(i,change):return 'SELECT id FROM public."Home" WHERE id='+lit(homes[i])+' FOR UPDATE; '+change
 race(0,'reviewer revoked',scope(0,'UPDATE public."HomeOccupancy" SET is_active=false WHERE home_id='+lit(homes[0])+';'),'HOME_CHECKLIST_DENIED')
 race(1,'explicit edit deny',scope(1,'INSERT INTO public."HomePermissionOverride"(home_id,user_id,permission,allowed) VALUES('+lit(homes[1])+','+lit(actor)+",'home.edit',false);"),'HOME_CHECKLIST_DENIED')
 race(2,'Home frozen',scope(2,'UPDATE public."Home" SET security_state=\'frozen\' WHERE id='+lit(homes[2])+';'),'HOME_CHECKLIST_DENIED')
 race(3,'membership expires during wait',scope(3,'UPDATE public."HomeOccupancy" SET end_at=clock_timestamp()+interval \'300 milliseconds\' WHERE home_id='+lit(homes[3])+';'),'HOME_CHECKLIST_DENIED',.5)
 race(4,'minor ceiling changed',scope(4,'UPDATE public."HomeOccupancy" SET age_band=\'child\' WHERE home_id='+lit(homes[4])+';'),'HOME_CHECKLIST_DENIED')
 race(5,'ownership explicitly revoked',scope(5,'INSERT INTO public."HomeOwner"(home_id,subject_id,owner_status) VALUES('+lit(homes[5])+','+lit(actor)+",'revoked');"),'HOME_CHECKLIST_DENIED')
 if settings:
  w.run('INSERT INTO public."HomePreference"(home_id) VALUES('+lit(homes[6])+');')
  w.run('UPDATE public."HomeOccupancy" SET end_at=clock_timestamp()+interval \'800 milliseconds\' WHERE home_id='+lit(homes[6])+';')
  race(6,'membership expires while preference row is locked','SELECT id FROM public."HomePreference" WHERE home_id='+lit(homes[6])+' FOR UPDATE;','HOME_SETTINGS_DENIED',1)
  assert passes==7
 else:
  race(6,'item already skipped while waiting','UPDATE public."HomeSeasonalChecklistItem" SET status=\'skipped\' WHERE id='+lit(items[6])+';','HOME_CHECKLIST_CHANGED')
  race(7,'item moved to another Home while waiting','UPDATE public."HomeSeasonalChecklistItem" SET home_id='+lit(homes[9])+' WHERE id='+lit(items[7])+';','HOME_CHECKLIST_NOT_FOUND')
  assert passes==8

finally:
 try:
  if w.p.poll() is None: w.run('ROLLBACK;')
  if l.p.poll() is None: l.run('ROLLBACK;')
  if setup:
   if w.p.poll() is not None: w=Conn('cleanup')
   w.run('BEGIN; DELETE FROM public."HomeAuditLog" WHERE home_id IN ('+ids+'); DELETE FROM public."HomeSeasonalChecklistItem" WHERE id IN ('+','.join(map(lit,items))+'); DELETE FROM public."HomePermissionOverride" WHERE home_id IN ('+ids+'); DELETE FROM public."HomeOwner" WHERE home_id IN ('+ids+'); DELETE FROM public."HomeOccupancy" WHERE home_id IN ('+ids+'); DELETE FROM public."Home" WHERE id IN ('+ids+'); DELETE FROM public."User" WHERE id='+lit(actor)+'; DELETE FROM auth.users WHERE id='+lit(actor)+'; COMMIT;')
   assert w.run('SELECT (SELECT count(*) FROM public."Home" WHERE id IN ('+ids+'))+(SELECT count(*) FROM auth.users WHERE id='+lit(actor)+');')==['0']
   print('PASS: exact summary race fixtures cleaned',flush=True)
 finally:w.close();l.close();log.close()
