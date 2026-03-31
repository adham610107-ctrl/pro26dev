let bank = [];
let currentTest = [];
let userAnswers = [];
let currentIndex = 0;
let currentUser = null;
let timerInterval;

// Holat Parametrlari
let pendingSubject = null;
let pendingPool = [];
let diffTime = 900; 
let orderMode = 'random'; 
let isExamMode = false;

// JSON Yuklash & Tozalash (PRO Logic)
async function loadData() {
    const files = ['musiqa_nazariyasi.json', 'cholgu_ijrochiligi.json', 'vokal_ijrochiligi.json', 'metodika_repertuar.json'];
    let globalIndex = 0;
    
    for (const f of files) {
        try {
            const res = await fetch(f);
            const data = await res.json();
            const subject = f.split('.')[0];
            
            data.forEach((q) => {
                // 1. Tozalash va dublikatlarni olib tashlash
                let rawOpts = q.options.filter(o => o !== null && o !== undefined && o.toString().trim() !== ''); 
                let uniqueOpts = [...new Set(rawOpts)]; 
                
                let correctText = q.options[q.answer]; 
                
                // 2. Agar aynan 3 ta unikal javob qolgan bo'lsa, 4-ni qo'shish
                if (uniqueOpts.length === 3) {
                    uniqueOpts.push("Barcha javoblar to'g'ri");
                }
                
                let newAnsIdx = uniqueOpts.indexOf(correctText);
                if (newAnsIdx === -1) newAnsIdx = 0; // xavfsizlik uchun

                bank.push({ ...q, id: `q_${globalIndex}`, subject, options: uniqueOpts, answer: newAnsIdx });
                globalIndex++;
            });
        } catch (e) { console.error(f + " yuklanmadi. Serveryoki Localhostni tekshiring."); }
    }
}

window.onload = async () => {
    await loadData();
    if (localStorage.getItem('theme') === 'dark') {
        document.body.classList.add('dark-mode');
    }
};

// ================= LOGIN VA STATS =================
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
    
    // Unikal saqlanishi kerak (800 dan oshmasligi uchun)
    userDb.learned = [...new Set(userDb.learned)];
    userDb.errors = [...new Set(userDb.errors)];
    localStorage.setItem(`stats_${currentUser}`, JSON.stringify(userDb));

    document.getElementById('learned-count').innerText = userDb.learned.length;
    document.getElementById('error-count').innerText = userDb.errors.length;
    
    // 7-tugmani faollashtirish (Faqat xato bo'lsa)
    document.getElementById('error-work-btn').disabled = userDb.errors.length === 0;
}

// ================= BO'LIMLAR (6-TUGMA) =================
function toggleChapters() {
    const grid = document.getElementById('chapters-grid');
    grid.classList.toggle('hidden');
    if(!grid.classList.contains('hidden')) renderChapterGrid();
}

function renderChapterGrid() {
    const grid = document.getElementById('chapters-grid');
    grid.innerHTML = '';
    const userDb = JSON.parse(localStorage.getItem(`stats_${currentUser}`)) || { learned: [], errors: [] };

    // 800 ta savol uchun 40 ta bo'lim (20 tadan)
    let totalChunks = Math.ceil(bank.length / 20);
    
    for (let i = 0; i < totalChunks; i++) {
        let start = i * 20;
        let end = Math.min(start + 20, bank.length);
        let chunk = bank.slice(start, end);
        
        // Shu 20 talik ichida qanchasi learned ichida borligini hisoblash
        let learnedInChunk = chunk.filter(q => userDb.learned.includes(q.id)).length;
        
        let btn = document.createElement('button');
        btn.className = 'chap-btn';
        let progClass = learnedInChunk === chunk.length ? 'chap-prog full' : 'chap-prog';
        btn.innerHTML = `${start + 1}-${end} <span class="${progClass}">${learnedInChunk}/${chunk.length}</span>`;
        btn.onclick = () => { pendingSubject = 'sequential'; pendingPool = chunk; showSetup(`Bo'lim: ${start+1}-${end}`); };
        grid.appendChild(btn);
    }
}

