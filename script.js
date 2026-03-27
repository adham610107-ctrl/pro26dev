// Boshlang'ich Holat
let bank = []; 
let currentTest = []; 
let userAnswers = [];
let currentIndex = 0;
let timerInterval;
let timeRemaining = 900; // 15 minut

// Unikal Statistika
let currentUser = null;
let globalStorage = JSON.parse(localStorage.getItem('chdpi_premium_data')) || {}; 

// Test Sozlamalari Holati
let selectedPool = [];
let testConfig = {
    difficulty: 'oson',
    order: 'random'
};

window.onload = async () => {
    document.getElementById('year').innerText = new Date().getFullYear();
    if (localStorage.getItem('theme') === 'dark') {
        document.getElementById('main-body').classList.add('dark-mode');
    }
    await loadAllJSONs();
};

// --- JSON yuklash va qayta ishlash (3 ta variant muammosini tuzatish) ---
async function loadAllJSONs() {
    const files = ['musiqa_nazariyasi.json', 'cholgu_ijrochiligi.json', 'vokal_ijrochiligi.json', 'metodika_repertuar.json'];
    let count = 0;
    for (let file of files) {
        try {
            let res = await fetch(file);
            let data = await res.json();
            let subject = file.split('.')[0];
            
            // Unikal ID va 3 variantlik muammosini hal qilish
            data = data.map((q, idx) => {
                let processedOptions = [...q.options];
                // Agar 3 ta variant bo'lsa, 4-chi variant qo'shish
                if (processedOptions.length === 3) {
                    processedOptions.push("Barcha javob to'g'ri");
                }
                
                return {
                    ...q,
                    id: `${subject}_${idx}`, // Unikal ID (statistika uchun)
                    subject: subject,
                    options: processedOptions
                };
            });
            
            bank = bank.concat(data);
            count++;
        } catch (e) {
            console.error(`Xato: ${file} yuklanmadi.`, e);
        }
    }
    
    // Agar serverda bo'lmasa, local simulated bank
    if (count === 0) {
        // ... (Simulated bank code removed for brevity, assuming real JSONs exist)
        console.warn("JSON fayllar topilmadi, serverda ishga tushiring.");
    }
}

// --- Kirish Mantiqi ---
function handleLogin() {
    let name = document.getElementById('student-name').value.trim();
    if (name.length < 3) return alert("Iltimos, Ism Familiyangizni to'liq kiriting (kamida 3 harf)!");
    
    currentUser = name;
    if (!globalStorage[currentUser]) {
        globalStorage[currentUser] = { learned: [], errors: [] }; // Unikal ro'yxatlar
    }
    saveData();
    
    document.getElementById('display-student-name').innerText = currentUser;
    updateDashboardStats();
    generateChapterButtons();
    switchScreen('welcome-screen', 'dashboard-screen');
}

// --- Statistika va Ma'lumotlarni saqlash ---
function saveData() {
    localStorage.setItem('chdpi_premium_data', JSON.stringify(globalStorage));
}

function updateDashboardStats() {
    if (!currentUser) return;
    let data = globalStorage[currentUser];
    let learnedCount = data.learned.length;
    let errorCount = data.errors.length;
    
    document.getElementById('total-learned').innerText = `800 / ${learnedCount}`;
    document.getElementById('total-errors').innerText = `800 / ${errorCount}`;
    
    // Xatolar ustida ishlash tugmasini yoqish/o'chirish (7-chi tugma)
    let errorBtn = document.getElementById('error-work-btn');
    if (errorCount > 0) {
        errorBtn.disabled = false;
        errorBtn.classList.add('pulse-anim');
    } else {
        errorBtn.disabled = true;
        errorBtn.classList.remove('pulse-anim');
    }
}

// --- Testni Tayyorlash (Settings Modalini ochish) ---
function prepareTest(subject) {
    let pool = [];
    if (subject === 'mixed') {
        pool = [...bank];
    } else {
        pool = bank.filter(q => q.subject === subject);
    }
    
    if (pool.length === 0) return alert("Hozircha testlar yo'q.");
    
    // 20 ta savol tanlash (agar bankda ko'p bo'lsa)
    selectedPool = shuffleArray(pool).slice(0, 20);
    openConfig();
}

