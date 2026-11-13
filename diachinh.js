/* M8 Pro Địa chính – biên tập bản đồ địa chính, thửa đất, hồ sơ. © Nguyễn Xuân Thủy (ĐT 0972839747) */
'use strict';
const {GEO,PLANAR,esc,fmtN}=M8;
const $=id=>document.getElementById(id);
const U=1000,EMBED=window.parent!==window,DESK=M8.isDesktop();
// ================= THIẾT LẬP =================
const CFG=Object.assign({tinh:'Phú Thọ',huyen:'',xa:'',to:'',tyle:1000,lvRanh:'10',lvNhan:'13',tol:0.02,fixTol:0.5,
 nhan:{so:{lv:13,c:3},dt:{lv:13,c:2},ld:{lv:13,c:4}},kieu:'3dong',hNhan:2.0,dtLe:1,dtSep:',',lvKT:14,cKT:6,lvDinh:15,cDinh:5,lvKhung:1,cKhung:0,lvRanhMoi:10,cRanh:0,dvdo:'',lech:5},
 (()=>{try{return JSON.parse(localStorage.getItem('m8d:cfg')||'{}')}catch(e){return{}}})());
const saveCfg=()=>{try{localStorage.setItem('m8d:cfg',JSON.stringify(CFG))}catch(e){}};
const lvs=s=>String(s).split(/[,; ]+/).filter(Boolean).map(Number);
const H=()=>CFG.hNhan*CFG.tyle;                // cao chữ nhãn (đơn vị lưu): mm giấy × tỷ lệ / 1000 m = …×1000
// ================= TRẠNG THÁI =================
let MAP=null,DOCI=null,PARC=[],TOPO=null,GTP=null,DIRTY=false,CUR=null,ERRS=[],SHOWLD=false,TOPOFF=false;
let _st=0;function st(t){$('st').textContent=t}
function dlg(html,onInit){return new Promise(res=>{const b=$('dlgB');b.innerHTML=html;$('dlg').style.display='flex';const close=v=>{$('dlg').style.display='none';b.innerHTML='';res(v)};
 b.querySelectorAll('[data-r]').forEach(x=>x.onclick=()=>{const r=x.dataset.r;if(r==='ok'){const o={};b.querySelectorAll('[name]').forEach(i=>o[i.name]=i.type==='checkbox'?i.checked:i.value);close(o)}else close(r==='x'?null:r)});if(onInit)onInit(b,close)})}
function form(title,fields,okL){return dlg(`<h3>${esc(title)}</h3>`+fields.map(f=>f.t==='check'?`<label class="f" style="flex-direction:row;gap:6px;align-items:center"><input type="checkbox" name="${f.k}" ${f.v?'checked':''}>${esc(f.l)}</label>`:
 f.t==='select'?`<div class="f"><span>${esc(f.l)}</span><select name="${f.k}">${f.o.map(o=>`<option value="${esc(o[0])}" ${String(o[0])===String(f.v)?'selected':''}>${esc(o[1])}</option>`).join('')}</select></div>`:f.t==='note'?`<p class="muted">${f.l}</p>`:
 `<div class="f"><span>${esc(f.l)}</span><input name="${f.k}" type="${f.t||'text'}" step="any" value="${esc(f.v==null?'':f.v)}"></div>`).join('')+`<div class="bt"><button data-r="x">Hủy</button><button class="p" data-r="ok">${okL||'Đồng ý'}</button></div>`)}
const alert_=(t,ti)=>dlg(`<h3>${esc(ti||'Thông báo')}</h3><div style="white-space:pre-wrap;line-height:1.5">${t}</div><div class="bt"><button class="p" data-r="ok">Đóng</button></div>`);
const confirm_=(t,ok)=>dlg(`<h3>Xác nhận</h3><div style="white-space:pre-wrap;line-height:1.5">${t}</div><div class="bt"><button data-r="x">Hủy</button><button class="p" data-r="ok">${ok||'Đồng ý'}</button></div>`).then(v=>!!v);
const org=()=>DOCI?DOCI.org:[0,0];
const toXY=(x,y)=>[(y-org()[1])/U,(x-org()[0])/U];
const fmD=a=>fmtN(a,CFG.dtLe).replace(',',CFG.dtSep);
const area=p=>{let a=Math.abs(GEO.area(p.rings[0]));for(const h of p.rings.slice(1))a-=Math.abs(GEO.area(h));return a/U/U};
// ================= KẾT NỐI BẢN ĐỒ =================
const BUS=new M8.Bus('diachinh');if(EMBED)BUS.win=window.parent;
const call=(n,a,o)=>BUS.call(n,a,o);
const ask=(n,a)=>BUS.call(n,a,{timeout:0});
async function connect(){try{const r=await BUS.call('hello',null,{any:true,timeout:1800});MAP=r;setDoc(r.doc);$('nc').style.display='none';$('body').style.display='';return true}
 catch(e){MAP=null;BUS.peer=null;$('conn').textContent='● Chưa kết nối bản đồ';$('nc').style.display='flex';$('body').style.display='none';return false}}
function setDoc(d){const ch=!DOCI||!d||DOCI.name!==d.name;DOCI=d;$('conn').textContent=d?`● ${d.name} · ${d.n} phần tử`:'● Đã kết nối – bản đồ chưa mở tệp';if(ch){PARC=[];TOPO=null;ERRS=[];CUR=null;if(d){const m=d.name.match(/(\d+)\D*$/);if(m&&!CFG.toLock)CFG.to=String(+m[1])}loadLocal().then(view)}}
BUS.on('mapReady',()=>{BUS.peer=null;setTimeout(connect,300)});
BUS.on('fileOpened',d=>{setDoc(d);st('Bản đồ mới mở: '+d.name+' – bấm Thửa đất → Tạo thửa từ ranh')});
BUS.on('changed',a=>{DIRTY=true;if(DOCI)DOCI.n=a.n;$('conn').textContent=`● ${DOCI?DOCI.name:''} · ${a.n} phần tử`+(PARC.length?' · bản đồ đã sửa, cần tạo lại thửa':'')});
$('bMap').onclick=$('ncOpen').onclick=()=>{if(EMBED){st('Đang chạy trong M8 Pro Bản đồ');return}location.href='bando.html?app=diachinh'};
$('ncRetry').onclick=connect;
// ================= LƯU THUỘC TÍNH CỤC BỘ (khi không có tệp .gtp) =================
const lkey=()=>'d:attr:'+(DOCI?DOCI.name:'');
async function loadLocal(){if(!DOCI)return;const o=await M8.IDB.get(lkey());LOCAL=o||{};}
let LOCAL={},_sl=0;function saveLocal(){clearTimeout(_sl);_sl=setTimeout(()=>{const o={};for(const p of PARC)if(p.so!=null&&p.so!=='')o[p.so]={ld:p.ld,chu:p.chu,diachi:p.diachi,dtpl:p.dtpl,ghichu:p.ghichu};LOCAL=o;M8.IDB.set(lkey(),o)},600)}
// ================= TẠO THỬA (TOPOLOGY) =================
function textCenter(t){const L=t.tw||t.h*String(t.s).length*.6,c=Math.cos(t.r||0),s=Math.sin(t.r||0);return[t.x+L/2*c-t.h/2*s,t.y+L/2*s+t.h/2*c]}
function classify(s){s=String(s).trim();if(/^\d+$/.test(s))return['so',s];const a=s.replace(/\s*m2$/i,'').replace(/\s*m²$/i,'');if(/^\d+[.,]\d+$/.test(a)||/^\d{1,3}(\.\d{3})+,\d+$/.test(a))return['dt',+a.replace(/\.(?=\d{3}\b)/g,'').replace(',','.')];
 if(/^[A-Z]{2,4}\d?([+,/][A-Z]{2,4}\d?)*$/.test(s))return['ld',s];const m=s.match(/^(\d+)\s*[\/(]\s*(\d+[.,]?\d*)\)?\s*([A-Z+]{2,})?$/);if(m)return['mix',m];return[null,s]}
function segsOfEl(e){const s=[];if(e.p){const q=e.p;for(let i=2;i<q.length;i+=2)s.push([q[i-2],q[i-1],q[i],q[i+1],e.id]);if(e.k==='S'&&(q[0]!==q[q.length-2]||q[1]!==q[q.length-1]))s.push([q[q.length-2],q[q.length-1],q[0],q[1],e.id])}
 else if(e.k==='A'){const a=e.a,q=GEO.arcPts(a[5],a[6],a[2],a[0]+a[4],a[1]);for(let i=2;i<q.length;i+=2)s.push([q[i-2],q[i-1],q[i],q[i+1],e.id])}
 else if(e.k==='E'){const c=e.e,q=GEO.arcPts(c[3],c[4],c[0],0,2*Math.PI,72);for(let i=2;i<q.length;i+=2)s.push([q[i-2],q[i-1],q[i],q[i+1],e.id])}return s}
async function buildTopo(quiet){if(!DOCI){st('Bản đồ chưa mở tệp');return false}st('Đang lấy ranh thửa từ bản đồ…');
 const els=await call('getElements',{levels:lvs(CFG.lvRanh),kinds:['L','S','A','E']},{timeout:60000});if(!els.length){alert_(`Không có đường ranh trên lớp ${CFG.lvRanh}. Vào Hệ thống → Thiết lập lớp để chọn đúng lớp ranh thửa.`);return false}
 const segs=[];for(const e of els)for(const s of segsOfEl(e))if(s[0]!==s[2]||s[1]!==s[3])segs.push(s);st(`Đang dựng ${segs.length} đoạn ranh…`);await new Promise(r=>setTimeout(r,20));
 const t0=performance.now(),R=PLANAR.build(segs,CFG.tol*U);TOPO={R,els,ek:new Map(R.edges.map(e=>[e[0]+'_'+e[1],e]))};
 const old=new Map(PARC.map(p=>[p.so,p]));const faces=R.faces.filter(f=>f.area/U/U>=0.01);
 PARC=faces.map((f,i)=>{const rings=[f.ring,...(f.holes||[])];const lp=GEO.labelPt(rings);return{i,rings,edges:new Set(f.edges),lp,bb:GEO.bbox(f.ring),so:'',ld:'',dtNhan:null,chu:'',diachi:'',dtpl:null,ghichu:'',lab:[],gid:null}});
 PARC.forEach(p=>p.dt=area(p));
 // nhãn trong thửa
 const txt=await call('getElements',{levels:[...new Set([...lvs(CFG.lvNhan),CFG.nhan.so.lv,CFG.nhan.dt.lv,CFG.nhan.ld.lv])],kinds:['T']},{timeout:60000});
 const G=gridOf(PARC);for(const t of txt){const c=textCenter(t),p=findParc(c[0],c[1],G);if(!p)continue;p.lab.push(t.id);const[k,v]=classify(t.s);
  if(k==='so'&&!p.so)p.so=v;else if(k==='dt'&&p.dtNhan==null)p.dtNhan=v;else if(k==='ld'&&!p.ld)p.ld=v;else if(k==='mix'){if(!p.so)p.so=v[1];if(p.dtNhan==null)p.dtNhan=+v[2].replace(',','.');if(v[3]&&!p.ld)p.ld=v[3]}}
 // thuộc tính lưu cục bộ / tệp .gtp
 for(const p of PARC){const o=LOCAL[p.so]||old.get(p.so);if(o){for(const k of['chu','diachi','dtpl','ghichu'])if(o[k]!=null&&o[k]!=='')p[k]=o[k];if(!p.ld&&o.ld)p.ld=o.ld}}
 if(GTP)linkGtp();DIRTY=false;saveLocal();if(CUR){const G2=gridOf(PARC);CUR=findParc(CUR.lp[0],CUR.lp[1],G2)}
 const nn=PARC.filter(p=>!p.so).length;if(!quiet)st(`Đã tạo ${PARC.length} thửa (${Math.round(performance.now()-t0)} ms) · ${nn} thửa chưa có số · ${R.dangles.length} đầu treo`);
 showTopo();return true}
