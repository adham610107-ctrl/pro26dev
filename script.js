// Global State
let fullBank = [];
let currentTest = [];
let userAnswers = [];
let currentIndex = 0;
let userName = "";
let hasMadeMistake = false; // CRITICAL: 100% logic tracker
let examTimer = null;

let pendingConfig = { mode: null, subject: null, level: null };
let testOptions = { order: 'random' }; // diff is visual only now

// 1. Dastlabki yuklanish
async function loadData() {
    const files = ['musiqa_nazariyasi.json', 'cholgu_ijrochiligi.json', 'vokal_ijrochiligi.json', 'metodika_repertuar.json'];
    let gId = 0;
    for(let f of files) {
        try {
            const res = await fetch(f);
            const data = await res.json();
            const sub = f.split('.')[0];
            data.forEach(q => {
                let opts = q.options.filter(o => o && o.trim() !== '');
                let uniqueOpts = [...new Set(opts)];
                let correctText = q.options[q.answer];
                
                // Fix: 3 option bug
                if(uniqueOpts.length === 3) uniqueOpts.push("Barcha javoblar to'g'ri");
                
                let newAnsIdx = uniqueOpts.indexOf(correctText) > -1 ? uniqueOpts.indexOf(correctText) : 0;
                fullBank.push({ id: `q_${gId++}`, subject: sub, q: q.q || q.question, options: uniqueOpts, answerText: uniqueOpts[newAnsIdx] });
            });
        } catch(e) { console.log(f + " topilmadi"); }
    }
}

window.onload = async () => {
    await loadData();
    let savedName = localStorage.getItem('adham_user_name');
    if(savedName) {
        document.getElementById('student-name').value = savedName;
    }
};

// 2. Navigatsiya va Boshqaruv
function getEl(id) { return document.getElementById(id); }
function hide(id) { getEl(id).classList.add('hidden'); }
function show(id) { getEl(id).classList.remove('hidden'); }
function shuffle(arr) { return arr.sort(() => Math.random() - 0.5); }

function enterDashboard() {
    let inp = getEl('student-name').value.trim();
    if(!inp) return alert("Ismingizni kiriting!");
    userName = inp;
    localStorage.setItem('adham_user_name', userName);
    getEl('user-display').innerText = userName;
    updateStatsUI();
    hide('welcome-screen'); show('dashboard-screen');
}

function updateStatsUI() {
    let stats = JSON.parse(localStorage.getItem(`stats_${userName}`)) || { mastered: [], mistakes: [] };
    getEl('learned-count').innerText = stats.mastered.length;
    getEl('error-count').innerText = stats.mistakes.length;
    
    let errBtn = getEl('error-btn');
    if(stats.mistakes.length === 0) {
        errBtn.style.opacity = '0.5';
        errBtn.onclick = () => alert("Sizda xatolar yo'q!");
    } else {
        errBtn.style.opacity = '1';
        errBtn.onclick = () => setupTest('errors', 'Xatolar ustida ishlash');
    }
}

// 3. Modal va Sozlamalar
function openLevels(sub, title) {
    pendingConfig.subject = sub;
    getEl('level-title').innerText = title;
    let container = getEl('levels-container');
    container.innerHTML = '';
    
    for(let i=1; i<=10; i++) {
        let btn = document.createElement('button');
        btn.className = 'lvl-btn'; btn.innerText = `${i}-Blok`;
        btn.onclick = () => { pendingConfig.mode = 'level'; pendingConfig.level = i; closeModal('levels-modal'); show('setup-modal'); };
        container.appendChild(btn);
    }
    show('levels-modal');
}

function setupTest(mode, title) {
    pendingConfig.mode = mode;
    show('setup-modal');
}

function setDiff(btn) { document.querySelectorAll('.diff-btn').forEach(b=>b.classList.remove('active')); btn.classList.add('active'); }
function setOrder(btn) { document.querySelectorAll('.ord-btn').forEach(b=>b.classList.remove('active')); btn.classList.add('active'); testOptions.order = btn.dataset.order; }
function closeModal(id) { hide(id); }

// 4. Testni Boshlash
function startExam() { pendingConfig.mode = 'exam'; launchTest(); }

function launchTest() {
    hide('setup-modal'); hide('dashboard-screen'); show('test-screen');
    getEl('bg-layer').classList.add('bg-blurred');
    
    let pool = [];
    if(pendingConfig.mode === 'level') {
        let subQ = fullBank.filter(q => q.subject === pendingConfig.subject);
        pool = subQ.slice((pendingConfig.level-1)*20, pendingConfig.level*20);
    } else if(pendingConfig.mode === 'global_mixed') {
        pool = shuffle([...fullBank]).slice(0, 20);
    } else if(pendingConfig.mode === 'errors') {
        let stats = JSON.parse(localStorage.getItem(`stats_${userName}`));
        pool = fullBank.filter(q => stats.mistakes.includes(q.id));
        pool = shuffle(pool).slice(0, 20);
    } else if(pendingConfig.mode === 'exam') {
        pool = shuffle([...fullBank]).slice(0, 60);
        startTimer(3600); // 60 min
    }

    if(testOptions.order === 'random' && pendingConfig.mode !== 'exam') pool = shuffle(pool);
    
    // Test holatini yaratish
    currentTest = pool.map(q => {
        let opts = shuffle([...q.options]); // Doim variantlar aralashadi
        return { ...q, options: opts };
    });
    
    startRound();
}

