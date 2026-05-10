import React, { useState, useEffect, useRef } from "react";

// ── 디자인 토큰 ─────────────────────────────────────────
const C = {
  bg:"#F4F6FA", bgCard:"#FFFFFF", bgHeader:"#FFFFFF",
  navy:"#1A2B45", navyMid:"#2C4066", navyLt:"#3D5A8A",
  gold:"#B8820A", goldLt:"#D4A017", goldBg:"#FFF8E7",
  red:"#D94040", redLt:"#E57373", redBg:"#FFF0F0",
  green:"#2E7D52", greenLt:"#4CAF7D", greenBg:"#F0FFF6",
  sky:"#1976D2", skyLt:"#42A5F5", skyBg:"#EEF6FF",
  orange:"#E65100", orangeLt:"#FF8A50", orangeBg:"#FFF3E0",
  purple:"#6A1B9A", purpleLt:"#AB47BC", purpleBg:"#F8F0FF",
  teal:"#00796B", tealLt:"#26A69A", tealBg:"#E8F8F5",
  text:"#1A2B45", textMid:"#4A5568", textMuted:"#8A97B0",
  border:"#E2E8F0", borderGold:"rgba(184,130,10,0.3)",
  shadow:"0 2px 12px rgba(26,43,69,0.08)",
};

const TABS = [
  { id:"home",     emoji:"🏠", label:"홈" },
  { id:"docs",     emoji:"📋", label:"서류관리" },
  { id:"budget",   emoji:"💳", label:"가계부" },
  { id:"pa",       emoji:"🤖", label:"개인비서" },
  { id:"scan",     emoji:"📷", label:"문서스캔" },
  { id:"ticket",   emoji:"🚗", label:"교통티켓" },
  { id:"letter",   emoji:"📬", label:"공문서" },
  { id:"tax",      emoji:"💰", label:"세금" },
  { id:"legal",    emoji:"⚖️",  label:"법률" },
  { id:"mortgage", emoji:"🏡", label:"모기지" },
];

const DOC_TYPES = [
  { value:"dl",        label:"🪪 운전면허증",     warnDays:90  },
  { value:"passport",  label:"📕 여권",           warnDays:180 },
  { value:"visa",      label:"🗽 비자/영주권",     warnDays:180 },
  { value:"car_reg",   label:"🚗 자동차 등록증",   warnDays:60  },
  { value:"car_ins",   label:"🛡️ 자동차 보험",     warnDays:30  },
  { value:"health_ins",label:"🏥 건강보험",        warnDays:60  },
  { value:"lease",     label:"🏠 렌트 계약서",     warnDays:90  },
  { value:"work_perm", label:"💼 취업허가서/EAD",  warnDays:180 },
  { value:"itin",      label:"💲 ITIN",            warnDays:365 },
  { value:"tax_dead",  label:"📅 세금 신고 마감",  warnDays:30  },
  { value:"rx",        label:"💊 처방전",          warnDays:14  },
  { value:"license",   label:"📜 전문직 라이선스", warnDays:90  },
  { value:"other",     label:"📄 기타 서류",       warnDays:30  },
];

const EXPENSE_CATS = [
  "🏠 렌트/모기지","🚗 자동차","🛒 식료품","🍽️ 외식",
  "🏥 의료/보험","📚 교육","🎮 유흥/취미","✈️ 여행",
  "👕 의류","💡 전기세","🔥 가스비","💧 수도세",
  "🌐 인터넷","📱 통신","💰 저축/투자","🎁 기타",
];
const INCOME_CATS = [
  "💼 급여","📈 투자수익","🏠 임대수입","💻 부업/프리랜서",
  "🎁 선물/지원","💲 기타수입",
];
const STATES = [
  {code:"NV",rate:0},{code:"CA",rate:9.3},{code:"TX",rate:0},
  {code:"NY",rate:6.85},{code:"WA",rate:0},{code:"FL",rate:0},
  {code:"IL",rate:4.95},{code:"GA",rate:5.49},{code:"NJ",rate:6.37},{code:"VA",rate:5.75},
];

// ── 유틸 ────────────────────────────────────────────────
const uid      = () => Math.random().toString(36).slice(2,9);
const today    = () => new Date().toISOString().slice(0,10);
const daysLeft = (d) => Math.ceil((new Date(d)-new Date())/86400000);
const fmt$     = (n) => "$"+Number(n).toLocaleString("en-US",{minimumFractionDigits:0,maximumFractionDigits:0});
const fmtDate  = (d) => new Date(d).toLocaleDateString("ko-KR",{year:"numeric",month:"short",day:"numeric"});
const monthsOld= (d) => Math.floor((new Date()-new Date(d))/(1000*60*60*24*30));

// ── 스토리지 ─────────────────────────────────────────────
async function load(key, fallback=[]) {
  try { const r=await window.storage.get(key); return r?JSON.parse(r.value):fallback; }
  catch { return fallback; }
}
async function save(key, val) {
  try { await window.storage.set(key, JSON.stringify(val)); } catch {}
}

// ── Claude API (백엔드 프록시 경유 — API키 보호) ─────────
const AI_MAX = 999;
async function getAiCount() {
  try { const r=await window.storage.get("ai_count"); return r?Number(r.value):0; } catch{ return 0; }
}
async function incAiCount() {
  const n=await getAiCount();
  try { await window.storage.set("ai_count",String(n+1)); } catch{}
  return n+1;
}

async function askClaude(system, messages, onBlocked) {
  const count=await getAiCount();
  if(count>=AI_MAX){ onBlocked&&onBlocked(); return null; }
  await incAiCount();
  try {
    const r = await fetch("/api/claude", {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({ system, messages, max_tokens:1500 }),
    });
    if(!r.ok) throw new Error(`HTTP ${r.status}`);
    const d=await r.json();
    return d?.content?.[0]?.text || d?.error || "응답을 받지 못했습니다.";
  } catch(e) { return `오류: ${e.message}. 잠시 후 다시 시도해 주세요.`; }
}

// ── Claude API (이미지+텍스트, 백엔드 프록시) ────────────
async function askClaudeWithImage(system, userText, imageBase64, mediaType="image/jpeg") {
  try {
    const r = await fetch("/api/claude", {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({
        system,
        messages:[{role:"user", content:[
          {type:"image", source:{type:"base64", media_type:mediaType, data:imageBase64}},
          {type:"text", text:userText},
        ]}],
        max_tokens:1500,
      }),
    });
    if(!r.ok) throw new Error(`HTTP ${r.status}`);
    const d=await r.json();
    return d.content?.[0]?.text || "응답을 받지 못했습니다.";
  } catch(e) { return `오류: ${e.message}. 잠시 후 다시 시도해 주세요.`; }
}

// ── 이미지 → base64 ────────────────────────────────────
function fileToBase64(file) {
  return new Promise((res,rej)=>{
    const r=new FileReader();
    r.onload=()=>res(r.result.split(",")[1]);
    r.onerror=()=>rej(new Error("파일 읽기 실패"));
    r.readAsDataURL(file);
  });
}

// ── 공통 UI ──────────────────────────────────────────────
const st = {
  card:{background:"#FFFFFF",border:"1px solid #E2E8F0",borderRadius:14,padding:"16px",boxShadow:"0 2px 12px rgba(26,43,69,0.08)"},
  label:{fontSize:12,color:C.navyMid,fontWeight:700,letterSpacing:"0.04em",marginBottom:6,display:"block"},
  input:{width:"100%",background:"#F8FAFC",border:"1.5px solid #E2E8F0",borderRadius:10,padding:"12px 14px",color:C.text,fontSize:15,fontFamily:"inherit",outline:"none",boxSizing:"border-box"},
  btn:(bg,fg="#fff")=>({width:"100%",padding:"14px",borderRadius:11,background:bg,color:fg,fontWeight:700,fontSize:15,border:"none",cursor:"pointer",fontFamily:"inherit",marginTop:10,boxShadow:`0 2px 8px ${bg}55`}),
  tag:(bg,fg)=>({display:"inline-block",background:bg,color:fg,borderRadius:20,padding:"3px 10px",fontSize:12,fontWeight:700}),
};

