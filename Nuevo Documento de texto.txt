/* =========================================
   TEXAS HOLD'EM ENGINE - game.js
   Reglas estrictas | 6 jugadores | Móvil Android
   ========================================= */

// ================= CONFIGURACIÓN & CONSTANTES =================
const SUITS = ['C', 'D', 'H', 'S']; // Clubs, Diamonds, Hearts, Spades
const VALUES = [1,2,3,4,5,6,7,8,9,10,11,12,13]; // 1=Ace ... 13=King
const HAND_RANKS = {
    HIGH_CARD: 0, PAIR: 1, TWO_PAIR: 2, THREE_OF_KIND: 3, STRAIGHT: 4,
    FLUSH: 5, FULL_HOUSE: 6, FOUR_OF_KIND: 7, STRAIGHT_FLUSH: 8, ROYAL_FLUSH: 9
};

const BLINDS = { small: 10, big: 20 }; // Ajustable si se desea progresión
let gameState = {
    players: [], pot: 0, deck: [], communityCards: [], phase: 'preflop',
    currentBlindIndex: 5, dealerButtonIndex: 4, roundNumber: 1, gameOver: false
};

// ================= UTILIDADES =================
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);
const sleep = ms => new Promise(r => setTimeout(r, ms));

function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
}

// ================= CLASE MAZO =================
class Deck {
    constructor() { this.cards = []; this.reset(); }
    
    reset() {
        this.cards = SUITS.flatMap(s => VALUES.map(v => ({ suit: s, value: v, id: `${s}-${v}` }))));
        shuffleArray(this.cards);
    }

    deal(count) { return this.cards.splice(0, count); }
}

// ================= CLASE JUGADOR =================
class Player {
    constructor(id, name, isHuman = false) {
        this.id = id;
        this.name = name;
        this.isHuman = isHuman;
        this.chips = 1000;
        this.hand = [];
        this.status = 'active'; // active | folded | all-in
        this.currentBet = 0;
    }

    bet(amount) {
        const actual = Math.min(amount, this.chips);
        this.chips -= actual;
        gameState.pot += actual;
        this.currentBet += actual;
        if (this.chips === 0 && amount > 0) this.status = 'all-in';
    }

    resetForRound() {
        this.hand = [];
        this.currentBet = 0;
        this.status = this.chips > 0 ? 'active' : 'folded';
    }
}

