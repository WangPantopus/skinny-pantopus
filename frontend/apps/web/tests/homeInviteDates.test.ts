import { homeInviteDates } from '../src/lib/homeInviteDates';

test.each(['2026-03-08','2026-11-01','2026-12-31'])('inclusive %s is an actual local calendar day, including DST and year boundaries', day => {
 const [year,month,date]=day.split('-').map(Number);
 expect(homeInviteDates(day,day)).toEqual({start_at:new Date(year,month-1,date).toISOString(),end_at:new Date(year,month-1,date+1).toISOString()});
});
test.each(['2026-02-30','bad','2026-13-01'])('invalid %s cannot silently normalize into access', day => {
 expect(()=>homeInviteDates(day,'')).toThrow('valid access date');
});
test('empty bounds stay omitted and backwards dates are rejected',()=>{
 expect(homeInviteDates('','')).toEqual({start_at:undefined,end_at:undefined});
 expect(()=>homeInviteDates('2026-05-02','2026-05-01')).toThrow('on or after');
});
