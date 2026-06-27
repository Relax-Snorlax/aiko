/* Jeetaw progress-report nav — shared across all dated report pages.
   Reads index.json (sibling) and renders a list of dated links into #report-nav,
   marking the current page. Each page styles .rn* to match its own theme.
   Fails silent (nav simply absent) if fetch fails — page stays fully readable. */
(function () {
  var mount = document.getElementById("report-nav");
  if (!mount) return;
  var here = location.pathname.split("/").pop() || "";
  fetch("index.json", { cache: "no-cache" })
    .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
    .then(function (reports) {
      if (!Array.isArray(reports) || !reports.length) return;
      var nav = document.createElement("nav");
      nav.className = "rn";
      nav.setAttribute("aria-label", "All progress reports");
      var lbl = document.createElement("span");
      lbl.className = "rn-label";
      lbl.textContent = "Progress Reports";
      nav.appendChild(lbl);
      reports.forEach(function (rep, i) {
        var a = document.createElement("a");
        a.className = "rn-item" + (rep.file === here ? " is-current" : "");
        a.href = rep.file;
        a.textContent = rep.label + (i === 0 ? "  ·  Latest" : "");
        if (rep.file === here) a.setAttribute("aria-current", "page");
        nav.appendChild(a);
      });
      mount.appendChild(nav);
    })
    .catch(function () { /* nav optional — ignore */ });
})();
