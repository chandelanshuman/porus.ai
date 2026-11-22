const motion = matchMedia('(prefers-reduced-motion: reduce)');
const toggle = document.querySelector('[data-astro-toggle]');
const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
const scenes = [];
let paused = motion.matches;

function seeded(seed) {
  const value = Math.sin(seed) * 43758.5453;
  return value - Math.floor(value);
}

const colors = ['#946025', '#c88a32', '#e8a33d', '#f5c069', '#ffdc92'];

for (const canvas of document.querySelectorAll('[data-astro-canvas]')) {
  const context = canvas.getContext('2d');
  if (!context) continue;

  const hero = canvas.closest('.rl-hero');
  const cursor = { x: 0, y: 0, targetX: 0, targetY: 0, strength: 0, active: false, ready: false };

  if (hero) {
    hero.addEventListener('pointermove', event => {
      if (paused || motion.matches || !finePointer.matches || event.pointerType === 'touch') return;
      const bounds = canvas.getBoundingClientRect();
      cursor.targetX = event.clientX - bounds.left;
      cursor.targetY = event.clientY - bounds.top;
      if (!cursor.ready) {
        cursor.x = cursor.targetX;
        cursor.y = cursor.targetY;
        cursor.ready = true;
      }
      cursor.active = true;
    }, { passive: true });

    function releasePointer() {
      cursor.active = false;
      cursor.ready = false;
    }

    hero.addEventListener('pointerleave', releasePointer);
    hero.addEventListener('pointercancel', releasePointer);
    window.addEventListener('blur', releasePointer);
    finePointer.addEventListener('change', releasePointer);
  }
  const field = Array.from({ length: hero ? 200 : 95 }, (_, index) => ({
    x: seeded(index * 127.1 + 31.7),
    y: seeded(index * 269.5 + 17.3),
    depth: seeded(index * 78.2 + 2.5),
    phase: index * 2.41,
  }));

  // Points follow branching logarithmic arms, with a loose halo between them.
  const galaxy = Array.from({ length: hero ? 3900 : 0 }, (_, index) => {
    const radius = .024 + seeded(index * 314.4 + 83) ** 1.18 * .98;
    const dispersion = seeded(index * 87.9) + seeded(index * 147.6) - 1;
    const arm = index % 3;
    const twist = Math.log(radius + .1) * 1.85;
    const angle = arm * Math.PI * 2 / 3 + twist + dispersion * (.74 - radius * .38);
    const color = Math.floor(seeded(index * 91.3 + 54) * colors.length);
    return {
      radius,
      angle: index % 10 === 0 ? angle + dispersion * 6 : angle,
      color,
      size: .38 + seeded(index * 9.1 + 45) ** 3 * 1.5,
      brightness: .24 + seeded(index * 13.1 + 28) * .58,
    };
  }).sort((first, second) => first.color - second.color);

  const handoff = hero && createWaveformHandoff(canvas, galaxy);
  if (handoff) scenes.push(handoff.schedule);

  let width = 1;
  let height = 1;
  let elapsed = 0;
  let previous = 0;
  let frame = 0;
  let visible = true;

  function drawGalaxy() {
    const mobile = width <= 760;
    const shiftX = (cursor.x / width - .5) * 35 * cursor.strength;
    const shiftY = (cursor.y / height - .5) * 26 * cursor.strength;
    const centerX = width * (mobile ? .5 : .722) + shiftX;
    const centerY = height * (mobile ? .745 : .545) + shiftY;
    const radius = Math.min(width * (mobile ? .72 : .44), height * (mobile ? .36 : .68));
    const glow = context.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius * .71);
    glow.addColorStop(0, '#f5bc777a');
    glow.addColorStop(.025, '#e8a33d4b');
    glow.addColorStop(.12, '#cf80222d');
    glow.addColorStop(.48, '#ad621112');
    glow.addColorStop(1, '#ad621100');
    context.fillStyle = glow;
    context.fillRect(centerX - radius, centerY - radius, radius * 2, radius * 2);

    context.save();
    context.translate(centerX, centerY);
    const tilt = -.37;
    const entrance = motion.matches ? 1 : Math.min(1, elapsed / 1.15);
    const scale = 1 - .1 * (1 - entrance) ** 3;
    const cosTilt = Math.cos(tilt);
    const sinTilt = Math.sin(tilt);
    const localX = ((cursor.x - centerX) * cosTilt + (cursor.y - centerY) * sinTilt) / scale;
    const localY = ((cursor.y - centerY) * cosTilt - (cursor.x - centerX) * sinTilt) / scale;
    const reach = Math.min(165, width * .15);
    context.rotate(tilt);
    context.scale(scale, scale);
    let previousColor = -1;
    for (const star of galaxy) {
      const angle = star.angle + elapsed * (.035 + (1 - star.radius) * .016);
      const distance = star.radius * radius;
      let x = Math.cos(angle) * distance;
      let y = Math.sin(angle) * distance * .67;
      let light = 0;
      if (cursor.strength > .005) {
        const dx = x - localX;
        const dy = y - localY;
        const separation = Math.sqrt(dx * dx + dy * dy);
        if (separation < reach) {
          const falloff = (1 - separation / reach) * cursor.strength;
          const deflection = falloff * falloff * 4.0;
          // Local pressure and curl bend the arm without moving the whole galaxy.
          x += (dx * .15 - dy * .48) * deflection;
          y += (dy * .15 + dx * .48) * deflection;
          light = falloff * .53;
        }
      }
      if (star.color !== previousColor) {
        context.fillStyle = colors[star.color];
        previousColor = star.color;
      }
      const coreLight = Math.max(0, 1 - star.radius * 4);
      context.globalAlpha = Math.min(1, star.brightness * (1 - star.radius * .40) + coreLight * .24 + light);
      const size = star.size + light * 1.05;
      star.screenX = centerX + scale * (x * cosTilt - y * sinTilt);
      star.screenY = centerY + scale * (x * sinTilt + y * cosTilt);
      context.fillRect(x, y, size, size);
    }
    context.restore();
  }

  function draw() {
    context.clearRect(0, 0, width, height);
    const offsetX = (cursor.x / width - .5) * 21 * cursor.strength;
    const offsetY = (cursor.y / height - .5) * 16 * cursor.strength;
    for (const star of field) {
      const x = ((star.x + elapsed * (.00015 + star.depth * .00025)) % 1) * width + offsetX * star.depth;
      const size = .6 + star.depth ** 4 * 1.9;
      context.globalAlpha = (.74 + .26 * Math.sin(elapsed * .8 + star.phase))
        * (.18 + star.depth * .65);
      context.fillStyle = colors[Math.floor(star.depth * colors.length)];
      context.fillRect(x, star.y * height + offsetY * star.depth, size, size);
    }
    context.globalAlpha = 1;
    if (hero) drawGalaxy();
    handoff?.schedule();
  }

  function animate(now) {
    if (now - previous >= 32) {
      elapsed += Math.min((now - previous) / 1000, .05);
      previous = now;
      cursor.x += (cursor.targetX - cursor.x) * .23;
      cursor.y += (cursor.targetY - cursor.y) * .23;
      cursor.strength += ((cursor.active ? 1 : 0) - cursor.strength) * .15;
      draw();
    }
    frame = requestAnimationFrame(animate);
  }

  function syncScene() {
    if (paused || !visible || document.hidden) {
      cursor.active = false;
      cursor.ready = false;
      cancelAnimationFrame(frame);
      frame = 0;
    } else if (!frame) {
      previous = performance.now();
      frame = requestAnimationFrame(animate);
    }
  }

  function resize() {
    width = canvas.clientWidth || 1;
    height = canvas.clientHeight || 1;
    const ratio = Math.min(devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    draw();
  }

  new ResizeObserver(resize).observe(canvas);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      syncScene();
    }).observe(canvas);
  }
  scenes.push(syncScene);
  resize();
}

