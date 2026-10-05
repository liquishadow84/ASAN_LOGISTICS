
(()=>{
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const txt=el=>(el?.textContent||'').replace(/\s+/g,' ').trim();
const LS='ifa-fx',st=Object.assign({noleft:false,noright:false,focus:false,dense:false,dh:null},JSON.parse(localStorage.getItem(LS)||'{}'));
const save=()=>localStorage.setItem(LS,JSON.stringify(st));
const I={
search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
focus:'<path d="M4 9V5a1 1 0 0 1 1-1h4M15 4h4a1 1 0 0 1 1 1v4M20 15v4a1 1 0 0 1-1 1h-4M9 20H5a1 1 0 0 1-1-1v-4"/>',
left:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/>',
right:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M15 4v16"/>',
dense:'<path d="M4 6h16M4 10h16M4 14h16M4 18h16"/>',
chain:'<circle cx="5" cy="6" r="2.2"/><circle cx="19" cy="6" r="2.2"/><circle cx="12" cy="18" r="2.2"/><path d="M7.2 6h9.6M6.2 8l4.6 8M17.8 8l-4.6 8"/>',
opt:'<circle cx="5" cy="18" r="2.2"/><circle cx="19" cy="6" r="2.2"/><path d="M7 17c5-1 3-9 10-10"/>',
cost:'<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
load:'<path d="M3 8l9-4 9 4v8l-9 4-9-4z"/><path d="M3 8l9 4 9-4M12 12v8"/>',
intel:'<ellipse cx="12" cy="5.5" rx="7.5" ry="2.8"/><path d="M4.5 5.5v6c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8v-6M4.5 11.5v6c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8v-6"/>',
keys:'<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/>'};
const svg=k=>`<svg viewBox="0 0 24 24">${I[k]}</svg>`;
const root=document.createElement('div');root.className='fx-root';document.body.appendChild(root);
const isMac=/Mac|iPhone|iPad/.test(navigator.platform);const MOD=isMac?'⌘':'Ctrl';

/* toast */
const toasts=document.createElement('div');toasts.className='fx-toasts';root.appendChild(toasts);
const toast=m=>{const t=document.createElement('div');t.className='fx-toast';t.textContent=m;toasts.appendChild(t);setTimeout(()=>t.remove(),2500)};

/* layout state */
function apply(){const b=document.body.classList;b.toggle('fx-noleft',st.noleft);b.toggle('fx-noright',st.noright);b.toggle('fx-focus',st.focus);b.toggle('fx-dense',st.dense);
 if(st.dh)document.documentElement.style.setProperty('--drawer-h',st.dh+'px');else document.documentElement.style.removeProperty('--drawer-h');
 $$('.fx-tools button[data-k]').forEach(b=>b.classList.toggle('on',!!st[b.dataset.k]));save();
 setTimeout(()=>window.dispatchEvent(new Event('resize')),420);}
const act={
 focus(){st.focus=!st.focus;apply();toast(st.focus?'حالت تمرکز روی نقشه فعال شد':'حالت تمرکز غیرفعال شد')},
 noleft(){st.noleft=!st.noleft;apply()},noright(){st.noright=!st.noright;apply()},
 dense(){st.dense=!st.dense;apply();toast(st.dense?'نمای فشرده':'نمای عادی')},
 resetH(){st.dh=null;apply();toast('ارتفاع پنل نتایج بازنشانی شد')},
 palette:()=>openPalette(),help:()=>openHelp(),chain:()=>window.__CHAIN&&window.__CHAIN.open(),opt:()=>window.__STUDIO&&window.__STUDIO.open('opt'),cost:()=>window.__STUDIO&&window.__STUDIO.open('cost'),load:()=>window.__STUDIO&&window.__STUDIO.open('load'),intel:()=>window.__STUDIO&&window.__STUDIO.open('intel')};

/* side tools */
const tools=document.createElement('div');tools.className='fx-tools';
[['palette','search','جستجوی دستورها',MOD+' K'],['chain','chain','استودیوی زنجیرهٔ فریت فورواردینگ','C'],['opt','opt','بهینه‌ساز مسیر','O'],['cost','cost','هزینهٔ کامل زنجیره','M'],['load','load','چیدمان سه‌بعدی کانتینر','L'],['intel','intel','اطلس داده‌ها','I'],['focus','focus','حالت تمرکز','F'],['noleft','left','نمایش/پنهان لایه‌ها','['],['noright','right','نمایش/پنهان پنل جستجو',']'],['dense','dense','نمای فشرده','D'],['help','keys','میانبرهای صفحه‌کلید','?']].forEach(([k,ic,t,key])=>{
 const b=document.createElement('button');b.innerHTML=svg(ic);b.title=t+' · '+key;b.setAttribute('aria-label',t);if(k in st)b.dataset.k=k;b.onclick=()=>act[k]();tools.appendChild(b)});
root.appendChild(tools);
const sbtn=document.createElement('button');sbtn.className='fx-search';sbtn.innerHTML=svg('search')+'<span>جستجو و فرمان…</span><kbd>'+MOD+' K</kbd>';sbtn.onclick=()=>openPalette();root.appendChild(sbtn);
const rz=document.createElement('div');rz.className='fx-resize';rz.title='برای تغییر ارتفاع بکشید · دوبار کلیک برای بازنشانی';root.appendChild(rz);
const status=document.createElement('div');status.className='fx-status';root.appendChild(status);

/* position loop */
let lastSel='';
function place(){
 const mt=$('.map-tools'),dr=$('.drawer'),tb=$('.topbar .actions'),kp=$('.topbar .kpis');
 if(mt){const r=mt.getBoundingClientRect();tools.style.left=r.left+'px';tools.style.top=(r.bottom+6)+'px';tools.style.display=r.width?'flex':'none'}
 if(tb){const r=tb.getBoundingClientRect();sbtn.style.top=(r.top+(r.height-28)/2)+'px';sbtn.style.left=(r.right+8)+'px';
   sbtn.style.visibility=innerWidth>1180?'visible':'hidden';
   if(innerWidth>1180&&kp)kp.style.paddingLeft=(sbtn.offsetWidth+8)+'px'; else if(kp)kp.style.paddingLeft='';}
 if(dr){const r=dr.getBoundingClientRect();const show=!dr.classList.contains('collapsed')&&!st.focus&&innerWidth>860;rz.style.display=show?'flex':'none';rz.style.left=r.left+'px';rz.style.width=r.width+'px';rz.style.top=(r.top-6)+'px';
   status.style.left=(r.left+4)+'px';status.style.top=(r.top-18)+'px';}
 status.style.display='none';
 requestAnimationFrame(place)}
requestAnimationFrame(place);

/* drawer resize */
rz.addEventListener('pointerdown',e=>{e.preventDefault();rz.setPointerCapture(e.pointerId);rz.classList.add('drag');document.body.classList.add('fx-resizing');
 const mv=ev=>{const h=Math.max(150,Math.min(innerHeight*0.7,innerHeight-ev.clientY-10));st.dh=Math.round(h);document.documentElement.style.setProperty('--drawer-h',st.dh+'px')};
 const up=()=>{rz.classList.remove('drag');document.body.classList.remove('fx-resizing');rz.removeEventListener('pointermove',mv);rz.removeEventListener('pointerup',up);save();window.dispatchEvent(new Event('resize'))};
 rz.addEventListener('pointermove',mv);rz.addEventListener('pointerup',up)});
rz.addEventListener('dblclick',act.resetH);

/* tooltips */
const tip=document.createElement('div');tip.className='fx-tip';root.appendChild(tip);let tipEl=null,tipT=0;
document.addEventListener('mouseover',e=>{const el=e.target.closest('[title],[data-fx-title]');if(!el||el===tipEl)return;hideTip();
 const t=el.getAttribute('title')||el.dataset.fxTitle;if(!t)return;el.dataset.fxTitle=t;el.removeAttribute('title');tipEl=el;
 tipT=setTimeout(()=>{tip.textContent=t;tip.classList.add('show');const r=el.getBoundingClientRect(),w=tip.offsetWidth,h=tip.offsetHeight;
  let x=r.left+r.width/2-w/2,y=r.bottom+6;if(y+h>innerHeight-6)y=r.top-h-6;x=Math.max(6,Math.min(innerWidth-w-6,x));tip.style.left=x+'px';tip.style.top=y+'px'},380)});
function hideTip(){clearTimeout(tipT);tip.classList.remove('show');if(tipEl&&tipEl.isConnected&&!tipEl.hasAttribute('title'))tipEl.setAttribute('title',tipEl.dataset.fxTitle);tipEl=null}
document.addEventListener('mouseout',e=>{if(tipEl&&!tipEl.contains(e.relatedTarget))hideTip()});
document.addEventListener('mousedown',hideTip,true);

/* enrich: KPI flash, route bars, wheel scroll */
let kpiPrev='';
const parseMoney=s=>{const m=s.replace(/[٬,]/g,'').match(/[\d.]+/);return m?parseFloat(m[0]):NaN};
function enrich(){
 const k=$('.kpis');if(k){const v=txt(k);if(kpiPrev&&v!==kpiPrev){$$('.kpi',k).forEach(x=>{x.classList.remove('flash');void x.offsetWidth;x.classList.add('flash')})}kpiPrev=v}
 const cards=$$('.rcard');if(cards.length){const ps=cards.map(c=>parseMoney(txt($('.price',c))));const mx=Math.max(...ps.filter(isFinite));
  cards.forEach((c,i)=>{if(isFinite(ps[i])&&mx){c.style.setProperty('--pbar',(ps[i]/mx*100).toFixed(1)+'%');if(!c.dataset.fxT){c.dataset.fxT=1}}});}
 const on=$('.rcard.on h3');const sel=on?txt(on):'';if(sel&&sel!==lastSel){lastSel=sel}
 const meta=$('.drawer-meta > span.num');status.textContent='';
 if(cards.length){const i=cards.findIndex(c=>c.classList.contains('on'));status.textContent=(i>=0?`${i+1}/${cards.length}`:'')+'  ←/→  ·  '+MOD+' K'}
 const car=$('.carousel');if(car&&!car.dataset.fxW){car.dataset.fxW=1;car.addEventListener('wheel',e=>{if(Math.abs(e.deltaY)>Math.abs(e.deltaX)){car.scrollLeft-=e.deltaY;e.preventDefault()}},{passive:false})}
}
new MutationObserver(()=>{cancelAnimationFrame(enrich._r);enrich._r=requestAnimationFrame(enrich)}).observe(document.getElementById('root'),{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['class']});

/* feedback toasts on app actions */
document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b||b.closest('.fx-root'))return;
 const l=b.getAttribute('aria-label')||b.dataset.fxTitle||b.title||'';
 if(/لینک/.test(l))toast('لینک اشتراک کپی شد');else if(/CSV/.test(l))toast('فایل CSV آماده شد');
 else if(b.matches('.panel .presets .chip'))toast('سناریو بارگذاری شد: '+txt(b));},true);

