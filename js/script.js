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

  // Lightbox (overlay plein écran)
  const lightbox        = document.querySelector('.lightbox');
  const lightboxContent = lightbox?.querySelector('.lightbox__content');

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
  function playFxRougail(images){
    const srcs = images.slice(0, 3);
    if (!srcs.length) return gsap.timeline();

    const tl = gsap.timeline({ defaults:{ ease: "expo.out" } });

    const layerRect  = fxLayer.getBoundingClientRect();
    const sliderRect = homeSlider.getBoundingClientRect();
    const vw = layerRect.width / 100;

    const startBelowY  = sliderRect.bottom - layerRect.top + 260;
    const endAboveY    = sliderRect.top    - layerRect.top - 340;

    const baseX = sliderRect.left - layerRect.left + sliderRect.width * 0.55;

    const sizesVW = [85, 8, 85];

    const cfg = [
      { w:sizesVW[0], dx:  0*vw,  dy0:   0,  dy1:   0,  r0:-6, s0:.95, s1:1.00, dur:2.00, del:0.50 },
      { w:sizesVW[1], dx: -8*vw,  dy0:-10,  dy1:-30,  r0:-4, s0:.93, s1:1.00, dur:2.05, del:0.92 },
      { w:sizesVW[2], dx: 19*vw,  dy0:-15,  dy1:-40,  r0: 56, s0:.93, s1:1.00, dur:2.10, del:1.04 },
    ];

    function addSprite(src, {w, dx, dy0, dy1, r0, s0, s1, dur, del}){
      const el = document.createElement('img');
      el.className = 'fx-sprite';
      el.src = src;
      el.style.width = w + 'vw';
      fxLayer.appendChild(el);
      currentSprites.push(el);

      gsap.set(el, {
        x: baseX + dx,
        y: startBelowY + dy0,
        opacity: 0,
        rotation: r0,
        scale: s0
      });

      tl.to(el, {
        x: baseX + dx,
        y: endAboveY + dy1,
        opacity: 1,
        rotation: 0,
        scale: s1,
        duration: dur
      }, del);
    }

    srcs.forEach((src, i) => addSprite(src, cfg[i]));
    return tl;
  }

  // Effet "cards" (2 cartes only, trajectoires config)
  function playFxCards(images, count){
    if (typeof gsap === "undefined" || !fxLayer || !homeSlider) {
      return gsap.timeline();
    }

    const tl = gsap.timeline({ defaults:{ ease: "power3.out" } });

    const layerRect  = fxLayer.getBoundingClientRect();
    const sliderRect = homeSlider.getBoundingClientRect();

    const cx = sliderRect.left - layerRect.left + sliderRect.width / 2;

    const cardConfigs = [
      {
        offsetX: 140,
        startOffset: 80,
        endOffset: -180,
        duration: 2.2,
        scaleStart: 0.85,
        scaleEnd: 1
      },
      {
        offsetX: 420,
        startOffset: 110,
        endOffset: -410,
        duration: 2.75,
        scaleStart: 0.5,
        scaleEnd: 0.4
      }
    ];

    const maxCards = 2;
    const cards = Math.min(
      maxCards,
      count || maxCards,
      (images && images.length) || 0
    );

    if (!cards) return tl;

    for (let i = 0; i < cards; i++){
      const cfg = cardConfigs[i] || cardConfigs[cardConfigs.length - 1];
      const src = images[i % images.length];

      const img = document.createElement('img');
      img.className = 'fx-sprite';
      img.src = src;
      fxLayer.appendChild(img);
      currentSprites.push(img);

      const startY = sliderRect.bottom - layerRect.top + cfg.startOffset;
      const endY   = sliderRect.top   - layerRect.top + cfg.endOffset;

      gsap.set(img, {
        x: cx + cfg.offsetX,
        y: startY,
        opacity: 0,
        scale: cfg.scaleStart ?? 0.85,
        rotation: 0
      });

      tl.to(img, {
        y: endY,
        opacity: 1,
        scale: cfg.scaleEnd ?? 1,
        duration: cfg.duration
      }, i * 0.12);
    }

    return tl;
  }

  function buildFx(slide){
    const type  = (slide.dataset.fx || '').toLowerCase();
    const imgs  = (slide.dataset.fxImages || '').split('|').map(s => s.trim()).filter(Boolean);
    const count = Number(slide.dataset.fxCount || (type === 'rougail' ? 9 : 6));
    if (!type || !imgs.length) return null;

    preload(imgs);

    switch (type){
      case 'rougail': return () => playFxRougail(imgs);
      case 'cards' :  return () => playFxCards(imgs, count);
      default:        return null;
    }
  }

  let _fxSwitchToken = 0;

  function clearEffect(force = false, leaveMs = 600) {
    return new Promise((resolve) => {
      const sprites = currentSprites.slice();
      currentSprites = [];

      if (currentTL) {
        currentTL.kill();
        currentTL = null;
      }

      if (force || !sprites.length || leaveMs <= 0) {
        sprites.forEach(el => el.remove());
        resolve();
        return;
      }

      gsap.to(sprites, {
        y: '+=40',
        opacity: 0,
        duration: leaveMs / 1000,
        stagger: 0.03,
        ease: 'power2.inOut',
        onComplete() {
          sprites.forEach(el => el.remove());
          resolve();
        }
      });
    });
  }

  function playEffectForSlide(slide, parentSection){
    ensureFxLayer(parentSection);
    const switchToken = ++_fxSwitchToken;

    clearEffect(false, 700).then(() => {
      if (switchToken !== _fxSwitchToken) return;

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const layerRect  = fxLayer.getBoundingClientRect();
          const sliderRect = homeSlider.getBoundingClientRect();
          if (!layerRect.width || !sliderRect.width) return;

          const make = buildFx(slide);
          if (!make) return;

          currentTL = make();
        });
      });
    });
  }

  // ===== LIGHTBOX PROJET (image + vidéo) =====
  function showLightbox() {
    if (!lightbox || !lightboxContent) return;
    lightbox.hidden = false;
    lightbox.classList.add('is-open');

    if (typeof gsap !== 'undefined') {
      gsap.fromTo(lightboxContent,
        { scale: 0.95, opacity: 0 },
        { scale: 1, opacity: 1, duration: 0.25, ease: 'power2.out' }
      );
    }
  }

  function closeLightbox() {
    if (!lightbox || !lightboxContent) return;

    const vid = lightboxContent.querySelector('video');
    if (vid) vid.pause();

    lightbox.classList.remove('is-open');
    lightbox.hidden = true;
    lightboxContent.innerHTML = '';
  }

  function openLightboxImage(src, alt = '') {
    if (!lightbox || !lightboxContent) return;

    lightboxContent.innerHTML = '';
    const img = document.createElement('img');
    img.className = 'lightbox__media';
    img.src = src;
    img.alt = alt || '';
    lightboxContent.appendChild(img);

    showLightbox();
  }

  function openLightboxVideo(src) {
    if (!lightbox || !lightboxContent) return;

    lightboxContent.innerHTML = '';
    const video = document.createElement('video');
    video.className = 'lightbox__media';
    video.autoplay = true;
    video.muted = true;
    video.loop = true;
    video.playsInline = true;

    const source = document.createElement('source');
    source.src = src;
    source.type = 'video/mp4';

    video.appendChild(source);
    lightboxContent.appendChild(video);

    showLightbox();
  }

  // ===== Thème + FX au hover du slider home =====
  function enableHoverTheme(slides, targetContainerEl, targetSectionEl = homeView) {
    if (!slides.length || !targetContainerEl || !homeSlider) return;

    const cs = getComputedStyle(targetContainerEl);
    const baseBG = cs.getPropertyValue('--bg').trim() || cs.backgroundColor;
    const baseFG = cs.getPropertyValue('--fg').trim() || cs.color;

    document.documentElement.style.setProperty('--cursor-color', baseFG);

    const setTheme = (bg, fg) => {
      targetContainerEl.style.setProperty('--bg', bg);
      targetContainerEl.style.setProperty('--fg', fg);
      if (targetSectionEl) {
        targetSectionEl.style.backgroundColor = bg;
        targetSectionEl.style.setProperty('--fg', fg);
      }
      document.documentElement.style.setProperty('--cursor-color', fg);
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
      clearEffect(false, 900);
    });

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

  // Construit les items images/vidéos pour le slider projet
  function buildProjectSlides(mediaList, altBase = 'project media') {
    return mediaList.map(src => {
      const trimmed = src.trim().toLowerCase();

      const isVideo =
        trimmed.endsWith('.mp4') ||
        trimmed.endsWith('.webm') ||
        trimmed.endsWith('.mov') ||
        trimmed.includes('video');

      if (isVideo) {
        return `
          <a class="slide" href="#" tabindex="-1">
            <video class="project-video" autoplay muted loop playsinline>
              <source src="${src.trim()}" type="video/mp4">
            </video>
          </a>
        `;
      }

      return `
        <a class="slide" href="#" tabindex="-1">
          <img src="${src.trim()}" alt="${altBase}">
        </a>
      `;
    }).join('');
  }

  // Crée le bouton "View site" sous le slider projet
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

  // Remplit la vue projet + thème (SANS transition animée de couleur)
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

    // on pose directement les couleurs, sans gsap.to
    heroProject.style.setProperty('--bg', bg);
    heroProject.style.setProperty('--fg', fg);
    projectView.style.setProperty('--fg', fg);
    projectView.style.backgroundColor = bg;

    // curseur suit la couleur du projet
    document.documentElement.style.setProperty('--cursor-color', fg);
  }

  if (projectTrack) {
    projectTrack.innerHTML = buildProjectSlides(data.images, `${data.title} — image`);
    gsap.set(projectTrack.querySelectorAll('.slide'), { opacity: 0, y: 12 });
    gsap.to(projectTrack.querySelectorAll('.slide'), {
      opacity: 1,
      y: 0,
      duration: 0.5,
      stagger: 0.06,
      delay: 0.05,
      ease: "power2.out"
    });
  }

  const btn = ensureProjectCTA(projectSliderWrap);
  if (btn) btn.href = (data.url && data.url !== '') ? data.url : '#';
}


  // Animation vers la vue projet
  // Animation vers la vue projet
