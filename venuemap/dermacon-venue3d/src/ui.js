var CSS = `
.dv3{--ink:#16132a;--panel:rgba(22,19,42,.9);--line:rgba(255,255,255,.14);--text:#f3f0f7;--mute:#b9b3cc;--accent:#d63d86;--accent2:#39a9d6;--ok:#58c08a;
  position:relative;width:100%;height:100%;min-height:320px;overflow:hidden;background:#bcd3e6;color:var(--text);font-family:var(--dv3-font,"Barlow","Segoe UI",system-ui,sans-serif);font-size:14px;line-height:1.35;-webkit-user-select:none;user-select:none;touch-action:none}
.dv3 *{box-sizing:border-box}
.dv3 [hidden]{display:none!important}
.dv3 canvas.dv3-gl{position:absolute;inset:0;width:100%;height:100%;display:block;outline:none;cursor:grab}
.dv3 canvas.dv3-gl:active{cursor:grabbing}
.dv3-labels{position:absolute;inset:0;pointer-events:none;overflow:hidden}
.dv3-lab{position:absolute;left:0;top:0;transform:translate(-50%,-100%);white-space:nowrap;pointer-events:auto;cursor:pointer;border:0;font:inherit;color:#fff;background:rgba(22,19,42,.86);padding:3px 9px 4px;border-radius:4px;font-weight:700;letter-spacing:.02em;font-size:12px;text-align:center;box-shadow:0 2px 10px rgba(0,0,0,.28);will-change:transform}
.dv3-lab small{display:block;font-weight:500;font-size:10px;color:#d8d2ea;letter-spacing:.03em}
.dv3-lab::after{content:"";position:absolute;left:50%;bottom:-5px;margin-left:-5px;border:5px solid transparent;border-bottom:0;border-top-color:rgba(22,19,42,.86)}
.dv3-lab.b{font-size:13px;background:rgba(74,23,102,.92)} .dv3-lab.b::after{border-top-color:rgba(74,23,102,.92)}
.dv3-lab.idle{background:rgba(70,74,84,.7);font-weight:500} .dv3-lab.idle::after{border-top-color:rgba(70,74,84,.7)}
.dv3-lab.park{background:#1a73e8;border:1.5px solid #fff;border-radius:6px;font-size:13px;z-index:5} .dv3-lab.park::after{border-top-color:#1a73e8}
.dv3-lab.poi{background:rgba(70,74,84,.85);font-size:11px;font-weight:600;padding:2px 8px} .dv3-lab.poi::after{border-top-color:rgba(70,74,84,.85)}
.dv3-lab.gate{background:#fff;color:#16132a;border-radius:999px;padding:2px 8px;font-size:11px} .dv3-lab.gate::after{border-top-color:#fff}
.dv3-lab.main{background:#d63d86;font-size:14px;padding:4px 10px 5px;border:1.5px solid #fff;border-radius:6px;z-index:6;animation:dv3pulse 1.6s ease-in-out infinite} .dv3-lab.main small{font-size:10px;color:#fff;font-weight:600} .dv3-lab.main::after{border-top-color:#d63d86;border-width:6px;bottom:-6px;margin-left:-6px}
@keyframes dv3pulse{0%,100%{box-shadow:0 0 0 0 rgba(214,61,134,.7)}50%{box-shadow:0 0 0 8px rgba(214,61,134,0)}}
.dv3-lab.sel{background:var(--accent);font-size:14px;z-index:5} .dv3-lab.sel::after{border-top-color:var(--accent)}
.dv3-lab:focus-visible,.dv3 button:focus-visible,.dv3 select:focus-visible{outline:2px solid #fff;outline-offset:2px}
.dv3-panel{position:absolute;left:12px;top:62px;width:290px;max-width:calc(100% - 24px);max-height:calc(100% - 74px);display:flex;flex-direction:column;background:var(--panel);border:1px solid var(--line);border-radius:10px;backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);box-shadow:0 10px 40px rgba(10,8,30,.35);-webkit-user-select:text;user-select:text;touch-action:auto}
.dv3-lrow{display:flex;align-items:center;justify-content:space-between;gap:10px}
.dv3-head h1{margin:0;font-family:var(--dv3-display,"Barlow Condensed","Barlow",sans-serif);font-size:22px;line-height:1;font-weight:700;letter-spacing:.04em}
.dv3-head h1 b{color:var(--accent)}
.dv3-head p{margin:3px 0 0;font-size:11.5px;color:var(--mute)}
.dv3-head .grow{flex:1;min-width:0}
.dv3-rgt{display:flex;flex-direction:column;align-items:flex-end;gap:2px}
.dv3-loc{border:0;background:transparent;padding:3px 8px;cursor:pointer;line-height:0}
.dv3-loc i{display:block;width:12px;height:12px;border-radius:50%;background:#4285f4;border:2px solid #fff;box-shadow:0 0 0 5px rgba(66,133,244,.28)}
.dv3-loc[aria-pressed="true"] i{box-shadow:0 0 0 5px rgba(66,133,244,.5)}
.dv3-fold{display:none;border:1px solid var(--line);background:transparent;color:var(--text);border-radius:6px;padding:3px 10px;font:inherit;font-size:12px;cursor:pointer}
.dv3-body{padding:10px 12px 12px;overflow:auto;display:flex;flex-direction:column;gap:8px}
.dv3-field{display:flex;flex-direction:column;gap:4px}
.dv3-field label{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--mute);font-weight:600}
.dv3 select{width:100%;appearance:none;-webkit-appearance:none;background:#221d3a url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8'%3E%3Cpath d='M1 1l5 5 5-5' fill='none' stroke='%23fff' stroke-width='1.6'/%3E%3C/svg%3E") no-repeat right 11px center;color:var(--text);border:1px solid var(--line);border-radius:7px;padding:7px 28px 7px 10px;font:inherit;font-weight:600;cursor:pointer}
.dv3 select.small{font-weight:500;font-size:13px;padding:6px 28px 6px 10px}
.dv3-gmap{display:flex;align-items:center;gap:6px;background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:10px 12px;color:#fff;text-decoration:none;font:inherit;font-weight:400;backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px)}
.dv3-gmap img{width:auto;height:17px;flex:none}
.dv3-gmap:hover{border-color:#fff}
.dv3-seg button.rt{padding:7px 12px}
.dv3-card{border:1px solid var(--line);border-radius:8px;padding:8px 10px;background:rgba(255,255,255,.04)}
.dv3-card h2{margin:0 0 6px;font-family:var(--dv3-display,"Barlow Condensed","Barlow",sans-serif);font-size:20px;line-height:1.05;letter-spacing:.03em;font-weight:700}
.dv3-chips{display:flex;flex-wrap:wrap;gap:5px}
.dv3-chip{font-size:11.5px;padding:2px 8px;border-radius:999px;background:rgba(255,255,255,.1);color:#e9e5f3;font-variant-numeric:tabular-nums}
.dv3-chip.k{background:rgba(214,61,134,.25);color:#ffd3e6}
.dv3-sum{margin:8px 0 0;font-size:13px;color:#e9e5f3;font-variant-numeric:tabular-nums}
.dv3-sum b{color:#fff;font-size:15px}
.dv3-row{display:flex;gap:8px;flex-wrap:wrap}
.dv3-btn{flex:1 1 auto;border:1px solid var(--line);background:rgba(255,255,255,.07);color:var(--text);border-radius:7px;padding:7px 8px;font:inherit;font-weight:600;cursor:pointer;white-space:nowrap}
.dv3-btn:hover{background:rgba(255,255,255,.14)}
.dv3-btn.pri{background:var(--accent);border-color:var(--accent);color:#fff} .dv3-btn.pri:hover{background:#e3559a}
.dv3-btn[disabled]{opacity:.45;cursor:default}
.dv3-steps{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:0;counter-reset:s}
.dv3-steps li{position:relative;padding:7px 0 7px 30px;border-top:1px solid var(--line);font-size:13px;counter-increment:s}
.dv3-steps li:first-child{border-top:0}
.dv3-steps li::before{content:counter(s);position:absolute;left:0;top:7px;width:21px;height:21px;border-radius:50%;background:rgba(57,169,214,.28);color:#d4f0fc;font-size:11.5px;font-weight:700;display:grid;place-items:center}
.dv3-steps li.arr::before{content:"";background:var(--accent)}
.dv3-steps li span{color:var(--mute)}
.dv3-top{position:absolute;left:12px;right:12px;top:12px;display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:flex-end;touch-action:auto;pointer-events:none}
.dv3-top>*{pointer-events:auto}
.dv3-brand{margin-right:auto;font-family:var(--dv3-display,"Barlow Condensed","Barlow",sans-serif);font-size:24px;line-height:1;font-weight:700;letter-spacing:.05em;color:#fff;background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:8px 12px;backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);white-space:nowrap}
.dv3-brand b{color:var(--accent)}
.dv3-seg{display:flex;background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:3px;backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px)}
.dv3-seg button{border:0;background:transparent;color:var(--mute);font:inherit;font-weight:600;padding:7px 12px;border-radius:6px;cursor:pointer}
.dv3-seg button[aria-pressed="true"]{background:#fff;color:#16132a}
.dv3-hint{position:absolute;left:50%;bottom:12px;transform:translateX(-50%);background:var(--panel);border:1px solid var(--line);border-radius:999px;padding:6px 14px;font-size:12px;color:#e3def0;white-space:nowrap;max-width:calc(100% - 24px);overflow:hidden;text-overflow:ellipsis;pointer-events:none}
.dv3-here{position:absolute;left:50%;top:12px;transform:translateX(-50%);background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:6px 14px;text-align:center;pointer-events:none;display:none}
.dv3-here small{display:block;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--mute)}
.dv3-here b{font-family:var(--dv3-display,"Barlow Condensed","Barlow",sans-serif);font-size:19px;letter-spacing:.04em}
.dv3-map{position:absolute;right:12px;bottom:12px;width:210px;height:150px;border-radius:8px;border:1px solid var(--line);background:var(--panel);display:block}
.dv3-toast{position:absolute;left:50%;top:22%;transform:translate(-50%,-50%);background:var(--accent);color:#fff;padding:12px 22px;border-radius:10px;font-family:var(--dv3-display,"Barlow Condensed","Barlow",sans-serif);font-size:24px;font-weight:700;letter-spacing:.04em;box-shadow:0 10px 40px rgba(10,8,30,.4);opacity:0;transition:opacity .35s;pointer-events:none;text-align:center}
.dv3-toast.on{opacity:1}
.dv3-load{position:absolute;inset:0;display:grid;place-items:center;background:#16132a;color:#fff;font-size:15px;letter-spacing:.06em;z-index:20;transition:opacity .5s}
.dv3.walk .dv3-here{display:block}
@media (max-width:720px){
  .dv3-panel{left:8px;right:8px;top:auto;bottom:8px;width:auto;max-width:none;max-height:58%}
  .dv3-fold{display:block}
  .dv3-panel.folded{left:auto;width:auto}
  .dv3-panel.folded .dv3-body>*:not(.dv3-to),.dv3-panel.folded .dv3-to select{display:none}
  .dv3-top{left:8px;right:8px;top:8px;gap:6px}
  .dv3-brand{font-size:19px;padding:7px 10px}
  .dv3-seg button{padding:6px 9px;font-size:12.5px}
  .dv3-gmap{padding:9px 10px;font-size:12.5px}
  .dv3-gmap img{height:15px}
  .dv3-hint{display:none}
  .dv3-map{bottom:auto;top:96px;right:8px;width:132px;height:96px}
  .dv3-here{top:96px;left:8px;transform:none}
}
@media (prefers-reduced-motion:reduce){.dv3-toast,.dv3-load{transition:none}.dv3-lab.main{animation:none}}
`;
var el = (tag, cls, html) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== void 0) e.innerHTML = html;
  return e;
};
var esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
function createUI(root, { rooms, starts, title, subtitle, showPanel = true }, on) {
  if (!document.getElementById("dv3-css")) {
    const st = el("style");
    st.id = "dv3-css";
    st.textContent = CSS;
    document.head.appendChild(st);
  }
  const uid = "dv3" + Math.random().toString(36).slice(2, 7);
  const ui = {};
  ui.labels = el("div", "dv3-labels");
  root.appendChild(ui.labels);
  const panel = el("div", "dv3-panel");
  if (!showPanel) panel.style.display = "none";
  const groups = [...new Set(rooms.map((r) => r.group))];
  panel.innerHTML = `
        <div class="dv3-body">
      <div class="dv3-field dv3-to"><div class="dv3-lrow"><label for="${uid}-to">Where to?</label><div class="dv3-rgt"><button class="dv3-loc" type="button" id="${uid}-loc" aria-pressed="false" aria-label="Show my location on the map" title="My location"><i></i></button><button class="dv3-fold" type="button" id="${uid}-fold" aria-expanded="true">Hide</button></div></div>
        <select id="${uid}-to"><option value="">Choose a hall or room</option>${groups.map((g) => `<optgroup label="${esc(g)}">${rooms.filter((r) => r.group === g).map((r) => `<option value="${r.id}">${esc(r.name)}</option>`).join("")}</optgroup>`).join("")}</select></div>
      <div class="dv3-field"><label for="${uid}-from">Starting from</label>
        <select id="${uid}-from" class="small">${starts.map((s) => `<option value="${s.id}">${esc(s.name)}</option>`).join("")}</select></div>
      <div class="dv3-card" id="${uid}-info" hidden></div>
      <div class="dv3-row" id="${uid}-acts" hidden>
        <button class="dv3-btn pri" type="button" data-a="tour">Walk me there</button>
        <button class="dv3-btn" type="button" data-a="inside">Step inside</button>
        <button class="dv3-btn" type="button" data-a="top">View from above</button>
      </div>
      <ol class="dv3-steps" id="${uid}-steps" hidden></ol>
    </div>`;
  root.appendChild(panel);
  const $ = (s) => panel.querySelector("#" + uid + "-" + s);
  const top = el("div", "dv3-top", `
    <div class="dv3-brand">${esc(title[0])} <b>${esc(title[1])}</b></div>
    <a class="dv3-gmap" href="https://maps.app.goo.gl/JDSsvENLr2fv1TJa9" target="_blank" rel="noopener" aria-label="Google Maps directions to Main Gate G9"><img src="data:image/png;base64,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" alt="" width="12" height="17">To Main Gate G9</a>
    <div class="dv3-seg" role="group" aria-label="View"><button type="button" data-m="overview" aria-pressed="true">Overview</button><button type="button" data-m="walk" aria-pressed="false">Walk</button></div>
    <div class="dv3-seg" role="group" aria-label="Roofs"><button type="button" class="rt" data-rt="1" aria-pressed="false">Roofs</button></div>`);
  root.appendChild(top);
  ui.here = el("div", "dv3-here", "<small>You are in</small><b></b>");
  root.appendChild(ui.here);
  ui.hint = el("div", "dv3-hint");
  root.appendChild(ui.hint);
  ui.map = el("canvas", "dv3-map");
  ui.map.width = 420;
  ui.map.height = 300;
  root.appendChild(ui.map);
  ui.toast = el("div", "dv3-toast");
  ui.toast.setAttribute("role", "status");
  root.appendChild(ui.toast);
  $("to").addEventListener("change", (e) => on.select(e.target.value || null));
  $("from").addEventListener("change", (e) => on.start(e.target.value));
  $("acts").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (b) on.action(b.dataset.a);
  });
  $("fold").addEventListener("click", () => {
    const f = panel.classList.toggle("folded");
    $("fold").textContent = f ? "Show" : "Hide";
    $("fold").setAttribute("aria-expanded", String(!f));
  });
  top.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.m) on.mode(b.dataset.m);
    if (b.dataset.rt) on.roofs(b.getAttribute("aria-pressed") === "true" ? "off" : "on");
  });
  $("loc").addEventListener("click", () => on.locate && on.locate());
  ui.setLoc = (v) => $("loc").setAttribute("aria-pressed", String(v));
  ui.setMode = (m) => {
    top.querySelectorAll("[data-m]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.m === m)));
    root.classList.toggle("walk", m === "walk");
    ui.hint.textContent = m === "walk" ? "Click the floor to walk there \xB7 drag to look around \xB7 W A S D or arrow keys to move \xB7 Shift to run" : "Drag to rotate \xB7 scroll or pinch to zoom \xB7 right-drag or two fingers to pan \xB7 double-click a spot to stand there";
  };
  ui.setRoofs = (r) => top.querySelectorAll("[data-rt]").forEach((b) => b.setAttribute("aria-pressed", String(r === "on")));
  ui.setStart = (id) => {
    $("from").value = id;
  };
  ui.setTouring = (t) => {
    const b = panel.querySelector('[data-a="tour"]');
    b.textContent = t ? "Stop walking" : "Walk me there";
  };
  ui.setDestination = (room, building, route, steps) => {
    $("to").value = room ? room.id : "";
    const info = $("info"), acts = $("acts"), list = $("steps");
    if (!room) {
      info.hidden = acts.hidden = list.hidden = true;
      return;
    }
    const chips = [];
    if (room.seats) chips.push(`<span class="dv3-chip k">${room.seats.toLocaleString("en-IN")} seats</span>`);
    if (room.tables) chips.push(`<span class="dv3-chip k">${room.tables} stations</span>`);
    if (room.size) chips.push(`<span class="dv3-chip">${esc(room.size)}</span>`);
    if (building) chips.push(`<span class="dv3-chip">${esc(building)}</span>`);
    if (room.note) chips.push(`<span class="dv3-chip">${esc(room.note)}</span>`);
    const mins = route ? Math.max(1, Math.round(route.length / 75)) : 0;
    info.innerHTML = `<h2>${esc(room.name)}</h2><div class="dv3-chips">${chips.join("")}</div>${route ? `<p class="dv3-sum"><b>${Math.round(route.length / 5) * 5} m</b> \xB7 about <b>${mins} min</b> on foot</p>` : '<p class="dv3-sum">No walking route found from this start.</p>'}`;
    info.hidden = acts.hidden = false;
    list.innerHTML = (steps || []).map((s) => `<li>${esc(s.text)} <span>${esc(s.then)}</span></li>`).join("");
    list.hidden = !steps || !steps.length;
    if (list.lastElementChild) list.lastElementChild.classList.add("arr");
  };
  let toastT = 0;
  ui.say = (t, ms = 2600) => {
    ui.toast.textContent = t;
    ui.toast.classList.add("on");
    clearTimeout(toastT);
    toastT = setTimeout(() => ui.toast.classList.remove("on"), ms);
  };
  ui.setHere = (t) => {
    const b = ui.here.lastElementChild;
    if (b.textContent !== t) b.textContent = t;
  };
  ui.dispose = () => {
    clearTimeout(toastT);
    [ui.labels, panel, top, ui.here, ui.hint, ui.map, ui.toast].forEach((n) => n.remove());
  };
  ui.panel = panel;
  return ui;
}

export { createUI };
