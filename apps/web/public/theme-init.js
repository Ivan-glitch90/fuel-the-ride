// Sets light/dark before the app draws anything, so the page never flashes the wrong theme.
// Same rule as src/lib/theme.js: the rider's choice (Profile → Dark mode), else the phone's setting.
// A separate file (not inline) because the Content-Security-Policy only allows same-origin scripts.
(function () {
  var choice = null;
  try {
    choice = localStorage.getItem('ftr-theme');
  } catch (e) {
    // storage blocked: follow the phone
  }
  var dark = choice ? choice === 'dark' : window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  var meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = dark ? '#131316' : '#fbf8fd';
})();
