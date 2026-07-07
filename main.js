/* ===== Juan Pierazzoli — interacciones ===== */

/* El título principal sigue al mouse: se desplaza un poco hacia el cursor
   en 2D (parallax con suavizado/lag, sin inclinación). */
(function titleFollowsMouse() {
  const stage = document.querySelector(".header__stage");
  if (!stage) return;

  // Respeta a quien prefiere menos movimiento.
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const MAX_SHIFT = 40;   // px de desplazamiento máximo en cada eje
  const EASE      = 0.12; // 0..1 — más bajo = más lag

  // posición objetivo (target) y actual (current)
  let tx = 0, ty = 0;     // -0.5 .. 0.5 (relativo al centro de la ventana)
  let cx = 0, cy = 0;

  window.addEventListener("mousemove", (e) => {
    tx = e.clientX / window.innerWidth  - 0.5;
    ty = e.clientY / window.innerHeight - 0.5;
  }, { passive: true });

  // Al salir el mouse, vuelve al centro.
  window.addEventListener("mouseleave", () => { tx = 0; ty = 0; });

  function frame() {
    cx += (tx - cx) * EASE;
    cy += (ty - cy) * EASE;

    const shiftX = cx * MAX_SHIFT * 2;
    const shiftY = cy * MAX_SHIFT * 2;

    stage.style.transform =
      `translate(${shiftX.toFixed(2)}px, ${shiftY.toFixed(2)}px)`;

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();


/* Granulado (film grain) en constante movimiento sobre toda la web.
   Ruido real regenerado por frame en un canvas: sin costuras de mosaico. */
(function filmGrain() {
  const canvas = document.querySelector("canvas.grain");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  // mosaico de ruido chico que se repite (barato de generar)
  const TILE = 256;
  const tile = document.createElement("canvas");
  tile.width = tile.height = TILE;
  const tctx = tile.getContext("2d");

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener("resize", resize, { passive: true });

  function makeNoise() {
    const img = tctx.createImageData(TILE, TILE);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const v = (Math.random() * 255) | 0;
      d[i] = d[i + 1] = d[i + 2] = v;
      d[i + 3] = 255;
    }
    tctx.putImageData(img, 0, 0);
  }

  function paint() {
    makeNoise();
    const pattern = ctx.createPattern(tile, "repeat");
    ctx.save();
    ctx.fillStyle = pattern;
    // desplazamiento aleatorio por frame => sensación de movimiento constante
    ctx.translate(-((Math.random() * TILE) | 0), -((Math.random() * TILE) | 0));
    ctx.fillRect(0, 0, canvas.width + TILE, canvas.height + TILE);
    ctx.restore();
  }

  // Si se prefiere menos movimiento: un solo frame estático.
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    paint();
    return;
  }

  let last = 0;
  function loop(t) {
    if (t - last > 45) {        // ~22 fps: suficiente para grano, liviano
      paint();
      last = t;
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();


/* Image trail: el mouse deja un rastro de fotos en el hero que se desvanecen. */
function makeTrail(zone, SRCS) {
  const layer = zone && zone.querySelector(".trail");
  if (!layer) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  SRCS.forEach((s) => { const im = new Image(); im.src = s; });   // precarga

  const THRESH = 110;   // px de movimiento entre foto y foto
  const LIFE   = 650;   // ms visible antes de empezar a desvanecerse
  const MAX    = 5;     // máximo de fotos a la vez
  let idx = 0, lastX = null, lastY = null;
  const active = [];

  zone.addEventListener("pointermove", (e) => {
    const rect = zone.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (lastX === null) { lastX = x; lastY = y; return; }
    if (Math.hypot(x - lastX, y - lastY) < THRESH) return;
    lastX = x; lastY = y;
    spawn(x, y);
  }, { passive: true });

  function fadeOut(img) {
    if (img.dataset.out) return;
    img.dataset.out = "1";
    const i = active.indexOf(img);
    if (i > -1) active.splice(i, 1);
    img.classList.remove("is-in");
    img.classList.add("is-out");
    setTimeout(() => img.remove(), 600);
  }
  function spawn(x, y) {
    const img = document.createElement("img");
    img.className = "trail__img";
    img.src = SRCS[idx % SRCS.length];
    idx++;
    img.style.left = x + "px";
    img.style.top = y + "px";
    layer.appendChild(img);
    active.push(img);
    while (active.length > MAX) fadeOut(active[0]);
    requestAnimationFrame(() => img.classList.add("is-in"));
    setTimeout(() => fadeOut(img), LIFE);
  }
}
// hero (título) y footer (último sector): mismo efecto, distintas fotos
(function () {
  const heroSrcs = [], footSrcs = [];
  for (let i = 1; i <= 14; i++) {
    heroSrcs.push("assets/trail/trail-" + String(i).padStart(2, "0") + ".jpg");
    footSrcs.push("assets/trail2/t" + String(i).padStart(2, "0") + ".jpg");
  }
  makeTrail(document.querySelector(".header"), heroSrcs);
  makeTrail(document.querySelector(".footer"), footSrcs);
})();


/* Servicios: al pasar el mouse por un trabajo, su imagen/video llena la pantalla,
   el fondo toma un color del activo y los demás trabajos bajan la opacidad. */
(function worksHover() {
  const services = document.querySelector(".services");
  const list  = services && services.querySelector(".works");
  const media = services && services.querySelector(".works-media");
  if (!list || !media) return;

  const mImg = media.querySelector(".works-media__img");
  const mVid = media.querySelector(".works-media__video");
  const works = Array.from(list.querySelectorAll(".work"));

  let currentRate = 1;
  // al recargar el video (nuevo src) la velocidad se resetea: la reaplicamos
  mVid.addEventListener("loadeddata", () => { mVid.playbackRate = currentRate; });

  // reproducción por segmento (p.ej. 112: 10s desde la mitad, en loop)
  let vidSeg = 0, vidSegStart = 0, vidFromMid = false;
  function startVideo() {
    mVid.muted = true;                          // nada con sonido en la web
    mVid.playbackRate = currentRate;
    // con preload="none", play() es lo que dispara la carga (no esperar metadata)
    const p = mVid.play();
    if (p && p.catch) p.catch(() => {});
    if (vidSeg > 0) {                          // segmento: saltar al punto cuando haya metadata
      const seek = () => {
        const d = mVid.duration || 0;
        vidSegStart = (vidFromMid && d) ? d / 2 : 0;
        try { mVid.currentTime = vidSegStart; } catch (e) {}
      };
      if (mVid.readyState >= 1) seek();
      else mVid.addEventListener("loadedmetadata", seek, { once: true });
    } else {
      vidSegStart = 0;                          // loop completo
    }
  }
  mVid.addEventListener("timeupdate", () => {
    if (vidSeg > 0 && mVid.currentTime >= vidSegStart + vidSeg) {
      mVid.currentTime = vidSegStart;   // loop del segmento
    }
  });

  // 4 colores con la MISMA saturación/luminosidad que #3070c9 (hsl 61% / 49%),
  // solo cambia el tono. Rota uno nuevo en cada hover.
  const PALETTE = [
    "hsl(215, 61%, 49%)", // azul (#3070c9)
    "hsl(320, 61%, 49%)", // magenta
    "hsl(140, 61%, 49%)", // verde
    "hsl(35, 61%, 49%)",  // naranja
    "hsl(270, 61%, 49%)", // violeta
    "hsl(178, 61%, 49%)", // turquesa
  ];
  let colorIdx = 0;

  // slideshow (ROSTOCK): cuadros que rotan como un gif
  let slideTimer = null;
  const SLIDE_MS = 450;                 // ritmo de "hojeo" del catálogo
  function stopSlides() { if (slideTimer) { clearInterval(slideTimer); slideTimer = null; } }
  function framesOf(work) {
    if (work._frames) return work._frames;
    const base = work.dataset.src;
    const n = parseInt(work.dataset.count, 10) || 0;
    const arr = [];
    for (let i = 1; i <= n; i++) {
      const p = base + String(i).padStart(2, "0") + ".jpg";
      arr.push(p);
      const im = new Image(); im.src = p;   // precarga
    }
    work._frames = arr;
    return arr;
  }

  // YouTube (112): reproduce ~10s desde la mitad, en loop, muteado, a máxima calidad.
  const ytBox = media.querySelector(".works-media__yt");
  let ytPlayer = null, ytReady = false, ytWantPlay = false, ytTimer = null,
      ytSegStart = 0, ytSegLen = 10;

  function ytEnsure(id, len) {
    ytSegLen = len;
    if (ytReady && ytPlayer) { ytStart(); return; }
    ytWantPlay = true;
    if (ytPlayer) return;                  // ya se está creando
    const create = () => {
      ytPlayer = new YT.Player("yt-player", {
        videoId: id,
        playerVars: {
          autoplay: 0, controls: 0, mute: 1, rel: 0, modestbranding: 1,
          playsinline: 1, disablekb: 1, fs: 0, iv_load_policy: 3,
        },
        events: { onReady: () => { ytReady = true; if (ytWantPlay) ytStart(); } },
      });
    };
    if (window.YT && window.YT.Player) { create(); }
    else {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => { if (prev) prev(); create(); };
      if (!document.getElementById("yt-api")) {
        const s = document.createElement("script");
        s.id = "yt-api"; s.src = "https://www.youtube.com/iframe_api";
        document.head.appendChild(s);
      }
    }
  }
  function ytStart() {
    ytWantPlay = false;
    const d = ytPlayer.getDuration ? ytPlayer.getDuration() : 0;
    if (!d) {                              // duración aún no lista: reintenta si sigue activo
      ytPlayer.mute(); ytPlayer.playVideo();
      setTimeout(() => { if (ytBox.style.display !== "none") ytStart(); }, 300);
      return;
    }
    ytSegStart = d / 2;                    // desde la mitad
    try { ytPlayer.setPlaybackQuality("hd1080"); } catch (e) {}
    ytPlayer.mute();
    ytPlayer.seekTo(ytSegStart, true);
    ytPlayer.playVideo();
    clearInterval(ytTimer);
    ytTimer = setInterval(() => {
      if (!ytPlayer.getCurrentTime) return;
      const t = ytPlayer.getCurrentTime();
      if (t >= ytSegStart + ytSegLen || t < ytSegStart - 1) ytPlayer.seekTo(ytSegStart, true);
    }, 250);
  }
  function ytStop() {
    ytWantPlay = false;
    clearInterval(ytTimer); ytTimer = null;
    if (ytPlayer && ytPlayer.pauseVideo) ytPlayer.pauseVideo();
  }

  function activate(work) {
    const src = work.dataset.src;
    if (!src) return;                 // trabajos sin media: por ahora no hacen nada

    list.classList.add("is-hovering");
    // color nuevo de la paleta en cada hover (rota entre los 4)
    const color = PALETTE[colorIdx % PALETTE.length];
    colorIdx++;
    // resalta el activo y le pone el color rotado; limpia los demás
    works.forEach((w) => {
      const on = w === work;
      w.classList.toggle("is-active", on);
      w.style.backgroundColor = on ? color : "";
    });

    const fit = work.dataset.fit || "cover";   // LPC usa "contain" (se ven las 4 marcas)
    mImg.style.objectFit = fit;
    mVid.style.objectFit = fit;
    stopSlides();
    ytStop();
    ytBox.style.display = "none";

    if (work.dataset.type === "youtube") {
      mImg.style.display = "none";
      mVid.pause();
      mVid.style.display = "none";
      ytBox.style.display = "block";
      ytEnsure(work.dataset.id, parseInt(work.dataset.seg, 10) || 10);
    } else if (work.dataset.type === "slideshow") {
      mVid.pause();
      mVid.style.display = "none";
      const frames = framesOf(work);
      let fi = 0;
      mImg.src = frames[0];
      mImg.style.display = "block";
      slideTimer = setInterval(() => {
        fi = (fi + 1) % frames.length;
        mImg.src = frames[fi];
      }, parseInt(work.dataset.interval, 10) || SLIDE_MS);
    } else if (work.dataset.type === "video") {
      mImg.style.display = "none";
      mVid.poster = work.dataset.poster || "";
      if (mVid.getAttribute("src") !== src) mVid.src = src;
      mVid.style.display = "block";
      currentRate = parseFloat(work.dataset.rate) || 1;         // p.ej. BLÚ a 2.3×
      vidSeg = parseFloat(work.dataset.seg) || 0;               // 112: 10s
      vidFromMid = work.dataset.start === "mid";
      startVideo();
    } else {
      mVid.pause();
      mVid.style.display = "none";
      mImg.src = src;
      mImg.style.display = "block";
    }
    media.classList.add("is-on");
  }

  function reset() {
    list.classList.remove("is-hovering");
    works.forEach((w) => {
      w.classList.remove("is-active");
      w.style.backgroundColor = "";   // vuelve al azul por CSS
    });
    media.classList.remove("is-on");
    mVid.pause();
    stopSlides();
    ytStop();
    ytBox.style.display = "none";
  }

  // El fondo del proyecto se ve SOLO mientras el mouse está sobre un título.
  // Delegación con mouseover: si el puntero pasa a un hueco entre títulos o a
  // un trabajo sin media, se limpia; al salir de la lista, también.
  let currentWork = null;
  list.addEventListener("mouseover", (e) => {
    const work = e.target.closest(".work");
    if (work && work.dataset.src) {
      if (work !== currentWork) { currentWork = work; activate(work); }
    } else if (currentWork) {
      currentWork = null;
      reset();
    }
  });
  list.addEventListener("mouseleave", () => {
    if (currentWork) { currentWork = null; reset(); }
  });
})();


/* Footer: el logo JP se reemplaza por gifs animados (velocidad x2) que se van
   cambiando por el siguiente cuando cada uno termina su loop. */
(function jpGifs() {
  const box = document.querySelector(".footer__jp");
  const img = box && box.querySelector("img");
  if (!img) return;

  // [archivo, duración real en ms del loop a 2×] — se cambia al terminar cada uno
  const GIFS = [
    ["assets/works/jp/jp1.gif", 2520], // balloon (globo rosa)
    // jp2 (globos2_1) era el mismo globo rosa -> quitado para que no se repita
    ["assets/works/jp/jp3.gif", 3640], // flor abejas
    ["assets/works/jp/jp4.gif", 3680], // flores moss
    ["assets/works/jp/jp5.gif", 2520], // agua
    ["assets/works/jp/jp6.gif", 2520], // futura
    ["assets/works/jp/jp7.gif", 2520], // sand
    ["assets/works/jp/jp8.gif", 2520], // gothic
    ["assets/works/jp/jp9.gif", 2400], // plateado
  ];

  let i = 0, timer = null;
  function show() {
    img.src = GIFS[i][0];             // cada uno arranca de frame 0 (src distinto)
    clearTimeout(timer);
    timer = setTimeout(() => { i = (i + 1) % GIFS.length; show(); }, GIFS[i][1]);
  }

  // arranca sólo cuando el footer entra en pantalla (ahorra recursos)
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting && !timer) show();
        else if (!e.isIntersecting && timer) { clearTimeout(timer); timer = null; }
      });
    }, { threshold: 0.1 });
    io.observe(box);
  } else {
    show();
  }
})();


