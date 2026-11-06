import re
PAT = {
    "year_built": re.compile(r"year.{0,22}built|built.{0,6}(yr|year)|(^|[^a-z])yr.{0,3}(blt|built|bt)|yrblt|yearblt|act.{0,3}yr|eff.{0,4}yr|year.{0,3}(const|constr|blt)|yr.{0,3}(const|constr)|^ayb$|^eyb$|yrbuilt|bldg.{0,3}yr|original.{0,3}year|imp.{0,3}yr", re.I),
    "size": re.compile(r"(living|liv|lvg|heated|htd|finish|fin|bldg|building|gross|total|tot|main|above.{0,3}grade|res|improvement|imprv|floor|property)[ _]?(area|sq|sf|sqft|square)|sq.{0,2}f(ee)?t|sqft|square.{0,2}f(ee|oo)t|^sf$|(^|[^a-z])gla($|[^a-z])|living.{0,3}area|bldg.{0,3}size|area.{0,3}liv|liv.{0,3}area|tla($|[^a-z])|heatedarea|sfla", re.I),
    "beds": re.compile(r"bed.?room|(^|[^a-z])beds?($|[^a-z])|bdrm|bedrm|(^|[^a-z])br($|[^a-z])|num.{0,3}br($|[^a-z])|nbr.{0,3}bed|no.{0,3}bed|rmbed|bed_?cnt|bedcount", re.I),
    "baths": re.compile(r"bath|(^|[^a-z])bth|fbath|hbath|full.{0,3}b($|[^a-z])|half.{0,3}b($|[^a-z])|(^|[^a-z])(fb|hb|ba)($|[^a-z])|plumb", re.I),
    "sale_price": re.compile(r"sale.{0,6}(pr|price|amt|amount|val)|saleprice|saleamt|consideration|deed.{0,3}price|transfer.{0,3}(amt|price)|sale_?prc|price", re.I),
    "value": re.compile(r"(assess|assd|appr|apprais|market|mkt|land|impr|imp|bldg|total|tot|just|taxable|full|fmv|cert|net)[ _]?(val|value|amt)|av.?total|mktval|assdval|(^|[^a-z])jv($|[^a-z])|totval|appraised|assessed|valuation", re.I),
}
NEG = re.compile(r"bedrock|flowerbed|riverbed|seabed|streambed|bathymetr|embedded", re.I)
def score(names):
    names = [str(n) for n in names if n]
    hits = {}
    for k, p in PAT.items():
        m = [n for n in names if p.search(n) and not NEG.search(n)]
        if m:
            hits[k] = sorted(set(m))[:4]
    return hits
def level(h):
    if "year_built" in h and "size" in h and ("beds" in h or "baths" in h):
        return "FULL"
    if "year_built" in h or "size" in h:
        return "CORE"
    if h:
        return "PARCEL"
    return "NONE"
