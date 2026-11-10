// Sabi's site: the latest release from GitHub, one scroll through a day,
// every feature, and a few small pieces of the app to try.
"use strict";

const RELEASES_API =
  "https://api.github.com/repos/Leuthra/sabi-releases/releases/latest";

// The home screen sky of each moment, from the app (sky_palette.dart).
const SKY = {
  fajar: { top: "#1E2350", mid: "#4B4E9A", low: "#C98A8E", stars: 1 },
  siang: { top: "#3F67C9", mid: "#5E8BDB", low: "#9CC0EC", stars: 0 },
  sore: { top: "#4E5BBE", mid: "#7E6CC8", low: "#D98A62", stars: 0 },
  senja: { top: "#2B2462", mid: "#6B3F86", low: "#D9735E", stars: 0.35 },
  malam: { top: "#0C0D22", mid: "#1B1D3A", low: "#2B2E5C", stars: 1 },
};

const prefersMotion = () =>
  window.matchMedia("(prefers-reduced-motion: no-preference)").matches;

scatterStars(document.querySelector(".stars"), 70);
watchHeader(document.querySelector(".top"));
showLatestRelease();
document.addEventListener("DOMContentLoaded", () => {
  if (window.gsap) {
    gsap.registerPlugin(
      ScrollTrigger,
      SplitText,
      MotionPathPlugin,
      Flip,
      Draggable,
      InertiaPlugin,
      DrawSVGPlugin,
      TextPlugin,
      ScrambleTextPlugin,
    );
  }
  setupFilters();
  setupQibla();
  setupPause();
  setupTasbih();
  setupChat();
  setupWidgetCountdown();
  animate();
});

function scatterStars(container, count) {
  if (!container) return;
  const fragment = document.createDocumentFragment();
  for (let i = 0; i < count; i++) {
    const star = document.createElement("span");
    star.className = "star";
    star.style.left = `${Math.random() * 100}%`;
    star.style.top = `${Math.random() * 100}%`;
    star.style.opacity = (0.3 + Math.random() * 0.7).toFixed(2);
    fragment.append(star);
  }
  container.append(fragment);
}

function watchHeader(header) {
  if (!header) return;
  const update = () => header.classList.toggle("is-scrolled", window.scrollY > 24);
  update();
  window.addEventListener("scroll", update, { passive: true });
}

/* ---------- Latest release ---------- */

async function showLatestRelease() {
  let release;
  try {
    const response = await fetch(RELEASES_API, {
      headers: { Accept: "application/vnd.github+json" },
    });
    if (!response.ok) return;
    release = await response.json();
  } catch {
    // Offline or rate limited: the links still point at the Releases page.
    return;
  }

  const version = release.tag_name.replace(/^v/, "");
  const date = new Date(release.published_at).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  for (const link of document.querySelectorAll("[data-download]")) {
    const asset = release.assets.find((item) =>
      item.name.endsWith(`-${link.dataset.download}.apk`),
    );
    if (!asset) continue;
    link.href = asset.browser_download_url;
    const label = link.querySelector("[data-download-label]");
    if (label) label.textContent = `Unduh Sabi ${version} (${megabytes(asset.size)})`;
  }

  const meta = document.querySelector("[data-release-meta]");
  if (meta) {
    meta.textContent = `Versi ${version}, rilis ${date}. Gratis dan tanpa iklan. Android 7.0 ke atas.`;
  }
  const installMeta = document.querySelector("[data-release-meta-install]");
  const sums = release.assets.find((item) => item.name === "SHA256SUMS.txt");
  if (installMeta && sums) {
    installMeta.replaceChildren(
      "Periksa file-nya dengan ",
      linkTo(sums.browser_download_url, "SHA256SUMS.txt"),
      ".",
    );
  }

  const title = document.querySelector("[data-changelog-title]");
  if (title) title.textContent = `Yang baru di ${version}`;
  const body = document.querySelector("[data-changelog]");
  if (body && release.body) body.replaceChildren(renderNotes(release.body));
}

function megabytes(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}

function linkTo(href, text) {
  const link = document.createElement("a");
  link.href = href;
  link.textContent = text;
  return link;
}

