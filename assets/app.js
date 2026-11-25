(function () {
  var norm = function (s) {
    return s.toLowerCase().replace(/œ/g, "oe").replace(/æ/g, "ae").normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
  };
  var esc = function (s) {
    return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; });
  };
  var reduce = (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) || document.documentElement.classList.contains("a-calme");

  // Confort de lecture : taille, contraste, police, espacement, animations (gardé sur l'appareil)
  var dlg = document.getElementById("a11y");
  if (dlg && dlg.showModal) {
    var A = {};
    try { A = JSON.parse(localStorage.getItem("ews_a11y") || "{}"); } catch (e) {}
    var html = document.documentElement;
    var applyA = function () {
      html.className = html.className.replace(/\ba-[\w-]+/g, "").trim();
      Object.keys(A).forEach(function (k) { if (A[k]) html.classList.add("a-" + k + (A[k] === true ? "" : "-" + A[k])); });
      dlg.querySelectorAll(".a11y-row button").forEach(function (b) { b.setAttribute("aria-pressed", (A.taille || "") === b.dataset.v); });
      dlg.querySelectorAll(".a11y-t").forEach(function (b) { b.setAttribute("aria-pressed", !!A[b.dataset.k]); });
      if (A.calme) document.querySelectorAll(".rise").forEach(function (e) { e.classList.add("in"); });
      try { localStorage.setItem("ews_a11y", JSON.stringify(A)); } catch (e) {}
    };
    applyA();
    document.querySelectorAll(".a11y-open").forEach(function (b) {
      b.addEventListener("click", function () { dlg.showModal(); });
    });
    dlg.addEventListener("click", function (e) {
      if (e.target === dlg) { dlg.close(); return; }
      var b = e.target.closest("button[type=button]");
      if (!b) return;
      if (b.closest(".a11y-row")) A.taille = b.dataset.v;
      else if (b.classList.contains("a11y-t")) A[b.dataset.k] = !A[b.dataset.k];
      else if (b.classList.contains("a11y-reset")) A = {};
      applyA();
    });
  } else if (dlg) {
    document.querySelectorAll(".a11y-open").forEach(function (b) { b.hidden = true; });
  }

  // Entrées : chaque élément .rise apparaît en arrivant à l'écran, avec un léger décalage entre voisins
  var rise = function (root) {
    var els = (root || document).querySelectorAll(".rise:not(.in)");
    if (reduce || !("IntersectionObserver" in window)) { els.forEach(function (e) { e.classList.add("in"); }); return; }
    var io = new IntersectionObserver(function (entries) {
      var n = 0;
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        en.target.style.transitionDelay = (n++ * 70) + "ms";
        en.target.classList.add("in");
        io.unobserve(en.target);
      });
    }, { rootMargin: "0px 0px -8% 0px" });
    els.forEach(function (e) { io.observe(e); });
  };
  rise();

  // Portions : recalcule les quantités (aussi après un changement de version)
  var box = document.querySelector(".portions");
  var rescale = function () {};
  if (box) {
    var base = +box.dataset.base, n = base;
    var fmt = function (q) {
      var w = Math.floor(q), r = Math.round((q - w) * 100) / 100;
      var f = { 0.25: "¼", 0.5: "½", 0.75: "¾" }[r];
      if (f) return (w ? w : "") + f;
      if (q >= 10) return String(Math.round(q));
      return (Math.round(q * 10) / 10).toString().replace(".", ",");
    };
    rescale = function (bump) {
      box.querySelector(".n").textContent = n;
      var u = box.querySelector(".u");
      if (u) u.textContent = n > 1 ? u.dataset.u2 : u.dataset.u1;
      document.querySelectorAll(".q").forEach(function (el) {
        el.textContent = fmt(+el.dataset.q * n / base);
        if (bump) { el.classList.remove("bump"); void el.offsetWidth; el.classList.add("bump"); }
      });
    };
    box.addEventListener("click", function (e) {
      var d = e.target.closest("button");
      if (!d) return;
      n = Math.max(1, Math.min(20, n + +d.dataset.d));
      rescale(true);
    });
  }

  // Étapes : on coche ce qui est fait
  document.querySelectorAll(".step-n").forEach(function (b) {
    b.addEventListener("click", function () {
      var on = b.getAttribute("aria-pressed") !== "true";
      b.setAttribute("aria-pressed", on);
      b.closest("li").classList.toggle("done", on);
    });
  });

  // Minuteurs : chaque durée d'une étape devient un bouton qui lance un compte à rebours
  var timers = null;
  var fmtT = function (t) {
    var h = Math.floor(t / 3600), m = Math.floor(t % 3600 / 60), x = t % 60, p = function (v) { return (v < 10 ? "0" : "") + v; };
    return (h ? h + ":" + p(m) : p(m)) + ":" + p(x);
  };
  var ring = function () {
    try {
      var C = window.AudioContext || window.webkitAudioContext, a = new C();
      [0, .35, .7].forEach(function (d) {
        var o = a.createOscillator(), g = a.createGain();
        o.frequency.value = 880; o.connect(g); g.connect(a.destination);
        g.gain.setValueAtTime(.25, a.currentTime + d); g.gain.exponentialRampToValueAtTime(.001, a.currentTime + d + .3);
        o.start(a.currentTime + d); o.stop(a.currentTime + d + .3);
      });
    } catch (e) {}
    if (navigator.vibrate) navigator.vibrate([300, 150, 300]);
  };
  var startTimer = function (secs, label) {
    if (!timers) {
      timers = document.createElement("div");
      timers.className = "timers"; timers.setAttribute("role", "region"); timers.setAttribute("aria-label", "Minuteurs");
      var say = document.createElement("p"); say.className = "sr"; say.setAttribute("role", "status"); say.id = "tmr-say"; document.body.appendChild(say);
      document.body.appendChild(timers);
    }
    var el = document.createElement("div"), left = secs, end = Date.now() + secs * 1000, paused = false, id;
    el.className = "timer";
    el.innerHTML = '<span class="t-lab"></span><span class="t-time">' + fmtT(left) + '</span>'
      + '<button type="button" class="t-pause">Pause</button><button type="button" class="t-x" aria-label="Arrêter ce minuteur">×</button>';
    el.querySelector(".t-lab").textContent = label;
    timers.appendChild(el);
    var announce = function (t) { var z = document.getElementById("tmr-say"); z.textContent = ""; setTimeout(function () { z.textContent = t; }, 50); };
    var dur = function (t) { var h = Math.floor(t / 3600), m = Math.floor(t % 3600 / 60), x = t % 60; return [h ? h + " h" : "", m ? m + " min" : "", x ? x + " s" : ""].join(" ").trim(); };
    announce("Minuteur lancé, " + label + " : " + dur(secs) + ".");
    var tick = function () {
      if (paused) return;
      left = Math.max(0, Math.round((end - Date.now()) / 1000));
      el.querySelector(".t-time").textContent = fmtT(left);
      if (!left) {
        clearInterval(id); el.classList.add("ring"); ring();
        el.querySelector(".t-time").textContent = "C'est prêt !";
        announce(label + " : c'est prêt !");
        el.querySelector(".t-pause").hidden = true;
      }
    };
    id = setInterval(tick, 250);
    el.querySelector(".t-pause").addEventListener("click", function (e) {
      paused = !paused;
      if (!paused) end = Date.now() + left * 1000;
      e.target.textContent = paused ? "Reprendre" : "Pause";
    });
    el.querySelector(".t-x").addEventListener("click", function () { clearInterval(id); el.remove(); });
  };
  var DUR = /(\d+(?:,\d+)?)\s*(heures?|minutes?|min\b|secondes?)(?:\s*(\d+)(?!\s*(?:°|g\b|cm|ml|%)))?/g;
  var linkify = function (p) {
    if (!p || p.querySelector(".tmr")) return;
    p.innerHTML = p.innerHTML.replace(DUR, function (all, n, u, extra) {
      var v = parseFloat(n.replace(",", ".")), s = /^h/.test(u) ? v * 3600 : /^s/.test(u) ? v : v * 60;
      if (extra && /^h/.test(u)) s += +extra * 60; else if (extra && /^m/.test(u)) s += +extra;
      if (s < 10 || s > 4 * 3600) return all;
      return '<button type="button" class="tmr" data-s="' + Math.round(s) + '"><span class="sr">Lancer un minuteur de </span>' + all + "</button>";
    });
  };
  var stepsList = document.querySelector(".steps");
  if (stepsList) {
    stepsList.querySelectorAll("li p").forEach(linkify);
    if (stepsList.querySelector(".tmr")) { var hint = document.querySelector(".tmr-hint"); if (hint) hint.hidden = false; }
    stepsList.addEventListener("click", function (e) {
      var b = e.target.closest(".tmr");
      if (!b) return;
      var li = b.closest("li"), n = li.querySelector(".step-n");
      startTimer(+b.dataset.s, "Étape " + (n ? n.textContent : ""));
    });
  }

  // Liste de courses : les quantités et la version affichées, à copier ou partager
  var courses = document.querySelector(".courses");
  if (courses) {
    courses.hidden = false;
    courses.querySelector(".print-btn").addEventListener("click", function () { window.print(); });
    courses.querySelector(".courses-btn").addEventListener("click", function () {
      var title = (document.querySelector("h1") || {}).textContent || "";
      var lines = [title + " (" + box.querySelector("output").textContent.trim() + ")"];
      document.querySelectorAll(".pantry h3, .pantry .ingr li").forEach(function (el) {
        if (el.hidden || el.closest("[hidden]")) return;
        var c = el.cloneNode(true);
        c.querySelectorAll(".info").forEach(function (a) { a.remove(); });
        var t = c.textContent.replace(/\s+/g, " ").trim();
        if (t) lines.push(el.tagName === "H3" ? "\n" + t.toUpperCase() : "☐ " + t);
      });
      lines.push("\n" + location.href.split("#")[0]);
      var txt = lines.join("\n"), msg = courses.querySelector(".courses-msg");
      var ok = function () { msg.textContent = "Liste copiée : colle-la dans tes notes ou un message."; };
      if (navigator.share && matchMedia("(pointer: coarse)").matches) {
        navigator.share({ title: "Liste de courses : " + title, text: txt }).catch(function () {});
      } else if (navigator.clipboard) {
        navigator.clipboard.writeText(txt).then(ok, function () { msg.textContent = txt; });
      } else { msg.textContent = txt; }
    });
  }

  // Version classique / végétarienne / vegan : remplace les lignes concernées
  var V = window.EWS_VARIANTES, reg = document.querySelector(".regime");
  if (reg && V) {
    var note = document.querySelector(".regime-note");
    var ings = document.querySelectorAll(".ingr li[data-k]");
    var steps = document.querySelectorAll(".steps li[data-k]");
    ings.forEach(function (li) { li.dataset.orig = li.innerHTML; });
    steps.forEach(function (li) { li.dataset.orig = li.querySelector("p").innerHTML; });
    var setReg = function (k, remember) {
      var v = k ? V[k] : null;
      if (k && (!v || !v.ok)) {
        note.textContent = v ? v.note : "Pas de version " + (k === "vegan" ? "vegan" : "végétarienne") + " pour cette recette.";
        note.hidden = false;
        return;
      }
      reg.querySelectorAll("button").forEach(function (b) { b.setAttribute("aria-pressed", b.dataset.r === k); });
      ings.forEach(function (li) {
        var x = v ? v.ing[li.dataset.k] : undefined;
        li.hidden = x === "";
        li.innerHTML = x ? x : li.dataset.orig;
      });
      var i = 0;
      steps.forEach(function (li) {
        var x = v ? v.steps[li.dataset.k] : undefined;
        li.hidden = x === "";
        li.querySelector("p").innerHTML = x ? x : li.dataset.orig;
        linkify(li.querySelector("p"));
        if (!li.hidden) {
          i++;
          var b = li.querySelector(".step-n");
          b.textContent = i;
          b.setAttribute("aria-label", "Étape " + i + " faite");
        }
      });
      note.textContent = v ? v.note : "";
      note.hidden = !v;
      rescale(false);
      if (remember) {
        try { localStorage.setItem("ews_regime", k); } catch (e) {}
        var u = new URL(location.href);
        if (k) u.searchParams.set("regime", k); else u.searchParams.delete("regime");
        history.replaceState(null, "", u);
      }
    };
    reg.addEventListener("click", function (e) {
      var b = e.target.closest("button");
      if (b) setReg(b.dataset.r, true);
    });
    var want = new URLSearchParams(location.search).get("regime");
    if (want === null) { try { want = localStorage.getItem("ews_regime"); } catch (e) {} }
    if (want && V[want] && V[want].ok) setReg(want, false);
  }

  // Accueil et pages thématiques : recherche + catégories + filtres combinables
  var list = document.getElementById("list");
  if (list) {
    var q = document.getElementById("q"), cat = "", none = document.getElementById("none");
    var text = {}, on = {};
    (window.KS_INDEX || []).forEach(function (r) { text[r.s] = r.t; });
    var tests = {
      vege: function (li) { return li.dataset.vege === "1"; },
      vegan: function (li) { return li.dataset.vegan === "1"; },
      rapide: function (li) { return +li.dataset.temps <= 30; },
      facile: function (li) { return li.dataset.diff === "Facile"; },
      doux: function (li) { return +li.dataset.epice <= 1; }
    };
    var apply = function () {
      var words = q ? norm(q.value).split(/\s+/).filter(Boolean) : [], shown = 0;
      var regime = on.vegan ? "vegan" : on.vege ? "vegetarien" : "";
      list.querySelectorAll(".cat").forEach(function (c) {
        var inCat = 0;
        c.querySelectorAll(".dish").forEach(function (li) {
          var ok = (!cat || li.dataset.cat === cat)
            && Object.keys(on).every(function (t) { return !on[t] || tests[t](li); })
            && words.every(function (w) { return (" " + (text[li.dataset.slug] || "")).search(new RegExp("[^a-z]" + w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))) > -1; });
          li.hidden = !ok;
          if (ok) { inCat++; li.classList.add("in"); }
          var a = li.querySelector("a"), h = a.getAttribute("href").split("?")[0];
          a.setAttribute("href", regime ? h + "?regime=" + regime : h);
          li.querySelectorAll(".dish-var").forEach(function (v) { v.hidden = v.dataset.r !== regime; });
        });
        c.hidden = !inCat;
        var cnt = c.querySelector(".cat-head span");
        if (cnt) cnt.textContent = inCat + " recette" + (inCat > 1 ? "s" : "");
        shown += inCat;
      });
      if (none) none.hidden = shown > 0;
    };
    if (q) q.addEventListener("input", apply);
    document.querySelectorAll(".chip[data-f]").forEach(function (c) {
      c.addEventListener("click", function () {
        document.querySelectorAll(".chip[data-f]").forEach(function (x) { x.classList.remove("on"); x.setAttribute("aria-pressed", "false"); });
        c.classList.add("on"); c.setAttribute("aria-pressed", "true");
        cat = c.dataset.f;
        apply();
      });
    });
    document.querySelectorAll(".chip[data-t]").forEach(function (c) {
      c.addEventListener("click", function () {
        var t = c.dataset.t;
        on[t] = !on[t];
        if (t === "vegan" && on.vegan) on.vege = false;
        if (t === "vege" && on.vege) on.vegan = false;
        document.querySelectorAll(".chip[data-t]").forEach(function (x) {
          x.classList.toggle("on", !!on[x.dataset.t]); x.setAttribute("aria-pressed", !!on[x.dataset.t]);
        });
        apply();
      });
    });
  }

  // Page recettes : ?cat=riz ou ?f=vegan présélectionnent un filtre
  if (list) {
    var qs = new URLSearchParams(location.search);
    var pc = qs.get("cat"), pf = qs.get("f");
    var pq = qs.get("q");
    if (pq && q) { q.value = pq; q.dispatchEvent(new Event("input")); }
    if (pc) { var c0 = document.querySelector('.chip[data-f="' + pc + '"]'); if (c0) c0.click(); }
    if (pf) { var t0 = document.querySelector('.chip[data-t="' + pf + '"]'); if (t0) t0.click(); }
  }

  // Accueil : un bol de catégorie filtre la carte des recettes (sans JS, il ouvre la page de la catégorie)
  if (list) {
    document.querySelectorAll(".bubbles a[data-f]").forEach(function (a) {
      a.addEventListener("click", function (e) {
        var chip = document.querySelector('.chip[data-f="' + a.dataset.f + '"]');
        if (!chip) return;
        e.preventDefault();
        chip.click();
        document.getElementById("recettes").scrollIntoView({ behavior: reduce ? "auto" : "smooth" });
      });
    });
  }

  // Frigo : les recettes qui utilisent le plus d'ingrédients que j'ai
  var fridge = document.getElementById("fridge");
  if (fridge && window.KS_FRIDGE) {
    var out = document.getElementById("fridge-out"), all = document.getElementById("fridge-all"), head = document.getElementById("h-res");
    var run = function () {
      var have = fridge.value.split(/[,;\n]/).map(norm).filter(function (w) { return w.length > 1; });
      if (!have.length) { out.innerHTML = ""; all.hidden = false; head.textContent = "Toutes les recettes"; return; }
      all.hidden = true; head.textContent = "Ce que tu peux cuisiner";
      var res = window.KS_FRIDGE.map(function (r) {
        var hit = r.i.filter(function (ing) {
          return have.some(function (h) { return ing.indexOf(h) > -1 || h.indexOf(ing) > -1; });
        });
        return { r: r, hit: hit.length, total: r.i.length };
      }).filter(function (x) { return x.hit > 0; })
        .sort(function (a, b) { return b.hit - a.hit || a.total - b.total; });
      out.innerHTML = res.length ? res.map(function (x) {
        var p = "assets/photos/" + x.r.s + "-480.webp";
        return '<li class="dish in"><a href="recettes/' + x.r.s + '.html"><span class="bowl"><img src="' + p + '" alt="" width="480" height="480" loading="lazy"></span>' +
          '<span class="dish-txt"><span class="dish-line"><strong>' + esc(x.r.n) + '</strong></span>' +
          '<span class="match">Tu as ' + x.hit + ' ingrédient' + (x.hit > 1 ? "s" : "") + ' sur ' + x.total + '</span>' +
          '<span class="dish-desc">' + esc(x.r.d) + '</span></span></a></li>';
      }).join("") : '<li class="empty">Aucune recette avec ces ingrédients pour l\'instant.</li>';
    };
    var pre = new URLSearchParams(location.search).get("i");
    if (pre) fridge.value = pre;
    fridge.addEventListener("input", run);
    fridge.form.addEventListener("submit", function (e) { e.preventDefault(); run(); });
    run();
  }
  // Accueil : diaporama « Ce soir, on cuisine ». Avance tout seul (sauf si l'appareil ou le
  // réglage « Sans animation » demande le calme), se met en pause au survol, au clavier ou au bouton.
  var show = document.querySelector(".h-show");
  if (show) {
    var slides = [].slice.call(show.querySelectorAll(".h-slide"));
    var bars = [].slice.call(show.querySelectorAll(".h-bar"));
    var pauseBtn = show.querySelector(".h-pause");
    var cur = 0, userPaused = false, hover = false, focus = false;
    if (reduce) {
      show.classList.add("is-still");
      if (pauseBtn) pauseBtn.hidden = true;
    }
    var sync = function () { show.classList.toggle("is-paused", userPaused || hover || focus); };
    var go = function (n) {
      if (!slides.length) return;
      slides[cur].classList.remove("is-on");
      bars[cur].classList.remove("is-on");
      cur = (n + slides.length) % slides.length;
      var img = slides[cur].querySelector("img");
      if (img) img.loading = "eager";
      void show.offsetWidth;
      slides[cur].classList.add("is-on");
      bars[cur].classList.add("is-on");
      bars.forEach(function (b, k) { b.classList.toggle("is-done", k < cur); });
    };
    show.addEventListener("animationend", function (e) {
      if (e.animationName === "fill" && !reduce) go(cur + 1);
    });
    bars.forEach(function (b, k) { b.addEventListener("click", function () { go(k); }); });
    if (pauseBtn) pauseBtn.addEventListener("click", function () {
      userPaused = !userPaused;
      pauseBtn.setAttribute("aria-pressed", userPaused);
      pauseBtn.querySelector(".sr").textContent = userPaused ? "Relancer le diaporama" : "Mettre le diaporama en pause";
      sync();
    });
    show.addEventListener("mouseenter", function () { hover = true; sync(); });
    show.addEventListener("mouseleave", function () { hover = false; sync(); });
    show.addEventListener("focusin", function () { focus = true; sync(); });
    show.addEventListener("focusout", function () { focus = false; sync(); });
    // les photos suivantes se chargent après la première, sans la ralentir
    window.addEventListener("load", function () {
      slides.forEach(function (s) { var im = s.querySelector("img"); if (im) im.loading = "eager"; });
    });
  }

  // « Surprends-moi » : une recette au hasard
  document.querySelectorAll("[data-alea]").forEach(function (a) {
    a.addEventListener("click", function (e) {
      var list = window.EWS_ALEA || [];
      if (!list.length) return;
      e.preventDefault();
      var url = "recettes/" + list[Math.floor(Math.random() * list.length)] + ".html";
      if (reduce) { location.href = url; return; }
      a.classList.add("is-rolling");
      setTimeout(function () { location.href = url; }, 450);
    });
  });
})();

