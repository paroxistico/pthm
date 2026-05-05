class PokerGame {
    constructor() {
        this.deck = [];
        this.players = []; // 0-5, donde uno es humano
        this.communityCards = [];
        this.pot = 0;
        this.isHumanTurn = true;
        this.init();
    }

    init() {
        // Iniciar música al primer click (política de navegadores)
        document.addEventListener('click', () => {
            const music = document.getElementById('bg-music');
            if(music.paused) music.play();
        }, { once: true });

        this.createDeck();
    }

    // Generar baraja según tu formato de nombres
    createDeck() {
        const suits = ['H', 'D', 'S', 'C']; // Hearts, Diamonds, Spades, Clubs
        const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]; // El 1 es As (A)

        this.deck = [];
        for(let s of suits) {
            for(let v of values) {
                // Mapeo de valor para el nombre del archivo: J=11, Q=12, K=13
                let valName = v === 1 ? 'A' : (v === 11 ? 'J' : (v === 12 ? 'Q' : (v === 13 ? 'K' : v)));
                this.deck.            push({ suit: s, value: v, name: `${s}-${valName}` });
            }
        }
    }

    // Función para repartir cartas con animación visual
    dealCard(targetElementId, isFaceDown = true) {
        const cardData = this.deck.pop(); // Sacar carta del mazo
        const container = document.getElementById(targetElementId);
        
        const imgPath = isFaceDown ? 'assets/images/Back-R.png' : `assets/images/${cardData.name}.png`;

        // Crear elemento de la carta en el DOM para animación
        const cardEl = document.createElement('img');
        cardEl.src = imgPath;
        cardEl.className = 'card';
        cardEl.style.left = "50%"; // Empieza desde un punto central (el mazo)
        cardEl.style.top = "-100px"; 

        container.appendChild(cardEl);

        // Animación de la carta moviéndose a su posición final
        setTimeout(() => {
            cardEl.style.transform = "translateY(20px)"; // Se mueve al lugar del jugador
        }, 50);

        return cardData;
    }

    fold() {
        this.log("Has foldeado la mano.");
        // Lógica de fin de ronda...
    }

    raise() {
        this.log("Hiciste Raise!");
        // Aquí iría el proceso de apuestas y turnos NPC
    }

    log(msg) {
        const logDiv = document.getElementById('log');
        logDiv.innerText = msg;
    }
}

// Iniciar juego
const game = new PokerGame();