// 7-chi tugma mantiqi
function prepareErrorWork() {
    if (!currentUser) return;
    let errorIds = globalStorage[currentUser].errors;
    if (errorIds.length === 0) return alert("Xatolar ro'yxati bo'sh.");
    
    let pool = bank.filter(q => errorIds.includes(q.id));
    selectedPool = shuffleArray(pool).slice(0, 20); // Maksimal 20 ta xato
    openConfig();
}

function selectChapter(start, end) {
    selectedPool = bank.slice(start, end);
    openConfig();
}

// --- Test Sozlamalari (Modal) ---
function openConfig() {
    document.getElementById('config-modal').classList.replace('hidden', 'active');
}

function closeConfig() {
    document.getElementById('config-modal').classList.replace('active', 'hidden');
}

function selectDifficulty(diff) {
    testConfig.difficulty = diff;
    document.querySelectorAll('.diff-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.diff === diff) btn.classList.add('active');
    });
}

function selectOrder(order) {
    testConfig.order = order;
    document.getElementById('order-random').classList.toggle('active', order === 'random');
    document.getElementById('order-sequential').classList.toggle('active', order === 'sequential');
}

// --- Testni boshlash (Configured) ---
function startConfiguredTest() {
    if (selectedPool.length === 0) return alert("Testni boshlab bo'lmaydi.");
    
    closeConfig();
    
    // 1. Savollar Ketma-ketligi mantiqi (Faqat savol tartibiga ta'sir qiladi)
    let questionsPool = [...selectedPool];
    if (testConfig.order === 'random') {
        questionsPool = shuffleArray(questionsPool);
    }
    // else sequential (o'z holatida qoladi)
    
    // 2. Variantlar DOIMO random (DIQQAT QILINDI)
    currentTest = questionsPool.map(q => {
        let correctText = q.options[q.answer]; // To'g'ri javob matni
        let shuffledOptions = shuffleArray([...q.options]); // Variantlar aralashtiriladi
        let newCorrectIndex = shuffledOptions.indexOf(correctText); // Yangi index topiladi
        
        return {
            ...q,
            options: shuffledOptions,
            answer: newCorrectIndex
        };
    });
    
    initTestUI();
}

// --- Bo'limlar (6-chi tugma indikatorlari bilan) ---
function toggleChapters() {
    let grid = document.getElementById('chapters-grid');
    grid.classList.toggle('hidden');
    if (!grid.classList.contains('hidden')) generateChapterButtons();
}

function generateChapterButtons() {
    const grid = document.getElementById('chapters-grid');
    grid.innerHTML = '';
    
    if (!currentUser) return;
    let learnedIds = globalStorage[currentUser].learned;
    
    for (let i = 0; i < 40; i++) { // 40 ta bo'lim (800 ta savol / 20)
        let start = i * 20;
        let end = Math.min(start + 20, bank.length);
        if (start >= bank.length) break;
        
        let chapterQuestions = bank.slice(start, end);
        let chapterCount = chapterQuestions.length;
        
        // Shu bo'limdan nechtasi unikal o'zlashtirilganini hisoblash
        let learnedInChapter = chapterQuestions.filter(q => learnedIds.includes(q.id)).length;
        
        let btn = document.createElement('button');
        btn.className = 'chapter-btn';
        if (learnedInChapter === chapterCount && chapterCount > 0) {
            btn.classList.add('chapter-done'); // Yashil rang (premium)
        }
        
        btn.innerHTML = `
            Bo'lim ${start + 1}-${end}
            <span class="chapter-indicator">${learnedInChapter}/${chapterCount} o'zlashtirildi</span>
        `;
        btn.onclick = () => selectChapter(start, end);
        grid.appendChild(btn);
    }
}

