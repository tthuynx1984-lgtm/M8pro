/* M8 Pro Bản đồ – trình biên tập bản đồ số địa chính. © Nguyễn Xuân Thủy (ĐT 0972839747) */
'use strict';
const {GEO,D8}=M8;
const $=id=>document.getElementById(id);
const DESK=M8.isDesktop();document.body.classList.add(DESK?'desk':'phone');
const VER='1.0';
// ================= TRẠNG THÁI =================
let DOC=null,NID=0,REFS=[],SEL=new Set(),FENCE=null,CMD=null,TX=null,OVL=new Map(),HL=null;
const UNDO=[],REDO=[];
const ACT=Object.assign({lv:1,c:0,w:0,st:0,th:2.5,tj:'bl',tr:0,font:0x401,snapOn:true,snap:['end','mid','int','cen','near','perp'],axis:false,grid:false,gstep:10,bg:'#000000',
 ktt:105,k0:0.9999,sat:false,satOp:.9,snapPx:DESK?12:26,dec:3,cross:false,lvNames:{}},(()=>{try{return JSON.parse(localStorage.getItem('m8b:act')||'{}')}catch(e){return{}}})());
ACT.snap=new Set(ACT.snap);
const saveAct=()=>{try{localStorage.setItem('m8b:act',JSON.stringify({...ACT,snap:[...ACT.snap]}))}catch(e){}};
const U=1000;   // 1 m = 1000 đơn vị lưu (mm)
// ================= GIAO DIỆN NHỎ =================
let _mt=0;function msg(t,ms){const m=$('msg');m.textContent=t;m.style.display='block';clearTimeout(_mt);_mt=setTimeout(()=>m.style.display='none',ms||2600)}
const prompt_=t=>{$('pr').textContent=t};
function dlg(html,onInit){return new Promise(res=>{const b=$('dlgB');b.innerHTML=html;$('dlg').style.display='flex';const close=v=>{$('dlg').style.display='none';b.innerHTML='';res(v)};
 b.querySelectorAll('[data-r]').forEach(x=>x.onclick=()=>{const r=x.dataset.r;if(r==='ok'){const o={};b.querySelectorAll('[name]').forEach(i=>o[i.name]=i.type==='checkbox'?i.checked:i.value);close(o)}else close(r==='x'?null:r)});
 b.querySelectorAll('input').forEach(i=>i.addEventListener('keydown',e=>{if(e.key==='Enter'){const k=b.querySelector('[data-r=ok]');if(k)k.click()}}));
 if(onInit)onInit(b,close);const f=b.querySelector('input,select');if(f&&DESK)setTimeout(()=>f.focus(),30)})}
// biểu mẫu: fields [{k,l,t:'text'|'number'|'select'|'check',v,o:[[v,l]]}]
function form(title,fields,okL){const h=`<h3>${M8.esc(title)}</h3>`+fields.map(f=>f.t==='check'?`<label class="f" style="flex-direction:row;gap:6px;align-items:center"><input type="checkbox" name="${f.k}" ${f.v?'checked':''}>${M8.esc(f.l)}</label>`:
 f.t==='select'?`<div class="f"><span>${M8.esc(f.l)}</span><select name="${f.k}">${f.o.map(o=>`<option value="${M8.esc(o[0])}" ${String(o[0])===String(f.v)?'selected':''}>${M8.esc(o[1])}</option>`).join('')}</select></div>`:
 f.t==='note'?`<p style="margin:4px 0;opacity:.8">${f.l}</p>`:
 `<div class="f"><span>${M8.esc(f.l)}</span><input name="${f.k}" type="${f.t||'text'}" step="any" value="${M8.esc(f.v==null?'':f.v)}"></div>`).join('')+`<div class="bt"><button data-r="x">Hủy</button><button class="p" data-r="ok">${okL||'Đồng ý'}</button></div>`;return dlg(h)}
const alert_=(t,title)=>dlg(`<h3>${M8.esc(title||'Thông báo')}</h3><div style="white-space:pre-wrap;line-height:1.5">${t}</div><div class="bt"><button class="p" data-r="ok">Đóng</button></div>`);
const confirm_=(t,ok)=>dlg(`<h3>Xác nhận</h3><div style="white-space:pre-wrap;line-height:1.5">${t}</div><div class="bt"><button data-r="x">Hủy</button><button class="p" data-r="ok">${ok||'Đồng ý'}</button></div>`).then(v=>!!v);
// ================= MÀU, KIỂU ĐƯỜNG =================
const DEFP=(()=>{const a=[[255,255,255],[0,0,255],[0,255,0],[255,0,0],[255,255,0],[255,0,255],[255,127,0],[0,255,255]],o=new Uint8Array(768);
 for(let i=0;i<256;i++){let c=a[i];if(!c){const h=(i*37)%360,l=30+(i*13)%50;const f=(n,k=(n+h/30)%12)=>l/100-.6*Math.min(l/100,1-l/100)*Math.max(-1,Math.min(k-3,9-k,1));c=[f(0)*255,f(8)*255,f(4)*255]}o.set(c.map(Math.round),i*3)}return o})();
const pal=()=>DOC&&DOC.pal||DEFP;
const colOf=c=>{const P=pal();c=(c|0)&255;return`rgb(${P[c*3]},${P[c*3+1]},${P[c*3+2]})`};
const DASH=[[],[2,4],[10,6],[12,4,3,4],[14,5],[2,5],[8,3,2,3],[16,8]];
const LT_NAMES=['0 Liền','1 Chấm','2 Gạch','3 Gạch-chấm','4 Gạch dài','5 Chấm thưa','6 Gạch-chấm ngắn','7 Gạch rất dài'];
// ================= KHUNG NHÌN =================
const VIEWS=[];let AV=0;
function mkView(el){const cv=el.querySelector('canvas'),v={el,cv,g:cv.getContext('2d'),cx:0,cy:0,s:1,hist:[],fut:[],W:1,H:1};VIEWS.push(v);bindView(v);return v}
const V=()=>VIEWS[AV];
const sx=(v,x)=>(x-v.cx)*v.s+v.W/2,sy=(v,y)=>v.H/2-(y-v.cy)*v.s,wx=(v,X)=>(X-v.W/2)/v.s+v.cx,wy=(v,Y)=>(v.H/2-Y)/v.s+v.cy;
function resize(){const d=devicePixelRatio||1;for(const v of VIEWS){const r=v.el.getBoundingClientRect();v.W=r.width;v.H=r.height;v.cv.width=Math.max(1,r.width*d);v.cv.height=Math.max(1,r.height*d);v.g.setTransform(d,0,0,d,0,0)}redraw()}
function pushView(v){v.hist.push([v.cx,v.cy,v.s]);if(v.hist.length>50)v.hist.shift();v.fut.length=0}
function fit(v,bb){v=v||V();bb=bb||extent();if(!bb)return;pushView(v);const w=Math.max(bb[2]-bb[0],1),h=Math.max(bb[3]-bb[1],1);v.cx=(bb[0]+bb[2])/2;v.cy=(bb[1]+bb[3])/2;v.s=Math.min(v.W/w,v.H/h)*.9;redraw()}
function zoomAt(v,X,Y,f){const x=wx(v,X),y=wy(v,Y);v.s*=f;v.cx=x-(X-v.W/2)/v.s;v.cy=y-(v.H/2-Y)/v.s;redraw()}
function extent(){if(!DOC)return null;let b=null;for(const p of allPrims()){if(p.del)continue;const q=bbOf(p);if(!b)b=q.slice();else{b[0]=Math.min(b[0],q[0]);b[1]=Math.min(b[1],q[1]);b[2]=Math.max(b[2],q[2]);b[3]=Math.max(b[3],q[3])}}return b}
// ================= PHẦN TỬ =================
function bbOf(p){if(p.bb)return p.bb;let b;
 if(p.k==='L'||p.k==='S')b=GEO.bbox(p.p);
 else if(p.k==='E'){const r=Math.max(p.e[0],p.e[1]);b=[p.e[3]-r,p.e[4]-r,p.e[3]+r,p.e[4]+r]}
 else if(p.k==='A'){const a=p.a,q=GEO.arcPts(a[5],a[6],a[2],a[0],a[1],24);b=GEO.bbox(q)}
 else if(p.k==='T'){const q=textBox(p);b=GEO.bbox(q)}else b=[0,0,0,0];return p.bb=b}
const _mc=document.createElement('canvas').getContext('2d');
function textW(s,h){_mc.font='100px "Times New Roman",Tinos,serif';return _mc.measureText(String(s)).width/100*h/0.662}
// 4 góc khung chữ (gốc = trái-dưới chân chữ)
function textBox(p){const L=p.tw||textW(p.s,p.h),h=p.h,c=Math.cos(p.r||0),s=Math.sin(p.r||0);return[[0,-h*.25],[L,-h*.25],[L,h*1.15],[0,h*1.15]].flatMap(([u,v])=>[p.x+u*c-v*s,p.y+u*s+v*c])}
function norm(p){p.id=++NID;if(p.k==='T'){if(p.tw==null){p.tw=p.w;p.w=0}if(!p.tw)p.tw=textW(p.s,p.h)}p.lv=p.lv||0;p.c=p.c||0;p.w=p.w||0;p.st=p.st||0;return p}
function clone(p){const o={...p};delete o.bb;if(p.p)o.p=p.p.slice();if(p.e)o.e=p.e.slice();if(p.a)o.a=p.a.slice();return o}
function allPrims(){const a=DOC?DOC.prims:[];if(!REFS.length)return a;return a.concat(...REFS.filter(r=>r.on).map(r=>r.prims))}
const lvOn=lv=>!DOC||!DOC.lvOff.has(lv);
const editable=p=>p&&!p.ref&&!p.del&&lvOn(p.lv)&&!(DOC.lvLock&&DOC.lvLock.has(p.lv));
const KN={L:'Đường',S:'Vùng kín',E:'Đường tròn/elip',A:'Cung tròn',T:'Chữ'};
const kname=p=>p.k==='L'?(p.p.length===4?'Đoạn thẳng':p.p[0]===p.p[2]&&p.p[1]===p.p[3]&&p.p.length===4?'Điểm':'Đường gấp khúc'):KN[p.k]||p.k;
// toạ độ hiển thị (địa chính: X = Bắc, Y = Đông, đơn vị m)
const org=()=>DOC?DOC.org:[0,0];
const toXY=(x,y)=>[(y-org()[1])/U,(x-org()[0])/U];          // → [X Bắc, Y Đông]
const fromXY=(X,Y)=>[Y*U+org()[0],X*U+org()[1]];
const fm=(v,d)=>(+v).toFixed(d==null?ACT.dec:d);
const fmXY=(x,y)=>{const t=toXY(x,y);return`X=${fm(t[0])} Y=${fm(t[1])}`};
// ================= CHỈ MỤC KHÔNG GIAN =================
const IDX={g:null,cs:1,b0:[0,0],dirty:true};
function idxBuild(){const P=allPrims(),bb=extent()||[0,0,1,1],n=Math.max(P.length,1);IDX.cs=Math.max((bb[2]-bb[0]+bb[3]-bb[1])/2/Math.max(8,Math.sqrt(n)/2),1);IDX.b0=[bb[0],bb[1]];IDX.g=new Map();
 for(const p of P){if(p.del)continue;idxIns(p)}IDX.dirty=false}
function idxIns(p){const b=bbOf(p),c=IDX.cs,i0=Math.floor((b[0]-IDX.b0[0])/c),i1=Math.floor((b[2]-IDX.b0[0])/c),j0=Math.floor((b[1]-IDX.b0[1])/c),j1=Math.floor((b[3]-IDX.b0[1])/c);
 if((i1-i0+1)*(j1-j0+1)>4000){(IDX.big||(IDX.big=new Set())).add(p);return}
 for(let i=i0;i<=i1;i++)for(let j=j0;j<=j1;j++){const k=i*1e7+j;let L=IDX.g.get(k);if(!L)IDX.g.set(k,L=[]);L.push(p)}}
function idxQ(x0,y0,x1,y1){if(IDX.dirty){IDX.big=null;idxBuild()}const c=IDX.cs,out=new Set(IDX.big||[]),i0=Math.floor((x0-IDX.b0[0])/c),i1=Math.floor((x1-IDX.b0[0])/c),j0=Math.floor((y0-IDX.b0[1])/c),j1=Math.floor((y1-IDX.b0[1])/c);
 if((i1-i0+1)*(j1-j0+1)>20000){for(const p of allPrims())if(!p.del)out.add(p);return out}
 for(let i=i0;i<=i1;i++)for(let j=j0;j<=j1;j++){const L=IDX.g.get(i*1e7+j);if(L)for(const p of L)if(!p.del)out.add(p)}return out}
// ================= HÌNH HỌC PHẦN TỬ =================
// danh sách đoạn của phần tử (cung/tròn rời rạc hoá)
function segsOf(p){const s=[];if(p.k==='L'||p.k==='S'){const q=p.p;for(let i=2;i<q.length;i+=2)s.push([q[i-2],q[i-1],q[i],q[i+1],(i>>1)-1]);if(p.k==='S'&&q.length>=6&&(q[0]!==q[q.length-2]||q[1]!==q[q.length-1]))s.push([q[q.length-2],q[q.length-1],q[0],q[1],q.length/2-1])}
 else if(p.k==='E'){const e=p.e,n=72;let pr=null;for(let i=0;i<=n;i++){const t=i/n*2*Math.PI,c=Math.cos(e[2]),sn=Math.sin(e[2]),u=e[0]*Math.cos(t),w=e[1]*Math.sin(t),x=e[3]+u*c-w*sn,y=e[4]+u*sn+w*c;if(pr)s.push([pr[0],pr[1],x,y,-1]);pr=[x,y]}}
 else if(p.k==='A'){const a=p.a,q=GEO.arcPts(a[5],a[6],a[2],a[0]+a[4],a[1]);for(let i=2;i<q.length;i+=2)s.push([q[i-2],q[i-1],q[i],q[i+1],-1])}
 else if(p.k==='T'){const q=textBox(p);for(let i=0;i<4;i++){const j=(i+1)%4;s.push([q[2*i],q[2*i+1],q[2*j],q[2*j+1],-2])}}return s}
function vertsOf(p){if(p.k==='L'||p.k==='S'){const o=[];for(let i=0;i<p.p.length;i+=2)o.push([p.p[i],p.p[i+1],i>>1]);return o}
 if(p.k==='A'){const a=p.a,a0=a[0]+a[4];return[[a[5]+a[2]*Math.cos(a0),a[6]+a[2]*Math.sin(a0),0],[a[5]+a[2]*Math.cos(a0+a[1]),a[6]+a[2]*Math.sin(a0+a[1]),1]]}
 if(p.k==='E'){const e=p.e;return[[e[3]+e[0],e[4],0],[e[3],e[4]+e[1],1],[e[3]-e[0],e[4],2],[e[3],e[4]-e[1],3]]}
 if(p.k==='T')return[[p.x,p.y,0]];return[]}
function centerOf(p){if(p.k==='E')return[p.e[3],p.e[4]];if(p.k==='A')return[p.a[5],p.a[6]];if(p.k==='S')return GEO.centroid(p.p);if(p.k==='T'){const q=textBox(p);return[(q[0]+q[4])/2,(q[1]+q[5])/2]}return null}
// khoảng cách điểm → phần tử
function distTo(p,x,y){if(p.k==='T'){const q=textBox(p);if(GEO.inPoly(x,y,q))return[0,null];}let best=[1/0,null];for(const s of segsOf(p)){const r=GEO.segPt(x,y,s[0],s[1],s[2],s[3]);if(r[0]<best[0])best=[r[0],s,r]}best[0]=Math.sqrt(best[0]);return best}
function hitAt(x,y,tol,f){let best=null;for(const p of idxQ(x-tol,y-tol,x+tol,y+tol)){if(!lvOn(p.lv))continue;if(f&&!f(p))continue;const d=distTo(p,x,y);if(d[0]<=tol&&(!best||d[0]<best.d-1e-9||(Math.abs(d[0]-best.d)<1e-9&&SEL.has(p))))best={p,d:d[0],seg:d[1],r:d[2]}}return best}
// ================= BẮT ĐIỂM =================
const SNAPN={end:'Đầu mút/Đỉnh',mid:'Trung điểm',cen:'Tâm',int:'Giao điểm',near:'Gần nhất',perp:'Vuông góc',grid:'Lưới'};
let SNAP=null;   // điểm bắt hiện tại {x,y,t,p}
function snapAt(v,X,Y,lastPt){const x=wx(v,X),y=wy(v,Y);if(!DOC)return{x,y};const tol=ACT.snapPx/v.s;
 if(ACT.snapOn&&ACT.snap.size){const C=[],S=[],ps=[...idxQ(x-tol,y-tol,x+tol,y+tol)].filter(p=>lvOn(p.lv));
  for(const p of ps){if(ACT.snap.has('end'))for(const q of vertsOf(p))C.push([q[0],q[1],'end',p]);
   const sg=segsOf(p).filter(s=>s[4]!==-2);
   if(ACT.snap.has('mid'))for(const s of sg)if(s[4]>=0)C.push([(s[0]+s[2])/2,(s[1]+s[3])/2,'mid',p]);
   if(ACT.snap.has('cen')){const c=centerOf(p);if(c&&p.k!=='T')C.push([c[0],c[1],'cen',p])}
   for(const s of sg){const r=GEO.segPt(x,y,s[0],s[1],s[2],s[3]);if(r[0]<=tol*tol*4)S.push([s,p,r])}}
  if(ACT.snap.has('int')&&S.length<400)for(let i=0;i<S.length;i++)for(let j=i+1;j<S.length;j++){if(S[i][1]===S[j][1]&&Math.abs(S[i][0][4]-S[j][0][4])<=1)continue;const a=S[i][0],b=S[j][0],q=GEO.segX(a[0],a[1],a[2],a[3],b[0],b[1],b[2],b[3]);if(q)C.push([q[0],q[1],'int',S[i][1]])}
  let best=null,bd=tol*tol;for(const c of C){const d=GEO.d2(c[0],c[1],x,y);const w=c[2]==='int'?d*.7:d;if(w<=bd){bd=w;best=c}}
  if(!best&&lastPt&&ACT.snap.has('perp')){let bp=null,bq=tol*tol;for(const[s,p]of S){const dx=s[2]-s[0],dy=s[3]-s[1],L=dx*dx+dy*dy;if(!L)continue;const t=((lastPt[0]-s[0])*dx+(lastPt[1]-s[1])*dy)/L;if(t<0||t>1)continue;const qx=s[0]+t*dx,qy=s[1]+t*dy,d=GEO.d2(qx,qy,x,y);if(d<=bq){bq=d;bp=[qx,qy,'perp',p]}}best=bp}
  if(!best&&ACT.snap.has('near')){let bq=tol*tol;for(const[s,p,r]of S)if(r[0]<=bq){bq=r[0];best=[r[2],r[3],'near',p]}}
  if(best)return{x:best[0],y:best[1],t:best[2],p:best[3]}}
 let px=x,py=y;
 if(ACT.grid){const g=ACT.gstep*U,o=org();px=Math.round((x-o[0])/g)*g+o[0];py=Math.round((y-o[1])/g)*g+o[1];return{x:px,y:py,t:'grid'}}
 if(ACT.axis&&lastPt){if(Math.abs(x-lastPt[0])>Math.abs(y-lastPt[1]))py=lastPt[1];else px=lastPt[0]}
 return{x:px,y:py}}
