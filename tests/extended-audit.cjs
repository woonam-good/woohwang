// Uses only the in-memory server. Never contacts the live scoreboard.
const assert=require('node:assert/strict');
const {setup,test,cases,amounts,round,ledger,clone}=require('./audit.cjs');
function fillResult(a,n=3000){a.el('matchDate').value='2026-10-15';for(const [id,value] of Object.entries({amountNamu:n,amountTaewon:-n,amountSeonggu:0,amountMinjin:0}))a.el(id).value=String(value);}
const submit=a=>a.el('resultForm').listeners.submit({preventDefault(){}});

test('Result retry after a committed but lost response creates exactly one match',async()=>{
  const a=setup();await a.init();fillResult(a);a.loseNextResponse();await submit(a);
  assert.equal(a.server.matches.length,1);await submit(a);assert.equal(a.server.matches.length,1);
});
test('Result retry after reload reuses the unconfirmed submission ID',async()=>{
  const a=setup();await a.init();fillResult(a);a.loseNextResponse();await submit(a);
  const b=setup(a.server,{storage:Object.fromEntries(a.storage),session:Object.fromEntries(a.session)});await b.init();fillResult(b);await submit(b);
  assert.equal(b.server.matches.length,1);
});
test('An edited result form is not cleared by an older delayed submission',async()=>{
  const a=setup();await a.init();fillResult(a);let resets=0;a.el('resultForm').reset=()=>{resets++;};
  const release=a.pauseWrites(),saving=submit(a);await new Promise(setImmediate);a.el('amountNamu').value='5000';release();await saving;
  assert.equal(resets,0);assert.equal(a.el('amountNamu').value,'5000');assert.equal(a.server.matches[0].changes.남우,3000);
});
test('Out-of-order local operations from several tabs are restored without losing a tap',async()=>{
  const actor='11111111-1111-4111-8111-111111111111';
  const ops=[2,1].map(seq=>({ledgerId:'ledger-one',draftId:'initial',actor,seq,player:'남우',delta:3000}));
  const a=setup({settlement:ledger()},{storage:{'today-team-game-v2-settlement-adjustments-v1':JSON.stringify(ops)}});await a.init();
  assert.equal(a.view().draft.남우,6000);await a.flush();assert.equal(a.server.settlement.draft.남우,6000);
});
test('Win-rate color uses actual wins and losses around the 50 percent boundary',()=>{
  const a=setup();assert.equal(a.run('winRateTone({wins:0,losses:0})'),'below-even');assert.equal(a.run('winRateTone({wins:501,losses:499})'),'above-even');
  assert.equal(a.run('winRateTone({wins:499,losses:501})'),'below-even');assert.equal(a.run('winRateTone({wins:500,losses:500})'),'even');
});
test('Damaged legacy per-round details cannot crash page startup',async()=>{
  for(const details of ['broken',[null],{length:1},[{id:'old',changes:null,stake:'<b>5000</b>'}]]){
    const a=setup({matches:[{id:'legacy',date:'2026-10-15',changes:amounts(3000),settlementRounds:details}]});
    await a.init();assert.equal(a.run('ready'),true);
  }
});
test('Concurrent deletion closes the confirmation when the selected record is already gone',async()=>{
  const a=setup({revision:1,sharedRounds:[round('gone')]});await a.init();a.run("pendingSharedDeleteId='gone'");a.el('sharedDeleteModal').hidden=false;
  a.server={revision:2,sharedRounds:[]};await a.el('confirmSharedDelete').listeners.click();assert.equal(a.el('sharedDeleteModal').hidden,true);
});

