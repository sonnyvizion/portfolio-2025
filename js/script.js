// js/script.js
(() => {
  // ====== Sélecteurs principaux ======
  const appRail     = document.querySelector('.app-rail');
  const homeView    = document.querySelector('.view--home');
  const projectView = document.querySelector('.view--project');

  if (!appRail || !homeView || !projectView) return;

  const heroHome    = homeView.querySelector('.container');
  const heroProject = projectView.querySelector('.container');
  const backBtn     = projectView.querySelector('.back_to_home');

  const homeSlider  = document.querySelector('.sliders_works');
  const homeTrack   = document.querySelector('.slides_track');
  const homeSlides  = document.querySelectorAll('.slides_track .slide');

  const projectTrack      = projectView.querySelector('.project_track');
  const projectTitle      = projectView.querySelector('.project_title');
  const projectDesc       = projectView.querySelector('.project_desc');
  const projectSliderWrap = projectView.querySelector('.sliders_project');

  const homeBaseBG    = getComputedStyle(homeView).backgroundColor;
  const projectBaseBG = getComputedStyle(projectView).backgroundColor;

  // ====== Utils ======
  const $  = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const rand = (min, max) => Math.random() * (max - min) + min;
  const forcePaint = (el) => { if (el) void el.offsetHeight; };

  function autoContrast(bgColor){
    const toRGB = (c) => {
      c = c.trim();
      if (c.startsWith('#')){
        let h = c.slice(1);
        if (h.length === 3) h = h.split('').map(x=>x+x).join('');
        const n = parseInt(h,16);
        return { r:(n>>16)&255, g:(n>>8)&255, b:n&255 };
      }
      if (c.startsWith('rgb')){
        const m = c.match(/rgba?\(([^)]+)\)/i);
        const p = m ? m[1].split(',').map(v=>parseFloat(v)) : [0,0,0];
        return { r:p[0]||0, g:p[1]||0, b:p[2]||0 };
      }
      const tmp = document.createElement('div');
      tmp.style.color = c;
      document.body.appendChild(tmp);
      const cs = getComputedStyle(tmp).color;
      document.body.removeChild(tmp);
      return toRGB(cs);
    };
    const {r,g,b} = toRGB(bgColor);
    const srgb = [r,g,b].map(v => {
      v/=255; return v<=0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4);
    });
    const L = 0.2126*srgb[0] + 0.7152*srgb[1] + 0.0722*srgb[2];
    return L > 0.55 ? '#000000' : '#FFFFFF';
  }

  // ====== Pan (mousemove) ======
  function enableMousePan(container, track) {
    if (!container || !track) return { enable(){}, disable(){}, isEnabled(){ return true; } };

    let enabled = true;
    const toX = gsap.quickTo(track, "x", { duration: 0.6, ease: "power3.out" });
    gsap.set(track, { x: 0 });

    function getMaxX() {
      const max = Math.max(0, track.scrollWidth - container.clientWidth);
      return -max;
    }
    function onMove(e) {
      if (!enabled) return;
      const rect = container.getBoundingClientRect();
      const relX = (e.clientX - rect.left) / rect.width;
      const target = getMaxX() * relX;
      toX(target);
    }
    const onLeave  = () => enabled && toX(0);
    const onResize = () => enabled && toX(0);

    container.addEventListener('mousemove', onMove, { passive: true });
    container.addEventListener('mouseleave', onLeave, { passive: true });
    window.addEventListener('resize', onResize);

    return {
      enable(){ enabled = true; },
      disable(){ enabled = false; },
      isEnabled(){ return enabled; }
    };
  }

  // === FX Layer ==========================================================
  let fxLayer;       // <div class="fx-layer"> unique sur la home
  let currentTL;     // timeline GSAP en cours
  let currentSprites = [];

  function ensureFxLayer(parentSection){
    if (!fxLayer){
      if (getComputedStyle(parentSection).position === 'static') {
        parentSection.style.position = 'relative';
      }
      fxLayer = document.createElement('div');
      fxLayer.className = 'fx-layer';
      Object.assign(fxLayer.style, {
        position: 'absolute',
        inset: '0',
        pointerEvents: 'none',
        overflow: 'visible',
        zIndex: '4',
        outline: 'none',
        background: 'transparent'
      });
      parentSection.appendChild(fxLayer);
      forcePaint(fxLayer);
    }
  }

  function preload(srcs = []){
    srcs.forEach(s => { const i = new Image(); i.src = s; });
  }

  // Effet "rougail"
  // Effet "rougail" — B & C calqués sur A, avec petits offsets
