// js/script.js

/* =========================================================
   ROUTER HASH (mode + project)
   formats:
   - #web
   - #video
   - #web:project-1
   - #video:video-project-1
========================================================= */
function parseAppHash() {
  const raw = (location.hash || '').replace('#', '').trim();
  if (!raw) return { mode: 'web', slug: '' };

  const [a, b] = raw.split(':');
  const mode = (a && a.toLowerCase().startsWith('video')) ? 'video' : 'web';
  const slug = (b || '').trim();
  return { mode, slug };
}

function setHash(mode, slug = '', replace = false) {
  const m = (mode === 'video') ? 'video' : 'web';
  const h = slug ? `#${m}:${slug}` : `#${m}`;
  if (replace) history.replaceState(history.state || {}, '', h);
  else history.pushState(history.state || {}, '', h);
}

/* =========================================================
   MODE SWITCH WEB <-> VIDEO (glisse horizontalement)
========================================================= */
(() => {
  const modesTrack = document.querySelector('.app-modes');
  if (!modesTrack) return;

  function setMode(mode, animate = true) {
    document.body.dataset.mode = mode;
    const targetX = (mode === 'video') ? -window.innerWidth : 0;

    if (typeof gsap === 'undefined' || !animate) {
      modesTrack.style.transform = `translate3d(${targetX}px,0,0)`;
      return;
    }
    gsap.to(modesTrack, { x: targetX, duration: 1.0, ease: "power3.inOut" });
  }

  // INIT depuis hash
  const init = parseAppHash();
  setMode(init.mode, false);

  // clic nav (webdesign / videomaker)
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a.webdesign, a.videomaker');
    if (!a) return;

    e.preventDefault();

    if (a.classList.contains('webdesign')) {
      setHash('web', '', false);
      setMode('web', true);
    } else {
      setHash('video', '', false);
      setMode('video', true);
    }
  });

  // back/forward + hash change
  window.addEventListener('popstate', () => {
    const s = parseAppHash();
    setMode(s.mode, true);
  });

  window.addEventListener('hashchange', () => {
    const s = parseAppHash();
    setMode(s.mode, true);
  });

  window.addEventListener('resize', () => {
    const s = parseAppHash();
    setMode(s.mode, false);
  });
})();

