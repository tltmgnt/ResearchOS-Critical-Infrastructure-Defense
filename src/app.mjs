import { SECTORS, STATUSES, validateStudy, sampleStudy, simulate, riskScore, riskBand, seriesCSV, makeReport } from './model.mjs';

const STORAGE_KEY = 'researchos-cid-study-v1';
const LABELS = [['overview','▦','Overview'],['assets','⬡','Asset network'],['scenarios','◷','Scenarios'],['risks','◇','Risk register'],['controls','◈','Safeguards'],['report','▤','Evidence & report']];
const byId = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt = value => Number(value).toLocaleString('en-US', {maximumFractionDigits:2});
const genId = prefix => prefix + '-' + (globalThis.crypto?.randomUUID?.() ?? (Date.now().toString(36) + Math.random().toString(36).slice(2)));
const download = (filename, body, mime) => {
  const url = URL.createObjectURL(new Blob([body], {type:mime}));
  const a = document.createElement('a'); a.href=url; a.download=filename; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
};
const load = () => { try { return validateStudy(JSON.parse(localStorage.getItem(STORAGE_KEY))); } catch { return sampleStudy(); } };
let study = load();
let page = 'overview';
let scenarioId = study.scenarios[0].id;
let editingAsset = null;
const activeScenario = () => study.scenarios.find(s => s.id === scenarioId) ?? study.scenarios[0];
const assetName = id => study.assets.find(a => a.id === id)?.name ?? 'Unknown asset';
const note = txt => { const el=byId('notice'); el.textContent=txt; };
const commit = next => {
  try { study = validateStudy(next); try { localStorage.setItem(STORAGE_KEY, JSON.stringify(study)); } catch { note('Storage unavailable: export the JSON file to retain changes.'); } render(); }
  catch (err) { note('Not saved: ' + err.message); }
};
const fld = (label, input, extra='') => `<div class="field ${extra}"><label>${label}</label>${input}</div>`;
const options = (values, chosen) => values.map(v => `<option value="${esc(v)}" ${v===chosen?'selected':''}>${esc(v)}</option>`).join('');
const assetOptions = chosen => study.assets.map(a => `<option value="${esc(a.id)}" ${a.id===chosen?'selected':''}>${esc(a.name)}</option>`).join('');
const title = (heading, sub, tag='') => `<div class="section-head"><div><h2>${heading}</h2><p>${sub}</p></div>${tag?`<span class="tag">${tag}</span>`:''}</div>`;
const metric = (name, value, detail, cls='') => `<div class="card metric"><p class="metric-label">${name}</p><div class="metric-value ${cls}">${value}</div><div class="metric-detail">${detail}</div></div>`;
const riskPill = score => `<span class="pill ${riskBand(score)}">${riskBand(score)} · ${score}/25</span>`;
function drawChart(base, active) {
  const w=720,h=235,left=46,right=12,top=12,bottom=29,minY=0,maxY=100,iw=w-left-right,ih=h-top-bottom;
  const n=base.daily.length;
  const xy=(d,i)=> (left+(n===1?0:i/(n-1)*iw)).toFixed(1)+','+(top+(100-d.index)/100*ih).toFixed(1);
  const line=(result,color)=>`<polyline fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" points="${result.daily.map(xy).join(' ')}"/>`;
  const ticks=[0,25,50,75,100].map(t=>{const y=top+(100-t)/100*ih;return `<line x1="${left}" y1="${y}" x2="${w-right}" y2="${y}" class="chart-grid"/><text x="${left-9}" y="${y+4}" text-anchor="end" font-size="11" fill="#89a5b9">${t}</text>`}).join('');
  return `<svg role="img" aria-label="Daily criticality-weighted service index without safeguards compared to with safeguards" viewBox="0 0 ${w} ${h}" class="service-graph">${ticks}${line(base,'#6388a9')}${line(active,'#55ddbc')}<text x="${left}" y="${h-4}" font-size="11" fill="#89a5b9">DAY 1</text><text x="${w-right}" y="${h-4}" text-anchor="end" font-size="11" fill="#89a5b9">DAY ${n}</text></svg><div class="chart-caption"><span><i class="dot" style="background:#6388a9"></i>Without safeguards</span><span><i class="dot" style="background:#55ddbc"></i>With safeguards</span></div>`;
}
function networkGraph() {
  const rows=study.assets.map((a,i)=>({a,x:25+(i%3)*208,y:25+Math.floor(i/3)*108}));
  const byKey=Object.fromEntries(rows.map(r=>[r.a.id,r]));
  const h=20+Math.ceil(rows.length/3)*108;
  const edges=rows.flatMap(r=>r.a.dependencies.map(d=>{
    const from=byKey[d.id];
    return `<line class="network-line" x1="${from.x+91}" y1="${from.y+42}" x2="${r.x+91}" y2="${r.y+8}"/>`;
  })).join('');
  const boxes=rows.map(r=>`<g><rect class="network-node" x="${r.x}" y="${r.y}" width="181" height="64" rx="11"/><text class="network-label" x="${r.x+12}" y="${r.y+25}">${esc(r.a.name.slice(0,23))}</text><text class="network-sector" x="${r.x+12}" y="${r.y+46}">${esc(r.a.sector.toUpperCase())} • C${r.a.criticality}</text></g>`).join('');
  return `<svg role="img" aria-label="Illustrative asset dependency network. Dashed lines indicate declared reliance." class="network-svg" viewBox="0 0 650 ${h}">${edges}${boxes}</svg>`;
}
function overview() {
  const sc=activeScenario(), base=simulate(study,sc.id,false), enhanced=simulate(study,sc.id,true);
  const sectors=SECTORS.filter(x=>study.assets.some(a=>a.sector===x));
  const worst=Object.entries(enhanced.summary.assetWorst).sort((a,b)=>a[1]-b[1]).slice(0,4);
  return `<div class="content-stack"><div class="warning-box">DEFENSIVE RESEARCH SANDBOX — All included infrastructure examples are fictional. These calculations are not validated risk estimates or operational recommendations.</div>
    <div class="metric-grid">${metric('MODELED ASSETS',study.assets.length,'Across '+sectors.length+' infrastructure sectors','cyan')}${metric('ACTIVE RISK ITEMS',study.risks.filter(r=>r.status!=='Reviewed').length,'Illustrative likelihood × impact')}${metric('MINIMUM SERVICE INDEX',fmt(enhanced.summary.minimum)+'%','Selected scenario · with safeguards','accent')}${metric('ASSUMED CONTROL SPEND',fmt(enhanced.summary.investment),'User-defined cost units','amber')}</div>
    <div class="split"><section class="card">${title('Service continuity projection','Criticality-weighted illustrative service index · '+esc(sc.name),sc.horizon+' DAYS')}${drawChart(base,enhanced)}</section><section class="card">${title('Sector coverage','Modeled asset distribution')}${sectors.map(x=>{const count=study.assets.filter(a=>a.sector===x).length;return `<div class="sector-row"><span>${esc(x)}</span><div class="track"><div class="fill" style="width:${count/study.assets.length*100}%"></div></div><strong>${count}</strong></div>`}).join('')}</section></div>
    <div class="split"><section class="card">${title('Dependency network','Dashed links represent assumed service dependencies','MODEL GRAPH')}${networkGraph()}<p class="section-tip">Connections indicate direction of reliance. They do not imply vulnerabilities, access paths or actual system configurations.</p></section><section class="card">${title('Most affected services','Lowest simulated daily service during this scenario')}${worst.map(([id,val])=>`<div class="event"><div><strong>${esc(assetName(id))}</strong><small>${esc(study.assets.find(a=>a.id===id).sector)}</small></div><strong class="${val<75?'red':'accent'}">${fmt(val)}%</strong></div>`).join('')}<p class="section-tip">Service loss area without controls: ${fmt(base.summary.lossArea)} %-days; with controls: ${fmt(enhanced.summary.lossArea)} %-days.</p></section></div></div>`;
}
function assetsPage() {
  const a=study.assets.find(x=>x.id===editingAsset);
  return `<div class="content-stack"><div class="split"><section class="card">${title(a?'Edit asset':'Register an asset','Use fictional or non-sensitive service descriptions')}
      <form id="asset-form" class="form-grid">${fld('Service name',`<input name="name" required maxlength="100" value="${esc(a?.name??'')}" placeholder="Example: regional communications service">`,'wide')}
      ${fld('Sector',`<select name="sector">${options(SECTORS,a?.sector??'Energy')}</select>`)}
      ${fld('Criticality (1–5)',`<input name="criticality" type="number" min="1" max="5" step="1" required value="${a?.criticality??3}">`)}
      ${fld('Recovery days (1–30)',`<input name="recoveryDays" type="number" min="1" max="30" step="1" required value="${a?.recoveryDays??3}">`)}
      ${fld('Depends on (single service)',`<select name="dependency"><option value="">None</option>${study.assets.filter(x=>x.id!==a?.id).map(x=>`<option value="${esc(x.id)}" ${a?.dependencies.some(d=>d.id===x.id)?'selected':''}>${esc(x.name)}</option>`).join('')}</select>`)}
      ${fld('Dependency influence (0–1)',`<input name="weight" type="number" min="0" max="1" step="0.05" value="${a?.dependencies[0]?.weight??0.5}">`)}
      <div class="form-actions"><button class="btn btn-primary" type="submit">${a?'Save asset':'Add asset'}</button>${a?'<button class="btn btn-quiet" type="button" data-action="cancel-edit">Cancel</button>':''}</div></form>
      <p class="section-tip">The form edits one dependency per asset. Use exported study JSON to model multiple links; importing validates acyclic dependencies.</p></section>
      <section class="card">${title('Dependency view','Service-to-service reliance map')}${networkGraph()}</section></div>
      <section class="card">${title('Asset registry','Criticality and recovery parameters are assumptions',study.assets.length+' ASSETS')}<div class="table-wrap"><table><thead><tr><th>Service</th><th>Sector</th><th>Criticality</th><th>Recovery</th><th>Dependencies</th><th>Actions</th></tr></thead><tbody>${study.assets.map(x=>`<tr><td><strong>${esc(x.name)}</strong></td><td>${esc(x.sector)}</td><td>${x.criticality}/5</td><td>${x.recoveryDays} d</td><td>${x.dependencies.map(d=>esc(assetName(d.id))+' ('+fmt(d.weight)+')').join(', ')||'—'}</td><td><div class="actions"><button class="btn btn-quiet btn-sm" data-action="edit-asset" data-id="${esc(x.id)}">Edit</button><button class="btn btn-danger btn-sm" data-action="remove-asset" data-id="${esc(x.id)}" ${study.assets.length===1?'disabled':''}>Remove</button></div></td></tr>`).join('')}</tbody></table></div></section></div>`;
}
function scenariosPage() {
  const sc=activeScenario(), base=simulate(study,sc.id,false), after=simulate(study,sc.id,true);
  return `<div class="content-stack"><div class="grid-two"><section class="card">${title('Scenario library','Create and evaluate safe, synthetic disruption cases')}
      <div class="field"><label for="scenario-select">Active scenario</label><select id="scenario-select">${study.scenarios.map(x=>`<option value="${esc(x.id)}" ${x.id===sc.id?'selected':''}>${esc(x.name)}</option>`).join('')}</select></div>
      <form id="scenario-create" class="form-grid" style="margin-top:19px">${fld('New scenario name',`<input name="name" required maxlength="100" placeholder="Weather-related service interruption">`,'wide')}<div class="form-actions"><button class="btn btn-primary" type="submit">+ New scenario</button><button class="btn btn-danger" type="button" data-action="remove-scenario" ${study.scenarios.length===1?'disabled':''}>Delete selected</button></div></form></section>
      <section class="card">${title('Study window','Simulation horizon and comparative indicators')}
      <form id="scenario-horizon" class="form-grid">${fld('Horizon (days)',`<input name="horizon" type="number" min="1" max="90" step="1" required value="${sc.horizon}">`)}<div class="form-actions"><button class="btn btn-secondary" type="submit">Update horizon</button></div></form>
      <div class="details" style="margin-top:16px"><div class="detail-item"><span class="kicker">Lowest index</span><div class="big">${fmt(after.summary.minimum)}%</div></div><div class="detail-item"><span class="kicker">Index improvement</span><div class="big accent">${fmt(after.summary.minimum-base.summary.minimum)} pts</div></div><div class="detail-item"><span class="kicker">Recovery day</span><div class="big">${after.summary.recoveredDay??'N/A'}</div></div></div></section></div>
      <div class="split"><section class="card">${title('Disruption timeline','Compare enabled safeguards to an unmitigated baseline')}${drawChart(base,after)}</section><section class="card">${title('Add disruption event','Modeled service impairment only; no adversarial instructions')}
      <form id="event-add" class="form-grid">${fld('Affected service',`<select name="assetId">${assetOptions()}</select>`,'wide')}${fld('Start day',`<input name="startDay" type="number" min="1" max="90" value="2" required>`)}${fld('Duration (days)',`<input name="duration" type="number" min="1" max="60" value="3" required>`)}${fld('Severity (%)',`<input name="severity" type="number" min="0" max="100" value="50" required>`)}<div class="form-actions"><button class="btn btn-primary" type="submit">Add event</button></div></form></section></div>
      <section class="card">${title('Scenario events','All events apply only to the local simulation',sc.events.length+' EVENTS')}${sc.events.length?sc.events.map(ev=>`<div class="event"><div><strong>${esc(assetName(ev.assetId))}</strong><small>Starts day ${ev.startDay} · ${ev.duration} days · ${ev.severity}% assumed impairment</small></div><button class="btn btn-danger btn-sm" data-action="remove-event" data-id="${esc(ev.id)}">Remove</button></div>`).join(''):'<div class="empty">No events. Add an event to test service continuity.</div>'}</section></div>`;
}
function risksPage() {
  const ranks=[...study.risks].sort((a,b)=>riskScore(b)-riskScore(a));
  return `<div class="content-stack"><div class="grid-two"><section class="card">${title('Register a risk','Qualitative 1–5 scoring; not a probabilistic risk estimate')}
    <form id="risk-add" class="form-grid">${fld('Risk statement',`<input name="title" maxlength="140" required placeholder="Example: shared supplier dependence">`,'wide')}${fld('Associated service',`<select name="assetId">${assetOptions()}</select>`,'wide')}${fld('Likelihood (1–5)',`<input name="likelihood" type="number" min="1" max="5" value="3" required>`)}${fld('Impact (1–5)',`<input name="impact" type="number" min="1" max="5" value="3" required>`)}<div class="form-actions"><button class="btn btn-primary" type="submit">Add risk</button></div></form></section>
    <section class="card">${title('Assessment model','Simple likelihood × impact matrix')}<div class="details"><div class="detail-item"><span class="kicker">High (16–25)</span><div class="big red">${ranks.filter(r=>riskScore(r)>=16).length}</div></div><div class="detail-item"><span class="kicker">Moderate (8–15)</span><div class="big amber">${ranks.filter(r=>riskScore(r)>=8&&riskScore(r)<16).length}</div></div><div class="detail-item"><span class="kicker">Low (1–7)</span><div class="big accent">${ranks.filter(r=>riskScore(r)<8).length}</div></div></div><p class="section-tip">Scores are subjective rankings only. There are no threat feeds, exploit analyses, or real-time monitoring in this application.</p></section></div>
    <section class="card">${title('Risk register','Select a workflow status; assessments stay in this browser',ranks.length+' ITEMS')}<div class="table-wrap"><table><thead><tr><th>Risk</th><th>Asset</th><th>Likelihood</th><th>Impact</th><th>Rank</th><th>Status</th><th></th></tr></thead><tbody>${ranks.map(r=>`<tr><td class="truncate"><strong>${esc(r.title)}</strong></td><td>${esc(assetName(r.assetId))}</td><td>${r.likelihood}/5</td><td>${r.impact}/5</td><td>${riskPill(riskScore(r))}</td><td><select aria-label="Status for ${esc(r.title)}" data-risk-status="${esc(r.id)}">${options(STATUSES,r.status)}</select></td><td><button class="btn btn-danger btn-sm" data-action="remove-risk" data-id="${esc(r.id)}">Remove</button></td></tr>`).join('')}</tbody></table></div>${!ranks.length?'<div class="empty">No risks logged.</div>':''}</section></div>`;
}
function controlsPage() {
  return `<div class="content-stack"><div class="warning-box">Safeguard efficacy and cost are user-supplied hypothetical inputs. They do not establish real-world control effectiveness or investment returns.</div>
    <section class="card">${title('Safeguard assumptions','Tune illustrative reductions in modeled local service impairment','WHAT-IF PLANNING')}
    <form id="controls-form"><div class="table-wrap"><table><thead><tr><th>Service</th><th>Enabled</th><th>Effectiveness (%)</th><th>Investment (user units)</th></tr></thead><tbody>${study.assets.map(a=>{const m=study.mitigations.find(x=>x.assetId===a.id)??{efficacy:0,cost:0,enabled:false};return `<tr><td><strong>${esc(a.name)}</strong><div class="muted">${esc(a.sector)}</div></td><td><label class="inline-checkbox"><input name="enabled-${esc(a.id)}" type="checkbox" ${m.enabled?'checked':''}><span>On</span></label></td><td><input aria-label="Assumed effectiveness for ${esc(a.name)}" name="efficacy-${esc(a.id)}" type="number" min="0" max="90" step="1" value="${m.efficacy}" required></td><td><input aria-label="Investment for ${esc(a.name)}" name="cost-${esc(a.id)}" type="number" min="0" max="1000000000" step="1" value="${m.cost}" required></td></tr>`}).join('')}</tbody></table></div><div class="form-actions"><button class="btn btn-primary" type="submit">Apply safeguard assumptions</button></div></form></section>
    <section class="card">${title('Interpretation','How controls affect this version of the simulation')}<p class="muted">When enabled, a safeguard scales down the combined direct and dependency-related impairment of its associated service by the declared effectiveness percentage. It does not change upstream assets, probability of disruption, physical recovery speed, or actual risk. Disabled safeguards have no effect and no assumed investment cost.</p></section></div>`;
}
function reportPage() {
  const sc=activeScenario(), result=simulate(study,sc.id,true);
  return `<div class="content-stack"><div class="grid-two"><section class="card">${title('Evidence & review notes','Preserve assumptions, provenance and reviewer rationale')}
    <form id="note-add" class="form-grid">${fld('Review note',`<textarea name="text" required maxlength="2000" placeholder="Record source context, uncertain assumptions, or review findings"></textarea>`,'wide')}${fld('Source or reference (optional)',`<input name="source" maxlength="250" placeholder="Document title, date, or internal reference">`,'wide')}<div class="form-actions"><button type="submit" class="btn btn-primary">Save note</button></div></form></section>
    <section class="card">${title('Research exports','Download portable evidence of the local study')}<div class="content-stack"><div><strong>JSON — Full project</strong><p class="muted">Assets, dependencies, scenarios, risk register, safeguards and notes.</p><button class="btn btn-secondary btn-sm" data-action="export-json" style="margin-top:9px">Download JSON</button></div><div><strong>CSV — Daily results</strong><p class="muted">Selected scenario service indices with enabled safeguards.</p><button class="btn btn-secondary btn-sm" data-action="export-csv" style="margin-top:9px">Download CSV</button></div><div><strong>Markdown — Research memo</strong><p class="muted">Methods, inputs, comparisons, risks and cited notes.</p><button class="btn btn-secondary btn-sm" data-action="export-report" style="margin-top:9px">Download memo</button></div><p class="range-note">Current model: ${esc(sc.name)} · ${fmt(result.summary.average)}% average service index.</p></div></section></div>
    <section class="card">${title('Recorded evidence notes','References are user assertions and are not independently verified',study.notes.length+' NOTES')}${study.notes.length?study.notes.map(n=>`<div class="note-item"><div><p>${esc(n.text)}</p><small>${n.source?'Reference: '+esc(n.source):'No reference provided'}</small></div><button class="btn btn-danger btn-sm" data-action="remove-note" data-id="${esc(n.id)}">Remove</button></div>`).join(''):'<div class="empty">No notes recorded.</div>'}</section><section class="card danger-zone">${title('Data management','Everything is held in browser storage; exports are your backups')}<button class="btn btn-danger" data-action="reset">Reset to synthetic example</button></section></div>`;
}
function render() {
  if (!study.scenarios.some(x=>x.id===scenarioId)) scenarioId=study.scenarios[0].id;
  byId('navigation').innerHTML=LABELS.map(([key,symbol,label])=>`<button type="button" data-nav="${key}" class="${page===key?'active':''}" ${page===key?'aria-current="page"':''}><span class="nav-symbol">${symbol}</span>${label}</button>`).join('');
  byId('page-title').textContent=LABELS.find(x=>x[0]===page)[2];
  const renderer={overview,assets:assetsPage,scenarios:scenariosPage,risks:risksPage,controls:controlsPage,report:reportPage}[page];
  byId('view').innerHTML=renderer();
}
function handleSubmit(ev) {
  const form=ev.target;
  if (!form.id) return;
  ev.preventDefault();
  const f=new FormData(form), copy=structuredClone(study);
  const value=n=>String(f.get(n)??'').trim();
  const n=n=>Number(value(n));
  try {
    switch(form.id) {
      case 'asset-form': {
        const existing=copy.assets.find(x=>x.id===editingAsset);
        const dep=value('dependency');
        const asset={id:existing?.id??genId('a'),name:value('name'),sector:value('sector'),criticality:n('criticality'),recoveryDays:n('recoveryDays'),dependencies:dep?[{id:dep,weight:n('weight')}]:[]};
        if (existing) Object.assign(existing,asset); else copy.assets.push(asset);
        editingAsset=null;break;
      }
      case 'scenario-create': {
        const s={id:genId('sc'),name:value('name'),horizon:21,events:[]};copy.scenarios.push(s);scenarioId=s.id;break;
      }
      case 'scenario-horizon':copy.scenarios.find(s=>s.id===scenarioId).horizon=n('horizon');break;
      case 'event-add':copy.scenarios.find(s=>s.id===scenarioId).events.push({id:genId('ev'),assetId:value('assetId'),startDay:n('startDay'),duration:n('duration'),severity:n('severity')});break;
      case 'risk-add':copy.risks.push({id:genId('risk'),title:value('title'),assetId:value('assetId'),likelihood:n('likelihood'),impact:n('impact'),status:'Open'});break;
      case 'controls-form':copy.mitigations=copy.assets.map(a=>({assetId:a.id,enabled:f.has('enabled-'+a.id),efficacy:n('efficacy-'+a.id),cost:n('cost-'+a.id)}));break;
      case 'note-add':copy.notes.push({id:genId('note'),text:value('text'),source:value('source')});break;
      default:return;
    }
    commit(copy);
  } catch(err){note('Unable to save: '+err.message);}
}
function handleClick(ev) {
  const nav=ev.target.closest('[data-nav]');
  if (nav) {page=nav.dataset.nav;editingAsset=null;note('');render();return;}
  const target=ev.target.closest('[data-action]'); if (!target) return;
  const action=target.dataset.action, id=target.dataset.id, copy=structuredClone(study);
  try {
    switch(action) {
      case 'edit-asset':editingAsset=id;render();return;
      case 'cancel-edit':editingAsset=null;render();return;
      case 'remove-asset': {
        if (copy.assets.length<2) throw Error('The study must retain one asset');
        if (!confirm('Remove this service and linked risks, events, dependencies and safeguards?')) return;
        copy.assets=copy.assets.filter(a=>a.id!==id);
        for(const a of copy.assets) a.dependencies=a.dependencies.filter(d=>d.id!==id);
        for(const s of copy.scenarios) s.events=s.events.filter(e=>e.assetId!==id);
        copy.risks=copy.risks.filter(r=>r.assetId!==id);copy.mitigations=copy.mitigations.filter(m=>m.assetId!==id);
        if(editingAsset===id) editingAsset=null;break;
      }
      case 'remove-scenario':if(copy.scenarios.length<2)throw Error('Keep at least one scenario');if(!confirm('Delete selected scenario?'))return;copy.scenarios=copy.scenarios.filter(s=>s.id!==scenarioId);scenarioId=copy.scenarios[0].id;break;
      case 'remove-event':copy.scenarios.find(s=>s.id===scenarioId).events=copy.scenarios.find(s=>s.id===scenarioId).events.filter(e=>e.id!==id);break;
      case 'remove-risk':copy.risks=copy.risks.filter(r=>r.id!==id);break;
      case 'remove-note':copy.notes=copy.notes.filter(n=>n.id!==id);break;
      case 'reset':if(!confirm('Replace current study with the synthetic example? Export first to retain your work.'))return;study=sampleStudy();scenarioId=study.scenarios[0].id;editingAsset=null;page='overview';commit(study);return;
      case 'export-json':download('researchos-cid-study.json',JSON.stringify(study,null,2)+'\n','application/json');return;
      case 'export-csv':download('researchos-cid-results.csv',seriesCSV(simulate(study,scenarioId,true)),'text/csv');return;
      case 'export-report':download('researchos-cid-memo.md',makeReport(study,scenarioId),'text/markdown');return;
      default:return;
    }
    commit(copy);
  }catch(err){note('Unable to proceed: '+err.message);}
}
function handleChange(ev) {
  if (ev.target.id==='scenario-select') { scenarioId=ev.target.value;render();return; }
  if (ev.target.dataset.riskStatus) {
    const copy=structuredClone(study); const r=copy.risks.find(x=>x.id===ev.target.dataset.riskStatus);if(r){r.status=ev.target.value;commit(copy);}return;
  }
}
byId('save-json').addEventListener('click',()=>download('researchos-cid-study.json',JSON.stringify(study,null,2)+'\n','application/json'));
byId('load-json').addEventListener('change',async ev=>{
  const file=ev.target.files?.[0];if(!file)return;
  try {
    if(file.size>1024*1024)throw Error('Study exceeds 1 MB import limit');
    const next=validateStudy(JSON.parse(await file.text()));
    if(!confirm('Import this study and replace the current browser data?'))return;
    scenarioId=next.scenarios[0].id;editingAsset=null;page='overview';commit(next);note('Imported study. Export a JSON backup after making changes.');
  }catch(err){note('Import rejected: '+err.message);}finally{ev.target.value='';}
});
document.addEventListener('submit',handleSubmit);
document.addEventListener('click',handleClick);
document.addEventListener('change',handleChange);
render();
