let allFlashcards = [];
let flashcards = [];
let current = 0;
let learnedTerms = JSON.parse(localStorage.getItem('learnedTerms')) || [];
let currentFilter = 'all';
let selectedVoiceName = localStorage.getItem('preferredVoice');

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

function loadVoices() {
    const voiceSelect = document.getElementById('voiceSelect');
    if (!voiceSelect) return;

    const voices = window.speechSynthesis.getVoices();
    // Filtramos solo voces de francés (de cualquier región)
    const frVoices = voices.filter(v => v.lang.startsWith('fr'));

    // Limpiar selector
    voiceSelect.innerHTML = '';

    if (frVoices.length === 0) {
        const opt = document.createElement('option');
        opt.textContent = 'No se encontraron voces francesas';
        voiceSelect.appendChild(opt);
        return;
    }

    // Ordenar voces: primero las que parecen más naturales o premium (Google, Natural, Online)
    frVoices.sort((a, b) => {
        const score = (v) => {
            let s = 0;
            const name = v.name.toLowerCase();
            if (name.includes('google')) s += 10;
            if (name.includes('natural')) s += 8;
            if (name.includes('online')) s += 5;
            if (name.includes('ca')) s += 2; // Prioridad leve al francés canadiense
            return s;
        };
        return score(b) - score(a);
    });

    frVoices.forEach(voice => {
        const option = document.createElement('option');
        option.value = voice.name;
        // Almacenamos el idioma en un atributo de datos para usarlo al hablar
        option.setAttribute('data-lang', voice.lang);
        option.textContent = `${voice.name} (${voice.lang})`;
        if (voice.name === selectedVoiceName) {
            option.selected = true;
        }
        voiceSelect.appendChild(option);
    });

    // Set default if none selected
    if (!selectedVoiceName && frVoices.length > 0) {
        selectedVoiceName = frVoices[0].name;
    }
}

function speak(text) {
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(text);

        const voices = window.speechSynthesis.getVoices();
        const voice = voices.find(v => v.name === selectedVoiceName) ||
            voices.find(v => v.lang.startsWith('fr'));

        if (voice) {
            utter.voice = voice;
            utter.lang = voice.lang; // Forzar fonética del idioma de la voz
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
    if (currentFilter === 'learned') {
        flashcards = allFlashcards.filter(card => learnedTerms.includes(card["Término en francés"]));
    } else if (currentFilter === 'pending') {
        flashcards = allFlashcards.filter(card => !learnedTerms.includes(card["Término en francés"]));
    } else {
        flashcards = [...allFlashcards];
    }

    current = 0;
    if (flashcards.length > 0) {
        showCard(0);
    } else {
        const container = document.getElementById('flashcard');
        if (container) {
            container.innerHTML = `<p class="no-data">No hay palabras en esta categoría.</p>`;
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

    // Configuración de Voz
    const voiceSettingsBtn = document.getElementById('voiceSettingsBtn');
    const voiceSelectorPopup = document.getElementById('voiceSelectorPopup');
    const voiceSelect = document.getElementById('voiceSelect');

    if (voiceSettingsBtn) {
        voiceSettingsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            voiceSelectorPopup.classList.toggle('active');
        });
    }

    // Cerrar popup al hacer clic fuera
    document.addEventListener('click', () => {
        if (voiceSelectorPopup) voiceSelectorPopup.classList.remove('active');
    });

    if (voiceSelectorPopup) {
        voiceSelectorPopup.addEventListener('click', (e) => e.stopPropagation());
    }

    if (voiceSelect) {
        voiceSelect.addEventListener('change', () => {
            selectedVoiceName = voiceSelect.value;
            localStorage.setItem('preferredVoice', selectedVoiceName);
            // Probar la voz
            speak("Bonjour");
        });
    }

    // Inicializar voces
    if ('speechSynthesis' in window) {
        window.speechSynthesis.onvoiceschanged = loadVoices;
        loadVoices();
    }

    init();
});
