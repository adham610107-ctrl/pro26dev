let bank = [];
let currentTest = [];
let userAnswers = [];
let currentIndex = 0;
let currentUser = null;
let timerInterval;

// Test Settings
let pendingMode = null; // 'level', 'subject_mixed', 'all_mixed', 'errors', 'exam'
let pendingSubject = null; 
let pendingPool = [];
let diffTime = 900; 
let orderMode = 'random'; 
let isExamMode = false;

// 1. Ma'lumotlarni yuklash va Xatolarni tozalash (A,B,C -> D qo'shish)
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
                
                // 3 ta variant bo'lsa 4-sini qo'shish qoidasi
                if (uniqueOpts.length === 3) {
                    uniqueOpts.push("Barcha javoblar to'g'ri");
                }
                
                let newAnsIdx = uniqueOpts.indexOf(correctText);
                if (newAnsIdx === -1) newAnsIdx = 0; 

                bank.push({ ...q, id: `q_${globalIndex}`, subject, originalOptions: uniqueOpts, correctText: correctText });
                globalIndex++;
            });
        } catch (e) { console.error(f + " yuklanmadi. Fayl nomini tekshiring."); }
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

// 2. Statistika (Faqat Unikal To'g'ri va Xato javoblar 800 tadan)
function updateStats() {
    let userDb = JSON.parse(localStorage.getItem(`stats_${currentUser}`)) || { learned: [], errors: [] };
    
    // Tozalash: 800 tadan oshib ketmasligi uchun
    userDb.learned = [...new Set(userDb.learned)];
    userDb.errors = [...new Set(userDb.errors)];
    
    // Agar savol o'rganilgan bo'lsa, xatolar ro'yxatidan o'chadi
    userDb.errors = userDb.errors.filter(id => !userDb.learned.includes(id));
    localStorage.setItem(`stats_${currentUser}`, JSON.stringify(userDb));

    let totalLearned = userDb.learned.length;
    let totalErrors = userDb.errors.length;

    document.getElementById('learned-count').innerText = totalLearned;
    document.getElementById('error-count').innerText = totalErrors;

    // Doiraviy Grafikni yangilash
    document.querySelector('.success-chart').style.background = `conic-gradient(var(--success) ${(totalLearned/800)*100}%, transparent 0%)`;
    document.querySelector('.error-chart').style.background = `conic-gradient(var(--error) ${(totalErrors/800)*100}%, transparent 0%)`;

    document.getElementById('error-work-btn').disabled = totalErrors === 0;
}

// 3. Subject Modal & Level Tizimi (1-10 lvl)
function openSubjectModal(subjectId, title) {
    pendingSubject = subjectId;
    document.getElementById('modal-subject-title').innerText = title;
    
    const grid = document.getElementById('level-grid-container');
    grid.innerHTML = '';
    
    let userDb = JSON.parse(localStorage.getItem(`stats_${currentUser}`)) || { learned: [], errors: [] };
    let subjQuestions = bank.filter(q => q.subject === subjectId); // 200 ta

    for(let i = 0; i < 10; i++) {
        let start = i * 20;
        let chunk = subjQuestions.slice(start, start + 20);
        let learnedInChunk = chunk.filter(q => userDb.learned.includes(q.id)).length;
        
        let btn = document.createElement('button');
        btn.className = 'lvl-btn';
        btn.innerHTML = `${i+1}-lvl <span class="lvl-prog">${learnedInChunk}/20</span>`;
        btn.onclick = () => {
            pendingMode = 'level';
            pendingPool = chunk;
            document.getElementById('setup-title').innerText = `${title} (${i+1}-Level)`;
            closeSubjectModal();
            showSetup();
        };
        grid.appendChild(btn);
    }
    
    document.getElementById('subject-modal').classList.remove('hidden');
}

function closeSubjectModal() { document.getElementById('subject-modal').classList.add('hidden'); }

function startSubjectMixed() {
    pendingMode = 'subject_mixed';
    pendingPool = bank.filter(q => q.subject === pendingSubject); // Barcha 200 ta
    document.getElementById('setup-title').innerText = document.getElementById('modal-subject-title').innerText + " (Aralash 200ta)";
    closeSubjectModal();
    showSetup();
}

// 4. Boshqa Rejimlar (1-800, Xatolar)
function openSetup(mode, title) {
    let userDb = JSON.parse(localStorage.getItem(`stats_${currentUser}`)) || { learned: [], errors: [] };
    pendingMode = mode;
    document.getElementById('setup-title').innerText = title;

    if (mode === 'errors') {
        pendingPool = bank.filter(q => userDb.errors.includes(q.id));
    } else if (mode === 'mixed') {
        pendingPool = bank; // 1-800
    }
    showSetup();
}

