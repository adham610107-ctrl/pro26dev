// ==========================================
// AUDIO & VIBRATION API (BONUS)
// ==========================================
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playFeedback(type) {
    if(audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    if(type === 'correct') {
        // Yashil to'g'ri javob uchun yoqimli "Bloop" ovozi va yengil vibratsiya
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1200, audioCtx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
        osc.start(); osc.stop(audioCtx.currentTime + 0.1);
        if("vibrate" in navigator) navigator.vibrate(50);
    } else {
        // Qizil xato javob uchun ogohlantiruvchi ovoz va kuchli 2 marta vibratsiya
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(300, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
        osc.start(); osc.stop(audioCtx.currentTime + 0.2);
        if("vibrate" in navigator) navigator.vibrate([150, 100, 150]);
    }
}

// ==========================================
// GLOBAL O'ZGARUVCHILAR
// ==========================================
let bank = [];
let currentTest = [];
let currentIdx = 0;
// 800 talik statistika xotirada saqlanadi
let stats = JSON.parse(localStorage.getItem('adham_pro_stats')) || { learned: [], errors: [] };
let timerInterval;
let pendingSubject = null;
let pendingLevelQs = [];
let isExamMode = false;
let testType = null;

// ==========================================
// 1. DATA YUKLASH VA FILTERLASH
// ==========================================
async function loadData() {
    const files = ['musiqa_nazariyasi.json', 'cholgu_ijrochiligi.json', 'vokal_ijrochiligi.json', 'metodika_repertuar.json'];
    let globalId = 1;
    
    for (const f of files) {
        try {
            const res = await fetch(f);
            const data = await res.json();
            const subjectName = f.replace('.json', '');
            
            data.forEach(q => {
                let opts = q.options.filter(o => o !== null && o.toString().trim() !== '');
                let correctText = q.options[q.answer]; 

                // 3 TA VARIANT BO'LSA: Avtomatik 4-sini qo'shish
                if(opts.length === 3) opts.push("Barcha javoblar to'g'ri");

                bank.push({
                    id: globalId++,
                    subject: subjectName,
                    q: q.q,
                    originalOpts: opts,
                    correctText: correctText
                });
            });
        } catch(e) { 
            console.warn(f + " yuklanmadi. JSON fayllar papkada borligini tekshiring."); 
        }
    }
    updateDashboardStats();
}
window.onload = loadData;

// ==========================================
// 2. EKRANLAR VA MENYU BOSHQRUVI
// ==========================================
function switchScreen(hideId, showId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(showId).classList.add('active');
}

function login() {
    const name = document.getElementById('student-name').value.trim();
    if(name.length < 2) return alert("Ismingizni kiriting!");
    
    // Ovoz tizimini foydalanuvchi bosganda faollashtirish (brauzer qoidasi)
    if(audioCtx.state === 'suspended') audioCtx.resume();
    switchScreen('screen-welcome', 'screen-dash');
}

function goHome() {
    clearInterval(timerInterval);
    document.getElementById('modal-result').style.display = 'none';
    switchScreen('screen-test', 'screen-dash');
    updateDashboardStats();
}

function confirmExit() {
    if(confirm("Testdan chiqishni xohlaysizmi? Yechilmagan natijalar saqlanmaydi.")) {
        goHome();
    }
}

function updateDashboardStats() {
    document.getElementById('dash-learned').innerText = stats.learned.length;
    document.getElementById('dash-errors').innerText = stats.errors.length;
}

function closeModal(e, id) {
    if(e.target.id === id) document.getElementById(id).style.display = 'none';
}

// ==========================================
// 3. LEVEL VA SOZLAMALAR
// ==========================================
function openLevels(sub, title) {
    pendingSubject = sub;
    document.getElementById('modal-subject-title').innerText = title;
    const grid = document.getElementById('level-grid-box');
    grid.innerHTML = '';
    
    let subQs = bank.filter(q => q.subject === sub);
    
    for(let i=0; i<10; i++) {
        let start = i * 20;
        let end = start + 20;
        if(start >= subQs.length) break;
        
        let btn = document.createElement('button');
        btn.className = 'lvl-btn';
        btn.innerHTML = `${i+1}-LVL <br><span style="font-size:0.8rem; opacity:0.7">${start+1}-${end}</span>`;
        btn.onclick = () => {
            pendingLevelQs = subQs.slice(start, end);
            testType = 'level';
            openSetup();
        };
        grid.appendChild(btn);
    }
    document.getElementById('modal-level').style.display = 'flex';
}

function prepareTest(type) {
    document.getElementById('modal-level').style.display = 'none';
    if (type === 'errors' && stats.errors.length === 0) return alert("Sizda hozircha xatolar yo'q. Barakalla!");
    testType = type;
    openSetup();
}

function openSetup() {
    document.getElementById('modal-setup').style.display = 'flex';
}

function setDifficulty(lvl, btn) {
    let btns = document.querySelectorAll('#modal-setup .lvl-btn:nth-child(-n+3)');
    btns.forEach(b => b.style.opacity = '0.5');
    btn.style.opacity = '1';
}

// ==========================================
// 4. TEST BAZASINI SHAKLLANTIRISH
// ==========================================
function applySetup(order) {
    document.getElementById('modal-setup').style.display = 'none';
    isExamMode = false;
    
    let pool = [];
    if(testType === 'level') pool = [...pendingLevelQs];
    else if(testType === 'mix_800') pool = bank.sort(() => Math.random() - 0.5).slice(0, 20);
    else if(testType === 'seq_800') pool = bank.slice(0, 20);
    else if(testType === 'errors') pool = bank.filter(q => stats.errors.includes(q.id));
    else if(testType === 'sub_mix') pool = bank.filter(q => q.subject === pendingSubject).sort(() => Math.random()-0.5).slice(0, 20);
    
    if(order === 'rand') pool = pool.sort(() => Math.random() - 0.5);

    currentTest = pool;
    startTestSession();
}

function startExamMode() {
    testType = 'exam';
    isExamMode = true;
    
    let examQs = [];
    const subjects = ['musiqa_nazariyasi', 'cholgu_ijrochiligi', 'vokal_ijrochiligi', 'metodika_repertuar'];
    subjects.forEach(sub => {
        let sQs = bank.filter(q => q.subject === sub).sort(() => Math.random() - 0.5).slice(0, 15);
        examQs = examQs.concat(sQs);
    });
    
    currentTest = examQs.sort(() => Math.random() - 0.5);
    startTestSession();
}

// ==========================================
// 5. TEST ENGINE & ANIMATIONS
// ==========================================
function startTestSession() {
    switchScreen('screen-dash', 'screen-test');
    currentIdx = 0;
    
    currentTest = currentTest.map(q => {
        let shuffledOpts = [...q.originalOpts].sort(() => Math.random() - 0.5);
        let correctIdx = shuffledOpts.indexOf(q.correctText);
        return { ...q, options: shuffledOpts, answer: correctIdx, userAns: null };
    });

    const track = document.getElementById('dot-track');
    track.innerHTML = currentTest.map((_, i) => `<div class="dot" id="dot-${i}">${i+1}</div>`).join('');

    const timerEl = document.getElementById('exam-timer');
    if(isExamMode) {
        timerEl.style.display = 'block';
        startTimer(60 * 60); 
    } else {
        timerEl.style.display = 'none';
    }

    loadQuestion();
}

function startTimer(seconds) {
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        seconds--;
        let m = Math.floor(seconds/60);
        let s = seconds % 60;
        document.getElementById('exam-timer').innerText = `${m}:${s<10?'0':''}${s}`;
        if(seconds <= 0) { clearInterval(timerInterval); showResult(); }
    }, 1000);
}