// ================= VẼ =================
let RAF=0;function redraw(){if(!RAF)RAF=requestAnimationFrame(()=>{RAF=0;for(const v of VIEWS)drawView(v)})}
function strokeStyle(g,p,v,hi){g.strokeStyle=hi||colOf(p.c);g.lineWidth=hi?Math.max(2,1+p.w*.8):Math.min(1+p.w*.8,12);const d=DASH[p.st&7]||[];g.setLineDash(d.length?d.map(x=>x*(1+p.w*.3)):[])}
function pathP(g,v,p){const X=x=>sx(v,x),Y=y=>sy(v,y);
 if(p.k==='L'||p.k==='S'){const q=p.p;g.moveTo(X(q[0]),Y(q[1]));if(q.length===4&&q[0]===q[2]&&q[1]===q[3]){g.arc(X(q[0]),Y(q[1]),1.5,0,7);return}for(let i=2;i<q.length;i+=2)g.lineTo(X(q[i]),Y(q[i+1]));if(p.k==='S')g.closePath()}
 else if(p.k==='E'){const e=p.e;g.moveTo(X(e[3])+e[0]*v.s*Math.cos(-e[2]),Y(e[4])+e[0]*v.s*Math.sin(-e[2]));g.ellipse(X(e[3]),Y(e[4]),Math.max(e[0]*v.s,.5),Math.max(e[1]*v.s,.5),-e[2],0,2*Math.PI)}
 else if(p.k==='A'){const a=p.a;if(Math.abs(a[2]-a[3])<1e-6){const a0=a[0]+a[4];g.moveTo(X(a[5]+a[2]*Math.cos(a0)),Y(a[6]+a[2]*Math.sin(a0)));g.arc(X(a[5]),Y(a[6]),Math.max(a[2]*v.s,.5),-a0,-(a0+a[1]),a[1]>0)}
  else{const q=GEO.arcPts(a[5],a[6],a[2],a[0]+a[4],a[1]);g.moveTo(X(q[0]),Y(q[1]));for(let i=2;i<q.length;i+=2)g.lineTo(X(q[i]),Y(q[i+1]))}}}
function drawText(g,v,p,hi){const px=p.h*v.s/0.662;if(px<1.2){g.fillStyle=hi||colOf(p.c);g.fillRect(sx(v,p.x),sy(v,p.y)-1,Math.max(1,(p.tw||0)*v.s),1);return}
 g.save();g.translate(sx(v,p.x),sy(v,p.y));g.rotate(-(p.r||0));g.fillStyle=hi||colOf(p.c);g.font=`${px}px "Times New Roman",Tinos,serif`;g.textBaseline='alphabetic';g.fillText(p.s,0,0);g.restore()}
function drawPrim(g,v,p,hi){if(p.k==='T')return drawText(g,v,p,hi);g.beginPath();strokeStyle(g,p,v,hi);pathP(g,v,p);g.stroke()}
function drawView(v){const g=v.g;g.setLineDash([]);g.fillStyle=ACT.bg;g.fillRect(0,0,v.W,v.H);if(!DOC){return}
 const x0=wx(v,0),x1=wx(v,v.W),y0=wy(v,v.H),y1=wy(v,0);
 if(ACT.sat)drawSat(v,x0,y0,x1,y1);
 if(ACT.grid)drawGrid(v,x0,y0,x1,y1);
 const vis=[...idxQ(x0,y0,x1,y1)];
 // tham chiếu nhạt
 for(const p of vis){if(!lvOn(p.lv))continue;if(p.ref){g.globalAlpha=.55;drawPrim(g,v,p);g.globalAlpha=1}}
 for(const p of vis){if(p.ref||!lvOn(p.lv))continue;drawPrim(g,v,p)}
 // lớp phủ của ứng dụng Địa chính
 for(const L of OVL.values())drawOvl(g,v,L);
 // phần tử đang chọn
 g.save();for(const p of SEL){if(p.del)continue;drawPrim(g,v,p,'#ff2bd6')}g.restore();
 if(HL){g.save();drawPrim(g,v,HL,'#00e5ff');g.restore()}
 if(FENCE)drawFence(g,v,FENCE);
 if(CMD&&CMD.dyn&&CUR){try{g.save();CMD.dyn(g,v,CUR);g.restore()}catch(e){console.error(e)}}
 if(SNAP&&SNAP.t){const X=sx(v,SNAP.x),Y=sy(v,SNAP.y);g.setLineDash([]);g.strokeStyle='#ffef00';g.lineWidth=2;g.beginPath();
  if(SNAP.t==='end')g.rect(X-6,Y-6,12,12);else if(SNAP.t==='mid'){g.moveTo(X-7,Y+6);g.lineTo(X,Y-6);g.lineTo(X+7,Y+6);g.closePath()}else if(SNAP.t==='cen')g.arc(X,Y,7,0,7);
  else if(SNAP.t==='int'){g.moveTo(X-7,Y-7);g.lineTo(X+7,Y+7);g.moveTo(X+7,Y-7);g.lineTo(X-7,Y+7)}else if(SNAP.t==='perp'){g.moveTo(X-7,Y+6);g.lineTo(X+7,Y+6);g.moveTo(X,Y+6);g.lineTo(X,Y-7)}else{g.moveTo(X-7,Y);g.lineTo(X,Y-7);g.lineTo(X+7,Y);g.lineTo(X,Y+7);g.closePath()}g.stroke()}
 if(!DESK&&CUR&&!ACT.cross&&CMD){const X=sx(v,CUR.x),Y=sy(v,CUR.y);g.strokeStyle='rgba(255,60,60,.9)';g.lineWidth=1;g.beginPath();g.moveTo(X-14,Y);g.lineTo(X+14,Y);g.moveTo(X,Y-14);g.lineTo(X,Y+14);g.stroke()}}
function drawFence(g,v,F){g.save();g.setLineDash([8,5]);g.strokeStyle='#00ffd0';g.lineWidth=1.5;g.beginPath();const q=F.p;g.moveTo(sx(v,q[0]),sy(v,q[1]));for(let i=2;i<q.length;i+=2)g.lineTo(sx(v,q[i]),sy(v,q[i+1]));if(F.closed!==false)g.closePath();g.stroke();g.restore()}
function drawOvl(g,v,L){for(const it of L.items||[]){g.save();g.setLineDash(it.dash||[]);
  if(it.rings){g.beginPath();for(const r of it.rings){g.moveTo(sx(v,r[0]),sy(v,r[1]));for(let i=2;i<r.length;i+=2)g.lineTo(sx(v,r[i]),sy(v,r[i+1]));g.closePath()}
   if(it.fill){g.globalAlpha=it.alpha==null?.35:it.alpha;g.fillStyle=it.fill;g.fill('evenodd');g.globalAlpha=1}if(it.stroke){g.strokeStyle=it.stroke;g.lineWidth=it.lw||2;g.stroke()}}
  if(it.line){const r=it.line;g.beginPath();g.moveTo(sx(v,r[0]),sy(v,r[1]));for(let i=2;i<r.length;i+=2)g.lineTo(sx(v,r[i]),sy(v,r[i+1]));g.strokeStyle=it.stroke||'#0ff';g.lineWidth=it.lw||2;g.stroke()}
  if(it.pt){const X=sx(v,it.pt[0]),Y=sy(v,it.pt[1]);g.beginPath();g.arc(X,Y,it.r||7,0,7);g.strokeStyle=it.stroke||'#f33';g.lineWidth=2.5;g.stroke();if(it.fill){g.fillStyle=it.fill;g.fill()}}
  if(it.text&&it.at){g.fillStyle=it.color||'#fff';g.font=(it.size||12)+'px system-ui';g.textAlign='center';g.strokeStyle='rgba(0,0,0,.7)';g.lineWidth=3;g.strokeText(it.text,sx(v,it.at[0]),sy(v,it.at[1]));g.fillText(it.text,sx(v,it.at[0]),sy(v,it.at[1]))}
  g.restore()}}
function drawGrid(v,x0,y0,x1,y1){let st=ACT.gstep*U;while(st*v.s<8)st*=5;const o=org(),g=v.g;g.fillStyle='rgba(140,160,180,.7)';
 for(let x=Math.ceil((x0-o[0])/st)*st+o[0];x<=x1;x+=st)for(let y=Math.ceil((y0-o[1])/st)*st+o[1];y<=y1;y+=st)g.fillRect(sx(v,x)-.75,sy(v,y)-.75,1.5,1.5)}
// ---- ảnh vệ tinh nền (VN-2000 → WGS84) ----
const TILES=new Map();
const toLL=(x,y)=>{const o=org(),l=M8.tmInv((x-o[0])/U,(y-o[1])/U,ACT.ktt,ACT.k0);return M8.vn2wgs(l[0],l[1])};
const fromLL=(la,lo)=>{const l=M8.wgs2vn(la,lo),e=M8.tmFwd(l[0],l[1],ACT.ktt,ACT.k0),o=org();return[e[0]*U+o[0],e[1]*U+o[1]]};
const t2ll=(x,y,z)=>{const n=2**z;return[Math.atan(Math.sinh(Math.PI*(1-2*y/n)))*180/Math.PI,x/n*360-180]};
function drawSat(v,x0,y0,x1,y1){try{const c=toLL((x0+x1)/2,(y0+y1)/2);if(!isFinite(c[0])||Math.abs(c[0])>85)return;
 const mpp=1/v.s/U;let z=Math.round(Math.log2(156543.03*Math.cos(c[0]*Math.PI/180)/mpp));z=Math.max(3,Math.min(19,z));
 const a=toLL(x0,y1),b=toLL(x1,y0),n=2**z,tx=lo=>Math.floor((lo+180)/360*n),ty=la=>Math.floor((1-Math.log(Math.tan(la*Math.PI/180)+1/Math.cos(la*Math.PI/180))/Math.PI)/2*n);
 const X0=tx(Math.min(a[1],b[1])),X1=tx(Math.max(a[1],b[1])),Y0=ty(Math.max(a[0],b[0])),Y1=ty(Math.min(a[0],b[0]));if((X1-X0+1)*(Y1-Y0+1)>90)return;
 const g=v.g;g.globalAlpha=ACT.satOp;
 for(let X=X0;X<=X1;X++)for(let Y=Y0;Y<=Y1;Y++){const k=z+'/'+X+'/'+Y;let im=TILES.get(k);if(!im){if(TILES.size>400)TILES.clear();im=new Image();im.onload=redraw;im.src=`https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${Y}/${X}`;TILES.set(k,im)}
  if(!im.complete||!im.naturalWidth)continue;const p0=fromLL(...t2ll(X,Y,z)),p1=fromLL(...t2ll(X+1,Y,z)),p2=fromLL(...t2ll(X,Y+1,z));
  const ox=sx(v,p0[0]),oy=sy(v,p0[1]),ax=(sx(v,p1[0])-ox)/256,ay=(sy(v,p1[1])-oy)/256,bx=(sx(v,p2[0])-ox)/256,by=(sy(v,p2[1])-oy)/256,d=devicePixelRatio||1;
  g.setTransform(ax*d,ay*d,bx*d,by*d,ox*d,oy*d);g.drawImage(im,0,0,256.6,256.6);g.setTransform(d,0,0,d,0,0)}g.globalAlpha=1}catch(e){}}
// ================= SỬA ĐỔI + HOÀN TÁC =================
function tx(label,fn){if(!DOC)return;const T={label,ops:[]};TX=T;try{fn()}finally{TX=null}if(T.ops.length){UNDO.push(T);if(UNDO.length>200)UNDO.shift();REDO.length=0;afterEdit()}return T.ops.length}
function addP(p){norm(p);if(p.lv==null)p.lv=ACT.lv;DOC.prims.push(p);if(TX)TX.ops.push({t:'add',p});if(!IDX.dirty&&IDX.g)idxIns(p);return p}
function delP(p){if(p.del||p.ref)return;p.del=true;SEL.delete(p);if(TX)TX.ops.push({t:'del',p})}
function modP(p,fn){const b=clone(p);fn(p);p.bb=null;if(p.k==='T')p.tw=textW(p.s,p.h);if(TX)TX.ops.push({t:'mod',p,b,a:clone(p)});IDX.dirty=true}
function restore(p,s){for(const k of Object.keys(p))if(k!=='id')delete p[k];Object.assign(p,clone(s));p.bb=null}
function undo(){const T=UNDO.pop();if(!T){msg('Không còn thao tác để hoàn tác');return}for(let i=T.ops.length-1;i>=0;i--){const o=T.ops[i];if(o.t==='add'){o.p.del=true;SEL.delete(o.p)}else if(o.t==='del')o.p.del=false;else restore(o.p,o.b)}REDO.push(T);afterEdit();msg('Đã hoàn tác: '+T.label)}
function redo(){const T=REDO.pop();if(!T){msg('Không còn thao tác để làm lại');return}for(const o of T.ops){if(o.t==='add')o.p.del=false;else if(o.t==='del'){o.p.del=true;SEL.delete(o.p)}else restore(o.p,o.a)}UNDO.push(T);afterEdit();msg('Đã làm lại: '+T.label)}
let _ce=0,_as=0;
function afterEdit(){DOC.dirty=true;IDX.dirty=true;title();redraw();clearTimeout(_ce);_ce=setTimeout(()=>BUS.emit('changed',{n:DOC.prims.length}),400);clearTimeout(_as);_as=setTimeout(autosave,4000)}
async function autosave(){if(!DOC)return;try{await M8.IDB.set('b:sess',{name:DOC.name,fmt:DOC.fmt,org:DOC.org,pal:DOC.pal,prims:DOC.prims.filter(p=>!p.del).map(clone),t:Date.now(),dirty:DOC.dirty})}catch(e){}}
function title(){$('fn').textContent=DOC?(DOC.dirty?'● ':'')+DOC.name+` · ${DOC.fmt||''} · ${DOC.prims.filter(p=>!p.del).length} phần tử`:'Chưa mở bản đồ';document.title=(DOC?DOC.name+' – ':'')+'M8 Pro Bản đồ'}
// ================= MỞ / LƯU TỆP =================
async function openBytes(name,u8,fh){let R;try{R=await M8.parseAny(name,u8)}catch(e){alert_(M8.esc(e.message||e),'Không mở được tệp');return false}
 const ids=Object.keys(R.models).filter(k=>R.models[k].prims.length);let id=ids[0]||Object.keys(R.models)[0];
 if(ids.length>1){const r=await form('Chọn mô hình (model) trong tệp',[{k:'m',l:'Mô hình',t:'select',v:id,o:ids.map(k=>[k,k+' – '+R.models[k].prims.length+' phần tử'])}]);if(r)id=r.m}
 const md=R.models[id];NID=0;DOC={name,fmt:(R.meta&&R.meta.fmt)||M8.fmtOf(u8),org:md.org||[0,0],pal:R.pal,prims:md.prims.map(norm),fh:fh||null,dirty:false,lvOff:new Set(),lvLock:new Set(),un:md.un};
 SEL.clear();FENCE=null;UNDO.length=0;REDO.length=0;OVL.clear();IDX.dirty=true;REFS=[];endCmd();$('hint').style.display='none';title();for(const v of VIEWS){v.hist=[];fit(v)}
 M8.IDB.set('b:last',{name,bytes:u8,t:Date.now()});
 const un=Object.entries(md.un||{}).filter(([t])=>!['2','7','5','9','8','1','66','10','12','14','18','19','33','37','34','38'].includes(t)).map(([t,n])=>`kiểu ${t}: ${n}`).join(', ');
 msg(`Đã mở ${name}: ${DOC.prims.length} phần tử`+(un?` (chưa hiển thị: ${un})`:''),4000);BUS.emit('fileOpened',docInfo());return true}
async function openFile(ref){if(!ref&&DESK&&window.showOpenFilePicker){try{const[h]=await showOpenFilePicker({types:[{description:'Bản đồ DGN/DXF',accept:{'application/octet-stream':['.dgn','.dxf']}}]});const f=await h.getFile();return openBytes(f.name,new Uint8Array(await f.arrayBuffer()),h)}catch(e){if(e&&e.name==='AbortError')return;}}
 const inp=$(ref?'fr':'fi');inp.value='';inp.click()}
$('fi').onchange=async e=>{const f=e.target.files[0];if(!f)return;if(DOC&&DOC.dirty&&!(await confirm_('Bản đồ đang mở có thay đổi chưa lưu. Vẫn mở bản đồ khác?','Mở')))return;openBytes(f.name,new Uint8Array(await f.arrayBuffer()))};
$('fr').onchange=async e=>{const f=e.target.files[0];if(f)attachRef(f.name,new Uint8Array(await f.arrayBuffer()))};
async function attachRef(name,u8){if(!DOC){msg('Mở bản đồ chính trước');return}try{const R=await M8.parseAny(name,u8),md=Object.values(R.models).sort((a,b)=>b.prims.length-a.prims.length)[0],o=md.org||[0,0],dx=DOC.org[0]-o[0],dy=DOC.org[1]-o[1];
 const prims=md.prims.map(p=>{norm(p);p.ref=name;if(dx||dy)xformIn(p,{t:'tr',dx,dy});return p});REFS.push({name,prims,on:true});IDX.dirty=true;redraw();msg(`Đã gắn bản đồ tham chiếu ${name} (${prims.length} phần tử)`)}catch(e){alert_(M8.esc(e.message),'Không gắn được tham chiếu')}}
async function buildDGN(){const live=DOC.prims.filter(p=>!p.del),v8=/^DGN V8/.test(DOC.fmt||'')||/dgn8/.test(DOC.fmt||''),go=v8?[DOC.org[0],DOC.org[1],0]:M8.D8SEED.go,dx=go[0]-DOC.org[0],dy=go[1]-DOC.org[1];
 const P=dx||dy?live.map(p=>{const q=clone(p);xformIn(q,{t:'tr',dx,dy});return q}):live,bb=GEO.bbox(P.flatMap(p=>{const b=bbOf(p);p.bb=null;return b}));
 return M8.D8.file(M8.primsToD8(P),bb,DOC.name,go)}
async function save(as){if(!DOC)return;try{const isDgn=/\.dgn$/i.test(DOC.name);
 const u=await buildDGN(),blob=new Blob([u],{type:'application/octet-stream'}),nm=isDgn?DOC.name:DOC.name.replace(/\.[^.]+$/,'')+'.dgn';
 if(!as&&DOC.fh&&isDgn){if(!(await confirm_(`Ghi đè trực tiếp vào tệp gốc <b>${M8.esc(DOC.name)}</b>?\nBản gốc trước khi ghi được giữ lại trên máy (Tệp → Khôi phục bản gốc).`,'Ghi đè')))return;
  try{const f=await DOC.fh.getFile();await M8.IDB.set('b:bak:'+DOC.name,{bytes:new Uint8Array(await f.arrayBuffer()),t:Date.now()})}catch(e){}
  await M8.writeHandle(DOC.fh,blob);DOC.dirty=false;title();msg('Đã lưu vào tệp gốc '+DOC.name);BUS.emit('saved',docInfo());return}
 const h=await M8.saveAs(nm,blob,[{description:'Bản đồ DGN V8',accept:{'application/octet-stream':['.dgn']}}]);if(!h)return;if(h&&h.createWritable){DOC.fh=h;DOC.name=h.name||nm}
 DOC.dirty=false;title();msg('Đã lưu '+nm+(DESK?'':' (tệp tải về thư mục Download)'));BUS.emit('saved',docInfo())}catch(e){console.error(e);alert_(M8.esc(e.message||e),'Không lưu được')}}
