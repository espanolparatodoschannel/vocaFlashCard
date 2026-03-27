let allFlashcards = [];
let flashcards = [];
let current = 0;
let learnedTerms = JSON.parse(localStorage.getItem('learnedTerms')) || [];
let currentFilter = 'all';

// Cargar datos
async function init() {
    try {
        const response = await fetch('vocabulario.json');
        allFlashcards = await response.json();

        // Ordenar alfabéticamente por término francés
        allFlashcards.sort((a, b) =>
            a["Término en francés"].localeCompare(b["Término en francés"], 'fr', { sensitivity: 'base' })
        );

        applyFilter();
    } catch (error) {
        console.error('Error cargando JSON:', error);
        const cardElement = document.getElementById('flashcard');
        if (cardElement) {
            cardElement.innerHTML = '<p style="color:red">Error al cargar datos. Asegúrate de que vocabulario.json exista y esté en la misma carpeta.</p>';
        }
    }
}

function speak(text) {
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(text);

        const voices = window.speechSynthesis.getVoices();
        
        // Buscar la voz francesa con más prioridad (Google, Natural, etc.)
        const frVoices = voices.filter(v => v.lang.startsWith('fr'));
        frVoices.sort((a, b) => {
            const score = (v) => {
                let s = 0;
                const name = v.name.toLowerCase();
                if (name.includes('google')) s += 10;
                if (name.includes('natural')) s += 8;
                if (name.includes('online')) s += 5;
                if (name.includes('ca')) s += 2;
                return s;
            };
            return score(b) - score(a);
        });

        const voice = frVoices[0];

        if (voice) {
            utter.voice = voice;
            utter.lang = voice.lang; 
        } else {
            utter.lang = 'fr-FR';
        }

        utter.rate = 0.9;
        window.speechSynthesis.speak(utter);
    }
}

