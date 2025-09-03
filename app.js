/* Nav dropdown (mobile-friendly, auto-close) */
(function(){
  const menuBtn = document.getElementById('menuBtn');
  const menu = document.getElementById('menuDropdown');
  if(!menuBtn || !menu) return;
  menuBtn.addEventListener('click', ()=> menu.classList.toggle('show'));
  document.addEventListener('click', (e)=>{
    if(!menu.contains(e.target) && e.target!==menuBtn) menu.classList.remove('show');
  });
  menu.querySelectorAll('button').forEach(b=>b.addEventListener('click', ()=>menu.classList.remove('show')));
})();

/* Utility */
const nzDate = (d)=> d ? new Date(d).toLocaleDateString("en-NZ",{weekday:"short", day:"2-digit", month:"2-digit", year:"numeric"}) : "";

/* IndexedDB */
const DB_NAME = 'MCBAppDB';
const DB_VERSION = 1;
let db;

function idbOpen(){
  return new Promise((res,rej)=>{
    const r = indexedDB.open(DB_NAME, DB_VERSION);
    r.onupgradeneeded = (e)=>{
      const db = e.target.result;
      if(!db.objectStoreNames.contains('workLogs')) db.createObjectStore('workLogs',{keyPath:'id',autoIncrement:true});
      if(!db.objectStoreNames.contains('sites')) db.createObjectStore('sites',{keyPath:'id',autoIncrement:true});
      if(!db.objectStoreNames.contains('tasks')) db.createObjectStore('tasks',{keyPath:'id',autoIncrement:true});
      if(!db.objectStoreNames.contains('events')) db.createObjectStore('events',{keyPath:'id',autoIncrement:true});
      if(!db.objectStoreNames.contains('materials')) db.createObjectStore('materials',{keyPath:'id',autoIncrement:true});
      if(!db.objectStoreNames.contains('cutting')) db.createObjectStore('cutting',{keyPath:'id',autoIncrement:true});
    };
    r.onsuccess = ()=>{ db=r.result; res(db); };
    r.onerror = ()=>rej(r.error);
  });
}
function idbAll(store){ return new Promise((res,rej)=>{ const tx=db.transaction(store,'readonly'); const st=tx.objectStore(store); const rq=st.getAll(); rq.onsuccess=()=>res(rq.result||[]); rq.onerror=()=>rej(rq.error);});}
function idbAdd(store, obj){ return new Promise((res,rej)=>{ const tx=db.transaction(store,'readwrite'); tx.objectStore(store).add(obj).onsuccess=(ev)=>res(ev.target.result); tx.onerror=()=>rej(tx.error);});}
function idbPut(store, obj){ return new Promise((res,rej)=>{ const tx=db.transaction(store,'readwrite'); tx.objectStore(store).put(obj).onsuccess=()=>res(true); tx.onerror=()=>rej(tx.error);});}
function idbDel(store, id){ return new Promise((res,rej)=>{ const tx=db.transaction(store,'readwrite'); tx.objectStore(store).delete(id).onsuccess=()=>res(true); tx.onerror=()=>rej(tx.error);});}

/* Optional Firestore mirroring (no-op if fs unavailable) */
const UID = sessionStorage.getItem('username') || 'local';
async function fsAdd(coll, data){ if(!window.fs) return; try{ await fs.collection('users').doc(UID).collection(coll).add({...data, createdAt: new Date()}); }catch(e){ console.warn('fs add fail', coll, e); } }
async function fsDel(coll, id){ /* not keeping mapping here (simple) */ }

