// GLOBAL VARIABLES
let fullBank = [];
let currentTest = [];
let userAnswers = []; // saqlash format: { qId: int, selectedObj: string, isCorrect: bool }
let currentIndex = 0;
let userName = "";

let masteredSet = new Set(JSON.parse(localStorage.getItem('mastered') || '[]'));
let mistakesSet = new Set(JSON.parse(localStorage.getItem('mistakes') || '[]'));

// State for pending config
let pendingConfig = { subject: null, level: null, mode: null }; 
let testSettings = { diff: 'orta', order: 'ketma-ket' };
let timerInt = null;
let isExam = false;

// 1. DATA PREP & FIXING
async function initData() {
    const files = ['musiqa_nazariyasi.json', 'cholgu_ijrochiligi.json', 'vokal_ijrochiligi.json', 'metodika_repertuar.json'];
    let gId = 1;
    for (let f of files) {
        try {
            const res = await fetch(f);
            const data = await res.json();
            const subjName = f.replace('.json', '');
            
            data.forEach(q => {
                // Remove empty and duplicate options
                let rawOpts = q.options.filter(o => o && o.toString().trim() !== '');
                let uniqueOpts = [...new Set(rawOpts)];
                let originalAnswerText = q.options[q.answer];

                // Auto-fix 3 option questions
                if(uniqueOpts.length === 3) {
                    uniqueOpts.push("Barcha javoblar to'g'ri");
                }

                fullBank.push({
                    id: gId++,
                    subject: subjName,
                    q: q.q || q.question,
                    options: uniqueOpts,
                    answerText: originalAnswerText // always rely on text matching
                });
            });
        } catch(e) { console.error("Error loading", f, e); }
    }
    updateDashboardStats();
}

window.onload = () => { initData(); };

// UTILS
const getEl = id => document.getElementById(id);
const hide = id => getEl(id).classList.add('hidden');
const show = id => getEl(id).classList.remove('hidden');
const shuffleArray = arr => arr.sort(() => Math.random() - 0.5);

// 2. NAVIGATION & FLOW
function startApp() {
    let inp = getEl('student-name').value.trim();
    if(!inp) return alert("Iltimos, ismingizni kiriting!");
    userName = inp;
    getEl('greeting-name').innerText = `Salom, ${userName}`;
    getEl('welcome-screen').classList.replace('active', 'hidden');
    show('dashboard-screen');
    show('global-nav');
}

function updateDashboardStats() {
    getEl('stat-mastered').innerText = `${masteredSet.size}/800`;
    getEl('stat-mistakes').innerText = `${mistakesSet.size}/800`;
}

// 3. LEVEL & MODES SETUP
function openLevels(subj) {
    pendingConfig.subject = subj;
    getEl('level-title').innerText = subj.replace('_', ' ').toUpperCase();
    let container = getEl('levels-container');
    container.innerHTML = '';
    
    // 10 levels generated
    for(let i=1; i<=10; i++) {
        let btn = document.createElement('button');
        btn.className = 'lvl-btn';
        btn.innerText = `${i}-lvl`;
        btn.onclick = () => {
            pendingConfig.mode = 'level'; pendingConfig.level = i;
            hide('levels-modal'); show('setup-modal');
        };
        container.appendChild(btn);
    }
    
    getEl('level-mixed-btn').onclick = () => {
        pendingConfig.mode = 'subj_mixed';
        hide('levels-modal'); show('setup-modal');
    };
    
    show('levels-modal');
}

function startMistakes() {
    if(mistakesSet.size === 0) return alert("Zo'r! Hozircha xatolaringiz yo'q.");
    pendingConfig.mode = 'mistakes';
    show('setup-modal');
}

function startExam() {
    pendingConfig.mode = 'exam';
    testSettings.order = 'random'; // exam is always random
    launchTest(); // skip setup for exam
}

function setupTest(mode) {
    pendingConfig.mode = mode;
    show('setup-modal');
}

// Config selection Logic
function selectDiff(btn, val) {
    document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active'); testSettings.diff = val;
}
function selectOrder(btn, val) {
    document.querySelectorAll('.ord-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active'); testSettings.order = val;
}
function closeModal(id) { hide(id); }