// Release notes are short Markdown: paragraphs and "- " lists whose items
// may wrap onto indented lines. Built as DOM nodes, never as HTML strings.
function renderNotes(markdown) {
  const fragment = document.createDocumentFragment();
  let list = null;
  let item = null;
  for (const raw of markdown.split(/\r?\n/)) {
    const line = raw.trimEnd();
    if (line.startsWith("- ")) {
      if (!list) list = fragment.appendChild(document.createElement("ul"));
      item = list.appendChild(document.createElement("li"));
      item.textContent = line.slice(2);
    } else if (item && /^\s+\S/.test(line)) {
      item.textContent += ` ${line.trim()}`;
    } else if (line.trim()) {
      list = item = null;
      fragment.appendChild(document.createElement("p")).textContent = line.trim();
    } else {
      item = null;
    }
  }
  return fragment;
}

/* ---------- Every feature: filter with Flip ---------- */

function setupFilters() {
  const grid = document.querySelector("[data-feature-grid]");
  const buttons = document.querySelectorAll("[data-filter]");
  const count = document.querySelector("[data-filter-count]");
  if (!grid || !buttons.length) return;
  const cards = [...grid.children];

  // The page grows or shrinks with the filter, so scroll positions below
  // (such as the pinned 0.7 section) are measured again.
  const remeasure = () => window.ScrollTrigger?.refresh();

  const show = (group, { animate = true } = {}) => {
    const state = animate && window.Flip ? Flip.getState(cards) : null;
    let shown = 0;
    for (const card of cards) {
      const visible = group === "semua" || card.dataset.group === group;
      card.hidden = !visible;
      if (visible) shown++;
    }
    for (const button of buttons) {
      const active = button.dataset.filter === group;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    }
    if (count) count.textContent = `${shown} fitur`;
    if (state && prefersMotion()) {
      // Cards slide to their new places; the ones coming in grow from small.
      Flip.from(state, {
        duration: 0.55,
        ease: "power3.inOut",
        absolute: true,
        stagger: 0.012,
        onComplete: remeasure,
        onEnter: (entering) =>
          gsap.fromTo(entering, { autoAlpha: 0, scale: 0.85 }, { autoAlpha: 1, scale: 1, duration: 0.4 }),
        onLeave: (leaving) => gsap.to(leaving, { autoAlpha: 0, scale: 0.85, duration: 0.3 }),
      });
    } else if (animate) {
      remeasure();
    }
  };

  for (const button of buttons) {
    button.addEventListener("click", () => show(button.dataset.filter));
  }
  // The first view is simply shown: nothing has moved yet.
  show("semua", { animate: false });
}

/* ---------- Try it: qibla dial with Draggable and inertia ---------- */

function setupQibla() {
  const dial = document.querySelector("[data-dial]");
  const card = document.querySelector(".try-qibla");
  const hint = document.querySelector("[data-qibla-hint]");
  if (!dial || !card) return;

  // Ticks every 10°, longer every 30°.
  const ticks = dial.querySelector(".dial-ticks");
  const svg = "http://www.w3.org/2000/svg";
  for (let angle = 0; angle < 360; angle += 10) {
    const line = document.createElementNS(svg, "line");
    const major = angle % 30 === 0;
    line.setAttribute("x1", "100");
    line.setAttribute("x2", "100");
    line.setAttribute("y1", major ? "12" : "14");
    line.setAttribute("y2", major ? "22" : "19");
    line.setAttribute("transform", `rotate(${angle} 100 100)`);
    if (major) line.classList.add("major");
    ticks.append(line);
  }

  // Everything but the hub turns, as the phone turns in the hand.
  const rotor = document.createElementNS(svg, "g");
  for (const child of [...dial.children]) {
    if (!child.classList.contains("dial-hub")) rotor.append(child);
  }
  dial.prepend(rotor);

  // The needle sits at 295° on the dial, so the dial must turn to 65°.
  const target = 65;
  const isAligned = (rotation) => {
    const off = (((rotation - target) % 360) + 540) % 360 - 180;
    return Math.abs(off) < 6;
  };
  const report = (rotation) => {
    const aligned = isAligned(rotation);
    card.classList.toggle("is-aligned", aligned);
    hint.textContent = aligned
      ? "Pas. Kiblat ada tepat di depanmu."
      : "Putar kompasnya sampai jarum emas menunjuk ke atas.";
  };

  if (!window.Draggable) return;
  gsap.set(rotor, { svgOrigin: "100 100", rotation: 0 });
  Draggable.create(rotor, {
    type: "rotation",
    inertia: true,
    // A throw that ends near the qibla settles exactly on it.
    snap: (value) => {
      const off = (((value - target) % 360) + 540) % 360 - 180;
      return Math.abs(off) < 14 ? value - off : value;
    },
    onDrag() {
      report(this.rotation);
    },
    onThrowUpdate() {
      report(this.rotation);
    },
    onThrowComplete() {
      report(this.rotation);
      if (isAligned(this.rotation) && prefersMotion()) {
        gsap.fromTo(".dial-hub", { scale: 1 }, { scale: 1.8, duration: 0.25, yoyo: true, repeat: 1, svgOrigin: "100 100" });
      }
    },
  });
}