async function exportDXF(){if(!DOC)return;const s=M8.writeDXF(DOC.prims.filter(p=>!p.del),DOC.org);await M8.saveAs(DOC.name.replace(/\.[^.]+$/,'')+'.dxf',new Blob([s],{type:'application/dxf'}),[{description:'DXF',accept:{'application/dxf':['.dxf']}}]);msg('Đã xuất DXF')}
async function exportPNG(print){const v=V(),c=document.createElement('canvas'),k=2;c.width=v.W*k;c.height=v.H*k;const g=c.getContext('2d');const bg=ACT.bg;ACT.bg='#ffffff';
 const vv={...v,g,W:v.W,H:v.H};g.scale(k,k);const keep=colOf;drawView(vv);ACT.bg=bg;
 if(print){const u=c.toDataURL('image/png'),w=window.open('');if(!w){msg('Trình duyệt chặn cửa sổ in');return}w.document.write(`<title>In bản đồ</title><style>@page{margin:8mm}body{margin:0}img{width:100%}</style><img src="${u}" onload="setTimeout(()=>print(),300)">`);w.document.close();return}
 c.toBlob(b=>M8.saveAs((DOC?DOC.name.replace(/\.[^.]+$/,''):'ban-do')+'.png',b,[{description:'Ảnh PNG',accept:{'image/png':['.png']}}]))}
// ================= BIẾN ĐỔI PHẦN TỬ =================
// T: {t:'tr',dx,dy} | {t:'rot',cx,cy,a} | {t:'sc',cx,cy,f} | {t:'mir',ax,ay,bx,by}
function ptT(T,x,y){if(T.t==='tr')return[x+T.dx,y+T.dy];if(T.t==='rot')return GEO.rot(x,y,T.cx,T.cy,T.a);if(T.t==='sc')return[T.cx+(x-T.cx)*T.f,T.cy+(y-T.cy)*(T.fy||T.f)];if(T.t==='mir')return GEO.mirror(x,y,T.ax,T.ay,T.bx,T.by);return[x,y]}
function xformIn(p,T){p.bb=null;
 if(p.p){for(let i=0;i<p.p.length;i+=2){const q=ptT(T,p.p[i],p.p[i+1]);p.p[i]=q[0];p.p[i+1]=q[1]}}
 else if(p.k==='E'){const c=ptT(T,p.e[3],p.e[4]);p.e[3]=c[0];p.e[4]=c[1];if(T.t==='rot')p.e[2]+=T.a;if(T.t==='sc'){p.e[0]*=T.f;p.e[1]*=T.f}if(T.t==='mir'){const ang=Math.atan2(T.by-T.ay,T.bx-T.ax);p.e[2]=2*ang-p.e[2]}}
 else if(p.k==='A'){const a=p.a,c=ptT(T,a[5],a[6]);a[5]=c[0];a[6]=c[1];if(T.t==='rot')a[4]+=T.a;if(T.t==='sc'){a[2]*=T.f;a[3]*=T.f}if(T.t==='mir'){const ang=Math.atan2(T.by-T.ay,T.bx-T.ax),s=a[0]+a[4],e=s+a[1];const ns=2*ang-s,ne=2*ang-e;a[4]=0;a[0]=ne;a[1]=ns-ne;}}
 else if(p.k==='T'){if(T.t==='mir'){const L=p.tw||0,c=Math.cos(p.r||0),s=Math.sin(p.r||0),ex=p.x+L*c,ey=p.y+L*s,q=ptT(T,ex,ey);p.x=q[0];p.y=q[1];}else{const q=ptT(T,p.x,p.y);p.x=q[0];p.y=q[1];if(T.t==='rot')p.r=(p.r||0)+T.a;if(T.t==='sc'){p.h*=T.f;p.tw=(p.tw||0)*T.f}}}
 return p}
const xform=(p,T)=>xformIn(clone(p),T);
// ================= LỆNH =================
const CMDS={};let CUR=null;
const reg=(id,o)=>{o.id=id;CMDS[id]=o};
const lastPt=()=>CMD&&CMD.pts&&CMD.pts.length?[CMD.pts[CMD.pts.length-1].x,CMD.pts[CMD.pts.length-1].y]:null;
const tolW=()=>ACT.snapPx/V().s;
const pick=(p,f)=>hitAt(p.x,p.y,tolW(),q=>!q.ref&&(!f||f(q)));
const attrs=()=>({lv:ACT.lv,c:ACT.c,w:ACT.w,st:ACT.st});
const newL=(pts,shape)=>addP({k:shape?'S':'L',...attrs(),p:pts});
const OPTK=id=>'m8b:opt:'+id;
function startCmd(id){const d=CMDS[id];if(!d){msg('Không có lệnh '+id);return}if(d.desk&&!DESK){msg('Chức năng này chỉ có trên bản máy tính');return}
 if(!DOC&&!d.nodoc){msg('Hãy mở bản đồ trước');return}if(d.now){d.now();return}
 endCmd(true);CMD=d.make();CMD.id=id;CMD.name=d.name;CMD.pts=CMD.pts||[];
 if(CMD.opts){let sv={};try{sv=JSON.parse(localStorage.getItem(OPTK(id))||'{}')}catch(e){}CMD.o={};for(const f of CMD.opts)CMD.o[f.k]=sv[f.k]!=null?sv[f.k]:f.v}
 if(CMD.init)CMD.init();renderTS();upPrompt();menuUI();redraw()}
function endCmd(silent){const c=CMD;CMD=null;if(c&&c.end)c.end();renderTS();if(!silent)upPrompt();menuUI();redraw()}
function upPrompt(){prompt_(CMD?CMD.name+' › '+(typeof CMD.pr==='function'?CMD.pr():CMD.pr||'Nhập điểm'):'Chọn phần tử › chạm/nhấp vào phần tử (Đặt lại = bỏ chọn)')}
let INFO=false;function dataPoint(p){if(!DOC)return;if(!CMD){selTool(p);return}INFO=false;try{CMD.dp(p)}catch(e){console.error(e);msg('Lỗi: '+e.message)}if(!INFO)upPrompt();redraw()}
function resetPt(){if(CMD){if(CMD.rs){if(CMD.rs()!==true){upPrompt();redraw();return}}endCmd()}else{if(SEL.size){SEL.clear();BUS.emit('selection',[]);msg('Đã bỏ chọn')}redraw()}}
function needSel(p){if(SEL.size)return true;const h=pick(p,editable);if(h){SEL.add(h.p);msg('Đã chọn '+kname(h.p)+' – nhập điểm tiếp');}else msg('Chưa chọn phần tử – chạm vào phần tử cần thao tác');return false}
function selTool(p){const h=hitAt(p.x,p.y,tolW(),q=>!q.ref);const add=SELADD||(window.event&&(window.event.ctrlKey||window.event.shiftKey));
 if(!h){if(!add)SEL.clear()}else if(add){SEL.has(h.p)?SEL.delete(h.p):SEL.add(h.p)}else{SEL.clear();SEL.add(h.p)}
 if(h)prompt_(`${kname(h.p)} · lớp ${h.p.lv} · màu ${h.p.c} · nét ${h.p.w}`+(h.p.k==='T'?` · “${h.p.s}”`:'')+(SEL.size>1?` · đang chọn ${SEL.size}`:''));
 BUS.emit('selection',[...SEL].map(ser));redraw()}
let SELADD=false;
// ---- vẽ động ----
function dPoly(g,v,pts,closed,col){if(pts.length<2)return;g.strokeStyle=col||'#ffd400';g.lineWidth=1.5;g.setLineDash([]);g.beginPath();g.moveTo(sx(v,pts[0]),sy(v,pts[1]));for(let i=2;i<pts.length;i+=2)g.lineTo(sx(v,pts[i]),sy(v,pts[i+1]));if(closed)g.closePath();g.stroke()}
function dPrims(g,v,ps,T,col){g.globalAlpha=.85;for(const p of ps)drawPrim(g,v,T?xform(p,T):p,col||'#ffd400');g.globalAlpha=1}
const flat=pts=>pts.flatMap(q=>[q.x,q.y]);
function info(t){INFO=true;prompt_(t);msg(t,4000)}
const fmA=a=>{a=(a%360+360)%360;const d=Math.floor(a),m=Math.floor((a-d)*60),s=((a-d)*60-m)*60;return`${d}°${String(m).padStart(2,'0')}'${s.toFixed(1).padStart(4,'0')}"`};
const azim=(a,b)=>{const dx=b.x-a.x,dy=b.y-a.y;return(Math.atan2(dx,dy)*180/Math.PI+360)%360};   // phương vị: từ Bắc theo chiều kim đồng hồ
// ======= NHÓM VẼ =======
reg('diem',{grp:'ve',name:'Điểm',ic:'•',make:()=>({pr:'Nhập vị trí điểm',dp(p){tx('Vẽ điểm',()=>newL([p.x,p.y,p.x,p.y]))}})});
reg('doan',{grp:'ve',name:'Đoạn thẳng',ic:'╱',make:()=>({pr(){return this.pts.length?'Nhập điểm cuối (Đặt lại: kết thúc chuỗi)':'Nhập điểm đầu'},
 dp(p){if(this.pts.length){const a=this.pts[0];tx('Vẽ đoạn thẳng',()=>newL([a.x,a.y,p.x,p.y]));info(`Dài ${fm(GEO.dist(a.x,a.y,p.x,p.y)/U)} m · phương vị ${fmA(azim(a,p))}`)}this.pts=[p]},
 rs(){if(this.pts.length){this.pts=[];return}return true},dyn(g,v,c){if(this.pts.length){const a=this.pts[0];dPoly(g,v,[a.x,a.y,c.x,c.y]);prompt_(`Đoạn thẳng › dài ${fm(GEO.dist(a.x,a.y,c.x,c.y)/U)} m · PV ${fmA(azim(a,c))}`)}}})});
reg('gapkhuc',{grp:'ve',name:'Đường gấp khúc',ic:'⟋',make:()=>({pr(){return this.pts.length?`Điểm thứ ${this.pts.length+1} (Đặt lại: kết thúc)`:'Nhập điểm đầu'},dp(p){this.pts.push(p)},
 rs(){if(this.pts.length>=2){const q=flat(this.pts);tx('Vẽ đường gấp khúc',()=>newL(q));info(`Đã vẽ đường ${this.pts.length} đỉnh, dài ${fm(GEO.len(q)/U)} m`);this.pts=[];return}if(this.pts.length){this.pts=[];return}return true},
 dyn(g,v,c){dPoly(g,v,[...flat(this.pts),c.x,c.y])}})});
reg('vung',{grp:'ve',name:'Vùng kín (đa giác)',ic:'⬠',make:()=>({pr(){return this.pts.length<3?`Điểm thứ ${this.pts.length+1}`:'Điểm tiếp (Đặt lại hoặc chạm điểm đầu: khép vùng)'},
 dp(p){if(this.pts.length>=3&&GEO.dist(p.x,p.y,this.pts[0].x,this.pts[0].y)<tolW()){this.rs();return}this.pts.push(p)},
 rs(){if(this.pts.length>=3){const q=flat(this.pts);q.push(q[0],q[1]);tx('Vẽ vùng kín',()=>newL(q,true));info(`Đã vẽ vùng: diện tích ${fm(Math.abs(GEO.area(q))/U/U,1)} m², chu vi ${fm(GEO.len(q)/U,2)} m`);this.pts=[];return}if(this.pts.length){this.pts=[];return}return true},
 dyn(g,v,c){dPoly(g,v,[...flat(this.pts),c.x,c.y],true)}})});
reg('chunhat',{grp:'ve',name:'Hình chữ nhật',ic:'▭',make:()=>({pr(){return this.pts.length?'Nhập góc đối diện':'Nhập góc thứ nhất'},
 dp(p){if(!this.pts.length){this.pts=[p];return}const a=this.pts[0];tx('Vẽ hình chữ nhật',()=>newL([a.x,a.y,p.x,a.y,p.x,p.y,a.x,p.y,a.x,a.y],true));this.pts=[]},
 dyn(g,v,c){if(this.pts.length){const a=this.pts[0];dPoly(g,v,[a.x,a.y,c.x,a.y,c.x,c.y,a.x,c.y],true)}}})});
reg('tron',{grp:'ve',name:'Đường tròn (tâm, bán kính)',ic:'◯',make:()=>({opts:[{k:'r',l:'Bán kính (m, 0 = theo điểm)',t:'number',v:0}],pr(){return this.pts.length?'Nhập điểm trên đường tròn':'Nhập tâm'},
 dp(p){const R=+this.o.r*U;if(R>0){tx('Vẽ đường tròn',()=>addP({k:'E',...attrs(),e:[R,R,0,p.x,p.y]}));return}if(!this.pts.length){this.pts=[p];return}const a=this.pts[0],r=GEO.dist(a.x,a.y,p.x,p.y);
  tx('Vẽ đường tròn',()=>addP({k:'E',...attrs(),e:[r,r,0,a.x,a.y]}));info(`Bán kính ${fm(r/U)} m`);this.pts=[]},
 dyn(g,v,c){const R=+this.o.r*U;const a=this.pts[0]||(R>0?c:null);if(!a)return;const r=R>0?R:GEO.dist(a.x,a.y,c.x,c.y);g.strokeStyle='#ffd400';g.beginPath();g.arc(sx(v,a.x),sy(v,a.y),r*v.s,0,7);g.stroke()}})});
reg('tron3',{grp:'ve',name:'Đường tròn qua 3 điểm',ic:'◎',make:()=>({pr(){return`Điểm thứ ${this.pts.length+1}/3`},dp(p){this.pts.push(p);if(this.pts.length===3){const[a,b,c]=this.pts,C=GEO.circ3(a.x,a.y,b.x,b.y,c.x,c.y);if(C)tx('Vẽ đường tròn',()=>addP({k:'E',...attrs(),e:[C[2],C[2],0,C[0],C[1]]}));else msg('Ba điểm thẳng hàng');this.pts=[]}},
 dyn(g,v,c){if(this.pts.length===2){const[a,b]=this.pts,C=GEO.circ3(a.x,a.y,b.x,b.y,c.x,c.y);if(C){g.strokeStyle='#ffd400';g.beginPath();g.arc(sx(v,C[0]),sy(v,C[1]),C[2]*v.s,0,7);g.stroke()}}else if(this.pts.length)dPoly(g,v,[this.pts[0].x,this.pts[0].y,c.x,c.y])}})});
reg('cung',{grp:'ve',name:'Cung tròn (3 điểm)',ic:'◠',make:()=>({pr(){return['Nhập điểm đầu cung','Nhập điểm trên cung','Nhập điểm cuối cung'][this.pts.length]},
 dp(p){this.pts.push(p);if(this.pts.length===3){const[a,b,c]=this.pts,A=GEO.arc3(a.x,a.y,b.x,b.y,c.x,c.y);if(A)tx('Vẽ cung tròn',()=>addP({k:'A',...attrs(),a:[A[3],A[4],A[2],A[2],0,A[0],A[1]]}));this.pts=[]}},
 dyn(g,v,c){if(this.pts.length===2){const[a,b]=this.pts,A=GEO.arc3(a.x,a.y,c.x,c.y,b.x,b.y);const A2=GEO.arc3(a.x,a.y,b.x,b.y,c.x,c.y);if(A2)dPoly(g,v,GEO.arcPts(A2[0],A2[1],A2[2],A2[3],A2[4]))}else if(this.pts.length)dPoly(g,v,[this.pts[0].x,this.pts[0].y,c.x,c.y])}})});
const JUST=[['bl','Trái – chân chữ'],['bc','Giữa – chân chữ'],['mc','Giữa – giữa chữ'],['br','Phải – chân chữ']];
function mkText(s,x,y,h,rot,j,a){const tw=textW(s,h),c=Math.cos(rot),sn=Math.sin(rot);let ox=0,oy=0;if(j==='bc'||j==='mc')ox=-tw/2;if(j==='br')ox=-tw;if(j==='mc')oy=-h/2;
 return{k:'T',...(a||attrs()),s,h,tw,r:rot,x:x+ox*c-oy*sn,y:y+ox*sn+oy*c,fid:ACT.font}}
reg('chu',{grp:'ve',name:'Ghi chữ',ic:'A',make:()=>({opts:[{k:'s',l:'Nội dung',t:'text',v:''},{k:'h',l:'Cao chữ (m)',t:'number',v:ACT.th},{k:'r',l:'Góc (độ)',t:'number',v:0},{k:'j',l:'Căn',t:'select',v:'bl',o:JUST},{k:'inc',l:'Tự tăng số cuối',t:'check',v:false}],
 pr(){return this.o.s?'Nhập vị trí đặt chữ':'Gõ nội dung chữ ở thanh thiết lập lệnh, rồi nhập vị trí'},
 dp(p){if(!String(this.o.s).trim()){msg('Chưa có nội dung chữ');return}const t=mkText(String(this.o.s),p.x,p.y,+this.o.h*U,(+this.o.r||0)*Math.PI/180,this.o.j);tx('Ghi chữ',()=>addP(t));
  const m=String(this.o.s).match(/^(.*?)(\d+)$/);if(m&&this.o.inc){this.o.s=m[1]+(+m[2]+1);renderTS()}},
 dyn(g,v,c){if(String(this.o.s).trim())drawText(g,v,mkText(String(this.o.s),c.x,c.y,+this.o.h*U,(+this.o.r||0)*Math.PI/180,this.o.j),'#ffd400')}})});
reg('ghikt',{grp:'ve',name:'Ghi kích thước cạnh',ic:'↔',make:()=>({opts:[{k:'h',l:'Cao chữ (m)',t:'number',v:ACT.th*.8},{k:'d',l:'Số lẻ',t:'number',v:2}],pr(){return this.pts.length?'Nhập điểm cuối cạnh':'Nhập điểm đầu cạnh'},
 mk(a,b){const L=GEO.dist(a.x,a.y,b.x,b.y)/U;let r=Math.atan2(b.y-a.y,b.x-a.x);if(r>Math.PI/2)r-=Math.PI;if(r<-Math.PI/2)r+=Math.PI;const h=+this.o.h*U,mx=(a.x+b.x)/2,my=(a.y+b.y)/2;
  return mkText(L.toFixed(+this.o.d).replace('.',','),mx-Math.sin(r)*h*.35,my+Math.cos(r)*h*.35,h,r,'bc')},
 dp(p){if(!this.pts.length){this.pts=[p];return}const t=this.mk(this.pts[0],p);tx('Ghi kích thước',()=>addP(t));this.pts=[]},dyn(g,v,c){if(this.pts.length){dPoly(g,v,[this.pts[0].x,this.pts[0].y,c.x,c.y]);drawText(g,v,this.mk(this.pts[0],c),'#ffd400')}}})});
reg('ghitoado',{grp:'ve',name:'Ghi toạ độ điểm',ic:'⌗',make:()=>({opts:[{k:'h',l:'Cao chữ (m)',t:'number',v:ACT.th*.8}],pr:'Nhập điểm cần ghi toạ độ',dp(p){const t=toXY(p.x,p.y),h=+this.o.h*U;
 tx('Ghi toạ độ',()=>{newL([p.x-h*.4,p.y,p.x+h*.4,p.y]);newL([p.x,p.y-h*.4,p.x,p.y+h*.4]);addP(mkText('X: '+fm(t[0],3),p.x+h*.6,p.y+h*.3,h,0,'bl'));addP(mkText('Y: '+fm(t[1],3),p.x+h*.6,p.y-h*1.2,h,0,'bl'))})}})});