function smooth(start, end, value) {
  const t = Math.max(0, Math.min(1, (value - start) / (end - start)));
  return t * t * (3 - 2 * t);
}

function createWaveformHandoff(source, galaxy) {
  const tracks = [...document.querySelectorAll('#listen .rl-preview-wave')];
  const studioWave = document.querySelector('[data-rv-wave]');
  const backdrop = document.querySelector('[data-craft-stars]');
  const backdropContext = backdrop?.getContext('2d');
  const eclipse = document.querySelector('[data-eclipse]');
  const chip = eclipse && document.querySelector('[data-chip]');
  const die = chip?.firstElementChild;
  if (tracks.length !== 2 || !studioWave || !backdropContext) return null;
  const settledStars = Array.from({ length: 245 }, (_, index) => ({
    x: .02 + seeded(index * 75.17 + 11) * .96,
    y: .035 + seeded(index * 46.71 + 57) * .93,
    brightness: .17 + seeded(index * 33.9 + 29) * .56,
    phase: seeded(index * 81.1 + 1) * Math.PI * 2,
    size: .5 + seeded(index * 11.8 + 7) ** 2.8 * 1.45,
  }));

  const overlay = document.createElement('canvas');
  overlay.className = 'rl-star-handoff';
  overlay.setAttribute('aria-hidden', 'true');
  overlay.hidden = true;
  const context = overlay.getContext('2d');
  if (!context) return null;
  document.body.append(overlay);

  const bars = [...tracks, studioWave].map(track => [...track.querySelectorAll('i')]);
  const particles = galaxy.map((star, index) => ({
    star,
    row: index % tracks.length,
    settled: settledStars[index % settledStars.length],
    column: Math.floor(index / tracks.length) % bars[index % tracks.length].length,
    position: seeded(index * 11.91 + 84),
    drift: seeded(index * 38.83 + 971) * 2 - 1,
    release: seeded(index * 19.27 + 53) * .24,
    orbit: seeded(index * 7.31 + 3) * Math.PI * 2,
  }));
  let frame = 0;
  let geometry;
  let faded = false;
  let lastSparkle = -Infinity;
  let skyTime = 0;
  let previousSkyFrame = null;
  let charge = '';
  let chipCharge = '';
  const shootingStarOrigins = settledStars.filter(star => star.x > .14 && star.x < .62 && star.y > .08 && star.y < .45);

  function drawShootingStar(width, height) {
    const interval = 4600;
    const cycle = Math.floor((skyTime + 3100) / interval);
    const progress = ((skyTime + 3100) % interval) / 950;
    if (progress >= 1) return;

    const star = shootingStarOrigins[(cycle * 11) % shootingStarOrigins.length];
    const distance = Math.min(width * .31, 280);
    const x = star.x * width + progress * distance;
    const y = star.y * height + progress * distance * .48;
    const tail = distance * Math.min(progress, .36);
    const fade = Math.sin(Math.PI * progress);
    const trail = backdropContext.createLinearGradient(x - tail, y - tail * .48, x + 1, y);
    trail.addColorStop(0, '#e8a33d00');
    trail.addColorStop(.78, '#e8a33db0');
    trail.addColorStop(1, '#fff1c4');
    backdropContext.globalAlpha = fade * .8;
    backdropContext.strokeStyle = trail;
    backdropContext.lineWidth = 1.2;
    backdropContext.beginPath();
    backdropContext.moveTo(x - tail, y - tail * .48);
    backdropContext.lineTo(x, y);
    backdropContext.stroke();
    backdropContext.fillStyle = '#fff1c4';
    backdropContext.fillRect(x - 1, y - 1, 2, 2);
  }

  function measure() {
    const ratio = Math.min(devicePixelRatio || 1, 1.5);
    overlay.width = Math.round(innerWidth * ratio);
    overlay.height = Math.round(innerHeight * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    const waveBounds = bars.map(row => row.map(bar => {
      const bounds = bar.getBoundingClientRect();
      return { x: bounds.left + bounds.width / 2, y: bounds.top + scrollY, height: bounds.height };
    }));
    const bounds = source.getBoundingClientRect();
    const pageTop = bounds.top + scrollY;
    const start = pageTop + Math.min(130, bounds.height * .14);
    const lastDemoWave = waveBounds[tracks.length - 1][0];
    const end = Math.max(start + 250, lastDemoWave.y - innerHeight * .72);
    const studioStart = end + Math.min(185, innerHeight * .19);
    const studioEnd = Math.max(studioStart + 250, waveBounds.at(-1)[0].y - innerHeight * .75);
    const craft = backdrop.getBoundingClientRect();
    const craftTop = craft.top + scrollY;
    const craftStart = studioEnd + Math.min(170, innerHeight * .18);
    const craftEnd = Math.max(craftStart + 250, craftTop - innerHeight * .25);
    backdrop.width = Math.round(craft.width * ratio);
    backdrop.height = Math.round(craft.height * ratio);
    backdropContext.setTransform(ratio, 0, 0, ratio, 0, 0);
    // The sky empties into the eclipse once the craft section begins to leave.
    const disc = eclipse?.getBoundingClientRect();
    const eclipseStart = Math.max(craftEnd + 120, craftTop + craft.height - innerHeight * .6);
    const eclipseEnd = disc ? Math.max(eclipseStart + 250, disc.top + scrollY + disc.height / 2 - innerHeight * .5) : 0;
    // After resting on the ring, the stars carry its light down into the chip.
    const core = die?.getBoundingClientRect();
    const chipStart = eclipseEnd + Math.min(150, innerHeight * .16);
    const chipEnd = core ? Math.max(chipStart + 250, core.top + scrollY + core.height / 2 - innerHeight * .5) : 0;
    geometry = { waveBounds, pageTop, left: bounds.left, start, end, studioStart, studioEnd, eclipseStart, eclipseEnd, chipStart, chipEnd,
      craftTop, craftStart, craftEnd, craftWidth: craft.width, craftHeight: craft.height, craftLeft: craft.left };
    lastSparkle = -Infinity;
  }

  function restore() {
    if (!faded) return;
    source.style.removeProperty('opacity');
    [...tracks, studioWave].forEach(track => track.style.removeProperty('opacity'));
    overlay.hidden = true;
    faded = false;
  }

  function render(now) {
    frame = 0;
    if (document.hidden) {
      previousSkyFrame = null;
      restore();
      return;
    }
    if (!geometry) measure();
    const { start, end, pageTop, left, waveBounds, studioStart, studioEnd, eclipseStart, eclipseEnd, chipStart, chipEnd,
      craftTop, craftStart, craftEnd, craftWidth, craftHeight, craftLeft } = geometry;
    const still = paused || motion.matches;
    const towardChip = Boolean(die) && scrollY >= chipStart;
    const towardEclipse = Boolean(eclipse) && scrollY >= eclipseStart && !towardChip;
    const belowStudio = scrollY >= craftStart && !towardEclipse && !towardChip;
    const craftProgress = (scrollY - craftStart) / (craftEnd - craftStart);
    const eclipseProgress = eclipse ? (scrollY - eclipseStart) / (eclipseEnd - eclipseStart) : 0;
    const chipProgress = die ? (scrollY - chipStart) / (chipEnd - chipStart) : 0;
    // The ring gives up part of its light as the stars leave it for the chip.
    const nextCharge = (still ? 1 : smooth(.72, 1, eclipseProgress) * (1 - .45 * smooth(0, .46, chipProgress))).toFixed(3);
    if (eclipse && nextCharge !== charge) {
      charge = nextCharge;
      eclipse.style.setProperty('--eclipse-charge', charge);
    }
    const nextChipCharge = (still ? 1 : smooth(.72, 1, chipProgress)).toFixed(3);
    if (die && nextChipCharge !== chipCharge) {
      chipCharge = nextChipCharge;
      chip.style.setProperty('--chip-charge', chipCharge);
    }
    backdrop.style.opacity = String(still ? 1 : smooth(.78, 1, craftProgress) * (1 - .85 * smooth(0, .46, eclipseProgress)));
    const craftVisible = craftTop < scrollY + innerHeight && craftTop + craftHeight > scrollY;
    const shooting = craftVisible && !still && craftProgress >= 1;
    if (shooting && previousSkyFrame !== null) skyTime += Math.min(now - previousSkyFrame, 50);
    previousSkyFrame = shooting ? now : null;
    if (craftVisible) {
      if (now - lastSparkle > 32 || still) {
        lastSparkle = now;
        backdropContext.clearRect(0, 0, craftWidth, craftHeight);
        backdropContext.fillStyle = '#f0b859';
        for (const star of settledStars) {
          const glint = still ? .58 : .38 + .62 * ((Math.sin(now / 950 + star.phase) + 1) / 2) ** 3;
          backdropContext.globalAlpha = star.brightness * glint;
          backdropContext.fillRect(star.x * craftWidth, star.y * craftHeight, star.size, star.size);
        }
        if (shooting) drawShootingStar(craftWidth, craftHeight);
        backdropContext.globalAlpha = 1;
      }
      if (!still) schedule();
    }
    if (still) {
      restore();
      return;
    }
    const headingToStudio = scrollY >= studioStart && !belowStudio;
    let t = (scrollY - start) / (end - start);
    if (towardChip) t = chipProgress;
    else if (towardEclipse) t = eclipseProgress;
    else if (belowStudio) t = craftProgress;
    else if (headingToStudio) t = (scrollY - studioStart) / (studioEnd - studioStart);
    if (t <= 0 || t >= 1) {
      restore();
      return;
    }

    overlay.hidden = false;
    faded = true;
    const departure = smooth(0, .46, t);
    const landing = smooth(.81, 1, t);
    const pastCraft = towardEclipse || towardChip;
    source.style.opacity = headingToStudio || belowStudio || pastCraft ? '1' : String(1 - departure);
    tracks.forEach(track => { track.style.opacity = String(belowStudio || pastCraft ? 1 : headingToStudio ? 1 - departure : landing); });
    studioWave.style.opacity = String(belowStudio ? 1 - departure : headingToStudio ? landing : 1);
    context.clearRect(0, 0, innerWidth, innerHeight);

    let color = -1;
    if (towardChip) {
      // Each star leaves its point on the ring and settles across the chip's tilted die.
      const disc = eclipse.getBoundingClientRect();
      const ringX = disc.left + disc.width / 2;
      const ringY = disc.top + disc.height / 2;
      const ringRadius = disc.width / 2 + 1.5;
      const core = die.getBoundingClientRect();
      const coreX = core.left + core.width / 2;
      const coreY = core.top + core.height / 2;
      const span = die.offsetWidth * .86;
      const cosTilt = Math.cos(-.14);
      const sinTilt = Math.sin(-.14);
      for (const { star, position, drift, release, orbit } of particles) {
        const flight = smooth(release, .93, t);
        const scatter = Math.sin(Math.PI * flight);
        const ring = ringRadius + (position - .5) * 7;
        const originX = ringX + Math.cos(orbit) * ring;
        const originY = ringY + Math.sin(orbit) * ring;
        const u = (position - .5) * span;
        const v = drift * .5 * span;
        const targetX = coreX + u * cosTilt - v * sinTilt;
        const targetY = coreY + u * sinTilt + v * cosTilt;
        const x = originX * (1 - flight) + targetX * flight + drift * 80 * scatter;
        const y = originY * (1 - flight) + targetY * flight - scatter * (78 + drift * 52);
        const size = star.size * (1 - flight) + 1.55 * flight;
        if (star.color !== color) {
          color = star.color;
          context.fillStyle = colors[color];
        }
        context.globalAlpha = star.brightness * (1 - landing) * departure;
        context.fillRect(x, y, size, size);
      }
      context.globalAlpha = 1;
      return;
    }

    if (towardEclipse) {
      // The full galaxy lifts out of the sky and spirals onto the eclipse ring.
      const disc = eclipse.getBoundingClientRect();
      const ringX = disc.left + disc.width / 2;
      const ringY = disc.top + disc.height / 2;
      const ringRadius = disc.width / 2 + 1.5;
      for (const { star, position, drift, release, settled, orbit } of particles) {
        const flight = smooth(release, .93, t);
        const scatter = Math.sin(Math.PI * flight);
        const angle = orbit + (1 - flight) * 1.4;
        const ring = ringRadius + (position - .5) * 7;
        const originX = craftLeft + (settled.x + drift * .05) * craftWidth;
        const originY = craftTop + (settled.y + (position - .5) * .1) * craftHeight - scrollY;
        const x = originX * (1 - flight) + (ringX + Math.cos(angle) * ring) * flight + drift * 80 * scatter;
        const y = originY * (1 - flight) + (ringY + Math.sin(angle) * ring) * flight - scatter * (78 + drift * 52);
        const size = star.size * (1 - flight) + 1.55 * flight;
        if (star.color !== color) {
          color = star.color;
          context.fillStyle = colors[color];
        }
        context.globalAlpha = star.brightness * (1 - landing) * departure;
        context.fillRect(x, y, size, size);
      }
      context.globalAlpha = 1;
      return;
    }

    for (const { star, row, column, position, drift, release, settled } of particles) {
      const demoBar = waveBounds[row][column];
      const studioBars = waveBounds.at(-1);
      const studioBar = studioBars[column % studioBars.length];
      const target = headingToStudio ? studioBar : demoBar;
      const origin = belowStudio ? studioBar : headingToStudio ? demoBar : null;
      const originX = origin ? origin.x : left + star.screenX;
      const originY = origin ? origin.y + origin.height * position : pageTop + star.screenY;
      const targetX = belowStudio ? craftLeft + settled.x * craftWidth : target.x;
      const targetY = belowStudio ? craftTop + settled.y * craftHeight : target.y + target.height * position;
      const flight = smooth(release, .93, t);
      const scatter = Math.sin(Math.PI * flight);
      const x = originX * (1 - flight) + targetX * flight + drift * 80 * scatter;
      const y = originY * (1 - flight)
        + targetY * flight - scrollY - scatter * (78 + drift * 52);
      const size = star.size * (1 - flight) + 1.55 * flight;
      if (star.color !== color) {
        color = star.color;
        context.fillStyle = colors[color];
      }
      context.globalAlpha = star.brightness * (1 - landing) * departure;
      context.fillRect(x, y, size, size);
    }
    context.globalAlpha = 1;
  }

  function schedule() {
    if (!frame) frame = requestAnimationFrame(render);
  }

  function invalidate() {
    geometry = undefined;
    schedule();
  }

  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', invalidate, { passive: true });
  const observer = new ResizeObserver(invalidate);
  observer.observe(source);
  observer.observe(backdrop.parentElement);
  observer.observe(document.querySelector('#listen'));
  observer.observe(studioWave.closest('[data-rv-studio]'));
  if (eclipse) observer.observe(eclipse.closest('.rl-uses'));
  if (chip) observer.observe(chip.closest('.rl-engine'));
  // Language changes adjust the bar heights without changing the overall panel size.
  const waveObserver = new MutationObserver(changes => {
    if (changes.some(change => change.target !== studioWave)) invalidate();
  });
  waveObserver.observe(studioWave, { subtree: true, attributes: true, attributeFilter: ['style'] });
  // Ignore the handoff's own opacity updates on the waveform itself.
  document.fonts.ready.then(invalidate);
  return { schedule };
}

function sync() {
  document.documentElement.classList.toggle('atmosphere-paused', paused);
  if (toggle) toggle.textContent = paused ? 'Play atmosphere' : 'Pause atmosphere';
  scenes.forEach(update => update());
}

toggle?.addEventListener('click', () => {
  paused = !paused;
  sync();
});
motion.addEventListener('change', event => {
  paused = event.matches;
  sync();
});
document.addEventListener('visibilitychange', sync);
sync();
