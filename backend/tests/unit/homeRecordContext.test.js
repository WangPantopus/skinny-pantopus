const db = require('../__mocks__/supabaseAdmin');
jest.mock('../../services/homeRecordService', () => ({ visibleRecords: jest.fn() }));
const records = require('../../services/homeRecordService');
const { collectInternalContext } = require('../../services/context/internalContextCollector');
beforeEach(() => { db.resetTables(); jest.clearAllMocks(); });
test('briefing labels use current record projections, canonical status and a narrow DTO', async () => {
  const permissions=require('../../utils/homePermissions');
  const homes=require('../../services/homeListService');
  db.seedTable('Home', [{id:'home',owner_id:'owner',home_status:'active',security_state:'normal'}]);
  let contextPrivate=false;
  db.setRpcMock(async (name, {p_home_id,p_user_id}) => {
    const access=await permissions.getUserAccess(p_home_id,p_user_id);
    return {data:{allowed:access.hasAccess,private:contextPrivate,permissions:access.permissions,role:access.effective_role_base,user_id:p_user_id},error:null};
  });
  const soon = new Date(Date.now()+3600000).toISOString();
  records.visibleRecords.mockImplementation(async ({kind}) => kind==='task'
    ? [{id:'visible',home_id:'home',title:'Visible task',status:'open',due_at:soon,details:{private:'omit',suggestion:'radon_test'}},
      {id:'done',title:'Completed task',status:'done',due_at:soon}]
    : [{id:'event',title:'Visible event',event_type:'other',start_at:soon,end_at:null,description:'omit'}]);
  const from=jest.spyOn(db,'from');
  const result=await collectInternalContext('actor','home');
  expect(result.tasks_due).toEqual([expect.objectContaining({id:'visible',title:'Visible task'})]);
  expect(result.tasks_due[0]).not.toHaveProperty('details');
  expect(result.tasks_due[0].is_suggestion).toBe(true);
  expect(result.calendar_events).toEqual([expect.objectContaining({id:'event',title:'Visible event'})]);
  expect(result.calendar_events[0]).not.toHaveProperty('description');
  expect(records.visibleRecords).toHaveBeenCalledWith(expect.objectContaining({homeId:'home',actorId:'actor',kind:'task'}));
  expect(records.visibleRecords).toHaveBeenCalledWith(expect.objectContaining({homeId:'home',actorId:'actor',kind:'event'}));
  expect(from.mock.calls.map(([table])=>table)).not.toEqual(expect.arrayContaining(['HomeTask','HomeCalendarEvent']));
  // Bill context must observe the same per-home finance read fence as the
  // bills route, even for an explicit Hub anchor or an active occupancy.
  db.seedTable('HomeBill', [{id:'bill',home_id:'home',provider_name:'Private bill provider',amount:144.72,currency:'USD',due_date:soon,status:'due'}]);
  for (const [role,verification] of [['guest','verified'],['service_provider','verified'],['member','unverified'],['member','verified']]) {
    db.seedTable('HomeOccupancy', [{id:'33333333-3333-4333-8333-333333333333',home_id:'home',user_id:'actor',role_base:role,is_active:true,verification_status:verification}]);
    from.mockClear();
    expect((await collectInternalContext('actor','home')).bills_due).toEqual([]);
    expect(from.mock.calls.map(([table])=>table)).not.toContain('HomeBill');
  }
  db.seedTable('HomeRolePermission', [{role_base:'member',permission:'finance.view',allowed:true},{role_base:'member',permission:'home.view',allowed:true}]);
  expect((await collectInternalContext('actor','home')).bills_due).toEqual([expect.objectContaining({id:'bill',amount:144.72})]);
  db.seedTable('HomePermissionOverride', [{home_id:'home',user_id:'actor',permission:'finance.view',allowed:false}]);
  expect((await collectInternalContext('actor','home')).bills_due).toEqual([]);
  db.seedTable('HomeOccupancy', []);
  // Preserve the existing bills route's admitted owner behavior.
  expect((await collectInternalContext('owner','home')).bills_due).toEqual([expect.objectContaining({id:'bill'})]);
  for (const [home_status,security_state] of [['active','frozen'],['active','frozen_silent'],['active','disputed'],['archived','normal'],['merged','normal']]) {
    db.seedTable('Home', [{id:'home',owner_id:'owner',home_status,security_state}]);
    from.mockClear();
    expect((await collectInternalContext('owner','home')).bills_due).toEqual([]);
    expect(from.mock.calls.map(([table])=>table)).not.toContain('HomeBill');
  }
  db.seedTable('Home', [{id:'home',owner_id:'owner',created_by_user_id:'owner',home_status:'active',security_state:'normal'}]);
  db.seedTable('HomeOwner', [{id:'44444444-4444-4444-8444-444444444444',home_id:'home',subject_id:'owner',subject_type:'user',owner_status:'revoked',is_primary_owner:false}]);
  expect((await collectInternalContext('owner','home')).bills_due).toEqual([]);
  db.seedTable('HomeOwner', []);
  contextPrivate=true;
  expect((await collectInternalContext('owner','home')).bills_due).toEqual([]);
  contextPrivate=false;
  const policy=jest.spyOn(homes,'readAccessState');
  const opening=await homes.readAccessState('home','owner');
  policy.mockResolvedValueOnce(opening).mockResolvedValueOnce({...opening,mode:'denied'});
  await expect(collectInternalContext('owner','home')).rejects.toMatchObject({code:'HOME_LIST_ACCESS_CHANGED'});
  policy.mockRejectedValueOnce(permissions.accessUnavailable());
  await expect(collectInternalContext('owner','home')).rejects.toMatchObject({code:'HOME_ACCESS_UNAVAILABLE'});
  policy.mockRestore();
  const launch=process.env.LAUNCH_FEATURES;
  process.env.LAUNCH_FEATURES='';
  from.mockClear();
  expect((await collectInternalContext('owner','home')).bills_due).toEqual([]);
  expect(from.mock.calls.map(([table])=>table)).not.toContain('HomeBill');
  process.env.LAUNCH_FEATURES=launch;
  from.mockRestore();
});
test('briefing cannot quietly cache a result after record authority lookup failure', async () => {
  db.seedTable('Home', [{id:'home',owner_id:'owner',home_status:'active',security_state:'normal'}]);
  db.setRpcMock(async () => ({data:{allowed:false,private:false,permissions:[]},error:null}));
  records.visibleRecords.mockRejectedValue(Object.assign(new Error('Retry'),{code:'HOME_RECORD_UNAVAILABLE',statusCode:503}));
  await expect(collectInternalContext('actor','home')).rejects.toMatchObject({code:'HOME_RECORD_UNAVAILABLE',statusCode:503});
});
