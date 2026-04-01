// --- Day/Night Eye Comfort ---
function toggleTheme() {
    document.body.classList.toggle('light-mode');
}

// --- 3D Hover Magic (Faqat PC da seziladi) ---
document.addEventListener('mousemove', (e) => {
    const card = document.getElementById('question-card');
    if(document.getElementById('screen-test').classList.contains('active')) {
        let xAxis = (window.innerWidth / 2 - e.pageX) / 40;
        let yAxis = (window.innerHeight / 2 - e.pageY) / 40;
        card.style.transform = `rotateY(${xAxis}deg) rotateX(${yAxis}deg)`;
    }
});

// --- Magic Particle Burst ---
function createParticles(x, y) {
    for (let i = 0; i < 12; i++) {
        let p = document.createElement('div');
        p.className = 'magic-particle';
        document.body.appendChild(p);
        let destX = x + (Math.random() - 0.5) * 120;
        let destY = y + (Math.random() - 0.5) * 120;
        p.style.left = x + 'px'; p.style.top = y + 'px';
        p.animate([
            { transform: 'translate(0, 0) scale(1)', opacity: 1 },
            { transform: `translate(${destX - x}px, ${destY - y}px) scale(0)`, opacity: 0 }
        ], { duration: 600, easing: 'ease-out' });
        setTimeout(() => p.remove(), 600);
    }
}

