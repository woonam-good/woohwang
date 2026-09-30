const ladderPlayers = ['민진', '성구', '남우', '태원', '혜빈', '민경'];
const scoreboardPlayers = ['성구', '남우', '태원', '민진'];
const synergyPlayers = ['민진', '남우', '성구', '태원'];
const ledgerPlayers = ['남우', '태원', '성구', '민진'];
const storageKey = 'today-team-game-v2';
const historicalRounds = [
  { label:'1회차', changes:{성구:6000, 남우:0, 태원:0, 민진:-6000} },
  { label:'2회차', changes:{성구:-18000, 남우:12000, 태원:0, 민진:6000} },
  { label:'3회차', changes:{성구:17000, 남우:17000, 태원:-17000, 민진:-17000} },
  { label:'4회차', changes:{성구:0, 남우:12000, 태원:-6000, 민진:-6000} },
  { label:'5회차 (프리장)', changes:{성구:0, 남우:7000, 태원:16000, 민진:-23000} },
  { label:'6회차', changes:{성구:-6000, 남우:6000, 태원:0, 민진:0} },
  { label:'7회차', changes:{성구:-3000, 남우:-3000, 태원:3000, 민진:3000} },
  { label:'8회차', changes:{성구:6000, 남우:-6000, 태원:0, 민진:0} }
];
const supabaseUrl = 'https://rqjktefgudohqkfnfkqx.supabase.co';
const supabaseKey = 'sb_publishable_VCByoPczOrmS7EejQNsa4Q_0906hKjL';
const migrationKey = `${storageKey}-supabase-migrated-v1`;
const db = window.supabase?.createClient(supabaseUrl, supabaseKey);
function validGameDate(value){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;const date=new Date(`${value}T00:00:00Z`);return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value;}
function escapeHtml(value){return String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));}
function settlementIsClosed(ledger){return Boolean(ledger&&(ledger.closed||ledger.posted));}
function normaliseSharedRound(round){if(!round||typeof round.id!=='string')return null;const team=(value)=>Array.isArray(value)?value.filter(player=>ladderPlayers.includes(player)):[];const rungs=Array.isArray(round.rungs)?round.rungs.map(row=>Array.isArray(row)?row.filter(col=>Number.isInteger(col)&&col>=0&&col<5):[]):[];const endpointTeams=Array.isArray(round.endpointTeams)&&round.endpointTeams.length===ladderPlayers.length?round.endpointTeams.map(value=>String(value)==='2'?'2':'1'):['1','1','1','2','2','2'];const paths=Array.isArray(round.paths)?round.paths.filter(path=>path&&typeof path==='object').map(path=>({start:Number(path.start)||0,lanes:Array.isArray(path.lanes)?path.lanes.filter(lane=>Number.isInteger(lane)&&lane>=0&&lane<ladderPlayers.length):[],endLane:Number(path.endLane)||0})):[];return {id:round.id,date:validGameDate(round.date)?round.date:null,createdAt:typeof round.createdAt==='string'?round.createdAt:null,team1:team(round.team1),team2:team(round.team2),rungs,endpointTeams,paths,results:Array.isArray(round.results)?round.results.map(value=>String(value)==='2'?'2':'1'):[],winnerTeam:round.winnerTeam===1||round.winnerTeam===2?round.winnerTeam:null};}
function normaliseLedgerAmounts(value){return Object.fromEntries(ledgerPlayers.map(player=>{const amount=Number(value?.[player]||0);return [player,Number.isSafeInteger(amount)?amount:0];}));}
function normaliseSettlement(value){
  if(!value||typeof value.id!=='string'||!validGameDate(value.date))return null;
  const rawRounds=Array.isArray(value.rounds)?value.rounds.filter(round=>round&&typeof round.id==='string'):[];
  const rounds=rawRounds.map((round,index)=>({id:round.id,draftId:typeof round.draftId==='string'?round.draftId:(rawRounds[index-1]?.id||'initial'),stake:round.stake===5000?5000:3000,changes:normaliseLedgerAmounts(round.changes),createdAt:typeof round.createdAt==='string'?round.createdAt:null}));
  const adjustmentReceipts=Object.fromEntries(Object.entries(value.adjustmentReceipts||{}).filter(([actor,seq])=>/^[a-f0-9-]{36}$/.test(actor)&&Number.isSafeInteger(seq)&&seq>0));
  return {id:value.id,date:value.date,stake:value.stake===5000?5000:3000,draftId:typeof value.draftId==='string'?value.draftId:(rounds[rounds.length-1]?.id||'initial'),draft:normaliseLedgerAmounts(value.draft),rounds,adjustmentReceipts,closed:Boolean(value.closed),posted:Boolean(value.posted),postedMatchId:typeof value.postedMatchId==='string'?value.postedMatchId:null,totals:normaliseLedgerAmounts(value.totals)};
}
function normalise(value){const allSharedRounds=Array.isArray(value?.sharedRounds)?value.sharedRounds.map(normaliseSharedRound).filter(Boolean):[];let activeSharedRoundId=typeof value?.activeSharedRoundId==='string'&&allSharedRounds.some(round=>round.id===value.activeSharedRoundId)?value.activeSharedRoundId:(allSharedRounds[allSharedRounds.length-1]?.id||null);const activeRound=allSharedRounds.find(round=>round.id===activeSharedRoundId),activePendingId=activeRound&&!activeRound.winnerTeam?activeRound.id:null;const sharedRounds=allSharedRounds.filter(round=>round.winnerTeam===1||round.winnerTeam===2||round.id===activePendingId);if(!sharedRounds.some(round=>round.id===activeSharedRoundId))activeSharedRoundId=sharedRounds[sharedRounds.length-1]?.id||null;const nextHyeBinTeam=value?.nextHyeBinTeam===2?2:1,revision=Number.isSafeInteger(value?.revision)&&value.revision>=0?value.revision:0;return {matches:Array.isArray(value?.matches)?value.matches.filter(match=>match&&typeof match==='object').map((match,index)=>({...match,id:match.id??`legacy-${index}`,date:validGameDate(match.date)?match.date:null,changes:normaliseLedgerAmounts(match.changes)})):[],nextHyeBinTeam,nextSharedHyeBinTeam:value?.nextSharedHyeBinTeam===2?2:nextHyeBinTeam,sharedRounds,activeSharedRoundId,settlement:normaliseSettlement(value?.settlement),settlementHistory:Array.isArray(value?.settlementHistory)?value.settlementHistory.map(normaliseSettlement).filter(Boolean):[],revision};}
let localSnapshot;
try { localSnapshot=normalise(JSON.parse(localStorage.getItem(storageKey)||'{}')); }
catch { localSnapshot=normalise({}); }
let state = localSnapshot;
let ready = false;
let working = false;
let pending = Promise.resolve();
let syncWarningShown = false;
let selectedSharedWinner = null;
let selectedSharedRoundId = null;
let pendingSharedDeleteId = null;
let pendingSettlementResetId = null;
let selectedLedgerStake = localSnapshot.settlement?.stake ?? 3000;
const ledgerQueueKey = `${storageKey}-settlement-adjustments-v1`;
let ledgerAdjustments=[];
try{const saved=JSON.parse(localStorage.getItem(ledgerQueueKey)||'[]');if(Array.isArray(saved))ledgerAdjustments=saved.filter(op=>op&&typeof op.ledgerId==='string'&&typeof op.draftId==='string'&&/^[a-f0-9-]{36}$/.test(op.actor)&&Number.isSafeInteger(op.seq)&&op.seq>0&&ledgerPlayers.includes(op.player)&&[3000,5000,-3000,-5000].includes(op.delta));}catch(error){console.warn('Settlement queue could not be read',error);}
const ledgerActor=crypto.randomUUID();
const ledgerOperationKey=op=>`${op.actor}:${op.seq}`;
const managedLedgerOperations=new Set(ledgerAdjustments.map(ledgerOperationKey));
let ledgerSequence=0,ledgerSaveTimer=null,ledgerFlushPromise=null,ledgerSaveError=false,ledgerStorageWarningShown=false;
const ladderRowCount = 9;
const ladderTop = 43;
const ladderXs = [70, 194, 318, 442, 566, 690];
const $ = (id) => document.getElementById(id);
function localDateString(date=new Date()){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
const today = localDateString();
let suggestedDate = today;
function refreshDefaultMatchDate(){const current=localDateString(),input=$('matchDate');if(input.value===suggestedDate)input.value=current;suggestedDate=current;}
function backup(){try{localStorage.setItem(storageKey,JSON.stringify(state));}catch(error){console.warn('Local backup failed',error);}}
function setBusy(value){working=value;for(const id of ['confirmReset','confirmSharedDelete','confirmSettlementReset','resetData','cancelSharedAssignment']){const control=$(id);if(control)control.disabled=value||!ready;}const draw=$('drawSharedTeams'),active=getActiveSharedRound(),hasPending=Boolean(active&&!active.winnerTeam);if(draw){draw.disabled=value||!ready||hasPending;draw.title=hasPending?'현재 팀 배정의 결과를 저장하거나 취소한 뒤 새로 배정할 수 있습니다.':'';}$('resultForm').querySelector('button[type="submit"]').disabled=value||!ready;document.querySelectorAll('.remove-match,.remove-shared-round,.shared-winner-options button').forEach(button=>button.disabled=value||!ready);const save=$('saveSharedWinner');if(save)save.disabled=value||!ready||!selectedSharedWinner||selectedSharedRoundId!==state.activeSharedRoundId;const ledger=displayedSettlement(),ledgerActive=Boolean(ledger&&!settlementIsClosed(ledger)),ledgerHasDraft=hasLedgerDraft(ledger);document.querySelectorAll('[data-ledger-stake]').forEach(button=>button.disabled=settlementIsClosed(ledger));document.querySelectorAll('[data-ledger-player]').forEach(button=>button.disabled=value||!ready||!ledgerActive);const start=$('startSettlement');if(start)start.disabled=value||!ready||ledgerActive;const saveRound=$('saveSettlementRound');if(saveRound)saveRound.disabled=value||!ready||!ledgerActive||!ledgerHasDraft;const reset=$('resetSettlement');if(reset)reset.disabled=value||!ready||!ledger;const retry=$('retrySettlementSave');if(retry)retry.disabled=value||!ready||Boolean(ledgerFlushPromise);const undoRound=$('undoSettlementRound');if(undoRound)undoRound.disabled=value||!ready||!ledgerActive||!ledger?.rounds.length;}
function applyState(value,settlementOnly=false){
  const previous=state;state=normalise(value);reconcileLedgerAdjustments();backup();
  const otherData=({settlement,revision,...rest})=>JSON.stringify(rest);
  if(settlementOnly&&state.settlement&&previous.settlement?.id===state.settlement.id&&!settlementIsClosed(state.settlement)&&otherData(previous)===otherData(state)){
    renderSettlementAmounts();renderSettlementRounds(displayedSettlement());
  }else{renderAll();renderSharedLadder();}
  setBusy(working);
}
async function readServer(){const {data,error}=await db.from('scoreboard_state').select('game_state').eq('id',1).single();if(error)throw error;return data.game_state||{};}
// Compare a short revision number instead of the complete JSON payload. This keeps
// optimistic concurrency protection without creating an oversized request URL.
async function changeServer(change){for(let attempt=0;attempt<8;attempt++){const raw=await readServer(),base=normalise(raw),next=change(base,raw);if(!next)return {state:base,changed:false};const gameState={...normalise(next),revision:base.revision+1};let query=db.from('scoreboard_state').update({game_state:gameState}).eq('id',1);query=Object.prototype.hasOwnProperty.call(raw,'revision')?query.eq('game_state->revision',base.revision):query.is('game_state->revision',null);const {data,error}=await query.select('game_state');if(error)throw error;if(data?.length)return {state:normalise(data[0].game_state),changed:true};}throw new Error('동시에 변경된 기록이 많아 저장하지 못했습니다. 다시 시도해 주세요.');}
function enqueue(change,success){setBusy(true);pending=pending.catch(()=>{}).then(async()=>{try{const result=await changeServer(change);applyState(result.state);if(result.changed&&success)showToast(success);return result.changed;}catch(error){console.error('Scoreboard save failed',error);showToast('서버 저장에 실패했습니다. 다시 시도해 주세요.');return false;}finally{setBusy(false);}});return pending;}
async function refresh(){if(!ready||working)return;try{const latest=normalise(await readServer());if(JSON.stringify(latest)!==JSON.stringify(state))applyState(latest);syncWarningShown=false;}catch(error){console.error('Scoreboard refresh failed',error);if(!syncWarningShown){showToast('동기화에 실패했습니다. 새로고침해 주세요.');syncWarningShown=true;}}}
function queueRefresh(){pending=pending.catch(()=>{}).then(refresh);}
function formatDate(value){return new Intl.DateTimeFormat('ko-KR',{month:'long',day:'numeric',weekday:'short'}).format(new Date(`${value}T00:00:00`));}
function formatHistoryDate(value){return validGameDate(value)?new Intl.DateTimeFormat('ko-KR',{year:'numeric',month:'long',day:'numeric',weekday:'short'}).format(new Date(`${value}T00:00:00`)):'날짜 미상';}
function formatEarnerDate(value){return validGameDate(value)?new Intl.DateTimeFormat('ko-KR',{year:'numeric',month:'long',day:'numeric'}).format(new Date(`${value}T00:00:00`)):'날짜 미상';}
function formatWon(value){return `${value<0?'−':''}${Math.abs(value).toLocaleString()}원`;}
function formatChange(value){return `${value>0?'+':value<0?'−':''}${Math.abs(value).toLocaleString()}원`;}
function shuffle(items){const a=[...items];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function totalChange(changes){return scoreboardPlayers.reduce((sum,player)=>sum+Number(changes[player]||0),0);}
function getPlayerStats(){const stats=Object.fromEntries(ladderPlayers.map(name=>[name,{points:0,wins:0,losses:0}]));[...historicalRounds,...state.matches].forEach(entry=>scoreboardPlayers.forEach(player=>{stats[player].points+=Number(entry.changes?.[player]||0);}));state.sharedRounds.forEach(round=>{if(round.winnerTeam!==1&&round.winnerTeam!==2)return;for(const player of round.team1){if(stats[player])round.winnerTeam===1?stats[player].wins+=1:stats[player].losses+=1;}for(const player of round.team2){if(stats[player])round.winnerTeam===2?stats[player].wins+=1:stats[player].losses+=1;}});return stats;}
function winRate(stats){const games=stats.wins+stats.losses;return games?Math.round(stats.wins/games*100):0;}
function winRateTone(stats){const rate=winRate(stats);return rate>50?'above-even':rate===50?'even':'below-even';}
function renderDashboard(){const stats=getPlayerStats(),ordered=scoreboardPlayers.map(name=>({name,...stats[name]})).sort((a,b)=>b.points-a.points||a.name.localeCompare(b.name,'ko'));$('scoreboard').innerHTML=ordered.map((p,i)=>`<div class="rank-row money-rank"><span class="rank ${i===0||p.points>0?'medal':''}">${String(i+1).padStart(2,'0')}</span><strong class="player-name">${p.name}</strong><span class="score-points"><b>누적</b><em class="${p.points>0?'positive-score':''}">${formatWon(p.points)}</em></span></div>`).join('');$('totalGames').textContent=historicalRounds.length+state.matches.length;const top=ordered[0],bottom=ordered[ordered.length-1];$('topWinner').textContent=`갓${top.name.slice(1)}`;$('topWinnerDetail').textContent=`누적 1위 · ${formatWon(top.points)}`;$('liquidityProvider').textContent=`족${bottom.name.slice(1)}`;$('liquidityProviderDetail').textContent=`누적 4위 · ${formatWon(bottom.points)}`;$('heroCopy').textContent=`${bottom.name.slice(-1)}황의 활약을 응원합니다.`;const recent=state.matches[state.matches.length-1],recentEarner=$('recentEarner'),recentDetail=$('recentEarnerDetail');if(recent){const largest=Math.max(...scoreboardPlayers.map(player=>Number(recent.changes?.[player]||0))),earners=scoreboardPlayers.filter(player=>Number(recent.changes?.[player]||0)===largest);recentEarner.textContent=earners.map(player=>`${player.slice(-1)}황~`).join(', ');recentDetail.textContent=`${formatEarnerDate(recent.date)} + ${formatWon(largest)}`;}else{recentEarner.textContent='-';recentDetail.textContent='입력된 경기 기록이 없어요.';}$('historyCount').textContent=`${historicalRounds.length+state.matches.length} RECORDS`;}
function emptyLedgerAmounts(){return Object.fromEntries(ledgerPlayers.map(player=>[player,0]));}
function settlementTotals(settlement,includeDraft=true){const totals=emptyLedgerAmounts();settlement.rounds.forEach(round=>ledgerPlayers.forEach(player=>{totals[player]+=round.changes[player];}));if(includeDraft)ledgerPlayers.forEach(player=>{totals[player]+=settlement.draft[player];});return totals;}
function hasLedgerDraft(settlement){return Boolean(settlement&&Object.values(settlement.draft).some(amount=>amount!==0));}
// Receipts retain one sequence number per browser, rather than one entry per tap.
// A draft ID also lets late taps reach the correct round after another screen saves it.
function applyLedgerAdjustments(ledger,operations){
  if(!ledger||settlementIsClosed(ledger))return ledger;
  const next={...ledger,draft:{...ledger.draft},rounds:ledger.rounds.map(round=>({...round,changes:{...round.changes}})),adjustmentReceipts:{...ledger.adjustmentReceipts}};
  for(const op of operations){
    if(op.ledgerId!==next.id||(next.adjustmentReceipts[op.actor]||0)>=op.seq)continue;
    const round=op.draftId===next.draftId?null:next.rounds.find(item=>item.draftId===op.draftId);
    if(op.draftId!==next.draftId&&!round)continue;
    const amounts=round?round.changes:next.draft,amount=amounts[op.player]+op.delta;
    if(!Number.isSafeInteger(amount))throw Error('입력 가능한 금액 범위를 넘었습니다.');
    amounts[op.player]=amount;if(!round)next.stake=Math.abs(op.delta);
    next.adjustmentReceipts[op.actor]=op.seq;
  }
  return next;
}
function displayedSettlement(){return applyLedgerAdjustments(state.settlement,ledgerAdjustments);}
function persistLedgerAdjustments(){
  try{
    // Tabs share localStorage. Leave other tabs' new operations in their backup.
    const raw=localStorage.getItem(ledgerQueueKey);let saved=[];
    try{saved=JSON.parse(raw||'[]');}catch{ /* Replace a damaged backup on the next write. */ }
    const otherOperations=Array.isArray(saved)?saved.filter(op=>op&&!managedLedgerOperations.has(ledgerOperationKey(op))):[];
    localStorage.setItem(ledgerQueueKey,JSON.stringify([...otherOperations,...ledgerAdjustments]));
  }
  catch(error){console.warn('Settlement queue backup failed',error);if(ledgerAdjustments.length&&!ledgerStorageWarningShown){ledgerStorageWarningShown=true;showToast('브라우저 임시 저장이 차단되어 있어요. 저장 완료를 확인한 뒤 화면을 닫아 주세요.');}}
}
function reconcileLedgerAdjustments(){
  const ledger=state.settlement;let stale=false;
  ledgerAdjustments=ledgerAdjustments.filter(op=>{
    if(ledger&&(ledger.adjustmentReceipts[op.actor]||0)>=op.seq)return false;
    if(!ledger||settlementIsClosed(ledger)||op.ledgerId!==ledger.id||(op.draftId!==ledger.draftId&&!ledger.rounds.some(round=>round.draftId===op.draftId))){stale=true;return false;}
    return true;
  });
  if(!ledgerAdjustments.length)ledgerSaveError=false;
  persistLedgerAdjustments();
  if(stale)showToast('다른 화면에서 정산 기록이 변경되어 현재 기록으로 갱신했어요.');
}
function renderSettlementSync(){
  const status=$('settlementSyncStatus'),retry=$('retrySettlementSave');
  status.textContent=ledgerAdjustments.length?(ledgerSaveError?'저장하지 못했어요. 입력은 이 브라우저에 남아 있어요.':'저장 중…'):state.settlement?'저장 완료':'';
  status.classList.toggle('save-error',ledgerSaveError);retry.hidden=!ledgerSaveError;
  retry.disabled=working||!ready||Boolean(ledgerFlushPromise);
}
function renderSettlementAmounts(){
  const ledger=displayedSettlement();if(!ledger||settlementIsClosed(ledger)){renderSettlementSync();return;}
  const totals=settlementTotals(ledger);
  for(const player of ledgerPlayers){
    for(const [id,amount] of [[`ledgerDraft-${player}`,ledger.draft[player]],[`ledgerTotal-${player}`,totals[player]]]){
      const element=$(id);if(element){element.textContent=formatChange(amount);element.classList.toggle('positive',amount>0);element.classList.toggle('negative',amount<0);}
    }
  }
  $('settlementRoundCount').textContent=`${ledger.rounds.length}판${hasLedgerDraft(ledger)?' + 현재 판':''}`;
  const balance=ledgerPlayers.reduce((sum,player)=>sum+totals[player],0),note=$('settlementBalance');
  note.hidden=balance===0;note.textContent=balance===0?'':`네 명 합계 차액 ${formatChange(balance)} · 금액을 확인해 주세요.`;
  $('saveSettlementRound').disabled=working||!ready||!hasLedgerDraft(ledger);renderSettlementSync();
}
function scheduleLedgerSave(){
  if(ledgerSaveTimer!==null||ledgerFlushPromise||!ready||!ledgerAdjustments.length)return;
  ledgerSaveTimer=setTimeout(()=>{ledgerSaveTimer=null;flushLedgerAdjustments();},350);
}
function flushLedgerAdjustments(){
  if(ledgerSaveTimer!==null){clearTimeout(ledgerSaveTimer);ledgerSaveTimer=null;}
  if(ledgerFlushPromise)return ledgerFlushPromise;
  if(!ready||!ledgerAdjustments.length)return Promise.resolve(!ledgerAdjustments.length);
  const batch=[...ledgerAdjustments];ledgerSaveError=false;
  const job=pending.catch(()=>{}).then(async()=>{
    try{
      const result=await changeServer(base=>{
        const ledger=applyLedgerAdjustments(base.settlement,batch);
        return JSON.stringify(ledger)===JSON.stringify(base.settlement)?null:{...base,settlement:ledger};
      });
      applyState(result.state,true);return true;
    }catch(error){console.error('Settlement save failed',error);ledgerSaveError=true;return false;}
    finally{ledgerFlushPromise=null;renderSettlementSync();if(!ledgerSaveError)scheduleLedgerSave();}
  });
  ledgerFlushPromise=job;pending=job;renderSettlementSync();return job;
}
function renderSettlementRounds(settlement){
  const rounds=settlement.rounds;$('settlementRoundLabel').textContent=`${rounds.length+1}판 기록`;$('settlementRoundsCount').textContent=`${rounds.length}판`;
  $('settlementRoundList').innerHTML=rounds.length?[...rounds].reverse().map((round,index)=>`<div class="settlement-round-item"><strong>${rounds.length-index}판 <small>${round.stake.toLocaleString()}원 선택</small></strong><span>${ledgerPlayers.filter(player=>round.changes[player]!==0).map(player=>`${player} ${formatChange(round.changes[player])}`).join(' · ')||'변동 없음'}</span></div>`).join(''):'<p class="settlement-empty-rounds">아직 기록한 판이 없어요.</p>';
}
function renderSettlement(){
  const settlement=displayedSettlement(),start=$('startSettlement'),active=$('settlementActive'),closed=settlementIsClosed(settlement),stake=selectedLedgerStake;
  document.querySelectorAll('[data-ledger-stake]').forEach(button=>{button.setAttribute('aria-pressed',String(Number(button.dataset.ledgerStake)===stake));button.disabled=closed;});
  start.hidden=Boolean(settlement&&!closed);start.textContent=closed?'새 정산 시작':'오늘 정산 시작';active.hidden=!settlement||closed;
  $('settlementDate').textContent=settlement?closed?'새 정산을 시작하거나 기록을 초기화해 주세요.':`${formatHistoryDate(settlement.date)} 정산`:'정산을 시작하면 네 명이 함께 기록할 수 있어요.';
  $('resetSettlement').hidden=!settlement;
  if(!settlement||closed){$('settlementPlayerList').innerHTML='';$('settlementTotals').innerHTML='';$('settlementRoundList').innerHTML='';renderSettlementSync();return;}
  $('settlementPlayerList').innerHTML=ledgerPlayers.map(player=>`<div class="settlement-player-row"><strong>${player}</strong><span id="ledgerDraft-${player}" class="settlement-draft-amount"></span><div class="settlement-adjust-actions"><button type="button" data-ledger-player="${player}" data-ledger-direction="1" aria-label="${player} ${stake.toLocaleString()}원 더하기">+</button><button type="button" data-ledger-player="${player}" data-ledger-direction="-1" aria-label="${player} ${stake.toLocaleString()}원 빼기">−</button></div></div>`).join('');
  $('settlementTotals').innerHTML=ledgerPlayers.map(player=>`<div class="settlement-total-row"><span>${player}</span><strong id="ledgerTotal-${player}"></strong></div>`).join('');
  renderSettlementRounds(settlement);
  renderSettlementAmounts();setBusy(working);
}
function ladderRowY(row,height){return ladderTop+((height-45-ladderTop)/(ladderRowCount+1))*(row+1);}
function traceLadder(start,rungs){let lane=start;const lanes=[lane];for(const row of rungs){if(row.includes(lane))lane+=1;else if(row.includes(lane-1))lane-=1;lanes.push(lane);}return {start,lanes,endLane:lane};}
function createRotatingThreeByThreeLadder(){const rungs=[];for(let row=0;row<ladderRowCount;row+=1){const rowRungs=[];for(const col of shuffle([0,1,2,3,4])){if(Math.random()<.56&&!rowRungs.includes(col-1)&&!rowRungs.includes(col+1))rowRungs.push(col);}if(!rowRungs.length)rowRungs.push(Math.floor(Math.random()*5));rowRungs.sort((a,b)=>a-b);rungs.push(rowRungs);}const paths=ladderPlayers.map((_,index)=>traceLadder(index,rungs));const hyeBinTeam=Math.random()<.5?'1':'2',minKyeongTeam=hyeBinTeam==='1'?'2':'1',hyeBinPartners=new Set(shuffle(ladderPlayers.slice(0,4)).slice(0,2));const results=ladderPlayers.map((player,index)=>index===4?hyeBinTeam:index===5?minKyeongTeam:hyeBinPartners.has(player)?hyeBinTeam:minKyeongTeam);const endpointTeams=Array(ladderPlayers.length);paths.forEach(path=>{endpointTeams[path.endLane]=results[path.start];});return {rungs,endpointTeams,paths,results};}
function drawLadderModel(canvasId,assignment){const canvas=$(canvasId);if(!canvas)return;const ctx=canvas.getContext('2d'),h=canvas.height,bottom=h-45;ctx.clearRect(0,0,canvas.width,h);ctx.strokeStyle='#c9d2e6';ctx.lineWidth=2;ctx.setLineDash([4,5]);ladderXs.forEach(x=>{ctx.beginPath();ctx.moveTo(x,ladderTop);ctx.lineTo(x,bottom);ctx.stroke();});ctx.setLineDash([]);if(!assignment)return;ctx.strokeStyle='#7d95de';ctx.lineWidth=3;for(let row=0;row<assignment.rungs.length;row+=1){const y=ladderRowY(row,h);for(const col of assignment.rungs[row]){ctx.beginPath();ctx.moveTo(ladderXs[col],y);ctx.lineTo(ladderXs[col+1],y);ctx.stroke();}}for(const path of assignment.paths){let lane=path.start;ctx.beginPath();ctx.moveTo(ladderXs[lane],ladderTop);for(let row=0;row<ladderRowCount;row+=1){const y=ladderRowY(row,h);const nextLane=path.lanes[row+1]??lane;ctx.lineTo(ladderXs[lane],y);if(nextLane!==lane)ctx.lineTo(ladderXs[nextLane],y);lane=nextLane;}ctx.lineTo(ladderXs[lane],bottom);ctx.strokeStyle=assignment.results[path.start]==='1'?'rgba(40,87,238,.56)':'rgba(243,72,114,.56)';ctx.lineWidth=5;ctx.lineCap='round';ctx.stroke();ctx.fillStyle=assignment.results[path.start]==='1'?'#2857ee':'#f34872';ctx.beginPath();ctx.arc(ladderXs[lane],bottom,5,0,Math.PI*2);ctx.fill();}}
function renderTargets(targetId,assignment){const targetTeams=assignment?.endpointTeams||['1','1','1','2','2','2'];$(targetId).innerHTML=targetTeams.map(team=>`<span class="${team==='1'?'team-one':'team-two'}">${team} TEAM</span>`).join('');}
function getActiveSharedRound(){return state.sharedRounds.find(round=>round.id===state.activeSharedRoundId)||null;}
function nextSharedTeamAfter(rounds){const latest=[...rounds].reverse().find(round=>round.winnerTeam===1||round.winnerTeam===2);return latest?.team1.includes('혜빈')?2:1;}
function renderSharedLadder(){const round=getActiveSharedRound();$('sharedLadderPlayers').innerHTML=ladderPlayers.map(p=>`<span>${p}</span>`).join('');renderTargets('sharedLadderTargets',round);drawLadderModel('sharedLadderCanvas',round);const empty=$('sharedAssignmentEmpty'),result=$('sharedAssignmentResult'),outcome=$('sharedOutcomeForm'),status=$('sharedLiveStatus');if(!round){selectedSharedWinner=null;selectedSharedRoundId=null;empty.hidden=false;result.hidden=true;outcome.hidden=true;status.textContent='아직 공유된 3:3 팀 배정이 없습니다.';return;}empty.hidden=true;result.hidden=false;result.innerHTML=teamCard(1,round.team1)+teamCard(2,round.team2);if(round.winnerTeam){selectedSharedWinner=null;selectedSharedRoundId=null;outcome.hidden=true;status.textContent=`${round.date?formatHistoryDate(round.date):'3:3 경기'} · ${round.winnerTeam} TEAM 승리 결과가 저장되어 모두에게 공유되었습니다.`;}else{if(selectedSharedRoundId!==round.id){selectedSharedWinner=null;selectedSharedRoundId=round.id;}outcome.hidden=false;status.textContent=`${round.date?formatHistoryDate(round.date):'3:3 경기'} · 팀 배정 완료, 승리 팀을 선택해 결과를 저장하세요.`;renderSharedOutcomeControls();}}
function renderSharedOutcomeControls(){const activeId=state.activeSharedRoundId;document.querySelectorAll('.shared-winner-options [data-winner]').forEach(button=>{const selected=Number(button.dataset.winner)===selectedSharedWinner&&selectedSharedRoundId===activeId;button.classList.toggle('selected',selected);button.setAttribute('aria-pressed',String(selected));});const summary=$('sharedOutcomeSelection');if(summary)summary.textContent=selectedSharedWinner&&selectedSharedRoundId===activeId?`${selectedSharedWinner} TEAM 승리를 저장할 준비가 됐습니다.`:'승리 팀을 선택해 주세요.';setBusy(working);}
function teamCard(team,members){return `<div class="team-result ${team===2?'team2':''}"><h3><b>${team} TEAM</b> · ${team===1?'BLUE SIDE':'RED SIDE'}</h3><div class="member-chips">${members.map(p=>`<span>${p}</span>`).join('')}</div></div>`;}
function assignSharedTeams(){if(!ready||working)return;const active=getActiveSharedRound();if(active&&!active.winnerTeam){showToast('현재 팀 배정의 결과를 저장하거나 취소한 뒤 새로 배정해 주세요.');return;}enqueue(base=>{const serverActive=base.sharedRounds.find(round=>round.id===base.activeSharedRoundId);if(serverActive&&!serverActive.winnerTeam)return null;const ladder=createRotatingThreeByThreeLadder(),team1=[],team2=[];ladder.results.forEach((team,index)=>(team==='1'?team1:team2).push(ladderPlayers[index]));const round={id:crypto.randomUUID(),date:localDateString(),createdAt:new Date().toISOString(),...ladder,team1,team2,winnerTeam:null};return {...base,sharedRounds:[...base.sharedRounds,round],activeSharedRoundId:round.id,nextSharedHyeBinTeam:base.nextSharedHyeBinTeam===1?2:1};},'무작위 3:3 팀 배정 결과가 모두에게 전송됐어요!');}
function chooseSharedWinner(event){const button=event.target.closest('[data-winner]');if(!button||!ready||working)return;selectedSharedWinner=Number(button.dataset.winner);selectedSharedRoundId=state.activeSharedRoundId;renderSharedOutcomeControls();}
function recordSharedWinner(){if(!ready||working||!selectedSharedWinner||selectedSharedRoundId!==state.activeSharedRoundId)return;const winnerTeam=selectedSharedWinner,activeId=selectedSharedRoundId;enqueue(base=>{const round=base.sharedRounds.find(item=>item.id===activeId);if(!round||round.winnerTeam)return null;return {...base,sharedRounds:base.sharedRounds.map(item=>item.id===activeId?{...item,winnerTeam}:item)};},`${winnerTeam} TEAM 승리 결과를 저장했어요. 승리 팀은 1승, 상대 팀은 1패가 반영됩니다.`);}
function cancelSharedAssignment(){if(!ready||working)return;const activeId=state.activeSharedRoundId;enqueue(base=>{const round=base.sharedRounds.find(item=>item.id===activeId);if(!round||round.winnerTeam)return null;const sharedRounds=base.sharedRounds.filter(item=>item.id!==activeId);return {...base,sharedRounds,activeSharedRoundId:sharedRounds[sharedRounds.length-1]?.id||null,nextSharedHyeBinTeam:nextSharedTeamAfter(sharedRounds)};},'이번 3:3 팀 배정을 취소했어요.');}
function renderHistory(){const items=[...historicalRounds.map((entry,index)=>({...entry,id:`seed-${index}`,date:null,seed:true})),...state.matches.map((entry,index)=>({...entry,label:`${historicalRounds.length+index+1}회차${entry.settlementRounds?.length?` · ${entry.settlementRounds.length}판 정산`:''}`}))].reverse(),recent=items.slice(0,5),older=items.slice(5),roundDetails=entry=>entry.settlementRounds?.length?`<details class="settlement-round-breakdown"><summary>판별 내역 ${entry.settlementRounds.length}판</summary><ul>${entry.settlementRounds.map((round,index)=>`<li><b>${index+1}판 · ${Number(round.stake||0).toLocaleString()}원</b><span>${ledgerPlayers.filter(player=>Number(round.changes?.[player]||0)!==0).map(player=>`${player} ${formatChange(Number(round.changes[player]))}`).join(' · ')||'변동 없음'}</span></li>`).join('')}</ul></details>`:'';const row=entry=>`<tr><td>${entry.label} · ${entry.date?formatHistoryDate(entry.date):'날짜 미상'}</td><td class="result-summary">${scoreboardPlayers.map(p=>`<b>${p}</b> ${formatChange(entry.changes[p])}`).join(' · ')}${roundDetails(entry)}</td><td>${entry.seed?'':`<button class="remove-match" aria-label="${entry.label} 기록 삭제" data-id="${escapeHtml(entry.id)}">×</button>`}</td></tr>`;$('historyBody').innerHTML=recent.map(row).join('');$('historyOlderBody').innerHTML=older.map(row).join('');$('olderHistoryCount').textContent=`${older.length}경기`;$('olderHistory').hidden=older.length===0;$('emptyHistory').hidden=items.length>0;setBusy(working);}
function renderSharedWinRates(){const stats=getPlayerStats();$('sharedWinRates').innerHTML=ladderPlayers.map(player=>{const entry=stats[player],games=entry.wins+entry.losses,rate=winRate(entry),tone=winRateTone(entry);return `<div class="shared-winrate-card"><strong>${player}</strong><b class="${tone}">${rate}%</b><small>${games?`${entry.wins}승 · ${entry.losses}패`:'아직 경기 없음'}</small></div>`;}).join('');}
function sharedRoundCard(round){const team=(number,members)=>`<span class="team-${number===1?'one':'two'} ${round.winnerTeam===number?'winning-team':''}"><b>${number} TEAM</b><em>${members.join(' · ')}</em>${round.winnerTeam===number?'<i class="win-badge">WIN</i>':''}</span>`;return `<article class="shared-round-record"><div class="shared-round-meta"><strong>${round.date?formatHistoryDate(round.date):'날짜 미상'}</strong><span class="${round.winnerTeam?'shared-round-winner':''}">${round.winnerTeam?`${round.winnerTeam} TEAM 승리`:'승패 입력 대기'}</span><button class="remove-shared-round" type="button" aria-label="3:3 경기 기록 삭제" data-shared-id="${escapeHtml(round.id)}">×</button></div><div class="shared-round-teams">${team(1,round.team1)}${team(2,round.team2)}</div></article>`;}
function renderSharedHistory(){const rounds=state.sharedRounds.filter(round=>round.winnerTeam===1||round.winnerTeam===2).reverse(),recent=rounds.slice(0,5),older=rounds.slice(5),groups=new Map();older.forEach(round=>{const key=round.date||'unknown';if(!groups.has(key))groups.set(key,[]);groups.get(key).push(round);});$('sharedHistoryCount').textContent=`${rounds.length} ROUNDS`;$('sharedHistoryEmpty').hidden=rounds.length>0;const recentMarkup=recent.length?`<p class="shared-history-caption">최근 5경기</p>${recent.map(sharedRoundCard).join('')}`:'';const olderMarkup=groups.size?`<div class="shared-history-older"><p class="shared-history-caption">날짜별 이전 기록</p>${[...groups.entries()].map(([date,items])=>`<details class="shared-history-day"><summary><strong>${date==='unknown'?'날짜 미상':formatHistoryDate(date)}</strong><span>${items.length}경기 · 펼치기</span></summary><div>${items.map(sharedRoundCard).join('')}</div></details>`).join('')}</div>`:'';$('sharedHistoryBody').innerHTML=recentMarkup+olderMarkup;}
function renderSharedCombinationCounts(){const counts=new Map();state.sharedRounds.filter(round=>round.winnerTeam===1||round.winnerTeam===2).forEach(round=>[round.team1,round.team2].forEach((members,index)=>{if(members.length!==3)return;const players=[...members].sort((a,b)=>ladderPlayers.indexOf(a)-ladderPlayers.indexOf(b)),key=players.join('|'),team=index+1;const entry=counts.get(key)||{players,count:0,wins:0,losses:0};entry.count+=1;if(round.winnerTeam===team)entry.wins+=1;else entry.losses+=1;counts.set(key,entry);}));const items=[...counts.values()].sort((a,b)=>b.count-a.count||a.players.join('').localeCompare(b.players.join(''),'ko'));$('sharedCombinationCounts').innerHTML=items.length?items.map(item=>`<div class="shared-combination-row"><span>${item.players.join(' · ')}</span><b><i class="combination-count">${item.count}전</i><i class="combination-wins">${item.wins}승</i><i class="combination-losses">${item.losses}패</i><i class="combination-rate ${winRateTone(item)}">승률 ${winRate(item)}%</i></b></div>`).join(''):'<p class="shared-combination-empty">아직 팀 조합 기록이 없어요.</p>';}
function renderSharedSynergies(){const counts=new Map(),completed=state.sharedRounds.filter(round=>round.winnerTeam===1||round.winnerTeam===2);completed.forEach(round=>[round.team1,round.team2].forEach((members,index)=>{const teammates=members.filter(player=>synergyPlayers.includes(player));for(let first=0;first<teammates.length;first+=1){for(let second=first+1;second<teammates.length;second+=1){const players=[teammates[first],teammates[second]].sort((a,b)=>synergyPlayers.indexOf(a)-synergyPlayers.indexOf(b)),key=players.join('|'),entry=counts.get(key)||{players,wins:0,losses:0};if(round.winnerTeam===index+1)entry.wins+=1;else entry.losses+=1;counts.set(key,entry);}}}));const items=[...counts.values()].sort((a,b)=>(b.wins+b.losses)-(a.wins+a.losses)||b.wins-a.wins||a.players.join('').localeCompare(b.players.join(''),'ko'));$('sharedSynergyCounts').innerHTML=items.length?items.map(item=>`<div class="shared-combination-row"><span>${item.players.join(' · ')}</span><b><i class="combination-count">${item.wins+item.losses}전</i><i class="combination-wins">${item.wins}승</i><i class="combination-losses">${item.losses}패</i><i class="combination-rate ${winRateTone(item)}">승률 ${winRate(item)}%</i></b></div>`).join(''):'<p class="shared-combination-empty">아직 시너지 기록이 없어요.</p>';}
function showToast(message){const t=$('toast');t.textContent=message;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2300);}
function createDailySettlement(){return normaliseSettlement({id:crypto.randomUUID(),date:localDateString(),stake:selectedLedgerStake,draft:emptyLedgerAmounts(),rounds:[]});}
function startDailySettlement(){
  if(!ready||working)return;const settlement=createDailySettlement();
  enqueue(base=>base.settlement&&!settlementIsClosed(base.settlement)?null:{...base,settlement,settlementHistory:[]},'오늘 정산을 시작했어요.');
}
function selectSettlementStake(value){if(settlementIsClosed(state.settlement))return;selectedLedgerStake=value===5000?5000:3000;document.querySelectorAll('[data-ledger-stake]').forEach(button=>button.setAttribute('aria-pressed',String(Number(button.dataset.ledgerStake)===selectedLedgerStake)));document.querySelectorAll('[data-ledger-player]').forEach(button=>button.setAttribute('aria-label',`${button.dataset.ledgerPlayer} ${selectedLedgerStake.toLocaleString()}원 ${Number(button.dataset.ledgerDirection)===1?'더하기':'빼기'}`));}
function adjustSettlementAmount(player,direction){
  const ledger=displayedSettlement();
  if(!ready||working||!ledgerPlayers.includes(player)||!ledger||settlementIsClosed(ledger)||![1,-1].includes(direction))return;
  const step=selectedLedgerStake*direction;
  if(!Number.isSafeInteger(ledger.draft[player]+step)){showToast('입력 가능한 금액 범위를 넘었습니다.');return;}
  const operation={ledgerId:ledger.id,draftId:ledger.draftId,actor:ledgerActor,seq:++ledgerSequence,player,delta:step};
  ledgerAdjustments.push(operation);managedLedgerOperations.add(ledgerOperationKey(operation));
  ledgerSaveError=false;persistLedgerAdjustments();renderSettlementAmounts();scheduleLedgerSave();
}
function saveSettlementRound(){
  const current=displayedSettlement();
  if(!ready||working||!current||settlementIsClosed(current)||!hasLedgerDraft(current)){showToast('이번 판에서 기록한 금액이 없습니다.');return;}
  const ledgerId=current.id,draftId=current.draftId,id=crypto.randomUUID(),createdAt=new Date().toISOString(),batch=[...ledgerAdjustments];
  enqueue(base=>{
    const ledger=applyLedgerAdjustments(base.settlement,batch);
    if(!ledger||ledger.id!==ledgerId||settlementIsClosed(ledger))return null;
    if(ledger.draftId!==draftId||!hasLedgerDraft(ledger))return JSON.stringify(ledger)===JSON.stringify(base.settlement)?null:{...base,settlement:ledger};
    const round={id,draftId,stake:ledger.stake,changes:{...ledger.draft},createdAt};
    return {...base,settlement:{...ledger,rounds:[...ledger.rounds,round],draftId:id,draft:emptyLedgerAmounts()}};
  },'이번 판 금액을 저장했어요.');
}
function undoSettlementRound(){
  if(!ready||working||!state.settlement?.rounds.length)return;const ledgerId=state.settlement.id,roundId=state.settlement.rounds[state.settlement.rounds.length-1].id;
  if(!confirm('마지막 판 기록을 되돌릴까요?'))return;
  enqueue(base=>{const ledger=base.settlement;if(!ledger||ledger.id!==ledgerId||settlementIsClosed(ledger)||ledger.rounds[ledger.rounds.length-1]?.id!==roundId)return null;return {...base,settlement:{...ledger,rounds:ledger.rounds.slice(0,-1)}};},'마지막 판 기록을 되돌렸어요.');
}
function resetDailySettlement(){
  if(!ready||working||!state.settlement)return;
  pendingSettlementResetId=state.settlement.id;$('settlementResetModal').hidden=false;
}
async function confirmResetDailySettlement(){
  if(!ready||working||!pendingSettlementResetId)return;
  const ledgerId=pendingSettlementResetId,settlement=createDailySettlement();
  const changed=await enqueue(base=>base.settlement?.id!==ledgerId?null:{...base,settlement,settlementHistory:[]},'정산 기록을 초기화했어요.');
  if(changed||state.settlement?.id!==ledgerId){$('settlementResetModal').hidden=true;pendingSettlementResetId=null;}
}
$('settlementPanel').addEventListener('click',event=>{const stakeButton=event.target.closest('[data-ledger-stake]');if(stakeButton){selectSettlementStake(Number(stakeButton.dataset.ledgerStake));return;}const playerButton=event.target.closest('[data-ledger-player]');if(playerButton){adjustSettlementAmount(playerButton.dataset.ledgerPlayer,Number(playerButton.dataset.ledgerDirection));}});
$('startSettlement').addEventListener('click',startDailySettlement);
$('saveSettlementRound').addEventListener('click',saveSettlementRound);
$('undoSettlementRound').addEventListener('click',undoSettlementRound);
$('resetSettlement').addEventListener('click',resetDailySettlement);
$('retrySettlementSave').addEventListener('click',flushLedgerAdjustments);
$('confirmSettlementReset').addEventListener('click',confirmResetDailySettlement);
$('cancelSettlementReset').addEventListener('click',()=>{pendingSettlementResetId=null;$('settlementResetModal').hidden=true;});
window.addEventListener('pagehide',()=>{persistLedgerAdjustments();flushLedgerAdjustments();});
window.addEventListener('beforeunload',event=>{if(ledgerAdjustments.length){event.preventDefault();event.returnValue='';}});
$('drawSharedTeams').addEventListener('click',assignSharedTeams);
document.querySelector('.shared-winner-options').addEventListener('click',chooseSharedWinner);
$('saveSharedWinner').addEventListener('click',recordSharedWinner);
$('cancelSharedAssignment').addEventListener('click',cancelSharedAssignment);
$('resultForm').addEventListener('submit',async event=>{event.preventDefault();if(!ready||working)return;const changes={};for(const [name,id] of [['성구','amountSeonggu'],['남우','amountNamu'],['태원','amountTaewon'],['민진','amountMinjin']]){const input=$(id),raw=input.value.trim(),amount=Number(raw);if(!/^-?[0-9]+$/.test(raw)||!Number.isSafeInteger(amount)){showToast('금액은 -3000처럼 정수로 입력해 주세요.');input.focus();return;}changes[name]=amount;}const date=$('matchDate').value;if(!validGameDate(date)){showToast('경기 날짜를 확인해 주세요.');return;}const match={id:crypto.randomUUID(),date,changes};if(await enqueue(base=>({...base,matches:[...base.matches,match]}),'개인 금액 기록이 저장됐어요.')){$('resultForm').reset();suggestedDate=localDateString();$('matchDate').value=suggestedDate;}});
function removeMatch(event){const button=event.target.closest('[data-id]');if(!button||!ready||working)return;if(!confirm('정말로 삭제하시겠습니까?'))return;const id=button.dataset.id;enqueue(base=>({...base,matches:base.matches.filter(m=>String(m.id)!==id),settlement:base.settlement?.postedMatchId===id?null:base.settlement}),'기록을 삭제했어요.');}
$('historyBody').addEventListener('click',removeMatch);
$('historyOlderBody').addEventListener('click',removeMatch);
$('sharedHistoryBody').addEventListener('click',event=>{const button=event.target.closest('[data-shared-id]');if(!button||!ready||working)return;pendingSharedDeleteId=button.dataset.sharedId;$('sharedDeleteModal').hidden=false;});
$('cancelSharedDelete').addEventListener('click',()=>{pendingSharedDeleteId=null;$('sharedDeleteModal').hidden=true;});
$('confirmSharedDelete').addEventListener('click',async()=>{const id=pendingSharedDeleteId;if(!id||!ready||working)return;if(!state.sharedRounds.some(round=>round.id===id)){$('sharedDeleteModal').hidden=true;pendingSharedDeleteId=null;return;}if(await enqueue(base=>{if(!base.sharedRounds.some(round=>round.id===id))return null;const sharedRounds=base.sharedRounds.filter(round=>round.id!==id);return {...base,sharedRounds,activeSharedRoundId:base.activeSharedRoundId===id?(sharedRounds[sharedRounds.length-1]?.id||null):base.activeSharedRoundId};},'3:3 경기 기록을 삭제했어요.')){$('sharedDeleteModal').hidden=true;pendingSharedDeleteId=null;}});
$('resetData').addEventListener('click',()=>{$('resetModal').hidden=false;});
$('cancelReset').addEventListener('click',()=>{$('resetModal').hidden=true;});
$('confirmReset').addEventListener('click',async()=>{if(!ready||working)return;if(await enqueue(()=>({matches:[],nextHyeBinTeam:1,nextSharedHyeBinTeam:1,sharedRounds:[],activeSharedRoundId:null}),'추가 기록을 초기화했어요.')){renderSharedLadder();$('resetModal').hidden=true;}});
function renderAll(){renderDashboard();renderHistory();renderSharedWinRates();renderSharedHistory();renderSharedCombinationCounts();renderSharedSynergies();renderSettlement();}
$('matchDate').value=today;renderAll();renderSharedLadder();setBusy(false);window.addEventListener('resize',()=>drawLadderModel('sharedLadderCanvas',getActiveSharedRound()));
function readMigrationFlag(){try{return localStorage.getItem(migrationKey);}catch{return null;}}
function writeMigrationFlag(){try{localStorage.setItem(migrationKey,'1');}catch(error){console.warn('Local migration marker unavailable',error);}}
async function initialise(){if(!db){showToast('동기화 라이브러리를 불러오지 못했습니다. 새로고침해 주세요.');return;}try{let server=await readServer();if(!readMigrationFlag()&&(localSnapshot.matches.length||localSnapshot.nextHyeBinTeam===2)){const migration=await changeServer((base,raw)=>{const ids=new Set(base.matches.map(m=>String(m.id))),missing=localSnapshot.matches.filter(m=>!ids.has(String(m.id))),empty=Object.keys(raw).length===0;return missing.length||empty&&localSnapshot.nextHyeBinTeam===2?{...base,matches:[...base.matches,...missing],nextHyeBinTeam:empty?localSnapshot.nextHyeBinTeam:base.nextHyeBinTeam}:null;});server=migration.state;}applyState(server);writeMigrationFlag();ready=true;setBusy(false);scheduleLedgerSave();db.channel('scoreboard-state-1').on('postgres_changes',{event:'UPDATE',schema:'public',table:'scoreboard_state'},queueRefresh).subscribe(status=>{if(status==='CHANNEL_ERROR'||status==='TIMED_OUT')queueRefresh();});setInterval(queueRefresh,10000);document.addEventListener('visibilitychange',()=>{if(!document.hidden){refreshDefaultMatchDate();queueRefresh();if(ledgerAdjustments.length)flushLedgerAdjustments();}});}catch(error){console.error('Scoreboard initialisation failed',error);showToast('서버 연결에 실패했습니다. 기록은 이 브라우저에 보관되어 있습니다.');}}
initialise();
