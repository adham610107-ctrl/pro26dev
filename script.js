let bank = []; 
let currentTest = []; 
let userAnswers = [];
let currentIndex = 0;
let timerInterval;
let timeRemaining = 900; // 15 daqiqa

// LocalStorage'dan ma'lumotlarni xavfsiz o'qish
let statistics = JSON.parse(localStorage.getItem('adhamStats')) || { learned: [], errors: [] };

// 1. Dastlabki yuklanish (JSON fayllarni ulaymiz)
window.onload = async () => {
    // Agar oldin Dark Mode tanlangan bo'lsa, uni yoqamiz
    if(localStorage.getItem('theme') === 'true') {
        document.getElementById('main-body').classList.add('dark-mode');
    }

    const files = ['musiqa_nazariyasi.json', 'cholgu_ijrochiligi.json', 'vokal_ijrochiligi.json', 'metodika_repertuar.json'];
    
    try {
        for(let f of files) {
            let res = await fetch(f);
            if (res.ok) {
                let data = await res.json();
                bank = bank.concat(data.map((q, i) => ({...q, id: f + '_' + i}))); // Noyob ID
            }
        }
    } catch (e) {
        console.error("Fayllarni yuklashda xatolik! Tizimni Localhost (Live Server) orqali oching.", e);
    }
    
    updateDashboardStats();
};

// 2. Navigatsiya
function enterDashboard() {
    document.getElementById('welcome-screen').classList.add('hidden');
    document.getElementById('dashboard-screen').classList.remove('hidden');
}

function toggleTheme() {
    const isDark = document.getElementById('main-body').classList.toggle('dark-mode');
    localStorage.setItem('theme', isDark);
}

// 3. Anti-Cheat (Aldashning oldini olish)
document.addEventListener("visibilitychange", () => {
    const isTestActive = !document.getElementById('test-screen').classList.contains('hidden');
    if (document.hidden && isTestActive) {
        alert("DIQQAT! Boshqa oynaga o'tish qat'iyan taqiqlanadi. Test jarayoni nazorat ostida!");
    }
});

// 4. Testni shakllantirish (Smart Random)
function startTest(subject) {
    let pool = [];

    if (subject === 'all') {
        pool = bank;
    } else if (subject === 'errors') {
        pool = bank.filter(q => statistics.errors.includes(q.id));
    } else {
        pool = bank.filter(q => q.id.includes(subject));
    }

    if (pool.length === 0) {
        alert("Bu bo'limda hozircha savollar yo'q yoki barcha xatolar to'g'rilangan!");
        return;
    }

    // O'rganilmagan savollarni ajratib olish
    let available = pool.filter(q => !statistics.learned.includes(q.id));
    
    // Agar o'rganilmaganlar 20 tadan kam bo'lsa, umumiy bazadan qo'shamiz
    if(available.length < 20) available = pool;

    // Savollarni aralashtirib, maksimal 20 tasini olish
    let selected = available.sort(() => 0.5 - Math.random()).slice(0, 20);
    
    // Variantlarni aralashtirish (javob to'g'ri joylashishi uchun mantiq)
    currentTest = selected.map(q => {
        let correctStr = q.options[q.answer]; // To'g'ri matnni eslab qolamiz
        let shuffled = [...q.options].sort(() => 0.5 - Math.random());
        return {...q, options: shuffled, answer: shuffled.indexOf(correctStr)};
    });

    setupExam();
}

function setupExam() {
    document.getElementById('dashboard-screen').classList.add('hidden');
    document.getElementById('test-screen').classList.remove('hidden');
    document.getElementById('exam-timer').classList.remove('hidden');
    
    userAnswers = new Array(currentTest.length).fill(null);
    currentIndex = 0;
    timeRemaining = 900;
    
    startTimer();
    renderQuestion();
}

// 5. Taymer tizimi
function startTimer() {
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        timeRemaining--;
        let m = Math.floor(timeRemaining / 60);
        let s = timeRemaining % 60;
        document.getElementById('exam-timer').innerText = `${m}:${s < 10 ? '0'+s : s}`;
        
        if(timeRemaining <= 0) {
            clearInterval(timerInterval);
            finishExam();
        }
    }, 1000);
}

