/**
 * Solvexa - Dark Mode
 * Applies the saved theme on load and wires the toggle button.
 * Plain script (no ES modules).
 */

(function () {
  const STORAGE_KEY = "solvexa_theme";

  const applyTheme = (theme, themeBtn) => {
    document.documentElement.setAttribute("data-theme", theme);
    themeBtn.textContent = theme === "dark" ? "☀️" : "🌙";
  };

  const initTheme = (themeBtn) => {
    const savedTheme = localStorage.getItem(STORAGE_KEY) || "light";
    applyTheme(savedTheme, themeBtn);

    themeBtn.addEventListener("click", () => {
      const isDark = document.documentElement.getAttribute("data-theme") === "dark";
      const newTheme = isDark ? "light" : "dark";
      localStorage.setItem(STORAGE_KEY, newTheme);
      applyTheme(newTheme, themeBtn);
    });
  };

  window.Solvexa = window.Solvexa || {};
  window.Solvexa.initTheme = initTheme;
})();