// 4. TEST ENGINE LAUNCH
function launchTest() {
    hide('setup-modal'); hide('dashboard-screen'); hide('levels-modal');
    show('test-screen'); show('exit-test-btn');
    isExam = (pendingConfig.mode === 'exam');
    
    let pool = [];
    if(pendingConfig.mode === 'level') {
        let subjBank = fullBank.filter(q => q.subject === pendingConfig.subject);
        let start = (pendingConfig.level - 1) * 20;
        pool = subjBank.slice(start, start + 20);
    } 
    else if(pendingConfig.mode === 'subj_mixed') {
        let subjBank = fullBank.filter(q => q.subject === pendingConfig.subject);
        pool = shuffleArray([...subjBank]).slice(0, 20);
    }
    else if(pendingConfig.mode === 'global_mixed') {
        pool = shuffleArray([...fullBank]).slice(0, 20);
    }
    else if(pendingConfig.mode === 'mistakes') {
        pool = fullBank.filter(q => mistakesSet.has(q.id));
        pool = shuffleArray(pool).slice(0, 20);
    }
    else if(isExam) {
        pool = shuffleArray([...fullBank]).slice(0, 60);
        startTimer(60 * 60);
    }

    if(testSettings.order === 'random' && !isExam) pool = shuffleArray(pool);
    
    currentTest = pool;
    userAnswers = new Array(currentTest.length).fill(null);
    currentIndex = 0;
    
    getEl('q-total-count').innerText = currentTest.length;
    renderSliderDots();
    renderQuestion();
}

// 5. RENDERING QUESTION & ROULETTE
function renderSliderDots() {
    const slider = getEl('q-slider');
    slider.innerHTML = '';
    currentTest.forEach((_, i) => {
        let dot = document.createElement('div');
        dot.className = `q-dot`;
        dot.innerText = i + 1;
        dot.onclick = () => { currentIndex = i; renderQuestion(); };
        slider.appendChild(dot);
    });
}

function renderQuestion() {
    let qObj = currentTest[currentIndex];
    
    // Roulette Animation trigger
    let rNum = getEl('q-roulette');
    rNum.innerText = currentIndex + 1;
    rNum.classList.remove('spin');
    void rNum.offsetWidth; // trigger reflow
    rNum.classList.add('spin');

    // UI Updates
    getEl('question-text').innerText = qObj.q;
    let optContainer = getEl('options-container');
    optContainer.innerHTML = '';
    let fText = getEl('feedback-text');
    fText.className = 'feedback-text hidden';
    
    // Always shuffle options visually
    let visualOptions = shuffleArray([...qObj.options]);
    let ansData = userAnswers[currentIndex];

    visualOptions.forEach(optText => {
        let btn = document.createElement('button');
        btn.className = 'opt-btn';
        btn.innerText = optText;
        
        if (ansData) {
            btn.disabled = true;
            if (optText === ansData.selectedObj) {
                btn.classList.add(ansData.isCorrect ? 'correct-ans' : 'wrong-ans');
            }
        } else {
            btn.onclick = () => selectAnswer(optText, qObj, btn);
        }
        optContainer.appendChild(btn);
    });

    // Update Slider focus & auto-scroll
    let dots = document.querySelectorAll('.q-dot');
    dots.forEach((d, i) => {
        d.classList.remove('active');
        if(i === currentIndex) {
            d.classList.add('active');
            d.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
        }
        if(userAnswers[i]) {
            d.classList.add('answered');
            d.classList.add(userAnswers[i].isCorrect ? 'correct' : 'wrong');
        }
    });

    if (ansData) showPsychFeedback(ansData.isCorrect);

    // Finish logic
    if (userAnswers.every(x => x !== null)) {
        show('finish-btn');
    } else {
        hide('finish-btn');
    }
}