// ký hiệu (cell): đơn vị = kích thước ký hiệu
const KYHIEU={
 moc:{n:'Mốc giới (vòng tròn có tâm)',g:[{k:'E',e:[.5,.5,0,0,0]},{k:'L',p:[0,0,0,0]}]},
 khongche:{n:'Điểm khống chế (tam giác)',g:[{k:'S',p:[0,.6,-.52,-.3,.52,-.3,0,.6]},{k:'L',p:[0,0,0,0]}]},
 cotdien:{n:'Cột điện',g:[{k:'E',e:[.35,.35,0,0,0]},{k:'L',p:[-.5,0,.5,0]}]},
 gieng:{n:'Giếng nước',g:[{k:'E',e:[.5,.5,0,0,0]},{k:'E',e:[.25,.25,0,0,0]}]},
 cay:{n:'Cây độc lập',g:[{k:'E',e:[.35,.35,0,0,.25]},{k:'L',p:[0,-.5,0,-.1]}]},
 bac:{n:'Mũi tên chỉ hướng Bắc',g:[{k:'S',p:[0,1,-.35,-.6,0,-.25,.35,-.6,0,1]},{k:'L',p:[0,-.25,0,-1]}]},
 nhatho:{n:'Nhà thờ / chùa (dấu thập)',g:[{k:'L',p:[0,-.6,0,.6]},{k:'L',p:[-.35,.25,.35,.25]}]}};
let GRP=0;
function kyhieuPrims(key,x,y,sz,rot){const K=KYHIEU[key],g='g'+(++GRP)+Date.now().toString(36);return K.g.map(q=>{const p=clone(q);p.lv=ACT.lv;p.c=ACT.c;p.w=ACT.w;p.st=0;p.g=g;p.gn=key.toUpperCase();
 xformIn(p,{t:'sc',cx:0,cy:0,f:sz});xformIn(p,{t:'rot',cx:0,cy:0,a:rot});xformIn(p,{t:'tr',dx:x,dy:y});return p})}
reg('kyhieu',{grp:'ve',name:'Đặt ký hiệu',ic:'✱',make:()=>({opts:[{k:'k',l:'Ký hiệu',t:'select',v:'moc',o:Object.entries(KYHIEU).map(([k,v])=>[k,v.n])},{k:'s',l:'Cỡ (m)',t:'number',v:2},{k:'r',l:'Góc (độ)',t:'number',v:0}],
 pr:'Nhập vị trí đặt ký hiệu',dp(p){const ps=kyhieuPrims(this.o.k,p.x,p.y,+this.o.s*U/2,(+this.o.r||0)*Math.PI/180);tx('Đặt ký hiệu',()=>ps.forEach(addP))},
 dyn(g,v,c){dPrims(g,v,kyhieuPrims(this.o.k,c.x,c.y,+this.o.s*U/2,(+this.o.r||0)*Math.PI/180))}})});
// ======= NHÓM CHỌN / SỬA =======
reg('chon',{grp:'sua',name:'Chọn phần tử',ic:'➚',make:()=>({opts:[{k:'add',l:'Chọn thêm (giữ chọn cũ)',t:'check',v:false}],init(){SELADD=!!this.o.add},end(){SELADD=false},pr:'Chạm vào phần tử để chọn',dp(p){SELADD=!!this.o.add;selTool(p)}})});
reg('chonvung',{grp:'sua',name:'Chọn theo cửa sổ',ic:'⬚',make:()=>({opts:[{k:'m',l:'Cách chọn',t:'select',v:'in',o:[['in','Nằm trọn trong'],['ov','Trong hoặc chạm']]},{k:'add',l:'Chọn thêm',t:'check',v:false}],
 pr(){return this.pts.length?'Nhập góc đối diện':'Nhập góc thứ nhất của cửa sổ'},
 dp(p){if(!this.pts.length){this.pts=[p];return}const a=this.pts[0];this.pts=[];if(!this.o.add)SEL.clear();const r=[a.x,a.y,p.x,a.y,p.x,p.y,a.x,p.y];const n=selInPoly(r,this.o.m);info(`Đã chọn ${n} phần tử (tổng ${SEL.size})`)},
 dyn(g,v,c){if(this.pts.length){const a=this.pts[0];g.setLineDash([6,4]);dPoly(g,v,[a.x,a.y,c.x,a.y,c.x,c.y,a.x,c.y],true,'#00ffd0')}}})});
function selInPoly(r,m,neg){const bb=GEO.bbox(r);let n=0;const cand=neg?allPrims():[...idxQ(bb[0],bb[1],bb[2],bb[3])];
 for(const p of cand){if(p.del||p.ref||!lvOn(p.lv))continue;const vs=p.k==='T'?textBox(p).reduce((a,v,i)=>(i%2?a[a.length-1].push(v):a.push([v]),a),[]):segsOf(p).flatMap(s=>[[s[0],s[1]],[s[2],s[3]]]);
  const inn=vs.filter(q=>GEO.inPoly(q[0],q[1],r)).length,all=inn===vs.length;let cross=false;
  if(!all&&m!=='in')for(const s of segsOf(p)){for(let i=0;i<r.length;i+=2){const j=(i+2)%r.length;if(GEO.segX(s[0],s[1],s[2],s[3],r[i],r[i+1],r[j],r[j+1])){cross=true;break}}if(cross)break}
  const ok=m==='in'?all:m==='ov'?(inn>0||cross):m==='out'?(!inn&&!cross):m==='outov'?!all:false;if(ok){SEL.add(p);n++}}BUS.emit('selection',[...SEL].map(ser));return n}
reg('chontatca',{grp:'sua',name:'Chọn tất cả',ic:'▣',now(){for(const p of DOC.prims)if(!p.del&&lvOn(p.lv))SEL.add(p);info(`Đã chọn ${SEL.size} phần tử`);redraw()}});
reg('bochon',{grp:'sua',name:'Bỏ chọn',ic:'▢',now(){SEL.clear();redraw();msg('Đã bỏ chọn')}});
reg('chonlop',{grp:'sua',name:'Chọn theo lớp',ic:'≣',async now(){const r=await form('Chọn tất cả phần tử của lớp',[{k:'lv',l:'Số lớp (nhiều lớp cách nhau dấu phẩy)',v:ACT.lv},{k:'k',l:'Kiểu phần tử',t:'select',v:'',o:[['','Mọi kiểu'],['L','Đường'],['S','Vùng kín'],['T','Chữ'],['E','Đường tròn']]}]);if(!r)return;
 const L=new Set(String(r.lv).split(/[,; ]+/).filter(Boolean).map(Number));SEL.clear();for(const p of DOC.prims)if(!p.del&&L.has(p.lv)&&(!r.k||p.k===r.k))SEL.add(p);info(`Đã chọn ${SEL.size} phần tử`);redraw()}});
reg('xoa',{grp:'sua',name:'Xoá',ic:'✕',make:()=>({init(){if(SEL.size){const n=SEL.size,ps=[...SEL];tx('Xoá '+n+' phần tử',()=>ps.forEach(delP));info(`Đã xoá ${n} phần tử`)}},pr:'Chạm phần tử cần xoá',
 dp(p){const h=pick(p,editable);if(h){tx('Xoá phần tử',()=>delP(h.p));info('Đã xoá '+kname(h.p))}}})});
function selMk(name,T0,label,copyOpt){return()=>({opts:copyOpt?[{k:'cp',l:'Sao chép (giữ bản gốc)',t:'check',v:false}]:null,pr(){return!SEL.size?'Chạm phần tử cần '+label:this.step()},
 step(){return T0.steps[this.pts.length]||'Nhập điểm'},dp(p){if(!needSel(p))return;this.pts.push(p);const T=T0.T(this);if(T&&this.pts.length>=T0.n){const ps=[...SEL],cp=this.o&&this.o.cp||T0.copy;
  tx(name,()=>{if(cp){for(const q of ps)addP(xform(q,T))}else for(const q of ps)modP(q,x=>xformIn(x,T))});if(T0.rep)this.pts=[this.pts[0]];else this.pts=[]}},
 rs(){if(this.pts.length){this.pts=[];return}return true},dyn(g,v,c){if(!SEL.size||!this.pts.length)return;const T=T0.T(this,c);if(T)dPrims(g,v,[...SEL],T);if(T0.line)dPoly(g,v,[this.pts[this.pts.length-1].x,this.pts[this.pts.length-1].y,c.x,c.y],false,'#888')}})}
reg('dichuyen',{grp:'sua',name:'Di chuyển',ic:'✥',make:selMk('Di chuyển',{n:2,steps:['Nhập điểm gốc','Nhập điểm đến'],line:1,T:(s,c)=>{const a=s.pts[0],b=c||s.pts[1];return a&&b?{t:'tr',dx:b.x-a.x,dy:b.y-a.y}:null}},'di chuyển')});
reg('saochep',{grp:'sua',name:'Sao chép',ic:'⧉',make:selMk('Sao chép',{n:2,copy:1,rep:1,steps:['Nhập điểm gốc','Nhập điểm đến (lặp lại để chép tiếp)'],line:1,T:(s,c)=>{const a=s.pts[0],b=c||s.pts[1];return a&&b?{t:'tr',dx:b.x-a.x,dy:b.y-a.y}:null}},'sao chép')});
reg('xoay',{grp:'sua',name:'Xoay',ic:'⟳',make(){const f=selMk('Xoay',{n:3,steps:['Nhập tâm xoay','Nhập điểm hướng ban đầu','Nhập điểm hướng mới'],line:1,T:(s,c)=>{const a=+s.o.a;if(a&&s.pts[0])return{t:'rot',cx:s.pts[0].x,cy:s.pts[0].y,a:a*Math.PI/180};
 const[o,b,e]=[s.pts[0],s.pts[1],c||s.pts[2]];if(!o||!b||!e)return null;return{t:'rot',cx:o.x,cy:o.y,a:Math.atan2(e.y-o.y,e.x-o.x)-Math.atan2(b.y-o.y,b.x-o.x)}}},'xoay',true)();
 f.opts=[{k:'a',l:'Góc xoay (độ, ngược chiều kim đồng hồ; 0 = theo 3 điểm)',t:'number',v:0},{k:'cp',l:'Sao chép',t:'check',v:false}];const dp0=f.dp;f.dp=function(p){if(+this.o.a&&SEL.size){this.pts=[p];const T={t:'rot',cx:p.x,cy:p.y,a:+this.o.a*Math.PI/180},ps=[...SEL],cp=this.o.cp;tx('Xoay',()=>{if(cp){SEL.clear();ps.forEach(q=>SEL.add(addP(xform(q,T))))}else ps.forEach(q=>modP(q,x=>xformIn(x,T)))});this.pts=[];return}dp0.call(this,p)};return f}});
reg('tile',{grp:'sua',name:'Thay đổi tỉ lệ',ic:'⤡',make(){const f=selMk('Tỉ lệ',{n:1,steps:['Nhập điểm gốc tỉ lệ'],T:(s,c)=>{const o=c||s.pts[0];return o?{t:'sc',cx:o.x,cy:o.y,f:+s.o.f||1}:null}},'đổi tỉ lệ',true)();f.opts=[{k:'f',l:'Hệ số tỉ lệ',t:'number',v:2},{k:'cp',l:'Sao chép',t:'check',v:false}];return f}});
reg('doixung',{grp:'sua',name:'Đối xứng',ic:'⇋',make:selMk('Đối xứng',{n:2,steps:['Nhập điểm đầu trục đối xứng','Nhập điểm cuối trục'],line:1,T:(s,c)=>{const a=s.pts[0],b=c||s.pts[1];return a&&b&&(a.x!==b.x||a.y!==b.y)?{t:'mir',ax:a.x,ay:a.y,bx:b.x,by:b.y}:null}},'lấy đối xứng',true)});
reg('songsong',{grp:'sua',name:'Đường song song',ic:'⫽',make:()=>({opts:[{k:'d',l:'Khoảng cách (m, 0 = theo điểm)',t:'number',v:0}],pr(){return this.el?'Nhập điểm phía cần tạo đường song song':'Chạm đường cần lấy song song'},
 mk(p){const e=this.el;let d=+this.o.d*U;const r=distTo(e,p.x,p.y);if(!d)d=r[0];if(!r[1])return null;const s=r[1],side=Math.sign((s[2]-s[0])*(p.y-s[1])-(s[3]-s[1])*(p.x-s[0]))||1;
  if(e.k==='E'){const c=e.e,dd=GEO.dist(p.x,p.y,c[3],c[4])>c[0]?d:-d;return{...clone(e),e:[c[0]+dd,c[1]+dd,c[2],c[3],c[4]]}}
  if(e.k==='A'){const a=e.a,dd=GEO.dist(p.x,p.y,a[5],a[6])>a[2]?d:-d;const q=clone(e);q.a[2]+=dd;q.a[3]+=dd;return q}
  if(e.k==='L'||e.k==='S'){const cl=e.k==='S',q=cl?e.p.slice(0,-2):e.p;let o=GEO.offset(q,d*side,cl);if(cl)o.push(o[0],o[1]);return{...clone(e),p:o}}return null},
 dp(p){if(!this.el){const h=pick(p,q=>editable(q)&&q.k!=='T');if(h){this.el=h.p;HL=h.p}return}const n=this.mk(p);if(n){delete n.id;tx('Đường song song',()=>addP(n))}},
 rs(){if(this.el){this.el=null;HL=null;return}return true},end(){HL=null},dyn(g,v,c){if(this.el){const n=this.mk(c);if(n)dPrims(g,v,[n])}}})});
// ---- cắt xén / kéo dài ----
// tham số dọc đường: s = chỉ số đoạn + t
function polyParamAt(q,x,y){let best=[1/0,0];for(let i=0;i+3<q.length;i+=2){const r=GEO.segPt(x,y,q[i],q[i+1],q[i+2],q[i+3]);if(r[0]<best[0])best=[r[0],i/2+r[1]]}return best[1]}
function polyAt(q,s){const i=Math.min(Math.floor(s),q.length/2-2),t=s-i;return[q[2*i]+(q[2*i+2]-q[2*i])*t,q[2*i+1]+(q[2*i+3]-q[2*i+1])*t]}
function polySub(q,s0,s1){const o=[...polyAt(q,s0)];for(let i=Math.floor(s0)+1;i<=Math.ceil(s1)-1&&i<q.length/2;i++)if(i>s0&&i<s1)o.push(q[2*i],q[2*i+1]);o.push(...polyAt(q,s1));return o}
function crossParams(q,cutters){const out=[];for(let i=0;i+3<q.length;i+=2)for(const c of cutters)for(const s of segsOf(c)){const x=GEO.segX(q[i],q[i+1],q[i+2],q[i+3],s[0],s[1],s[2],s[3]);if(x)out.push(i/2+x[2])}return out.sort((a,b)=>a-b)}
function trimAt(e,cut,p){let q=e.p.slice();if(e.k==='S'){/* vùng kín: mở thành đường */}const ps=crossParams(q,cut).filter((v,i,a)=>!i||v-a[i-1]>1e-9),s=polyParamAt(q,p.x,p.y),N=q.length/2-1;
 const lo=ps.filter(v=>v<s-1e-9).pop(),hi=ps.find(v=>v>s+1e-9);if(lo==null&&hi==null)return null;const parts=[];
 if(e.k==='S'){if(ps.length<2)return null;let a=lo,b=hi;if(a==null)a=ps[ps.length-1]-N;if(b==null)b=ps[0]+N;const q2=q.concat(q.slice(2),q.slice(2));if(a<0){a+=N;b+=N}parts.push(polySub(q2,b,a+N))}
 else{if(lo!=null&&lo>1e-9)parts.push(polySub(q,0,lo));if(hi!=null&&hi<N-1e-9)parts.push(polySub(q,hi,N))}return parts}
reg('catxen',{grp:'sua',name:'Cắt xén theo đường',ic:'✂',make:()=>({pr(){return this.cut?'Chạm phần cần cắt bỏ (Đặt lại: chọn lại đường cắt)':'Chạm đường dùng làm dao cắt'},
 dp(p){if(!this.cut){const h=pick(p,q=>q.k!=='T');if(h){this.cut=[h.p];HL=h.p}return}const h=pick(p,q=>editable(q)&&(q.k==='L'||q.k==='S')&&!this.cut.includes(q));if(!h)return;
  const parts=trimAt(h.p,this.cut,p);if(!parts){msg('Đường này không cắt dao cắt');return}tx('Cắt xén',()=>{const a={lv:h.p.lv,c:h.p.c,w:h.p.w,st:h.p.st};delP(h.p);for(const q of parts)if(q.length>=4)addP({k:'L',...a,p:q})})},
 rs(){if(this.cut){this.cut=null;HL=null;return}return true},end(){HL=null}})});
reg('catnhieu',{grp:'sua',name:'Cắt xén nhiều (theo phần tử chọn)',ic:'✄',make:()=>({pr(){return SEL.size?'Chạm phần cần cắt bỏ (dao cắt = các phần tử đang chọn)':'Chọn các phần tử dao cắt trước (Chọn phần tử / Chọn theo cửa sổ)'},
 dp(p){if(!SEL.size){msg('Chưa chọn dao cắt');return}const cut=[...SEL],h=pick(p,q=>editable(q)&&(q.k==='L'||q.k==='S')&&!SEL.has(q));if(!h)return;const parts=trimAt(h.p,cut,p);if(!parts){msg('Không có giao điểm');return}
  tx('Cắt xén',()=>{const a={lv:h.p.lv,c:h.p.c,w:h.p.w,st:h.p.st};delP(h.p);for(const q of parts)if(q.length>=4)addP({k:'L',...a,p:q})})}})});
function extendEnd(e,bounds,p){const q=e.p,n=q.length/2,atEnd=GEO.d2(p.x,p.y,q[2*n-2],q[2*n-1])<GEO.d2(p.x,p.y,q[0],q[1]);const[ax,ay,bx,by]=atEnd?[q[2*n-4],q[2*n-3],q[2*n-2],q[2*n-1]]:[q[2],q[3],q[0],q[1]];
 let best=null;for(const b of bounds)for(const s of segsOf(b)){const x=GEO.segX(ax,ay,bx,by,s[0],s[1],s[2],s[3],true);if(!x)continue;const u=x[3];if(u<-1e-9||u>1+1e-9)continue;if(x[2]<=1e-9)continue;if(!best||Math.abs(x[2]-1)<Math.abs(best[2]-1))best=x}
 if(!best)return null;const o=q.slice();if(atEnd){o[2*n-2]=best[0];o[2*n-1]=best[1]}else{o[0]=best[0];o[1]=best[1]}return o}
reg('keodai',{grp:'sua',name:'Kéo dài tới đường',ic:'⇥',make:()=>({pr(){return this.b?'Chạm gần đầu đường cần kéo dài':'Chạm đường biên (đích kéo tới)'},
 dp(p){if(!this.b){const h=pick(p,q=>q.k!=='T');if(h){this.b=h.p;HL=h.p}return}const h=pick(p,q=>editable(q)&&q.k==='L'&&q!==this.b);if(!h)return;const o=extendEnd(h.p,[this.b],p);if(!o){msg('Không kéo dài tới được');return}tx('Kéo dài',()=>modP(h.p,x=>x.p=o))},
 rs(){if(this.b){this.b=null;HL=null;return}return true},end(){HL=null}})});
