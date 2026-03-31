let bank = [];
let currentTest = [];
let currentIndex = 0;
let userAnswers = [];
let timer;
let currentUser = "";

// 1. JSON yuklash va "3 variant" muammosini hal qilish
async function loadData() {
    const files = ['musiqa_nazariyasi.json', 'cholgu_ijrochiligi.json', 'vokal_ijrochiligi.json', 'metodika_repertuar.json'];
    for (let f of files) {
        try {
            let res = await fetch(f);
            let data = await res.json();
            const sub = f.split('.')[0];
            data.forEach((q, idx) => {
                // Duplicate variantlarni tozalash va 3 tadan 4 ta qilish
                let opts = [...new Set(q.options.filter(o => o !== null && o !== ""))];
                let correctText = q.options[q.answer];
                
                if (opts.length === 3) {
                    opts.push("Barcha javoblar to'g'ri");
                }
                
                bank.push({
                    id: `${sub}_${idx}`,
                    subject: sub,
                    q: q.q,
                    options: opts,
                    correct: opts.indexOf(correctText) === -1 ? 0 : opts.indexOf(correctText)
                });
            });
        } catch(e) { console.error("JSON Error: " + f); }
    }
}

window.onload = loadData;

function handleLogin() {
    const name = document.getElementById('student-name').value.trim();
    if (name === "") return alert("Ismingizni kiriting!");
    currentUser = name;
    document.getElementById('display-name').innerText = name;
    updateStats();
    switchScreen('welcome-screen', 'dashboard-screen');
}

function updateStats() {
    const stats = JSON.parse(localStorage.getItem(`stats_${currentUser}`)) || { learned: [], errors: [] };
    document.getElementById('learned-count').innerText = stats.learned.length;
    document.getElementById('error-count').innerText = stats.errors.length;
    
    // Xatolar tugmasini faollashtirish
    const eb = document.getElementById('err-btn');
    if (stats.errors.length === 0) eb.style.opacity = "0.5"; else eb.style.opacity = "1";
}

// 2. 10 ta Level va Aralash mantiqi
function openLevels(sub, title) {
    const modal = document.getElementById('level-modal');
    const container = document.getElementById('levels-container');
    const mixedBtn = document.getElementById('sub-mixed-btn');
    
    document.getElementById('modal-title').innerText = title;
    container.innerHTML = "";
    
    let subPool = bank.filter(q => q.subject === sub);
    const stats = JSON.parse(localStorage.getItem(`stats_${currentUser}`)) || { learned: [], errors: [] };

    for (let i = 0; i < 10; i++) {
        let start = i * 20;
        let end = start + 20;
        let chunk = subPool.slice(start, end);
        if (chunk.length === 0) break;

        let learnedInLvl = chunk.filter(q => stats.learned.includes(q.id)).length;

        let btn = document.createElement('button');
        btn.className = "level-card";
        btn.innerHTML = `<span>${i+1}-Lvl</span> <span>${learnedInLvl}/20</span>`;
        btn.onclick = () => startTest(chunk, false);
        container.appendChild(btn);
    }

    mixedBtn.onclick = () => startTest(shuffleArray([...subPool]).slice(0, 200), true);
    modal.classList.remove('hidden');
}

function startTest(questions, isRandom) {
    closeModal();
    currentTest = questions.map(q => {
        let correctText = q.options[q.correct];
        let newOpts = shuffleArray([...q.options]);
        return {...q, options: newOpts, correct: newOpts.indexOf(correctText)};
    });
    
    currentIndex = 0;
    userAnswers = new Array(currentTest.length).fill(null);
    initTestUI();
    switchScreen('dashboard-screen', 'test-screen');
}

// 60 talik imtihon
function startExam60() {
    let pool = shuffleArray([...bank]).slice(0, 60);
    startTest(pool, true);
    document.getElementById('timer').classList.remove('hidden');
    startTimer(3600);
}

function initTestUI() {
    renderMap();
    showQuestion();
    updateProgress();
}