// --- Test UI ---
function initTestUI() {
    document.getElementById('progress-bar').style.width = '0%';
    document.getElementById('finish-trigger').classList.add('hidden');
    
    userAnswers = new Array(currentTest.length).fill(null);
    currentIndex = 0;
    timeRemaining = 900;
    
    document.getElementById('exam-timer').innerText = "15:00";
    document.getElementById('score-correct').innerText = "0";
    document.getElementById('score-wrong').innerText = "0";
    
    startTimer();
    generateNavigationMap();
    renderQuestion();
    
    switchScreen('dashboard-screen', 'test-screen');
}

// ... (Timer, Navigation, renderQuestion funksiyalari o'zgarishsiz, 
// lekin premium classlar bilan moslashtirilgan. 
// variant tanlash (handleSelect) yangilandi statistika uchun)

function renderQuestion() {
    const q = currentTest[currentIndex];
    const box = document.getElementById('question-box');
    box.className = 'question-card fade-in';
    
    let optionsHtml = q.options.map((opt, i) => `
        <button class="option-btn" onclick="handleSelect(${i}, this)" ${userAnswers[currentIndex] !== null ? 'disabled' : ''}>
            ${String.fromCharCode(65 + i)}) ${opt}
        </button>
    `).join('');
    
    box.innerHTML = `
        <div class="subj-tag">${q.subject.replace('_',' ')} | Savol ${currentIndex+1}/${currentTest.length}</div>
        <h2>${q.q}</h2>
        <div class="options-list">${optionsHtml}</div>
    `;
    updateNavigationMap();
    
    // Agar oldin tanlagan bo'lsa, javobni ko'rsatish
    if (userAnswers[currentIndex] !== null) {
        let btns = document.querySelectorAll('#question-box .option-btn');
        btns[q.answer].classList.add('correct');
        if (userAnswers[currentIndex] !== q.answer) {
            btns[userAnswers[currentIndex]].classList.add('wrong');
        }
    }
}

// --- Variant tanlash (Unikal statistika mantiqi) ---
function handleSelect(optIdx, btn) {
    if (!currentUser) return;
    
    const q = currentTest[currentIndex];
    const isCorrect = (optIdx === q.answer);
    
    userAnswers[currentIndex] = optIdx;
    
    // Vizual effekt
    let btns = document.querySelectorAll('#question-box .option-btn');
    btns[q.answer].classList.add('correct');
    
    if (!isCorrect) {
        btn.classList.add('wrong');
    }
    
    // Hamma tugmalarni o'chirish
    btns.forEach(b => b.disabled = true);
    
    // UNIKAL STATISTIKA LOGIKASI
    let learnedList = globalStorage[currentUser].learned;
    let errorList = globalStorage[currentUser].errors;
    
    if (isCorrect) {
        // To'g'ri yechildi
        if (!learnedList.includes(q.id)) {
            learnedList.push(q.id); // O'zlashtirilganlarga unikal qo'shish
        }
        // Agar oldin xatolar ro'yxatida bo'lsa, u yerdan o'chirish
        globalStorage[currentUser].errors = errorList.filter(id => id !== q.id);
    } else {
        // Xato yechildi
        if (!learnedList.includes(q.id)) { // Agar hali o'zlashtirilmagan bo'lsa
            if (!errorList.includes(q.id)) {
                errorList.push(q.id); // Xatolarga unikal qo'shish
            }
        }
        // Agar o'zlashtirilgan bo'lsa, xatolarga qo'shilmaydi (qonun-qoida)
    }
    saveData();
    
    // Score update
    updateScoreBoard();
    updateNavigationMap();
    
    // Muvaffaqiyatli o'tish animatsiyasi
    if(currentIndex < currentTest.length - 1) {
        setTimeout(() => move(1), 800);
    } else {
        if (!userAnswers.includes(null)) {
            document.getElementById('finish-trigger').classList.remove('hidden');
        }
    }
}

// ... (Kodni to'liqligi uchun navigation va boshqa helper funksiyalar)
function move(step) {
    let next = currentIndex + step;
    if (next >= 0 && next < currentTest.length) {
        currentIndex = next;
        renderQuestion();
    }
}

function startTimer() {
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        timeRemaining--;
        if (timeRemaining <= 0) {
            clearInterval(timerInterval);
            finishExam();
        } else {
            let m = Math.floor(timeRemaining / 60);
            let s = timeRemaining % 60;
            document.getElementById('exam-timer').innerText = `${m}:${s < 10 ? '0' + s : s}`;
        }
    }, 1000);
}

