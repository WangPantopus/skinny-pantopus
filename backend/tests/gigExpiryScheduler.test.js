// Exercise actual scheduler exports with timers/jobs replaced, never start real jobs.
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
function load(name) {
 const registered=[]; const jobs=new Map(); const module={ exports: {} };
 const context={ module, process: { env: { NODE_ENV: 'development' } }, require: id => {
  if (id==='node-cron') return { schedule: jest.fn((expression, fn) => registered.push({ expression, fn })) };
  if (id==='../utils/logger') return { info: jest.fn(), error: jest.fn() };
  if (id==='../config/householdClaims') return { jobs: { dryRun: true } };
  const fn=jest.fn(); jobs.set(id,fn);
  return Object.assign(fn, { runSupportTrainReminders: fn, runBookingReminders: fn, checkAndAlertStuckPayments: fn });
 } };
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../jobs',name),'utf8'),context);
 return { api: module.exports, registered, jobs };
}
test('cron fallback keeps daily bookings and independent frequent Gig discovery/delivery', async () => {
 const { api, registered, jobs }=load('index.js');api.startJobs();
 const find=name=>registered.filter(x=>x.fn.jobName===name);
 expect(find('expireUncapturedAuthorizations').map(x=>x.expression)).toEqual(['0 3 * * *']);
 expect(find('reconcileGigAuthorizationExpiry').map(x=>x.expression)).toEqual(['*/15 * * * *']);
 expect(find('deliverGigAuthorizationExpiry').map(x=>x.expression)).toEqual(['* * * * *']);
 expect(find('deliverGigStop').map(x=>x.expression)).toEqual(['* * * * *']);
 expect(find('reconcileGigStop').map(x=>x.expression)).toEqual(['*/5 * * * *']);
 jobs.get('./reconcileGigAuthorizationExpiry').mockRejectedValue(new Error('Unavailable'));
 await find('reconcileGigAuthorizationExpiry')[0].fn();
 await find('deliverGigAuthorizationExpiry')[0].fn();
 expect(jobs.get('./deliverGigAuthorizationExpiry')).toHaveBeenCalledTimes(1);
});
test('pg-boss ownership suppresses both duplicate fallback schedulers without suppressing daily bookings', () => {
 const { api, registered }=load('index.js');api.startJobs({ skipPgBossBackedJobs: true });
 expect(registered.some(x=>x.fn.jobName==='reconcileGigAuthorizationExpiry')).toBe(false);
 expect(registered.some(x=>x.fn.jobName==='deliverGigAuthorizationExpiry')).toBe(false);
 expect(registered.some(x=>x.fn.jobName==='deliverGigStop')).toBe(false);
 expect(registered.some(x=>x.fn.jobName==='reconcileGigStop')).toBe(false);
 expect(registered.some(x=>x.fn.jobName==='expireUncapturedAuthorizations')).toBe(true);
});
test('pg-boss registers independent singleton queues and preserves retryable delivery failure', async () => {
 const { api, jobs }=load('pgBossJobs.js');const workers=new Map();
 const boss={createQueue:jest.fn(),schedule:jest.fn(),work:jest.fn(async(name,options,fn)=>workers.set(name,fn))};
 await api.registerPgBossJobs(boss);
 expect(boss.schedule).toHaveBeenCalledWith('reconcile-gig-authorization-expiry','*/15 * * * *',null,expect.objectContaining({singletonKey:'reconcile-gig-authorization-expiry'}));
 expect(boss.schedule).toHaveBeenCalledWith('deliver-gig-authorization-expiry','* * * * *',null,expect.objectContaining({singletonKey:'deliver-gig-authorization-expiry'}));
 expect(boss.createQueue).toHaveBeenCalledWith('deliver-gig-authorization-expiry',expect.objectContaining({policy:'singleton',retryDelay:30}));
 expect(boss.schedule).toHaveBeenCalledWith('deliver-gig-stop','* * * * *',null,expect.objectContaining({singletonKey:'deliver-gig-stop'}));
 expect(boss.schedule).toHaveBeenCalledWith('reconcile-gig-stop','*/5 * * * *',null,expect.objectContaining({singletonKey:'reconcile-gig-stop'}));
 expect(boss.createQueue).toHaveBeenCalledWith('deliver-gig-stop',expect.objectContaining({policy:'singleton',retryDelay:30}));
 jobs.get('./deliverGigAuthorizationExpiry').mockRejectedValue(new Error('Unknown acknowledgement'));
 await expect(workers.get('deliver-gig-authorization-expiry')([{id:'synthetic'}])).rejects.toThrow('Unknown acknowledgement');
});