function showCard(idx) {
    if (!flashcards.length) return;

    const card = flashcards[idx];
    const container = document.getElementById('flashcard');
    if (!container) return;

    const innerContent = container.querySelector('.card-content');
    if (innerContent) {
        innerContent.classList.add('fade-out-content');
    }

    setTimeout(() => {
        const terminoFr = card["Término en francés"];
        const palabraEscaped = terminoFr.replace(/'/g, "\\'");

        const isLearned = learnedTerms.includes(terminoFr);

        let html = `
            <button class="sound-btn-main" onclick="speak('${palabraEscaped}')" title="Escuchar término">🔊</button>
            <button class="learned-toggle ${isLearned ? 'is-learned' : ''}" 
                    onclick="toggleLearned('${palabraEscaped}')" 
                    title="${isLearned ? 'Marcar como pendiente' : 'Marcar como aprendida'}">
                ✅
            </button>
            <div class="card-content">
            <div class="word-fr">${terminoFr}</div>
        `;

        if (card.verbo_infinitivo) {
            html += `<div class="word-infinitive">${card.verbo_infinitivo}</div>`;
        }

        if (card.definiciones) {
            const definitionsToShow = card.definiciones.slice(0, 2);
            definitionsToShow.forEach((def, i) => {
                if (i > 0) html += '<hr>';
                const oracionEscaped = def["Ejemplo en francés"].replace(/'/g, "\\'");
                html += `
                    <div class="def-container">
                        <div class="word-es">${def["Término en español"]}</div>
                        <div class="sentence-group">
                            <div class="sentence-fr-row">
                                <span>${def["Ejemplo en francés"]}</span>
                                <button class="mini-sound-btn" onclick="speak('${oracionEscaped}')" title="Escuchar ejemplo">🗣️</button>
                            </div>
                            <div class="sentence-es">${def["Ejemplo en español"]}</div>
                        </div>
                    </div>
                `;
            });
        }

        html += `</div>`;

        container.innerHTML = html;
        
        // Actualizar contador externo
        const externalCounter = document.getElementById('counterExternal');
        if (externalCounter) {
            externalCounter.textContent = `${idx + 1} / ${flashcards.length}`;
        }
    }, 150);
}

function nextCard() {
    if (!flashcards.length) return;
    current = (current + 1) % flashcards.length;
    showCard(current);
}

function prevCard() {
    if (!flashcards.length) return;
    current = (current - 1 + flashcards.length) % flashcards.length;
    showCard(current);
}

function randomCard() {
    if (flashcards.length < 2) return;
    let rand;
    do {
        rand = Math.floor(Math.random() * flashcards.length);
    } while (rand === current);
    current = rand;
    showCard(current);
}

function setFilter(filterType) {
    currentFilter = filterType;
    
    // UI: Actualizar botones activos
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.getElementById(`filter-${filterType}`);
    if (activeBtn) activeBtn.classList.add('active');

    applyFilter();
}

function applyFilter() {
    const searchInput = document.getElementById('searchInput');
    const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';

    flashcards = allFlashcards.filter(card => {
        // Filtrar por estado (dominadas / pendientes)
        let statusMatch = true;
        if (currentFilter === 'learned') {
            statusMatch = learnedTerms.includes(card["Término en francés"]);
        } else if (currentFilter === 'pending') {
            statusMatch = !learnedTerms.includes(card["Término en francés"]);
        }

        // Filtrar por término de búsqueda (frances o español)
        let searchMatch = true;
        if (searchTerm !== '') {
            const termFr = card["Término en francés"].toLowerCase();
            const termInf = (card.verbo_infinitivo || "").toLowerCase();
            const hasDefMatch = card.definiciones && card.definiciones.some(def => 
                def["Término en español"].toLowerCase().includes(searchTerm)
            );
            searchMatch = termFr.includes(searchTerm) || termInf.includes(searchTerm) || hasDefMatch;
        }

        return statusMatch && searchMatch;
    });

    current = 0;
    if (flashcards.length > 0) {
        showCard(0);
    } else {
        const container = document.getElementById('flashcard');
        if (container) {
            container.innerHTML = `<p class="no-data">No hay resultados para tu búsqueda.</p>`;
        }
        const externalCounter = document.getElementById('counterExternal');
        if (externalCounter) externalCounter.textContent = `0 / 0`;
    }
}

function toggleLearned(term) {
    const index = learnedTerms.indexOf(term);
    if (index > -1) {
        learnedTerms.splice(index, 1);
    } else {
        learnedTerms.push(term);
    }
    
    localStorage.setItem('learnedTerms', JSON.stringify(learnedTerms));
    
    // Si estamos en un filtro activo y la palabra ya no coincide, refrescar
    if (currentFilter !== 'all') {
        applyFilter();
    } else {
        showCard(current); // Solo refrescar la visual de la tarjeta actual
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // Tema
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            const currentTheme = document.documentElement.getAttribute('data-theme');
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', newTheme);
            themeToggle.textContent = newTheme === 'dark' ? '☀️' : '🌓';
            localStorage.setItem('theme', newTheme);
        });
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme) {
            document.documentElement.setAttribute('data-theme', savedTheme);
            themeToggle.textContent = savedTheme === 'dark' ? '☀️' : '🌓';
        }
    }

    // Evento para el buscador
    const searchInput = document.getElementById('searchInput');
    const clearSearchBtn = document.getElementById('clearSearchBtn');
    
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            if (clearSearchBtn) {
                clearSearchBtn.style.display = searchInput.value.length > 0 ? 'flex' : 'none';
            }
            applyFilter();
        });
        
        if (clearSearchBtn) {
            clearSearchBtn.addEventListener('click', () => {
                searchInput.value = '';
                clearSearchBtn.style.display = 'none';
                applyFilter();
                searchInput.focus();
            });
        }
    }

    // Asegurarse de cargar las voces localmente en background para que estén listas
    if ('speechSynthesis' in window) {
        // Un simple getVoices() triggerea la carga en Chrome
        window.speechSynthesis.getVoices();
    }

    init();
});