async function goToProjectFromSlide(slideEl) {
  const data = parseSlideData(slideEl);

  // On prépare tout le contenu + couleurs du projet
  fillProjectView(data);

  // On calcule et fixe déjà la couleur du curseur côté projet
  const projectBG = data.color || getComputedStyle(projectView).backgroundColor;
  const projectFG = data.fg || autoContrast(projectBG);
  document.documentElement.style.setProperty('--cursor-color', projectFG);

  // On nettoie les FX de la home
  clearEffect(true);

  // On rend la vue projet visible avant l’animation
  projectView.hidden = false;

  // Slide vers la vue projet
  await gsap.to(appRail, {
    yPercent: -100,
    duration: 1.0,
    ease: "power3.inOut"
  });

  // 🧷 Après l’anim, on RE-force la couleur du curseur au cas où un pointerleave la remettrait
  document.documentElement.style.setProperty('--cursor-color', projectFG);

  if (data.href) {
    history.pushState({ view: 'project', href: data.href }, '', data.href);
  }

  // Pan sur le slider projet
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
  // Retour home
async function backToHome() {
  await gsap.to(appRail, {
    yPercent: 0,
    duration: 1.0,
    ease: "power3.inOut"
  });

  projectView.hidden = true;
  history.pushState({ view: 'home' }, '', '/');

  // On reprend la couleur de la home pour le curseur
  if (heroHome) {
    const cs = getComputedStyle(heroHome);
    const homeBG = cs.getPropertyValue('--bg').trim() || cs.backgroundColor;
    const homeFG = cs.getPropertyValue('--fg').trim() || cs.color || autoContrast(homeBG);
    document.documentElement.style.setProperty('--cursor-color', homeFG);
  }
}


  // ===== Init comportements =====

  // Init état sections
  homeView.style.backgroundColor    = homeBaseBG;
  projectView.style.backgroundColor = projectBaseBG;

  // Pan home
  const homePanCtl = enableMousePan(homeSlider, homeTrack);

  // Thème + FX
  enableHoverTheme(homeSlides, heroHome, homeView);

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

  // Clic sur image/vidéo dans le slider projet = lightbox
  if (projectTrack && lightbox && lightboxContent) {
    projectTrack.addEventListener('click', (e) => {
      const img = e.target.closest('.slide img');
      const vid = e.target.closest('.slide video');

      if (img) {
        e.preventDefault();
        openLightboxImage(img.src, img.alt || '');
        return;
      }

      if (vid) {
        e.preventDefault();
        const src = vid.currentSrc || vid.src || (vid.querySelector('source')?.src) || '';
        if (src) openLightboxVideo(src);
      }
    });
  }

  // fermer en cliquant sur le fond sombre
  if (lightbox) {
    lightbox.addEventListener('click', (e) => {
      if (e.target === lightbox || e.target.classList.contains('lightbox__backdrop')) {
        closeLightbox();
      }
    });
  }

  // fermer avec Échap
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeLightbox();
    }
  });

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

  // Sécurise les mesures au load
  window.addEventListener('load', () => {
    forcePaint(homeSlider);
    forcePaint(document.body);
  });

})();

