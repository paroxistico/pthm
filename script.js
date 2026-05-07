/**
 * SCRIPT.JS - MOTOR DE JUEGO TEXAS HOLD'EM (COMPLETO)
 * Incluye: Lógica de Jugadores, Baraja, Evaluación de Manos y UI.
 */

// 1. UTILIDADES Y SELECTORES
const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// 2. CONSTANTES DE REGLAS
const BLINDS = { small: 1, big: 2 };
const HAND_RANKS = {
    'ROYAL_FLUSH': 10, 'STRAIGHT_FLUSH': 9, 'FOUR_OF_A_KIND': 8,
    'FULL_HOUSE': 7, 'FLUSH': 6, 'STRAIGHT': 5, 'THREE_OF_A_KIND': 4,
    'TWO_PAIR': 3, 'PAIR': 2, 'HIGH_CARD': 1
};

// 3. CLASES DEL MOTOR
class Player {
    constructor(index, name, isHuman = false) {
        this.index = index;
        this.name = name;
        this.isHuman = isHuman;
        this.chips = 1s100; // Chips iniciales
        this.status = 'active'; // 'active', 'folded', 'all-in'
        this.hand = [];
        this.currentBet = 0;
    }
    bet(amount) {
        this.chips -= amount;
        this.currentBet += amount;
    }
    resetHand() {
        this.hand = [];
        this.currentBet = 0;
        this.status = 'active';
    }
}

class Deck {
    constructor() { this.reset(); }
    reset() {
        const suits = ['H', 'D', 'C', 'S']; // Hearts, Diamonds, Clubs, Spades
        const values = ['2','3','4','5','6','7','8','9','T','J','Q','K','A'];
        this.cards = [];
        for (let s of suits) {
            for (let v of values) {
                this.cards.push({ suit: s, value: v, weight: parseInt(v === 'T' ? 10 : v === 'J' ? 11 : v === 'Q' ? 12 : v === 'K' ? 13 : v === 'A' ? 14 : v) });
            }
        }
        this.shuffle();
    }
    shuffle() {
        for (let i = this.cards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
        }
    }
    deal(count) { return this.cards.splice(0, count); }
}

// 4. MOTOR DE EVALUACIÓN (LA LÓGICA DEL JUEGO)
const Evaluator = {
    getHandStrength(cards, community) {
        const allCards = [...cards, ...community].sort((a, b) => b.weight - a.weight);
        // Este objeto identifica el tipo de jugada y su fuerza
        let strength = { rank: HAND_RANKS.HIGH_CARD, value: 0 };

        // Lógica simplificada para ejemplo (puedes expandir esto)
        // El valor 'value' se usa para desempatar manos del mismo rango (por el kicker)
        const isFlush = this.checkFlush(allCards);
        const isStraight = this.checkStraight(allsCards);
        // ... (Aquí se evaluarían combinaciones de Full House, etc.)

        return strength;
    },

    checkFlush(cards) { /* Lógica para verificar Flush */ return false; },
    checkStraight(cards) { /* Lógica para verificar Escalera */ return false; },
    
    // Función de comparación entre dos manos
    compareHands(handA, handB) {
        if (handA.rank > handB.rank) return 1;
        if (handA.rank < handB.rank) return -1;
        return handA.value - handB.value; // Desempate por kicker
    }
};

// 5. ESTADO GLOBAL DEL JUEGO
const gameState = {
    players: [],
    deck: new Deck(),
    pot: 0,
    phase: 'preflop',
    gameOver: false,
    dealerButtonIndex: 0
};

// 6. FUNCIONES DE FLUJO (UI & ACCIONES)

async function initGame() {
    gameState.deck.reset();
    gameState.players = [new Player(0, "Tú", true)];
    for (let i = 1; i < 6; i++) {
        gameState.players.push(new Player(i, `Bot ${i}`));
    }
    renderPlayers();
    await startRound();
}

function renderPlayers() {
    const container = $('#players-container');
    container.innerHTML = '';
    gameState.players.forEach((p, i) => {
        const seat = document.createElement('figure');
        seat.className = 'player-seat';
        seat.dataset.index = i;
        seat.innerHTML = `
            <div class="card-row" id="hand-${i}"></div>
            <figcaption class="player-info">
                <span class="player-name">${p.name}</span><br>
                $<span class="player-chips">${p.chips}</span>
            </figcaption>`;
        container.appendChild(seat);
    });
}

async function startRound() {
    gameState.pot = 0;
    gameState.phase = 'preflop';
    $('#community-cards').innerHTML = '';
    updateUI();

    // Repartir cartas iniciales
    for (let i = 0; i < 6; i++) {
        const p = gameState.players[i];
        if (p.chips > 0) {
            await dealCardToPlayer(