function gridOf(P){let b=[1/0,1/0,-1/0,-1/0];for(const p of P){b[0]=Math.min(b[0],p.bb[0]);b[1]=Math.min(b[1],p.bb[1]);b[2]=Math.max(b[2],p.bb[2]);b[3]=Math.max(b[3],p.bb[3])}const cs=Math.max((b[2]-b[0]+b[3]-b[1])/2/Math.max(4,Math.sqrt(P.length)),1),m=new Map();
 for(const p of P){for(let i=Math.floor((p.bb[0]-b[0])/cs);i<=Math.floor((p.bb[2]-b[0])/cs);i++)for(let j=Math.floor((p.bb[1]-b[1])/cs);j<=Math.floor((p.bb[3]-b[1])/cs);j++){const k=i*1e6+j;if(!m.has(k))m.set(k,[]);m.get(k).push(p)}}return{b,cs,m}}
function findParc(x,y,G){G=G||gridOf(PARC);const L=G.m.get(Math.floor((x-G.b[0])/G.cs)*1e6+Math.floor((y-G.b[1])/G.cs))||[];for(const p of L)if(GEO.inPoly(x,y,p.rings[0])&&!p.rings.slice(1).some(h=>GEO.inPoly(x,y,h)))return p;return null}
function showTopo(){if(!PARC.length||TOPOFF){call('overlay',{key:'dc:topo',items:null});return}const items=[];
 if(SHOWLD)for(const p of PARC)items.push({rings:p.rings,fill:M8.MAU_LD[M8.nhomLD(p.ld)]||'#ccc',alpha:.45});
 for(const p of PARC)if(!p.so)items.push({pt:p.lp,r:6,stroke:'#ff3030'});
 if(CUR)items.push({rings:CUR.rings,fill:'#00e5ff',alpha:.25,stroke:'#00e5ff',lw:3});
 call('overlay',{key:'dc:topo',items})}
async function ensureTopo(){if(!PARC.length||DIRTY)return buildTopo(true);return true}
// thửa liền kề (có chung cạnh)
function neighbors(p){const out=[];for(const q of PARC){if(q===p)continue;if(q.bb[0]>p.bb[2]||q.bb[2]<p.bb[0]||q.bb[1]>p.bb[3]||q.bb[3]<p.bb[1])continue;for(const e of q.edges)if(p.edges.has(e)){out.push(q);break}}return out}
// ================= TỆP THUỘC TÍNH .gtp =================
async function openGtp(){if(DESK&&window.showOpenFilePicker){try{const[h]=await showOpenFilePicker({types:[{description:'Tệp thuộc tính (.gtp)',accept:{'application/octet-stream':['.gtp']}}]});const f=await h.getFile();return loadGtp(f.name,new Uint8Array(await f.arrayBuffer()),h)}catch(e){if(e&&e.name==='AbortError')return}}
 $('fGtp').value='';$('fGtp').click()}
$('fGtp').onchange=async e=>{const f=e.target.files[0];if(f)loadGtp(f.name,new Uint8Array(await f.arrayBuffer()))};
async function loadGtp(name,u8,fh){st('Đang mở tệp thuộc tính…');try{const o=await M8.gtpOpenDB(u8);o.name=name;o.fh=fh||null;o.rows=M8.gtpRows(o);GTP=o;
 const tos=[...new Set(o.rows.map(r=>String(r.to)))];if(tos.length>1&&!CFG.to){const r=await form('Tệp có nhiều tờ bản đồ',[{k:'to',l:'Chọn tờ ứng với bản đồ đang mở',t:'select',v:tos[0],o:tos.map(t=>[t,'Tờ '+t])}]);if(r)CFG.to=r.to}
 if(PARC.length)linkGtp();st(`Đã mở ${name}: ${o.rows.length} thửa`+(PARC.length?` · liên kết ${PARC.filter(p=>p.gid!=null).length}/${PARC.length} thửa`:''));view()}catch(e){console.error(e);alert_(esc(e.message||e),'Không mở được tệp thuộc tính')}}
const gRows=()=>GTP?GTP.rows.filter(r=>!CFG.to||String(+r.to||r.to)===String(+CFG.to||CFG.to)):[];
function linkGtp(){if(!GTP)return;const rows=gRows(),bySo=new Map();for(const r of rows)bySo.set(String(r.so),r);const G=gridOf(PARC),used=new Set();
 for(const p of PARC)p.gid=null;
 // 1) theo tâm thửa trong tệp thuộc tính
 for(const r of rows){if(r.cx==null||r.cy==null)continue;for(const[x,y]of[[r.cx*U+org()[0],r.cy*U+org()[1]],[r.cy*U+org()[0],r.cx*U+org()[1]]]){const p=findParc(x,y,G);if(p&&p.gid==null){p.gid=r.id;used.add(r.id);break}}}
 // 2) theo số thửa
 for(const p of PARC){if(p.gid!=null||!p.so)continue;const r=bySo.get(String(p.so));if(r&&!used.has(r.id)){p.gid=r.id;used.add(r.id)}}
 for(const p of PARC){if(p.gid==null)continue;const r=GTP.rows.find(x=>x.id===p.gid);if(!r)continue;if(r.so!=null)p.so=String(r.so);if(r.kh)p.ld=r.kh;p.chu=r.chu||p.chu;p.diachi=r.diachi||p.diachi;if(r.dtpl!=null)p.dtpl=r.dtpl;p.ghichu=r.ghichu||p.ghichu;p.grow=r}}
async function saveGtp(){if(!GTP){st('Chưa mở tệp thuộc tính');return}try{const u=M8.gtpBytes(GTP),b=new Blob([u],{type:'application/octet-stream'});
 if(GTP.fh){if(!(await confirm_('Ghi đè tệp thuộc tính gốc '+esc(GTP.name)+'?','Ghi đè')))return;await M8.writeHandle(GTP.fh,b)}else{const h=await M8.saveAs(GTP.name,b,[{description:'Tệp thuộc tính',accept:{'application/octet-stream':['.gtp']}}]);if(!h)return;if(h.createWritable)GTP.fh=h}
 GTP.dirty=false;st('Đã lưu tệp thuộc tính '+GTP.name);view()}catch(e){alert_(esc(e.message||e),'Không lưu được')}}
function gtpSetParcel(p,f){if(!GTP||p.gid==null)return;const T=GTP.T.ThuaDat.cols;const m={so:'soThuTuThua',ld:'mucDichSuDungGhep',diachi:'diaChi',dtpl:'dienTichPhapLy',ghichu:'ghiChu',dt:'dienTich'};
 for(const k in f){if(k==='chu'){const o=p.grow&&p.grow.owners&&p.grow.owners[0];if(o&&GTP.T.Nguoi&&GTP.T.Nguoi.cols.includes('hoTen')){GTP.db.run('update Nguoi set hoTen=? where nguoiId=?',[f.chu,o.nid]);GTP.dirty=true}continue}
  if(m[k]&&T.includes(m[k])){let v=f[k];if(k==='so'||k==='dt'||k==='dtpl')v=v===''||v==null?null:+String(v).replace(',','.');M8.gtpUpd(GTP,p.gid,m[k],v)}}}
async function pushGtp(){if(!GTP){st('Mở tệp thuộc tính trước');return}if(!(await ensureTopo()))return;const r=await form('Cập nhật từ bản đồ vào tệp thuộc tính',[{k:'so',l:'Số thửa',t:'check',v:true},{k:'dt',l:'Diện tích (theo bản đồ, làm tròn '+CFG.dtLe+' số lẻ)',t:'check',v:true},{k:'ld',l:'Loại đất (ký hiệu)',t:'check',v:false},{k:'tam',l:'Toạ độ tâm thửa',t:'check',v:true},{k:'geom',l:'Hình thửa (cột hình học, nếu có)',t:'check',v:false},{k:'moi',l:'Thêm thửa chưa có trong tệp thuộc tính',t:'check',v:true}]);if(!r)return;
 let n=0,a=0;const T=GTP.T.ThuaDat.cols,k=10**CFG.dtLe;for(const p of PARC){const f={};if(r.so&&p.so)f.so=p.so;if(r.dt)f.dt=Math.round(p.dt*k)/k;if(r.ld&&p.ld)f.ld=p.ld;
  if(p.gid==null){if(!r.moi||!p.so)continue;const o={soThuTuThua:+p.so,dienTich:Math.round(p.dt*k)/k};if(CFG.to)o.soHieuToBanDo=+CFG.to;if(p.ld)o.mucDichSuDungGhep=p.ld;if(T.includes('TamX')){const t=toXY(...p.lp);o.TamX=t[1];o.TamY=t[0]}
   try{p.gid=M8.gtpNewParcel(GTP,o);a++}catch(e){console.warn(e)}continue}
  gtpSetParcel(p,f);if(r.tam&&T.includes('TamX')){const t=toXY(...p.lp);M8.gtpUpd(GTP,p.gid,'TamX',t[1]);M8.gtpUpd(GTP,p.gid,'TamY',t[0])}
  if(r.geom&&T.includes('geom')){const rr=p.rings.map(q=>{const o=[];for(let i=0;i<q.length;i+=2){const t=toXY(q[i],q[i+1]);o.push(t[1],t[0])}return o});M8.gtpUpd(GTP,p.gid,'geom',M8.wkbPoly(rr))}n++}
 GTP.rows=M8.gtpRows(GTP);linkGtp();st(`Đã cập nhật ${n} thửa, thêm mới ${a} thửa vào ${GTP.name} – nhớ bấm “Lưu tệp thuộc tính”`);view()}
