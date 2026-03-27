let bank = [];
let currentTest = [];
let userAnswers = [];
let currentIndex = 0;
let currentUser = null;
let timerInterval;

// Parametrlar
let pendingSubject = null;
let pendingPool = [];
let diffTime = 900; 
let orderMode = 'random'; 

// JSON Yuklash & Tozalash
async function loadData() {
    const files = ['musiqa_nazariyasi.json', 'cholgu_ijrochiligi.json', 'vokal_ijrochiligi.json', 'metodika_repertuar.json'];
    let globalIndex = 0;
    for (const f of files) {
        try {
            const res = await fetch(f);
            const data = await res.json();
            const subject = f.split('.')[0];
            
            data.forEach((q) => {
                // 1. Bo'sh variantlarni o'chirish va dublikatlarni tozalash
                let rawOpts = q.options.filter(o => o !== null && o !== undefined && o.toString().trim() !== ''); 
                let uniqueOpts = [...new Set(rawOpts)]; 
                
                let correctText = q.options[q.answer]; 
                
                // 2. Agar aynan 3 ta variant bo'lsa, 4-ni qo'shish
                if (uniqueOpts.length === 3) {
                    uniqueOpts.push("Barcha javoblar to'g'ri");
                }
                
                let newAnsIdx = uniqueOpts.indexOf(correctText);
                if (newAnsIdx === -1) newAnsIdx = 0; 

                bank.push({ ...q, id: `q_${globalIndex}`, subject, options: uniqueOpts, answer: newAnsIdx });
                globalIndex++;
            });
        } catch (e) { console.error(f + " yuklanmadi"); }
    }
}

window.onload = async () => {
    await loadData();
    if (localStorage.getItem('theme') === 'dark') document.body.classList.add('dark-mode');
};

function handleLogin() {
    const name = document.getElementById('student-name').value.trim();
    if (name.length < 3) return alert("Iltimos, ismingizni to'liq kiriting!");
    
    currentUser = name;
    document.getElementById('display-name').innerText = name;
    updateStats();
    
    document.getElementById('welcome-screen').classList.replace('active', 'hidden');
    document.getElementById('dashboard-screen').classList.replace('hidden', 'active');
    document.getElementById('global-nav').classList.remove('hidden');
}

