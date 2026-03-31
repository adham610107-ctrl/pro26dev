/* ============================================================
   JS: ADHAM'S PRO EXAM v7.0 - CORE ENGINE
   ============================================================ */

const app = {
    // Ma'lumotlar ombori
    db: {
        musiqa_nazariyasi: [],
        cholgu_ijrochiligi: [],
        vokal_ijrochiligi: [],
        metodika_repertuar: []
    },
    currentTest: [],
    currentIndex: 0,
    correctCount: 0,
    errorCount: 0,
    timer: null,

    async init() {
        // Anti-Cheat: O'ng tugma va nusxalashni bloklash
        document.addEventListener('contextmenu', e => e.preventDefault());
        document.addEventListener('keydown', e => {
            if (e.ctrlKey && (e.key === 'c' || e.key === 'u' || e.key === 'i')) e.preventDefault();
        });

        // Ma'lumotlarni yuklash
        const files = Object.keys(this.db);
        for (const file of files) {
            try {
                const response = await fetch(`${file}.json`);
                const data = await response.json();
                
                // Bonus Logic: 3 ta variant bo'lsa 4-sini qo'shish va aralashtirish
                this.db[file] = data.map(item => {
                    let opts = [...item.options];
                    if (opts.length === 3) opts.push("Barcha javoblar to'g'ri");
                    
                    const correctText = item.options[item.answer];
                    opts = opts.sort(() => Math.random() - 0.5); // Variantlarni aralashtirish
                    
                    return {
                        ...item,
                        options: opts,
                        answer: opts.indexOf(correctText)
                    };
                });
            } catch (err) {
                console.error(`${file} yuklanmadi!`, err);
            }
        }
    },

    showScreen(id) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.getElementById(`scr-${id}`).classList.add('active');
    },

    // 200 tadan 20 tani random tanlash (Har gal har xil)
    startSubject(key) {
        const pool = [...this.db[key]].sort(() => Math.random() - 0.5).slice(0, 20);
        this.setupTest(pool, 15); // 15 minut
    },

    // Imtihon Mode: Har bir fandan 15 tadan (Jami 60 ta)
    startExam() {
        let pool = [];
        Object.keys(this.db).forEach(k => {
            const subPool = [...this.db[k]].sort(() => Math.random() - 0.5).slice(0, 15);
            pool.push(...subPool);
        });
        this.setupTest(pool.sort(() => Math.random() - 0.5), 60); // 60 minut
    },

    setupTest(questions, minutes) {
        this.currentTest = questions;
        this.currentIndex = 0;
        this.correctCount = 0;
        this.errorCount = 0;
        
        this.buildIndicators();
        this.renderQuestion();
        this.startTimer(minutes);
        this.showScreen('test');
    },

    buildIndicators() {
        const container = document.getElementById('ind-box');
        container.innerHTML = '';
        this.currentTest.forEach((_, i) => {
            const dot = document.createElement('div');
            dot.className = 'dot';
            dot.id = `dot-${i}`;
            dot.innerText = i + 1;
            container.appendChild(dot);
        });
    },

    renderQuestion() {
        const q = this.currentTest[this.currentIndex];
        const qCard = document.querySelector('.q-card');
        qCard.classList.remove('shake'); // Shake reset

        // Question Spin Effect
        const spinNum = document.getElementById('q-num-spin');
        let counter = 0;
        const interval = setInterval(() => {
            spinNum.innerText = Math.floor(Math.random() * 99);
            if (++counter > 8) {
                clearInterval(interval);
                spinNum.innerText = this.currentIndex + 1;
            }
        }, 40);

        document.getElementById('q-txt').innerText = q.q;
        const optBox = document.getElementById('opt-box');
        optBox.innerHTML = '';
        optBox.dataset.locked = "false";

        q.options.forEach((opt, i) => {
            const div = document.createElement('div');
            div.className = 'opt glass';
            div.innerHTML = `
                <div style="width:28px;height:28px;border-radius:50%;background:rgba(255,255,255,0.1);display:flex;align-items:center;justify-content:center;font-size:0.75rem;font-weight:800;border:1px solid rgba(255,255,255,0.2)">${String.fromCharCode(65+i)}</div>
                <span>${opt}</span>
            `;
            div.onclick = () => this.checkAnswer(i, div);
            optBox.appendChild(div);
        });

        // Update indicators
        document.querySelectorAll('.dot').forEach(d => d.classList.remove('active'));
        const activeDot = document.getElementById(`dot-${this.currentIndex}`);
        activeDot.classList.add('active');
        activeDot.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    },

    checkAnswer(idx, el) {
        const box = document.getElementById('opt-box');
        if (box.dataset.locked === "true") return;
        box.dataset.locked = "true";

        const q = this.currentTest[this.currentIndex];
        const dot = document.getElementById(`dot-${this.currentIndex}`);
        const qCard = document.querySelector('.q-card');

        if (idx === q.answer) {
            el.classList.add('selected-correct');
            dot.classList.add('correct');
            this.correctCount++;
            if (navigator.vibrate) navigator.vibrate(50);
        } else {
            el.classList.add('selected-wrong');
            dot.classList.add('wrong');
            qCard.classList.add('shake'); // Xato bo'lsa titrash
            this.errorCount++;
            // To'g'ri javobni ham ko'rsatish
            box.children[q.answer].classList.add('selected-correct');
            if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
        }

        // 1 soniyadan keyin keyingi savolga o'tish
        setTimeout(() => {
            if (++this.currentIndex < this.currentTest.length) {
                this.renderQuestion();
            } else {
                this.finishTest();
            }
        }, 1000);
    },

    startTimer(m) {
        clearInterval(this.timer);
        let time = m * 60;
        const display = document.getElementById('timer');
        this.timer = setInterval(() => {
            let mins = Math.floor(time / 60);
            let secs = time % 60;
            display.innerText = `${mins}:${secs < 10 ? '0' + secs : secs}`;
            if (--time < 0) {
                clearInterval(this.timer);
                this.finishTest();
            }
        }, 1000);
    },

    finishTest() {
        clearInterval(this.timer);
        const percent = Math.round((this.correctCount / this.currentTest.length) * 100);
        
        document.getElementById('res-pct').innerText = percent + "%";
        document.getElementById('res-cnt').innerText = `${this.correctCount} / ${this.currentTest.length}`;
        
        let msg = "";
        if (percent >= 90) msg = "Daxshat! Siz haqiqiy profisiz! 🔥";
        else if (percent >= 70) msg = "Barakalla! Natijangiz juda yaxshi 👍";
        else msg = "Ko'rdingizmi, siz hali yana mashq qilishingiz kerak 📚";
        
        document.getElementById('res-msg').innerText = msg;
        
        // Modalni ko'rsatish (Bu qismni keyingi HTML yuborganimda IDlar bilan moslaymiz)
        this.showResultModal();
    },

    showResultModal() {
        // Result ekranini chiqarish
        const modal = document.getElementById('scr-result') || document.getElementById('modal-res');
        if(modal) {
             modal.style.display = 'flex';
             modal.classList.add('active');
        }
    },

    exit() {
        if (confirm("Testni to'xtatib, chiqib ketishni xohlaysizmi?")) {
            location.reload();
        }
    }
};

// Start initialization
app.init();