// ================= VẼ NHÃN, ĐÁNH SỐ =================
const _mc=document.createElement('canvas').getContext('2d');function textW(s,h){_mc.font='100px "Times New Roman",Tinos,serif';return _mc.measureText(String(s)).width/100*h/0.662}
function T(s,cx,y,h,lv,c,r){const w=textW(s,h);r=r||0;const co=Math.cos(r),si=Math.sin(r);return{k:'T',s:String(s),h,tw:w,r,lv,c,x:cx-w/2*co,y:y-w/2*si}}
function labelEls(p){const h=H(),[x,y]=p.lp,N=CFG.nhan,out=[],dt=fmD(p.dt);
 if(CFG.kieu==='phanso'){const so=String(p.so||'?'),w=Math.max(textW(so,h),textW(dt,h))+h*.4;out.push(T(so,x,y+h*.35,h,N.so.lv,N.so.c));out.push({k:'L',lv:N.so.lv,c:N.so.c,w:0,st:0,p:[x-w/2,y,x+w/2,y]});out.push(T(dt,x,y-h*1.35,h,N.dt.lv,N.dt.c));
  if(p.ld){const t=T(p.ld,0,0,h*.9,N.ld.lv,N.ld.c);t.x=x+w/2+h*.3;t.y=y-h*.45;out.push(t)}}
 else{const L=[[p.so||'?',N.so]];L.push([dt,N.dt]);if(p.ld)L.push([p.ld,N.ld]);const n=L.length,sp=h*1.45;L.forEach(([s,a],i)=>out.push(T(s,x,y+((n-1)/2-i)*sp-h/2,h,a.lv,a.c)))}
 return out}
async function drawLabels(list,delOld){if(!(await ensureTopo()))return;list=list||PARC;const add=[],del=new Set();for(const p of list){if(delOld!==false)p.lab.forEach(i=>del.add(i));add.push(...labelEls(p))}
 const ids=await call('applyEdits',{label:'Vẽ nhãn thửa',del:[...del],add},{timeout:120000});DIRTY=true;await buildTopo(true);st(`Đã vẽ nhãn cho ${list.length} thửa`)}
async function delLabels(){if(!(await ensureTopo()))return;const del=PARC.flatMap(p=>p.lab);if(!del.length){st('Không có nhãn trong thửa');return}if(!(await confirm_(`Xoá ${del.length} chữ nhãn nằm trong các thửa (lớp ${CFG.lvNhan})?`,'Xoá')))return;await call('applyEdits',{label:'Xoá nhãn',del});await buildTopo(true);st('Đã xoá nhãn')}
async function autoNumber(){if(!(await ensureTopo()))return;const r=await form('Đánh số thửa tự động',[{k:'b',l:'Bắt đầu từ số',t:'number',v:1},{k:'m',l:'Phạm vi',t:'select',v:'all',o:[['all','Đánh lại toàn bộ'],['new','Chỉ thửa chưa có số (tiếp theo số lớn nhất)']]},{k:'z',l:'Thứ tự',t:'select',v:'zz',o:[['zz','Zích zắc: trái → phải rồi phải → trái, từ trên xuống'],['lr','Mỗi hàng từ trái sang phải, từ trên xuống']]},{k:'v',l:'Vẽ lại nhãn sau khi đánh số',t:'check',v:true}]);if(!r)return;
 let list=r.m==='new'?PARC.filter(p=>!p.so):PARC.slice();let n=r.m==='new'?Math.max(0,...PARC.map(p=>+p.so||0))+1:+r.b||1;if(!list.length){st('Không có thửa cần đánh số');return}
 const hs=list.map(p=>p.bb[3]-p.bb[1]).sort((a,b)=>a-b),band=hs[hs.length>>1]||1;list.sort((a,b)=>b.lp[1]-a.lp[1]);const rows=[];for(const p of list){const R=rows[rows.length-1];if(R&&R.y-p.lp[1]<band*.8)R.L.push(p);else rows.push({y:p.lp[1],L:[p]})}
 rows.forEach((R,i)=>{R.L.sort((a,b)=>a.lp[0]-b.lp[0]);if(r.z==='zz'&&i%2)R.L.reverse();for(const p of R.L){p.so=String(n++);gtpSetParcel(p,{so:p.so})}});saveLocal();st(`Đã đánh số ${list.length} thửa`);if(r.v)await drawLabels(list);view()}
// ================= KIỂM TRA & SỬA LỖI RANH =================
async function checkErr(){if(!(await buildTopo(true)))return;const R=TOPO.R,E=[];const deg=new Array(R.nodes.length).fill(0);for(const e of R.edges){deg[e[0]]++;deg[e[1]]++}
 R.nodes.forEach((n,i)=>{if(deg[i]===1)E.push({t:'Đầu treo (bắt chưa tới hoặc bắt quá)',at:n})});
 const seen=new Map();for(const e of TOPO.els)for(const s of segsOfEl(e)){const k=[Math.round(s[0]),Math.round(s[1]),Math.round(s[2]),Math.round(s[3])],key=(k[0]<k[2]||(k[0]===k[2]&&k[1]<k[3]))?k.join(','):[k[2],k[3],k[0],k[1]].join(',');if(seen.has(key)&&seen.get(key)!==e.id)E.push({t:'Đoạn ranh trùng nhau',at:[(s[0]+s[2])/2,(s[1]+s[3])/2],ids:[e.id,seen.get(key)]});else seen.set(key,e.id)}
 const cnt=new Map();for(const p of PARC)if(p.so)cnt.set(p.so,(cnt.get(p.so)||0)+1);
 for(const p of PARC){if(!p.so)E.push({t:'Thửa chưa có số thửa',at:p.lp,p});else if(cnt.get(p.so)>1)E.push({t:'Trùng số thửa '+p.so,at:p.lp,p});if(p.dt<1)E.push({t:`Thửa quá nhỏ (${fmD(p.dt)} m²) – có thể là lỗi ranh`,at:p.lp,p});
  const lc=p.lab.length;if(p.dtNhan!=null&&Math.abs(p.dtNhan-p.dt)>Math.max(1,p.dt*CFG.lech/100))E.push({t:`Diện tích nhãn ${fmD(p.dtNhan)} khác bản đồ ${fmD(p.dt)} m²`,at:p.lp,p})}
 ERRS=E;call('overlay',{key:'dc:err',items:E.slice(0,3000).map(e=>({pt:e.at,r:8,stroke:'#ff9800'}))});PANEL='loi';view();st(`Tìm thấy ${E.length} lỗi`)}
async function fixErr(){if(!(await buildTopo(true)))return;const r=await form('Sửa lỗi ranh tự động',[{k:'d',l:'Khoảng bắt nối tối đa (m)',t:'number',v:CFG.fixTol},{k:'u',l:'Nối đầu treo tới ranh gần nhất (bắt chưa tới)',t:'check',v:true},{k:'o',l:'Cắt phần thừa ngắn (bắt quá)',t:'check',v:true},{k:'dup',l:'Xoá đoạn thẳng trùng nhau',t:'check',v:true}]);if(!r)return;CFG.fixTol=+r.d;saveCfg();
 const R=TOPO.R,tol=CFG.tol*U,D=CFG.fixTol*U,deg=new Array(R.nodes.length).fill(0),adj=R.nodes.map(()=>[]);for(const e of R.edges){deg[e[0]]++;deg[e[1]]++;adj[e[0]].push(e[1]);adj[e[1]].push(e[0])}
 const els=new Map(TOPO.els.map(e=>[e.id,{...e,p:e.p&&e.p.slice()}])),mod=new Set(),del=new Set();let nu=0,no=0;
 const endOf=(x,y)=>{for(const e of els.values()){if(!e.p||e.k==='S')continue;const n=e.p.length;if(GEO.d2(e.p[0],e.p[1],x,y)<=tol*tol)return[e,0];if(GEO.d2(e.p[n-2],e.p[n-1],x,y)<=tol*tol)return[e,n-2]}return null};
 const allSegs=[];for(const e of els.values())for(const s of segsOfEl(e))allSegs.push(s);
 R.nodes.forEach((n,i)=>{if(deg[i]!==1)return;const f=endOf(n[0],n[1]);if(!f)return;const[e,k]=f,m=adj[i][0],M=R.nodes[m];
  if(r.o&&deg[m]>=3&&GEO.dist(n[0],n[1],M[0],M[1])<=D){e.p[k]=M[0];e.p[k+1]=M[1];mod.add(e.id);no++;return}
  if(!r.u)return;let best=null,bd=D*D;for(const s of allSegs){if(s[4]===e.id){const q=e.p;const own=k===0?[q[0],q[1],q[2],q[3]]:[q[q.length-4],q[q.length-3],q[q.length-2],q[q.length-1]];if(Math.min(GEO.d2(s[0],s[1],n[0],n[1]),GEO.d2(s[2],s[3],n[0],n[1]))<=tol*tol)continue}
   const g=GEO.segPt(n[0],n[1],s[0],s[1],s[2],s[3]);if(g[0]>tol*tol&&g[0]<bd){bd=g[0];best=[g[2],g[3]];for(const v of[[s[0],s[1]],[s[2],s[3]]])if(GEO.d2(v[0],v[1],g[2],g[3])<(D*.3)**2)best=v}}
  if(best){e.p[k]=best[0];e.p[k+1]=best[1];mod.add(e.id);nu++}});
 if(r.dup){const seen=new Map();for(const e of els.values()){if(!e.p||e.p.length!==4)continue;const k=e.p.map(Math.round),key=(k[0]<k[2]||(k[0]===k[2]&&k[1]<k[3]))?k.join(','):[k[2],k[3],k[0],k[1]].join(',');if(seen.has(key))del.add(e.id);else seen.set(key,e.id)}}
 if(!mod.size&&!del.size){st('Không có lỗi nào sửa được trong khoảng '+CFG.fixTol+' m');return}
 await call('applyEdits',{label:'Sửa lỗi ranh',mod:[...mod].filter(i=>!del.has(i)).map(i=>({id:i,p:els.get(i).p})),del:[...del]});await buildTopo(true);st(`Đã nối ${nu} đầu treo, cắt ${no} phần thừa, xoá ${del.size} đoạn trùng – còn ${TOPO.R.dangles.length} đầu treo`);checkErr()}
// ================= CHỌN THỬA TRÊN BẢN ĐỒ =================
async function pickParcel(prompt){if(!(await ensureTopo()))return null;try{const p=await ask('pickPoint',{prompt:prompt||'Chạm vào trong thửa đất'});const q=findParc(p.x,p.y);if(!q)st('Không có thửa tại điểm này');return q}catch(e){st(e.message);return null}}
function selectParc(p,zoom){CUR=p;showTopo();if(zoom&&p){const b=p.bb,w=Math.max(b[2]-b[0],b[3]-b[1]);call('zoomTo',{bbox:[b[0]-w*.6,b[1]-w*.6,b[2]+w*.6,b[3]+w*.6]})}PANEL='thua';view()}
// ================= TÁCH / GỘP THỬA =================
function clipToRing(line,ring){const R={k:'S',p:ring.concat(ring.slice(0,2))},ps=[];for(let i=0;i+3<line.length;i+=2){const n=ring.length/2;for(let j=0;j<n;j++){const k=(j+1)%n,x=GEO.segX(line[i],line[i+1],line[i+2],line[i+3],ring[2*j],ring[2*j+1],ring[2*k],ring[2*k+1]);if(x)ps.push(i/2+x[2])}}
 ps.sort((a,b)=>a-b);if(ps.length<2)return null;const s0=ps[0],s1=ps[ps.length-1],at=s=>{const i=Math.min(Math.floor(s),line.length/2-2),t=s-i;return[line[2*i]+(line[2*i+2]-line[2*i])*t,line[2*i+1]+(line[2*i+3]-line[2*i+1])*t]};
 const o=[...at(s0)];for(let i=Math.floor(s0)+1;i<s1;i++)o.push(line[2*i],line[2*i+1]);o.push(...at(s1));return o}