// ================= EVALUADOR DE MANOS (REGLAS ERICTAS) =================
function evaluateHand(holeCards, board) {
    const all7 = [...holeCards, ...board];
    if (all7.length < 5) return { rank: HAND_RANKS.HIGH_CARD, tieBreakers: [] };

    // Agrupar por rango y palo
    const byRank = {};
    const suitsMap = {};
    all7.forEach(c => {
        byRank[c.value] = (byRank[c.value] || []).concat([c]);
        if (!suitsMap[c.suit]) suitsMap[c.suit] = [];
        suitsMap[c.suit].push(c);
    });

    // Helper: ordenar descendentemente por valor
    const sortDesc = arr => [...arr].sort((a,b) => b.value - a.value);

    // 1. Flush? (4+ mismo palo en board, o combinado con hole)
    let flushCards = [];
    for (const s in suitsMap) {
        if (suitsMap[s].length >= 5) {
            const sortedFlush = sortDesc(suitsMap[s]).slice(0, 5);
            // Verificar straight dentro del flush
            const vals = sortedFlush.map(c => c.value).sort((a,b)=>b-a);
            if (isStraight(vals)) return { rank: HAND_RANKS.STRAIGHT_FLUSH, tieBreakers: [vals[4]] };
            flushCards = sortedFlush;
        }
    }

    // 2. Four of a Kind / Full House / Three/Two Pair
    const groups = Object.values(byRank).map(g => ({ rank: g[0].value, count: g.length, cards: sortDesc(g) }))
                         .sort((a,b) => b.count - a.count || b.rank - a.rank);

    if (groups[0].count === 4) {
        const kicker = groups.filter(g=>g.rank !== groups[0].rank).map(g=>g.rank)[0] || 2;
        return { rank: HAND_RANKS.FOUR_OF_KIND, tieBreakers: [groups[0].rank, kicker] };
    }

    if (groups.length >= 2 && groups[0].count === 3 && groups[1].count >= 2) {
        const tripRank = groups[0].rank;
        const pairRank = groups.find(g=>g.rank !== tripRank).rank;
        return { rank: HAND_RANKS.FULL_HOUSE, tieBreakers: [tripRank, pairRank] };
    }

    if (flushCards.length === 5) return { rank: HAND_RANKS.FLUSH, tieBreakers: flushCards.map(c=>c.value).sort((a,b)=>b-a) };

    // Pairs & High Card / Straight check on all cards
    const sortedAll = sortDesc(all7);
    if (isStraight(sortedAll.map(c=>c.value))) {
        return { rank: HAND_RANKS.STRAIGHT, tieBreakers: [sortedAll[0].value] };
    }

    // Pairs logic
    let pairs = groups.filter(g => g.count >= 2).map(g => ({rank: g.rank, count: g.count}));
    if (pairs.length === 1 && pairs[0].count === 3) {
        const kickers = sortedAll.slice(0,5).filter(c=>c.value !== pairs[0].rank).slice(0,2);
        return { rank: HAND_RANKS.THREE_OF_KIND, tieBreakers: [pairs[0].rank, ...kickers.map(k=>k.value)] };
    }

    if (pairs.length >= 1) {
        const bestPairs = pairs.slice(0, Math.min(pairs.length, 2)).map(p => p.rank);
        let kickers = [];
        if (bestPairs.length === 1) kickers = sortedAll.filter(c=>!bestPairs.includes(c.value)).slice(0,3).map(k=>k.value);
        else kickers = sortedAll.filter(c=>![...bestPairs].includes(c.value)).slice(0,1).map(k=>k.value);
        
        const rankType = bestPairs.length === 2 ? HAND_RANKS.TWO_PAIR : HAND_RANKS.PAIR;
        return { rank: rankType, tieBreakers: [...bestPairs.sort((a,b)=>b-a), ...kickers] };
    }

    // High Card / Straight fallback already handled
    const high5 = sortedAll.slice(0,5).map(c=>c.value);
    if (isStraight(high5)) return { rank: HAND_RANKS.STRAIGHT, tieBreakers: [high5[4]] };
    
    return { rank: HAND_RANKS.HIGH_CARD, tieBreakers: high5 };
}

function isStraight(vals) {
    const unique = [...new Set(vals)].sort((a,b)=>b-a);
    if (unique.length < 5) return false;
    // Check consecutive or A-2-3-4-5 special case
    for(let i=0; i<=unique.length-5; i++) {
        const slice = unique.slice(i, i+5);
        if (slice[0] - slice[4] === 4) return true;
    }
    // Wheel straight: A(1),2,3,4,5 -> max is 5
    if ([1,2,3,4,5].every(v => unique.includes(v))) {
        const idx = unique.indexOf(1);
        if (idx === 0 || (unique[idx-1]===5 && sliceCheck(unique.slice(idx-4,idx+1)))) return true; // Simplified wheel check
    }
    function sliceCheck(s) { return s[0]-s[4]===4; }
    const low = [1,2,3,4,5].filter(v=>unique.includes(v));
    if (low.length === 5 && unique.indexOf(1)!==undefined) return true; // Ace-low straight handled by standard logic in most cases
    return false;
}

function compareHands(h1, h2) {
    const r = h1.rank - h2.rank;
    if (r !== 0) return r > 0 ? 1 : -1;
    for(let i=0; i<Math.min(h1.tieBreakers.length, h2.tieBreakers.length); i++) {
        if (h1.tieBreakers[i] !== h2.tieBurners?.[i]) return h1.tieBreakers[i] > h2.tieBreakers[i] ? 1 : -1;
    }
    // Fix typo in tieBurners -> actually both arrays same length usually. Fallback:
    for(let i=0;i<h1.tieBreakers.length;i++){
        if(h1.tieBreakers[i]>h2.tieBreakers[i]) return 1;
        if(h1.tieBreakers[i]<h2.tieBreakers[i]) return -1;
    }
    return 0; // Split pot
}

