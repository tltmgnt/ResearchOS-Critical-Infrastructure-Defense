import test from 'node:test';
import assert from 'node:assert/strict';
import { sampleStudy, simulate, validateStudy, riskScore, riskBand, seriesCSV, makeReport } from '../src/model.mjs';
const clone = s => structuredClone(s);

test('synthetic study validates and scenarios simulate deterministically', () => {
  const study = sampleStudy();
  const first = simulate(study, 'outage');
  assert.equal(first.daily.length, 21);
  assert.deepEqual(first, simulate(study, 'outage'));
  assert.ok(first.summary.minimum < 100);
  assert.ok(first.summary.minimum >= 0);
});
test('active safeguards improve service in selected example without altering input', () => {
  const study=sampleStudy(), original=JSON.stringify(study);
  const base=simulate(study,'outage',false), protectedRun=simulate(study,'outage',true);
  assert.ok(protectedRun.summary.minimum > base.summary.minimum);
  assert.ok(protectedRun.summary.lossArea < base.summary.lossArea);
  assert.equal(protectedRun.summary.investment, 69000);
  assert.equal(JSON.stringify(study), original);
});
test('zero-event scenario has 100% service throughout', () => {
  const study=sampleStudy(); study.scenarios[0].events=[];
  const result=simulate(study,'outage');
  assert.equal(result.summary.average,100);
  assert.equal(result.summary.minimum,100);
});
test('severity and recovery follow declared day ordering', () => {
  const study=sampleStudy();
  study.assets=[{id:'a',name:'Asset',sector:'Energy',criticality:5,recoveryDays:2,dependencies:[]}];
  study.risks=[];study.mitigations=[];
  study.scenarios=[{id:'test',name:'Test',horizon:6,events:[{id:'1',assetId:'a',startDay:2,duration:2,severity:80}]}];
  const v=simulate(study,'test');
  assert.deepEqual(v.daily.map(d=>d.index),[100,20,20,60,100,100]);
});
test('dependencies propagate service loss downstream and never exceed bounds', () => {
  const study=sampleStudy();study.mitigations=[];
  const v=simulate(study,'outage');
  const day2=v.daily[1].assets;
  assert.ok(day2.grid < day2.telecom);
  assert.ok(day2.telecom < 100);
  assert.ok(Object.values(day2).every(x=>x>=0&&x<=100));
});
test('rejects cycles, duplicate IDs and broken references', () => {
  const s=sampleStudy();s.assets[0].dependencies=[{id:'hospital',weight:0.5}];
  assert.throws(()=>validateStudy(s),/cycle/i);
  const b=sampleStudy();b.assets[1].id='grid';
  assert.throws(()=>validateStudy(b),/Duplicate/);
  const r=sampleStudy();r.scenarios[0].events[0].assetId='missing';
  assert.throws(()=>validateStudy(r),/missing asset/);
});
test('malformed and nonfinite numeric values are rejected', () => {
  const s=sampleStudy();s.assets[0].criticality=NaN;
  assert.throws(()=>validateStudy(s),/criticality/);
  const s2=sampleStudy();s2.scenarios[0].horizon=1000;
  assert.throws(()=>validateStudy(s2),/horizon/);
});
test('risk classifications, CSV rows and report content', () => {
  const study=sampleStudy(), r=simulate(study,'outage');
  assert.equal(riskScore(study.risks[0]),15); assert.equal(riskBand(15),'Moderate');
  assert.equal(riskBand(16),'High');
  assert.equal(seriesCSV(r).trim().split('\n').length,22);
  const report=makeReport(study,'outage');
  assert.match(report,/## Model boundaries/);assert.match(report,/Synthetic/);
});
test('protective efficacy cannot exceed 90% and controls have no false negative investment',()=>{
  const s=sampleStudy();s.mitigations[0].efficacy=100;
  assert.throws(()=>validateStudy(s),/effectiveness/);
  s.mitigations[0].efficacy=10;s.mitigations[0].cost=-1;
  assert.throws(()=>validateStudy(s),/investment/);
});
