// --- CONFIGURAÇÃO FIREBASE ---
const firebaseConfig = {
    apiKey: "AIzaSyANGqSlR63OXVYldxTmstZGy2ZhzJPBbA4",
    authDomain: "bhaskaratv-5a90d.firebaseapp.com",
    projectId: "bhaskaratv-5a90d",
    storageBucket: "bhaskaratv-5a90d.firebasestorage.app",
    messagingSenderId: "82790875511",
    appId: "1:82790875511:web:c597077bd18257e7d1a172"
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// --- SEGURANÇA: EMAILS AUTORIZADOS ---
// ADICIONE SEU EMAIL AQUI PARA TER ACESSO
const AUTHORIZED_EMAILS = [
    'hiagogmedeiros@gmail.com', // Seu e-mail autorizado
    // adicione mais e-mails se necessário
];

document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
    const loginOverlay = document.getElementById('login-overlay');
    const adminContent = document.getElementById('admin-content');
    const loginBtn = document.getElementById('login-google-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const authError = document.getElementById('auth-error');

    // Tabs & Forms
    const tabSchedule = document.getElementById('tab-schedule');
    const tabCatalog = document.getElementById('tab-catalog');
    const sectionSchedule = document.getElementById('section-schedule');
    const sectionCatalog = document.getElementById('section-catalog');
    const programForm = document.getElementById('program-form');
    const catalogForm = document.getElementById('catalog-form');
    const scheduleContainer = document.getElementById('schedule-container');
    const catalogContainer = document.getElementById('catalog-container');
    const saveBtn = document.getElementById('save-btn');
    const btnFetchDuration = document.getElementById('btn-fetch-duration');
    const metaFetcher = document.getElementById('meta-fetcher');
    const progDurationInput = document.getElementById('prog-duration');
    const progUrlInput = document.getElementById('prog-url');

    let config = {
        schedule: [],
        catalog: []
    };

    // --- AUTENTICAÇÃO ---
    // Persistir sessão localmente
    auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);

    loginBtn.addEventListener('click', () => {
        const provider = new firebase.auth.GoogleAuthProvider();
        auth.signInWithRedirect(provider);
    });

    logoutBtn.addEventListener('click', () => {
        auth.signOut().then(() => window.location.reload());
    });

    // Capturar Resultado do Redirect (ajuda no debug)
    auth.getRedirectResult().then(result => {
        if (result.user) console.log("Redirecionamento concluído com sucesso.");
    }).catch(error => {
        console.error("Erro no Redirect:", error);
        authError.textContent = "Erro de Autenticação: " + error.message;
        authError.classList.remove('hidden');
    });

    auth.onAuthStateChanged(user => {
        if (user) {
            console.log("Usuário logado:", user.email);
            const isAuthorized = AUTHORIZED_EMAILS.some(e => e.toLowerCase() === user.email.toLowerCase());

            if (isAuthorized) {
                console.log("Acesso Autorizado!");
                loginOverlay.classList.add('hidden');
                adminContent.classList.remove('hidden');
                loadFromCloud();
            } else {
                console.warn("Acesso Negado para:", user.email);
                authError.textContent = `Acesso negado para: ${user.email}. (ID: ${user.uid})`;
                authError.classList.remove('hidden');
                setTimeout(() => auth.signOut(), 3000);
            }
        } else {
            console.log("Sessão encerrada ou usuário deslogado.");
            loginOverlay.classList.remove('hidden');
            adminContent.classList.add('hidden');
        }
    });

    // --- FETCH DURATION LOGIC ---
    btnFetchDuration.addEventListener('click', () => {
        const url = progUrlInput.value.trim();
        if (!url) { alert("Insira uma URL primeiro."); return; }

        btnFetchDuration.textContent = 'Verificando...';
        btnFetchDuration.disabled = true;

        metaFetcher.src = url;
        metaFetcher.onloadedmetadata = function () {
            const minutes = Math.ceil(metaFetcher.duration / 60);
            progDurationInput.value = minutes;
            btnFetchDuration.textContent = 'Verificar Duração';
            btnFetchDuration.disabled = false;
        };
        metaFetcher.onerror = function () {
            alert("Não foi possível ler a duração deste vídeo. Verifique se o link é direto (MP4/TS).");
            btnFetchDuration.textContent = 'Verificar Duração';
            btnFetchDuration.disabled = false;
        };
    });

    // --- LÓGICA DE TABS ---
    tabSchedule.addEventListener('click', () => {
        tabSchedule.classList.add('border-indigo-500');
        tabSchedule.classList.remove('opacity-40');
        tabCatalog.classList.remove('border-indigo-500');
        tabCatalog.classList.add('opacity-40');
        sectionSchedule.classList.remove('hidden');
        sectionCatalog.classList.add('hidden');
    });

    tabCatalog.addEventListener('click', () => {
        tabCatalog.classList.add('border-indigo-500');
        tabCatalog.classList.remove('opacity-40');
        tabSchedule.classList.remove('border-indigo-500');
        tabSchedule.classList.add('opacity-40');
        sectionCatalog.classList.remove('hidden');
        sectionSchedule.classList.add('hidden');
    });

    // --- FIRESTORE ACTIONS ---
    async function loadFromCloud() {
        try {
            const doc = await db.collection('config').doc('main').get();
            if (doc.exists) {
                config = doc.data();
                renderAll();
            } else {
                // Primeira execução: Criar documento vazio
                await db.collection('config').doc('main').set({ schedule: [], catalog: [] });
                renderAll();
            }
        } catch (error) {
            console.error("Erro ao carregar nuvem:", error);
        }
    }

    async function saveToCloud() {
        saveBtn.textContent = 'Sincronizando...';
        saveBtn.disabled = true;
        try {
            await db.collection('config').doc('main').set(config);
            alert("Sincronizado com Sucesso na Nuvem! ✅");
        } catch (error) {
            alert("Erro ao salvar na nuvem: " + error.message);
        } finally {
            saveBtn.textContent = 'Salvar Nuvem';
            saveBtn.disabled = false;
        }
    }

    saveBtn.addEventListener('click', saveToCloud);

    function renderAll() {
        renderSchedule();
        renderCatalog();
    }

    function renderSchedule() {
        scheduleContainer.innerHTML = '';
        if (config.schedule.length === 0) {
            scheduleContainer.innerHTML = '<div class="p-20 glass rounded-[2.5rem] text-center opacity-20 font-bold uppercase tracking-widest">Grade Sem Programas</div>';
            return;
        }

        config.schedule.sort((a, b) => a.startTime.localeCompare(b.startTime));

        config.schedule.forEach((prog, index) => {
            const [h, m] = prog.startTime.split(':').map(Number);
            const startDate = new Date();
            startDate.setHours(h, m, 0);
            const endDate = new Date(startDate.getTime() + prog.duration * 60000);
            const endTimeStr = endDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

            const card = document.createElement('div');
            card.className = 'glass p-8 rounded-[2rem] flex justify-between items-center group hover:border-indigo-500/30 transition-all';

            const daysShort = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB'];
            const activeDays = prog.days.map(d => daysShort[d]).join(', ');

            card.innerHTML = `
                <div class="flex gap-8 items-center">
                    <div class="text-3xl font-black text-indigo-500 bg-indigo-500/10 w-24 h-24 rounded-[1.5rem] flex flex-col items-center justify-center font-mono italic">
                        <span class="text-[10px] opacity-40 not-italic uppercase tracking-widest mb-1">FIM ${endTimeStr}</span>
                        ${prog.startTime}
                    </div>
                    <div>
                        <h3 class="text-2xl font-black mb-1 uppercase italic tracking-tighter">${prog.title}</h3>
                        <p class="text-sm text-indigo-300 opacity-60 mb-2 italic">${prog.description || 'Sem descrição'}</p>
                        <div class="flex gap-3">
                             <span class="text-[10px] font-black px-3 py-1.5 rounded-full bg-white/5 border border-white/5 uppercase tracking-widest">${prog.duration} MIN</span>
                             <span class="text-[10px] font-black px-3 py-1.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 uppercase tracking-widest">${activeDays}</span>
                        </div>
                    </div>
                </div>
                <button onclick="removeSchedule(${index})" class="p-6 rounded-3xl hover:bg-red-500/10 text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                </button>
            `;
            scheduleContainer.appendChild(card);
        });
    }

    function renderCatalog() {
        catalogContainer.innerHTML = '';
        if (config.catalog.length === 0) {
            catalogContainer.innerHTML = '<div class="col-span-full p-20 glass rounded-[2.5rem] text-center opacity-20 font-bold uppercase tracking-widest">Catálogo Vazio</div>';
            return;
        }

        config.catalog.forEach((item, index) => {
            const card = document.createElement('div');
            card.className = 'glass rounded-[2rem] overflow-hidden group hover:border-purple-500/30 transition-all';
            card.innerHTML = `
                <div class="h-40 bg-cover bg-center" style="background-image: url('${item.banner}')"></div>
                <div class="p-6 relative">
                    <div class="flex justify-between items-start mb-2">
                        <h4 class="font-black text-xl italic uppercase tracking-tighter">${item.title}</h4>
                        <span class="text-[10px] px-3 py-1 rounded-full bg-purple-500/20 text-purple-400 font-black uppercase tracking-widest">${item.type}</span>
                    </div>
                    <p class="text-sm opacity-50 line-clamp-2 mb-6 leading-relaxed">${item.description}</p>
                    <button onclick="removeCatalog(${index})" class="absolute bottom-6 right-6 p-3 rounded-2xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all">
                         <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                    </button>
                </div>
            `;
            catalogContainer.appendChild(card);
        });
    }

    window.removeSchedule = (index) => {
        if (confirm("Remover programa da grade?")) {
            config.schedule.splice(index, 1);
            renderSchedule();
        }
    };

    window.removeCatalog = (index) => {
        if (confirm("Remover show do catálogo?")) {
            config.catalog.splice(index, 1);
            renderCatalog();
        }
    };

    programForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const selectedDays = Array.from(document.querySelectorAll('input[name="prog-days"]:checked')).map(cb => parseInt(cb.value));
        if (selectedDays.length === 0) { alert("Selecione os dias da semana."); return; }

        config.schedule.push({
            title: document.getElementById('prog-title').value,
            description: document.getElementById('prog-desc').value,
            url: document.getElementById('prog-url').value,
            startTime: document.getElementById('prog-start').value,
            duration: parseInt(document.getElementById('prog-duration').value),
            days: selectedDays
        });
        renderSchedule();
        programForm.reset();
    });

    catalogForm.addEventListener('submit', (e) => {
        e.preventDefault();
        config.catalog.push({
            title: document.getElementById('cat-title').value,
            type: document.getElementById('cat-type').value,
            banner: document.getElementById('cat-banner').value,
            description: document.getElementById('cat-desc').value
        });
        renderCatalog();
        catalogForm.reset();
    });
});
