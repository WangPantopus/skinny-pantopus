(function(){
  var KEY='pantopus-prompt-pack-sent-v3', sent={};
  try{ sent=JSON.parse(localStorage.getItem(KEY)||'{}')||{}; }catch(e){ sent={}; }
  function save(){ try{ localStorage.setItem(KEY, JSON.stringify(sent)); }catch(e){} }
  var boxes=[].slice.call(document.querySelectorAll('.sent input'));
  function paint(){
    var n=0;
    boxes.forEach(function(b){ var on=!!sent[b.dataset.id]; b.checked=on; b.closest('.pr').classList.toggle('is-sent',on); if(on)n++; });
    var el=document.getElementById('sentN'); if(el) el.textContent=n;
  }
  boxes.forEach(function(b){ b.addEventListener('change',function(){ if(b.checked) sent[b.dataset.id]=1; else delete sent[b.dataset.id]; save(); paint(); filter(); }); });
  document.addEventListener('click',function(ev){
    var t=ev.target.closest('.tog');
    if(t){ var body=document.getElementById(t.getAttribute('aria-controls')); if(!body) return;
      var open=body.hidden; body.hidden=!open; t.setAttribute('aria-expanded',String(open)); t.textContent=open?'Hide':'Show'; return; }
    var c=ev.target.closest('.copy');
    if(c){ var pre=document.getElementById('b-'+c.dataset.t); if(!pre) return;
      var label=c.textContent, text=pre.textContent;
      var done=function(ok){ c.textContent=ok?'Copied':'Select to copy'; c.classList.add(ok?'done':'fail');
        if(!ok){ pre.hidden=false; try{ var r=document.createRange(); r.selectNodeContents(pre); var s=window.getSelection(); s.removeAllRanges(); s.addRange(r);}catch(e){} }
        setTimeout(function(){ c.textContent=label; c.classList.remove('done','fail'); },1800); };
      try{ if(navigator.clipboard&&navigator.clipboard.writeText){ navigator.clipboard.writeText(text).then(function(){done(true);},function(){done(false);}); } else done(false); }catch(e){ done(false); }
    }
  });
  var q=document.getElementById('q'), fp=document.getElementById('fp'), ft=document.getElementById('ft'), hs=document.getElementById('hs'), shown=document.getElementById('shown');
  var rows=[].slice.call(document.querySelectorAll('.pr'));
  var idx=rows.map(function(r){ return (r.querySelector('h3').textContent+' '+r.id+' '+(r.querySelector('.job')||{}).textContent+' '+r.querySelector('pre').textContent).toLowerCase(); });
  function filter(){
    var term=(q.value||'').trim().toLowerCase(), p=fp.value, t=ft.value, hide=hs.checked, n=0;
    rows.forEach(function(r,i){
      var ok=(!term||idx[i].indexOf(term)>-1)&&(!p||(' '+r.dataset.plat+' ').indexOf(' '+p+' ')>-1)&&(!t||r.dataset.type===t)&&!(hide&&sent[r.id]);
      r.hidden=!ok; if(ok)n++;
    });
    [].forEach.call(document.querySelectorAll('.grp'),function(g){ g.hidden=!g.querySelector('.pr:not([hidden])'); });
    shown.textContent=(term||p||t||hide)?(n+' of '+rows.length+' shown'):'';
  }
  [q,fp,ft,hs].forEach(function(el){ el.addEventListener('input',filter); el.addEventListener('change',filter); });
  paint(); filter();
})();
