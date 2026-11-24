(function () {
  var root = document.documentElement, $ = function (q) { return document.querySelector(q); };
  var tone = $('#tone');
  function cur() { return root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'; }
  function label() { tone.textContent = cur() === 'dark' ? 'Light' : 'Dark'; }
  label();
  tone.addEventListener('click', function () { var n = cur() === 'dark' ? 'light' : 'dark'; root.setAttribute('data-theme', n); try { localStorage.setItem('theme', n); } catch (e) {} label(); });
  var mb = $('#menu'), side = $('.side');
  mb.addEventListener('click', function () { mb.setAttribute('aria-expanded', side.classList.toggle('open')); });
  // Only photos not already loaded are held back, and shown once fully decoded.
  var ims = [].slice.call(document.querySelectorAll('.ph:not(.gated) img'));
  ims.forEach(function (im) {
    if (im.complete && im.naturalWidth) return;
    im.classList.add('wait');
    function on() { (im.decode ? im.decode().catch(function () {}) : Promise.resolve()).then(function () { im.classList.remove('wait'); }); }
    im.addEventListener('load', on); im.addEventListener('error', on);
  });
  // Then fetch the rest of the strip in order, so nothing is still loading when you reach it.
  addEventListener('load', function () { (function next(k) { if (k >= ims.length) return; var im = ims[k]; if (im.complete && im.naturalWidth) return next(k + 1); var f = function () { next(k + 1); }; im.addEventListener('load', f, { once: true }); im.addEventListener('error', f, { once: true }); im.loading = 'eager'; })(0); });

  var strip = $('.strip'); if (!strip) return;

  // ---- one photo fills the window (the browser itself never goes full screen)
  var all = [].slice.call(strip.querySelectorAll('.ph:not(.gated)')), fs = document.createElement('div'), at = -1, back = null;
  fs.id = 'fs'; fs.hidden = true; fs.tabIndex = -1; fs.setAttribute('role', 'dialog'); fs.setAttribute('aria-modal', 'true'); fs.setAttribute('aria-label', 'Photograph, enlarged');
  fs.innerHTML = '<img alt="" draggable="false"><p></p><button type="button" class="pv" aria-label="Previous photograph"></button><button type="button" class="nx" aria-label="Next photograph"></button><label class="zm"><span aria-hidden="true">−</span><input type="range" min="1" max="4" step="0.01" value="1" aria-label="Zoom"><span aria-hidden="true">+</span></label><button type="button" class="x" aria-label="Close"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><path d="M5 5 19 19M19 5 5 19"/></svg></button>';
  document.body.appendChild(fs);
  var fi = fs.querySelector('img'), fp = fs.querySelector('p');
  // zoom slider; drag to move around a zoomed photograph
  var zr = fs.querySelector('input'), z = 1, px = 0, py = 0, pd = null, panned = false;
  function bounds() {
    var k = Math.min(fs.clientWidth / (fi.naturalWidth || 1), fs.clientHeight / (fi.naturalHeight || 1));
    var mx = Math.max(0, (fi.naturalWidth * k * z - fs.clientWidth) / 2), my = Math.max(0, (fi.naturalHeight * k * z - fs.clientHeight) / 2);
    px = Math.max(-mx, Math.min(mx, px)); py = Math.max(-my, Math.min(my, py));
  }
  function place() { bounds(); fi.style.transform = z > 1 ? 'translate(' + px + 'px,' + py + 'px) scale(' + z + ')' : ''; fs.classList.toggle('zoomed', z > 1); }
  function zoom(v) { v = Math.max(1, Math.min(4, v)); px *= v / z; py *= v / z; z = v; zr.value = v; place(); }
  zr.addEventListener('input', function () { zoom(+zr.value); });
  addEventListener('resize', function () { if (!fs.hidden) place(); });
  fs.addEventListener('wheel', function (e) { e.preventDefault(); zoom(z * Math.exp(-e.deltaY * 0.002)); }, { passive: false });
  fs.addEventListener('pointerdown', function (e) { panned = false; if (z <= 1 || e.target.closest('.zm, .x')) return; pd = [e.clientX - px, e.clientY - py, e.clientX, e.clientY]; fs.setPointerCapture(e.pointerId); });
  fs.addEventListener('pointermove', function (e) { if (!pd) return; if (Math.abs(e.clientX - pd[2]) + Math.abs(e.clientY - pd[3]) > 4) panned = true; px = e.clientX - pd[0]; py = e.clientY - pd[1]; place(); });
  fs.addEventListener('pointerup', function () { pd = null; }); fs.addEventListener('pointercancel', function () { pd = null; });
  function big(f) { var im = f.querySelector('img'); return (im.getAttribute('srcset') || '').split(',').pop().trim().split(' ')[0] || im.src; }
  function ahead(k) { if (all[k]) { new Image().src = big(all[k]); } }
  function show(k) {
    if (k < 0 || k >= all.length) return; at = k; z = 1; px = py = 0; zr.value = 1; place();
    var im = all[k].querySelector('img'), url = big(all[k]), n = new Image();
    n.onload = n.onerror = function () { (n.decode ? n.decode().catch(function () {}) : Promise.resolve()).then(function () { if (at === k) { fi.src = url; fi.alt = im.alt; } }); };
    n.src = url;
    fp.innerHTML = all[k].querySelector('figcaption').innerHTML;
    fs.classList.toggle('first', k === 0); fs.classList.toggle('last', k === all.length - 1);
    try { history.replaceState(null, '', '#' + all[k].id); } catch (e) {}
    ahead(k + 1); ahead(k - 1);
  }
  function open(k) {
    back = document.activeElement; fi.src = all[k].querySelector('img').currentSrc || big(all[k]);   // what is already on screen, so nothing blinks
    fs.hidden = false; root.classList.add('fs'); show(k); fs.focus();
  }
  function close() {
    if (fs.hidden) return; fs.hidden = true; root.classList.remove('fs');
    var f = all[at];
    function align() { if (!f || !fs.hidden) return; if (wide.matches) { target = clamp(edge(f)); moving = false; strip.scrollLeft = target; } else f.scrollIntoView({ block: 'center' }); }
    align();
    if (back && back.focus) back.focus({ preventScroll: true });
  }
  fs.addEventListener('click', function (e) { if (e.target.closest('.zm')) return; if (z > 1 && !e.target.closest('.x')) return; if (e.target.closest('.pv')) show(at - 1); else if (e.target.closest('.nx')) show(at + 1); else close(); });
  addEventListener('keydown', function (e) {
    if (fs.hidden) return;
    if (e.target === zr && /^Arrow|Home|End/.test(e.key)) { e.stopImmediatePropagation(); return; }
    if (e.key === '+' || e.key === '=') zoom(z * 1.25); else if (e.key === '-') zoom(z / 1.25); else if (e.key === 'Escape') close(); else if (e.key === 'ArrowRight' || e.key === ' ') show(at + 1); else if (e.key === 'ArrowLeft') show(at - 1);
    else if (e.key === 'Tab') return; else return;
    e.preventDefault(); e.stopImmediatePropagation();
  }, true);
  var tx = null;
  fs.addEventListener('touchstart', function (e) { tx = e.touches.length === 1 ? e.touches[0].clientX : null; }, { passive: true });
  fs.addEventListener('touchend', function (e) { if (tx === null || z > 1 || e.target.closest('.zm')) return; var d = e.changedTouches[0].clientX - tx; tx = null; if (Math.abs(d) > 45) { e.preventDefault(); show(at + (d < 0 ? 1 : -1)); } });
  function arm(f) {
    var im = f.querySelector('img'); im.tabIndex = 0; im.setAttribute('role', 'button'); im.setAttribute('aria-label', 'Enlarge photograph');
    im.addEventListener('click', function () { if (moved <= 4) open(all.indexOf(f)); });
    im.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); open(all.indexOf(f)); } });
  }
  all.forEach(arm);

  var wide = matchMedia('(min-width: 561px)'), calm = matchMedia('(prefers-reduced-motion: reduce)');
  var stops = [].slice.call(strip.children).filter(function (e) { return e.id !== 'prog' && !e.hidden; });
  var photos = stops.filter(function (e) { return e.classList.contains('ph'); });
  var cap = $('#cap'), count = $('#count'), prog = $('#prog'), target = 0, moving = false, now = -1;
  // Photographs behind a content note: not fetched until asked for.
  var rv = $('#reveal');
  if (rv) rv.addEventListener('click', function () {
    [].slice.call(strip.querySelectorAll('.ph.gated')).forEach(function (f) {
      var im = f.querySelector('img'); f.classList.remove('gated'); f.hidden = false;
      im.srcset = im.getAttribute('data-srcset'); im.src = im.getAttribute('data-src');
      all.push(f); photos.push(f); arm(f);
    });
    stops = [].slice.call(strip.children).filter(function (e) { return e.id !== 'prog' && !e.hidden; });
    rv.hidden = true; now = -1; update();
    var f = photos[photos.length - strip.querySelectorAll('img[data-src]').length];
    if (wide.matches) go(edge(f)); else f.scrollIntoView({ block: 'start' });
  });
  function pad() { return side.offsetWidth; }
  function max() { return strip.scrollWidth - strip.clientWidth; }
  function clamp(x) { return Math.max(0, Math.min(max(), x)); }
  function step() {
    var d = target - strip.scrollLeft;
    if (Math.abs(d) < 1) { strip.scrollLeft = target; moving = false; return; }
    strip.scrollLeft += d * 0.13 + (d > 0 ? 0.5 : -0.5); requestAnimationFrame(step);
  }
  function go(x) { target = clamp(x); if (calm.matches || document.hidden) { strip.scrollLeft = target; return; } if (!moving) { moving = true; requestAnimationFrame(step); } }
  function base() { return moving ? target : strip.scrollLeft; }
  function edge(e) { return e.offsetLeft - pad(); }
  function update() {
    if (!wide.matches) return;
    var m = max(); prog.style.transform = 'scaleX(' + (m ? strip.scrollLeft / m : 0) + ')';
    var mid = strip.scrollLeft + pad() + (strip.clientWidth - pad()) * 0.4, k = 0;
    photos.forEach(function (p, i) { if (p.offsetLeft <= mid) k = i; });
    if (k === now) return;
    var start = now < 0; now = k;
    if (!start || k) { cap.innerHTML = photos[k].querySelector('figcaption').innerHTML; count.textContent = (k + 1) + ' / ' + photos.length; }
    if (!start) try { history.replaceState(null, '', '#' + photos[k].id); } catch (e) {}
  }
  strip.addEventListener('scroll', update, { passive: true }); addEventListener('resize', update);
  addEventListener('wheel', function (e) {
    if (!fs.hidden) { e.preventDefault(); return; }
    if (!wide.matches || e.ctrlKey) return;
    var t = e.target.closest && e.target.closest('.tx');
    if (t && t.scrollHeight > t.clientHeight + 2 && Math.abs(e.deltaY) > Math.abs(e.deltaX)) return;
    if (Math.abs(e.deltaX) >= Math.abs(e.deltaY)) return;   // sideways trackpad: native
    e.preventDefault(); go(base() + e.deltaY * (e.deltaMode === 1 ? 32 : 1.6));
  }, { passive: false });
  function jump(dir) {
    var x = base(), xs = stops.map(edge);
    if (dir > 0) { var n = xs.filter(function (v) { return v > x + 4; })[0]; go(n === undefined ? max() : n); }
    else { var p = xs.filter(function (v) { return v < x - 4; }); go(p.length ? p[p.length - 1] : 0); }
  }
  addEventListener('keydown', function (e) {
    if (!wide.matches || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'ArrowRight' || e.key === ' ') { if (e.key === ' ' && e.target.closest('a,button')) return; e.preventDefault(); jump(1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); jump(-1); }
    if (e.key === 'Home') { e.preventDefault(); go(0); } if (e.key === 'End') { e.preventDefault(); go(max()); }
  });
  var x0 = null, s0 = 0, moved = 0;
  strip.addEventListener('pointerdown', function (e) { moved = 0; if (!wide.matches || e.pointerType !== 'mouse' || e.button || e.target.closest('a,.tx')) return; x0 = e.clientX; s0 = strip.scrollLeft; moved = 0; moving = false; target = s0; });
  addEventListener('pointermove', function (e) { if (x0 === null) return; moved = Math.max(moved, Math.abs(e.clientX - x0)); if (moved > 4) { strip.classList.add('drag'); strip.scrollLeft = s0 - (e.clientX - x0); } });
  addEventListener('pointerup', function (e) { if (x0 === null) return; x0 = null; strip.classList.remove('drag'); });
  function land() { var el = location.hash && document.getElementById(location.hash.slice(1)); if (el && wide.matches) { target = clamp(edge(el)); strip.scrollLeft = target; } update(); }
  land(); addEventListener('hashchange', land);
})();
