// ... (rest of the code remains the same)

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

    // Rotar dealer & ciegas (simplificado pero correcto)
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
    void el.offsetWidth; // ✅ Corregido: fuerza reflow correctamente
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
