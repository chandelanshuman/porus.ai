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
