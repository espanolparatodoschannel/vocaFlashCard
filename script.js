/* 
  Lumière Académie | script.js
  Logic for 3D Flashcard study system with Focus Mode.
  Optimized for multi-definition JSON schema.
*/

let allFlashcards = [];
let currentFlashcardIndex = 0;
let filteredFlashcards = [];
let currentFilter = 'all';
let learnedTerms = JSON.parse(localStorage.getItem('learnedTerms')) || [];

document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('searchInput');
    const clearSearchBtn = document.getElementById('clearSearchBtn');
    const themeToggle = document.getElementById('themeToggle');

    // Inicializar Tema
    if (localStorage.getItem('theme') === 'light') {
        document.documentElement.setAttribute('data-theme', 'light');
    }

    themeToggle.addEventListener('click', () => {
        const isLight = document.documentElement.getAttribute('data-theme') === 'light';
        const newTheme = isLight ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
    });

    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        clearSearchBtn.style.display = query ? 'flex' : 'none';
        applyFilter();
        
        // Salir de modo foco al buscar
        document.querySelector('.header').classList.remove('focus-mode');
        document.querySelector('.search-container').classList.remove('focus-mode');
    });

    clearSearchBtn.addEventListener('click', () => {
        searchInput.value = '';
        clearSearchBtn.style.display = 'none';
        applyFilter();
        searchInput.focus();
    });

    async function init() {
        try {
            const response = await fetch('vocabulario.json');
            if (!response.ok) throw new Error('Network response was not ok');
            const data = await response.json();
            
            // Validar que sea un array
            allFlashcards = (Array.isArray(data) ? data : []).sort((a, b) => 
                a["Término en francés"].localeCompare(b["Término en francés"])
            );
            
            applyFilter();
            lucide.createIcons(); // Inicializar iconos Lucide
        } catch (error) {
            console.error('Error cargando vocabulario:', error);
            document.getElementById('flashcard').innerHTML = `<p class="no-data">Error al cargar datos.<br><small style="opacity:0.5">${error.message}</small></p>`;
        }
    }

    init();
    lucide.createIcons(); // Carga iconos estáticos del index
});

function applyFilter() {
    const query = (document.getElementById('searchInput')?.value || '').toLowerCase();
    
    filteredFlashcards = allFlashcards.filter(card => {
        const termFr = (card["Término en francés"] || '').toLowerCase();
        
        // Buscar en el término principal y en todas las definiciones
        const definitionsMatch = card.definiciones ? card.definiciones.some(d => 
            (d["Término en español"] || '').toLowerCase().includes(query)
        ) : false;

        const matchesSearch = termFr.includes(query) || definitionsMatch;
        
        if (currentFilter === 'pending') {
            return matchesSearch && !learnedTerms.includes(card["Término en francés"]);
        } else if (currentFilter === 'learned') {
            return matchesSearch && learnedTerms.includes(card["Término en francés"]);
        }
        return matchesSearch;
    });

    currentFlashcardIndex = 0;
    updateCounter();
    showCard();
}

function setFilter(filter) {
    currentFilter = filter;
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn.id === `filter-${filter}`);
    });
    applyFilter();
}

function flipCard() {
    const card = document.getElementById('flashcard');
    if (!card) return;
    card.classList.toggle('flipped');
    
    // Activar Modo Foco al interactuar
    if (filteredFlashcards.length > 0) {
        document.querySelector('.header').classList.add('focus-mode');
    }
}

function showCard() {
    const front = document.getElementById('flashcardFront');
    const back = document.getElementById('flashcardBack');
    const cardElement = document.getElementById('flashcard');
    
    if (!front || !back || !cardElement) return;

    // Resetear rotación
    cardElement.classList.remove('flipped');

    if (filteredFlashcards.length === 0) {
        front.innerHTML = '<p class="no-data">No hay palabras disponibles.</p>';
        back.style.display = 'none';
        return;
    }

    back.style.display = 'flex';
    const card = filteredFlashcards[currentFlashcardIndex];
    const isLearned = learnedTerms.includes(card["Término en francés"]);

    // CARA FRONTAL
    front.innerHTML = `
        <button class="learned-toggle ${isLearned ? 'is-learned' : ''}" 
                onclick="event.stopPropagation(); toggleLearned('${card["Término en francés"].replace(/'/g, "\\'")}')" title="¿Aprendida?">
            <i data-lucide="${isLearned ? 'check-circle' : 'circle'}"></i>
        </button>
        <h1 class="word-fr speakable" onclick="event.stopPropagation(); speak('${card["Término en francés"].replace(/'/g, "\\'")}')">${card["Término en francés"]}</h1>
    `;
    lucide.createIcons();

    // CARA POSTERIOR (Múltiples definiciones)
    let contentHtml = `<div class="word-fr-small">${card["Término en francés"]}</div>`;
    
    if (card.verbo_infinitivo) {
        contentHtml += `<div class="word-infinitive">${card.verbo_infinitivo}</div>`;
    }

    if (card.definiciones && card.definiciones.length > 0) {
        contentHtml += card.definiciones.map(def => `
            <div class="def-block" style="width:100%; margin-bottom: 20px;">
                <div class="es-container" style="text-align: center; margin-bottom: 12px;">
                    ${(() => {
                        const esTerm = def["Término en español"];
                        const match = esTerm.match(/^(.*?)\s*\((.*?)\)\s*$/); // Detecta paréntesis al final de forma flexible
                        if (match) {
                            return `
                                <div class="word-es">${match[1].trim()}</div>
                                <div class="word-es-sub">(${match[2].trim()})</div>
                            `;
                        }
                        return `<div class="word-es">${esTerm}</div>`;
                    })()}
                </div>
                <div class="sentence-group">
                    <div class="sentence-fr-row speakable" onclick="event.stopPropagation(); speak('${def["Ejemplo en francés"].replace(/'/g, "\\'")}')">
                        <span>${def["Ejemplo en francés"]}</span>
                    </div>
                    <div class="sentence-es">${def["Ejemplo en español"]}</div>
                </div>
            </div>
        `).join('<hr style="margin: 5px 0; opacity: 0.1;">');
    }

    back.innerHTML = `<div class="card-content" style="width:100%">${contentHtml}</div>`;

    // Animación de entrada suave
    cardElement.style.animation = 'none';
    cardElement.offsetHeight; /* Trigger reflow */
    cardElement.style.animation = 'slideIn 0.3s ease-out';

    updateCounter();
}

