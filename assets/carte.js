/* Carte du blog : Leaflet et les tuiles OpenStreetMap ne sont chargés que quand la carte arrive à l'écran.
   Sans JavaScript, la liste numérotée à côté reste lisible et cliquable. */
(function () {
  var box = document.getElementById("carte-map"), data = window.EWS_MAP;
  if (!box || !data) return;
  var tabs = [].slice.call(document.querySelectorAll(".map-tabs [role=tab]"));
  var lists = [].slice.call(document.querySelectorAll(".map-list"));
  var zone = tabs[0].dataset.zone, map = null, layers = {};
  if (/^#carte-/.test(location.hash) && data[location.hash.slice(7)]) {
    zone = location.hash.slice(7);
    document.getElementById("carte").scrollIntoView();
  }

  function show(z) {
    zone = z;
    tabs.forEach(function (t) { t.setAttribute("aria-selected", t.dataset.zone === z ? "true" : "false"); });
    lists.forEach(function (l) { l.hidden = l.dataset.zone !== z; });
    if (!map) return;
    Object.keys(layers).forEach(function (k) { if (k === z) layers[k].addTo(map); else map.removeLayer(layers[k]); });
    map.fitBounds(layers[z].getBounds(), { padding: [48, 48], maxZoom: 14 });
  }
  tabs.forEach(function (t, i) {
    t.addEventListener("click", function () { show(t.dataset.zone); });
    t.addEventListener("keydown", function (e) {
      var d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
      if (!d) return;
      var n = tabs[(i + d + tabs.length) % tabs.length]; n.focus(); show(n.dataset.zone);
    });
  });
  show(zone);

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function build() {
    var L = window.L;
    box.innerHTML = "";
    map = L.map(box, { scrollWheelZoom: false, attributionControl: false });
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18 }).addTo(map);
    Object.keys(data).forEach(function (k) {
      var g = L.featureGroup();
      data[k].forEach(function (p, n) {
        var icon = L.divIcon({ className: "pin-wrap", html: '<span class="pin">' + (n + 1) + "</span>", iconSize: [34, 34], iconAnchor: [17, 17] });
        L.marker(p.g, { icon: icon, title: p.l, alt: p.l }).bindPopup(
          '<a class="pop" href="' + p.s + '.html"><img src="' + p.i + '" alt="" width="200" height="200">' +
          "<strong>" + esc(p.t) + "</strong><span>" + esc(p.l) + ", " + esc(p.v) + "</span><em>Lire l'article</em></a>"
        ).addTo(g);
      });
      layers[k] = g;
    });
    show(zone);
  }
  function load() {
    var css = document.createElement("link");
    css.rel = "stylesheet"; css.href = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css";
    document.head.appendChild(css);
    var js = document.createElement("script");
    js.src = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js";
    js.onload = build;
    js.onerror = function () { box.innerHTML = '<p class="map-wait">La carte n’a pas pu se charger. La liste des adresses reste à côté.</p>'; };
    document.head.appendChild(js);
  }
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (es) { if (es[0].isIntersecting) { io.disconnect(); load(); } }, { rootMargin: "300px" });
    io.observe(box);
  } else load();
})();