/* command palette */
let scrim=null;
function collect(){const C=[];const add=(g,label,run,ic='›',sub='')=>label&&C.push({g,label,run,ic,sub});
 if(window.__CHAIN){const CH=window.__CHAIN;[['map','نقشهٔ زنجیرهٔ عملیات'],['find','یابندهٔ اجزای زنجیره'],['plan','برنامهٔ اجرایی و مسیر بحرانی'],['docs','چک‌لیست اسناد مسیر'],['dir','ذی‌نفعان و پورتال‌های رسمی مسیر']].forEach(([v,t])=>add('زنجیرهٔ عملیات',t,()=>CH.open(v),'⛓','C'));CH.steps().forEach(st=>add('گام‌های زنجیره','گام '+(st.i+1)+': '+st.t,()=>CH.openStep(st.i),st.on?'●':'○',st.lane))}
 if(window.__STUDIO){const SX=window.__STUDIO;[['opt','بهینه‌ساز مسیر چندمعیاره (پارتو + مونت‌کارلو)','O'],['cost','هزینهٔ کامل زنجیره و ترکیب‌های هزینه','M'],['load','چیدمان سه‌بعدی کانتینر','L'],['intel','اطلس داده‌ها (۶ فایل اکسل)','I']].forEach(([v,t,k])=>add('استودیوی تحلیل',t,()=>SX.open(v),'◆',k));SX.extra().forEach(x=>add(x.g,x.t,x.run,'·',x.sub||''))}
 add('نما','حالت تمرکز روی نقشه',act.focus,'◎','F');add('نما','نمایش/پنهان لایه‌ها',act.noleft,'▏','[');add('نما','نمایش/پنهان پنل جستجو',act.noright,'▕',']');add('نما','نمای فشرده',act.dense,'≡','D');add('نما','بازنشانی ارتفاع نتایج',act.resetH,'↕');add('نما','میانبرهای صفحه‌کلید',act.help,'⌨','?');
 $$('.drawer .tab').forEach((b,i)=>add('نتایج','نمایش '+txt(b),()=>b.click(),'▤',String(i+1)));
 $$('.rcard').forEach(b=>add('مسیرها',txt($('h3',b))+' — '+txt($('.price',b)),()=>{b.click();b.scrollIntoView({behavior:'smooth',inline:'nearest',block:'nearest'})},'↗',txt($('.price+div',b))));
 $$('.panel .presets .chip').forEach(b=>add('سناریوهای آماده',txt(b),()=>b.click(),'✦'));
 $$('.panel .step').forEach(b=>add('پنل جستجو','مرحله: '+txt($('.t',b)),()=>{if(st.noright||st.focus){st.noright=false;st.focus=false;apply()}b.click()},'①'));
 $$('.mode-row[aria-pressed]').forEach(b=>add('لایه‌ها','لایهٔ '+txt(b).replace(/\d+$/,'').trim(),()=>b.click(),'━',b.getAttribute('aria-pressed')==='true'?'روشن':'خاموش'));
 $$('.corr-row').forEach(b=>add('کریدورها',txt(b),()=>b.click(),'⋯'));
 $$('.legend .seg button').forEach(b=>add('سبک نقشه','نقشهٔ '+txt(b),()=>b.click(),'◐'));
 $$('.topbar .seg button').forEach(b=>add('ارز','واحد پول '+txt(b),()=>b.click(),'$'));
 $$('.topbar .icon-btn,.drawer-meta .icon-btn,.map-tools .icon-btn').forEach(b=>{const l=b.getAttribute('aria-label')||b.dataset.fxTitle||b.title||txt(b);add('ابزارها',l,()=>b.click(),'⚙')});
 const pb=$('.play-btn');if(pb)add('پخش',pb.getAttribute('aria-label')||'پخش/توقف',()=>pb.click(),'▶','Space');
 return C}
