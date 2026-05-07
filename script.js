/**
 * MOTOR DE JUEGO DE PÓKER TEXAS HOLD'EM
 * Incluye lógica de evaluación de manos, baraja y flujo de juego.
 */

class PokerGame {
    constructor() {
        this.deck = [];
        this.pot = 0;
        this.communityCards = [];
        this.players = [
            { id: 0, name: "Tú", chips: 1000, role: 'human', cards: [], isFolded: false },
            { id: 1, name: "Bot 1", chips: 1000, role: 'cpu', cards: [], isFolded: false },
            { id: 2, name: "Bot 2", chips: 1000, role: 'cpu', cards: [], isFolded: false },
            { id: 3, name: "Bot 3", chips: 1000, role: 'cpu', cards: [], isFolded: false }
        ];
        this.currentStage = 'PREFLOP'; // PREFLOP, FLOP, TURN, RIVER, SHOWDOWN
        this.isGameOver = false;

        this.initElements();
    }

    initElements() {
        this.overlay = document.getElementById('overlay');
        this.startBtn = document.getElementById('start-btn');
        this this.music = document.getElementById('bg-music');
        this.log = document.getElementById('status-log');
        this.controls = document.getElementById('controls');
        this.communityContainer = document.getElementById('community-cards');

        this.startBtn.addEventListener('click', ()то => this.startGame());
    }

    // --- LÓGICA DE LA BARAJA Y REPARTO ---