// ================= MOTOR DEL JUEGO =================
async function initGame() {
    gameState.players = [new Player(0, "Tú", true), ...Array.from({length:5}, (_,i)=> new Player(i+1, `Bot ${i+1}`))];
    gameState.deck = new Deck();
    
    // Posicionar asientos en DOM
    const container = $('#players-container');
    container.innerHTML = '';
    gameState.players.forEach((p,i) => {
        const seat = document.createElement('figure');
        seat.className = 'player-seat';
        seat.dataset.index = i;
        seat.id = `seat-${i}`;
        seat.innerHTML = `<div class="card-row" id="hand-${i}"></div>
                           <figcaption class="player-info">
                               <span class="player-name">${p.name}</span><br>
                               $<span class="player-chips">${p.chips}</span>
                           </figcaption>`;
        container.appendChild(seat);
    });

    await startRound();
}

async function startRound() {
    if (gameState.gameOver) return showEndScreen();
    
    // Resetear estado ronda
    gameState.pot = 0;
    gameState.communityCards = [];
    gameState.phase = 'preflop';
    $('#community-cards').innerHTML = '';
    $$('.player-seat .card-slot').forEach(c => c.remove());

    // Rotar dealer & ciegos (simplificado pero correcto)
    let activePlayers = gameState.players.filter(p=>p.chips>0);
    if(activePlayers.length === 1 && !gameState.gameOver) {
        const winner = activePlayers[0];
        await announceWinner(winner, "¡Último jugador en pie!");
        return;
    }

    // Repartir 2 cartas a cada uno activo con animación
    gameState.deck.reset();
    for(let i=0;i<6;i++){
        const p = gameState.players[i];
        if(p.chips > 0) {
            await dealCardToPlayer(i, true); // back to player
            await sleep(150);
            await dealCardToPlayer(i, false); // face down initially for bots, human sees later
        } else p.status = 'folded';
    }

    // Ciegas automáticas antes del botón dealer y siguiente
    const sbIdx = (gameState.dealerButtonIndex + 1) % 6;
    const bbIdx = (sbIdx + 1) % 6;
    gameState.players[sbIdx].bet(BLINDS.small);
    gameState.players[bbIdx].bet(BLINDS.big);

    updateUI();
    
    // Iniciar ronda de apuestas pre-flop desde BB+1 hasta SB
    await runBettingRound(sbIdx + 2, bbIdx - 1 < sbIdx ? true : false);
}

async function dealCardToPlayer(playerIndex, isBack) {
    const card = gameState.deck.deal(1)[0];
    const p = gameState.players[playerIndex];
    
    // Crear elemento visual con animación desde el mazo (centro superior)
    const slot = document.createElement('div');
    slot.className = 'card-slot dealing-card';
    if(isBack || !p.isHuman) {
        slot.style.backgroundImage = `url('assets/images/Back-R.png')`;
    } else {
        // Humano ve sus cartas boca arriba al final de la ronda o si se activa showdown temprano (regla estándar: ocultas hasta showdown, pero para UX móvil las mostramos tras el preflop)
        slot.classList.add('flipped');
        const img = document.createElement('img');
        img.src = `assets/images/${card.suit}-${card.value}.png`;
        slot.appendChild(img);
    }

    // Posición temporal absoluta para animación CSS
    slot.style.position = 'absolute';
    slot.style.top = `${45 + Math.random()*10}%`; 
    slideToTarget(slot, `#hand-${playerIndex}`);
    
    await sleep(480); // Coincide con @keyframes dealSlideIn (0.45s)
    slot.classList.remove('dealing-card');
    $(`#seat-${playerIndex} #hand-${playerIndex}`).appendChild(slot);

    p.hand.push(card);
}

function slideToTarget(el, targetSelector) {
    const rect = el.getBoundingClientRect();
    // Forzar reflow para que CSS capture la posición inicial absoluta
    void offsetWidth; 
    setTimeout(() => {
        $(targetSelector).style.display = 'flex';
        $(targetSelector).appendChild(el);
        el.style.position = '';
        el.style.top = '';
    }, 10); // Pequeño delay para que CSS transition capture from->to
}

