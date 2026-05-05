// Estado inicial del juego
const gameState = {
    phase: 'start', // fases: start, preflop, flop, turn, river, showdown
    players: [{ name: "Jugador", isFolded: false }]
};

/** 
 * Función para ajustar el tamaño de la pantalla (Responsive)
 * Esto es vital para que en móviles se vea como una App y no cortado.
 */
function resizeGame() {
    const wrapper = document.getElementById('game-wrapper');
    // Calculamos la escala necesaria para que el juego quepa siempre en la pantalla del móvil
    const scale = Math.min(window.innerWidth / 1280, window.innerHeight / 720);
    
    // Aplicamos transformación al contenedor principal (esto mueve todo: botones y mesa)
    wrapper.style.transformOrigin = "center"; 
    wrapper.style.transform = `scale(${scale})`;
}

/**
 * Función para manejar las acciones del usuario (Fold, Call, Raise)
 */
function handleAction(actionType) {
    const statusMsg = document.getElementById('status-msg');
    const controlsContainer = document.getElementById('controls-container');

    if (actionType === 'fold') {
        gameState.players[0].isFolded = true;
        statusMsg.innerText = "Te has retirado.";
        // Ocultamos los controles tras la acción para que no estorben
        controlsContainer.classList.add('hidden'); 
    } else if (actionType === 'call') {
        statusMsg.innerText = "Pagas la apuesta...";
        setTimeout(() => nextPhase(), 1000); // Simulación de retraso en el juego
    }
}

/**
 * Función para avanzar a la siguiente fase del juego
 */
function nextPhase() {
    if (gameState.phase === 'preflop') {
        gameState.phase = 'flop';
        // Aquí iría la lógica para repartir cartas comunitarias...
        document.getElementById('status-msg').innerText = "Fase: FLOP";
    } else if (gameState.phase === 'showdown') {
        alert("¡Fin del juego!");
        location.reload(); // Reiniciar el juego
    }
}

// Escuchar cambios de tamaño para reajustar la escala automáticamente
window.addEventListener('resize', resizeGame);

// Ejecutar ajuste inicial al cargar y un pequeño delay por seguridad
setTimeout(resizeGame, 100);
window.onload = () => {
    document.getElementById('controls-container').classList.remove('hidden');
    resizeGame();
};

// Configuración de los 6 jugadores
const players = [
    { id: 1, name: "Bot 1", chips: 1000 },
    { id: 2, name: "Bot 2", chips: 1000 },
    { id: 3, name: "Bot 3", chips: 1000 },
    { id: 4, name: "Bot 4", chips: 1000 },
    { id: 5, name: "Bot 5", chips: 1000 },
    { id: 6, name: "Tú", chips: 1000 } // Humano
];

function dealInitialCards() {
    players.forEach(player => {
        // Repartimos dos cartas a cada uno
        for(let i=0; i<2; i++) {
            const cardData = deck.pop();
            // Solo mostramos (isFaceUp = true) si es el jugador 6[cite: 2]
            const isVisible = (player.id === 6); 
            renderCard(`player-${player.id}`, cardData, isVisible);
        }
    });
}

function renderCard(containerId, cardName, isFaceUp) {
    const container = document.getElementById(containerId);
    const cardDiv = document.createElement('div');
    cardDiv.className = 'card';
    
    // Usamos tus nombres de archivo
    const imgName = isFaceUp ? `${cardName}.png` : 'Back-R.png';
    cardDiv.style.backgroundImage = `url('assets/images/${imgName}')`;
    
    container.appendChild(cardDiv);
}