// 6. ANSWER LOGIC & PSYCHOLOGY
function selectAnswer(selectedText, qObj, btnEl) {
    let isCorrect = (selectedText === qObj.answerText);
    userAnswers[currentIndex] = { qId: qObj.id, selectedObj: selectedText, isCorrect: isCorrect };
    
    // Global Stat Tracking
    if(isCorrect) {
        masteredSet.add(qObj.id);
        mistakesSet.delete(qObj.id);
    } else {
        mistakesSet.add(qObj.id);
        masteredSet.delete(qObj.id);
    }
    saveStats();
    
    renderQuestion(); // Re-render to show colors and lock
    
    // Auto next after 1.5s
    setTimeout(() => { move(1); }, 1500);
}

function showPsychFeedback(isCorrect) {
    let fText = getEl('feedback-text');
    fText.classList.remove('hidden', 'success', 'error');
    if(isCorrect) {
        fText.classList.add('success');
        fText.innerText = "Barakalla! To'g'ri topdingiz.";
    } else {
        fText.classList.add('error');
        fText.innerText = "Xato! Yana urinib ko'ring, xatolardan o'rganamiz.";
    }
}

function saveStats() {
    localStorage.setItem('mastered', JSON.stringify([...masteredSet]));
    localStorage.setItem('mistakes', JSON.stringify([...mistakesSet]));
    updateDashboardStats();
}

function move(step) {
    let n = currentIndex + step;
    if(n >= 0 && n < currentTest.length) {
        currentIndex = n;
        renderQuestion();
    }
}

// 7. EXAM TIMER & EXIT
function startTimer(seconds) {
    show('exam-timer');
    let t = getEl('exam-timer');
    clearInterval(timerInt);
    timerInt = setInterval(() => {
        seconds--;
        let m = Math.floor(seconds / 60).toString().padStart(2, '0');
        let s = (seconds % 60).toString().padStart(2, '0');
        t.innerText = `${m}:${s}`;
        if(seconds <= 0) { clearInterval(timerInt); finishTest(); }
    }, 1000);
}

function confirmExit() {
    if(confirm("Testni yakunlamasdan chiqmoqchimisiz? Natijalar saqlanmaydi.")) {
        exitToDashboard();
    }
}

function exitToDashboard() {
    clearInterval(timerInt); hide('exam-timer');
    hide('test-screen'); hide('result-modal'); hide('exit-test-btn');
    show('dashboard-screen');
    updateDashboardStats();
}
function goHome() {
    if(!getEl('test-screen').classList.contains('hidden')) {
        confirmExit();
    } else {
        hide('setup-modal'); hide('levels-modal'); hide('result-modal');
        if(!getEl('welcome-screen').classList.contains('active')) show('dashboard-screen');
    }
}

// 8. RESULTS
function finishTest() {
    clearInterval(timerInt);
    let correct = userAnswers.filter(a => a && a.isCorrect).length;
    let total = currentTest.length;
    let perc = Math.round((correct / total) * 100);
    
    let msg = ""; let subMsg = "";
    if(isExam) {
        if(perc >= 90) { msg = "Daho!"; subMsg = "Siz imtihonga 100% tayyorsiz! Shunday davom eting."; }
        else if(perc >= 70) { msg = "Ajoyib natija!"; subMsg = "Lekin mukammallikka oz qoldi. Yana ozgina harakat!"; }
        else { msg = "Taslim bo'lmang!"; subMsg = "Xatolardan dars olib, qayta-qayta mashq qilib cho'qqiga chiqamiz."; }
    } else {
        if(perc === 100) { msg = "Mukammal!"; subMsg = "Barcha savollar o'zlashtirildi."; }
        else { msg = "Mashq qilishda davom eting!"; subMsg = "Xatolar ustida ishlash rejimida ularni takrorlang."; }
    }

    getEl('result-percent').innerText = `${perc}%`;
    getEl('result-message').innerText = msg;
    getEl('result-sub-message').innerText = subMsg;
    
    // Donut chart color setup
    let color = perc >= 70 ? 'var(--success)' : (perc >= 40 ? 'var(--warning)' : 'var(--error)');
    getEl('donut-chart').style.background = `conic-gradient(${color} 0% ${perc}%, rgba(255,255,255,0.1) ${perc}% 100%)`;
    
    show('result-modal');
}
