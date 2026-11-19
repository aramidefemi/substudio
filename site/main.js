// Waveform illustration + latest version label. No trackers, no third parties
// beyond one call to GitHub's public API for the release name.

(function drawWave() {
  const svg = document.querySelector(".wave-svg");
  if (!svg) return;
  const n = 250;
  const w = 1000 / n;
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  // Speech-like envelope: bursts of words with short pauses between lines.
  const env = (x) => {
    const t = x / n;
    const speech = [
      [0.065, 0.235], [0.275, 0.475], [0.515, 0.655], [0.68, 0.79], [0.84, 0.97],
    ];
    const inside = speech.find(([a, b]) => t >= a && t <= b);
    if (!inside) return 0.06;
    const [a, b] = inside;
    const p = (t - a) / (b - a);
    return 0.35 + 0.65 * Math.sin(Math.PI * p) * (0.6 + 0.4 * Math.sin(p * 19));
  };
  // Bars inside a cue box use waveform-b; inside the selected cue, waveform-selected
  // (same rule as the app). Ranges match the .cue-box positions in index.html.
  const cues = [...document.querySelectorAll(".cue-box")].map((el) => {
    const left = parseFloat(el.style.left) / 100;
    return { a: left, b: left + parseFloat(el.style.width) / 100, sel: el.classList.contains("sel") };
  });
  const paths = { "": "", "in-cue": "", "in-sel": "" };
  for (let i = 0; i < n; i++) {
    const h = Math.max(1.5, env(i) * (0.45 + 0.55 * rand()) * 54);
    const x = i * w + w / 2;
    const t = x / 1000;
    const cue = cues.find((c) => t >= c.a && t <= c.b);
    const cls = cue ? (cue.sel ? "in-sel" : "in-cue") : "";
    paths[cls] += `M${x.toFixed(1)} ${(60 - h).toFixed(1)}V${(60 + h).toFixed(1)}`;
  }
  svg.innerHTML = Object.entries(paths)
    .map(([cls, d]) => `<path class="${cls}" d="${d}" />`)
    .join("");
})();

(async function version() {
  const els = document.querySelectorAll("[data-version]");
  if (!els.length) return;
  try {
    const res = await fetch("https://api.github.com/repos/aramidefemi/substudio/releases/latest", {
      headers: { Accept: "application/vnd.github+json" },
    });
    if (!res.ok) return;
    const { tag_name: tag, published_at: at } = await res.json();
    if (!tag) return;
    const date = at
      ? new Date(at).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })
      : "";
    els.forEach((el) => (el.textContent = date ? `${tag} · ${date}` : tag));
  } catch {
    /* offline or rate-limited: keep the static label */
  }
})();