/* =========================================================
   INIT PORTFOLIO (scopé par .portfolio)
========================================================= */
(() => {
  const canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const isTouchDevice   = !canHover;
  const isTouchOrSmall  = !canHover;
  const isCoarsePointer = !canHover;

  const forcePaint = (el) => { if (el) void el.offsetHeight; };

  function autoContrast(bgColor) {
    const toRGB = (c) => {
      c = (c || '').trim();
      if (!c) return { r:0, g:0, b:0 };

      if (c.startsWith('#')) {
        let h = c.slice(1);
        if (h.length === 3) h = h.split('').map(x => x + x).join('');
        const n = parseInt(h, 16);
        return { r:(n>>16)&255, g:(n>>8)&255, b:n&255 };
      }
      if (c.startsWith('rgb')) {
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
      v /= 255;
      return v <= 0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4);
    });
    const L = 0.2126*srgb[0] + 0.7152*srgb[1] + 0.0722*srgb[2];
    return L > 0.55 ? '#000000' : '#FFFFFF';
  }

  function enableMousePan(container, track) {
    if (isCoarsePointer || !container || !track || typeof gsap === 'undefined') {
      return { enable(){}, disable(){}, isEnabled(){ return false; } };
    }

    let enabled = true;

    const currentTransform = getComputedStyle(track).transform;
    let startX = 0;
    if (currentTransform && currentTransform !== 'none') {
      const matrix = new DOMMatrix(currentTransform);
      startX = matrix.m41 || 0;
    }

    const toX = gsap.quickTo(track, "x", { duration: 0.6, ease: "power3.out" });
    gsap.set(track, { x: startX });

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

    container.addEventListener('mousemove', onMove, { passive: true });

    return {
      enable(){ enabled = true; },
      disable(){ enabled = false; },
      isEnabled(){ return enabled; }
    };
  }

  function buildProjectSlides(mediaList, altBase = 'project media') {
    return (mediaList || []).map(src => {
      const trimmed = (src || '').trim();
      const low = trimmed.toLowerCase();
      if (!trimmed) return '';

      const isVideo =
        low.endsWith('.mp4') ||
        low.endsWith('.webm') ||
        low.endsWith('.mov') ||
        low.includes('video');

      if (isVideo) {
        return `
          <a class="slide" href="#" tabindex="-1">
            <video class="project-video" autoplay muted loop playsinline style="pointer-events: none; width: 100%; height: 100%; object-fit: cover;">
              <source src="${trimmed}" type="video/mp4">
            </video>
          </a>
        `;
      }

      return `
        <a class="slide" href="#" tabindex="-1">
          <img src="${trimmed}" alt="${altBase}">
        </a>
      `;
    }).join('');
  }

  // Loop infini mobile + évite nav clones
  function initInfiniteSlider(container, track) {
    if (!container || !track) return;
    if (track.dataset.loopInit === '1') return;

    const slides = Array.from(track.children);
    if (slides.length < 2) return;

    const originalWidth = track.scrollWidth;

    slides.forEach((slide) => {
      const clone = slide.cloneNode(true);
      clone.setAttribute('data-clone', '1');
      if (clone.tagName.toLowerCase() === 'a') clone.setAttribute('href', '#');
      track.appendChild(clone);
    });

    track.dataset.loopInit = '1';

    let ticking = false;
    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const max = originalWidth;
        const left = container.scrollLeft;

        if (left >= max) container.scrollLeft = left - max;
        else if (left <= 0) container.scrollLeft = left + max;

        ticking = false;
      });
    }

    container.addEventListener('scroll', onScroll, { passive: true });
  }

  function initPortfolio(root){
    const appRail     = root.querySelector('.app-rail');
    const homeView    = root.querySelector('.view--home');
    const projectView = root.querySelector('.view--project');
    if (!appRail || !homeView || !projectView) return;

    const heroHome    = homeView.querySelector('.container');
    const heroProject = projectView.querySelector('.container');
    const backBtn     = projectView.querySelector('.back_to_home');

    const homeSlider  = root.querySelector('.sliders_works');
    const homeTrack   = root.querySelector('.slides_track');
    const homeSlides  = root.querySelectorAll('.slides_track .slide');

    const projectTrack      = projectView.querySelector('.project_track');
    const projectTitle      = projectView.querySelector('.project_title');
    const projectDesc       = projectView.querySelector('.project_desc');
    const projectSliderWrap = projectView.querySelector('.sliders_project');

    let projectPanInstance = null;

    const lightbox        = document.querySelector('.lightbox');
    const lightboxContent = lightbox?.querySelector('.lightbox__content');

    const homeBaseBG    = getComputedStyle(homeView).backgroundColor;
    const projectBaseBG = getComputedStyle(projectView).backgroundColor;

    const $ = (s, el = root) => el.querySelector(s);

    // -------- FX (Rougail / Cards) --------
    let fxLayer;
    let currentTL = null;
    let currentSprites = [];
    let _fxSwitchToken = 0;

    function ensureFxLayer(parentSection){
      if (isTouchOrSmall) return;
      if (!fxLayer){
        if (getComputedStyle(parentSection).position === 'static') parentSection.style.position = 'relative';
        fxLayer = document.createElement('div');
        fxLayer.className = 'fx-layer';
        Object.assign(fxLayer.style, {
          position: 'absolute',
          inset: '0',
          pointerEvents: 'none',
          overflow: 'hidden',
          zIndex: '4',
          background: 'transparent'
        });
        parentSection.appendChild(fxLayer);
        forcePaint(fxLayer);
      }
    }

    function preload(srcs = []){
      srcs.forEach(s => { const i = new Image(); i.src = s; });
    }

    function clearEffect(force = false, leaveMs = 600) {
      return new Promise((resolve) => {
        const sprites = currentSprites.slice();
        currentSprites = [];

        if (currentTL) { currentTL.kill(); currentTL = null; }

        if (force || !sprites.length || leaveMs <= 0 || typeof gsap === 'undefined') {
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

    function playFxRougail(images){
      if (typeof gsap === 'undefined' || !fxLayer || !homeSlider) return gsap.timeline();
      if (!images?.length) return gsap.timeline();

      const tl = gsap.timeline({ defaults:{ ease: "expo.out" } });
      const layerRect  = fxLayer.getBoundingClientRect();
      const sliderRect = homeSlider.getBoundingClientRect();

      const startBelowY  = sliderRect.bottom - layerRect.top + 260;
      const endAboveY    = sliderRect.top    - layerRect.top - 340;
      const baseX        = sliderRect.left   - layerRect.left + sliderRect.width * 0.55;

      const el = document.createElement('img');
      el.className = 'fx-sprite';
      el.src = images[0];
      el.style.width = '85vw';
      fxLayer.appendChild(el);
      currentSprites.push(el);

      gsap.set(el, { x: baseX, y: startBelowY, opacity: 0, rotation: -6, scale: 0.95 });
      tl.to(el, { x: baseX, y: endAboveY, opacity: 1, rotation: 0, scale: 1, duration: 2.0 }, 0.5);

      return tl;
    }

    function playFxCards(images, count){
      if (typeof gsap === 'undefined' || !fxLayer || !homeSlider) return gsap.timeline();
      if (!images?.length) return gsap.timeline();

      const tl = gsap.timeline({ defaults:{ ease: "power3.out" } });
      const layerRect  = fxLayer.getBoundingClientRect();
      const sliderRect = homeSlider.getBoundingClientRect();
      const cx = sliderRect.left - layerRect.left + sliderRect.width / 2;

      const cardConfigs = [
        { offsetX: 140, startOffset: 80,  endOffset: -180, duration: 2.2,  scaleStart: 0.85, scaleEnd: 1 },
        { offsetX: 420, startOffset: 110, endOffset: -410, duration: 2.75, scaleStart: 0.5,  scaleEnd: 0.4 }
      ];

      const maxCards = 2;
      const cards = Math.min(maxCards, count || maxCards, images.length);

      for (let i = 0; i < cards; i++){
        const cfg = cardConfigs[i] || cardConfigs[0];
        const src = images[i % images.length];

        const img = document.createElement('img');
        img.className = 'fx-sprite';
        img.src = src;
        fxLayer.appendChild(img);
        currentSprites.push(img);

        const startY = sliderRect.bottom - layerRect.top + cfg.startOffset;
        const endY   = sliderRect.top   - layerRect.top + cfg.endOffset;

        gsap.set(img, { x: cx + cfg.offsetX, y: startY, opacity: 0, scale: cfg.scaleStart, rotation: 0 });
        tl.to(img, { y: endY, opacity: 1, scale: cfg.scaleEnd, duration: cfg.duration }, i * 0.12);
      }

      return tl;
    }

    function buildFx(slide){
      const projectId = (slide.dataset.project || '').toLowerCase();
      if (projectId === 'ardko') return null;

      const type  = (slide.dataset.fx || '').toLowerCase();
      const imgs  = (slide.dataset.fxImages || '').split('|').map(s => s.trim()).filter(Boolean);
      const count = Number(slide.dataset.fxCount || (type === 'rougail' ? 8 : 6));
      if (!type || !imgs.length) return null;

      preload(imgs);
      if (type === 'rougail') return () => playFxRougail(imgs);
      if (type === 'cards')  return () => playFxCards(imgs, count);
      return null;
    }

    function playEffectForSlide(slide, parentSection){
      if (isTouchOrSmall) return;
      ensureFxLayer(parentSection);
      const switchToken = ++_fxSwitchToken;

      clearEffect(false, 700).then(() => {
        if (switchToken !== _fxSwitchToken) return;

        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            if (!fxLayer) return;
            const make = buildFx(slide);
            if (!make) return;
            currentTL = make();
          });
        });
      });
    }

    // -------- Lightbox --------
    function showLightbox() {
      if (!lightbox || !lightboxContent) return;
      lightbox.hidden = false;
      lightbox.classList.add('is-open');
      if (typeof gsap !== 'undefined') {
        gsap.fromTo(lightboxContent, { scale: 0.95, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.25, ease: 'power3.out' });
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

      const source = document.createElement('source');
      source.src = src;
      source.type = 'video/mp4';
      video.appendChild(source);

      const isFilmmaker = document.body.dataset.mode === 'video';

      if (isFilmmaker) {
        video.controls = true;
        video.autoplay = true;
        video.muted = false;
        video.loop = false;
      } else {
        video.controls = false;
        video.autoplay = true;
        video.muted = true;
        video.loop = true;
        video.playsInline = true;
      }

      lightboxContent.appendChild(video);
      showLightbox();
    }

    // -------- Hover theme + FX (desktop) --------
    function enableHoverTheme(slides, targetContainerEl, targetSectionEl = homeView) {
      if (!canHover) return;
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
        document.documentElement.style.setProperty('--cursor-color', fg);
      };

      const isArdkoSlide = (slide) => (slide.dataset.project || '').toLowerCase() === 'ardko';
      const isHoloraSlide = (slide) =>
        (slide.dataset.project || '').toLowerCase() === 'holora' ||
        (slide.dataset.title || '').toLowerCase() === 'holora';

      function applyFromSlide(slide) {
        if (slide.dataset.clone === '1') return;

        let bg = slide.dataset.color || baseBG;
        let fg = slide.dataset.fg || autoContrast(bg);

        playEffectForSlide(slide, targetSectionEl || homeView);

        if (isHoloraSlide(slide)) { bg = '#000000'; fg = '#ffffff'; }

        setTheme(bg, fg);

        if (isArdkoSlide(slide)) document.body.classList.add('is-grain-ardko');
        else if (!document.body.classList.contains('is-project-ardko')) document.body.classList.remove('is-grain-ardko');

        if (isHoloraSlide(slide)) document.body.classList.add('glitch-active');
        else if (!document.body.classList.contains('is-project-holora')) document.body.classList.remove('glitch-active');
      }

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

        if (!document.body.classList.contains('is-project-ardko')) document.body.classList.remove('is-grain-ardko');
        if (!document.body.classList.contains('is-project-holora')) document.body.classList.remove('glitch-active');

        clearEffect(false, 900);
      });
    }

    // -------- Project view fill --------
    function parseSlideData(slideEl) {
      const title  = slideEl.dataset.title || 'Project';
      const color  = slideEl.dataset.color || '';
      const fg     = slideEl.dataset.fg || '';
      const href   = slideEl.getAttribute('href') || '';
      const url    = slideEl.dataset.url || '';
      const images = (slideEl.dataset.images || '').split('|').filter(Boolean);

      const rawDesc = slideEl.dataset.desc || '';
      const parts   = rawDesc.includes('||') ? rawDesc.split('||') : [rawDesc, rawDesc];
      const p1 = (parts[0] || '').trim();
      const p2 = (parts[1] || parts[0] || '').trim();

      return { title, color, fg, href, url, images, p1, p2 };
    }

    // ✅ MODIF 1: fillProjectView ne fait PLUS l'init marquee (juste href)

    
    function fillProjectView(data) {
    // On cherche le titre spécifiquement dans le portfolio parent (root)
    const titleEl = root.querySelector('.project_title');
    
    if (titleEl) {
        titleEl.textContent = data.title || '—';
        
        // On vérifie le texte exact (attention aux majuscules/minuscules)
        if (data.title.toUpperCase() === "UNE VIE DE MOUCHE") {
            titleEl.classList.add('title--small');
        } else {
            titleEl.classList.remove('title--small');
        }
    }

    if (projectDesc) {
        const p1 = data.p1 ? `<p class="project_p1">${data.p1}</p>` : '';
        const p2 = data.p2 ? `<p class="project_p2">${data.p2}</p>` : '';
        projectDesc.innerHTML = p1 + p2;
    }

      if (heroProject) {
        const bg = data.color || '#000000';
        const fg = (data.fg && data.fg.trim()) || autoContrast(bg);

        heroProject.style.setProperty('--bg', bg);
        heroProject.style.setProperty('--fg', fg);

        projectView.style.setProperty('--bg', bg);
        projectView.style.setProperty('--fg', fg);

        document.documentElement.style.setProperty('--cursor-color', fg);
      }

      if (projectTrack) {
        projectTrack.innerHTML = buildProjectSlides(data.images, `${data.title} — image`);

        if (typeof gsap !== 'undefined') {
          const slides = projectTrack.querySelectorAll('.slide');
          gsap.set(slides, { opacity: 0, y: 12 });
          gsap.to(slides, {
            opacity: 1,
            y: 0,
            duration: 0.5,
            stagger: 0.06,
            delay: 0.05,
            ease: "power2.out"
          });
        }
      }

      // ✅ bouton: seulement href ici
      const btn = projectView.querySelector('.btn.view_site');
      if (btn) btn.href = (data.url && data.url !== '') ? data.url : '#';
    }

    // -------- Navigation between views --------
    let _isOpeningFromHash = false;

    // ✅ MODIF 2: init marquee APRES projectView.hidden = false
    async function goToProjectFromSlide(slideEl, { updateHash = true } = {}) {
      const data = parseSlideData(slideEl);

      // remplit contenu
      fillProjectView(data);

      // rend visible
      projectView.hidden = false;

      // ✅ init/recalc marquee quand visible (double RAF = ultra safe)
      const btn = projectView.querySelector('.btn.view_site');
      if (btn && window._initCTAMarquee) {
        window._initCTAMarquee(btn);
        requestAnimationFrame(() => requestAnimationFrame(() => {
          if (btn._marqueeRecalc) btn._marqueeRecalc();
        }));
      }

      root.classList.add('is-project-open');

      void appRail.offsetWidth;

      if (typeof gsap !== 'undefined') {
        await gsap.to(appRail, { y: -window.innerHeight, duration: 1.0, ease: "power3.inOut" });
      } else {
        appRail.style.transform = `translateY(${-window.innerHeight}px)`;
      }

      if (updateHash && data.href) {
        const mode = (document.body.dataset.mode === 'video') ? 'video' : 'web';
        const slug = String(data.href).replace(/^\//,'').replace(/^#/,'');
        _isOpeningFromHash = true;
        setHash(mode, slug, true);
        _isOpeningFromHash = false;
      }

      if (!projectPanInstance) {
        projectPanInstance = enableMousePan($('.sliders_project', projectView), projectTrack);
      }

      if (isTouchOrSmall) initInfiniteSlider(projectSliderWrap, projectTrack);
    }

    async function backToHome({ updateHash = true } = {}) {
      root.classList.remove('is-project-open');

      const bgVideo = root.querySelector('.bg-video-wrap video');
      if (bgVideo) bgVideo.play().catch(() => {});

      if (typeof gsap !== 'undefined') {
        await gsap.to(appRail, { y: 0, duration: 1.0, ease: "power3.inOut" });
      } else {
        appRail.style.transform = 'translateY(0px)';
      }



      projectView.hidden = true;

      if (updateHash) {
        const mode = (document.body.dataset.mode === 'video') ? 'video' : 'web';
        setHash(mode, '', true);
      }

      homeView.style.backgroundColor = homeBaseBG;
      projectView.style.backgroundColor = 'transparent';
    }

    // -------- Click handlers --------
    homeView.style.backgroundColor    = homeBaseBG;
    projectView.style.backgroundColor = projectBaseBG;

    if (homeSlider && homeTrack) enableMousePan(homeSlider, homeTrack);
    if (!isTouchDevice) enableHoverTheme(homeSlides, heroHome, homeView);

    homeSlider?.addEventListener('click', (e) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;

      const slide = e.target.closest('.slide');
      if (!slide || !homeSlider.contains(slide)) return;

      if (slide.dataset.clone === '1') {
        e.preventDefault();
        return;
      }

      e.preventDefault();
      goToProjectFromSlide(slide, { updateHash: true });
    });

    backBtn?.addEventListener('click', () => backToHome({ updateHash: true }));

    if (projectTrack && lightbox) {
      projectTrack.addEventListener('click', (e) => {
        const slide = e.target.closest('.slide');
        if (!slide) return;
        e.preventDefault();

        const vid = slide.querySelector('video');
        const img = slide.querySelector('img');

        if (vid) {
          const src = vid.currentSrc || vid.src || (vid.querySelector('source')?.src) || '';
          if (src) openLightboxVideo(src);
        } else if (img) {
          openLightboxImage(img.src, img.alt || '');
        }
      });
    }

    if (lightbox) {
      lightbox.addEventListener('click', (e) => {
        if (e.target === lightbox || e.target.classList.contains('lightbox__backdrop')) closeLightbox();
      });
    }
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeLightbox(); });

    if (isTouchOrSmall) {
      window.addEventListener('load', () => initInfiniteSlider(homeSlider, homeTrack));
    }

    // -------- HASH ROUTER for THIS portfolio --------
    function portfolioMode() {
      return root.classList.contains('portfolio--video') ? 'video' : 'web';
    }

    function findSlideBySlug(slug) {
      if (!slug) return null;
      const selector = `.sliders_works .slide:not([data-clone="1"])[href="${slug}"], .sliders_works .slide:not([data-clone="1"])[href="/${slug}"], .sliders_works .slide:not([data-clone="1"])[href="#${slug}"]`;
      return root.querySelector(selector);
    }

    function syncFromHash() {
      const { mode, slug } = parseAppHash();
      if (mode !== portfolioMode()) return;

      if (!slug) {
        backToHome({ updateHash: false });
        return;
      }

      const slide = findSlideBySlug(slug);
      if (!slide) return;

      goToProjectFromSlide(slide, { updateHash: false });
    }

    window.addEventListener('load', () => {
      const { slug } = parseAppHash();
      if (slug) syncFromHash();
    });

    window.addEventListener('hashchange', () => {
      if (_isOpeningFromHash) return;
      syncFromHash();
    });
    window.addEventListener('popstate', () => {
      if (_isOpeningFromHash) return;
      syncFromHash();
    });
  }

  document.querySelectorAll('.portfolio').forEach(initPortfolio);
})();

