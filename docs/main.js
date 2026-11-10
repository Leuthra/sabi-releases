// Sabi's site: the latest release from GitHub, and one scroll through a day.
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

scatterStars(document.querySelector(".stars"), 70);
watchHeader(document.querySelector(".top"));
showLatestRelease();
document.addEventListener("DOMContentLoaded", animate);

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
    installMeta.innerHTML = "";
    installMeta.append(
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
  gsap.registerPlugin(ScrollTrigger, SplitText, MotionPathPlugin);

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
    gsap
      .timeline()
      .to([clockTime, clockLabel], { yPercent: -40, autoAlpha: 0, duration: 0.2, ease: "power2.in" })
      .add(() => {
        clockTime.textContent = panel.dataset.time;
        clockLabel.textContent = panel.dataset.label;
      })
      .fromTo(
        [clockTime, clockLabel],
        { yPercent: 40, autoAlpha: 0 },
        { yPercent: 0, autoAlpha: 1, duration: 0.35, ease: "power3.out", stagger: 0.05 },
      );
  }

  const media = gsap.matchMedia();

  media.add(
    {
      motion: "(prefers-reduced-motion: no-preference)",
      still: "(prefers-reduced-motion: reduce)",
    },
    (context) => {
      const { motion } = context.conditions;

      // Which moment of the day is on screen decides the sky and clock.
      for (const panel of panels) {
        ScrollTrigger.create({
          trigger: panel,
          start: "top 65%",
          end: "bottom 65%",
          onToggle: (self) => self.isActive && showMoment(panel, motion),
        });
      }
      ScrollTrigger.create({
        trigger: ".day",
        start: "top 65%",
        onLeaveBack: () => setSky("fajar", motion ? 1.2 : 0),
      });

      // Sabi walks the prayer arc across the whole day.
      const arcSabi = document.querySelector(".arc-sabi");
      const path = {
        path: "#arc-path",
        align: "#arc-path",
        alignOrigin: [0.5, 0.5],
      };
      if (!motion) {
        gsap.set(arcSabi, { motionPath: { ...path, start: 0.5, end: 0.5 } });
        return;
      }
      gsap.to(arcSabi, {
        motionPath: path,
        ease: "none",
        scrollTrigger: {
          trigger: ".day-panels",
          start: "top 60%",
          end: "bottom 60%",
          scrub: 0.6,
          invalidateOnRefresh: true,
        },
      });

      // The one page-load moment: Sabi rises, then the headline.
      const split = SplitText.create(".hero h1", { type: "lines", mask: "lines" });
      gsap
        .timeline({ defaults: { ease: "power3.out" } })
        .from(".hero-sabi", { y: 140, autoAlpha: 0, scale: 0.85, duration: 1.4, ease: "power2.out" })
        .from(split.lines, { yPercent: 105, duration: 0.9, stagger: 0.09 }, "-=0.8")
        .from(".lead, .hero-actions, .hero .fineprint", { y: 16, autoAlpha: 0, duration: 0.6, stagger: 0.08 }, "-=0.5")
        .from(".top", { autoAlpha: 0, duration: 0.6 }, "<");

      // As the day starts, the big Sabi sets behind the first panel.
      gsap.to(".hero-sabi", {
        y: 120,
        scale: 0.7,
        autoAlpha: 0,
        ease: "none",
        scrollTrigger: { trigger: ".hero", start: "center center", end: "bottom top", scrub: true },
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

      return () => split.revert();
    },
  );
}
