/* Relecture des avis (page admin.html, réservée à Stella).
   Connexion avec le compte e-mail créé dans Firebase Authentication ;
   les règles Firestore n'autorisent la lecture des avis en attente,
   la publication et la suppression qu'à l'identifiant (uid) de ce compte. */
(function () {
  var cfg = window.EWS_AVIS || {};
  var box = document.getElementById("admin");
  if (!box) return;
  var KEY = "?key=" + encodeURIComponent(cfg.apiKey || "");
  var DB = "https://firestore.googleapis.com/v1/projects/" + cfg.projectId + "/databases/(default)/documents";
  var login = document.getElementById("admin-login");
  var out = document.getElementById("admin-list");
  var note = document.getElementById("admin-msg");
  var idToken = null;
  var esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var say = function (t) { note.textContent = t; note.hidden = !t; };

  if (!cfg.apiKey) { say("Firebase n'est pas encore configuré (voir FIREBASE.md)."); login.hidden = true; return; }

  login.addEventListener("submit", function (e) {
    e.preventDefault();
    say("Connexion…");
    fetch("https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword" + KEY, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: login.elements.email.value, password: login.elements.password.value, returnSecureToken: true })
    }).then(function (r) { return r.ok ? r.json() : Promise.reject(); })
      .then(function (j) { idToken = j.idToken; login.reset(); login.hidden = true; say(""); load(); })
      .catch(function () { say("Connexion refusée. Vérifie l'e-mail et le mot de passe."); });
  });

  function load() {
    var q = { structuredQuery: { from: [{ collectionId: "avis" }],
      where: { fieldFilter: { field: { fieldPath: "statut" }, op: "EQUAL", value: { stringValue: "en_attente" } } }, limit: 100 } };
    fetch(DB + ":runQuery" + KEY, { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + idToken }, body: JSON.stringify(q) })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
      .then(function (rows) {
        var docs = rows.filter(function (x) { return x.document; }).map(function (x) { return x.document; });
        if (!docs.length) { out.innerHTML = '<li class="empty">Aucun avis en attente.</li>'; return; }
        out.innerHTML = docs.map(function (d) {
          var f = d.fields, photo = f.photo && f.photo.stringValue;
          return '<li class="admin-item" data-name="' + esc(d.name) + '">' +
            (photo && /^data:image\/jpeg;base64,/.test(photo) ? '<img src="' + photo + '" alt="">' : "") +
            "<div><p><strong>" + esc(f.prenom.stringValue) + "</strong> · " + esc(f.note.integerValue) + "/5 · " + esc(f.recette.stringValue) + "</p>" +
            "<p>" + esc((f.texte && f.texte.stringValue) || "(sans commentaire)") + "</p>" +
            '<p class="admin-actions"><button class="btn" data-act="pub">Publier</button> <button class="btn ghost" data-act="del">Supprimer</button></p></div></li>';
        }).join("");
      })
      .catch(function (s) { say("Lecture refusée (" + s + "). L'uid de ce compte est-il bien dans firestore.rules ?"); });
  }

  out.addEventListener("click", function (e) {
    var b = e.target.closest("button[data-act]");
    if (!b) return;
    var li = b.closest("li"), name = li.dataset.name, url = "https://firestore.googleapis.com/v1/" + name;
    var auth = { Authorization: "Bearer " + idToken, "Content-Type": "application/json" };
    var req = b.dataset.act === "pub"
      ? fetch(url + "?updateMask.fieldPaths=statut&key=" + encodeURIComponent(cfg.apiKey), { method: "PATCH", headers: auth, body: JSON.stringify({ fields: { statut: { stringValue: "publie" } } }) })
      : (confirm("Supprimer définitivement cet avis ?") ? fetch(url + KEY, { method: "DELETE", headers: auth }) : null);
    if (!req) return;
    b.disabled = true;
    req.then(function (r) { if (r.ok) li.remove(); else say("Action refusée (" + r.status + ")."); });
  });
})();