/* ---------- Try it: the pause before social media ---------- */

function setupPause() {
  const open = document.querySelector("[data-pause-open]");
  const overlay = document.querySelector("[data-pause-overlay]");
  if (!open || !overlay) return;
  const close = overlay.querySelector("[data-pause-close]");
  const proceed = overlay.querySelector("[data-pause-continue]");
  const count = overlay.querySelector("[data-pause-count]");
  const text = overlay.querySelector("[data-pause-text]");
  const note = document.querySelector("[data-pause-note]");
  const circle = overlay.querySelector(".breath span");
  let timeline = null;
  let timer = null;

  const finish = (message) => {
    timeline?.kill();
    clearInterval(timer);
    overlay.hidden = true;
    note.textContent = message;
    open.focus();
  };

  open.addEventListener("click", () => {
    overlay.hidden = false;
    proceed.disabled = true;
    let left = 5;
    count.textContent = left;
    text.textContent = "Tarik napas pelan-pelan...";
    close.focus();
    timer = setInterval(() => {
      left--;
      count.textContent = left > 0 ? left : "";
      if (left === 2) text.textContent = "Lalu hembuskan...";
      if (left <= 0) {
        clearInterval(timer);
        proceed.disabled = false;
        text.textContent = "Masih mau membukanya?";
      }
    }, 1000);
    if (window.gsap && prefersMotion()) {
      timeline = gsap
        .timeline()
        .fromTo(overlay, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.3 })
        .fromTo(circle, { scale: 0.45 }, { scale: 1, duration: 3, ease: "sine.inOut" }, 0)
        .to(circle, { scale: 0.55, duration: 2, ease: "sine.inOut" });
    }
  });
  close.addEventListener("click", () =>
    finish("Kamu mengurungkannya. Sering kali satu tarikan napas sudah cukup."),
  );
  proceed.addEventListener("click", () =>
    finish("Silakan. Sabi tetap menghitung waktunya, dan jedanya lebih lama kalau kamu membuka lagi."),
  );
}

/* ---------- Try it: tasbih ---------- */

function setupTasbih() {
  const button = document.querySelector("[data-tasbih]");
  if (!button) return;
  const beads = button.querySelector("[data-beads]");
  const countText = button.querySelector("[data-tasbih-count]");
  const label = button.querySelector("[data-tasbih-label]");
  const words = ["Subhanallah", "Alhamdulillah", "Allahu akbar"];
  const total = 33;
  const dots = [];
  for (let i = 0; i < total; i++) {
    const dot = document.createElement("span");
    dot.className = "bead";
    const angle = (i / total) * Math.PI * 2 - Math.PI / 2;
    dot.style.left = `${50 + Math.cos(angle) * 43}%`;
    dot.style.top = `${50 + Math.sin(angle) * 43}%`;
    beads.append(dot);
    dots.push(dot);
  }
  let count = 0;
  let round = 0;

  button.addEventListener("click", () => {
    count++;
    countText.textContent = count;
    dots[(count - 1) % total].classList.add("is-lit");
    const motion = window.gsap && prefersMotion();
    if (motion) gsap.fromTo(countText, { scale: 1.25 }, { scale: 1, duration: 0.35, ease: "back.out(3)" });
    if (count % total === 0) {
      round = (round + 1) % words.length;
      if (motion) {
        gsap
          .timeline()
          .to(button, { boxShadow: "0 0 0 3px #ffe39a, 0 0 80px -10px rgba(255,227,154,0.8)", duration: 0.25 })
          .to(button, { boxShadow: "0 0 0 1px rgba(236,238,246,0.14), 0 0 60px -20px rgba(255,227,154,0.4)", duration: 0.6 })
          .add(() => dots.forEach((dot) => dot.classList.remove("is-lit")), 0.3)
          .to(label, { duration: 0.6, scrambleText: { text: words[round], chars: "lowerCase" } }, 0.2);
      } else {
        dots.forEach((dot) => dot.classList.remove("is-lit"));
        label.textContent = words[round];
      }
    }
  });
}

