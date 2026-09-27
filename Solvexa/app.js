/**
 * Solvexa - Main Application v2.0
 * Enhanced with semantic search, advanced filtering, and better UX
 * Filters: Category → Solution Type → Language
 */

const App = (() => {
  // --- Safe localStorage helpers ---
  const safeJSON = (key, fallback) => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
      console.warn(`Could not read localStorage key: ${key}`, error);
      return fallback;
    }
  };

  // --- State Management ---
  let state = {
    allSolutions: [],
    displayedSolutions: [],
    activeCategory: "All",
    activeType: "All",
    activeLanguage: "All",
    searchQuery: "",
    currentSolutionId: null,
    savedItems: new Set(safeJSON("solvexa_saved", [])),
    feedback: safeJSON("solvexa_feedback", {}),
    sortBy: "recent",
    isLoading: false,
  };

  // --- DOM References ---
  const DOM = {
    searchInput: document.getElementById("searchInput"),
    categoryFilter: document.getElementById("categoryFilter"),
    typeFilter: document.getElementById("typeFilter"),
    languageFilter: document.getElementById("languageFilter"),
    sortBy: document.getElementById("sortBy"),
    cardsContainer: document.getElementById("cardsContainer"),
    resultCount: document.getElementById("resultCount"),
    sectionTitle: document.getElementById("sectionTitle"),
    viewHome: document.getElementById("view-home"),
    viewDetail: document.getElementById("view-detail"),
    themeBtn: document.getElementById("themeBtn"),
    toastContainer: document.getElementById("toastContainer"),
    backBtn: document.getElementById("backBtn"),
    logoBtn: document.getElementById("logoBtn"),

    // Suggest a Solution modal
    suggestModal: document.getElementById("suggestModal"),
    suggestForm: document.getElementById("suggestForm"),
    suggestCategory: document.getElementById("suggestCategory"),
    suggestLanguage: document.getElementById("suggestLanguage"),
    suggestProblem: document.getElementById("suggestProblem"),
    suggestSolution: document.getElementById("suggestSolution"),
    suggestError: document.getElementById("suggestError"),
    suggestSubmitBtn: document.getElementById("suggestSubmitBtn"),
  };

  // --- Keyword Mapping for Semantic Search ---
  const semanticMap = {
    exam: ["exam", "test", "quiz", "preparation", "study", "prepare"],
    schedule: ["schedule", "plan", "time", "organization", "organize", "manage", "routine"],
    cooking: ["cook", "recipe", "food", "kitchen", "meal", "dish", "prepare"],
    exercise: ["exercise", "fitness", "workout", "gym", "run", "train", "sport"],
    technology: ["tech", "computer", "software", "app", "digital", "programming"],
    everyday: ["life", "daily", "routine", "home", "personal", "basic"],
  };

  // --- Utility Functions ---
  const Utils = {
    escapeHTML: (str) => 
      str.replace(/[&<>"']/g, m => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
      }[m])),

    debounce: (func, delay) => {
      let timeoutId;
      return (...args) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func(...args), delay);
      };
    },

    highlightMatch: (text, query) => {
      if (!query) return text;
      const regex = new RegExp(`(${query})`, "gi");
      return text.replace(regex, "<mark>$1</mark>");
    },

    getRelatedSolutions: (currentId, category) => {
      return state.allSolutions
        .filter(s => s.id !== currentId && s.category === category)
        .slice(0, 3);
    },

    formatDate: (dateStr) => {
      const date = new Date(dateStr);
      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric"
      });
    }
  };

  // --- Notification Service ---
  const Notification = {
    show: (message, type = "success", duration = 3000) => {
      const toast = document.createElement("div");
      toast.className = `toast ${type}`;
      toast.setAttribute("role", "status");
      toast.textContent = message;
      DOM.toastContainer.appendChild(toast);

      // Trigger animation
      setTimeout(() => toast.classList.add("show"), 10);

      setTimeout(() => {
        toast.classList.add("fade-out");
        toast.addEventListener("animationend", () => toast.remove(), { once: true });
      }, duration);
    }
  };

  // --- Supabase Configuration ---
      const SUPABASE_URL = "https://widvkfyiyptjpxyoiwss.supabase.co";
      const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_VyuctW8Kg9kjjNbhfcyV5A_8izmM2OR";

  let supabaseClient = null;

  const initSupabase = () => {
    if (supabaseClient) return supabaseClient;
    if (!window.supabase || typeof window.supabase.createClient !== "function") {
      console.error("Supabase CDN is not available.");
      return null;
    }
    try {
      supabaseClient = window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_PUBLISHABLE_KEY
      );
      return supabaseClient;
    } catch (error) {
      console.error("Supabase initialization error:", error);
      return null;
    }
  };

  // --- Data Service ---
  const DataService = {
    loadData: async (options = {}) => {
      const silent = options.silent === true;

      try {
        const client = initSupabase();
        if (!client) {
          state.isLoading = false;
          if (!silent) showError("Supabase could not be loaded. Please refresh the page.");
          return;
        }

        state.isLoading = true;

        // Only show skeletons during the initial load.
        if (!silent) {
          showSkeletons();
        }

        // Load only Published solutions from Supabase.
        const { data, error } = await client
          .from("solutions")
          .select("*")
          .eq("status", "Published")
          .order("created_at", { ascending: false });

        if (error) {
          throw error;
        }

        state.allSolutions = (data || []).map(s => ({
          ...s,

          // Keep the existing frontend structure compatible with Supabase.
          type: s.type || "How-To",
          language: s.language || "English",
          difficulty: s.difficulty || "Beginner",
          keywords: Array.isArray(s.keywords) ? s.keywords : [],

          views: Number(s.views) || 0,
          helpful: Number(s.helpful) || 0,
          unhelpful: Number(s.unhelpful) || 0,

          // The database uses created_at/date; the frontend expects date.
          date: s.date || s.created_at
        }));

        state.isLoading = false;
        render();

        // If the user is currently viewing a solution, refresh its data
        // without changing the current URL or creating another view count.
        if (state.currentSolutionId !== null) {
          const current = state.allSolutions.find(
            s => s.id === state.currentSolutionId
          );

          if (current) {
            updateDetailView(current);
          }
        }

      } catch (error) {
        console.error("Supabase data loading error:", error);
        state.isLoading = false;

        if (!silent) {
          showError("Failed to load solutions. Please refresh the page.");
        }
      }
    }
  };

  // --- Suggest-a-Solution Service ---
  const SubmissionService = {
    submit: async ({ problem, suggestedSolution, category, language }) => {
      const client = initSupabase();
      if (!client) throw new Error("Could not connect. Please refresh and try again.");

      const { error } = await client.from("user_submissions").insert({
        problem,
        suggested_solution: suggestedSolution || null,
        category: category || null,
        language: language || "English",
        status: "Pending"
      });

      if (error) throw error;
    }
  };

  // Refresh published solutions automatically every 15 seconds.
  // This lets an already-open Solvexa page pick up new Admin publications
  // without using Terminal or manually editing data.json.
  const startAutoRefresh = () => {
    setInterval(() => {
      DataService.loadData({ silent: true });
    }, 15000);
  };

  // --- Search & Filter Logic ---
  const SearchEngine = {
    performSearch: (query) => {
      if (!query.trim()) {
        return state.allSolutions;
      }

      const q = query.toLowerCase();
      
      return state.allSolutions.filter(solution => {
        const titleMatch = solution.title.toLowerCase().includes(q);
        const problemMatch = solution.problem.toLowerCase().includes(q);
        const contentMatch = solution.content.toLowerCase().includes(q);
        
        // Semantic matching
        let semanticMatch = false;
        for (const [key, keywords] of Object.entries(semanticMap)) {
          if (keywords.some(kw => q.includes(kw))) {
            semanticMatch = 
              solution.category.toLowerCase().includes(key) ||
              solution.keywords?.some(k => k.toLowerCase().includes(key));
            if (semanticMatch) break;
          }
        }
        
        return titleMatch || problemMatch || contentMatch || semanticMatch;
      });
    },

    applyFilters: (solutions) => {
      return solutions.filter(s => {
        const categoryMatch = 
          state.activeCategory === "All" || s.category === state.activeCategory;
        const typeMatch = 
          state.activeType === "All" || s.type === state.activeType;
        const languageMatch = 
          state.activeLanguage === "All" || s.language === state.activeLanguage;
        return categoryMatch && typeMatch && languageMatch;
      });
    },

    sortSolutions: (solutions) => {
      const sorted = [...solutions];
      
      switch (state.sortBy) {
        case "popular":
          return sorted.sort((a, b) => (b.helpful || 0) - (a.helpful || 0));
        case "title":
          return sorted.sort((a, b) => a.title.localeCompare(b.title));
        case "recent":
        default:
          return sorted;
      }
    }
  };

  // --- Render Functions ---
  const render = () => {
    const filtered = SearchEngine.performSearch(state.searchQuery);
    state.displayedSolutions = SearchEngine.applyFilters(filtered);
    state.displayedSolutions = SearchEngine.sortSolutions(state.displayedSolutions);
    
    renderCards();
    updateResultsInfo();
  };

  const renderCards = () => {
    if (!state.displayedSolutions.length) {
      DOM.cardsContainer.innerHTML = `
        <div class="empty">
          <div class="empty-icon">🔍</div>
          <h3>No solutions found</h3>
          <p>Try different keywords or filters — or tell us what you need.</p>
          <button type="button" class="btn-primary" data-action="open-suggest">
            🙋 Suggest a Solution
          </button>
        </div>
      `;
      return;
    }

    DOM.cardsContainer.innerHTML = state.displayedSolutions.map(s => `
      <button class="card" data-id="${s.id}" aria-label="Open: ${Utils.escapeHTML(s.title)}">
        <div class="card-top">
          <span class="tag">${s.category}</span>
          ${s.type ? `<span class="type-tag">${s.type}</span>` : ''}
          <span class="date">${Utils.formatDate(s.date)}</span>
        </div>
        <h3>${Utils.escapeHTML(s.title)}</h3>
        <p class="problem">${Utils.escapeHTML(s.problem)}</p>
        <div class="card-bottom">
          <span class="read">View Details →</span>
          <span class="stats">${state.savedItems.has(s.id) ? '📌 Saved' : '👁 ' + (s.views || 0)}</span>
        </div>
      </button>
    `).join("");

    // Attach click handlers
    document.querySelectorAll(".card").forEach(card => {
      card.addEventListener("click", () => {
        const id = card.dataset.id;
        window.location.hash = `solution-${id}`;
      });
    });
  };

  const renderDetail = (id) => {
    const solution = state.allSolutions.find(s => s.id === parseInt(id));
    if (!solution) return handleRoute();

    state.currentSolutionId = solution.id;

    // Update view count locally for this open session.
    solution.views = (solution.views || 0) + 1;

    updateDetailView(solution);
  };

  const updateDetailView = (solution) => {
    // Meta info
    document.getElementById("detailMeta").innerHTML = `
      <span class="meta-tag">${solution.category}</span>
      ${solution.type ? `<span class="meta-tag">${solution.type}</span>` : ''}
      <span class="meta-date">${Utils.formatDate(solution.date)}</span>
    `;

    // Title
    document.getElementById("detailTitle").textContent = solution.title;

    // Stats
    document.getElementById("detailStats").innerHTML = `
      <span class="stat-item">👁 ${solution.views} views</span>
      <span class="stat-item">👍 ${solution.helpful || 0} helpful</span>
      <span class="stat-item">👎 ${solution.unhelpful || 0} not helpful</span>
    `;

    // Problem
    document.getElementById("detailProblem").textContent = solution.problem;

    // Content
    document.getElementById("detailContent").textContent = solution.content;

    // Difficulty badge
    if (solution.difficulty) {
      document.getElementById("difficultyBadge").innerHTML = `
        <span class="badge-difficulty ${solution.difficulty.toLowerCase()}">
          ${solution.difficulty}
        </span>
      `;
    }

    // Update action buttons
    updateActionButtons(solution.id);

    // Related solutions
    const relatedSolutions = Utils.getRelatedSolutions(solution.id, solution.category);
    if (relatedSolutions.length > 0) {
      document.getElementById("relatedSection").style.display = "block";
      document.getElementById("relatedList").innerHTML = relatedSolutions.map(s => `
        <div class="related-item" data-id="${s.id}">
          <p>${Utils.escapeHTML(s.title)}</p>
        </div>
      `).join("");

      document.querySelectorAll(".related-item").forEach(item => {
        item.addEventListener("click", () => {
          window.location.hash = `solution-${item.dataset.id}`;
        });
      });
    } else {
      document.getElementById("relatedSection").style.display = "none";
    }

    // Switch views
    DOM.viewHome.classList.remove("active");
    DOM.viewDetail.classList.add("active");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const updateActionButtons = (solutionId) => {
    const saveBtn = document.getElementById("saveBtn");
    const helpfulBtn = document.querySelector('[data-action="helpful"]');
    const unhelpfulBtn = document.querySelector('[data-action="unhelpful"]');

    // Save button state
    if (state.savedItems.has(solutionId)) {
      saveBtn.classList.add("active");
      saveBtn.textContent = "🔖 Saved";
    } else {
      saveBtn.classList.remove("active");
      saveBtn.textContent = "🔖 Save";
    }

    // Feedback button states
    if (state.feedback[solutionId] === "helpful") {
      helpfulBtn.classList.add("active");
      unhelpfulBtn.classList.remove("active");
    } else if (state.feedback[solutionId] === "unhelpful") {
      unhelpfulBtn.classList.add("active");
      helpfulBtn.classList.remove("active");
    } else {
      helpfulBtn.classList.remove("active");
      unhelpfulBtn.classList.remove("active");
    }
  };

  const updateResultsInfo = () => {
    const count = state.displayedSolutions.length;
    DOM.resultCount.textContent = `${count} ${count === 1 ? "result" : "results"}`;
    
    if (state.searchQuery || state.activeCategory !== "All" || state.activeType !== "All" || state.activeLanguage !== "All") {
      DOM.sectionTitle.textContent = "Search Results";
    } else {
      DOM.sectionTitle.textContent = "All Solutions";
    }
  };

  const showSkeletons = () => {
    DOM.cardsContainer.innerHTML = Array(6).fill(0)
      .map(() => '<div class="skeleton"></div>')
      .join("");
  };

  // --- Suggest a Solution Modal ---
  const openSuggestModal = () => {
    DOM.suggestError.style.display = "none";
    // Convenience: carry over whatever the visitor already searched for.
    if (state.searchQuery && !DOM.suggestProblem.value) {
      DOM.suggestProblem.value = state.searchQuery;
    }
    if (state.activeCategory !== "All") {
      DOM.suggestCategory.value = state.activeCategory;
    }
    DOM.suggestModal.style.display = "flex";
    DOM.suggestProblem.focus();
  };

  const closeSuggestModal = () => {
    DOM.suggestModal.style.display = "none";
  };

  const showError = (message) => {
    DOM.cardsContainer.innerHTML = `
      <div class="empty">
        <div class="empty-icon">❌</div>
        <h3>Error loading solutions</h3>
        <p>${message}</p>
        <button class="btn-secondary" onclick="location.reload()">Try Again</button>
      </div>
    `;
  };

  // --- Event Handlers ---
  const bindEvents = () => {
    // Search with debounce
    DOM.searchInput.addEventListener("input", Utils.debounce((e) => {
      state.searchQuery = e.target.value.trim();
      state.sortBy = "recent";
      DOM.sortBy.value = "recent";
      render();
    }, 300));

    // Category filter
    DOM.categoryFilter.addEventListener("change", (e) => {
      state.activeCategory = e.target.value;
      render();
    });

    // Solution Type filter
    DOM.typeFilter.addEventListener("change", (e) => {
      state.activeType = e.target.value;
      render();
    });

    // Language filter
    DOM.languageFilter.addEventListener("change", (e) => {
      state.activeLanguage = e.target.value;
      render();
    });

    // Sort
    DOM.sortBy.addEventListener("change", (e) => {
      state.sortBy = e.target.value;
      render();
    });

    // Detail actions
    document.getElementById("detailActions").addEventListener("click", (e) => {
      const btn = e.target.closest(".action-btn");
      if (!btn) return;

      const action = btn.dataset.action;
      const id = state.currentSolutionId;
      if (!id) return;

      switch (action) {
        case "save":
          if (state.savedItems.has(id)) {
            state.savedItems.delete(id);
            Notification.show("Removed from saved");
          } else {
            state.savedItems.add(id);
            Notification.show("Added to saved ✓");
          }
          localStorage.setItem("solvexa_saved", JSON.stringify([...state.savedItems]));
          updateActionButtons(id);
          render(); // Update cards
          break;

        case "share":
          const url = location.href;
          if (navigator.share) {
            navigator.share({ title: "Solvexa Solution", url });
          } else {
            navigator.clipboard.writeText(url);
            Notification.show("Link copied to clipboard");
          }
          break;

        case "copy":
          const content = document.getElementById("detailContent").textContent;
          navigator.clipboard.writeText(content);
          Notification.show("Solution copied");
          break;

        case "helpful":
          state.feedback[id] = "helpful";
          const solution = state.allSolutions.find(s => s.id === id);
          if (solution) solution.helpful = (solution.helpful || 0) + 1;
          localStorage.setItem("solvexa_feedback", JSON.stringify(state.feedback));
          updateActionButtons(id);
          Notification.show("👍 Thanks for feedback!");
          break;

        case "unhelpful":
          state.feedback[id] = "unhelpful";
          const solution2 = state.allSolutions.find(s => s.id === id);
          if (solution2) solution2.unhelpful = (solution2.unhelpful || 0) + 1;
          localStorage.setItem("solvexa_feedback", JSON.stringify(state.feedback));
          updateActionButtons(id);
          Notification.show("👎 We'll improve this");
          break;
      }
    });

    // Back button
    DOM.backBtn.addEventListener("click", () => {
      window.location.hash = "";
    });

    // Logo - go home
    DOM.logoBtn.addEventListener("click", (e) => {
      e.preventDefault();
      window.location.hash = "";
    });

    // Hash routing
    window.addEventListener("hashchange", handleRoute);

    // Theme toggle
    DOM.themeBtn.addEventListener("click", () => {
      const isDark = document.documentElement.getAttribute("data-theme") === "dark";
      const newTheme = isDark ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", newTheme);
      localStorage.setItem("solvexa_theme", newTheme);
      DOM.themeBtn.textContent = newTheme === "dark" ? "☀️" : "🌙";
    });

    // Suggest a Solution — open/close from any entry point (event delegation,
    // since the empty-state button is re-rendered dynamically)
    document.addEventListener("click", (e) => {
      if (e.target.closest('[data-action="open-suggest"]')) {
        openSuggestModal();
      } else if (e.target.closest('[data-action="close-suggest"]')) {
        closeSuggestModal();
      }
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && DOM.suggestModal.style.display === "flex") {
        closeSuggestModal();
      }
    });

    DOM.suggestForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      DOM.suggestError.style.display = "none";

      const problem = DOM.suggestProblem.value.trim();
      if (!problem) {
        DOM.suggestError.textContent = "Please describe the problem.";
        DOM.suggestError.style.display = "block";
        return;
      }

      DOM.suggestSubmitBtn.disabled = true;
      DOM.suggestSubmitBtn.textContent = "Submitting...";

      try {
        await SubmissionService.submit({
          problem,
          suggestedSolution: DOM.suggestSolution.value.trim(),
          category: DOM.suggestCategory.value,
          language: DOM.suggestLanguage.value
        });

        Notification.show("✓ Thanks! Your submission was sent for review.");
        DOM.suggestForm.reset();
        closeSuggestModal();
      } catch (error) {
        console.error("Failed to submit suggestion:", error);
        DOM.suggestError.textContent = "Couldn't submit right now — please try again.";
        DOM.suggestError.style.display = "block";
      } finally {
        DOM.suggestSubmitBtn.disabled = false;
        DOM.suggestSubmitBtn.textContent = "Submit for Review";
      }
    });
  };

  // --- Routing ---
  const handleRoute = () => {
    const hash = window.location.hash;
    if (hash.startsWith("#solution-")) {
      const id = hash.replace("#solution-", "");
      if (state.allSolutions.length > 0) {
        renderDetail(id);
      }
    } else {
      state.currentSolutionId = null;
      DOM.viewDetail.classList.remove("active");
      DOM.viewHome.classList.add("active");
    }
  };

  // --- Initialization ---
  return {
    init: () => {
      // Theme initialization — independent of Supabase
      const savedTheme = localStorage.getItem("solvexa_theme") || "light";
      document.documentElement.setAttribute("data-theme", savedTheme);
      DOM.themeBtn.textContent = savedTheme === "dark" ? "☀️" : "🌙";

      bindEvents();
      DataService.loadData();
      startAutoRefresh();
      handleRoute();
    }
  };
})();

// Start app when DOM is ready
document.addEventListener("DOMContentLoaded", App.init);
