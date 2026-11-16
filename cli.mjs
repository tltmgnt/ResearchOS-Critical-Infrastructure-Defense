import { readFile, writeFile, access } from 'node:fs/promises';
import { validateStudy, simulate, seriesCSV } from './src/model.mjs';
if (process.argv.length < 3 || process.argv.length > 5) {
  console.error('Usage: node cli.mjs <study.json> [scenario-id] [results.json|results.csv]');
  process.exitCode=2;
} else {
  try {
    const input=JSON.parse(await readFile(process.argv[2],'utf8'));
    const study=validateStudy(input);
    let scenarioId=study.scenarios[0].id, output;
    if(process.argv[3]?.endsWith('.json')||process.argv[3]?.endsWith('.csv')) output=process.argv[3];
    else {scenarioId=process.argv[3]??scenarioId;output=process.argv[4];}
    const result=simulate(study,scenarioId,true);
    const body=output?.endsWith('.csv')?seriesCSV(result):JSON.stringify(result,null,2)+'\n';
    if(output){
      try {await access(output);throw Error('Refusing to overwrite existing output: '+output);} catch(e){if(e.code!=='ENOENT')throw e;}
      await writeFile(output,body,{flag:'wx'});console.log('Written '+output);
    } else process.stdout.write(body);
  } catch(e) { console.error(e.message);process.exitCode=1; }
}
