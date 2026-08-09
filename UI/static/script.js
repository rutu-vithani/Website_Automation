// --- Tab switching ---
function switchTab(t){
  ['build','logs','history','settings','github'].forEach(v=>{
    document.getElementById('view-'+v).style.display = v===t?'flex':'none';
    document.getElementById('tab-'+v)?.classList.toggle('active',v===t);
    document.getElementById('tabbtn-'+v)?.classList.toggle('active',v===t);
  });
  if(t==='logs') scrollLog('full-log');
  if(t==='history') loadHistory();
  if(t==='settings') loadSettings();
  if(t==='github') loadGithubProjects();
}

// --- Input ---
function fillReq(txt){
  document.getElementById('req-input').value=txt;
}
function clearAll(){
  document.getElementById('req-input').value='';
  resetAgents();
  resetStats();
  hideLiveBanner();
}

// --- Agents ---
const agentIds=['ceo','fe','db','be','te','deploy'];
const badgeMap={ceo:'badge-ceo',fe:'badge-fe',db:'badge-db',be:'badge-be',te:'badge-te',deploy:'badge-deploy'};
function setAgent(id,state,statusText){
  const card=document.getElementById('card-'+id);
  const st=document.getElementById('status-'+id);
  if(!card||!st) return;
  card.className='agent-card '+state;
  st.textContent=statusText;
  const badge=document.getElementById(badgeMap[id]);
  if(badge) badge.textContent = state==='done' ? '✓' : state==='error' ? '✗' : state==='active' ? '⟳' : '—';
}
function resetAgents(){
  agentIds.forEach(id=>setAgent(id,'waiting','Waiting'));
}
function resetStats(){
  ['stat-tests','stat-files','stat-time','stat-fixes'].forEach(id=>{
    const el=document.getElementById(id);
    if(el) el.textContent='—';
  });
  const st=document.getElementById('stat-tests');
  if(st) st.className='stat-value green';
}
function hideLiveBanner(){
  document.getElementById('live-banner').classList.remove('show','error');
}

// --- Log ---
let logCount=0;
let startTime=null;
let timerHandle=null;
function elapsed(){
  if(!startTime) return '00:00';
  const s=Math.floor((Date.now()-startTime)/1000);
  return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0');
}
function classifyLine(text){
  if(/^|passed|deployed|live at/i.test(text)) return 'success';
  if(/warn|/i.test(text)) return 'warn';
  if(/error|failed|/i.test(text)) return 'error';
  if(/^\[.*Agent\]/i.test(text)) return 'agent';
  return 'muted';
}
function addLog(text,cls){
  if(!cls) cls=classifyLine(text);
  logCount++;
  document.getElementById('log-badge').textContent=logCount;
  const line='<div class="log-line"><span class="log-time">'+elapsed()+'</span><span class="log-text '+cls+'">'+escapeHtml(text)+'</span></div>';
  ['mini-log','full-log'].forEach(id=>{
    const el=document.getElementById(id);
    el.insertAdjacentHTML('beforeend',line);
    scrollLog(id);
  });
}
function escapeHtml(s){
  const d=document.createElement('div');
  d.textContent=s;
  return d.innerHTML;
}
function scrollLog(id){
  const el=document.getElementById(id);
  el.scrollTop=el.scrollHeight;
}
function clearLog(){
  ['mini-log','full-log'].forEach(id=>{
    document.getElementById(id).innerHTML='';
  });
  logCount=0;
  document.getElementById('log-badge').textContent='0';
}

// --- Pipeline (real backend via fetch + SSE) ---
let running=false;

function startPipeline(){
  if(running) return;
  const req=document.getElementById('req-input').value.trim();
  if(!req){
    addLog(' Please enter a website requirement first.','warn');
    return;
  }
  running=true;
  startTime=Date.now();
  resetAgents();
  resetStats();
  hideLiveBanner();
  document.getElementById('run-btn').disabled=true;
  document.getElementById('main-status').innerHTML='<div class="status-dot"></div>Running';
  document.getElementById('main-status').style.color='var(--blue)';

  addLog('══════════════════════════════════════════','muted');
  addLog('  MULTI-AGENT WEBSITE BUILDER — STARTED','info');
  addLog('══════════════════════════════════════════','muted');
  addLog('User requirement: "'+req.slice(0,80)+(req.length>80?'…':'')+'"','info');

  if(timerHandle) clearInterval(timerHandle);
  timerHandle=setInterval(function(){
    document.getElementById('stat-time').textContent=Math.floor((Date.now()-startTime)/1000)+'s';
  },1000);

  fetch('/api/run',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({request:req,push_to_github:document.getElementById('push-github-checkbox').checked})
  })
  .then(function(r){ return r.json().then(function(body){ return {ok:r.ok,body:body}; }); })
  .then(function(res){
    if(!res.ok){
      addLog(' '+(res.body.error||'Failed to start pipeline'),'error');
      finishRun(false);
      return;
    }
    listenToRun(res.body.run_id);
  })
  .catch(function(err){
    addLog('✗ Could not reach the server: '+err.message,'error');
    finishRun(false);
  });
}