const norm=s=>s.toLowerCase().replace(/[ي]/g,'ی').replace(/[ك]/g,'ک').replace(/\u200c/g,' ');
function score(q,l){if(!q)return 1;l=norm(l);const ws=norm(q).split(/\s+/).filter(Boolean);let s=0;for(const w of ws){const i=l.indexOf(w);if(i<0)return 0;s+=i===0?3:1}return s}
function hl(l,q){if(!q)return esc(l);let out=esc(l);norm(q).split(/\s+/).filter(Boolean).forEach(w=>{out=out.replace(new RegExp('('+w.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+')','i'),'<mark>$1</mark>')});return out}
const esc=s=>s.replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
function openPalette(){if(scrim)return close();hideTip();const all=collect();scrim=document.createElement('div');scrim.className='fx-scrim';
 scrim.innerHTML=`<div class="fx-pal" role="dialog" aria-label="جستجوی دستورها"><div class="fx-pal-in">${svg('search')}<input placeholder="جستجوی مسیر، سناریو، لایه، کریدور یا دستور…" aria-label="جستجو"><kbd>Esc</kbd></div><div class="fx-list" role="listbox"></div><div class="fx-foot"><span><kbd>↑</kbd><kbd>↓</kbd> حرکت</span><span><kbd>Enter</kbd> اجرا</span><span><kbd>Esc</kbd> بستن</span><span style="margin-inline-start:auto">${all.length} فرمان</span></div></div>`;
 root.appendChild(scrim);const inp=$('input',scrim),list=$('.fx-list',scrim);let items=[],sel=0;
 const render=()=>{const q=inp.value.trim();items=all.map(c=>({...c,s:score(q,c.g+' '+c.label)})).filter(c=>c.s>0&&(q||c.g!=='گام‌های زنجیره'));if(q)items.sort((a,b)=>b.s-a.s);if(q.length>5&&window.__STUDIO&&window.__STUDIO.nlq){try{const N=window.__STUDIO.nlq(q);if(N)items.unshift({g:'پرسش هوشمند',label:N.label,run:N.run,ic:'✦',sub:'Enter',s:999})}catch(e){}}items=items.slice(0,80);sel=Math.min(sel,Math.max(0,items.length-1));
  if(!items.length){list.innerHTML='<div class="fx-empty">نتیجه‌ای پیدا نشد</div>';return}
  let g='',h='';items.forEach((c,i)=>{if(c.g!==g&&!q){g=c.g;h+=`<div class="fx-grp">${esc(g)}</div>`}h+=`<div class="fx-it" role="option" data-i="${i}" aria-selected="${i===sel}"><span class="ic">${c.ic}</span><span>${hl(c.label,q)}</span><span class="sub">${q?esc(c.g)+' · ':''}${c.sub&&c.sub.length<4?'<kbd>'+esc(c.sub)+'</kbd>':esc(c.sub)}</span></div>`});list.innerHTML=h};
 const mark=()=>{$$('.fx-it',list).forEach(e=>e.setAttribute('aria-selected',+e.dataset.i===sel));$(`.fx-it[data-i="${sel}"]`,list)?.scrollIntoView({block:'nearest'})};
 const run=i=>{const c=items[i];if(!c)return;close();setTimeout(()=>c.run(),30)};
 inp.oninput=()=>{sel=0;render()};
 inp.onkeydown=e=>{if(e.key==='ArrowDown'){sel=Math.min(items.length-1,sel+1);mark();e.preventDefault()}else if(e.key==='ArrowUp'){sel=Math.max(0,sel-1);mark();e.preventDefault()}else if(e.key==='Enter'){run(sel);e.preventDefault()}else if(e.key==='Escape'){close();e.preventDefault()}};
 list.onmousemove=e=>{const it=e.target.closest('.fx-it');if(it&&+it.dataset.i!==sel){sel=+it.dataset.i;mark()}};
 list.onclick=e=>{const it=e.target.closest('.fx-it');if(it)run(+it.dataset.i)};
 scrim.onmousedown=e=>{if(e.target===scrim)close()};render();inp.focus()}