function showSetup() {
    isExamMode = false;
    document.getElementById('dashboard-screen').classList.replace('active', 'hidden');
    document.getElementById('setup-screen').classList.replace('hidden', 'active');
}

// 5. Imtihon Rejimi (8-tugma maxsus logikasi)
function startExamMode() {
    isExamMode = true;
    let examPool = [];
    const subjects = ['musiqa_nazariyasi', 'cholgu_ijrochiligi', 'vokal_ijrochiligi', 'metodika_repertuar'];
    
    subjects.forEach(sub => {
        let subQ = shuffleArray(bank.filter(q => q.subject === sub)).slice(0, 15);
        examPool = examPool.concat(subQ);
    });
    
    pendingPool = shuffleArray(examPool); // 60 ta savol
    diffTime = 3600; // 60 minut
    orderMode = 'random';
    
    document.getElementById('dashboard-screen').classList.replace('active', 'hidden');
    confirmSetupAndStart();
}

// Setup Sozlamalari
function setDifficulty(level, btn) {
    document.querySelectorAll('.difficulty-control .seg-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    if(level === 'easy') diffTime = 1800; 
    if(level === 'medium') diffTime = 1200; 
    if(level === 'hard') diffTime = 600; 
}

function setOrder(mode, btn) {
    document.querySelectorAll('.order-control .seg-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    orderMode = mode;
}

// 6. Testni boshlash va Variantlarni aralashtirish
function confirmSetupAndStart() {
    let finalSelection = [];
    
    if (isExamMode) {
        finalSelection = pendingPool; // 60 ta
    } else {
        // Level yoki mixed bo'lsa, agar array katta bo'lsa (masalan 200ta), barchasini olamiz yoki 20talik qisamiz? 
        // Foydalanuvchi "har gal aralash tugmasi bosilganda random 200 tadan aralashib tushsin" degan.
        let amount = (pendingMode === 'subject_mixed' || pendingMode === 'mixed') ? (pendingMode === 'mixed' ? 800 : 200) : 20; 
        
        if (orderMode === 'random') {
            finalSelection = shuffleArray([...pendingPool]).slice(0, amount);
        } else {
            finalSelection = pendingPool.slice(0, amount);
        }
    }

    // Har bir savolning 4 ta variantini aralashtirish (DIQQAT: Javoblar doim aralashadi)
    currentTest = finalSelection.map(q => {
        let shuffledOpts = shuffleArray([...q.originalOptions]);
        return { ...q, options: shuffledOpts, answer: shuffledOpts.indexOf(q.correctText) };
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

// 7. Render va Roulette Animatsiyasi
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
            <div id="msg-${idx}" class="feedback-msg"></div>
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
    
    // Roulette Animation for Number Indicator
    const activeDot = document.getElementById(`dot-${currentIndex}`);
    if(activeDot) {
        activeDot.classList.remove('spin-roulette');
        void activeDot.offsetWidth; // trigger reflow
        activeDot.classList.add('spin-roulette');
    }

    scrollToActive();
    updateMap();
}

function scrollToActive() {
    const activeBlock = document.getElementById(`q-block-${currentIndex}`);
    if (activeBlock) {
        // Mobile da qotib qolmasligi uchun konteyner ichida scroll qilish
        document.getElementById('question-list-wrapper').scrollTo({
            top: activeBlock.offsetTop - 20,
            behavior: 'smooth'
        });
    }
}

// 8. Tekshirish va Psixologik Matnlar
function checkAns(qIdx, optIdx) {
    if (qIdx !== currentIndex || userAnswers[qIdx]) return;
    
    const isCorrect = optIdx === currentTest[qIdx].answer;
    userAnswers[qIdx] = { selected: optIdx, isCorrect };
    
    let userDb = JSON.parse(localStorage.getItem(`stats_${currentUser}`)) || { learned: [], errors: [] };
    const qId = currentTest[qIdx].id;
    const clickedBtn = document.getElementById(`btn-${qIdx}-${optIdx}`);
    const msgBox = document.getElementById(`msg-${qIdx}`);
    
    if (isCorrect) {
        if (!userDb.learned.includes(qId)) userDb.learned.push(qId);
        userDb.errors = userDb.errors.filter(id => id !== qId); 
        
        clickedBtn.classList.add('magic-correct');
        msgBox.innerHTML = "✅ Barakalla! To'g'ri topdingiz.";
        msgBox.style.color = "var(--success)";
    } else {
        if (!userDb.errors.includes(qId) && !userDb.learned.includes(qId)) {
            userDb.errors.push(qId);
        }
        
        clickedBtn.classList.add('magic-wrong');
        msgBox.innerHTML = "❌ Ko'rdingizmi, siz hali yana mashq qilishingiz kerak.";
        msgBox.style.color = "var(--error)";
    }
    msgBox.style.display = "block";
    
    localStorage.setItem(`stats_${currentUser}`, JSON.stringify(userDb));
    
    const options = document.getElementById(`opts-${qIdx}`).getElementsByTagName('button');
    for(let btn of options) btn.disabled = true;

    if (userAnswers.filter(a => a !== null).length === currentTest.length) {
        document.getElementById('finish-btn').classList.remove('hidden');
    }

    setTimeout(() => { 
        let next = userAnswers.findIndex(ans => ans === null); 
        if (next !== -1) { 
            currentIndex = next; 
            updateFocus(); 
        } 
    }, 900);
}

// 9. Imtihonni Yakunlash
function finishExam() {
    clearInterval(timerInterval);
    const correctCount = userAnswers.filter(a => a?.isCorrect).length;
    const total = currentTest.length;
    
    if (isExamMode) {
        // Exam Result Logic
        let percent = Math.round((correctCount / total) * 100);
        document.getElementById('exam-percent').innerText = percent;
        let msg = "";
        if(percent >= 90) msg = "Dahshat! Siz haqiqiy pro darajadasiz. Imtihonga to'liq tayyorsiz!";
        else if(percent >= 70) msg = "Yaxshi natija! Lekin mukammallikka ozgina qoldi. Yana urinib ko'ramizmi?";
        else msg = "Qo'rqmang, xatolar o'rganish uchun beriladi. Qayta urinib ko'ring, siz bunga qodirsiz!";
        
        document.getElementById('exam-motivation').innerText = msg;
        document.getElementById('test-screen').classList.replace('active', 'hidden');
        document.getElementById('exam-result-modal').classList.remove('hidden');
    } else {
        // Normal Test Logic (100% Rule)
        if (correctCount < total) {
            alert(`Natija: ${correctCount}/${total}. Qoidaga ko'ra, 100% bo'lmaguncha ushbu savollar yana qayta beriladi. Taslim bo'lmang!`);
            
            currentTest = shuffleArray(currentTest).map(q => {
                let shuffledOpts = shuffleArray([...q.originalOptions]);
                return { ...q, options: shuffledOpts, answer: shuffledOpts.indexOf(q.correctText) };
            });
            
            userAnswers = new Array(total).fill(null);
            currentIndex = 0;
            startTimer(diffTime);
            renderMap();
            renderAllQuestions();
            document.getElementById('finish-btn').classList.add('hidden');
        } else {
            confetti({ particleCount: 200, spread: 90, origin: { y: 0.6 } });
            setTimeout(() => {
                alert("🎉 MUKAMMAL! Barcha savollarga to'g'ri javob berdingiz.");
                goBackToDashboard();
            }, 2000);
        }
    }
}

// Yordamchi Funksiyalar
function renderMap() {
    const map = document.getElementById('indicator-map');
    map.innerHTML = currentTest.map((_, i) => `<div class="dot" id="dot-${i}" onclick="goTo(${i})">${i+1}</div>`).join('');
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

function shuffleArray(arr) { return arr.sort(() => Math.random() - 0.5); }
function goTo(i) { currentIndex = i; updateFocus(); }
function move(step) { let n = currentIndex + step; if (n >= 0 && n < currentTest.length) { currentIndex = n; updateFocus(); } }
function toggleTheme() { document.body.classList.toggle('dark-mode'); localStorage.setItem('theme', document.body.classList.contains('dark-mode') ? 'dark' : 'light'); }

// 10. Navigatsiya (Bitta oyna orqaga qaytish)
function goBack() {
    if(confirm("Testni to'xtatib orqaga qaytishni xohlaysizmi?")) {
        clearInterval(timerInterval);
        goBackToDashboard();
    }
}

function goBackToDashboard() {
    updateStats();
    document.getElementById('exam-result-modal').classList.add('hidden');
    document.getElementById('setup-screen').classList.replace('active', 'hidden');
    document.getElementById('test-screen').classList.replace('active', 'hidden');
    document.getElementById('dashboard-screen').classList.replace('hidden', 'active');
    document.getElementById('exit-test-btn').classList.add('hidden');
    document.getElementById('exam-timer').classList.add('hidden');
}

function logout() { 
    if(confirm("Tizimdan chiqib, bosh sahifaga qaytishni xohlaysizmi?")) location.reload(); 
}
