let bank = [];
let currentTest = [];
let userAnswers = [];
let currentIndex = 0;
let errorsList = JSON.parse(localStorage.getItem('adham_errors')) || [];
let masteredList = JSON.parse(localStorage.getItem('adham_mastered')) || [];
let timerInterval;

// Spinner Animation
function updateSpinner(num) {
    const el = document.getElementById('spin-number');
    el.classList.add('spinning');
    setTimeout(() => {
        el.innerText = num;
        el.classList.remove('spinning');
    }, 200);
}

// 1. Data Loading & Cleaning
async function loadData() {
    const files = ['musiqa_nazariyasi.json', 'cholgu_ijrochiligi.json', 'vokal_ijrochiligi.json', 'metodika_repertuar.json'];
    bank = [];
    for (const f of files) {
        try {
            const res = await fetch(f);
            const data = await res.json();
            data.forEach(q => {
                let options = q.options.filter(o => o.trim() !== "");
                if (options.length === 3) {
                    options.push("Barcha javoblar to'g'ri");
                }
                bank.push({ ...q, options, subject: f.split('.')[0] });
            });
        } catch (e) { console.error("Fayl yuklanmadi:", f); }
    }
    updateDashboardStats();
}

// 2. Setup & Levels
function openSetup(subject) {
    pendingSubject = subject;
    const lvlGrid = document.getElementById('level-selection');
    lvlGrid.innerHTML = '';
    
    if (subject !== 'mix_1_800') {
        for (let i = 1; i <= 10; i++) {
            lvlGrid.innerHTML += `<button class="lvl-btn" onclick="selectLevel(${i})">LVL ${i}</button>`;
        }
    }
    switchScreen('dashboard-screen', 'setup-screen');
}

// 3. Exam Mode (8-Tugma)
function startExam60() {
    isExamMode = true;
    currentTest = shuffleArray([...bank]).slice(0, 60);
    startTestProcess(1200); // 20 daqiqa
}

function startTestProcess(seconds) {
    userAnswers = new Array(currentTest.length).fill(null);
    currentIndex = 0;
    renderMap();
    updateFocus();
    startTimer(seconds);
    switchScreen('dashboard-screen', 'test-screen');
    document.getElementById('exit-test-btn').classList.remove('hidden');
    document.getElementById('global-nav').classList.remove('hidden');
}

function updateFocus() {
    const qArea = document.getElementById('question-area');
    const q = currentTest[currentIndex];
    updateSpinner(currentIndex + 1);

    let optionsHTML = q.options.map((opt, i) => `
        <button class="opt-btn ${userAnswers[currentIndex]?.idx === i ? 'selected' : ''}" 
                onclick="selectOption(${i})">${String.fromCharCode(65 + i)}) ${opt}</button>
    `).join('');

    qArea.innerHTML = `
        <div class="q-card">
            <h3 class="q-text">${q.q}</h3>
            <div class="options-grid">${optionsHTML}</div>
        </div>
    `;
    updateMap();
}

function selectOption(idx) {
    const q = currentTest[currentIndex];
    const isCorrect = idx === q.answer;
    userAnswers[currentIndex] = { idx, isCorrect };
    
    // Statistika saqlash
    if (isCorrect) {
        if (!masteredList.includes(q.q)) masteredList.push(q.q);
        errorsList = errorsList.filter(item => item.q !== q.q);
    } else {
        if (!errorsList.find(e => e.q === q.q)) errorsList.push(q);
    }
    
    localStorage.setItem('adham_mastered', JSON.stringify(masteredList));
    localStorage.setItem('adham_errors', JSON.stringify(errorsList));
    
    setTimeout(() => move(1), 300);
}

// 4. Result logic with Psychology
function finishTest() {
    clearInterval(timerInterval);
    const correctCount = userAnswers.filter(a => a?.isCorrect).length;
    const percent = Math.round((correctCount / currentTest.length) * 100);
    
    const msg = document.getElementById('result-message');
    const desc = document.getElementById('result-desc');
    
    if (percent === 100) {
        msg.innerText = "BARAKALLA! MUKAMMAL!";
        desc.innerText = "Siz imtihonga tayyorsiz. Bu g'alaba sizniki!";
        confetti({ particleCount: 150, spread: 70 });
    } else if (percent > 70) {
        msg.innerText = "Yaxshi natija!";
        desc.innerText = "Yana ozgina harakat qilsangiz, cho'qqini zabt etasiz.";
    } else {
        msg.innerText = "Yana urinib ko'ring!";
        desc.innerText = "Ko'rdingizmi, sizda hali o'rganish kerak bo'lgan joylar bor. Bo'shashmang!";
    }
    
    document.getElementById('result-modal').classList.remove('hidden');
}

function exitToHome() {
    clearInterval(timerInterval);
    location.reload(); // Toza qaytish uchun
}

loadData();
