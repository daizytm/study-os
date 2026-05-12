import React, { useState, useEffect, useRef } from 'react';
import { GoogleOAuthProvider, useGoogleLogin } from '@react-oauth/google';

const GOOGLE_CLIENT_ID = '630089517286-lpgo4sq55e0nllut9940rm8jbauv07f9.apps.googleusercontent.com';
const GEMINI_API_KEY   = 'AIzaSyBS3quMmraHF9O7HENXnosehsaynSCJxuk';
const GEMINI_URL       = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

/* ─────────────────────────────────────────
   PALETTE  — Navy / Blue / Purple / Blush
───────────────────────────────────────── */
const DARK = {
  bg:'#0E0D1A', card:'#16152A', card2:'#1E1C35', border:'#2A2850',
  text:'#F0EEF8', muted:'#7A78A0', sub:'#9E9CC0',
  navy:'#413C69',   navyD:'#1A1830',   navyL:'#C8C5F0',
  blue:'#4A47A3',   blueD:'#1A1840',   blueL:'#C0BEFF',
  purple:'#AD62AA', purpleD:'#2D1530', purpleL:'#F0C8EE',
  pink:'#EAB9C9',   pinkD:'#30101C',   pinkL:'#FFE8F0',
  green:'#3DB87A',  greenD:'#082818',  greenL:'#C0F0D8',
  amber:'#D4A843',  amberD:'#302008',  amberL:'#FFF0C0',
  red:'#E05555',    redD:'#300808',    redL:'#FFD0D0',
  teal:'#3DBDB0',   tealD:'#082825',   tealL:'#C0F0EC',
  coral:'#E8714A',  coralD:'#301008',  coralL:'#FFD4C2',
  sage:'#5BAF82',   sageD:'#0A2818',   sageL:'#C8F0D8',
};
const LIGHT = {
  bg:'#F2F0FA', card:'#FFFFFF', card2:'#EAE8F8', border:'#D0CCF0',
  text:'#1A1830', muted:'#7070A0', sub:'#505080',
  navy:'#413C69',   navyD:'#E8E5FF',   navyL:'#1A1840',
  blue:'#4A47A3',   blueD:'#E0DEFF',   blueL:'#1A1840',
  purple:'#AD62AA', purpleD:'#F8E8F8',  purpleL:'#3D1540',
  pink:'#C4607A',   pinkD:'#FFE8F0',   pinkL:'#3D0820',
  green:'#2A9860',  greenD:'#D8F8E8',  greenL:'#083020',
  amber:'#B88A25',  amberD:'#FFF5D8',  amberL:'#302008',
  red:'#C03535',    redD:'#FFE0E0',    redL:'#280808',
  teal:'#0D9488',   tealD:'#D0F8F5',   tealL:'#042F2E',
  coral:'#C8501A',  coralD:'#FFE8D8',  coralL:'#301008',
  sage:'#3A9068',   sageD:'#D8F5E8',   sageL:'#082818',
};

const COLOR_KEYS = ['navy','blue','purple','pink','teal','sage','amber','coral'];
const ICONS = ['📚','🔬','📊','⚖️','💻','🧮','🏛️','🧪','🎯','📝','🩺','✏️','🌍','🎵','💡','🔧'];

const load = (k,f) => { try{const v=localStorage.getItem(k);return v?JSON.parse(v):f;}catch{return f;} };
const persist = (k,v) => { try{localStorage.setItem(k,JSON.stringify(v));}catch{} };
const daysUntil = d => Math.max(0,Math.ceil((new Date(d)-new Date())/86400000));
const todayStr = () => new Date().toISOString().slice(0,10);
const coursePct = co => {
  const all=co.units.flatMap(u=>u.topics);
  if(!all.length) return 0;
  return Math.round(all.filter(t=>t.done).length/all.length*100);
};
const unitPct = u => {
  if(!u.topics.length) return 0;
  return Math.round(u.topics.filter(t=>t.done).length/u.topics.length*100);
};

