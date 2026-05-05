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
    wrapper.style.transform = `translate(-50%, -5-scale(${scale}))`;
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