async function splitParcel(){const p=await pickParcel('Tách thửa › chạm vào thửa cần tách');if(!p)return;selectParc(p,true);
 let line;try{line=await ask('pickLine',{prompt:`Tách thửa ${p.so||''} › vẽ đường cắt cắt qua ranh thửa (Đặt lại: kết thúc). Có thể vẽ nhiều lần.`})}catch(e){st(e.message);return}
 const c=clipToRing(line,p.rings[0]);if(!c){alert_('Đường cắt phải cắt qua ranh thửa ít nhất 2 lần');return}
 const old=p,oldRing=p.rings[0],maxSo=Math.max(0,...PARC.map(q=>+q.so||0)),attr={ld:p.ld,chu:p.chu,diachi:p.diachi};
 await call('applyEdits',{label:'Tách thửa',add:[{k:'L',lv:CFG.lvRanhMoi,c:CFG.cRanh,w:0,st:0,p:c}]});DIRTY=true;await buildTopo(true);
 const news=PARC.filter(q=>GEO.inPoly(q.lp[0],q.lp[1],oldRing));if(news.length<2){st('Không tách được – kiểm tra đường cắt');return}
 news.sort((a,b)=>b.dt-a.dt);let keep=news.find(q=>GEO.inPoly(old.lp[0],old.lp[1],q.rings[0]))||news[0],n=maxSo;
 for(const q of news){Object.assign(q,attr);if(q===keep){q.so=old.so;q.gid=old.gid;q.grow=old.grow;gtpSetParcel(q,{dt:Math.round(q.dt*10)/10})}else{q.so=String(++n);q.gid=null}}
 await drawLabels(news);st(`Đã tách thửa ${old.so} thành ${news.length} thửa: ${news.map(q=>q.so+' ('+fmD(q.dt)+' m²)').join(', ')}`+(GTP?' – dùng “Cập nhật vào tệp thuộc tính” để thêm thửa mới':''));selectParc(PARC.find(q=>q.so===keep.so),false)}
function chain(edges,nodes){const adj=new Map(),used=new Set(),out=[];const add=(a,b,k)=>{if(!adj.has(a))adj.set(a,[]);adj.get(a).push([b,k])};edges.forEach((e,k)=>{add(e[0],e[1],k);add(e[1],e[0],k)});
 const walk=(s)=>{const o=[s];let c=s;while(true){const nx=(adj.get(c)||[]).find(([b,k])=>!used.has(k));if(!nx)break;used.add(nx[1]);c=nx[0];o.push(c);if(c===s)break}return o};
 for(const[n,L]of adj)if(L.length!==2)while((adj.get(n)||[]).some(([b,k])=>!used.has(k))){const w=walk(n);out.push(w)}
 for(let k=0;k<edges.length;k++)if(!used.has(k)){const w=walk(edges[k][0]);out.push(w)}return out.map(w=>w.flatMap(i=>nodes[i]))}
async function mergeParcels(){const a=await pickParcel('Gộp thửa › chạm vào thửa thứ nhất (giữ số thửa này)');if(!a)return;selectParc(a,false);const b=await pickParcel('Gộp thửa › chạm vào thửa liền kề cần gộp');if(!b||b===a)return;
 const sh=[...a.edges].filter(e=>b.edges.has(e));if(!sh.length){alert_('Hai thửa không có cạnh chung');return}
 const R=TOPO.R,shared=new Set(sh),tags=new Set(sh.map(k=>TOPO.ek.get(k)[2])),del=[],add=[];
 for(const id of tags){const el=TOPO.els.find(e=>e.id===id);const keep=R.edges.filter(e=>e[2]===id&&!shared.has(e[0]+'_'+e[1]));del.push(id);for(const pl of chain(keep,R.nodes))if(pl.length>=4)add.push({k:'L',lv:el.lv,c:el.c,w:el.w,st:el.st,p:pl})}
 const so=a.so,bs=b.so,keepAttr={ld:a.ld,chu:a.chu,diachi:a.diachi,gid:a.gid,grow:a.grow};
 await call('applyEdits',{label:'Gộp thửa',del:[...del,...b.lab,...a.lab],add});DIRTY=true;await buildTopo(true);
 const m=findParc(...a.lp)||findParc(...b.lp);if(m){Object.assign(m,keepAttr);m.so=so;gtpSetParcel(m,{dt:Math.round(m.dt*10)/10});await drawLabels([m],false)}
 st(`Đã gộp thửa ${bs} vào thửa ${so}`+(GTP?` – thửa ${bs} vẫn còn trong tệp thuộc tính, cần xử lý theo hồ sơ biến động`:''))}
// ================= KÍCH THƯỚC CẠNH, SỐ ĐỈNH, TOẠ ĐỘ =================
function vertsOf(p){let r=GEO.simplify(p.rings[0].concat(p.rings[0].slice(0,2)),CFG.tol*U).slice(0,-2);if(GEO.area(r)>0){const o=[];for(let i=r.length-2;i>=0;i-=2)o.push(r[i],r[i+1]);r=o}   // theo chiều kim đồng hồ
 let s=0,bv=-1/0;for(let i=0;i<r.length;i+=2){const v=r[i+1]-r[i]*.3;if(v>bv){bv=v;s=i}}return r.slice(s).concat(r.slice(0,s))}   // bắt đầu từ đỉnh phía Tây Bắc
function edgeTable(p){const v=vertsOf(p),n=v.length/2,o=[];for(let i=0;i<n;i++){const j=(i+1)%n,t=toXY(v[2*i],v[2*i+1]);o.push({i:i+1,X:t[0],Y:t[1],L:GEO.dist(v[2*i],v[2*i+1],v[2*j],v[2*j+1])/U,to:j+1})}return o}
function dimEls(p){const v=vertsOf(p),n=v.length/2,h=H()*.8,out=[],c=GEO.centroid(v);for(let i=0;i<n;i++){const j=(i+1)%n,ax=v[2*i],ay=v[2*i+1],bx=v[2*j],by=v[2*j+1],L=GEO.dist(ax,ay,bx,by)/U;if(L<0.05)continue;
  let r=Math.atan2(by-ay,bx-ax);if(r>Math.PI/2)r-=Math.PI;if(r<-Math.PI/2)r+=Math.PI;const mx=(ax+bx)/2,my=(ay+by)/2;let nx=-Math.sin(r),ny=Math.cos(r);if((c[0]-mx)*nx+(c[1]-my)*ny<0){nx=-nx;ny=-ny}
  const t=T(fmtN(L,2),mx+nx*h*.25,my+ny*h*.25,h,CFG.lvKT,CFG.cKT,r);if(nx*-Math.sin(r)+ny*Math.cos(r)<0){t.x-=-Math.sin(r)*h;t.y-=Math.cos(r)*h}out.push(t)}return out}
function vertEls(p){const v=vertsOf(p),n=v.length/2,h=H()*.7,c=GEO.centroid(v),out=[];for(let i=0;i<n;i++){const x=v[2*i],y=v[2*i+1],dx=x-c[0],dy=y-c[1],L=Math.hypot(dx,dy)||1;
 out.push({k:'E',lv:CFG.lvDinh,c:CFG.cDinh,w:0,st:0,e:[h*.25,h*.25,0,x,y]});out.push(T(String(i+1),x+dx/L*h*.9,y+dy/L*h*.9-h/2,h,CFG.lvDinh,CFG.cDinh))}return out}
async function forParcels(title,fn){if(!(await ensureTopo()))return;const r=await form(title,[{k:'m',l:'Áp dụng cho',t:'select',v:'one',o:[['one','Thửa chọn trên bản đồ'],['cur','Thửa đang xem'],['all','Tất cả thửa']]}]);if(!r)return;
 let L=r.m==='all'?PARC:r.m==='cur'?(CUR?[CUR]:[]):[await pickParcel()].filter(Boolean);if(!L.length){st('Chưa có thửa');return}const add=L.flatMap(fn);await call('applyEdits',{label:title,add},{timeout:120000});DIRTY=true;st(`${title}: ${L.length} thửa`)}
