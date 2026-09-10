const db = require('../__mocks__/supabaseAdmin');
jest.mock('../../services/homeRecordService', () => ({ visibleRecords: jest.fn() }));
const records = require('../../services/homeRecordService');
const { collectInternalContext } = require('../../services/context/internalContextCollector');
beforeEach(() => { db.resetTables(); jest.clearAllMocks(); });
test('briefing labels use current record projections, canonical status and a narrow DTO', async () => {
  const soon = new Date(Date.now()+3600000).toISOString();
  records.visibleRecords.mockImplementation(async ({kind}) => kind==='task'
    ? [{id:'visible',home_id:'home',title:'Visible task',status:'open',due_at:soon,details:{private:'omit'}},
      {id:'done',title:'Completed task',status:'done',due_at:soon}]
    : [{id:'event',title:'Visible event',event_type:'other',start_at:soon,end_at:null,description:'omit'}]);
  const from=jest.spyOn(db,'from');
  const result=await collectInternalContext('actor','home');
  expect(result.tasks_due).toEqual([expect.objectContaining({id:'visible',title:'Visible task'})]);
  expect(result.tasks_due[0]).not.toHaveProperty('details');
  expect(result.calendar_events).toEqual([expect.objectContaining({id:'event',title:'Visible event'})]);
  expect(result.calendar_events[0]).not.toHaveProperty('description');
  expect(records.visibleRecords).toHaveBeenCalledWith(expect.objectContaining({homeId:'home',actorId:'actor',kind:'task'}));
  expect(records.visibleRecords).toHaveBeenCalledWith(expect.objectContaining({homeId:'home',actorId:'actor',kind:'event'}));
  expect(from.mock.calls.map(([table])=>table)).not.toEqual(expect.arrayContaining(['HomeTask','HomeCalendarEvent']));
  from.mockRestore();
});
test('briefing cannot quietly cache a result after record authority lookup failure', async () => {
  records.visibleRecords.mockRejectedValue(Object.assign(new Error('Retry'),{code:'HOME_RECORD_UNAVAILABLE',statusCode:503}));
  await expect(collectInternalContext('actor','home')).rejects.toMatchObject({code:'HOME_RECORD_UNAVAILABLE',statusCode:503});
});
