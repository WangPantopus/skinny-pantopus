// Current household/currency/month comparison fixture on the owned local DB.
module.exports = function(container) {
  const f = require('./home-residency-review-http-fixture.cjs')(container, { summary: true, place: true, dashboard: true });
  const { sql, q, id, home, actor } = f;
  const homes = [home, ...Array.from({ length: 9 }, (_, i) => id(830+i))];
  const bills = Array.from({ length: 15 }, (_, i) => id(850+i));
  let initialized = false;
  const month = offset => sql(`SELECT to_char(date_trunc('month',CURRENT_DATE)-interval '${offset} month','YYYY-MM');`);
  function setup() {
    f.setup(); initialized = true;
    const current = month(1), previous = month(2);
    sql(`BEGIN; UPDATE public."Home" SET location=ST_SetSRID(ST_MakePoint(0,0),4326),map_center_lat=0,map_center_lng=0 WHERE id=${q(home)};
      INSERT INTO public."Home"(id,owner_id,address,city,state,zipcode,location,map_center_lat,map_center_lng)
        VALUES ${homes.slice(1).map(h => `(${q(h)},${q(actor)},'Private current-bill fixture','Test','WA','98607',ST_SetSRID(ST_MakePoint(0,0),4326),0,0)`).join(',')};
      INSERT INTO public."HomePreference"(home_id,settings) VALUES ${homes.map(h => `(${q(h)},'{"bill_benchmark_opt_in":true}')`).join(',')};
      INSERT INTO public."HomeBill"(id,home_id,created_by,bill_type,amount,currency,status,period_start)
        VALUES ${homes.map((h,i) => `(${q(bills[i])},${q(h)},${q(actor)},'electric',${i === 0 ? '71.25' : '100.50'},'USD','paid',${q(current+'-01')})`).join(',')},
          (${q(bills[10])},${q(home)},${q(actor)},'electric',71.25,'USD','paid',${q(current+'-01')}),
          (${q(bills[11])},${q(home)},${q(actor)},'electric',999.99,'CAD','paid',${q(current+'-01')}),
          (${q(bills[12])},${q(home)},${q(actor)},'electric',210.25,'USD','paid',${q(previous+'-01')}),
          (${q(bills[13])},${q(home)},${q(actor)},'electric',987.65,'USD','due',${q(current+'-01')}),
          (${q(bills[14])},${q(home)},${q(actor)},'electric',987.65,'USD','paid',(CURRENT_DATE-interval '3 years')::date);
      COMMIT;`);
    return { current, previous };
  }
  function cleanup() {
    if (!initialized) return;
    sql(`BEGIN; DELETE FROM public."HomeBill" WHERE home_id IN (${homes.map(q)});
      DELETE FROM public."HomeSeasonalChecklistItem" WHERE home_id=${q(home)};
      DELETE FROM public."Home" WHERE id IN (${homes.slice(1).map(q)}); COMMIT;`);
    f.cleanup(); initialized = false;
  }
  return { ...f, homes, bills, setup, cleanup, month };
};