// ================= KHUNG BẢN ĐỒ ĐỊA CHÍNH =================
async function drawFrame(){if(!(await ensureTopo()))return;const r=await form('Vẽ khung bản đồ địa chính',[{k:'to',l:'Tờ bản đồ số',v:CFG.to},{k:'tl',l:'Tỷ lệ 1:',t:'number',v:CFG.tyle},{k:'xa',l:'Xã/phường',v:CFG.xa},{k:'huyen',l:'Huyện (để trống nếu không dùng)',v:CFG.huyen},{k:'tinh',l:'Tỉnh',v:CFG.tinh},{k:'m',l:'Phạm vi khung',t:'select',v:'auto',o:[['auto','Bao các thửa, làm tròn theo lưới 10 cm giấy'],['pick','Chọn 2 góc trên bản đồ']]}]);if(!r)return;
 Object.assign(CFG,{to:r.to,tyle:+r.tl,xa:r.xa,huyen:r.huyen,tinh:r.tinh});saveCfg();const k=CFG.tyle,g=100*k,o=org();let b;
 if(r.m==='pick'){try{const q=await ask('pickRect',{prompt:'Chọn góc thứ nhất rồi góc đối diện của khung'});b=[Math.min(q[0],q[2]),Math.min(q[1],q[3]),Math.max(q[0],q[2]),Math.max(q[1],q[3])]}catch(e){return}}
 else{let bb=[1/0,1/0,-1/0,-1/0];for(const p of PARC){bb[0]=Math.min(bb[0],p.bb[0]);bb[1]=Math.min(bb[1],p.bb[1]);bb[2]=Math.max(bb[2],p.bb[2]);bb[3]=Math.max(bb[3],p.bb[3])}b=[Math.floor((bb[0]-o[0])/g)*g+o[0],Math.floor((bb[1]-o[1])/g)*g+o[1],Math.ceil((bb[2]-o[0])/g)*g+o[0],Math.ceil((bb[3]-o[1])/g)*g+o[1]]}
 const L=CFG.lvKhung,C=CFG.cKhung,mm=k,E=[],rect=(a,c,d,w)=>E.push({k:'S',lv:L,c:C,w:w||0,st:0,p:[a[0],a[1],c,a[1],c,d,a[0],d,a[0],a[1]]}),h=2.5*mm;
 rect([b[0],b[1]],b[2],b[3],1);const ob=[b[0]-12*mm,b[1]-12*mm,b[2]+12*mm,b[3]+12*mm];rect([ob[0],ob[1]],ob[2],ob[3],3);
 for(let x=Math.ceil((b[0]-o[0])/g)*g+o[0];x<=b[2]+1;x+=g)for(let y=Math.ceil((b[1]-o[1])/g)*g+o[1];y<=b[3]+1;y+=g){const onX=Math.abs(x-b[0])<1||Math.abs(x-b[2])<1,onY=Math.abs(y-b[1])<1||Math.abs(y-b[3])<1;
  if(!onX&&!onY){E.push({k:'L',lv:L,c:C,w:0,st:0,p:[x-5*mm,y,x+5*mm,y]});E.push({k:'L',lv:L,c:C,w:0,st:0,p:[x,y-5*mm,x,y+5*mm]})}}
 for(let x=Math.ceil((b[0]-o[0])/g)*g+o[0];x<=b[2]+1;x+=g){const t=((x-o[0])/U).toFixed(0);E.push(T(t,x,b[1]-6*mm,h,L,C),T(t,x,b[3]+3*mm,h,L,C));E.push({k:'L',lv:L,c:C,w:0,st:0,p:[x,b[1],x,b[1]-2*mm]},{k:'L',lv:L,c:C,w:0,st:0,p:[x,b[3],x,b[3]+2*mm]})}
 for(let y=Math.ceil((b[1]-o[1])/g)*g+o[1];y<=b[3]+1;y+=g){const t=((y-o[1])/U).toFixed(0);E.push(T(t,b[0]-6*mm,y-h/2,h,L,C,Math.PI/2),T(t,b[2]+6*mm,y-h/2,h,L,C,Math.PI/2));E.push({k:'L',lv:L,c:C,w:0,st:0,p:[b[0],y,b[0]-2*mm,y]},{k:'L',lv:L,c:C,w:0,st:0,p:[b[2],y,b[2]+2*mm,y]})}
 const cx=(b[0]+b[2])/2;E.push(T('BẢN ĐỒ ĐỊA CHÍNH',cx,ob[3]+14*mm,6*mm,L,C),T([CFG.xa,CFG.huyen,CFG.tinh].filter(Boolean).join(' - ').toUpperCase(),cx,ob[3]+7*mm,3.5*mm,L,C),T('Tờ số: '+(CFG.to||'…'),b[2]-10*mm,ob[3]+3*mm,3*mm,L,C),
  T('Tỷ lệ 1:'+CFG.tyle,cx,ob[1]-8*mm,3.5*mm,L,C),T('Hệ toạ độ VN-2000, kinh tuyến trục '+String((DOCI&&DOCI.ktt)||'').replace('.',',')+'°, múi chiếu 3°',cx,ob[1]-14*mm,2.5*mm,L,C));
 await call('applyEdits',{label:'Vẽ khung bản đồ',add:E});call('zoomTo',{bbox:[ob[0]-20*mm,ob[1]-25*mm,ob[2]+20*mm,ob[3]+25*mm]});st('Đã vẽ khung bản đồ địa chính tờ '+(CFG.to||''))}
// ================= HỒ SƠ (in ra PDF qua trình duyệt) =================
// vị trí ghi số thửa liền kề trong khung sơ đồ: trên đường từ tâm thửa chính sang thửa liền kề, phần nằm trong thửa liền kề và trong khung
function nbPt(p,q,b){const c=GEO.centroid(p.rings[0]),e=q.lp,inV=(x,y)=>x>b[0]&&x<b[2]&&y>b[1]&&y<b[3];let t0=-1,t1=-1;for(let i=1;i<=60;i++){const t=i/60*1.5,x=c[0]+(e[0]-c[0])*t,y=c[1]+(e[1]-c[1])*t;if(GEO.inPoly(x,y,q.rings[0])&&inV(x,y)){if(t0<0)t0=t;t1=t}else if(t0>=0)break}
 if(t0<0)return inV(e[0],e[1])?e:null;const t=(t0+t1)/2;return[c[0]+(e[0]-c[0])*t,c[1]+(e[1]-c[1])*t]}
function svgParcel(p,W,Hh,opt){opt=opt||{};const nb=neighbors(p),all=[p,...nb];let b=[...p.bb];const pad=Math.max(b[2]-b[0],b[3]-b[1])*(opt.pad||.35);b=[b[0]-pad,b[1]-pad,b[2]+pad,b[3]+pad];
 const s=Math.min(W/(b[2]-b[0]),Hh/(b[3]-b[1])),X=x=>((x-b[0])*s).toFixed(1),Y=y=>((b[3]-y)*s).toFixed(1),path=r=>{let d='';for(let i=0;i<r.length;i+=2)d+=(i?'L':'M')+X(r[i])+' '+Y(r[i+1]);return d+'Z'};
 let o=`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${Hh}" viewBox="0 0 ${W} ${Hh}" style="font-family:'Times New Roman',serif"><defs><clipPath id="cp"><rect width="${W}" height="${Hh}"/></clipPath></defs><g clip-path="url(#cp)">`;
 for(const q of nb){o+=`<path d="${q.rings.map(path).join('')}" fill="none" stroke="#555" stroke-width=".8"/>`;const c=nbPt(p,q,b);if(c)o+=`<text x="${X(c[0])}" y="${Y(c[1])}" font-size="10" text-anchor="middle" fill="#333">${esc(q.so||'')}</text>`}
 o+=`<path d="${p.rings.map(path).join('')}" fill="none" stroke="#000" stroke-width="2"/>`;const v=vertsOf(p),n=v.length/2,c=GEO.centroid(v);
 if(opt.dim!==false)for(let i=0;i<n;i++){const j=(i+1)%n,mx=(v[2*i]+v[2*j])/2,my=(v[2*i+1]+v[2*j+1])/2,L=GEO.dist(v[2*i],v[2*i+1],v[2*j],v[2*j+1])/U;let a=-Math.atan2(v[2*j+1]-v[2*i+1],v[2*j]-v[2*i])*180/Math.PI;if(a>90)a-=180;if(a<-90)a+=180;
  const dx=c[0]-mx,dy=c[1]-my,dl=Math.hypot(dx,dy)||1,ox=dx/dl*8/s,oy=dy/dl*8/s;o+=`<text x="${X(mx+ox)}" y="${Y(my+oy)}" font-size="9.5" text-anchor="middle" dominant-baseline="middle" transform="rotate(${a.toFixed(1)} ${X(mx+ox)} ${Y(my+oy)})">${fmtN(L,2)}</text>`}
 for(let i=0;i<n;i++){const x=v[2*i],y=v[2*i+1],dx=x-c[0],dy=y-c[1],L=Math.hypot(dx,dy)||1;o+=`<circle cx="${X(x)}" cy="${Y(y)}" r="2.2" fill="#000"/><text x="${X(x+dx/L*11/s)}" y="${Y(y+dy/L*11/s)}" font-size="10" font-weight="bold" text-anchor="middle" dominant-baseline="middle">${i+1}</text>`}
 o+=`<text x="${X(p.lp[0])}" y="${Y(p.lp[1])}" font-size="12" font-weight="bold" text-anchor="middle">${esc(p.so||'')}</text><text x="${X(p.lp[0])}" y="${(+Y(p.lp[1])+14).toFixed(1)}" font-size="10.5" text-anchor="middle">${fmD(p.dt)} m²</text>`;
 o+=`</g><g transform="translate(${W-22},22)"><path d="M0 -16 L6 6 L0 2 L-6 6 Z" fill="#000"/><text y="18" font-size="10" text-anchor="middle">B</text></g></svg>`;return{svg:o,scale:Math.round(1/(s/U*1000/(96/25.4)))}}
const HDR=`<div style="text-align:center;font-weight:bold">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div><div style="text-align:center;font-weight:bold;text-decoration:underline">Độc lập - Tự do - Hạnh phúc</div>`;
const PCSS=`@page{size:A4;margin:15mm 15mm 15mm 20mm}body{font-family:"Times New Roman",Tinos,serif;font-size:13pt;line-height:1.35;color:#000}h1{font-size:15pt;text-align:center;margin:12px 0 6px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #000;padding:2px 5px;font-size:11.5pt}.nb td{border:0}.sig{display:flex;justify-content:space-between;text-align:center;margin-top:18px}.sig div{width:45%}.pg{page-break-after:always}.foot{position:fixed;bottom:0;left:0;right:0;text-align:center;font-size:9pt;color:#555}`;
function printHTML(title,body){const w=window.open('','_blank');if(!w){alert_('Trình duyệt chặn cửa sổ in. Cho phép cửa sổ bật lên rồi thử lại.');return}
 w.document.write(`<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8"><title>${esc(title)}</title><style>${PCSS}</style></head><body>${body}<div class="foot">Lập bằng M8 Pro Địa chính</div><script>setTimeout(()=>print(),400)<\/script></body></html>`);w.document.close()}
const today=()=>{const d=new Date();return`ngày ${d.getDate()} tháng ${d.getMonth()+1} năm ${d.getFullYear()}`};
const place=()=>[CFG.xa,CFG.huyen,CFG.tinh].filter(Boolean).join(', ');
function coordTable(p){const t=edgeTable(p);return`<table><tr><th>Số hiệu đỉnh</th><th>X (m)</th><th>Y (m)</th><th>Cạnh</th><th>Chiều dài (m)</th></tr>${t.map(r=>`<tr><td style="text-align:center">${r.i}</td><td>${fmtN(r.X,3)}</td><td>${fmtN(r.Y,3)}</td><td style="text-align:center">${r.i}-${r.to}</td><td>${fmtN(r.L,2)}</td></tr>`).join('')}</table>`}
function ldName(k){return String(k||'').split(/[+,]/).map(s=>{s=s.trim();return M8.LOAI_DAT[s]?M8.LOAI_DAT[s]+' ('+s+')':s}).join('; ')}
async function hoSo(kind){if(!(await ensureTopo()))return;let p=CUR;if(!p||kind==='pick'){p=await pickParcel('Chạm vào thửa cần lập hồ sơ');if(!p)return;selectParc(p,false)}return p}
async function trichLuc(){const p=await hoSo();if(!p)return;const S=svgParcel(p,620,460);
 printHTML('Trích lục thửa '+p.so,`${HDR}<h1>TRÍCH LỤC BẢN ĐỒ ĐỊA CHÍNH</h1><p style="text-align:center">(Số: ……… /TLBĐ)</p>
 <table class="nb"><tr><td>1. Thửa đất số: <b>${esc(p.so)}</b></td><td>Tờ bản đồ số: <b>${esc(CFG.to)}</b></td></tr><tr><td colspan="2">2. Địa chỉ thửa đất: ${esc(p.diachi||place())}</td></tr>
 <tr><td colspan="2">3. Diện tích: <b>${fmD(p.dt)} m²</b>${p.dtpl!=null?` (diện tích pháp lý: ${fmD(+p.dtpl)} m²)`:''}</td></tr><tr><td colspan="2">4. Mục đích sử dụng đất: ${esc(ldName(p.ld))}</td></tr><tr><td colspan="2">5. Tên người sử dụng đất: ${esc(p.chu||'')}</td></tr><tr><td colspan="2">6. Sơ đồ thửa đất:</td></tr></table>
 <div style="text-align:center;border:1px solid #000;margin:4px 0">${S.svg}</div><p style="margin:2px 0">7. Toạ độ đỉnh thửa và chiều dài cạnh (hệ VN-2000):</p>${coordTable(p)}
 <div class="sig"><div><i>…………, ${today()}</i><br><b>NGƯỜI TRÍCH LỤC</b><br><i>(Ký, ghi rõ họ tên)</i></div><div><i>…………, ${today()}</i><br><b>THỦ TRƯỞNG CƠ QUAN</b><br><i>(Ký tên, đóng dấu)</i></div></div>`)}