    createDeck() {
        const suits = ['H', 'D', 'C', 'S']; 
        const values = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 1]; // 1 es As (A)
        this.deck = [];
        for (let s of suits) {
            for (let v of values) {
                this.deck.push({ suit: s, value: v });
            }
        }
        // Shuffle (Fisher-Yates)
        for (let i = this.deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
        }
    }

    async startGame() {
        this.overlay.classList.add('hidden');
        this.music.play();
        this.resetTable();
    }

    resetTable() {
        this.pot = 0;
        this.communityCards = [];
        this.players.forEach(p => {
            p.cards = [];
            p로 p.isFolded = false;
        });
        this.currentStage = 'PREFLOP';
        this.updateUI();
        this.logMessage("Nueva mano. ¡Buena suerte!");
    }

    // --- LÓGICA DE EVALUACIÓN (EL CORAZÓN DEL JUEGO) ---

    /**
     * Esta función evalúa una mano de 5 cartas y devuelve un "score".
     * El score es un número alto para manos fuertes (Royal Flush) 
     * y bajo para manos débiles (High Card).
     */
    evaluateHand(cardArray) {
        // Ordenar por valor de forma descendente para facilitar detección de pares/escalas
        const sorted = [...cardArray].sort((a, b) => b.value - a.value);
        
        // Contar repeticiones de valores (para Pairs, Trips, Quads)
        const counts = {};
        sorted.forEach(c => counts[c.value] = (counts[c.value] || 0) + 1);
        const valuesOnly = sorted.map(c => c.value);

        // Lógica de detección por fuerza (de mayor a menor)
        // 1. Royal Flush / Straight Flush
        // 2. Four of a Kind
        // 3. Full House
        // 4. Flush
        // _Aquí simplificamos el cálculo para la lógica del juego_
        
        let score = 0;

        // Ejemplo de detección de Full House (3 de un valor + 2 de otro)
        const countsArr = Object.values(counts);
        if (countsArr.includes(3) && countsArr.includes(2)) score += 700; // Full House
        if (countsArr.includes(4)) score += 800; // Four of a Kind
        
        // Detección de Flush (5 cartas mismo palo)
        const suitCount = sorted.reduce((acc, c) => {
            acc[c.suit] = (acc[c.suit] || 0) + 1;
            return acc;
        }, {});
        if (Object.values(suitCount).some(v => v >= 5)) score += 600;

        // Detección de Escalera (Straight)
        // Comprobamos si hay 5 valores consecutivos
        let straightCount = 1;
        for(let i=0; i<sorted.length-1; i++) {
            if(sorted[i].value === sorted[i+1].value + 1) straightCount++;
            else straightCount = 1;
        }
        if (straightCount >= 5) score += 400;

        // Detección de Tríos/Pares
        if (countsArr.includes(3)) score += 300;
        if (countsArr.includes(2)) score += 100;

        // Sumar valor de la carta más alta para desempatar
        score += sorted[0].value;

        return score;
    }

    /**
     * Determina el ganador entre varios jugadores
     */
    determineWinner(activePlayers) {
        let winner = null;
        let maxScore = -1;

        activePlayers.forEach(p => {
            if (!p.isFolded) {
                // La mano es la combinación de sus cartas + las comunitarias
                const fullHand = [...p.cards, ...this.communityCards];
                const currentScore = this로 this.evaluateHand(fullHand);

                if (currentScore > maxScore) {
                    maxScore = currentScore;
                    winner = p;
                }
            }
        });
        return winner;
    }

    // --- FLUJO DE LA PARTIDA ---

    async playRound() {
        this.createDeck();
        this.resetTable();
        
        // 1. Repartir cartas iniciales (Pre-flop)
        this.players.forEach(p => {
            if(p.role === 'human' || p.role === 'cpu') {
                // Aquí se reparten las cartas pero las del humano se ven, las de los bots no
                p.cards = [this.drawCard(), this.drawCard()];
            }
        });

        // 2. Fase de Apuestas (Flop, Turn, River)
        await this.bettingPhase();

        // 3. Mostrar cartas comunitarias
        this.communityCards = [this.drawCard(), this.drawCard(), this.drawCard()];
        this.updateUI();
        
        // 4. Evaluación Final (Showdown)
        const activePlayers = this.players.filter(p => !p.isFolded);
        if (activePlayers.length > 1) {
            const winner = this.determineWinner(actives);
            this.logMessage(`El ganador es ${winner.name}`);
            // Repartir el Pot
            winner.chips += this.pot;
            this.pot = 0;
        }
        
        this.checkGameOver();
    }

    drawCard() {
        const card = this.deck.pop();
        return card;
    }

    async bettingPhase() {
        // Simulación de turnos de apuestas (esto sería un loop de tiempo)
        // En una app real, aquí esperarías el input del usuario
        this.logMessage("Esperando acciones...");
        // Lógica para el botón "Call/Fold" del humano...
    }

    updateUI() {
        // Actualizar la mesa y los chips
        this.players.forEach(p => {
            const el = document.getElementById(`player-${p.id}`);
            if(el) {
                el.querySelector('.chips').textContent = `${p.chips}€`;
                const slot = el.querySelector('.card-slot');
                slot.innerHTML = '';
                p.cards.forEach(c => {
                    const img = document.createElement('img');
                    img.src = `assets/images/${c.suit}-${c.value}.png`;
                    img.className = 'card-visual';
                    slot.appendChild(img);
                });
            }
        });
    }

    logMessage(msg) {
        const p = document.createElement('p');
        p.textContent = `> ${msg}`;
        this.log.prepend(p);
    }

    checkGameOver() {
        const human = this.players[0];
        if (human.chips <= 0) {
            this.logMessage("FIN DEL JUEGO: Has quebrado.");
            this.isGameOver = true;
        }
        // Si los otros bots se quedan sin dinero, el humano también pierde o gana
    }

    // --- MÉTODOS PARA EL HTML (Atados a botones) ---
    fold() {
        const human = this.players[0];
        human.isFolded = true;
        this.logMessage("Has foldeado.");
        // Lógica de la siguiente fase o fin de mano...
    }

    call() {
        this.logMessage("Has pagado.");
        // Aquí dispararías el flujo de la partida
    }

    raise() {
        this.logMessage("Has subido!");
    }
}

// Inicialización
const game = new PokerGame();