function playFxRougail(images){
  const srcs = images.slice(0, 3);
  if (!srcs.length) return gsap.timeline();

  // même ease pour tous (doux et ciné)
  const tl = gsap.timeline({ defaults:{ ease: "expo.out" } });

  const layerRect  = fxLayer.getBoundingClientRect();
  const sliderRect = homeSlider.getBoundingClientRect();
  const vw = layerRect.width / 100;

  // Trajectoire de base (sprite A)
  const startBelowY  = sliderRect.bottom - layerRect.top + 260;
  const endAboveY    = sliderRect.top    - layerRect.top - 340;

  // X de référence = centre du slider
  const baseX = sliderRect.left - layerRect.left + sliderRect.width * 0.55;

  // Tailles (garde tes proportions)
  const sizesVW = [85, 8, 85];

  // Offsets et timings par sprite (calqués sur A)
  // dx en pixels (on utilise vw pour rester responsive)
  const cfg = [
    //    wVW,    dx,           dY start, dY end, rot0, s0,  s1,  dur,  delay
    { w:sizesVW[0], dx:  0*vw,  dy0:   0,  dy1:   0,  r0:-6, s0:.95, s1:1.00, dur:2.00, del:0.50 }, // A (référence)
    { w:sizesVW[1], dx: -8*vw,  dy0:-10,  dy1:-30,  r0:-4, s0:.93, s1:1.00, dur:2.05, del:0.92 }, // B (un peu à gauche + un peu plus haut)
    { w:sizesVW[2], dx:  19*vw,  dy0:-15,  dy1:-40,  r0: 56, s0:.93, s1:1.00, dur:2.10, del:1.04 }, // C (un peu à droite + encore un peu plus haut)
  ];

  // Créateur + anim
  function addSprite(src, {w, dx, dy0, dy1, r0, s0, s1, dur, del}){
    const el = document.createElement('img');
    el.className = 'fx-sprite';
    el.src = src;
    el.style.width = w + 'vw';
    fxLayer.appendChild(el);
    currentSprites.push(el);

    // État initial : même logique que A, mais décalée
    gsap.set(el, {
      x: baseX + dx,
      y: startBelowY + dy0,
      opacity: 0,
      rotation: r0,
      scale: s0
    });

    // Trajectoire : essentiellement verticale (comme A) + offsets
    tl.to(el, {
      x: baseX + dx,                 // même X (avec décalage), trajectoire “calquée”
      y: endAboveY + dy1,            // monte au même endroit, un peu plus haut si dy1 < 0
      opacity: 1,
      rotation: 0,
      scale: s1,
      duration: dur
    }, del);
  }

  // A, B, C
  srcs.forEach((src, i) => addSprite(src, cfg[i]));

  return tl;
}


  // Effet "cards"
  function playFxCards(images, count){
    const tl = gsap.timeline({ defaults:{ ease: "power3.out" } });
    const rect = fxLayer.getBoundingClientRect();
    const cx = rect.width / 2;
    const baseY = rect.height * 0.72;

    const spread = 40;
    const startRot = -spread/2;

    for (let i = 0; i < count; i++){
      const src = images[i % images.length];
      const img = document.createElement('img');
      img.className = 'fx-sprite';
      img.src = src;
      fxLayer.appendChild(img);
      currentSprites.push(img);

      const angle = startRot + (spread/(Math.max(1, count-1))) * i;
      const radius = rand(40, 120);
      const x = cx + rand(-80, 80);
      const y = baseY;

      gsap.set(img, { x, y, rotation: angle * 0.6, opacity: 0, scale: 0.7 });
      tl.to(img, { y: y - radius, rotation: angle, opacity: 1, scale: 1, duration: rand(0.5, 0.8) }, i * 0.07);
    }
    return tl;
  }

  function buildFx(slide){
    const type = (slide.dataset.fx || '').toLowerCase();
    const imgs = (slide.dataset.fxImages || '').split('|').map(s => s.trim()).filter(Boolean);
    const count = Number(slide.dataset.fxCount || (type === 'rougail' ? 9 : 6));
    if (!type || !imgs.length) return null;

    preload(imgs);

    switch (type){
      case 'rougail': return () => playFxRougail(imgs);
      case 'cards'  : return () => playFxCards(imgs, count);
      default       : return null;
    }
  }

  // Lance un effet — attend un frame pour stabiliser les rects