async function phieuDoDac(){const p=await hoSo();if(!p)return;const S=svgParcel(p,620,430);const nb=neighbors(p);
 printHTML('Phiếu đo đạc chỉnh lý thửa '+p.so,`${HDR}<h1>PHIẾU ĐO ĐẠC CHỈNH LÝ THỬA ĐẤT</h1>
 <p>1. Thửa đất số: <b>${esc(p.so)}</b>; Tờ bản đồ số: <b>${esc(CFG.to)}</b>; Tỷ lệ: 1/${CFG.tyle}<br>Địa chỉ thửa đất: ${esc(p.diachi||place())}<br>Diện tích sau đo đạc chỉnh lý: <b>${fmD(p.dt)} m²</b>; Mục đích sử dụng: ${esc(ldName(p.ld))}<br>
 Người sử dụng đất: ${esc(p.chu||'')}<br>Nội dung chỉnh lý: ………………………………………………………………</p>
 <p>2. Sơ đồ thửa đất (các thửa tiếp giáp: ${nb.map(q=>esc(q.so||'?')).join(', ')}):</p><div style="text-align:center;border:1px solid #000">${S.svg}</div><p>3. Bảng toạ độ đỉnh thửa:</p>${coordTable(p)}
 <div class="sig"><div><b>NGƯỜI ĐO ĐẠC</b><br><i>(Ký, ghi rõ họ tên)</i></div><div><i>…………, ${today()}</i><br><b>ĐƠN VỊ ĐO ĐẠC</b><br><i>(Ký tên, đóng dấu)</i></div></div>`)}
async function bienBan(){const p=await hoSo();if(!p)return;const S=svgParcel(p,620,400),nb=neighbors(p),v=edgeTable(p);
 printHTML('Biên bản ranh giới thửa '+p.so,`${HDR}<h1>BIÊN BẢN XÁC ĐỊNH RANH GIỚI, MỐC GIỚI THỬA ĐẤT</h1>
 <p>Hôm nay, ${today()}, đơn vị đo đạc đã tiến hành xác định ranh giới, mốc giới thửa đất số <b>${esc(p.so)}</b>, tờ bản đồ số <b>${esc(CFG.to)}</b> tại ${esc(p.diachi||place())}.<br>
 Người sử dụng đất: <b>${esc(p.chu||'…………………')}</b>. Diện tích đo đạc: <b>${fmD(p.dt)} m²</b>.</p><p><b>Sơ đồ thửa đất:</b></p><div style="text-align:center;border:1px solid #000">${S.svg}</div>
 <p><b>Mô tả ranh giới và mốc giới:</b> thửa có ${v.length} đỉnh, ranh giới đi qua các điểm ${v.map(r=>r.i).join(' - ')} - 1.</p>
 <p><b>Ý kiến của người sử dụng đất liền kề:</b></p><table><tr><th>Cạnh tiếp giáp</th><th>Thửa liền kề</th><th>Người sử dụng đất liền kề</th><th>Ký xác nhận</th></tr>${nb.map(q=>`<tr><td></td><td style="text-align:center">${esc(q.so||'')}</td><td>${esc(q.chu||'')}</td><td style="height:34px"></td></tr>`).join('')}</table>
 <div class="sig"><div><b>NGƯỜI SỬ DỤNG ĐẤT</b><br><i>(Ký, ghi rõ họ tên)</i></div><div><b>CÁN BỘ ĐO ĐẠC</b><br><i>(Ký, ghi rõ họ tên)</i></div></div><div class="sig"><div><b>CÔNG CHỨC ĐỊA CHÍNH CẤP XÃ</b><br><i>(Ký, ghi rõ họ tên)</i></div><div><b>XÁC NHẬN CỦA UBND CẤP XÃ</b><br><i>(Ký tên, đóng dấu)</i></div></div>`)}
async function soMucKe(){if(!(await ensureTopo()))return;const L=[...PARC].sort((a,b)=>(+a.so||1e9)-(+b.so||1e9));
 printHTML('Sổ mục kê tờ '+CFG.to,`${HDR}<h1>SỔ MỤC KÊ ĐẤT ĐAI</h1><p style="text-align:center">${esc(place())} · Tờ bản đồ số ${esc(CFG.to)}</p><table><tr><th>STT</th><th>Số thửa</th><th>Tên người sử dụng, quản lý đất</th><th>Diện tích (m²)</th><th>Loại đất</th><th>Địa chỉ</th><th>Ghi chú</th></tr>${L.map((p,i)=>`<tr><td>${i+1}</td><td>${esc(p.so)}</td><td>${esc(p.chu)}</td><td style="text-align:right">${fmD(p.dt)}</td><td>${esc(p.ld)}</td><td>${esc(p.diachi)}</td><td>${esc(p.ghichu)}</td></tr>`).join('')}
 <tr><th colspan="3">Tổng cộng: ${L.length} thửa</th><th style="text-align:right">${fmD(L.reduce((s,p)=>s+p.dt,0))}</th><th colspan="3"></th></tr></table><div class="sig"><div></div><div><i>…………, ${today()}</i><br><b>NGƯỜI LẬP</b></div></div>`)}
async function bangToaDo(){const p=await hoSo();if(!p)return;printHTML('Bảng toạ độ thửa '+p.so,`<h1>BẢNG TOẠ ĐỘ ĐỈNH THỬA ĐẤT</h1><p style="text-align:center">Thửa số ${esc(p.so)}, tờ bản đồ số ${esc(CFG.to)} – ${esc(place())}<br>Hệ toạ độ VN-2000 · Diện tích ${fmD(p.dt)} m²</p>${coordTable(p)}`)}
function statLD(){const m=new Map();for(const p of PARC){const k=(p.ld||'(chưa có)').split(/[+,]/)[0].trim();const o=m.get(k)||{n:0,a:0};o.n++;o.a+=p.dt;m.set(k,o)}return[...m].sort((a,b)=>b[1].a-a[1].a)}
async function inThongKe(){if(!(await ensureTopo()))return;const L=statLD(),tot=PARC.reduce((s,p)=>s+p.dt,0);printHTML('Thống kê loại đất',`<h1>BẢNG THỐNG KÊ DIỆN TÍCH THEO LOẠI ĐẤT</h1><p style="text-align:center">${esc(place())} · Tờ ${esc(CFG.to)}</p><table><tr><th>Loại đất</th><th>Tên loại đất</th><th>Số thửa</th><th>Diện tích (m²)</th><th>Tỷ lệ (%)</th></tr>${L.map(([k,o])=>`<tr><td>${esc(k)}</td><td>${esc(M8.LOAI_DAT[k]||'')}</td><td>${o.n}</td><td style="text-align:right">${fmD(o.a)}</td><td style="text-align:right">${fmtN(o.a/tot*100,2)}</td></tr>`).join('')}<tr><th colspan="2">Tổng</th><th>${PARC.length}</th><th style="text-align:right">${fmD(tot)}</th><th>100</th></tr></table>`)}
// ================= EXCEL / GEOJSON =================
let XLSX_=null;async function xlsxLib(){if(XLSX_)return XLSX_;if(window.XLSX)return XLSX_=window.XLSX;await new Promise((ok,no)=>{const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';s.onload=ok;s.onerror=()=>no(new Error('Không tải được thư viện Excel (cần mạng)'));document.head.appendChild(s)});return XLSX_=window.XLSX}
const ROWH=['Tờ','Số thửa','Diện tích bản đồ (m²)','Diện tích pháp lý (m²)','Loại đất','Chủ sử dụng','Địa chỉ','Ghi chú','X tâm','Y tâm'];
const rowOf=p=>{const t=toXY(...p.lp);return[CFG.to,p.so,+p.dt.toFixed(CFG.dtLe),p.dtpl==null||p.dtpl===''?'':+p.dtpl,p.ld,p.chu,p.diachi,p.ghichu,+t[0].toFixed(3),+t[1].toFixed(3)]};
async function exportXlsx(){if(!(await ensureTopo()))return;const rows=[ROWH,...[...PARC].sort((a,b)=>(+a.so||1e9)-(+b.so||1e9)).map(rowOf)],nm=(DOCI?DOCI.name.replace(/\.[^.]+$/,''):'thua-dat')+'.xlsx';
 try{const X=await xlsxLib(),wb=X.utils.book_new(),ws=X.utils.aoa_to_sheet(rows);ws['!cols']=[6,8,12,12,10,28,28,16,13,13].map(w=>({wch:w}));X.utils.book_append_sheet(wb,ws,'Thửa đất');
  const L=statLD();X.utils.book_append_sheet(wb,X.utils.aoa_to_sheet([['Loại đất','Tên','Số thửa','Diện tích (m²)'],...L.map(([k,o])=>[k,M8.LOAI_DAT[k]||'',o.n,+o.a.toFixed(2)])]),'Thống kê');
  await M8.saveAs(nm,new Blob([X.write(wb,{type:'array',bookType:'xlsx'})],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),[{description:'Excel',accept:{'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':['.xlsx']}}]);st('Đã xuất '+nm)}
 catch(e){const csv='﻿'+rows.map(r=>r.map(v=>`"${String(v==null?'':v).replace(/"/g,'""')}"`).join(',')).join('\r\n');await M8.saveAs(nm.replace('.xlsx','.csv'),new Blob([csv],{type:'text/csv'}),[{description:'CSV',accept:{'text/csv':['.csv']}}]);st('Không tải được thư viện Excel – đã xuất CSV')}}
async function importXlsx(){$('fXls').value='';$('fXls').click()}
$('fXls').onchange=async e=>{const f=e.target.files[0];if(!f)return;if(!(await ensureTopo()))return;try{const X=await xlsxLib(),wb=X.read(new Uint8Array(await f.arrayBuffer()),{type:'array'}),A=X.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1,defval:''});
 const nz=s=>String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/đ/g,'d');let hi=A.findIndex(r=>r.some(c=>/so thua/.test(nz(c))));if(hi<0){alert_('Không thấy cột “Số thửa” trong trang đầu');return}
 const h=A[hi].map(nz),col=re=>h.findIndex(c=>re.test(c)),cS=col(/so thua/),cL=col(/loai|muc dich/),cC=col(/chu|ten nguoi|ho ten/),cD=col(/dia chi/),cP=col(/phap ly/),cG=col(/ghi chu/);
 const by=new Map(PARC.map(p=>[String(p.so),p]));let n=0;for(const r of A.slice(hi+1)){const p=by.get(String(r[cS]).trim());if(!p)continue;const f2={};if(cL>=0&&r[cL]!=='')f2.ld=String(r[cL]).trim();if(cC>=0&&r[cC]!=='')f2.chu=String(r[cC]);if(cD>=0&&r[cD]!=='')f2.diachi=String(r[cD]);if(cP>=0&&r[cP]!=='')f2.dtpl=+String(r[cP]).replace(',','.');if(cG>=0&&r[cG]!=='')f2.ghichu=String(r[cG]);Object.assign(p,f2);gtpSetParcel(p,f2);n++}
 saveLocal();st(`Đã nhập thông tin ${n} thửa từ ${f.name}`);view()}catch(err){alert_(esc(err.message),'Không đọc được Excel')}};
