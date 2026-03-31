let bank = [];
let currentTest = [];
let userAnswers = [];
let currentIndex = 0;
let currentUser = null;
let timerInterval;

// Test Settings
let pendingSubject = null;
let pendingPool = [];
let diffTime = 900; 
let orderMode = 'random'; 

// 1. Ma'lumotlarni yuklash (3 ta variant bo'lsa 4-sini qo'shish)
async function loadData() {
    const files = ['musiqa_nazariyasi.json', 'cholgu_ijrochiligi.json', 'vokal_ijrochiligi.json', 'metodika_repertuar.json'];
    let globalIndex = 0;
    for (const f of files) {
        try {
            const res = await fetch(f);
            const data = await res.json();
            const subject = f.split('.')[0];
            
            data.forEach((q) => {
                let rawOpts = q.options.filter(o => o !== null && o !== undefined && o.toString().trim() !== ''); 
                let uniqueOpts = [...new Set(rawOpts)]; 
                let correctText = q.options[q.answer]; 
                
                // 3 ta qolgan bo'lsa, barcha javoblar to'g'rini qo'shish
                if (uniqueOpts.length === 3) uniqueOpts.push("Barcha javoblar to'g'ri");
                
                let newAnsIdx = uniqueOpts.indexOf(correctText);
                if (newAnsIdx === -1) newAnsIdx = 0; 

                bank.push({ ...q, id: `q_${globalIndex}`, subject, options: uniqueOpts, answer: newAnsIdx });
                globalIndex++;
            });
        } catch (e) { console.error(f + " yuklanmadi!"); }
    }
}

window.onload = async () => {
    await loadData();
    if (localStorage.getItem('theme') === 'light') {
        document.body.classList.remove('dark-mode');
    }
};

function toggleTheme() {
    document.body.classList.toggle('dark-mode');
    localStorage.setItem('theme', document.body.classList.contains('dark-mode') ? 'dark' : 'light');
}

// 2. Login va Dashboard
function handleLogin() {
    const name = document.getElementById('student-name').value.trim();
    if (name.length < 3) return alert("Iltimos, ismingizni to'liq kiriting!");
    
    currentUser = name;
    document.getElementById('display-name').innerText = name;
    updateStats();
    
    switchScreen('welcome-screen', 'dashboard-screen');
    document.getElementById('global-nav').classList.remove('hidden');
}

function updateStats() {
    let userDb = JSON.parse(localStorage.getItem(`stats_${currentUser}`)) || { learned: [], errors: [] };
    userDb.learned = [...new Set(userDb.learned)];
    userDb.errors = [...new Set(userDb.errors)];
    localStorage.setItem(`stats_${currentUser}`, JSON.stringify(userDb));

    document.getElementById('learned-count').innerText = userDb.learned.length;
    document.getElementById('error-count').innerText = userDb.errors.length;
    document.getElementById('error-work-btn').disabled = userDb.errors.length === 0;
}

function toggleChapters() {
    const grid = document.getElementById('chapters-grid');
    grid.classList.toggle('hidden');
    if(!grid.classList.contains('hidden')) renderChapterGrid();
}

function renderChapterGrid() {
    const grid = document.getElementById('chapters-grid');
    grid.innerHTML = '';
    const userDb = JSON.parse(localStorage.getItem(`stats_${currentUser}`)) || { learned: [], errors: [] };

    for (let i = 0; i < 40; i++) {
        let start = i * 20;
        let end = start + 20;
        let chunk = bank.slice(start, end);
        let learnedInChunk = chunk.filter(q => userDb.learned.includes(q.id)).length;
        
        let btn = document.createElement('button');
        btn.className = 'chap-btn';
        let progClass = learnedInChunk === 20 ? 'chap-prog full' : 'chap-prog';
        btn.innerHTML = `${start + 1}-${end} <span class="${progClass}">${learnedInChunk}/20</span>`;
        btn.onclick = () => { pendingSubject = 'sequential'; pendingPool = chunk; showSetup(); };
        grid.appendChild(btn);
    }
}

// 3. Setup Test
function openSetup(type) {
    const userDb = JSON.parse(localStorage.getItem(`stats_${currentUser}`)) || { learned: [], errors: [] };
    
    if (type === 'errors') {
        pendingPool = bank.filter(q => userDb.errors.includes(q.id));
    } else {
        let pool = type === 'mixed' ? bank : bank.filter(q => q.subject === type);
        let unlearned = pool.filter(q => !userDb.learned.includes(q.id));
        pendingPool = unlearned.length >= 20 ? unlearned : pool; 
    }
    pendingSubject = type;
    showSetup();
}