function close(){scrim?.remove();scrim=null}
function openHelp(){if(scrim)return close();const K=(...k)=>k.map(x=>`<kbd>${x}</kbd>`).join('');
 scrim=document.createElement('div');scrim.className='fx-scrim';scrim.innerHTML=`<div class="fx-help"><h3>میانبرهای صفحه‌کلید</h3><dl>
 <dt>استودیوی زنجیرهٔ عملیات</dt><dd>${K('C')}</dd><dt>بهینه‌ساز مسیر / هزینهٔ کامل</dt><dd>${K('O')} ${K('M')}</dd><dt>چیدمان کانتینر / اطلس داده</dt><dd>${K('L')} ${K('I')}</dd><dt>جستجوی دستورها</dt><dd>${K(MOD,'K')} ${K('/')}</dd><dt>حالت تمرکز روی نقشه</dt><dd>${K('F')}</dd><dt>پنهان کردن لایه‌ها / پنل جستجو</dt><dd>${K('[')} ${K(']')}</dd>
 <dt>نمای فشرده</dt><dd>${K('D')}</dd><dt>تب‌های نتایج</dt><dd>${K('1')}–${K('4')}</dd><dt>مسیر قبلی / بعدی</dt><dd>${K('←')} ${K('→')}</dd>
 <dt>پخش / توقف سفر</dt><dd>${K('Space')}</dd><dt>تغییر تم</dt><dd>${K('T')}</dd><dt>بزرگ‌نمایی / کوچک‌نمایی</dt><dd>${K('+')} ${K('−')}</dd><dt>بستن</dt><dd>${K('Esc')}</dd></dl></div>`;
 scrim.onmousedown=()=>close();root.appendChild(scrim)}

