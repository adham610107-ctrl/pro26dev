let allQuestions = [];
let currentPool = [];
let currentIndex = 0;
let userAnswers = [];
let timerInterval;
let currentSubject = "";

// 1. Ma'lumotlarni yuklash va 3-variantli testlarni to'g'irlash
async function loadAllData() {
    const files = ['musiqa_nazariyasi.json', 'cholgu_ijrochiligi.json', 'vokal_ijrochiligi.json', 'metodika_repertuar.json'];
    for (let file of files) {
        let res = await fetch(file);
        let data = await res.json();
        let subName = file.split('.')[0];
        
        data.forEach((item, index) => {
            let options = [...item.options].filter(o => o !== null);
            let correctText = item.options[item.answer];

            // Bonus: 3 variantli bo'lsa 4-chi variantni qo'shish
            if (options.length === 3) {
                options.push("Barcha javoblar to'g'ri");
            }
            
            // Duplicate variantlarni tozalash (A B C D bir xil bo'lmasligi uchun)
            options = [...new Set(options)];

            allQuestions.push({
                id: `${subName}-${index}`,
                subject: subName,
                question: item.q,
                options: options,
                answerText: correctText
            });
        });
    }
}

window.onload = loadAllData;

// 2. Start App & Stats
function startApp() {
    const name = document.getElementById('user-name').value.trim();
    if (!name) return alert("Iltimos, ismingizni kiriting!");
    document.getElementById('welcome-user').innerText = name;
    updateStats();
    switchScreen('welcome-screen', 'main-dashboard');
}

function updateStats() {
    let stats = JSON.parse(localStorage.getItem('music_stats')) || { learned: [], errors: [] };
    document.getElementById('learned-stat').innerText = stats.learned.length;
    document.getElementById('error-stat').innerText = stats.errors.length;
    
    // Xatolar tugmasini faolligi
    document.getElementById('fix-errors-btn').style.opacity = stats.errors.length > 0 ? "1" : "0.5";
}

// 3. Level Logic (10 Lvl)
function openSubject(sub) {
    currentSubject = sub;
    const list = document.getElementById('levels-list');
    list.innerHTML = "";
    let subPool = allQuestions.filter(q => q.subject === sub);
    
    for (let i = 0; i < 10; i++) {
        let btn = document.createElement('button');
        btn.className = "lvl-btn";
        btn.innerHTML = `Lvl ${i+1} <br> <small>${i*20+1}-${(i+1)*20}</small>`;
        btn.onclick = () => initTest(subPool.slice(i*20, (i+1)*20), false);
        list.appendChild(btn);
    }
    document.getElementById('level-modal').classList.remove('hidden');
}

// 4. Imtihon Rejimi (8-tugma - 60 ta savol)
function startExam60() {
    let examPool = shuffle([...allQuestions]).slice(0, 60);
    initTest(examPool, true);
    document.getElementById('exam-timer').classList.remove('hidden');
    startTimer(3600); // 1 soat
}

function initTest(questions, isRandom) {
    closeModal();
    currentPool = questions.map(q => {
        let shuffledOpts = shuffle([...q.options]);
        return { ...q, options: shuffledOpts, correctIndex: shuffledOpts.indexOf(q.answerText) };
    });
    
    currentIndex = 0;
    userAnswers = new Array(currentPool.length).fill(null);
    renderTest();
    switchScreen('main-dashboard', 'test-screen');
}

function renderTest() {
    const q = currentPool[currentIndex];
    const numEl = document.getElementById('q-number');
    numEl.innerText = currentIndex + 1;
    numEl.style.animation = 'none';
    numEl.offsetHeight; // Reflow
    numEl.style.animation = null;

    document.getElementById('q-text').innerText = q.question;
    const box = document.getElementById('options-box');
    box.innerHTML = "";

    q.options.forEach((opt, idx) => {
        let btn = document.createElement('button');
        btn.className = "opt-btn";
        btn.innerText = opt;
        btn.onclick = () => selectOption(idx);
        if (userAnswers[currentIndex] !== null) {
            btn.disabled = true;
            if (idx === q.correctIndex) btn.classList.add('correct');
            else if (idx === userAnswers[currentIndex]) btn.classList.add('wrong');
        }
        box.appendChild(btn);
    });

    renderIndicator();
    updateProgress();
}