let _fxSwitchToken = 0; // pour annuler une transition si l'utilisateur bouge vite

function playEffectForSlide(slide, parentSection){
  ensureFxLayer(parentSection);
  const switchToken = ++_fxSwitchToken;

  // 1) ranger l'effet courant en douceur (700 ms)
  clearEffect(false, 700).then(() => {
    // si un nouveau hover est arrivé entre-temps, on abandonne
    if (switchToken !== _fxSwitchToken) return;

    // 2) attendre 2 frames pour des rects stables
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const layerRect  = fxLayer.getBoundingClientRect();
        const sliderRect = homeSlider.getBoundingClientRect();
        if (!layerRect.width || !sliderRect.width) return;

        const make = buildFx(slide);
        if (!make) return;

        currentTL = make(); // nouveau FX
      });
    });
  });
}



function clearEffect(force = false, leaveMs = 600) {
  return new Promise((resolve) => {
    const cleanup = () => {
      currentSprites.forEach(el => el.remove());
      currentSprites = [];
      resolve();
    };

    if (!currentTL) { cleanup(); return; }

    if (force) {
      currentTL.kill();
      currentTL = null;
      cleanup();
      return;
    }

    // Sortie douce: reverse visible sur ≈ leaveMs
    const desired = Math.max(0.001, leaveMs / 1000);
    const elapsed = Math.max(0, currentTL.time());
    const speed   = elapsed > 0 ? (elapsed / desired) : 1;

    currentTL.timeScale(speed);
    currentTL.eventCallback("onReverseComplete", () => {
      currentTL = null;
      cleanup();
    });
    currentTL.reverse();
  });
}




// ====== Init comportements ======

// 1) Pan: ne l'initialise qu'une seule fois
const homePanCtl = enableMousePan(homeSlider, homeTrack);

// 2) Thème + FX (hover) — ok
enableHoverTheme(homeSlides, heroHome, homeView);

// 3) Clic slide = ouvrir projet
homeSlides.forEach(slide => {
  slide.addEventListener('click', e => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    goToProjectFromSlide(slide);
  });
});

// 4) Bouton retour
backBtn?.addEventListener('click', backToHome);

// 5) Back/forward navigateur
window.addEventListener('popstate', () => {
  const isHome = location.pathname === '/' || location.pathname === '';
  if (isHome) {
    projectView.hidden = true;
    gsap.set(appRail, { yPercent: 0 });
    return;
  }
  const target = [...homeSlides].find(s => s.getAttribute('href') === location.pathname);
  if (target) {
    fillProjectView(parseSlideData(target));
    projectView.hidden = false;
    gsap.set(appRail, { yPercent: -100 });
    enableMousePan($('.sliders_project', projectView), projectTrack);
  } else {
    projectView.hidden = false;
    gsap.set(appRail, { yPercent: -100 });
  }

  const btn = projectView.querySelector('.btn.view_site');
  if (btn) {
    if (window._initCTAMarquee && !btn._marqueeInit) window._initCTAMarquee(btn);
    else btn._marqueeRecalc && btn._marqueeRecalc();
  }
});

