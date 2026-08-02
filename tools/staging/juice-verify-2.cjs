const fs=require('fs'),path=require('path');
const {chromium}=require('playwright');
const OUT='tools/forge/staging/juice';
async function boot(b){
  const ctx=await b.newContext({viewport:{width:1200,height:720}});
  const p=await ctx.newPage(); const errs=[];
  p.on('pageerror',e=>errs.push(String(e)));
  p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
  await p.goto('http://localhost:3800/',{waitUntil:'domcontentloaded'});
  await p.waitForTimeout(3500);
  for(const x of await p.locator('button').all()) if(/new game/i.test((await x.textContent())||'')){await x.click();break;}
  await p.waitForFunction('!!window.__melakaDebug',null,{timeout:25000});
  await p.waitForTimeout(1200);
  for(const x of await p.locator('button').all()) if(/begin journey/i.test((await x.textContent())||'')){await x.click();break;}
  await p.waitForTimeout(1000);
  await p.evaluate(()=>window.__melakaDebug.setQuality('high',false));
  return {ctx,p,errs};
}
async function phase(p,want){await p.evaluate(w=>{const d=window.__melakaDebug;for(let i=0;i<40;i++){if(d.timeOfDay()===w)return;try{d.advanceTime(3)}catch(e){}}},want);await p.waitForTimeout(800);}
(async()=>{
const b=await chromium.launch(); const rep={};
// --- WATER: put the player at the quay edge so the strait is in frame
{
  const {ctx,p,errs}=await boot(b);
  await p.evaluate(()=>{try{window.__melakaDebug.travel('waterfront')}catch(e){}});
  await p.waitForTimeout(3200);
  await p.evaluate(()=>window.__melakaDebug.setQuality('high',false));
  await phase(p,'dusk');
  await p.evaluate(()=>window.__melakaDebug.setQuality('high',false));
  // walk north to the water's edge (native y ~120 -> world 360)
  const placed=await p.evaluate(()=>{
    const d=window.__melakaDebug;
    for(let ny=118; ny<200; ny+=2) for(let nx=200; nx<460; nx+=8){
      if(d.walkable(nx*3, ny*3)) { d.place(nx*3, ny*3); return {nx,ny}; }
    }
    return null;
  });
  await p.waitForTimeout(1500);
  const frames=[]; for(let i=0;i<20;i++){frames.push(await p.evaluate(()=>window.__melakaDebug.juice().water)); await p.waitForTimeout(150);}
  rep.water={placed, distinct:[...new Set(frames.filter(Boolean).map(f=>f.frame))].sort((x,y)=>x-y), last:frames[frames.length-1]};
  await p.screenshot({path:path.join(OUT,'water-waterfront-dusk.png')});
  await phase(p,'day'); await p.waitForTimeout(1200);
  await p.screenshot({path:path.join(OUT,'water-waterfront-day.png')});
  rep.water.errors=errs; await ctx.close();
}
// --- FAUNA: put the player at an anchor in each location
for(const [loc,ph] of [['kampung','day'],['rua-direita','day']]){
  const {ctx,p,errs}=await boot(b);
  await p.evaluate(l=>{try{window.__melakaDebug.travel(l)}catch(e){}},loc);
  await p.waitForTimeout(3200);
  await p.evaluate(()=>window.__melakaDebug.setQuality('high',false));
  await phase(p,ph);
  await p.evaluate(()=>window.__melakaDebug.setQuality('high',false));
  await p.waitForTimeout(2000);
  const f0=await p.evaluate(()=>window.__melakaDebug.juice());
  if(f0.fauna.length) await p.evaluate(f=>window.__melakaDebug.place(f.x, f.y+40),f0.fauna[0]);
  await p.waitForTimeout(1500);
  // motion over 12s
  const start=(await p.evaluate(()=>window.__melakaDebug.juice().fauna)).map(f=>f.x+','+f.y);
  await p.waitForTimeout(12000);
  const end=(await p.evaluate(()=>window.__melakaDebug.juice().fauna)).map(f=>f.x+','+f.y);
  const j=await p.evaluate(()=>window.__melakaDebug.juice());
  rep[loc]={count:j.fauna.length,crowd:j.crowd,ids:[...new Set(j.fauna.map(f=>f.id))],
    allStanding:j.fauna.every(f=>f.standing), maxDepth:Math.max(0,...j.fauna.map(f=>f.depth)),
    moved:start.filter((s,i)=>s!==end[i]).length+'/'+start.length,
    states:j.fauna.map(f=>f.id+':'+f.state), errors:errs};
  await p.screenshot({path:path.join(OUT,'fauna-'+loc+'-'+ph+'.png')});
  await ctx.close();
}
await b.close();
fs.writeFileSync(path.join(OUT,'report-2.json'),JSON.stringify(rep,null,2));
console.log(JSON.stringify(rep,null,2));
})();
