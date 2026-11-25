/* Avis des lecteurs sur une recette : note (1 à 5 bols), commentaire, photo.
   Firestore par API REST (pas de SDK : quelques Ko au lieu de 150).
   Règles :
   - un avis n'est visible qu'une fois relu et publié par Stella (statut "publie") ;
   - aucun avis d'exemple, aucune moyenne inventée : sans avis réel, rien ne s'affiche ;
   - prénom seul, pas d'e-mail demandé ;
   - pas de orderBy dans la requête (il exigerait un index composite) : tri en JavaScript. */
(function () {
  var root = document.getElementById("avis");
  if (!root) return;
  var cfg = window.EWS_AVIS || {};
  var ready = !!(cfg.apiKey && cfg.projectId);
  var slug = root.dataset.recette;
  var DB = "https://firestore.googleapis.com/v1/projects/" + cfg.projectId + "/databases/(default)/documents";
  var KEY = "?key=" + encodeURIComponent(cfg.apiKey || "");
  var list = root.querySelector(".avis-list");
  var summary = root.querySelector(".avis-summary");
  var form = root.querySelector("form");
  var msg = root.querySelector(".avis-msg");
  var heroNote = document.querySelector(".r-note");

  var esc = function (s) {
    return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; });
  };
  var bowls = function (n) {
    var h = "";
    for (var i = 1; i <= 5; i++) h += '<i class="' + (i <= Math.floor(n + 0.25) ? "on" : "") + '"></i>';
    return '<span class="bowls" aria-hidden="true">' + h + "</span>";
  };
  var val = function (f) {
    if (!f) return null;
    if ("stringValue" in f) return f.stringValue;
    if ("integerValue" in f) return +f.integerValue;
    if ("timestampValue" in f) return f.timestampValue;
    return null;
  };

  // ---------- Lecture ----------
  function load() {
    if (!ready) {
      summary.innerHTML = "<p>Les avis ouvrent bientôt. Tu pourras noter la recette, raconter comment elle s'est passée et montrer ta photo.</p>";
      return;
    }
    var q = { structuredQuery: {
      from: [{ collectionId: "avis" }],
      where: { compositeFilter: { op: "AND", filters: [
        { fieldFilter: { field: { fieldPath: "recette" }, op: "EQUAL", value: { stringValue: slug } } },
        { fieldFilter: { field: { fieldPath: "statut" }, op: "EQUAL", value: { stringValue: "publie" } } }
      ] } },
      limit: 60
    } };
    fetch(DB + ":runQuery" + KEY, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(q) })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
      .then(function (rows) {
        var items = rows.filter(function (x) { return x.document; }).map(function (x) {
          var f = x.document.fields;
          return { prenom: val(f.prenom), note: val(f.note), texte: val(f.texte) || "", photo: val(f.photo) || "", cree: val(f.cree) || "" };
        }).sort(function (a, b) { return a.cree < b.cree ? 1 : -1; });
        render(items);
      })
      .catch(function () { summary.innerHTML = "<p>Les avis ne se chargent pas pour le moment. Réessaie un peu plus tard.</p>"; });
  }

  function render(items) {
    if (!items.length) {
      summary.innerHTML = "<p>Pas encore d'avis sur cette recette. Tu l'as faite ? Dis-nous comment ça s'est passé.</p>";
      return;
    }
    var avg = items.reduce(function (s, x) { return s + x.note; }, 0) / items.length;
    var avgTxt = avg.toFixed(1).replace(".", ",");
    var count = items.length + " avis";
    summary.innerHTML = '<p class="avis-avg"><strong>' + avgTxt + "</strong> sur 5 " + bowls(avg) + '<span class="avis-count">' + count + "</span></p>";
    if (heroNote) {
      heroNote.innerHTML = bowls(avg) + " " + avgTxt + " sur 5 (" + count + ")";
      heroNote.hidden = false;
    }
    list.innerHTML = items.map(function (x) {
      var d = x.cree ? new Date(x.cree).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : "";
      var pic = /^data:image\/jpeg;base64,/.test(x.photo)
        ? '<img class="avis-pic" src="' + x.photo + '" alt="Le plat réalisé par ' + esc(x.prenom) + '" loading="lazy">' : "";
      return '<li class="avis-item' + (pic ? ' has-pic' : '') + '">' + pic + '<div><p class="avis-who"><strong>' + esc(x.prenom) + "</strong> " + bowls(x.note) +
        '<span class="sr">' + x.note + " sur 5</span> <span class=\"avis-date\">" + d + "</span></p>" +
        (x.texte ? "<p>" + esc(x.texte) + "</p>" : "") + "</div></li>";
    }).join("");
  }

  // ---------- Note : 5 bols cliquables ----------
  var rate = root.querySelector(".rate");
  if (rate) {
    var paint = function (n) {
      rate.querySelectorAll("label").forEach(function (l, i) { l.classList.toggle("on", i < n); });
    };
    rate.addEventListener("change", function (e) { paint(+e.target.value); });
    rate.querySelectorAll("label").forEach(function (l, i) {
      l.addEventListener("mouseenter", function () { paint(i + 1); });
    });
    rate.addEventListener("mouseleave", function () {
      var c = rate.querySelector("input:checked");
      paint(c ? +c.value : 0);
    });
  }

  // ---------- Photo : réduite dans le navigateur (moins de 350 Ko) ----------
  var photoData = "";
  var fileInput = root.querySelector('input[type="file"]');
  var preview = root.querySelector(".avis-preview");
  if (fileInput) {
    fileInput.addEventListener("change", function () {
      photoData = "";
      preview.hidden = true;
      var file = fileInput.files && fileInput.files[0];
      if (!file) return;
      if (!/^image\//.test(file.type)) { say("Ce fichier n'est pas une image."); return; }
      var img = new Image();
      img.onload = function () {
        var max = 1080, w = img.width, h = img.height, s = Math.min(1, max / Math.max(w, h));
        var c = document.createElement("canvas");
        c.width = Math.round(w * s); c.height = Math.round(h * s);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        var q = 0.82, out = c.toDataURL("image/jpeg", q);
        while (out.length > 350000 && q > 0.4) { q -= 0.08; out = c.toDataURL("image/jpeg", q); }
        if (out.length > 350000) { say("Cette photo est trop lourde, essaie avec une autre."); return; }
        photoData = out;
        preview.src = out;
        preview.hidden = false;
        URL.revokeObjectURL(img.src);
      };
      img.onerror = function () { say("Impossible de lire cette photo."); };
      img.src = URL.createObjectURL(file);
    });
  }

  function say(t, ok) {
    msg.textContent = t;
    msg.classList.toggle("ok", !!ok);
    msg.hidden = false;
  }

  // ---------- Compte anonyme (pas d'e-mail) pour signer l'envoi ----------
  function token() {
    var saved = null;
    try { saved = JSON.parse(localStorage.getItem("ews_anon") || "null"); } catch (e) {}
    if (saved && saved.refresh) {
      return fetch("https://securetoken.googleapis.com/v1/token" + KEY, {
        method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "grant_type=refresh_token&refresh_token=" + encodeURIComponent(saved.refresh)
      }).then(function (r) { return r.ok ? r.json() : Promise.reject(); })
        .then(function (j) { return { id: j.id_token, uid: j.user_id }; })
        .catch(function () { return signUp(); });
    }
    return signUp();
  }
  function signUp() {
    return fetch("https://identitytoolkit.googleapis.com/v1/accounts:signUp" + KEY, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ returnSecureToken: true })
    }).then(function (r) { return r.ok ? r.json() : Promise.reject("auth"); })
      .then(function (j) {
        try { localStorage.setItem("ews_anon", JSON.stringify({ refresh: j.refreshToken })); } catch (e) {}
        return { id: j.idToken, uid: j.localId };
      });
  }

  // ---------- Envoi ----------
  if (form) {
    if (!ready) {
      form.querySelectorAll("input, textarea, button").forEach(function (el) { el.disabled = true; });
    }
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!ready) return;
      if (form.elements.site && form.elements.site.value) return; // piège à robots
      var prenom = form.elements.prenom.value.trim().slice(0, 30);
      var checked = form.querySelector('input[name="note"]:checked');
      var texte = form.elements.texte.value.trim().slice(0, 1000);
      if (!checked) { say("Choisis une note, de 1 à 5 bols."); return; }
      if (!prenom) { say("Écris ton prénom."); form.elements.prenom.focus(); return; }
      var btn = form.querySelector('button[type="submit"]');
      btn.disabled = true;
      say("Envoi en cours…");
      token().then(function (t) {
        var name = "projects/" + cfg.projectId + "/databases/(default)/documents/avis/" + slug + "__" + t.uid;
        var body = { writes: [{
          update: { name: name, fields: {
            recette: { stringValue: slug }, prenom: { stringValue: prenom }, note: { integerValue: String(+checked.value) },
            texte: { stringValue: texte }, photo: { stringValue: photoData }, statut: { stringValue: "en_attente" }, uid: { stringValue: t.uid }
          } },
          updateTransforms: [{ fieldPath: "cree", setToServerValue: "REQUEST_TIME" }],
          currentDocument: { exists: false }
        }] };
        return fetch(DB.replace("/documents", "/documents:commit") + KEY, {
          method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + t.id }, body: JSON.stringify(body)
        });
      }).then(function (r) {
        if (r.ok) {
          form.reset(); photoData = ""; preview.hidden = true;
          root.querySelectorAll(".rate label").forEach(function (l) { l.classList.remove("on"); });
          say("Merci ! Ton avis sera visible une fois relu.", true);
        } else if (r.status === 409 || r.status === 400) {
          say("Tu as déjà laissé un avis sur cette recette. Merci !");
        } else {
          say("L'envoi n'a pas marché. Réessaie dans un moment.");
        }
      }).catch(function () {
        say("L'envoi n'a pas marché. Vérifie ta connexion et réessaie.");
      }).then(function () { btn.disabled = false; });
    });
  }

  load();
})();
