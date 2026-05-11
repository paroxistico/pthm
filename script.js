/**
 * MOTOR DE JUEGO DE PÓKER TEXAS HOLD'EM
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
        this.currentStage = 'PREFLOP';
        this.isGameOver = false;
        this.actionResolver = null;

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

    createDeck() {
        const suits = ['H', 'D', 'C', 'S']; 
        const values = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 1];
        this.deck = [];
        for (let s of suits) {
            for (let v of values) {
                this.deck.push({ suit: s, value: v });
            }
        }
        for (let i = this.deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
        }
    }

    async startGame() {
        console.log("🎵 Iniciando partida...");
        this.overlay.classList.add('hidden');
        try { await this.music.play(); } catch (e) { console.warn("Audio:", e); }
        await this.playRound();
    }

    resetTable() {
        this.pot = 0;
        this.communityCards = [];
        this.players.forEach(p => { p.cards = []; p.isFolded = false; });
        this.currentStage = 'PREFLOP';
        this.updateUI();
        this.logMessage("🃏 Nueva mano. ¡Buena suerte!");
    }

    evaluateHand(cardArray) {
        if (!cardArray || cardArray.length < 5) return 0;
        const sorted = [...cardArray].sort((a, b) => b.value - a.value);
        const counts = {};
        sorted.forEach(c => counts[c.value] = (counts[c.value] || 0) + 1);

        let score = 0;
        const countsArr = Object.values(counts);
        if (countsArr.includes(3) && countsArr.includes(2)) score += 700;
        if (countsArr.includes(4)) score += 800;
        
        const suitCount = sorted.reduce((acc, c) => { acc[c.suit] = (acc[c.suit] || 0) + 1; return acc; }, {});
        if (Object.values(suitCount).some(v => v >= 5)) score += 600;

        let straightCount = 1;
        for(let i=0; i<sorted.length-1; i++) {
            if(sorted[i].value === sorted[i+1].value + 1) straightCount++;
            else straightCount = 1;
        }
        if (straightCount >= 5) score += 400;

        if (countsArr.includes(3)) score += 300;
        if (countsArr.includes(2)) score += 100;
        score += sorted[0].value;
        return score;
    }

    // 🆕 Detecta y devuelve el nombre de la mejor mano en español
    getHandName(cards) {
        const sorted = [...cards].sort((a,b) => b.value - a.value);
        const counts = {};
        sorted.forEach(c => counts[c.value] = (counts[c.value] || 0) + 1);
        const cArr = Object.values(counts).sort((a,b) => b-a);

        const suitCounts = {};
        sorted.forEach(c => suitCounts[c.suit] = (suitCounts[c.suit] || 0) + 1);
        const hasFlush = Object.values(suitCounts).some(v => v >= 5);

        let uniqueVals = [...new Set(sorted.map(c=>c.value))].sort((a,b)=>b-a);
        let hasStraight = false;
        for(let i=0; i<=uniqueVals.length-5; i++) {
            if(uniqueVals[i] - uniqueVals[i+4] === 4) { hasStraight = true; break; }
        }

        if (hasFlush && hasStraight) return "Escalera de Color";
        if (cArr[0] === 4) return "Póker (Four of a Kind)";
        if (cArr[0] === 3 && cArr[1] >= 2) return "Full House";
        if (hasFlush) return "Color (Flush)";
        if (hasStraight) return "Escalera (Straight)";
        if (cArr[0] === 3) return "Trío (Three of a Kind)";
        if (cArr[0] === 2 && cArr[1] === 2) return "Doble Pareja";
        if (cArr[0] === 2) return "Pareja";
        return "Carta Alta";
    }

    determineWinner(activePlayers) {
        let winner = null, maxScore = -1;
        activePlayers.forEach(p => {
            if (!p.isFolded) {
                const fullHand = [...p.cards, ...this.communityCards];
                const currentScore = this.evaluateHand(fullHand);
                if (currentScore > maxScore) { maxScore = currentScore; winner = p; }
            }
        });
        return winner;
    }

    async playRound() {
        this.createDeck();
        this.resetTable();
        
        this.players.forEach(p => { p.cards = [this.drawCard(), this.drawCard()]; });
        this.updateUI();
        this.logMessage("📥 Cartas repartidas.");

        await this.bettingPhase("Pre-Flop");

        this.communityCards = [this.drawCard(), this.drawCard(), this.drawCard()];
        this.updateUI();
        this.logMessage("🃏 Flop repartido.");
        await this.bettingPhase("Flop");

        this.communityCards.push(this.drawCard());
        this.updateUI();
        this.logMessage("🃏 Turn repartido.");
        await this.bettingPhase("Turn");

        this.communityCards.push(this.drawCard());
        this.updateUI();
        this.logMessage("🃏 River repartido.");
        await this.bettingPhase("River");

        this.currentStage = 'SHOWDOWN';
        this.updateUI(); 

        const activePlayers = this.players.filter(p => !p.isFolded);
        if (activePlayers.length > 1) {
            const winner = this.determineWinner(activePlayers);
            // 🆕 Mensaje con el tipo de mano ganadora
            const winHandName = this.getHandName([...winner.cards, ...this.communityCards]);
            this.logMessage(`🏆 El ganador es ${winner.name} con una ${winHandName}.`);
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
        if (this.deck.length === 0) this.createDeck();
        return this.deck.pop();
    }

    async bettingPhase(phaseName) {
        this.logMessage(`⏳ Fase: ${phaseName}. Tu turno.`);
        if (this.controls) this.controls.classList.remove('hidden');
        
        return new Promise((resolve) => {
            this.actionResolver = resolve;
        });
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
                    if (p.role === 'cpu' && this.currentStage !== 'SHOWDOWN') {
                        img.className = 'card-visual card-back';
                    } else {
                        img.src = `assets/images/${c.suit}-${c.value}.png`;
                        img.className = 'card-visual';
                        img.alt = `${c.value} ${c.suit}`;
                        img.onerror = () => {
                            img.style.backgroundColor = '#eee';
                            img.style.border = '2px solid #333';
                            img.src = `https://via.placeholder.com/50x70?text=${c.value}${c.suit}`;
                        };
                    }
                    slot.appendChild(img);
                });
            }
        });

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
            return;
        }

        setTimeout(() => {
            this.logMessage("💡 Pulsa 'Empezar Partida' para la siguiente mano.");
            this.overlay.classList.remove('hidden');
            if (this.controls) this.controls.classList.add('hidden');
        }, 2500);
    }

    fold() {
        const human = this.players[0];
        human.isFolded = true;
        this.logMessage("📂 Has foldeado.");
        if (this.controls) this.controls.classList.add('hidden');
        this.simulateBotsAndContinue();
    }

    call() {
        const human = this.players[0];
        const bet = 50;
        if (human.chips >= bet) {
            human.chips -= bet;
            this.pot += bet;
            this.logMessage(`💰 Has pagado ${bet}€.`);
        } else {
            this.logMessage("💸 No tienes suficientes fichas.");
        }
        if (this.controls) this.controls.classList.add('hidden');
        this.simulateBotsAndContinue();
    }

    raise() {
        const human = this.players[0];
        const bet = 100;
        if (human.chips >= bet) {
            human.chips -= bet;
            this.pot += bet;
            this.logMessage(`📈 ¡Has subido ${bet}€!`);
        } else {
            this.logMessage("💸 No tienes suficientes fichas para subir.");
        }
        if (this.controls) this.controls.classList.add('hidden');
        this.simulateBotsAndContinue();
    }

    simulateBotsAndContinue() {
        this.logMessage("🤖 Bots evaluando...");
        let delay = 0;
        for (let i = 1; i < this.players.length; i++) {
            const bot = this.players[i];
            setTimeout(() => {
                if (!bot.isFolded) {
                    const action = Math.random();
                    if (action > 0.3) { 
                        const bet = 50;
                        bot.chips -= bet;
                        this.pot += bet;
                        this.logMessage(`${bot.name} paga ${bet}€.`);
                    } else {
                        bot.isFolded = true;
                        this.logMessage(`${bot.name} foldea.`);
                    }
                }
                this.updateUI();
            }, delay);
            delay += 600;
        }

        setTimeout(() => {
            if (this.actionResolver) this.actionResolver();
        }, delay + 400);
    }
}

const game = new PokerGame();