/* ---------- Try it: the assistant types its answer ---------- */

function setupChat() {
  const answer = document.querySelector("[data-chat-answer]");
  const replay = document.querySelector("[data-chat-replay]");
  if (!answer || !window.gsap || !window.TextPlugin) {
    replay?.remove();
    return;
  }
  // Each piece of text (inside bold, italic or plain) types in turn, so
  // the formatting appears as the words do.
  const pieces = [];
  const walker = document.createTreeWalker(answer, NodeFilter.SHOW_TEXT);
  const textNodes = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode);
  for (const node of textNodes) {
    const span = document.createElement("span");
    span.textContent = node.textContent;
    node.replaceWith(span);
    pieces.push({ span, text: span.textContent });
  }

  let timeline = null;
  const play = () => {
    timeline?.kill();
    timeline = gsap.timeline();
    for (const { span } of pieces) span.textContent = "";
    for (const { span, text } of pieces) {
      timeline.to(span, { duration: text.length * 0.018, text, ease: "none" });
    }
  };

  if (prefersMotion()) {
    for (const { span } of pieces) span.textContent = "";
    ScrollTrigger.create({ trigger: answer, start: "top 80%", once: true, onEnter: play });
    replay.addEventListener("click", play);
  } else {
    replay.remove();
  }
}

/* ---------- Coming soon: the wide widget's countdown runs ---------- */

function setupWidgetCountdown() {
  const clock = document.querySelector(".mock-countdown");
  if (!clock) return;
  let seconds = 41 * 60 + 12;
  setInterval(() => {
    seconds = seconds > 0 ? seconds - 1 : 41 * 60 + 12;
    const h = String(Math.floor(seconds / 3600)).padStart(2, "0");
    const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
    const s = String(seconds % 60).padStart(2, "0");
    clock.textContent = `${h}:${m}:${s}`;
  }, 1000);
}

/* ---------- Motion ---------- */

function setSky(phase, duration) {
  const sky = SKY[phase];
  if (!sky) return;
  gsap.to(document.documentElement, {
    "--sky-top": sky.top,
    "--sky-mid": sky.mid,
    "--sky-low": sky.low,
    "--stars": sky.stars,
    duration,
    ease: "sine.inOut",
    overwrite: true,
  });
}

