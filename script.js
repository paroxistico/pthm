/* =========================================
   TEXAS HOLD'EM ENGINE - COMPLETO
   ========================================= */

const SUITS = ['C', 'D', 'H', 'S'];
const VALUES = [1,2,3,4,5,6,7,8,9,10,11,12,13];
const HAND_RANKS = {
    HIGH_CARD: 0, PAIR: 1, TWO_PAIR: 2, THREE_OF_KIND: 3, STRAIGHT: 4,
    FLUSH: 5, FULL_HOUSE: 6, FOUR_OF_KIND: 7, STRAIGHT_FLUSH: 8, ROYAL_FLUSH: 9
};

const BLINDS = { small: 10, big: 20 };
let gameState = {
    players: [], pot: 0, deck: [], communityCards: [], phase: 'preflop',
    currentBlindIndex: 5, dealerButtonIndex: 4, roundNumber: 1, gameOver: false
};

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ================= LÓGICA DE EVALUACIÓN (CEREBRO) =================
function evaluateHand(cards) {
    const allCards = [...cards].sort((a, b) => b.value - a.value);
    
    const isFlush = SUITS.some(s => allCards.filter(c => c.suit === s).length >= 5);
    const flushCards = isFlush ? allCards.filter(c => c.suit === SUITS.find(s => allCards.filter(curr => curr.suit === s).length >= 5)) : [];

    // Lógica simplificada de rangos (Parejas, Tríos, etc.)
    const counts = {};
    allCards.forEach(c => counts[c.value] = (counts[c.value] || 0) + 1);
    const pairs = Object.keys(counts).filter(v => counts[v] === 2).map(Number).sort((a,b)=>b-a);
    const trips = Object.keys(counts).filter(v => counts[v] === 3).map(Number).sort((a,b)=>b-a);
    const quads = Object.keys(counts).filter(v => counts[v] === 4).map(Number).sort((a,b)=>b-a);

    if (isFlush) return { rank: HAND_RANKS.FLUSH, name: "Color", tieBreakers: flushCards.map(c => c.value) };
    if (trips.length > 0 && pairs.length > 0) return { rank: HAND_RANKS.FULL_HOUSE, name: "Full House", tieBreakers: [trips[0], pairs[0]] };
    if (trips.length > 0) return { rank: HAND_RANKS.THREE_OF_KIND, name: "Trío", tieBreakers: [trips[0], ...allCards.filter(c=>c.value!==trips[0]).slice(0,2).map(c=>c.value)] };
    if (pairs.length >= 2) return { rank: HAND_RANKS.TWO_PAIR, name: "Doble Pareja", tieBreakers: [pairs[0], pairs[1], allCards.find(c=>c.value!==pairs[0]&&c.value!==pairs[1]).value] };
    if (pairs.length === 1) return { rank: HAND_RANKS.PAIR, name: "Pareja", tieBreakers: [pairs[0], ...allCards.filter(c=>c.value!==pairs[0]).slice(0,3).map(c=>c.value)] };
    
    return { rank: HAND_RANKS.HIGH_CARD, name: "Carta Alta", tieBreakers: allCards.slice(0,5).map(c => c.value) };
}

function compareHands(h1, h2) {
    const r = h1.rank - h2.rank;
    if (r !== 0) return r > 0 ? 1 : -1;
    const len = Math.min(h1.tieBreakers.length, h2.tieBreakers.length);
    for(let i=0; i < len; i++) {
        if (h1.tieBreakers[i] !== h2.tieBreakers[i]) return h1.tieBreakers[i] > h2.tieBreakers[i] ? 1 : -1;
    }
    return 0;
}

// ================= MOTOR VISUAL & UI =================
async function renderCard(containerId, card, isVisible, isCommunity = false) {
    const container = isCommunity ? $('#community-cards') : $(`[data-index="${containerId}"]`);
    if (!container) return;

    const cardDiv = document.createElement('div');
    cardDiv.className = `card-slot dealing-card ${isVisible ? 'flipped' : ''}`;
    
    if (isVisible) {
        const img = document.createElement('img');
        img.src = `assets/images/${card.suit}-${card.value}.png`;
        cardDiv.appendChild(img);
    }

    container.appendChild(cardDiv);
    await sleep(250); 
}

function enableControls(active, toCall = 0, maxChips = 1000) {
    const btnCheck = $('#btn-check-call');
    const btnRaise = $('#btn-raise');
    const btnFold = $('#btn-fold');

    if (!active) {
        [btnCheck, btnRaise, btnFold].forEach(b => b.disabled = true);
        return;
    }

    btnCheck.disabled = false;
    btnCheck.textContent = toCall <= 0 ? "Chequear" : `Pagar $${toCall}`;
    btnFold.disabled = false;
    
    btnRaise.disabled = maxChips < (toCall + BLINDS.big);
    if(!btnRaise.disabled) $('.bet-amount').textContent = toCall + BLINDS.big;

    const handleBtnClick = (e) => {
        window.lastAction = e.currentTarget.dataset.action;
        enableControls(false);
        if(window.humanResolve) window.humanResolve();
    };

    [btnCheck, btnRaise, btnFold].forEach(b => b.onclick = handleBtnClick);
}

// ================= FLUJO DE PARTIDA =================
async function initGame() {
    gameState.players = [];
    for(let i=0; i<6; i++) {
        gameState.players.push({
            id: i, name: i === 0 ? "Tú" : `Bot ${i}`,
            chips: 1000, cards: [], isFolded: false, currentBet: 0
        });
    }
    await startNewRound();
}

async function startNewRound() {
    $('#community-cards').innerHTML = '';
    $$('.player-seat').forEach(s => s.innerHTML = '');
    gameState.pot = 0;
    gameState.communityCards = [];
    
    // Crear y barajar mazo
    gameState.deck = [];
    for(let s of SUITS) for(let v of VALUES) gameState.deck.push({suit: s, value: v});
    gameState.deck.sort(() => Math.random() - 0.5);

    // Reparto inicial
    for(let i=0; i<2; i++) {
        for(let p of gameState.players) {
            const card = gameState.deck.pop();
            p.cards.push(card);
            await renderCard(p.id, card, p.id === 0);
        }
    }
    
    enableControls(true, 0, gameState.players[0].chips);
}

$('#btn-start').addEventListener('click', async () => {
    $('#start-overlay').classList.remove('active');
    const music = document.getElementById('bg-music');
    music.volume = 0.4;
    music.play().catch(() => {});
    initGame();
});