function renderIndicator() {
    const track = document.getElementById('indicator-track');
    track.innerHTML = currentPool.map((_, i) => {
        let status = "";
        if (userAnswers[i] === true) status = "correct";
        else if (userAnswers[i] !== null) status = "wrong";
        let active = i === currentIndex ? "active" : "";
        return `<div class="dot ${status} ${active}" onclick="goToQ(${i})">${i+1}</div>`;
    }).join('');

    // Auto-scroll logic (Sizning rasmdagi muammo yechimi)
    const activeDot = track.children[currentIndex];
    activeDot.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
}

function selectOption(idx) {
    if (userAnswers[currentIndex] !== null) return;
    
    let isCorrect = idx === currentPool[currentIndex].correctIndex;
    userAnswers[currentIndex] = isCorrect ? true : idx;

    // Statistikani yangilash
    let stats = JSON.parse(localStorage.getItem('music_stats')) || { learned: [], errors: [] };
    let qId = currentPool[currentIndex].id;

    if (isCorrect) {
        if (!stats.learned.includes(qId)) stats.learned.push(qId);
        stats.errors = stats.errors.filter(id => id !== qId);
    } else {
        if (!stats.errors.includes(qId)) stats.errors.push(qId);
    }
    
    localStorage.setItem('music_stats', JSON.stringify(stats));
    updateStats();
    renderTest();

    setTimeout(() => {
        if (currentIndex < currentPool.length - 1) nextQ();
        else showFinalResult();
    }, 800);
}

function showFinalResult() {
    const correct = userAnswers.filter(a => a === true).length;
    const perc = Math.round((correct / currentPool.length) * 100);
    
    document.getElementById('final-res-text').innerText = perc + "%";
    document.getElementById('result-stroke').style.strokeDasharray = `${perc}, 100`;
    
    // Motivatsiya (Psixologik integratsiya)
    const title = document.getElementById('res-title');
    const desc = document.getElementById('res-motivation');
    
    if (perc >= 90) {
        title.innerText = "G'alaba!";
        desc.innerText = "Siz imtihonga 100% tayyorsiz! Bu shunchaki dahshat natija! 🔥";
    } else if (perc >= 60) {
        title.innerText = "Yaxshi natija!";
        desc.innerText = "Sizda poydevor bor, lekin yana bir oz mashq qilsangiz, cho'qqini zabt etasiz! 💪";
    } else {
        title.innerText = "To'xtab qolmang!";
        desc.innerText = "Ko'rdingizmi, hali o'rganishimiz kerak bo'lgan narsalar bor. Qayta urinib ko'ring! ✨";
    }

    document.getElementById('result-screen').classList.remove('hidden');
}

// Yordamchilar
function shuffle(array) { return array.sort(() => Math.random() - 0.5); }
function switchScreen(from, to) {
    document.getElementById(from).classList.add('hidden');
    document.getElementById(to).classList.remove('hidden');
}
function backOneStep() { 
    if (confirm("Testni yakunlaysizmi?")) exitToHome();
}
function exitToHome() { location.reload(); }
function toggleEyeComfort() { document.body.classList.toggle('eye-comfort'); }
function nextQ() { if (currentIndex < currentPool.length - 1) { currentIndex++; renderTest(); } }
function prevQ() { if (currentIndex > 0) { currentIndex--; renderTest(); } }
function goToQ(i) { currentIndex = i; renderTest(); }
function closeModal() { document.getElementById('level-modal').classList.add('hidden'); }