async function exportGeo(){if(!(await ensureTopo()))return;const F=PARC.map(p=>({type:'Feature',properties:{to:CFG.to,so:p.so,dientich:+p.dt.toFixed(2),loaidat:p.ld,chu:p.chu,diachi:p.diachi},geometry:{type:'Polygon',coordinates:p.rings.map(r=>{const o=[];for(let i=0;i<=r.length;i+=2){const j=i%r.length,t=toXY(r[j],r[j+1]);o.push([+t[1].toFixed(3),+t[0].toFixed(3)])}return o})}}));
 await M8.saveAs((DOCI?DOCI.name.replace(/\.[^.]+$/,''):'thua')+'.geojson',new Blob([JSON.stringify({type:'FeatureCollection',name:'VN-2000',features:F})],{type:'application/geo+json'}),[{description:'GeoJSON',accept:{'application/geo+json':['.geojson']}}]);st('Đã xuất GeoJSON (toạ độ VN-2000: Đông, Bắc)')}
// ================= THIẾT LẬP =================
async function cfgSheet(){const r=await form('Thông tin tờ bản đồ',[{k:'tinh',l:'Tỉnh/thành phố',v:CFG.tinh},{k:'huyen',l:'Huyện (để trống nếu đã bỏ cấp huyện)',v:CFG.huyen},{k:'xa',l:'Xã/phường/thị trấn',v:CFG.xa},{k:'to',l:'Tờ bản đồ số',v:CFG.to},{k:'tl',l:'Tỷ lệ 1:',t:'number',v:CFG.tyle},{k:'lk',l:'Giữ số tờ (không tự lấy theo tên tệp)',t:'check',v:!!CFG.toLock}]);if(!r)return;
 Object.assign(CFG,{tinh:r.tinh,huyen:r.huyen,xa:r.xa,to:r.to,tyle:+r.tl||1000,toLock:r.lk});saveCfg();if(GTP&&PARC.length)linkGtp();view()}
async function cfgLevels(){const N=CFG.nhan,r=await form('Thiết lập lớp và nhãn',[{k:'r',l:'Lớp ranh thửa (nhiều lớp cách dấu phẩy)',v:CFG.lvRanh},{k:'n',l:'Lớp chữ nhãn thửa (để đọc nhãn)',v:CFG.lvNhan},{k:'tol',l:'Dung sai bắt nối ranh (m)',t:'number',v:CFG.tol},
 {k:'kieu',l:'Kiểu nhãn',t:'select',v:CFG.kieu,o:[['3dong','3 dòng: số thửa / diện tích / loại đất'],['phanso','Phân số: số thửa trên, diện tích dưới, loại đất bên phải']]},{k:'h',l:'Cao chữ nhãn (mm trên giấy)',t:'number',v:CFG.hNhan},
 {k:'sl',l:'Số thửa – lớp',t:'number',v:N.so.lv},{k:'sc',l:'Số thửa – màu',t:'number',v:N.so.c},{k:'dl',l:'Diện tích – lớp',t:'number',v:N.dt.lv},{k:'dc',l:'Diện tích – màu',t:'number',v:N.dt.c},{k:'ll',l:'Loại đất – lớp',t:'number',v:N.ld.lv},{k:'lc',l:'Loại đất – màu',t:'number',v:N.ld.c},
 {k:'le',l:'Số lẻ diện tích',t:'number',v:CFG.dtLe},{k:'sep',l:'Dấu thập phân',t:'select',v:CFG.dtSep,o:[[',','Dấu phẩy (123,4)'],['.','Dấu chấm (123.4)']]},{k:'kt',l:'Lớp ghi kích thước cạnh',t:'number',v:CFG.lvKT},{k:'dd',l:'Lớp số hiệu đỉnh',t:'number',v:CFG.lvDinh},{k:'kh',l:'Lớp khung bản đồ',t:'number',v:CFG.lvKhung},{k:'rm',l:'Lớp vẽ đường tách thửa mới',t:'number',v:CFG.lvRanhMoi},{k:'lech',l:'Ngưỡng chênh lệch diện tích (%)',t:'number',v:CFG.lech}]);if(!r)return;
 Object.assign(CFG,{lvRanh:r.r,lvNhan:r.n,tol:+r.tol||0.02,kieu:r.kieu,hNhan:+r.h||2,dtLe:+r.le|0,dtSep:r.sep,lvKT:+r.kt,lvDinh:+r.dd,lvKhung:+r.kh,lvRanhMoi:+r.rm,lech:+r.lech||5,nhan:{so:{lv:+r.sl,c:+r.sc},dt:{lv:+r.dl,c:+r.dc},ld:{lv:+r.ll,c:+r.lc}}});saveCfg();DIRTY=true;st('Đã lưu thiết lập')}
// ================= GIAO DIỆN =================
let PANEL='home',FILTER='',OPEN=null;
const MENU=[['ht','Hệ thống',[['Thông tin tờ bản đồ',cfgSheet],['Thiết lập lớp và nhãn',cfgLevels],['Kết nối lại bản đồ',connect],['Giới thiệu',()=>alert_('<b>M8 Pro Địa chính 1.0</b>\nBiên tập bản đồ địa chính, thửa đất, hồ sơ – chạy cùng M8 Pro Bản đồ.\n\nTác giả, bản quyền: <b>Nguyễn Xuân Thủy</b> – ĐT 0972839747')]]],
 ['td','Thửa đất',[['Tạo thửa từ ranh',()=>buildTopo()],['Chọn thửa trên bản đồ',async()=>{const p=await pickParcel();if(p)selectParc(p,false)}],['Danh sách thửa',()=>{PANEL='bang';view()}],['Tô màu theo loại đất',()=>{SHOWLD=!SHOWLD;showTopo()}],['Ẩn/hiện vùng thửa',()=>{TOPOFF=!TOPOFF;showTopo()}]]],
 ['kt','Kiểm tra ranh',[['Tìm lỗi ranh và nhãn',checkErr],['Sửa lỗi ranh tự động',fixErr],['Xoá dấu lỗi',()=>{ERRS=[];call('overlay',{key:'dc:err',items:null});view()}]]],
 ['nh','Nhãn & số thửa',[['Vẽ nhãn tất cả thửa',()=>drawLabels()],['Vẽ nhãn thửa chọn',async()=>{const p=await pickParcel();if(p)drawLabels([p])}],['Đánh số thửa tự động',autoNumber],['Xoá nhãn thửa',delLabels]]],
 ['bt','Biên tập',[['Tách thửa',splitParcel],['Gộp thửa',mergeParcels],['Ghi kích thước cạnh',()=>forParcels('Ghi kích thước cạnh',dimEls)],['Đánh số hiệu đỉnh thửa',()=>forParcels('Đánh số hiệu đỉnh',vertEls)],['Vẽ khung bản đồ địa chính',drawFrame]]],
 ['tt','Thuộc tính',[['Mở tệp thuộc tính (.gtp)',openGtp],['Cập nhật từ bản đồ vào tệp thuộc tính',pushGtp],['Lưu tệp thuộc tính',saveGtp],['Nhập thông tin từ Excel',importXlsx],['Xuất Excel danh sách thửa',exportXlsx]]],
 ['hs','Hồ sơ',[['Trích lục bản đồ địa chính',trichLuc],['Phiếu đo đạc chỉnh lý thửa đất',phieuDoDac],['Biên bản xác định ranh giới, mốc giới',bienBan],['Bảng toạ độ đỉnh thửa',bangToaDo],['Sổ mục kê đất đai (tờ bản đồ)',soMucKe]]],
 ['tk','Thống kê',[['Diện tích theo loại đất',()=>{PANEL='tk';view()}],['In bảng thống kê',inThongKe],['Thửa chênh lệch diện tích',()=>{PANEL='lech';view()}],['Xuất GeoJSON',exportGeo]]]];
function buildMenu(){const m=$('menu');m.innerHTML='';const h=document.createElement('button');h.textContent='⌂';h.title='Tổng quan';h.onclick=()=>{PANEL='home';OPEN=null;sub();view()};m.appendChild(h);
 for(const[k,n]of MENU){const b=document.createElement('button');b.textContent=n+' ▾';b.dataset.g=k;b.onclick=()=>{OPEN=OPEN===k?null:k;sub()};m.appendChild(b)}}
function sub(){const s=$('sub');s.innerHTML='';document.querySelectorAll('#menu [data-g]').forEach(b=>b.classList.toggle('open',b.dataset.g===OPEN));if(!OPEN){s.style.display='none';return}s.style.display='flex';
 for(const[n,f]of MENU.find(x=>x[0]===OPEN)[2]){const b=document.createElement('button');b.textContent=n;b.onclick=async()=>{OPEN=null;sub();try{if(!MAP&&!['Giới thiệu','Thông tin tờ bản đồ','Thiết lập lớp và nhãn','Kết nối lại bản đồ'].includes(n)){if(!(await connect()))return}await f()}catch(e){console.error(e);st('Lỗi: '+(e.message||e))}};s.appendChild(b)}}
