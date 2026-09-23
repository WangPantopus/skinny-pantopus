# route-blocks.py <file> <start_line> -> prints each top-level `case .x` block in the destination switch with back-ish evidence
import re,sys
f,start=sys.argv[1],int(sys.argv[2])
lines=open(f).read().split('\n')
# find 'switch route {' after start
i=start-1
while 'switch route' not in lines[i]: i+=1
base_indent=len(lines[i+1])-len(lines[i+1].lstrip())
blocks=[];cur=None
depth=0
for j in range(i+1,len(lines)):
    l=lines[j]
    ind=len(l)-len(l.lstrip())
    if l.strip()=='}' and ind<base_indent: break
    m=re.match(r'\s*case\s+(.*):\s*$',l) or re.match(r'\s*case\s+(let\s+)?\.(.*?):',l)
    if ind==base_indent and l.strip().startswith('case ') :
        if cur: blocks.append(cur)
        cur={'line':j+1,'head':l.strip(),'body':[]}
    elif ind==base_indent and l.strip().startswith('default'):
        if cur: blocks.append(cur)
        cur={'line':j+1,'head':'default','body':[]}
    elif cur is not None:
        cur['body'].append(l)
if cur: blocks.append(cur)
for b in blocks:
    body='\n'.join(b['body'])
    names=re.findall(r'\.([a-zA-Z0-9]+)',b['head'].split(':')[0])
    view=re.search(r'([A-Z][A-Za-z0-9]+)\(',body)
    back=[]
    for k in ['onBack:','onClose:','onCancel:','onDismiss:','{ pop() }','{ Task { @MainActor in pop() } }','path.removeLast()','onDone:','onExit:']:
        if k in body: back.append(k)
    trailing=re.search(r'\)\s*\{\s*(Task \{ @MainActor in )?pop\(\)',body) or re.search(r'\)\s*\{ if !path\.isEmpty \{ path\.removeLast\(\) \} \}',body)
    if trailing: back.append('trailing-pop')
    hides='toolbar(.hidden' in body
    print(f"{b['line']}\t{','.join(names)}\t{view.group(1) if view else '-'}\t{' '.join(back) or 'NO-BACK-ARG'}\t{'HIDES' if hides else ''}")