/* =========================================================
   Contact Drawer (push .app-modes)
========================================================= */
(() => {
  const panel = document.getElementById('contact-panel');
  const scrim = document.querySelector('.contact-scrim');
  const btnClose = panel?.querySelector('.contact-close');
  const modesTrack = document.querySelector('.app-modes');

  if (!panel || !scrim || !modesTrack || typeof gsap === 'undefined') return;

  const getPanelWidth = () => Math.min(window.innerWidth * 0.5, 700);

  const showForAnim = () => { panel.hidden = false; scrim.hidden = false; };
  const hideIfClosed = (tl) => { if (tl.progress() === 0) { panel.hidden = true; scrim.hidden = true; } };

  const tl = gsap.timeline({ paused: true, defaults: { duration: 0.5, ease: "power3.out" } });

  const build = () => {
    tl.clear();
    const w = getPanelWidth();

    gsap.set(panel, { x: '100%' });
    gsap.set(modesTrack, { x: gsap.getProperty(modesTrack, "x") || 0 });
    gsap.set(scrim, { opacity: 0, pointerEvents: 'none' });

    tl.addLabel('start')
      .to(scrim, { opacity: 1, onStart: () => { scrim.style.pointerEvents = 'auto'; } }, 'start')
      .to(panel, { x: 0 }, 'start')
      .to(modesTrack, { x: `-=${w}` }, 'start');
  };

  showForAnim();
  build();
  hideIfClosed(tl);

  window.addEventListener('resize', () => {
    const p = tl.progress();
    const wasOpen = p > 0 && !tl.reversed();
    build();
    tl.progress(p);
    if (wasOpen) tl.progress(1);
    hideIfClosed(tl);
  });

  const openPanel = () => { showForAnim(); tl.play(); };
  const closePanel = () => {
    tl.reverse().then(() => {
      scrim.style.pointerEvents = 'none';
      hideIfClosed(tl);
    });
  };

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-contact');
    if (!btn) return;
    e.preventDefault();
    if (tl.progress() === 1 && !tl.reversed()) closePanel();
    else openPanel();
  });

  btnClose?.addEventListener('click', closePanel);
  scrim.addEventListener('click', closePanel);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closePanel(); });
})();