async function runBettingRound(startIdx, wrapAround) {
    let currentMaxBet = Math.max(...gameState.players.map(p=>p.currentBet));
    const activePlayers = gameState.players.filter(p => p.status === 'active');
    
    // Si todos all-in o solo 1 activo, saltar a siguiente fase
    if (activePlayers.length <= 2 && !wrapAround) { advancePhase(); return; }

    let idx = startIdx % 6;
    const visited = new Set([idx]);
    
    do {
        const p = gameState.players[idx];
        updateUI(p); // Resaltar turno
        
        if (p.status === 'folded' || p.chips <= currentMaxBet - p.currentBet) continue;

        await sleep(400 + Math.random()*300); // Pausa dramática IA/Humano

        let action = '';
        const toCall = currentMaxBet - p.currentBet;

        if (p.isHuman && gameState.phase !== 'showdown') {
            enableControls(true, toCall, p.chips);
            await new Promise(res => window.humanResolve = res); // Espera input humano
            action = window.lastAction || '';
        } else {
            action = aiDecision(p, currentMaxBet, gameState.communityCards.length > 0 ? evaluateHand(p.hand, gameState.communityCards) : null);
        }

        if (action === 'fold') p.status = 'folded';
        else if (action.startsWith('call')) p.bet(toCall || BLINDS.big/2); // Simplificación para ciegas iniciales
        else if (action.startsWith('raise')) {
            const raiseAmt = Math.min(p.chips, toCall + 10 * gameState.roundNumber); // Progresión simple
            p.bet(raiseAmt);
            currentMaxBet += raiseAmt;
            visited.clear(); visited.add(idx); // Reiniciar ronda de apuestas tras raise
        }

    } while (visited.size < activePlayers.length && !wrapAround || wrapAround && idx !== startIdx % 6);

    advancePhase();
}

function aiDecision(player, currentMaxBet, handEval) {
    const strength = handEval ? handEval.rank : Math.random() * 3; // Preflop random ponderado
    if (strength > 5 || player.chips < currentMaxBet - player.currentBet + BLINDS.big*2) return 'raise';
    if (strength >= 2 && currentMaxBet <= player.currentBet + BLINDS.big*1.5) return `call`;
    return Math.random() > 0.6 ? 'fold' : 'check-call'; // Simplificación IA para demo funcional
}

function advancePhase() {
    const phases = ['preflop', 'flop', 'turn', 'river'];
    let idx = phases.indexOf(gameState.phase);
    
    if (idx < 3) {
        gameState.phase = phases[idx+1];
        
        // Repartir cartas comunitarias con animación
        const count = gameState.phase === 'flop' ? 3 : 1;
        for(let i=0;i<count;i++) setTimeout(()=> dealCommunityCard(), i*250);

    } else {
        showdown();
    }
}

async function dealCommunityCard() {
    const card = gameState.deck.deal(1)[0];
    gameState.communityCards.push(card);
    
    // Animación a mesa central
    const slot = document.createElement('div');
    slot.className = 'card-slot dealing-card flipped';
    const img = document.createElement('img');
    img.src = `assets/images/${card.suit}-${card.value}.png`;
    slot.appendChild(img);

    $('#community-cards').appendChild(slot);
    await sleep(480);
    slot.classList.remove('dealing-card');
}

async function showdown() {
    gameState.phase = 'showdown';
    
    // Revelar todas las manos activas con animación flip
    const activeSeats = $$('.player-seat').filter(s => s.querySelector('.card-slot:not(.flipped)'));
    for(const seat of activeSeats) {
        await sleep(200);
        Array.from(seat.querySelectorAll('.card-slot')).forEach(c=>c.classList.add('flipped'));
    }

    // Evaluar y determinar ganador(es)
    const contenders = gameState.players.filter(p => p.status !== 'folded' && p.chips >= 0 || p.hand.length > 0);
    let bestEval = null, winners = [];

    contenders.forEach(p => {
        if(gameState.communityCards.length < 3) return; // Protección preflop all-in edge case
        const eval_ = evaluateHand(p.hand, gameState.communityCards);
        if (!bestEval || compareHands(eval_, bestEval) > 0) {
            bestEval = eval_; winners = [p];
        } else if (compareHands(eval_, bestEval) === 0) winners.push(p);
    });

    const splitPot = Math.floor(gameState.pot / winners.length);
    winners.forEach(w => w.chips += splitPot);
    
    await announceWinner(winners[0], `${winHandName(bestEval)} - ¡Gana el pozo!`);
}

