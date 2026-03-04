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

const AUTHORIZED_EMAILS = [
    'hiagogmedeiros@gmail.com',
    'hiagomedeiros@gmail.com', // Adicionado backup por precaução
    'hiagomedeiros.dev@gmail.com'
];

// --- AUTH STATE PERSISTENCE ---
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);

console.log("Firebase Auth Initialized");

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

    let editingIndex = {
        schedule: -1,
        catalog: -1
    };

    // --- AUTENTICAÇÃO ---
    loginBtn.addEventListener('click', async () => {
        try {
            authError.classList.add('hidden');
            loginBtn.textContent = "Aguardando Google...";
            const provider = new firebase.auth.GoogleAuthProvider();
            await auth.signInWithPopup(provider);
        } catch (error) {
            console.error("Erro login:", error);
            authError.classList.remove('hidden');
            authError.textContent = error.message;
            loginBtn.textContent = "Entrar com Google";
        }
    });

    logoutBtn.addEventListener('click', () => {
        auth.signOut().then(() => window.location.reload());
    });

    auth.onAuthStateChanged(user => {
        if (user) {
            console.log("Firebase Auth: Usuário Logado ->", user.email);
            const userEmail = user.email.toLowerCase();
            const isAuthorized = AUTHORIZED_EMAILS.some(e => e.toLowerCase() === userEmail);

            if (isAuthorized) {
                console.log("Firebase Auth: Acesso Permitido!");
                loginOverlay.classList.add('hidden');
                adminContent.classList.remove('hidden');
                loadFromCloud();
            } else {
                console.warn("Firebase Auth: Acesso Negado para", user.email);
                authError.classList.remove('hidden');
                authError.textContent = "E-mail não autorizado: " + user.email;
                loginBtn.textContent = "Tentar outra conta";
            }
        } else {
            console.log("Firebase Auth: Nenhum usuário ativo.");
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

        // Ordenar: Primeiro os sem data (semanais) por horário, depois os com data por data e horário
        config.schedule.sort((a, b) => {
            const dateA = a.date || "";
            const dateB = b.date || "";
            if (dateA !== dateB) {
                return dateA.localeCompare(dateB);
            }
            return a.startTime.localeCompare(b.startTime);
        });

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

            const dateDisplay = prog.date ? `
                <span class="text-[10px] font-black px-3 py-1.5 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20 uppercase tracking-widest flex items-center gap-1">
                    <svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    DATA: ${formatDateWithDay(prog.date)}
                </span>` : `
                <span class="text-[10px] font-black px-3 py-1.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 uppercase tracking-widest">${activeDays}</span>`;

            card.innerHTML = `
                <div class="flex gap-8 items-center">
                    <!-- Bloco de Horário Ultra Premium -->
                    <div class="relative flex flex-col justify-center items-center w-28 h-28 rounded-[2rem] bg-indigo-500/5 group-hover:bg-indigo-500/10 transition-all border border-white/5 shrink-0 overflow-hidden">
                        <!-- Efeito de Brilho Interno Sugerido -->
                        <div class="absolute -top-10 -left-10 w-24 h-24 bg-indigo-500/10 blur-[40px] pointer-events-none"></div>
                        
                        <div class="relative z-10 flex flex-col items-center">
                            <span class="text-[9px] font-black text-indigo-400/40 uppercase tracking-[0.2em] mb-1">Início</span>
                            <div class="text-3xl font-black text-white font-mono italic leading-none">${prog.startTime}</div>
                            
                            <div class="mt-3 flex items-center gap-1.5 py-1.5 px-3 rounded-full bg-white/5 border border-white/5 shadow-lg">
                                <span class="text-[8px] font-black opacity-30 uppercase tracking-tighter">Fim</span>
                                <span class="text-[11px] font-bold text-indigo-300 font-mono">${endTimeStr}</span>
                            </div>
                        </div>
                    </div>

                    <div>
                        <h3 class="text-2xl font-black mb-1 uppercase italic tracking-tighter">${prog.title}</h3>
                        <p class="text-sm text-indigo-300 opacity-60 mb-2 italic line-clamp-1">${prog.description || 'Sem descrição'}</p>
                        <div class="flex gap-3 flex-wrap">
                             <span class="text-[10px] font-black px-3 py-1.5 rounded-full bg-white/5 border border-white/5 uppercase tracking-widest">${prog.duration} MIN</span>
                             ${dateDisplay}
                        </div>
                    </div>
                </div>
                <div class="flex gap-2">
                    <button data-index="${index}" class="btn-edit-schedule p-4 rounded-2xl hover:bg-indigo-500/10 text-indigo-400 opacity-0 group-hover:opacity-100 transition-all" title="Editar">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                    </button>
                    <button data-index="${index}" class="btn-remove-schedule p-4 rounded-2xl hover:bg-red-500/10 text-red-500 opacity-0 group-hover:opacity-100 transition-all" title="Remover">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                    </button>
                </div>
            `;
            scheduleContainer.appendChild(card);
        });

        // Add event listeners programmatically (Safe for CSP)
        document.querySelectorAll('.btn-remove-schedule').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                removeSchedule(btn.dataset.index);
            });
        });

        document.querySelectorAll('.btn-edit-schedule').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                editSchedule(btn.dataset.index);
            });
        });
    }

    function formatDateWithDay(dateStr) {
        if (!dateStr) return '';
        const date = new Date(dateStr + 'T12:00:00'); // T12:00:00 evita erros de fuso horário
        const days = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
        const dayName = days[date.getDay()];
        const [year, month, day] = dateStr.split('-');
        return `${day}/${month} (${dayName})`;
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
                    <div class="flex gap-2 absolute bottom-6 right-6">
                        <button data-index="${index}" class="btn-edit-catalog p-3 rounded-2xl bg-purple-500/10 text-purple-400 hover:bg-purple-500 hover:text-white transition-all" title="Editar">
                             <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                        </button>
                        <button data-index="${index}" class="btn-remove-catalog p-3 rounded-2xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all" title="Remover">
                             <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        </button>
                    </div>
                </div>
            `;
            catalogContainer.appendChild(card);
        });

        // Add event listeners (Safe for CSP)
        document.querySelectorAll('.btn-remove-catalog').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                removeCatalog(btn.dataset.index);
            });
        });

        document.querySelectorAll('.btn-edit-catalog').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                editCatalog(btn.dataset.index);
            });
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
        const specificDate = document.getElementById('prog-date').value;

        if (!specificDate && selectedDays.length === 0) {
            alert("Selecione os dias da semana ou defina uma data específica.");
            return;
        }

        const newProgram = {
            title: document.getElementById('prog-title').value,
            description: document.getElementById('prog-desc').value,
            url: document.getElementById('prog-url').value,
            startTime: document.getElementById('prog-start').value,
            duration: parseInt(document.getElementById('prog-duration').value),
            days: specificDate ? [] : selectedDays,
            date: specificDate || null
        };

        if (editingIndex.schedule >= 0) {
            config.schedule[editingIndex.schedule] = newProgram;
            editingIndex.schedule = -1;
            document.getElementById('btn-submit-program').textContent = 'Adicionar à Grade';
            document.getElementById('btn-cancel-edit-program').classList.add('hidden');
        } else {
            config.schedule.push(newProgram);
        }

        renderSchedule();
        programForm.reset();
    });

    catalogForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const newItem = {
            title: document.getElementById('cat-title').value,
            type: document.getElementById('cat-type').value,
            banner: document.getElementById('cat-banner').value,
            description: document.getElementById('cat-desc').value
        };

        if (editingIndex.catalog >= 0) {
            config.catalog[editingIndex.catalog] = newItem;
            editingIndex.catalog = -1;
            document.getElementById('btn-submit-catalog').textContent = 'Adicionar Destaque';
            document.getElementById('btn-cancel-edit-catalog').classList.add('hidden');
        } else {
            config.catalog.push(newItem);
        }

        renderCatalog();
        catalogForm.reset();
    });

    // --- FORM ACTIONS ---
    window.editSchedule = (index) => {
        const prog = config.schedule[index];
        editingIndex.schedule = parseInt(index);

        document.getElementById('prog-title').value = prog.title;
        document.getElementById('prog-desc').value = prog.description;
        document.getElementById('prog-url').value = prog.url;
        document.getElementById('prog-start').value = prog.startTime;
        document.getElementById('prog-duration').value = prog.duration;
        document.getElementById('prog-date').value = prog.date || '';

        // Checkboxes
        document.querySelectorAll('input[name="prog-days"]').forEach(cb => {
            cb.checked = prog.days.includes(parseInt(cb.value));
        });

        document.getElementById('btn-submit-program').textContent = 'Atualizar Programa';
        document.getElementById('btn-cancel-edit-program').classList.remove('hidden');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    window.editCatalog = (index) => {
        const item = config.catalog[index];
        editingIndex.catalog = parseInt(index);

        document.getElementById('cat-title').value = item.title;
        document.getElementById('cat-type').value = item.type;
        document.getElementById('cat-banner').value = item.banner;
        document.getElementById('cat-desc').value = item.description;

        document.getElementById('btn-submit-catalog').textContent = 'Atualizar Destaque';
        document.getElementById('btn-cancel-edit-catalog').classList.remove('hidden');
        window.scrollTo({ top: tabCatalog.offsetTop, behavior: 'smooth' });
    };

    document.getElementById('btn-cancel-edit-program').addEventListener('click', () => {
        editingIndex.schedule = -1;
        programForm.reset();
        document.getElementById('btn-submit-program').textContent = 'Adicionar à Grade';
        document.getElementById('btn-cancel-edit-program').classList.add('hidden');
    });

    document.getElementById('btn-cancel-edit-catalog').addEventListener('click', () => {
        editingIndex.catalog = -1;
        catalogForm.reset();
        document.getElementById('btn-submit-catalog').textContent = 'Adicionar Destaque';
        document.getElementById('btn-cancel-edit-catalog').classList.add('hidden');
    });

    // Listener para mostrar o dia da semana no formulário
    document.getElementById('prog-date').addEventListener('input', (e) => {
        const dateVal = e.target.value;
        const hint = e.target.nextElementSibling;
        if (dateVal) {
            const date = new Date(dateVal + 'T12:00:00');
            const days = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
            hint.textContent = `Isso cai em uma ${days[date.getDay()]}.`;
            hint.classList.remove('opacity-30');
            hint.classList.add('text-indigo-400', 'font-bold');
        } else {
            hint.textContent = `Se definir uma data, os dias da semana abaixo serão ignorados para este programa.`;
            hint.classList.remove('text-indigo-400', 'font-bold');
            hint.classList.add('opacity-30');
        }
    });
});