reg('giao2',{grp:'sua',name:'Kéo/cắt 2 đường tới giao điểm',ic:'⋌',make:()=>({pr(){return this.a?'Chạm đường thứ hai (phía giữ lại)':'Chạm đường thứ nhất (phía giữ lại)'},
 dp(p){const h=pick(p,q=>editable(q)&&q.k==='L');if(!h)return;if(!this.a){this.a={p:h.p,pt:p,seg:h.seg};HL=h.p;return}const A=this.a,B={p:h.p,pt:p,seg:h.seg};this.a=null;HL=null;
  const sa=A.seg,sb=B.seg,x=GEO.segX(sa[0],sa[1],sa[2],sa[3],sb[0],sb[1],sb[2],sb[3],true);if(!x){msg('Hai đường song song');return}
  const fix=(E,s)=>{const q=E.p.p.slice(),i=s[4],ax=s[0],ay=s[1],dx=s[2]-ax,dy=s[3]-ay,L=dx*dx+dy*dy||1,tp=((E.pt.x-ax)*dx+(E.pt.y-ay)*dy)/L,tq=((x[0]-ax)*dx+(x[1]-ay)*dy)/L;
   if(tp<tq){q[2*i+2]=x[0];q[2*i+3]=x[1];q.length=2*i+4}else{q[2*i]=x[0];q[2*i+1]=x[1];q.splice(0,2*i)}return q};
  tx('Kéo tới giao điểm',()=>{modP(A.p,e=>e.p=fix(A,sa));if(B.p!==A.p)modP(B.p,e=>e.p=fix(B,sb))})},rs(){if(this.a){this.a=null;HL=null;return}return true},end(){HL=null}})});
reg('chat',{grp:'sua',name:'Chặt đường tại điểm',ic:'⊣',make:()=>({pr:'Chạm vị trí cần chặt đôi đường',dp(p){const h=pick(p,q=>editable(q)&&(q.k==='L'||q.k==='S'));if(!h)return;const q=h.p.p,s=polyParamAt(q,p.x,p.y),N=q.length/2-1;if(s<1e-6||s>N-1e-6){msg('Chạm vào giữa đường, không phải đầu mút');return}
 const a={lv:h.p.lv,c:h.p.c,w:h.p.w,st:h.p.st};tx('Chặt đường',()=>{delP(h.p);if(h.p.k==='S')addP({k:'L',...a,p:polySub(q.concat(q.slice(2)),s,s+N)});else{addP({k:'L',...a,p:polySub(q,0,s)});addP({k:'L',...a,p:polySub(q,s,N)})}})}})});
reg('xoamot',{grp:'sua',name:'Xoá một phần đường',ic:'⌫',make:()=>({pr(){return this.e?'Nhập điểm cuối đoạn cần xoá':'Chạm điểm đầu đoạn cần xoá trên đường'},
 dp(p){if(!this.e){const h=pick(p,q=>editable(q)&&q.k==='L');if(h){this.e=h.p;this.s0=polyParamAt(h.p.p,p.x,p.y);HL=h.p}return}const q=this.e.p,s1=polyParamAt(q,p.x,p.y),a=Math.min(this.s0,s1),b=Math.max(this.s0,s1),N=q.length/2-1,at={lv:this.e.lv,c:this.e.c,w:this.e.w,st:this.e.st},e=this.e;
  tx('Xoá một phần',()=>{delP(e);if(a>1e-6)addP({k:'L',...at,p:polySub(q,0,a)});if(b<N-1e-6)addP({k:'L',...at,p:polySub(q,b,N)})});this.e=null;HL=null},
 rs(){if(this.e){this.e=null;HL=null;return}return true},end(){HL=null},dyn(g,v,c){if(this.e){const q=this.e.p,s1=polyParamAt(q,c.x,c.y);dPoly(g,v,polySub(q,Math.min(this.s0,s1),Math.max(this.s0,s1)),false,'#ff3030')}}})});
reg('noi',{grp:'sua',name:'Nối thành chuỗi',ic:'⛓',now(){const L=[...SEL].filter(p=>p.k==='L'&&editable(p));if(L.length<2){msg('Chọn từ 2 đường trở lên cần nối');return}const tol=tolW();
 const pool=L.map(p=>p.p.slice());let chains=[];while(pool.length){let c=pool.shift(),grow=true;while(grow){grow=false;for(let i=0;i<pool.length;i++){const q=pool[i],n=c.length,m=q.length,E=[c[n-2],c[n-1]],S=[c[0],c[1]];
   const near=(a,b)=>GEO.dist(a[0],a[1],b[0],b[1])<=tol;const rev=x=>{const o=[];for(let k=x.length-2;k>=0;k-=2)o.push(x[k],x[k+1]);return o};
   if(near(E,[q[0],q[1]]))c=c.concat(q.slice(2));else if(near(E,[q[m-2],q[m-1]]))c=c.concat(rev(q).slice(2));else if(near(S,[q[m-2],q[m-1]]))c=q.concat(c.slice(2));else if(near(S,[q[0],q[1]]))c=rev(q).concat(c.slice(2));else continue;pool.splice(i,1);grow=true;break}}chains.push(c)}
 const a={lv:L[0].lv,c:L[0].c,w:L[0].w,st:L[0].st};tx('Nối chuỗi',()=>{L.forEach(delP);SEL.clear();for(const c of chains){const n=c.length,cl=n>=8&&GEO.dist(c[0],c[1],c[n-2],c[n-1])<=tol;if(cl){c[n-2]=c[0];c[n-1]=c[1]}SEL.add(addP({k:cl?'S':'L',...a,p:c}))}});info(`Đã nối ${L.length} đường thành ${chains.length} chuỗi`)}});
reg('pha',{grp:'sua',name:'Phá chuỗi thành đoạn',ic:'⋯',now(){const L=[...SEL].filter(p=>(p.k==='L'||p.k==='S')&&p.p.length>4&&editable(p));if(!L.length){msg('Chọn đường gấp khúc/vùng cần phá');return}let n=0;
 tx('Phá chuỗi',()=>{for(const p of L){delP(p);for(const s of segsOf(p)){addP({k:'L',lv:p.lv,c:p.c,w:p.w,st:p.st,p:[s[0],s[1],s[2],s[3]]});n++}}});SEL.clear();info(`Đã phá thành ${n} đoạn`)}});
reg('dongvung',{grp:'sua',name:'Đóng đường thành vùng kín',ic:'⬡',now(){const L=[...SEL].filter(p=>p.k==='L'&&p.p.length>=6&&editable(p));if(!L.length){msg('Chọn đường gấp khúc cần đóng');return}tx('Đóng vùng',()=>L.forEach(p=>modP(p,x=>{x.k='S';const n=x.p.length;if(x.p[0]!==x.p[n-2]||x.p[1]!==x.p[n-1])x.p.push(x.p[0],x.p[1])})));info('Đã đóng '+L.length+' vùng')}});
reg('suadinh',{grp:'sua',name:'Sửa đỉnh (di chuyển đỉnh)',ic:'⊹',make:()=>({pr(){return this.e?'Nhập vị trí mới của đỉnh':'Chạm gần đỉnh cần di chuyển'},
 dp(p){if(!this.e){const h=pick(p,editable);if(!h)return;let bi=-1,bd=1/0;vertsOf(h.p).forEach(q=>{const d=GEO.d2(q[0],q[1],p.x,p.y);if(d<bd){bd=d;bi=q[2]}});this.e=h.p;this.i=bi;HL=h.p;return}
  const e=this.e,i=this.i;tx('Sửa đỉnh',()=>modP(e,x=>this.ap(x,i,p)));this.e=null;HL=null},
 ap(x,i,p){if(x.p){const n=x.p.length/2;x.p[2*i]=p.x;x.p[2*i+1]=p.y;if(x.k==='S'&&(i===0||i===n-1)){x.p[0]=x.p[2*n-2]=p.x;x.p[1]=x.p[2*n-1]=p.y}}else if(x.k==='E'){const r=GEO.dist(x.e[3],x.e[4],p.x,p.y);x.e[0]=x.e[1]=r}else if(x.k==='T'){x.x=p.x;x.y=p.y}else if(x.k==='A'){const a=x.a,r=GEO.dist(a[5],a[6],p.x,p.y);a[2]=a[3]=r}},
 rs(){if(this.e){this.e=null;HL=null;return}return true},end(){HL=null},dyn(g,v,c){if(this.e){const q=clone(this.e);this.ap(q,this.i,c);dPrims(g,v,[q])}}})});
reg('themdinh',{grp:'sua',name:'Chèn đỉnh',ic:'⊕',make:()=>({pr(){return this.e?'Nhập vị trí đỉnh mới':'Chạm cạnh cần chèn đỉnh'},
 dp(p){if(!this.e){const h=pick(p,q=>editable(q)&&(q.k==='L'||q.k==='S'));if(!h||!h.seg)return;this.e=h.p;this.i=h.seg[4];HL=h.p;return}const e=this.e,i=this.i;tx('Chèn đỉnh',()=>modP(e,x=>x.p.splice(2*i+2,0,p.x,p.y)));this.e=null;HL=null},
 rs(){if(this.e){this.e=null;HL=null;return}return true},end(){HL=null},dyn(g,v,c){if(this.e){const q=clone(this.e);q.p.splice(2*this.i+2,0,c.x,c.y);dPrims(g,v,[q])}}})});
reg('xoadinh',{grp:'sua',name:'Xoá đỉnh',ic:'⊖',make:()=>({pr:'Chạm gần đỉnh cần xoá',dp(p){const h=pick(p,q=>editable(q)&&(q.k==='L'||q.k==='S'));if(!h)return;const e=h.p,n=e.p.length/2;let bi=0,bd=1/0;for(let i=0;i<n;i++){const d=GEO.d2(e.p[2*i],e.p[2*i+1],p.x,p.y);if(d<bd){bd=d;bi=i}}
 if((e.k==='L'&&n<=2)||(e.k==='S'&&n<=4)){msg('Không thể xoá thêm đỉnh');return}tx('Xoá đỉnh',()=>modP(e,x=>{if(x.k==='S'&&(bi===0||bi===n-1)){x.p.splice(0,2);x.p.splice(x.p.length-2,2,x.p[0],x.p[1])}else x.p.splice(2*bi,2)}))}})});
reg('doithuoctinh',{grp:'sua',name:'Đổi thuộc tính theo hiện hành',ic:'🎨',make:()=>({opts:[{k:'lv',l:'Lớp',t:'check',v:true},{k:'c',l:'Màu',t:'check',v:true},{k:'w',l:'Lực nét',t:'check',v:true},{k:'st',l:'Kiểu đường',t:'check',v:true}],
 init(){if(SEL.size){const ps=[...SEL];tx('Đổi thuộc tính',()=>ps.forEach(p=>this.ap(p)));info(`Đã đổi thuộc tính ${ps.length} phần tử`)}},pr:'Chạm phần tử cần đổi thuộc tính (theo thuộc tính hiện hành)',
 ap(p){modP(p,x=>{for(const k of['lv','c','w','st'])if(this.o[k])x[k]=ACT[k]})},dp(p){const h=pick(p,editable);if(h)tx('Đổi thuộc tính',()=>this.ap(h.p))}})});
reg('khopthuoctinh',{grp:'sua',name:'Lấy thuộc tính từ phần tử',ic:'💧',make:()=>({pr:'Chạm phần tử mẫu',dp(p){const h=hitAt(p.x,p.y,tolW());if(!h)return;const q=h.p;ACT.lv=q.lv;ACT.c=q.c;ACT.w=q.w;ACT.st=q.st;if(q.k==='T')ACT.th=+(q.h/U).toFixed(3);saveAct();renderAttr();info(`Hiện hành: lớp ${q.lv}, màu ${q.c}, nét ${q.w}, kiểu ${q.st}`);endCmd()}})});
reg('suachu',{grp:'sua',name:'Sửa chữ',ic:'✎',make:()=>({pr:'Chạm chữ cần sửa',async dp(p){const h=pick(p,q=>editable(q)&&q.k==='T');if(!h)return;const e=h.p;
 const r=await form('Sửa chữ',[{k:'s',l:'Nội dung',v:e.s},{k:'h',l:'Cao chữ (m)',t:'number',v:+(e.h/U).toFixed(3)},{k:'r',l:'Góc (độ)',t:'number',v:+((e.r||0)*180/Math.PI).toFixed(4)}]);if(!r)return;
 tx('Sửa chữ',()=>modP(e,x=>{x.s=r.s;x.h=+r.h*U;x.r=+r.r*Math.PI/180}));redraw()}})});
reg('thaychu',{grp:'sua',name:'Tìm và thay chữ',ic:'🔎',async now(){const r=await form('Tìm và thay chữ',[{k:'f',l:'Tìm',v:''},{k:'t',l:'Thay bằng (để trống = chỉ tìm và chọn)',v:''},{k:'w',l:'Khớp nguyên chữ',t:'check',v:false},{k:'lv',l:'Chỉ trong lớp (để trống = mọi lớp)',v:''}]);if(!r||!r.f)return;
 const L=r.lv?new Set(String(r.lv).split(/[, ]+/).map(Number)):null,ps=DOC.prims.filter(p=>!p.del&&p.k==='T'&&(!L||L.has(p.lv))&&(r.w?p.s===r.f:p.s.includes(r.f)));SEL.clear();ps.forEach(p=>SEL.add(p));
 if(r.t!==''&&ps.length){tx('Thay chữ',()=>ps.forEach(p=>modP(p,x=>x.s=r.w?r.t:x.s.split(r.f).join(r.t))))}info(`Tìm thấy ${ps.length} chữ`+(r.t!==''?', đã thay':' (đang được chọn)'));if(ps.length===1)zoomTo(bbOf(ps[0]),20);redraw()}});
reg('botron',{grp:'sua',name:'Bo tròn góc',ic:'⌒',make:()=>({opts:[{k:'r',l:'Bán kính (m)',t:'number',v:2}],pr(){return this.a?'Chạm đường thứ hai':'Chạm đoạn thẳng thứ nhất'},
 dp(p){const h=pick(p,q=>editable(q)&&q.k==='L'&&q.p.length===4);if(!h)return;if(!this.a){this.a={e:h.p,pt:p};HL=h.p;return}const A=this.a;this.a=null;HL=null;const B={e:h.p,pt:p},R=+this.o.r*U;
  const a=A.e.p,b=B.e.p,X=GEO.segX(a[0],a[1],a[2],a[3],b[0],b[1],b[2],b[3],true);if(!X){msg('Hai đường song song');return}const ix=X[0],iy=X[1];
  const far=(q,pt)=>{const d0=GEO.d2(q[0],q[1],ix,iy),d1=GEO.d2(q[2],q[3],ix,iy);return d0>d1?[q[0],q[1]]:[q[2],q[3]]};const fa=far(a),fb=far(b);
  const ua=[fa[0]-ix,fa[1]-iy],ub=[fb[0]-ix,fb[1]-iy],la=Math.hypot(...ua),lb=Math.hypot(...ub);ua[0]/=la;ua[1]/=la;ub[0]/=lb;ub[1]/=lb;
  const th=Math.acos(Math.max(-1,Math.min(1,ua[0]*ub[0]+ua[1]*ub[1])));if(th<1e-3||Math.abs(th-Math.PI)<1e-3){msg('Không bo được');return}const t=R/Math.tan(th/2);if(t>la||t>lb){msg('Bán kính quá lớn');return}
  const ta=[ix+ua[0]*t,iy+ua[1]*t],tb=[ix+ub[0]*t,iy+ub[1]*t],bis=[ua[0]+ub[0],ua[1]+ub[1]],bl=Math.hypot(...bis),dc=R/Math.sin(th/2),c=[ix+bis[0]/bl*dc,iy+bis[1]/bl*dc];
  const a0=Math.atan2(ta[1]-c[1],ta[0]-c[0]),a1=Math.atan2(tb[1]-c[1],tb[0]-c[0]);let sw=a1-a0;while(sw>Math.PI)sw-=2*Math.PI;while(sw<-Math.PI)sw+=2*Math.PI;
  tx('Bo tròn góc',()=>{modP(A.e,x=>x.p=[fa[0],fa[1],ta[0],ta[1]]);modP(B.e,x=>x.p=[fb[0],fb[1],tb[0],tb[1]]);addP({k:'A',lv:A.e.lv,c:A.e.c,w:A.e.w,st:A.e.st,a:[a0,sw,R,R,0,c[0],c[1]]})})},rs(){if(this.a){this.a=null;HL=null;return}return true},end(){HL=null}})});
reg('mang',{grp:'sua',name:'Sao chép theo mảng',ic:'▦',async now(){if(!SEL.size){msg('Chọn phần tử trước');return}const r=await form('Sao chép theo mảng',[{k:'m',l:'Kiểu',t:'select',v:'r',o:[['r','Mảng chữ nhật'],['p','Mảng tròn (quanh tâm phần tử chọn)']]},{k:'n',l:'Số hàng (chữ nhật) / số bản sao (tròn)',t:'number',v:2},{k:'c',l:'Số cột (chữ nhật)',t:'number',v:2},{k:'dx',l:'Khoảng cách cột (m) / góc giữa 2 bản (độ)',t:'number',v:10},{k:'dy',l:'Khoảng cách hàng (m)',t:'number',v:10}]);if(!r)return;
 const ps=[...SEL];let n=0;tx('Sao chép mảng',()=>{if(r.m==='r'){for(let i=0;i<+r.n;i++)for(let j=0;j<+r.c;j++){if(!i&&!j)continue;for(const q of ps){addP(xform(q,{t:'tr',dx:j*r.dx*U,dy:i*r.dy*U}));n++}}}
  else{const bb=GEO.bbox(ps.flatMap(bbOf)),cx=(bb[0]+bb[2])/2,cy=(bb[1]+bb[3])/2;for(let i=1;i<=+r.n;i++)for(const q of ps){addP(xform(q,{t:'rot',cx,cy,a:i*r.dx*Math.PI/180}));n++}}});info('Đã tạo '+n+' phần tử')}});