function animate() {
  if (!window.gsap) return;

  const panels = gsap.utils.toArray(".panel");
  const clockTime = document.querySelector("[data-clock-time]");
  const clockLabel = document.querySelector("[data-clock-label]");
  let shownTime = clockTime.textContent;

  function showMoment(panel, animated) {
    setSky(panel.dataset.phase, animated ? 1.4 : 0);
    if (panel.dataset.time === shownTime) return;
    shownTime = panel.dataset.time;
    if (!animated) {
      clockTime.textContent = panel.dataset.time;
      clockLabel.textContent = panel.dataset.label;
      return;
    }
    // The digits tick over like a clock; the name of the moment scrambles in.
    gsap.to(clockTime, {
      duration: 0.6,
      scrambleText: { text: panel.dataset.time, chars: "0123456789", speed: 0.6 },
    });
    gsap.to(clockLabel, {
      duration: 0.7,
      scrambleText: { text: panel.dataset.label, chars: "lowerCase", speed: 0.5 },
    });
  }

  const media = gsap.matchMedia();

  media.add(
    {
      motion: "(prefers-reduced-motion: no-preference)",
      still: "(prefers-reduced-motion: reduce)",
      wide: "(min-width: 52.01rem)",
    },
    (context) => {
      const { motion, wide } = context.conditions;

      // Which moment of the day is on screen decides the sky and clock.
      for (const panel of panels) {
        ScrollTrigger.create({
          trigger: panel,
          start: "top 60%",
          end: "bottom 60%",
          onToggle: (self) => self.isActive && showMoment(panel, motion),
        });
      }
      ScrollTrigger.create({
        trigger: ".day-panels",
        start: "top 60%",
        onLeaveBack: () => setSky("fajar", motion ? 1.2 : 0),
      });
      ScrollTrigger.create({
        trigger: ".features",
        start: "top 60%",
        onEnter: () => setSky("malam", motion ? 1.4 : 0),
        onLeaveBack: () => setSky("malam", 0),
      });

      const arcSabi = document.querySelector(".arc-sabi");
      const path = { path: "#arc-path", align: "#arc-path", alignOrigin: [0.5, 0.5] };
      if (!motion) {
        gsap.set(arcSabi, { motionPath: { ...path, start: 0.5, end: 0.5 } });
        gsap.set(".arc-line", { drawSVG: "0% 50%" });
        return;
      }

      // Sabi walks the prayer arc across the day, drawing the day so far.
      const daySpan = {
        trigger: ".day-panels",
        start: "top 60%",
        end: "bottom 60%",
        scrub: 0.6,
        invalidateOnRefresh: true,
      };
      gsap.to(arcSabi, { motionPath: path, ease: "none", scrollTrigger: daySpan });
      gsap.fromTo(".arc-line", { drawSVG: "0% 0%" }, { drawSVG: "0% 100%", ease: "none", scrollTrigger: { ...daySpan } });

      // The one page-load moment: the phone rises, Sabi arrives, then the words.
      const split = SplitText.create(".hero h1", { type: "lines", mask: "lines" });
      gsap
        .timeline({ defaults: { ease: "power3.out" } })
        .from(".phone", { y: 80, autoAlpha: 0, rotate: -4, duration: 1.1 })
        .from(".hero-sabi", { y: 60, x: 40, autoAlpha: 0, scale: 0.6, duration: 1.1, ease: "back.out(1.6)" }, "-=0.7")
        .from(split.lines, { yPercent: 105, duration: 0.9, stagger: 0.09 }, "-=0.9")
        .from(".hero-kicker, .lead, .hero-actions, .hero .fineprint, .promises li", { y: 16, autoAlpha: 0, duration: 0.55, stagger: 0.06 }, "-=0.5")
        .from(".top", { autoAlpha: 0, duration: 0.6 }, "<");

      // Sabi bobs gently, like on Beranda.
      gsap.to(".hero-sabi", { y: -12, rotate: 4, duration: 2.4, ease: "sine.inOut", yoyo: true, repeat: -1 });

      // As the page moves on, the phone drifts up faster than the words.
      gsap.to(".hero-visual", {
        yPercent: -12,
        ease: "none",
        scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true },
      });

      // The island grows from Sabi alone to its message, like on the phone.
      gsap.from(".island-text", {
        width: 0,
        autoAlpha: 0,
        duration: 0.9,
        ease: "power3.inOut",
        scrollTrigger: { trigger: ".mock-island", start: "top 80%" },
      });
      gsap.from(".bar span", {
        width: 0,
        duration: 1.1,
        ease: "power2.out",
        scrollTrigger: { trigger: ".mock-island", start: "top 80%" },
      });
      gsap.from(".mock-habits .tick", {
        scale: 0,
        duration: 0.4,
        stagger: 0.12,
        ease: "back.out(3)",
        scrollTrigger: { trigger: ".mock-habits", start: "top 80%" },
      });

      // The feature cards arrive once, together.
      gsap.from(".feature:not([hidden])", {
        y: 24,
        autoAlpha: 0,
        duration: 0.5,
        stagger: { each: 0.02, from: "start" },
        ease: "power2.out",
        scrollTrigger: { trigger: ".feature-grid", start: "top 85%", once: true },
      });

      // Privacy icons draw themselves.
      gsap.from(".draw-icon path, .draw-icon rect, .draw-icon circle", {
        drawSVG: "0%",
        duration: 1.2,
        stagger: 0.12,
        ease: "power2.inOut",
        scrollTrigger: { trigger: ".privacy-cols", start: "top 80%" },
      });

      // Coming in 0.7: on wide screens the section pins and the cards
      // slide past sideways as the page scrolls.
      if (wide) {
        const track = document.querySelector("[data-next-track]");
        const distance = () => track.scrollWidth - track.parentElement.clientWidth + 48;
        gsap.to(track, {
          x: () => -distance(),
          ease: "none",
          scrollTrigger: {
            trigger: ".next-pin",
            start: "top top+=72",
            end: () => `+=${distance()}`,
            pin: true,
            scrub: 0.8,
            invalidateOnRefresh: true,
            anticipatePin: 1,
          },
        });
      }

      // The footer Sabi greets the end of the page.
      gsap.from(".foot-sabi", {
        rotate: -30,
        scale: 0.5,
        autoAlpha: 0,
        duration: 1,
        ease: "back.out(2)",
        scrollTrigger: { trigger: ".foot", start: "top 90%" },
      });

      return () => split.revert();
    },
  );
}