/* App controller */
const App = {
  async init(page){
    await idbOpen();
    if('serviceWorker' in navigator){ try{ navigator.serviceWorker.register('service-worker.js'); }catch{} }
    switch(page){
      case 'home': return this.homeInit();
      case 'work': return this.workInit();
      case 'sites': return this.sitesInit();
      case 'tasks': return this.tasksInit();
      case 'calendar': return this.calendarInit();
      case 'materials': return this.materialsInit();
      case 'cutting': return this.cuttingInit();
      case 'reports': return this.reportsInit();
      case 'settings': return this.settingsInit();
    }
  },

  /* Home */
  async homeInit(){
    const events = (await idbAll('events')).sort((a,b)=>new Date(a.date)-new Date(b.date)).slice(0,5);
    const logs = (await idbAll('workLogs')).sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,5);
    const mats = (await idbAll('materials')).filter(m=>m.status==='Pending').slice(0,5);

    const hE=document.getElementById('homeEvents'); if(hE){hE.innerHTML=''; events.forEach(e=>hE.appendChild(card(`<strong>${e.title}</strong> — ${nzDate(e.date)}<br>${e.site||''}`)));}
    const hL=document.getElementById('homeLogs'); if(hL){hL.innerHTML=''; logs.forEach(l=>hL.appendChild(card(`${nzDate(l.date)} — ${l.site}<br>${(l.items||[]).map(t=>`${t.task} (${t.hours}h)`).join(', ')}`)));}
    const hM=document.getElementById('homeMaterials'); if(hM){hM.innerHTML=''; mats.forEach(m=>hM.appendChild(card(`${m.name} — ${nzDate(m.due)} — ${m.site}`)));}
  },

  /* Work Logs */
  async workInit(){
    // site options
    const sites = await idbAll('sites');
    const siteSel = document.getElementById('logSite'); siteSel.innerHTML='';
    sites.forEach(s=>{ const o=document.createElement('option'); o.value=s.name; o.textContent=s.name; siteSel.appendChild(o); });
    // task rows
    const addRow = (preset={task:'',hours:''})=>{
      const row=document.createElement('div'); row.className='row';
      const tSel=document.createElement('select'); tSel.className='taskSel';
      const tasks=awaitGetTasks; // function below
      tasks.forEach(t=>{ const o=document.createElement('option'); o.value=t; o.textContent=t; if(t===preset.task) o.selected=true; tSel.appendChild(o); });
      const hrs=document.createElement('input'); hrs.type='number'; hrs.step='0.25'; hrs.min='0'; hrs.className='taskHrs'; hrs.placeholder='Hours'; hrs.value=preset.hours||'';
      const del=document.createElement('button'); del.className='btn small'; del.textContent='Delete Row'; del.onclick=()=>row.remove();
      row.appendChild(tSel); row.appendChild(hrs); row.appendChild(del);
      document.getElementById('taskRows').appendChild(row);
    };
    const awaitGetTasks = (await idbAll('tasks')).map(t=>t.name);
    document.getElementById('addTaskRowBtn').onclick = ()=>addRow();

    // save
    document.getElementById('saveLogBtn').onclick = async ()=>{
      const date=document.getElementById('logDate').value;
      const site=document.getElementById('logSite').value;
      const notes=document.getElementById('logNotes').value;
      const rows=[...document.querySelectorAll('#taskRows .row')].map(r=>{
        const task=r.querySelector('.taskSel').value;
        const hours=r.querySelector('.taskHrs').value;
        return (task && hours) ? {task, hours} : null;
      }).filter(Boolean);
      const idEdit=document.getElementById('editLogId').value;
      const entry={date,site,items:rows,notes};
      if(idEdit){
        entry.id=Number(idEdit);
        await idbPut('workLogs', entry);
      } else {
        entry.id = await idbAdd('workLogs', entry);
        fsAdd('workLogs', entry);
      }
      this.workRender();
      this.workReset();
    };
    document.getElementById('cancelLogBtn').onclick = ()=>this.workReset();
    this.workRender();
  },
  async workRender(){
    const out=document.getElementById('logsList'); if(!out) return;
    out.innerHTML='';
    const logs=(await idbAll('workLogs')).sort((a,b)=>new Date(a.date)-new Date(b.date));
    logs.forEach(l=>{
      const c=card(`<strong>${nzDate(l.date)}</strong><br>${l.site}<br>${(l.items||[]).map(t=>`${t.task} (${t.hours}h)`).join(', ')}<br>${l.notes||''}`);
      const acts=document.createElement('div'); acts.className='row';
      const e=document.createElement('button'); e.className='btn small'; e.textContent='Edit';
      e.onclick=()=>{ document.getElementById('editLogId').value=l.id; document.getElementById('logDate').value=l.date||''; document.getElementById('logSite').value=l.site||''; document.getElementById('logNotes').value=l.notes||''; document.getElementById('taskRows').innerHTML=''; (l.items||[]).forEach(t=>{const row=document.createElement('div'); row.className='row'; const tSel=document.createElement('input'); tSel.value=t.task; tSel.placeholder='Task'; const hrs=document.createElement('input'); hrs.type='number'; hrs.step='0.25'; hrs.min='0'; hrs.value=t.hours; const del=document.createElement('button'); del.className='btn small'; del.textContent='Delete Row'; del.onclick=()=>row.remove(); row.appendChild(tSel); row.appendChild(hrs); row.appendChild(del); document.getElementById('taskRows').appendChild(row);}); document.getElementById('cancelLogBtn').style.display='inline-block'; };
      const d=document.createElement('button'); d.className='btn small'; d.textContent='Delete';
      d.onclick=async()=>{ await idbDel('workLogs', l.id); this.workRender(); };
      acts.appendChild(e); acts.appendChild(d); c.appendChild(acts); out.appendChild(c);
    });
  },
  workReset(){
    document.getElementById('editLogId').value=''; document.getElementById('logDate').value=''; document.getElementById('logNotes').value=''; document.getElementById('taskRows').innerHTML=''; document.getElementById('cancelLogBtn').style.display='none';
  },

  /* Sites */
  async sitesInit(){
    document.getElementById('saveSiteBtn').onclick = async ()=>{
      const obj={name:siteName.value.trim(),address:siteAddress.value.trim(),contact:siteContact.value.trim(),notes:siteNotes.value.trim()};
      if(!obj.name) return alert('Enter site name');
      const idEdit=document.getElementById('editSiteId').value;
      if(idEdit){ obj.id=Number(idEdit); await idbPut('sites', obj); }
      else { obj.id=await idbAdd('sites', obj); fsAdd('sites', obj); }
      this.sitesRender(); this.sitesReset();
    };
    document.getElementById('cancelSiteBtn').onclick = ()=>this.sitesReset();
    this.sitesRender();
  },
  async sitesRender(){
    const out=document.getElementById('sitesList'); if(!out) return; out.innerHTML='';
    const arr=await idbAll('sites');
    arr.forEach(s=>{
      const c=card(`<strong>${s.name}</strong><br>${s.address||''}<br>${s.contact||''}<br>${s.notes||''}`);
      const e=button('Edit', ()=>{editSiteId.value=s.id; siteName.value=s.name; siteAddress.value=s.address||''; siteContact.value=s.contact||''; siteNotes.value=s.notes||''; cancelSiteBtn.style.display='inline-block';});
      const d=button('Delete', async()=>{ await idbDel('sites', s.id); this.sitesRender();});
      const row=document.createElement('div'); row.className='row'; row.appendChild(e); row.appendChild(d); c.appendChild(row); out.appendChild(c);
    });
  },
  sitesReset(){ editSiteId.value=''; siteName.value=''; siteAddress.value=''; siteContact.value=''; siteNotes.value=''; cancelSiteBtn.style.display='none'; },

  /* Tasks */
  async tasksInit(){
    document.getElementById('addTaskBtn').onclick = async ()=>{
      const name=newTask.value.trim(); if(!name) return;
      const id=await idbAdd('tasks',{name}); fsAdd('tasks',{id,name});
      this.tasksRender();
      newTask.value='';
    };
    this.tasksRender();
  },
  async tasksRender(){
    const out=document.getElementById('tasksList'); out.innerHTML='';
    const arr=await idbAll('tasks');
    arr.forEach((t)=>{
      const c=card(t.name);
      const d=button('Delete', async()=>{ await idbDel('tasks', t.id); this.tasksRender(); });
      c.appendChild(d); out.appendChild(c);
    });
  },

  /* Calendar */
  async calendarInit(){
    // populate sites
    const sites=await idbAll('sites'); const sel=document.getElementById('eventSite'); sel.innerHTML=''; sites.forEach(s=>{const o=document.createElement('option'); o.value=s.name; o.textContent=s.name; sel.appendChild(o);});
    document.getElementById('saveEventBtn').onclick = async ()=>{
      const obj={title:eventTitle.value.trim(), date:eventDateTime.value, site:eventSite.value, notes:eventNotes.value.trim()};
      if(!obj.title||!obj.date) return alert('Enter title & date');
      const idEdit=editEventId.value;
      if(idEdit){ obj.id=Number(idEdit); await idbPut('events', obj); }
      else { obj.id=await idbAdd('events', obj); fsAdd('events', obj); }
      this.calendarRender(); this.calendarReset();
    };
    document.getElementById('cancelEventBtn').onclick = ()=>this.calendarReset();
    this.calendarRender();
  },
  async calendarRender(){
    const out=document.getElementById('eventsList'); out.innerHTML='';
    const arr=(await idbAll('events')).sort((a,b)=>new Date(a.date)-new Date(b.date));
    arr.forEach(e=>{
      const c=card(`<strong>${e.title}</strong><br>${nzDate(e.date)}<br>${e.site||''}<br>${e.notes||''}`);
      const ed=button('Edit', ()=>{ editEventId.value=e.id; eventTitle.value=e.title; eventDateTime.value=e.date; eventSite.value=e.site||''; eventNotes.value=e.notes||''; cancelEventBtn.style.display='inline-block'; });
      const del=button('Delete', async()=>{ await idbDel('events', e.id); this.calendarRender(); });
      const row=document.createElement('div'); row.className='row'; row.appendChild(ed); row.appendChild(del); c.appendChild(row); out.appendChild(c);
    });
  },
  calendarReset(){ editEventId.value=''; eventTitle.value=''; eventDateTime.value=''; eventSite.value=''; eventNotes.value=''; cancelEventBtn.style.display='none'; },

  /* Materials */
  async materialsInit(){
    const sites=await idbAll('sites'); const sel=document.getElementById('matSite'); sel.innerHTML=''; sites.forEach(s=>{const o=document.createElement('option'); o.value=s.name; o.textContent=s.name; sel.appendChild(o);});
    document.getElementById('saveMaterialBtn').onclick = async ()=>{
      const obj={name:matName.value.trim(),site:matSite.value,due:matDue.value,notes:matNotes.value.trim(),status:matStatus.value};
      if(!obj.name||!obj.site||!obj.due) return alert('Enter name, site & due date');
      const idEdit=editMaterialId.value;
      if(idEdit){ obj.id=Number(idEdit); await idbPut('materials', obj); }
      else { obj.id=await idbAdd('materials', obj); fsAdd('materials', obj); }
      this.materialsRender(); this.materialsReset();
    };
    document.getElementById('cancelMaterialBtn').onclick = ()=>this.materialsReset();
    this.materialsRender();
  },
  async materialsRender(){
    const out=document.getElementById('materialsList'); out.innerHTML='';
    const arr=(await idbAll('materials')).sort((a,b)=>new Date(a.due)-new Date(b.due));
    arr.forEach(m=>{
      const c=card(`<strong>${m.name}</strong> — ${nzDate(m.due)} <span class="pill">${m.status}</span><br>${m.site}<br>${m.notes||''}`);
      const ed=button('Edit', ()=>{ editMaterialId.value=m.id; matName.value=m.name; matSite.value=m.site; matDue.value=m.due; matNotes.value=m.notes||''; matStatus.value=m.status||'Pending'; cancelMaterialBtn.style.display='inline-block'; });
      const del=button('Delete', async()=>{ await idbDel('materials', m.id); this.materialsRender(); });
      const row=document.createElement('div'); row.className='row'; row.appendChild(ed); row.appendChild(del); c.appendChild(row); out.appendChild(c);
    });
  },
  materialsReset(){ editMaterialId.value=''; matName.value=''; matSite.value=''; matDue.value=''; matNotes.value=''; matStatus.value='Pending'; cancelMaterialBtn.style.display='none'; },

  /* Cutting */
  async cuttingInit(){
    document.getElementById('addCuttingItemBtn').onclick = async ()=>{
      const item = cuttingItem.value.trim(); if(!item) return;
      const id = await idbAdd('cutting', {text:item});
      fsAdd('cutting',{id,text:item});
      this.cuttingRender();
      cuttingItem.value='';
    };
    this.cuttingRender();
  },
  async cuttingRender(){
    const out=document.getElementById('cuttingList'); out.innerHTML='';
    const arr=await idbAll('cutting');
    arr.forEach((cI)=>{
      const c=card(cI.text);
      const d=button('Delete', async()=>{ await idbDel('cutting', cI.id); this.cuttingRender(); });
      c.appendChild(d); out.appendChild(c);
    });
  },

  /* Reports */
  async reportsInit(){
    const sites=await idbAll('sites'); const sel=document.getElementById('reportSite'); sel.innerHTML="<option value=''>Select Site</option>";
    sites.forEach(s=>{const o=document.createElement('option'); o.value=s.name; o.textContent=s.name; sel.appendChild(o);});
    sel.onchange=()=>this.reportsRender();
  },
  async reportsRender(){
    const siteName=document.getElementById('reportSite').value;
    const out=document.getElementById('reportOutput'); out.innerHTML='';
    if(!siteName) return;
    const makePanel=(title)=>{ const d=document.createElement('div'); d.className='panel'; d.innerHTML=`<h2>${title}</h2>`; return d; };

    const siteLogs=(await idbAll('workLogs')).filter(l=>l.site===siteName).sort((a,b)=>new Date(a.date)-new Date(b.date));
    if(siteLogs.length){ const pnl=makePanel('Work Logs'); siteLogs.forEach(l=>pnl.appendChild(card(`<strong>${nzDate(l.date)}</strong><br>${(l.items||[]).map(t=>`${t.task} (${t.hours}h)`).join(', ')}<br>${l.notes||''}`))); out.appendChild(pnl); }

    const mats=(await idbAll('materials')).filter(m=>m.site===siteName).sort((a,b)=>new Date(a.due)-new Date(b.due));
    if(mats.length){ const pnl=makePanel('Materials'); mats.forEach(m=>pnl.appendChild(card(`<strong>${m.name}</strong> — ${nzDate(m.due)} <span class="pill">${m.status}</span><br>${m.notes||''}`))); out.appendChild(pnl); }

    const ev=(await idbAll('events')).filter(e=>e.site===siteName).sort((a,b)=>new Date(a.date)-new Date(b.date));
    if(ev.length){ const pnl=makePanel('Events'); ev.forEach(e=>pnl.appendChild(card(`<strong>${e.title}</strong> — ${nzDate(e.date)}<br>${e.notes||''}`))); out.appendChild(pnl); }
  },

  /* Settings */
  async settingsInit(){
    document.getElementById('clearAllBtn').onclick = async ()=>{
      if(!confirm('Clear all local data? This cannot be undone.')) return;
      await Promise.all(['workLogs','sites','tasks','events','materials','cutting'].map(async s=>{
        const items=await idbAll(s);
        for(const it of items) await idbDel(s,it.id);
      }));
      alert('Local data cleared.');
    };
  }
};

/* helpers */
function card(html){ const d=document.createElement('div'); d.className='entry-card'; d.innerHTML=html; return d; }
function button(txt, onClick){ const b=document.createElement('button'); b.className='btn small'; b.textContent=txt; b.onclick=onClick; return b; }

window.App = App;
document.addEventListener("DOMContentLoaded", () => {
  const syncBtn = document.getElementById("syncBtn");
  if (syncBtn) {
    syncBtn.addEventListener("click", async () => {
      try {
        await forceSync();
        alert("✅ Data synced with Firestore!");
      } catch (err) {
        alert("⚠️ Sync failed: " + err.message);
      }
    });
  }
});
