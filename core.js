/* M8 Pro – lõi dùng chung: đọc/ghi DGN V8, DGN V7, DXF; chuyển đổi VN-2000; tệp thuộc tính .gtp; hình học; kênh kết nối Bản đồ ⇄ Địa chính. © Nguyễn Xuân Thủy */
(function(G){'use strict';
async function inflate(u){const ds=new DecompressionStream('deflate'),w=ds.writable.getWriter();w.write(u);w.close();return new Uint8Array(await new Response(ds.readable).arrayBuffer());}
const cat=a=>{let n=0;for(const x of a)n+=x.length;const o=new Uint8Array(n);let p=0;for(const x of a){o.set(x,p);p+=x.length}return o};
function readOLE(buf){
 if(![0xD0,0xCF,0x11,0xE0].every((b,i)=>buf[i]===b))return null;
 const dv=new DataView(buf.buffer,buf.byteOffset,buf.byteLength),u32=(v,o)=>v.getUint32(o,true);
 const ss=1<<dv.getUint16(30,true),mss=1<<dv.getUint16(32,true),nfat=u32(dv,44),dirS=u32(dv,48),cut=u32(dv,56),mfS=u32(dv,60);
 let dif=u32(dv,68),nd=u32(dv,72);
 const sec=n=>buf.subarray(512+n*ss,512+(n+1)*ss),V=b=>new DataView(b.buffer,b.byteOffset,b.byteLength);
 let fs=[];for(let i=0;i<109;i++)fs.push(u32(dv,76+i*4));
 while(dif<0xFFFFFFFA&&nd-->0){const v=V(sec(dif)),n=ss/4;for(let i=0;i<n-1;i++)fs.push(u32(v,i*4));dif=u32(v,(n-1)*4)}
 fs=fs.filter(x=>x<0xFFFFFFFA).slice(0,nfat);
 const fat=[];for(const f of fs){const v=V(sec(f));for(let i=0;i<ss/4;i++)fat.push(u32(v,i*4))}
 const chain=n=>{const p=[],s=new Set();while(n<0xFFFFFFFA&&!s.has(n)){s.add(n);p.push(sec(n));n=fat[n]}return cat(p)};
 const dd=chain(dirS),dV=V(dd),E=[];
 for(let i=0;i<dd.length/128;i++){const o=i*128,nl=dV.getUint16(o+64,true);
  E.push({name:new TextDecoder('utf-16le').decode(dd.subarray(o,o+Math.max(nl-2,0))),type:dd[o+66],l:u32(dV,o+68),r:u32(dV,o+72),c:u32(dV,o+76),start:u32(dV,o+116),size:u32(dV,o+120)})}
 const ms=E[0].start<0xFFFFFFFA?chain(E[0].start).subarray(0,E[0].size):new Uint8Array(0);
 let mf=[];if(mfS<0xFFFFFFFA){const b=chain(mfS),v=V(b);for(let i=0;i<b.length/4;i++)mf.push(u32(v,i*4))}
 const read=e=>{if(e.size<cut){const p=[];let n=e.start;while(n<0xFFFFFFFA){p.push(ms.subarray(n*mss,(n+1)*mss));n=mf[n]}return cat(p).subarray(0,e.size)}return chain(e.start).subarray(0,e.size)};
 const files={};
 const walk=(i,path)=>{const go=j=>{if(j===0xFFFFFFFF)return;go(E[j].l);const k=E[j],p=path+'/'+k.name;if(k.type===2)files[p]=k;else if(k.type===1)walk(j,p);go(E[j].r)};go(E[i].c)};
 walk(0,'');
 return{files,read};
}
async function dec(u){if(u[0]===0x78)return inflate(u);if(u.length>17&&u[16]===0x78)return inflate(u.subarray(16));return null}
const TC='ĂÂÊÔƠƯĐăâêôơưđ'; // 0xA1..0xAE
const TL={0xB5:'à',0xB6:'ả',0xB7:'ã',0xB8:'á',0xB9:'ạ',0xBB:'ằ',0xBC:'ẳ',0xBD:'ẵ',0xBE:'ắ',0xC6:'ặ',0xC7:'ầ',0xC8:'ẩ',0xC9:'ẫ',0xCA:'ấ',0xCB:'ậ',0xCC:'è',0xCE:'ẻ',0xCF:'ẽ',0xD0:'é',0xD1:'ẹ',0xD2:'ề',0xD3:'ể',0xD4:'ễ',0xD5:'ế',0xD6:'ệ',0xD7:'ì',0xD8:'ỉ',0xDC:'ĩ',0xDD:'í',0xDE:'ị',0xDF:'ò',0xE1:'ỏ',0xE2:'õ',0xE3:'ó',0xE4:'ọ',0xE5:'ồ',0xE6:'ổ',0xE7:'ỗ',0xE8:'ố',0xE9:'ộ',0xEA:'ờ',0xEB:'ở',0xEC:'ỡ',0xED:'ớ',0xEE:'ợ',0xEF:'ù',0xF1:'ủ',0xF2:'ũ',0xF3:'ú',0xF4:'ụ',0xF5:'ừ',0xF6:'ử',0xF7:'ữ',0xF8:'ứ',0xF9:'ự',0xFA:'ỳ',0xFB:'ỷ',0xFC:'ỹ',0xFD:'ý',0xFE:'ỵ'};
function tcvn(b){let s='';for(const c of b){s+=c>=0xA1&&c<=0xAE?TC[c-0xA1]:TL[c]||String.fromCharCode(c)}return s}
function dtxt(sb,hi){if(sb[0]===255&&sb[1]===254){const r=sb.subarray(2);if(r[0]===1&&r[1]===0)return tcvn(r.subarray(2));let u=r.length%2===0;if(u)for(let i=1;i<r.length;i+=2)if(r[i]>0x33){u=false;break}return u?new TextDecoder('utf-16le').decode(r):tcvn(r.subarray(2))}return hi?tcvn(sb):new TextDecoder('latin1').decode(sb)}
async function parseDGN(buf){
 const o=readOLE(buf);if(!o)throw new Error('Không phải DGN V8 (OLE).');
 const F=Object.keys(o.files),models={};
 for(const p of F){const m=p.match(/^\/Dgn-Md\/(#[^/]+)\/Dgn\^G\/\$(\d+)$/);if(m)(models[m[1]]??=[]).push([+m[2],p])}
 // palette
 let pal=null;const pat=[255,255,255,0,0,255,0,255,0,255,0,0];
 for(const p of F){if(p.includes('Dgn^G')||p.includes('Dgn^Ix'))continue;const d=await dec(o.read(o.files[p])).catch(()=>null);if(!d)continue;
  outer:for(let i=0;i<d.length-768;i++){for(let k=0;k<12;k++)if(d[i+k]!==pat[k])continue outer;pal=d.slice(i,i+768);break}if(pal)break}
 const out={models:{},pal,stats:{},meta:{fmt:'DGN V8'}};
 for(const id in models){
  let org=[0,0];const mh=F.find(p=>p==='/Dgn-Md/'+id+'/Dgn~Mh');
  if(mh){const d=await dec(o.read(o.files[mh]));if(d){const v=new DataView(d.buffer,d.byteOffset,d.byteLength);
   for(let i=0;i+16<=d.length;i+=4){const a=v.getFloat64(i,true),b=v.getFloat64(i+8,true);
    if(Math.abs(a)>=1e6&&Math.abs(b)>=1e6&&a%1000===0&&b%1000===0&&Math.abs(a)<1e13&&Math.abs(b)<1e13){org=[a,b];break}}}}
  const prims=[],un={};
  for(const [,p] of models[id].sort((a,b)=>a[0]-b[0])){
   const d=await dec(o.read(o.files[p]));if(!d||d.length<20)continue;const v=new DataView(d.buffer,d.byteOffset,d.byteLength);
   for(let pos=4;pos+104<=d.length;){
    const fl=v.getUint32(pos,true),sz=v.getUint32(pos+4,true)*2,ao=v.getUint32(pos+8,true)*2;if(!sz||pos+sz>d.length)break;
    const t=fl&0xff,lv=v.getUint32(pos+12,true),st=v.getInt32(pos+44,true),w=v.getUint32(pos+48,true),c=v.getUint32(pos+52,true);
    const f=o=>v.getFloat64(pos+o,true),b={t,lv,c:c>255?0:c,w,st};
    if(t===3){const nd=(ao-104)/16;if(nd===2)prims.push({...b,k:'L',p:[f(104),f(112),f(120),f(128)]});else un[t]=(un[t]||0)+1}
    else if(t===4||t===6){const n=v.getUint32(pos+104,true),nd=(ao-112)/(n*8);if(nd===2&&n>1){const p=[];for(let i=0;i<n;i++)p.push(f(112+i*16),f(120+i*16));prims.push({...b,k:t===6?'S':'L',p})}else un[t]=(un[t]||0)+1}
    else if(t===15){if(ao-104===40)prims.push({...b,k:'E',e:[f(104),f(112),f(120),f(128),f(136)]});else un[t]=(un[t]||0)+1}
    else if(t===17){const n=v.getUint32(pos+108,true)>>>16,sb=d.subarray(pos+170,pos+170+n);let hi=false;for(const x of sb)if(x>=0xA1)hi=true;
     prims.push({...b,k:'T',x:f(152),y:f(160),h:f(136),w:f(128),r:f(144),s:dtxt(sb,hi),font:v.getUint16(pos+108,true),fid:v.getUint32(pos+104,true)})}
    else if(t===16&&ao-104===56){const A=[f(104),f(112),f(120),f(128),f(136),f(144),f(152)];if(A.every(isFinite)&&A[2]>0&&A[3]>0&&Math.abs(A[1])<=7)prims.push({...b,k:'A',a:A});else un[t]=(un[t]||0)+1}
    else if(t!==2&&t!==7)un[t]=(un[t]||0)+1;
    pos+=sz+4}}
  out.models[id]={prims,org,un};
 }
 return out;
}


/* ===== Đọc DGN V7 (ISFF / IGDS) =====
   Trả về cùng dạng với parseDGN (V8): {models:{id:{prims,org,un}},pal}. Toạ độ đổi ra "mm" (1 đơn vị app = 1 mm) tính từ gốc toàn cục,
   nên phần còn lại của app (đo, ghim, ảnh vệ tinh, thửa) dùng y như bản đồ V8.
   Số nguyên 32 bit lưu kiểu PDP-11 (word cao trước, mỗi word little-endian); số thực là VAX D-float. */
const U7={
 i32:(u,o)=>(u[o+2]|(u[o+3]<<8)|(u[o]<<16)|(u[o+1]<<24)),
 u16:(u,o)=>u[o]|(u[o+1]<<8),
 vax(u,o){const w0=u[o]|(u[o+1]<<8),e=(w0>>7)&255;if(!e)return 0;
  const f=(w0&127)*281474976710656+(u[o+2]|(u[o+3]<<8))*4294967296+(u[o+4]|(u[o+5]<<8))*65536+(u[o+6]|(u[o+7]<<8));
  return(w0&32768?-1:1)*(.5+f/72057594037927936)*2**(e-128)},
 // tên đơn vị 2 ký tự trong TCB → mét
 unit(a,b){const s=(String.fromCharCode(a||32)+String.fromCharCode(b||32)).trim().toLowerCase();
  return{m:1,mm:.001,cm:.01,km:1000,dm:.1,um:1e-6,in:.0254,ft:.3048,yd:.9144,mi:1609.344,mil:2.54e-5,uin:2.54e-8,ch:20.1168}[s]||0}
};
function isDGN7(u){return u.length>=1536&&(u[0]===8||u[0]===0xC8)&&u[1]===9&&u[2]===0xFE&&u[3]===2}
function parseDGN7(u){
 const n=u.length,I=o=>U7.i32(u,o),H=o=>U7.u16(u,o),X=o=>U7.vax(u,o),D2R=Math.PI/180;
 // --- khối điều khiển (TCB) ---
 let dim3=false,mm=1,org=[0,0,0],uPer=0,mName='',sName='',unitKnown=false;
 if(isDGN7(u)){dim3=!!(u[1214]&64);const a=I(1112),b=I(1116);
  if(a>0&&b>0&&a<=1e9&&b<=1e9){uPer=a*b;sName=String.fromCharCode(u[1120]||32,u[1121]||32).trim();mName=String.fromCharCode(u[1122]||32,u[1123]||32).trim();
   const mp=U7.unit(u[1122],u[1123]);if(mp){unitKnown=true;mm=1000*mp/uPer}}
  org=[X(1240),X(1248),X(1256)].map(v=>isFinite(v)?v:0)}
 if(!unitKnown){mm=uPer?1000/uPer:1}   // tên đơn vị lạ: coi đơn vị chính là mét
 // --- phần tử ---
 const els=[];let pos=0;
 while(pos+4<=n){if(u[pos]===255&&u[pos+1]===255)break;
  const len=4+2*H(pos+2);if(len<4||pos+len>n)break;
  const b0=u[pos],b1=u[pos+1];els.push({o:pos,len,lv:b0&63,cx:!!(b0&128),t:b1&127,del:!!(b1&128)});pos+=len}
 const prims=[],un={},pal=[];let palOK=false;
 const bump=t=>un[t]=(un[t]||0)+1;
 // hình học thô (đơn vị UOR của file, chưa trừ gốc) của một phần tử đường: trả về mảng phẳng [x,y,...] hoặc null
 const arcPts=(sa,sw,a,b,rot,cx,cy)=>{const ns=Math.max(2,Math.min(360,Math.ceil(Math.abs(sw)/3))),c=Math.cos(rot*D2R),s=Math.sin(rot*D2R),p=[];
  for(let k=0;k<=ns;k++){const t=(sa+sw*k/ns)*D2R,px=a*Math.cos(t),py=b*Math.sin(t);p.push(cx+px*c-py*s,cy+px*s+py*c)}return p};
 const yaw=o=>{const q=[0,1,2,3].map(k=>I(o+4*k)/2147483647),w=q[0],x=q[1],y=q[2],z=q[3];return Math.atan2(2*(w*z+x*y),1-2*(y*y+z*z))/D2R};
 const geom=e=>{const o=e.o,L=e.len,t=e.t,st=dim3?12:8;
  if(t===3){if(L<(dim3?60:52))return null;return dim3?[I(o+36),I(o+40),I(o+48),I(o+52)]:[I(o+36),I(o+40),I(o+44),I(o+48)]}
  if(t===4||t===6||t===11){const nv=H(o+36);if(nv<2||38+nv*st>L)return null;const p=[];for(let k=0;k<nv;k++)p.push(I(o+38+k*st),I(o+42+k*st));
   if(t===11&&nv>4)return p.slice(4,p.length-4);return p}
  if(t===16){const sa=I(o+36)/360000;let sw=U7.i32(u,o+40);const neg=(sw<0);sw=Math.abs(neg?(sw^-2147483648):sw)/360000;if(neg)sw=-sw;if(!sw)sw=360;
   if(dim3){if(L<100)return null;return arcPts(sa,sw,X(o+44),X(o+52),yaw(o+60),X(o+76),X(o+84))}
   if(L<80)return null;return arcPts(sa,sw,X(o+44),X(o+52),I(o+60)/360000,X(o+64),X(o+72))}
  return null};
 const prop=(e,k)=>({t:e.t,lv:e.lv,c:u[e.o+35],w:u[e.o+34]>>3,st:u[e.o+34]&7,k});
 // nối các thành phần của chuỗi/hình phức hợp thành một đường
 const chain=comps=>{let out=null;
  for(const c of comps){let p=c.slice();if(!out){out=p;continue}
   const ex=out[out.length-2],ey=out[out.length-1],d1=Math.hypot(p[0]-ex,p[1]-ey),d2=Math.hypot(p[p.length-2]-ex,p[p.length-1]-ey);
   if(d2<d1){const r=[];for(let k=p.length-2;k>=0;k-=2)r.push(p[k],p[k+1]);p=r}
   const j=Math.hypot(p[0]-ex,p[1]-ey)<=2?2:0;for(let k=j;k<p.length;k++)out.push(p[k])}
  return out};
 for(let i=0;i<els.length;i++){const e=els[i];if(e.del)continue;const t=e.t,o=e.o;
  if(t===3||t===4||t===6||t===16||t===11){const g=geom(e);if(!g){bump(t);continue}
   if(t===6&&g.length>=6)prims.push({...prop(e,'S'),p:g});
   else if(g.length>=4)prims.push({...prop(e,'L'),p:g})
   else bump(t)}
  else if(t===12||t===14){const ne=H(o+38),comps=[];let j=i+1;
   for(let c=0;c<ne&&j<els.length;c++,j++){const q=els[j];q.used=true;const g=q.del?null:geom(q);if(g)comps.push(g);else if(!q.del)bump(q.t)}
   i=j-1;const p=chain(comps);
   if(p&&p.length>=4){if(t===14&&p.length>=6){if(p[0]!==p[p.length-2]||p[1]!==p[p.length-1])p.push(p[0],p[1]);prims.push({...prop(e,'S'),p})}else prims.push({...prop(e,'L'),p})}
   else bump(t)}
  else if(t===15){if(dim3?e.len>=92:e.len>=72){const a=X(o+36),b=X(o+44);
    prims.push({...prop(e,'E'),e:dim3?[a,b,yaw(o+52)*D2R,X(o+68),X(o+76)]:[a,b,I(o+52)/360000*D2R,X(o+56),X(o+64)]})}else bump(t)}
  else if(t===17){const bs=dim3?76:60,off=dim3?74:58;if(e.len<bs){bump(t);continue}
   const nc=u[o+off],sb=u.subarray(o+bs,Math.min(o+e.len,o+bs+nc));let hi=false;for(const x of sb)if(x>=0xA1){hi=true;break}
   const s=hi?tcvn(sb):new TextDecoder('latin1').decode(sb);if(!s.trim())continue;
   const w=I(o+38)*6/1000,h=I(o+42)*6/1000;
   prims.push({...prop(e,'T'),x:dim3?I(o+62):I(o+50),y:dim3?I(o+66):I(o+54),h:Math.abs(h),w:Math.abs(w),r:(dim3?yaw(o+46):I(o+46)/360000)*D2R,s,font:u[o+36]})}
  else if(t===5&&e.lv===1&&e.len>=38+3*256&&!palOK){ // bảng màu: ô đầu = màu nền (255), sau đó là màu 0..254
   for(let k=0;k<255;k++)for(let c=0;c<3;c++)pal[3*k+c]=u[o+41+3*k+c];pal[765]=u[o+38];pal[766]=u[o+39];pal[767]=u[o+40];palOK=true}
  else if(t===2||t===7||t===8||t===9||t===10||t===5||t===37||t===35||t===34||t===66||t===1||t===33){}
  else bump(t)}
 // --- gốc toàn cục: toạ độ người dùng = toạ độ file − gốc (theo dgnlib). Nếu cách đó ra ngoài Việt Nam mà cách ngược lại thì vào → dùng cách ngược lại ---
 let sg=-1;
 if(org[0]||org[1]){let a=1/0,b=1/0,c=-1/0,d=-1/0;
  for(const p of prims){if(p.k==='T'){a=Math.min(a,p.x);c=Math.max(c,p.x);b=Math.min(b,p.y);d=Math.max(d,p.y)}else if(p.k==='E'){a=Math.min(a,p.e[3]);c=Math.max(c,p.e[3]);b=Math.min(b,p.e[4]);d=Math.max(d,p.e[4])}
   else for(let k=0;k<p.p.length;k+=2){const x=p.p[k],y=p.p[k+1];if(x<a)a=x;if(x>c)c=x;if(y<b)b=y;if(y>d)d=y}}
  const vn=s=>{const E=((a+c)/2+s*org[0])*mm/1000,N=((b+d)/2+s*org[1])*mm/1000;return E>8e4&&E<1.1e6&&N>4e5&&N<3.2e6};
  if(!vn(-1)&&vn(1))sg=1}
 const ox=sg*org[0],oy=sg*org[1];
 for(const p of prims){
  if(p.k==='T'){p.x=(p.x+ox)*mm;p.y=(p.y+oy)*mm;p.h*=mm;p.w*=mm}
  else if(p.k==='E'){p.e[0]*=mm;p.e[1]*=mm;p.e[3]=(p.e[3]+ox)*mm;p.e[4]=(p.e[4]+oy)*mm}
  else{const a=p.p;for(let k=0;k<a.length;k+=2){a[k]=(a[k]+ox)*mm;a[k+1]=(a[k+1]+oy)*mm}}}
 return{models:{'0':{prims,org:[0,0],un}},pal:palOK?Uint8Array.from(pal):null,stats:{},meta:{fmt:'DGN V7',dim3,master:mName,sub:sName,mm,org,sign:sg,units:unitKnown}}}
/* ===== Đọc DXF (ASCII và nhị phân; R12 → AutoCAD 2018+) =====
   Trả về cùng dạng với parseDGN: {models:{'0':{prims,org:[0,0],un,ln}},pal,meta}. Toạ độ đổi ra mm (đơn vị trong của app).
   Hỗ trợ: LINE, LWPOLYLINE, POLYLINE(2D/3D), CIRCLE, ARC, ELLIPSE, SPLINE, TEXT, MTEXT, ATTRIB, INSERT (khối lồng nhau, mảng),
   DIMENSION (khối *D), LEADER, SOLID/TRACE/3DFACE, HATCH (biên vùng tô đặc). Màu ACI + màu thật (gần nhất), lớp (tên, tắt/đóng băng).
   Chữ: UTF-8 (R2007+) hoặc theo $DWGCODEPAGE; phông TCVN3 (.VnTime…) và VNI (VNI-Times…) được đổi sang Unicode. */
const DXF=(()=>{
 const hsv=(h,s,v)=>{const c=v*s,x=c*(1-Math.abs((h/60)%2-1)),m=v-c,k=Math.floor(h/60)%6,r=[[c,x,0],[x,c,0],[0,c,x],[0,x,c],[x,0,c],[c,0,x]][k];return r.map(t=>Math.floor(t+m))};
 const PAL=(()=>{const P=new Uint8Array(768),b=[[0,0,0],[255,0,0],[255,255,0],[0,255,0],[0,255,255],[0,0,255],[255,0,255],[255,255,255],[128,128,128],[192,192,192]],V=[255,165,127,76,38],G=[51,91,132,173,214,255];
  b.forEach((c,i)=>P.set(c,3*i));for(let i=10;i<250;i++)P.set(hsv(Math.floor((i-10)/10)*15,i%2?.5:1,V[Math.floor((i%10)/2)]),3*i);for(let i=250;i<256;i++)P.set([G[i-250],G[i-250],G[i-250]],3*i);return P})();
 const near=new Map(),tc2aci=rgb=>{if(near.has(rgb))return near.get(rgb);const r=rgb>>16&255,g=rgb>>8&255,b=rgb&255;let bi=7,bd=1e9;
  for(let i=1;i<256;i++){const d=(PAL[3*i]-r)**2+(PAL[3*i+1]-g)**2+(PAL[3*i+2]-b)**2;if(d<bd){bd=d;bi=i}}near.set(rgb,bi);return bi};
 // ----- VNI-Windows → Unicode -----
 const VNI=(()=>{const P={},S={},add=(o,k,v)=>{o[k]=v};
  const T=[['ù','́'],['ø','̀'],['û','̉'],['õ','̃'],['ï','̣']],TU=[['Ù','́'],['Ø','̀'],['Û','̉'],['Õ','̃'],['Ï','̣']];
  const C=[['â',''],['á','́'],['à','̀'],['å','̉'],['ã','̃'],['ä','̣']],CU=[['Â',''],['Á','́'],['À','̀'],['Å','̉'],['Ã','̃'],['Ä','̣']];
  const B=[['ê',''],['é','́'],['è','̀'],['ú','̉'],['ü','̃'],['ë','̣']],BU=[['Ê',''],['É','́'],['È','̀'],['Ú','̉'],['Ü','̃'],['Ë','̣']];
  for(const v of 'aeouy')for(const[m,t]of T)add(P,v+m,(v+t).normalize('NFC'));
  for(const v of 'AEOUY')for(const[m,t]of TU)add(P,v+m,(v+t).normalize('NFC'));
  for(const v of 'aeo')for(const[m,t]of C)add(P,v+m,(v+'̂'+t).normalize('NFC'));
  for(const v of 'AEO')for(const[m,t]of CU)add(P,v+m,(v+'̂'+t).normalize('NFC'));
  for(const[m,t]of B)add(P,'a'+m,('ă'+t).normalize('NFC'));for(const[m,t]of BU)add(P,'A'+m,('Ă'+t).normalize('NFC'));
  for(const[m,t]of T){add(P,'ô'+m,('ơ'+t).normalize('NFC'));add(P,'ö'+m,('ư'+t).normalize('NFC'))}
  for(const[m,t]of TU){add(P,'Ô'+m,('Ơ'+t).normalize('NFC'));add(P,'Ö'+m,('Ư'+t).normalize('NFC'))}
  Object.assign(S,{'í':'í','ì':'ì','æ':'ỉ','ó':'ĩ','ò':'ị','î':'ỵ','ñ':'đ','ô':'ơ','ö':'ư','Í':'Í','Ì':'Ì','Æ':'Ỉ','Ó':'Ĩ','Ò':'Ị','Î':'Ỵ','Ñ':'Đ','Ô':'Ơ','Ö':'Ư'});
  return s=>{let o='';for(let i=0;i<s.length;i++){const p=P[s[i]+(s[i+1]||'')];if(p){o+=p;i++;continue}o+=S[s[i]]||s[i]}return o}})();
 const CP1252={8364:128,8218:130,402:131,8222:132,8230:133,8224:134,8225:135,710:136,8240:137,352:138,8249:139,338:140,381:142,8216:145,8217:146,8220:147,8221:148,8226:149,8211:150,8212:151,732:152,8482:153,353:154,8250:155,339:156,382:158,376:159};
 const toBytes=s=>{const b=new Uint8Array(s.length);for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);b[i]=c<256?c:(CP1252[c]||63)}return b};
 const fontKind=f=>{f=String(f||'').toLowerCase().replace(/^.*[\\/]/,'');if(/^vni[-_ ]?/.test(f))return'vni';if(/^\.?vn[a-z]/.test(f)&&!/^vni/.test(f))return/^\.?vn[a-z]*h(\.ttf|\.shx)?$/.test(f)?'tcvnH':'tcvn';return''};
 const _tcvn=b=>typeof tcvn==='function'?tcvn(b):String.fromCharCode(...b);
 // ----- đọc thô thành cặp (mã nhóm, giá trị) -----
 const SENT='AutoCAD Binary DXF\r\n\x1a\x00';
 function isDXF(u){if(u.length>22&&String.fromCharCode(...u.subarray(0,22))===SENT)return'bin';
  let s='';const n=Math.min(u.length,4096);for(let i=0;i<n;i++)s+=String.fromCharCode(u[i]);s=s.replace(/^﻿|^\xef\xbb\xbf/,'');
  return/^\s*(999\s*\r?\n[^\n]*\r?\n\s*)*0\s*\r?\n\s*SECTION\s*\r?\n\s*2\s*\r?\n\s*(HEADER|CLASSES|TABLES|BLOCKS|ENTITIES|OBJECTS)\b/.test(s)?'asc':''}
 function vtype(c){ // kiểu giá trị trong DXF nhị phân
  if(c<10||(c>=100&&c<=102)||c===105||(c>=300&&c<=309)||(c>=320&&c<=369)||(c>=390&&c<=399)||(c>=410&&c<=419)||(c>=430&&c<=439)||(c>=470&&c<=481)||c===999||(c>=1000&&c<=1003)||(c>=1005&&c<=1009))return's';
  if((c>=10&&c<=59)||(c>=110&&c<=149)||(c>=210&&c<=239)||(c>=460&&c<=469)||(c>=1010&&c<=1059))return'd';
  if((c>=60&&c<=79)||(c>=170&&c<=179)||(c>=270&&c<=289)||(c>=370&&c<=389)||(c>=400&&c<=409)||(c>=1060&&c<=1070))return'h';
  if((c>=90&&c<=99)||(c>=420&&c<=429)||(c>=440&&c<=459)||c===1071)return'l';
  if(c>=160&&c<=169)return'q';if(c>=290&&c<=299)return'b';if((c>=310&&c<=319)||c===1004)return'x';return's'}
 function tok(u,kind){const C=[],V=[];
  if(kind==='bin'){const dv=new DataView(u.buffer,u.byteOffset,u.byteLength),n=u.length;let p=22;const two=!(u[22]===0&&u[23]!==0);
   const str=()=>{let e=p;while(e<n&&u[e])e++;let s='';for(let i=p;i<e;i+=8192)s+=String.fromCharCode(...u.subarray(i,Math.min(e,i+8192)));p=e+1;return s};
   while(p<n){let c;if(two){if(p+2>n)break;c=dv.getInt16(p,true);p+=2}else{c=u[p++];if(c===255){c=dv.getInt16(p,true);p+=2}}
    const t=vtype(c);let v;
    if(t==='s')v=str();else if(t==='d'){v=dv.getFloat64(p,true);p+=8}else if(t==='h'){v=dv.getInt16(p,true);p+=2}else if(t==='l'){v=dv.getInt32(p,true);p+=4}
    else if(t==='q'){v=Number(dv.getBigInt64(p,true));p+=8}else if(t==='b'){v=u[p++]}else{const L=u[p++];v='';p+=L}
    C.push(c);V.push(v);if(c===0&&v==='EOF')break}
   return{C,V}}
  let s='';for(let i=0;i<u.length;i+=8192)s+=String.fromCharCode(...u.subarray(i,Math.min(u.length,i+8192)));
  let p=0;const n=s.length;if(s.charCodeAt(0)===0xef&&s.charCodeAt(1)===0xbb&&s.charCodeAt(2)===0xbf)p=3;
  const line=()=>{let e=s.indexOf('\n',p);if(e<0)e=n;let l=s.slice(p,e);p=e+1;if(l.endsWith('\r'))l=l.slice(0,-1);return l};
  while(p<n){const c=parseInt(line(),10);if(p>n)break;const v=line();if(isNaN(c))continue;C.push(c);V.push(v);if(c===0&&v.trim()==='EOF')break}
  return{C,V}}
 // ----- phân tích -----
 function parse(u,opt){opt=opt||{};const kind=isDXF(u);if(!kind)throw new Error('Không phải file DXF');
  const{C,V}=tok(u,kind),N=C.length,num=v=>typeof v==='number'?v:parseFloat(v);
  const meas=opt.measure||((t,h)=>t.length*h*.62);
  // gom thành bản ghi: mỗi bản ghi bắt đầu bằng mã 0
  const recs=[];for(let i=0;i<N;i++){if(C[i]===0){recs.push({t:String(V[i]).trim(),a:i+1,b:i+1});if(recs.length>1)recs[recs.length-2].b=i}}if(recs.length)recs[recs.length-1].b=N;
  const G=(r,c)=>{for(let i=r.a;i<r.b;i++)if(C[i]===c)return V[i];return undefined},GN=(r,c,d)=>{const v=G(r,c);return v===undefined?d:num(v)},GS=(r,c,d)=>{const v=G(r,c);return v===undefined?d:String(v)};
  // header
  const H={};let sec='';const ents=[],blocks={},layers={},styles={};let blk=null,tbl='';
  for(let k=0;k<recs.length;k++){const r=recs[k];
   if(r.t==='SECTION'){sec=String(G(r,2)||'').trim();if(sec==='HEADER'){for(let i=r.a;i<r.b;i++){if(C[i]===9){const nm=String(V[i]).trim(),vals={};for(let j=i+1;j<r.b&&C[j]!==9;j++)if(vals[C[j]]===undefined)vals[C[j]]=V[j];H[nm]=vals}}}continue}
   if(r.t==='ENDSEC'){sec='';continue}
   if(sec==='TABLES'){if(r.t==='TABLE'){tbl=String(G(r,2)||'').trim();continue}if(r.t==='ENDTAB'){tbl='';continue}
    if(r.t==='LAYER'){const nm=GS(r,2,'0').trim(),c=GN(r,62,7),f=GN(r,70,0),tc=G(r,420);layers[nm.toUpperCase()]={nm,c:Math.abs(c)||7,tc:tc!==undefined?num(tc):undefined,off:c<0,frozen:!!(f&1)}}
    else if(r.t==='STYLE'){const nm=GS(r,2,'').trim();let fam='';for(let i=r.a;i<r.b;i++)if(C[i]===1000&&!fam)fam=String(V[i]);styles[nm.toUpperCase()]={font:GS(r,3,''),big:GS(r,4,''),fam}}
    continue}
   if(sec==='BLOCKS'){if(r.t==='BLOCK'){blk={nm:GS(r,2,'').trim(),bx:GN(r,10,0),by:GN(r,20,0),ents:[]};blocks[blk.nm.toUpperCase()]=blk;continue}if(r.t==='ENDBLK'){blk=null;continue}if(blk)blk.ents.push(r);continue}
   if(sec==='ENTITIES')ents.push(r)}
  const ver=String((H.$ACADVER||{})[1]||'AC1009').trim(),cpg=String((H.$DWGCODEPAGE||{})[3]||'').trim().toUpperCase(),utf8=ver>='AC1021';
  const VERN={AC1006:'R10',AC1009:'R11/R12',AC1012:'R13',AC1014:'R14',AC1015:'2000',AC1018:'2004',AC1021:'2007',AC1024:'2010',AC1027:'2013',AC1032:'2018'};
  let cpd=null;if(!utf8){const m=cpg.match(/^ANSI_(\d+)$/),lab=m?({'932':'shift_jis','936':'gbk','949':'euc-kr','950':'big5','874':'windows-874'})[m[1]]||('windows-'+m[1]):'windows-1252';try{cpd=new TextDecoder(lab)}catch(e){try{cpd=new TextDecoder('windows-1252')}catch(e2){}}}
  const u8d=utf8?new TextDecoder('utf-8'):null;
  // đổi chuỗi thô (mỗi ký tự = 1 byte) sang Unicode theo phông
  const dec=(s,font)=>{s=String(s);let hi=false;for(let i=0;i<s.length;i++)if(s.charCodeAt(i)>127){hi=true;break}
   let t=s;if(hi){if(utf8)t=u8d.decode(toBytes(s));const fk=fontKind(font);
    if(fk==='tcvn'||fk==='tcvnH'){t=_tcvn(toBytes(t));if(fk==='tcvnH')t=t.toUpperCase()}else if(fk==='vni')t=VNI(t);else if(!utf8&&cpd)t=cpd.decode(toBytes(s))}
   else{const fk=fontKind(font);if(fk==='tcvnH')t=t.toUpperCase()}
   return t.replace(/\\U\+([0-9A-Fa-f]{4})/g,(_,h)=>String.fromCharCode(parseInt(h,16))).replace(/\\M\+[0-9A-Fa-f]{5}/g,'?').normalize('NFC')};
  const pct=t=>t.replace(/%%(\d{3})/g,(_,d)=>String.fromCharCode(+d)).replace(/%%[dD]/g,'°').replace(/%%[cC]/g,'⌀').replace(/%%[pP]/g,'±').replace(/%%[uUoOkK]/g,'').replace(/%%%/g,'%');
  const fontOf=st=>{const s=styles[String(st||'STANDARD').toUpperCase()];return s?(s.fam||s.font):''};
  // đơn vị → mm
  const IU=[0,25.4,304.8,1609344,1,10,1000,1e6,2.54e-5,.0254,914.4,1e-7,1e-6,1e-3,100,1e4,1e5,1e12],iu=num((H.$INSUNITS||{})[70]||0);
  const em=H.$EXTMIN||{},eM=H.$EXTMAX||{},ex=[num(em[10]),num(em[20]),num(eM[10]),num(eM[20])];
  const vnM=(x,y)=>x>8e4&&x<1.1e6&&y>4e5&&y<3.2e6,vnMM=(x,y)=>vnM(x/1000,y/1000);
  const ecx=(ex[0]+ex[2])/2,ecy=(ex[1]+ex[3])/2,extOK=ex.every(isFinite)&&ex[2]>ex[0]&&Math.abs(ex[0])<1e19;
  let MM=IU[iu]||0,uGuess=false;if(!MM){uGuess=true;MM=extOK&&vnMM(ecx,ecy)&&!vnM(ecx,ecy)?1:1000}
  // ----- dựng hình -----
  const prims=[],un={},lvOf={},ln={};let nextLv=1000;const bump=t=>un[t]=(un[t]||0)+1;
  const lvl=nm=>{nm=String(nm==null?'0':nm).trim();const K=nm.toUpperCase();if(lvOf[K]!==undefined)return lvOf[K];
   let m=nm.match(/^(?:level\s*|lv\s*|lop\s*|lớp\s*)?(\d{1,3})$/i),v=m&&+m[1]>0&&+m[1]<1000&&!Object.values(lvOf).includes(+m[1])?+m[1]:nextLv++;lvOf[K]=v;ln[v]=dec(nm,'');return v};
  const mul=(A,B)=>[A[0]*B[0]+A[2]*B[1],A[1]*B[0]+A[3]*B[1],A[0]*B[2]+A[2]*B[3],A[1]*B[2]+A[3]*B[3],A[0]*B[4]+A[2]*B[5]+A[4],A[1]*B[4]+A[3]*B[5]+A[5]];
  const ID=[MM,0,0,MM,0,0],ap=(T,x,y)=>[T[0]*x+T[2]*y+T[4],T[1]*x+T[3]*y+T[5]];
  const ocs=r=>{const nz=GN(r,230,1);return nz<0?[-1,0,0,1,0,0]:null};       // pháp tuyến (0,0,-1): lật X
  const bulge=(out,x1,y1,x2,y2,b)=>{if(!b||Math.abs(b)<1e-9){out.push(x2,y2);return}const th=4*Math.atan(b),d=Math.hypot(x2-x1,y2-y1);if(d<1e-12){out.push(x2,y2);return}
   const R=d/(2*Math.sin(th/2)),mx=(x1+x2)/2,my=(y1+y2)/2,h=R*Math.cos(th/2),nx=-(y2-y1)/d,ny=(x2-x1)/d,cx=mx+nx*h,cy=my+ny*h,a0=Math.atan2(y1-cy,x1-cx),ns=Math.max(2,Math.min(128,Math.ceil(Math.abs(th)/(Math.PI/36))));
   const rr=Math.abs(R);for(let k=1;k<=ns;k++){const a=a0+th*k/ns;out.push(cx+rr*Math.cos(a),cy+rr*Math.sin(a))}out[out.length-2]=x2;out[out.length-1]=y2};
  const arcP=(cx,cy,r,a0,a1)=>{let sw=a1-a0;while(sw<=0)sw+=360;while(sw>360)sw-=360;const ns=Math.max(2,Math.min(256,Math.ceil(sw/5))),p=[];for(let k=0;k<=ns;k++){const a=(a0+sw*k/ns)*Math.PI/180;p.push(cx+r*Math.cos(a),cy+r*Math.sin(a))}return p};
  const spline=(deg,K,P,W)=>{const n=P.length/2;if(n<2)return P.slice();if(!K.length||K.length!==n+deg+1||deg<1){return P.slice()}
   const out=[],t0=K[deg],t1=K[n],ns=Math.max(8,Math.min(800,n*8));
   for(let s=0;s<=ns;s++){const t=t0+(t1-t0)*s/ns;let k=deg;while(k<n-1&&!(t>=K[k]&&t<K[k+1]))k++;
    const d=[];for(let j=0;j<=deg;j++){const i=k-deg+j,w=W?W[i]||1:1;d.push([P[2*i]*w,P[2*i+1]*w,w])}
    for(let r=1;r<=deg;r++)for(let j=deg;j>=r;j--){const i=k-deg+j,den=K[i+deg-r+1]-K[i],al=den?(t-K[i])/den:0;for(let c=0;c<3;c++)d[j][c]=(1-al)*d[j-1][c]+al*d[j][c]}
    out.push(d[deg][0]/d[deg][2],d[deg][1]/d[deg][2])}return out};
  const colorOf=(r,lay,bc)=>{let c=GN(r,62,256);const tc=G(r,420);if(tc!==undefined&&c!==0&&c!==256)return tc2aci(num(tc));if(tc!==undefined&&G(r,62)===undefined)return tc2aci(num(tc));
   if(c===0)return bc||7;if(c===256||c===undefined){const L=layers[String(lay).toUpperCase()];if(!L)return 7;return L.tc!==undefined?tc2aci(L.tc):L.c}return Math.abs(c)||7};
  const simil=T=>{const a=Math.hypot(T[0],T[1]),b=Math.hypot(T[2],T[3]);return Math.abs(a-b)<=1e-9*a&&Math.abs(T[0]*T[2]+T[1]*T[3])<=1e-9*a*a?a:0};
  const hidden=lay=>{const L=layers[String(lay).toUpperCase()];return L&&(L.off||L.frozen)};
  const pts=(r,cx,cy)=>{const p=[];for(let i=r.a;i<r.b;i++)if(C[i]===cx){const x=num(V[i]);let y=0;if(i+1<r.b&&C[i+1]===cy)y=num(V[i+1]);p.push(x,y)}return p};
  const emitL=(T,p,base,closed)=>{if(p.length<4)return;const q=[];for(let i=0;i<p.length;i+=2){const w=ap(T,p[i],p[i+1]);q.push(w[0],w[1])}
   if(closed){if(q[0]!==q[q.length-2]||q[1]!==q[q.length-1])q.push(q[0],q[1]);if(q.length>=8){prims.push({...base,k:'S',p:q});return}}prims.push({...base,k:'L',p:q})};
  const emitT=(T,base,x,y,h,rotDeg,s,wf)=>{if(!s||!String(s).trim())return;const o=ap(T,x,y),a=rotDeg*Math.PI/180,v=[T[0]*Math.cos(a)+T[2]*Math.sin(a),T[1]*Math.cos(a)+T[3]*Math.sin(a)],
   sc=Math.sqrt(Math.abs(T[0]*T[3]-T[1]*T[2]));prims.push({...base,k:'T',x:o[0],y:o[1],h:Math.abs(h*sc),w:meas(s,h)*sc*(wf||1),r:Math.atan2(v[1],v[0]),s,font:0})};
  // MTEXT: bỏ mã định dạng, tách dòng; trả về [{s, font}] từng dòng (đoạn phông khác nhau được giải mã riêng)
  const mtext=(raw,font0)=>{const lines=[''];let f=font0,i=0;const s=raw;
   const put=t=>{lines[lines.length-1]+=dec(t,f)};let buf='';const flush=()=>{if(buf){put(buf);buf=''}};
   while(i<s.length){const ch=s[i];
    if(ch==='\\'){const n=s[i+1];
     if(n==='P'||n==='X'||n==='N'){flush();lines.push('');i+=2;continue}
     if(n==='~'){buf+=' ';i+=2;continue}if(n==='\\'||n==='{'||n==='}'){buf+=n;i+=2;continue}
     if(n==='U'&&s[i+2]==='+'){buf+=s.slice(i,i+7);i+=7;continue}
     if(n==='f'||n==='F'){flush();const e=s.indexOf(';',i);const spec=s.slice(i+2,e<0?s.length:e);f=spec.split('|')[0]||f;i=e<0?s.length:e+1;continue}
     if(n==='S'){const e=s.indexOf(';',i);const t=s.slice(i+2,e<0?s.length:e).replace(/[#^]/,'/');buf+=t;i=e<0?s.length:e+1;continue}
     if('HWQTACcpa'.includes(n)){const e=s.indexOf(';',i);i=e<0?s.length:e+1;continue}
     if('LlOoKk'.includes(n)){i+=2;continue}
     buf+=n||'';i+=2;continue}
    if(ch==='{'||ch==='}'){i++;continue}
    buf+=ch;i++}
   flush();return lines.map(t=>pct(t))};
  const ins=new Set();let depth=0;
  function draw(list,T,ctx){for(const r of list)one(r,T,ctx)}
  function one(r,T,ctx){const t=r.t;if(GN(r,67,0)===1&&!ctx.inBlk)return;
   let lay=GS(r,8,'0');if(ctx.lay&&lay==='0')lay=ctx.lay;if(hidden(lay))return;
   const base={t:0,lv:lvl(lay),c:colorOf(r,lay,ctx.c),w:0,st:0},O=ocs(r),TT=O?mul(T,O):T;
   if(t==='LINE'){emitL(T,[GN(r,10,0),GN(r,20,0),GN(r,11,0),GN(r,21,0)],base,false)}
   else if(t==='LWPOLYLINE'){const p=[],bl=[];let x=null;for(let i=r.a;i<r.b;i++){const c=C[i];if(c===10){x=num(V[i]);p.push(x,0);bl.push(0)}else if(c===20&&p.length)p[p.length-1]=num(V[i]);else if(c===42&&bl.length)bl[bl.length-1]=num(V[i])}
    const cl=!!(GN(r,70,0)&1),q=[p[0],p[1]];const nv=p.length/2;for(let k=1;k<nv+(cl?1:0);k++){const a=(k-1),b=k%nv;bulge(q,p[2*a],p[2*a+1],p[2*b],p[2*b+1],bl[a])}
    if(nv===1)return;emitL(TT,q,base,cl)}
   else if(t==='CIRCLE'){const c=ap(TT,GN(r,10,0),GN(r,20,0)),R=GN(r,40,0),sc=simil(TT);if(sc)prims.push({...base,k:'E',e:[R*sc,R*sc,0,c[0],c[1]]});else emitL(TT,arcP(GN(r,10,0),GN(r,20,0),R,0,360),base,true)}
   else if(t==='ARC'){emitL(TT,arcP(GN(r,10,0),GN(r,20,0),GN(r,40,0),GN(r,50,0),GN(r,51,360)),base,false)}
   else if(t==='ELLIPSE'){const cx=GN(r,10,0),cy=GN(r,20,0),mx=GN(r,11,1),my=GN(r,21,0),k=GN(r,40,1);let t0=GN(r,41,0),t1=GN(r,42,2*Math.PI);const nz=GN(r,230,1);
    let sw=t1-t0;while(sw<=0)sw+=2*Math.PI;const p=[],ns=Math.max(8,Math.min(256,Math.ceil(sw/(Math.PI/36))));for(let j=0;j<=ns;j++){const a=t0+sw*j/ns,c=Math.cos(a),s=Math.sin(a)*(nz<0?-1:1);p.push(cx+mx*c-my*k*s,cy+my*c+mx*k*s)}
    const sc=simil(T);if(sw>=2*Math.PI-1e-6&&sc){const c=ap(T,cx,cy),v=[T[0]*mx+T[2]*my,T[1]*mx+T[3]*my],L=Math.hypot(mx,my)*sc;prims.push({...base,k:'E',e:[L,L*k,Math.atan2(v[1],v[0]),c[0],c[1]]})}else emitL(T,p,base,sw>=2*Math.PI-1e-6)}
   else if(t==='SPLINE'){const deg=GN(r,71,3),K=[],P=[],W=[],F=[];for(let i=r.a;i<r.b;i++){const c=C[i];if(c===40)K.push(num(V[i]));else if(c===10)P.push(num(V[i]),0);else if(c===20)P[P.length-1]=num(V[i]);else if(c===41)W.push(num(V[i]));else if(c===11)F.push(num(V[i]),0);else if(c===21)F[F.length-1]=num(V[i])}
    const p=P.length>=4?spline(deg,K,P,W.length===P.length/2?W:null):F;emitL(T,p,base,false)}
   else if(t==='POLYLINE'){const fl=GN(r,70,0);if(fl&64){bump('POLYFACE');return}
    const p=[],bl=[];let j=list_next(r);while(j&&j.t==='VERTEX'){const vf=GN(j,70,0);if(!(vf&16)){p.push(GN(j,10,0),GN(j,20,0));bl.push(GN(j,42,0))}j=list_next(j)}
    const cl=!!(fl&1),nv=p.length/2;if(nv<2)return;const q=[p[0],p[1]];for(let k=1;k<nv+(cl?1:0);k++){const a=k-1,b=k%nv;bulge(q,p[2*a],p[2*a+1],p[2*b],p[2*b+1],(fl&8)?0:bl[a])}emitL((fl&8)?T:TT,q,base,cl)}
   else if(t==='TEXT'||(t==='ATTRIB'&&ctx.attr)||(t==='ATTDEF'&&ctx.inBlk&&(GN(r,70,0)&2))){if(t!=='TEXT'&&(GN(r,70,0)&1))return;
    const st=GS(r,7,'STANDARD'),s=pct(dec(GS(r,1,''),fontOf(st))),h=GN(r,40,1),rot=GN(r,50,0),wf=GN(r,41,1),hj=GN(r,72,0),vj=GN(r,t==='TEXT'?73:74,0);
    let x=GN(r,10,0),y=GN(r,20,0);const x2=G(r,11),y2=G(r,21);
    if((hj||vj)&&x2!==undefined&&!(hj===3||hj===5)){const ax=num(x2),ay=num(y2||0),same=Math.abs(ax-x)<1e-9&&Math.abs(ay-y)<1e-9;
     if(same||(x===0&&y===0)){const W=meas(s,h)*wf,a=rot*Math.PI/180,c=Math.cos(a),sn=Math.sin(a),dx=hj===1||hj===4?-W/2:hj===2?-W:0,dy=hj===4||vj===2?-h/2:vj===3?-h:vj===1?h*.25:0;x=ax+dx*c-dy*sn;y=ay+dx*sn+dy*c}}
    emitT(TT,base,x,y,h,rot,s,wf)}
   else if(t==='MTEXT'){let raw='';for(let i=r.a;i<r.b;i++)if(C[i]===3)raw+=String(V[i]);raw+=GS(r,1,'');const st=GS(r,7,'STANDARD'),L=mtext(raw,fontOf(st)),h=GN(r,40,1),ap7=GN(r,71,1),ls=h*5/3*GN(r,44,1);
    let rot=GN(r,50,0);const dx=G(r,11);if(dx!==undefined){rot=Math.atan2(GN(r,21,0),num(dx))*180/Math.PI}
    const bw=GN(r,41,0),lines=[];for(const l of L){if(bw>0&&meas(l,h)>bw*1.02){let cur='';for(const w of l.split(' ')){const tt=cur?cur+' '+w:w;if(cur&&meas(tt,h)>bw){lines.push(cur);cur=w}else cur=tt}lines.push(cur)}else lines.push(l)}
    const n=lines.length,tot=(n-1)*ls+h,y0=ap7<=3?-h:ap7<=6?tot/2-h:(n-1)*ls,a=rot*Math.PI/180,c=Math.cos(a),sn=Math.sin(a),X0=GN(r,10,0),Y0=GN(r,20,0);
    lines.forEach((s,k)=>{const W=meas(s,h),hx=ap7%3===2?-W/2:ap7%3===0?-W:0,vy=y0-k*ls;emitT(T,base,X0+hx*c-vy*sn,Y0+hx*sn+vy*c,h,rot,s,1)})}
   else if(t==='INSERT'||t==='DIMENSION'||t==='ARC_DIMENSION'||t==='LARGE_RADIAL_DIMENSION'){const nm=GS(r,2,'').trim(),B=blocks[nm.toUpperCase()];
    if(B&&depth<16&&!ins.has(B)){let M2;if(t==='INSERT'){const sx=GN(r,41,1),sy=GN(r,42,sx),a=GN(r,50,0)*Math.PI/180,c=Math.cos(a),s=Math.sin(a),nc=Math.max(1,GN(r,70,1)),nr=Math.max(1,GN(r,71,1)),dc=GN(r,44,0),dr=GN(r,45,0);
      ins.add(B);depth++;for(let ri=0;ri<Math.min(nr,100);ri++)for(let ci=0;ci<Math.min(nc,100);ci++){const ox=ci*dc,oy=ri*dr,ix=GN(r,10,0)+ox*c-oy*s,iy=GN(r,20,0)+ox*s+oy*c;
       M2=mul(TT,[c*sx,s*sx,-s*sy,c*sy,ix,iy]);M2=mul(M2,[1,0,0,1,-B.bx,-B.by]);draw(B.ents,M2,{lay,c:base.c,inBlk:true})}depth--;ins.delete(B)}
     else{ins.add(B);depth++;draw(B.ents,T,{lay,c:base.c,inBlk:true});depth--;ins.delete(B)}}
    else if(!B)bump(t);
    if(t==='INSERT'&&GN(r,66,0)){let j=list_next(r);while(j&&j.t==='ATTRIB'){one(j,T,{...ctx,attr:true});j=list_next(j)}}}
   else if(t==='LEADER'){emitL(T,pts(r,10,20),base,false)}
   else if(t==='SOLID'||t==='TRACE'||t==='3DFACE'){const p=[GN(r,10,0),GN(r,20,0),GN(r,11,0),GN(r,21,0)],p3=[GN(r,12,0),GN(r,22,0)],p4=[GN(r,13,p3[0]),GN(r,23,p3[1])];
    const q=t==='3DFACE'?[...p,...p3,...p4]:[...p,...p4,...p3];emitL(t==='3DFACE'?T:TT,q,base,true)}
   else if(t==='HATCH'){if(!GN(r,70,0))return;let i=r.a;while(i<r.b&&C[i]!==91)i++;const np=i<r.b?num(V[i]):0;i++;
    for(let b=0;b<np&&i<r.b;b++){while(i<r.b&&C[i]!==92)i++;if(i>=r.b)break;const ty=num(V[i]);i++;const q=[];
     if(ty&2){let hb=0,nv=0;for(;i<r.b;i++){if(C[i]===72)hb=num(V[i]);else if(C[i]===93){nv=num(V[i]);i++;break}}const p=[],bl=[];
      let cnt=0;while(i<r.b&&cnt<nv){const c=C[i];if(c===10){p.push(num(V[i]),0);bl.push(0)}else if(c===20&&p.length){p[p.length-1]=num(V[i]);cnt++}else if(c===92||c===97)break;i++;if(cnt&&hb&&i<r.b&&C[i]===42){bl[bl.length-1]=num(V[i]);i++}}
      if(p.length>=4){q.push(p[0],p[1]);for(let k=1;k<=p.length/2;k++){const a=k-1,b2=k%(p.length/2);bulge(q,p[2*a],p[2*a+1],p[2*b2],p[2*b2+1],bl[a])}}}
     else{let ne=0;for(;i<r.b;i++)if(C[i]===93){ne=num(V[i]);i++;break}
      for(let e=0;e<ne&&i<r.b;e++){while(i<r.b&&C[i]!==72)i++;const et=num(V[i]);i++;const g={};const take=cs=>{for(const c of cs){while(i<r.b&&C[i]!==c&&C[i]!==72)i++;if(C[i]===c){g[c]=num(V[i]);i++}}};
       if(et===1){take([10,20,11,21]);if(!q.length)q.push(g[10],g[20]);q.push(g[11],g[21])}
       else if(et===2){take([10,20,40,50,51,73]);const sg=g[73]===0?-1:1;let sw=g[51]-g[50];while(sw<=0)sw+=360;if(sw>360)sw=360;const ns=Math.max(2,Math.ceil(sw/5));
        for(let j=0;j<=ns;j++){const a=sg*(g[50]+sw*j/ns)*Math.PI/180;q.push(g[10]+g[40]*Math.cos(a),g[20]+g[40]*Math.sin(a))}}
       else if(et===3){take([10,20,11,21,40,50,51,73]);const k=g[40],t0=g[50]*Math.PI/180,t1=g[51]*Math.PI/180;let sw=t1-t0;while(sw<=0)sw+=2*Math.PI;const ns=36,sg=g[73]===0?-1:1;
        for(let j=0;j<=ns;j++){const a=sg*(t0+sw*j/ns),c=Math.cos(a),s=Math.sin(a);q.push(g[10]+g[11]*c-g[21]*k*s,g[20]+g[21]*c+g[11]*k*s)}}
       else{bump('HATCH_SPLINE')}}}
     if(q.length>=6)emitL(TT,q,base,true);
     while(i<r.b&&C[i]!==97)i++;if(i<r.b){const nb=num(V[i]);i+=1+nb}}}
   else if(t==='VERTEX'||t==='SEQEND'||t==='ATTDEF'||t==='ATTRIB'||t==='VIEWPORT'){}
   else bump(t)}
  // vị trí bản ghi kế tiếp (cho POLYLINE/VERTEX, INSERT/ATTRIB)
  const idx=new Map();recs.forEach((r,k)=>idx.set(r,k));const list_next=r=>recs[idx.get(r)+1];
  draw(ents,ID,{});
  // bỏ đối tượng không gian giấy (khối *Paper_Space không vẽ vì chỉ vẽ ENTITIES có 67≠1)
  return{models:{'0':{prims,org:[0,0],un,ln}},pal:PAL,stats:{},meta:{fmt:'DXF '+(VERN[ver]||ver)+(kind==='bin'?' (nhị phân)':''),ver,cp:utf8?'UTF-8':cpg||'ANSI_1252',mm:MM,uGuess,insunits:iu}}}
 return{isDXF,parse,PAL,VNI,fontKind}
})();
function isDXF(u){return DXF.isDXF(u)}
function parseDXF(u,opt){return DXF.parse(u,opt)}
/* ===== nhận dạng định dạng khi mở file ===== */
const DWGV={'MC0.0':'R1.0','AC1.2':'R1.2','AC1.40':'R1.4','AC1.50':'R2.0','AC2.10':'R2.10','AC1001':'R2.5','AC1002':'R2.6','AC1003':'R9','AC1004':'R10','AC1006':'R10','AC1009':'R11/R12','AC1012':'R13','AC1014':'R14','AC1015':'2000','AC1018':'2004','AC1021':'2007','AC1024':'2010','AC1027':'2013','AC1032':'2018'};
const dxfMeasure=(()=>{let c=null;return(t,h)=>{try{if(!c){c=document.createElement('canvas').getContext('2d');c.font='100px Arial,sans-serif'}return c.measureText(t).width/100*h*1.25}catch(e){return String(t).length*h*.62}}})();
function fmtOf(u){const h=String.fromCharCode(...u.subarray(0,6));
 if(u[0]===0xD0&&u[1]===0xCF&&u[2]===0x11&&u[3]===0xE0)return'dgn8';if(isDGN7(u))return'dgn7';
 if(/^(AC1\d{3}|AC[12]\.\d|MC0\.0)/.test(h))return'dwg';return isDXF(u)?'dxf':''}
async function parseAny(name,u){const f=fmtOf(u);
 if(f==='dgn8')return parseDGN(u);if(f==='dgn7')return parseDGN7(u);if(f==='dxf')return parseDXF(u,{measure:dxfMeasure});
 if(f==='dwg'){const v=String.fromCharCode(...u.subarray(0,6)).replace(/\0.*$/,''),k=Object.keys(DWGV).find(x=>v.startsWith(x));
  throw new Error('File DWG'+(k?' (AutoCAD '+DWGV[k]+')':'')+' chưa đọc trực tiếp được. Hãy lưu thành DXF (AutoCAD: Save As → DXF; MicroStation/gCadas: mở rồi Save As DXF hoặc DGN; hoặc phần mềm miễn phí ODA File Converter) rồi mở file đó.')}
 throw new Error('Không nhận ra định dạng file. M8 Mobile mở được DGN V8, DGN V7 và DXF (AutoCAD R12 → 2018+, dạng chữ và nhị phân).')}

const WA=6378137,WF=1/298.257223563,E2=WF*(2-WF),EP=E2/(1-E2),RAD=Math.PI/180;
const MER=p=>WA*((1-E2/4-3*E2*E2/64-5*E2**3/256)*p-(3*E2/8+3*E2*E2/32+45*E2**3/1024)*Math.sin(2*p)+(15*E2*E2/256+45*E2**3/1024)*Math.sin(4*p)-35*E2**3/3072*Math.sin(6*p));
function tmFwd(lat,lon,l0,k0){const p=lat*RAD,N=WA/Math.sqrt(1-E2*Math.sin(p)**2),T=Math.tan(p)**2,C=EP*Math.cos(p)**2,A=(lon-l0)*RAD*Math.cos(p);
 return[500000+k0*N*(A+(1-T+C)*A**3/6+(5-18*T+T*T+72*C-58*EP)*A**5/120),k0*(MER(p)+N*Math.tan(p)*(A*A/2+(5-T+9*C+4*C*C)*A**4/24+(61-58*T+T*T+600*C-330*EP)*A**6/720))]}
function tmInv(E,Nn,l0,k0){const x=E-500000,mu=Nn/k0/(WA*(1-E2/4-3*E2*E2/64-5*E2**3/256)),s=Math.sqrt(1-E2),e1=(1-s)/(1+s);
 const f1=mu+(3*e1/2-27*e1**3/32)*Math.sin(2*mu)+(21*e1*e1/16-55*e1**4/32)*Math.sin(4*mu)+151*e1**3/96*Math.sin(6*mu)+1097*e1**4/512*Math.sin(8*mu);
 const C=EP*Math.cos(f1)**2,T=Math.tan(f1)**2,N1=WA/Math.sqrt(1-E2*Math.sin(f1)**2),R1=WA*(1-E2)/(1-E2*Math.sin(f1)**2)**1.5,D=x/(N1*k0);
 const lat=f1-N1*Math.tan(f1)/R1*(D*D/2-(5+3*T+10*C-4*C*C-9*EP)*D**4/24+(61+90*T+298*C+45*T*T-252*EP-3*C*C)*D**6/720);
 const lon=l0*RAD+(D-(1+2*T+C)*D**3/6+(5-2*C+28*T-3*C*C+8*EP+24*T*T)*D**5/120)/Math.cos(f1);return[lat/RAD,lon/RAD]}
const HP={t:[-191.90441429,-39.30318279,-111.45032835],r:[-0.00928836,0.01975479,-0.00427372].map(v=>v*Math.PI/648000),s:0.252906278e-6};
function geo2ecef(la,lo,h){const p=la*RAD,l=lo*RAD,N=WA/Math.sqrt(1-E2*Math.sin(p)**2);return[(N+h)*Math.cos(p)*Math.cos(l),(N+h)*Math.cos(p)*Math.sin(l),(N*(1-E2)+h)*Math.sin(p)]}
function ecef2geo(X,Y,Z){const lo=Math.atan2(Y,X),q=Math.hypot(X,Y);let p=Math.atan2(Z,q*(1-E2)),h=0;for(let i=0;i<6;i++){const N=WA/Math.sqrt(1-E2*Math.sin(p)**2);h=q/Math.cos(p)-N;p=Math.atan2(Z,q*(1-E2*N/(N+h)))}return[p/RAD,lo/RAD,h]}
function helm(X,Y,Z){const[rx,ry,rz]=HP.r,k=1+HP.s;return[HP.t[0]+k*(X+rz*Y-ry*Z),HP.t[1]+k*(-rz*X+Y+rx*Z),HP.t[2]+k*(ry*X-rx*Y+Z)]}
function vn2wgs(la,lo,h=0){const c=geo2ecef(la,lo,h),w=helm(...c);return ecef2geo(...w).slice(0,2)}
function wgs2vn(la,lo,h=0){const w=geo2ecef(la,lo,h);let c=[w[0]-HP.t[0],w[1]-HP.t[1],w[2]-HP.t[2]];for(let i=0;i<4;i++){const f=helm(...c);c=[c[0]+w[0]-f[0],c[1]+w[1]-f[1],c[2]+w[2]-f[2]]}return ecef2geo(...c).slice(0,2)}
/* hạt giống DGN V8: cấu trúc + thiết lập (lớp, phông, kiểu đường, bảng màu, đơn vị m/mm, gốc toàn cục) lấy từ file V8 thật của gCadas, đã bỏ nội dung bản vẽ */
const D8SEED={"d":[["Root Entry",5,0,4294967295,4294967295,15,"",0],["Dgn~H",2,1,4294967295,4294967295,4294967295,"",0],["Dgn~S",2,1,1,3,4294967295,"",0],["Dgn-Md",1,1,4294967295,4294967295,4,"",0],["#000000",1,1,4294967295,4294967295,7,"",0],["Dgn^C",1,1,4294967295,4294967295,6,"",0],["$1",2,1,4294967295,4294967295,4294967295,"",0],["Dgn^G",1,1,5,12,31,"",0],["$1",2,1,4294967295,4294967295,4294967295,"",0],["Dgn^CA",1,0,4294967295,4294967295,10,"",0],["$1",2,1,4294967295,11,4294967295,"",0],["^AH",2,0,4294967295,4294967295,4294967295,"",0],["Dgn^GA",1,1,9,14,13,"",0],["^AH",2,1,4294967295,4294967295,4294967295,"",0],["Dgn~Mh",2,0,4294967295,4294967295,4294967295,"",0],["Dgn^Ix",1,1,2,21,16,"",0],["Dgn~Mix",2,1,4294967295,4294967295,4294967295,"",0],["Dgn^Nm",1,1,4294967295,4294967295,19,"",0],["$1",2,0,4294967295,4294967295,4294967295,"",0],["$2",2,1,18,20,4294967295,"",0],["$3",2,0,4294967295,4294967295,4294967295,"",0],["Dgn~Mf",2,1,17,26,4294967295,"",0],["Dgn^NmA",1,1,4294967295,4294967295,24,"",0],["$1",2,0,4294967295,4294967295,4294967295,"",0],["$3",2,1,23,25,4294967295,"",0],["^AH",2,0,4294967295,4294967295,4294967295,"",0],[".Embedded",1,0,22,29,27,"",0],[".Index",2,1,4294967295,4294967295,4294967295,"",0],["\u0005SummaryInformation",2,0,4294967295,4294967295,4294967295,"",0],["\u0005DocumentSummaryInformation",2,1,28,30,4294967295,"",0],["\u0005SebiesnrMkudrfcoIaamtykdDa",2,0,4294967295,4294967295,4294967295,"",0],["$2",2,1,8,33,4294967295,"",0],["$3",2,1,4294967295,4294967295,4294967295,"",0],["$4",2,0,32,34,4294967295,"",0],["$5",2,1,4294967295,35,4294967295,"",0],["$6",2,0,4294967295,4294967295,4294967295,"",0]],"s":{"1":"AQAEAAAAAAAAAAAAAAAAAAAAAAB4XmNgGAXogAOIM4CYCUmM7ziUt8FPmUOwymkKkHmBlYFBHknNKBi6gBGJhrHpCQbCzlEwCogFAMmFBMy4WAYt","2":"/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////w==","6":"BwAAAAMAAAAAAAAAAAAAAHhe7Zh/aFtVFMdP0qxJq5tZqaXVgUHSUqR2r+s201qam4w44krc7NpNplhHmoVJpdiOum7aTAQ7EJvGH6yysTIZ2/xF3cbU/SHZD6SyoPHH3JiyRsFZN5GAFToU4rnv3puX3DQMV6li36d837nnHO67j3vfu/ekAAAO1KICJspPzADE30p8Ut3nLgQFnUJUGcrAxTjU/EX4/JX4zm+bXnx0aih06PSaZQdpPERYfoA8fd2zOkmHyOIqGYjsLBl8SI7LPPV59ZPUfrx2m7WqIhiQ8yJeoxzY8voroZxxRPxG4015wZ7pn16zcnTz42MnMmOZ8eoVyx+znVWOyfl8cXn8AVIbCfufedXedEdsw8mOrXX3uSuutx5uz+xDCS6rmrhELEuPvNvwpX+T7ZycF/R7mBXzLvw0LnqxgFiffCxGTRaIFTaDv7GrsScj35XRvhnf37kly983lDp6sO3rZuYlnflsw76HDzwwMaz6Jijgf/SdBKCvLX918bkNmNfez7nGJgdmiUUO6OjMMfL5MCkS/6nzobIMzspZLV6jbN/sCJaflPMifqPx/m/nw/iqdIqhnw9zgk0OzBL9fND5t3GjXuMqRf0sEvx8SPkAFlDf8GZz8YVYcyxW4RwZaXHGYiH8XkewfcxZXx9D/4ozELDiTmRDKSiCWovqQHWjQqhBVBi1BzWKOowaQ32IiqLGUXHURVQCNYlKoqZd7KGil2uNY9GFxj9vjxmpf/xSrdF+aqHa7vixBJZ4l6ptgfAN3H8pUmfcUfre6u/7jztp3+ko60vZYVNqFYfyrPBngs5WmIvO1lWRSM9WayfdrX4HaHmip9fW1tPpB0PpaNRgbIKCGoOpxrBgwvP+XvuvwRWF+z1k7O0Gx29mcZP0flA0TgdCikXkFtG4VWz+i9iuD3AbvVhbXK3r29tgMV2rXb7tXTAIUOm7v453U9nt++wyRPPHy30XAmDV4uI++eLyfVK99OoGAkdNoIrO0TWRjkbPP6f0uSfazeAoMu8GeGOE8hE/BzSwIxTxNl0eOi9+0KqTCpD6kg6S5Q+eISw+xGz3B8zOQPE3z9PhMhDnkkAh965acu2HlffwuIWIjGlPKiXajKTTBux7oStH20IiL9t6la9yLMtPSTbppPNB50JDPM90zjxCqD17XuYxbB6OOIflBIV4CGto6xJQKVPjVhJMsvh8JnGX1pa/EY3Mb9fS0J3eeQnwXdiQ+QvDRMNIObdxfl8797Hm5tLR0dFhPEJ4g1t5P0pwX7Zekm21fYaxnPt2IvYcdh7/kXe/U5EqiFzE82o28zfv3+FlWlKpyHXWLyKRuDjdP2OddaLO6z13ykzCle94qiLrnLOps874t34aMQ279pv7tr3QuMnF/F28Js1Fr7PmB3qdNVturs5i/y3T6ywdHZ1/ivlbZ91dIlpuCFlofSXk28gT8Y2NZZ19btOGdb3fPXjn+r8AItwLRw==","10":"AQAAAAMAAAAAAAAAAAAAAHhek17IwODDwMCwigEC/CIgNCOYTAfTFgwMDSDe7Z91WXtKvtqf/x78eOnsP/YwPro4jIYaCTYDALw4I0A=","11":"AQAAAA==","13":"BgAAAA==","14":"eNpjZmBg4ADiDIZRMApGwSgYBaNgFIyCUTAKRsEoGAWjYBQMZ+AExAqMDAw/QDQWeTY8ermAWBDKFkRiMzB8sEehHfodkPmpZ/cehNBnD8K1XIjl5RCscqKJJ9HsR9D0AmjhgOEe+gFugUthwOhmYAdil9S0xNKcErg4E5DmAWLfxOKS1CIF3/yU1Bx2oLgwUAwklwtMICC+CIyfy8AAAEztJCQ=","16":"eF4T3MWwioWBgYGRATsIY+BjkADSAkD8o9KIy4UhlSGNIZGhlCGHoYTBF8gqBtKpDEUMCkBePkMKkJ3DYA/VPYUJTDkAACgTDAs=","18":"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","19":"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","20":"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","21":"eF4TYGQYBWgAABNnABI=","23":"AgAAAAIAAAAAAAAAAAAAAHhek17IwODDyMCwigECnkJpJjDJGQ4iNzEwNIBoZiAOY2FgqJizdMpZrkMGAi37Nz+w7lBvdbqsquX0VWmf517P1lcH9+3l7hTy993WcpZ/dmJZm2/Uuj2VhYuXX975+FDz7mMHJhuvfVZ9lr9nzaQ7nabSMqE9a+e9Pvn7kJ/71+i1OzZMS7zLE5M399yCs5LZnwXLU+b3fuKcbb5Sa/Ul8XKPB0KLm3/O2lcldVe2y+qieoyYvOovjZt25x5zz72UMf1J9pQnR/9cj/T/I+4tdoD93N1pTQwM7GAflCH54AUryAfcZbzfUlMSEhKSDrC869t3UMnhl6oxM7NAo+GuPdoT6linJCQ2JMg8aLbtYd3+5v///y+yHNi8GCLzZyq+kii08GL22H94YZtox1+JT5KfJIIeblKwnd+wrrr/+J1AAy63gxoSdQeO3jedwcgQlyVaBAxeBmlgOHMghfMVPggNkmNkyI4Asb9AXRnPwMBSBaRBGORinIAFmZPpgEoTBgnPmhlqXffqoovTC7Aw+OXnpULYoHAAAPVvnMk=","24":"AgAAAAMAAAAAAAAAAAAAAHhek17IwMDCwMCwigECLkFpEGAEYmmg/AQk+ctIcowM4uEguoaBoQEqjAJSz+49CKHPgmkE+GCPSuMCxMuD3AEAjPAQoQ==","25":"AwAAAA==","27":"eF4r9klzZSARAABH1QFr","29":"/v8AAAoAAgAAAAAAAAAAAAAAAAAAAAAAAQAAAALVzdWcLhsQk5cIACss+a4wAAAARAAAAAMAAAABAAAAKAAAAAAAAIAwAAAADwAAADgAAAAAAAAAAAAAAAIAAACwBAAAEwAAAAkEAAAfAAAAAQAAAAAAAAA="},"g":{"8":[1,2],"31":[2,3],"32":[3,2],"33":[4,2],"34":[5,2],"35":[6,3]},"h":1,"mh":14,"go":[-500000000.0,-1000000000.0,0.0],"nm3":20,"v98":[25192,25608,26024,26440,26856,27272,27688,28104],"si":28,"cp":30,"ids":[[132336,132677],[132679,139978],[139980,156798],[156800,171138],[171153,179304],[179316,181574],[181579,181756],[181760,182018],[182027,182030]]};
/* ===== Ghi DGN V8 (MicroStation V8 / V8i) =====
   File V8 là kho OLE2 (Compound File) gồm nhiều luồng; phần tử nằm trong /Dgn-Md/#000000/Dgn^G/$n (nén zlib).
   Bộ ghi dùng "hạt giống" D8SEED lấy từ một file V8 thật của gCadas (đã bỏ toàn bộ nội dung bản vẽ, ảnh thu nhỏ, tác giả):
   giữ nguyên bảng lớp, phông, kiểu đường, bảng màu, đơn vị (m / mm, 1 UOR = 1 mm) và gốc toàn cục;
   chỉ thay phần tử, vùng bao của model, bộ đếm id, thời gian và vị trí 8 khung nhìn.
   Toạ độ truyền vào là toạ độ người dùng (mm); toạ độ lưu = toạ độ người dùng + gốc toàn cục của hạt giống. */
const D8={
 b64(s){const b=atob(s),u=new Uint8Array(b.length);for(let i=0;i<b.length;i++)u[i]=b.charCodeAt(i);return u},
 cat(a){let n=0;for(const x of a)n+=x.length;const o=new Uint8Array(n);let p=0;for(const x of a){o.set(x,p);p+=x.length}return o},
 // zlib: dùng CompressionStream nếu có, không thì khối "stored" (không nén) – zlib nào cũng đọc được
 async zip(u){
  if(typeof CompressionStream==='function'){try{const cs=new CompressionStream('deflate'),w=cs.writable.getWriter();w.write(u);w.close();return new Uint8Array(await new Response(cs.readable).arrayBuffer())}catch(e){}}
  const parts=[Uint8Array.of(0x78,0x01)];let a=1,b=0;for(const x of u){a=(a+x)%65521;b=(b+a)%65521}
  for(let i=0;i<u.length||i===0;i+=65535){const n=Math.min(65535,u.length-i),h=new Uint8Array(5);h[0]=i+65535>=u.length?1:0;h[1]=n&255;h[2]=n>>8;h[3]=~n&255;h[4]=(~n>>8)&255;parts.push(h,u.subarray(i,i+n));if(!u.length)break}
  parts.push(Uint8Array.of(b>>8,b&255,a>>8,a&255));return D8.cat(parts)},
 async unzip(u){const ds=new DecompressionStream('deflate'),w=ds.writable.getWriter();w.write(u);w.close();return new Uint8Array(await new Response(ds.readable).arrayBuffer())},
 i64(v,o,x){const hi=Math.floor(x/4294967296);v.setUint32(o,x-hi*4294967296,true);v.setInt32(o+4,hi,true)},
 ft(ms){return BigInt(Math.round(ms))*10000n+116444736000000000n},   // FILETIME
 // ----- Compound File (OLE2) v3: sector 512, mini sector 64, ngưỡng 4096 -----
 cfb(ents,data,now){
  const SS=512,MS=64,CUT=4096,FREE=0xFFFFFFFF,EOC=0xFFFFFFFE,n=ents.length,start=new Array(n).fill(EOC),size=new Array(n).fill(0),mfat=[],mparts=[],bigs=[],sec=[],fat=[];
  for(let i=0;i<n;i++){if(ents[i][1]!==2)continue;const d=data[i]||new Uint8Array(0);size[i]=d.length;if(!d.length)continue;
   if(d.length<CUT){const ns=Math.ceil(d.length/MS),s0=mfat.length;for(let k=0;k<ns;k++)mfat.push(k===ns-1?EOC:s0+k+1);start[i]=s0;const p=new Uint8Array(ns*MS);p.set(d);mparts.push(p)}
   else bigs.push(i)}
  const ms=D8.cat(mparts);
  const chain=u=>{const ns=Math.ceil(u.length/SS);if(!ns)return EOC;const s0=fat.length;for(let k=0;k<ns;k++){fat.push(k===ns-1?EOC:s0+k+1);const b=new Uint8Array(SS);b.set(u.subarray(k*SS,Math.min(u.length,(k+1)*SS)));sec.push(b)}return s0};
  for(const i of bigs)start[i]=chain(data[i]);
  const rootStart=ms.length?chain(ms):EOC;
  let mfStart=EOC,nmf=0;if(mfat.length){const nb=Math.ceil(mfat.length/128)*128,u=new Uint8Array(nb*4),v=new DataView(u.buffer);for(let k=0;k<nb;k++)v.setUint32(4*k,k<mfat.length?mfat[k]:FREE,true);nmf=nb/128;mfStart=chain(u)}
  const nd=Math.ceil(n/4)*4,dir=new Uint8Array(nd*128),dv=new DataView(dir.buffer),FT=D8.ft(now);
  for(let i=0;i<nd;i++){const o=i*128;if(i>=n){dv.setUint32(o+68,FREE,true);dv.setUint32(o+72,FREE,true);dv.setUint32(o+76,FREE,true);continue}
   const[name,type,color,l,r,c,cls,state]=ents[i];for(let k=0;k<name.length;k++)dv.setUint16(o+2*k,name.charCodeAt(k),true);
   dv.setUint16(o+64,(name.length+1)*2,true);dir[o+66]=type;dir[o+67]=color;dv.setUint32(o+68,l,true);dv.setUint32(o+72,r,true);dv.setUint32(o+76,c,true);
   if(cls)for(let k=0;k<16;k++)dir[o+80+k]=parseInt(cls.substr(2*k,2),16);dv.setUint32(o+96,state,true);
   if(type===1){dv.setBigUint64(o+100,FT,true);dv.setBigUint64(o+108,FT,true)}
   if(type===5){dv.setBigUint64(o+108,FT,true);dv.setUint32(o+116,rootStart,true);dv.setUint32(o+120,ms.length,true)}
   else if(type===2){dv.setUint32(o+116,start[i],true);dv.setUint32(o+120,size[i],true)}}
  const dirStart=chain(dir);
  let nf=1;while(sec.length+nf>nf*128)nf++;if(nf>109)throw new Error('File quá lớn');
  const fs0=sec.length;for(let k=0;k<nf;k++)fat.push(0xFFFFFFFD);
  for(let k=0;k<nf;k++){const b=new Uint8Array(SS),v=new DataView(b.buffer);for(let j=0;j<128;j++){const x=fat[k*128+j];v.setUint32(4*j,x===undefined?FREE:x,true)}sec.push(b)}
  const h=new Uint8Array(512),hv=new DataView(h.buffer);h.set([0xD0,0xCF,0x11,0xE0,0xA1,0xB1,0x1A,0xE1]);
  hv.setUint16(24,0x3E,true);hv.setUint16(26,3,true);hv.setUint16(28,0xFFFE,true);hv.setUint16(30,9,true);hv.setUint16(32,6,true);
  hv.setUint32(44,nf,true);hv.setUint32(48,dirStart,true);hv.setUint32(56,CUT,true);hv.setUint32(60,mfStart,true);hv.setUint32(64,nmf,true);hv.setUint32(68,EOC,true);
  for(let k=0;k<109;k++)hv.setUint32(76+4*k,k<nf?fs0+k:FREE,true);
  return D8.cat([h,...sec])},
 // ----- bộ thuộc tính OLE (SummaryInformation…) -----
 pset(fmtid,props){ // props: [[pid, 'i2'|'u4'|'s'|'t', value]]
  const vals=props.map(([pid,k,x])=>{let u;
   if(k==='i2'){u=new Uint8Array(8);const v=new DataView(u.buffer);v.setUint32(0,2,true);v.setInt16(4,x,true)}
   else if(k==='u4'){u=new Uint8Array(8);const v=new DataView(u.buffer);v.setUint32(0,0x13,true);v.setUint32(4,x,true)}
   else if(k==='t'){u=new Uint8Array(12);const v=new DataView(u.buffer);v.setUint32(0,0x40,true);v.setBigUint64(4,D8.ft(x),true)}
   else{const s=String(x),nc=s.length+1;u=new Uint8Array(8+Math.ceil(nc*2/4)*4);const v=new DataView(u.buffer);v.setUint32(0,0x1f,true);v.setUint32(4,nc,true);for(let i=0;i<s.length;i++)v.setUint16(8+2*i,s.charCodeAt(i),true)}
   return[pid,u]});
  let off=8+8*vals.length;const tbl=new Uint8Array(off),tv=new DataView(tbl.buffer);
  vals.forEach(([pid,u],i)=>{tv.setUint32(8+8*i,pid>>>0,true);tv.setUint32(12+8*i,off,true);off+=u.length});
  tv.setUint32(0,off,true);tv.setUint32(4,vals.length,true);
  const hd=new Uint8Array(48),hv=new DataView(hd.buffer);hv.setUint16(0,0xFFFE,true);hv.setUint32(4,0x0002000A,true);hv.setUint32(24,1,true);
  for(let k=0;k<16;k++)hd[28+k]=parseInt(fmtid.substr(2*k,2),16);hv.setUint32(44,48,true);
  return D8.cat([hd,tbl,...vals.map(v=>v[1])])},
 // ----- phần tử -----
 // tiêu đề chung 104 byte; r = [xmin,ymin,xmax,ymax] (toạ độ lưu), vùng bao lưu dạng số nguyên: thấp = floor(min), cỡ = ceil(max) − floor(min)
 el(type,len,ao,lv,wt,col,st,r){const a=new Uint8Array(len),v=new DataView(a.buffer);
  v.setUint32(0,(0x10c0<<16)|type,true);v.setUint32(4,len/2,true);v.setUint32(8,ao/2,true);v.setUint32(12,lv,true);
  v.setUint32(40,0x600,true);v.setInt32(44,st||0,true);v.setUint32(48,wt||0,true);v.setUint32(52,col||0,true);
  const x0=Math.floor(r[0]),y0=Math.floor(r[1]);D8.i64(v,56,x0);D8.i64(v,64,y0);D8.i64(v,80,Math.ceil(r[2])-x0);D8.i64(v,88,Math.ceil(r[3])-y0);
  return{a,v,r:[x0,y0,Math.ceil(r[2]),Math.ceil(r[3])]}},
 line(lv,wt,col,x1,y1,x2,y2,st){const e=D8.el(3,136,136,lv,wt,col,st,[Math.min(x1,x2),Math.min(y1,y2),Math.max(x1,x2),Math.max(y1,y2)]);
  e.v.setFloat64(104,x1,true);e.v.setFloat64(112,y1,true);e.v.setFloat64(120,x2,true);e.v.setFloat64(128,y2,true);return e},
 // đường gấp khúc (type 4) hoặc hình kín (type 6, điểm cuối = điểm đầu); tối đa 5000 đỉnh/phần tử
 poly(shape,lv,wt,col,pts,st){const out=[];const q=[];for(const p of pts)if(!q.length||p[0]!==q[q.length-1][0]||p[1]!==q[q.length-1][1])q.push(p);
  if(q.length<2)return out;if(q.length===2&&!shape)return[D8.line(lv,wt,col,q[0][0],q[0][1],q[1][0],q[1][1],st)];
  if(shape&&(q[0][0]!==q[q.length-1][0]||q[0][1]!==q[q.length-1][1]))q.push(q[0].slice());if(shape&&(q.length<4||q.length>5000))shape=false;
  for(let i=0;;i+=4999){const s=q.slice(i,i+5000);if(s.length<2)break;const len=112+16*s.length,xs=s.map(p=>p[0]),ys=s.map(p=>p[1]);
   const e=D8.el(shape?6:4,len,len,lv,wt,col,st,[Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)]);e.v.setUint32(104,s.length,true);
   s.forEach((p,k)=>{e.v.setFloat64(112+16*k,p[0],true);e.v.setFloat64(120+16*k,p[1],true)});out.push(e);if(i+5000>=q.length)break}
  return out},
 // chữ TrueType Unicode: (x,y) gốc đường chân chữ bên trái; h = chiều cao chữ hoa; w = bề rộng ô chữ (= h khi không co giãn); L = chiều dài cả dòng; rot rad (ngược chiều kim đồng hồ)
 text(lv,wt,col,font,x,y,h,w,L,rot,s){s=String(s);const nb=2+2*s.length,body=170+nb+(nb&1),len=body+16,c=Math.cos(rot),sn=Math.sin(rot);
  const P=[[0,-h/2],[L,-h/2],[L,1.5*h],[0,1.5*h]].map(([u,v])=>[x+u*c-v*sn,y+u*sn+v*c]),xs=P.map(p=>p[0]),ys=P.map(p=>p[1]);
  const e=D8.el(17,len,body,lv,wt,col,0,[Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)]),v=e.v,a=e.a;
  v.setUint32(104,font,true);v.setUint16(110,nb,true);v.setFloat64(112,w*1000/6,true);v.setFloat64(120,h*1000/6,true);v.setFloat64(128,L,true);v.setFloat64(136,h,true);
  v.setFloat64(144,rot,true);v.setFloat64(152,x,true);v.setFloat64(160,y,true);a[170]=0xFF;a[171]=0xFE;for(let i=0;i<s.length;i++)v.setUint16(172+2*i,s.charCodeAt(i),true);
  a.set([0x07,0x10,0xd4,0x80,0x00,0x02,0,0,0,0,0,0,0xe4,0x04,0,0],body);return e},
 // ô (cell) 2D có tên: phần tử đầu type 2 (cờ complex) + các phần tử con (cờ component) ngay sau; tên lưu ở liên kết chuỗi 0x56d2 khoá 1
 // (như tên lớp và cell định nghĩa kiểu đường trong file V8 thật); ma trận đơn vị, gốc (ox,oy), vùng bao cục bộ = vùng bao − gốc
 cell(lv,name,ox,oy,comps){name=String(name).replace(/[^\x20-\x7e]/g,'_').slice(0,60);const nb=name.length,lk=Math.ceil((13+nb)/8)*8,len=192+lk,r=[1/0,1/0,-1/0,-1/0];let cls=0;
  for(const c of comps){r[0]=Math.min(r[0],c.r[0]);r[1]=Math.min(r[1],c.r[1]);r[2]=Math.max(r[2],c.r[2]);r[3]=Math.max(r[3],c.r[3]);cls|=1<<(c.v.getUint32(40,true)&15);c.v.setUint32(0,(0x50c0<<16)|c.a[0],true);c.comp=true}
  const e=D8.el(2,len,192,lv,0,0,0,r),v=e.v,R=e.r;v.setUint32(0,(0x30c0<<16)|2,true);v.setUint32(40,0xc600,true);v.setUint32(104,comps.length,true);v.setUint16(108,cls||1,true);
  v.setFloat64(112,R[0]-ox,true);v.setFloat64(120,R[1]-oy,true);v.setFloat64(128,R[2]-ox,true);v.setFloat64(136,R[3]-oy,true);v.setFloat64(144,1,true);v.setFloat64(168,1,true);v.setFloat64(176,ox,true);v.setFloat64(184,oy,true);
  v.setUint16(192,0x1000|(lk/2-1),true);v.setUint16(194,0x56d2,true);v.setUint32(196,1,true);v.setUint32(200,nb,true);for(let i=0;i<nb;i++)e.a[204+i]=name.charCodeAt(i);
  return[e,...comps]},
 // ----- ghép file -----
 // els: phần tử từ D8.line/poly/text (toạ độ đã cộng gốc toàn cục); view = [xmin,ymin,xmax,ymax] vùng khung nhìn (toạ độ lưu); name = tên file
 async file(els,view,name,go){
  const S=D8SEED,now=Date.now(),ents=S.d,data=[];
  for(const k in S.s)data[+k]=D8.b64(S.s[k]);
  // phần tử: id lấy trong các dải id còn trống của hạt giống (≤ bộ đếm id của file nên giữ nguyên luồng Dgn~H), thời gian;
  // gom vào các khối Dgn^G/$n (tối đa ~120 KB mỗi khối), khối thừa để trống như file mẫu
  let ri=0,id=S.ids[0][0];const R=[1/0,1/0,-1/0,-1/0];
  for(const e of els){if(id>S.ids[ri][1]){ri++;if(ri>=S.ids.length)throw new Error('Phiếu có quá nhiều phần tử');id=S.ids[ri][0]}
   e.v.setUint32(16,id++,true);e.v.setFloat64(24,now,true);R[0]=Math.min(R[0],e.r[0]);R[1]=Math.min(R[1],e.r[1]);R[2]=Math.max(R[2],e.r[2]);R[3]=Math.max(R[3],e.r[3])}
  const gk=Object.keys(S.g).map(Number).sort((a,b)=>S.g[a][0]-S.g[b][0]),chunks=[[]];let cs=0;
  for(const e of els){if(cs+e.a.length>120000&&chunks[chunks.length-1].length&&!e.comp){chunks.push([]);cs=0}chunks[chunks.length-1].push(e);cs+=e.a.length+4}
  if(chunks.length>gk.length)throw new Error('Phiếu có quá nhiều phần tử');
  for(let j=0;j<gk.length;j++){const i=gk[j],ch=chunks[j]||[],hd=new Uint8Array(16),hv=new DataView(hd.buffer);hv.setUint32(0,ch.length,true);hv.setUint32(4,S.g[i][1],true);
   if(!ch.length){data[i]=hd;continue}const parts=[];for(const e of ch)parts.push(new Uint8Array(4),e.a);data[i]=D8.cat([hd,await D8.zip(D8.cat(parts))])}
  // model header: thời gian + vùng bao toàn bộ phần tử
  {const d=await D8.unzip(data[S.mh]),v=new DataView(d.buffer);v.setFloat64(0x108c,now,true);if(go){v.setFloat64(0x1074,go[0],true);v.setFloat64(0x107c,go[1],true)}
   if(els.length){D8.i64(v,0x1094,R[0]);D8.i64(v,0x109c,R[1]);D8.i64(v,0x10a4,0);D8.i64(v,0x10ac,R[2]);D8.i64(v,0x10b4,R[3]);D8.i64(v,0x10bc,0)}
   data[S.mh]=await D8.zip(d)}
  // 8 khung nhìn: đặt gốc / kích thước cho thấy trọn phiếu khi mở (khung nhìn đang mở thì giữ tỉ lệ cửa sổ)
  {const raw=data[S.nm3],d=await D8.unzip(raw.subarray(16)),v=new DataView(d.buffer);
   for(const o of S.v98){let[x0,y0,x1,y1]=view,w=x1-x0,h=y1-y0;const r0=v.getUint16(o+0xf0,true),r1=v.getUint16(o+0xf2,true),r2=v.getUint16(o+0xf4,true),r3=v.getUint16(o+0xf6,true),ar=(r2-r0)/(r3-r1);
    if(r2>r0&&r3>r1&&isFinite(ar)&&ar>.2&&ar<8){if(w/h<ar){const W=h*ar;x0-=(W-w)/2;w=W}else{const H=w/ar;y0-=(H-h)/2;h=H}}
    v.setFloat64(o+0x90,x0,true);v.setFloat64(o+0x98,y0,true);v.setFloat64(o+0xa8,w,true);v.setFloat64(o+0xb0,h,true)}
   data[S.nm3]=D8.cat([raw.subarray(0,16),await D8.zip(d)])}
  // thuộc tính tài liệu: không tác giả, không ảnh thu nhỏ
  data[S.si]=D8.pset('e0859ff2f94f6810ab9108002b27b3d9',[[1,'i2',1200],[0x80000000,'u4',0x409],[9,'s','1'],[12,'t',now],[13,'t',now],[8,'s','M8 Mobile'],[18,'s','M8 Mobile']]);
  data[S.cp]=D8.pset('920444648b4cd1118b70080036b11a03',[[1,'i2',1200],[0x80000000,'u4',0x409],[4,'s',String(name||'phieu.dgn')]]);
  return D8.cfb(ents,data,now)}
};
const GTP_KEY='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';
const GTP_CDN=['https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/','https://cdn.jsdelivr.net/npm/sql.js@1.10.3/dist/'];
const gtpKeyOf=n=>'gtp:'+String(n||'').replace(/^.*[\\/]/,'').replace(/\.(dgn|dxf|dwg|gtp)$/i,'').trim().toLowerCase();
const GTP_MG=[83,81,76,105,116,101,32,102,111,114,109,97,116,32,51,0],gtpIsSQL=u=>GTP_MG.every((b,i)=>u[i]===b);
let _gtpK=null;const gtpK0=()=>_gtpK||(_gtpK=Uint8Array.from(atob(GTP_KEY),c=>c.charCodeAt(0)));
const gtpX=(u,K)=>{const o=new Uint8Array(u.length);for(let i=0;i<u.length;i++)o[i]=u[i]^K[i&4095];return o};
// suy khoá từ chính file: phần lớn byte trong file SQLite là 0 → byte hay gặp nhất ở mỗi vị trí trong khối 4096 chính là byte khoá
function gtpDerive(u){const n=u.length>>12,K=new Uint8Array(4096),c=new Uint32Array(256);for(let j=0;j<4096;j++){c.fill(0);for(let p=0;p<n;p++)c[u[p*4096+j]]++;let b=0;for(let v=1;v<256;v++)if(c[v]>c[b])b=v;K[j]=b}
 for(let i=0;i<16;i++)K[i]=u[i]^GTP_MG[i];return K}
function gtpLibLoad(){if(_gtpLib)return _gtpLib;
 const one=base=>new Promise((ok,no)=>{const go=()=>window.initSqlJs({locateFile:f=>base+f}).then(ok,no);if(window.initSqlJs)return go();
  const s=document.createElement('script');s.src=base+'sql-wasm.js';s.onload=go;s.onerror=()=>{s.remove();no(new Error('net'))};document.head.appendChild(s)});
 _gtpLib=one(GTP_CDN[0]).catch(()=>{try{delete window.initSqlJs}catch(e){window.initSqlJs=undefined}return one(GTP_CDN[1])})
  .catch(()=>{_gtpLib=null;throw new Error('Không tải được bộ đọc file .gtp — cần mạng ở lần dùng đầu tiên')});return _gtpLib}
async function gtpDB(u8){const SQL=await gtpLibLoad();if(!u8||u8.length<1024)throw new Error('File quá nhỏ — không phải file thuộc tính .gtp');
 const tries=gtpIsSQL(u8)?[null]:[gtpK0(),gtpDerive(u8)];let er='';
 for(const K of tries){const p=K?gtpX(u8,K):u8;if(!gtpIsSQL(p))continue;
  try{const db=new SQL.Database(p),r=db.exec('pragma quick_check'),ok=r[0]&&r[0].values[0][0];if(ok==='ok')return{db,key:K};er=String(ok);db.close()}catch(e){er=e.message}}
 throw new Error('Không đọc được file .gtp'+(er?' ('+er+')':'')+' — có đúng là file thuộc tính gCadas không?')}
// ---- truy vấn ----
function gq(db,sql,p){const st=db.prepare(sql);if(p)st.bind(p);const r=[];while(st.step())r.push(st.get());st.free();return r}
function gqo(db,sql,p){const st=db.prepare(sql);if(p)st.bind(p);const c=st.getColumnNames(),r=[];while(st.step()){const v=st.get(),o={};for(let i=0;i<c.length;i++)o[c[i]]=v[i];r.push(o)}st.free();return r}
const gqi=n=>'"'+String(n).replace(/"/g,'""')+'"';
const gtpU=s=>String(s==null?'':s).normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').toLowerCase();
const gtpBit=v=>String(v==null?'':v).replace(/'/g,'').trim()==='1';
const gtpNK=(t,s)=>{const a=String(t==null?'':t).trim(),b=String(s==null?'':s).trim();return(/^\d+(\.0+)?$/.test(a)?String(parseInt(a,10)):a)+'|'+(/^\d+(\.0+)?$/.test(b)?String(parseInt(b,10)):b)};
// hình thửa: WKB (Polygon / MultiPolygon, 2D) → các vòng toạ độ mét
function gtpWKB(b){if(!b||!b.length||b.length<9)return null;const dv=new DataView(b.buffer,b.byteOffset,b.byteLength),R=[];
 const rd=o=>{const le=b[o]===1,t=dv.getUint32(o+1,le)%1000;o+=5;
  if(t===3){const nr=dv.getUint32(o,le);o+=4;for(let r=0;r<nr;r++){const n=dv.getUint32(o,le);o+=4;const a=new Float64Array(2*n);for(let i=0;i<2*n;i++){a[i]=dv.getFloat64(o,le);o+=8}R.push(a)}return o}
  if(t===6){const np=dv.getUint32(o,le);o+=4;for(let p=0;p<np;p++)o=rd(o);return o}throw 0};
 try{rd(0)}catch(e){}return R.length?R:null}
// ---- tên cột tiếng Việt ----
const GTP_LAB={soHieuToBanDo:'Tờ bản đồ',soThuTuThua:'Số thửa',dienTich:'Diện tích (m²)',dienTichPhapLy:'Diện tích pháp lý (m²)',mucDichSuDungGhep:'Loại đất (ký hiệu)',laMucDichChinh:'Mục đích chính',loaiMucDichSuDungKiemKeId:'Loại đất chi tiết',loaiMucDichSuDungId:'Loại đất chi tiết',diaChi:'Địa chỉ',ghiChu:'Ghi chú',
 soHieuToBanDoCu:'Tờ cũ',soThuTuThuaCu:'Thửa cũ',dienTichCu:'Diện tích cũ (m²)',loaiDatCu:'Loại đất cũ',inSoLieuCu:'In số liệu cũ',nguonGocHinhThanh:'Nguồn gốc hình thành',thoiDiemHinhThanh:'Thời điểm hình thành',
 loaiGiayToHienCo:'Giấy tờ hiện có',dienTichTrenGiayTo:'Diện tích trên giấy tờ (m²)',tinhHinhThayDoiRanhGioi:'Tình hình thay đổi ranh giới',soHieuThuaTam:'Số thửa tạm',loaiDuong:'Loại đường',viTri:'Vị trí',hangDat:'Hạng đất',
 khuDanCu:'Thuộc khu dân cư',datDoThi:'Đất đô thị',chuaGiaoDat:'Chưa giao đất',dienTichTrongQuyHoach:'DT trong quy hoạch (m²)',dienTichNgoaiQuyHoach:'DT ngoài quy hoạch (m²)',soHieuToBanDoGoc:'Tờ gốc',maThua:'Mã thửa',
 TamX:'Tâm X – Đông (m)',TamY:'Tâm Y – Bắc (m)',hoTen:'Họ tên',namSinh:'Năm sinh',ngaySinh:'Ngày sinh',gioiTinh:'Giới tính nam',hoTen2:'Họ tên vợ/chồng',namSinh2:'Năm sinh vợ/chồng',ngaySinh2:'Ngày sinh vợ/chồng',
 gioiTinh2:'Vợ/chồng giới tính nam',diaChi2:'Địa chỉ vợ/chồng',maSoThue:'Mã số thuế',maSoThue2:'Mã số thuế vợ/chồng',soDienThoai:'Điện thoại',soDiDong:'Di động',hoGiaDinh:'Hộ gia đình',inHoOngBa:'In “Hộ ông/bà”',
 daChet:'Đã mất',namMat:'Năm mất',ngayMat:'Ngày mất',daChet2:'Vợ/chồng đã mất',namMat2:'Năm mất vợ/chồng',ngayMat2:'Ngày mất vợ/chồng',voChongDongSuDung:'Vợ chồng đồng sử dụng',nhanTheChap:'Nhận thế chấp',
 chuaXacDinhGioiTinh:'Chưa xác định giới tính',chuaXacDinhGioiTinh2:'Vợ/chồng chưa xác định giới tính',ten:'Tên',hoDem:'Họ đệm',ten2:'Tên vợ/chồng',hoDem2:'Họ đệm vợ/chồng',
 loaiGiayTo:'Loại giấy tờ',soGiayTo:'Số giấy tờ',ngayCap:'Ngày cấp',ngayHetHan:'Ngày hết hạn',noiCap:'Nơi cấp',laThongTinChinh:'Giấy tờ chính',
 loaiDat:'Loại đất',hinhThucSuDung:'Hình thức sử dụng',thoiHanSuDung:'Thời hạn sử dụng',nguonGocSuDung:'Nguồn gốc sử dụng',nghiaVuTaiChinh:'Nghĩa vụ tài chính',hanCheSuDung:'Hạn chế sử dụng',
 quyenSuDungHanChe:'Quyền sử dụng hạn chế',ngayDangKyLanDau:'Ngày đăng ký lần đầu',ngayVaoSoDiaChinh:'Ngày vào sổ',giayToNguonGoc:'Giấy tờ nguồn gốc',soPhatHanh:'Số phát hành GCN',soVaoSo:'Số vào sổ cấp GCN',
 thuTucDangKy:'Thủ tục đăng ký',taiLieuDoDac:'Tài liệu đo đạc',trangSo:'Trang sổ',tenTaiSan:'Tên tài sản',maNguonGoc:'Mã nguồn gốc',
 tenChuCu:'Tên chủ cũ',tenVoChongCu:'Tên vợ/chồng cũ',diaChiCu:'Địa chỉ cũ',soPhatHanhCu:'Số phát hành GCN cũ',soVaoSoCu:'Số vào sổ cũ',ngayCapCu:'Ngày cấp GCN cũ',viTriCu:'Vị trí cũ',maVachCu:'Mã vạch cũ',
 nguoiKyGCNCu:'Người ký GCN cũ',canCuPhapLyCu:'Căn cứ pháp lý cũ',loaiGiayChungNhanCu:'Loại GCN cũ'};
const gtpLab=c=>GTP_LAB[c]||c.replace(/([a-z])([A-Z0-9])/g,'$1 $2').replace(/^./,x=>x.toUpperCase());
// cột nội bộ (khoá, liên kết, đồng bộ, hình) — chỉ đọc hoặc ẩn
const GTP_HIDE=/(Id\d*|ID\d*)$|^id$|^uid$|^u[A-Z]|FTS$|^geom$|^trangThai$|^path$|^maTrinhBay$|^dienTich(BanDo|DaMucDichSuDung|Chuan)$|^saoLuu/;
const GTP_RO=/^(TamX|TamY|dienTich)$/;
// trường hay dùng (hiện trước), còn lại nằm trong “Thêm trường”
const GTP_MAIN={ThuaDat:['soHieuToBanDo','soThuTuThua','dienTich','dienTichPhapLy','mucDichSuDungGhep','diaChi','ghiChu','loaiGiayToHienCo','dienTichTrenGiayTo','tinhHinhThayDoiRanhGioi','nguonGocHinhThanh','thoiDiemHinhThanh','soHieuToBanDoCu','soThuTuThuaCu','dienTichCu','loaiDatCu','soHieuThuaTam'],
 Nguoi:['hoTen','namSinh','gioiTinh','diaChi','hoTen2','namSinh2','gioiTinh2','diaChi2','soDienThoai','maSoThue','ghiChu'],ThongTinBoSung:['loaiGiayTo','soGiayTo','ngayCap','noiCap'],
 TbTrangSoDiaChinh:['loaiDat','dienTich','hinhThucSuDung','thoiHanSuDung','nguonGocSuDung','soPhatHanh','soVaoSo','ngayVaoSoDiaChinh','taiLieuDoDac','trangSo'],
 ThuaDatCu:['soHieuToBanDoCu','soThuTuThuaCu','dienTichCu','tenChuCu','diaChiCu','soPhatHanhCu','soVaoSoCu','ngayCapCu']};
const GTP_PK={ThuaDat:'thuaDatId',Nguoi:'nguoiId',ThongTinBoSung:'thongTinBoSungId',TbTrangSoDiaChinh:'trangSoDiachinhId',ThuaDatCu:'id',DaMucDichSuDung:'daMucDichSuDungId',DangKyThua:'dangKyThuaId'};
// ---- mở file, dựng danh sách thửa ----
function gtpSchema(db){const T={};for(const[n]of gq(db,"select name from sqlite_master where type='table'")){const cs=gq(db,'pragma table_info('+gqi(n)+')');
 T[n]={cols:cs.map(c=>c[1]),type:Object.fromEntries(cs.map(c=>[c[1],String(c[2]||'').toUpperCase()])),pk:(cs.filter(c=>c[5]).length===1?cs.find(c=>c[5])[1]:null)}}return T}

/* ====================== PHẦN BỔ SUNG CỦA M8 PRO ====================== */
let _gtpLib=null;
// ---------- Ghi đường tròn / elip (type 15) ----------
D8.ellipse=function(lv,wt,col,a,b,rot,cx,cy,st){const R=Math.max(a,b),e=D8.el(15,144,144,lv,wt,col,st,[cx-R,cy-R,cx+R,cy+R]);
 e.v.setFloat64(104,a,true);e.v.setFloat64(112,b,true);e.v.setFloat64(120,rot||0,true);e.v.setFloat64(128,cx,true);e.v.setFloat64(136,cy,true);return e};

// ---------- Lưu trữ trên máy (IndexedDB) ----------
const IDB={_d:null,
 db(){if(this._d)return this._d;this._d=new Promise((ok,no)=>{try{const r=indexedDB.open('m8pro',1);r.onupgradeneeded=()=>r.result.createObjectStore('kv');r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)}catch(e){no(e)}});return this._d},
 async get(k){try{const d=await this.db();return await new Promise((ok,no)=>{const q=d.transaction('kv').objectStore('kv').get(k);q.onsuccess=()=>ok(q.result);q.onerror=()=>no(q.error)})}catch(e){return null}},
 async set(k,v){try{const d=await this.db();await new Promise((ok,no)=>{const t=d.transaction('kv','readwrite');t.objectStore('kv').put(v,k);t.oncomplete=ok;t.onerror=()=>no(t.error)})}catch(e){}},
 async del(k){try{const d=await this.db();await new Promise(ok=>{const t=d.transaction('kv','readwrite');t.objectStore('kv').delete(k);t.oncomplete=ok;t.onerror=ok})}catch(e){}}};

// ---------- Hình học ----------
const GEO={
 d2:(ax,ay,bx,by)=>(ax-bx)**2+(ay-by)**2,
 dist:(ax,ay,bx,by)=>Math.hypot(ax-bx,ay-by),
 // khoảng cách điểm → đoạn, trả về [d², t, qx, qy]
 segPt(px,py,ax,ay,bx,by){const dx=bx-ax,dy=by-ay,L=dx*dx+dy*dy;let t=L?((px-ax)*dx+(py-ay)*dy)/L:0;t=t<0?0:t>1?1:t;const qx=ax+t*dx,qy=ay+t*dy;return[(px-qx)**2+(py-qy)**2,t,qx,qy]},
 // giao 2 đoạn: trả về [x,y,t,u] hoặc null; inf=true: giao 2 đường thẳng
 segX(ax,ay,bx,by,cx,cy,dx,dy,inf){const r1=bx-ax,r2=by-ay,s1=dx-cx,s2=dy-cy,den=r1*s2-r2*s1;if(Math.abs(den)<1e-12)return null;
  const t=((cx-ax)*s2-(cy-ay)*s1)/den,u=((cx-ax)*r2-(cy-ay)*r1)/den;if(!inf&&(t<-1e-9||t>1+1e-9||u<-1e-9||u>1+1e-9))return null;return[ax+t*r1,ay+t*r2,t,u]},
 area(p){let a=0;const n=p.length/2;for(let i=0,j=n-1;i<n;j=i++)a+=(p[2*j]+p[2*i])*(p[2*j+1]-p[2*i+1]);return-a/2},   // >0: ngược chiều kim đồng hồ
 len(p,closed){let s=0;const n=p.length/2;for(let i=1;i<n;i++)s+=Math.hypot(p[2*i]-p[2*i-2],p[2*i+1]-p[2*i-1]);if(closed&&n>2)s+=Math.hypot(p[0]-p[2*n-2],p[1]-p[2*n-1]);return s},
 inPoly(x,y,p){let c=false;const n=p.length/2;for(let i=0,j=n-1;i<n;j=i++){const xi=p[2*i],yi=p[2*i+1],xj=p[2*j],yj=p[2*j+1];if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)c=!c}return c},
 centroid(p){let a=0,cx=0,cy=0;const n=p.length/2;for(let i=0,j=n-1;i<n;j=i++){const f=p[2*j]*p[2*i+1]-p[2*i]*p[2*j+1];a+=f;cx+=(p[2*j]+p[2*i])*f;cy+=(p[2*j+1]+p[2*i+1])*f}
  if(Math.abs(a)<1e-9){let sx=0,sy=0;for(let i=0;i<n;i++){sx+=p[2*i];sy+=p[2*i+1]}return[sx/n,sy/n]}return[cx/(3*a),cy/(3*a)]},
 // điểm nằm trong đa giác, xa ranh nhất (vị trí đặt nhãn) – tìm theo lưới thô rồi tinh
 labelPt(rings){const o=rings[0];let bx=1/0,by=1/0,ex=-1/0,ey=-1/0;for(let i=0;i<o.length;i+=2){bx=Math.min(bx,o[i]);ex=Math.max(ex,o[i]);by=Math.min(by,o[i+1]);ey=Math.max(ey,o[i+1])}
  const inside=(x,y)=>GEO.inPoly(x,y,o)&&!rings.slice(1).some(h=>GEO.inPoly(x,y,h));
  const dEdge=(x,y)=>{let m=1/0;for(const r of rings){const n=r.length/2;for(let i=0,j=n-1;i<n;j=i++){const d=GEO.segPt(x,y,r[2*j],r[2*j+1],r[2*i],r[2*i+1])[0];if(d<m)m=d}}return Math.sqrt(m)};
  let best=null,bd=-1;const c=GEO.centroid(o);if(inside(c[0],c[1])){best=c;bd=dEdge(c[0],c[1])}
  const N=14;for(let gx=0;gx<=N;gx++)for(let gy=0;gy<=N;gy++){const x=bx+(ex-bx)*(gx+.5)/(N+1),y=by+(ey-by)*(gy+.5)/(N+1);if(!inside(x,y))continue;const d=dEdge(x,y);if(d>bd){bd=d;best=[x,y]}}
  if(!best)return c;let st=Math.max(ex-bx,ey-by)/(N+1)/2;
  for(let k=0;k<14;k++){let imp=false;for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1],[1,-1],[-1,1]]){const x=best[0]+dx*st,y=best[1]+dy*st;if(!inside(x,y))continue;const d=dEdge(x,y);if(d>bd){bd=d;best=[x,y];imp=true}}if(!imp)st/=2}
  best.r=bd;return best},
 // offset đường gấp khúc (song song), d>0 bên trái
 offset(p,d,closed){const n=p.length/2,out=[];const N=(i,j)=>{const dx=p[2*j]-p[2*i],dy=p[2*j+1]-p[2*i+1],L=Math.hypot(dx,dy)||1;return[-dy/L,dx/L]};
  for(let i=0;i<n;i++){const pi=closed?(i-1+n)%n:i-1,ni=closed?(i+1)%n:i+1;let nx=0,ny=0,k=0;
   if(pi>=0){const a=N(pi,i);nx+=a[0];ny+=a[1];k++}if(ni<n){const b=N(i,ni);nx+=b[0];ny+=b[1];k++}
   let L=Math.hypot(nx,ny)||1;nx/=L;ny/=L;let sc=1;if(k===2&&pi>=0){const a=N(pi,i);const c=nx*a[0]+ny*a[1];sc=c>.2?1/c:5}
   out.push(p[2*i]+nx*d*sc,p[2*i+1]+ny*d*sc)}return out},
 // phép biến đổi
 rot(x,y,cx,cy,a){const c=Math.cos(a),s=Math.sin(a),dx=x-cx,dy=y-cy;return[cx+dx*c-dy*s,cy+dx*s+dy*c]},
 mirror(x,y,ax,ay,bx,by){const dx=bx-ax,dy=by-ay,L=dx*dx+dy*dy||1,t=((x-ax)*dx+(y-ay)*dy)/L,qx=ax+t*dx,qy=ay+t*dy;return[2*qx-x,2*qy-y]},
 arcPts(cx,cy,r,a0,sw,n){n=n||Math.max(8,Math.ceil(Math.abs(sw)/(Math.PI/36)));const o=[];for(let i=0;i<=n;i++){const a=a0+sw*i/n;o.push(cx+r*Math.cos(a),cy+r*Math.sin(a))}return o},
 // đường tròn qua 3 điểm
 circ3(ax,ay,bx,by,cx,cy){const d=2*(ax*(by-cy)+bx*(cy-ay)+cx*(ay-by));if(Math.abs(d)<1e-12)return null;
  const a2=ax*ax+ay*ay,b2=bx*bx+by*by,c2=cx*cx+cy*cy,ux=(a2*(by-cy)+b2*(cy-ay)+c2*(ay-by))/d,uy=(a2*(cx-bx)+b2*(ax-cx)+c2*(bx-ax))/d;return[ux,uy,Math.hypot(ax-ux,ay-uy)]},
 // cung qua 3 điểm → [cx,cy,r,a0,sweep]
 arc3(ax,ay,bx,by,cx,cy){const c=GEO.circ3(ax,ay,bx,by,cx,cy);if(!c)return null;const A=Math.atan2(ay-c[1],ax-c[0]),B=Math.atan2(by-c[1],bx-c[0]),C=Math.atan2(cy-c[1],cx-c[0]);
  const nm=a=>{a%=2*Math.PI;return a<0?a+2*Math.PI:a};let sw=nm(C-A);if(nm(B-A)>sw)sw=sw-2*Math.PI;return[c[0],c[1],c[2],A,sw]},
 // chuỗi khép kín nối từ nhiều đoạn
 simplify(p,tol){if(p.length<=4)return p.slice();const n=p.length/2,keep=new Uint8Array(n);keep[0]=keep[n-1]=1;const st=[[0,n-1]];
  while(st.length){const[a,b]=st.pop();let m=-1,md=tol*tol;for(let i=a+1;i<b;i++){const d=GEO.segPt(p[2*i],p[2*i+1],p[2*a],p[2*a+1],p[2*b],p[2*b+1])[0];if(d>md){md=d;m=i}}if(m>=0){keep[m]=1;st.push([a,m],[m,b])}}
  const o=[];for(let i=0;i<n;i++)if(keep[i])o.push(p[2*i],p[2*i+1]);return o},
 // cắt đa giác bằng đường gấp khúc → danh sách đa giác (thuật toán: dựng đồ thị phẳng rồi tìm mặt)
 bbox(p){let a=1/0,b=1/0,c=-1/0,d=-1/0;for(let i=0;i<p.length;i+=2){if(p[i]<a)a=p[i];if(p[i]>c)c=p[i];if(p[i+1]<b)b=p[i+1];if(p[i+1]>d)d=p[i+1]}return[a,b,c,d]}
};

// ---------- Đồ thị phẳng: nối đoạn, cắt tại giao, tìm mặt (dùng cho tạo thửa, tách/gộp thửa) ----------
const PLANAR={
 // segs: [[x1,y1,x2,y2,tag],...]; tol: dung sai bắt điểm (đơn vị bản đồ). Trả về {nodes:[[x,y]], edges:[[i,j,tag]], faces:[{ring:[...], area, edges}], holes}
 build(segs,tol){tol=tol||1;
  // 1) lưới chỉ mục
  let bb=[1/0,1/0,-1/0,-1/0];for(const s of segs){bb[0]=Math.min(bb[0],s[0],s[2]);bb[1]=Math.min(bb[1],s[1],s[3]);bb[2]=Math.max(bb[2],s[0],s[2]);bb[3]=Math.max(bb[3],s[1],s[3])}
  const W=Math.max(bb[2]-bb[0],bb[3]-bb[1],1),cs=Math.max(W/Math.max(16,Math.sqrt(segs.length)*1.5),tol*4),grid=new Map(),key=(i,j)=>i*1e6+j;
  const cell=(x,y)=>[Math.floor((x-bb[0])/cs),Math.floor((y-bb[1])/cs)];
  segs.forEach((s,k)=>{const a=cell(Math.min(s[0],s[2])-tol,Math.min(s[1],s[3])-tol),b=cell(Math.max(s[0],s[2])+tol,Math.max(s[1],s[3])+tol);
   for(let i=a[0];i<=b[0];i++)for(let j=a[1];j<=b[1];j++){const q=key(i,j);let L=grid.get(q);if(!L)grid.set(q,L=[]);L.push(k)}});
  // 2) điểm cắt trên từng đoạn (giao nhau + đầu mút đoạn khác chạm vào giữa đoạn)
  const cuts=segs.map(()=>[]),seen=new Set();
  for(const L of grid.values())for(let a=0;a<L.length;a++)for(let b=a+1;b<L.length;b++){const i=L[a],j=L[b],k=i<j?i*4e6+j:j*4e6+i;if(seen.has(k))continue;seen.add(k);
   const A=segs[i],B=segs[j],x=GEO.segX(A[0],A[1],A[2],A[3],B[0],B[1],B[2],B[3]);
   if(x){cuts[i].push(x[2]);cuts[j].push(x[3])}
   // đầu mút B chạm giữa A (bắt chưa tới/bắt quá trong dung sai)
   for(const[P,Q,pi,qi]of[[A,B,i,j],[B,A,j,i]])for(const e of[0,2]){const r=GEO.segPt(Q[e],Q[e+1],P[0],P[1],P[2],P[3]);if(r[0]<=tol*tol&&r[1]>1e-6&&r[1]<1-1e-6)cuts[pi].push(r[1])}}
  if(seen.size>4e7)console.warn('nhiều cặp');
  // 3) nút: gộp điểm gần nhau trong dung sai
  const nodes=[],ng=new Map(),nc=Math.max(tol*2,1e-6);
  const node=(x,y)=>{const gi=Math.floor(x/nc),gj=Math.floor(y/nc);for(let di=-1;di<=1;di++)for(let dj=-1;dj<=1;dj++){const L=ng.get((gi+di)+','+(gj+dj));if(L)for(const n of L){const p=nodes[n];if((p[0]-x)**2+(p[1]-y)**2<=tol*tol)return n}}
   const n=nodes.length;nodes.push([x,y]);const k=gi+','+gj;let L=ng.get(k);if(!L)ng.set(k,L=[]);L.push(n);return n};
  const E=new Map();
  segs.forEach((s,k)=>{const t=[0,1,...cuts[k]].sort((a,b)=>a-b);let prev=node(s[0],s[1]);
   for(let q=1;q<t.length;q++){if(t[q]-t[q-1]<1e-9&&q<t.length-1)continue;const x=s[0]+(s[2]-s[0])*t[q],y=s[1]+(s[3]-s[1])*t[q],n=q===t.length-1?node(s[2],s[3]):node(x,y);
    if(n!==prev){const kk=prev<n?prev+'_'+n:n+'_'+prev;if(!E.has(kk))E.set(kk,[Math.min(prev,n),Math.max(prev,n),s[4]])}prev=n}});
  const all=[...E.values()],dg=new Array(nodes.length).fill(0);for(const e of all){dg[e[0]]++;dg[e[1]]++}
  const dangles=[];dg.forEach((d,n)=>{if(d===1)dangles.push(nodes[n])});
  // bỏ các đoạn cụt (đầu treo) trước khi tìm mặt để vòng thửa không có gai
  const inc=nodes.map(()=>[]);all.forEach((e,k)=>{inc[e[0]].push(k);inc[e[1]].push(k)});const dead=new Uint8Array(all.length),q=[];dg.forEach((d,n)=>{if(d===1)q.push(n)});
  while(q.length){const n=q.pop();if(dg[n]!==1)continue;const k=inc[n].find(k=>!dead[k]);if(k==null)continue;dead[k]=1;dg[n]--;const m=all[k][0]===n?all[k][1]:all[k][0];if(--dg[m]===1)q.push(m)}
  const edges=all.filter((e,k)=>!dead[k]);
  // 4) bán cạnh, sắp xếp theo góc quanh nút
  const out=nodes.map(()=>[]);edges.forEach((e,k)=>{out[e[0]].push([k,e[1]]);out[e[1]].push([k,e[0]])});
  const ang=(a,b)=>Math.atan2(nodes[b][1]-nodes[a][1],nodes[b][0]-nodes[a][0]);
  out.forEach((L,n)=>L.sort((p,q)=>ang(n,p[1])-ang(n,q[1])));
  const deg=out.map(L=>L.length);
  const used=new Set(),faces=[],holes=[];
  for(let n=0;n<nodes.length;n++)for(const[k,m]of out[n]){const hk=n+'>'+m;if(used.has(hk))continue;
   const ring=[],es=[];let a=n,b=m,ok=true,guard=0;
   while(true){used.add(a+'>'+b);ring.push(nodes[a][0],nodes[a][1]);es.push(a<b?a+'_'+b:b+'_'+a);
    const L=out[b];let idx=L.findIndex(x=>x[1]===a);// cạnh kế tiếp: quay theo chiều kim đồng hồ (mặt nằm bên trái)
    const nx=L[(idx-1+L.length)%L.length];a=b;b=nx[1];if(a===n&&b===m)break;if(++guard>2e5){ok=false;break}}
   if(!ok||ring.length<6)continue;const ar=GEO.area(ring);
   if(ar>1e-9)faces.push({ring,area:ar,edges:es});else holes.push({ring,area:ar,edges:es})}
  // 5) lỗ: vòng âm (biên ngoài của cụm) nằm trong mặt dương nhỏ nhất chứa nó, và không phải chính mặt đó
  for(const h of holes){const x=h.ring[0],y=h.ring[1];const hb=GEO.bbox(h.ring);let best=null;
   for(const f of faces){if(f.area<=Math.abs(h.area)+1e-6)continue;const fb=f.bb||(f.bb=GEO.bbox(f.ring));if(hb[0]<fb[0]||hb[2]>fb[2]||hb[1]<fb[1]||hb[3]>fb[3])continue;
    // điểm thử: trung điểm cạnh đầu của lỗ, lệch nhẹ ra ngoài lỗ
    const mx=(h.ring[0]+h.ring[2])/2,my=(h.ring[1]+h.ring[3])/2;if(!GEO.inPoly(mx,my,f.ring))continue;if(f.edges.some(e=>h.edges.includes(e)))continue;if(!best||f.area<best.area)best=f}
   if(best)(best.holes||(best.holes=[])).push(h.ring.slice().reverse?Array.from(h.ring):h.ring)}
  return{nodes,edges:all,faces,dangles}}
};

// ---------- Ghi DXF (R12, mét, X=Đông, Y=Bắc) ----------
function writeDXF(prims,org,pal){const L=[],P=(c,v)=>L.push(c,v),X=x=>((x-org[0])/1000).toFixed(4),Y=y=>((y-org[1])/1000).toFixed(4),U=v=>(v/1000).toFixed(4);
 const lvs=[...new Set(prims.map(p=>p.lv||0))].sort((a,b)=>a-b),ac=c=>Math.max(1,Math.min(255,c||7));
 P(0,'SECTION');P(2,'HEADER');P(9,'$ACADVER');P(1,'AC1009');P(9,'$INSUNITS');P(70,6);P(0,'ENDSEC');
 P(0,'SECTION');P(2,'TABLES');P(0,'TABLE');P(2,'LAYER');P(70,lvs.length);for(const l of lvs){P(0,'LAYER');P(2,'LV'+l);P(70,0);P(62,7);P(6,'CONTINUOUS')}P(0,'ENDTAB');P(0,'ENDSEC');
 P(0,'SECTION');P(2,'ENTITIES');
 const esc=s=>String(s).replace(/[^\x20-\x7e]/g,ch=>'\\U+'+ch.charCodeAt(0).toString(16).toUpperCase().padStart(4,'0'));
 for(const p of prims){if(p.del)continue;const ly='LV'+(p.lv||0),cl=ac(p.c);
  if(p.k==='L'||p.k==='S'){const n=p.p.length/2;if(n===2&&p.k==='L'){P(0,'LINE');P(8,ly);P(62,cl);P(10,X(p.p[0]));P(20,Y(p.p[1]));P(30,0);P(11,X(p.p[2]));P(21,Y(p.p[3]));P(31,0);continue}
   P(0,'POLYLINE');P(8,ly);P(62,cl);P(66,1);P(70,p.k==='S'?1:0);for(let i=0;i<n;i++){if(p.k==='S'&&i===n-1&&p.p[0]===p.p[2*i]&&p.p[1]===p.p[2*i+1])break;P(0,'VERTEX');P(8,ly);P(10,X(p.p[2*i]));P(20,Y(p.p[2*i+1]));P(30,0)}P(0,'SEQEND')}
  else if(p.k==='E'){const e=p.e;if(Math.abs(e[0]-e[1])<1e-6){P(0,'CIRCLE');P(8,ly);P(62,cl);P(10,X(e[3]));P(20,Y(e[4]));P(30,0);P(40,U(e[0]))}}
  else if(p.k==='A'){const a=p.a,d=180/Math.PI;let s=a[0],e=a[0]+a[1];if(a[1]<0)[s,e]=[e,s];P(0,'ARC');P(8,ly);P(62,cl);P(10,X(a[5]));P(20,Y(a[6]));P(30,0);P(40,U(a[2]));P(50,(s*d).toFixed(6));P(51,(e*d).toFixed(6))}
  else if(p.k==='T'){P(0,'TEXT');P(8,ly);P(62,cl);P(10,X(p.x));P(20,Y(p.y));P(30,0);P(40,U(p.h));P(1,esc(p.s));P(50,((p.r||0)*180/Math.PI).toFixed(4))}}
 P(0,'ENDSEC');P(0,'EOF');return L.join('\r\n')}

// ---------- Phần tử M8 → phần tử DGN V8 ----------
// prims: phần tử bản đồ (toạ độ lưu); trả về danh sách phần tử D8 (cell gom theo p.g)
function primsToD8(prims){const els=[],groups=new Map(),TNR=0x401;
 const one=p=>{const lv=p.lv||1,w=p.w||0,c=p.c||0,st=p.st||0;
  if(p.k==='L'){const q=[];for(let i=0;i<p.p.length;i+=2)q.push([p.p[i],p.p[i+1]]);if(q.length===2)return[D8.line(lv,w,c,q[0][0],q[0][1],q[1][0],q[1][1],st)];return D8.poly(false,lv,w,c,q,st)}
  if(p.k==='S'){const q=[];for(let i=0;i<p.p.length;i+=2)q.push([p.p[i],p.p[i+1]]);return D8.poly(true,lv,w,c,q,st)}
  if(p.k==='E'){const e=p.e;return[D8.ellipse(lv,w,c,e[0],e[1],e[2],e[3],e[4],st)]}
  if(p.k==='A'){const a=p.a;if(Math.abs(a[2]-a[3])>1e-6)return[];const pts=GEO.arcPts(a[5],a[6],a[2],a[0],a[1]),q=[];for(let i=0;i<pts.length;i+=2)q.push([pts[i],pts[i+1]]);return D8.poly(false,lv,w,c,q,st)}
  if(p.k==='T'){if(!String(p.s||'').length)return[];const L=p.tw||p.h*String(p.s).length*.6;return[D8.text(lv,0,c,p.fid&&p.fid<0x10000?p.fid:TNR,p.x,p.y,p.h,p.h,L,p.r||0,p.s)]}
  return[]};
 for(const p of prims){if(p.del)continue;if(p.g){let G=groups.get(p.g);if(!G){G={lv:p.lv||1,name:p.gn||'M8',x:0,y:0,c:[]};groups.set(p.g,G);els.push(G)}const r=one(p);for(const e of r)G.c.push(e);continue}for(const e of one(p))els.push(e)}
 const out=[];for(const e of els){if(e.c){if(!e.c.length)continue;const bb=e.c[0].r;for(const x of D8.cell(e.lv,e.name,bb[0],bb[1],e.c))out.push(x)}else out.push(e)}return out}

// ---------- Kênh kết nối Bản đồ ⇄ Địa chính ----------
// Giống bộ đôi trình bản đồ + ứng dụng nghiệp vụ nạp vào trong: ứng dụng Địa chính chạy trong khung (iframe) của Bản đồ,
// hoặc ở cửa sổ/thẻ riêng cùng nguồn (BroadcastChannel). Gọi hàm từ xa: bus.call(tên, đối số) → Promise; sự kiện: bus.emit / bus.on.
class Bus{
 constructor(role){this.role=role;this.id=role+'-'+Math.random().toString(36).slice(2,9);this.h={};this.ev={};this.pend=new Map();this.peer=null;this.win=null;this.seq=0;this.seen=new Set();
  try{this.bc=new BroadcastChannel('m8pro');this.bc.onmessage=e=>this._in(e.data,null)}catch(e){this.bc=null}
  window.addEventListener('message',e=>{if(e.data&&e.data.m8)this._in(e.data,e.source)})}
 handle(n,f){this.h[n]=f}
 on(n,f){(this.ev[n]||(this.ev[n]=[])).push(f)}
 _post(m,w){m.m8=1;m.from=this.id;if(w){try{w.postMessage(m,'*');return}catch(e){}}if(this.win){try{this.win.postMessage(m,'*')}catch(e){}}if(this.bc)this.bc.postMessage(m)}
 async _in(m,src){if(!m||m.from===this.id)return;if(m.to&&m.to!==this.id)return;const k=m.from+':'+m.seq+':'+m.t;if(this.seen.has(k))return;this.seen.add(k);if(this.seen.size>5000)this.seen.clear();
  if(src&&!this.win&&m.t!=='ret')this.win=src;
  if(m.t==='call'){const f=this.h[m.n];if(!f){if(m.to)this._post({t:'ret',seq:m.seq,to:m.from,err:'Không có lệnh '+m.n},src);return}
   try{const r=await f(m.a,m.from);this._post({t:'ret',seq:m.seq,to:m.from,r},src)}catch(e){this._post({t:'ret',seq:m.seq,to:m.from,err:String(e&&e.message||e)},src)}}
  else if(m.t==='ret'){const p=this.pend.get(m.seq);if(p){this.pend.delete(m.seq);if(!this.peer)this.peer=m.from;m.err?p.no(new Error(m.err)):p.ok(m.r)}}
  else if(m.t==='evt'){for(const f of this.ev[m.n]||[])try{f(m.a,m.from)}catch(e){console.error(e)}}}
 call(n,a,opt){opt=opt||{};const seq=++this.seq+':'+this.id;return new Promise((ok,no)=>{this.pend.set(seq,{ok,no});this._post({t:'call',seq,n,a,to:opt.any?undefined:this.peer||undefined});
  const to=opt.timeout===0?0:(opt.timeout||20000);if(to)setTimeout(()=>{if(this.pend.has(seq)){this.pend.delete(seq);no(new Error('Không có phản hồi từ '+(this.role==='diachinh'?'M8 Pro Bản đồ':'M8 Pro Địa chính')))}},to)})}
 emit(n,a){this._post({t:'evt',seq:++this.seq,n,a})}
}

// ---------- Tệp thuộc tính (.gtp): mở / lưu ----------
async function gtpOpenDB(u8){const r=await gtpDB(u8);r.T=gtpSchema(r.db);return r}
function gtpBytes(o){const p=o.db.export();return o.key?gtpX(p,o.key):p}
// danh sách thửa: [{id, to, so, dt, dtpl, kh, diachi, ghichu, chu, cx, cy, rings}]
function gtpRows(o){const db=o.db,T=o.T,has=(t,...c)=>T[t]&&c.every(x=>T[t].cols.includes(x));if(!has('ThuaDat','soThuTuThua'))throw new Error('Tệp không có bảng thửa đất');
 const own=new Map();if(has('DangKyThua','thuaDatId','nguoiId')&&has('Nguoi','nguoiId','hoTen'))for(const r of gqo(db,'select d.thuaDatId as t,n.nguoiId as nid,n.hoTen as h,'+(has('Nguoi','hoTen2')?'n.hoTen2':"''")+' as h2,'+(has('Nguoi','diaChi')?'n.diaChi':"''")+' as dc from DangKyThua d join Nguoi n on n.nguoiId=d.nguoiId')){
  if(!own.has(r.t))own.set(r.t,[]);const a=own.get(r.t);if(!a.some(z=>z.nid===r.nid))a.push(r)}
 const ts=new Map();if(has('TbTrangSoDiaChinh','soHieuToBanDo','soThuTuThua','loaiDat'))for(const r of gqo(db,'select soHieuToBanDo as t,soThuTuThua as s,loaiDat as l from TbTrangSoDiaChinh'))ts.set(String(+r.t||r.t)+'|'+String(+r.s||r.s),r.l);
 const cols=T.ThuaDat.cols.filter(c=>c!=='geom'),geo=T.ThuaDat.cols.includes('geom')?new Map(gq(db,'select thuaDatId,geom from ThuaDat')):null;
 return gqo(db,'select '+cols.map(gqi).join(',')+' from ThuaDat').map(v=>{const o2=own.get(v.thuaDatId)||[],k=String(+v.soHieuToBanDo||v.soHieuToBanDo)+'|'+String(+v.soThuTuThua||v.soThuTuThua);
  return{id:v.thuaDatId,v,to:v.soHieuToBanDo,so:v.soThuTuThua,dt:v.dienTich,dtpl:v.dienTichPhapLy,kh:v.mucDichSuDungGhep||'',ldso:ts.get(k)||'',diachi:v.diaChi||'',ghichu:v.ghiChu||'',
   chu:o2.map(n=>[n.h,n.h2].filter(Boolean).join(' và ')).filter(Boolean).join('; '),chuDc:(o2[0]&&o2[0].dc)||'',owners:o2,cx:v.TamX,cy:v.TamY,rings:geo?gtpWKB(geo.get(v.thuaDatId)):null}})}
function gtpUpd(o,id,col,val){if(!o.T.ThuaDat.cols.includes(col))return false;o.db.run('update ThuaDat set '+gqi(col)+'=? where thuaDatId=?',[val,id]);o.dirty=true;return true}
// thêm thửa mới: sao một dòng thửa có sẵn làm mẫu (giữ đúng kiểu cột của tệp), đặt lại khoá, số, diện tích
function gtpNewParcel(o,f){const db=o.db,T=o.T.ThuaDat,tpl=gqo(db,'select * from ThuaDat limit 1')[0];const r={};
 if(tpl)for(const c of T.cols)r[c]=tpl[c];for(const c of T.cols)if(/^(ghiChu|diaChi|dienTichPhapLy|soHieuToBanDoCu|soThuTuThuaCu|dienTichCu|loaiDatCu|soHieuThuaTam|geom)$/.test(c))r[c]=null;
 delete r.thuaDatId;if('uid'in r)r.uid=gtpUidNew(r.uid);Object.assign(r,f);const c=Object.keys(r).filter(k=>T.cols.includes(k));
 db.run('insert into ThuaDat ('+c.map(gqi).join(',')+') values ('+c.map(()=>'?').join(',')+')',c.map(k=>r[k]===undefined?null:r[k]));o.dirty=true;return gq(db,'select last_insert_rowid()')[0][0]}
function gtpUidNew(v){if(v==null)return null;if(v instanceof Uint8Array)return v.every(b=>!b)?new Uint8Array(v.length):crypto.getRandomValues(new Uint8Array(v.length));
 const s=String(v),core=s.replace(/[{}]/g,'');if(/^[0-]+$/.test(core))return s;let u=crypto.randomUUID?crypto.randomUUID():String(Date.now());if(/[A-F]/.test(core))u=u.toUpperCase();return/^\{/.test(s)?'{'+u+'}':u}
// hình thửa → WKB Polygon (little-endian) để ghi cột geom
function wkbPoly(rings){let n=9;for(const r of rings)n+=4+r.length*8+16;const b=new Uint8Array(n),v=new DataView(b.buffer);let o=0;b[o++]=1;v.setUint32(o,3,true);o+=4;v.setUint32(o,rings.length,true);o+=4;
 for(const r of rings){const m=r.length/2+1;v.setUint32(o,m,true);o+=4;for(let i=0;i<r.length;i++){v.setFloat64(o,r[i],true);o+=8}v.setFloat64(o,r[0],true);o+=8;v.setFloat64(o,r[1],true);o+=8}return b}

// ---------- Ký hiệu loại đất (Thông tư 08/2024/TT-BTNMT và ký hiệu cũ hay gặp) ----------
const LOAI_DAT={LUC:'Đất chuyên trồng lúa',LUK:'Đất trồng lúa còn lại',HNK:'Đất trồng cây hàng năm khác',CLN:'Đất trồng cây lâu năm',RSX:'Đất rừng sản xuất',RPH:'Đất rừng phòng hộ',RDD:'Đất rừng đặc dụng',
 NTS:'Đất nuôi trồng thủy sản',CNT:'Đất chăn nuôi tập trung',LMU:'Đất làm muối',NKH:'Đất nông nghiệp khác',ONT:'Đất ở tại nông thôn',ODT:'Đất ở tại đô thị',TSC:'Đất xây dựng trụ sở cơ quan',
 CQP:'Đất quốc phòng',CAN:'Đất an ninh',DTS:'Đất xây dựng trụ sở của tổ chức sự nghiệp',DVH:'Đất xây dựng cơ sở văn hóa',DXH:'Đất xây dựng cơ sở dịch vụ xã hội',DYT:'Đất xây dựng cơ sở y tế',
 DGD:'Đất xây dựng cơ sở giáo dục và đào tạo',DTT:'Đất xây dựng cơ sở thể dục, thể thao',DKH:'Đất xây dựng cơ sở khoa học và công nghệ',DMT:'Đất xây dựng cơ sở môi trường',DKT:'Đất xây dựng cơ sở khí tượng thủy văn',
 DNG:'Đất xây dựng cơ sở ngoại giao',DSK:'Đất xây dựng công trình sự nghiệp khác',SKK:'Đất khu công nghiệp',SKN:'Đất cụm công nghiệp',TMD:'Đất thương mại, dịch vụ',SKC:'Đất cơ sở sản xuất phi nông nghiệp',
 SKS:'Đất sử dụng cho hoạt động khoáng sản',DGT:'Đất công trình giao thông',DTL:'Đất công trình thủy lợi',DCK:'Đất công trình cấp nước, thoát nước',DNL:'Đất công trình năng lượng, chiếu sáng công cộng',
 DBV:'Đất công trình bưu chính, viễn thông, công nghệ thông tin',DCH:'Đất chợ dân sinh, chợ đầu mối',DDD:'Đất công trình di tích lịch sử - văn hóa, danh lam thắng cảnh',DKV:'Đất khu vui chơi, giải trí công cộng, sinh hoạt cộng đồng',
 DRA:'Đất công trình xử lý chất thải',DCC:'Đất công trình công cộng khác',TON:'Đất tôn giáo',TIN:'Đất tín ngưỡng',NTD:'Đất nghĩa trang, nhà tang lễ, cơ sở hỏa táng; đất cơ sở lưu giữ tro cốt',
 SON:'Đất có mặt nước chuyên dùng dạng sông, ngòi, kênh, rạch, suối',MNC:'Đất có mặt nước chuyên dùng dạng ao, hồ, đầm, phá',PNK:'Đất phi nông nghiệp khác',BCS:'Đất bằng chưa sử dụng',DCS:'Đất đồi núi chưa sử dụng',
 NCS:'Núi đá không có rừng cây',LNQ:'Đất trồng cây ăn quả lâu năm',LNC:'Đất trồng cây công nghiệp lâu năm',LNK:'Đất trồng cây lâu năm khác',BHK:'Đất bằng trồng cây hàng năm khác',NHK:'Đất nương rẫy trồng cây hàng năm khác',
 COC:'Đất cỏ dùng vào chăn nuôi',RST:'Đất có rừng trồng sản xuất',RSN:'Đất có rừng tự nhiên sản xuất',TSN:'Đất nuôi trồng thủy sản nước ngọt',CTS:'Đất trụ sở cơ quan, công trình sự nghiệp',CSK:'Đất sản xuất, kinh doanh phi nông nghiệp',
 TTN:'Đất tôn giáo, tín ngưỡng',CCC:'Đất có mục đích công cộng',DSH:'Đất sinh hoạt cộng đồng',DKV2:'',SKX:'Đất sản xuất vật liệu xây dựng, làm đồ gốm',DRA2:''};
delete LOAI_DAT.DKV2;delete LOAI_DAT.DRA2;
// nhóm loại đất (để tô màu, thống kê)
const nhomLD=k=>{k=String(k||'').toUpperCase().split(/[^A-Z]+/).filter(Boolean)[0]||'';if(/^(LUC|LUK|LUN)$/.test(k))return'lua';if(/^(HNK|BHK|NHK|COC)$/.test(k))return'hn';if(/^(CLN|LNQ|LNC|LNK)$/.test(k))return'ln';
 if(/^R/.test(k))return'rung';if(/^(NTS|TSN|TSL|LMU|CNT|NKH)$/.test(k))return'nn';if(/^(ONT|ODT)$/.test(k))return'o';if(/^(DGT)$/.test(k))return'gt';if(/^(DTL|SON|MNC)$/.test(k))return'nuoc';if(/^(BCS|DCS|NCS)$/.test(k))return'csd';return k?'pnn':''};
const MAU_LD={lua:'#ffff66',hn:'#ffd27f',ln:'#ffcc99',rung:'#66cc66',nn:'#a8e0ff',o:'#ff9fa8',gt:'#d9d9d9',nuoc:'#9fd6ff',csd:'#e8e0c8',pnn:'#ff99cc','':'#cccccc'};

// ---------- tiện ích chung ----------
const fmtN=(v,d=2)=>v==null||!isFinite(v)?'':(Math.round(v*10**d)/10**d).toFixed(d).replace('.',',');
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
async function saveAs(name,blob,types){
 if(window.showSaveFilePicker){try{const h=await window.showSaveFilePicker({suggestedName:name,types});const w=await h.createWritable();await w.write(blob);await w.close();return h}catch(e){if(e&&e.name==='AbortError')return null}}
 const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},4000);return true}
async function writeHandle(h,blob){if(h.queryPermission&&(await h.queryPermission({mode:'readwrite'}))!=='granted'&&(await h.requestPermission({mode:'readwrite'}))!=='granted')throw new Error('Chưa được cấp quyền ghi tệp');const w=await h.createWritable();await w.write(blob);await w.close()}
const isDesktop=()=>matchMedia('(pointer:fine)').matches&&innerWidth>=900;

G.M8=Object.assign(G.M8||{},{parseAny,fmtOf,readOLE,D8,D8SEED,primsToD8,writeDXF,tmFwd,tmInv,vn2wgs,wgs2vn,GEO,PLANAR,Bus,IDB,
 gtpOpenDB,gtpBytes,gtpRows,gtpUpd,gtpNewParcel,wkbPoly,gtpLab,gq,gqo,gqi,gtpLibLoad,GTP_LAB,LOAI_DAT,nhomLD,MAU_LD,fmtN,esc,saveAs,writeHandle,isDesktop,tcvn});
})(window);