// == Contact Drawer (clic uniquement) ==
(() => {
  const btnContact = document.querySelector('.btn-contact');
  const appRail    = document.querySelector('.app-rail') || document.body;
  const panel      = document.getElementById('contact-panel');
  const scrim      = document.querySelector('.contact-scrim');
  const btnClose   = panel?.querySelector('.contact-close');

  // Si un des éléments n'existe pas ou pas de GSAP, on sort
  if (!btnContact || !panel || !scrim || typeof gsap === 'undefined') return;

  const getPanelWidth = () => Math.min(window.innerWidth * 0.5, 700);

  let lastFocused = null;

  const showForAnim = () => {
    panel.hidden = false;
    scrim.hidden = false;
  };

  const hideIfClosed = (tl) => {
    if (tl.progress() === 0) {
      panel.hidden = true;
      scrim.hidden = true;
    }
  };

  // Timeline principale
  const tl = gsap.timeline({
    paused: true,
    defaults: { duration: 0.5, ease: "power3.out" }
  });

  const build = () => {
    tl.clear();
    const w = getPanelWidth();

    gsap.set(panel, { x: '100%' });
    gsap.set(appRail, { x: 0 });
    gsap.set(scrim, { opacity: 0, pointerEvents: 'none' });

    tl.addLabel('start')
      .to(scrim, {
        opacity: 1,
        onStart: () => { scrim.style.pointerEvents = 'auto'; }
      }, 'start')
      .to(panel, { x: 0 }, 'start')
      .to(appRail, { x: -w }, 'start');
  };

  // Init
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

  // clic sur le bouton contact
  btnContact.addEventListener('click', (e) => {
    e.preventDefault();
    if (tl.progress() === 1 && !tl.reversed()) {
      closePanel();
    } else {
      openPanel();
    }
  });

  // boutons / overlay pour fermer
  btnClose?.addEventListener('click', closePanel);
  scrim.addEventListener('click', closePanel);

  // Esc pour fermer
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closePanel();
  });

  // hook optionnel
  window.addEventListener('closeContact', closePanel);
})();