function listenToRun(runId){
  const es=new EventSource('/api/stream/'+runId);
  es.onmessage=function(ev){
    let data;
    try{ data=JSON.parse(ev.data); }catch(e){ return; }

    if(data.type==='log'){
      addLog(data.text);
    } else if(data.type==='agent_status'){
      setAgent(data.agent,data.state,data.text||data.state);
    } else if(data.type==='complete'){
      handleComplete(data.result);
    } else if(data.type==='error'){
      addLog('✗ '+data.text,'error');
    } else if(data.type==='eof'){
      es.close();
      finishRun(true);
    }
  };
  es.onerror=function(){
    es.close();
    if(running){
      addLog('⚠ Connection to server lost.','warn');
      finishRun(false);
    }
  };
}

function handleComplete(result){
  if(!result) return;
  const stats=result.stats||{};
  const elTests=document.getElementById('stat-tests');
  const elFiles=document.getElementById('stat-files');
  const elFixes=document.getElementById('stat-fixes');
  if(elTests){
    elTests.textContent=(stats.iterations!=null)?(stats.passed?stats.iterations+'/'+stats.iterations:'—'):'—';
    elTests.className='stat-value '+(stats.passed?'green':'amber');
  }
  if(elFiles) elFiles.textContent=stats.files!=null?stats.files:'—';
  if(elFixes) elFixes.textContent=stats.fixes!=null?stats.fixes:'0';

  addLog('');
  addLog('══════════════════════════════════════════','muted');
  addLog(result.passed?'  PIPELINE COMPLETE ✓':'  PIPELINE FINISHED WITH WARNINGS','success');
  addLog('  Project: '+result.project_slug,'muted');
  addLog('══════════════════════════════════════════','muted');

  if(result.netlify && result.netlify.url){
    showLiveBanner(result.netlify.url, true);
    addLog('✓ Live at: '+result.netlify.url,'success');
  } else {
    showLiveBanner(null,false);
  }

  if(result.pushed && result.pushed.repo_url){
    addLog('✓ Pushed to GitHub: '+result.pushed.repo_url,'success');
  }
}

function showLiveBanner(url, ok){
  const banner=document.getElementById('live-banner');
  const link=document.getElementById('live-banner-link');
  const title=document.getElementById('live-banner-title');
  const sub=document.getElementById('live-banner-sub');
  const icon=document.getElementById('live-banner-icon');
  banner.classList.add('show');
  if(ok && url){
    banner.classList.remove('error');
    icon.textContent='🚀';
    title.textContent='Your website is live';
    sub.textContent=url;
    link.href=url;
    link.style.display='flex';
  } else {
    banner.classList.add('error');
    icon.textContent='⚠️';
    title.textContent='Netlify deploy did not complete';
    sub.textContent='Check the log for details — the generated site files are still saved locally.';
    link.style.display='none';
  }
}

function finishRun(success){
  running=false;
  if(timerHandle){ clearInterval(timerHandle); timerHandle=null; }
  document.getElementById('run-btn').disabled=false;
  const badge=document.getElementById('main-status');
  if(success){
    badge.innerHTML='<div class="status-dot" style="background:var(--green)"></div>Done';
    badge.style.color='var(--green)';
  } else {
    badge.innerHTML='<div class="status-dot" style="background:var(--red)"></div>Error';
    badge.style.color='var(--red)';
  }
}

// --- History (real data) ---
function loadHistory(){
  const list=document.getElementById('history-list');
  fetch('/api/history').then(function(r){ return r.json(); }).then(function(data){
    const items=data.history||[];
    document.getElementById('hist-badge').textContent=items.length;
    if(items.length===0){
      list.innerHTML='<div style="text-align:center;padding:24px;color:var(--text3);font-size:13px">Run your first build to see history here.</div>';
      return;
    }
    list.innerHTML=items.map(function(it){
      return '<div class="history-item">'
        +'<div class="history-dot '+(it.passed?'success':'error')+'"></div>'
        +'<div class="history-info">'
        +'<div class="history-name">'+escapeHtml(it.business_name||it.slug)+'</div>'
        +'<div class="history-meta">'+escapeHtml(it.business_type||'')+' · '+(it.iterations||0)+' iteration(s)</div>'
        +'</div>'
        +'<span class="history-badge '+(it.passed?'success':'error')+'">'+(it.passed?'Passed':'Issues')+'</span>'
        +'</div>';
    }).join('');
  }).catch(function(){
    list.innerHTML='<div style="text-align:center;padding:24px;color:var(--text3);font-size:13px">Could not load history.</div>';
  });
}