reg('thongtin',{grp:'sua',name:'Thông tin phần tử',ic:'ℹ',make:()=>({pr:'Chạm phần tử cần xem thông tin',dp(p){const h=hitAt(p.x,p.y,tolW());if(h)elInfo(h.p)}})});
async function elInfo(e){const r=[['Kiểu',kname(e)+(e.ref?' (tham chiếu '+e.ref+')':'')+(e.g?' · thuộc ký hiệu '+(e.gn||''):'')],['Lớp',e.lv],['Màu',e.c],['Lực nét',e.w],['Kiểu đường',e.st]];
 if(e.p){const cl=e.k==='S';r.push(['Số đỉnh',e.p.length/2],['Chiều dài'+(cl?' (chu vi)':''),fm(GEO.len(e.p)/U,3)+' m']);if(cl)r.push(['Diện tích',fm(Math.abs(GEO.area(e.p))/U/U,2)+' m²']);
  const vs=[];for(let i=0;i<e.p.length&&i<60;i+=2){const t=toXY(e.p[i],e.p[i+1]);vs.push(`${i/2+1}: X=${fm(t[0])}  Y=${fm(t[1])}`)}r.push(['Toạ độ đỉnh',vs.join('<br>')+(e.p.length>60?'<br>…':'')])}
 if(e.k==='E'){const t=toXY(e.e[3],e.e[4]);r.push(['Tâm',`X=${fm(t[0])} Y=${fm(t[1])}`],['Bán kính',fm(e.e[0]/U)+' m'],['Diện tích',fm(Math.PI*e.e[0]*e.e[1]/U/U,2)+' m²'])}
 if(e.k==='A'){const t=toXY(e.a[5],e.a[6]);r.push(['Tâm',`X=${fm(t[0])} Y=${fm(t[1])}`],['Bán kính',fm(e.a[2]/U)+' m'],['Góc mở',fmA(Math.abs(e.a[1])*180/Math.PI)],['Dài cung',fm(Math.abs(e.a[1])*e.a[2]/U)+' m'])}
 if(e.k==='T'){const t=toXY(e.x,e.y);r.push(['Nội dung',M8.esc(e.s)],['Cao chữ',fm(e.h/U)+' m'],['Góc',fmA((e.r||0)*180/Math.PI)],['Gốc chữ',`X=${fm(t[0])} Y=${fm(t[1])}`])}
 const v=await dlg(`<h3>Thông tin phần tử</h3><table>${r.map(x=>`<tr><th>${x[0]}</th><td>${x[1]}</td></tr>`).join('')}</table>
 ${e.ref?'':`<h3 style="margin-top:10px">Sửa thuộc tính</h3><div style="display:flex;gap:6px;flex-wrap:wrap"><label>Lớp <input name="lv" type="number" value="${e.lv}" style="width:70px"></label><label>Màu <input name="c" type="number" value="${e.c}" style="width:70px"></label><label>Nét <input name="w" type="number" value="${e.w}" style="width:60px"></label><label>Kiểu <input name="st" type="number" value="${e.st}" style="width:60px"></label></div>`}
 <div class="bt"><button data-r="z">Phóng tới</button><button data-r="x">Đóng</button>${e.ref?'':'<button class="p" data-r="ok">Cập nhật</button>'}</div>`);
 if(v==='z')zoomTo(bbOf(e),30);else if(v&&typeof v==='object'){tx('Sửa thuộc tính',()=>modP(e,x=>{x.lv=+v.lv;x.c=+v.c;x.w=+v.w;x.st=+v.st}));}}
// ======= HÀNG RÀO =======
reg('hrchunhat',{grp:'hr',name:'Hàng rào chữ nhật',ic:'⬚',make:()=>({pr(){return this.pts.length?'Nhập góc đối diện':'Nhập góc thứ nhất'},dp(p){if(!this.pts.length){this.pts=[p];return}const a=this.pts[0];FENCE={p:[a.x,a.y,p.x,a.y,p.x,p.y,a.x,p.y]};this.pts=[];info('Đã đặt hàng rào – dùng các lệnh “Chọn theo hàng rào”, “Xoá trong hàng rào”…');endCmd()},
 dyn(g,v,c){if(this.pts.length){const a=this.pts[0];drawFence(g,v,{p:[a.x,a.y,c.x,a.y,c.x,c.y,a.x,c.y]})}}})});
reg('hrdagiac',{grp:'hr',name:'Hàng rào đa giác',ic:'⬠',make:()=>({pr:'Nhập các đỉnh hàng rào (Đặt lại: khép)',dp(p){this.pts.push(p)},rs(){if(this.pts.length>=3){FENCE={p:flat(this.pts)};this.pts=[];info('Đã đặt hàng rào');return true}if(this.pts.length){this.pts=[];return}return true},dyn(g,v,c){if(this.pts.length)drawFence(g,v,{p:[...flat(this.pts),c.x,c.y]})}})});
reg('hrphantu',{grp:'hr',name:'Hàng rào theo vùng kín',ic:'⬡',make:()=>({pr:'Chạm vùng kín (hoặc đường tròn) làm hàng rào',dp(p){const h=hitAt(p.x,p.y,tolW(),q=>q.k==='S'||q.k==='E');if(!h)return;FENCE={p:h.p.k==='S'?h.p.p.slice(0,-2):segsOf(h.p).flatMap(s=>[s[0],s[1]])};info('Đã đặt hàng rào theo phần tử');endCmd()}})});
reg('hrbo',{grp:'hr',name:'Bỏ hàng rào',ic:'✕',now(){FENCE=null;redraw()}});
const FMODE=[['in','Nằm trong'],['ov','Trong + chạm'],['out','Nằm ngoài'],['outov','Ngoài + chạm']];
reg('hrchon',{grp:'hr',name:'Chọn theo hàng rào',ic:'▣',async now(){if(!FENCE){msg('Chưa đặt hàng rào');return}const r=await form('Chọn phần tử theo hàng rào',[{k:'m',l:'Chế độ',t:'select',v:'in',o:FMODE},{k:'add',l:'Chọn thêm',t:'check',v:false}]);if(!r)return;if(!r.add)SEL.clear();const n=selInPoly(FENCE.p,r.m,r.m.startsWith('out'));info(`Đã chọn ${n} phần tử`);redraw()}});
reg('hrxoa',{grp:'hr',name:'Xoá trong hàng rào',ic:'⌧',async now(){if(!FENCE){msg('Chưa đặt hàng rào');return}const r=await form('Xoá phần tử theo hàng rào',[{k:'m',l:'Chế độ',t:'select',v:'in',o:FMODE}]);if(!r)return;const keep=new Set(SEL);SEL.clear();selInPoly(FENCE.p,r.m,r.m.startsWith('out'));const ps=[...SEL];SEL.clear();
 if(ps.length&&await confirm_(`Xoá ${ps.length} phần tử?`,'Xoá'))tx('Xoá theo hàng rào',()=>ps.forEach(delP));redraw()}});
reg('hrcat',{grp:'hr',name:'Cắt đường theo hàng rào',ic:'✂',async now(){if(!FENCE){msg('Chưa đặt hàng rào');return}const r=await form('Cắt đường theo biên hàng rào',[{k:'m',l:'Giữ lại phần',t:'select',v:'in',o:[['in','Bên trong hàng rào'],['out','Bên ngoài hàng rào']]}]);if(!r)return;
 const F=FENCE.p,fp={k:'S',p:F.concat(F.slice(0,2))},bb=GEO.bbox(F);let n=0;
 tx('Cắt theo hàng rào',()=>{for(const p of [...idxQ(bb[0],bb[1],bb[2],bb[3])]){if(!editable(p)||(p.k!=='L'&&p.k!=='S'))continue;let q=p.p;const ps=[0,...crossParams(q,[fp]),q.length/2-1];if(ps.length<=2){const m=polyAt(q,.5);if(GEO.inPoly(m[0],m[1],F)!==(r.m==='in')){delP(p);n++}continue}
  const at={lv:p.lv,c:p.c,w:p.w,st:p.st};delP(p);n++;for(let i=1;i<ps.length;i++){if(ps[i]-ps[i-1]<1e-9)continue;const m=polyAt(q,(ps[i]+ps[i-1])/2);if(GEO.inPoly(m[0],m[1],F)===(r.m==='in'))addP({k:'L',...at,p:polySub(q,ps[i-1],ps[i])})}}});info(`Đã cắt ${n} phần tử`)}});
// ======= ĐO =======
reg('dokc',{grp:'do',name:'Đo khoảng cách',ic:'📏',make:()=>({pr(){return this.pts.length?'Nhập điểm tiếp (Đặt lại: đo lại)':'Nhập điểm đầu'},tot:0,
 dp(p){if(this.pts.length){const a=this.pts[this.pts.length-1],d=GEO.dist(a.x,a.y,p.x,p.y)/U;this.tot+=d;info(`Đoạn: ${fm(d)} m · PV ${fmA(azim(a,p))} · Tổng: ${fm(this.tot)} m`)}this.pts.push(p)},
 rs(){if(this.pts.length){this.pts=[];this.tot=0;return}return true},dyn(g,v,c){if(this.pts.length){dPoly(g,v,[...flat(this.pts),c.x,c.y],false,'#00e5ff');const a=this.pts[this.pts.length-1];prompt_(`Đo › đoạn ${fm(GEO.dist(a.x,a.y,c.x,c.y)/U)} m · PV ${fmA(azim(a,c))} · tổng ${fm(this.tot+GEO.dist(a.x,a.y,c.x,c.y)/U)} m`)}}})});
reg('dodt',{grp:'do',name:'Đo diện tích',ic:'⬓',make:()=>({opts:[{k:'m',l:'Cách đo',t:'select',v:'pt',o:[['pt','Theo các điểm'],['el','Chạm vùng kín / đường tròn'],['fl','Chạm vào trong vùng bao (tự tìm ranh)']]}],pr(){return this.o.m==='pt'?(this.pts.length<3?`Điểm thứ ${this.pts.length+1}`:'Điểm tiếp (Đặt lại: tính diện tích)'):'Chạm vào vùng'},
 show(q){const A=Math.abs(GEO.area(q))/U/U,P=GEO.len(q,true)/U;info(`Diện tích: ${fm(A,2)} m² (${fm(A/1e4,4)} ha) · Chu vi: ${fm(P,2)} m`);OVL.set('_do',{items:[{rings:[q],fill:'#00e5ff',stroke:'#00e5ff',alpha:.25}]})},
 dp(p){if(this.o.m==='pt'){this.pts.push(p);return}if(this.o.m==='el'){const h=hitAt(p.x,p.y,tolW(),q=>q.k==='S'||q.k==='E');if(!h)return;if(h.p.k==='S')this.show(h.p.p);else{const A=Math.PI*h.p.e[0]*h.p.e[1]/U/U;info(`Diện tích: ${fm(A,2)} m²`)}return}
  const r=floodRing(p);if(r)this.show(r);else msg('Không tìm được vùng khép kín bao quanh điểm này')},
 rs(){if(this.pts.length>=3){this.show(flat(this.pts));this.pts=[];return}if(this.pts.length){this.pts=[];return}OVL.delete('_do');return true},end(){OVL.delete('_do')},dyn(g,v,c){if(this.pts.length)dPoly(g,v,[...flat(this.pts),c.x,c.y],true,'#00e5ff')}})});
// vùng khép kín nhỏ nhất quanh điểm (dựa trên các đường đang hiển thị trong khung nhìn)
function floodRing(p){const v=V(),x0=wx(v,0),x1=wx(v,v.W),y0=wy(v,v.H),y1=wy(v,0),S=[];for(const q of idxQ(x0,y0,x1,y1)){if(!lvOn(q.lv)||q.k==='T')continue;for(const s of segsOf(q))S.push([s[0],s[1],s[2],s[3],0])}
 if(S.length>60000){msg('Quá nhiều đường trong khung nhìn – hãy phóng to');return null}const R=M8.PLANAR.build(S,Math.max(1,2/v.s));let best=null;for(const f of R.faces){if(GEO.inPoly(p.x,p.y,f.ring)&&!(f.holes||[]).some(h=>GEO.inPoly(p.x,p.y,h))&&(!best||f.area<best.area))best=f}return best?best.ring:null}
reg('dogoc',{grp:'do',name:'Đo góc',ic:'∠',make:()=>({pr(){return['Nhập điểm trên cạnh thứ nhất','Nhập đỉnh góc','Nhập điểm trên cạnh thứ hai'][this.pts.length]},dp(p){this.pts.push(p);if(this.pts.length===3){const[a,o,b]=this.pts;let g=Math.abs(Math.atan2(a.y-o.y,a.x-o.x)-Math.atan2(b.y-o.y,b.x-o.x))*180/Math.PI;if(g>180)g=360-g;info(`Góc: ${fmA(g)} (${g.toFixed(5)}°)`);this.pts=[]}},
 dyn(g,v,c){dPoly(g,v,[...flat(this.pts),c.x,c.y],false,'#00e5ff')}})});
reg('dobk',{grp:'do',name:'Đo bán kính',ic:'◔',make:()=>({pr:'Chạm đường tròn / cung tròn',dp(p){const h=hitAt(p.x,p.y,tolW(),q=>q.k==='E'||q.k==='A');if(!h)return;const r=h.p.k==='E'?h.p.e[0]:h.p.a[2];info(`Bán kính: ${fm(r/U)} m · Đường kính: ${fm(2*r/U)} m`)}})});
reg('toado',{grp:'do',name:'Xem toạ độ điểm',ic:'⌖',make:()=>({pr:'Nhập điểm cần xem toạ độ (có bắt điểm)',dp(p){const t=toXY(p.x,p.y),s=`X=${fm(t[0])}  Y=${fm(t[1])}`;let ll='';try{const l=toLL(p.x,p.y);ll=` · ${l[0].toFixed(7)}, ${l[1].toFixed(7)} (WGS84)`}catch(e){}info(s+ll);try{navigator.clipboard&&navigator.clipboard.writeText(`${fm(t[0])}\t${fm(t[1])}`)}catch(e){}}})});
// ======= XEM =======
function zoomTo(bb,padPx){const v=V();pushView(v);const w=Math.max(bb[2]-bb[0],1),h=Math.max(bb[3]-bb[1],1);v.cx=(bb[0]+bb[2])/2;v.cy=(bb[1]+bb[3])/2;v.s=Math.min((v.W-2*(padPx||40))/w,(v.H-2*(padPx||40))/h);if(v.s>200)v.s=200;redraw()}
reg('phongto',{grp:'xem',name:'Phóng to',ic:'＋',nodoc:1,now(){const v=V();pushView(v);zoomAt(v,v.W/2,v.H/2,2)}});
reg('thunho',{grp:'xem',name:'Thu nhỏ',ic:'－',nodoc:1,now(){const v=V();pushView(v);zoomAt(v,v.W/2,v.H/2,.5)}});
reg('toanbo',{grp:'xem',name:'Xem toàn bộ',ic:'⤢',now(){fit()}});
reg('cuasophong',{grp:'xem',name:'Phóng theo cửa sổ',ic:'🔍',make:()=>({pr(){return this.pts.length?'Nhập góc đối diện':'Nhập góc thứ nhất vùng cần phóng'},dp(p){if(!this.pts.length){this.pts=[p];return}const a=this.pts[0];zoomTo([Math.min(a.x,p.x),Math.min(a.y,p.y),Math.max(a.x,p.x),Math.max(a.y,p.y)],4);endCmd()},
 dyn(g,v,c){if(this.pts.length){const a=this.pts[0];g.setLineDash([5,4]);dPoly(g,v,[a.x,a.y,c.x,a.y,c.x,c.y,a.x,c.y],true,'#0ff')}}})});
reg('xemtruoc',{grp:'xem',name:'Khung nhìn trước',ic:'⏴',now(){const v=V(),h=v.hist.pop();if(!h)return;v.fut.push([v.cx,v.cy,v.s]);[v.cx,v.cy,v.s]=h;redraw()}});
reg('xemsau',{grp:'xem',name:'Khung nhìn sau',ic:'⏵',now(){const v=V(),h=v.fut.pop();if(!h)return;v.hist.push([v.cx,v.cy,v.s]);[v.cx,v.cy,v.s]=h;redraw()}});
reg('vetinh',{grp:'xem',name:'Ảnh vệ tinh nền',ic:'🛰',nodoc:1,tog:()=>ACT.sat,now(){ACT.sat=!ACT.sat;saveAct();redraw();menuUI();msg(ACT.sat?`Bật ảnh vệ tinh (VN-2000, kinh tuyến trục ${ACT.ktt}°)`:'Tắt ảnh vệ tinh')}});
reg('nen',{grp:'xem',name:'Nền đen / trắng',ic:'◐',nodoc:1,now(){ACT.bg=ACT.bg==='#000000'?'#ffffff':'#000000';saveAct();redraw()}});
reg('luoi',{grp:'xem',name:'Lưới điểm',ic:'⋰',nodoc:1,tog:()=>ACT.grid,async now(){if(!ACT.grid){const r=await form('Lưới điểm',[{k:'g',l:'Bước lưới (m) – khi bật, điểm nhập sẽ bám lưới nếu không bắt được điểm nào',t:'number',v:ACT.gstep}]);if(!r)return;ACT.gstep=+r.g||10}ACT.grid=!ACT.grid;saveAct();redraw();menuUI()}});
reg('cuaso2',{grp:'xem',name:'Chia 2 cửa sổ xem',ic:'◫',desk:1,nodoc:1,tog:()=>VIEWS.length>1,now(){if(VIEWS.length>1){const v=VIEWS.pop();v.el.remove();AV=0}else{const el=document.createElement('div');el.className='vw';el.dataset.v='1';el.innerHTML='<canvas></canvas><span class="vt">Cửa sổ 2</span>';$('views').insertBefore(el,$('hint'));const v=mkView(el);v.cx=V().cx;v.cy=V().cy;v.s=V().s}
 VIEWS.forEach((v,i)=>v.el.classList.toggle('act',i===AV));requestAnimationFrame(resize);menuUI()}});
// ======= LỚP =======
reg('qllop',{grp:'lop',name:'Quản lý lớp',ic:'☰',now:levelMgr});
reg('loptat',{grp:'lop',name:'Tắt lớp theo phần tử',ic:'◌',make:()=>({pr:'Chạm phần tử thuộc lớp cần tắt',dp(p){const h=hitAt(p.x,p.y,tolW());if(h){DOC.lvOff.add(h.p.lv);info('Đã tắt lớp '+h.p.lv);redraw()}}})});
reg('lopchi',{grp:'lop',name:'Chỉ hiện lớp của phần tử',ic:'◉',make:()=>({pr:'Chạm phần tử thuộc lớp cần giữ',dp(p){const h=hitAt(p.x,p.y,tolW());if(h){for(const l of levelsUsed())if(l!==h.p.lv)DOC.lvOff.add(l);info('Chỉ hiện lớp '+h.p.lv);endCmd()}}})});
reg('lopbat',{grp:'lop',name:'Bật tất cả lớp',ic:'●',now(){DOC.lvOff.clear();redraw();msg('Đã bật tất cả lớp')}});
function levelsUsed(){const m=new Map();for(const p of DOC.prims)if(!p.del)m.set(p.lv,(m.get(p.lv)||0)+1);return[...m.keys()].sort((a,b)=>a-b)}
async function levelMgr(){const cnt=new Map();for(const p of DOC.prims)if(!p.del)cnt.set(p.lv,(cnt.get(p.lv)||0)+1);const L=[...new Set([...cnt.keys(),ACT.lv])].sort((a,b)=>a-b);
 const v=await dlg(`<h3>Quản lý lớp</h3><div class="lvtab"><table><tr><th>Hiện</th><th>Khoá</th><th>Lớp</th><th>Tên lớp</th><th>Số phần tử</th><th></th></tr>${L.map(l=>`<tr><td><input type="checkbox" data-on="${l}" ${DOC.lvOff.has(l)?'':'checked'}></td><td><input type="checkbox" data-lk="${l}" ${DOC.lvLock.has(l)?'checked':''}></td><td><b>${l}</b>${l===ACT.lv?' ★':''}</td><td><input data-nm="${l}" value="${M8.esc(ACT.lvNames[l]||'')}" style="width:130px"></td><td>${cnt.get(l)||0}</td><td><button data-act="${l}">Hiện hành</button></td></tr>`).join('')}</table></div>
 <div class="bt"><button data-r="all">Bật hết</button><button data-r="none">Tắt hết</button><button class="p" data-r="ok">Đóng</button></div>`,(b,close)=>{b.querySelectorAll('[data-act]').forEach(x=>x.onclick=()=>{ACT.lv=+x.dataset.act;saveAct();renderAttr();close('ok')})});
 const b=document;if(v==='all')DOC.lvOff.clear();else if(v==='none')for(const l of L)DOC.lvOff.add(l);redraw()}
