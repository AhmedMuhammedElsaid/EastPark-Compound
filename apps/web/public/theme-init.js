// Applies the persisted theme class before first paint to avoid a flash of the wrong theme.
// Served as a static same-origin file so the CSP does not need an inline-script allowance for it.
// Keep the storage key in sync with STORAGE_KEY in src/lib/theme/ThemeProvider.tsx.
(function () {
  try {
    if (window.localStorage.getItem('eastpark-theme') === 'light') {
      document.documentElement.classList.add('light');
    }
  } catch {}
})();