function loadQuestion() {
    const q = currentTest[currentIdx];
    document.getElementById('live-counter').innerText = `Savol: ${currentIdx + 1} / ${currentTest.length}`;
    
    // Auto-Scroll to Center
    document.querySelectorAll('.dot').forEach(d => d.classList.remove('active'));
    const activeDot = document.getElementById(`dot-${currentIdx}`);
    if(activeDot) {
        activeDot.classList.add('active');
        activeDot.scrollIntoView({ behavior: 'smooth', inline: 'center' });
    }

    // Casino Spin Animation
    const spin = document.getElementById('casino-spin');
    const qCard = document.getElementById('question-card');
    qCard.classList.remove('shake');
    
    let spinCount = 0;
    let spinInt = setInterval(() => {
        spin.innerText = Math.floor(Math.random() * currentTest.length) + 1;
        spinCount++;
        if(spinCount > 8) {
            clearInterval(spinInt);
            spin.innerText = currentIdx + 1;
        }
    }, 40);

    document.getElementById('question-text').innerText = q.q;
    const optBox = document.getElementById('options-box');
    optBox.innerHTML = q.options.map((opt, i) => `
        <button class="opt-btn" onclick="selectAnswer(${i}, this)">${opt}</button>
    `).join('');
}

function selectAnswer(selectedIdx, btnEl) {
    const allBtns = document.querySelectorAll('.opt-btn');
    allBtns.forEach(b => b.disabled = true);

    const q = currentTest[currentIdx];
    const isCorrect = (selectedIdx === q.answer);
    q.userAns = isCorrect;

    const dot = document.getElementById(`dot-${currentIdx}`);
    const qCard = document.getElementById('question-card');

    if(isCorrect) {
        btnEl.style.background = 'var(--success)';
        btnEl.style.color = '#fff';
        btnEl.style.borderColor = 'var(--success)';
        btnEl.style.boxShadow = '0 0 15px rgba(50, 215, 75, 0.4)';
        dot.classList.add('correct');
        playFeedback('correct');
        
        if(!stats.learned.includes(q.id)) stats.learned.push(q.id);
        stats.errors = stats.errors.filter(id => id !== q.id); 
    } else {
        btnEl.style.background = 'var(--error)';
        btnEl.style.color = '#fff';
        btnEl.style.borderColor = 'var(--error)';
        qCard.classList.add('shake');
        dot.classList.add('wrong');
        playFeedback('wrong');
        
        if(!stats.errors.includes(q.id)) stats.errors.push(q.id);
        // DIQQAT: Xato belgilanganda to'g'ri javob KO'RSATILMAYDI. Shunchaki qizaradi va o'tib ketadi.
    }
    
    localStorage.setItem('adham_pro_stats', JSON.stringify(stats));

    setTimeout(() => {
        if(currentIdx < currentTest.length - 1) {
            currentIdx++;
            loadQuestion();
        } else {
            showResult();
        }
    }, 1000); // 1 soniyadan so'ng avtomatik keyingi savolga o'tish
}

// ==========================================
// 6. NATIJALAR VA PSIXOLOGIYA
// ==========================================
function showResult() {
    clearInterval(timerInterval);
    let correctCount = currentTest.filter(q => q.userAns === true).length;
    let percent = Math.round((correctCount / currentTest.length) * 100);
    
    document.getElementById('result-percent').innerText = `${percent}%`;
    
    let msg = "";
    let color = "";
    
    if(percent >= 90) { 
        msg = "Zo'r! Siz imtihonga to'liq tayyorsiz. 🏆"; 
        color = "var(--success)"; 
    }
    else if(percent >= 70) { 
        msg = "Yaxshi natija, lekin biroz mashq qiling. 👍"; 
        color = "var(--primary)"; 
    }
    else if(percent >= 50) { 
        msg = "Ko'rdingizmi? Yana urinib ko'ring! 📚"; 
        color = "var(--warning)"; 
    }
    else { 
        msg = "Ko'proq mashq kerak! Xatolar ustida ishlang. ⚠️"; 
        color = "var(--error)"; 
    }

    document.getElementById('result-msg').innerText = msg;
    document.getElementById('result-donut').style.borderColor = color;
    document.getElementById('result-percent').style.color = color;

    document.getElementById('modal-result').style.display = 'flex';
}