// lưu trạng thái hộp thoại lớp trước khi đóng (gắn vào sự kiện thay đổi)
document.addEventListener('change',e=>{const t=e.target;if(!DOC)return;if(t.dataset.on){const l=+t.dataset.on;t.checked?DOC.lvOff.delete(l):DOC.lvOff.add(l);redraw()}if(t.dataset.lk){const l=+t.dataset.lk;t.checked?DOC.lvLock.add(l):DOC.lvLock.delete(l)}if(t.dataset.nm!=null){ACT.lvNames[t.dataset.nm]=t.value;saveAct()}});
// ======= TỆP =======
reg('mo',{grp:'tep',name:'Mở bản đồ',ic:'📂',nodoc:1,now:()=>openFile()});
reg('molai',{grp:'tep',name:'Mở lại bản đồ gần nhất',ic:'↻',nodoc:1,async now(){const r=await M8.IDB.get('b:last');if(!r){msg('Chưa có bản đồ mở gần đây');return}openBytes(r.name,r.bytes)}});
reg('phien',{grp:'tep',name:'Khôi phục phiên làm việc',ic:'⟲',nodoc:1,async now(){const s=await M8.IDB.get('b:sess');if(!s){msg('Không có phiên lưu tạm');return}if(!(await confirm_(`Khôi phục bản đồ ${M8.esc(s.name)} lưu tạm lúc ${new Date(s.t).toLocaleString('vi-VN')} (${s.prims.length} phần tử)?`,'Khôi phục')))return;
 NID=0;DOC={name:s.name,fmt:s.fmt,org:s.org,pal:s.pal,prims:s.prims.map(p=>{delete p.id;return norm(p)}),fh:null,dirty:true,lvOff:new Set(),lvLock:new Set()};SEL.clear();UNDO.length=0;REDO.length=0;IDX.dirty=true;$('hint').style.display='none';title();fit();BUS.emit('fileOpened',docInfo())}});
reg('luu',{grp:'tep',name:'Lưu',ic:'💾',now:()=>save(false)});
reg('luuthanh',{grp:'tep',name:'Lưu thành DGN V8…',ic:'🖫',now:()=>save(true)});
reg('xuatdxf',{grp:'tep',name:'Xuất DXF',ic:'⇪',now:exportDXF});
reg('xuatpng',{grp:'tep',name:'Xuất ảnh khung nhìn',ic:'🖼',now:()=>exportPNG(false)});
reg('in',{grp:'tep',name:'In khung nhìn',ic:'🖨',now:()=>exportPNG(true)});
reg('thamchieu',{grp:'tep',name:'Gắn bản đồ tham chiếu',ic:'🔗',now:()=>openFile(true)});
reg('qltc',{grp:'tep',name:'Quản lý tham chiếu',ic:'⛓',async now(){if(!REFS.length){msg('Chưa gắn bản đồ tham chiếu nào');return}const v=await dlg(`<h3>Bản đồ tham chiếu</h3><table>${REFS.map((r,i)=>`<tr><td><label><input type="checkbox" data-rf="${i}" ${r.on?'checked':''}> ${M8.esc(r.name)}</label></td><td>${r.prims.length} phần tử</td><td><button data-r="d${i}">Gỡ</button></td></tr>`).join('')}</table><div class="bt"><button class="p" data-r="ok">Đóng</button></div>`,b=>b.querySelectorAll('[data-rf]').forEach(x=>x.onchange=()=>{REFS[+x.dataset.rf].on=x.checked;IDX.dirty=true;redraw()}));
 if(typeof v==='string'&&v[0]==='d'){REFS.splice(+v.slice(1),1);IDX.dirty=true;redraw()}}});
reg('khoiphuc',{grp:'tep',name:'Khôi phục bản gốc trước khi ghi',ic:'⎌',async now(){const b=await M8.IDB.get('b:bak:'+DOC.name);if(!b){msg('Chưa có bản sao gốc của tệp này');return}if(await confirm_(`Mở lại bản gốc ${M8.esc(DOC.name)} (giữ lúc ${new Date(b.t).toLocaleString('vi-VN')})?`,'Mở bản gốc'))openBytes(DOC.name,b.bytes,DOC.fh)}});
reg('ttep',{grp:'tep',name:'Thông tin bản đồ',ic:'ℹ',now(){const bb=extent(),a=bb?toXY(bb[0],bb[1]):[0,0],b=bb?toXY(bb[2],bb[3]):[0,0],cnt={};for(const p of DOC.prims)if(!p.del)cnt[kname(p)]=(cnt[kname(p)]||0)+1;
 alert_(`<b>${M8.esc(DOC.name)}</b>\nĐịnh dạng: ${M8.esc(DOC.fmt)}\nĐơn vị: mét (1 m = 1000 đơn vị lưu)\nGốc toàn cục: ${DOC.org.map(v=>v.toFixed(0)).join(', ')}\nPhạm vi: X ${fm(a[0],2)} → ${fm(b[0],2)}; Y ${fm(a[1],2)} → ${fm(b[1],2)}\n\n${Object.entries(cnt).map(([k,v])=>k+': '+v).join('\n')}\nSố lớp đang dùng: ${levelsUsed().length}`,'Thông tin bản đồ')}});
reg('moi',{grp:'tep',name:'Bản đồ mới',ic:'🗋',nodoc:1,async now(){const r=await form('Tạo bản đồ mới (DGN V8, đơn vị mét, VN-2000)',[{k:'n',l:'Tên tệp',v:'BanDoMoi.dgn'},{k:'x',l:'Toạ độ X (Bắc) tâm khu vực (m)',t:'number',v:2360000},{k:'y',l:'Toạ độ Y (Đông) tâm khu vực (m)',t:'number',v:560000}]);if(!r)return;
 NID=0;const go=M8.D8SEED.go;DOC={name:/\.dgn$/i.test(r.n)?r.n:r.n+'.dgn',fmt:'DGN V8',org:[go[0],go[1]],pal:null,prims:[],fh:null,dirty:false,lvOff:new Set(),lvLock:new Set()};SEL.clear();UNDO.length=0;REDO.length=0;IDX.dirty=true;$('hint').style.display='none';title();
 const c=fromXY(+r.x,+r.y);for(const v of VIEWS){v.cx=c[0];v.cy=c[1];v.s=v.W/(500*U)}redraw();BUS.emit('fileOpened',docInfo())}});
// ======= THIẾT LẬP =======
reg('tthh',{grp:'tl',name:'Thuộc tính hiện hành',ic:'🖌',nodoc:1,async now(){const r=await form('Thuộc tính hiện hành',[{k:'lv',l:'Lớp',t:'number',v:ACT.lv},{k:'c',l:'Màu (0–255)',t:'number',v:ACT.c},{k:'w',l:'Lực nét (0–31)',t:'number',v:ACT.w},{k:'st',l:'Kiểu đường',t:'select',v:ACT.st,o:LT_NAMES.map((n,i)=>[i,n])},{k:'th',l:'Cao chữ mặc định (m)',t:'number',v:ACT.th}]);if(!r)return;ACT.lv=+r.lv;ACT.c=+r.c;ACT.w=+r.w;ACT.st=+r.st;ACT.th=+r.th;saveAct();renderAttr()}});
reg('batdiem',{grp:'tl',name:'Chế độ bắt điểm',ic:'🧲',nodoc:1,async now(){const f=Object.entries(SNAPN).filter(([k])=>k!=='grid').map(([k,n])=>({k,l:n,t:'check',v:ACT.snap.has(k)}));
 const r=await form('Chế độ bắt điểm tự động',[{k:'on',l:'Bật bắt điểm tự động',t:'check',v:ACT.snapOn},...f,{k:'px',l:'Bán kính bắt (điểm ảnh màn hình)',t:'number',v:ACT.snapPx},{k:'ax',l:'Khoá trục (vẽ ngang/dọc khi không bắt điểm)',t:'check',v:ACT.axis}]);if(!r)return;
 ACT.snapOn=r.on;ACT.snap=new Set(Object.keys(SNAPN).filter(k=>r[k]));ACT.snapPx=Math.max(4,+r.px||12);ACT.axis=r.ax;saveAct();renderSnap()}});
reg('htvn',{grp:'tl',name:'Hệ toạ độ & ảnh nền',ic:'🌐',nodoc:1,async now(){const r=await form('Hệ toạ độ VN-2000 (để đặt ảnh vệ tinh, đổi sang kinh/vĩ độ)',[{k:'ktt',l:'Kinh tuyến trục (độ) – ví dụ Phú Thọ (cũ) 104,75; Vĩnh Phúc (cũ) 105; Hà Nội 105',t:'number',v:ACT.ktt},{k:'k0',l:'Hệ số k0 (múi 3° = 0,9999)',t:'number',v:ACT.k0},{k:'op',l:'Độ đậm ảnh nền (0–1)',t:'number',v:ACT.satOp},{k:'dec',l:'Số lẻ khi hiện toạ độ',t:'number',v:ACT.dec}]);if(!r)return;
 ACT.ktt=+r.ktt;ACT.k0=+r.k0;ACT.satOp=Math.max(0,Math.min(1,+r.op));ACT.dec=Math.max(0,Math.min(6,+r.dec|0));saveAct();TILES.clear();redraw()}});
reg('phimtat',{grp:'tl',name:'Phím tắt (máy tính)',ic:'⌨',desk:1,nodoc:1,now(){alert_(`Chuột trái: nhập điểm · Chuột phải / Esc: đặt lại (kết thúc lệnh)\nCuộn chuột: phóng to/thu nhỏ · Giữ chuột giữa hoặc Phím cách + kéo: dịch khung nhìn\nKéo chuột trái khi không có lệnh: chọn theo cửa sổ (kéo sang phải: nằm trọn; sang trái: chạm)\nCtrl+Z / Ctrl+Y: hoàn tác / làm lại · Ctrl+S: lưu · Delete: xoá phần tử chọn\nCtrl+A: chọn tất cả · F: xem toàn bộ · Enter ở dòng lệnh: thực hiện lệnh\nGõ thẳng tên lệnh (không dấu) vào dòng lệnh, ví dụ: doan, gapkhuc, vung, xoa, dichuyen, td=X,Y, pv=khoảng cách,phương vị`,'Phím tắt')}});
reg('gioithieu',{grp:'tl',name:'Giới thiệu',ic:'©',nodoc:1,now(){alert_(`<b>M8 Pro Bản đồ ${VER}</b>\nTrình biên tập bản đồ số địa chính chạy trên điện thoại và máy tính.\nĐọc/ghi DGN V8, đọc DGN V7 và DXF; xuất DXF.\nKết hợp với ứng dụng <b>M8 Pro Địa chính</b> (menu 🏠 Địa chính).\n\nTác giả, bản quyền: <b>Nguyễn Xuân Thủy</b> – ĐT 0972839747`,'Giới thiệu')}});
// ======= CÔNG CỤ =======
reg('nhapcx',{grp:'cc',name:'Nhập điểm chính xác',ic:'⌨',nodoc:1,tog:()=>$('pin').style.display==='flex',now(){const e=$('pin');e.style.display=e.style.display==='flex'?'none':'flex';renderPin();menuUI();requestAnimationFrame(resize)}});
reg('dong',{grp:'cc',name:'Dòng lệnh',ic:'›_',nodoc:1,tog:()=>$('kin').style.display==='flex',now(){const e=$('kin');e.style.display=e.style.display==='flex'?'none':'flex';menuUI();requestAnimationFrame(resize);if(e.style.display==='flex')$('kinI').focus()}});
reg('thongke',{grp:'cc',name:'Thống kê phần tử theo lớp',ic:'∑',now(){const m=new Map();for(const p of DOC.prims){if(p.del)continue;const o=m.get(p.lv)||{n:0,L:0,S:0,T:0,E:0,len:0};o.n++;o[p.k==='A'?'E':p.k]++;if(p.p)o.len+=GEO.len(p.p);m.set(p.lv,o)}
 alert_(`<table><tr><th>Lớp</th><th>Tổng</th><th>Đường</th><th>Vùng</th><th>Chữ</th><th>Tròn/cung</th><th>Dài (m)</th></tr>${[...m].sort((a,b)=>a[0]-b[0]).map(([l,o])=>`<tr><td>${l}</td><td>${o.n}</td><td>${o.L}</td><td>${o.S}</td><td>${o.T}</td><td>${o.E}</td><td>${fm(o.len/U,1)}</td></tr>`).join('')}</table>`,'Thống kê phần tử')}});
reg('donrac',{grp:'cc',name:'Dọn phần tử rỗng, trùng',ic:'🧹',async now(){const seen=new Map();let z=0,d=0;const kill=[];
 for(const p of DOC.prims){if(p.del)continue;if(p.k==='T'&&!String(p.s).trim()){kill.push(p);z++;continue}if(p.p&&p.p.length>4&&GEO.len(p.p)===0){kill.push(p);z++;continue}
  const key=p.k+'|'+p.lv+'|'+(p.p?p.p.map(v=>Math.round(v)).join(','):p.e?p.e.map(v=>Math.round(v)).join(','):p.a?p.a.join(','):p.x+','+p.y+','+p.s);if(seen.has(key)){kill.push(p);d++}else seen.set(key,p)}
 if(!kill.length){msg('Không có phần tử rỗng hoặc trùng');return}if(await confirm_(`Tìm thấy ${z} phần tử rỗng, ${d} phần tử trùng hệt nhau. Xoá?`,'Xoá'))tx('Dọn phần tử',()=>kill.forEach(delP))}});
reg('diachinh',{grp:'cc',name:'Nạp ứng dụng Địa chính',ic:'🏠',nodoc:1,now:()=>dockOpen()});
// ================= MENU =================
const GROUPS=[['tep','Tệp'],['xem','Xem'],['ve','Vẽ'],['sua','Sửa'],['hr','Hàng rào'],['do','Đo'],['lop','Lớp'],['tl','Thiết lập'],['cc','Công cụ']];
let OPEN=null;
function buildMenu(){const m=$('menu');m.innerHTML='';for(const[k,n]of GROUPS){const b=document.createElement('button');b.textContent=n+' ▾';b.dataset.g=k;b.onclick=()=>{OPEN=OPEN===k?null:k;renderSub()};m.appendChild(b)}
 const sb=document.createElement('button');sb.id='bSnap';sb.title='Bật/tắt bắt điểm tự động';sb.onclick=()=>{ACT.snapOn=!ACT.snapOn;saveAct();renderSnap()};m.appendChild(sb);renderSnap()}
function renderSub(){const s=$('sub');s.innerHTML='';if(!OPEN){s.style.display='none';menuUI();return}s.style.display='flex';
 for(const c of Object.values(CMDS)){if(c.grp!==OPEN||(c.desk&&!DESK))continue;const b=document.createElement('button');b.textContent=(c.ic?c.ic+' ':'')+c.name;b.dataset.c=c.id;b.onclick=()=>{startCmd(c.id);if(!['sua','do'].includes(OPEN)||c.now){OPEN=null;renderSub()}else menuUI()};s.appendChild(b)}menuUI()}
function menuUI(){document.querySelectorAll('#menu [data-g]').forEach(b=>{b.classList.toggle('open',b.dataset.g===OPEN);b.classList.toggle('on',!!(CMD&&CMDS[CMD.id]&&CMDS[CMD.id].grp===b.dataset.g))});
 document.querySelectorAll('#sub [data-c],#pal [data-c]').forEach(b=>{const c=CMDS[b.dataset.c];b.classList.toggle('on',(CMD&&CMD.id===b.dataset.c)||(c.tog&&c.tog()))})}
function renderSnap(){const b=$('bSnap');if(b){b.textContent='🧲 '+(ACT.snapOn?[...ACT.snap].map(k=>({end:'Đỉnh',mid:'Giữa',cen:'Tâm',int:'Giao',near:'Gần',perp:'Vuông'}[k])).filter(Boolean).join('·'):'Tắt bắt điểm');b.classList.toggle('on',ACT.snapOn)}}
// hộp công cụ (máy tính)
function buildPal(){const P=$('pal');const L=[['chon','dichuyen','saochep','xoay','tile','doixung','xoa'],['doan','gapkhuc','vung','chunhat','tron','cung','chu','ghikt','kyhieu'],['songsong','catxen','keodai','giao2','chat','suadinh','themdinh','xoadinh','noi'],['dokc','dodt','toado','thongtin'],['cuasophong','toanbo']];
 P.innerHTML='';L.forEach((g,i)=>{if(i)P.appendChild(document.createElement('hr'));for(const id of g){const c=CMDS[id];const b=document.createElement('button');b.textContent=c.ic||'?';b.title=c.name;b.dataset.c=id;b.onclick=()=>startCmd(id);P.appendChild(b)}})}
// thanh thiết lập lệnh
function renderTS(){const t=$('ts');if(!CMD||!CMD.opts){t.style.display='none';t.innerHTML='';requestAnimationFrame(resize);return}t.style.display='flex';
 t.innerHTML='<b>'+M8.esc(CMD.name)+':</b> '+CMD.opts.map(f=>f.t==='check'?`<label><input type="checkbox" data-o="${f.k}" ${CMD.o[f.k]?'checked':''}>${f.l}</label>`:f.t==='select'?`<label>${f.l} <select data-o="${f.k}">${f.o.map(o=>`<option value="${o[0]}" ${String(o[0])===String(CMD.o[f.k])?'selected':''}>${o[1]}</option>`).join('')}</select></label>`:`<label>${f.l} <input type="${f.t}" step="any" data-o="${f.k}" value="${M8.esc(CMD.o[f.k])}"></label>`).join(' ');
 t.querySelectorAll('[data-o]').forEach(i=>{const up=()=>{CMD.o[i.dataset.o]=i.type==='checkbox'?i.checked:i.value;try{localStorage.setItem(OPTK(CMD.id),JSON.stringify(CMD.o))}catch(e){}if(CMD.id==='chon')SELADD=!!CMD.o.add;upPrompt();redraw()};i.oninput=up;i.onchange=up});requestAnimationFrame(resize)}
// thanh thuộc tính hiện hành
function renderAttr(){const a=$('attr');a.innerHTML=`<label>Lớp <input type="number" id="aLv" value="${ACT.lv}" min="0"></label><label>Màu <span class="sw" style="background:${colOf(ACT.c)}"></span><input type="number" id="aC" value="${ACT.c}" min="0" max="255"></label>
 <label>Nét <input type="number" id="aW" value="${ACT.w}" min="0" max="31"></label><label>Kiểu <select id="aSt">${LT_NAMES.map((n,i)=>`<option value="${i}" ${i===ACT.st?'selected':''}>${n}</option>`).join('')}</select></label><label>Chữ cao <input type="number" id="aTh" value="${ACT.th}" step="any"> m</label>`;
 const up=()=>{ACT.lv=+$('aLv').value;ACT.c=+$('aC').value;ACT.w=+$('aW').value;ACT.st=+$('aSt').value;ACT.th=+$('aTh').value||ACT.th;saveAct();a.querySelector('.sw').style.background=colOf(ACT.c)};a.querySelectorAll('input,select').forEach(i=>i.onchange=up)}