function showQuestion() {
    const q = currentTest[currentIndex];
    const spin = document.getElementById('q-number-spin');
    spin.innerText = currentIndex + 1;
    spin.classList.add('spinning');
    setTimeout(() => spin.classList.remove('spinning'), 300);

    document.getElementById('question-text').innerText = q.q;
    const optCont = document.getElementById('options-container');
    optCont.innerHTML = "";

    q.options.forEach((opt, i) => {
        let btn = document.createElement('button');
        btn.className = "option-btn";
        btn.innerText = opt;
        btn.onclick = () => checkAnswer(i);
        if (userAnswers[currentIndex] !== null) btn.disabled = true;
        optCont.appendChild(btn);
    });

    // Mobile scroll to active dot
    const activeDot = document.querySelector(`.dot[data-idx="${currentIndex}"]`);
    activeDot?.scrollIntoView({ behavior: 'smooth', inline: 'center' });
}

function checkAnswer(idx) {
    if (userAnswers[currentIndex] !== null) return;
    
    const q = currentTest[currentIndex];
    const isCorrect = idx === q.correct;
    userAnswers[currentIndex] = isCorrect;

    const stats = JSON.parse(localStorage.getItem(`stats_${currentUser}`)) || { learned: [], errors: [] };
    
    if (isCorrect) {
        if (!stats.learned.includes(q.id)) stats.learned.push(q.id);
        stats.errors = stats.errors.filter(id => id !== q.id);
    } else {
        if (!stats.errors.includes(q.id)) stats.errors.push(q.id);
    }

    localStorage.setItem(`stats_${currentUser}`, JSON.stringify(stats));
    updateStats();
    showQuestion(); // refresh to disable buttons
    renderMap();
    
    // Auto move
    setTimeout(() => { if (currentIndex < currentTest.length - 1) move(1); else finishTest(); }, 500);
}

function finishTest() {
    const correctCount = userAnswers.filter(a => a === true).length;
    const percent = Math.round((correctCount / currentTest.length) * 100);
    
    document.getElementById('final-percent').innerText = percent + "%";
    const stroke = document.getElementById('result-stroke');
    stroke.setAttribute('stroke-dasharray', `${percent}, 100`);
    
    let msg = "";
    let color = "--ios-red";
    if (percent >= 90) { msg = "Barakalla! Mukammal natija!"; color = "--ios-green"; }
    else if (percent >= 60) { msg = "Yaxshi! Lekin hali mashq qilishingiz kerak."; color = "--ios-yellow"; }
    else { msg = "Yana urinib ko'ring, tushkunlikka tushmang!"; color = "--ios-red"; }
    
    stroke.style.stroke = `var(${color})`;
    document.getElementById('result-status').innerText = percent >= 60 ? "Muvaffaqiyatli!" : "Harakatdan to'xtamang!";
    document.getElementById('result-motivation').innerText = msg;
    
    document.getElementById('result-modal').classList.remove('hidden');
}

// Yordamchi funksiyalar
function shuffleArray(array) { return array.sort(() => Math.random() - 0.5); }
function switchScreen(hide, show) {
    document.getElementById(hide).classList.add('hidden');
    document.getElementById(show).classList.remove('hidden');
    document.getElementById(show).classList.add('active');
}
function move(step) {
    let next = currentIndex + step;
    if (next >= 0 && next < currentTest.length) {
        currentIndex = next;
        showQuestion();
        renderMap();
    }
}
function renderMap() {
    const cont = document.getElementById('indicator-scroll');
    cont.innerHTML = currentTest.map((_, i) => {
        let cls = "dot";
        if (i === currentIndex) cls += " active";
        if (userAnswers[i] === true) cls += " correct";
        if (userAnswers[i] === false) cls += " wrong";
        return `<div class="${cls}" data-idx="${i}" onclick="jumpTo(${i})">${i+1}</div>`;
    }).join('');
}
function jumpTo(i) { currentIndex = i; showQuestion(); renderMap(); }
function closeModal() { document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden')); }
function exitToHome() { location.reload(); }
function goBack() { switchScreen('test-screen', 'dashboard-screen'); }