function generateNavigationMap() {
    const map = document.getElementById('map');
    map.innerHTML = '';
    currentTest.forEach((_, i) => {
        let dot = document.createElement('div');
        dot.className = 'map-dot';
        if (i === 0) dot.classList.add('active');
        dot.onclick = () => { currentIndex = i; renderQuestion(); };
        map.appendChild(dot);
    });
}

function updateNavigationMap() {
    let dots = document.querySelectorAll('.map-dot');
    let answeredCount = 0;
    currentTest.forEach((_, i) => {
        dots[i].className = 'map-dot';
        if (i === currentIndex) dots[i].classList.add('active');
        if (userAnswers[i] !== null) {
            dots[i].classList.add(userAnswers[i] === currentTest[i].answer ? 'filled' : 'filled-wrong');
            answeredCount++;
        }
    });
    
    // Progress Bar update
    let prg = (answeredCount / currentTest.length) * 100;
    document.getElementById('progress-bar').style.width = `${prg}%`;
    
    if (!userAnswers.includes(null)) {
        document.getElementById('finish-trigger').classList.remove('hidden');
    }
}

function updateScoreBoard() {
    let correct = 0, wrong = 0;
    userAnswers.forEach((ans, i) => {
        if (ans === null) return;
        if (ans === currentTest[i].answer) correct++;
        else wrong++;
    });
    document.getElementById('score-correct').innerText = correct;
    document.getElementById('score-wrong').innerText = wrong;
}

function finishExam() {
    clearInterval(timerInterval);
    let correct = userAnswers.filter((ans, i) => ans === currentTest[i].answer).length;
    let wrong = userAnswers.filter((ans, i) => ans !== null && ans !== currentTest[i].answer).length;
    let score = (correct / currentTest.length) * 100;
    
    alert(`Test yakunlandi!\nNatija: ${correct}/${currentTest.length} (${score.toFixed(1)}%).\nXatolar: ${wrong}`);
    
    // Confetti animatsiyasi agar yaxshi natija bo'lsa
    if(score >= 80) triggerWinConfetti();
    
    exitTest();
}

function exitTest() {
    clearInterval(timerInterval);
    document.getElementById('config-modal').classList.replace('active', 'hidden');
    updateDashboardStats();
    generateChapterButtons();
    switchScreen('test-screen', 'dashboard-screen');
}

// ... (Logout, Theme functions o'zgarishsiz, faqat premium dizayn elementlari bilan)

// --- Yordamchi Funksiyalar ---
function switchScreen(fromId, toId) {
    document.getElementById(fromId).classList.replace('active', 'hidden');
    document.getElementById(toId).classList.replace('hidden', 'active');
    
    // Footer vizuallashuvi
    if (toId !== 'welcome-screen') {
        document.getElementById('main-footer').classList.remove('hidden');
    } else {
        document.getElementById('main-footer').classList.add('hidden');
    }
}

function shuffleArray(array) {
    let arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function toggleTheme() {
    document.getElementById('main-body').classList.toggle('dark-mode');
    localStorage.setItem('theme', document.getElementById('main-body').classList.contains('dark-mode') ? 'dark' : 'light');
}

function logout() {
    if(confirm("Tizimdan chiqmoqchimisiz?")) {
        clearInterval(timerInterval);
        currentUser = null;
        document.getElementById('student-name').value = '';
        switchScreen('dashboard-screen', 'welcome-screen');
    }
}

// Confetti effekti (Muvaffaqiyat uchun)
function triggerWinConfetti() {
    var count = 200;
    var defaults = { origin: { y: 0.7 } };

    function fire(particleRatio, opts) {
      confetti(Object.assign({}, defaults, opts, {
        particleCount: Math.floor(count * particleRatio)
      }));
    }

    fire(0.25, { spread: 26, startVelocity: 55 });
    fire(0.2, { spread: 60 });
    fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
    fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
    fire(0.1, { spread: 120, startVelocity: 45 });
}