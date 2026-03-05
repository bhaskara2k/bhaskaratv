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
    // Usa o botão da página se existir, senão usa o do header (novo design)
    const openCatalogBtn = document.getElementById('open-catalog') || document.getElementById('open-catalog-header');
    const closeCatalogBtn = document.getElementById('close-catalog');
    const fullScheduleModal = document.getElementById('full-schedule-modal');
    const openFullScheduleBtn = document.getElementById('open-full-schedule') || document.getElementById('open-full-schedule-header');
    const closeFullScheduleBtn = document.getElementById('close-full-schedule');
    const fullScheduleTabs = document.getElementById('full-schedule-tabs');
    const fullScheduleContent = document.getElementById('full-schedule-content');
    const fullScheduleWeekRange = document.getElementById('full-schedule-week-range');
    const togglePipBtn = document.getElementById('toggle-pip');
    const nextPlayer = document.getElementById('next-player');
    const colorSampler = document.getElementById('color-sampler');
    const ctxSampler = colorSampler ? colorSampler.getContext('2d', { willReadFrequently: true }) : null;
    const btnMinimizeFullscreen = document.getElementById('btn-minimize-fullscreen');
    // openCatalogHeaderBtn e openFullScheduleHeaderBtn apontam para os mesmos botões do header
    const openCatalogHeaderBtn = openCatalogBtn;
    const openFullScheduleHeaderBtn = openFullScheduleBtn;

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

    function getTodayStr() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    // Helper to normalize dates for comparison (handles both YYYY-MM-DD and YYYY-M-D)
    function normalizeDate(d) {
        if (!d) return null;
        try {
            const parts = d.split('-');
            if (parts.length !== 3) return d;
            return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
        } catch (e) { return d; }
    }

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
        const catalogContainer = document.querySelector('#catalog-modal .catalog-grid');
        if (!catalogContainer) return;

        if (catalogItems.length === 0) {
            catalogContainer.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:5rem 0;opacity:0.3;">Nenhum destaque disponível no momento.</div>';
            return;
        }

        catalogContainer.innerHTML = catalogItems.map(item => `
            <div class="modal-card reveal-node">
                <div class="modal-card-banner" style="background-image: url('${item.banner}');"></div>
                <div class="modal-card-body">
                    <span class="modal-card-type">${item.type}</span>
                    <h3 class="modal-card-title">${item.title}</h3>
                    <p class="modal-card-desc">${item.description}</p>
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
            const todayStr = getTodayStr();
            const activeProgram = schedule.find(prog => {
                if (prog.date) {
                    if (prog.date !== todayStr) return false;
                } else {
                    if (!prog.days.includes(currentDay)) return false;
                }

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

        // --- TRANSIÇÃO DE PROGRAMA ---
        // Se já havia um programa rodando, mostra tela de transição
        const transitionEl = document.getElementById('program-transition');
        const transitionTitleEl = document.getElementById('transition-title');
        const wasPlaying = !!currentProgram;

        function showTransition(title) {
            if (!transitionEl || !transitionTitleEl) return;
            transitionTitleEl.textContent = title;
            // Força reset da animação do título
            transitionTitleEl.style.animation = 'none';
            requestAnimationFrame(() => {
                transitionTitleEl.style.animation = '';
                transitionEl.classList.add('show');
            });
        }

        function hideTransition() {
            if (!transitionEl) return;
            transitionEl.classList.remove('show');
        }

        if (wasPlaying) {
            showTransition(program.title);
            // Esconde após 2.8 segundos (tempo suficiente para o vídeo carregar)
            setTimeout(hideTransition, 2800);
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
        let errorRetries = 0;
        const MAX_ERROR_RETRIES = 3;

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
                        if (unmuteOverlay) unmuteOverlay.style.display = 'flex';
                    });
                } else {
                    videoPlayer.play().catch(() => { if (unmuteOverlay) unmuteOverlay.style.display = 'flex'; });
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
            console.error("ERRO NO PLAYER: Falha ao carregar", program.url, `(tentativa ${errorRetries + 1}/${MAX_ERROR_RETRIES})`);
            errorRetries++;

            // Se excedeu o limite de tentativas, desiste e mostra fallback
            if (errorRetries >= MAX_ERROR_RETRIES) {
                console.error("RECOVERY: Número máximo de tentativas atingido. Exibindo tela de fallback.");
                showFallback();
                return;
            }

            // RECUPERAÇÃO: Se falhou com CORS, limpa tudo e tenta sem
            if (videoPlayer.hasAttribute('crossorigin')) {
                console.log("RECOVERY: Falha de CORS detectada. Tentando modo de compatibilidade (Sem Ambilight)...");
                videoPlayer.removeAttribute('crossorigin');
                videoPlayer.src = ""; // Force clear
                const retryDelay = errorRetries * 2000; // Backoff: 2s, 4s...
                console.log(`RECOVERY: Aguardando ${retryDelay}ms antes de nova tentativa...`);
                setTimeout(() => {
                    videoPlayer.src = program.url;
                    videoPlayer.load();
                }, retryDelay);
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
            .filter(p => {
                const pDays = p.days || [];
                const pDate = p.date || null;
                const todayStr = getTodayStr();
                if (pDate) return pDate === todayStr;
                return pDays.includes(now.getDay());
            })
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
            .filter(p => {
                const pDays = p.days || [];
                const pDate = p.date || null;
                const todayStr = getTodayStr();

                if (pDate) return pDate === todayStr;
                return pDays.includes(now.getDay());
            })
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

    function getBadge(prog) {
        // Se houver categoria explicativa, use-a primeiro
        if (prog && typeof prog === 'object' && prog.category) {
            const cat = prog.category;
            if (cat === 'anime') return '<span class="badge badge-anime">Anime</span>';
            if (cat === 'series') return '<span class="badge badge-series">Série</span>';
            if (cat === 'movie') return '<span class="badge badge-movie">Cinema</span>';
            if (cat === 'news') return '<span class="badge badge-news">Jornalismo</span>';
            if (cat === 'cartoon') return '<span class="badge badge-cartoon">Desenho</span>';
            if (cat === 'default') return '<span class="badge badge-default">Programa</span>';
        }

        // Fallback para detecção baseada no título
        const title = typeof prog === 'string' ? prog : (prog ? prog.title : '');
        const t = title.toLowerCase();
        if (t.includes('naruto') || t.includes('pokemon') || t.includes('fairy tail') || t.includes('desenho') || t.includes('anime')) return '<span class="badge badge-anime">Anime</span>';
        if (t.includes('news') || t.includes('notícia') || t.includes('jornal')) return '<span class="badge badge-news">Jornalismo</span>';
        if (t.includes('movie') || t.includes('filme') || t.includes('cinema') || t.includes('sessão')) return '<span class="badge badge-movie">Cinema</span>';
        if (t.includes('ep') || t.includes('temporada') || t.includes('série')) return '<span class="badge badge-series">Série</span>';
        return '<span class="badge badge-default">Programa</span>';
    }

    function renderSchedule() {
        if (!scheduleList) return;
        const now = new Date();
        const currentDay = now.getDay();
        const todayStr = getTodayStr();
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        const currentTimeInSeconds = (currentHour * 3600) + (currentMinute * 60);

        console.log(`[DEBUG] Renderizando Grade. Hoje: ${todayStr}, Dia Semana: ${currentDay}`);

        const todaysSchedule = schedule
            .filter(prog => {
                const progDate = normalizeDate(prog.date);
                if (progDate) {
                    const match = progDate === todayStr;
                    if (prog.title.toLowerCase().includes('hunter')) {
                        console.log(`[DEBUG] Hunter Match: ${progDate} === ${todayStr} ? ${match}`);
                    }
                    return match;
                }
                return prog.days && prog.days.includes(currentDay);
            })
            .sort((a, b) => a.startTime.localeCompare(b.startTime));

        console.log(`[DEBUG] Programas filtrados para hoje:`, todaysSchedule.map(p => p.title));

        if (currentDayElement) {
            currentDayElement.textContent = daysWeek[now.getDay()];
        }

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
            card.className = `program-card${isLive ? ' live' : ''}${isPast ? ' past' : ''}`;
            card.setAttribute('role', 'listitem');

            const startDate = new Date();
            startDate.setHours(startH, startM, 0);
            const endDate = new Date(startDate.getTime() + prog.duration * 60000);
            const endTimeStr = endDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

            let progressPercent = 0;
            if (isLive) {
                progressPercent = ((currentTimeInSeconds - startInSeconds) / durationInSeconds) * 100;
            }

            card.innerHTML = `
                <div class="card-time">${prog.startTime} &mdash; ${endTimeStr}</div>
                <div class="card-badges">
                    ${getBadge(prog)}
                    ${isLive ? '<span class="live-chip"><span class="live-chip-dot"></span>No Ar</span>' : ''}
                    ${isNext ? '<span class="next-chip">A Seguir</span>' : ''}
                </div>
                <div class="card-title">${prog.title}</div>
                <div class="card-desc">${prog.description || 'Sem descrição'}</div>
                <div class="card-footer">
                    <span class="card-duration">${prog.duration} min</span>
                </div>
                ${isLive ? `<div class="schedule-progress"><div class="schedule-progress-bar" style="width:${progressPercent}%"></div></div>` : ''}
            `;

            scheduleList.appendChild(card);
        });
    }

    // Interactive events
    if (unmuteOverlay && videoPlayer) {
        unmuteOverlay.addEventListener('click', () => {
            videoPlayer.muted = false;
            unmuteOverlay.style.display = 'none'; // direto, sem depender de classe CSS
            updateMuteUI();
            videoPlayer.play().catch(e => console.warn("Erro ao dar play após clique:", e));
        });
    }

    if (toggleMuteBtn && videoPlayer) {
        toggleMuteBtn.addEventListener('click', () => {
            videoPlayer.muted = !videoPlayer.muted;
            updateMuteUI();
            if (unmuteOverlay) unmuteOverlay.style.display = 'none';
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

    // --- LÓGICA DE AUTO-HIDE EM FULLSCREEN ---
    // Usa polling (setInterval) + timestamp de última atividade.
    // Mais confiável que eventos em fullscreen, que variam entre navegadores e TVs.
    const FS_HIDE_DELAY = 5000;
    let lastActivityTime = Date.now();
    let fsControlsVisible = true;

    const fsHideTargets = [
        document.querySelector('.custom-controls'),
        document.querySelector('.fullscreen-ui'),
        document.querySelector('.watermark'),
        document.getElementById('video-overlay'),
        document.getElementById('next-toast'),
    ].filter(Boolean);

    function showFsControls() {
        if (!fsControlsVisible) {
            fsHideTargets.forEach(el => el.classList.remove('fs-hidden'));
            playerContainer.style.cursor = '';
            fsControlsVisible = true;
        }
    }

    function hideFsControls() {
        if (fsControlsVisible) {
            fsHideTargets.forEach(el => el.classList.add('fs-hidden'));
            playerContainer.style.cursor = 'none';
            fsControlsVisible = false;
        }
    }

    function onUserActivity() {
        lastActivityTime = Date.now();
        showFsControls();
    }

    // Registra atividade em qualquer interação: mouse, toque ou teclado
    ['mousemove', 'mousedown', 'click', 'touchstart', 'touchmove', 'keydown'].forEach(evt => {
        document.addEventListener(evt, onUserActivity, { passive: true });
    });

    // Polling: a cada 500ms verifica se está inativo em fullscreen
    setInterval(() => {
        if (!document.fullscreenElement) {
            showFsControls();
            return;
        }
        if (Date.now() - lastActivityTime >= FS_HIDE_DELAY) {
            hideFsControls();
        }
    }, 500);

    // Ao entrar em fullscreen: reseta atividade para iniciar o timer do zero
    document.addEventListener('fullscreenchange', () => {
        if (document.fullscreenElement === playerContainer) {
            onUserActivity();
        } else {
            showFsControls();
        }
    });

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

    // Helpers de modal (novo design usa .open)
    function openModal(modal) { if (modal) modal.classList.add('open'); }
    function closeModal(modal) { if (modal) modal.classList.remove('open'); }

    // Modal Catalog: openCatalogBtn já aponta para o botão do header
    if (openCatalogBtn && catalogModal) openCatalogBtn.addEventListener('click', () => openModal(catalogModal));
    if (closeCatalogBtn && catalogModal) closeCatalogBtn.addEventListener('click', () => closeModal(catalogModal));

    // Modal Full Schedule
    if (openFullScheduleBtn && fullScheduleModal) {
        openFullScheduleBtn.addEventListener('click', () => {
            renderWeeklySchedule(new Date().getDay());
            openModal(fullScheduleModal);
        });
    }
    if (closeFullScheduleBtn && fullScheduleModal) {
        closeFullScheduleBtn.addEventListener('click', () => closeModal(fullScheduleModal));
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

        // Atualizar estilo e texto das abas
        fullScheduleTabs.querySelectorAll('.day-tab').forEach(btn => {
            const btnDay = parseInt(btn.getAttribute('data-day'));

            // Adicionar data ao texto do botão
            const btnDiff = btnDay - now.getDay();
            const bDate = new Date(now);
            bDate.setDate(now.getDate() + btnDiff);
            const bDateFmt = `${String(bDate.getDate()).padStart(2, '0')}/${String(bDate.getMonth() + 1).padStart(2, '0')}`;

            const dayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
            btn.textContent = `${dayNames[btnDay]} (${bDateFmt})`;

            if (btnDay === day) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        // Calcular período da semana (Domingo a Sábado)
        const sunDiff = 0 - now.getDay();
        const satDiff = 6 - now.getDay();
        const sun = new Date(now); sun.setDate(now.getDate() + sunDiff);
        const sat = new Date(now); sat.setDate(now.getDate() + satDiff);

        const fmt = (d) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (fullScheduleWeekRange) {
            fullScheduleWeekRange.textContent = `Semana de ${fmt(sun)} a ${fmt(sat)}`;
        }

        const diff = day - now.getDay();
        const targetDate = new Date(now);
        targetDate.setDate(now.getDate() + diff);
        const targetDateStr = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')}`;

        console.log(`[DEBUG] Grade Semanal: Aba ${day}, Data Alvo: ${targetDateStr}`);

        const daySchedule = schedule
            .filter(prog => {
                const progDate = normalizeDate(prog.date);
                if (progDate) {
                    return progDate === targetDateStr;
                }
                return prog.days && prog.days.includes(day);
            })
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
            card.className = `sched-card reveal-node${isLive ? ' live' : ''}${isPast ? ' past' : ''}`;
            card.style.animationDelay = `${index * 0.05}s`;

            card.addEventListener('focus', () => {
                card.scrollIntoView({ behavior: 'smooth', block: 'center' });
            });

            card.innerHTML = `
                <div class="card-time">${prog.startTime} &mdash; ${endTimeStr}</div>
                <div class="card-badges">
                    ${getBadge(prog)}
                    ${isLive ? '<span class="live-chip"><span class="live-chip-dot"></span>Ao Vivo</span>' : ''}
                </div>
                <div class="card-title" style="font-size:1rem;">${prog.title}</div>
                <div class="card-desc">${prog.description || 'Nenhuma descrição disponível.'}</div>
                <div class="card-footer">
                    <span class="card-duration">${prog.duration} min</span>
                </div>
            `;
            fullScheduleContent.appendChild(card);
        });
    }

    // Fechar modais ao clicar no backdrop
    if (catalogModal) catalogModal.addEventListener('click', e => { if (e.target === catalogModal) closeModal(catalogModal); });
    if (fullScheduleModal) fullScheduleModal.addEventListener('click', e => { if (e.target === fullScheduleModal) closeModal(fullScheduleModal); });

    // Sincronizar border-radius com o estado de fullscreen
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

    // =====================================================================
    // MODO TV (D-PAD / CONTROLE REMOTO)
    // =====================================================================
    // Detecta se o usuário é de TV: primeira navegação por seta sem uso de mouse
    // antes dele. Quando detectado:
    //   1. Ativa fullscreen automático
    //   2. Mostra badge "Modo TV ativado"
    //   3. Aplica body.tv-mode para estilos de foco aprimorados
    //   4. Navegação por D-pad fica smarter: só elementos visíveis e focusable
    // =====================================================================

    let mouseUsed = false;
    let tvModeActive = false;
    const tvModeBadge = document.getElementById('tv-mode-badge');

    document.addEventListener('mousemove', () => { mouseUsed = true; }, { once: true });
    document.addEventListener('mousedown', () => { mouseUsed = true; }, { once: true });

    function activateTVMode() {
        if (tvModeActive) return;
        tvModeActive = true;

        document.body.classList.add('tv-mode');

        // Badge de notificação
        if (tvModeBadge) {
            tvModeBadge.classList.add('show');
            setTimeout(() => tvModeBadge.classList.remove('show'), 3500);
        }

        // Entrar em fullscreen automaticamente
        if (!document.fullscreenElement && playerContainer) {
            playerContainer.requestFullscreen().catch(() => { });
        }

        console.log('[TV MODE] Modo TV ativado.');
    }

    // Retorna todos os elementos focusable que estão visíveis no DOM atualmente
    function getVisibleFocusable() {
        const sel = 'button:not([disabled]), input:not([disabled]), [tabindex="0"]';
        return Array.from(document.querySelectorAll(sel)).filter(el => {
            if (el.offsetParent === null) return false; // hidden (display:none, visibility:hidden)
            const rect = el.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
        });
    }

    window.addEventListener('keydown', (e) => {
        const isDPad = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'].includes(e.key);

        // Detecção de TV Mode: primeira tecla de seta sem mouse
        if (isDPad && !mouseUsed && !tvModeActive) {
            activateTVMode();
        }

        const active = document.activeElement;
        const allFocusable = getVisibleFocusable();
        let index = allFocusable.indexOf(active);
        if (index === -1) index = 0;

        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
            e.preventDefault();
            const next = allFocusable[(index + 1) % allFocusable.length];
            next.focus();
            if (tvModeActive) next.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
            e.preventDefault();
            const prev = allFocusable[(index - 1 + allFocusable.length) % allFocusable.length];
            prev.focus();
            if (tvModeActive) prev.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
        } else if (e.key === 'Enter') {
            if (active && active !== document.body) active.click();
        } else if (e.key === 'Escape') {
            // ESC fecha modais abertos
            const openModal = document.querySelector('.modal-backdrop.open');
            if (openModal) {
                const closeBtn = openModal.querySelector('[id^="close-"]');
                if (closeBtn) closeBtn.click();
            } else if (document.fullscreenElement) {
                document.exitFullscreen();
            }
        } else if (e.key === 'Backspace') {
            // Backspace = voltar / fechar (comum em TVs)
            const openModal = document.querySelector('.modal-backdrop.open');
            if (openModal) {
                const closeBtn = openModal.querySelector('[id^="close-"]');
                if (closeBtn) closeBtn.click();
            }
        }
    });

    init();
});