function nextCard() {
    if (filteredFlashcards.length === 0) return;
    currentFlashcardIndex = (currentFlashcardIndex + 1) % filteredFlashcards.length;
    showCard();
}

function prevCard() {
    if (filteredFlashcards.length === 0) return;
    currentFlashcardIndex = (currentFlashcardIndex - 1 + filteredFlashcards.length) % filteredFlashcards.length;
    showCard();
}

function randomCard() {
    if (filteredFlashcards.length === 0) return;
    currentFlashcardIndex = Math.floor(Math.random() * filteredFlashcards.length);
    showCard();
}

function updateCounter() {
    const counter = document.getElementById('cardCounter');
    if (!counter) return;
    if (filteredFlashcards.length === 0) {
        counter.textContent = '0 / 0';
    } else {
        counter.textContent = `${currentFlashcardIndex + 1} / ${filteredFlashcards.length}`;
    }
}

function toggleLearned(term) {
    if (learnedTerms.includes(term)) {
        learnedTerms = learnedTerms.filter(t => t !== term);
    } else {
        learnedTerms.push(term);
        // Feedback Háptico de éxito (vibración doble corta)
        if (navigator.vibrate) navigator.vibrate([10, 30, 10]);
    }
    localStorage.setItem('learnedTerms', JSON.stringify(learnedTerms));
    showCard();
}

function speak(text) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'fr-FR';
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
}

// ESTADÍSTICAS
function toggleView() {
    const study = document.getElementById('studyContainer');
    const stats = document.getElementById('statsContainer');
    const toggleBtn = document.getElementById('statsToggle');
    
    if (stats.style.display === 'none') {
        renderStats();
        study.style.display = 'none';
        stats.style.display = 'block';
        toggleBtn.innerHTML = '<i data-lucide="layout"></i>';
        lucide.createIcons();
        document.querySelector('.header').classList.remove('focus-mode');
    } else {
        study.style.display = 'block';
        stats.style.display = 'none';
        toggleBtn.innerHTML = '<i data-lucide="bar-chart-3"></i>';
        lucide.createIcons();
    }
}

function renderStats() {
    const total = allFlashcards.length;
    const learned = learnedTerms.length;
    const percentage = total > 0 ? Math.round((learned / total) * 100) : 0;
    
    const categories = {};
    allFlashcards.forEach(card => {
        const cat = card.categoría || 'General';
        if (!categories[cat]) categories[cat] = { total: 0, learned: 0 };
        categories[cat].total++;
        if (learnedTerms.includes(card["Término en francés"])) {
            categories[cat].learned++;
        }
    });

    const statsView = document.getElementById('statsView');

    let categoriesHtml = '';
    for (const [name, data] of Object.entries(categories)) {
        const catPerc = Math.round((data.learned / data.total) * 100);
        categoriesHtml += `
            <div class="cat-item">
                <div class="cat-info">
                    <span>${name}</span>
                    <span>${data.learned}/${data.total} (${catPerc}%)</span>
                </div>
                <div class="bar-container">
                    <div class="bar-fill" style="width: ${catPerc}%"></div>
                </div>
            </div>
        `;
    }

    const recentTerms = learnedTerms.slice(-6).reverse();
    let recentHtml = recentTerms.map(t => `<span class="recent-tag">${t}</span>`).join('');

    statsView.innerHTML = `
        <div class="stats-grid" style="margin-top: 20px;">
            <div class="stat-card">
                <div class="stat-value">${total}</div>
                <div class="stat-label">Total Vocabulario</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${learned}</div>
                <div class="stat-label">Aprendidas</div>
            </div>
        </div>
        <div class="category-stats">
            <h3>Temas</h3>
            <div class="category-list">${categoriesHtml}</div>
        </div>
        ${recentTerms.length > 0 ? `<div class="recent-mastery"><div class="recent-list">${recentHtml}</div></div>` : ''}
    `;
}