// 6. Savolni ekranga chiqarish
function renderQuestion() {
    const q = currentTest[currentIndex];
    const box = document.getElementById('question-box');
    
    box.innerHTML = `
        <h2 style="margin-top:0; font-size: 20px; line-height: 1.4;">
            ${currentIndex + 1}. ${q.q}
        </h2>
        <div class="options-list">
            ${q.options.map((opt, i) => `
                <button class="option-btn ${getBtnClass(i)}" onclick="selectAnswer(${i})" ${userAnswers[currentIndex] ? 'disabled' : ''}>
                    ${String.fromCharCode(65 + i)}) ${opt}
                </button>
            `).join('')}
        </div>
    `;
    updateUI();
}

// 7. Javobni tanlash logikasi
function selectAnswer(idx) {
    if(userAnswers[currentIndex]) return; // Ikki marta bosishni oldini olamiz

    const correctIdx = currentTest[currentIndex].answer;
    const isCorrect = idx === correctIdx;
    const currentQId = currentTest[currentIndex].id;
    
    userAnswers[currentIndex] = { selected: idx, isCorrect };

    // Statistikani yangilash
    if(isCorrect) {
        if(!statistics.learned.includes(currentQId)) statistics.learned.push(currentQId);
        statistics.errors = statistics.errors.filter(id => id !== currentQId); // Xatolardan olib tashlash
    } else {
        if(!statistics.errors.includes(currentQId)) statistics.errors.push(currentQId); // Xatolarga qo'shish
    }
    
    localStorage.setItem('adhamStats', JSON.stringify(statistics));
    
    renderQuestion(); // Tanlangan variant ranglarini ko'rsatish
    
    // Keyingi savolga avtomatik o'tish
    setTimeout(() => move(1), 700);
}

// 8. Savollar bo'ylab harakatlanish
function move(step) {
    let next = currentIndex + step;
    if(next >= 0 && next < currentTest.length) {
        currentIndex = next;
        renderQuestion();
    }
}

// 9. UI va Xaritani yangilash
function updateUI() {
    let answeredCount = userAnswers.filter(a => a !== null).length;
    let progress = (answeredCount / currentTest.length) * 100;
    document.getElementById('progress-bar').style.width = `${progress}%`;
    
    const map = document.getElementById('map');
    map.innerHTML = currentTest.map((_, i) => {
        let cls = i === currentIndex ? 'current' : '';
        if(userAnswers[i]) {
            cls = userAnswers[i].isCorrect ? 'correct' : 'wrong';
        }
        return `<div class="dot ${cls}" onclick="jumpTo(${i})">${i + 1}</div>`;
    }).join('');

    document.getElementById('score-correct').innerText = userAnswers.filter(a => a?.isCorrect).length;
    document.getElementById('score-wrong').innerText = userAnswers.filter(a => a && !a.isCorrect).length;

    if(answeredCount === currentTest.length) {
        document.getElementById('finish-trigger').classList.remove('hidden');
    }
}

function jumpTo(i) {
    currentIndex = i;
    renderQuestion();
}

// 10. Tugmalarning joriy holatiga qarab CSS class berish
function getBtnClass(i) {
    if(!userAnswers[currentIndex]) return ''; // Hech narsa tanlanmagan
    
    const correctIdx = currentTest[currentIndex].answer;
    const selectedIdx = userAnswers[currentIndex].selected;

    if (i === correctIdx) return 'correct-ans'; // Har doim to'g'ri javobni yashil qilib ko'rsatamiz
    if (i === selectedIdx && !userAnswers[currentIndex].isCorrect) return 'wrong-ans'; // Agar xato tanlangan bo'lsa qizil
    
    return '';
}

// 11. Imtihonni yakunlash
function finishExam() {
    clearInterval(timerInterval);
    let correct = userAnswers.filter(a => a?.isCorrect).length;
    let total = currentTest.length;
    
    let percent = Math.round((correct / total) * 100);
    let msg = percent >= 80 ? "Tabriklaymiz, a'lo natija!" : "Yana tayyorlanishingiz kerak.";
    
    alert(`Imtihon yakunlandi!\n\nNatijangiz: ${correct}/${total} (${percent}%)\n${msg}`);
    location.reload(); // Dasturni boshlang'ich holatga qaytarish
}

// 12. Asosiy menudagi statistikalarni yangilash
function updateDashboardStats() {
    document.getElementById('total-learned').innerText = statistics.learned.length;
    document.getElementById('total-errors').innerText = statistics.errors.length;
    
    let errBtn = document.getElementById('error-work-btn');
    errBtn.innerHTML = `❌ Xatolar ustida ishlash (${statistics.errors.length})`;
    errBtn.disabled = statistics.errors.length === 0;
}