function showSetup() {
    switchScreen('dashboard-screen', 'setup-screen');
    if (pendingSubject === 'sequential') setOrder('sequential', document.querySelector('.order-seq'));
    else setOrder('random', document.querySelector('.order-random'));
}

function setDifficulty(level, btn) {
    document.querySelectorAll('.difficulty-control .seg-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    if(level === 'easy') diffTime = 1200; 
    if(level === 'medium') diffTime = 900; 
    if(level === 'hard') diffTime = 600; 
}

function setOrder(mode, btn) {
    document.querySelectorAll('.order-control .seg-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    orderMode = mode;
}

// 4. Test Boshlash
function confirmSetupAndStart() {
    let poolCopy = [...pendingPool];
    let selected20 = orderMode === 'random' ? shuffleArray(poolCopy).slice(0, 20) : poolCopy.slice(0, 20); 

    // Variantlar doimo aralashtiriladi
    currentTest = selected20.map(q => {
        let correctText = q.options[q.answer];
        let shuffledOpts = shuffleArray([...q.options]);
        return { ...q, options: shuffledOpts, answer: shuffledOpts.indexOf(correctText) };
    });

    switchScreen('setup-screen', 'test-screen');
    document.querySelector('.hero-bg').classList.add('bg-blurred');
    initTestUI();
}

function initTestUI() {
    document.getElementById('exit-test-btn').classList.remove('hidden');
    document.getElementById('exam-timer').classList.remove('hidden');
    document.getElementById('finish-btn').classList.add('hidden');
    document.getElementById('question-list-wrapper').classList.remove('gravity-fall'); // Reset animatsiya

    userAnswers = new Array(currentTest.length).fill(null);
    currentIndex = 0;
    
    clearInterval(timerInterval);
    startTimer(diffTime);
    renderMap();
    renderAllQuestions(); 
}

function startTimer(seconds) {
    let time = seconds;
    timerInterval = setInterval(() => {
        time--;
        let m = Math.floor(time / 60), s = time % 60;
        document.getElementById('exam-timer').innerText = `${m}:${s < 10 ? '0'+s : s}`;
        if (time <= 0) { clearInterval(timerInterval); finishExam(); }
    }, 1000);
}

// 5. Render & UI Boshqaruvi
function renderAllQuestions() {
    const area = document.getElementById('all-questions-area');
    area.innerHTML = currentTest.map((q, idx) => `
        <div class="q-block ${idx === currentIndex ? 'active-q' : 'blurred-q'}" id="q-block-${idx}">
            <div class="q-meta">📝 Savol ${idx+1} / ${currentTest.length}</div>
            <div class="q-text">${q.q}</div>
            <div class="options-box" id="opts-${idx}">
                ${q.options.map((opt, optIdx) => `
                    <button class="option-btn" id="btn-${idx}-${optIdx}" onclick="checkAns(${idx}, ${optIdx})" ${userAnswers[idx] ? 'disabled' : ''}>
                        ${opt}
                    </button>
                `).join('')}
            </div>
        </div>
    `).join('');
    
    updateMap();
    scrollToActive();
}

function updateFocus() {
    for(let i = 0; i < currentTest.length; i++) {
        const block = document.getElementById(`q-block-${i}`);
        if(block) {
            if(i === currentIndex) {
                block.classList.remove('blurred-q');
                block.classList.add('active-q');
            } else {
                block.classList.remove('active-q');
                block.classList.add('blurred-q');
            }
        }
    }
    scrollToActive();
    updateMap();
}

function scrollToActive() {
    const activeBlock = document.getElementById(`q-block-${currentIndex}`);
    if (activeBlock) activeBlock.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// 6. Javob Tekshirish (Qat'iy Qoidalar Asosida)
function checkAns(qIdx, optIdx) {
    if (qIdx !== currentIndex || userAnswers[qIdx]) return;
    
    const isCorrect = optIdx === currentTest[qIdx].answer;
    userAnswers[qIdx] = { selected: optIdx, isCorrect };
    
    let userDb = JSON.parse(localStorage.getItem(`stats_${currentUser}`));
    const qId = currentTest[qIdx].id;
    const clickedBtn = document.getElementById(`btn-${qIdx}-${optIdx}`);
    
    if (isCorrect) {
        if (!userDb.learned.includes(qId)) userDb.learned.push(qId);
        userDb.errors = userDb.errors.filter(id => id !== qId); 
        clickedBtn.classList.add('magic-correct');
    } else {
        if (!userDb.errors.includes(qId)) userDb.errors.push(qId);
        // QAT'IY QOIDA: Faqat xato qizil bo'ladi. To'g'ri javob yashil ko'rsatilmaydi!
        clickedBtn.classList.add('magic-wrong');
    }
    
    localStorage.setItem(`stats_${currentUser}`, JSON.stringify(userDb));
    
    // Bloklash
    const options = document.getElementById(`opts-${qIdx}`).getElementsByTagName('button');
    for(let btn of options) btn.disabled = true;

    // Tugatish tugmasi
    if (userAnswers.filter(a => a !== null).length === currentTest.length) {
        document.getElementById('finish-btn').classList.remove('hidden');
    }

    // Auto Next
    setTimeout(() => { 
        let next = userAnswers.findIndex(ans => ans === null); 
        if (next !== -1) { currentIndex = next; updateFocus(); } 
    }, 600);
}

// 7. Mantiq: 100% bo'lmasa qat'iy takrorlash
function finishExam() {
    clearInterval(timerInterval);
    const correct = userAnswers.filter(a => a?.isCorrect).length;
    
    if (correct < currentTest.length) {
        alert(`Natija: ${correct}/${currentTest.length}.\nQoidaga ko'ra, 100% natija qayd etmaguningizcha ushbu savollar aralashtirib qayta beriladi!`);
        
        // Xuddi shu savollarni olamiz, faqat javob variantlarini yana aralashtiramiz
        currentTest = currentTest.map(q => {
            let correctText = q.options[q.answer];
            let shuffledOpts = shuffleArray([...q.options]);
            return { ...q, options: shuffledOpts, answer: shuffledOpts.indexOf(correctText) };
        });
        
        // Testni qayta boshlash
        userAnswers = new Array(currentTest.length).fill(null);
        currentIndex = 0;
        document.getElementById('finish-btn').classList.add('hidden');
        startTimer(diffTime);
        renderMap();
        renderAllQuestions();
    } else {
        // 100% SUCCESS
        document.getElementById('question-list-wrapper').classList.add('gravity-fall');
        triggerConfetti();
        setTimeout(() => {
            alert("🎉 MUKAMMAL! Siz barcha savollarga to'g'ri javob berdingiz.");
            document.querySelector('.hero-bg').classList.remove('bg-blurred');
            switchScreen('test-screen', 'dashboard-screen');
            updateStats();
            document.getElementById('exit-test-btn').classList.add('hidden');
            document.getElementById('exam-timer').classList.add('hidden');
        }, 2000);
    }
}

// 8. Qoshimcha Funksiyalar
function renderMap() {
    document.getElementById('indicator-map').innerHTML = currentTest.map((_, i) => `<div class="dot" id="dot-${i}" onclick="goTo(${i})">${i+1}</div>`).join('');
}

function updateMap() {
    let answered = userAnswers.filter(a => a !== null).length;
    document.getElementById('progress-fill').style.width = `${(answered / currentTest.length) * 100}%`;
    
    currentTest.forEach((_, i) => {
        const dot = document.getElementById(`dot-${i}`);
        if(dot) {
            dot.className = 'dot';
            if (i === currentIndex) dot.classList.add('active-dot');
            if (userAnswers[i]) dot.classList.add(userAnswers[i].isCorrect ? 'correct' : 'wrong');
        }
    });
}

function triggerConfetti() {
    let duration = 3 * 1000;
    let end = Date.now() + duration;
    (function frame() {
        confetti({ particleCount: 5, angle: 60, spread: 55, origin: { x: 0 }, colors: ['#0A84FF', '#30D158'] });
        confetti({ particleCount: 5, angle: 120, spread: 55, origin: { x: 1 }, colors: ['#0A84FF', '#30D158'] });
        if (Date.now() < end) requestAnimationFrame(frame);
    }());
}

function shuffleArray(arr) { return arr.sort(() => Math.random() - 0.5); }
function goTo(i) { currentIndex = i; updateFocus(); }
function move(step) { let n = currentIndex + step; if (n >= 0 && n < currentTest.length) { currentIndex = n; updateFocus(); } }
function switchScreen(hideId, showId) { document.getElementById(hideId).classList.replace('active', 'hidden'); document.getElementById(showId).classList.replace('hidden', 'active'); }

// LOGO VA EXIT BOSILGANDA
function goHome() {
    if (!document.getElementById('test-screen').classList.contains('hidden')) {
        if (confirm("Testni yakunlamasdan chiqmoqchimisiz? Natijalar saqlanmaydi.")) {
            clearInterval(timerInterval);
            document.querySelector('.hero-bg').classList.remove('bg-blurred');
            switchScreen('test-screen', 'dashboard-screen');
            document.getElementById('exit-test-btn').classList.add('hidden');
            document.getElementById('exam-timer').classList.add('hidden');
            updateStats();
        }
    } else if (!document.getElementById('setup-screen').classList.contains('hidden')) {
        cancelSetup();
    }
}
