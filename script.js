// === Auto Leia SP Robust v2 (takashito & I.A) ===
// Cola no console da página do leitor: F12 -> Console -> cola -> Enter

(function(){
  if (window.__autoLeiaRobustInjected) {
    console.log('Auto Leia Robust já está ativo.');
    return;
  }
  window.__autoLeiaRobustInjected = true;

  // ---------- Config / Estado ----------
  let intervalMs = 60000;
  let ativo = false;
  let intervaloId = null;
  let cronometroId = null;
  let segundos = 0;
  let paginasViradas = 0;
  let arcoirisId = null;

  // ---------- UI ----------
  const painel = document.createElement('div');
  painel.id = '__autoLeiaPanel';
  Object.assign(painel.style, {
    position: 'fixed',
    bottom: '20px',
    right: '20px',
    background: 'rgba(0,0,0,0.85)',
    color: '#00ff88',
    padding: '14px 18px',
    borderRadius: '12px',
    fontFamily: 'monospace',
    fontSize: '14px',
    zIndex: 2147483647,
    boxShadow: '0 0 12px #00ff88',
    minWidth: '300px'
  });
  painel.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center;">
      <div><b>📖 Auto Leia SP</b><br><small>made by takashito & I.A</small></div>
      <div style="text-align:right"><button id="__autoLeiaClose" style="background:transparent;border:0;color:inherit;font-size:16px;cursor:pointer">✕</button></div>
    </div>
    <div style="margin-top:8px">
      <label style="font-size:13px">⏱ Tempo (segundos): </label>
      <input id="__autoLeiaTempo" type="number" value="60" min="1" style="width:70px;padding:4px;border-radius:6px;border:0;text-align:center;margin-left:6px">
    </div>
    <div style="margin-top:8px; display:flex; gap:8px; flex-wrap:wrap">
      <button id="__autoLeiaStart" style="padding:6px 12px;border-radius:6px;border:0;cursor:pointer;background:#00ff88;color:black">Iniciar</button>
      <button id="__autoLeiaStop" style="padding:6px 12px;border-radius:6px;border:0;cursor:pointer;background:#ff0055;color:white">Parar</button>
      <button id="__autoLeiaOnce" style="padding:6px 12px;border-radius:6px;border:0;cursor:pointer;background:#111827;color:white">Avançar Agora</button>
    </div>
    <div style="margin-top:8px; font-size:13px" id="__autoLeiaStats">
      ⏳ Tempo decorrido: <span id="__autoLeiaSeconds">0</span>s • 📄 Páginas viradas: <span id="__autoLeiaPages">0</span>
    </div>
    <div style="margin-top:8px; font-size:11px; opacity:.85">
      Dica: clique manualmente no leitor uma vez antes de iniciar se o script não avançar.
    </div>
  `;
  document.body.appendChild(painel);

  const inputTempo = document.getElementById('__autoLeiaTempo');
  const btnStart = document.getElementById('__autoLeiaStart');
  const btnStop = document.getElementById('__autoLeiaStop');
  const btnOnce = document.getElementById('__autoLeiaOnce');
  const spanSeconds = document.getElementById('__autoLeiaSeconds');
  const spanPages = document.getElementById('__autoLeiaPages');
  const btnClose = document.getElementById('__autoLeiaClose');

  btnClose.addEventListener('click', cleanup);

  // ---------- GIF e Áudio ----------
  const GIF_URL = "https://media1.giphy.com/media/v1.Y2lkPTc5MGI3NjExaWx0ZjE0NG5uY3d1eDhiOWllYmYycGt5Zmo0cG1jcWdldmRod3IyZiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/TpvnqBFOE0tVrnGU1h/giphy.gif";
  const AUDIO_URL = "https://www.myinstants.com/media/sounds/marretada-do-galego.mp3"; // direct mp3 link used earlier
  const playAudio = () => {
    try {
      const a = new Audio(AUDIO_URL);
      a.volume = 0.9;
      a.play().catch(()=>{ console.debug('Áudio bloqueado (autoplay). Requer primeiro interação do usuário.'); });
    } catch(e) { console.warn('Erro ao tocar som:', e); }
  };
  const showGif = (duration = 1800) => {
    try {
      const img = document.createElement('img');
      img.src = GIF_URL;
      Object.assign(img.style, {
        position: 'fixed',
        left: '50%',
        top: '40%',
        transform: 'translate(-50%, -50%)',
        width: '240px',
        zIndex: 2147483650,
        borderRadius: '8px',
        boxShadow: '0 8px 30px rgba(0,0,0,0.6)'
      });
      document.body.appendChild(img);
      setTimeout(()=> img.remove(), duration);
    } catch(e){}
  };

  // ---------- Arco-íris ----------
  function startArcoiris() {
    let hue = 0;
    if (arcoirisId) clearInterval(arcoirisId);
    arcoirisId = setInterval(() => {
      painel.style.boxShadow = `0 0 24px hsl(${hue},100%,60%)`;
      painel.style.color = `hsl(${hue},100%,75%)`;
      hue = (hue + 6) % 360;
    }, 80);
  }
  function stopArcoiris() {
    if (arcoirisId) { clearInterval(arcoirisId); arcoirisId = null; }
    painel.style.boxShadow = '0 0 12px #00ff88';
    painel.style.color = '#00ff88';
  }

  // ---------- Heurísticas para avançar página ----------
  function findAndClickNext() {
    const selectors = [
      'a[rel~="next"]',
      'button[aria-label*="Próx"]',
      'button[aria-label*="Next"]',
      'a[aria-label*="Próx"]',
      'a[aria-label*="Next"]',
      '.next, .proximo, .proxima, .pagina-next, .next-page, .page-next, .btn-next, #next, #proximo',
      '.reader-next, .reader__next, .next-button'
    ];
    for (const sel of selectors) {
      try {
        const el = document.querySelector(sel);
        if (el && isVisible(el)) {
          el.scrollIntoView({behavior:'smooth', block:'center'});
          el.click();
          return { method: 'clickSelector', element: el };
        }
      } catch(e){}
    }
    return null;
  }

  function isVisible(el) {
    return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length) && getComputedStyle(el).visibility !== 'hidden';
  }

  function sendKeyboardArrow() {
    // cria eventos mais completos (keydown -> keypress -> keyup) e dispatch para múltiplos alvos
    const targets = [document, window, document.activeElement];
    // também tenta focar em elementos que pareçam leitor
    const guessSelectors = ['.documentViewer', '.e-reader', '#viewer', '.page', '.chapter', '.viewer', '.read-area'];
    for (const sel of guessSelectors) {
      const el = document.querySelector(sel);
      if (el) targets.push(el);
    }

    let dispatched = false;
    const evOptions = { key: 'ArrowRight', code: 'ArrowRight', keyCode: 39, which:39, bubbles:true, cancelable:true, composed:true };
    for (const t of targets) {
      if (!t) continue;
      try {
        const kd = new KeyboardEvent('keydown', evOptions);
        const kp = new KeyboardEvent('keypress', evOptions);
        const ku = new KeyboardEvent('keyup', evOptions);
        t.dispatchEvent(kd);
        t.dispatchEvent(kp);
        t.dispatchEvent(ku);
        dispatched = true;
      } catch(e){}
    }
    return dispatched ? { method: 'keyboard' } : null;
  }

  function simulateRightSideClick() {
    // calcula posição no centro vertical e 85% largura (lado direito)
    const x = Math.floor(window.innerWidth * 0.85);
    const y = Math.floor(window.innerHeight * 0.5);
    // cria e dispara evento de mouse
    try {
      const el = document.elementFromPoint(x, y) || document.body;
      ['pointerdown','mousedown','click','pointerup','mouseup'].forEach(type => {
        const me = new MouseEvent(type, { view: window, bubbles: true, cancelable: true, clientX: x, clientY: y });
        el.dispatchEvent(me);
      });
      return { method: 'rightSideClick', x, y, element: el };
    } catch(e){}
    return null;
  }

  function attemptAdvance() {
    // Tenta várias estratégias na ordem
    let res = null;
    res = findAndClickNext();
    if (res) return res;
    res = sendKeyboardArrow();
    if (res) return res;
    res = simulateRightSideClick();
    if (res) return res;
    // fallback: scroll um viewport
    window.scrollBy({ top: window.innerHeight * 0.9, behavior: 'smooth' });
    return { method: 'fallbackScroll' };
  }

  // ---------- Core loop ----------
  function startAuto() {
    if (ativo) return;
    const val = parseInt(inputTempo.value);
    if (!val || val < 1) {
      alert('Tempo inválido (mínimo 1 segundo).');
      return;
    }
    intervalMs = val * 1000;
    segundos = 0;
    paginasViradas = 0;
    ativo = true;
    startArcoiris();

    // cronômetro de segundos
    cronometroId = setInterval(() => {
      segundos++;
      spanSeconds.textContent = segundos;
    }, 1000);

    // loop de tentativa (usa setInterval + redundância)
    intervaloId = setInterval(async () => {
      const info = attemptAdvance();
      paginasViradas++;
      spanPages.textContent = paginasViradas;
      console.log('AutoLeia: avanço via', info && info.method ? info.method : 'unknown', info);
      // mostrar gif e tocar som (pode ser bloqueado até interação manual)
      showGif();
      playAudio();
    }, intervalMs);

    // também dispara imediatamente uma vez (opcional)
    // attemptAdvance();
    console.log('AutoLeia iniciado — intervalo:', intervalMs, 'ms');
  }

  function stopAuto() {
    if (!ativo) return;
    ativo = false;
    if (intervaloId) { clearInterval(intervaloId); intervaloId = null; }
    if (cronometroId) { clearInterval(cronometroId); cronometroId = null; }
    stopArcoiris();
    console.log('AutoLeia parado.');
  }

  // ---------- Bind UI ----------
  btnStart.addEventListener('click', startAuto);
  btnStop.addEventListener('click', stopAuto);
  btnOnce.addEventListener('click', () => {
    const info = attemptAdvance();
    paginasViradas++;
    spanPages.textContent = paginasViradas;
    showGif();
    playAudio();
    console.log('AutoLeia Avançou (manual):', info);
  });

  // cleanup
  function cleanup() {
    stopAuto();
    try { document.getElementById('__autoLeiaPanel').remove(); } catch(e){}
    window.__autoLeiaRobustInjected = false;
    console.log('AutoLeia removido.');
  }

  // Expor controle via console
  window.__autoLeia = {
    start: startAuto,
    stop: stopAuto,
    once: () => { btnOnce.click(); },
    cleanup,
    status: () => ({ ativo, segundos, paginasViradas, intervalMs })
  };

  console.log('Auto Leia SP Robust injetado. Dica: clique no leitor uma vez para dar permissões de interação e então pressione "Iniciar".');
})();