test('A failed result preserves its fields and can be saved after reconnection',async()=>{
  const a=setup();await a.init();fillResult(a,5000);a.setWriteError(Error('offline'));await submit(a);
  assert.equal(a.el('amountNamu').value,'5000');assert.equal(a.state().matches.length,0);assert.equal(a.run('working'),false);
  a.setWriteError(null);await submit(a);assert.equal(a.server.matches.length,1);assert.equal(a.server.matches[0].changes.남우,5000);
});
test('New intentional identical results remain distinct after a confirmed save',async()=>{
  const a=setup();await a.init();fillResult(a);await submit(a);fillResult(a);await submit(a);
  assert.equal(a.server.matches.length,2);assert.notEqual(a.server.matches[0].id,a.server.matches[1].id);
});
test('A double submit while the first write is delayed records only one result',async()=>{
  const a=setup();await a.init();fillResult(a);const release=a.pauseWrites(),first=submit(a);await new Promise(setImmediate);await submit(a);release();await first;
  assert.equal(a.server.matches.length,1);
});
test('Unconfirmed result fields restore on reload without making a write',async()=>{
  const a=setup();await a.init();fillResult(a,5000);a.setWriteError(Error('offline'));await submit(a);
  const b=setup(a.server,{session:Object.fromEntries(a.session)});await b.init();
  assert.equal(b.el('amountNamu').value,'5000');assert.equal(b.el('amountTaewon').value,'-5000');assert.equal(b.writes,0);
});
test('A malformed result retry backup does not prevent startup or a new save',async()=>{
  for(const value of ['broken','null','{"match":{"id":"bad","date":"bad"}}']){
    const a=setup({},{session:{'today-team-game-v2-result-submission-v1':value}});await a.init();fillResult(a);await submit(a);assert.equal(a.server.matches.length,1);
  }
});
test('Invalid amount and date boundaries never reach the server',async()=>{
  const a=setup();await a.init();
  for(const value of ['', '-', '+3000','3,000','1e3','Infinity','NaN','3000.1','９０００','<script>','9007199254740992']){
    fillResult(a);a.el('amountNamu').value=value;await submit(a);assert.equal(a.writes,0,value);
  }
  for(const value of ['','2026-02-29','2026-04-31','2026-13-01','2026-01-00']){fillResult(a);a.el('matchDate').value=value;await submit(a);assert.equal(a.writes,0,value);}
});
test('Missing/null/malformed stored collections remain renderable',async()=>{
  for(const value of [null,[],false,'bad',{matches:[null,0,'bad'],sharedRounds:[null,{}],settlementHistory:[null],settlement:{}},{matches:{},sharedRounds:{},settlementHistory:'bad'}]){
    const a=setup(value);await a.init();assert.equal(a.run('ready'),true);
  }
});
test('Pending rounds never affect any of the six personal win rates',async()=>{
  const a=setup({sharedRounds:[round('pending',null)],activeSharedRoundId:'pending'});await a.init();
  for(const stat of Object.values(a.run('getPlayerStats()'))){assert.equal(stat.wins,0);assert.equal(stat.losses,0);}
});
test('All 12 allowed team assignments and both winner outcomes produce correct personal counts',async()=>{
  const people=['남우','태원','성구','민진'];let checks=0;
  for(const fixed of ['혜빈','민경'])for(let i=0;i<4;i++)for(let j=i+1;j<4;j++)for(const winnerTeam of [1,2]){
    const t1=[people[i],people[j],fixed],t2=[...people.filter(p=>!t1.includes(p)),fixed==='혜빈'?'민경':'혜빈'];
    const a=setup({sharedRounds:[{id:'outcome',date:'2026-10-15',team1:t1,team2:t2,winnerTeam}]});await a.init();const stats=a.run('getPlayerStats()');
    for(const p of [...t1,...t2]){const win=(t1.includes(p)?1:2)===winnerTeam;assert.equal(stats[p].wins,win?1:0);assert.equal(stats[p].losses,win?0:1);}
    checks++;
  }
  assert.equal(checks,24);
});
test('Two racing team assignments leave only one pending round',async()=>{
  const a=setup({revision:1});await a.init();a.conflict(()=>{a.server={revision:2,sharedRounds:[round('other',null)],activeSharedRoundId:'other'};});
  await a.act('assignSharedTeams()');assert.deepEqual(a.state().sharedRounds.map(r=>r.id),['other']);
});
test('Cancel cannot delete a round another user has already completed',async()=>{
  const a=setup({revision:1,sharedRounds:[round('r',null)],activeSharedRoundId:'r'});await a.init();a.server={revision:2,sharedRounds:[round('r',2)],activeSharedRoundId:'r'};
  await a.act('cancelSharedAssignment()');assert.equal(a.state().sharedRounds[0].winnerTeam,2);
});
test('Conflicting winners keep the first saved outcome exactly once',async()=>{
  const a=setup({revision:1,sharedRounds:[round('r',null)],activeSharedRoundId:'r'});await a.init();a.conflict(()=>{a.server={revision:2,sharedRounds:[round('r',2)],activeSharedRoundId:'r'};});
  await a.act("selectedSharedWinner=1;selectedSharedRoundId='r';recordSharedWinner()");assert.equal(a.state().sharedRounds[0].winnerTeam,2);
  assert.equal(a.run('getPlayerStats().민진.wins'),1);
});
test('An old winner selection cannot save a newly assigned round',async()=>{
  const a=setup({revision:1,sharedRounds:[round('old',null)],activeSharedRoundId:'old'});await a.init();a.run("selectedSharedWinner=1;selectedSharedRoundId='old'");
  a.server={revision:2,sharedRounds:[round('new',null)],activeSharedRoundId:'new'};await a.act('recordSharedWinner()');assert.equal(a.server.sharedRounds[0].winnerTeam,null);
});
test('Repeated CAS conflicts preserve the server and release disabled controls',async()=>{
  const a=setup({revision:1});await a.init();const conflict=()=>{const s=a.server;s.revision++;a.server=s;a.conflict(conflict);};a.conflict(conflict);
  await a.act('assignSharedTeams()');assert.equal(a.writes,8);assert.equal(a.server.sharedRounds,undefined);assert.equal(a.run('working'),false);assert.equal(a.el('drawSharedTeams').disabled,false);
});
test('Deleting a missing normal record does not remove an unrelated newer record',async()=>{
  const a=setup({revision:1,matches:[{id:'old',changes:amounts(3000)}]});await a.init();a.server={revision:2,matches:[{id:'new',changes:amounts(5000)}]};
  await a.act("removeMatch({target:{closest:()=>({dataset:{id:'old'}})}})");assert.deepEqual(a.server.matches.map(x=>x.id),['new']);
});
test('A failed shared deletion keeps its confirmation and all game records',async()=>{
  const a=setup({sharedRounds:[round('r')]});await a.init();a.run("pendingSharedDeleteId='r'");a.el('sharedDeleteModal').hidden=false;a.setWriteError(Error('offline'));
  await a.el('confirmSharedDelete').listeners.click();assert.equal(a.el('sharedDeleteModal').hidden,false);assert.equal(a.state().sharedRounds.length,1);
});
test('Reset failure preserves amounts and allows a successful retry',async()=>{
  const a=setup({settlement:ledger({draft:amounts(5000)})});await a.init();await a.act('resetDailySettlement()');a.setWriteError(Error('offline'));
  await a.el('confirmSettlementReset').listeners.click();assert.equal(a.view().draft.남우,5000);assert.equal(a.el('settlementResetModal').hidden,false);
  a.setWriteError(null);await a.el('confirmSettlementReset').listeners.click();assert.equal(a.view().draft.남우,0);
});
test('Settlement plus/minus does not affect scoreboard totals or 3:3 wins',async()=>{
  const a=setup({settlement:ledger(),sharedRounds:[round('r')],matches:[{id:'m',changes:amounts(3000)}]});await a.init();const stats=clone(a.run('getPlayerStats()'));
  await a.act("adjustSettlementAmount('민진',-1)");await a.flush();assert.deepEqual(clone(a.run('getPlayerStats()')),stats);
});
test('Retry and reload do not duplicate any of 1,000 shuffled buffered operations',async()=>{
  const actors=['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222'];
  const ops=Array.from({length:1000},(_,i)=>({ledgerId:'ledger-one',draftId:'initial',actor:actors[i%2],seq:Math.floor(i/2)+1,player:i%2?'태원':'남우',delta:i%2?-3000:3000})).reverse();
  const a=setup({settlement:ledger()},{storage:{'today-team-game-v2-settlement-adjustments-v1':JSON.stringify(ops)}});await a.init();assert.equal(a.view().draft.남우,1500000);await a.flush();
  const b=setup(a.server,{storage:{'today-team-game-v2-settlement-adjustments-v1':JSON.stringify(ops)}});await b.init();await b.flush();assert.equal(b.state().settlement.draft.태원,-1500000);assert.equal(b.writes,0);
});
test('Generated team statistics and 1,000-match cumulative balances match an independent oracle',async()=>{
  const expected={남우:0,태원:0,성구:0,민진:0};const a=setup();
  const baseline=clone(a.run('historicalRounds'));for(const r of baseline)for(const p of Object.keys(expected))expected[p]+=r.changes[p];
  const matches=Array.from({length:1000},(_,i)=>{const changes={남우:(i%5-2)*3000,태원:(i%7-3)*5000,성구:(i%3-1)*3000,민진:0};changes.민진=-(changes.남우+changes.태원+changes.성구);for(const p of Object.keys(expected))expected[p]+=changes[p];return {id:`m${i}`,date:'2026-10-15',changes};});
  const sharedRounds=Array.from({length:1000},(_,i)=>round(`r${i}`,i%3?1:2));const start=performance.now();
  const b=setup({matches,sharedRounds});await b.init();const stats=b.run('getPlayerStats()');for(const p of Object.keys(expected))assert.equal(stats[p].points,expected[p]);
  assert.equal(stats.남우.wins,666);assert.equal(stats.남우.losses,334);assert.equal(b.el('totalGames').textContent,1008);
  assert.equal((b.el('historyBody').innerHTML.match(/<tr>/g)||[]).length,5);assert.equal((b.el('historyOlderBody').innerHTML.match(/<tr>/g)||[]).length,1003);
  console.log(`METRIC 1000 ordinary + 1000 shared: ${Math.round(performance.now()-start)} ms in simulated DOM, ${Buffer.byteLength(JSON.stringify(b.server))} bytes`);
});
test('Realtime refresh after a read failure recovers without discarding pending input',async()=>{
  const a=setup({revision:1,settlement:ledger()});await a.init();a.run("adjustSettlementAmount('남우',1)");a.setReadError(Error('offline'));
  await a.act('queueRefresh()');assert.equal(a.view().draft.남우,3000);a.setReadError(null);await a.flush();assert.equal(a.server.settlement.draft.남우,3000);
});
test('Remote settlement refresh does not replace focused amount buttons or shared history',async()=>{
  const a=setup({revision:1,settlement:ledger(),sharedRounds:[round('r')]});await a.init();let writes=0;
  for(const id of ['settlementPlayerList','sharedHistoryBody']){const e=a.el(id);let markup=e.innerHTML;Object.defineProperty(e,'innerHTML',{get:()=>markup,set:value=>{writes++;markup=value;}});}
  a.server={...a.server,revision:2,settlement:ledger({draft:amounts(5000)})};await a.act('queueRefresh()');assert.equal(writes,0);assert.equal(a.el('ledgerDraft-남우').textContent,'+5,000원');
});
test('Expanded date groups survive a match or team statistics refresh',async()=>{
  const a=setup({sharedRounds:Array.from({length:8},(_,i)=>round(`r${i}`))});await a.init();
  a.el('sharedHistoryBody').querySelectorAll=()=>[{dataset:{historyDate:'2026-09-30'}}];a.run('renderSharedHistory()');
  assert(a.el('sharedHistoryBody').innerHTML.includes('data-history-date="2026-09-30" open'));
});
test('Concurrency filters remain fixed-size even with 1,000 records',async()=>{
  const a=setup({revision:1000,matches:Array.from({length:1000},(_,i)=>({id:`r${i}`,changes:amounts(3000)}))});await a.init();
  let captures=[];a.run('normalise(state)');
  // The real mutator is executed; intercept only the mock query builder to inspect URL filter values.
  a.run("const oldFrom=db.from;db.from=function(...args){const query=oldFrom(...args),eq=query.eq;query.eq=function(k,v){globalThis.filterCapture.push([k,v]);return eq.call(this,k,v);};return query;};globalThis.filterCapture=[];");
  await a.act('assignSharedTeams()');captures=clone(a.run('filterCapture'));
  assert(captures.some(([k,v])=>k==='game_state->revision'&&v===1000));assert(captures.every(([,v])=>typeof v==='number'||v===null));
});

(async()=>{let passed=0;for(const [name,fn] of cases){try{await fn();console.log(`PASS ${name}`);passed++;}catch(error){console.error(`FAIL ${name}\n${error.stack}`);}}console.log(`${passed}/${cases.length} passed`);if(passed!==cases.length)process.exitCode=1;})();