/* El CONTACT ME sigue al mouse en 2D (igual que el título y el VOLVER de la galería). */
(function cmFollow() {
  const cm = document.querySelector(".footer__cm");
  if (!cm) return;

  // hover: color random de la paleta de trabajos, SIN el azul (igual que VOLVER)
  const rect = cm.querySelector("#contactBg");
  const COLORS = ["hsl(320,61%,49%)", "hsl(140,61%,49%)", "hsl(35,61%,49%)", "hsl(270,61%,49%)", "hsl(178,61%,49%)"];
  if (rect) {
    cm.addEventListener("mouseenter", () => rect.setAttribute("fill", COLORS[(Math.random() * COLORS.length) | 0]));
    cm.addEventListener("mouseleave", () => rect.setAttribute("fill", "#3070c9"));
  }

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const MAX = 18, EASE = 0.12;
  let tx = 0, ty = 0, cx = 0, cy = 0;
  window.addEventListener("mousemove", (e) => {
    tx = e.clientX / window.innerWidth - 0.5;
    ty = e.clientY / window.innerHeight - 0.5;
  }, { passive: true });
  window.addEventListener("mouseleave", () => { tx = 0; ty = 0; });
  function frame() {
    cx += (tx - cx) * EASE;
    cy += (ty - cy) * EASE;
    cm.style.transform = "translate(" + (cx * MAX * 2).toFixed(2) + "px," + (cy * MAX * 2).toFixed(2) + "px)";
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
