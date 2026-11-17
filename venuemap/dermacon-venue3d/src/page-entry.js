import { createVenue } from "./index.js";

function boot() {
  const app = document.getElementById("app");
  const v = createVenue(app, {
    destination: new URLSearchParams(location.search).get("to") || location.hash.slice(1) || null,
    onSelect: (room) => {
      const h = room ? "#" + room.id : "";
      if (location.hash !== h) {
        try {
          location.hash = h;
        } catch (e) {
        }
      }
    }
  });
  window.venue = v;
  window.addEventListener("hashchange", () => {
    const id = location.hash.slice(1);
    if ((v.destination && v.destination.id || "") !== id) v.goTo(id || null, { silent: true });
  });
  const b = document.getElementById("boot");
  if (b) {
    b.style.opacity = "0";
    setTimeout(() => b.remove(), 600);
  }
}
var fonts = document.fonts && document.fonts.load ? Promise.race([Promise.all(["800 40px Barlow", "600 40px Barlow", "500 40px Barlow", '700 40px "Barlow Condensed"'].map((f) => document.fonts.load(f))), new Promise((r) => setTimeout(r, 2500))]) : Promise.resolve();
fonts.then(() => requestAnimationFrame(boot), () => requestAnimationFrame(boot));