// ================= FAN LEVEL LARI (1-4 TUGMALAR) =================
function openLevelsModal(subjectId, subjectName) {
    document.getElementById('level-modal-title').innerText = subjectName;
    const grid = document.getElementById('levels-grid');
    grid.innerHTML = '';
    
    const userDb = JSON.parse(localStorage.getItem(`stats_${currentUser}`)) || { learned: [], errors: [] };
    let subPool = bank.filter(q => q.subject === subjectId);
    
    // 10 ta level (20 tadan = 200 ta)
    for(let i=0; i<10; i++) {
        let start = i * 20;
        let end = start + 20;
        let chunk = subPool.slice(start, end);
        
        if(chunk.length === 0) break; // Agar 200 tadan kam bo'lsa
        
        let learnedInChunk = chunk.filter(q => userDb.learned.includes(q.id)).length;
        let progClass = learnedInChunk === chunk.length ? 'chap-prog full' : 'chap-prog';
        
        let btn = document.createElement('button');
        btn.className = 'level-btn';
        btn.innerHTML = `
            <div style="display:flex; align-items:center; gap:10px;">
                <span class="lvl-num">${i+1}</span>
                <span>${start + 1}-${end}</span>
            </div>
            <span class="${progClass}">${learnedInChunk}/${chunk.length}</span>
        `;
        btn.onclick = () => { 
            closeLevelsModal();
            pendingSubject = subjectId; 
            pendingPool = chunk; 
            showSetup(`${subjectName} - Level ${i+1}`); 
        };
        grid.appendChild(btn);
    }
    
    document.getElementById('levels-modal').classList.remove('hidden');
}

function closeLevelsModal() {
    document.getElementById('levels-modal').classList.add('hidden');
}


// ================= SETUP SCREEN =================
function openSetup(type, title) {
    const userDb = JSON.parse(localStorage.getItem(`stats_${currentUser}`)) || { learned: [], errors: [] };
    isExamMode = false;

    if (type === 'errors') {
        pendingPool = bank.filter(q => userDb.errors.includes(q.id));
        if (pendingPool.length === 0) return alert("Hozircha xatolar topilmadi!");
    } else if (type === 'mixed') {
        pendingPool = [...bank]; // 1-800
    }
    
    pendingSubject = type;
    showSetup(title);
}

function showSetup(title = "Test Parametrlari") {
    document.getElementById('setup-title').innerText = title;
    document.getElementById('dashboard-screen').classList.replace('active', 'hidden');
    document.getElementById('setup-screen').classList.replace('hidden', 'active');
    
    // Default holat
    if (pendingSubject === 'sequential') setOrder('sequential', document.querySelector('.order-seq'));
    else setOrder('random', document.querySelector('.order-random'));
}

function cancelSetup() {
    document.getElementById('setup-screen').classList.replace('active', 'hidden');
    document.getElementById('dashboard-screen').classList.replace('hidden', 'active');
}

// Ranglar o'zgargani uchun logikaga moslashtirildi
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

// ================= IMTIHON REJIMI (8-TUGMA) =================
function startExamMode() {
    isExamMode = true;
    let examPool = [];
    const subjects = ['musiqa_nazariyasi', 'cholgu_ijrochiligi', 'vokal_ijrochiligi', 'metodika_repertuar'];
    
    // Har bir fandan 15 tadan random savol (Jami 60)
    subjects.forEach(sub => {
       let subQ = bank.filter(q => q.subject === sub);
       let shuffled = shuffleArray([...subQ]).slice(0, 15);
       examPool = examPool.concat(shuffled);
    });
    
    // Yakuniy 60 tani aralashtirish
    pendingPool = shuffleArray(examPool);
    
    // Imtihon sozlamalari (Foydalanuvchiga ko'rsatmasdan birdan boshlash mumkin, yoki vaqt belgilash)
    diffTime = 3600; // 60 daqiqa imtihon uchun
    orderMode = 'random'; // Savollar random
    
    confirmSetupAndStart(true);
}


