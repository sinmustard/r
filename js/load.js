(() => {
  const t = window.LOAD_TIME;
  const css = document.createElement("link");
  css.rel = "stylesheet";
  css.href = "style.css?t=" + t;
  document.head.appendChild(css);
  for (const name of ["config", "modules", "game", "skills", "upgrade", "route", "bosses"]) {
    const s = document.createElement("script");
    s.src = "js/" + name + ".js?t=" + t;
    s.async = false;
    document.body.appendChild(s);
  }
})();