// 6) Post-load: sécurise les mesures (fonts/images) avant de jouer des FX
window.addEventListener('load', () => {
  // “Réveille” le layout pour éviter les rects à 0 au premier hover
  forcePaint(homeSlider);
  forcePaint(document.body);

  // (Optionnel) si tu veux, déclenche un hover “virtuel” sur la 1re slide pour fixer le thème
  // const first = homeSlides[0];
  // if (first) {
  //   const ev = new PointerEvent('pointerover', { bubbles: true });
  //   first.dispatchEvent(ev);
  // }
});

  // Thème + FX avec délégation AU NIVEAU DU SLIDER (sans désactiver le pan)
  function enableHoverTheme(slides, targetContainerEl, targetSectionEl = homeView) {
    if (!slides.length || !targetContainerEl || !homeSlider) return;

    const cs = getComputedStyle(targetContainerEl);
    const baseBG = cs.getPropertyValue('--bg').trim() || cs.backgroundColor;
    const baseFG = cs.getPropertyValue('--fg').trim() || cs.color;

    const setTheme = (bg, fg) => {
      targetContainerEl.style.setProperty('--bg', bg);
      targetContainerEl.style.setProperty('--fg', fg);
      if (targetSectionEl) {
        targetSectionEl.style.backgroundColor = bg;
        targetSectionEl.style.setProperty('--fg', fg);
      }
    };

    const applyFromSlide = (slide) => {
      const bg = slide.dataset.color || baseBG;
      const fg = slide.dataset.fg || autoContrast(bg);
      setTheme(bg, fg);
      playEffectForSlide(slide, targetSectionEl || homeView);
    };

    let currentSlide = null;

    homeSlider.addEventListener('pointerover', (e) => {
      const s = e.target.closest('.slide');
      if (!s || !homeSlider.contains(s)) return;
      if (currentSlide === s) return;
      currentSlide = s;
      applyFromSlide(s);
    });

    homeSlider.addEventListener('pointerleave', () => {
  currentSlide = null;
  setTheme(baseBG, baseFG);
  clearEffect(false, 900); // sortie lente quand on sort du slider
});




    // Accessibilité clavier
    slides.forEach(s => {
      s.addEventListener('focusin', () => {
        currentSlide = s;
        applyFromSlide(s);
      });
      s.addEventListener('focusout', () => {
        currentSlide = null;
        setTheme(baseBG, baseFG);
        clearEffect();
      });
    });
  }

  // Construit les items images pour le slider projet
  function buildProjectSlides(images, altBase = 'project image') {
    return images.map(src =>
      `<a class="slide" href="#" tabindex="-1"><img src="${src.trim()}" alt="${altBase}"></a>`
    ).join('');
  }

  // Crée le bouton "View site" sous le slider projet (une seule fois)
  function ensureProjectCTA(anchorEl) {
    if (!anchorEl) return null;
    let ctaWrap = projectView.querySelector('.project_cta');
    if (!ctaWrap) {
      ctaWrap = document.createElement('div');
      ctaWrap.className = 'project_cta';
    }
    if (ctaWrap.parentNode !== anchorEl.parentNode || ctaWrap.nextElementSibling !== anchorEl) {
      anchorEl.parentNode.insertBefore(ctaWrap, anchorEl);
    }
    let btn = ctaWrap.querySelector('.view_site');
    if (!btn) {
      btn = document.createElement('a');
      btn.className = 'btn view_site';
      btn.textContent = 'View site';
      btn.target = '_blank';
      btn.rel = 'noopener';
      ctaWrap.appendChild(btn);
    }
    return btn;
  }

  // Récupère les données d’une slide
  function parseSlideData(slideEl) {
    const title  = slideEl.dataset.title   || 'Project';
    const color  = slideEl.dataset.color   || '';
    const fg     = slideEl.dataset.fg      || '';
    const href   = slideEl.getAttribute('href') || '/project';
    const url    = slideEl.dataset.url || '';
    const images = (slideEl.dataset.images || '').split('|').filter(Boolean);

    const rawDesc = slideEl.dataset.desc || '';
    const parts   = rawDesc.includes('||') ? rawDesc.split('||') : [rawDesc, rawDesc];
    const p1 = (parts[0] || '').trim();
    const p2 = (parts[1] || parts[0] || '').trim();

    return { title, color, fg, href, url, images, p1, p2 };
  }

  // Remplit la vue projet + thème
  function fillProjectView(data) {
    if (projectTitle) projectTitle.textContent = data.title || '—';
    if (projectDesc) {
      const p1 = data.p1 ? `<p class="project_p1">${data.p1}</p>` : '';
      const p2 = data.p2 ? `<p class="project_p2">${data.p2}</p>` : '';
      projectDesc.innerHTML = p1 + p2;
    }

    if (heroProject) {
      const bg = data.color || getComputedStyle(heroProject).getPropertyValue('--bg').trim();
      const fg = (data.fg && data.fg.trim()) || autoContrast(bg);
      heroProject.style.setProperty('--bg', bg);
      heroProject.style.setProperty('--fg', fg);
      projectView.style.setProperty('--fg', fg);
      gsap.to(projectView, { backgroundColor: bg, duration: 0.6, ease: "power2.out" });
    }

    if (projectTrack) {
      projectTrack.innerHTML = buildProjectSlides(data.images, `${data.title} — image`);
      gsap.set(projectTrack.querySelectorAll('.slide'), { opacity: 0, y: 12 });
      gsap.to(projectTrack.querySelectorAll('.slide'), {
        opacity: 1, y: 0, duration: 0.5, stagger: 0.06, delay: 0.05, ease: "power2.out"
      });
    }

    const btn = ensureProjectCTA(projectSliderWrap);
    if (btn) btn.href = (data.url && data.url !== '') ? data.url : '#';
  }

  // Animation vers la vue projet
  async function goToProjectFromSlide(slideEl) {
    const data = parseSlideData(slideEl);
    fillProjectView(data);

    clearEffect(true); // nettoie la couche FX

    projectView.hidden = false;

    await gsap.to(appRail, {
      yPercent: -100,
      duration: 1.0,
      ease: "power3.inOut"
    });

    if (data.href) history.pushState({ view: 'project', href: data.href }, '', data.href);

    enableMousePan($('.sliders_project', projectView), projectTrack);

    const btn = projectView.querySelector('.btn.view_site');
    if (btn) {
      if (window._initCTAMarquee && !btn._marqueeInit) {
        window._initCTAMarquee(btn);
      } else if (btn._marqueeRecalc) {
        btn._marqueeRecalc();
      }
    }
  }

  // Retour home
  async function backToHome() {
    await gsap.to(appRail, {
      yPercent: 0,
      duration: 1.0,
      ease: "power3.inOut"
    });
    projectView.hidden = true;
    history.pushState({ view: 'home' }, '', '/');
  }

  // Init état sections
  homeView.style.backgroundColor    = homeBaseBG;
  projectView.style.backgroundColor = projectBaseBG;

  // Lancer comportements
  enableMousePan(homeSlider, homeTrack);        // pan actif
  enableHoverTheme(homeSlides, heroHome, homeView); // thème + FX

  // Clic slide = ouvrir projet
  homeSlides.forEach(slide => {
    slide.addEventListener('click', e => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      e.preventDefault();
      goToProjectFromSlide(slide);
    });
  });

  // Bouton retour
  backBtn?.addEventListener('click', backToHome);

  // Back/forward navigateur
  window.addEventListener('popstate', () => {
    const isHome = location.pathname === '/' || location.pathname === '';
    if (isHome) {
      projectView.hidden = true;
      gsap.set(appRail, { yPercent: 0 });
      return;
    }
    const target = [...homeSlides].find(s => s.getAttribute('href') === location.pathname);
    if (target) {
      fillProjectView(parseSlideData(target));
      projectView.hidden = false;
      gsap.set(appRail, { yPercent: -100 });
      enableMousePan($('.sliders_project', projectView), projectTrack);
    } else {
      projectView.hidden = false;
      gsap.set(appRail, { yPercent: -100 });
    }

    const btn = projectView.querySelector('.btn.view_site');
    if (btn) {
      if (window._initCTAMarquee && !btn._marqueeInit) window._initCTAMarquee(btn);
      else btn._marqueeRecalc && btn._marqueeRecalc();
    }
  });
})();