/* =========================================================
   CTA "View site" : marquee (FIX DEFINITIF)
========================================================= */
(() => {
  if (typeof gsap === "undefined") return;

  function initCTA(btn) {
    if (!btn) return;

    // ✅ vitesse lisible par défaut
    const speed = Number(btn.dataset.speed || 18); // <<<<<< ICI (plus petit = plus lent)

    // Si déjà initialisé -> on force juste un recalc + on relance le ticker si besoin
    if (btn._marqueeInit) {
      btn._marqueeSpeed = speed;
      if (btn._marqueeRecalc) btn._marqueeRecalc();
      if (btn._marqueeResume) btn._marqueeResume();
      return;
    }

    btn._marqueeInit = true;
    btn._marqueeSpeed = speed;

    const baseText = (btn.getAttribute('aria-label') || btn.textContent || 'LIVE SITE').toUpperCase();
    const sep = ' — ';

    // construit la structure
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

    // ✅ remplissage (ne dépend pas du width)
    function fillTrack() {
      track.innerHTML = '';
      for (let i = 0; i < 18; i++) track.appendChild(makeItem());
      track.innerHTML += track.innerHTML; // double pour loop
    }

    let pos = 0;
    let distance = 0;
    let slowFactor = 1;
    let running = true;

    function recalc() {
      // si encore hidden => on retente
      if (btn.clientWidth <= 0) {
        requestAnimationFrame(recalc);
        return;
      }

      fillTrack();
      distance = track.scrollWidth / 2;

      // fallback safety
      if (!distance) {
        btn.textContent = baseText;
        return;
      }

      pos = 0;
      gsap.set(track, { x: pos });
    }

    // ✅ Remplace l'ancienne fonction tick par celle-ci :
const tick = (_t, delta) => {
  if (!running || !distance) return;

  // On utilise une vitesse très basse (0.5 à 1.5)
  // On divise par 10 pour être sûr que même avec un delta élevé, ça reste lent
  const baseSpeed = (btn._marqueeSpeed || 2) / 10; 
  
  pos -= baseSpeed * slowFactor; 

  if (pos <= -distance) pos += distance;
  gsap.set(track, { x: pos });
};

    // ✅ SUPER IMPORTANT : enlever un ancien ticker si un existe (évite vitesse x100)
    if (btn._tickerFn) gsap.ticker.remove(btn._tickerFn);
    btn._tickerFn = tick;
    gsap.ticker.add(btn._tickerFn);

    // ✅ on calcule au moment où c’est visible
    requestAnimationFrame(() => requestAnimationFrame(recalc));

    // hover slow
    const slow = () => { slowFactor = 0.25; };
    const norm = () => { slowFactor = 1; };

    btn.addEventListener('mouseenter', slow);
    btn.addEventListener('mouseleave', norm);
    btn.addEventListener('focusin', slow);
    btn.addEventListener('focusout', norm);

    // helpers (utilisés par ton fillProjectView)
    btn._marqueeRecalc = recalc;

    btn._marqueePause = () => { running = false; };
    btn._marqueeResume = () => { running = true; };

    btn._marqueeDestroy = () => {
      running = false;
      if (btn._tickerFn) {
        gsap.ticker.remove(btn._tickerFn);
        btn._tickerFn = null;
      }
    };
  }

  // expose
  window._initCTAMarquee = initCTA;

  // init au load (au cas où)
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.btn.view_site').forEach(initCTA);
  });
})();