function view(){const B=$('body');if(!MAP){return}let h='';
 if(PANEL==='home'){const nn=PARC.filter(p=>!p.so).length,tot=PARC.reduce((s,p)=>s+p.dt,0);
  h=`<div class="card"><h3>Tờ bản đồ</h3><div class="kv"><b>Bản đồ</b><span>${esc(DOCI?DOCI.name:'(chưa mở tệp trong M8 Pro Bản đồ)')}</span><b>Đơn vị</b><span>${esc(place()||'— (Hệ thống → Thông tin tờ bản đồ)')}</span><b>Tờ số</b><span>${esc(CFG.to||'—')} · tỷ lệ 1:${CFG.tyle}</span>
  <b>Lớp ranh / nhãn</b><span>${esc(CFG.lvRanh)} / ${esc(CFG.lvNhan)}</span><b>Thửa</b><span>${PARC.length?`${PARC.length} thửa · ${fmD(tot)} m²`+(nn?` · <span class="er">${nn} chưa có số</span>`:''):'chưa tạo'}${DIRTY&&PARC.length?' · <span class="er">bản đồ đã sửa</span>':''}</span>
  <b>Tệp thuộc tính</b><span>${GTP?esc(GTP.name)+` · ${gRows().length} thửa · liên kết ${PARC.filter(p=>p.gid!=null).length}`+(GTP.dirty?' · <span class="er">chưa lưu</span>':''):'chưa mở (dữ liệu lưu trên máy)'}</span></div>
  <div class="btns"><button class="p" data-a="topo">⬡ Tạo thửa từ ranh</button><button data-a="pick">☝ Chọn thửa</button><button data-a="bang">☰ Danh sách thửa</button><button data-a="err">⚠ Kiểm tra lỗi</button><button data-a="gtp">📂 Mở .gtp</button></div></div>
  <div class="card"><h3>Quy trình thường dùng</h3><ol style="margin:0;padding-left:18px;line-height:1.7"><li>Mở bản đồ trong M8 Pro Bản đồ, kiểm tra <b>lớp ranh thửa</b> (Hệ thống → Thiết lập lớp).</li><li><b>Kiểm tra ranh</b> → Sửa lỗi ranh tự động → <b>Tạo thửa từ ranh</b>.</li><li>Mở tệp thuộc tính .gtp (nếu có) hoặc nhập từ Excel; <b>Đánh số thửa</b>, <b>Vẽ nhãn</b>.</li><li>Lập <b>hồ sơ</b> (trích lục, phiếu đo đạc, biên bản), <b>thống kê</b>, lưu bản đồ và tệp thuộc tính.</li></ol></div>`}
 else if(PANEL==='bang'){const f=FILTER.toLowerCase(),L=[...PARC].filter(p=>!f||[p.so,p.ld,p.chu,p.diachi].some(v=>String(v||'').toLowerCase().includes(f))).sort((a,b)=>(+a.so||1e9)-(+b.so||1e9));
  h=`<div class="card"><div style="display:flex;gap:6px;align-items:center"><input id="flt" placeholder="Tìm số thửa, chủ, loại đất…" value="${esc(FILTER)}" style="flex:1"><span class="pill">${L.length}/${PARC.length}</span></div></div><div class="tw"><table class="t"><tr><th>Số</th><th>DT bản đồ</th><th>DT pháp lý</th><th>Loại</th><th>Chủ sử dụng</th></tr>
  ${L.slice(0,3000).map(p=>`<tr data-i="${p.i}" class="${p===CUR?'sel':''}"><td>${esc(p.so)||'<span class="er">?</span>'}${p.gid!=null?' <span title="đã liên kết tệp thuộc tính">🔗</span>':''}</td><td>${fmD(p.dt)}</td><td>${p.dtpl==null?'':fmD(+p.dtpl)}</td><td>${esc(p.ld)}</td><td>${esc(p.chu)}</td></tr>`).join('')}</table></div>`}
 else if(PANEL==='thua'&&CUR){const p=CUR,nb=neighbors(p),et=edgeTable(p);
  h=`<div class="card"><h3>Thửa ${esc(p.so||'(chưa có số)')} <span class="pill">${fmD(p.dt)} m²</span> ${p.gid!=null?'<span class="pill">🔗 tệp thuộc tính</span>':''}</h3><div class="fg">
  <label>Số thửa<input data-f="so" value="${esc(p.so)}"></label><label>Loại đất (ký hiệu)<input data-f="ld" value="${esc(p.ld)}" list="ldl"></label><label>Diện tích pháp lý (m²)<input data-f="dtpl" value="${p.dtpl==null?'':esc(p.dtpl)}"></label>
  <label style="grid-column:1/-1">Chủ sử dụng<input data-f="chu" value="${esc(p.chu)}"></label><label style="grid-column:1/-1">Địa chỉ thửa đất<input data-f="diachi" value="${esc(p.diachi)}"></label><label style="grid-column:1/-1">Ghi chú<input data-f="ghichu" value="${esc(p.ghichu)}"></label></div>
  <datalist id="ldl">${Object.entries(M8.LOAI_DAT).map(([k,v])=>`<option value="${k}">${esc(v)}</option>`).join('')}</datalist>
  <div class="muted" style="margin-top:4px">${esc(ldName(p.ld))}${p.dtNhan!=null?` · diện tích trên nhãn: ${fmD(p.dtNhan)} m²`:''} · ${et.length} đỉnh · liền kề: ${nb.map(q=>esc(q.so||'?')).join(', ')||'—'}</div>
  <div class="btns"><button class="p" data-a="lab1">Vẽ nhãn</button><button data-a="zoom">Phóng tới</button><button data-a="tl">Trích lục</button><button data-a="pd">Phiếu đo đạc</button><button data-a="bb">Biên bản ranh giới</button><button data-a="dim1">Ghi kích thước</button><button data-a="vx1">Số hiệu đỉnh</button></div></div>
  <div class="card"><h3>Toạ độ đỉnh (VN-2000)</h3><table class="t"><tr><th>Đỉnh</th><th>X</th><th>Y</th><th>Cạnh (m)</th></tr>${et.map(r=>`<tr><td>${r.i}</td><td>${fmtN(r.X,3)}</td><td>${fmtN(r.Y,3)}</td><td>${r.i}-${r.to}: ${fmtN(r.L,2)}</td></tr>`).join('')}</table></div>`}
 else if(PANEL==='loi'){h=`<div class="card"><h3>Lỗi ranh và nhãn (${ERRS.length})</h3><div class="muted">Chạm vào dòng để phóng tới vị trí lỗi trên bản đồ</div></div><div class="tw"><table class="t"><tr><th>#</th><th>Lỗi</th><th>Vị trí (X, Y)</th></tr>${ERRS.slice(0,3000).map((e,i)=>{const t=toXY(...e.at);return`<tr data-e="${i}"><td>${i+1}</td><td>${esc(e.t)}</td><td>${fmtN(t[0],2)}; ${fmtN(t[1],2)}</td></tr>`}).join('')}</table></div>`}
 else if(PANEL==='tk'){const L=statLD(),tot=PARC.reduce((s,p)=>s+p.dt,0);h=`<div class="card"><h3>Diện tích theo loại đất</h3><table class="t"><tr><th>Loại</th><th>Tên</th><th>Thửa</th><th>Diện tích (m²)</th><th>%</th></tr>${L.map(([k,o])=>`<tr><td>${esc(k)}</td><td>${esc(M8.LOAI_DAT[k]||'')}</td><td>${o.n}</td><td>${fmD(o.a)}</td><td>${fmtN(o.a/tot*100,1)}</td></tr>`).join('')}<tr><th colspan="2">Tổng</th><th>${PARC.length}</th><th>${fmD(tot)}</th><th>100</th></tr></table></div>`}
 else if(PANEL==='lech'){const L=PARC.filter(p=>{const r=p.dtpl!=null&&p.dtpl!==''?+p.dtpl:p.dtNhan;return r!=null&&Math.abs(r-p.dt)>Math.max(.1,p.dt*CFG.lech/100)});h=`<div class="card"><h3>Thửa chênh lệch diện tích quá ${CFG.lech}% (${L.length})</h3><table class="t"><tr><th>Số</th><th>Bản đồ</th><th>Pháp lý/nhãn</th><th>Chênh</th></tr>${L.map(p=>{const r=p.dtpl!=null&&p.dtpl!==''?+p.dtpl:p.dtNhan;return`<tr data-i="${p.i}"><td>${esc(p.so)}</td><td>${fmD(p.dt)}</td><td>${fmD(r)}</td><td>${fmD(p.dt-r)}</td></tr>`}).join('')}</table></div>`}
 B.innerHTML=h;
 B.querySelectorAll('[data-a]').forEach(b=>b.onclick=async()=>{const a=b.dataset.a;try{if(a==='topo')await buildTopo();else if(a==='pick'){const p=await pickParcel();if(p)selectParc(p,false)}else if(a==='bang'){PANEL='bang';view()}else if(a==='err')await checkErr();else if(a==='gtp')await openGtp();
  else if(a==='lab1')await drawLabels([CUR]);else if(a==='zoom')selectParc(CUR,true);else if(a==='tl')await trichLuc();else if(a==='pd')await phieuDoDac();else if(a==='bb')await bienBan();
  else if(a==='dim1'){await call('applyEdits',{label:'Ghi kích thước cạnh',add:dimEls(CUR)});DIRTY=true}else if(a==='vx1'){await call('applyEdits',{label:'Số hiệu đỉnh',add:vertEls(CUR)});DIRTY=true}}catch(e){st('Lỗi: '+e.message)}});
 B.querySelectorAll('tr[data-i]').forEach(r=>r.onclick=()=>selectParc(PARC.find(p=>p.i===+r.dataset.i),true));
 B.querySelectorAll('tr[data-e]').forEach(r=>r.onclick=()=>{const e=ERRS[+r.dataset.e],d=Math.max(H()*6,5000);call('zoomTo',{bbox:[e.at[0]-d,e.at[1]-d,e.at[0]+d,e.at[1]+d]});call('overlay',{key:'dc:err1',items:[{pt:e.at,r:14,stroke:'#ff1744'}]})});
 const fl=$('flt');if(fl){fl.oninput=()=>{FILTER=fl.value;const pos=fl.selectionStart;view();const n=$('flt');n.focus();n.setSelectionRange(pos,pos)}}
 B.querySelectorAll('[data-f]').forEach(i=>i.onchange=()=>{const k=i.dataset.f,p=CUR;let v=i.value.trim();if(k==='dtpl')v=v===''?null:+v.replace(',','.');if(k==='ld')v=v.toUpperCase();
  if(k==='so'&&v&&PARC.some(q=>q!==p&&q.so===v)){st('Số thửa '+v+' đã có trong tờ');i.value=p.so;return}p[k]=v;gtpSetParcel(p,{[k]:v});saveLocal();st('Đã cập nhật '+k+(p.gid!=null?' (cả tệp thuộc tính – nhớ lưu)':'')+' · bấm “Vẽ nhãn” để cập nhật nhãn trên bản đồ');if(k==='ld'&&SHOWLD)showTopo()})}
if(EMBED)$('bMap').style.display='none';buildMenu();sub();connect();
window.addEventListener('beforeunload',e=>{if(GTP&&GTP.dirty){e.preventDefault();e.returnValue=''}});
