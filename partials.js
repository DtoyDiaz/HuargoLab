// Carga el header y footer compartidos en cualquier página que tenga
// <div id="site-header"></div> y/o <div id="site-footer"></div>.
// Requiere que el sitio esté servido por http(s) (Netlify funciona bien);
// no funciona abriendo el archivo directo con doble clic (file://).
(function () {
  function loadPartial(id, url) {
    const el = document.getElementById(id);
    if (!el) return Promise.resolve();
    return fetch(url)
      .then(function (res) {
        if (!res.ok) throw new Error("No se pudo cargar " + url);
        return res.text();
      })
      .then(function (html) {
        el.innerHTML = html;
      })
      .catch(function (err) {
        console.error(err);
        el.innerHTML =
          '<p style="color:#FF4F1E;text-align:center;padding:1rem;font-size:14px;">No se pudo cargar esta sección.</p>';
      });
  }

  document.addEventListener("DOMContentLoaded", function () {
    Promise.all([
      loadPartial("site-header", "header.html"),
      loadPartial("site-footer", "footer.html"),
    ]).then(function () {
      // Activa el menú móvil (hamburguesa) del header compartido.
      const toggle = document.getElementById("mobile-menu-toggle");
      const menu = document.getElementById("mobile-menu");
      if (toggle && menu) {
        toggle.addEventListener("click", function () {
          menu.classList.toggle("hidden");
        });
        // Cierra el menú al elegir una opción.
        menu.querySelectorAll("a").forEach(function (link) {
          link.addEventListener("click", function () {
            menu.classList.add("hidden");
          });
        });
      }
      document.dispatchEvent(new Event("partialsLoaded"));
    });
  });
})();