// === CTA "View site" : marquee =====
(() => {
  if (typeof gsap === "undefined") {
    console.warn("GSAP manquant pour l'animation du bouton View site.");
    return;
  }

  const debounce = (fn, wait = 150) => {
    let t;
    return (...a) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...a), wait);
    };
  };

  function initCTA(btn) {
    if (!btn || btn._marqueeInit) return;
    btn._marqueeInit = true;

    const baseText = (btn.getAttribute('aria-label') || btn.textContent || 'VIEW SITE').toUpperCase();
    const sep = ' — ';

    // on remplace le contenu du bouton par la piste
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
      // on remplit jusqu'à avoir assez de largeur pour scroller
      while (track.scrollWidth < btn.clientWidth * 3) {
        track.appendChild(makeItem());
      }
      // on duplique pour le loop infini
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

    // recalc au prochain frame (le temps que le bouton prenne sa taille)
    requestAnimationFrame(() => requestAnimationFrame(recalc));

    const tick = (_time, deltaMs) => {
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
    btn._marqueeDestroy = () => {
      running = false;
      gsap.ticker.remove(tick);
      window.removeEventListener('resize', onResize);
    };
  }

  // on expose une fonction globale pour ré-initialiser si besoin (dans goToProjectFromSlide)
  window._initCTAMarquee = initCTA;

  // init sur les boutons déjà présents au chargement
  document.querySelectorAll('.btn.view_site').forEach(initCTA);
})();


// ==== CURSEUR CUSTOM ====
document.addEventListener('DOMContentLoaded', () => {
  const cursor = document.querySelector('.custom-cursor');
  if (!cursor) return;

  let lastX = window.innerWidth / 2;
  let lastY = window.innerHeight / 2;
  let currentX = lastX;
  let currentY = lastY;
  let lastTime = performance.now();

  let targetStretch = 1;
  let currentStretch = 1;

  let targetAngle = 0;
  let currentAngle = 0;

  const baseW = 12;     // largeur au repos
  const baseH = 12;     // hauteur au repos
  const maxStretch = 3; // largeur max relative
  const speedForMax = 1.2;

  function onMouseMove(e) {
    cursor.style.opacity = '1';

    const now = performance.now();
    const dt = now - lastTime || 16;

    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;

    lastTime = now;
    lastX = e.clientX;
    lastY = e.clientY;

    const dist = Math.hypot(dx, dy);
    const speed = dist / dt;

    const t = Math.min(speed / speedForMax, 1);
    targetStretch = 1 + (maxStretch - 1) * t;

    if (dist > 0.01) {
      targetAngle = Math.atan2(dy, dx) * (180 / Math.PI);
    }

    currentX = e.clientX;
    currentY = e.clientY;
  }

  function animate() {
    const lerp = (a, b, f) => a + (b - a) * f;

    currentStretch = lerp(currentStretch, targetStretch, 0.15);
    currentAngle = lerp(currentAngle, targetAngle, 0.25);

    const width = baseW * currentStretch;
    const height = baseH;

    cursor.style.width = `${width}px`;
    cursor.style.height = `${height}px`;
    cursor.style.borderRadius = `${height / 2}px`;

    const translate = `translate(${currentX}px, ${currentY}px)`;
    const center = `translate(-50%, -50%)`;
    const rotate = `rotate(${currentAngle}deg)`;

    cursor.style.transform = `${translate} ${center} ${rotate}`;

    requestAnimationFrame(animate);
  }

  window.addEventListener('mousemove', onMouseMove);
  requestAnimationFrame(animate);
});

