let bank = [];
let currentTest = [];
let userAnswers = [];
let currentIndex = 0;
let currentUser = null;
let timerInterval;

// Setup Variables
let pendingSubject = null;
let pendingPool = [];
let diffTime = 900; // default 15m
let orderMode = 'random'; // random or sequential

// Data Initialization
async function loadData() {
    const files = ['musiqa_nazariyasi.json', 'cholgu_ijrochiligi.json', 'vokal_ijrochiligi.json', 'metodika_repertuar.json'];
    let globalIndex = 0;
    for (const f of files) {
        try {
            const res = await fetch(f);
            const data = await res.json();
            const subject = f.split('.')[0];
            
            data.forEach((q) => {
                // XATOLIK 1: Dublikatlarni tozalash va 3 talik bo'lsa 4-variant qo'shish
                let rawOpts = q.options.filter(o => o.trim() !== ''); // Bo'shlarni olib tashlash
                let uniqueOpts = [...new Set(rawOpts)]; // Dublikatlarni olib tashlash
                
                let ansText = q.options[q.answer]; // Asl javob matni
                
                if (uniqueOpts.length === 3) {
                    uniqueOpts.push("Barcha javoblar to'g'ri");
                }
                
                let newAnsIdx = uniqueOpts.indexOf(ansText);
                if (newAnsIdx === -1) newAnsIdx = 0; // fallback

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

// Login & Stats
function handleLogin() {
    const name = document.getElementById('student-name').value.trim();
    if (name.length < 3) return alert("Ism kiriting!");
    
    currentUser = name;
    document.getElementById('display-name').innerText = name;
    updateStats();
    
    document.getElementById('welcome-screen').classList.replace('active', 'hidden');
    document.getElementById('dashboard-screen').classList.replace('hidden', 'active');
    document.getElementById('global-nav').classList.remove('hidden');
}

function updateStats() {
    const userDb = JSON.parse(localStorage.getItem(`stats_${currentUser}`)) || { learned: [], errors: [] };
    
    // XATOLIK 2: 800 tadan aniq nechtasi o'zlashtirildi/xato qilindi (unique set)
    let uniqueLearned = [...new Set(userDb.learned)].length;
    let uniqueErrors = [...new Set(userDb.errors)].length;

    document.getElementById('learned-count').innerText = uniqueLearned;
    document.getElementById('error-count').innerText = uniqueErrors;
    
    // XATOLIK 3: Xatolar ustida ishlash tugmasi
    document.getElementById('error-work-btn').disabled = uniqueErrors === 0;
}

// Bo'limlar (Chapters) va Indikatorlar
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
        
        // Bu 20 talik ichida nechta savol o'rganilganligini hisoblash
        let learnedInChunk = chunk.filter(q => userDb.learned.includes(q.id)).length;
        
        let btn = document.createElement('button');
        btn.className = 'chap-btn';
        let progClass = learnedInChunk === 20 ? 'chap-prog full' : 'chap-prog';
        btn.innerHTML = `${start + 1}-${end} <span class="${progClass}">${learnedInChunk}/20</span>`;
        btn.onclick = () => { pendingSubject = 'sequential'; pendingPool = chunk; showSetup(); };
        grid.appendChild(btn);
    }
}

// SETUP SCREEN (YANGILIK: Qiyinlik va Ketma-ketlik)
function openSetup(type) {
    const userDb = JSON.parse(localStorage.getItem(`stats_${currentUser}`)) || { learned: [], errors: [] };
    
    if (type === 'errors') {
        // XATOLIK 4: Faqat xato qilingan savollarni olish
        pendingPool = bank.filter(q => userDb.errors.includes(q.id));
        if (pendingPool.length === 0) return alert("Xatolar topilmadi!");
    } else {
        let pool = type === 'mixed' ? bank : bank.filter(q => q.subject === type);
        let unlearned = pool.filter(q => !userDb.learned.includes(q.id));
        pendingPool = unlearned.length >= 20 ? unlearned : pool; // Agar hammasi yechilgan bo'lsa, qayta hamma bazani beradi
    }
    
    pendingSubject = type;
    showSetup();
}

function showSetup() {
    document.getElementById('dashboard-screen').classList.replace('active', 'hidden');
    document.getElementById('setup-screen').classList.replace('hidden', 'active');
    
    // Agar bo'lim (chapter) tanlangan bo'lsa, "Ketma-ketlik"ni default qilish
    if (pendingSubject === 'sequential') {
        setOrder('sequential', document.querySelector('.order-seq'));
    } else {
        setOrder('random', document.querySelector('.order-random'));
    }
}

function cancelSetup() {
    document.getElementById('setup-screen').classList.replace('active', 'hidden');
    document.getElementById('dashboard-screen').classList.replace('hidden', 'active');
}

// Segmented Controls
function setDifficulty(level, btn) {
    document.querySelectorAll('.difficulty-control .seg-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    if(level === 'easy') diffTime = 1200; // 20m
    if(level === 'medium') diffTime = 900; // 15m
    if(level === 'hard') diffTime = 600; // 10m
}

function setOrder(mode, btn) {
    document.querySelectorAll('.order-control .seg-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    orderMode = mode;
}

// TESTNI BOSHLASH
function confirmSetupAndStart() {
    let selected20 = [];
    
    // Ketma-ketlik yoki Random qoidasi (FAQAT SAVOLLAR UCHUN)
    if (orderMode === 'random') {
        selected20 = shuffleArray([...pendingPool]).slice(0, 20);
    } else {
        selected20 = pendingPool.slice(0, 20); // Kesib olamiz, aralashtirmaymiz
    }

    // VARIANTLAR (A,B,C,D) HAR DOIM ARALASHTIRILADI
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
    renderQuestion();
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

// UI Rendering
function renderQuestion() {
    const q = currentTest[currentIndex];
    const area = document.getElementById('question-area');
    
    area.innerHTML = `
        <div class="q-meta">Savol ${currentIndex+1} / ${currentTest.length}</div>
        <div class="q-text">${q.q}</div>
        ${q.options.map((opt, i) => `
            <button class="option-btn ${getBtnClass(i)}" onclick="checkAns(${i})" ${userAnswers[currentIndex] ? 'disabled' : ''}>
                ${opt}
            </button>
        `).join('')}
    `;
    updateMap();
}

function checkAns(idx) {
    if (userAnswers[currentIndex]) return;
    const isCorrect = idx === currentTest[currentIndex].answer;
    userAnswers[currentIndex] = { selected: idx, isCorrect };
    
    // Shaxsiy Xotiraga Yozish (Mukammal mantiq)
    let userDb = JSON.parse(localStorage.getItem(`stats_${currentUser}`)) || { learned: [], errors: [] };
    const qId = currentTest[currentIndex].id;
    
    if (isCorrect) {
        if (!userDb.learned.includes(qId)) userDb.learned.push(qId);
        // Agar to'g'ri topsa, xatolar ro'yxatidan o'chirib yuborish
        userDb.errors = userDb.errors.filter(id => id !== qId); 
    } else {
        if (!userDb.errors.includes(qId)) userDb.errors.push(qId);
    }
    localStorage.setItem(`stats_${currentUser}`, JSON.stringify(userDb));

    renderQuestion(); // Ranglarni qo'llash
    
    if (userAnswers.filter(a => a !== null).length === currentTest.length) {
        document.getElementById('finish-btn').classList.remove('hidden');
    }

    // Auto-next
    setTimeout(() => { let next = userAnswers.findIndex(ans => ans === null); if (next !== -1) { currentIndex = next; renderQuestion(); } }, 500);
}

function getBtnClass(i) {
    if (!userAnswers[currentIndex]) return '';
    if (i === currentTest[currentIndex].answer) return 'correct-ans'; // FAQAT TO'G'RINI YASHIL QILISH: Bu safar ko'rsatamiz. Agar ko'rsatmaslik kerak bo'lsa shartni o'zgartiramiz.
    if (userAnswers[currentIndex].selected === i && !userAnswers[currentIndex].isCorrect) return 'wrong-ans';
    return '';
}

// 100% SHART
function finishExam() {
    clearInterval(timerInterval);
    const correct = userAnswers.filter(a => a?.isCorrect).length;
    
    if (correct < currentTest.length) {
        alert(`Natija: ${correct}/${currentTest.length}. Qoidaga ko'ra, 100% bo'lmaguncha ushbu savollar aralashtirib qayta beriladi.`);
        
        // O'sha testlarni qayta berish
        currentTest = shuffleArray(currentTest).map(q => {
            let correctText = q.options[q.answer];
            let shuffledOpts = shuffleArray([...q.options]);
            return { ...q, options: shuffledOpts, answer: shuffledOpts.indexOf(correctText) };
        });
        
        userAnswers = new Array(currentTest.length).fill(null);
        currentIndex = 0;
        startTimer(diffTime);
        renderMap();
        renderQuestion();
        document.getElementById('finish-btn').classList.add('hidden');
    } else {
        triggerWin();
    }
}

// Animatsiya
function triggerWin() {
    document.getElementById('question-area').classList.add('gravity-fall');
    confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
    setTimeout(() => {
        alert("🎉 MUKAMMAL! Siz barcha savollarga to'g'ri javob berdingiz.");
        exitTest();
    }, 2000);
}

// Map va Yordamchilar
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
function goTo(i) { currentIndex = i; renderQuestion(); }
function move(step) { let n = currentIndex + step; if (n >= 0 && n < currentTest.length) { currentIndex = n; renderQuestion(); } }
function toggleTheme() { document.body.classList.toggle('dark-mode'); localStorage.setItem('theme', document.body.classList.contains('dark-mode') ? 'dark' : 'light'); }
function exitTest() { location.reload(); }
function logout() { if(confirm("Tizimdan chiqishni xohlaysizmi?")) location.reload(); }