import React, { useState, useEffect, useRef } from 'react';
import { GoogleOAuthProvider, useGoogleLogin } from '@react-oauth/google';

/* ─────────────────────────────────────────
   CONFIG — API KEYS
───────────────────────────────────────── */
const GOOGLE_CLIENT_ID = '630089517286-lpgo4sq55e0nllut9940rm8jbauv07f9.apps.googleusercontent.com';
const GEMINI_API_KEY   = 'AIzaSyBS3quMmraHF9O7HENXnosehsaynSCJxuk';
const GEMINI_URL       = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

/* ─────────────────────────────────────────
   DEEP SEA BOTANICA PALETTE
───────────────────────────────────────── */
const DARK = {
  bg:'#060D12', card:'#0C1A22', card2:'#112230', border:'#1A3345',
  text:'#D6EDE8', muted:'#4A7A7A', sub:'#6BA8A0',
  teal:'#0BBFAA',   tealD:'#062A25',   tealL:'#AEFAF2',
  coral:'#E8714A',  coralD:'#3D1508',  coralL:'#FFD4C2',
  sage:'#4CAF82',   sageD:'#0A2818',   sageL:'#B8F0D0',
  amber:'#D4A843',  amberD:'#332208',  amberL:'#FFF0C0',
  blue:'#2E86C8',   blueD:'#081E3A',   blueL:'#B8DCFF',
  purple:'#7B68EE', purpleD:'#1A1440', purpleL:'#D8D4FF',
  pink:'#C4607A',   pinkD:'#300A18',   pinkL:'#FFD0DC',
  red:'#E05555',    redD:'#300808',    redL:'#FFD0D0',
  green:'#3DB87A',  greenD:'#082818',  greenL:'#C0F0D8',
};
const LIGHT = {
  bg:'#EEF8F6', card:'#FFFFFF', card2:'#D8F0EC', border:'#A8D8D0',
  text:'#0A2020', muted:'#5A9090', sub:'#3A7070',
  teal:'#0A9E8E',   tealD:'#D0F5F0',   tealL:'#054845',
  coral:'#C85A35',  coralD:'#FFE8DE',  coralL:'#5A1A08',
  sage:'#3A9068',   sageD:'#D0F0E0',   sageL:'#0A3820',
  amber:'#B88A25',  amberD:'#FFF5D8',  amberL:'#3A2005',
  blue:'#1A70B0',   blueD:'#D8EEFF',   blueL:'#082040',
  purple:'#5E50CC', purpleD:'#E8E5FF', purpleL:'#1A1060',
  pink:'#A84560',   pinkD:'#FFE0E8',   pinkL:'#380818',
  red:'#C03535',    redD:'#FFE0E0',    redL:'#280808',
  green:'#2A9860',  greenD:'#D0F8E8',  greenL:'#082818',
};

const COLOR_KEYS = ['teal','coral','sage','amber','blue','purple','pink','red'];
const ICONS = ['📚','🔬','📊','⚖️','💻','🧮','🏛️','🧪','🎯','📝','🩺','✏️','🌍','🎵','💡','🔧','🌿','🐠','🪸','🌊'];

/* ─── STORAGE ─── */
const load = (k,f) => { try{const v=localStorage.getItem(k);return v?JSON.parse(v):f;}catch{return f;} };
const persist = (k,v) => { try{localStorage.setItem(k,JSON.stringify(v));}catch{} };

/* ─── UTILS ─── */
const daysUntil = d => Math.max(0,Math.ceil((new Date(d)-new Date())/86400000));
const today = () => new Date().toISOString().slice(0,10);
const coursePct = co => {
  const all = (co.units||[]).flatMap(u=>(u.topics||[]));
  if(!all.length) return 0;
  return Math.round(all.filter(t=>t.done).length/all.length*100);
};
const unitPct = u => {
  const topics = u.topics||[];
  if(!topics.length) return 0;
  return Math.round(topics.filter(t=>t.done).length/topics.length*100);
};

/* ─── GEMINI ─── */
async function askGemini(prompt) {
  const res = await fetch(GEMINI_URL, {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ contents:[{parts:[{text:prompt}]}] }),
  });
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

/* ─── GOOGLE CALENDAR ─── */
async function pushToCalendar(token, title, desc, dateStr, mins=60) {
  const start = new Date(dateStr);
  const end   = new Date(start.getTime()+mins*60000);
  const tz    = Intl.DateTimeFormat().resolvedOptions().timeZone;
  await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events',{
    method:'POST',
    headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},
    body:JSON.stringify({
      summary:`📚 ${title}`, description:desc,
      start:{dateTime:start.toISOString(),timeZone:tz},
      end:{dateTime:end.toISOString(),timeZone:tz},
      colorId:'9',
      reminders:{useDefault:false,overrides:[{method:'popup',minutes:10}]},
    }),
  });
}

/* ═══════════════════════════════════════════
   ROOT
═══════════════════════════════════════════ */
export default function App() {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <StudyOS />
    </GoogleOAuthProvider>
  );
}