// --- Settings (editable, saved to server .env) ---
const SETTINGS_FIELDS = {
  'set-mongo':    'MONGO_URI',
  'set-gh-token': 'GITHUB_TOKEN',
  'set-gh-user':  'GITHUB_USERNAME',
  'set-gh-repo':  'GITHUB_REPO_NAME',
};

function loadSettings(){
  fetch('/api/settings').then(function(r){ return r.json(); }).then(function(data){
    Object.keys(SETTINGS_FIELDS).forEach(function(fieldId){
      const key=SETTINGS_FIELDS[fieldId];
      const info=data[key];
      const el=document.getElementById(fieldId);
      if(!el || !info) return;
      el.value='';
      if(info.value !== undefined){
        // non-sensitive field — show the real value
        el.value=info.value||'';
        el.classList.toggle('is-set', !!info.value);
      } else {
        // sensitive field — never show the value, just indicate it's set
        el.placeholder = info.configured ? '••••••••••••••••' : el.placeholder;
        el.classList.toggle('is-set', !!info.configured);
      }
    });
  }).catch(function(){
    const msg=document.getElementById('settings-msg');
    if(msg){ msg.textContent='Could not load current settings.'; msg.style.color='var(--red)'; }
  });
}

function saveSettings(){
  const payload={};
  Object.keys(SETTINGS_FIELDS).forEach(function(fieldId){
    const el=document.getElementById(fieldId);
    if(el && el.value.trim()){
      payload[SETTINGS_FIELDS[fieldId]]=el.value.trim();
    }
  });
  const msg=document.getElementById('settings-msg');
  if(Object.keys(payload).length===0){
    msg.textContent='Nothing to save — fill in at least one field.';
    msg.style.color='var(--amber)';
    return;
  }
  msg.textContent='Saving…';
  msg.style.color='var(--text3)';
  fetch('/api/settings',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify(payload)
  })
  .then(function(r){ return r.json().then(function(body){ return {ok:r.ok,body:body}; }); })
  .then(function(res){
    if(!res.ok){
      msg.textContent=' '+(res.body.error||'Failed to save settings.');
      msg.style.color='var(--red)';
      return;
    }
    msg.textContent=' Saved: '+res.body.saved.join(', ');
    msg.style.color='var(--green)';
    // clear sensitive fields after save, reload to show updated "already set" state
    Object.keys(SETTINGS_FIELDS).forEach(function(fieldId){
      const el=document.getElementById(fieldId);
      if(el && el.type==='password') el.value='';
    });
    loadSettings();
  })
  .catch(function(err){
    msg.textContent=' Could not reach server: '+err.message;
    msg.style.color='var(--red)';
  });
}

// --- GitHub Upload (push a previously generated project, get repo link) ---
function loadGithubProjects(){
  const list=document.getElementById('github-project-list');
  fetch('/api/history').then(function(r){ return r.json(); }).then(function(data){
    const items=data.history||[];
    if(items.length===0){
      list.innerHTML='<div style="text-align:center;padding:24px;color:var(--text3);font-size:13px">No generated projects yet — run a build first.</div>';
      return;
    }
    list.innerHTML=items.map(function(it){
      const safeSlug=escapeHtml(it.slug);
      return '<div class="gh-project-card" id="gh-card-'+safeSlug+'">'
        +'<div class="gh-project-info">'
        +'<div class="gh-project-name">'+escapeHtml(it.business_name||it.slug)+'</div>'
        +'<div class="gh-project-meta" id="gh-meta-'+safeSlug+'">'+escapeHtml(it.business_type||'')+'</div>'
        +'</div>'
        +'<button class="btn btn-primary btn-small" onclick="pushToGithub(\''+safeSlug+'\')">Push to GitHub</button>'
        +'</div>';
    }).join('');
  }).catch(function(){
    list.innerHTML='<div style="text-align:center;padding:24px;color:var(--text3);font-size:13px">Could not load projects.</div>';
  });
}

function pushToGithub(slug){
  const meta=document.getElementById('gh-meta-'+slug);
  if(meta) meta.textContent='Pushing to GitHub…';
  fetch('/api/push-github',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({slug:slug})
  })
  .then(function(r){ return r.json().then(function(body){ return {ok:r.ok,body:body}; }); })
  .then(function(res){
    if(!meta) return;
    if(!res.ok){
      meta.textContent=' '+(res.body.error||'Push failed');
      meta.style.color='var(--red)';
      return;
    }
    const url=res.body.pushed && res.body.pushed.repo_url;
    if(url){
      meta.innerHTML=' Pushed — <a class="gh-project-link" href="'+url+'" target="_blank" rel="noopener">'+url+'</a>';
    } else {
      meta.textContent=' Pushed to GitHub.';
    }
    meta.style.color='var(--green)';
  })
  .catch(function(err){
    if(meta){ meta.textContent=' Could not reach server: '+err.message; meta.style.color='var(--red)'; }
  });
}

// initial history badge fetch (cheap, non-blocking)
loadHistory();