function startRound() {
    userAnswers = new Array(currentTest.length).fill(null);
    currentIndex = 0;
    hasMadeMistake = false; // CRITICAL Reset
    
    getEl('q-total').innerText = currentTest.length;
    hide('finish-btn');
    renderSlider();
    renderQuestion();
}

function startTimer(secs) {
    show('exam-timer');
    clearInterval(examTimer);
    examTimer = setInterval(() => {
        secs--;
        let m = Math.floor(secs/60).toString().padStart(2,'0'), s = (secs%60).toString().padStart(2,'0');
        getEl('exam-timer').innerText = `${m}:${s}`;
        if(secs <= 0) { clearInterval(examTimer); checkFinalResult(); }
    }, 1000);
}

// 5. Render va Mantiq
function renderSlider() {
    let dots = getEl('slider-dots'); dots.innerHTML = '';
    currentTest.forEach((_, i) => {
        let d = document.createElement('div'); d.className = 'q-dot'; d.id = `dot-${i}`; d.innerText = i+1;
        d.onclick = () => { currentIndex = i; renderQuestion(); };
        dots.appendChild(d);
    });
}

function renderQuestion() {
    let qObj = currentTest[currentIndex];
    
    // Roulette animation
    let rn = getEl('q-current-num');
    rn.innerText = currentIndex + 1;
    rn.classList.remove('spin'); void rn.offsetWidth; rn.classList.add('spin');

    getEl('question-text').innerText = qObj.q;
    let optBox = getEl('options-container'); optBox.innerHTML = '';
    
    let ansData = userAnswers[currentIndex];
    
    qObj.options.forEach(opt => {
        let btn = document.createElement('button');
        btn.className = 'opt-btn'; btn.innerText = opt;
        
        if(ansData) {
            btn.disabled = true;
            // CRITICAL RULE: To'g'ri javobni yashil qilib ko'rsatmaslik, faqat xatoni qizil qilish.
            if(opt === ansData.selected) {
                if(ansData.isCorrect) btn.classList.add('user-correct');
                else btn.classList.add('user-wrong');
            }
        } else {
            btn.onclick = () => selectAnswer(opt, btn);
        }
        optBox.appendChild(btn);
    });

    // Slider va Progress yangilash
    let answered = userAnswers.filter(a => a).length;
    getEl('progress-bar').style.width = `${(answered/currentTest.length)*100}%`;
    
    document.querySelectorAll('.q-dot').forEach((d, i) => {
        d.className = 'q-dot';
        if(i === currentIndex) { d.classList.add('active'); d.scrollIntoView({behavior: 'smooth', inline: 'center'}); }
        if(userAnswers[i]) d.classList.add(userAnswers[i].isCorrect ? 'correct' : 'wrong');
    });

    if(answered === currentTest.length) show('finish-btn');
}

function selectAnswer(selText, btnEl) {
    let qObj = currentTest[currentIndex];
    let isCorrect = (selText === qObj.answerText);
    userAnswers[currentIndex] = { selected: selText, isCorrect: isCorrect };
    
    let stats = JSON.parse(localStorage.getItem(`stats_${userName}`)) || { mastered: [], mistakes: [] };
    
    if(isCorrect) {
        btnEl.classList.add('user-correct');
        if(!stats.mastered.includes(qObj.id)) stats.mastered.push(qObj.id);
        stats.mistakes = stats.mistakes.filter(id => id !== qObj.id);
    } else {
        btnEl.classList.add('user-wrong');
        hasMadeMistake = true; // 100% logic trigger
        if(!stats.mistakes.includes(qObj.id)) stats.mistakes.push(qObj.id);
        stats.mastered = stats.mastered.filter(id => id !== qObj.id);
    }
    
    localStorage.setItem(`stats_${userName}`, JSON.stringify(stats));
    updateStatsUI();
    
    // Disable all
    document.querySelectorAll('.opt-btn').forEach(b => b.disabled = true);
    
    // Auto next
    setTimeout(() => { moveQ(1); }, 800);
}

function moveQ(step) {
    let next = currentIndex + step;
    if(next >= 0 && next < currentTest.length) { currentIndex = next; renderQuestion(); }
    else {
        let unans = userAnswers.findIndex(a => !a);
        if(unans !== -1) { currentIndex = unans; renderQuestion(); }
    }
}

// 6. Yakunlash va 100% Mantiq
function checkFinalResult() {
    let correct = userAnswers.filter(a => a && a.isCorrect).length;
    let perc = Math.round((correct / currentTest.length) * 100);
    
    if(pendingConfig.mode === 'exam') {
        alert(`Imtihon yakunlandi!\nNatija: ${correct}/${currentTest.length} (${perc}%)`);
        exitTest();
        return;
    }

    if(hasMadeMistake) {
        alert(`Sizda xato bor! Natija: ${perc}%. Ushbu 20 talikni 100% o'zlashtirmaguningizcha almashtira olmaysiz. Qaytadan ishlang!`);
        // Shuffle existing currentTest sequence if order is random
        if(testOptions.order === 'random') currentTest = shuffle(currentTest);
        startRound(); // Xuddi shu savollar boshidan beriladi
    } else {
        alert("MUKAMMAL! 100% natija. Endi keyingi blokka o'tishingiz mumkin.");
        exitTest();
    }
}

function confirmExit() { if(confirm("Chindan ham chiqmoqchimisiz? Natijalar qisman saqlanadi.")) exitTest(); }
function exitTest() {
    clearInterval(examTimer); hide('exam-timer');
    getEl('bg-layer').classList.remove('bg-blurred');
    hide('test-screen'); show('dashboard-screen');
}
