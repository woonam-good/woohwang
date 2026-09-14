const ladderPlayers = ['민진', '성구', '남우', '태원', '혜빈', '민경'];
const scoreboardPlayers = ['성구', '남우', '태원', '민진'];
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
let state = JSON.parse(localStorage.getItem(storageKey) || '{"matches":[],"nextHyeBinTeam":1}');
let currentAssignment = null;
const $ = (id) => document.getElementById(id);
const today = new Date().toISOString().slice(0, 10);
function save(){localStorage.setItem(storageKey,JSON.stringify(state));}
function formatDate(value){return new Intl.DateTimeFormat('ko-KR',{month:'long',day:'numeric',weekday:'short'}).format(new Date(`${value}T00:00:00`));}
function formatHistoryDate(value){return new Intl.DateTimeFormat('ko-KR',{year:'numeric',month:'long',day:'numeric',weekday:'short'}).format(new Date(`${value}T00:00:00`));}
function formatWon(value){return `${value<0?'−':''}${Math.abs(value).toLocaleString()}원`;}
function formatChange(value){return `${value>0?'+':value<0?'−':''}${Math.abs(value).toLocaleString()}원`;}
function shuffle(items){const a=[...items];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function totalChange(changes){return scoreboardPlayers.reduce((sum,player)=>sum+Number(changes[player]||0),0);}
function getPlayerStats(){const stats=Object.fromEntries(scoreboardPlayers.map(name=>[name,{points:0}]));[...historicalRounds,...state.matches].forEach(entry=>scoreboardPlayers.forEach(player=>{stats[player].points+=Number(entry.changes?.[player]||0);}));return stats;}
function renderDashboard(){const stats=getPlayerStats(),ordered=scoreboardPlayers.map(name=>({name,...stats[name]})).sort((a,b)=>b.points-a.points||a.name.localeCompare(b.name,'ko'));$('scoreboard').innerHTML=ordered.map((p,i)=>`<div class="rank-row money-rank"><span class="rank ${i===0||p.points>0?'medal':''}">${String(i+1).padStart(2,'0')}</span><strong class="player-name">${p.name}</strong><span class="score-points">누적 ${formatWon(p.points)}</span></div>`).join('');$('totalGames').textContent=historicalRounds.length+state.matches.length;const top=ordered[0],bottom=ordered[ordered.length-1];$('topWinner').textContent=`갓${top.name.slice(1)}`;$('topWinnerDetail').textContent=`누적 1위 · ${formatWon(top.points)}`;$('liquidityProvider').textContent=`족${bottom.name.slice(1)}`;$('liquidityProviderDetail').textContent=`누적 4위 · ${formatWon(bottom.points)}`;$('todayGames').textContent=state.matches.filter(m=>m.date===today).length;$('historyCount').textContent=`${historicalRounds.length+state.matches.length} RECORDS`;}
function drawLadder(){const canvas=$('ladderCanvas'),ctx=canvas.getContext('2d'),h=canvas.height;ctx.clearRect(0,0,canvas.width,h);const xs=[70,194,318,442,566,690];ctx.strokeStyle='#c9d2e6';ctx.lineWidth=2;ctx.setLineDash([4,5]);xs.forEach(x=>{ctx.beginPath();ctx.moveTo(x,43);ctx.lineTo(x,h-45);ctx.stroke();});ctx.setLineDash([]);if(currentAssignment){ctx.strokeStyle='#7d95de';ctx.lineWidth=3;for(let y=78;y<h-75;y+=42)for(let i=0;i<5;i++)if(Math.random()>.56){ctx.beginPath();ctx.moveTo(xs[i],y+(i%2)*7);ctx.lineTo(xs[i+1],y+(i%2)*7);ctx.stroke();}}}
function renderLadder(){$('ladderPlayers').innerHTML=ladderPlayers.map(p=>`<span>${p}</span>`).join('');drawLadder();if(!currentAssignment)return;$('assignmentEmpty').hidden=true;const result=$('assignmentResult');result.hidden=false;result.innerHTML=teamCard(1,currentAssignment.team1)+teamCard(2,currentAssignment.team2);}
function teamCard(team,members){return `<div class="team-result ${team===2?'team2':''}"><h3><b>${team} TEAM</b> · ${team===1?'BLUE SIDE':'RED SIDE'}</h3><div class="member-chips">${members.map(p=>`<span>${p}</span>`).join('')}</div></div>`;}
function assignTeams(){const random=shuffle(['민진','성구','남우','태원']),hyeTeam=state.nextHyeBinTeam;currentAssignment=hyeTeam===1?{team1:['혜빈',...random.slice(0,2)],team2:['민경',...random.slice(2)]}:{team1:['민경',...random.slice(0,2)],team2:['혜빈',...random.slice(2)]};state.nextHyeBinTeam=hyeTeam===1?2:1;save();renderLadder();showToast('이번 판 팀이 정해졌어요!');}
function renderHistory(){const body=$('historyBody'),items=[...historicalRounds.map((entry,index)=>({...entry,id:`seed-${index}`,date:null,seed:true})),...state.matches].reverse();body.innerHTML=items.map(entry=>`<tr><td>${entry.date?formatHistoryDate(entry.date):`${entry.label} · 날짜 미상`}</td><td class="result-summary">${scoreboardPlayers.map(p=>`<b>${p}</b> ${formatChange(entry.changes[p])}`).join(' · ')}</td><td>${entry.seed?'':`<button class="remove-match" aria-label="기록 삭제" data-id="${entry.id}">×</button>`}</td></tr>`).join('');$('emptyHistory').hidden=true;}
function showToast(message){const t=$('toast');t.textContent=message;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2300);}
$('drawTeams').addEventListener('click',assignTeams);
$('resultForm').addEventListener('submit',event=>{event.preventDefault();const changes={성구:Number($('amountSeonggu').value),남우:Number($('amountNamu').value),태원:Number($('amountTaewon').value),민진:Number($('amountMinjin').value)};state.matches.push({id:Date.now(),date:$('matchDate').value,changes});save();$('resultForm').reset();$('matchDate').value=today;renderAll();showToast('개인 금액 기록이 저장됐어요.');});
$('historyBody').addEventListener('click',event=>{const button=event.target.closest('[data-id]');if(!button)return;if(!confirm('정말로 삭제하시겠습니까?'))return;state.matches=state.matches.filter(m=>m.id!==Number(button.dataset.id));save();renderAll();showToast('기록을 삭제했어요.');});
$('resetData').addEventListener('click',()=>{$('resetModal').hidden=false;});
$('cancelReset').addEventListener('click',()=>{$('resetModal').hidden=true;});
$('confirmReset').addEventListener('click',()=>{state={matches:[],nextHyeBinTeam:1};currentAssignment=null;save();renderAll();renderLadder();$('resetModal').hidden=true;showToast('추가 기록을 초기화했어요.');});
function renderAll(){renderDashboard();renderHistory();}
$('todayLabel').textContent=formatDate(today);$('matchDate').value=today;renderAll();renderLadder();window.addEventListener('resize',drawLadder);