function StudyOS() {
  const [dark,setDark]         = useState(()=>load('sos_dark',true));
  const [tab,setTab]           = useState('home');
  const [courses,setCourses]   = useState(()=>load('sos_courses',[]));
  const [cards,setCards]       = useState(()=>load('sos_cards',[]));
  const [sessions,setSessions] = useState(()=>load('sos_sessions',[]));
  const [goals,setGoals]       = useState(()=>load('sos_goals',[]));
  const [gToken,setGToken]     = useState(()=>load('sos_gtoken',null));
  const [gUser,setGUser]       = useState(()=>load('sos_guser',null));

  const c = dark?DARK:LIGHT;

  useEffect(()=>persist('sos_dark',dark),[dark]);
  useEffect(()=>persist('sos_courses',courses),[courses]);
  useEffect(()=>persist('sos_cards',cards),[cards]);
  useEffect(()=>persist('sos_sessions',sessions),[sessions]);
  useEffect(()=>persist('sos_goals',goals),[goals]);
  useEffect(()=>persist('sos_gtoken',gToken),[gToken]);
  useEffect(()=>persist('sos_guser',gUser),[gUser]);

  const allTopics  = courses.flatMap(co=>(co.units||[]).flatMap(u=>(u.topics||[])));
  const doneTopics = allTopics.filter(t=>t.done).length;
  const nextExam   = [...courses].filter(co=>co.examDate&&co.units).sort((a,b)=>daysUntil(a.examDate)-daysUntil(b.examDate))[0];

  const toggleTopic = (cid,uid,tid) => setCourses(prev=>prev.map(co=>
    co.id!==cid?co:{...co,units:(co.units||[]).map(u=>
      u.id!==uid?u:{...u,topics:(u.topics||[]).map(t=>t.id===tid?{...t,done:!t.done}:t)}
    )}
  ));

  const deleteCourse = id => { if(window.confirm('Delete this course?')) setCourses(p=>p.filter(co=>co.id!==id)); };

  const s = mkStyles(c);

  return (
    <div style={s.app}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=DM+Sans:wght@300;400;500&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}
        body{background:${c.bg}}
        input,textarea,select{font-family:'DM Sans',sans-serif;color:${c.text}}
        input[type=date]::-webkit-calendar-picker-indicator,
        input[type=datetime-local]::-webkit-calendar-picker-indicator{filter:${dark?'invert(1)':'none'}}
        ::-webkit-scrollbar{width:3px}
        ::-webkit-scrollbar-thumb{background:${c.border};border-radius:4px}
        @keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        @keyframes shimmer{0%{opacity:0.6}50%{opacity:1}100%{opacity:0.6}}
        .screen{animation:fadeUp 0.25s ease}
        .press:active{transform:scale(0.96);transition:transform 0.1s}
        .hov:hover{opacity:0.82;transition:opacity 0.15s}
        .thinking{animation:shimmer 1.4s infinite}
      `}</style>

      <header style={s.nav}>
        <div style={s.logo}>Study<span style={{color:c.teal}}>OS</span></div>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          {gUser&&<div style={{fontSize:11,color:c.sage,background:c.sageD,padding:'4px 10px',borderRadius:20}}>📅 Synced</div>}
          <button className="press" onClick={()=>setDark(!dark)} style={s.iconBtn}>{dark?'☀️':'🌙'}</button>
          <div style={s.avatar}>ME</div>
        </div>
      </header>

      <main style={s.main}>
        {tab==='home'      && <HomeTab      c={c} s={s} courses={courses} sessions={sessions} goals={goals} setGoals={setGoals} doneTopics={doneTopics} allTopics={allTopics} nextExam={nextExam} setTab={setTab} toggleTopic={toggleTopic} gToken={gToken} setGToken={setGToken} setGUser={setGUser} gUser={gUser} setGUser2={setGUser} />}
        {tab==='courses'   && <CoursesTab   c={c} s={s} courses={courses} setCourses={setCourses} toggleTopic={toggleTopic} deleteCourse={deleteCourse} />}
        {tab==='focus'     && <FocusTab     c={c} s={s} courses={courses} sessions={sessions} setSessions={setSessions} gToken={gToken} setGToken={setGToken} setGUser={setGUser} />}
        {tab==='cards'     && <CardsTab     c={c} s={s} cards={cards} setCards={setCards} courses={courses} />}
        {tab==='analytics' && <AnalyticsTab c={c} s={s} courses={courses} sessions={sessions} doneTopics={doneTopics} allTopics={allTopics} />}
        {tab==='ai'        && <AITab        c={c} s={s} courses={courses} setCourses={setCourses} setCards={setCards} />}
        {tab==='add'       && <AddTab       c={c} s={s} courses={courses} setCourses={setCourses} setCards={setCards} setTab={setTab} gToken={gToken} setGToken={setGToken} setGUser={setGUser} />}
      </main>

      <nav style={s.bottomNav}>
        {[
          {id:'home',icon:'🏠',label:'Home'},
          {id:'courses',icon:'📖',label:'Courses'},
          {id:'focus',icon:'⏱️',label:'Focus'},
          {id:'cards',icon:'🃏',label:'Cards'},
          {id:'analytics',icon:'📈',label:'Stats'},
          {id:'ai',icon:'🤖',label:'AI'},
          {id:'add',icon:'＋',label:'Add'},
        ].map(({id,icon,label})=>(
          <button key={id} className="press" onClick={()=>setTab(id)} style={s.navBtn(tab===id)}>
            <span style={{fontSize:18}}>{icon}</span>
            <span style={{fontSize:8,marginTop:2}}>{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

/* ═══════════════════════════════════════════
   HOME TAB
═══════════════════════════════════════════ */
function HomeTab({c,s,courses,sessions,goals,setGoals,doneTopics,allTopics,nextExam,setTab,toggleTopic,gToken,setGToken,setGUser,gUser}) {
  const hour=new Date().getHours();
  const greet=hour<12?'Good morning':hour<17?'Good afternoon':'Good evening';
  const tod=today();
  const todaySessions=sessions.filter(s=>s.date===tod);
  const todayHrs=todaySessions.reduce((a,s)=>a+s.hours,0);
  const [newGoal,setNewGoal]=useState('');
  const [addingGoal,setAddingGoal]=useState(false);

  /* Heatmap — last 35 days */
  const heatDays=Array.from({length:35},(_,i)=>{
    const d=new Date(); d.setDate(d.getDate()-(34-i));
    const key=d.toISOString().slice(0,10);
    const hrs=sessions.filter(s=>s.date===key).reduce((a,s)=>a+s.hours,0);
    return {key,hrs};
  });

  const heatColor=(hrs)=>{
    if(hrs===0) return c.border;
    if(hrs<1) return c.teal+'55';
    if(hrs<2) return c.teal+'99';
    if(hrs<3) return c.teal+'CC';
    return c.teal;
  };

  const login = useGoogleLogin({
    onSuccess:async t=>{
      setGToken(t.access_token);
      try{const r=await fetch('https://www.googleapis.com/oauth2/v3/userinfo',{headers:{Authorization:`Bearer ${t.access_token}`}});setGUser(await r.json());}catch{}
    },
    onError:()=>alert('Google login failed.'),
    scope:'https://www.googleapis.com/auth/calendar.events',
  });

  return (
    <div className="screen">
      <div style={{marginBottom:20}}>
        <h1 style={{...s.display,fontSize:24,marginBottom:4}}>{greet}! 🌊</h1>
        <p style={{fontSize:13,color:c.muted}}>{new Date().toDateString()} · {courses.length} course{courses.length!==1?'s':''}</p>
      </div>

      {/* GOOGLE CALENDAR */}
      {!gToken?(
        <button className="press hov" onClick={()=>login()}
          style={{...s.card,width:'100%',border:`1px solid ${c.teal}44`,display:'flex',alignItems:'center',gap:12,marginBottom:14,cursor:'pointer',background:c.tealD}}>
          <span style={{fontSize:22}}>📅</span>
          <div style={{textAlign:'left'}}>
            <div style={{fontSize:13,fontWeight:500,color:c.tealL}}>Connect Google Calendar</div>
            <div style={{fontSize:11,color:c.teal,marginTop:2}}>Sync study sessions automatically</div>
          </div>
        </button>
      ):(
        <div style={{...s.card,background:c.sageD,border:`1px solid ${c.sage}44`,marginBottom:14,display:'flex',alignItems:'center',gap:12}}>
          <span style={{fontSize:20}}>✅</span>
          <div>
            <div style={{fontSize:13,color:c.sageL,fontWeight:500}}>Google Calendar connected</div>
            <div style={{fontSize:11,color:c.sage,marginTop:2}}>{gUser?.email||'Signed in'}</div>
          </div>
        </div>
      )}

      {courses.length===0?(
        <div style={{...s.card,textAlign:'center',padding:'48px 24px',border:`2px dashed ${c.border}`,marginBottom:20}}>
          <div style={{fontSize:56,marginBottom:16}}>🌊</div>
          <h2 style={{...s.display,fontSize:20,marginBottom:10}}>Welcome to StudyOS</h2>
          <p style={{fontSize:14,color:c.muted,lineHeight:1.75,marginBottom:24}}>Your deep-focus study companion.<br/>Add your first course to begin.</p>
          <button className="press hov" onClick={()=>setTab('add')} style={s.btnPrimary(c.teal)}>＋ Add first course</button>
        </div>
      ):(
        <>
          {/* STATS */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:18}}>
            <Stat label="Topics done"  val={`${doneTopics}/${allTopics.length}`} color={c.teal} />
            <Stat label="Today's hrs"  val={todayHrs.toFixed(1)+'h'}             color={c.coral} />
            <Stat label="Next exam"    val={nextExam?`${daysUntil(nextExam.examDate)}d`:'—'} color={nextExam?(daysUntil(nextExam.examDate)<30?c.red:daysUntil(nextExam.examDate)<60?c.coral:c.sage):c.muted} />
            <Stat label="Progress"     val={`${allTopics.length>0?Math.round(doneTopics/allTopics.length*100):0}%`} color={c.sage} />
          </div>

          {/* STUDY HEATMAP */}
          <div style={{...s.card,marginBottom:14}}>
            <Label text="Study heatmap — last 5 weeks" />
            <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:4,marginTop:10}}>
              {['S','M','T','W','T','F','S'].map((d,i)=>(
                <div key={i} style={{fontSize:9,color:c.muted,textAlign:'center',marginBottom:2}}>{d}</div>
              ))}
              {heatDays.map(({key,hrs})=>(
                <div key={key} title={`${key}: ${hrs}h`}
                  style={{height:20,borderRadius:4,background:heatColor(hrs),transition:'background 0.3s'}} />
              ))}
            </div>
            <div style={{display:'flex',gap:8,alignItems:'center',marginTop:10,justifyContent:'flex-end'}}>
              <span style={{fontSize:10,color:c.muted}}>Less</span>
              {[0,0.5,1.5,2.5,3.5].map(h=>(
                <div key={h} style={{width:12,height:12,borderRadius:3,background:heatColor(h)}} />
              ))}
              <span style={{fontSize:10,color:c.muted}}>More</span>
            </div>
          </div>

          {/* TODAY SESSIONS */}
          <div style={{...s.card,marginBottom:14}}>
            <Label text="Today's sessions" />
            {todaySessions.length===0?(
              <div style={{fontSize:13,color:c.muted,fontStyle:'italic',marginTop:8}}>No sessions logged today. Go to ⏱️ Focus to log one.</div>
            ):(
              todaySessions.map((sess,i)=>(
                <div key={i} style={{display:'flex',alignItems:'center',gap:12,padding:'8px 0',borderBottom:`1px solid ${c.border}`}}>
                  <div style={{width:10,height:10,borderRadius:'50%',background:c.teal,flexShrink:0}} />
                  <div style={{flex:1}}>
                    <div style={{fontSize:13,color:c.text}}>{sess.topic||sess.course}</div>
                    <div style={{fontSize:11,color:c.muted,marginTop:2}}>{sess.course} · {sess.hours}h</div>
                  </div>
                  <div style={{fontSize:11,color:c.muted}}>{sess.time}</div>
                </div>
              ))
            )}
          </div>

          {/* WEEKLY GOALS */}
          <div style={{...s.card,marginBottom:14}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
              <Label text="Weekly goals" />
              <button className="press" onClick={()=>setAddingGoal(!addingGoal)}
                style={{background:c.teal,color:'#fff',border:'none',borderRadius:8,padding:'4px 12px',fontSize:12,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>
                {addingGoal?'✕':'＋'}
              </button>
            </div>
            {addingGoal&&(
              <div style={{display:'flex',gap:8,marginBottom:10}}>
                <input style={{...s.input,marginBottom:0,flex:1,fontSize:13}} placeholder="e.g. Finish Unit 2 topics..." value={newGoal} onChange={e=>setNewGoal(e.target.value)}
                  onKeyDown={e=>{if(e.key==='Enter'&&newGoal.trim()){setGoals(p=>[...p,{id:Date.now(),text:newGoal.trim(),done:false,color:COLOR_KEYS[p.length%COLOR_KEYS.length]}]);setNewGoal('');setAddingGoal(false);}}} />
                <button className="press" onClick={()=>{if(newGoal.trim()){setGoals(p=>[...p,{id:Date.now(),text:newGoal.trim(),done:false,color:COLOR_KEYS[p.length%COLOR_KEYS.length]}]);setNewGoal('');setAddingGoal(false);}}}
                  style={{background:c.teal,color:'#fff',border:'none',borderRadius:10,padding:'0 14px',cursor:'pointer',fontSize:18}}>＋</button>
              </div>
            )}
            {goals.length===0&&<div style={{fontSize:13,color:c.muted,fontStyle:'italic'}}>No goals yet. Add one above!</div>}
            {goals.map(g=>(
              <div key={g.id} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 12px',borderRadius:10,background:c[g.color+'D'],marginBottom:6}}>
                <div onClick={()=>setGoals(p=>p.map(x=>x.id===g.id?{...x,done:!x.done}:x))}
                  style={{width:18,height:18,borderRadius:'50%',border:`1.5px solid ${c[g.color]}`,background:g.done?c[g.color]:'transparent',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,color:'#fff',flexShrink:0}}>
                  {g.done?'✓':''}
                </div>
                <span style={{flex:1,fontSize:13,color:c[g.color+'L'],textDecoration:g.done?'line-through':'none'}}>{g.text}</span>
                <button onClick={()=>setGoals(p=>p.filter(x=>x.id!==g.id))}
                  style={{background:'none',border:'none',color:c.muted,cursor:'pointer',fontSize:14}}>✕</button>
              </div>
            ))}
          </div>

          {/* QUICK ACTIONS */}
          <Label text="Quick actions" />
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:20}}>
            {[
              {label:'AI Tutor',icon:'🤖',id:'ai',bg:c.tealD,fg:c.teal},
              {label:'Focus Timer',icon:'⏱️',id:'focus',bg:c.coralD,fg:c.coral},
              {label:'Flashcards',icon:'🃏',id:'cards',bg:c.amberD,fg:c.amber},
              {label:'Analytics',icon:'📈',id:'analytics',bg:c.sageD,fg:c.sage},
            ].map(({label,icon,id,bg,fg})=>(
              <button key={id} className="press" onClick={()=>setTab(id)}
                style={{background:bg,border:'none',borderRadius:14,padding:'14px',cursor:'pointer',display:'flex',alignItems:'center',gap:10,textAlign:'left'}}>
                <span style={{fontSize:22}}>{icon}</span>
                <span style={{fontSize:13,fontWeight:500,color:fg,fontFamily:"'DM Sans',sans-serif"}}>{label}</span>
              </button>
            ))}
          </div>

          {/* COURSES SNAPSHOT */}
          <Label text="My courses" />
          {courses.map(co=>{
            const cc=c[co.color],ccD=c[co.color+'D'],ccL=c[co.color+'L'],p=coursePct(co);
            return (
              <div key={co.id} style={{...s.card,background:ccD,border:'none',marginBottom:14}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:10}}>
                  <div style={{flex:1}}>
                    <div style={{fontSize:16,fontWeight:500,color:ccL}}>{co.icon} {co.name}</div>
                    {co.examDate&&<div style={{fontSize:11,color:cc,marginTop:3}}>📅 {new Date(co.examDate).toDateString()}</div>}
                  </div>
                  {co.examDate&&<div style={{textAlign:'right'}}>
                    <div style={{fontSize:26,fontWeight:700,color:ccL,fontFamily:"'Playfair Display',serif",lineHeight:1}}>{daysUntil(co.examDate)}</div>
                    <div style={{fontSize:10,color:cc}}>days left</div>
                  </div>}
                </div>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:cc,marginBottom:6}}>
                  <span>Progress</span><span style={{fontWeight:500,color:ccL}}>{p}%</span>
                </div>
                <ProgBar val={p} color={cc} bg={cc+'25'} />
                {(co.units||[]).map(u=>(
                  <div key={u.id} style={{marginTop:12}}>
                    <div style={{fontSize:12,fontWeight:500,color:cc,marginBottom:6}}>📂 {u.name} <span style={{fontWeight:400}}>({unitPct(u)}%)</span></div>
                    {(u.topics||[]).map(t=>(
                      <div key={t.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'6px 0 6px 12px',borderBottom:`1px solid ${cc}18`}}>
                        <div style={{display:'flex',alignItems:'center',gap:8,flex:1,minWidth:0}}>
                          <Circle done={t.done} color={cc} onClick={()=>toggleTopic(co.id,u.id,t.id)} />
                          <span style={{fontSize:12,color:t.done?cc:ccL,textDecoration:t.done?'line-through':'none',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{t.name}</span>
                        </div>
                        <button className="press" onClick={()=>toggleTopic(co.id,u.id,t.id)}
                          style={{fontSize:10,padding:'2px 8px',borderRadius:20,border:'none',cursor:'pointer',background:t.done?c.green+'33':cc+'33',color:t.done?c.green:cc,fontFamily:"'DM Sans',sans-serif",flexShrink:0,marginLeft:6}}>
                          {t.done?'✓':'Mark'}
                        </button>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════
   COURSES TAB
═══════════════════════════════════════════ */
function CoursesTab({c,s,courses,setCourses,toggleTopic,deleteCourse}) {
  const [editing,setEditing]=useState(null);
  const [detail,setDetail]=useState(null);

  if(editing!==null){
    const co=courses.find(x=>x.id===editing);
    if(!co){setEditing(null);return null;}
    return <EditCourse c={c} s={s} course={co} setCourses={setCourses} onBack={()=>setEditing(null)} />;
  }
  if(detail!==null){
    const co=courses.find(x=>x.id===detail);
    if(!co){setDetail(null);return null;}
    const cc=c[co.color],ccD=c[co.color+'D'],ccL=c[co.color+'L'];
    const all=(co.units||[]).flatMap(u=>(u.topics||[]));
    const p=coursePct(co);
    return (
      <div className="screen">
        <button className="press" onClick={()=>setDetail(null)} style={s.backBtn}>← Back</button>
        <div style={{...s.card,background:ccD,border:'none',margin:'14px 0'}}>
          <div style={{fontSize:36,marginBottom:8}}>{co.icon}</div>
          <h2 style={{...s.display,fontSize:20,color:ccL,marginBottom:6}}>{co.name}</h2>
          {co.examDate&&<div style={{fontSize:12,color:cc,marginBottom:14}}>Exam: {new Date(co.examDate).toDateString()} · {daysUntil(co.examDate)} days away</div>}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8}}>
            {[{label:'Progress',val:p+'%'},{label:'Units',val:(co.units||[]).length},{label:'Topics done',val:`${all.filter(t=>t.done).length}/${all.length}`}].map(({label,val})=>(
              <div key={label} style={{background:cc+'25',borderRadius:10,padding:'10px 8px',textAlign:'center'}}>
                <div style={{fontSize:17,fontWeight:700,color:ccL,fontFamily:"'Playfair Display',serif"}}>{val}</div>
                <div style={{fontSize:10,color:cc,marginTop:3}}>{label}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
          <Label text={`Units (${(co.units||[]).length})`} />
          <button className="press hov" onClick={()=>{setDetail(null);setTimeout(()=>setEditing(co.id),10);}}
            style={{fontSize:12,color:c.teal,background:'none',border:'none',cursor:'pointer'}}>✏️ Edit</button>
        </div>
        {(co.units||[]).map(u=>(
          <div key={u.id} style={{...s.card,marginBottom:12}}>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}>
              <div style={{fontSize:14,fontWeight:500,color:c.text}}>📂 {u.name}</div>
              <div style={{fontSize:13,color:cc,fontWeight:500}}>{unitPct(u)}%</div>
            </div>
            <ProgBar val={unitPct(u)} color={cc} bg={c.border} />
            <div style={{marginTop:10}}>
              {(u.topics||[]).map(t=>(
                <div key={t.id} style={{display:'flex',alignItems:'center',gap:10,padding:'7px 0',borderBottom:`1px solid ${c.border}`}}>
                  <Circle done={t.done} color={cc} onClick={()=>toggleTopic(co.id,u.id,t.id)} size={20} />
                  <div style={{flex:1}}>
                    <div style={{fontSize:13,color:c.text,textDecoration:t.done?'line-through':'none'}}>{t.name}</div>
                    {t.confidence>0&&(
                      <div style={{display:'flex',gap:6,alignItems:'center',marginTop:4}}>
                        <div style={{flex:1,height:3,background:c.border,borderRadius:2}}>
                          <div style={{height:3,width:t.confidence+'%',background:t.confidence>70?c.sage:t.confidence>40?c.amber:c.coral,borderRadius:2}} />
                        </div>
                        <span style={{fontSize:10,color:c.muted}}>{t.confidence}%</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="screen">
      <h1 style={{...s.display,fontSize:22,marginBottom:20}}>My Courses</h1>
      {courses.length===0&&(
        <div style={{...s.card,textAlign:'center',padding:'50px 24px',border:`2px dashed ${c.border}`}}>
          <div style={{fontSize:48,marginBottom:14}}>📚</div>
          <div style={{fontSize:15,color:c.text,marginBottom:6}}>No courses yet</div>
          <div style={{fontSize:13,color:c.muted}}>Go to ＋ Add to create your first course</div>
        </div>
      )}
      {courses.map(co=>{
        const cc=c[co.color],ccD=c[co.color+'D'],ccL=c[co.color+'L'],p=coursePct(co);
        const all=(co.units||[]).flatMap(u=>(u.topics||[]));
        return (
          <div key={co.id} style={{...s.card,background:ccD,border:'none',marginBottom:14}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
              <button className="press" onClick={()=>setDetail(co.id)}
                style={{display:'flex',alignItems:'center',gap:10,background:'none',border:'none',cursor:'pointer',flex:1,textAlign:'left'}}>
                <div style={{width:44,height:44,borderRadius:12,background:cc+'30',display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,flexShrink:0}}>{co.icon}</div>
                <div>
                  <div style={{fontSize:15,fontWeight:500,color:ccL}}>{co.name}</div>
                  <div style={{fontSize:11,color:cc,marginTop:2}}>{(co.units||[]).length} units · {all.length} topics</div>
                </div>
              </button>
              <div style={{textAlign:'right',marginLeft:8}}>
                <div style={{fontSize:24,fontWeight:700,color:ccL,fontFamily:"'Playfair Display',serif",lineHeight:1}}>{p}%</div>
              </div>
            </div>
            <ProgBar val={p} color={cc} bg={cc+'25'} />
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:12}}>
              <span style={{fontSize:11,color:cc}}>{all.filter(t=>t.done).length}/{all.length} done{co.examDate?` · ${daysUntil(co.examDate)}d left`:''}</span>
              <div style={{display:'flex',gap:8}}>
                <button className="press hov" onClick={()=>setEditing(co.id)}
                  style={{fontSize:11,padding:'4px 12px',borderRadius:20,border:'none',background:cc+'30',color:ccL,cursor:'pointer'}}>✏️ Edit</button>
                <button className="press hov" onClick={()=>deleteCourse(co.id)}
                  style={{fontSize:11,padding:'4px 12px',borderRadius:20,border:'none',background:c.red+'22',color:c.red,cursor:'pointer'}}>🗑</button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─── EDIT COURSE (with Units) ─── */
function EditCourse({c,s,course,setCourses,onBack}) {
  const [name,setName]         = useState(course.name);
  const [icon,setIcon]         = useState(course.icon);
  const [color,setColor]       = useState(course.color);
  const [examDate,setExamDate] = useState(course.examDate||'');
  const [hours,setHours]       = useState(course.hoursPerDay||1.5);
  const [units,setUnits]       = useState((course.units||[]).map(u=>({...u,topics:[...(u.topics||[])]})));
  const [newUnit,setNewUnit]   = useState('');
  const [newTopics,setNewTopics] = useState({});

  const addUnit=()=>{
    const v=newUnit.trim(); if(!v) return;
    setUnits(p=>[...p,{id:Date.now(),name:v,topics:[]}]);
    setNewUnit('');
  };
  const addTopic=(uid)=>{
    const v=(newTopics[uid]||'').trim(); if(!v) return;
    setUnits(p=>p.map(u=>u.id===uid?{...u,topics:[...u.topics,{id:Date.now(),name:v,done:false,confidence:0}]}:u));
    setNewTopics(p=>({...p,[uid]:''}));
  };
  const removeUnit=uid=>setUnits(p=>p.filter(u=>u.id!==uid));
  const removeTopic=(uid,tid)=>setUnits(p=>p.map(u=>u.id===uid?{...u,topics:(u.topics||[]).filter(t=>t.id!==tid)}:u));

  const handleSave=()=>{
    if(!name.trim()) return alert('Please enter a course name.');
    setCourses(p=>p.map(co=>co.id===course.id?{...co,name:name.trim(),icon,color,examDate,hoursPerDay:Number(hours),units}:co));
    onBack();
  };

  return (
    <div className="screen">
      <button className="press" onClick={onBack} style={s.backBtn}>← Back</button>
      <h1 style={{...s.display,fontSize:20,margin:'14px 0 20px'}}>Edit Course</h1>

      <div style={{...s.card,marginBottom:14}}>
        <label style={s.label}>Course name</label>
        <input style={s.input} value={name} onChange={e=>setName(e.target.value)} />
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
          <div><label style={s.label}>Exam date</label><input type="date" style={s.input} value={examDate} onChange={e=>setExamDate(e.target.value)} /></div>
          <div><label style={s.label}>Hrs/day</label><input type="number" style={s.input} min="0.5" max="12" step="0.5" value={hours} onChange={e=>setHours(e.target.value)} /></div>
        </div>
        <label style={s.label}>Icon</label>
        <div style={{display:'flex',flexWrap:'wrap',gap:8,marginBottom:14}}>
          {ICONS.map(ic=><button key={ic} className="press" onClick={()=>setIcon(ic)}
            style={{width:38,height:38,borderRadius:10,fontSize:18,cursor:'pointer',border:icon===ic?`2px solid ${c.teal}`:`1px solid ${c.border}`,background:icon===ic?c.tealD:c.card2}}>{ic}</button>)}
        </div>
        <label style={s.label}>Color</label>
        <div style={{display:'flex',gap:10}}>
          {COLOR_KEYS.map(col=><button key={col} className="press" onClick={()=>setColor(col)}
            style={{width:28,height:28,borderRadius:'50%',background:c[col],cursor:'pointer',border:color===col?`3px solid ${c.text}`:'3px solid transparent'}} />)}
        </div>
      </div>

      {/* UNITS EDITOR */}
      <div style={{...s.card,marginBottom:14}}>
        <div style={{fontSize:14,fontWeight:500,color:c.text,marginBottom:14}}>Units & Topics</div>
        {units.map((u,ui)=>(
          <div key={u.id} style={{background:c.card2,borderRadius:12,padding:'12px',marginBottom:10}}>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
              <div style={{width:24,height:24,borderRadius:8,background:c[color],color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,flexShrink:0,fontWeight:700}}>{ui+1}</div>
              <input style={{...s.input,marginBottom:0,flex:1,fontSize:13}} value={u.name}
                onChange={e=>setUnits(p=>p.map(x=>x.id===u.id?{...x,name:e.target.value}:x))} placeholder="Unit name" />
              <button className="press" onClick={()=>removeUnit(u.id)}
                style={{background:'none',border:'none',color:c.red,cursor:'pointer',fontSize:16}}>✕</button>
            </div>
            {(u.topics||[]).map(t=>(
              <div key={t.id} style={{display:'flex',alignItems:'center',gap:8,padding:'6px 0 6px 32px',borderBottom:`1px solid ${c.border}`}}>
                <span style={{fontSize:12,color:c.text,flex:1}}>• {t.name}</span>
                <button onClick={()=>removeTopic(u.id,t.id)}
                  style={{background:'none',border:'none',color:c.muted,cursor:'pointer',fontSize:13}}>✕</button>
              </div>
            ))}
            <div style={{display:'flex',gap:6,marginTop:8,paddingLeft:32}}>
              <input style={{...s.input,marginBottom:0,flex:1,fontSize:12}} placeholder="Add topic..."
                value={newTopics[u.id]||''} onChange={e=>setNewTopics(p=>({...p,[u.id]:e.target.value}))}
                onKeyDown={e=>e.key==='Enter'&&addTopic(u.id)} />
              <button className="press hov" onClick={()=>addTopic(u.id)}
                style={{background:c.teal,color:'#fff',border:'none',borderRadius:8,padding:'0 12px',cursor:'pointer',fontSize:16}}>＋</button>
            </div>
          </div>
        ))}
        <div style={{display:'flex',gap:8,marginTop:8}}>
          <input style={{...s.input,marginBottom:0,flex:1,fontSize:13}} placeholder="Add a new unit..." value={newUnit}
            onChange={e=>setNewUnit(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addUnit()} />
          <button className="press hov" onClick={addUnit}
            style={{background:c.teal,color:'#fff',border:'none',borderRadius:10,padding:'0 16px',cursor:'pointer',fontSize:18,flexShrink:0}}>＋</button>
        </div>
      </div>

      <button className="press hov" onClick={handleSave} style={{...s.btnPrimary(c.teal),marginBottom:30}}>✓ Save changes</button>
    </div>
  );
}

/* ═══════════════════════════════════════════
   FOCUS TAB — Pomodoro + Session Logger
═══════════════════════════════════════════ */
function FocusTab({c,s,courses,sessions,setSessions,gToken,setGToken,setGUser}) {
  const [running,setRunning]   = useState(false);
  const [secs,setSecs]         = useState(25*60);
  const [mode,setMode]         = useState('focus');
  const [pomos,setPomos]       = useState(0);
  const [picked,setPicked]     = useState(courses[0]?.id||'');
  const [pickedUnit,setPickedUnit] = useState('');
  const [ambience,setAmbience] = useState('🔕 Silent');
  const [hrs,setHrs]           = useState(1);
  const [sessDate,setSessDate] = useState(()=>{const d=new Date();d.setMinutes(0,0,0);return d.toISOString().slice(0,16);});
  const [syncStatus,setSyncStatus] = useState('idle');
  const ref=useRef(null);
  const TOTAL=mode==='focus'?25*60:5*60;

  const pickedCourse=courses.find(co=>co.id===Number(picked)||co.id===picked);

  useEffect(()=>{
    if(running){
      ref.current=setInterval(()=>setSecs(s=>{
        if(s<=1){clearInterval(ref.current);setRunning(false);
          if(mode==='focus'){setPomos(n=>n+1);setMode('break');setSecs(5*60);}
          else{setMode('focus');setSecs(25*60);}return 0;}
        return s-1;
      }),1000);
    } else clearInterval(ref.current);
    return ()=>clearInterval(ref.current);
  },[running,mode]);

  const fmt=s=>`${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
  const prog=((TOTAL-secs)/TOTAL)*100;
  const R=80,circ=2*Math.PI*R;
  const cc=mode==='focus'?c.teal:c.sage;

  const logSession=async()=>{
    const co=pickedCourse;
    if(!co) return alert('Please select a course.');
    const newSess={id:Date.now(),course:co.name,unit:pickedUnit,topic:'',date:today(),time:new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}),hours:Number(hrs)};
    setSessions(p=>[...p,newSess]);
    if(gToken){
      setSyncStatus('syncing');
      try{
        await pushToCalendar(gToken,`Study: ${co.name}${pickedUnit?' — '+pickedUnit:''}`,`StudyOS session · ${hrs}h`,sessDate,Math.round(Number(hrs)*60));
        setSyncStatus('done');
      }catch{setSyncStatus('error');}
      setTimeout(()=>setSyncStatus('idle'),3000);
    }
    alert(`✅ Session logged! ${hrs}h for ${co.name}`);
  };

  const login=useGoogleLogin({
    onSuccess:async t=>{setGToken(t.access_token);try{const r=await fetch('https://www.googleapis.com/oauth2/v3/userinfo',{headers:{Authorization:`Bearer ${t.access_token}`}});setGUser(await r.json());}catch{}},
    onError:()=>alert('Login failed'),
    scope:'https://www.googleapis.com/auth/calendar.events',
  });

  return (
    <div className="screen" style={{textAlign:'center'}}>
      <h1 style={{...s.display,fontSize:22,textAlign:'left',marginBottom:4}}>Focus Mode</h1>
      <p style={{fontSize:13,color:c.muted,textAlign:'left',marginBottom:22}}>Deep work. One session at a time.</p>

      <div style={{display:'flex',gap:8,justifyContent:'center',marginBottom:24}}>
        {[['focus','🎯 Focus'],['break','☕ Break']].map(([m,label])=>(
          <button key={m} className="press" onClick={()=>{setMode(m);setRunning(false);setSecs(m==='focus'?25*60:5*60);}}
            style={{padding:'9px 22px',borderRadius:22,border:'none',cursor:'pointer',background:mode===m?cc:c.card2,color:mode===m?'#fff':c.muted,fontSize:13,fontFamily:"'DM Sans',sans-serif"}}>
            {label}
          </button>
        ))}
      </div>

      <div style={{position:'relative',display:'inline-flex',alignItems:'center',justifyContent:'center',marginBottom:20}}>
        <svg width="200" height="200" viewBox="0 0 200 200" style={{transform:'rotate(-90deg)'}}>
          <circle cx="100" cy="100" r={R} fill="none" stroke={c.border} strokeWidth="12" />
          <circle cx="100" cy="100" r={R} fill="none" stroke={cc} strokeWidth="12"
            strokeDasharray={circ} strokeDashoffset={circ-(circ*prog/100)}
            strokeLinecap="round" style={{transition:'stroke-dashoffset 0.6s ease'}} />
        </svg>
        <div style={{position:'absolute',textAlign:'center'}}>
          <div style={{fontSize:38,fontWeight:700,color:c.text,fontFamily:"'Playfair Display',serif",lineHeight:1}}>{fmt(secs)}</div>
          <div style={{fontSize:12,color:c.muted,marginTop:4}}>{mode==='focus'?'🎯 Focus':'☕ Break'}</div>
        </div>
      </div>

      <div style={{display:'flex',gap:12,justifyContent:'center',marginBottom:16}}>
        <button className="press hov" onClick={()=>setRunning(!running)}
          style={{background:cc,color:'#fff',border:'none',borderRadius:14,padding:'14px 40px',fontSize:16,cursor:'pointer',fontFamily:"'Playfair Display',serif"}}>
          {running?'⏸ Pause':'▶ Start'}
        </button>
        <button className="press" onClick={()=>{setRunning(false);setSecs(mode==='focus'?25*60:5*60);}}
          style={{background:c.card2,color:c.muted,border:'none',borderRadius:14,padding:'14px 18px',fontSize:20,cursor:'pointer'}}>↺</button>
      </div>

      <div style={{display:'flex',justifyContent:'center',gap:8,marginBottom:20}}>
        {Array.from({length:4},(_,i)=><div key={i} style={{width:12,height:12,borderRadius:'50%',background:i<pomos%4?cc:c.border}} />)}
      </div>

      {/* SESSION LOGGER */}
      <div style={{...s.card,textAlign:'left',marginBottom:12}}>
        <Label text="Log a study session" />
        <label style={s.label}>Course</label>
        <select style={{...s.input,marginBottom:10}} value={picked} onChange={e=>{setPicked(e.target.value);setPickedUnit('');}}>
          <option value="">Select course...</option>
          {courses.map(co=><option key={co.id} value={co.id}>{co.icon} {co.name}</option>)}
        </select>
        {pickedCourse?.units?.length>0&&(
          <>
            <label style={s.label}>Unit (optional)</label>
            <select style={{...s.input,marginBottom:10}} value={pickedUnit} onChange={e=>setPickedUnit(e.target.value)}>
              <option value="">All units</option>
              {pickedCourse.units.map(u=><option key={u.id} value={u.name}>{u.name}</option>)}
            </select>
          </>
        )}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
          <div>
            <label style={s.label}>Hours studied</label>
            <input type="number" style={s.input} min="0.25" max="12" step="0.25" value={hrs} onChange={e=>setHrs(e.target.value)} />
          </div>
          <div>
            <label style={s.label}>Date & time</label>
            <input type="datetime-local" style={s.input} value={sessDate} onChange={e=>setSessDate(e.target.value)} />
          </div>
        </div>
        <button className="press hov" onClick={logSession}
          style={{...s.btnPrimary(c.teal),marginTop:4}}>
          {syncStatus==='syncing'?'⏳ Logging...':syncStatus==='done'?'✓ Logged & Synced!':syncStatus==='error'?'⚠ Logged (sync failed)':'✓ Log Session'}
        </button>
        {!gToken&&(
          <button className="press hov" onClick={()=>login()}
            style={{...s.btnPrimary(c.blue),marginTop:8,background:c.blueD,color:c.blueL,fontSize:13}}>
            📅 Connect Calendar to also sync
          </button>
        )}
      </div>

      {/* AMBIENCE */}
      <div style={{...s.card,textAlign:'left'}}>
        <Label text="Ambience" />
        <div style={{display:'flex',flexWrap:'wrap',gap:8,marginTop:10}}>
          {['🔕 Silent','🌊 Ocean','🌿 Forest','🌧️ Rain','☕ Café','🐠 Deep Sea'].map(a=>(
            <button key={a} className="press" onClick={()=>setAmbience(a)}
              style={{padding:'7px 14px',borderRadius:20,border:'none',cursor:'pointer',background:ambience===a?c.teal:c.card2,color:ambience===a?'#fff':c.muted,fontSize:12,fontFamily:"'DM Sans',sans-serif"}}>
              {a}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   AI TAB — Gemini Tutor + Outline Parser
═══════════════════════════════════════════ */
function AITab({c,s,courses,setCourses,setCards}) {
  const [mode,setMode]         = useState('tutor'); // tutor | parse
  const [messages,setMessages] = useState([{role:'ai',text:'Hello! I\'m your AI study tutor powered by Gemini. Ask me anything — explain a concept, quiz me, help with a topic from your courses. How can I help? 🌊'}]);
  const [input,setInput]       = useState('');
  const [thinking,setThinking] = useState(false);
  const [outline,setOutline]   = useState('');
  const [courseName,setCourseName] = useState('');
  const [parsing,setParsing]   = useState(false);
  const [parsed,setParsed]     = useState(null);
  const bottomRef=useRef(null);

  useEffect(()=>bottomRef.current?.scrollIntoView({behavior:'smooth'}),[messages]);

  const sendMessage=async()=>{
    if(!input.trim()||thinking) return;
    const userMsg={role:'user',text:input.trim()};
    setMessages(p=>[...p,userMsg]);
    setInput('');
    setThinking(true);
    try{
      const context=courses.length>0?`The student is studying: ${courses.map(co=>`${co.name} (units: ${(co.units||[]).map(u=>u.name).join(', ')})`).join('; ')}. `:'`';
      const prompt=`You are a helpful, encouraging study tutor. ${context}Student asks: ${userMsg.text}\n\nRespond concisely and helpfully. Use simple language. If relevant, give an example. Keep response under 200 words.`;
      const reply=await askGemini(prompt);
      setMessages(p=>[...p,{role:'ai',text:reply}]);
    }catch{setMessages(p=>[...p,{role:'ai',text:'Sorry, I had trouble connecting. Please try again!'}]);}
    setThinking(false);
  };

  const parseWithAI=async()=>{
    if(!outline.trim()) return alert('Please paste your syllabus first.');
    if(!courseName.trim()) return alert('Please enter a course name.');
    setParsing(true);
    try{
      const prompt=`Parse this course syllabus into a structured JSON format. Course name: "${courseName}".
      
Syllabus text:
${outline}

Return ONLY valid JSON in this exact format (no markdown, no backticks):
{
  "units": [
    {
      "name": "Unit name here",
      "topics": ["Topic 1", "Topic 2", "Topic 3"]
    }
  ]
}

Group related topics into logical units. If the syllabus already has units/chapters, use those. Create at least 2-3 units.`;
      const reply=await askGemini(prompt);
      const clean=reply.replace(/```json|```/g,'').trim();
      const data=JSON.parse(clean);
      setParsed(data);
    }catch(e){alert('AI parsing failed. Please check your syllabus text and try again.');}
    setParsing(false);
  };

  const saveCourse=()=>{
    if(!parsed||!courseName.trim()) return;
    const newCourse={
      id:Date.now(), name:courseName.trim(), icon:'📚', color:COLOR_KEYS[courses.length%COLOR_KEYS.length],
      examDate:'', hoursPerDay:1.5,
      units:(parsed.units||[]).map((u,i)=>({
        id:Date.now()+i+1, name:u.name,
        topics:(u.topics||[]).map((t,j)=>({id:Date.now()+i*100+j+1,name:t,done:false,confidence:0}))
      }))
    };
    const allTopics=(parsed.units||[]).flatMap(u=>(u.topics||[]));
    const starterCards=allTopics.slice(0,5).map((t,i)=>({
      id:Date.now()+i+1000, front:`Key concept: ${t}`,
      back:`Study this topic carefully. Edit with your own notes!`,
      course:courseName.trim(), known:false,
    }));
    setCourses(p=>[...p,newCourse]);
    setCards(p=>[...p,...starterCards]);
    setParsed(null); setOutline(''); setCourseName('');
    alert(`✅ Course "${courseName}" created with ${parsed.units.length} units and ${allTopics.length} topics!`);
  };

  return (
    <div className="screen">
      <h1 style={{...s.display,fontSize:22,marginBottom:4}}>AI Assistant 🤖</h1>
      <p style={{fontSize:13,color:c.muted,marginBottom:16}}>Powered by Google Gemini · Free</p>

      <div style={{display:'flex',gap:8,marginBottom:20}}>
        {[['tutor','💬 AI Tutor'],['parse','📄 Parse Syllabus']].map(([m,label])=>(
          <button key={m} className="press" onClick={()=>setMode(m)}
            style={{padding:'9px 18px',borderRadius:22,border:'none',cursor:'pointer',background:mode===m?c.teal:c.card2,color:mode===m?'#fff':c.muted,fontSize:13,fontFamily:"'DM Sans',sans-serif"}}>
            {label}
          </button>
        ))}
      </div>

      {mode==='tutor'&&(
        <>
          {/* CHAT */}
          <div style={{...s.card,marginBottom:12,minHeight:320,maxHeight:420,overflowY:'auto',display:'flex',flexDirection:'column',gap:10,padding:'14px'}}>
            {messages.map((m,i)=>(
              <div key={i} style={{display:'flex',justifyContent:m.role==='user'?'flex-end':'flex-start'}}>
                <div style={{maxWidth:'85%',padding:'10px 14px',borderRadius:m.role==='user'?'16px 16px 4px 16px':'16px 16px 16px 4px',background:m.role==='user'?c.teal:c.card2,color:m.role==='user'?'#fff':c.text,fontSize:13,lineHeight:1.6}}>
                  {m.text}
                </div>
              </div>
            ))}
            {thinking&&(
              <div style={{display:'flex',justifyContent:'flex-start'}}>
                <div className="thinking" style={{padding:'10px 14px',borderRadius:'16px 16px 16px 4px',background:c.card2,color:c.muted,fontSize:13}}>
                  🤔 Thinking...
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* QUICK PROMPTS */}
          <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:10}}>
            {['Explain this simply','Give me a quiz','What should I focus on?','Help me remember this'].map(q=>(
              <button key={q} className="press" onClick={()=>setInput(q)}
                style={{padding:'6px 12px',borderRadius:20,border:`1px solid ${c.border}`,background:'transparent',color:c.muted,fontSize:11,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>
                {q}
              </button>
            ))}
          </div>

          <div style={{display:'flex',gap:8}}>
            <input style={{...s.input,marginBottom:0,flex:1}} placeholder="Ask anything..." value={input}
              onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&sendMessage()} />
            <button className="press hov" onClick={sendMessage} disabled={thinking}
              style={{background:c.teal,color:'#fff',border:'none',borderRadius:10,padding:'0 18px',cursor:'pointer',fontSize:18,flexShrink:0,opacity:thinking?0.6:1}}>➤</button>
          </div>
        </>
      )}

      {mode==='parse'&&(
        <>
          <div style={{...s.card,marginBottom:14}}>
            <div style={{fontSize:14,fontWeight:500,color:c.text,marginBottom:14}}>AI Syllabus Parser</div>
            <p style={{fontSize:13,color:c.muted,marginBottom:14,lineHeight:1.6}}>
              Paste your course syllabus below. Gemini AI will automatically detect units and topics and create your course structure.
            </p>
            <label style={s.label}>Course name</label>
            <input style={s.input} placeholder="e.g. CPA — Financial Accounting" value={courseName} onChange={e=>setCourseName(e.target.value)} />
            <label style={s.label}>Paste your syllabus</label>
            <textarea style={{...s.input,height:160,resize:'vertical',fontSize:13}}
              placeholder={"Paste your syllabus, table of contents, or topic list here...\n\nExample:\nUnit 1: Financial Statements\n- Income Statement\n- Balance Sheet\nUnit 2: Revenue Recognition\n- ASC 606\n- Performance Obligations"}
              value={outline} onChange={e=>setOutline(e.target.value)} />
            <button className="press hov" onClick={parseWithAI} disabled={parsing}
              style={{...s.btnPrimary(parsing?c.muted:c.teal),opacity:parsing?0.7:1}}>
              {parsing?'🤖 AI is reading your syllabus...':'✨ Parse with Gemini AI'}
            </button>
          </div>

          {parsed&&(
            <div style={{...s.card,border:`1px solid ${c.teal}44`,marginBottom:14}}>
              <div style={{fontSize:14,fontWeight:500,color:c.tealL,marginBottom:4}}>✨ AI detected {(parsed.units||[]).length} units</div>
              <div style={{fontSize:11,color:c.teal,marginBottom:14}}>{(parsed.units||[]).flatMap(u=>(u.topics||[])).length} topics total</div>
              {(parsed.units||[]).map((u,i)=>(
                <div key={i} style={{marginBottom:12}}>
                  <div style={{fontSize:13,fontWeight:500,color:c.text,marginBottom:6}}>📂 {u.name}</div>
                  {(u.topics||[]).map((t,j)=>(
                    <div key={j} style={{fontSize:12,color:c.muted,padding:'4px 0 4px 16px',borderBottom:`1px solid ${c.border}`}}>• {t}</div>
                  ))}
                </div>
              ))}
              <button className="press hov" onClick={saveCourse} style={{...s.btnPrimary(c.sage),marginTop:8}}>
                ✅ Create this course
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════
   CARDS TAB
═══════════════════════════════════════════ */
function CardsTab({c,s,cards,setCards,courses}) {
  const [flipped,setFlipped]=useState(false);
  const [idx,setIdx]=useState(0);
  const [filter,setFilter]=useState('all');
  const [adding,setAdding]=useState(false);
  const [form,setForm]=useState({front:'',back:'',course:''});

  const deck=filter==='all'?cards:filter==='learn'?cards.filter(f=>!f.known):cards.filter(f=>f.known);
  const card=deck[idx]||null;
  const known=cards.filter(f=>f.known).length;

  const next=(mk)=>{
    if(mk!==undefined&&card) setCards(p=>p.map(f=>f.id===card.id?{...f,known:mk}:f));
    setFlipped(false);
    setTimeout(()=>setIdx(i=>deck.length>1?(i+1)%deck.length:0),150);
  };

  const addCard=()=>{
    if(!form.front.trim()||!form.back.trim()) return alert('Fill in both sides.');
    setCards(p=>[...p,{id:Date.now(),front:form.front.trim(),back:form.back.trim(),course:form.course||'General',known:false}]);
    setForm({front:'',back:'',course:''});setAdding(false);
  };

  return (
    <div className="screen">
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4}}>
        <h1 style={{...s.display,fontSize:22}}>Flashcards</h1>
        <button className="press hov" onClick={()=>setAdding(!adding)}
          style={{background:adding?c.card2:c.teal,color:adding?c.muted:'#fff',border:'none',borderRadius:10,padding:'8px 14px',fontSize:13,cursor:'pointer'}}>
          {adding?'✕':'＋ New'}
        </button>
      </div>
      <p style={{fontSize:13,color:c.muted,marginBottom:16}}>{known}/{cards.length} mastered</p>

      {adding&&(
        <div style={{...s.card,marginBottom:16,border:`1px solid ${c.teal}44`}}>
          <label style={s.label}>Question</label>
          <input style={s.input} placeholder="Front of card..." value={form.front} onChange={e=>setForm({...form,front:e.target.value})} />
          <label style={s.label}>Answer</label>
          <textarea style={{...s.input,height:80,resize:'vertical'}} placeholder="Back of card..." value={form.back} onChange={e=>setForm({...form,back:e.target.value})} />
          <label style={s.label}>Course</label>
          <select style={{...s.input,marginBottom:14}} value={form.course} onChange={e=>setForm({...form,course:e.target.value})}>
            <option value="">General</option>
            {courses.map(co=><option key={co.id} value={co.name}>{co.icon} {co.name}</option>)}
          </select>
          <button className="press hov" onClick={addCard} style={s.btnPrimary(c.teal)}>Save card</button>
        </div>
      )}

      <div style={{display:'flex',gap:8,marginBottom:14}}>
        {[['all',`All (${cards.length})`],['learn',`Learning (${cards.filter(f=>!f.known).length})`],['known',`Known (${known})`]].map(([f,label])=>(
          <button key={f} className="press" onClick={()=>{setFilter(f);setIdx(0);setFlipped(false);}}
            style={{padding:'7px 12px',borderRadius:20,border:'none',cursor:'pointer',background:filter===f?c.teal:c.card2,color:filter===f?'#fff':c.muted,fontSize:12}}>
            {label}
          </button>
        ))}
      </div>

      {cards.length>0&&<ProgBar val={cards.length>0?Math.round(known/cards.length*100):0} color={c.sage} bg={c.border} />}

      {cards.length===0&&!adding&&(
        <div style={{...s.card,textAlign:'center',padding:'50px 24px',marginTop:16,border:`2px dashed ${c.border}`}}>
          <div style={{fontSize:48,marginBottom:14}}>🃏</div>
          <div style={{fontSize:15,color:c.text,marginBottom:6}}>No flashcards yet</div>
          <div style={{fontSize:13,color:c.muted}}>Tap ＋ New to add your first card</div>
        </div>
      )}

      {card&&(
        <>
          <div onClick={()=>setFlipped(!flipped)}
            style={{...s.card,minHeight:190,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',cursor:'pointer',textAlign:'center',margin:'16px 0 10px',background:flipped?c.tealD:c.card,border:`1px solid ${flipped?c.teal:c.border}`,transition:'all 0.2s',padding:'32px 24px'}}>
            <div style={{fontSize:10,color:c.muted,marginBottom:12,textTransform:'uppercase',letterSpacing:1.2}}>
              {flipped?'✦ Answer':'? Question'}{card.course?` · ${card.course}`:''}
            </div>
            <div style={{fontSize:16,color:flipped?c.tealL:c.text,lineHeight:1.65}}>{flipped?card.back:card.front}</div>
            {!flipped&&<div style={{fontSize:11,color:c.muted,marginTop:18}}>Tap to reveal</div>}
          </div>
          <div style={{textAlign:'center',fontSize:12,color:c.muted,marginBottom:14}}>{idx+1} of {deck.length}</div>
          {flipped?(
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:20}}>
              <button className="press" onClick={()=>next(false)}
                style={{background:c.redD,border:'none',borderRadius:14,padding:'14px',fontSize:14,color:c.red,cursor:'pointer'}}>✗ Still learning</button>
              <button className="press" onClick={()=>next(true)}
                style={{background:c.sageD,border:'none',borderRadius:14,padding:'14px',fontSize:14,color:c.sage,cursor:'pointer'}}>✓ Got it!</button>
            </div>
          ):(
            <button className="press" onClick={()=>next()}
              style={{width:'100%',background:c.card2,border:'none',borderRadius:14,padding:'14px',fontSize:14,color:c.muted,cursor:'pointer',marginBottom:20}}>
              Skip →
            </button>
          )}
        </>
      )}

      {deck.length===0&&cards.length>0&&(
        <div style={{textAlign:'center',padding:'40px 20px'}}>
          <div style={{fontSize:40,marginBottom:12}}>🎉</div>
          <div style={{fontSize:15,color:c.text,marginBottom:6}}>All done!</div>
        </div>
      )}

      {cards.length>0&&(
        <>
          <Label text={`All cards (${cards.length})`} />
          <div style={{marginTop:10,marginBottom:30}}>
            {cards.map(f=>(
              <div key={f.id} style={{...s.card,marginBottom:8,display:'flex',alignItems:'center',gap:12}}>
                <div style={{width:10,height:10,borderRadius:'50%',background:f.known?c.sage:c.muted,flexShrink:0}} />
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:13,color:c.text,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{f.front}</div>
                  {f.course&&<div style={{fontSize:11,color:c.muted,marginTop:2}}>{f.course}</div>}
                </div>
                <div style={{display:'flex',gap:6,alignItems:'center',flexShrink:0}}>
                  <span style={{fontSize:11,padding:'3px 10px',borderRadius:20,background:f.known?c.sage+'22':c.card2,color:f.known?c.sage:c.muted}}>{f.known?'Known':'Learning'}</span>
                  <button className="press" onClick={()=>setCards(p=>p.filter(x=>x.id!==f.id))}
                    style={{background:'none',border:'none',color:c.red,cursor:'pointer',fontSize:14}}>✕</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════
   ANALYTICS TAB
═══════════════════════════════════════════ */
function AnalyticsTab({c,s,courses,sessions,doneTopics,allTopics}) {
  const pct=allTopics.length>0?Math.round(doneTopics/allTopics.length*100):0;
  const sorted=[...courses].filter(co=>co.examDate).sort((a,b)=>daysUntil(a.examDate)-daysUntil(b.examDate));

  /* Last 7 days bar chart */
  const last7=Array.from({length:7},(_,i)=>{
    const d=new Date(); d.setDate(d.getDate()-(6-i));
    const key=d.toISOString().slice(0,10);
    const label=['S','M','T','W','T','F','S'][d.getDay()];
    const hrs=sessions.filter(s=>s.date===key).reduce((a,s)=>a+s.hours,0);
    return {key,label,hrs};
  });
  const maxHrs=Math.max(...last7.map(d=>d.hrs),1);
  const totalHrsWeek=last7.reduce((a,d)=>a+d.hrs,0);

  if(courses.length===0) return (
    <div className="screen">
      <h1 style={{...s.display,fontSize:22,marginBottom:20}}>Analytics</h1>
      <div style={{...s.card,textAlign:'center',padding:'50px 24px',border:`2px dashed ${c.border}`}}>
        <div style={{fontSize:48,marginBottom:14}}>📊</div>
        <div style={{fontSize:15,color:c.text,marginBottom:6}}>No data yet</div>
        <div style={{fontSize:13,color:c.muted}}>Add courses and log study sessions to see analytics.</div>
      </div>
    </div>
  );

  return (
    <div className="screen">
      <h1 style={{...s.display,fontSize:22,marginBottom:20}}>Analytics</h1>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:20}}>
        <Stat label="Overall progress" val={pct+'%'}          color={c.teal} />
        <Stat label="Topics done"      val={`${doneTopics}/${allTopics.length}`} color={c.sage} />
        <Stat label="This week"        val={totalHrsWeek.toFixed(1)+'h'} color={c.amber} />
        <Stat label="Nearest exam"     val={sorted.length>0?daysUntil(sorted[0].examDate)+'d':'—'} color={c.coral} />
      </div>

      {/* HOURS BAR CHART */}
      <div style={{...s.card,marginBottom:16}}>
        <div style={{fontSize:14,fontWeight:500,color:c.text,marginBottom:4}}>Hours studied — last 7 days</div>
        <div style={{fontSize:11,color:c.muted,marginBottom:16}}>{totalHrsWeek.toFixed(1)}h this week</div>
        <div style={{display:'flex',alignItems:'flex-end',gap:6,height:100}}>
          {last7.map(({label,hrs})=>{
            const h=Math.round((hrs/maxHrs)*80);
            return (
              <div key={label} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:4}}>
                <div style={{fontSize:9,color:c.muted,height:14}}>{hrs>0?hrs.toFixed(1):''}</div>
                <div style={{width:'75%',height:h||3,background:hrs>0?c.teal:c.border,borderRadius:'3px 3px 0 0',transition:'height 0.5s'}} />
                <div style={{fontSize:10,color:c.muted}}>{label}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* COURSE PROGRESS */}
      <div style={{...s.card,marginBottom:16}}>
        <div style={{fontSize:14,fontWeight:500,color:c.text,marginBottom:16}}>Course progress</div>
        {courses.map(co=>{
          const all=(co.units||[]).flatMap(u=>(u.topics||[]));
          return (
            <div key={co.id} style={{marginBottom:16}}>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}>
                <span style={{fontSize:13,color:c.text}}>{co.icon} {co.name}</span>
                <span style={{fontSize:13,fontWeight:500,color:c[co.color]}}>{coursePct(co)}%</span>
              </div>
              <ProgBar val={coursePct(co)} color={c[co.color]} bg={c.border} />
              <div style={{fontSize:11,color:c.muted,marginTop:5}}>
                {all.filter(t=>t.done).length}/{all.length} topics · {(co.units||[]).length} units{co.examDate?` · ${daysUntil(co.examDate)} days to exam`:''}
              </div>
              {(co.units||[]).map(u=>(
                <div key={u.id} style={{marginTop:8,paddingLeft:12}}>
                  <div style={{display:'flex',justifyContent:'space-between',fontSize:11,marginBottom:4}}>
                    <span style={{color:c.muted}}>📂 {u.name}</span>
                    <span style={{color:c[co.color]}}>{unitPct(u)}%</span>
                  </div>
                  <ProgBar val={unitPct(u)} color={c[co.color]+'99'} bg={c.border} />
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {/* EXAM COUNTDOWNS */}
      {sorted.length>0&&(
        <div style={{...s.card,marginBottom:16}}>
          <div style={{fontSize:14,fontWeight:500,color:c.text,marginBottom:16}}>Exam countdowns</div>
          {sorted.map(co=>{
            const days=daysUntil(co.examDate);
            const col=days<30?c.red:days<60?c.coral:c.sage;
            return (
              <div key={co.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 0',borderBottom:`1px solid ${c.border}`}}>
                <div>
                  <div style={{fontSize:13,color:c.text}}>{co.icon} {co.name}</div>
                  <div style={{fontSize:11,color:c.muted,marginTop:2}}>{new Date(co.examDate).toDateString()}</div>
                </div>
                <div style={{textAlign:'right'}}>
                  <div style={{fontSize:22,fontWeight:700,color:col,fontFamily:"'Playfair Display',serif",lineHeight:1}}>{days}</div>
                  <div style={{fontSize:10,color:c.muted}}>days left</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* WELLBEING */}
      <div style={{...s.card,background:c.sageD,border:'none',marginBottom:30}}>
        <div style={{fontSize:14,fontWeight:500,color:c.sageL,marginBottom:8}}>🌿 Wellbeing check</div>
        <div style={{fontSize:13,color:c.sage,lineHeight:1.65,marginBottom:14}}>Rest is part of learning. Sleep consolidates memory. How are you feeling?</div>
        <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
          {['Feeling great 😊','Need a break 😮‍💨','A bit stressed 😰','Exhausted 😴'].map(label=>(
            <button key={label} className="press" onClick={()=>alert(`Logged: "${label}" 💚`)}
              style={{padding:'7px 14px',borderRadius:20,border:'none',background:c.sage+'30',color:c.sage,fontSize:12,cursor:'pointer'}}>
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   ADD TAB
═══════════════════════════════════════════ */
function AddTab({c,s,courses,setCourses,setCards,setTab,gToken,setGToken,setGUser}) {
  const [name,setName]         = useState('');
  const [icon,setIcon]         = useState('📚');
  const [color,setColor]       = useState('teal');
  const [examDate,setExamDate] = useState('');
  const [hours,setHours]       = useState(1.5);
  const [outline,setOutline]   = useState('');
  const [saved,setSaved]       = useState(false);
  const [preview,setPreview]   = useState([]);

  const parse=text=>text.trim().split('\n')
    .map(l=>l.replace(/^[-•*\d.):\s]+/,'').trim()).filter(l=>l.length>2)
    .map((name,i)=>({id:i+1,name,done:false,confidence:0}));

  const handleOutline=val=>{setOutline(val);setPreview(parse(val));};

  const handleSave=()=>{
    if(!name.trim()) return alert('Please enter a course name.');
    const topics=preview.length>0?preview:[];
    const newCourse={
      id:Date.now(), name:name.trim(), icon, color, examDate, hoursPerDay:Number(hours),
      units:[{id:Date.now()+1, name:'Main Topics', topics:topics.map((t,i)=>({...t,id:Date.now()+i+10}))}]
    };
    setCourses(p=>[...p,newCourse]);
    if(topics.length>0){
      setCards(p=>[...p,...topics.slice(0,3).map((t,i)=>({id:Date.now()+i+500,front:`Key concept: ${t.name}`,back:'Edit with your own answer!',course:name.trim(),known:false}))]);
    }
    setSaved(true);
    setTimeout(()=>{setSaved(false);setTab('courses');},1000);
  };

  const dLeft=examDate?daysUntil(examDate):null;
  const tpd=dLeft&&preview.length&&dLeft>0?(preview.length/dLeft).toFixed(1):null;

  const login=useGoogleLogin({
    onSuccess:async t=>{setGToken(t.access_token);try{const r=await fetch('https://www.googleapis.com/oauth2/v3/userinfo',{headers:{Authorization:`Bearer ${t.access_token}`}});setGUser(await r.json());}catch{}},
    onError:()=>alert('Login failed'),
    scope:'https://www.googleapis.com/auth/calendar.events',
  });

  return (
    <div className="screen">
      <h1 style={{...s.display,fontSize:22,marginBottom:4}}>Add Course</h1>
      <p style={{fontSize:13,color:c.muted,marginBottom:16}}>Works for any subject. Or use the 🤖 AI tab to parse your syllabus automatically!</p>

      {!gToken&&(
        <button className="press hov" onClick={()=>login()}
          style={{...s.card,width:'100%',border:`1px solid ${c.teal}44`,display:'flex',alignItems:'center',gap:12,marginBottom:14,cursor:'pointer',background:c.tealD}}>
          <span style={{fontSize:20}}>📅</span>
          <span style={{fontSize:13,fontWeight:500,color:c.tealL,fontFamily:"'DM Sans',sans-serif"}}>Connect Google Calendar</span>
        </button>
      )}

      <div style={{...s.card,marginBottom:14}}>
        <label style={s.label}>Course name *</label>
        <input style={s.input} placeholder="e.g. CPA, ACCA, Python, Medicine..." value={name} onChange={e=>setName(e.target.value)} />
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
          <div><label style={s.label}>Exam date</label><input type="date" style={s.input} value={examDate} onChange={e=>setExamDate(e.target.value)} /></div>
          <div><label style={s.label}>Study hrs/day</label><input type="number" style={s.input} min="0.5" max="12" step="0.5" value={hours} onChange={e=>setHours(e.target.value)} /></div>
        </div>
        <label style={s.label}>Icon</label>
        <div style={{display:'flex',flexWrap:'wrap',gap:8,marginBottom:14}}>
          {ICONS.map(ic=><button key={ic} className="press" onClick={()=>setIcon(ic)}
            style={{width:38,height:38,borderRadius:10,fontSize:18,cursor:'pointer',border:icon===ic?`2px solid ${c.teal}`:`1px solid ${c.border}`,background:icon===ic?c.tealD:c.card2}}>{ic}</button>)}
        </div>
        <label style={s.label}>Color</label>
        <div style={{display:'flex',gap:10}}>
          {COLOR_KEYS.map(col=><button key={col} className="press" onClick={()=>setColor(col)}
            style={{width:28,height:28,borderRadius:'50%',background:c[col],cursor:'pointer',border:color===col?`3px solid ${c.text}`:'3px solid transparent'}} />)}
        </div>
      </div>

      <div style={{...s.card,marginBottom:14}}>
        <div style={{fontSize:14,fontWeight:500,color:c.text,marginBottom:8}}>Quick topic paste</div>
        <p style={{fontSize:12,color:c.muted,marginBottom:12}}>Or use 🤖 AI tab for smarter parsing with units auto-detected.</p>
        <label style={s.label}>Paste topics (one per line)</label>
        <textarea style={{...s.input,height:120,resize:'vertical',fontSize:13}}
          placeholder={"Topic 1\nTopic 2\nTopic 3"} value={outline} onChange={e=>handleOutline(e.target.value)} />
        {preview.length>0&&(
          <div style={{background:c.tealD,borderRadius:12,padding:'12px 14px'}}>
            <div style={{fontSize:13,color:c.tealL,marginBottom:8}}>✨ {preview.length} topics detected{tpd?` · ${tpd}/day needed`:''}</div>
            <div style={{maxHeight:100,overflowY:'auto'}}>
              {preview.map((t,i)=><div key={i} style={{fontSize:12,color:c.teal,padding:'3px 0',borderBottom:`1px solid ${c.teal}20`}}>{i+1}. {t.name}</div>)}
            </div>
          </div>
        )}
      </div>

      <button className="press hov" onClick={handleSave} style={{...s.btnPrimary(saved?c.sage:c.teal),marginBottom:30}}>
        {saved?'✓ Course created!':'＋ Create course'}
      </button>
    </div>
  );
}

/* ═══════════════════════════════════════════
   SHARED COMPONENTS
═══════════════════════════════════════════ */
function ProgBar({val,color,bg}){
  return <div style={{height:6,background:bg,borderRadius:3,overflow:'hidden'}}>
    <div style={{height:6,width:val+'%',background:color,borderRadius:3,transition:'width 0.5s ease'}} />
  </div>;
}
function Circle({done,color,onClick,size=18}){
  return <div onClick={onClick} style={{width:size,height:size,borderRadius:'50%',border:`1.5px solid ${color}`,background:done?color:'transparent',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',fontSize:size*0.6,color:'#fff',flexShrink:0,transition:'all 0.2s'}}>
    {done?'✓':''}
  </div>;
}
function Stat({label,val,color}){
  return <div style={{background:'#0C1A22',borderRadius:14,padding:'14px 12px'}}>
    <div style={{fontSize:11,color:'#4A7A7A',marginBottom:6}}>{label}</div>
    <div style={{fontSize:24,fontWeight:700,color,fontFamily:"'Playfair Display',serif"}}>{val}</div>
  </div>;
}
function Label({text}){
  return <div style={{fontSize:11,fontWeight:500,color:'#4A7A7A',textTransform:'uppercase',letterSpacing:'0.8px',marginBottom:10}}>{text}</div>;
}

/* ═══════════════════════════════════════════
   STYLES
═══════════════════════════════════════════ */
function mkStyles(c){
  return {
    app:      {minHeight:'100vh',background:c.bg,color:c.text,fontFamily:"'DM Sans',sans-serif",paddingBottom:88},
    nav:      {background:c.card,borderBottom:`1px solid ${c.border}`,padding:'14px 20px',display:'flex',alignItems:'center',justifyContent:'space-between',position:'sticky',top:0,zIndex:100},
    logo:     {fontFamily:"'Playfair Display',serif",fontSize:20,fontWeight:700,color:c.text},
    iconBtn:  {background:c.card2,border:'none',borderRadius:10,width:34,height:34,cursor:'pointer',fontSize:16},
    avatar:   {width:34,height:34,borderRadius:'50%',background:c.teal,color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:600},
    main:     {padding:'22px 20px 0',maxWidth:640,margin:'0 auto'},
    bottomNav:{position:'fixed',bottom:0,left:0,right:0,background:c.card,borderTop:`1px solid ${c.border}`,display:'flex',padding:'8px 2px 14px',zIndex:100},
    navBtn:   a=>({flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:2,background:'none',border:'none',cursor:'pointer',color:a?c.teal:c.muted,fontFamily:"'DM Sans',sans-serif",padding:'4px 1px'}),
    card:     {background:c.card,border:`1px solid ${c.border}`,borderRadius:16,padding:'16px 18px'},
    display:  {fontFamily:"'Playfair Display',serif",color:c.text},
    label:    {fontSize:12,color:c.muted,display:'block',marginBottom:6},
    input:    {width:'100%',background:c.bg,border:`1px solid ${c.border}`,borderRadius:10,padding:'11px 14px',color:c.text,fontSize:14,outline:'none',marginBottom:14,display:'block'},
    btnPrimary:bg=>({width:'100%',padding:'14px',borderRadius:14,border:'none',background:bg,color:'#fff',fontSize:15,fontFamily:"'Playfair Display',serif",cursor:'pointer',display:'block'}),
    backBtn:  {background:'none',border:'none',color:c.teal,cursor:'pointer',fontSize:14,fontFamily:"'DM Sans',sans-serif",padding:0},
  };
}