// nhập điểm chính xác
function renderPin(){const e=$('pin');if(e.innerHTML)return;e.innerHTML=`<b>Nhập điểm:</b><select id="pM"><option value="xy">Toạ độ X (Bắc), Y (Đông)</option><option value="pv">Khoảng cách + Phương vị từ điểm trước</option><option value="d">ΔX, ΔY từ điểm trước</option></select>
 <input id="pA" type="number" step="any" placeholder="X / khoảng cách / ΔX"><input id="pB" type="number" step="any" placeholder="Y / phương vị (độ) / ΔY"><button class="p" id="pGo">Nhập điểm</button>`;
 $('pGo').onclick=()=>{const m=$('pM').value,a=+$('pA').value,b=+$('pB').value,L=lastPt();if(!isFinite(a)||!isFinite(b))return;let p;
  if(m==='xy'){const q=fromXY(a,b);p={x:q[0],y:q[1]}}else{if(!L){msg('Chưa có điểm trước');return}if(m==='pv'){const az=b*Math.PI/180;p={x:L[0]+a*U*Math.sin(az),y:L[1]+a*U*Math.cos(az)}}else p={x:L[0]+b*U,y:L[1]+a*U}}
  if(!CMD){msg('Hãy chọn lệnh vẽ trước');return}CUR=p;dataPoint(p)}}
// dòng lệnh
const KEYIN={'?':'trợ giúp'};
function keyin(s){s=s.trim();if(!s)return;const n=s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/đ/g,'d');let m;
 const pt=(x,y)=>{if(!CMD){msg('Hãy chọn lệnh trước khi nhập toạ độ');return}const p={x,y};CUR=p;dataPoint(p)};
 if(m=n.match(/^td\s*=\s*(-?[\d.]+)\s*[,; ]\s*(-?[\d.]+)/)){const q=fromXY(+m[1],+m[2]);return pt(q[0],q[1])}
 if(m=n.match(/^xy\s*=\s*(-?[\d.]+)\s*[,; ]\s*(-?[\d.]+)/)){const q=fromXY(+m[2],+m[1]);return pt(q[0],q[1])}
 if(m=n.match(/^dl\s*=\s*(-?[\d.]+)\s*[,; ]\s*(-?[\d.]+)/)){const L=lastPt();if(!L)return msg('Chưa có điểm trước');return pt(L[0]+m[1]*U,L[1]+m[2]*U)}
 if(m=n.match(/^(pv|di)\s*=\s*(-?[\d.]+)\s*[,; ]\s*(-?[\d.]+)/)){const L=lastPt();if(!L)return msg('Chưa có điểm trước');const a=(+m[3])*Math.PI/180,d=+m[2]*U;return m[1]==='pv'?pt(L[0]+d*Math.sin(a),L[1]+d*Math.cos(a)):pt(L[0]+d*Math.cos(a),L[1]+d*Math.sin(a))}
 if(m=n.match(/^(lop|lv|mau|co|net|wt|kieu|lc|cao|th)\s*=\s*([\d.]+)/)){const k={lop:'lv',lv:'lv',mau:'c',co:'c',net:'w',wt:'w',kieu:'st',lc:'st',cao:'th',th:'th'}[m[1]];ACT[k]=+m[2];saveAct();renderAttr();return msg('Đã đặt '+m[1]+' = '+m[2])}
 if(n==='?'||n==='help'||n==='trogiup'){return alert_(`<b>Nhập điểm:</b> td=X,Y (toạ độ địa chính X Bắc, Y Đông) · xy=Đông,Bắc · dl=ΔĐông,ΔBắc · pv=khoảng cách,phương vị · di=khoảng cách,góc (từ trục Đông, ngược kim đồng hồ)
<b>Thuộc tính:</b> lop=10 · mau=3 · net=2 · kieu=1 · cao=2.5
<b>Lệnh:</b> ${Object.values(CMDS).map(c=>c.id+' ('+c.name+')').join(' · ')}
<b>Khác:</b> hoantac · lamlai · luu · thoat`,'Dòng lệnh')}
 if(n==='hoantac'||n==='undo')return undo();if(n==='lamlai'||n==='redo')return redo();if(n==='thoat'||n==='esc')return endCmd();
 const id=n.replace(/\s+/g,'');if(CMDS[id])return startCmd(id);const c=Object.values(CMDS).find(c=>c.name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/đ/g,'d').replace(/\s+/g,'').startsWith(id));if(c)return startCmd(c.id);msg('Không hiểu lệnh: '+s)}
$('kinGo').onclick=()=>{keyin($('kinI').value);$('kinI').select()};$('kinI').onkeydown=e=>{if(e.key==='Enter'){keyin(e.target.value);e.target.select()}else if(e.key==='Escape'){e.target.blur();resetPt()}};
// ================= NHẬP LIỆU CHUỘT / CẢM ỨNG =================
function bindView(v){const c=v.cv,P=new Map();let mv=0,pinch=null,lp=0,down=null,box=null,space=false;
 const rel=e=>{const r=c.getBoundingClientRect();return[e.clientX-r.left,e.clientY-r.top]};
 c.addEventListener('pointerdown',e=>{c.setPointerCapture(e.pointerId);const q=rel(e);P.set(e.pointerId,q);if(AV!==VIEWS.indexOf(v)){AV=VIEWS.indexOf(v);VIEWS.forEach((x,i)=>x.el.classList.toggle('act',i===AV))}
  if(P.size===2){const[a,b]=[...P.values()];pinch={d:Math.hypot(a[0]-b[0],a[1]-b[1]),m:[(a[0]+b[0])/2,(a[1]+b[1])/2],s:v.s,cx:v.cx,cy:v.cy};clearTimeout(lp);down=null;return}
  down={x:q[0],y:q[1],b:e.button,t:e.pointerType,cx:v.cx,cy:v.cy,sh:e.shiftKey||e.ctrlKey};mv=0;
  if(e.pointerType==='touch'){clearTimeout(lp);lp=setTimeout(()=>{if(down&&mv<8){down=null;navigator.vibrate&&navigator.vibrate(30);resetPt();msg('Đặt lại')}},650)}});
 c.addEventListener('pointermove',e=>{const q=rel(e);if(P.has(e.pointerId))P.set(e.pointerId,q);
  if(pinch&&P.size===2){const[a,b]=[...P.values()],d=Math.hypot(a[0]-b[0],a[1]-b[1]),m=[(a[0]+b[0])/2,(a[1]+b[1])/2];v.s=pinch.s*d/pinch.d;const wx0=(pinch.m[0]-v.W/2)/pinch.s+pinch.cx,wy0=(v.H/2-pinch.m[1])/pinch.s+pinch.cy;v.cx=wx0-(m[0]-v.W/2)/v.s;v.cy=wy0-(v.H/2-m[1])/v.s;redraw();return}
  if(down){const dx=q[0]-down.x,dy=q[1]-down.y;mv=Math.max(mv,Math.hypot(dx,dy));
   const pan=down.t==='touch'||down.b===1||space||(down.b===0&&CMD&&!['chonvung','hrchunhat','cuasophong'].includes(CMD.id));
   if(mv>6&&pan){v.cx=down.cx-dx/v.s;v.cy=down.cy+dy/v.s;redraw();if(ACT.cross)crossMove(v);return}
   if(mv>6&&down.b===0&&!CMD){box={a:[down.x,down.y],b:q};redraw();drawBox(v,box)}}
  if(e.pointerType!=='touch'&&!down){const s=snapAt(v,q[0],q[1],lastPt());SNAP=s.t?s:null;CUR={x:s.x,y:s.y};const t=toXY(s.x,s.y);$('xy').textContent=`X=${fm(t[0])} Y=${fm(t[1])}`;$('sn').textContent=s.t?SNAPN[s.t]:'';redraw()}});
 const up=e=>{clearTimeout(lp);const q=rel(e);P.delete(e.pointerId);if(pinch){if(P.size<2)pinch=null;down=null;return}if(!down)return;const d=down;down=null;
  if(box){const a=[wx(v,box.a[0]),wy(v,box.a[1])],b=[wx(v,box.b[0]),wy(v,box.b[1])];const mode=box.b[0]>=box.a[0]?'in':'ov';box=null;if(!d.sh)SEL.clear();const n=selInPoly([a[0],a[1],b[0],a[1],b[0],b[1],a[0],b[1]],mode);prompt_(`Đã chọn ${SEL.size} phần tử`);redraw();return}
  if(mv>6)return;if(d.b===2){resetPt();return}if(d.b===1)return;
  const s=snapAt(v,q[0],q[1],lastPt());SNAP=s.t?s:null;CUR={x:s.x,y:s.y};const t=toXY(s.x,s.y);$('xy').textContent=`X=${fm(t[0])} Y=${fm(t[1])}`;$('sn').textContent=s.t?SNAPN[s.t]:'';
  if(d.t==='touch'&&CMD&&ACT.cross){redraw();return}dataPoint({x:s.x,y:s.y,t:s.t})};
 c.addEventListener('pointerup',up);c.addEventListener('pointercancel',e=>{P.delete(e.pointerId);pinch=null;down=null;box=null});
 c.addEventListener('contextmenu',e=>e.preventDefault());
 c.addEventListener('wheel',e=>{e.preventDefault();const q=rel(e);zoomAt(v,q[0],q[1],e.deltaY<0?1.25:0.8)},{passive:false});
 window.addEventListener('keydown',e=>{if(e.code==='Space'&&e.target===document.body){space=true;e.preventDefault()}});window.addEventListener('keyup',e=>{if(e.code==='Space')space=false})}
function drawBox(v,b){const g=v.g;g.save();g.setLineDash(b.b[0]>=b.a[0]?[]:[6,4]);g.strokeStyle='#00ffd0';g.strokeRect(b.a[0],b.a[1],b.b[0]-b.a[0],b.b[1]-b.a[1]);g.restore()}
// tâm ngắm (điện thoại): điểm nhập = giữa màn hình
function crossMove(v){const s=snapAt(v,v.W/2,v.H/2,lastPt());SNAP=s.t?s:null;CUR={x:s.x,y:s.y};const t=toXY(s.x,s.y);$('xy').textContent=`X=${fm(t[0])} Y=${fm(t[1])}`;$('sn').textContent=s.t?SNAPN[s.t]:''}
$('fOk').onclick=()=>{const v=V();if(ACT.cross){crossMove(v);dataPoint({...CUR,t:SNAP&&SNAP.t})}else if(CUR)dataPoint({...CUR});else msg('Chạm bản đồ để nhập điểm, hoặc bật ⌖ tâm ngắm')};
$('fRs').onclick=()=>resetPt();
$('fCr').onclick=()=>{ACT.cross=!ACT.cross;$('cross').style.display=ACT.cross?'block':'none';$('fCr').classList.toggle('on',ACT.cross);if(ACT.cross){crossMove(V());msg('Tâm ngắm: dịch bản đồ cho điểm cần nhập vào giữa dấu +, rồi bấm ✓')}redraw()};
$('fFit').onclick=()=>fit();
window.addEventListener('keydown',e=>{if(e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA'||e.target.tagName==='SELECT'||$('dlg').style.display==='flex')return;const k=e.key.toLowerCase();
 if(e.key==='Escape'){resetPt();return}if((e.ctrlKey||e.metaKey)&&k==='z'){e.preventDefault();undo();return}if((e.ctrlKey||e.metaKey)&&k==='y'){e.preventDefault();redo();return}
 if((e.ctrlKey||e.metaKey)&&k==='s'){e.preventDefault();save(false);return}if((e.ctrlKey||e.metaKey)&&k==='a'){e.preventDefault();startCmd('chontatca');return}
 if(e.key==='Delete'&&SEL.size){startCmd('xoa');return}if(k==='f'&&!e.ctrlKey){fit();return}
 if(DESK&&e.key.length===1&&/[a-z0-9?=]/i.test(e.key)&&!e.ctrlKey&&!e.altKey){$('kin').style.display='flex';$('kinI').focus()}});
// kéo thả tệp
document.addEventListener('dragover',e=>e.preventDefault());document.addEventListener('drop',async e=>{e.preventDefault();const f=e.dataTransfer.files[0];if(f)openBytes(f.name,new Uint8Array(await f.arrayBuffer()))});
window.addEventListener('beforeunload',e=>{if(DOC&&DOC.dirty){autosave();e.preventDefault();e.returnValue=''}});
$('bUndo').onclick=undo;$('bRedo').onclick=redo;$('bSave').onclick=()=>save(false);
// ================= KẾT NỐI VỚI ỨNG DỤNG ĐỊA CHÍNH =================
const BUS=new M8.Bus('bando');
const ser=p=>{const o={id:p.id,k:p.k,lv:p.lv,c:p.c,w:p.w,st:p.st};for(const k of['p','e','a'])if(p[k])o[k]=p[k].slice();if(p.k==='T')Object.assign(o,{x:p.x,y:p.y,h:p.h,r:p.r||0,s:p.s,tw:p.tw});if(p.g){o.g=p.g;o.gn=p.gn}return o};
const docInfo=()=>DOC?{name:DOC.name,fmt:DOC.fmt,org:DOC.org,n:DOC.prims.filter(p=>!p.del).length,levels:levelsUsed(),act:{lv:ACT.lv,c:ACT.c,w:ACT.w,st:ACT.st,th:ACT.th},ktt:ACT.ktt,k0:ACT.k0,dirty:DOC.dirty}:null;
const byId=id=>DOC.prims.find(p=>p.id===id&&!p.del);
BUS.handle('hello',()=>({app:'M8 Pro Bản đồ',ver:VER,doc:docInfo(),desk:DESK}));
BUS.handle('getElements',a=>{if(!DOC)throw new Error('Chưa mở bản đồ');a=a||{};const L=a.levels?new Set(a.levels):null,K=a.kinds?new Set(a.kinds):null;let ps=DOC.prims.filter(p=>!p.del&&(!L||L.has(p.lv))&&(!K||K.has(p.k)));
 if(a.bbox){const b=a.bbox;ps=ps.filter(p=>{const q=bbOf(p);return q[2]>=b[0]&&q[0]<=b[2]&&q[3]>=b[1]&&q[1]<=b[3]})}if(a.selected)ps=ps.filter(p=>SEL.has(p));return ps.map(ser)});
BUS.handle('applyEdits',a=>{if(!DOC)throw new Error('Chưa mở bản đồ');const ids=[];tx(a.label||'Địa chính',()=>{for(const id of a.del||[]){const p=byId(id);if(p)delP(p)}for(const m of a.mod||[]){const p=byId(m.id);if(p)modP(p,x=>{for(const k in m)if(k!=='id')x[k]=m[k]})}for(const e of a.add||[]){const q={...e};delete q.id;if(q.k==='T'&&!q.fid)q.fid=ACT.font;ids.push(addP(q).id)}});redraw();return ids});
BUS.handle('overlay',a=>{if(a.items)OVL.set(a.key,{items:a.items});else OVL.delete(a.key);redraw();return true});
BUS.handle('zoomTo',a=>{if(a.bbox)zoomTo(a.bbox,a.pad||60);else if(a.x!=null){const v=V();pushView(v);v.cx=a.x;v.cy=a.y;if(a.s)v.s=a.s;redraw()}return true});
BUS.handle('status',a=>{info(a.text);return true});
BUS.handle('select',a=>{SEL.clear();for(const id of a.ids||[]){const p=byId(id);if(p)SEL.add(p)}redraw();return SEL.size});
BUS.handle('save',()=>save(false));
BUS.handle('setActive',a=>{Object.assign(ACT,a);saveAct();renderAttr();return true});
BUS.handle('viewBox',()=>{const v=V();return[wx(v,0),wy(v,v.H),wx(v,v.W),wy(v,0)]});
// lấy điểm / đường / phần tử từ người dùng trên bản đồ (ứng dụng Địa chính đang chờ)
function askMap(kind,a){return new Promise((ok,no)=>{if(!DOC)return no(new Error('Chưa mở bản đồ'));if(!DESK)dockMini(true);endCmd(true);
 let fin=false;const done=(v,err)=>{if(fin)return;fin=true;CMD=null;HL=null;renderTS();upPrompt();menuUI();redraw();if(!DESK)dockMini(false);err?no(new Error(err)):ok(v)};
 CMD={id:'_ask',name:'Địa chính',pts:[],pr:a.prompt||'Nhập điểm',end(){done(null,'Đã huỷ')},
  dp(p){if(kind==='point')return done({x:p.x,y:p.y,t:p.t||null});if(kind==='element'){const L=a.levels?new Set(a.levels):null;const h=hitAt(p.x,p.y,tolW(),q=>!q.ref&&(!L||L.has(q.lv))&&(!a.kinds||a.kinds.includes(q.k)));if(h)return done(ser(h.p));msg('Không có phần tử phù hợp ở đây');return}
   this.pts.push(p);if(a.n&&this.pts.length>=a.n)done(flat(this.pts))},
  rs(){if(kind==='line'&&this.pts.length>=2){done(flat(this.pts));return}done(null,'Đã huỷ');},
  dyn(g,v,c){if(kind==='line'&&this.pts.length)dPoly(g,v,[...flat(this.pts),c.x,c.y],false,'#ff8800');if(kind==='rect'&&this.pts.length){const q=this.pts[0];dPoly(g,v,[q.x,q.y,c.x,q.y,c.x,c.y,q.x,c.y],true,'#ff8800')}}};
 if(kind==='rect')a.n=2;upPrompt();msg(a.prompt||'Nhập điểm trên bản đồ',3500);redraw()})}
BUS.handle('pickPoint',a=>askMap('point',a||{}));
BUS.handle('pickElement',a=>askMap('element',a||{}));
BUS.handle('pickLine',a=>askMap('line',Object.assign({prompt:'Vẽ đường (Đặt lại: kết thúc)'},a||{})));
BUS.handle('pickRect',a=>askMap('rect',a||{}));
// khung Địa chính gắn trong cửa sổ Bản đồ
function dockOpen(){const d=$('dock'),f=$('dFrame');if(d.style.display==='flex'){d.style.display='none';requestAnimationFrame(resize);return}d.style.display='flex';d.classList.remove('mini');
 if(!f.src){f.src='diachinh.html?embed=1';f.onload=()=>{BUS.win=f.contentWindow}}else BUS.win=f.contentWindow;requestAnimationFrame(resize)}
function dockMini(on){const d=$('dock');if(d.style.display!=='flex')return;d.classList.toggle('mini',on);$('dMin').textContent=on?'▴':'▾'}
$('bDc').onclick=dockOpen;$('dClose').onclick=()=>{$('dock').style.display='none';requestAnimationFrame(resize)};$('dMin').onclick=()=>dockMini(!$('dock').classList.contains('mini'));
$('dWin').onclick=()=>{$('dock').style.display='none';requestAnimationFrame(resize);const w=window.open('diachinh.html','m8pro_dc','width=520,height=820');if(!w)msg('Trình duyệt chặn mở cửa sổ mới');};
// ================= KHỞI ĐỘNG =================
mkView(document.querySelector('.vw'));buildMenu();buildPal();renderAttr();renderSub();upPrompt();title();
window.addEventListener('resize',()=>requestAnimationFrame(resize));new ResizeObserver(()=>requestAnimationFrame(resize)).observe($('views'));resize();
if(!DESK&&!ACT.crossInit){/* gợi ý tâm ngắm cho điện thoại */}
BUS.emit('mapReady',{});
(async()=>{const q=new URLSearchParams(location.search);if(q.get('app')==='diachinh')dockOpen();
 const s=await M8.IDB.get('b:sess');if(s&&s.dirty&&!DOC){const b=document.createElement('button');b.textContent='⟲ Khôi phục phiên: '+s.name;b.className='p';b.onclick=()=>{b.remove();startCmd('phien')};$('menu').prepend(b)}})();
