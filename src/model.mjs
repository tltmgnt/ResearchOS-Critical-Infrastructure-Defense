// ResearchOS-CID v1. Deterministic, illustrative resilience research model.
export const SECTORS = ['Energy', 'Water', 'Communications', 'Transportation', 'Healthcare', 'Supply chain'];
export const STATUSES = ['Open', 'Assessing', 'Mitigating', 'Reviewed'];
const num = (v, lo, hi, label) => {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < lo || v > hi) throw Error(label + ' must be between ' + lo + ' and ' + hi);
  return v;
};
const str = (v, label, max = 160) => {
  if (typeof v !== 'string' || !v.trim() || v.length > max) throw Error(label + ' must be 1–' + max + ' characters');
  return v.trim();
};
const list = (v, label, max) => {
  if (!Array.isArray(v) || v.length > max) throw Error(label + ' must be an array (max ' + max + ')');
  return v;
};
const unique = (arr, name) => {
  if (new Set(arr).size !== arr.length) throw Error('Duplicate ' + name);
};
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const sortDependencies = (assets) => {
  const byId = new Map(assets.map(a => [a.id, a]));
  const order = [], visiting = new Set(), done = new Set();
  const visit = (id) => {
    if (visiting.has(id)) throw Error('Dependency cycle detected. Version 1 requires an acyclic asset graph.');
    if (done.has(id)) return;
    visiting.add(id);
    for (const dep of byId.get(id).dependencies) visit(dep.id);
    visiting.delete(id);
    done.add(id);
    order.push(byId.get(id));
  };
  for (const asset of assets) visit(asset.id);
  return order;
};
export function validateStudy(s) {
  if (!s || typeof s !== 'object' || Array.isArray(s) || s.version !== 1) throw Error('Expected ResearchOS-CID study version 1');
  const project = str(s.project, 'Project', 120);
  const assets = list(s.assets, 'Assets', 40).map(a => ({
    id: str(a.id, 'Asset ID', 64), name: str(a.name, 'Asset name', 100),
    sector: SECTORS.includes(a.sector) ? a.sector : (() => { throw Error('Unknown sector'); })(),
    criticality: num(a.criticality, 1, 5, 'Asset criticality'),
    recoveryDays: num(a.recoveryDays, 1, 30, 'Recovery days'),
    dependencies: list(a.dependencies, 'Dependencies', 15).map(d => ({ id: str(d.id, 'Dependency ID', 64), weight: num(d.weight, 0, 1, 'Dependency influence') }))
  }));
  if (!assets.length) throw Error('At least one asset is required');
  unique(assets.map(a => a.id), 'asset IDs');
  const ids = new Set(assets.map(a => a.id));
  for (const a of assets) {
    unique(a.dependencies.map(d => d.id), 'dependency IDs');
    for (const d of a.dependencies) if (!ids.has(d.id) || d.id === a.id) throw Error('Invalid dependency on ' + a.name);
  }
  sortDependencies(assets);
  const scenarios = list(s.scenarios, 'Scenarios', 30).map(sc => ({
    id: str(sc.id, 'Scenario ID', 64), name: str(sc.name, 'Scenario name', 100),
    horizon: num(sc.horizon, 1, 90, 'Scenario horizon'),
    events: list(sc.events, 'Scenario events', 20).map(e => ({
      id: str(e.id, 'Event ID', 64), assetId: str(e.assetId, 'Event asset ID', 64),
      startDay: num(e.startDay, 1, 90, 'Event start day'),
      duration: num(e.duration, 1, 60, 'Event duration'),
      severity: num(e.severity, 0, 100, 'Event severity')
    }))
  }));
  if (!scenarios.length) throw Error('At least one scenario is required');
  unique(scenarios.map(sc => sc.id), 'scenario IDs');
  for (const sc of scenarios) {
    unique(sc.events.map(e => e.id), 'event IDs');
    for (const e of sc.events) if (!ids.has(e.assetId)) throw Error('Scenario event references a missing asset');
  }
  const risks = list(s.risks, 'Risks', 150).map(r => ({
    id: str(r.id, 'Risk ID', 64), assetId: str(r.assetId, 'Risk asset ID', 64),
    title: str(r.title, 'Risk title', 140), likelihood: num(r.likelihood, 1, 5, 'Likelihood'),
    impact: num(r.impact, 1, 5, 'Impact'),
    status: STATUSES.includes(r.status) ? r.status : (() => { throw Error('Unknown risk status'); })()
  }));
  unique(risks.map(r => r.id), 'risk IDs');
  for (const r of risks) if (!ids.has(r.assetId)) throw Error('Risk references a missing asset');
  const mitigations = list(s.mitigations, 'Controls', 40).map(m => ({
    assetId: str(m.assetId, 'Control asset ID', 64),
    efficacy: num(m.efficacy, 0, 90, 'Assumed control effectiveness'),
    cost: num(m.cost, 0, 1e9, 'Assumed investment'), enabled: Boolean(m.enabled)
  }));
  unique(mitigations.map(m => m.assetId), 'control asset IDs');
  for (const m of mitigations) if (!ids.has(m.assetId)) throw Error('Control references a missing asset');
  const notes = list(s.notes, 'Notes', 200).map(n => ({
    id: str(n.id, 'Note ID', 64), text: str(n.text, 'Note', 2000),
    source: typeof n.source === 'string' ? n.source.slice(0, 250).trim() : ''
  }));
  unique(notes.map(n => n.id), 'note IDs');
  return { version: 1, project, assets, scenarios, risks, mitigations, notes };
}
export function simulate(study, scenarioId, applyControls = true) {
  const s = validateStudy(study);
  const scenario = s.scenarios.find(sc => sc.id === scenarioId);
  if (!scenario) throw Error('Scenario not found');
  const ordered = sortDependencies(s.assets);
  const controls = new Map(s.mitigations.filter(m => applyControls && m.enabled).map(m => [m.assetId, m]));
  const daily = [];
  const assetWorst = Object.fromEntries(s.assets.map(a => [a.id, 100]));
  for (let day = 1; day <= scenario.horizon; day++) {
    const service = {};
    for (const a of ordered) {
      let remaining = 1;
      for (const ev of scenario.events) {
        if (ev.assetId !== a.id || day < ev.startDay) continue;
        const elapsed = day - (ev.startDay + ev.duration) + 1;
        const recoveryFactor = elapsed <= 0 ? 1 : Math.max(0, 1 - elapsed / a.recoveryDays);
        remaining *= 1 - (ev.severity / 100) * recoveryFactor;
      }
      const directLoss = 1 - remaining;
      let dependencySurvival = 1;
      for (const dep of a.dependencies) dependencySurvival *= 1 - dep.weight * (1 - service[dep.id] / 100);
      const dependencyLoss = 1 - dependencySurvival;
      const uncappedLoss = 1 - (1 - directLoss) * (1 - dependencyLoss);
      const efficacy = (controls.get(a.id)?.efficacy ?? 0) / 100;
      service[a.id] = 100 * (1 - clamp(uncappedLoss * (1 - efficacy)));
      assetWorst[a.id] = Math.min(assetWorst[a.id], service[a.id]);
    }
    const weight = s.assets.reduce((n, a) => n + a.criticality, 0);
    const index = s.assets.reduce((n, a) => n + a.criticality * service[a.id], 0) / weight;
    const sectors = {};
    for (const sector of SECTORS) {
      const subset = s.assets.filter(a => a.sector === sector);
      if (subset.length) sectors[sector] = subset.reduce((n, a) => n + a.criticality * service[a.id], 0) / subset.reduce((n, a) => n + a.criticality, 0);
    }
    daily.push({ day, index: +index.toFixed(3), sectors, assets: service });
  }
  const lastEnd = scenario.events.reduce((n, e) => Math.max(n, e.startDay + e.duration - 1), 0);
  const recovered = daily.find(d => d.day > lastEnd && d.index >= 99.5);
  const investment = [...controls.values()].reduce((n, m) => n + m.cost, 0);
  const summary = {
    average: +(daily.reduce((n, d) => n + d.index, 0) / daily.length).toFixed(2),
    minimum: +Math.min(...daily.map(d => d.index)).toFixed(2),
    lossArea: +daily.reduce((n, d) => n + 100 - d.index, 0).toFixed(2),
    investment, recoveredDay: recovered ? recovered.day : null, assetWorst
  };
  return { scenario, daily, summary };
}
export function riskScore(r) { return r.likelihood * r.impact; }
export function riskBand(score) { return score >= 16 ? 'High' : score >= 8 ? 'Moderate' : 'Low'; }
export function seriesCSV(result) {
  const sectors = SECTORS.filter(k => result.daily.some(d => k in d.sectors));
  const rows = [['day', 'system_service_pct', ...sectors.map(s => s.toLowerCase().replaceAll(' ', '_') + '_pct')]];
  for (const d of result.daily) rows.push([d.day, d.index, ...sectors.map(s => d.sectors[s] ?? '')]);
  return rows.map(r => r.join(',')).join('\n') + '\n';
}
export function makeReport(study, scenarioId) {
  const s = validateStudy(study), sc = s.scenarios.find(x => x.id === scenarioId);
  if (!sc) throw Error('Scenario not found');
  const base = simulate(s, scenarioId, false), active = simulate(s, scenarioId, true);
  const clean = (v) => String(v).replaceAll('|', '/').replaceAll('\n', ' ');
  const lines = ['# ' + clean(s.project), '', 'ResearchOS-CID v1 • Illustrative, unvalidated scenario analysis', '',
    '## Scenario: ' + clean(sc.name), '', 'Horizon: ' + sc.horizon + ' days. Events: ' + sc.events.length + '.', '',
    '| Metric | Without controls | With enabled controls |', '|---|---:|---:|',
    '| Average service index | ' + base.summary.average + '% | ' + active.summary.average + '% |',
    '| Lowest service index | ' + base.summary.minimum + '% | ' + active.summary.minimum + '% |',
    '| Service deficit (%-days) | ' + base.summary.lossArea + ' | ' + active.summary.lossArea + ' |',
    '| Assumed investment (user units) | 0 | ' + active.summary.investment + ' |', '',
    '## Assets', '', '| Asset | Sector | Criticality | Recovery days |', '|---|---|---:|---:|',
    ...s.assets.map(a => '| ' + clean(a.name) + ' | ' + a.sector + ' | ' + a.criticality + ' | ' + a.recoveryDays + ' |'), '',
    '## Scenario events', '', '| Asset | Day | Duration | Severity |', '|---|---:|---:|---:|',
    ...sc.events.map(ev => '| ' + clean(s.assets.find(a => a.id === ev.assetId)?.name ?? ev.assetId) + ' | ' + ev.startDay + ' | ' + ev.duration + ' | ' + ev.severity + '% |'), '',
    '## Risks', '', '| Risk | Asset | Likelihood | Impact | Score | Status |', '|---|---|---:|---:|---:|---|',
    ...s.risks.map(r => '| ' + clean(r.title) + ' | ' + clean(s.assets.find(a => a.id === r.assetId)?.name ?? '') + ' | ' + r.likelihood + ' | ' + r.impact + ' | ' + riskScore(r) + ' | ' + r.status + ' |'), '',
    '## Research notes and references', '', ...s.notes.map(n => '- ' + clean(n.text) + (n.source ? ' (Reference: ' + clean(n.source) + ')' : '')), '',
    '## Model boundaries', '',
    '- Synthetic, deterministic single-run scenario arithmetic. Not forecasts, attack analysis, safety certification, or operational guidance.',
    '- Dependencies form an acyclic graph; influence weights and protective efficacy are declared assumptions, not measured probabilities.',
    '- Service indices are criticality-weighted illustrative percentages. Investment has user-defined units and no return-on-investment claim.',
    '- No live infrastructure connectivity, system scanning, external feeds, AI, authentication, or independently verified evidence.',
    '- Validate assumptions with qualified domain specialists before any consequential use.', ''];
  return lines.join('\n');
}
export function sampleStudy() {
  return validateStudy({version:1, project:'Regional Infrastructure Resilience — Illustrative Study',
    assets:[
      {id:'grid',name:'Electric grid service',sector:'Energy',criticality:5,recoveryDays:5,dependencies:[]},
      {id:'water',name:'Water treatment service',sector:'Water',criticality:5,recoveryDays:3,dependencies:[{id:'grid',weight:0.7}]},
      {id:'telecom',name:'Emergency communications',sector:'Communications',criticality:5,recoveryDays:2,dependencies:[{id:'grid',weight:0.5}]},
      {id:'freight',name:'Regional freight operations',sector:'Transportation',criticality:4,recoveryDays:4,dependencies:[{id:'grid',weight:0.35},{id:'telecom',weight:0.3}]},
      {id:'hospital',name:'Hospital service continuity',sector:'Healthcare',criticality:5,recoveryDays:2,dependencies:[{id:'grid',weight:0.55},{id:'water',weight:0.3},{id:'telecom',weight:0.25}]},
      {id:'distribution',name:'Essential goods distribution',sector:'Supply chain',criticality:4,recoveryDays:4,dependencies:[{id:'freight',weight:0.65},{id:'telecom',weight:0.25}]}
    ],
    scenarios:[
      {id:'outage',name:'Power service interruption',horizon:21,events:[{id:'ev1',assetId:'grid',startDay:2,duration:3,severity:70}]},
      {id:'dual',name:'Compound services disruption',horizon:25,events:[{id:'ev2',assetId:'grid',startDay:3,duration:2,severity:45},{id:'ev3',assetId:'telecom',startDay:5,duration:4,severity:50}]}
    ],
    risks:[
      {id:'r1',assetId:'water',title:'Dependence on uninterrupted electricity',likelihood:3,impact:5,status:'Assessing'},
      {id:'r2',assetId:'hospital',title:'Continuity during supporting service outages',likelihood:2,impact:5,status:'Open'},
      {id:'r3',assetId:'distribution',title:'Multi-service delivery disruption',likelihood:3,impact:4,status:'Mitigating'}
    ],
    mitigations:[{assetId:'grid',efficacy:25,cost:45000,enabled:true},{assetId:'hospital',efficacy:35,cost:24000,enabled:true}],
    notes:[{id:'n1',text:'All assets, dependencies and controls in this example are fictional research assumptions.',source:'Synthetic demonstration dataset'}]
  });
}