function F({label,children}){return <div style={{marginBottom:14}}><span style={st.label}>{label}</span>{children}</div>;}
function Inp({value,onChange,placeholder,type="text",min,max}){
  return <input type={type} min={min} max={max} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} style={st.input}/>;
}
function Sel({value,onChange,options}){
  return <select value={value} onChange={e=>onChange(e.target.value)} style={{...st.input,cursor:"pointer",color:C.text,background:"#F8FAFC"}}>
    {options.map(o=><option key={o.v||o} value={o.v||o} style={{color:"#1A2B45",background:"#fff"}}>{o.l||o}</option>)}
  </select>;
}
function Btn({onClick,disabled,children,color=C.gold,fg="#fff"}){
  return <button onClick={onClick} disabled={disabled} style={{...st.btn(disabled?"#CBD5E0":color,disabled?C.textMuted:fg),opacity:disabled?0.7:1}}>
    {disabled?"처리 중...":children}
  </button>;
}
function GLine(){return <div style={{height:1,background:`linear-gradient(90deg,transparent,${C.borderGold},transparent)`,margin:"16px 0"}}/>;}
function Dots(){
  return <div style={{display:"flex",gap:6,justifyContent:"center",padding:"20px 0"}}>
    {[0,1,2].map(i=><div key={i} style={{width:8,height:8,borderRadius:"50%",background:C.gold,animation:"pulse 1.2s ease-in-out infinite",animationDelay:`${i*0.2}s`}}/>)}
    <style>{`@keyframes pulse{0%,80%,100%{transform:scale(0.3);opacity:0.3}40%{transform:scale(1);opacity:1}}`}</style>
  </div>;
}
function AiBox({text}){
  if(!text) return null;
  return <div style={{background:C.goldBg,border:`1.5px solid ${C.borderGold}`,borderRadius:12,padding:"18px",marginTop:12,whiteSpace:"pre-wrap",lineHeight:1.85,fontSize:14,color:C.text}}>{text}</div>;
}
function Modal({open,onClose,title,children}){
  if(!open) return null;
  return <div style={{position:"fixed",inset:0,background:"rgba(26,43,69,0.5)",zIndex:200,display:"flex",alignItems:"flex-end",justifyContent:"center"}} onClick={onClose}>
    <div style={{background:C.bgCard,border:"1px solid #E2E8F0",borderRadius:"20px 20px 0 0",padding:"24px 20px",width:"100%",maxWidth:680,maxHeight:"88vh",overflowY:"auto",boxShadow:"0 -8px 40px rgba(26,43,69,0.15)"}} onClick={e=>e.stopPropagation()}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
        <span style={{fontSize:17,fontWeight:800,color:C.text}}>{title}</span>
        <button onClick={onClose} style={{background:"#F1F5F9",border:"none",color:C.textMid,fontSize:18,cursor:"pointer",borderRadius:8,width:32,height:32,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
      </div>
      {children}
    </div>
  </div>;
}

// ── 프리미엄 업그레이드 모달 ─────────────────────────────
function PremiumModal({open,onClose,reason}) {
  return <Modal open={open} onClose={onClose} title="💎 Premium 업그레이드">
    <div style={{textAlign:"center",padding:"10px 0 20px"}}>
      <div style={{fontSize:44,marginBottom:12}}>🔒</div>
      <div style={{fontSize:15,fontWeight:800,color:C.navy,marginBottom:8}}>
        {reason==="ai"?"AI 무료 사용 3회 초과":"Premium 전용 기능"}
      </div>
      <div style={{fontSize:13,color:C.textMid,lineHeight:1.8,marginBottom:20}}>
        {reason==="ai"
          ?"AI 기능은 무료로 3회까지 사용 가능합니다.\nPremium으로 업그레이드하면 무제한 사용됩니다."
          :"이 기능은 Premium 회원 전용입니다.\n업그레이드하면 즉시 사용 가능합니다."
        }
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
        {[
          {plan:"Basic",price:"$4.99/월",features:["AI 무제한","스캔 무제한","모든 알림","서류 관리"],color:C.sky},
          {plan:"Premium",price:"$9.99/월",features:["Basic 전체","문서 내보내기","가족 계정 3명","클라우드 백업"],color:C.gold},
        ].map((p,i)=>(
          <div key={i} style={{padding:"14px",background:i===1?C.goldBg:C.skyBg,borderRadius:12,border:`1.5px solid ${i===1?C.gold:C.sky}44`}}>
            <div style={{fontSize:13,fontWeight:800,color:p.color,marginBottom:4}}>{p.plan}</div>
            <div style={{fontSize:16,fontWeight:900,color:p.color,marginBottom:8}}>{p.price}</div>
            {p.features.map((f,j)=><div key={j} style={{fontSize:11,color:C.textMid,marginBottom:2}}>✓ {f}</div>)}
          </div>
        ))}
      </div>
      <button onClick={onClose} style={{...st.btn(C.gold,C.navy),marginTop:0}}>💎 지금 업그레이드</button>
      <button onClick={onClose} style={{...st.btn("transparent",C.textMuted),marginTop:8,border:`1px solid ${C.border}`}}>나중에</button>
    </div>
  </Modal>;
}

// ── AI 사용량 배지 ────────────────────────────────────────
function AiBadge({count}) {
  const left=Math.max(0,AI_MAX-count);
  const color=left===0?C.red:left===1?C.orange:C.green;
  return <div style={{display:"inline-flex",alignItems:"center",gap:5,
    background:`${color}15`,border:`1px solid ${color}33`,
    borderRadius:20,padding:"5px 12px",marginBottom:12}}>
    <span style={{fontSize:12,color,fontWeight:700}}>
      🤖 AI 무료 잔여: {left}/{AI_MAX}회
    </span>
  </div>;
}

// ════════════════════════════════════════════════════════
// 문서 스캔 탭
// ════════════════════════════════════════════════════════
function ScanTab({onPremium}) {
  const [pages,setPages]=useState([]);
  const [docName,setDocName]=useState("");
  const [saved,setSaved]=useState([]);

  useEffect(()=>{ load("scan_docs",[]).then(setSaved); },[]);
  const persistSaved=d=>{setSaved(d);save("scan_docs",d);};

  const handleImages=(b64, fileType)=>{
    // base64로 직접 받음 (CameraBtn에서 한 장씩)
    const src=`data:${fileType||"image/jpeg"};base64,${b64}`;
    setPages(prev=>[...prev,{id:uid(),src,name:`page_${prev.length+1}`,date:today()}]);
  };

  const saveDoc=()=>{
    if(pages.length===0) return;
    const doc={id:uid(),name:docName||`스캔문서_${today()}`,pages:[...pages],date:today()};
    persistSaved([doc,...saved]);
    setPages([]);setDocName("");
  };

  const printDoc=(doc)=>{
    const w=window.open("","_blank");
    if(!w) return;
    const imgs=doc.pages.map(p=>`<img src="${p.src}" style="width:100%;max-width:800px;display:block;margin:0 auto 20px;page-break-after:always"/>`).join("");
    w.document.write(`<!DOCTYPE html><html><head><title>${doc.name}</title>
      <style>body{margin:0;padding:20px;background:#fff;}@media print{body{padding:0}}</style></head>
      <body>${imgs}<script>window.onload=()=>window.print();<\/script></body></html>`);
    w.document.close();
  };

  return <div>
    <div style={{...st.card,background:`linear-gradient(135deg,${C.navy},${C.navyMid})`,textAlign:"center",marginBottom:12,border:"none"}}>
      <div style={{fontSize:28,marginBottom:6}}>📷</div>
      <div style={{fontSize:14,fontWeight:800,color:"#fff",marginBottom:4}}>문서 스캔</div>
      <div style={{fontSize:11,color:"rgba(255,255,255,0.7)",lineHeight:1.7}}>
        사진 찍어 PDF로 저장 — 무료<br/>이메일/공유 내보내기 — 💎 Premium
      </div>
    </div>

    <div style={{...st.card,marginBottom:12}}>
      <span style={st.label}>📸 사진 추가 (한 장씩 추가)</span>
      <CameraZone
        onImage={handleImages}
        preview={null}
        label={pages.length>0?`${pages.length}장 추가됨 · 탭하여 더 추가`:"탭하여 사진 찍기 / 갤러리 선택"}/>
    </div>

    {pages.length>0&&<div style={{...st.card,marginBottom:12}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
        <span style={{fontSize:13,fontWeight:700,color:C.navy}}>📄 스캔 페이지 ({pages.length}장)</span>
        <button onClick={()=>setPages([])} style={{background:C.redBg,border:"none",color:C.red,fontSize:11,cursor:"pointer",borderRadius:6,padding:"3px 8px",fontFamily:"inherit"}}>전체삭제</button>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
        {pages.map((p,i)=>(
          <div key={p.id} style={{position:"relative",borderRadius:8,overflow:"hidden",border:`1px solid ${C.border}`}}>
            <img src={p.src} alt={`page${i+1}`} style={{width:"100%",height:100,objectFit:"cover",display:"block"}}/>
            <div style={{position:"absolute",top:4,left:4,background:"rgba(26,43,69,0.75)",borderRadius:4,padding:"2px 6px",fontSize:10,color:"#fff"}}>{i+1}p</div>
            <button onClick={()=>setPages(prev=>prev.filter(x=>x.id!==p.id))} style={{position:"absolute",top:4,right:4,background:"rgba(217,64,64,0.85)",border:"none",borderRadius:"50%",width:20,height:20,color:"white",fontSize:11,cursor:"pointer",lineHeight:1}}>✕</button>
          </div>
        ))}
      </div>
      <F label="문서 이름 (선택)">
        <Inp value={docName} onChange={setDocName} placeholder="예: 여권 사본, 렌트 계약서"/>
      </F>
      <Btn onClick={saveDoc} color={C.teal}>💾 앱에 저장 (무료)</Btn>
      <button onClick={()=>onPremium&&onPremium()}
        style={{...st.btn(C.goldBg,C.gold),marginTop:8,border:`1px solid ${C.borderGold}`}}>
        💎 이메일/공유로 내보내기 (Premium)
      </button>
    </div>}

    {saved.length>0&&<div>
      <GLine/>
      <div style={{fontSize:13,fontWeight:700,color:C.navy,marginBottom:10}}>📁 저장된 문서 ({saved.length}개)</div>
      {saved.map(doc=>(
        <div key={doc.id} style={{...st.card,marginBottom:10}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
            <div>
              <div style={{fontSize:13,fontWeight:700,color:C.text}}>{doc.name}</div>
              <div style={{fontSize:11,color:C.textMuted}}>{fmtDate(doc.date)} · {doc.pages.length}페이지</div>
            </div>
            <button onClick={()=>persistSaved(saved.filter(d=>d.id!==doc.id))} style={{background:"none",border:"none",color:C.textMuted,cursor:"pointer",fontSize:15}}>🗑️</button>
          </div>
          <div style={{display:"flex",gap:4,marginBottom:10,overflowX:"auto"}}>
            {doc.pages.slice(0,4).map((p,i)=>(
              <img key={p.id} src={p.src} alt="" style={{height:50,width:40,objectFit:"cover",borderRadius:4,flexShrink:0,border:`1px solid ${C.border}`}}/>
            ))}
            {doc.pages.length>4&&<div style={{height:50,width:40,borderRadius:4,background:"#F1F5F9",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
              <span style={{fontSize:10,color:C.textMuted}}>+{doc.pages.length-4}</span>
            </div>}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            <button onClick={()=>printDoc(doc)} style={{padding:"9px",borderRadius:8,background:C.greenBg,border:`1px solid ${C.green}33`,color:C.green,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
              🖨️ PDF로 저장
            </button>
            <button onClick={()=>onPremium&&onPremium()} style={{padding:"9px",borderRadius:8,background:C.goldBg,border:`1px solid ${C.borderGold}`,color:C.gold,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
              💎 내보내기
            </button>
          </div>
        </div>
      ))}
    </div>}

    {saved.length===0&&pages.length===0&&<div style={{textAlign:"center",padding:"28px 0",color:C.textMuted}}>
      <div style={{fontSize:32,marginBottom:8}}>📂</div>
      <div style={{fontSize:13}}>저장된 문서가 없습니다</div>
    </div>}

    <div style={{...st.card,background:C.tealBg,border:`1px solid ${C.teal}33`,marginTop:8}}>
      <p style={{margin:0,fontSize:11,color:C.teal,lineHeight:1.7,textAlign:"center"}}>
        💡 PDF로 저장: 브라우저 인쇄 → "PDF로 저장" 선택 (완전 무료)<br/>
        📤 이메일/공유 내보내기: Premium 전용
      </p>
    </div>
  </div>;
}

function CameraBtn(props) {
  const onImage = props.onImage;
  const children = props.children;
  const color = props.color || C.sky;
  const extraStyle = props.btnStyle || {};
  const handleChange = async(e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const b64 = await fileToBase64(file);
    onImage(b64, file.type);
    e.target.value = "";
  };
  return (
    <div style={{position:"relative", overflow:"hidden",
      borderRadius:11, cursor:"pointer", ...extraStyle}}>
      {/* 보이는 버튼 */}
      <div style={{...st.btn(color,"#fff"), marginTop:0,
        display:"flex", alignItems:"center", justifyContent:"center",
        gap:6, fontSize:14, borderRadius:11, padding:"14px", fontWeight:700,
        boxShadow:`0 2px 8px ${color}55`, pointerEvents:"none"}}>
        {children}
      </div>
      {/* 투명 input이 버튼 전체를 덮음 — 터치가 직접 input으로 전달 */}
      <input type="file" accept="image/*"
        onChange={handleChange}
        style={{position:"absolute", top:0, left:0, width:"100%", height:"100%",
          opacity:0, cursor:"pointer", fontSize:0}}/>
    </div>
  );
}

// ── 카메라 업로드 영역 (큰 박스형) ────────────────────────
function CameraZone({onImage, preview, mime, label="사진 찍기/업로드"}) {
  const handleChange = async(e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const b64 = await fileToBase64(file);
    onImage(b64, file.type);
    e.target.value = "";
  };
  return (
    <div style={{position:"relative", overflow:"hidden",
      border:`2px dashed ${preview?C.green:C.borderGold}`,
      borderRadius:14, background:preview?C.greenBg:C.goldBg,
      marginBottom:12, cursor:"pointer"}}>
      <div style={{padding:"20px", textAlign:"center", pointerEvents:"none"}}>
        {preview
          ?<div>
            <img src={`data:${mime||"image/jpeg"};base64,${preview}`}
              style={{maxWidth:"100%", maxHeight:180, borderRadius:10, objectFit:"contain"}}/>
            <div style={{fontSize:12,color:C.green,marginTop:8,fontWeight:600}}>
              ✅ 사진 선택됨 · 탭하면 다시 찍기
            </div>
          </div>
          :<div>
            <div style={{fontSize:36, marginBottom:8}}>📷</div>
            <div style={{fontSize:14, fontWeight:700, color:C.gold}}>{label}</div>
            <div style={{fontSize:12, color:C.textMuted, marginTop:4}}>
              카메라로 찍거나 갤러리에서 선택
            </div>
          </div>
        }
      </div>
      <input type="file" accept="image/*"
        onChange={handleChange}
        style={{position:"absolute", top:0, left:0, width:"100%", height:"100%",
          opacity:0, cursor:"pointer", fontSize:0}}/>
    </div>
  );
}

// ── 구형 PhotoUpload (CameraZone으로 대체됨, 하위호환용) ──
function PhotoUpload({onImage, label="사진 업로드", preview}) {
  return <CameraZone onImage={onImage} preview={preview} label={label}/>;
}

// ════════════════════════════════════════════════════════
// 홈 대시보드 (오늘 일정 표시 추가)
// ════════════════════════════════════════════════════════
function HomeTab({docs,txns,todos}) {
  const expiring=docs.filter(d=>{const n=daysLeft(d.expiryDate);return n>=0&&n<=30;}).length;
  const expired=docs.filter(d=>daysLeft(d.expiryDate)<0).length;
  const thisMonth=new Date().toISOString().slice(0,7);
  const income=txns.filter(t=>t.type==="income"&&t.date.startsWith(thisMonth)).reduce((s,t)=>s+Number(t.amount),0);
  const expense=txns.filter(t=>t.type==="expense"&&t.date.startsWith(thisMonth)).reduce((s,t)=>s+Number(t.amount),0);
  const urgent=docs.map(d=>({...d,days:daysLeft(d.expiryDate)})).filter(d=>d.days>=0&&d.days<=60).sort((a,b)=>a.days-b.days).slice(0,3);

  // 오늘 일정 (시간순 정렬)
  const todayStr=today();
  const todaySchedule=(todos||[])
    .filter(t=>!t.done && t.dueDate===todayStr)
    .sort((a,b)=>{
      if(a.dueTime&&b.dueTime) return a.dueTime.localeCompare(b.dueTime);
      if(a.dueTime) return -1;
      if(b.dueTime) return 1;
      return 0;
    });

  // 이번주 예정 (오늘 제외, 7일 이내)
  const weekSchedule=(todos||[])
    .filter(t=>{
      if(t.done||t.dueDate===todayStr) return false;
      const dl=daysLeft(t.dueDate);
      return dl>0 && dl<=6;
    })
    .sort((a,b)=>a.dueDate.localeCompare(b.dueDate)||(a.dueTime||"").localeCompare(b.dueTime||""))
    .slice(0,4);

  const nowHour=new Date().getHours();
  const fmtTime=(t)=>{
    if(!t) return "";
    const [h,m]=t.split(":");
    const hh=Number(h);
    return `${hh>12?hh-12:hh||12}:${m} ${hh>=12?"PM":"AM"}`;
  };
  const isPast=(t)=>{ if(!t) return false; const [h,m]=t.split(":"); return Number(h)<nowHour||(Number(h)===nowHour&&Number(m)<new Date().getMinutes()); };
  const typeIcon=(type)=>({appointment:"📅",task:"✅",reminder:"🔔",errand:"🚶"}[type]||"📌");

  return <div>
    {/* 헤더 */}
    <div style={{...st.card,background:`linear-gradient(135deg,${C.navy},${C.navyMid})`,marginBottom:14,textAlign:"center",border:"none"}}>
      <div style={{fontSize:30,marginBottom:6}}>🇺🇸</div>
      <div style={{fontSize:20,fontWeight:900,color:"#fff",marginBottom:2}}>미국생활 911</div>
      <div style={{fontSize:12,color:"rgba(255,255,255,0.7)"}}>미국 교민 올인원 생활관리 앱</div>
      <div style={{fontSize:12,color:"#F0C35A",marginTop:8}}>{new Date().toLocaleDateString("ko-KR",{year:"numeric",month:"long",day:"numeric",weekday:"long"})}</div>
    </div>

    {/* ── 오늘 일정 타임라인 ── */}
    {todaySchedule.length>0 && (
      <div style={{...st.card,marginBottom:14,border:`1.5px solid ${C.sky}44`,background:C.skyBg}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
          <div style={{fontSize:14,fontWeight:800,color:C.sky}}>📅 오늘 일정</div>
          <span style={{...st.tag(C.sky+"22",C.sky),fontSize:11}}>{todaySchedule.length}건</span>
        </div>
        {/* 타임라인 */}
        <div style={{position:"relative",paddingLeft:44}}>
          {/* 세로 줄 */}
          <div style={{position:"absolute",left:16,top:8,bottom:8,width:2,background:`linear-gradient(180deg,${C.sky}44,${C.sky}11)`,borderRadius:1}}/>
          {todaySchedule.map((t,i)=>{
            const past=t.dueTime&&isPast(t.dueTime);
            const isNext=!past&&todaySchedule.filter(x=>x.dueTime&&!isPast(x.dueTime)).indexOf(t)===0;
            return (
              <div key={t.id} style={{position:"relative",marginBottom:i<todaySchedule.length-1?14:0}}>
                {/* 타임라인 점 */}
                <div style={{position:"absolute",left:-32,top:4,width:14,height:14,borderRadius:"50%",
                  background:past?"#CBD5E0":isNext?C.sky:C.skyLt,
                  border:`2px solid ${past?"#CBD5E0":isNext?C.navy:C.sky}`,
                  boxShadow:isNext?`0 0 0 4px ${C.sky}22`:"none"}}/>
                <div style={{background:past?"#F8FAFC":isNext?"#fff":C.bgCard,
                  border:`1px solid ${past?C.border:isNext?C.sky:C.border}`,
                  borderRadius:10,padding:"10px 12px",
                  opacity:past?0.55:1,
                  boxShadow:isNext?C.shadow:"none"}}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:3}}>
                    <div style={{display:"flex",alignItems:"center",gap:6}}>
                      <span style={{fontSize:15}}>{typeIcon(t.type)}</span>
                      <span style={{fontSize:14,fontWeight:700,color:past?C.textMuted:C.text}}>{t.text}</span>
                    </div>
                    {isNext&&<span style={{...st.tag(C.sky,C.bgCard),fontSize:10}}>▶ 다음</span>}
                    {past&&<span style={{...st.tag("#E2E8F0",C.textMuted),fontSize:10}}>완료예정</span>}
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:10}}>
                    {t.dueTime&&<span style={{fontSize:12,fontWeight:700,color:past?C.textMuted:C.sky}}>🕐 {fmtTime(t.dueTime)}</span>}
                    {t.location&&<span style={{fontSize:12,color:C.textMuted}}>📍 {t.location}</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    )}

    {/* ── 이번주 예정 ── */}
    {weekSchedule.length>0 && (
      <div style={{...st.card,marginBottom:14}}>
        <div style={{fontSize:13,fontWeight:800,color:C.navy,marginBottom:10}}>📆 이번주 예정</div>
        {weekSchedule.map((t,i)=>(
          <div key={t.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",
            borderBottom:i<weekSchedule.length-1?`1px solid ${C.border}`:"none"}}>
            <span style={{fontSize:16}}>{typeIcon(t.type)}</span>
            <div style={{flex:1}}>
              <div style={{fontSize:13,fontWeight:600,color:C.text}}>{t.text}</div>
              <div style={{fontSize:11,color:C.textMuted}}>{fmtDate(t.dueDate)}{t.dueTime&&` · ${fmtTime(t.dueTime)}`}{t.location&&` · ${t.location}`}</div>
            </div>
            <span style={{...st.tag(C.goldBg,C.gold),fontSize:11}}>D-{daysLeft(t.dueDate)}</span>
          </div>
        ))}
      </div>
    )}

    {/* AI 기능 배너 */}
    <div style={{...st.card,background:C.skyBg,border:`1.5px solid ${C.sky}33`,marginBottom:14,display:"flex",alignItems:"center",gap:12}}>
      <div style={{fontSize:28}}>🤖</div>
      <div>
        <div style={{fontSize:13,fontWeight:700,color:C.sky}}>AI 기능 (교통티켓·법률·세금·공문서·모기지)</div>
        <div style={{fontSize:12,color:C.textMid,marginTop:2}}>유료 서비스 · Premium $9.99/월 · 곧 출시</div>
      </div>
    </div>

    {/* 요약 카드 */}
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
      {[
        {label:"만료 임박 서류",value:`${expiring}건`,color:expiring>0?C.orange:C.green,bg:expiring>0?C.orangeBg:C.greenBg,icon:"📋"},
        {label:"만료된 서류",value:`${expired}건`,color:expired>0?C.red:C.green,bg:expired>0?C.redBg:C.greenBg,icon:"🚨"},
        {label:"이번달 수입",value:fmt$(income),color:C.green,bg:C.greenBg,icon:"💵"},
        {label:"이번달 지출",value:fmt$(expense),color:C.red,bg:C.redBg,icon:"💸"},
      ].map((c,i)=>(
        <div key={i} style={{...st.card,textAlign:"center",background:c.bg,border:`1px solid ${c.color}22`}}>
          <div style={{fontSize:24}}>{c.icon}</div>
          <div style={{fontSize:18,fontWeight:800,color:c.color,margin:"4px 0"}}>{c.value}</div>
          <div style={{fontSize:11,color:C.textMuted}}>{c.label}</div>
        </div>
      ))}
    </div>

    {(income>0||expense>0)&&<div style={st.card}>
      <div style={{fontSize:13,fontWeight:700,color:C.navy,marginBottom:10}}>📊 이번달 수지</div>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
        <span style={{fontSize:13,color:C.textMid}}>잔액</span>
        <span style={{fontWeight:800,color:income-expense>=0?C.green:C.red,fontSize:15}}>{fmt$(income-expense)}</span>
      </div>
      <div style={{height:8,background:"#EEF2FF",borderRadius:4,overflow:"hidden"}}>
        <div style={{height:"100%",width:`${Math.min(100,expense/(income||1)*100)}%`,background:`linear-gradient(90deg,${C.green},${C.orange})`,transition:"width 0.5s",borderRadius:4}}/>
      </div>
      <div style={{display:"flex",justifyContent:"space-between",marginTop:6}}>
        <span style={{fontSize:12,color:C.green,fontWeight:600}}>수입 {fmt$(income)}</span>
        <span style={{fontSize:12,color:C.red,fontWeight:600}}>지출 {fmt$(expense)}</span>
      </div>
    </div>}

    {urgent.length>0&&<><GLine/><div style={st.card}>
      <div style={{fontSize:13,fontWeight:700,color:C.red,marginBottom:10}}>🚨 곧 만료되는 서류</div>
      {urgent.map(d=>{
        const tp=DOC_TYPES.find(t=>t.value===d.type);
        const color=d.days<=7?C.red:d.days<=30?C.orange:C.gold;
        const bg=d.days<=7?C.redBg:d.days<=30?C.orangeBg:C.goldBg;
        return <div key={d.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:`1px solid ${C.border}`}}>
          <div>
            <div style={{fontSize:14,fontWeight:600,color:C.text}}>{tp?.label||d.name}</div>
            <div style={{fontSize:12,color:C.textMuted}}>{d.name} · {fmtDate(d.expiryDate)}</div>
          </div>
          <span style={st.tag(bg,color)}>{d.days===0?"오늘만료":`D-${d.days}`}</span>
        </div>;
      })}
    </div></>}

    <GLine/>
    <div style={{...st.card,background:C.goldBg,border:`1px solid ${C.borderGold}`}}>
      <p style={{margin:0,fontSize:12,color:C.navy,lineHeight:1.8,textAlign:"center"}}>
        💡 <strong>미국생활 911</strong> — 서류관리 · 가계부 · 법률 · 세금 · 모기지 · 공문서까지
      </p>
    </div>
  </div>;
}

// ════════════════════════════════════════════════════════
// 서류 관리 (사진 스캔 자동입력)
// ════════════════════════════════════════════════════════
function DocsTab() {
  const [docs,setDocs]       = useState([]);
  const [modal,setModal]     = useState(false);
  const [filter,setFilter]   = useState("all");
  const [form,setForm]       = useState({name:"",type:"dl",issueDate:"",expiryDate:"",notes:""});
  const [scanImg,setScanImg] = useState(null);
  const [scanType,setScanType] = useState("image/jpeg");
  const [scanLoad,setScanLoad] = useState(false);
  const [scanDone,setScanDone] = useState(false);
  const imgInputRef = useRef();

  useEffect(()=>{load("docs").then(setDocs);},[]);
  const persist=d=>{setDocs(d);save("docs",d);};
  const add=()=>{
    if(!form.name||!form.expiryDate) return;
    persist([...docs,{...form,id:uid(),createdAt:today()}]);
    setForm({name:"",type:"dl",issueDate:"",expiryDate:"",notes:""});
    setScanImg(null);setScanDone(false);
    setModal(false);
  };
  const del=id=>persist(docs.filter(d=>d.id!==id));
  const statusOf=d=>{
    const n=daysLeft(d.expiryDate);
    if(n<0)  return{label:"만료됨",color:C.red,   bg:C.redBg};
    if(n<=14)return{label:`D-${n}`,color:C.red,   bg:C.redBg};
    if(n<=30)return{label:`D-${n}`,color:C.orange,bg:C.orangeBg};
    if(n<=90)return{label:`D-${n}`,color:C.gold,  bg:C.goldBg};
    return   {label:"정상",       color:C.green,  bg:C.greenBg};
  };
  const filtered=docs
    .map(d=>({...d,days:daysLeft(d.expiryDate),status:statusOf(d)}))
    .filter(d=>{
      if(filter==="urgent") return d.days>=0&&d.days<=30;
      if(filter==="expired") return d.days<0;
      return true;
    })
    .sort((a,b)=>a.days-b.days);

  // 사진 → AI 자동 분석
  const handleDocScan = async(b64, fileType) => {
    setScanImg(b64); setScanType(fileType||"image/jpeg");
    setScanLoad(true); setScanDone(false);

    const SYS=`당신은 미국 공문서·신분증 분석 전문가입니다.
사진을 보고 반드시 JSON만 반환하세요 (설명·마크다운 없이):
{
  "type": "dl|passport|visa|car_reg|car_ins|health_ins|lease|work_perm|itin|tax_dead|rx|license|other",
  "name": "서류 소유자 이름 또는 서류 종류 한국어",
  "issueDate": "YYYY-MM-DD 또는 null",
  "expiryDate": "YYYY-MM-DD 또는 null",
  "notes": "기타 중요 정보 한국어 한줄"
}
날짜가 MM/DD/YYYY 형식이면 YYYY-MM-DD로 변환하세요.
읽을 수 없으면 null로 표시하세요.`;

    const r=await askClaudeWithImage(SYS,"이 서류 사진에서 정보를 추출해주세요.",b64,file.type);
    try{
      const clean=r.replace(/```json|```/g,"").trim();
      const parsed=JSON.parse(clean);
      setForm({
        type:   parsed.type||"other",
        name:   parsed.name||"",
        issueDate: parsed.issueDate||"",
        expiryDate:parsed.expiryDate||"",
        notes:  parsed.notes||"",
      });
      setScanDone(true);
    } catch {
      // 파싱 실패해도 모달은 열어줌
    }
    setScanLoad(false);
    setModal(true);
  };

  const openManual = () => {
    setScanImg(null); setScanDone(false);
    setForm({name:"",type:"dl",issueDate:"",expiryDate:"",notes:""});
    setModal(true);
  };

  return <div>
    {/* 필터 */}
    <div style={{display:"flex",gap:6,marginBottom:12}}>
      {[["all","전체"],["urgent","임박"],["expired","만료"]].map(([v,l])=>(
        <button key={v} onClick={()=>setFilter(v)} style={{flex:1,padding:"10px",borderRadius:10,
          fontFamily:"inherit",border:`1.5px solid ${filter===v?C.gold:C.border}`,
          background:filter===v?C.goldBg:"transparent",
          color:filter===v?C.gold:C.textMid,fontSize:13,fontWeight:700,cursor:"pointer"}}>{l}</button>
      ))}
    </div>

    {/* 추가 버튼 2개 */}
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:4}}>
      <CameraBtn onImage={handleDocScan} color={C.sky}>
        📷 사진 찍어 자동입력
      </CameraBtn>
      <button onClick={openManual}
        style={{...st.btn(C.teal,"#fff"),marginTop:0,fontSize:14}}>
        ✏️ 직접 입력
      </button>
    </div>
    <div style={{fontSize:11,color:C.textMuted,textAlign:"center",marginBottom:14}}>
      📷 여권·면허증·비자 사진을 찍으면 날짜가 자동으로 입력됩니다
    </div>

    {/* AI 로딩 오버레이 */}
    {scanLoad&&<div style={{...st.card,background:C.skyBg,border:`1.5px solid ${C.sky}33`,
      textAlign:"center",marginBottom:12}}>
      <Dots/>
      <div style={{fontSize:13,color:C.sky,fontWeight:600,marginTop:-10}}>
        📷 서류 사진 분석 중... 잠깐만요!
      </div>
    </div>}

    {/* 서류 목록 */}
    <div>
      {filtered.length===0
        ?<div style={{textAlign:"center",padding:"40px 0",color:C.textMuted}}>
          <div style={{fontSize:36,marginBottom:10}}>📋</div>
          <div style={{fontSize:14}}>등록된 서류가 없습니다</div>
          <div style={{fontSize:12,marginTop:6}}>사진 찍기 또는 직접 입력으로 추가하세요</div>
        </div>
        :filtered.map(d=>{
          const tp=DOC_TYPES.find(t=>t.value===d.type);
          return <div key={d.id} style={{...st.card,marginBottom:10}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
              <div style={{flex:1}}>
                <div style={{fontSize:15,fontWeight:700,color:C.text,marginBottom:3}}>
                  {tp?.label||"📄"} {d.name}
                </div>
                {d.issueDate&&<div style={{fontSize:12,color:C.textMuted}}>발급: {fmtDate(d.issueDate)}</div>}
                <div style={{fontSize:12,color:C.textMuted}}>만료: {fmtDate(d.expiryDate)}</div>
                {d.notes&&<div style={{fontSize:12,color:C.textMuted,marginTop:4}}>{d.notes}</div>}
              </div>
              <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:8}}>
                <span style={st.tag(d.status.bg,d.status.color)}>{d.status.label}</span>
                <button onClick={()=>del(d.id)} style={{background:"none",border:"none",
                  color:C.textMuted,fontSize:15,cursor:"pointer",padding:0}}>🗑️</button>
              </div>
            </div>
          </div>;
        })
      }
    </div>

    {/* 서류 추가/수정 모달 */}
    <Modal open={modal} onClose={()=>{setModal(false);setScanImg(null);setScanDone(false);}} title="📋 서류 추가">

      {/* 스캔 미리보기 */}
      {scanImg&&(
        <div style={{marginBottom:14}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
            <img src={`data:${scanType};base64,${scanImg}`}
              style={{width:60,height:60,objectFit:"cover",borderRadius:8,border:`1px solid ${C.border}`}}/>
            <div>
              {scanDone
                ?<div style={{fontSize:13,fontWeight:700,color:C.green}}>✅ AI 자동입력 완료!</div>
                :<div style={{fontSize:13,color:C.textMuted}}>📷 스캔된 사진</div>
              }
              <div style={{fontSize:11,color:C.textMuted,marginTop:2}}>
                내용을 확인하고 필요하면 수정하세요
              </div>
            </div>
          </div>
          {scanDone&&<div style={{padding:"8px 12px",background:C.greenBg,
            border:`1px solid ${C.green}33`,borderRadius:8,fontSize:12,color:C.green}}>
            🤖 AI가 서류 정보를 자동으로 읽었습니다. 날짜·이름을 확인해 주세요.
          </div>}
        </div>
      )}

      <F label="서류 종류">
        <Sel value={form.type} onChange={v=>setForm({...form,type:v})}
          options={DOC_TYPES.map(t=>({v:t.value,l:t.label}))}/>
      </F>
      <F label="별칭/이름 (예: 내 여권, 남편 면허증)">
        <Inp value={form.name} onChange={v=>setForm({...form,name:v})} placeholder="예: 내 운전면허증"/>
      </F>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <F label="발급일">
          <Inp type="date" value={form.issueDate} onChange={v=>setForm({...form,issueDate:v})} max={today()}/>
        </F>
        <F label="만료일 ⚠️">
          <Inp type="date" value={form.expiryDate} onChange={v=>setForm({...form,expiryDate:v})}/>
        </F>
      </div>
      <F label="메모 (선택)">
        <Inp value={form.notes} onChange={v=>setForm({...form,notes:v})} placeholder="예: DMV 위치, 갱신 방법 등"/>
      </F>
      <Btn onClick={add} color={C.teal} disabled={!form.name||!form.expiryDate}>
        💾 서류 저장
      </Btn>

      <CameraBtn onImage={handleDocScan} color="#E2E8F0" btnStyle={{marginTop:8}}>
        <span style={{color:C.textMid}}>📷 다른 사진으로 다시 스캔</span>
      </CameraBtn>
    </Modal>
  </div>;
}

// ════════════════════════════════════════════════════════
// 가계부 (영수증 + 모든 청구서/인보이스 스캔)
// ════════════════════════════════════════════════════════

// 발행처 → 카테고리 자동 매핑
const VENDOR_CAT_MAP = [
  {keys:["DWP","Department of Water","수도","water"],    cat:"💧 수도세"},
  {keys:["Edison","SCE","Electric","전기","electricity"], cat:"💡 전기세"},
  {keys:["SoCalGas","Gas Company","gas","가스"],          cat:"🔥 가스비"},
  {keys:["Spectrum","AT&T","Verizon","T-Mobile","인터넷","internet","wireless","mobile"],cat:"🌐 인터넷"},
  {keys:["Xfinity","Cox","인터넷"],                       cat:"🌐 인터넷"},
  {keys:["Kaiser","Blue Shield","Anthem","Cigna","보험","insurance","Medicare","Medi-Cal"],cat:"🏥 의료/보험"},
  {keys:["HOA","Association"],                            cat:"🏠 렌트/모기지"},
  {keys:["DMV","Vehicle","자동차"],                       cat:"🚗 자동차"},
  {keys:["IRS","Franchise Tax","세금","tax"],             cat:"💰 저축/투자"},
  {keys:["Costco","Walmart","Target","Ralph","Vons","Kroger","마트","grocery"],cat:"🛒 식료품"},
  {keys:["McDonald","Starbucks","restaurant","café","Pizza","식당","외식"],  cat:"🍽️ 외식"},
  {keys:["Amazon","Online","온라인"],                     cat:"🎁 기타"},
];

function guessCat(vendor="", aiCat="") {
  const src=(vendor+" "+aiCat).toLowerCase();
  for(const {keys,cat} of VENDOR_CAT_MAP){
    if(keys.some(k=>src.includes(k.toLowerCase()))) return cat;
  }
  return EXPENSE_CATS.find(c=>c.includes(aiCat||"")) || "🎁 기타";
}

function BudgetTab() {
  const [txns,setTxns]             = useState([]);
  const [modal,setModal]           = useState(false);
  const [scanModal,setScanModal]   = useState(false);
  const [form,setForm]             = useState({type:"expense",amount:"",category:EXPENSE_CATS[0],description:"",date:""});
  const [month,setMonth]           = useState(new Date().toISOString().slice(0,7));
  const [scanImg,setScanImg]       = useState(null);
  const [scanMime,setScanMime]     = useState("image/jpeg");
  const [scanLoad,setScanLoad]     = useState(false);
  const [scanResult,setScanResult] = useState(null);
  const imgRef                     = useRef();

  useEffect(()=>{load("txns").then(setTxns);},[]);
  const persist=t=>{setTxns(t);save("txns",t);};
  const add=()=>{
    if(!form.amount||Number(form.amount)<=0||!form.date) return;
    persist([{...form,id:uid(),amount:Number(form.amount)},...txns]);
    setForm({type:"expense",amount:"",category:EXPENSE_CATS[0],description:"",date:""});
    setModal(false);
  };
  const del=id=>persist(txns.filter(t=>t.id!==id));

  // ── 사진 선택 핸들러 — CameraBtn/CameraZone에서 (b64,type) 받음
  const handleScanFile = (b64, fileType) => {
    setScanImg(b64); setScanMime(fileType||"image/jpeg");
    setScanResult(null);
  };

  // ── AI 분석 (영수증 + 모든 인보이스/청구서) ───────────
  const runScan = async() => {
    if(!scanImg) return;
    setScanLoad(true); setScanResult(null);

    const SYS=`당신은 미국 영수증·청구서·인보이스 전문 분석가입니다.
사진이 다음 중 무엇인지 파악하세요:
- 일반 영수증 (마트, 식당, 약국 등)
- 공과금 청구서 (전기 Edison/SCE, 수도 DWP, 가스 SoCalGas 등)
- 인터넷/통신 청구서 (Spectrum, AT&T, Verizon 등)
- 의료/보험 청구서 (Kaiser, Blue Shield 등)
- 정부기관 청구서 (DMV, IRS, HOA 등)
- 렌트/모기지 청구서

반드시 JSON만 반환하세요 (설명·마크다운 없이):
{
  "docType": "receipt|utility|telecom|medical|government|rent|other",
  "vendor": "발행처 이름 (영어 원문 그대로)",
  "vendorKo": "발행처 한국어 이름 또는 설명",
  "date": "YYYY-MM-DD (청구일 또는 거래일)",
  "dueDate": "YYYY-MM-DD 또는 null (납부기한, 청구서인 경우)",
  "total": 숫자 (Amount Due 또는 Total),
  "period": "청구 기간 (예: Apr 2025) 또는 null",
  "category": "전기세|수도세|가스비|인터넷|식료품|외식|의료/보험|자동차|세금|기타",
  "items": [{"name":"항목명","amount":숫자}],
  "notes": "중요 정보 한줄 (한국어)"
}
금액은 숫자만 ($ 기호 제외). 읽을 수 없으면 null.`;

    const r=await askClaudeWithImage(SYS,"이 사진의 모든 청구 정보를 JSON으로 추출해주세요.",scanImg,scanMime);
    try{
      const clean=r.replace(/```json|```/g,"").trim();
      const parsed=JSON.parse(clean);
      setScanResult(parsed);
    } catch { setScanResult({error:true, raw:r.slice(0,200)}); }
    setScanLoad(false);
  };

  // ── 스캔 결과 → 가계부 적용 ──────────────────────────
  const applyScan = () => {
    if(!scanResult||scanResult.error) return;
    const cat=guessCat(scanResult.vendor, scanResult.category);
    const desc=scanResult.vendorKo||scanResult.vendor||"";
    const memo=scanResult.period?`${desc} (${scanResult.period})`:desc;
    setForm({
      type:"expense",
      amount:String(scanResult.total||""),
      category:cat,
      description:memo,
      date:"",           // 납부일은 반드시 사용자가 직접 입력
      _billingDate:scanResult.date||"",    // 청구일 (참고용)
      _dueDate:scanResult.dueDate||"",     // 납부기한 (참고용)
      _period:scanResult.period||"",       // 청구기간 (참고용)
    });
    setScanModal(false); setScanImg(null); setScanResult(null);
    setModal(true);
  };

  const resetScan=()=>{setScanImg(null);setScanResult(null);};

  // ── 월 계산 ──────────────────────────────────────────
  const monthly=txns.filter(t=>t.date.startsWith(month));
  const income =monthly.filter(t=>t.type==="income" ).reduce((s,t)=>s+t.amount,0);
  const expense=monthly.filter(t=>t.type==="expense").reduce((s,t)=>s+t.amount,0);
  const balance=income-expense;
  const byCat={};
  monthly.filter(t=>t.type==="expense").forEach(t=>{byCat[t.category]=(byCat[t.category]||0)+t.amount;});
  const catSorted=Object.entries(byCat).sort((a,b)=>b[1]-a[1]);
  const prevMonth=()=>{const d=new Date(month+"-01");d.setMonth(d.getMonth()-1);setMonth(d.toISOString().slice(0,7));};
  const nextMonth=()=>{const d=new Date(month+"-01");d.setMonth(d.getMonth()+1);if(d.toISOString().slice(0,7)<=new Date().toISOString().slice(0,7))setMonth(d.toISOString().slice(0,7));};

  // 문서 타입 아이콘
  const docIcon=(t)=>({receipt:"🧾",utility:"💡",telecom:"📱",medical:"🏥",government:"🏛️",rent:"🏠",other:"📄"}[t]||"📄");

  return <div>
    {/* 월 선택 */}
    <div style={{...st.card,marginBottom:12,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
      <button onClick={prevMonth} style={{background:"#F1F5F9",border:"none",color:C.navy,fontSize:20,cursor:"pointer",borderRadius:8,width:36,height:36,display:"flex",alignItems:"center",justifyContent:"center"}}>‹</button>
      <div style={{textAlign:"center"}}>
        <div style={{fontSize:15,fontWeight:800,color:C.text}}>{new Date(month+"-01").toLocaleDateString("ko-KR",{year:"numeric",month:"long"})}</div>
        <div style={{fontSize:13,color:balance>=0?C.green:C.red,fontWeight:600}}>잔액 {fmt$(balance)}</div>
      </div>
      <button onClick={nextMonth} style={{background:"#F1F5F9",border:"none",color:C.navy,fontSize:20,cursor:"pointer",borderRadius:8,width:36,height:36,display:"flex",alignItems:"center",justifyContent:"center"}}>›</button>
    </div>

    {/* 수지 요약 */}
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:12}}>
      {[{l:"수입",v:fmt$(income),c:C.green,bg:C.greenBg},
        {l:"지출",v:fmt$(expense),c:C.red,bg:C.redBg},
        {l:"잔액",v:fmt$(balance),c:balance>=0?C.green:C.red,bg:balance>=0?C.greenBg:C.redBg}]
        .map((x,i)=><div key={i} style={{...st.card,textAlign:"center",padding:"12px 8px",background:x.bg,border:`1px solid ${x.c}22`}}>
          <div style={{fontSize:13,fontWeight:800,color:x.c}}>{x.v}</div>
          <div style={{fontSize:11,color:C.textMuted,marginTop:2}}>{x.l}</div>
        </div>)}
    </div>

    {/* 지출 분석 */}
    {catSorted.length>0&&<div style={{...st.card,marginBottom:12}}>
      <div style={{fontSize:13,fontWeight:700,color:C.navy,marginBottom:10}}>📊 지출 분석</div>
      {catSorted.slice(0,6).map(([cat,amt],i)=>(
        <div key={i} style={{marginBottom:10}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
            <span style={{fontSize:13,color:C.text}}>{cat}</span>
            <span style={{fontSize:13,fontWeight:700,color:C.red}}>{fmt$(amt)}</span>
          </div>
          <div style={{height:5,background:"#EEF2FF",borderRadius:3}}>
            <div style={{height:"100%",borderRadius:3,width:`${Math.round(amt/expense*100)}%`,
              background:`linear-gradient(90deg,${C.sky},${C.purple})`}}/>
          </div>
        </div>
      ))}
    </div>}

    {/* 입력 버튼 */}
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:4}}>
      <CameraBtn onImage={(b64,type)=>{handleScanFile(b64,type);setScanModal(true);}} color={C.teal}>
        📷 사진으로 입력
      </CameraBtn>
      <button onClick={()=>setModal(true)}
        style={{...st.btn(C.gold,C.navy),marginTop:0,fontSize:14}}>
        ✏️ 직접 입력
      </button>
    </div>
    <div style={{fontSize:11,color:C.textMuted,textAlign:"center",marginBottom:14,lineHeight:1.6}}>
      영수증 · 전기/수도/가스 · 인터넷 · 의료 · HOA · DMV 등 모든 청구서 OK
    </div>

    {/* 거래 목록 */}
    <div style={{marginTop:4}}>
      {monthly.length===0
        ?<div style={{textAlign:"center",padding:"28px 0",color:C.textMuted}}>
          <div style={{fontSize:30,marginBottom:8}}>💳</div>
          <div style={{fontSize:13}}>이번달 내역이 없습니다</div>
        </div>
        :[...monthly].sort((a,b)=>b.date.localeCompare(a.date)).map(t=>(
          <div key={t.id} style={{...st.card,marginBottom:8,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div>
              <div style={{fontSize:12,color:C.textMuted}}>{fmtDate(t.date)}</div>
              <div style={{fontSize:14,fontWeight:600,color:C.text}}>{t.category}</div>
              {t.description&&<div style={{fontSize:12,color:C.textMuted}}>{t.description}</div>}
            </div>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <span style={{fontSize:15,fontWeight:800,color:t.type==="income"?C.green:C.red}}>
                {t.type==="income"?"+":"-"}{fmt$(t.amount)}
              </span>
              <button onClick={()=>del(t.id)} style={{background:"#F1F5F9",border:"none",color:C.textMid,cursor:"pointer",padding:"4px 8px",borderRadius:6,fontSize:12}}>✕</button>
            </div>
          </div>
        ))
      }
    </div>

    {/* ── 스캔 모달 ── */}
    <Modal open={scanModal} onClose={()=>{setScanModal(false);resetScan();}} title="📷 청구서·영수증 스캔">

      {/* 안내 배너 */}
      <div style={{...st.card,background:C.skyBg,border:`1px solid ${C.sky}33`,marginBottom:14,padding:"12px"}}>
        <div style={{fontSize:12,color:C.sky,fontWeight:700,marginBottom:6}}>인식 가능한 문서</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
          {["🧾 일반 영수증","💡 전기 (Edison)","💧 수도 (DWP)",
            "🔥 가스 (SoCalGas)","📱 인터넷/통신","🏥 의료비","🏛️ HOA/DMV/IRS"].map((t,i)=>(
            <span key={i} style={{...st.tag(C.skyBg,C.sky),border:`1px solid ${C.sky}33`}}>{t}</span>
          ))}
        </div>
      </div>

      {/* 사진 업로드 영역 */}
      <CameraZone
        onImage={(b64,type)=>{handleScanFile(b64,type);}}
        preview={scanImg} mime={scanMime}
        label="청구서·영수증 사진 찍기"/>

      {scanImg&&!scanResult&&(
        <Btn onClick={runScan} disabled={scanLoad} color={C.sky}>
          {scanLoad?"🔍 분석 중...":"🔍 AI 자동 분석 시작"}
        </Btn>
      )}
      {scanLoad&&<><Dots/><div style={{textAlign:"center",fontSize:12,color:C.sky,marginTop:-10}}>내용을 읽고 있습니다...</div></>}

      {/* 분석 성공 결과 */}
      {scanResult&&!scanResult.error&&<div style={{marginTop:12}}>
        <div style={{...st.card,background:C.greenBg,border:`1.5px solid ${C.green}33`}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
            <span style={{fontSize:24}}>{docIcon(scanResult.docType)}</span>
            <div>
              <div style={{fontSize:14,fontWeight:800,color:C.green}}>✅ 분석 완료</div>
              <div style={{fontSize:12,color:C.textMuted}}>{scanResult.vendorKo||scanResult.vendor}</div>
            </div>
          </div>
          {[
            ["발행처",  scanResult.vendorKo||(scanResult.vendor||"미확인"), C.text],
            ["청구금액",scanResult.total!=null?fmt$(scanResult.total):"미확인", C.red],
            ["청구일",  scanResult.date||"미확인", C.textMid],
            ["납부기한",scanResult.dueDate||"없음", scanResult.dueDate?C.orange:C.textMuted],
            ["청구기간",scanResult.period||"해당없음", C.textMid],
            ["자동분류",guessCat(scanResult.vendor,scanResult.category), C.sky],
          ].map(([label,val,color],i)=>(
            <div key={i} style={{display:"flex",justifyContent:"space-between",
              padding:"7px 0",borderBottom:`1px solid ${C.border}`}}>
              <span style={{fontSize:12,color:C.textMuted}}>{label}</span>
              <span style={{fontSize:13,fontWeight:700,color}}>{val}</span>
            </div>
          ))}
          {scanResult.items?.length>0&&<div style={{marginTop:10}}>
            <div style={{fontSize:11,color:C.textMuted,fontWeight:700,marginBottom:6}}>세부 항목</div>
            {scanResult.items.slice(0,5).map((item,i)=>(
              <div key={i} style={{display:"flex",justifyContent:"space-between",fontSize:12,color:C.textMid,marginBottom:3}}>
                <span>· {item.name}</span>
                <span>{item.amount!=null?fmt$(item.amount):""}</span>
              </div>
            ))}
          </div>}
          {scanResult.notes&&<div style={{marginTop:10,fontSize:12,color:C.navy,
            background:"#fff",borderRadius:8,padding:"8px 10px"}}>
            💬 {scanResult.notes}
          </div>}
        </div>
        <Btn onClick={applyScan} color={C.green}>✅ 가계부에 추가</Btn>
        <CameraBtn onImage={(b64,type)=>{handleScanFile(b64,type);}} color="#94A3B8" btnStyle={{marginTop:8}}>
          <span style={{color:"#fff"}}>📷 다른 사진으로 다시 스캔</span>
        </CameraBtn>
      </div>}

      {/* 분석 실패 */}
      {scanResult?.error&&<div style={{...st.card,background:C.redBg,border:`1px solid ${C.red}33`,marginTop:12,textAlign:"center"}}>
        <div style={{fontSize:20,marginBottom:6}}>😅</div>
        <div style={{fontSize:13,fontWeight:700,color:C.red,marginBottom:4}}>자동 분석 실패</div>
        <div style={{fontSize:12,color:C.textMid,marginBottom:10}}>
          사진을 더 밝고 선명하게 찍어보세요.
        </div>
        <CameraBtn onImage={(b64,type)=>{handleScanFile(b64,type);}} color={C.sky}>
          📷 다시 찍기
        </CameraBtn>
      </div>}
    </Modal>

    {/* ── 직접 입력 모달 ── */}
    <Modal open={modal} onClose={()=>setModal(false)} title="💳 수입/지출 추가">

      {/* 수입/지출 선택 */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
        {["income","expense"].map(tp=>(
          <button key={tp} onClick={()=>setForm({...form,type:tp,category:tp==="income"?INCOME_CATS[0]:EXPENSE_CATS[0]})}
            style={{padding:"12px",borderRadius:10,fontFamily:"inherit",cursor:"pointer",
              border:`1.5px solid ${form.type===tp?(tp==="income"?C.green:C.red):C.border}`,
              background:form.type===tp?(tp==="income"?C.greenBg:C.redBg):"transparent",
              color:form.type===tp?(tp==="income"?C.green:C.red):C.textMid,fontWeight:700,fontSize:14}}>
            {tp==="income"?"💵 수입":"💸 지출"}
          </button>
        ))}
      </div>

      {/* 스캔에서 넘어온 참고 정보 */}
      {(form._billingDate||form._dueDate||form._period)&&(
        <div style={{...st.card,background:C.skyBg,border:`1px solid ${C.sky}33`,marginBottom:14,padding:"10px 14px"}}>
          <div style={{fontSize:12,fontWeight:700,color:C.sky,marginBottom:6}}>📋 청구서 참고 정보</div>
          <div style={{display:"flex",flexDirection:"column",gap:4}}>
            {form._billingDate&&<div style={{fontSize:12,color:C.textMid}}>
              📅 청구일: <strong style={{color:C.text}}>{fmtDate(form._billingDate)}</strong>
            </div>}
            {form._dueDate&&<div style={{fontSize:12,color:C.textMid}}>
              ⚠️ 납부기한: <strong style={{color:C.orange}}>{fmtDate(form._dueDate)}</strong>
            </div>}
            {form._period&&<div style={{fontSize:12,color:C.textMid}}>
              🗓️ 청구기간: <strong style={{color:C.text}}>{form._period}</strong>
            </div>}
          </div>
        </div>
      )}

      <F label="금액 ($)">
        <Inp type="number" value={form.amount} onChange={v=>setForm({...form,amount:v})} placeholder="예: 150"/>
      </F>
      <F label="카테고리">
        <Sel value={form.category} onChange={v=>setForm({...form,category:v})}
          options={form.type==="income"?INCOME_CATS.map(c=>({v:c,l:c})):EXPENSE_CATS.map(c=>({v:c,l:c}))}/>
      </F>
      <F label="메모 (발행처·내용)">
        <Inp value={form.description} onChange={v=>setForm({...form,description:v})} placeholder="예: CBR 줄기세포 연간보관료"/>
      </F>

      {/* 납부일 — 필수, 강조 */}
      <div style={{...st.card, background:form.date?C.greenBg:C.redBg,
        border:`1.5px solid ${form.date?C.green:C.red}`,marginBottom:14,padding:"14px"}}>
        <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}>
          <span style={{fontSize:16}}>📅</span>
          <span style={{fontSize:14,fontWeight:800,color:form.date?C.green:C.red}}>
            실제 납부일 {form.date?"✅":"(필수 입력)"}
          </span>
        </div>
        <input type="date" value={form.date}
          onChange={e=>setForm({...form,date:e.target.value})}
          max={today()}
          style={{...st.input, border:`1.5px solid ${form.date?C.green:C.red}`,
            background:"#fff", fontSize:15, fontWeight:form.date?700:400}}/>
        {!form.date&&<div style={{fontSize:12,color:C.red,marginTop:6,fontWeight:600}}>
          ⚠️ 납부일을 입력해야 저장 버튼이 활성화됩니다
        </div>}
        {form.date&&<div style={{fontSize:12,color:C.green,marginTop:6,fontWeight:600}}>
          ✅ {fmtDate(form.date)} 납부 기록됩니다
        </div>}
      </div>

      <Btn onClick={add}
        color={form.type==="income"?C.green:C.red}
        disabled={!form.amount||Number(form.amount)<=0||!form.date}>
        {!form.date
          ? "📅 납부일을 먼저 입력하세요"
          : form.type==="income"?"💵 수입 저장":"💸 지출 저장"
        }
      </Btn>
    </Modal>
  </div>;
}

// ════════════════════════════════════════════════════════
// 개인 비서 (월간 달력 + 시간별 일정)
// ════════════════════════════════════════════════════════
const TODO_TYPES=[
  {v:"appointment",l:"📅 예약/미팅"},
  {v:"task",       l:"✅ 할 일"},
  {v:"reminder",   l:"🔔 리마인더"},
  {v:"errand",     l:"🚶 외출/심부름"},
];

function PATab({docs,txns}){
  const [todos,setTodos]   = useState([]);
  const [aiResult,setAi]   = useState("");
  const [loading,setLoad]  = useState(false);
  const [addModal,setAddModal] = useState(false);
  const [viewDate,setViewDate] = useState(today());
  // 달력 표시 월 (YYYY-MM)
  const [calMonth,setCalMonth] = useState(new Date().toISOString().slice(0,7));
  const [form,setForm] = useState({text:"",type:"appointment",dueDate:today(),dueTime:"",location:"",notes:""});

  useEffect(()=>{load("todos").then(setTodos);},[]);
  const persist=t=>{setTodos(t);save("todos",t);};

  const addTodo=()=>{
    if(!form.text.trim()||!form.dueDate) return;
    persist([{id:uid(),...form,done:false,createdAt:today()},...todos]);
    setForm({text:"",type:"appointment",dueDate:viewDate,dueTime:"",location:"",notes:""});
    setAddModal(false);
  };
  const toggleTodo=id=>persist(todos.map(t=>t.id===id?{...t,done:!t.done}:t));
  const delTodo   =id=>persist(todos.filter(t=>t.id!==id));

  const getAdvice=async()=>{
    setLoad(true);setAi("");
    const expiring=docs.filter(d=>{const n=daysLeft(d.expiryDate);return n>=0&&n<=60;}).map(d=>`${DOC_TYPES.find(t=>t.value===d.type)?.label} D-${daysLeft(d.expiryDate)}`);
    const todayItems=todos.filter(t=>!t.done&&t.dueDate===today()).map(t=>`${t.dueTime?t.dueTime+" ":""}${t.text}${t.location?" @"+t.location:""}`);
    const upcoming=todos.filter(t=>{if(t.done||t.dueDate===today())return false;const dl=daysLeft(t.dueDate);return dl>0&&dl<=7;}).map(t=>`${t.dueDate} ${t.text}`);
    const thisMonth=new Date().toISOString().slice(0,7);
    const expense=txns.filter(t=>t.type==="expense"&&t.date.startsWith(thisMonth)).reduce((s,t)=>s+t.amount,0);
    const msg=`오늘일정:${todayItems.join(", ")||"없음"} / 이번주:${upcoming.join(", ")||"없음"} / 만료임박:${expiring.join(",")||"없음"} / 이번달지출:$${expense}`;
    const sys=`미국 교민 개인비서. 한국어로 친근하게.\n🗓️ 오늘 우선순위:\n1.\n2.\n3.\n💡 이번주 꼭 할 일:\n💰 재정 조언:\n🔔 놓치기 쉬운 것:`;
    const r=await askClaude(sys,msg);setAi(r);setLoad(false);
  };

  // ── 월간 달력 계산 ─────────────────────────────────────
  const buildMonthGrid=()=>{
    const [y,m]=calMonth.split("-").map(Number);
    const firstDay=new Date(y,m-1,1).getDay(); // 0=일
    const lastDate=new Date(y,m,0).getDate();
    const cells=[];
    // 앞 빈칸
    for(let i=0;i<firstDay;i++) cells.push(null);
    // 날짜
    for(let d=1;d<=lastDate;d++){
      const ds=`${calMonth}-${String(d).padStart(2,"0")}`;
      const cnt=todos.filter(t=>t.dueDate===ds&&!t.done).length;
      cells.push({d,ds,cnt});
    }
    return cells;
  };

  const prevCalMonth=()=>{
    const [y,m]=calMonth.split("-").map(Number);
    const d=new Date(y,m-2,1);
    setCalMonth(d.toISOString().slice(0,7));
  };
  const nextCalMonth=()=>{
    const [y,m]=calMonth.split("-").map(Number);
    const d=new Date(y,m,1);
    setCalMonth(d.toISOString().slice(0,7));
  };

  const cells=buildMonthGrid();

  // 선택된 날 일정
  const viewItems=todos
    .filter(t=>t.dueDate===viewDate)
    .sort((a,b)=>{
      if(a.done!==b.done) return a.done?1:-1;
      if(a.dueTime&&b.dueTime) return a.dueTime.localeCompare(b.dueTime);
      if(a.dueTime) return -1; if(b.dueTime) return 1;
      return 0;
    });

  const fmtTime=(t)=>{if(!t)return "";const[h,m]=t.split(":");const hh=Number(h);return `${hh>12?hh-12:hh||12}:${m} ${hh>=12?"PM":"AM"}`;};
  const typeIcon =(type)=>({appointment:"📅",task:"✅",reminder:"🔔",errand:"🚶"}[type]||"📌");
  const typeColor=(type)=>({appointment:C.sky,task:C.teal,reminder:C.orange,errand:C.purple}[type]||C.gold);

  const [calY,calM]=calMonth.split("-").map(Number);

  return <div>
    {/* ── 월간 달력 먼저 ── */}
    <div style={{...st.card,marginBottom:12}}>

      {/* 월 이동 헤더 */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <button onClick={prevCalMonth}
          style={{background:"#F1F5F9",border:"none",borderRadius:8,width:34,height:34,
            cursor:"pointer",color:C.navy,fontSize:18,display:"flex",alignItems:"center",justifyContent:"center"}}>‹</button>
        <div style={{textAlign:"center"}}>
          <div style={{fontSize:15,fontWeight:800,color:C.navy}}>
            {new Date(calY,calM-1,1).toLocaleDateString("ko-KR",{year:"numeric",month:"long"})}
          </div>
          <div style={{fontSize:11,color:C.sky,marginTop:2}}>
            {new Date(viewDate).toLocaleDateString("ko-KR",{month:"long",day:"numeric",weekday:"short"})} 선택됨
          </div>
        </div>
        <button onClick={nextCalMonth}
          style={{background:"#F1F5F9",border:"none",borderRadius:8,width:34,height:34,
            cursor:"pointer",color:C.navy,fontSize:18,display:"flex",alignItems:"center",justifyContent:"center"}}>›</button>
      </div>

      {/* 요일 헤더 */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2,marginBottom:4}}>
        {["일","월","화","수","목","금","토"].map((d,i)=>(
          <div key={i} style={{textAlign:"center",fontSize:11,fontWeight:700,
            color:i===0?C.red:i===6?C.sky:C.textMuted,padding:"4px 0"}}>
            {d}
          </div>
        ))}
      </div>

      {/* 날짜 그리드 */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2}}>
        {cells.map((cell,i)=>{
          if(!cell) return <div key={i}/>;
          const {d,ds,cnt}=cell;
          const isToday=ds===today();
          const isSelected=ds===viewDate;
          const dayOfWeek=i%7;
          const textColor=isSelected?"#fff":isToday?C.gold:dayOfWeek===0?C.red:dayOfWeek===6?C.sky:C.text;
          return (
            <button key={ds} onClick={()=>setViewDate(ds)}
              style={{display:"flex",flexDirection:"column",alignItems:"center",
                padding:"5px 2px",borderRadius:8,fontFamily:"inherit",cursor:"pointer",
                border:"none",
                background:isSelected?C.sky:isToday?C.goldBg:"transparent",
                minHeight:40}}>
              <span style={{fontSize:13,fontWeight:isToday||isSelected?800:500,color:textColor}}>
                {d}
              </span>
              {cnt>0
                ?<div style={{display:"flex",gap:2,marginTop:2,justifyContent:"center"}}>
                  {Array.from({length:Math.min(cnt,3)}).map((_,j)=>(
                    <div key={j} style={{width:4,height:4,borderRadius:"50%",
                      background:isSelected?"rgba(255,255,255,0.8)":C.sky}}/>
                  ))}
                </div>
                :<div style={{height:6}}/>
              }
            </button>
          );
        })}
      </div>

      {/* 오늘로 이동 */}
      {viewDate!==today()&&<div style={{textAlign:"center",marginTop:10}}>
        <button onClick={()=>{setViewDate(today());setCalMonth(new Date().toISOString().slice(0,7));}}
          style={{background:C.goldBg,border:`1px solid ${C.borderGold}`,borderRadius:8,
            padding:"5px 14px",color:C.gold,fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>
          📅 오늘로 이동
        </button>
      </div>}
    </div>

    {/* ── 선택된 날 일정 타임라인 ── */}
    <div style={{...st.card,marginBottom:12}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <div style={{fontSize:14,fontWeight:800,color:C.navy}}>
          {viewDate===today()
            ?"📅 오늘 일정"
            :`📅 ${new Date(viewDate).toLocaleDateString("ko-KR",{month:"short",day:"numeric"})} 일정`}
          {viewItems.filter(t=>!t.done).length>0&&
            <span style={{...st.tag(C.skyBg,C.sky),fontSize:11,marginLeft:8}}>
              {viewItems.filter(t=>!t.done).length}건
            </span>}
        </div>
        <button onClick={()=>{setForm({...form,dueDate:viewDate,dueTime:""});setAddModal(true);}}
          style={{background:C.teal,border:"none",borderRadius:8,padding:"6px 14px",
            color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
          + 추가
        </button>
      </div>

      {viewItems.length===0
        ?<div style={{textAlign:"center",padding:"18px 0",color:C.textMuted}}>
          <div style={{fontSize:26,marginBottom:6}}>📭</div>
          <div style={{fontSize:13}}>일정이 없습니다</div>
          <div style={{fontSize:12,marginTop:4}}>오른쪽 "+ 추가" 버튼을 누르세요</div>
        </div>
        :<div style={{position:"relative",paddingLeft:48}}>
          <div style={{position:"absolute",left:18,top:8,bottom:8,width:2,
            background:`linear-gradient(180deg,${C.sky}55,transparent)`,borderRadius:1}}/>
          {viewItems.map((t,i)=>(
            <div key={t.id} style={{position:"relative",marginBottom:i<viewItems.length-1?12:0}}>
              <div style={{position:"absolute",left:-34,top:12,width:14,height:14,borderRadius:"50%",
                background:t.done?"#CBD5E0":typeColor(t.type),
                border:`2px solid ${t.done?"#CBD5E0":"#fff"}`,
                boxShadow:t.done?"none":`0 0 0 3px ${typeColor(t.type)}33`}}/>
              {t.dueTime&&<div style={{position:"absolute",left:-46,top:10,
                fontSize:9,color:C.textMuted,fontWeight:700,width:38,textAlign:"right",lineHeight:1.2}}>
                {fmtTime(t.dueTime).split(" ").map((x,ii)=><div key={ii}>{x}</div>)}
              </div>}
              <div style={{background:t.done?"#F8FAFC":"#fff",
                border:`1px solid ${t.done?C.border:typeColor(t.type)+"33"}`,
                borderRadius:10,padding:"10px 12px",opacity:t.done?0.55:1}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                  <div style={{flex:1}}>
                    <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:2}}>
                      <span style={{fontSize:14}}>{typeIcon(t.type)}</span>
                      <span style={{fontSize:14,fontWeight:700,
                        color:t.done?C.textMuted:C.text,
                        textDecoration:t.done?"line-through":"none"}}>{t.text}</span>
                    </div>
                    {t.dueTime&&<div style={{fontSize:12,fontWeight:700,color:typeColor(t.type),marginBottom:2}}>🕐 {fmtTime(t.dueTime)}</div>}
                    {t.location&&<div style={{fontSize:12,color:C.textMuted}}>📍 {t.location}</div>}
                    {t.notes&&<div style={{fontSize:12,color:C.textMuted,marginTop:2}}>💬 {t.notes}</div>}
                  </div>
                  <div style={{display:"flex",gap:6,marginLeft:8,flexShrink:0}}>
                    <button onClick={()=>toggleTodo(t.id)}
                      style={{background:t.done?C.greenBg:C.tealBg,border:`1px solid ${t.done?C.green:C.teal}`,
                        borderRadius:6,width:28,height:28,cursor:"pointer",color:t.done?C.green:C.teal,
                        fontWeight:700,fontSize:13,display:"flex",alignItems:"center",justifyContent:"center"}}>
                      {t.done?"↩":"✓"}
                    </button>
                    <button onClick={()=>delTodo(t.id)}
                      style={{background:"#F1F5F9",border:"none",color:C.textMid,cursor:"pointer",
                        width:28,height:28,borderRadius:6,fontSize:12,
                        display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      }
    </div>

    {/* ── AI 버튼 (아래쪽, 작게) ── */}
    <div style={{...st.card,background:C.purpleBg,border:`1px solid ${C.purple}33`,marginBottom:12}}>
      <button onClick={getAdvice} disabled={loading}
        style={{width:"100%",background:loading?"#CBD5E0":C.purple,border:"none",borderRadius:10,
          padding:"12px",color:"#fff",fontWeight:700,fontSize:14,cursor:loading?"not-allowed":"pointer",
          fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
        {loading?<><span>처리 중...</span></>:<><span>🤖</span><span>AI 개인비서에게 오늘 할 일 물어보기</span></>}
      </button>
      {loading&&<Dots/>}
      {aiResult&&<div style={{marginTop:10,padding:"14px",background:"#fff",borderRadius:10,
        whiteSpace:"pre-wrap",lineHeight:1.85,fontSize:13,color:C.text,
        border:`1px solid ${C.purple}22`}}>{aiResult}</div>}
    </div>

    {/* 일정 추가 모달 */}
    <Modal open={addModal} onClose={()=>setAddModal(false)} title="📅 일정/할 일 추가">
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
        {TODO_TYPES.map(tp=>(
          <button key={tp.v} onClick={()=>setForm({...form,type:tp.v})}
            style={{padding:"10px",borderRadius:10,fontFamily:"inherit",cursor:"pointer",
              border:`1.5px solid ${form.type===tp.v?typeColor(tp.v):C.border}`,
              background:form.type===tp.v?typeColor(tp.v)+"15":"transparent",
              color:form.type===tp.v?typeColor(tp.v):C.textMid,fontWeight:600,fontSize:13}}>
            {tp.l}
          </button>
        ))}
      </div>
      <F label="내용 *">
        <Inp value={form.text} onChange={v=>setForm({...form,text:v})} placeholder="예: 치과 예약, 마트 장보기"/>
      </F>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
        <F label="날짜 *">
          <Inp type="date" value={form.dueDate} onChange={v=>setForm({...form,dueDate:v})}/>
        </F>
        <F label="시간 (선택)">
          <Inp type="time" value={form.dueTime} onChange={v=>setForm({...form,dueTime:v})}/>
        </F>
      </div>
      <F label="장소 (선택)">
        <Inp value={form.location} onChange={v=>setForm({...form,location:v})} placeholder="예: Dr. Kim Dental"/>
      </F>
      <F label="메모 (선택)">
        <Inp value={form.notes} onChange={v=>setForm({...form,notes:v})} placeholder="예: 보험카드 챙기기"/>
      </F>
      <Btn onClick={addTodo} disabled={!form.text.trim()||!form.dueDate} color={C.teal}>
        📅 일정 저장
      </Btn>
    </Modal>
  </div>;
}

// ════════════════════════════════════════════════════════
// 교통 티켓 (업그레이드 버전 — 사진분석+대처옵션+주별안내)
// ════════════════════════════════════════════════════════
const TRAFFIC_SCHOOL_SITES = {
  CA:{name:"캘리포니아",school:{name:"iDriveSafely",url:"https://www.idrivesafely.com",price:"$15~25"},pay:{name:"CA Courts",url:"https://www.courts.ca.gov/traffic.htm"},court:"위반 후 60일 이내 법원 출석 신청 가능",schoolNote:"DMV 승인 온라인 스쿨 필수"},
  NV:{name:"네바다",school:{name:"Nevada Traffic Safety",url:"https://www.nvtrafficschool.com",price:"$14~20"},pay:{name:"NV DMV",url:"https://dmvnv.com/trafficcitations.htm"},court:"티켓 수령 후 30일 이내 법원 출석 가능",schoolNote:"네바다 주 승인 온라인 스쿨 이용"},
  TX:{name:"텍사스",school:{name:"Improv Traffic School",url:"https://www.improvlearning.com",price:"$25"},pay:{name:"TX Courts",url:"https://www.txcourts.gov"},court:"티켓 수령 후 30일 이내 법원 연락 필요",schoolNote:"텍사스는 6시간 이수 필수"},
  NY:{name:"뉴욕",school:{name:"I Drive Safely NY",url:"https://www.idrivesafely.com/defensive-driving/new-york",price:"$25~35"},pay:{name:"NY DMV",url:"https://transact.dmv.ny.gov/TicketPayment/"},court:"TVB(Traffic Violations Bureau) 출석 가능",schoolNote:"뉴욕은 6시간 코스, 4점 감점 효과"},
  FL:{name:"플로리다",school:{name:"Florida Safety Council",url:"https://www.flsafety.org",price:"$15~25"},pay:{name:"FL HSMV",url:"https://www.flhsmv.gov/driver-licenses-id-cards/traffic-tickets"},court:"선택 여부 티켓에 표시됨",schoolNote:"4시간 Basic Driver Improvement 코스"},
  WA:{name:"워싱턴",school:{name:"5 Star Driving School",url:"https://www.5stardriver.com",price:"$20~30"},pay:{name:"WA Courts",url:"https://www.courts.wa.gov"},court:"30일 이내 법원 이의신청 가능",schoolNote:"워싱턴 주 승인 스쿨만 인정"},
  IL:{name:"일리노이",school:{name:"Illinois Traffic Safety",url:"https://www.iltrafficschool.com",price:"$15~25"},pay:{name:"IL Courts",url:"https://www.illinoiscourts.gov"},court:"21일 이내 출석 신청",schoolNote:"쿡 카운티는 별도 시스템"},
  GA:{name:"조지아",school:{name:"Approved Course",url:"https://www.approvedcourse.com/georgia",price:"$7~15"},pay:{name:"GA Courts",url:"https://www.gasafety.com"},court:"30일 이내 법원 신청",schoolNote:"6시간 이수 필요"},
  other:{name:"기타",school:{name:"iDriveSafely (전국)",url:"https://www.idrivesafely.com",price:"$15~35"},pay:{name:"해당 카운티 법원",url:"#"},court:"티켓에 기재된 법원에 연락하세요",schoolNote:"주 DMV 승인 온라인 스쿨 이용"},
};

const SCHOOL_STEPS=[
  {step:1,title:"사이트 접속",desc:"위 링크 클릭 → 영어 사이트 열림",icon:"🌐"},
  {step:2,title:"회원가입",desc:"Create Account 클릭\n이름, 이메일, 비밀번호 입력\n주(State)와 티켓 번호 입력",icon:"📝"},
  {step:3,title:"결제",desc:"$15~25 카드 결제\nCredit/Debit Card 선택 후 진행",icon:"💳"},
  {step:4,title:"코스 시작",desc:"Start Course 클릭\n⚠️ 각 페이지 최소 1분 이상 체류 필수\n페이지 건너뛰면 수료증 안 나옴!",icon:"📖"},
  {step:5,title:"퀴즈",desc:"각 챕터 후 퀴즈 있음\n본인이 직접 풀어야 합니다\n대부분 80점 이상이면 통과",icon:"✏️"},
  {step:6,title:"수료증 발급",desc:"모든 챕터 완료 후\nCertificate 클릭 → PDF 저장/인쇄 필수!",icon:"🏆"},
  {step:7,title:"법원 제출",desc:"수료증을 법원에 제출\n우편 또는 직접 방문\n티켓 마감일 전에 제출!",icon:"⚖️"},
];

function TicketTab(){
  const [image,setImage]=useState(null);
  const [imageBase64,setImageBase64]=useState(null);
  const [analysis,setAnalysis]=useState(null);
  const [loading,setLoading]=useState(false);
  const [selectedOption,setSelectedOption]=useState(null);
  const [showSteps,setShowSteps]=useState(false);
  const [manualState,setManualState]=useState("NV");

  const handleImage=(b64, type)=>{
    setImage(`data:${type||"image/jpeg"};base64,${b64}`);
    setImageBase64(b64);
    setAnalysis(null);setSelectedOption(null);setShowSteps(false);
  };

  const analyzeTicket=async()=>{
    setLoading(true);setAnalysis(null);
    const SYS=`당신은 미국 교통티켓 전문 분석가입니다. 한국어로만 답변하세요.
티켓 이미지를 분석하여 반드시 아래 JSON 형식으로만 응답하세요. 다른 텍스트 없이 JSON만 출력:
{"violation":"위반내용","state":"주코드2글자","stateName":"주이름한국어","amount":"벌금금액","dueDate":"마감일","ticketNumber":"티켓번호","points":"면허점수차감","schoolAvailable":true,"recommendation":"school또는pay또는court","reason":"추천이유2-3문장","insuranceImpact":"보험료예상인상액"}
읽을 수 없는 항목은 "확인불가"로 표시.`;
    try{
      const r=await fetch("/api/claude",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({system:SYS,
          messages:[{role:"user",content:[
            {type:"image",source:{type:"base64",media_type:"image/jpeg",data:imageBase64}},
            {type:"text",text:"이 교통 티켓을 분석해주세요."}
          ]}], max_tokens:1000})
      });
      const d=await r.json();
      const text=d.content?.[0]?.text||"{}";
      const clean=text.replace(/```json|```/g,"").trim();
      const parsed=JSON.parse(clean);
      setAnalysis(parsed);setManualState(parsed.state||"NV");
    }catch{setAnalysis({error:true});}
    setLoading(false);
  };

  const site=TRAFFIC_SCHOOL_SITES[manualState]||TRAFFIC_SCHOOL_SITES.other;

  return <div>
    {/* 안내 배너 */}
    <div style={{...st.card,background:C.skyBg,border:`1.5px solid ${C.sky}33`,textAlign:"center",padding:"18px",marginBottom:12}}>
      <div style={{fontSize:28,marginBottom:6}}>🚗</div>
      <div style={{fontSize:14,fontWeight:800,color:C.navy,marginBottom:4}}>교통 티켓 대처 안내</div>
      <div style={{fontSize:12,color:C.textMid,lineHeight:1.6}}>티켓 사진을 찍어 올리면<br/>어떻게 해야 할지 AI가 알려드립니다</div>
    </div>

    {/* 사진 업로드 */}
    <div style={{...st.card,marginBottom:12}}>
      <span style={st.label}>📸 티켓 사진 업로드</span>
      <CameraZone
        onImage={handleImage}
        preview={imageBase64}
        mime="image/jpeg"
        label="여기를 탭해서 티켓 사진 찍기"/>
      {image&&<Btn onClick={analyzeTicket} disabled={loading} color={C.sky}>
        {loading?"🔍 분석 중...":"🔍 티켓 분석하기"}
      </Btn>}
    </div>

    {loading&&<><Dots/><div style={{textAlign:"center",fontSize:12,color:C.textMuted,marginTop:-10,marginBottom:10}}>티켓 내용을 읽고 있습니다...</div></>}

    {/* 분석 결과 */}
    {analysis&&!analysis.error&&<div>
      <div style={{...st.card,marginBottom:12}}>
        <div style={{fontSize:13,fontWeight:700,color:C.navy,marginBottom:12}}>📋 티켓 분석 결과</div>
        {[["위반 내용",analysis.violation,C.text],["벌금 금액",analysis.amount,C.red],
          ["마감일",analysis.dueDate,C.red],["면허 점수",analysis.points,C.orange],
          ["티켓 번호",analysis.ticketNumber,C.textMid]
        ].map(([label,value,color],i)=>value&&value!=="확인불가"&&(
          <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"9px 0",borderBottom:`1px solid ${C.border}`}}>
            <span style={{fontSize:12,color:C.textMuted}}>{label}</span>
            <span style={{fontSize:13,fontWeight:700,color}}>{value}</span>
          </div>
        ))}
        {analysis.insuranceImpact&&<div style={{marginTop:10,padding:"10px",background:C.orangeBg,borderRadius:8,border:`1px solid ${C.orange}33`}}>
          <div style={{fontSize:12,color:C.orange,lineHeight:1.6}}>📈 {analysis.insuranceImpact}</div>
        </div>}
      </div>

      <div style={{fontSize:13,fontWeight:700,color:C.navy,marginBottom:10}}>💡 대처 방법 선택</div>

      {/* 옵션 A: 트래픽 스쿨 */}
      {analysis.schoolAvailable&&<div style={{...st.card,border:`1.5px solid ${selectedOption==="school"?C.green:C.border}`,background:selectedOption==="school"?C.greenBg:"#fff",cursor:"pointer",transition:"all 0.2s",marginBottom:10}} onClick={()=>{setSelectedOption("school");setShowSteps(false);}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
          <div style={{flex:1}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
              <span style={{fontSize:18}}>🎓</span>
              <span style={{fontSize:14,fontWeight:800,color:C.green}}>트래픽 스쿨 수료</span>
              <span style={st.tag(C.greenBg,C.green)}>추천</span>
            </div>
            <div style={{fontSize:12,color:C.textMid,lineHeight:1.7}}>✅ 보험료 인상 없음<br/>✅ 온라인으로 집에서 가능<br/>💰 비용 {site.school.price}</div>
          </div>
          <div style={{fontSize:20,marginLeft:8,color:selectedOption==="school"?C.green:C.textMuted}}>{selectedOption==="school"?"✅":"○"}</div>
        </div>
      </div>}

      {/* 옵션 B: 납부 */}
      <div style={{...st.card,border:`1.5px solid ${selectedOption==="pay"?C.sky:C.border}`,background:selectedOption==="pay"?C.skyBg:"#fff",cursor:"pointer",transition:"all 0.2s",marginBottom:10}} onClick={()=>{setSelectedOption("pay");setShowSteps(false);}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
          <div style={{flex:1}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
              <span style={{fontSize:18}}>💳</span>
              <span style={{fontSize:14,fontWeight:800,color:C.sky}}>그냥 납부하기</span>
            </div>
            <div style={{fontSize:12,color:C.textMid,lineHeight:1.7}}>✅ 가장 간단함<br/>⚠️ 보험료 인상 가능성 있음<br/>💰 벌금 {analysis.amount}</div>
          </div>
          <div style={{fontSize:20,marginLeft:8,color:selectedOption==="pay"?C.sky:C.textMuted}}>{selectedOption==="pay"?"✅":"○"}</div>
        </div>
      </div>

      {/* 옵션 C: 법원 */}
      <div style={{...st.card,border:`1.5px solid ${selectedOption==="court"?C.orange:C.border}`,background:selectedOption==="court"?C.orangeBg:"#fff",cursor:"pointer",transition:"all 0.2s",marginBottom:10}} onClick={()=>{setSelectedOption("court");setShowSteps(false);}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
          <div style={{flex:1}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
              <span style={{fontSize:18}}>⚖️</span>
              <span style={{fontSize:14,fontWeight:800,color:C.orange}}>법원 출석</span>
            </div>
            <div style={{fontSize:12,color:C.textMid,lineHeight:1.7}}>⚠️ 통역사 비용 $200~300 추가<br/>⚠️ 반나절 이상 시간 소요<br/>💡 {site.court}</div>
          </div>
          <div style={{fontSize:20,marginLeft:8,color:selectedOption==="court"?C.orange:C.textMuted}}>{selectedOption==="court"?"✅":"○"}</div>
        </div>
      </div>

      {analysis.reason&&<div style={{...st.card,background:C.goldBg,border:`1px solid ${C.borderGold}`,marginBottom:12}}>
        <div style={{fontSize:12,color:C.navy,lineHeight:1.7}}>🤖 AI 분석: {analysis.reason}</div>
      </div>}

      {/* 트래픽 스쿨 상세 */}
      {selectedOption==="school"&&<div style={{...st.card,marginBottom:12}}>
        <div style={{fontSize:13,fontWeight:700,color:C.green,marginBottom:12}}>🎓 온라인 트래픽 스쿨 안내</div>
        <div style={{padding:"12px",background:C.greenBg,borderRadius:10,border:`1px solid ${C.green}33`,marginBottom:12}}>
          <div style={{fontSize:13,fontWeight:800,color:C.green,marginBottom:4}}>{site.school.name}</div>
          <div style={{fontSize:11,color:C.textMuted,marginBottom:8}}>💰 {site.school.price} · {site.schoolNote}</div>
          <a href={site.school.url} target="_blank" rel="noopener noreferrer"
            style={{display:"block",padding:"10px",background:C.green,color:"white",borderRadius:8,textAlign:"center",textDecoration:"none",fontSize:13,fontWeight:800}}>
            🌐 스쿨 사이트 바로가기
          </a>
        </div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <div style={{fontSize:12,fontWeight:700,color:C.navy}}>📋 단계별 진행 방법</div>
          <button onClick={()=>setShowSteps(!showSteps)}
            style={{background:C.goldBg,border:`1px solid ${C.borderGold}`,borderRadius:6,padding:"4px 10px",color:C.gold,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>
            {showSteps?"접기 ▲":"펼치기 ▼"}
          </button>
        </div>
        {showSteps&&<div>
          {SCHOOL_STEPS.map((s,i)=>(
            <div key={i} style={{display:"flex",gap:10,marginBottom:10,padding:"10px",background:"#F8FAFC",borderRadius:8}}>
              <div style={{fontSize:20,flexShrink:0}}>{s.icon}</div>
              <div>
                <div style={{fontSize:12,fontWeight:700,color:C.navy,marginBottom:3}}>{s.step}단계: {s.title}</div>
                <div style={{fontSize:11,color:C.textMid,lineHeight:1.6,whiteSpace:"pre-line"}}>{s.desc}</div>
              </div>
            </div>
          ))}
          <div style={{padding:"10px",background:C.redBg,borderRadius:8,border:`1px solid ${C.red}33`}}>
            <div style={{fontSize:11,color:C.red,lineHeight:1.6}}>⚠️ 퀴즈는 반드시 본인이 직접 푸세요.</div>
          </div>
        </div>}
      </div>}

      {/* 납부 상세 */}
      {selectedOption==="pay"&&<div style={{...st.card,marginBottom:12}}>
        <div style={{fontSize:13,fontWeight:700,color:C.sky,marginBottom:12}}>💳 온라인 납부 안내</div>
        <div style={{fontSize:12,color:C.textMid,lineHeight:1.9,marginBottom:12}}>
          1. 아래 사이트 접속<br/>2. Ticket Number 입력 (티켓에 기재)<br/>3. 카드 또는 eCheck으로 결제<br/>4. 영수증 이메일로 받기
        </div>
        <a href={site.pay.url} target="_blank" rel="noopener noreferrer"
          style={{display:"block",padding:"12px",background:C.sky,color:"white",borderRadius:8,textAlign:"center",textDecoration:"none",fontSize:13,fontWeight:800}}>
          💳 납부 사이트 바로가기
        </a>
        <div style={{fontSize:11,color:C.textMuted,marginTop:8,textAlign:"center"}}>{site.name} 공식 납부 포털</div>
      </div>}

      {/* 법원 상세 */}
      {selectedOption==="court"&&<div style={{...st.card,marginBottom:12}}>
        <div style={{fontSize:13,fontWeight:700,color:C.orange,marginBottom:12}}>⚖️ 법원 출석 전 준비사항</div>
        {[["준비 서류","원본 티켓, 운전면허증, 등록증, 보험 증서"],
          ["복장","깔끔한 캐주얼 (청바지 OK, 슬리퍼 X)"],
          ["통역","한국어 통역사 사전 예약 필요 ($200~300)\n또는 법원에 통역 요청 (무료, 사전 신청)"],
          ["법원 연락","티켓에 기재된 전화번호로 먼저 전화"],
        ].map(([label,desc],i)=>(
          <div key={i} style={{padding:"8px 0",borderBottom:`1px solid ${C.border}`}}>
            <div style={{fontSize:11,color:C.gold,fontWeight:700,marginBottom:3}}>{label}</div>
            <div style={{fontSize:12,color:C.text,lineHeight:1.6,whiteSpace:"pre-line"}}>{desc}</div>
          </div>
        ))}
        <div style={{marginTop:10,padding:"10px",background:C.skyBg,borderRadius:8,border:`1px solid ${C.sky}33`}}>
          <div style={{fontSize:11,color:C.sky,lineHeight:1.7}}>
            💡 법원 통역사 무료 신청:<br/>
            법원 클럭에게 "I need a Korean interpreter"<br/>
            사전 전화로 요청하면 무료로 제공됩니다.
          </div>
        </div>
      </div>}
    </div>}

    {/* 분석 실패 */}
    {analysis?.error&&<div style={{...st.card,textAlign:"center",padding:"20px",marginBottom:12,background:C.redBg,border:`1px solid ${C.red}33`}}>
      <div style={{fontSize:24,marginBottom:8}}>😅</div>
      <div style={{fontSize:13,fontWeight:700,color:C.red,marginBottom:4}}>티켓 읽기 실패</div>
      <div style={{fontSize:11,color:C.textMid}}>사진을 더 밝고 선명하게 다시 찍어보세요.<br/>티켓 전체가 보이도록 촬영해주세요.</div>
    </div>}

    {/* 사진 없이 주별 안내 */}
    {!image&&<div style={{...st.card,marginBottom:12}}>
      <div style={{fontSize:13,fontWeight:700,color:C.navy,marginBottom:10}}>📍 주(State)별 직접 안내</div>
      <select value={manualState} onChange={e=>setManualState(e.target.value)}
        style={{...st.input,cursor:"pointer",marginBottom:10}}>
        {Object.entries(TRAFFIC_SCHOOL_SITES).filter(([k])=>k!=="other").map(([code,data])=>(
          <option key={code} value={code}>{code} - {data.name}</option>
        ))}
        <option value="other">기타 주</option>
      </select>
      <a href={site.school.url} target="_blank" rel="noopener noreferrer"
        style={{display:"block",padding:"11px",background:C.green,color:"white",borderRadius:9,textAlign:"center",textDecoration:"none",fontSize:13,fontWeight:800,marginBottom:8}}>
        🎓 트래픽 스쿨 ({site.school.price})
      </a>
      <a href={site.pay.url} target="_blank" rel="noopener noreferrer"
        style={{display:"block",padding:"11px",background:C.sky,color:"white",borderRadius:9,textAlign:"center",textDecoration:"none",fontSize:13,fontWeight:800}}>
        💳 벌금 납부 사이트
      </a>
    </div>}

    <div style={{...st.card,background:C.orangeBg,border:`1px solid ${C.orange}33`}}>
      <p style={{margin:0,fontSize:11,color:C.orange,textAlign:"center",lineHeight:1.7}}>
        ⚠️ 본 안내는 정보 제공 목적입니다. 법적 조언이 아니며,<br/>트래픽 스쿨 퀴즈는 반드시 본인이 직접 완료해야 합니다.
      </p>
    </div>
  </div>;
}

// ════════════════════════════════════════════════════════
// 공문서 해설 (사진 업로드 추가)
// ════════════════════════════════════════════════════════
function LetterTab(){
  const [img,setImg]=useState(null);const [imgType,setImgType]=useState("image/jpeg");
  const [txt,setTxt]=useState("");const [from,setFrom]=useState("irs");
  const [res,setRes]=useState("");const [load,setLoad]=useState(false);
  const SENDERS=[{v:"irs",l:"🏛️ IRS"},{v:"dmv",l:"🚗 DMV"},{v:"court",l:"⚖️ 법원"},{v:"ssa",l:"👴 Social Security"},{v:"uscis",l:"🗽 이민국"},{v:"medicare",l:"🏥 Medicare"},{v:"hoa",l:"🏠 HOA"},{v:"utility",l:"💡 공과금"},{v:"other",l:"📄 기타"}];
  const SYS=`미국 정부/기관 공문서 해설가. 한국어만 사용.\n📌 발신기관 / 📋 목적(한줄) / 📖 상세해설 / 🚨 긴급도 / 📅 마감일 / ✅ 해야할일(3가지) / 📞 문의처\n⚠️ 법률 조언 아님.`;
  const go=async()=>{
    setLoad(true);setRes("");
    let r;
    if(img){r=await askClaudeWithImage(SYS,`이 공문서를 한국어로 해설해주세요. 발신기관: ${from}. 추가내용: ${txt}`,img,imgType);}
    else{r=await askClaude(SYS,`발신:${from}\n\n${txt}`);}
    setRes(r);setLoad(false);
  };
  return <div>
    <div style={{...st.card,background:C.skyBg,border:`1px solid ${C.sky}33`,marginBottom:14}}>
      <div style={{fontSize:13,color:C.sky,fontWeight:600}}>📷 편지/공문서 사진을 찍으면 AI가 한국어로 해설합니다</div>
    </div>
    <F label="발신 기관"><Sel value={from} onChange={setFrom} options={SENDERS}/></F>
    <F label="📷 공문서 사진 (선택)">
      <PhotoUpload onImage={(b64,type)=>{setImg(b64);setImgType(type);}} label="공문서/편지 사진 찍기" preview={img}/>
    </F>
    <F label="편지 내용 직접 입력 (선택)">
      <textarea value={txt} onChange={e=>setTxt(e.target.value)} rows={5}
        placeholder="사진만 올려도 분석 가능합니다&#10;또는 영어 내용을 붙여넣으세요"
        style={{...st.input,resize:"vertical",lineHeight:1.7}}/>
    </F>
    <Btn onClick={go} disabled={load||(!txt.trim()&&!img)} color={C.teal}>📬 AI 해설 시작</Btn>
    {load&&<Dots/>}<AiBox text={res}/>
  </div>;
}

// ════════════════════════════════════════════════════════
// 세금 계산기
// ════════════════════════════════════════════════════════
function TaxTab(){
  const [inc,setInc]         = useState("");
  const [st2,setSt]          = useState("NV");
  const [fs,setFs]           = useState("single");
  const [ded,setDed]         = useState("standard");
  const [extra,setExtra]     = useState("");
  // 추가 상세 항목
  const [sideInc,setSideInc] = useState("");   // 부업/프리랜서 소득
  const [k401,setK401]       = useState("");   // 401k 기여금
  const [hsa,setHsa]         = useState("");   // HSA 기여금
  const [children,setChildren]= useState("0"); // 자녀 수
  const [mortgage,setMortgage]= useState("");  // 모기지 이자
  const [charity,setCharity] = useState("");   // 자선 기부금
  const [studentLoan,setStudentLoan]=useState(""); // 학자금 이자
  const [selfEmp,setSelfEmp] = useState(false);// 자영업 여부
  const [showAdvanced,setShowAdvanced]=useState(false);
  const [res,setRes]         = useState("");
  const [load,setLoad]       = useState(false);

  const SYS=`당신은 미국 세금 전문가입니다. 한국어로만 답변하세요. 2025년 세법 기준 (2026년 신고).
아래 형식으로 정확하게 계산해주세요:

💰 총소득 요약
- W-2/급여 소득: $X
- 부업/1099 소득: $X (있는 경우)
- 총 합산 소득: $X

📊 연방세 계산
- 표준/항목 공제: $X
- 401k/HSA 공제: $X
- 과세 소득: $X
- 세율 구간: X%
- 연방세액: $X
- 자녀세액공제: -$X (해당시)
- 최종 연방세: $X
- 실효세율: X%

🏛️ 주(State)세
- ${st2}주 세율: X%
- 주세액: $X

💼 자영업세 (해당시)
- SE Tax (15.3%): $X

📱 FICA (사회보장/메디케어)
- Social Security: $X
- Medicare: $X

💵 최종 정리
- 총 세금 합계: $X
- 예상 실수령액: $X
- 월 실수령 환산: $X

📅 분기 예납세 일정 (자영업자/부업자)
- Q1: 4/15, Q2: 6/16, Q3: 9/15, Q4: 1/15/2026

💡 절세 팁 (본인 상황 맞춤 3가지)

⚠️ 이 계산은 추정치입니다. 정확한 세금은 CPA와 상담하세요.`;

  const go=async()=>{
    if(!inc.trim()) return;
    setLoad(true);setRes("");
    const msg=`
급여소득: $${inc}
부업/1099소득: $${sideInc||0}
거주주: ${st2}
신고상태: ${fs}
공제방식: ${ded}
추가항목공제: $${extra||0}
401k기여: $${k401||0}
HSA기여: $${hsa||0}
자녀수: ${children}명
모기지이자: $${mortgage||0}
자선기부금: $${charity||0}
학자금이자: $${studentLoan||0}
자영업여부: ${selfEmp?"예(SE Tax적용)":"아니오"}
    `.trim();
    const r=await askClaude(SYS,msg);
    setRes(r);setLoad(false);
  };

  return <div>
    {/* 기본 정보 */}
    <div style={st.card}>
      <div style={{fontSize:14,fontWeight:800,color:C.navy,marginBottom:14}}>📋 기본 정보</div>

      <F label="W-2 급여 소득 ($)">
        <Inp type="number" value={inc} onChange={setInc} placeholder="예: 85000"/>
      </F>
      <F label="부업/프리랜서/1099 소득 ($)">
        <Inp type="number" value={sideInc} onChange={setSideInc} placeholder="없으면 0"/>
      </F>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
        <F label="거주 주(State)">
          <Sel value={st2} onChange={setSt}
            options={STATES.map(s=>({v:s.code,l:`${s.code} ${s.rate===0?"(무세)":s.rate+"%"}`}))}/>
        </F>
        <F label="신고 상태">
          <Sel value={fs} onChange={setFs} options={[
            {v:"single",       l:"Single (미혼)"},
            {v:"married_joint",l:"Married Joint"},
            {v:"married_sep",  l:"Married Sep."},
            {v:"head",         l:"Head of HH"},
          ]}/>
        </F>
        <F label="공제 방식">
          <Sel value={ded} onChange={setDed} options={[
            {v:"standard",l:"표준공제 (Standard)"},
            {v:"itemized", l:"항목공제 (Itemized)"},
          ]}/>
        </F>
        <F label="자녀 수">
          <Sel value={children} onChange={setChildren}
            options={["0","1","2","3","4","5+"].map(v=>({v,l:`${v}명${v!=="0"?" (세액공제 가능)":""}`}))}/>
        </F>
      </div>

      {/* 자영업 토글 */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",
        padding:"12px",background:selfEmp?C.orangeBg:"#F8FAFC",
        borderRadius:10,border:`1px solid ${selfEmp?C.orange:C.border}`,marginBottom:8}}>
        <div>
          <div style={{fontSize:13,fontWeight:700,color:selfEmp?C.orange:C.text}}>자영업/사업체 운영</div>
          <div style={{fontSize:11,color:C.textMuted}}>SE Tax 15.3% 별도 적용</div>
        </div>
        <button onClick={()=>setSelfEmp(!selfEmp)} style={{
          background:selfEmp?C.orange:"#CBD5E0",border:"none",borderRadius:20,
          width:44,height:24,cursor:"pointer",position:"relative",transition:"all 0.2s"}}>
          <div style={{position:"absolute",top:2,left:selfEmp?22:2,width:20,height:20,
            borderRadius:"50%",background:"#fff",transition:"all 0.2s"}}/>
        </button>
      </div>
    </div>

    {/* 상세 공제 항목 (펼치기/접기) */}
    <div style={{...st.card,marginTop:10}}>
      <button onClick={()=>setShowAdvanced(!showAdvanced)}
        style={{width:"100%",display:"flex",justifyContent:"space-between",alignItems:"center",
          background:"none",border:"none",cursor:"pointer",fontFamily:"inherit",padding:0}}>
        <div style={{fontSize:14,fontWeight:800,color:C.navy}}>💡 상세 공제 항목 (선택)</div>
        <span style={{fontSize:13,color:C.sky,fontWeight:600}}>{showAdvanced?"▲ 접기":"▼ 펼치기"}</span>
      </button>

      {showAdvanced&&<div style={{marginTop:14}}>
        <div style={{fontSize:11,color:C.textMuted,marginBottom:12,lineHeight:1.6}}>
          입력할수록 더 정확한 계산이 됩니다. 없으면 비워두세요.
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          <F label="401(k) 기여금 ($)">
            <Inp type="number" value={k401} onChange={setK401} placeholder="예: 6000"/>
          </F>
          <F label="HSA 기여금 ($)">
            <Inp type="number" value={hsa} onChange={setHsa} placeholder="예: 3850"/>
          </F>
          <F label="모기지 이자 ($)">
            <Inp type="number" value={mortgage} onChange={setMortgage} placeholder="예: 12000"/>
          </F>
          <F label="자선 기부금 ($)">
            <Inp type="number" value={charity} onChange={setCharity} placeholder="예: 500"/>
          </F>
          <F label="학자금 대출이자 ($)">
            <Inp type="number" value={studentLoan} onChange={setStudentLoan} placeholder="예: 2500"/>
          </F>
          <F label="기타 추가공제 ($)">
            <Inp type="number" value={extra} onChange={setExtra} placeholder="예: 0"/>
          </F>
        </div>

        {/* 2025 주요 한도 참고 */}
        <div style={{background:C.goldBg,border:`1px solid ${C.borderGold}`,
          borderRadius:10,padding:"12px",marginTop:4}}>
          <div style={{fontSize:11,fontWeight:700,color:C.gold,marginBottom:6}}>📌 2025년 주요 한도 (2026년 신고)</div>
          {[
            ["표준공제 (Single)",         "$15,000"],
            ["표준공제 (Married Joint)",   "$30,000"],
            ["401(k) 최대 기여",           "$23,500"],
            ["401(k) 50세 이상 추가",      "+$7,500"],
            ["HSA 최대 (개인)",            "$4,300"],
            ["HSA 최대 (가족)",            "$8,550"],
            ["자녀 세액공제",              "$2,000/명"],
            ["학자금이자 공제 한도",        "$2,500"],
            ["IRA 기여 한도",              "$7,000"],
            ["IRA 50세 이상 추가",         "+$1,000"],
          ].map(([label,val],i)=>(
            <div key={i} style={{display:"flex",justifyContent:"space-between",
              padding:"5px 0",borderBottom:`1px solid ${C.borderGold}`,fontSize:11}}>
              <span style={{color:C.textMid}}>{label}</span>
              <span style={{fontWeight:700,color:C.gold}}>{val}</span>
            </div>
          ))}
          <div style={{fontSize:10,color:C.textMuted,marginTop:8,textAlign:"center"}}>
            출처: IRS Rev. Proc. 2024-40 · 2025 Tax Year
          </div>
        </div>
      </div>}
    </div>

    <Btn onClick={go} disabled={load||!inc.trim()} color={C.green}>
      💰 세금 계산하기
    </Btn>
    {load&&<><Dots/><div style={{textAlign:"center",fontSize:12,color:C.textMuted,marginTop:-10}}>계산 중...</div></>}
    <AiBox text={res}/>

    {!res&&<div style={{...st.card,background:C.skyBg,border:`1px solid ${C.sky}33`,marginTop:12}}>
      <p style={{margin:0,fontSize:11,color:C.sky,textAlign:"center",lineHeight:1.7}}>
        ⚠️ 추정치입니다. 정확한 세금 신고는 CPA와 상담하세요.
      </p>
    </div>}
  </div>;
}

// ════════════════════════════════════════════════════════
// 법률 도우미 (멀티턴 채팅)
// ════════════════════════════════════════════════════════
const MAX_TURNS=8;
function LegalTab(){
  const [cat,setCat]=useState("general");const [input,setInput]=useState("");const [chatHistory,setChat]=useState([]);const [apiMessages,setApi]=useState([]);const [load,setLoad]=useState(false);const chatEndRef=useRef(null);
  const CATS=[{v:"general",l:"⚖️ 일반"},{v:"traffic",l:"🚗 교통"},{v:"tenant",l:"🏠 임대"},{v:"employment",l:"💼 고용"},{v:"immigration",l:"🗽 이민"},{v:"consumer",l:"🛒 소비자"},{v:"small_claim",l:"⚖️ 소액재판"},{v:"scam",l:"🚨 사기"}];
  const QUICK=["집주인이 보증금을 안 돌려줘요","교통사고 상대방 보험 연락 없어요","직장에서 부당해고 당했어요","Small Claims 소송 방법은?","온라인 쇼핑 사기 환불방법","HOA 부당한 벌금 부과"];
  const SYS=`당신은 미국 법률 전문 한인 교민 도우미입니다. 반드시 한국어로만 답변하세요.\n📋 핵심요약 / ⚖️ 관련법률 / ✅ 행동방안(3가지) / 📄 필요서류 / 🆓 무료도움처\n⚠️ 법률 정보이며 법률 조언이 아닙니다.`;
  useEffect(()=>{chatEndRef.current?.scrollIntoView({behavior:"smooth"});},[chatHistory]);
  const turns=chatHistory.filter(m=>m.isUser).length;
  const isMaxed=turns>=MAX_TURNS;
  const send=async(text)=>{
    const q=(text||input).trim();if(!q||load||isMaxed)return;setInput("");
    const newUserMsg={role:"user",content:`카테고리:${CATS.find(c=>c.v===cat)?.l||cat}\n${q}`};
    const newApiMessages=[...apiMessages,newUserMsg];
    setChat(prev=>[...prev,{role:"user",content:q,isUser:true}]);setApi(newApiMessages);setLoad(true);
    const r=await askClaude(SYS,newApiMessages);
    setApi(prev=>[...prev,{role:"assistant",content:r}]);setChat(prev=>[...prev,{role:"assistant",content:r,isUser:false}]);setLoad(false);
  };
  const reset=()=>{setChat([]);setApi([]);setInput("");};
  return <div>
    <F label="카테고리"><Sel value={cat} onChange={setCat} options={CATS}/></F>
    {chatHistory.length===0&&<div style={{marginBottom:14}}>
      <span style={st.label}>자주 묻는 질문</span>
      <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
        {QUICK.map((q,i)=><button key={i} onClick={()=>send(q)} style={{background:C.skyBg,border:`1px solid ${C.sky}44`,borderRadius:20,padding:"6px 12px",color:C.sky,fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>{q.length>16?q.slice(0,16)+"…":q}</button>)}
      </div>
    </div>}
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
      <span style={{fontSize:12,color:C.textMuted}}>💬 대화 {turns}/{MAX_TURNS}회{isMaxed&&<span style={{color:C.red,marginLeft:6}}>최대 도달</span>}</span>
      {chatHistory.length>0&&<button onClick={reset} style={{background:C.redBg,border:`1px solid ${C.red}33`,borderRadius:8,padding:"4px 10px",color:C.red,fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>🔄 새 대화</button>}
    </div>
    {chatHistory.length>0&&<div style={{...st.card,marginBottom:12,maxHeight:380,overflowY:"auto",padding:"12px"}}>
      {chatHistory.map((m,i)=><div key={i} style={{marginBottom:12,display:"flex",flexDirection:"column",alignItems:m.isUser?"flex-end":"flex-start"}}>
        <div style={{maxWidth:"88%",padding:"10px 14px",borderRadius:m.isUser?"14px 14px 4px 14px":"14px 14px 14px 4px",background:m.isUser?C.navy:C.goldBg,color:m.isUser?"#fff":C.text,fontSize:13,lineHeight:1.75,whiteSpace:"pre-wrap",boxShadow:C.shadow,border:m.isUser?"none":`1px solid ${C.borderGold}`}}>
          {!m.isUser&&<div style={{fontSize:11,color:C.gold,fontWeight:700,marginBottom:4}}>⚖️ 법률 도우미</div>}
          {m.content}
        </div>
      </div>)}
      {load&&<div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 0"}}><span style={{fontSize:12,color:C.textMuted}}>답변 작성 중</span><Dots/></div>}
      <div ref={chatEndRef}/>
    </div>}
    {!isMaxed?<div>
      <F label={chatHistory.length===0?"질문 입력 (한국어/영어 모두 OK)":"추가 질문"}>
        <textarea value={input} onChange={e=>setInput(e.target.value)} rows={3} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();}}}
          placeholder="미국 생활 법률 궁금한 점을 한국어로 질문하세요..." style={{...st.input,resize:"vertical",lineHeight:1.7}}/>
      </F>
      <Btn onClick={()=>send()} disabled={load||!input.trim()} color={C.sky}>⚖️ {chatHistory.length===0?"법률 도우미에게 묻기":"추가 질문 보내기"}</Btn>
    </div>:<div style={{...st.card,background:C.orangeBg,border:`1px solid ${C.orange}44`,textAlign:"center"}}>
      <div style={{fontSize:14,color:C.orange,fontWeight:700,marginBottom:6}}>최대 {MAX_TURNS}회 도달</div>
      <button onClick={reset} style={{...st.btn(C.sky),marginTop:0}}>🔄 새 대화 시작</button>
    </div>}
    <div style={{...st.card,background:C.orangeBg,border:`1px solid ${C.orange}33`,marginTop:12}}>
      <p style={{margin:0,fontSize:12,color:C.orange}}>⚠️ 법률 정보이며 조언이 아닙니다. 중요한 사안은 변호사와 상담하세요.</p>
    </div>
  </div>;
}

// ════════════════════════════════════════════════════════
// 모기지 계산기 + 자격 심사
// ════════════════════════════════════════════════════════
function MortgageTab(){
  // 계산기
  const [price,setPrice]=useState("");const [down,setDown]=useState("");const [rate,setRate]=useState("");const [term,setTerm]=useState("30");const [calcResult,setCalcResult]=useState(null);
  // 자격 심사 AI
  const [income,setIncome]=useState("");const [monthly,setMonthly]=useState("");const [credit,setCredit]=useState("700");const [empType,setEmpType]=useState("w2");const [aiMode,setAiMode]=useState("qualify");
  const [res,setRes]=useState("");const [load,setLoad]=useState(false);

  // 모기지 계산 (로컬)
  const calcMortgage=()=>{
    const p=Number(price);const d=Number(down);const r=Number(rate)/100/12;const n=Number(term)*12;
    if(!p||!rate||p<=d)return;
    const loan=p-d;
    const payment=r===0?loan/n:loan*(r*Math.pow(1+r,n))/(Math.pow(1+r,n)-1);
    const total=payment*n;const totalInt=total-loan;
    setCalcResult({loan,payment,total,totalInt,ltvRatio:((loan/p)*100).toFixed(1)});
  };

  const SYS_Q=`미국 모기지 전문 한인 상담사. 한국어로만 답변.\n📊 DTI 비율 계산 / 🏦 최대 대출 가능 금액 / ✅ 자격 여부 판단 / 💡 자격 향상 방법 3가지 / 🏛️ 추천 대출 프로그램(FHA/Conventional/VA)\n⚠️ 실제 승인은 렌더에 문의하세요.`;
  const SYS_A=`미국 모기지 전략 전문가. 한국어로만 답변.\n📋 현재 상황 분석 / 💵 적정 주택 가격대 / 📈 이자율 전망 / 🏠 구매 vs 렌트 비교 / 💡 절약 팁 3가지\n⚠️ 투자 조언이 아닙니다.`;

  const askAI=async()=>{
    setLoad(true);setRes("");
    const sys=aiMode==="qualify"?SYS_Q:SYS_A;
    const msg=`연소득:$${income}, 월부채:$${monthly||0}, 크레딧:${credit}, 고용형태:${empType}${calcResult?`, 희망주택가:$${price}, 다운페이:$${down}`:""}, 주:NV`;
    const r=await askClaude(sys,msg);
    setRes(r);setLoad(false);
  };

  return <div>
    {/* 탭 전환 */}
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:14}}>
      {["calc","ai"].map(m=>(
        <button key={m} onClick={()=>{setAiMode(m==="ai"?"qualify":"qualify");}} style={{padding:"11px",borderRadius:10,border:`1.5px solid ${aiMode==="qualify"&&m==="ai"?C.sky:m==="calc"&&!calcResult?C.border:C.border}`,background:"transparent",fontFamily:"inherit",color:C.textMid,fontWeight:700,fontSize:13,cursor:"pointer",display:"none"}}>x</button>
      ))}
    </div>

    {/* ① 월 납입금 계산기 */}
    <div style={st.card}>
      <div style={{fontSize:15,fontWeight:800,color:C.navy,marginBottom:14}}>🏡 월 납입금 계산기</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
        <F label="주택 가격 ($)"><Inp type="number" value={price} onChange={setPrice} placeholder="450000"/></F>
        <F label="다운페이먼트 ($)"><Inp type="number" value={down} onChange={setDown} placeholder="90000"/></F>
        <F label="이자율 (%)"><Inp type="number" value={rate} onChange={setRate} placeholder="6.5"/></F>
        <F label="대출 기간">
          <Sel value={term} onChange={setTerm} options={[{v:"30",l:"30년"},{v:"20",l:"20년"},{v:"15",l:"15년"}]}/>
        </F>
      </div>
      <Btn onClick={calcMortgage} color={C.navy} disabled={!price||!rate}>🔢 계산하기</Btn>
      {calcResult&&<div style={{...st.card,background:C.goldBg,border:`1px solid ${C.borderGold}`,marginTop:12}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          {[
            {l:"월 납입금",v:fmt$(calcResult.payment),c:C.navy,big:true},
            {l:"대출 금액",v:fmt$(calcResult.loan),c:C.textMid},
            {l:"총 이자",v:fmt$(calcResult.totalInt),c:C.red},
            {l:"LTV 비율",v:`${calcResult.ltvRatio}%`,c:calcResult.ltvRatio>80?C.orange:C.green},
          ].map((x,i)=><div key={i} style={{textAlign:"center",padding:"10px",background:"#fff",borderRadius:10}}>
            <div style={{fontSize:x.big?18:14,fontWeight:800,color:x.c}}>{x.v}</div>
            <div style={{fontSize:11,color:C.textMuted,marginTop:2}}>{x.l}</div>
          </div>)}
        </div>
        {calcResult.ltvRatio>80&&<div style={{fontSize:12,color:C.orange,marginTop:8,textAlign:"center"}}>
          ⚠️ LTV {calcResult.ltvRatio}% → PMI(사보험) 추가 납부 필요
        </div>}
      </div>}
    </div>

    <GLine/>

    {/* ② AI 자격 심사 */}
    <div style={st.card}>
      <div style={{fontSize:15,fontWeight:800,color:C.navy,marginBottom:6}}>🏦 모기지 자격 AI 심사</div>
      <div style={{fontSize:12,color:C.textMuted,marginBottom:14}}>소득·부채·크레딧 입력 → AI가 자격 여부와 최대 금액 분석</div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
        {["qualify","advice"].map(m=>(
          <button key={m} onClick={()=>setAiMode(m)} style={{padding:"10px",borderRadius:10,border:`1.5px solid ${aiMode===m?C.sky:C.border}`,background:aiMode===m?C.skyBg:"transparent",fontFamily:"inherit",color:aiMode===m?C.sky:C.textMid,fontWeight:700,fontSize:13,cursor:"pointer"}}>
            {m==="qualify"?"✅ 자격 심사":"📊 구매 전략"}
          </button>
        ))}
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
        <F label="연간 총 소득 ($)"><Inp type="number" value={income} onChange={setIncome} placeholder="85000"/></F>
        <F label="월 부채 합계 ($)"><Inp type="number" value={monthly} onChange={setMonthly} placeholder="500"/></F>
        <F label="크레딧 스코어">
          <Sel value={credit} onChange={setCredit} options={[{v:"760+",l:"760+ (탁월)"},{v:"740",l:"740-759 (매우좋음)"},{v:"700",l:"700-739 (좋음)"},{v:"660",l:"660-699 (보통)"},{v:"620",l:"620-659 (낮음)"},{v:"580",l:"580 미만 (불량)"}]}/>
        </F>
        <F label="고용 형태">
          <Sel value={empType} onChange={setEmpType} options={[{v:"w2",l:"W-2 직장인"},{v:"self",l:"자영업/1099"},{v:"business",l:"사업체 운영"},{v:"retired",l:"은퇴/연금"}]}/>
        </F>
      </div>

      <Btn onClick={askAI} disabled={load||!income} color={C.sky}>
        {aiMode==="qualify"?"✅ 자격 심사 받기":"📊 구매 전략 분석"}
      </Btn>
    </div>

    {load&&<Dots/>}
    <AiBox text={res}/>

    <div style={{...st.card,background:C.orangeBg,border:`1px solid ${C.orange}33`,marginTop:12}}>
      <p style={{margin:0,fontSize:12,color:C.orange}}>
        ⚠️ AI 분석은 참고용입니다. 실제 모기지 승인은 렌더(은행/모기지회사)에 문의하세요.
      </p>
    </div>
  </div>;
}

// ════════════════════════════════════════════════════════
// 메인 앱
// ════════════════════════════════════════════════════════
export default function App(){
  const [tab,setTab]=useState("home");
  const [docs,setDocs]=useState([]);
  const [txns,setTxns]=useState([]);
  const [todos,setTodos]=useState([]);
  const [aiCount,setAiCount]=useState(0);
  const [showPremium,setShowPremium]=useState(false);

  useEffect(()=>{
    load("docs").then(setDocs);
    load("txns").then(setTxns);
    load("todos").then(setTodos);
    getAiCount().then(setAiCount);
  },[]);
  useEffect(()=>{
    const i=setInterval(()=>{
      load("docs").then(setDocs);
      load("txns").then(setTxns);
      load("todos").then(setTodos);
      getAiCount().then(setAiCount);
    },3000);
    return()=>clearInterval(i);
  },[]);

  const handleAiUsed=async()=>{ const n=await getAiCount(); setAiCount(n); };
  const handleAiBlocked=()=>setShowPremium(true);

  const SCREENS={
    home:<HomeTab docs={docs} txns={txns} todos={todos} aiCount={aiCount}/>,
    docs:<DocsTab/>,
    budget:<BudgetTab/>,
    pa:<PATab docs={docs} txns={txns} aiCount={aiCount} onAiUsed={handleAiUsed} onAiBlocked={handleAiBlocked}/>,
    scan:<ScanTab onPremium={()=>setShowPremium(true)}/>,
    ticket:<TicketTab/>,
    letter:<LetterTab aiCount={aiCount} onAiUsed={handleAiUsed} onAiBlocked={handleAiBlocked}/>,
    tax:<TaxTab aiCount={aiCount} onAiUsed={handleAiUsed} onAiBlocked={handleAiBlocked}/>,
    legal:<LegalTab aiCount={aiCount} onAiUsed={handleAiUsed} onAiBlocked={handleAiBlocked}/>,
    mortgage:<MortgageTab aiCount={aiCount} onAiUsed={handleAiUsed} onAiBlocked={handleAiBlocked}/>,
  };

  const curTab=TABS.find(t=>t.id===tab);
  const aiLeft=Math.max(0,AI_MAX-aiCount);

  return (
    <div style={{minHeight:"100vh",background:C.bg,fontFamily:"'Noto Sans KR','Apple SD Gothic Neo',sans-serif",color:C.text,maxWidth:680,margin:"0 auto"}}>
      <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700;900&display=swap" rel="stylesheet"/>

      <PremiumModal open={showPremium} onClose={()=>setShowPremium(false)} reason="ai"/>

      {/* 헤더 — 작게 */}
      <div style={{background:C.bgHeader,borderBottom:"1.5px solid rgba(184,130,10,0.25)",padding:"10px 16px 8px",position:"sticky",top:0,zIndex:100,boxShadow:"0 2px 10px rgba(26,43,69,0.07)"}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <div style={{width:32,height:32,borderRadius:8,flexShrink:0,background:`linear-gradient(135deg,${C.navy},${C.navyMid})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>🇺🇸</div>
          <div>
            <div style={{fontSize:16,fontWeight:900,color:C.navy,lineHeight:1.1}}>미국생활 911</div>
            <div style={{fontSize:9,color:C.textMuted}}>미국 교민 올인원 생활관리</div>
          </div>
          <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:6}}>
            <div onClick={()=>aiLeft===0&&setShowPremium(true)}
              style={{fontSize:11,color:aiLeft===0?C.red:aiLeft===1?C.orange:C.green,
                background:aiLeft===0?C.redBg:aiLeft===1?C.orangeBg:C.greenBg,
                border:`1px solid ${aiLeft===0?C.red:aiLeft===1?C.orange:C.green}33`,
                borderRadius:7,padding:"3px 7px",fontWeight:700,cursor:aiLeft===0?"pointer":"default"}}>
              🤖 {aiLeft}/{AI_MAX}
            </div>
            <div style={{fontSize:11,color:C.gold,fontWeight:700,background:C.goldBg,border:"1px solid rgba(184,130,10,0.3)",borderRadius:7,padding:"3px 8px"}}>
              {curTab?.emoji} {curTab?.label}
            </div>
          </div>
        </div>
      </div>

      {/* 콘텐츠 */}
      <div style={{padding:"16px 16px 120px"}}>
        {tab!=="home"&&tab!=="pa"&&<>
          <div style={{fontSize:17,fontWeight:800,color:C.text,marginBottom:4}}>{curTab?.emoji} {curTab?.label}</div>
          <div style={{height:2,background:`linear-gradient(90deg,${C.gold},transparent)`,marginBottom:16,borderRadius:1}}/>
        </>}
        {tab==="pa"&&<>
          <div style={{fontSize:17,fontWeight:800,color:C.text,marginBottom:4}}>{curTab?.emoji} {curTab?.label}</div>
          <div style={{height:2,background:`linear-gradient(90deg,${C.gold},transparent)`,marginBottom:12,borderRadius:1}}/>
        </>}
        {SCREENS[tab]}
        {["ticket","letter","tax","legal","mortgage"].includes(tab)&&(
          <div style={{marginTop:20,padding:"12px 16px",background:C.goldBg,border:"1px solid rgba(184,130,10,0.3)",borderRadius:10}}>
            <p style={{margin:0,fontSize:11,color:C.textMid,textAlign:"center",lineHeight:1.7}}>
              ⚠️ 미국생활 911는 정보 제공용 AI 서비스입니다. 법률·세무·금융 결정은 전문가와 상담하세요.
            </p>
          </div>
        )}
      </div>

      {/* 하단 탭바 — 가로 스크롤 */}
      <div style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:680,background:C.bgHeader,borderTop:"1.5px solid #E2E8F0",boxShadow:"0 -4px 20px rgba(26,43,69,0.08)"}}>
        <div style={{display:"flex",overflowX:"auto",padding:"8px 4px 14px",WebkitOverflowScrolling:"touch",scrollbarWidth:"none"}}>
          <style>{`div::-webkit-scrollbar{display:none}`}</style>
          {TABS.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)}
              style={{display:"flex",flexDirection:"column",alignItems:"center",gap:3,background:"none",border:"none",cursor:"pointer",padding:"4px 8px",flexShrink:0,minWidth:60}}>
              <span style={{fontSize:20}}>{t.emoji}</span>
              <span style={{fontSize:11,fontFamily:"inherit",color:tab===t.id?C.gold:C.textMuted,fontWeight:tab===t.id?800:500,whiteSpace:"nowrap"}}>{t.label}</span>
              {tab===t.id&&<div style={{width:18,height:2.5,background:C.gold,borderRadius:2}}/>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
