document.addEventListener('DOMContentLoaded', () => {
    const videoPlayer = document.getElementById('tv-player');
    const playerContainer = document.getElementById('player-container');
    const fallbackScreen = document.getElementById('fallback-screen');
    const unmuteOverlay = document.getElementById('unmute-overlay');
    const toggleMuteBtn = document.getElementById('toggle-mute');
    const toggleFullscreenBtn = document.getElementById('toggle-fullscreen');
    const muteIcon = document.getElementById('mute-icon');
    const currentTitle = document.getElementById('current-title');
    const controlTitle = document.getElementById('control-title');
    const controlTime = document.getElementById('control-time');
    const scheduleList = document.getElementById('schedule-list');
    const clockElement = document.getElementById('clock');
    const currentDayElement = document.getElementById('current-day');
    const playerOverlayName = document.getElementById('current-program-display');
    const volumeSlider = document.getElementById('volume-slider');
    const nextToast = document.getElementById('next-toast');
    const nextTitle = document.getElementById('next-title');
    const ambientLight = document.getElementById('ambient-light');
    const catalogModal = document.getElementById('catalog-modal');
    const openCatalogBtn = document.getElementById('open-catalog');
    const closeCatalogBtn = document.getElementById('close-catalog');
    const fullScheduleModal = document.getElementById('full-schedule-modal');
    const openFullScheduleBtn = document.getElementById('open-full-schedule');
    const closeFullScheduleBtn = document.getElementById('close-full-schedule');
    const fullScheduleTabs = document.getElementById('full-schedule-tabs');
    const fullScheduleContent = document.getElementById('full-schedule-content');
    const togglePipBtn = document.getElementById('toggle-pip');
    const nextPlayer = document.getElementById('next-player');
    const colorSampler = document.getElementById('color-sampler');
    const ctxSampler = colorSampler ? colorSampler.getContext('2d', { willReadFrequently: true }) : null;
    const btnMinimizeFullscreen = document.getElementById('btn-minimize-fullscreen');
    const openCatalogHeaderBtn = document.getElementById('open-catalog-header');
    const openFullScheduleHeaderBtn = document.getElementById('open-full-schedule-header');

    // Safe check for critical elements
    if (!videoPlayer || !scheduleList || !currentTitle) {
        console.error("Erro fatal: Elementos essenciais do DOM não encontrados.");
        return;
    }

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
    const db = firebase.firestore();

    let schedule = [];
    let currentProgram = null;

    // Days of the week in Portuguese
    const daysWeek = [
        'Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira',
        'Quinta-feira', 'Sexta-feira', 'Sábado'
    ];

    // Initialize the app
    async function init() {
        console.log("LOG: Iniciando BhaskaraTV Cloud...");

        // Escutar mudanças em tempo real na nuvem
        db.collection('config').doc('main').onSnapshot((doc) => {
            if (doc.exists) {
                const config = doc.data();
                schedule = config.schedule || [];

                console.log("LOG: Dados da Nuvem recebidos. Itens na grade:", schedule.length);

                // Renderizar tudo com os novos dados
                renderCatalog(config.catalog || []);
                checkSchedule();
                renderSchedule();
            } else {
                console.error("ERRO: Documento de configuração não encontrado no Firestore.");
                showFallback();
            }
        }, (error) => {
            console.error("ERRO DE CONEXÃO COM A NUVEM:", error);
            showFallback();
        });

        // Iniciar relógio global
        updateTime();
        setInterval(updateTime, 1000);

        // Intervalos de manutenção de estado
        setInterval(checkSchedule, 30000);
        setInterval(renderSchedule, 60000);
    }

    function renderCatalog(catalogItems) {
        const catalogContainer = document.querySelector('#catalog-modal .grid');
        if (!catalogContainer) return;

        if (catalogItems.length === 0) {
            catalogContainer.innerHTML = '<div class="col-span-full text-center py-20 opacity-30">Nenhum destaque disponível no momento.</div>';
            return;
        }

        catalogContainer.innerHTML = catalogItems.map(item => `
            <div class="modal-card glass rounded-3xl overflow-hidden border border-white/10 bg-white/5">
                <div class="h-56 bg-cover bg-center" style="background-image: url('${item.banner}');"></div>
                <div class="p-6">
                    <div class="flex justify-between items-start mb-4">
                        <h3 class="text-2xl font-bold">${item.title}</h3>
                        <span class="px-3 py-1 bg-indigo-500/20 text-indigo-400 text-[10px] font-bold rounded-full border border-indigo-500/30 uppercase tracking-widest">${item.type}</span>
                    </div>
                    <p class="text-sm opacity-60 leading-relaxed mb-6">${item.description}</p>
                    <div class="flex items-center gap-2 text-xs font-bold text-indigo-400 group cursor-default">
                        <span class="w-2 h-2 rounded-full bg-indigo-500"></span>
                        DISPONÍVEL NA GRADE
                    </div>
                </div>
            </div>
        `).join('');
    }

    function updateTime() {
        const now = new Date();
        const timeString = now.toLocaleTimeString('pt-BR', { hour12: false });
        clockElement.textContent = timeString;
        currentDayElement.textContent = daysWeek[now.getDay()];
    }

    function checkSchedule() {
        try {
            const now = new Date();
            const currentHour = now.getHours();
            const currentMinute = now.getMinutes();
            const currentSecond = now.getSeconds();
            const currentDay = now.getDay();

            const currentTimeInSeconds = (currentHour * 3600) + (currentMinute * 60) + currentSecond;

            // Find the matching program for today
            const activeProgram = schedule.find(prog => {
                if (!prog.days.includes(currentDay)) return false;

                const [startH, startM] = prog.startTime.split(':').map(Number);
                const startInSeconds = (startH * 3600) + (startM * 60);
                const durationInSeconds = prog.duration * 60;
                const endInSeconds = startInSeconds + durationInSeconds;

                return currentTimeInSeconds >= startInSeconds && currentTimeInSeconds < endInSeconds;
            });

            if (activeProgram) {
                if (!currentProgram || currentProgram.url !== activeProgram.url) {
                    playProgram(activeProgram, currentTimeInSeconds);
                }
            } else {
                showFallback();
            }

            // Update highlight in the guide if needed
            renderSchedule();
        } catch (e) {
            console.error("Erro no loop de verificação:", e);
        }
    }

    function playProgram(program, currentTimeInSeconds) {
        if (currentProgram && currentProgram.url === program.url && !videoPlayer.paused) {
            console.log("Programa já está em execução.");
            return;
        }

        currentProgram = program;

        const [startH, startM] = program.startTime.split(':').map(Number);
        const startInSeconds = (startH * 3600) + (startM * 60);
        const seekPosition = currentTimeInSeconds - startInSeconds;

        // Limpa URL do Archive.org para formato compatível
        if (program.url.includes('archive.org')) {
            const oldUrl = program.url;
            program.url = cleanArchiveUrl(program.url);
            if (oldUrl !== program.url) console.log("LOG: URL convertida ->", program.url);
        }

        // Gestão Inteligente de CORS: 
        // Arquivos locais -> anonymous (Ambilight OK)
        // Arquivos externos -> sem crossorigin (Estabilidade Máxima)
        if (program.url.startsWith('http') && !program.url.includes(window.location.host)) {
            console.log("LOG: Link externo detectado. Desativando CORS para estabilidade.");
            videoPlayer.removeAttribute('crossorigin');
        } else {
            videoPlayer.setAttribute('crossorigin', 'anonymous');
        }

        console.log(`Iniciando programa: ${program.title}. Seek alvo: ${seekPosition}s`);

        // Update UI
        fallbackScreen.classList.add('hidden');
        videoPlayer.classList.remove('hidden');
        if (playerOverlayName) playerOverlayName.textContent = program.title;
        controlTitle.textContent = program.title;

        const startDate = new Date();
        startDate.setHours(startH, startM, 0);
        const endDate = new Date(startDate.getTime() + program.duration * 60000);
        const endTimeStr = endDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        controlTime.textContent = `${program.startTime} - ${endTimeStr}`;

        // Limpa eventos anteriores
        videoPlayer.oncanplay = null;
        videoPlayer.onloadeddata = null; // Clear previous listener
        videoPlayer.onloadedmetadata = null; // Clear previous listener

        let hasSeeked = false;

        const performSeek = () => {
            if (!hasSeeked) {
                hasSeeked = true;

                if (seekPosition > 0) {
                    console.log(`SINCRONIZANDO: Tentando pular para ${seekPosition}s...`);

                    // Tentativa 1: Antes do play
                    videoPlayer.currentTime = seekPosition;

                    videoPlayer.play().then(() => {
                        // Tentativa 2: Logo após o play (alguns browsers resetam no play)
                        if (Math.abs(videoPlayer.currentTime - seekPosition) > 2) {
                            console.log("Re-sincronizando após início do play...");
                            videoPlayer.currentTime = seekPosition;
                        }
                    }).catch(e => {
                        console.log("Autoplay bloqueado ou erro. Overlay ativo.");
                        unmuteOverlay.classList.remove('hidden');
                    });
                } else {
                    videoPlayer.play().catch(() => unmuteOverlay.classList.remove('hidden'));
                }
            }
        };

        if (program.url.endsWith('.m3u8')) {
            if (typeof Hls !== 'undefined' && Hls.isSupported()) {
                const hls = new Hls();
                hls.loadSource(program.url);
                hls.attachMedia(videoPlayer);
                hls.on(Hls.Events.MANIFEST_PARSED, () => {
                    performSeek();
                });
                hls.on(Hls.Events.ERROR, (event, data) => {
                    if (data.fatal) showFallback();
                });
            } else if (videoPlayer.canPlayType('application/vnd.apple.mpegurl')) {
                // Suporte nativo (Safari)
                videoPlayer.src = program.url;
                videoPlayer.removeEventListener('loadedmetadata', performSeek); // Limpar anterior
                videoPlayer.addEventListener('loadedmetadata', performSeek);
            } else {
                console.warn("HLS não suportado neste navegador.");
                showFallback();
            }
        } else {
            // MP4 Standard
            videoPlayer.src = program.url;
            videoPlayer.oncanplay = performSeek;
            videoPlayer.onloadeddata = () => {
                if (!hasSeeked) performSeek();
            };
            videoPlayer.load();
        }

        // Verificação de suporte a Range (Isolada para evitar crash em links externos)
        if (!program.url.startsWith('http')) {
            try {
                fetch(program.url, { method: 'HEAD', headers: { 'Range': 'bytes=0-1' } })
                    .then(res => {
                        if (res.status !== 206) console.warn("Nota: Servidor local não reportou suporte a Range.");
                    })
                    .catch(() => { });
            } catch (e) { }
        }

        // Bloqueio de Seek (Anti-trapaça e Sincronia Linear)
        videoPlayer.onseeking = () => {
            if (!currentProgram) return;
            const now = new Date();
            const [h, m] = currentProgram.startTime.split(':').map(Number);
            const startSec = (h * 3600) + (m * 60);
            const nowSec = (now.getHours() * 3600) + (now.getMinutes() * 60) + now.getSeconds();
            const correctPos = nowSec - startSec;

            // Se o usuário tentar pular mais de 2 segundos de diferença do "Live", volta pra sincronia
            if (Math.abs(videoPlayer.currentTime - correctPos) > 3) {
                console.log("RESYNC: Seek detectado. Retornando ao ponto linear...");
                videoPlayer.currentTime = correctPos;
            }
        };

        videoPlayer.onended = () => {
            console.log("Vídeo terminou. Verificando próxima programação...");
            checkSchedule();
        };

        videoPlayer.onerror = (e) => {
            console.error("ERRO NO PLAYER: Falha ao carregar", program.url);

            // RECUPERAÇÃO AGRESSIVA: Se falhou com CORS, limpa tudo e tenta sem
            if (videoPlayer.hasAttribute('crossorigin')) {
                console.log("RECOVERY: Falha de CORS detectada. Tentando modo de compatibilidade (Sem Ambilight)...");
                videoPlayer.removeAttribute('crossorigin');
                videoPlayer.src = ""; // Force clear
                setTimeout(() => {
                    videoPlayer.src = program.url;
                    videoPlayer.load();
                }, 100);
            } else {
                showFallback();
            }
        };

        // Premium: Coming Next & Gapless Logic
        videoPlayer.ontimeupdate = () => {
            const timeLeft = videoPlayer.duration - videoPlayer.currentTime;

            // Mostrar toast 1 minuto antes
            if (timeLeft > 0 && timeLeft < 60) {
                showNextToast();

                // Gapless: Pre-load next program in background player
                prepareNextProgram();
            } else {
                if (nextToast) nextToast.classList.remove('show');
            }

            // Loop de Ambient Light
            if (Math.floor(videoPlayer.currentTime * 5) % 1 === 0) { // update 5 times per sec
                updateAmbientLight();
            }
        };
    }

    function prepareNextProgram() {
        const now = new Date();
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        const currentSecond = now.getSeconds();
        const currentTimeInSeconds = (currentHour * 3600) + (currentMinute * 60) + currentSecond;

        const nextProg = schedule
            .filter(p => p.days.includes(now.getDay()))
            .sort((a, b) => a.startTime.localeCompare(b.startTime))
            .find(p => {
                const [h, m] = p.startTime.split(':').map(Number);
                return (h * 3600 + m * 60) > currentTimeInSeconds;
            });

        if (nextProg && (!nextPlayer.src.includes(nextProg.url))) {
            console.log("GAPLESS: Pré-carregando próximo programa:", nextProg.title);
            nextPlayer.src = nextProg.url;
            nextPlayer.load();
        }
    }

    function showNextToast() {
        if (!nextToast) return;
        const now = new Date();
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        const currentSecond = now.getSeconds();
        const currentTimeInSeconds = (currentHour * 3600) + (currentMinute * 60) + currentSecond;

        // Find the next program
        const nextProg = schedule
            .filter(p => p.days.includes(now.getDay()))
            .sort((a, b) => a.startTime.localeCompare(b.startTime))
            .find(p => {
                const [h, m] = p.startTime.split(':').map(Number);
                return (h * 3600 + m * 60) > currentTimeInSeconds;
            });

        if (nextProg) {
            nextTitle.textContent = nextProg.title;
            nextToast.classList.add('show');
        }
    }

    function updateAmbientLight() {
        if (!ambientLight || !ctxSampler || videoPlayer.paused || videoPlayer.ended) return;

        // Redimensionar canvas se necessário (pequeno para performance)
        if (colorSampler.width !== 10) {
            colorSampler.width = 10;
            colorSampler.height = 10;
        }

        try {
            ctxSampler.drawImage(videoPlayer, 0, 0, 10, 10);
            const frame = ctxSampler.getImageData(0, 0, 10, 10);
            const length = frame.data.length;
            let r = 0, g = 0, b = 0;

            for (let i = 0; i < length; i += 4) {
                r += frame.data[i];
                g += frame.data[i + 1];
                b += frame.data[i + 2];
            }

            r = Math.floor(r / (length / 4));
            g = Math.floor(g / (length / 4));
            b = Math.floor(b / (length / 4));

            ambientLight.style.background = `rgb(${r}, ${g}, ${b})`;
        } catch (e) {
            // Ignorar erros de cross-origin ou carregamento
        }
    }

    function showFallback() {
        currentProgram = null;
        if (videoPlayer) {
            videoPlayer.pause();
            videoPlayer.classList.add('hidden');
        }
        if (fallbackScreen) fallbackScreen.classList.remove('hidden');
        if (currentTitle) currentTitle.textContent = "Fora do Ar";
        if (playerOverlayName) playerOverlayName.textContent = "Sem Sinal";
        if (controlTitle) controlTitle.textContent = "Fora do Ar";
        if (controlTime) controlTime.textContent = "--:--";
    }

    function getBadge(title) {
        const t = title.toLowerCase();
        if (t.includes('naruto') || t.includes('pokemon') || t.includes('fairy tail') || t.includes('desenho') || t.includes('anime')) return '<span class="badge badge-anime">Anime</span>';
        if (t.includes('news') || t.includes('notícia') || t.includes('jornal')) return '<span class="badge badge-news">Jornalismo</span>';
        if (t.includes('movie') || t.includes('filme') || t.includes('cinema') || t.includes('sessão')) return '<span class="badge badge-movie">Cinema</span>';
        if (t.includes('ep') || t.includes('temporada') || t.includes('série')) return '<span class="badge badge-series">Série</span>';
        return '<span class="badge badge-default">Programa</span>';
    }

    function renderSchedule() {
        const now = new Date();
        const currentDay = now.getDay();
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        const currentTimeInSeconds = (currentHour * 3600) + (currentMinute * 60);

        if (currentDayElement) {
            currentDayElement.textContent = daysWeek[currentDay];
        }

        const todaysSchedule = schedule
            .filter(prog => prog.days.includes(currentDay))
            .sort((a, b) => a.startTime.localeCompare(b.startTime));

        scheduleList.innerHTML = '';

        if (todaysSchedule.length === 0) {
            scheduleList.innerHTML = '<div class="col-span-full text-center py-10 opacity-50">Nenhuma programação para hoje.</div>';
            return;
        }

        // Encontrar o indice do programa atual para marcar o "A seguir"
        const liveIndex = todaysSchedule.findIndex(prog => {
            const [startH, startM] = prog.startTime.split(':').map(Number);
            const startInSeconds = (startH * 3600) + (startM * 60);
            const endInSeconds = startInSeconds + (prog.duration * 60);
            return currentTimeInSeconds >= startInSeconds && currentTimeInSeconds < endInSeconds;
        });

        todaysSchedule.forEach((prog, index) => {
            const [startH, startM] = prog.startTime.split(':').map(Number);
            const startInSeconds = (startH * 3600) + (startM * 60);
            const durationInSeconds = prog.duration * 60;
            const endInSeconds = startInSeconds + durationInSeconds;

            const isLive = currentTimeInSeconds >= startInSeconds && currentTimeInSeconds < endInSeconds;
            const isPast = currentTimeInSeconds >= endInSeconds;
            const isNext = index === liveIndex + 1;

            const card = document.createElement('div');
            card.className = `program-card glass p-5 rounded-2xl border ${isLive ? 'live border-indigo-500/50 scale-[1.02]' : 'border-white/5'} ${isPast ? 'past' : ''}`;

            // Calcular string de fim
            const startDate = new Date();
            startDate.setHours(startH, startM, 0);
            const endDate = new Date(startDate.getTime() + prog.duration * 60000);
            const endTimeStr = endDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

            // Calcular porcentagem do progresso se estiver ao vivo
            let progressPercent = 0;
            if (isLive) {
                progressPercent = ((currentTimeInSeconds - startInSeconds) / durationInSeconds) * 100;
            }

            card.innerHTML = `
                <div class="flex justify-between items-start mb-3">
                    <div class="flex flex-col gap-1">
                        <span class="text-[10px] font-bold opacity-50 tracking-wider">${prog.startTime} - ${endTimeStr}</span>
                        ${getBadge(prog.title)}
                    </div>
                    ${isLive ? '<span class="text-[9px] font-black px-2 py-1 rounded bg-red-600 text-white animate-pulse tracking-tighter">NO AR</span>' : ''}
                    ${isNext ? '<span class="text-[9px] font-black px-2 py-1 rounded bg-indigo-600 text-white tracking-tighter">A SEGUIR</span>' : ''}
                </div>
                <h4 class="font-bold text-white leading-tight mb-1 text-sm">${prog.title}</h4>
                <p class="text-[10px] opacity-40 italic line-clamp-1 mb-2">${prog.description || 'Sem descrição'}</p>
                <div class="flex items-center gap-2">
                    <p class="text-[9px] opacity-30 font-bold uppercase tracking-widest">${prog.duration} MINUTOS</p>
                </div>
                ${isLive ? `
                    <div class="schedule-progress">
                        <div class="schedule-progress-bar" style="width: ${progressPercent}%"></div>
                    </div>
                ` : ''}
            `;

            scheduleList.appendChild(card);
        });
    }

    // Interactive events
    if (unmuteOverlay && videoPlayer) {
        unmuteOverlay.addEventListener('click', () => {
            videoPlayer.muted = false;
            unmuteOverlay.classList.add('hidden');
            if (typeof updateMuteUI === 'function') updateMuteUI();
            videoPlayer.play().catch(e => console.warn("Erro ao dar play após clique:", e));
        });
    }

    if (toggleMuteBtn && videoPlayer) {
        toggleMuteBtn.addEventListener('click', () => {
            videoPlayer.muted = !videoPlayer.muted;
            if (typeof updateMuteUI === 'function') updateMuteUI();
            if (unmuteOverlay) unmuteOverlay.classList.add('hidden');
        });
    }

    if (togglePipBtn && videoPlayer) {
        togglePipBtn.addEventListener('click', async () => {
            try {
                if (videoPlayer !== document.pictureInPictureElement) {
                    await videoPlayer.requestPictureInPicture();
                } else {
                    await document.exitPictureInPicture();
                }
            } catch (error) {
                console.error("Erro ao alternar PiP:", error);
            }
        });
    }

    if (toggleFullscreenBtn && playerContainer) {
        toggleFullscreenBtn.addEventListener('click', () => {
            if (!document.fullscreenElement) {
                playerContainer.requestFullscreen().catch(err => {
                    console.error(`Erro: ${err.message}`);
                });
            } else {
                if (document.exitFullscreen) document.exitFullscreen();
            }
        });
    }

    if (btnMinimizeFullscreen) {
        btnMinimizeFullscreen.addEventListener('click', () => {
            if (document.exitFullscreen) document.exitFullscreen();
        });
    }

    if (volumeSlider && videoPlayer) {
        volumeSlider.addEventListener('input', (e) => {
            videoPlayer.volume = e.target.value;
            videoPlayer.muted = videoPlayer.volume === 0;
            if (typeof updateMuteUI === 'function') updateMuteUI();
        });
    }

    // Modal Catalog Logic
    if (openCatalogBtn && catalogModal) {
        openCatalogBtn.addEventListener('click', () => {
            catalogModal.classList.remove('opacity-0', 'pointer-events-none');
        });
    }

    if (openCatalogHeaderBtn && catalogModal) {
        openCatalogHeaderBtn.addEventListener('click', () => {
            catalogModal.classList.remove('opacity-0', 'pointer-events-none');
        });
    }

    if (closeCatalogBtn && catalogModal) {
        closeCatalogBtn.addEventListener('click', () => {
            catalogModal.classList.add('opacity-0', 'pointer-events-none');
        });
    }

    // Modal Full Schedule Logic
    if (openFullScheduleBtn && fullScheduleModal) {
        openFullScheduleBtn.addEventListener('click', () => {
            const now = new Date();
            renderWeeklySchedule(now.getDay()); // Abre no dia atual
            fullScheduleModal.classList.remove('opacity-0', 'pointer-events-none');
        });
    }

    if (openFullScheduleHeaderBtn && fullScheduleModal) {
        openFullScheduleHeaderBtn.addEventListener('click', () => {
            const now = new Date();
            renderWeeklySchedule(now.getDay()); // Abre no dia atual
            fullScheduleModal.classList.remove('opacity-0', 'pointer-events-none');
        });
    }

    if (closeFullScheduleBtn && fullScheduleModal) {
        closeFullScheduleBtn.addEventListener('click', () => {
            fullScheduleModal.classList.add('opacity-0', 'pointer-events-none');
        });
    }

    if (fullScheduleTabs && fullScheduleModal) {
        fullScheduleTabs.querySelectorAll('.day-tab').forEach(btn => {
            btn.addEventListener('click', () => {
                const day = parseInt(btn.getAttribute('data-day'));
                renderWeeklySchedule(day);
            });

            // Auto-scroll para abas em TVs
            btn.addEventListener('focus', () => {
                btn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
            });
        });
    }

    function renderWeeklySchedule(day) {
        if (!fullScheduleContent) return;

        const now = new Date();
        const isToday = now.getDay() === day;
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        const currentTimeInSeconds = (currentHour * 3600) + (currentMinute * 60);

        // Atualizar estilo das abas
        fullScheduleTabs.querySelectorAll('.day-tab').forEach(btn => {
            const btnDay = parseInt(btn.getAttribute('data-day'));
            if (btnDay === day) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        const daySchedule = schedule
            .filter(prog => prog.days.includes(day))
            .sort((a, b) => a.startTime.localeCompare(b.startTime));

        fullScheduleContent.innerHTML = '';

        if (daySchedule.length === 0) {
            fullScheduleContent.innerHTML = `
                <div class="col-span-full text-center py-20 reveal-node">
                    <div class="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-10 w-10 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <p class="opacity-30 font-medium text-xl">Nenhum programa cadastrado para este dia.</p>
                </div>
            `;
            return;
        }

        daySchedule.forEach((prog, index) => {
            const [startH, startM] = prog.startTime.split(':').map(Number);
            const durationInSeconds = prog.duration * 60;
            const startInSeconds = (startH * 3600) + (startM * 60);
            const endInSeconds = startInSeconds + durationInSeconds;

            const isLive = isToday && currentTimeInSeconds >= startInSeconds && currentTimeInSeconds < endInSeconds;
            const isPast = isToday && currentTimeInSeconds >= endInSeconds;

            const startDate = new Date();
            startDate.setHours(startH, startM, 0);
            const endDate = new Date(startDate.getTime() + prog.duration * 60000);
            const endTimeStr = endDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

            const card = document.createElement('button');
            card.className = `program-card text-left reveal-node glass p-6 rounded-3xl border ${isLive ? 'live' : 'border-white/5'} ${isPast ? 'past' : ''} transition-all duration-300 focus:outline-none`;
            card.style.animationDelay = `${index * 0.05}s`;

            // Auto-scroll para foco em TVs (D-pad)
            card.addEventListener('focus', () => {
                card.scrollIntoView({ behavior: 'smooth', block: 'center' });
            });

            card.innerHTML = `
                <div class="flex justify-between items-start mb-4">
                    <div class="flex flex-col">
                        <span class="text-xs font-bold text-indigo-400 font-mono tracking-tighter mb-1">${prog.startTime} — ${endTimeStr}</span>
                        <div class="flex flex-wrap items-center gap-3">
                            ${getBadge(prog.title)}
                            ${isLive ? '<span class="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-red-500/20 text-red-500 text-[9px] font-black uppercase tracking-widest ring-1 ring-red-500/30 animate-pulse">AO VIVO</span>' : ''}
                        </div>
                    </div>
                </div>
                
                <h4 class="font-bold text-white text-xl leading-tight mb-2">${prog.title}</h4>
                <p class="text-[13px] text-white/40 leading-relaxed mb-4 line-clamp-2">${prog.description || 'Nenhuma descrição disponível.'}</p>
                
                <div class="flex items-center justify-between pt-4 border-t border-white/5 mt-auto">
                    <span class="text-[9px] opacity-30 font-bold uppercase tracking-widest">${prog.duration} MINUTOS</span>
                    <div class="w-8 h-8 rounded-full border border-white/5 bg-white/5 flex items-center justify-center text-[10px] font-bold opacity-30 text-indigo-400">TV</div>
                </div>
            `;
            fullScheduleContent.appendChild(card);
        });
    }

    if (catalogModal) {
        catalogModal.addEventListener('click', (e) => {
            if (e.target === catalogModal) catalogModal.classList.add('opacity-0', 'pointer-events-none');
        });
    }

    if (fullScheduleModal) {
        fullScheduleModal.addEventListener('click', (e) => {
            if (e.target === fullScheduleModal) fullScheduleModal.classList.add('opacity-0', 'pointer-events-none');
        });
    }

    // Handle ESC key or other ways to exit fullscreen to sync UI if needed
    document.addEventListener('fullscreenchange', () => {
        if (document.fullscreenElement) {
            playerContainer.classList.add('rounded-none');
            playerContainer.classList.remove('rounded-2xl');
        } else {
            playerContainer.classList.add('rounded-2xl');
            playerContainer.classList.remove('rounded-none');
        }
    });

    function updateMuteUI() {
        if (videoPlayer.muted) {
            muteIcon.innerHTML = `
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8l4 4m0 0l-4 4m4-4H13" />
            `;
        } else {
            muteIcon.innerHTML = `
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
            `;
        }
    }

    function cleanArchiveUrl(url) {
        try {
            // Aceita tanto iaXXXX.us.archive.org quanto o formato padrão
            if (url.includes('archive.org') && url.includes('items/')) {
                const parts = url.split('/');
                // Procure o index de 'items' e pegue o próximo
                const itemsIndex = parts.indexOf('items');
                if (itemsIndex !== -1 && parts[itemsIndex + 1]) {
                    const identifier = parts[itemsIndex + 1];
                    const filename = parts[parts.length - 1];
                    return `https://archive.org/download/${identifier}/${filename}`;
                }
            }
        } catch (e) {
            console.warn("Falha ao limpar URL:", e);
        }
        return url;
    }

    // --- Lógica de Navegação por Controle Remoto (D-Pad) ---
    const focusableElements = 'button, input, [tabindex="0"]';

    window.addEventListener('keydown', (e) => {
        const active = document.activeElement;
        const allFocusable = Array.from(document.querySelectorAll(focusableElements));
        let index = allFocusable.indexOf(active);

        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
            e.preventDefault();
            let nextIndex = (index + 1) % allFocusable.length;
            allFocusable[nextIndex].focus();
        }
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
            e.preventDefault();
            let prevIndex = (index - 1 + allFocusable.length) % allFocusable.length;
            allFocusable[prevIndex].focus();
        }
        else if (e.key === 'Enter') {
            if (active && active.click) active.click();
        }
    });

    // --- LÓGICA DE AUTO-HIDE (INATIVIDADE) ---
    let idleTimer;
    const hideDelay = 3000; // 3 segundos
    const root = document.documentElement;

    function resetIdleTimer() {
        root.classList.remove('user-inactive');
        if (playerContainer) playerContainer.classList.remove('user-inactive');
        clearTimeout(idleTimer);

        idleTimer = setTimeout(() => {
            // Só esconde se o mouse não estiver em cima de algum modal ou menu
            const isMenuOpen = (catalogModal && !catalogModal.classList.contains('opacity-0')) ||
                (fullScheduleModal && !fullScheduleModal.classList.contains('opacity-0'));
            if (!isMenuOpen) {
                root.classList.add('user-inactive');
                if (playerContainer) playerContainer.classList.add('user-inactive');
            }
        }, hideDelay);
    }

    // Eventos para detectar atividade
    window.addEventListener('mousemove', resetIdleTimer);
    window.addEventListener('mousedown', resetIdleTimer);
    window.addEventListener('keydown', resetIdleTimer);
    window.addEventListener('touchstart', resetIdleTimer);

    // Iniciar timer
    resetIdleTimer();

    init();
});
