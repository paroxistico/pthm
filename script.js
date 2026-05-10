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
        this.music = document.getElementById('bg-music');
        this.log = document.getElementById('status-log');
        this.controls = document.getElementById('controls');
        this.communityContainer = document.getElementById('community-cards');

        if (this.startBtn) {
            this.startBtn.addEventListener('click', () => this.startGame());
        }
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
        console.log("🎵 Iniciando partida...");
        this.overlay.classList.add('hidden');
        try {
            await this.music.play();
        } catch (e) {
            console.warn("Audio autoplay bloqueado o error:", e);
        }
        // playRound() ya incluye resetTable() internamente
        await this.playRound();
    }

    resetTable() {
        this.pot = 0;
        this.communityCards = [];
        this.players.forEach(p => {
            p.cards = [];
            p.isFolded = false;
        });
        this.currentStage = 'PREFLOP';
        this.updateUI();
        this.logMessage("🃏 Nueva mano. ¡Buena suerte!");
    }

    // --- LÓGICA DE EVALUACIÓN (EL CORAZÓN DEL JUEGO) ---

    evaluateHand(cardArray) {
        if (!cardArray || cardArray.length < 5) return 0;
        
        const sorted = [...cardArray].sort((a, b) => b.value - a.value);
        
        const counts = {};
        sorted.forEach(c => counts[c.value] = (counts[c.value] || 0) + 1);

        let score = 0;

        const countsArr = Object.values(counts);
        if (countsArr.includes(3) && countsArr.includes(2)) score += 700; // Full House
        if (countsArr.includes(4)) score += 800; // Four of a Kind
        
        const suitCount = sorted.reduce((acc, c) => {
            acc[c.suit] = (acc[c.suit] || 0) + 1;
            return acc;
        }, {});
        if (Object.values(suitCount).some(v => v >= 5)) score += 600; // Flush

        let straightCount = 1;
        for(let i=0; i<sorted.length-1; i++) {
            if(sorted[i].value === sorted[i+1].value + 1) straightCount++;
            else straightCount = 1;
        }
        if (straightCount >= 5) score += 400; // Straight

        if (countsArr.includes(3)) score += 300; // Trips
        if (countsArr.includes(2)) score += 100; // Pair

        score += sorted[0].value; // High card tie-breaker

        return score;
    }

    determineWinner(activePlayers) {
        let winner = null;
        let maxScore = -1;

        activePlayers.forEach(p => {
            if (!p.isFolded) {
                const fullHand = [...p.cards, ...this.communityCards];
                const currentScore = this.evaluateHand(fullHand);
                
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
            p.cards = [this.drawCard(), this.drawCard()];
        });
        this.updateUI();
        this.logMessage("📥 Cartas repartidas.");

        // 2. Fase de Apuestas (Simulada con delay para interacción)
        await this.bettingPhase();

        // 3. Flop: Mostrar 3 cartas comunitarias
        this.communityCards = [this.drawCard(), this.drawCard(), this.drawCard()];
        this.updateUI();
        this.logMessage("🃏 Flop repartido.");
        
        await this.bettingPhase(); // Segunda ronda de apuestas

        // 4. Showdown
        const activePlayers = this.players.filter(p => !p.isFolded);
        if (activePlayers.length > 1) {
            const winner = this.determineWinner(activePlayers);
            this.logMessage(`🏆 El ganador es ${winner.name}`);
            winner.chips += this.pot;
            this.pot = 0;
            this.updateUI();
        } else if (activePlayers.length === 1) {
            const winner = activePlayers[0];
            this.logMessage(`🏆 Todos foldearon. Gana ${winner.name}`);
            winner.chips += this.pot;
            this.pot = 0;
        }
        
        this.checkGameOver();
    }

    drawCard() {
        if (this.deck.length === 0) this.createDeck(); // Fallback por si se agota
        return this.deck.pop();
    }

    async bettingPhase() {
        // Simulación de turnos de apuestas con delay para que la UI sea usable
        this.logMessage("⏳ Esperando acciones del jugador y bots...");
        if (this.controls) this.controls.classList.remove('hidden');
        
        return new Promise(resolve => setTimeout(resolve, 2500));
    }

    updateUI() {
        this.players.forEach(p => {
            const el = document.getElementById(`player-${p.id}`);
            if(el) {
                el.querySelector('.chips').textContent = `${p.chips}€`;
                const slot = el.querySelector('.card-slot');
                slot.innerHTML = '';
                
                p.cards.forEach(c => {
                    const img = document.createElement('img');
                    // Fallback por si la imagen no existe en assets
                    img.src = `assets/images/${c.suit}-${c.value}.png`;
                    img.className = 'card-visual';
                    img.alt = `${c.value} ${c.suit}`;
                    img.onerror = () => {
                        img.style.backgroundColor = '#eee';
                        img.style.border = '2px solid #333';
                        img.src = `https://via.placeholder.com/50x70?text=${c.value}${c.suit}`;
                    };
                    slot.appendChild(img);
                });
            }
        });

        // Actualizar cartas comunitarias en el centro de la mesa
        if (this.communityContainer) {
            this.communityContainer.innerHTML = '';
            this.communityCards.forEach(c => {
                const img = document.createElement('img');
                img.src = `assets/images/${c.suit}-${c.value}.png`;
                img.className = 'card-visual community';
                img.alt = `${c.value} ${c.suit}`;
                img.onerror = () => {
                    img.style.backgroundColor = '#eee';
                    img.style.border = '2px solid #333';
                    img.src = `https://via.placeholder.com/50x70?text=${c.value}${c.suit}`;
                };
                this.communityContainer.appendChild(img);
            });
        }
    }

    logMessage(msg) {
        const p = document.createElement('p');
        p.textContent = `> ${msg}`;
        if (this.log) this.log.prepend(p);
    }

    checkGameOver() {
        const human = this.players[0];
        if (human.chips <= 0) {
            this.logMessage("🔚 FIN DEL JUEGO: Has quebrado.");
            this.isGameOver = true;
            if (this.controls) this.controls.classList.add('hidden');
        } else {
            // Siguiente ronda automática tras pausa
            setTimeout(() => {
                if (!this.isGameOver) this.playRound();
            }, 3000);
        }
    }

    // --- MÉTODOS PARA EL HTML (Atados a botones) ---
    fold() {
        const human = this.players[0];
        human.isFolded = true;
        this.logMessage("📂 Has foldeado.");
        if (this.controls) this.controls.classList.add('hidden');
    }

    call() {
        this.logMessage("💰 Has pagado (Call).");
        if (this.controls) this.controls.classList.add('hidden');
    }

    raise() {
        const human = this.players[0];
        if (human.chips >= 100) {
            this.pot += 100;
            human.chips -= 100;
            this.logMessage("📈 ¡Has subido la apuesta!");
            this.updateUI();
        } else {
            this.logMessage("💸 No tienes suficientes fichas para subir.");
        }
        if (this.controls) this.controls.classList.add('hidden');
    }
}

// Inicialización global
const game = new PokerGame();