// === CTA "View site" : marquee =====
(() => {
  if (typeof gsap === "undefined") { console.warn("GSAP manquant."); return; }

  const debounce = (fn, wait=150) => { let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), wait); }; };

  function initCTA(btn) {
    if (!btn || btn._marqueeInit) return;
    btn._marqueeInit = true;

    const baseText = (btn.getAttribute('aria-label') || btn.textContent || 'VIEW SITE').toUpperCase();
    const sep = ' — ';
    btn.textContent = '';
    const track = document.createElement('span');
    track.className = 'marquee_track';
    btn.appendChild(track);

    const makeItem = () => {
      const el = document.createElement('span');
      el.className = 'marquee_item';
      el.textContent = baseText + sep;
      return el;
    };

    function fillTrack() {
      track.innerHTML = '';
      track.appendChild(makeItem());
      while (track.scrollWidth < btn.clientWidth * 3) {
        track.appendChild(makeItem());
      }
      track.innerHTML += track.innerHTML;
    }

    let pos = 0;
    let speed = Number(btn.dataset.speed || 90);
    let distance;
    let running = true;
    let slowFactor = 1;

    function recalc() {
      fillTrack();
      distance = track.scrollWidth / 2;
      pos = (pos % -distance) || 0;
      gsap.set(track, { x: pos });
    }

    requestAnimationFrame(() => requestAnimationFrame(recalc));

    const tick = (time, deltaMs) => {
      if (!running || !distance) return;
      const delta = (deltaMs || 16.7) / 1000;
      pos -= speed * slowFactor * delta;
      if (pos <= -distance) pos += distance;
      gsap.set(track, { x: pos });
    };
    gsap.ticker.add(tick);

    const slow = () => { slowFactor = 0.25; };
    const norm = () => { slowFactor = 1; };
    btn.addEventListener('mouseenter', slow);
    btn.addEventListener('mouseleave', norm);
    btn.addEventListener('focusin', slow);
    btn.addEventListener('focusout', norm);

    const onResize = debounce(recalc, 150);
    window.addEventListener('resize', onResize);

    btn._marqueeRecalc  = recalc;
    btn._marqueeDestroy = () => { running = false; gsap.ticker.remove(tick); window.removeEventListener('resize', onResize); };
  }

  window._initCTAMarquee = initCTA;
  document.querySelectorAll('.btn.view_site').forEach(initCTA);
})();