function updateStats() {
    let userDb = JSON.parse(localStorage.getItem(`stats_${currentUser}`)) || { learned: [], errors: [] };
    
    // 800 talik unikal hisob (dublikatsiz)
    userDb.learned = [...new Set(userDb.learned)];
    userDb.errors = [...new Set(userDb.errors)];
    localStorage.setItem(`stats_${currentUser}`, JSON.stringify(userDb));

    document.getElementById('learned-count').innerText = userDb.learned.length;
    document.getElementById('error-count').innerText = userDb.errors.length;
    
    // 7-tugmani aktivlashtirish
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

// SETUP SCREEN
function openSetup(type) {
    const userDb = JSON.parse(localStorage.getItem(`stats_${currentUser}`)) || { learned: [], errors: [] };
    
    if (type === 'errors') {
        pendingPool = bank.filter(q => userDb.errors.includes(q.id));
        if (pendingPool.length === 0) return alert("Xatolar topilmadi!");
    } else {
        let pool = type === 'mixed' ? bank : bank.filter(q => q.subject === type);
        let unlearned = pool.filter(q => !userDb.learned.includes(q.id));
        pendingPool = unlearned.length >= 20 ? unlearned : pool; 
    }
    
    pendingSubject = type;
    showSetup();
}

function showSetup() {
    document.getElementById('dashboard-screen').classList.replace('active', 'hidden');
    document.getElementById('setup-screen').classList.replace('hidden', 'active');
    
    if (pendingSubject === 'sequential') setOrder('sequential', document.querySelector('.order-seq'));
    else setOrder('random', document.querySelector('.order-random'));
}

function cancelSetup() {
    document.getElementById('setup-screen').classList.replace('active', 'hidden');
    document.getElementById('dashboard-screen').classList.replace('hidden', 'active');
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

// BOSHLASH
function confirmSetupAndStart() {
    let selected20 = [];
    
    // Savollar tartibi
    if (orderMode === 'random') selected20 = shuffleArray([...pendingPool]).slice(0, 20);
    else selected20 = pendingPool.slice(0, 20); 

    // Variantlar har doim aralashtiriladi
    currentTest = selected20.map(q => {
        let correctText = q.options[q.answer];
        let shuffledOpts = shuffleArray([...q.options]);
        return { ...q, options: shuffledOpts, answer: shuffledOpts.indexOf(correctText) };
    });

    document.getElementById('setup-screen').classList.replace('active', 'hidden');
    initTestUI();
}

function initTestUI() {
    document.getElementById('test-screen').classList.replace('hidden', 'active');
    document.getElementById('exit-test-btn').classList.remove('hidden');
    document.getElementById('exam-timer').classList.remove('hidden');

    userAnswers = new Array(currentTest.length).fill(null);
    currentIndex = 0;
    
    clearInterval(timerInterval);
    startTimer(diffTime);
    renderMap();
    renderAllQuestions(); // Barcha 20 ta savolni ekranga chizish
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

// 🌟 BARCHA SAVOLLARNI CHIZISH VA BLUR EFFEKT LOGIKASI
function renderAllQuestions() {
    const area = document.getElementById('all-questions-area');
    area.innerHTML = currentTest.map((q, idx) => `
        <div class="q-block ${idx === currentIndex ? 'active-q' : 'blurred-q'}" id="q-block-${idx}">
            <div class="q-meta">Savol ${idx+1} / ${currentTest.length}</div>
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
    // Blur va active classlarini yangilash
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
    if (activeBlock) {
        activeBlock.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

// 🌟 MAGIC JAVOB TEKSHIRISH VA YASHIRIN JAVOB
function checkAns(qIdx, optIdx) {
    // Agar biz joriy savolda bo'lmasak yoki javob berib bo'lingan bo'lsa
    if (qIdx !== currentIndex || userAnswers[qIdx]) return;
    
    const isCorrect = optIdx === currentTest[qIdx].answer;
    userAnswers[qIdx] = { selected: optIdx, isCorrect };
    
    let userDb = JSON.parse(localStorage.getItem(`stats_${currentUser}`)) || { learned: [], errors: [] };
    const qId = currentTest[qIdx].id;
    
    const clickedBtn = document.getElementById(`btn-${qIdx}-${optIdx}`);
    
    if (isCorrect) {
        if (!userDb.learned.includes(qId)) userDb.learned.push(qId);
        userDb.errors = userDb.errors.filter(id => id !== qId); 
        
        // 🎇 To'g'ri bo'lsa Magic Yashil Animatsiya
        clickedBtn.classList.add('magic-correct');
    } else {
        if (!userDb.errors.includes(qId)) userDb.errors.push(qId);
        
        // 🎇 Xato bo'lsa Magic Qizil Animatsiya
        clickedBtn.classList.add('magic-wrong');
        // DIQQAT: To'g'ri javobga hech qanday klass qo'shilmaydi (Sir tutiladi).
    }
    
    localStorage.setItem(`stats_${currentUser}`, JSON.stringify(userDb));
    
    // Barcha tugmalarni blocklash (shu savol uchun)
    const options = document.getElementById(`opts-${qIdx}`).getElementsByTagName('button');
    for(let btn of options) btn.disabled = true;

    if (userAnswers.filter(a => a !== null).length === currentTest.length) {
        document.getElementById('finish-btn').classList.remove('hidden');
    }

    // Keyingi savolga silliq o'tish
    setTimeout(() => { 
        let next = userAnswers.findIndex(ans => ans === null); 
        if (next !== -1) { 
            currentIndex = next; 
            updateFocus(); 
        } 
    }, 800);
}

function finishExam() {
    clearInterval(timerInterval);
    const correct = userAnswers.filter(a => a?.isCorrect).length;
    
    if (correct < currentTest.length) {
        alert(`Natija: ${correct}/${currentTest.length}. Qoidaga ko'ra, 100% bo'lmaguncha ushbu savollar aralashtirib qayta beriladi.`);
        
        currentTest = shuffleArray(currentTest).map(q => {
            let correctText = q.options[q.answer];
            let shuffledOpts = shuffleArray([...q.options]);
            return { ...q, options: shuffledOpts, answer: shuffledOpts.indexOf(correctText) };
        });
        
        userAnswers = new Array(currentTest.length).fill(null);
        currentIndex = 0;
        startTimer(diffTime);
        renderMap();
        renderAllQuestions();
        document.getElementById('finish-btn').classList.add('hidden');
    } else {
        triggerWin();
    }
}

function triggerWin() {
    document.getElementById('question-list-wrapper').classList.add('gravity-fall');
    confetti({ particleCount: 200, spread: 90, origin: { y: 0.6 } });
    setTimeout(() => {
        alert("🎉 MUKAMMAL! Siz barcha savollarga to'g'ri javob berdingiz.");
        exitTest();
    }, 2500);
}

function renderMap() {
    const map = document.getElementById('indicator-map');
    map.innerHTML = currentTest.map((_, i) => `<div class="dot" id="dot-${i}" onclick="goTo(${i})">${i+1}</div>`).join('');
}

function updateMap() {
    let answered = userAnswers.filter(a => a !== null).length;
    document.getElementById('progress-fill').style.width = `${(answered / currentTest.length) * 100}%`;
    
    currentTest.forEach((_, i) => {
        const dot = document.getElementById(`dot-${i}`);
        dot.className = 'dot';
        if (i === currentIndex) dot.classList.add('active-dot');
        if (userAnswers[i]) dot.classList.add(userAnswers[i].isCorrect ? 'correct' : 'wrong');
    });
}

function shuffleArray(arr) { return arr.sort(() => Math.random() - 0.5); }
function goTo(i) { currentIndex = i; updateFocus(); }
function move(step) { let n = currentIndex + step; if (n >= 0 && n < currentTest.length) { currentIndex = n; updateFocus(); } }
function toggleTheme() { document.body.classList.toggle('dark-mode'); localStorage.setItem('theme', document.body.classList.contains('dark-mode') ? 'dark' : 'light'); }
function exitTest() { location.reload(); }
function logout() { if(confirm("Tizimdan chiqishni xohlaysizmi?")) location.reload(); }