/* shortcuts */
document.addEventListener('keydown',e=>{
 if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();openPalette();return}
 if(scrim){if(e.key==='Escape')close();return}
 const t=e.target;if(t.closest&&t.closest('input,textarea,select,[contenteditable=true]'))return;if(e.metaKey||e.ctrlKey||e.altKey)return;
 const k=e.key;let h=true;
 if(k==='/'){openPalette()}else if(k==='f'||k==='F'||k==='ف'){act.focus()}else if(k==='['){act.noleft()}else if(k===']'){act.noright()}
 else if(k==='d'||k==='D'){act.dense()}else if(k==='?'){openHelp()}
 else if(/^[1-4]$/.test(k)){const b=$$('.drawer .tab')[+k-1];if(b){b.click();const d=$('.drawer.collapsed');}}
 else if(k==='ArrowLeft'||k==='ArrowRight'){const c=$$('.rcard');if(!c.length){h=false}else{let i=c.findIndex(x=>x.classList.contains('on'));i=(i+(k==='ArrowLeft'?1:-1)+c.length)%c.length;c[i].click();c[i].scrollIntoView({behavior:'smooth',inline:'nearest',block:'nearest'})}}
 else if(k===' '){const p=$('.play-btn');if(p)p.click();else h=false}
 else if(k==='t'||k==='T'){const b=$('.topbar [aria-label="تغییر تم"]');b?b.click():h=false}
 else if(k==='+'||k==='='){$('.map-tools [aria-label="بزرگ‌نمایی"]')?.click()}else if(k==='-'){$('.map-tools [aria-label="کوچک‌نمایی"]')?.click()}
 else if(k==='Escape'&&st.focus){act.focus()}else h=false;
 if(h)e.preventDefault()});
apply();
})();