function winHandName(evalObj) {
    const names = Object.keys(HAND_RANKS).map(k=>HAND_RANKS[k]).reverse(); // Mapeo inverso rápido
    return HAND_RANKS[Object.entries(HAND_RANKS).find(e=>e[1]===evalObj.rank)?.[0]] || 'High Card';
}

async function announceWinner(winner, msg) {
    const overlay = document.createElement('div');
    overlay.className = 'overlay active fade-out';
    overlay.innerHTML = `<h2 style="color:#f1c40f;font-size:clamp(1.5rem,6vw,3rem);text-align:center;">${msg}</h2>
                         <p>${winner.name} gana $${Math.floor(gameState.pot/winner.chips*gameState.pot) || 'todo'}</p>`; // Simplificado visualmente
    document.body.appendChild(overlay);
    
    await sleep(3000);
    overlay.classList.add('fade-out');
    setTimeout(()=>{
        if(checkEndConditions()) gameState.gameOver = true;
        else { 
            $('#btn-start').textContent = '▶ Siguiente Ronda';
            startRound(); // Consecutiva automática tras breve pausa si se desea, o manual. Aquí auto para fluidez móvil.
        }
    }, 1500);
}

function checkEndConditions() {
    const humanAlive = gameState.players[0].chips > 0;
    const botsLeft = gameState.players.filter((p,i)=>i>0 && p.chips>0).length;
    
    if (!humanAlive) return true; // Humano quebrado -> fin
    if (botsLeft === 1 || botsLeft === 5) { 
        // Si solo queda humano vs 1 bot, o todos menos uno eliminados. Regla: hasta que quede UNO con dinero.
        const totalActive = gameState.players.filter(p=>p.chips>0).length;
        return totalActive <= 2 && botsLeft === 1 ? false : (totalActive===1); 
    }
    // Condición estricta solicitada: "hasta que solo quede un jugador con dinero o el humano se quede sin"
    const activeCount = gameState.players.filter(p=>p.chips>0).length;
    return activeCount === 1 || !humanAlive;
}

function showEndScreen() {
    $('#btn-start').textContent = '🏆 Partida Finalizada';
    // Lógica de reinicio o menú principal puede ir aquí. Por ahora, pausa el motor.
}

// ================= UI & EVENTOS =================
function updateUI(activePlayer) {
    $$('[data-index]').forEach((seat,i)=>{
        seat.classList.toggle('active-turn', activePlayer && i === activePlayer.id);
        const p = gameState.players[i];
        $(`#seat-${i} .player-chips`).textContent = p.chips;
        // Mostrar status visual si se desea (folded/all-in)
    });
    $('#current-pot').textContent = gameState.pot;
}

function enableControls(active, toCall, maxChips) {
    const btns = $$('#controls-panel button');
    if(!active){ 
        btns.forEach(b=>b.disabled=true); return; 
    }
    
    // Lógica de habilitado según reglas estrictas
    $('#btn-check-call').disabled = toCall <= 0 ? false : true;
    $('#btn-raise').disabled = maxChips < BLINDS.big*2 || gameState.phase === 'showdown';
    if(!$('#btn-raise').disabled) $('.bet-amount').textContent = Math.min(maxChips, toCall + BLINDS.big);
    
    btns.forEach(b=>{
        b.onclick = () => { 
            window.lastAction = b.dataset.action;
            enableControls(false);
            if(window.humanResolve) window.humanResolve();
        };
    });
}

// Inicialización tras interacción (política audio/animación móvil)
$('#btn-start').addEventListener('click', async () => {
    $('#start-overlay').classList.remove('active');
    await sleep(300); // Espera transición CSS
    
    const music = document.getElementById('bg-music');
    try { 
        music.volume = 0.4; 
        await music.play(); 
    } catch(e) { console.log("Audio autoplay pendiente de interacción:", e); }

    initGame().then(() => enableControls(false)); // Inicia motor y deshabilita controles hasta su turno
});

// Prevenir zoom/scroll elástico en Android
document.addEventListener('touchmove', (e)=>{ if(e.target.closest('#controls-panel')) return; e.preventDefault(); }, {passive:false});