// --- Audio & Vibration ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playFeedback(type) {
    if(audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator(); const gain = audioCtx.createGain();
    osc.connect(gain); gain.connect(audioCtx.destination);
    
    if(type === 'correct') {
        osc.type = 'sine'; osc.frequency.setValueAtTime(600, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1200, audioCtx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.3, audioCtx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
        osc.start(); osc.stop(audioCtx.currentTime + 0.1);
        if("vibrate" in navigator) navigator.vibrate(50);
    } else {
        osc.type = 'sawtooth'; osc.frequency.setValueAtTime(300, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.3, audioCtx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
        osc.start(); osc.stop(audioCtx.currentTime + 0.2);
        if("vibrate" in navigator) navigator.vibrate([150, 100, 150]);
    }
}

// --- Global Vars ---
let bank = []; 
let currentTest = []; let currentIdx = 0;
let stats = JSON.parse(localStorage.getItem('adham_pro_stats')) || { learned: [], errors: [] };
let timerInterval; let pendingSubject = null; let pendingLevelQs = [];
let isExamMode = false; let testType = null;

// --- 1. Load Data ---
async function loadData() {
    const files = ['musiqa_nazariyasi.json', 'cholgu_ijrochiligi.json', 'vokal_ijrochiligi.json', 'metodika_repertuar.json'];
    let globalId = 1;
    for (const f of files) {
        try {
            const res = await fetch(f); const data = await res.json();
            const subName = f.replace('.json', '');
            data.forEach(q => {
                let opts = q.options.filter(o => o !== null && o.toString().trim() !== '');
                let correctText = q.options[q.answer]; 
                if(opts.length === 3) opts.push("Barcha javoblar to'g'ri");
                bank.push({ id: globalId++, subject: subName, q: q.q, originalOpts: opts, correctText: correctText });
            });
        } catch(e) { console.warn(f + " yuklanmadi."); }
    }
    document.getElementById('dash-learned').parentNode.innerHTML = `✅ <span id="dash-learned">${stats.learned.length}</span> / ${bank.length}`;
    updateDashboardStats();
}
window.onload = loadData;

// --- 2. Screens ---
function switchScreen(hideId, showId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(showId).classList.add('active');
}
function login() {
    const name = document.getElementById('student-name').value.trim();
    if(name.length < 2) return alert("Ismingizni kiriting!");
    if(audioCtx.state === 'suspended') audioCtx.resume();
    switchScreen('screen-welcome', 'screen-dash');
}
function goHome() { clearInterval(timerInterval); document.getElementById('modal-result').style.display = 'none'; switchScreen('screen-test', 'screen-dash'); updateDashboardStats(); }
function confirmExit() { if(confirm("Testdan chiqishni xohlaysizmi?")) goHome(); }
function updateDashboardStats() {
    let l = document.getElementById('dash-learned'); if(l) l.innerText = stats.learned.length;
    let e = document.getElementById('dash-errors'); if(e) e.innerText = stats.errors.length;
}
function closeModal(e, id) { if(e.target.id === id) document.getElementById(id).style.display = 'none'; }

// --- 3. Levels & Chapters ---
function openLevels(sub, title) {
    pendingSubject = sub; document.getElementById('modal-subject-title').innerText = title;
    const grid = document.getElementById('level-grid-box'); grid.innerHTML = '';
    let subQs = bank.filter(q => q.subject === sub);
    for(let i=0; i<10; i++) {
        let start = i * 20; let end = start + 20;
        if(start >= subQs.length) break;
        let btn = document.createElement('button'); btn.className = 'lvl-btn';
        btn.innerHTML = `${i+1}-LVL <br><span style="font-size:0.8rem; opacity:0.7">${start+1}-${end}</span>`;
        btn.onclick = () => { pendingLevelQs = subQs.slice(start, end); testType = 'level'; openSetup(); };
        grid.appendChild(btn);
    }
    document.getElementById('modal-level').style.display = 'flex';
}

function openChapters() {
    const grid = document.getElementById('chapters-grid-box'); grid.innerHTML = '';
    const cleanBank = [...bank].sort((a,b) => a.id - b.id);
    const chunks = Math.ceil(cleanBank.length / 20);
    for(let i=0; i<chunks; i++) {
        let start = i * 20; let end = Math.min(start + 20, cleanBank.length);
        let chunkQs = cleanBank.slice(start, end);
        let learned = chunkQs.filter(q => stats.learned.includes(q.id)).length;
        let isFull = learned === (end - start);
        let btn = document.createElement('button'); btn.className = 'lvl-btn';
        btn.innerHTML = `Bob: ${start+1}-${end} <br><span style="font-size:0.85rem; color:${isFull ? 'var(--success)' : 'var(--warning)'}">${learned}/${end - start} ✅</span>`;
        btn.onclick = () => { pendingLevelQs = chunkQs; testType = 'chapter'; openSetup(); };
        grid.appendChild(btn);
    }
    document.getElementById('modal-chapters').style.display = 'flex';
}

function prepareTest(type) {
    if (type === 'errors' && stats.errors.length === 0) return alert("Sizda hozircha xatolar yo'q. Barakalla!");
    testType = type; openSetup();
}

// 🎯 MAGIC FIX: Barcha modal oynalarni tozalab, keyin Setupni ochish
function openSetup() { 
    document.querySelectorAll('.modal-overlay').forEach(m => m.style.display = 'none');
    document.getElementById('modal-setup').style.display = 'flex'; 
}

function setDifficulty(btn) {
    document.querySelectorAll('#modal-setup .lvl-btn:nth-child(-n+3)').forEach(b => b.style.opacity = '0.4');
    btn.style.opacity = '1';
}

// --- 4. Test Logic ---
function applySetup(order) {
    // 🎯 MAGIC FIX: Test boshlanganda oynani to'liq yopamiz
    document.querySelectorAll('.modal-overlay').forEach(m => m.style.display = 'none');
    isExamMode = false;
    let pool = []; 
    let cleanBank = [...bank].sort((a,b) => a.id - b.id);

    if(testType === 'level' || testType === 'chapter') pool = [...pendingLevelQs];
    else if(testType === 'mix_800') pool = [...cleanBank].sort(() => Math.random() - 0.5).slice(0, 20);
    else if(testType === 'errors') pool = cleanBank.filter(q => stats.errors.includes(q.id));
    else if(testType === 'sub_mix') pool = cleanBank.filter(q => q.subject === pendingSubject).sort(() => Math.random()-0.5).slice(0, 20);
    
    if(order === 'rand') pool = pool.sort(() => Math.random() - 0.5);
    else pool = pool.sort((a,b) => a.id - b.id); // Ketma-ketlik kafolati

    currentTest = pool; startTestSession();
}

function startExamMode() {
    testType = 'exam'; isExamMode = true; let examQs = [];
    const subjects = ['musiqa_nazariyasi', 'cholgu_ijrochiligi', 'vokal_ijrochiligi', 'metodika_repertuar'];
    subjects.forEach(sub => { let sQs = bank.filter(q => q.subject === sub).sort(() => Math.random() - 0.5).slice(0, 15); examQs = examQs.concat(sQs); });
    currentTest = examQs.sort(() => Math.random() - 0.5); startTestSession();
}

// --- 5. Engine & Animations ---
function startTestSession() {
    switchScreen('screen-dash', 'screen-test'); currentIdx = 0;
    currentTest = currentTest.map(q => {
        let shuffledOpts = [...q.originalOpts].sort(() => Math.random() - 0.5);
        return { ...q, options: shuffledOpts, answer: shuffledOpts.indexOf(q.correctText), userAns: null };
    });
    document.getElementById('dot-track').innerHTML = currentTest.map((_, i) => `<div class="dot" id="dot-${i}">${i+1}</div>`).join('');
    if(isExamMode) { document.getElementById('exam-timer').style.display = 'block'; startTimer(3600); } 
    else document.getElementById('exam-timer').style.display = 'none';
    loadQuestion();
}

function startTimer(seconds) {
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        seconds--; let m = Math.floor(seconds/60); let s = seconds % 60;
        document.getElementById('exam-timer').innerText = `${m}:${s<10?'0':''}${s}`;
        if(seconds <= 0) { clearInterval(timerInterval); showResult(); }
    }, 1000);
}

