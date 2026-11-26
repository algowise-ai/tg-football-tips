/* Click-to-sort for every <table> with a header row. Vanilla JS, no deps.
   Handles numbers, HK$ amounts, percentages, signed values (+3.29 / −1.00 unicode minus),
   units (1.5u), W-L-P tuples, dates (YYYY-MM-DD[ HH:MM], MM-DD[ HH:MM]). Blank / "-" sort last. */
(function () {
  "use strict";
  var MINUS = /[\u2212\u2013\u2014\uFE63\uFF0D]/g;

  function clean(t) {
    return (t || "").replace(/\s+/g, " ").trim();
  }
  function isBlank(t) {
    return t === "" || /^[-\u2212\u2013\u2014–—·]+$/.test(t);
  }
  function parse(raw) {
    var t = clean(raw);
    if (isBlank(t)) return { blank: true };
    var s = t.replace(MINUS, "-");
    var m;
    // full date / datetime: 2026-10-06 or 2026-10-06 02:41(:ss)
    if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/))) {
      return { num: Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0)), kind: "d" };
    }
    // W-L-P tuple: 12-3-1
    if ((m = s.match(/^(\d+)-(\d+)-(\d+)\b/))) {
      return { num: (+m[1]) * 1e8 + (1e4 - +m[2]) * 1e4 + (+m[3]), kind: "n" };
    }
    // short date / datetime: 10-06 or 10-06 02:41 or 10/06
    if ((m = s.match(/^(\d{1,2})[-\/](\d{1,2})(?: (\d{1,2}):(\d{2}))?(?!\d)/)) && +m[1] <= 12 && +m[2] <= 31) {
      return { num: Date.UTC(2000, +m[1] - 1, +m[2], +(m[3] || 0), +(m[4] || 0)), kind: "d" };
    }
    // time only: 02:45
    if ((m = s.match(/^(\d{1,2}):(\d{2})$/))) {
      return { num: +m[1] * 60 + +m[2], kind: "d" };
    }
    // signed number with optional HK$/$/#, commas, trailing %/u
    var n = s.replace(/^(#|HK\$|\$)/i, "").replace(/^([+-])\s*(HK\$|\$)/i, "$1");
    if ((m = n.match(/^([+-]?)(?:HK\$|\$)?(\d[\d,]*(?:\.\d+)?|\.\d+)/i))) {
      var v = parseFloat(m[2].replace(/,/g, ""));
      if (!isNaN(v)) return { num: m[1] === "-" ? -v : v, kind: "n" };
    }
    return { text: t };
  }
  function cellText(cell) {
    if (!cell) return "";
    if (cell.hasAttribute("data-sort")) return cell.getAttribute("data-sort");
    return cell.textContent;
  }
  function headerRow(table) {
    if (table.tHead && table.tHead.rows.length) return table.tHead.rows[table.tHead.rows.length - 1];
    return null;
  }
  function sortTable(table, col, th) {
    var body = table.tBodies[0];
    if (!body) return;
    var dir = th.getAttribute("data-sort-dir") === "asc" ? "desc" : "asc";
    var hdr = headerRow(table);
    Array.prototype.forEach.call(hdr.cells, function (h) {
      h.removeAttribute("data-sort-dir");
      h.removeAttribute("aria-sort");
      var ind = h.querySelector(".sort-ind");
      if (ind) ind.textContent = "↕";
    });
    th.setAttribute("data-sort-dir", dir);
    th.setAttribute("aria-sort", dir === "asc" ? "ascending" : "descending");
    th.querySelector(".sort-ind").textContent = dir === "asc" ? "▲" : "▼";

    var rows = Array.prototype.slice.call(body.rows);
    var items = rows.map(function (r, i) {
      return { row: r, idx: i, v: parse(cellText(r.cells[col])) };
    });
    // column is numeric if every non-blank cell parsed as a number/date
    var numeric = items.every(function (it) { return it.v.blank || it.v.num !== undefined; });
    var sign = dir === "asc" ? 1 : -1;
    items.sort(function (a, b) {
      if (a.v.blank || b.v.blank) {
        if (a.v.blank && b.v.blank) return a.idx - b.idx;
        return a.v.blank ? 1 : -1; // blanks always last
      }
      var c;
      if (numeric) c = a.v.num - b.v.num;
      else c = clean(cellText(a.row.cells[col])).localeCompare(clean(cellText(b.row.cells[col])), "zh-Hant", { numeric: true });
      return c !== 0 ? c * sign : a.idx - b.idx;
    });
    var frag = document.createDocumentFragment();
    items.forEach(function (it) { frag.appendChild(it.row); });
    body.appendChild(frag);
  }
  function init(table) {
    if (table.getAttribute("data-nosort") !== null) return;
    var hdr = headerRow(table);
    if (!hdr || !table.tBodies[0]) return;
    var col = 0;
    Array.prototype.forEach.call(hdr.cells, function (th) {
      var idx = col;
      col += th.colSpan || 1;
      if (th.getAttribute("data-nosort") !== null) return;
      th.classList.add("sortable");
      th.setAttribute("tabindex", "0");
      th.setAttribute("title", "撳一下排序（再撳反轉）");
      var ind = document.createElement("span");
      ind.className = "sort-ind";
      ind.textContent = "↕";
      th.appendChild(ind);
      th.addEventListener("click", function () { sortTable(table, idx, th); });
      th.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); sortTable(table, idx, th); }
      });
    });
  }
  window.__tableSortParse = parse; // for testing
  function wrap(table) { // fallback: any table not already inside .table-wrap scrolls inside its card
    var p = table.parentNode;
    if (!p || (p.classList && p.classList.contains("table-wrap"))) return;
    var d = document.createElement("div");
    d.className = "table-wrap";
    p.insertBefore(d, table);
    d.appendChild(table);
  }
  function boot() { Array.prototype.forEach.call(document.querySelectorAll("table"), function (t) { wrap(t); init(t); }); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