// Barre du haut : une ombre légère dès qu'on a défilé ; la loupe met le curseur dans la recherche
(function () {
  var top = document.querySelector(".top");
  if (top) {
    var on = false, tick = function () { var s = window.scrollY > 8; if (s !== on) { on = s; top.classList.toggle("is-scrolled", s); } };
    window.addEventListener("scroll", tick, { passive: true }); tick();
  }
  // Menu hamburger : une vraie fenêtre (dialog), donc Échap, retour du focus et piège du focus sont gérés par le navigateur
  var menu = document.getElementById("menu");
  if (menu && menu.showModal) {
    document.querySelectorAll(".menu-open").forEach(function (b) {
      b.addEventListener("click", function () { menu.showModal(); document.documentElement.classList.add("menu-is-open"); });
    });
    menu.addEventListener("close", function () { document.documentElement.classList.remove("menu-is-open"); });
    menu.addEventListener("click", function (e) {
      if (e.target === menu) {   // clic sur le fond grisé, hors du panneau
        var b = menu.getBoundingClientRect();
        if (e.clientY < b.top || e.clientY > b.bottom || e.clientX < b.left || e.clientX > b.right) menu.close();
      }
      if (e.target.closest(".sheet-a11y")) menu.close();
    });
    if (location.hash === "#menu") { menu.showModal(); document.documentElement.classList.add("menu-is-open"); }
  } else if (menu) {
    document.querySelectorAll(".menu-open").forEach(function (b) { b.addEventListener("click", function () { menu.setAttribute("open", ""); }); });
  }
  var q = document.getElementById("q");
  if (q && location.hash === "#q") { q.focus({ preventScroll: true }); q.scrollIntoView({ block: "center" }); }
})();

