try {
  var savedScheme = localStorage.getItem('athar:color-scheme');
  var meta = document.querySelector('meta[name="color-scheme"]');
  if (meta) {
    meta.content =
      savedScheme === 'light' || savedScheme === 'dark' ? savedScheme : 'light dark';
  }
  if (savedScheme === 'light' || savedScheme === 'dark') {
    document.documentElement.setAttribute('data-theme', savedScheme);
  }
  var savedLang = localStorage.getItem('athar:locale');
  if (savedLang === 'en' || savedLang === 'ar') {
    document.documentElement.lang = savedLang;
    document.documentElement.dir = savedLang === 'ar' ? 'rtl' : 'ltr';
  }
  if ('__TAURI_INTERNALS__' in window) {
    document.documentElement.setAttribute('data-platform', 'desktop');
  }
} catch (_) {
  // Ignore storage restrictions during boot
}