// ================= TESTNI BOSHLASH =================
function confirmSetupAndStart(skipSetupModal = false) {
    let selectedQs = [];
    let count = isExamMode ? 60 : 20;
    
    // Savollar ketma-ketligi (Faqat savollarga ta'sir qiladi)
    if (orderMode === 'random') selectedQs = shuffleArray([...pendingPool]).slice(0, Math.min(count, pendingPool.length));
    else selectedQs = pendingPool.slice(0, Math.min(count, pendingPool.length)); 

    // VARIANTLAR HAR DOIM ARALASHTIRILADI
    currentTest = selectedQs.map(q => {
        let correctText = q.options[q.answer];
        let shuffledOpts = shuffleArray([...q.options]);
        return { ...q, options: shuffledOpts, answer: shuffledOpts.indexOf(correctText) };
    });

    if(!skipSetupModal) document.getElementById('setup-screen').classList.replace('active', 'hidden');
    else document.getElementById('dashboard-screen').classList.replace('active', 'hidden');

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

// ================= RENDER VA ANIMATSIYALAR =================
function renderAllQuestions() {
    const area = document.getElementById('all-questions-area');
    area.innerHTML = currentTest.map((q, idx) => `
        <div class="q-block ${idx === currentIndex ? 'active-q' : 'blurred-q'}" id="q-block-${idx}">
            <div class="q-meta">
                SAVOL <span id="num-indicator-${idx}">${idx+1}</span> / ${currentTest.length}
            </div>
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
                // Spinning Animation ishlatish
                playSpinAnimation(i + 1, `num-indicator-${i}`);
            } else {
                block.classList.remove('active-q');
                block.classList.add('blurred-q');
            }
        }
    }
    scrollToActive();
    updateMap();
}

// Rapid number spinner
function playSpinAnimation(targetNum, elementId) {
    let el = document.getElementById(elementId);
    if(!el) return;
    el.classList.add('spin-number');
    let count = 0;
    let maxSpins = 8;
    let interval = setInterval(() => {
        el.innerText = Math.floor(Math.random() * currentTest.length) + 1;
        count++;
        if(count >= maxSpins) {
            clearInterval(interval);
            el.innerText = targetNum;
            el.classList.remove('spin-number');
        }
    }, 40);
}

function scrollToActive() {
    const activeBlock = document.getElementById(`q-block-${currentIndex}`);
    if (activeBlock) {
        activeBlock.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

// ================= TEKSHIRISH VA SAQLASH =================
function checkAns(qIdx, optIdx) {
    if (qIdx !== currentIndex || userAnswers[qIdx]) return;
    
    const isCorrect = optIdx === currentTest[qIdx].answer;
    userAnswers[qIdx] = { selected: optIdx, isCorrect };
    
    let userDb = JSON.parse(localStorage.getItem(`stats_${currentUser}`)) || { learned: [], errors: [] };
    const qId = currentTest[qIdx].id;
    const clickedBtn = document.getElementById(`btn-${qIdx}-${optIdx}`);
    
    if (isCorrect) {
        // Agar xato javob berilganlar ro'yxatida bo'lsa, o'chiramiz
        userDb.errors = userDb.errors.filter(id => id !== qId); 
        // Agar o'zlashtirilmagan bo'lsa, qo'shamiz
        if (!userDb.learned.includes(qId)) userDb.learned.push(qId);
        
        clickedBtn.classList.add('magic-correct');
    } else {
        // Xato ro'yxatiga qo'shamiz (faqat bir marta)
        if (!userDb.errors.includes(qId)) userDb.errors.push(qId);
        
        clickedBtn.classList.add('magic-wrong');
        // Yashirin qoida: To'g'ri javob ko'rsatilmaydi!
    }
    
    localStorage.setItem(`stats_${currentUser}`, JSON.stringify(userDb));
    updateStats();
    
    // Boshqa variantlarni bloklash
    const options = document.getElementById(`opts-${qIdx}`).getElementsByTagName('button');
    for(let btn of options) btn.disabled = true;

    // Tugatish tugmasini chiqarish
    if (userAnswers.filter(a => a !== null).length === currentTest.length) {
        document.getElementById('finish-btn').classList.remove('hidden');
    }

    // Auto Next
    setTimeout(() => { 
        let next = userAnswers.findIndex(ans => ans === null); 
        if (next !== -1) { 
            currentIndex = next; 
            updateFocus(); 
        } 
    }, 700);
}

// ================= YAKUNLASH =================
function finishExam() {
    clearInterval(timerInterval);
    const correct = userAnswers.filter(a => a?.isCorrect).length;
    
    if (isExamMode) {
        showExamResult(correct, currentTest.length);
        return;
    }

    // Oddiy rejim: 100% bo'lmasa qoidalarga ko'ra takrorlanadi
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

// Imtihon rejimi natijalari (Psixologik baholash)
function showExamResult(correct, total) {
    let percent = Math.round((correct / total) * 100);
    let emoji, msg, color;

    if (percent >= 90) {
        emoji = "😍"; msg = "Siz shunchaki dahosiz! Imtihonga 100% tayyorsiz. Shu tempda davom eting!"; color = "conic-gradient(#34C759 " + percent + "%, var(--bg) 0%)";
    } else if (percent >= 70) {
        emoji = "😎"; msg = "Juda yaxshi natija! Yana ozgina harakat qilsangiz rekord o'rnatasiz!"; color = "conic-gradient(#007AFF " + percent + "%, var(--bg) 0%)";
    } else if (percent >= 50) {
        emoji = "🤔"; msg = "Yomon emas, lekin hali o'rganish kerak. Taslim bo'lmang, xatolar ustida ishlang!"; color = "conic-gradient(#FFCC00 " + percent + "%, var(--bg) 0%)";
    } else {
        emoji = "🥺"; msg = "Ko'proq tayyorgarlik kerak. Tizimdagi xatolar ustida ishlab, albatta yuqori cho'qqiga chiqasiz!"; color = "conic-gradient(#FF3B30 " + percent + "%, var(--bg) 0%)";
    }

    document.getElementById('exam-percentage').innerText = `${percent}%`;
    document.querySelector('.exam-score-circle').style.background = color;
    document.getElementById('exam-emoji').innerText = emoji;
    document.getElementById('exam-message').innerText = msg;
    document.getElementById('exam-correct-count').innerText = correct;

    document.getElementById('exam-result-modal').classList.remove('hidden');
    confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
}

function triggerWin() {
    document.getElementById('question-list-wrapper').classList.add('gravity-fall');
    confetti({ particleCount: 200, spread: 90, origin: { y: 0.6 } });
    setTimeout(() => {
        alert("🎉 MUKAMMAL! Siz barcha savollarga to'g'ri javob berdingiz.");
        exitTest();
    }, 2000);
}

// ================= KARTA VA SCROLL =================
function renderMap() {
    const map = document.getElementById('indicator-map');
    map.innerHTML = currentTest.map((_, i) => `<div class="dot" id="dot-${i}" onclick="goTo(${i})">${i+1}</div>`).join('');
}

function updateMap() {
    let answered = userAnswers.filter(a => a !== null).length;
    document.getElementById('progress-fill').style.width = `${(answered / currentTest.length) * 100}%`;
    
    let activeDot = null;
    currentTest.forEach((_, i) => {
        const dot = document.getElementById(`dot-${i}`);
        if(dot) {
            dot.className = 'dot';
            if (i === currentIndex) {
                dot.classList.add('active-dot');
                activeDot = dot;
            }
            if (userAnswers[i]) dot.classList.add(userAnswers[i].isCorrect ? 'correct' : 'wrong');
        }
    });

    // Telefonda qotib qolmasligi uchun Auto-Scroll
    if (activeDot) {
        const container = document.getElementById('map-scroll-container');
        // Mobile uchun silliq gorizontal scroll
        if(window.innerWidth < 768) {
            const dotRect = activeDot.getBoundingClientRect();
            const containerRect = container.getBoundingClientRect();
            
            // Agar nuqta ekrandan chiqib ketayotgan bo'lsa, markazga surish
            if(dotRect.right > containerRect.right || dotRect.left < containerRect.left) {
                activeDot.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
            }
        }
    }
}

// ================= YORDAMCHI FUNKSIYALAR =================
function shuffleArray(arr) { return arr.sort(() => Math.random() - 0.5); }
function goTo(i) { currentIndex = i; updateFocus(); }
function move(step) { let n = currentIndex + step; if (n >= 0 && n < currentTest.length) { currentIndex = n; updateFocus(); } }
function toggleTheme() { document.body.classList.toggle('dark-mode'); localStorage.setItem('theme', document.body.classList.contains('dark-mode') ? 'dark' : 'light'); }
function exitTest() { location.reload(); }
function logout() { if(confirm("Tizimdan chiqishni xohlaysizmi?")) location.reload(); }