// ---------- Application installable (PWA) ----------
(function () {
  var me = document.querySelector('script[src$="assets/app.js"]');
  var root = me ? me.getAttribute("src").replace(/assets\/app\.js$/, "") : "";
  if ("serviceWorker" in navigator && location.protocol === "https:") {
    window.addEventListener("load", function () { navigator.serviceWorker.register(root + "sw.js", { scope: root || "./" }).catch(function () {}); });
  }
  var standalone = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  var btns = document.querySelectorAll(".install-btn"), ok = document.querySelectorAll(".install-ok");
  var show = function (els, on) { els.forEach(function (e) { e.hidden = !on; }); };
  if (standalone) { show(ok, true); document.documentElement.classList.add("is-app"); }
  var deferred = null;
  window.addEventListener("beforeinstallprompt", function (e) { e.preventDefault(); deferred = e; if (!standalone) show(btns, true); });
  btns.forEach(function (b) {
    b.addEventListener("click", function () {
      if (!deferred) return;
      deferred.prompt();
      deferred.userChoice.then(function (c) { if (c.outcome === "accepted") { show(btns, false); show(ok, true); } deferred = null; });
    });
  });
  window.addEventListener("appinstalled", function () { show(btns, false); show(ok, true); });
  // Page « Installer l'appli » : on met en avant les étapes de l'appareil utilisé
  var ua = navigator.userAgent, os = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) ? "ios"
    : /Android/.test(ua) ? "android" : (/Macintosh/.test(ua) && /Safari/.test(ua) && !/Chrome|Edg/.test(ua)) ? "mac" : "desktop";
  var steps = document.querySelector(".appli-steps");
  if (steps) {
    var mine = steps.querySelector('[data-os="' + os + '"]');
    if (mine) { mine.classList.add("is-mine"); steps.insertBefore(mine, steps.firstChild); }
  }
})();