function loadQuestion() {
    const q = currentTest[currentIdx];
    document.getElementById('live-counter').innerText = `Savol: ${currentIdx + 1} / ${currentTest.length}`;
    document.querySelectorAll('.dot').forEach(d => d.classList.remove('active'));
    const activeDot = document.getElementById(`dot-${currentIdx}`);
    if(activeDot) { activeDot.classList.add('active'); activeDot.scrollIntoView({ behavior: 'smooth', inline: 'center' }); }

    const spin = document.getElementById('casino-spin'); const qCard = document.getElementById('question-card');
    qCard.classList.remove('shake');
    let sc = 0; let si = setInterval(() => {
        spin.innerText = Math.floor(Math.random() * currentTest.length) + 1;
        if(++sc > 8) { clearInterval(si); spin.innerText = currentIdx + 1; }
    }, 40);

    document.getElementById('question-text').innerText = q.q;
    document.getElementById('options-box').innerHTML = q.options.map((opt, i) => `<button class="opt-btn" onclick="selectAnswer(${i}, this, event)">${opt}</button>`).join('');
}

function selectAnswer(selectedIdx, btnEl, event) {
    document.querySelectorAll('.opt-btn').forEach(b => b.disabled = true);
    const q = currentTest[currentIdx]; const isCorrect = (selectedIdx === q.answer); q.userAns = isCorrect;
    const dot = document.getElementById(`dot-${currentIdx}`); const qCard = document.getElementById('question-card');

    if(isCorrect) {
        btnEl.style.background = 'var(--success)'; btnEl.style.color = '#fff'; btnEl.style.borderColor = 'var(--success)';
        btnEl.style.boxShadow = '0 0 20px rgba(50, 215, 75, 0.5)';
        dot.classList.add('correct'); playFeedback('correct');
        createParticles(event.clientX, event.clientY); // MAGIC PARTICLES
        if(!stats.learned.includes(q.id)) stats.learned.push(q.id);
        stats.errors = stats.errors.filter(id => id !== q.id); 
    } else {
        btnEl.style.background = 'var(--error)'; btnEl.style.color = '#fff'; btnEl.style.borderColor = 'var(--error)';
        qCard.classList.add('shake'); dot.classList.add('wrong'); playFeedback('wrong');
        if(!stats.errors.includes(q.id)) stats.errors.push(q.id);
    }
    localStorage.setItem('adham_pro_stats', JSON.stringify(stats));
    setTimeout(() => { if(currentIdx < currentTest.length - 1) { currentIdx++; loadQuestion(); } else showResult(); }, 1000); 
}

function showResult() {
    clearInterval(timerInterval);
    let correctCount = currentTest.filter(q => q.userAns === true).length;
    let percent