// == Contact Drawer (clic uniquement) ==
(() => {
  const btnContact = document.querySelector('.btn-contact');
  const appRail    = document.querySelector('.app-rail') || document.body;
  const panel      = document.getElementById('contact-panel');
  const scrim      = document.querySelector('.contact-scrim');
  const btnClose   = panel?.querySelector('.contact-close');
  if (!btnContact || !panel || !scrim) return;

  const getPanelWidth = () => Math.min(window.innerWidth * 0.5, 700);

  let lastFocused = null;
  const showForAnim = () => { panel.hidden = false; scrim.hidden = false; };
  const hideIfClosed = (tl) => { if (tl.progress() === 0) { panel.hidden = true; scrim.hidden = true; } };

  // timeline principale
  const tl = gsap.timeline({ paused: true, defaults: { duration: 0.5, ease: "power3.out" } });

  const build = () => {
    tl.clear();
    const w = getPanelWidth();

    gsap.set(panel, { x: '100%' });
    gsap.set(appRail, { x: 0 }); // on part de 0 en X
    gsap.set(scrim, { opacity: 0, pointerEvents: 'none' });

    tl.addLabel('start')
      .to(scrim, { opacity: 1, onStart: () => scrim.style.pointerEvents = 'auto' }, 'start')
      .to(panel, { x: 0 }, 'start')     // drawer glisse
      .to(appRail, { x: -w }, 'start'); // contenu poussé
  };

  showForAnim();
  build();
  hideIfClosed(tl);

  // conserve l'état au resize
  window.addEventListener('resize', () => {
    const p = tl.progress();
    const wasOpen = p > 0 && !tl.reversed();
    build();
    tl.progress(p);
    if (wasOpen) tl.progress(1);
    hideIfClosed(tl);
  });

  const openPanel = () => {
    showForAnim();
    lastFocused = document.activeElement;
    tl.play().then(() => {
      panel.querySelector('#contact-title')?.focus?.();
    });
  };

  const closePanel = () => {
    tl.reverse().then(() => {
      scrim.style.pointerEvents = 'none';
      hideIfClosed(tl);
      lastFocused?.focus?.();
    });
  };

  // clic pour ouvrir
  btnContact.addEventListener('click', (e) => {
    e.preventDefault();
    // toggle si déjà ouvert
    if (tl.progress() === 1 && !tl.reversed()) closePanel();
    else openPanel();
  });

  // moyens de fermer
  btnClose?.addEventListener('click', closePanel);
  scrim.addEventListener('click', closePanel);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closePanel(); });

  // (optionnel) ferme automatiquement quand tu passes sur la page "project"
  window.addEventListener('closeContact', closePanel);
})();


// ==== HEADLINE: reveal lettre par lettre — version 100% CSS ====
(function(){
  function splitLetters(el){
    if (!el || el._splitDone) return;
    el._splitDone = true;

    const text = el.textContent || '';
    el.textContent = '';

    const frag = document.createDocumentFragment();
    for (let i = 0; i < text.length; i++){
      const ch = text[i];
      if (ch === ' ') { frag.appendChild(document.createTextNode('\u00A0')); continue; }

      const wrap = document.createElement('span');
      wrap.className = 'char-wrap';

      const inner = document.createElement('span');
      inner.className = 'char';
      // cadence : 0.05s entre chaque lettre
      inner.style.animationDelay = (i * 0.05) + 's';
      inner.textContent = ch;

      wrap.appendChild(inner);
      frag.appendChild(wrap);
    }
    el.appendChild(frag);
  }

  // Lance dès que le DOM est prêt (même si GSAP n'est pas chargé)
  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', () => {
      document.querySelectorAll('.js-reveal').forEach(splitLetters);
    });
  } else {
    document.querySelectorAll('.js-reveal').forEach(splitLetters);
  }
})();