/* =========================================================
   Curseur custom
========================================================= */
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

  const baseW = 12;
  const baseH = 12;
  const maxStretch = 3;
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

    if (dist > 0.01) targetAngle = Math.atan2(dy, dx) * (180 / Math.PI);

    currentX = e.clientX;
    currentY = e.clientY;
  }

  function animate() {
    const lerp = (a, b, f) => a + (b - a) * f;

    currentStretch = lerp(currentStretch, targetStretch, 0.15);
    currentAngle   = lerp(currentAngle,   targetAngle,   0.25);

    const width  = baseW * currentStretch;
    const height = baseH;

    cursor.style.width        = `${width}px`;
    cursor.style.height       = `${height}px`;
    cursor.style.borderRadius = `${height / 2}px`;

    const translate = `translate(${currentX}px, ${currentY}px)`;
    const center    = `translate(-50%, -50%)`;
    const rotate    = `rotate(${currentAngle}deg)`;

    cursor.style.transform = `${translate} ${center} ${rotate}`;
    requestAnimationFrame(animate);
  }

  window.addEventListener('mousemove', onMouseMove);
  requestAnimationFrame(animate);
});

/* =========================================================
   Preloader (anime app-modes)
========================================================= */
(() => {
  const preloader = document.getElementById('preloader');
  const modesTrack = document.querySelector('.app-modes');
  if (!preloader || !modesTrack || typeof gsap === 'undefined') return;

  const percentEl = preloader.querySelector('.preloader__percent');
  const counter   = { value: 0 };

  gsap.set(modesTrack, { yPercent: 100 });

  window.addEventListener('load', () => {
    const tl = gsap.timeline();

    tl.to(counter, {
      value: 100,
      duration: 2.2,
      ease: 'power2.out',
      onUpdate() { percentEl.textContent = `${Math.round(counter.value)}%`; }
    });

    tl.to(preloader, {
      yPercent: -100,
      duration: 1.0,
      ease: 'power3.inOut',
      onComplete() { preloader.remove(); }
    }, "-=0.3");

    tl.to(modesTrack, {
      yPercent: 0,
      duration: 1.0,
      ease: 'power3.inOut'
    }, "<");
  });
})();