async function askGemini(prompt, fileData=null) {
  const parts = [{text: prompt}];
  if (fileData) parts.unshift({inline_data: fileData});
  const res = await fetch(GEMINI_URL, {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({contents:[{parts}]}),
  });
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

async function pushToCalendar(token, title, desc, dateStr, mins=60) {
  const start=new Date(dateStr), end=new Date(start.getTime()+mins*60000);
  const tz=Intl.DateTimeFormat().resolvedOptions().timeZone;
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

/* ═══════════════════════════════════════════ ROOT ═══ */
export default function App() {
  return <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}><StudyOS /></GoogleOAuthProvider>;
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

  const allTopics  = courses.flatMap(co=>co.units?.flatMap(u=>u.topics)||[]);
  const doneTopics = allTopics.filter(t=>t.done).length;
  const nextExam   = [...courses].filter(co=>co.examDate).sort((a,b)=>daysUntil(a.examDate)-daysUntil(b.examDate))[0];

  const toggleTopic=(cid,uid,tid)=>setCourses(p=>p.map(co=>
    co.id!==cid?co:{...co,units:co.units.map(u=>
      u.id!==uid?u:{...u,topics:u.topics.map(t=>t.id===tid?{...t,done:!t.done}:t)}
    )}
  ));
  const deleteCourse=id=>{if(window.confirm('Delete this course?'))setCourses(p=>p.filter(co=>co.id!==id));};
  const s=mkStyles(c);

  return (
    <div style={s.app}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=DM+Sans:opsz,wght@9..40,400;9..40,500&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}
        body{background:${c.bg};font-size:16px}
        input,textarea,select{font-family:'DM Sans',sans-serif;color:${c.text};font-size:15px}
        input[type=date]::-webkit-calendar-picker-indicator,
        input[type=datetime-local]::-webkit-calendar-picker-indicator{filter:${dark?'invert(1)':'none'}}
        ::-webkit-scrollbar{width:3px}
        ::-webkit-scrollbar-thumb{background:${c.border};border-radius:4px}
        @keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        @keyframes shimmer{0%,100%{opacity:0.5}50%{opacity:1}}
        .screen{animation:fadeUp 0.25s ease}
        .press:active{transform:scale(0.96)}
        .hov:hover{opacity:0.82}
        .thinking{animation:shimmer 1.4s infinite}
      `}</style>

      <header style={s.nav}>
        <div style={s.logo}>Study<span style={{color:c.blue}}>OS</span></div>
        <div style={{display:'flex',gap:10,alignItems:'center'}}>
          {gUser&&<div style={{fontSize:12,color:c.sage,background:c.sageD,padding:'5px 12px',borderRadius:20}}>📅 Synced</div>}
          <button className="press" onClick={()=>setDark(!dark)} style={s.iconBtn}>{dark?'☀️':'🌙'}</button>
          <div style={s.avatar}>ME</div>
        </div>
      </header>

      <main style={s.main}>
        {tab==='home'      && <HomeTab      c={c} s={s} courses={courses} sessions={sessions} goals={goals} setGoals={setGoals} doneTopics={doneTopics} allTopics={allTopics} nextExam={nextExam} setTab={setTab} toggleTopic={toggleTopic} gToken={gToken} setGToken={setGToken} setGUser={setGUser} gUser={gUser} />}
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
            <span style={{fontSize:20}}>{icon}</span>
            <span style={{fontSize:10,marginTop:2}}>{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

/* ═══════════════════════════════════════════ HOME ═══ */
function HomeTab({c,s,courses,sessions,goals,setGoals,doneTopics,allTopics,nextExam,setTab,toggleTopic,gToken,setGToken,setGUser,gUser}) {
  const hour=new Date().getHours();
  const greet=hour<12?'Good morning':hour<17?'Good afternoon':'Good evening';
  const tod=todayStr();
  const todaySessions=sessions.filter(x=>x.date===tod);
  const todayHrs=todaySessions.reduce((a,x)=>a+x.hours,0);
  const [newGoal,setNewGoal]=useState('');
  const [addingGoal,setAddingGoal]=useState(false);

  const heatDays=Array.from({length:35},(_,i)=>{
    const d=new Date(); d.setDate(d.getDate()-(34-i));
    const key=d.toISOString().slice(0,10);
    const hrs=sessions.filter(x=>x.date===key).reduce((a,x)=>a+x.hours,0);
    return {key,hrs};
  });
  const heatColor=hrs=>{
    if(hrs===0) return c.border;
    if(hrs<1)   return c.blue+'44';
    if(hrs<2)   return c.blue+'88';
    if(hrs<3)   return c.blue+'BB';
    return c.blue;
  };

  const login=useGoogleLogin({
    onSuccess:async t=>{setGToken(t.access_token);try{const r=await fetch('https://www.googleapis.com/oauth2/v3/userinfo',{headers:{Authorization:`Bearer ${t.access_token}`}});setGUser(await r.json());}catch{}},
    onError:()=>alert('Google login failed.'),
    scope:'https://www.googleapis.com/auth/calendar.events',
  });

  return (
    <div className="screen">
      <div style={{marginBottom:22}}>
        <h1 style={{...s.display,fontSize:26,marginBottom:6}}>{greet}! 👋</h1>
        <p style={{fontSize:15,color:c.muted}}>{new Date().toDateString()} · {courses.length} course{courses.length!==1?'s':''}</p>
      </div>

      {!gToken?(
        <button className="press hov" onClick={()=>login()}
          style={{...s.card,width:'100%',border:`1px solid ${c.blue}55`,display:'flex',alignItems:'center',gap:14,marginBottom:16,cursor:'pointer',background:c.blueD}}>
          <span style={{fontSize:24}}>📅</span>
          <div style={{textAlign:'left'}}>
            <div style={{fontSize:15,fontWeight:500,color:c.blueL}}>Connect Google Calendar</div>
            <div style={{fontSize:13,color:c.blue,marginTop:3}}>Sync study sessions automatically</div>
          </div>
        </button>
      ):(
        <div style={{...s.card,background:c.sageD,border:`1px solid ${c.sage}44`,marginBottom:16,display:'flex',alignItems:'center',gap:12}}>
          <span style={{fontSize:22}}>✅</span>
          <div>
            <div style={{fontSize:15,color:c.sageL,fontWeight:500}}>Google Calendar connected</div>
            <div style={{fontSize:13,color:c.sage,marginTop:2}}>{gUser?.email||'Signed in'}</div>
          </div>
        </div>
      )}

      {courses.length===0?(
        <div style={{...s.card,textAlign:'center',padding:'52px 24px',border:`2px dashed ${c.border}`,marginBottom:22}}>
          <div style={{fontSize:60,marginBottom:18}}>📚</div>
          <h2 style={{...s.display,fontSize:22,marginBottom:12}}>Welcome to StudyOS</h2>
          <p style={{fontSize:15,color:c.muted,lineHeight:1.8,marginBottom:28}}>Your personal study companion.<br/>Add your first course to get started.</p>
          <button className="press hov" onClick={()=>setTab('add')} style={s.btnPrimary(c.blue)}>＋ Add first course</button>
        </div>
      ):(
        <>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:20}}>
            <Stat label="Topics done"  val={`${doneTopics}/${allTopics.length}`} color={c.blue} />
            <Stat label="Today's hrs"  val={todayHrs.toFixed(1)+'h'}             color={c.coral} />
            <Stat label="Next exam"    val={nextExam?`${daysUntil(nextExam.examDate)}d`:'—'} color={nextExam?(daysUntil(nextExam.examDate)<30?c.red:daysUntil(nextExam.examDate)<60?c.coral:c.sage):c.muted} />
            <Stat label="Progress"     val={`${allTopics.length>0?Math.round(doneTopics/allTopics.length*100):0}%`} color={c.purple} />
          </div>

          {/* HEATMAP */}
          <div style={{...s.card,marginBottom:16}}>
            <Label text="Study heatmap — last 5 weeks" />
            <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:5,marginTop:12}}>
              {['S','M','T','W','T','F','S'].map((d,i)=>(
                <div key={i} style={{fontSize:11,color:c.muted,textAlign:'center',marginBottom:3}}>{d}</div>
              ))}
              {heatDays.map(({key,hrs})=>(
                <div key={key} title={`${key}: ${hrs}h`}
                  style={{height:22,borderRadius:5,background:heatColor(hrs),transition:'background 0.3s'}} />
              ))}
            </div>
            <div style={{display:'flex',gap:8,alignItems:'center',marginTop:12,justifyContent:'flex-end'}}>
              <span style={{fontSize:11,color:c.muted}}>Less</span>
              {[0,0.5,1.5,2.5,3.5].map(h=>(
                <div key={h} style={{width:14,height:14,borderRadius:4,background:heatColor(h)}} />
              ))}
              <span style={{fontSize:11,color:c.muted}}>More</span>
            </div>
          </div>

          {/* TODAY SESSIONS */}
          <div style={{...s.card,marginBottom:16}}>
            <Label text="Today's sessions" />
            {todaySessions.length===0?(
              <div style={{fontSize:14,color:c.muted,fontStyle:'italic',marginTop:10}}>No sessions yet. Go to ⏱️ Focus to log one.</div>
            ):todaySessions.map((sess,i)=>(
              <div key={i} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 0',borderBottom:`1px solid ${c.border}`}}>
                <div style={{width:11,height:11,borderRadius:'50%',background:c.blue,flexShrink:0}} />
                <div style={{flex:1}}>
                  <div style={{fontSize:14,color:c.text}}>{sess.topic||sess.course}</div>
                  <div style={{fontSize:12,color:c.muted,marginTop:2}}>{sess.course} · {sess.hours}h</div>
                </div>
                <div style={{fontSize:13,color:c.muted}}>{sess.time}</div>
              </div>
            ))}
          </div>

          {/* WEEKLY GOALS */}
          <div style={{...s.card,marginBottom:16}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
              <Label text="Weekly goals" />
              <button className="press" onClick={()=>setAddingGoal(!addingGoal)}
                style={{background:c.blue,color:'#fff',border:'none',borderRadius:9,padding:'5px 14px',fontSize:13,cursor:'pointer'}}>
                {addingGoal?'✕':'＋'}
              </button>
            </div>
            {addingGoal&&(
              <div style={{display:'flex',gap:8,marginBottom:12}}>
                <input style={{...s.input,marginBottom:0,flex:1}} placeholder="Add a goal..."
                  value={newGoal} onChange={e=>setNewGoal(e.target.value)}
                  onKeyDown={e=>{if(e.key==='Enter'&&newGoal.trim()){setGoals(p=>[...p,{id:Date.now(),text:newGoal.trim(),done:false,color:COLOR_KEYS[p.length%COLOR_KEYS.length]}]);setNewGoal('');setAddingGoal(false);}}} />
                <button className="press hov" onClick={()=>{if(newGoal.trim()){setGoals(p=>[...p,{id:Date.now(),text:newGoal.trim(),done:false,color:COLOR_KEYS[p.length%COLOR_KEYS.length]}]);setNewGoal('');setAddingGoal(false);}}}
                  style={{background:c.blue,color:'#fff',border:'none',borderRadius:10,padding:'0 16px',cursor:'pointer',fontSize:20}}>＋</button>
              </div>
            )}
            {goals.length===0&&<div style={{fontSize:14,color:c.muted,fontStyle:'italic'}}>No goals yet. Add one!</div>}
            {goals.map(g=>(
              <div key={g.id} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 14px',borderRadius:12,background:c[g.color+'D'],marginBottom:8}}>
                <Circle done={g.done} color={c[g.color]} onClick={()=>setGoals(p=>p.map(x=>x.id===g.id?{...x,done:!x.done}:x))} size={20} />
                <span style={{flex:1,fontSize:14,color:c[g.color+'L'],textDecoration:g.done?'line-through':'none'}}>{g.text}</span>
                <button onClick={()=>setGoals(p=>p.filter(x=>x.id!==g.id))}
                  style={{background:'none',border:'none',color:c.muted,cursor:'pointer',fontSize:16}}>✕</button>
              </div>
            ))}
          </div>

          {/* QUICK ACTIONS */}
          <Label text="Quick actions" />
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:22}}>
            {[
              {label:'AI Tutor',   icon:'🤖',id:'ai',       bg:c.navyD,   fg:c.navy},
              {label:'Focus Timer',icon:'⏱️',id:'focus',    bg:c.blueD,   fg:c.blue},
              {label:'Flashcards', icon:'🃏',id:'cards',    bg:c.purpleD, fg:c.purple},
              {label:'Analytics',  icon:'📈',id:'analytics',bg:c.pinkD,   fg:c.pink},
            ].map(({label,icon,id,bg,fg})=>(
              <button key={id} className="press" onClick={()=>setTab(id)}
                style={{background:bg,border:'none',borderRadius:14,padding:'16px 14px',cursor:'pointer',display:'flex',alignItems:'center',gap:12,textAlign:'left'}}>
                <span style={{fontSize:24}}>{icon}</span>
                <span style={{fontSize:15,fontWeight:500,color:fg,fontFamily:"'DM Sans',sans-serif"}}>{label}</span>
              </button>
            ))}
          </div>

          {/* COURSES */}
          <Label text="My courses" />
          {courses.map(co=>{
            const cc=c[co.color],ccD=c[co.color+'D'],ccL=c[co.color+'L'],p=coursePct(co);
            return (
              <div key={co.id} style={{...s.card,background:ccD,border:'none',marginBottom:16}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:12}}>
                  <div style={{flex:1}}>
                    <div style={{fontSize:17,fontWeight:500,color:ccL,marginBottom:4}}>{co.icon} {co.name}</div>
                    {co.examDate&&<div style={{fontSize:13,color:cc}}>📅 {new Date(co.examDate).toDateString()}</div>}
                  </div>
                  {co.examDate&&<div style={{textAlign:'right',marginLeft:10}}>
                    <div style={{fontSize:28,fontWeight:700,color:ccL,fontFamily:"'Playfair Display',serif",lineHeight:1}}>{daysUntil(co.examDate)}</div>
                    <div style={{fontSize:11,color:cc}}>days left</div>
                  </div>}
                </div>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:13,color:cc,marginBottom:8}}>
                  <span>Progress</span><span style={{fontWeight:500,color:ccL}}>{p}%</span>
                </div>
                <ProgBar val={p} color={cc} bg={cc+'25'} />
                {co.units?.map(u=>(
                  <div key={u.id} style={{marginTop:14}}>
                    <div style={{fontSize:13,fontWeight:500,color:cc,marginBottom:8}}>📂 {u.name} ({unitPct(u)}%)</div>
                    {u.topics.map(t=>(
                      <div key={t.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'8px 0 8px 14px',borderBottom:`1px solid ${cc}18`}}>
                        <div style={{display:'flex',alignItems:'center',gap:10,flex:1,minWidth:0}}>
                          <Circle done={t.done} color={cc} onClick={()=>toggleTopic(co.id,u.id,t.id)} />
                          <span style={{fontSize:14,color:t.done?cc:ccL,textDecoration:t.done?'line-through':'none',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{t.name}</span>
                        </div>
                        <button className="press" onClick={()=>toggleTopic(co.id,u.id,t.id)}
                          style={{fontSize:11,padding:'3px 10px',borderRadius:20,border:'none',cursor:'pointer',background:t.done?c.green+'33':cc+'33',color:t.done?c.green:cc,flexShrink:0,marginLeft:8}}>
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

/* ═══════════════════════════════════════════ COURSES ═══ */
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
    const all=co.units?.flatMap(u=>u.topics)||[];
    return (
      <div className="screen">
        <button className="press" onClick={()=>setDetail(null)} style={s.backBtn}>← Back</button>
        <div style={{...s.card,background:ccD,border:'none',margin:'16px 0'}}>
          <div style={{fontSize:40,marginBottom:10}}>{co.icon}</div>
          <h2 style={{...s.display,fontSize:22,color:ccL,marginBottom:8}}>{co.name}</h2>
          {co.examDate&&<div style={{fontSize:14,color:cc,marginBottom:16}}>Exam: {new Date(co.examDate).toDateString()} · {daysUntil(co.examDate)} days away</div>}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10}}>
            {[{label:'Progress',val:coursePct(co)+'%'},{label:'Units',val:co.units?.length||0},{label:'Done',val:`${all.filter(t=>t.done).length}/${all.length}`}].map(({label,val})=>(
              <div key={label} style={{background:cc+'25',borderRadius:12,padding:'12px 8px',textAlign:'center'}}>
                <div style={{fontSize:18,fontWeight:700,color:ccL,fontFamily:"'Playfair Display',serif"}}>{val}</div>
                <div style={{fontSize:11,color:cc,marginTop:4}}>{label}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
          <Label text={`Units (${co.units?.length||0})`} />
          <button className="press hov" onClick={()=>{setDetail(null);setTimeout(()=>setEditing(co.id),10);}}
            style={{fontSize:14,color:c.blue,background:'none',border:'none',cursor:'pointer'}}>✏️ Edit</button>
        </div>
        {co.units?.map(u=>(
          <div key={u.id} style={{...s.card,marginBottom:14}}>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:10}}>
              <div style={{fontSize:15,fontWeight:500,color:c.text}}>📂 {u.name}</div>
              <div style={{fontSize:14,color:cc,fontWeight:500}}>{unitPct(u)}%</div>
            </div>
            <ProgBar val={unitPct(u)} color={cc} bg={c.border} />
            <div style={{marginTop:12}}>
              {u.topics.map(t=>(
                <div key={t.id} style={{display:'flex',alignItems:'center',gap:12,padding:'9px 0',borderBottom:`1px solid ${c.border}`}}>
                  <Circle done={t.done} color={cc} onClick={()=>toggleTopic(co.id,u.id,t.id)} size={22} />
                  <span style={{flex:1,fontSize:14,color:c.text,textDecoration:t.done?'line-through':'none'}}>{t.name}</span>
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
      <h1 style={{...s.display,fontSize:24,marginBottom:22}}>My Courses</h1>
      {courses.length===0&&(
        <div style={{...s.card,textAlign:'center',padding:'52px 24px',border:`2px dashed ${c.border}`}}>
          <div style={{fontSize:52,marginBottom:16}}>📚</div>
          <div style={{fontSize:17,color:c.text,marginBottom:8}}>No courses yet</div>
          <div style={{fontSize:15,color:c.muted}}>Go to ＋ Add to create your first course</div>
        </div>
      )}
      {courses.map(co=>{
        const cc=c[co.color],ccD=c[co.color+'D'],ccL=c[co.color+'L'],p=coursePct(co);
        const all=co.units?.flatMap(u=>u.topics)||[];
        return (
          <div key={co.id} style={{...s.card,background:ccD,border:'none',marginBottom:16}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
              <button className="press" onClick={()=>setDetail(co.id)}
                style={{display:'flex',alignItems:'center',gap:12,background:'none',border:'none',cursor:'pointer',flex:1,textAlign:'left'}}>
                <div style={{width:48,height:48,borderRadius:14,background:cc+'30',display:'flex',alignItems:'center',justifyContent:'center',fontSize:24,flexShrink:0}}>{co.icon}</div>
                <div>
                  <div style={{fontSize:16,fontWeight:500,color:ccL}}>{co.name}</div>
                  <div style={{fontSize:13,color:cc,marginTop:3}}>{co.units?.length||0} units · {all.length} topics</div>
                </div>
              </button>
              <div style={{textAlign:'right',marginLeft:10}}>
                <div style={{fontSize:26,fontWeight:700,color:ccL,fontFamily:"'Playfair Display',serif",lineHeight:1}}>{p}%</div>
              </div>
            </div>
            <ProgBar val={p} color={cc} bg={cc+'25'} />
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:14}}>
              <span style={{fontSize:13,color:cc}}>{all.filter(t=>t.done).length}/{all.length} done{co.examDate?` · ${daysUntil(co.examDate)}d left`:''}</span>
              <div style={{display:'flex',gap:10}}>
                <button className="press hov" onClick={()=>setEditing(co.id)}
                  style={{fontSize:13,padding:'5px 14px',borderRadius:20,border:'none',background:cc+'30',color:ccL,cursor:'pointer'}}>✏️ Edit</button>
                <button className="press hov" onClick={()=>deleteCourse(co.id)}
                  style={{fontSize:13,padding:'5px 14px',borderRadius:20,border:'none',background:c.red+'22',color:c.red,cursor:'pointer'}}>🗑</button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function EditCourse({c,s,course,setCourses,onBack}) {
  const [name,setName]         = useState(course.name);
  const [icon,setIcon]         = useState(course.icon);
  const [color,setColor]       = useState(course.color);
  const [examDate,setExamDate] = useState(course.examDate||'');
  const [hours,setHours]       = useState(course.hoursPerDay||1.5);
  const [units,setUnits]       = useState((course.units||[]).map(u=>({...u,topics:[...u.topics]})));
  const [newUnit,setNewUnit]   = useState('');
  const [newTopics,setNewTopics]=useState({});

  const addUnit=()=>{const v=newUnit.trim();if(!v)return;setUnits(p=>[...p,{id:Date.now(),name:v,topics:[]}]);setNewUnit('');};
  const addTopic=uid=>{const v=(newTopics[uid]||'').trim();if(!v)return;setUnits(p=>p.map(u=>u.id===uid?{...u,topics:[...u.topics,{id:Date.now(),name:v,done:false,confidence:0}]}:u));setNewTopics(p=>({...p,[uid]:''}));};

  const handleSave=()=>{
    if(!name.trim()) return alert('Please enter a course name.');
    setCourses(p=>p.map(co=>co.id===course.id?{...co,name:name.trim(),icon,color,examDate,hoursPerDay:Number(hours),units}:co));
    onBack();
  };

  return (
    <div className="screen">
      <button className="press" onClick={onBack} style={s.backBtn}>← Back</button>
      <h1 style={{...s.display,fontSize:22,margin:'16px 0 22px'}}>Edit Course</h1>
      <div style={{...s.card,marginBottom:16}}>
        <label style={s.label}>Course name</label>
        <input style={s.input} value={name} onChange={e=>setName(e.target.value)} />
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
          <div><label style={s.label}>Exam date</label><input type="date" style={s.input} value={examDate} onChange={e=>setExamDate(e.target.value)} /></div>
          <div><label style={s.label}>Hrs/day</label><input type="number" style={s.input} min="0.5" max="12" step="0.5" value={hours} onChange={e=>setHours(e.target.value)} /></div>
        </div>
        <label style={s.label}>Icon</label>
        <div style={{display:'flex',flexWrap:'wrap',gap:10,marginBottom:16}}>
          {ICONS.map(ic=><button key={ic} className="press" onClick={()=>setIcon(ic)}
            style={{width:42,height:42,borderRadius:10,fontSize:20,cursor:'pointer',border:icon===ic?`2px solid ${c.blue}`:`1px solid ${c.border}`,background:icon===ic?c.blueD:c.card2}}>{ic}</button>)}
        </div>
        <label style={s.label}>Color</label>
        <div style={{display:'flex',gap:12}}>
          {COLOR_KEYS.map(col=><button key={col} className="press" onClick={()=>setColor(col)}
            style={{width:30,height:30,borderRadius:'50%',background:c[col],cursor:'pointer',border:color===col?`3px solid ${c.text}`:'3px solid transparent'}} />)}
        </div>
      </div>
      <div style={{...s.card,marginBottom:16}}>
        <div style={{fontSize:15,fontWeight:500,color:c.text,marginBottom:16}}>Units & Topics</div>
        {units.map((u,ui)=>(
          <div key={u.id} style={{background:c.card2,borderRadius:14,padding:'14px',marginBottom:12}}>
            <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:12}}>
              <div style={{width:26,height:26,borderRadius:8,background:c[color],color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,flexShrink:0,fontWeight:700}}>{ui+1}</div>
              <input style={{...s.input,marginBottom:0,flex:1}} value={u.name}
                onChange={e=>setUnits(p=>p.map(x=>x.id===u.id?{...x,name:e.target.value}:x))} placeholder="Unit name" />
              <button className="press" onClick={()=>setUnits(p=>p.filter(x=>x.id!==u.id))}
                style={{background:'none',border:'none',color:c.red,cursor:'pointer',fontSize:18}}>✕</button>
            </div>
            {u.topics.map(t=>(
              <div key={t.id} style={{display:'flex',alignItems:'center',gap:10,padding:'7px 0 7px 36px',borderBottom:`1px solid ${c.border}`}}>
                <span style={{fontSize:14,color:c.text,flex:1}}>• {t.name}</span>
                <button onClick={()=>setUnits(p=>p.map(x=>x.id===u.id?{...x,topics:x.topics.filter(tp=>tp.id!==t.id)}:x))}
                  style={{background:'none',border:'none',color:c.muted,cursor:'pointer',fontSize:15}}>✕</button>
              </div>
            ))}
            <div style={{display:'flex',gap:8,marginTop:10,paddingLeft:36}}>
              <input style={{...s.input,marginBottom:0,flex:1,fontSize:14}} placeholder="Add topic..."
                value={newTopics[u.id]||''} onChange={e=>setNewTopics(p=>({...p,[u.id]:e.target.value}))}
                onKeyDown={e=>e.key==='Enter'&&addTopic(u.id)} />
              <button className="press hov" onClick={()=>addTopic(u.id)}
                style={{background:c.blue,color:'#fff',border:'none',borderRadius:10,padding:'0 14px',cursor:'pointer',fontSize:18}}>＋</button>
            </div>
          </div>
        ))}
        <div style={{display:'flex',gap:10,marginTop:10}}>
          <input style={{...s.input,marginBottom:0,flex:1}} placeholder="Add a new unit..."
            value={newUnit} onChange={e=>setNewUnit(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addUnit()} />
          <button className="press hov" onClick={addUnit}
            style={{background:c.blue,color:'#fff',border:'none',borderRadius:12,padding:'0 18px',cursor:'pointer',fontSize:20,flexShrink:0}}>＋</button>
        </div>
      </div>
      <button className="press hov" onClick={handleSave} style={{...s.btnPrimary(c.blue),marginBottom:32}}>✓ Save changes</button>
    </div>
  );
}

/* ═══════════════════════════════════════════ FOCUS ═══ */
function FocusTab({c,s,courses,sessions,setSessions,gToken,setGToken,setGUser}) {
  const [running,setRunning]=useState(false);
  const [secs,setSecs]=useState(25*60);
  const [mode,setMode]=useState('focus');
  const [pomos,setPomos]=useState(0);
  const [picked,setPicked]=useState('');
  const [pickedUnit,setPickedUnit]=useState('');
  const [ambience,setAmbience]=useState('🔕 Silent');
  const [hrs,setHrs]=useState(1);
  const [sessDate,setSessDate]=useState(()=>{const d=new Date();d.setMinutes(0,0,0);return d.toISOString().slice(0,16);});
  const [logStatus,setLogStatus]=useState('idle');
  const ref=useRef(null);
  const TOTAL=mode==='focus'?25*60:5*60;
  const pickedCourse=courses.find(co=>String(co.id)===String(picked));

  useEffect(()=>{
    if(running){ref.current=setInterval(()=>setSecs(s=>{if(s<=1){clearInterval(ref.current);setRunning(false);if(mode==='focus'){setPomos(n=>n+1);setMode('break');setSecs(5*60);}else{setMode('focus');setSecs(25*60);}return 0;}return s-1;}),1000);}
    else clearInterval(ref.current);
    return()=>clearInterval(ref.current);
  },[running,mode]);

  const fmt=s=>`${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
  const prog=((TOTAL-secs)/TOTAL)*100;
  const R=80,circ=2*Math.PI*R;
  const cc=mode==='focus'?c.blue:c.sage;

  const logSession=async()=>{
    if(!pickedCourse) return alert('Please select a course.');
    const newSess={id:Date.now(),course:pickedCourse.name,unit:pickedUnit,date:todayStr(),time:new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}),hours:Number(hrs)};
    setSessions(p=>[...p,newSess]);
    setLogStatus('syncing');
    if(gToken){
      try{await pushToCalendar(gToken,`Study: ${pickedCourse.name}${pickedUnit?' — '+pickedUnit:''}`,`StudyOS · ${hrs}h session`,sessDate,Math.round(Number(hrs)*60));setLogStatus('done');}
      catch{setLogStatus('done');}
    } else setLogStatus('done');
    setTimeout(()=>setLogStatus('idle'),3000);
  };

  const login=useGoogleLogin({
    onSuccess:async t=>{setGToken(t.access_token);try{const r=await fetch('https://www.googleapis.com/oauth2/v3/userinfo',{headers:{Authorization:`Bearer ${t.access_token}`}});setGUser(await r.json());}catch{}},
    onError:()=>alert('Login failed'),scope:'https://www.googleapis.com/auth/calendar.events',
  });

  return (
    <div className="screen" style={{textAlign:'center'}}>
      <h1 style={{...s.display,fontSize:24,textAlign:'left',marginBottom:6}}>Focus Mode</h1>
      <p style={{fontSize:15,color:c.muted,textAlign:'left',marginBottom:24}}>Deep work. One session at a time.</p>
      <div style={{display:'flex',gap:10,justifyContent:'center',marginBottom:26}}>
        {[['focus','🎯 Focus'],['break','☕ Break']].map(([m,label])=>(
          <button key={m} className="press" onClick={()=>{setMode(m);setRunning(false);setSecs(m==='focus'?25*60:5*60);}}
            style={{padding:'10px 24px',borderRadius:24,border:'none',cursor:'pointer',background:mode===m?cc:c.card2,color:mode===m?'#fff':c.muted,fontSize:15}}>
            {label}
          </button>
        ))}
      </div>
      <div style={{position:'relative',display:'inline-flex',alignItems:'center',justifyContent:'center',marginBottom:22}}>
        <svg width="210" height="210" viewBox="0 0 210 210" style={{transform:'rotate(-90deg)'}}>
          <circle cx="105" cy="105" r={R} fill="none" stroke={c.border} strokeWidth="13" />
          <circle cx="105" cy="105" r={R} fill="none" stroke={cc} strokeWidth="13"
            strokeDasharray={circ} strokeDashoffset={circ-(circ*prog/100)}
            strokeLinecap="round" style={{transition:'stroke-dashoffset 0.6s ease'}} />
        </svg>
        <div style={{position:'absolute',textAlign:'center'}}>
          <div style={{fontSize:40,fontWeight:700,color:c.text,fontFamily:"'Playfair Display',serif",lineHeight:1}}>{fmt(secs)}</div>
          <div style={{fontSize:14,color:c.muted,marginTop:5}}>{mode==='focus'?'🎯 Focus':'☕ Break'}</div>
        </div>
      </div>
      <div style={{display:'flex',gap:14,justifyContent:'center',marginBottom:18}}>
        <button className="press hov" onClick={()=>setRunning(!running)}
          style={{background:cc,color:'#fff',border:'none',borderRadius:16,padding:'15px 44px',fontSize:18,cursor:'pointer',fontFamily:"'Playfair Display',serif"}}>
          {running?'⏸ Pause':'▶ Start'}
        </button>
        <button className="press" onClick={()=>{setRunning(false);setSecs(mode==='focus'?25*60:5*60);}}
          style={{background:c.card2,color:c.muted,border:'none',borderRadius:16,padding:'15px 20px',fontSize:22,cursor:'pointer'}}>↺</button>
      </div>
      <div style={{display:'flex',justifyContent:'center',gap:10,marginBottom:24}}>
        {Array.from({length:4},(_,i)=><div key={i} style={{width:13,height:13,borderRadius:'50%',background:i<pomos%4?cc:c.border}} />)}
      </div>
      <div style={{...s.card,textAlign:'left',marginBottom:14}}>
        <Label text="Log a study session" />
        <label style={s.label}>Course</label>
        <select style={{...s.input,marginBottom:12}} value={picked} onChange={e=>{setPicked(e.target.value);setPickedUnit('');}}>
          <option value="">Select course...</option>
          {courses.map(co=><option key={co.id} value={co.id}>{co.icon} {co.name}</option>)}
        </select>
        {pickedCourse?.units?.length>0&&(
          <>
            <label style={s.label}>Unit (optional)</label>
            <select style={{...s.input,marginBottom:12}} value={pickedUnit} onChange={e=>setPickedUnit(e.target.value)}>
              <option value="">All units</option>
              {pickedCourse.units.map(u=><option key={u.id} value={u.name}>{u.name}</option>)}
            </select>
          </>
        )}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
          <div><label style={s.label}>Hours studied</label><input type="number" style={s.input} min="0.25" max="12" step="0.25" value={hrs} onChange={e=>setHrs(e.target.value)} /></div>
          <div><label style={s.label}>Date & time</label><input type="datetime-local" style={s.input} value={sessDate} onChange={e=>setSessDate(e.target.value)} /></div>
        </div>
        <button className="press hov" onClick={logSession} style={s.btnPrimary(logStatus==='done'?c.green:c.blue)}>
          {logStatus==='syncing'?'⏳ Logging...':logStatus==='done'?'✓ Logged!':'✓ Log Session'}
        </button>
        {!gToken&&<button className="press hov" onClick={()=>login()} style={{...s.btnPrimary(c.navyD),marginTop:10,color:c.navyL,fontSize:14}}>📅 Connect Calendar to sync</button>}
      </div>
      <div style={{...s.card,textAlign:'left'}}>
        <Label text="Ambience" />
        <div style={{display:'flex',flexWrap:'wrap',gap:10,marginTop:12}}>
          {['🔕 Silent','🌊 Ocean','🌿 Forest','🌧️ Rain','☕ Café','🌙 Night'].map(a=>(
            <button key={a} className="press" onClick={()=>setAmbience(a)}
              style={{padding:'8px 16px',borderRadius:22,border:'none',cursor:'pointer',background:ambience===a?c.blue:c.card2,color:ambience===a?'#fff':c.muted,fontSize:14}}>
              {a}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════ AI TAB ═══ */
function AITab({c,s,courses,setCourses,setCards}) {
  const [mode,setMode]=useState('tutor');
  const [messages,setMessages]=useState([{role:'ai',text:"Hello! I'm your AI study tutor powered by Google Gemini. Ask me to explain concepts, quiz you, help with topics from your courses, or anything study-related. How can I help? 📚"}]);
  const [input,setInput]=useState('');
  const [thinking,setThinking]=useState(false);
  const [outline,setOutline]=useState('');
  const [courseName,setCourseName]=useState('');
  const [parsing,setParsing]=useState(false);
  const [parsed,setParsed]=useState(null);
  const [pdfLoading,setPdfLoading]=useState(false);
  const fileRef=useRef(null);
  const bottomRef=useRef(null);

  useEffect(()=>bottomRef.current?.scrollIntoView({behavior:'smooth'}),[messages]);

  const sendMessage=async()=>{
    if(!input.trim()||thinking) return;
    const userMsg={role:'user',text:input.trim()};
    setMessages(p=>[...p,userMsg]);setInput('');setThinking(true);
    try{
      const ctx=courses.length>0?`Student is studying: ${courses.map(co=>`${co.name} (units: ${co.units?.map(u=>u.name).join(', ')})`).join('; ')}. `:'';
      const reply=await askGemini(`You are a helpful, encouraging study tutor. ${ctx}Student asks: ${userMsg.text}\n\nRespond helpfully and concisely. Use simple language. Keep under 200 words.`);
      setMessages(p=>[...p,{role:'ai',text:reply}]);
    }catch{setMessages(p=>[...p,{role:'ai',text:'Sorry, connection issue. Please try again!'}]);}
    setThinking(false);
  };

  /* PDF UPLOAD */
  const handlePDF=async(e)=>{
    const file=e.target.files[0];
    if(!file) return;
    if(!courseName.trim()) return alert('Please enter a course name first.');
    setPdfLoading(true);
    try{
      const reader=new FileReader();
      reader.onload=async(ev)=>{
        const base64=ev.target.result.split(',')[1];
        const fileData={mime_type:'application/pdf',data:base64};
        const prompt=`Parse this course syllabus PDF into a structured JSON format. Course name: "${courseName}".
Return ONLY valid JSON (no markdown, no backticks):
{"units":[{"name":"Unit name","topics":["Topic 1","Topic 2"]}]}
Group topics into logical units. Create at least 2-3 units.`;
        const reply=await askGemini(prompt,fileData);
        const clean=reply.replace(/```json|```/g,'').trim();
        setParsed(JSON.parse(clean));
        setPdfLoading(false);
      };
      reader.readAsDataURL(file);
    }catch{alert('PDF parsing failed. Try pasting the text instead.');setPdfLoading(false);}
  };

  const parseWithAI=async()=>{
    if(!outline.trim()) return alert('Please paste your syllabus first.');
    if(!courseName.trim()) return alert('Please enter a course name.');
    setParsing(true);
    try{
      const prompt=`Parse this syllabus into JSON. Course: "${courseName}".
Text: ${outline}
Return ONLY valid JSON (no markdown):
{"units":[{"name":"Unit name","topics":["Topic 1","Topic 2"]}]}
Create logical units with at least 2-3 topics each.`;
      const reply=await askGemini(prompt);
      const clean=reply.replace(/```json|```/g,'').trim();
      setParsed(JSON.parse(clean));
    }catch{alert('Parsing failed. Check your text and try again.');}
    setParsing(false);
  };

  const saveCourse=()=>{
    if(!parsed||!courseName.trim()) return;
    const allTopics=parsed.units.flatMap(u=>u.topics);
    setCourses(p=>[...p,{
      id:Date.now(), name:courseName.trim(), icon:'📚',
      color:COLOR_KEYS[p.length%COLOR_KEYS.length],
      examDate:'', hoursPerDay:1.5,
      units:parsed.units.map((u,i)=>({
        id:Date.now()+i+1, name:u.name,
        topics:u.topics.map((t,j)=>({id:Date.now()+i*100+j+1,name:t,done:false,confidence:0}))
      }))
    }]);
    setCards(p=>[...p,...allTopics.slice(0,5).map((t,i)=>({id:Date.now()+i+1000,front:`Key concept: ${t}`,back:'Edit with your own notes!',course:courseName.trim(),known:false}))]);
    alert(`✅ "${courseName}" created with ${parsed.units.length} units and ${allTopics.length} topics!`);
    setParsed(null);setOutline('');setCourseName('');
  };

  return (
    <div className="screen">
      <h1 style={{...s.display,fontSize:24,marginBottom:6}}>AI Assistant 🤖</h1>
      <p style={{fontSize:14,color:c.muted,marginBottom:18}}>Powered by Google Gemini · Free</p>
      <div style={{display:'flex',gap:10,marginBottom:22}}>
        {[['tutor','💬 AI Tutor'],['parse','📄 Parse Syllabus']].map(([m,label])=>(
          <button key={m} className="press" onClick={()=>setMode(m)}
            style={{padding:'10px 20px',borderRadius:24,border:'none',cursor:'pointer',background:mode===m?c.blue:c.card2,color:mode===m?'#fff':c.muted,fontSize:15}}>
            {label}
          </button>
        ))}
      </div>

      {mode==='tutor'&&(
        <>
          <div style={{...s.card,marginBottom:14,minHeight:340,maxHeight:440,overflowY:'auto',display:'flex',flexDirection:'column',gap:12,padding:'16px'}}>
            {messages.map((m,i)=>(
              <div key={i} style={{display:'flex',justifyContent:m.role==='user'?'flex-end':'flex-start'}}>
                <div style={{maxWidth:'88%',padding:'12px 16px',borderRadius:m.role==='user'?'18px 18px 4px 18px':'18px 18px 18px 4px',background:m.role==='user'?c.blue:c.card2,color:m.role==='user'?'#fff':c.text,fontSize:15,lineHeight:1.65}}>
                  {m.text}
                </div>
              </div>
            ))}
            {thinking&&<div style={{display:'flex',justifyContent:'flex-start'}}>
              <div className="thinking" style={{padding:'12px 16px',borderRadius:'18px 18px 18px 4px',background:c.card2,color:c.muted,fontSize:15}}>🤔 Thinking...</div>
            </div>}
            <div ref={bottomRef} />
          </div>
          <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:12}}>
            {['Explain this simply','Give me a quiz','What should I focus on?','Create a summary'].map(q=>(
              <button key={q} className="press" onClick={()=>setInput(q)}
                style={{padding:'7px 14px',borderRadius:22,border:`1px solid ${c.border}`,background:'transparent',color:c.muted,fontSize:13,cursor:'pointer'}}>
                {q}
              </button>
            ))}
          </div>
          <div style={{display:'flex',gap:10}}>
            <input style={{...s.input,marginBottom:0,flex:1}} placeholder="Ask anything..."
              value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&sendMessage()} />
            <button className="press hov" onClick={sendMessage} disabled={thinking}
              style={{background:c.blue,color:'#fff',border:'none',borderRadius:12,padding:'0 20px',cursor:'pointer',fontSize:20,flexShrink:0,opacity:thinking?0.6:1}}>➤</button>
          </div>
        </>
      )}

      {mode==='parse'&&(
        <>
          <div style={{...s.card,marginBottom:16}}>
            <div style={{fontSize:16,fontWeight:500,color:c.text,marginBottom:6}}>AI Syllabus Parser</div>
            <p style={{fontSize:14,color:c.muted,marginBottom:16,lineHeight:1.7}}>Upload a PDF or paste text — Gemini will auto-detect your units and topics.</p>

            <label style={s.label}>Course name *</label>
            <input style={s.input} placeholder="e.g. CPA — Financial Accounting" value={courseName} onChange={e=>setCourseName(e.target.value)} />

            {/* PDF UPLOAD */}
            <label style={s.label}>Upload PDF syllabus</label>
            <input type="file" accept=".pdf" ref={fileRef} onChange={handlePDF} style={{display:'none'}} />
            <button className="press hov" onClick={()=>fileRef.current?.click()} disabled={pdfLoading}
              style={{width:'100%',padding:'16px',borderRadius:14,border:`2px dashed ${c.blue}55`,background:c.blueD,color:c.blueL,cursor:'pointer',fontSize:15,marginBottom:16,fontFamily:"'DM Sans',sans-serif",opacity:pdfLoading?0.7:1}}>
              {pdfLoading?'🤖 Reading PDF...':'📄 Upload PDF Syllabus'}
            </button>

            <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:16}}>
              <div style={{flex:1,height:1,background:c.border}} />
              <span style={{fontSize:13,color:c.muted}}>or paste text</span>
              <div style={{flex:1,height:1,background:c.border}} />
            </div>

            <label style={s.label}>Paste syllabus text</label>
            <textarea style={{...s.input,height:160,resize:'vertical'}}
              placeholder={"Unit 1: Financial Statements\n- Income Statement\n- Balance Sheet\n\nUnit 2: Revenue Recognition\n- ASC 606\n- Performance Obligations"}
              value={outline} onChange={e=>setOutline(e.target.value)} />
            <button className="press hov" onClick={parseWithAI} disabled={parsing}
              style={{...s.btnPrimary(parsing?c.muted:c.purple),opacity:parsing?0.7:1}}>
              {parsing?'🤖 AI is reading...':'✨ Parse with Gemini AI'}
            </button>
          </div>

          {parsed&&(
            <div style={{...s.card,border:`1px solid ${c.blue}44`,marginBottom:16}}>
              <div style={{fontSize:16,fontWeight:500,color:c.blueL,marginBottom:6}}>✨ AI detected {parsed.units.length} units</div>
              <div style={{fontSize:13,color:c.blue,marginBottom:16}}>{parsed.units.flatMap(u=>u.topics).length} topics total</div>
              {parsed.units.map((u,i)=>(
                <div key={i} style={{marginBottom:14}}>
                  <div style={{fontSize:15,fontWeight:500,color:c.text,marginBottom:8}}>📂 {u.name}</div>
                  {u.topics.map((t,j)=>(
                    <div key={j} style={{fontSize:14,color:c.muted,padding:'5px 0 5px 18px',borderBottom:`1px solid ${c.border}`}}>• {t}</div>
                  ))}
                </div>
              ))}
              <button className="press hov" onClick={saveCourse} style={{...s.btnPrimary(c.sage),marginTop:10}}>
                ✅ Create this course
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════ CARDS ═══ */
function CardsTab({c,s,cards,setCards,courses}) {
  const [flipped,setFlipped]=useState(false);
  const [idx,setIdx]=useState(0);
  const [filter,setFilter]=useState('all');
  const [adding,setAdding]=useState(false);
  const [form,setForm]=useState({front:'',back:'',course:''});
  const deck=filter==='all'?cards:filter==='learn'?cards.filter(f=>!f.known):cards.filter(f=>f.known);
  const card=deck[idx]||null;
  const known=cards.filter(f=>f.known).length;

  const next=mk=>{
    if(mk!==undefined&&card) setCards(p=>p.map(f=>f.id===card.id?{...f,known:mk}:f));
    setFlipped(false);setTimeout(()=>setIdx(i=>deck.length>1?(i+1)%deck.length:0),150);
  };
  const addCard=()=>{
    if(!form.front.trim()||!form.back.trim()) return alert('Fill in both sides.');
    setCards(p=>[...p,{id:Date.now(),front:form.front.trim(),back:form.back.trim(),course:form.course||'General',known:false}]);
    setForm({front:'',back:'',course:''});setAdding(false);
  };

  return (
    <div className="screen">
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
        <h1 style={{...s.display,fontSize:24}}>Flashcards</h1>
        <button className="press hov" onClick={()=>setAdding(!adding)}
          style={{background:adding?c.card2:c.blue,color:adding?c.muted:'#fff',border:'none',borderRadius:12,padding:'9px 16px',fontSize:15,cursor:'pointer'}}>
          {adding?'✕':'＋ New'}
        </button>
      </div>
      <p style={{fontSize:14,color:c.muted,marginBottom:18}}>{known}/{cards.length} mastered</p>

      {adding&&(
        <div style={{...s.card,marginBottom:18,border:`1px solid ${c.blue}44`}}>
          <label style={s.label}>Question</label>
          <input style={s.input} placeholder="Front of card..." value={form.front} onChange={e=>setForm({...form,front:e.target.value})} />
          <label style={s.label}>Answer</label>
          <textarea style={{...s.input,height:90,resize:'vertical'}} placeholder="Back of card..." value={form.back} onChange={e=>setForm({...form,back:e.target.value})} />
          <label style={s.label}>Course</label>
          <select style={{...s.input,marginBottom:16}} value={form.course} onChange={e=>setForm({...form,course:e.target.value})}>
            <option value="">General</option>
            {courses.map(co=><option key={co.id} value={co.name}>{co.icon} {co.name}</option>)}
          </select>
          <button className="press hov" onClick={addCard} style={s.btnPrimary(c.blue)}>Save card</button>
        </div>
      )}

      <div style={{display:'flex',gap:10,marginBottom:16}}>
        {[['all',`All (${cards.length})`],['learn',`Learning (${cards.filter(f=>!f.known).length})`],['known',`Known (${known})`]].map(([f,label])=>(
          <button key={f} className="press" onClick={()=>{setFilter(f);setIdx(0);setFlipped(false);}}
            style={{padding:'8px 14px',borderRadius:22,border:'none',cursor:'pointer',background:filter===f?c.blue:c.card2,color:filter===f?'#fff':c.muted,fontSize:14}}>
            {label}
          </button>
        ))}
      </div>

      {cards.length>0&&<ProgBar val={cards.length>0?Math.round(known/cards.length*100):0} color={c.purple} bg={c.border} />}

      {cards.length===0&&!adding&&(
        <div style={{...s.card,textAlign:'center',padding:'52px 24px',marginTop:18,border:`2px dashed ${c.border}`}}>
          <div style={{fontSize:52,marginBottom:16}}>🃏</div>
          <div style={{fontSize:17,color:c.text,marginBottom:8}}>No flashcards yet</div>
          <div style={{fontSize:15,color:c.muted}}>Tap ＋ New to add your first card</div>
        </div>
      )}

      {card&&(
        <>
          <div onClick={()=>setFlipped(!flipped)}
            style={{...s.card,minHeight:200,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',cursor:'pointer',textAlign:'center',margin:'18px 0 12px',background:flipped?c.blueD:c.card,border:`1px solid ${flipped?c.blue:c.border}`,transition:'all 0.2s',padding:'36px 26px'}}>
            <div style={{fontSize:12,color:c.muted,marginBottom:14,textTransform:'uppercase',letterSpacing:1.2}}>
              {flipped?'✦ Answer':'? Question'}{card.course?` · ${card.course}`:''}
            </div>
            <div style={{fontSize:17,color:flipped?c.blueL:c.text,lineHeight:1.7}}>{flipped?card.back:card.front}</div>
            {!flipped&&<div style={{fontSize:13,color:c.muted,marginTop:20}}>Tap to reveal</div>}
          </div>
          <div style={{textAlign:'center',fontSize:14,color:c.muted,marginBottom:16}}>{idx+1} of {deck.length}</div>
          {flipped?(
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:22}}>
              <button className="press" onClick={()=>next(false)}
                style={{background:c.redD,border:'none',borderRadius:16,padding:'16px',fontSize:16,color:c.red,cursor:'pointer'}}>✗ Still learning</button>
              <button className="press" onClick={()=>next(true)}
                style={{background:c.greenD,border:'none',borderRadius:16,padding:'16px',fontSize:16,color:c.green,cursor:'pointer'}}>✓ Got it!</button>
            </div>
          ):(
            <button className="press" onClick={()=>next()}
              style={{width:'100%',background:c.card2,border:'none',borderRadius:16,padding:'16px',fontSize:16,color:c.muted,cursor:'pointer',marginBottom:22}}>
              Skip →
            </button>
          )}
        </>
      )}

      {cards.length>0&&(
        <>
          <Label text={`All cards (${cards.length})`} />
          <div style={{marginTop:12,marginBottom:32}}>
            {cards.map(f=>(
              <div key={f.id} style={{...s.card,marginBottom:10,display:'flex',alignItems:'center',gap:14}}>
                <div style={{width:12,height:12,borderRadius:'50%',background:f.known?c.green:c.muted,flexShrink:0}} />
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:14,color:c.text,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{f.front}</div>
                  {f.course&&<div style={{fontSize:12,color:c.muted,marginTop:3}}>{f.course}</div>}
                </div>
                <div style={{display:'flex',gap:8,alignItems:'center',flexShrink:0}}>
                  <span style={{fontSize:12,padding:'4px 12px',borderRadius:20,background:f.known?c.green+'22':c.card2,color:f.known?c.green:c.muted}}>{f.known?'Known':'Learning'}</span>
                  <button className="press" onClick={()=>setCards(p=>p.filter(x=>x.id!==f.id))}
                    style={{background:'none',border:'none',color:c.red,cursor:'pointer',fontSize:16}}>✕</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════ ANALYTICS ═══ */
function AnalyticsTab({c,s,courses,sessions,doneTopics,allTopics}) {
  const pct=allTopics.length>0?Math.round(doneTopics/allTopics.length*100):0;
  const sorted=[...courses].filter(co=>co.examDate).sort((a,b)=>daysUntil(a.examDate)-daysUntil(b.examDate));
  const last7=Array.from({length:7},(_,i)=>{
    const d=new Date();d.setDate(d.getDate()-(6-i));
    const key=d.toISOString().slice(0,10);
    return {label:['S','M','T','W','T','F','S'][d.getDay()],hrs:sessions.filter(x=>x.date===key).reduce((a,x)=>a+x.hours,0)};
  });
  const maxHrs=Math.max(...last7.map(d=>d.hrs),1);
  const weekTotal=last7.reduce((a,d)=>a+d.hrs,0);

  if(courses.length===0) return (
    <div className="screen">
      <h1 style={{...s.display,fontSize:24,marginBottom:22}}>Analytics</h1>
      <div style={{...s.card,textAlign:'center',padding:'52px 24px',border:`2px dashed ${c.border}`}}>
        <div style={{fontSize:52,marginBottom:16}}>📊</div>
        <div style={{fontSize:17,color:c.text,marginBottom:8}}>No data yet</div>
        <div style={{fontSize:15,color:c.muted}}>Add courses and log sessions to see analytics.</div>
      </div>
    </div>
  );

  return (
    <div className="screen">
      <h1 style={{...s.display,fontSize:24,marginBottom:22}}>Analytics</h1>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:22}}>
        <Stat label="Overall progress" val={pct+'%'}                          color={c.blue} />
        <Stat label="Topics done"      val={`${doneTopics}/${allTopics.length}`} color={c.purple} />
        <Stat label="This week"        val={weekTotal.toFixed(1)+'h'}          color={c.amber} />
        <Stat label="Nearest exam"     val={sorted.length>0?daysUntil(sorted[0].examDate)+'d':'—'} color={c.coral} />
      </div>

      <div style={{...s.card,marginBottom:18}}>
        <div style={{fontSize:16,fontWeight:500,color:c.text,marginBottom:5}}>Hours studied — last 7 days</div>
        <div style={{fontSize:13,color:c.muted,marginBottom:18}}>{weekTotal.toFixed(1)}h this week</div>
        <div style={{display:'flex',alignItems:'flex-end',gap:8,height:110}}>
          {last7.map(({label,hrs},i)=>(
            <div key={i} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:5}}>
              <div style={{fontSize:11,color:c.muted,height:16}}>{hrs>0?hrs.toFixed(1):''}</div>
              <div style={{width:'75%',height:Math.round((hrs/maxHrs)*88)||4,background:hrs>0?c.blue:c.border,borderRadius:'4px 4px 0 0',transition:'height 0.5s'}} />
              <div style={{fontSize:12,color:c.muted}}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{...s.card,marginBottom:18}}>
        <div style={{fontSize:16,fontWeight:500,color:c.text,marginBottom:18}}>Course progress</div>
        {courses.map(co=>{
          const all=co.units?.flatMap(u=>u.topics)||[];
          return (
            <div key={co.id} style={{marginBottom:20}}>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}>
                <span style={{fontSize:15,color:c.text}}>{co.icon} {co.name}</span>
                <span style={{fontSize:15,fontWeight:500,color:c[co.color]}}>{coursePct(co)}%</span>
              </div>
              <ProgBar val={coursePct(co)} color={c[co.color]} bg={c.border} />
              <div style={{fontSize:13,color:c.muted,marginTop:6}}>{all.filter(t=>t.done).length}/{all.length} topics{co.examDate?` · ${daysUntil(co.examDate)} days to exam`:''}</div>
              {co.units?.map(u=>(
                <div key={u.id} style={{marginTop:10,paddingLeft:14}}>
                  <div style={{display:'flex',justifyContent:'space-between',fontSize:13,marginBottom:5}}>
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

      {sorted.length>0&&(
        <div style={{...s.card,marginBottom:18}}>
          <div style={{fontSize:16,fontWeight:500,color:c.text,marginBottom:18}}>Exam countdowns</div>
          {sorted.map(co=>{
            const days=daysUntil(co.examDate);
            const col=days<30?c.red:days<60?c.coral:c.sage;
            return (
              <div key={co.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'12px 0',borderBottom:`1px solid ${c.border}`}}>
                <div>
                  <div style={{fontSize:15,color:c.text}}>{co.icon} {co.name}</div>
                  <div style={{fontSize:13,color:c.muted,marginTop:3}}>{new Date(co.examDate).toDateString()}</div>
                </div>
                <div style={{textAlign:'right'}}>
                  <div style={{fontSize:26,fontWeight:700,color:col,fontFamily:"'Playfair Display',serif",lineHeight:1}}>{days}</div>
                  <div style={{fontSize:12,color:c.muted}}>days left</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div style={{...s.card,background:c.sageD,border:'none',marginBottom:32}}>
        <div style={{fontSize:16,fontWeight:500,color:c.sageL,marginBottom:10}}>🌿 Wellbeing check</div>
        <div style={{fontSize:15,color:c.sage,lineHeight:1.7,marginBottom:16}}>Rest is part of learning. Sleep consolidates memory. How are you feeling?</div>
        <div style={{display:'flex',flexWrap:'wrap',gap:10}}>
          {['Feeling great 😊','Need a break 😮‍💨','A bit stressed 😰','Exhausted 😴'].map(label=>(
            <button key={label} className="press" onClick={()=>alert(`Logged: "${label}" 💚`)}
              style={{padding:'9px 16px',borderRadius:22,border:'none',background:c.sage+'30',color:c.sage,fontSize:14,cursor:'pointer'}}>
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════ ADD ═══ */
function AddTab({c,s,courses,setCourses,setCards,setTab,gToken,setGToken,setGUser}) {
  const [name,setName]=useState('');
  const [icon,setIcon]=useState('📚');
  const [color,setColor]=useState('blue');
  const [examDate,setExamDate]=useState('');
  const [hours,setHours]=useState(1.5);
  const [outline,setOutline]=useState('');
  const [saved,setSaved]=useState(false);
  const [preview,setPreview]=useState([]);

  const parse=text=>text.trim().split('\n').map(l=>l.replace(/^[-•*\d.):\s]+/,'').trim()).filter(l=>l.length>2).map((name,i)=>({id:i+1,name,done:false,confidence:0}));
  const handleOutline=val=>{setOutline(val);setPreview(parse(val));};
  const dLeft=examDate?daysUntil(examDate):null;
  const tpd=dLeft&&preview.length&&dLeft>0?(preview.length/dLeft).toFixed(1):null;

  const handleSave=()=>{
    if(!name.trim()) return alert('Please enter a course name.');
    setCourses(p=>[...p,{
      id:Date.now(),name:name.trim(),icon,color,examDate,hoursPerDay:Number(hours),
      units:[{id:Date.now()+1,name:'Main Topics',topics:preview.length>0?preview.map((t,i)=>({...t,id:Date.now()+i+10})):[]}]
    }]);
    if(preview.length>0) setCards(p=>[...p,...preview.slice(0,3).map((t,i)=>({id:Date.now()+i+500,front:`Key concept: ${t.name}`,back:'Edit with your own answer!',course:name.trim(),known:false}))]);
    setSaved(true);setTimeout(()=>{setSaved(false);setTab('courses');},1000);
  };

  const login=useGoogleLogin({
    onSuccess:async t=>{setGToken(t.access_token);try{const r=await fetch('https://www.googleapis.com/oauth2/v3/userinfo',{headers:{Authorization:`Bearer ${t.access_token}`}});setGUser(await r.json());}catch{}},
    onError:()=>alert('Login failed'),scope:'https://www.googleapis.com/auth/calendar.events',
  });

  return (
    <div className="screen">
      <h1 style={{...s.display,fontSize:24,marginBottom:6}}>Add Course</h1>
      <p style={{fontSize:14,color:c.muted,marginBottom:18}}>Tip: Use the 🤖 AI tab to upload a PDF and auto-build your course!</p>

      {!gToken&&<button className="press hov" onClick={()=>login()} style={{...s.card,width:'100%',border:`1px solid ${c.blue}44`,display:'flex',alignItems:'center',gap:14,marginBottom:16,cursor:'pointer',background:c.blueD}}>
        <span style={{fontSize:24}}>📅</span>
        <span style={{fontSize:15,fontWeight:500,color:c.blueL}}>Connect Google Calendar</span>
      </button>}

      <div style={{...s.card,marginBottom:16}}>
        <label style={s.label}>Course name *</label>
        <input style={s.input} placeholder="e.g. CPA, ACCA, Python, Medicine..." value={name} onChange={e=>setName(e.target.value)} />
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
          <div><label style={s.label}>Exam date</label><input type="date" style={s.input} value={examDate} onChange={e=>setExamDate(e.target.value)} /></div>
          <div><label style={s.label}>Study hrs/day</label><input type="number" style={s.input} min="0.5" max="12" step="0.5" value={hours} onChange={e=>setHours(e.target.value)} /></div>
        </div>
        <label style={s.label}>Icon</label>
        <div style={{display:'flex',flexWrap:'wrap',gap:10,marginBottom:16}}>
          {ICONS.map(ic=><button key={ic} className="press" onClick={()=>setIcon(ic)}
            style={{width:42,height:42,borderRadius:11,fontSize:20,cursor:'pointer',border:icon===ic?`2px solid ${c.blue}`:`1px solid ${c.border}`,background:icon===ic?c.blueD:c.card2}}>{ic}</button>)}
        </div>
        <label style={s.label}>Color</label>
        <div style={{display:'flex',gap:12}}>
          {COLOR_KEYS.map(col=><button key={col} className="press" onClick={()=>setColor(col)}
            style={{width:32,height:32,borderRadius:'50%',background:c[col],cursor:'pointer',border:color===col?`3px solid ${c.text}`:'3px solid transparent'}} />)}
        </div>
      </div>

      <div style={{...s.card,marginBottom:16}}>
        <div style={{fontSize:15,fontWeight:500,color:c.text,marginBottom:8}}>Quick topic paste</div>
        <label style={s.label}>Paste topics (one per line)</label>
        <textarea style={{...s.input,height:130,resize:'vertical'}} placeholder={"Topic 1\nTopic 2\nTopic 3"} value={outline} onChange={e=>handleOutline(e.target.value)} />
        {preview.length>0&&(
          <div style={{background:c.blueD,borderRadius:14,padding:'14px 16px'}}>
            <div style={{fontSize:14,color:c.blueL,marginBottom:10}}>✨ {preview.length} topics detected{tpd?` · ${tpd}/day needed`:''}</div>
            <div style={{maxHeight:110,overflowY:'auto'}}>
              {preview.map((t,i)=><div key={i} style={{fontSize:13,color:c.blue,padding:'4px 0',borderBottom:`1px solid ${c.blue}20`}}>{i+1}. {t.name}</div>)}
            </div>
          </div>
        )}
      </div>

      <button className="press hov" onClick={handleSave} style={{...s.btnPrimary(saved?c.green:c.blue),marginBottom:32}}>
        {saved?'✓ Course created!':'＋ Create course'}
      </button>
    </div>
  );
}

/* ═══════════════════════════════════════════ SHARED ═══ */
function ProgBar({val,color,bg}){return <div style={{height:7,background:bg,borderRadius:4,overflow:'hidden'}}><div style={{height:7,width:val+'%',background:color,borderRadius:4,transition:'width 0.5s ease'}} /></div>;}
function Circle({done,color,onClick,size=20}){return <div onClick={onClick} style={{width:size,height:size,borderRadius:'50%',border:`2px solid ${color}`,background:done?color:'transparent',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',fontSize:size*0.55,color:'#fff',flexShrink:0,transition:'all 0.2s'}}>{done?'✓':''}</div>;}
function Stat({label,val,color}){return <div style={{background:'#16152A',borderRadius:16,padding:'16px 14px'}}><div style={{fontSize:13,color:'#7A78A0',marginBottom:8}}>{label}</div><div style={{fontSize:26,fontWeight:700,color,fontFamily:"'Playfair Display',serif"}}>{val}</div></div>;}
function Label({text}){return <div style={{fontSize:12,fontWeight:500,color:'#7A78A0',textTransform:'uppercase',letterSpacing:'0.9px',marginBottom:12}}>{text}</div>;}

/* ═══════════════════════════════════════════ STYLES ═══ */
function mkStyles(c){
  return {
    app:      {minHeight:'100vh',background:c.bg,color:c.text,fontFamily:"'DM Sans',sans-serif",paddingBottom:90},
    nav:      {background:c.card,borderBottom:`1px solid ${c.border}`,padding:'16px 22px',display:'flex',alignItems:'center',justifyContent:'space-between',position:'sticky',top:0,zIndex:100},
    logo:     {fontFamily:"'Playfair Display',serif",fontSize:22,fontWeight:700,color:c.text},
    iconBtn:  {background:c.card2,border:'none',borderRadius:11,width:38,height:38,cursor:'pointer',fontSize:18},
    avatar:   {width:38,height:38,borderRadius:'50%',background:c.blue,color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,fontWeight:600},
    main:     {padding:'24px 22px 0',maxWidth:640,margin:'0 auto'},
    bottomNav:{position:'fixed',bottom:0,left:0,right:0,background:c.card,borderTop:`1px solid ${c.border}`,display:'flex',padding:'10px 4px 16px',zIndex:100},
    navBtn:   a=>({flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:3,background:'none',border:'none',cursor:'pointer',color:a?c.blue:c.muted,fontFamily:"'DM Sans',sans-serif",padding:'4px 2px'}),
    card:     {background:c.card,border:`1px solid ${c.border}`,borderRadius:18,padding:'18px 20px'},
    display:  {fontFamily:"'Playfair Display',serif",color:c.text},
    label:    {fontSize:14,color:c.muted,display:'block',marginBottom:8},
    input:    {width:'100%',background:c.bg,border:`1px solid ${c.border}`,borderRadius:12,padding:'13px 16px',color:c.text,fontSize:15,outline:'none',marginBottom:16,display:'block'},
    btnPrimary:bg=>({width:'100%',padding:'16px',borderRadius:16,border:'none',background:bg,color:'#fff',fontSize:16,fontFamily:"'Playfair Display',serif",cursor:'pointer',display:'block'}),
    backBtn:  {background:'none',border:'none',color:c.blue,cursor:'pointer',fontSize:16,fontFamily:"'DM Sans',sans-serif",padding:0},
  };
}
