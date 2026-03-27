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

async function loadData() {
    const files = ['musiqa_nazariyasi.json', 'cholgu_ijrochiligi.json', 'vokal_ijrochiligi.json', 'metodika_repertuar.json'];
    let globalIndex = 0;
    for (const f of files) {
        try {
            const res = await fetch(f);
            const data = await res.json();
            const subject = f.split('.')[0];
            
            data.forEach((q) => {
                // 1. Dublikatlarni tozalash (Bo'sh joylarni kesish)
                let rawOpts = q.options.filter(o => o !== null && o.toString().trim() !== ''); 
                let uniqueOpts = [...new Set(rawOpts)]; 
                
                let correctText = q.options[q.answer]; // Asl javob
                
                // 2. Agar 3 ta qolsa, 4-variantni qo'shish
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
    
    // 3. 800 tadan aniq unikal o'zlashtirish va xatolar hisobi
    let uniqueLearned = [...new Set(userDb.learned)].length;
    let uniqueErrors = [...new Set(userDb.errors)].length;

    document.getElementById('learned-count').innerText = uniqueLearned;
    document.getElementById('error-count').innerText = uniqueErrors;
    
    // 4. Xatolar tugmasini yoqish/o'chirish
    document.getElementById('error-work-btn').disabled = uniqueErrors === 0;
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

// SETUP: Parametrlarni o'rnatish
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

function setDifficulty(level, btn) {
    document.querySelectorAll('.difficulty-control .seg-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    if(level === 'easy') diffTime = 1200; // 20 min
    if(level === 'medium') diffTime = 900; // 15 min
    if(level === 'hard') diffTime = 600; // 10 min
}

function setOrder(mode, btn) {
    document.querySelectorAll('.order-control .seg-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    orderMode = mode;
}

// BOSHLASH
function confirmSetupAndStart() {
    let selected20 = [];
    
    // 5. Faqat savollar tartibi random/ketma-ket bo'ladi
    if (orderMode === 'random') {
        selected20 = shuffleArray([...pendingPool]).slice(0, 20);
    } else {
        selected20 = pendingPool.slice(0, 20); 
    }

    // 6. Javob Variantlari HAR DOIM RANDOM!
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
    
    let userDb = JSON.parse(localStorage.getItem(`stats_${currentUser}`)) || { learned: [], errors: [] };
    const qId = currentTest[currentIndex].id;
    
    if (isCorrect) {
        if (!userDb.learned.includes(qId)) userDb.learned.push(qId);
        userDb.errors = userDb.errors.filter(id => id !== qId); 
    } else {
        if (!userDb.errors.includes(qId)) userDb.errors.push(qId);
    }
    localStorage.setItem(`stats_${currentUser}`, JSON.stringify(userDb));

    renderQuestion(); 
    
    if (userAnswers.filter(a => a !== null).length === currentTest.length) {
        document.getElementById('finish-btn').classList.remove('hidden');
    }

    setTimeout(() => { let next = userAnswers.findIndex(ans => ans === null); if (next !== -1) { currentIndex = next; renderQuestion(); } }, 500);
}

// 7. TO'G'RI JAVOB YASHIRIN QOLADI! Faqat foydalanuvchi tanlagani tekshiriladi.
function getBtnClass(i) {
    if (!userAnswers[currentIndex]) return '';
    const ans = userAnswers[currentIndex];
    
    if (ans.selected === i) {
        return ans.isCorrect ? 'correct-ans' : 'wrong-ans';
    }
    return ''; // To'g'ri bo'lsa ham unga class bermaymiz!
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
        renderQuestion();
        document.getElementById('finish-btn').classList.add('hidden');
    } else {
        triggerWin();
    }
}

function triggerWin() {
    document.getElementById('question-area').classList.add('gravity-fall');
    confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
    setTimeout(() => {
        alert("🎉 MUKAMMAL! Siz barcha savollarga to'g'ri javob berdingiz.");
        exitTest();
    }, 2000);
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
function goTo(i) { currentIndex = i; renderQuestion(); }
function move(step) { let n = currentIndex + step; if (n >= 0 && n < currentTest.length) { currentIndex = n; renderQuestion(); } }
function toggleTheme() { document.body.classList.toggle('dark-mode'); localStorage.setItem('theme', document.body.classList.contains('dark-mode') ? 'dark' : 'light'); }
function exitTest() { location.reload(); }
function logout() { if(confirm("Tizimdan chiqishni xohlaysizmi?")) location.reload(); }
