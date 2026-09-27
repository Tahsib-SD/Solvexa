/**
 * Solvexa Admin Dashboard v2.0
 * Professional Content Management System
 * =====================================
 */

const AdminApp = (() => {
  // --- STATE MANAGEMENT ---
  let state = {
    currentUser: null,
    solutions: [],
    pendingSubmissions: [],
    currentView: "dashboard",
    editingId: null,
    searchQuery: "",
    filterCategory: "",
    filterStatus: "",
  };

  // --- DOM REFERENCES ---
  const DOM = {
    // Auth
    authView: document.getElementById("authView"),
    dashboardView: document.getElementById("dashboardView"),
    loginForm: document.getElementById("loginForm"),
    authError: document.getElementById("authError"),

    // Navigation
    navItems: document.querySelectorAll(".nav-item"),
    viewSections: document.querySelectorAll(".view-section"),

    // Form
    addSolutionForm: document.getElementById("addSolutionForm"),
    saveDraftBtn: document.getElementById("saveDraftBtn"),

    // Filter & Search
    solutionSearch: document.getElementById("solutionSearch"),
    filterCategory: document.getElementById("filterCategory"),
    filterStatus: document.getElementById("filterStatus"),
    solutionsTable: document.getElementById("solutionsTable"),

    // Modals
    editModal: document.getElementById("editModal"),
    editForm: document.getElementById("editForm"),
    closeEditModal: document.getElementById("closeEditModal"),
    cancelEditBtn: document.getElementById("cancelEditBtn"),

    // UI Elements
    viewTitle: document.getElementById("viewTitle"),
    viewSubtitle: document.getElementById("viewSubtitle"),
    adminNameDisplay: document.getElementById("adminNameDisplay"),
    profileAvatar: document.getElementById("profileAvatar"),
    themeBtn: document.getElementById("themeBtn"),
    logoutBtn: document.getElementById("logoutBtn"),
    toastContainer: document.getElementById("toastContainer"),

    // Stats
    totalSolutions: document.getElementById("totalSolutions"),
    totalViews: document.getElementById("totalViews"),
    totalHelpful: document.getElementById("totalHelpful"),
    pendingCount: document.getElementById("pendingCount"),
    pendingBadge: document.getElementById("pendingBadge"),
    recentSolutions: document.getElementById("recentSolutions"),

    // Analytics
    mostViewed: document.getElementById("mostViewed"),
    mostHelpful: document.getElementById("mostHelpful"),
    categoryStats: document.getElementById("categoryStats"),
    difficultyStats: document.getElementById("difficultyStats"),

    // Pending
    pendingList: document.getElementById("pendingList"),
  };

  // --- UTILITIES ---
  const Utils = {
    generateId: () => Date.now().toString(36) + Math.random().toString(36).substr(2),

    formatDate: (dateStr) => {
      const date = new Date(dateStr);
      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric"
      });
    },

    debounce: (func, delay) => {
      let timeoutId;
      return (...args) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func(...args), delay);
      };
    }
  };

  // --- NOTIFICATIONS ---
  const Notify = {
    show: (message, type = "success") => {
      const toast = document.createElement("div");
      toast.className = `toast ${type}`;
      toast.textContent = message;
      DOM.toastContainer.appendChild(toast);

      setTimeout(() => {
        toast.style.animation = "slideIn 0.3s ease";
      }, 10);

      setTimeout(() => {
        toast.remove();
      }, 3000);
    }
  };

  // --- SUPABASE CONFIGURATION (same project the main app reads from) ---
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
      supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
      return supabaseClient;
    } catch (error) {
      console.error("Supabase initialization error:", error);
      return null;
    }
  };

  // Map a Supabase `solutions` row to the shape the admin UI already expects
  const mapRowToSolution = (row) => ({
    ...row,
    type: row.type || "How-To",
    language: row.language || "English",
    difficulty: row.difficulty || "Beginner",
    keywords: Array.isArray(row.keywords) ? row.keywords : [],
    views: Number(row.views) || 0,
    helpful: Number(row.helpful) || 0,
    unhelpful: Number(row.unhelpful) || 0,
    notes: row.notes || "",
    createdAt: row.created_at,
    editedAt: row.edited_at || row.created_at,
  });

  // Only build payload keys that are real `solutions` columns.
  // (created_by / edited_by are uuid columns tied to real Supabase Auth users,
  // which the current mock login doesn't provide yet, so they're left alone.)
  const buildSolutionPayload = (solution) => {
    const payload = {};
    if (solution.title !== undefined) payload.title = solution.title;
    if (solution.category !== undefined) payload.category = solution.category;
    if (solution.type !== undefined) payload.type = solution.type || "How-To";
    if (solution.language !== undefined) payload.language = solution.language || "English";
    if (solution.difficulty !== undefined) payload.difficulty = solution.difficulty || "Beginner";
    if (solution.problem !== undefined) payload.problem = solution.problem;
    if (solution.content !== undefined) payload.content = solution.content;
    if (solution.status !== undefined) payload.status = solution.status;
    if (solution.notes !== undefined) payload.notes = solution.notes || "";
    if (solution.keywords !== undefined) {
      payload.keywords = Array.isArray(solution.keywords)
        ? solution.keywords.filter(k => k)
        : String(solution.keywords).split(",").map(k => k.trim()).filter(k => k);
    }
    if (solution.views !== undefined) payload.views = Number(solution.views) || 0;
    if (solution.helpful !== undefined) payload.helpful = Number(solution.helpful) || 0;
    if (solution.unhelpful !== undefined) payload.unhelpful = Number(solution.unhelpful) || 0;
    return payload;
  };

  // --- DATA MANAGEMENT (Supabase-backed for solutions and pending submissions) ---
  const DataManager = {
    load: async () => {
      const client = initSupabase();
      if (!client) {
        Notify.show("Could not connect to Supabase. Please refresh.", "error");
        return;
      }

      const { data, error } = await client
        .from("solutions")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Failed to load solutions from Supabase:", error);
        Notify.show("Failed to load solutions from the database.", "error");
        return;
      }

      state.solutions = (data || []).map(mapRowToSolution);
    },

    loadPendingSubmissions: async () => {
      const client = initSupabase();
      if (!client) return;

      const { data, error } = await client
        .from("user_submissions")
        .select("*")
        .eq("status", "Pending")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Failed to load pending submissions:", error);
        Notify.show("Failed to load pending submissions.", "error");
        return;
      }

      state.pendingSubmissions = data || [];
    },

    approveSubmission: async (id) => {
      const client = initSupabase();
      if (!client) throw new Error("Supabase is not available.");

      const { error } = await client
        .from("user_submissions")
        .update({ status: "Approved", reviewed_at: new Date().toISOString() })
        .eq("id", id);

      if (error) throw error;

      state.pendingSubmissions = state.pendingSubmissions.filter(s => s.id !== id);
    },

    rejectSubmission: async (id, note) => {
      const client = initSupabase();
      if (!client) throw new Error("Supabase is not available.");

      const { error } = await client
        .from("user_submissions")
        .update({
          status: "Rejected",
          reviewed_at: new Date().toISOString(),
          admin_note: note || null
        })
        .eq("id", id);

      if (error) throw error;

      state.pendingSubmissions = state.pendingSubmissions.filter(s => s.id !== id);
    },

    addSolution: async (solution) => {
      const client = initSupabase();
      if (!client) throw new Error("Supabase is not available.");

      const payload = buildSolutionPayload(solution);
      const { data, error } = await client
        .from("solutions")
        .insert(payload)
        .select()
        .single();

      if (error) throw error;

      const newSolution = mapRowToSolution(data);
      state.solutions.unshift(newSolution);
      return newSolution;
    },

    updateSolution: async (id, updates) => {
      const client = initSupabase();
      if (!client) throw new Error("Supabase is not available.");

      const payload = buildSolutionPayload(updates);
      payload.edited_at = new Date().toISOString();

      const { data, error } = await client
        .from("solutions")
        .update(payload)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;

      const updated = mapRowToSolution(data);
      const index = state.solutions.findIndex(s => s.id == id);
      if (index !== -1) state.solutions[index] = updated;
      return updated;
    },

    deleteSolution: async (id) => {
      const client = initSupabase();
      if (!client) throw new Error("Supabase is not available.");

      const { error } = await client.from("solutions").delete().eq("id", id);
      if (error) throw error;

      state.solutions = state.solutions.filter(s => s.id != id);
    }
  };

  // --- AUTHENTICATION (real Supabase Auth, checked against users.is_admin —
  // the same flag the database's Row Level Security policies check) ---
  const Auth = {
    login: async (email, password) => {
      const client = initSupabase();
      if (!client) return { ok: false, message: "Supabase is not available." };

      const { data, error } = await client.auth.signInWithPassword({ email, password });
      if (error) {
        return { ok: false, message: error.message || "Invalid email or password" };
      }

      // Confirm this account is actually an admin (matches the DB's RLS check),
      // so a non-admin account gets a clear message instead of a later "permission denied".
      const { data: userRow, error: userError } = await client
        .from("users")
        .select("is_admin")
        .eq("id", data.user.id)
        .maybeSingle();

      if (userError || !userRow || !userRow.is_admin) {
        await client.auth.signOut();
        return { ok: false, message: "This account does not have admin access." };
      }

      state.currentUser = {
        email: data.user.email,
        name: data.user.email.split("@")[0]
      };
      return { ok: true };
    },

    logout: async () => {
      const client = initSupabase();
      if (client) await client.auth.signOut();
      state.currentUser = null;
      showAuthView();
    },

    checkSession: async () => {
      const client = initSupabase();
      if (!client) return false;

      const { data } = await client.auth.getSession();
      const session = data?.session;
      if (session?.user) {
        state.currentUser = {
          email: session.user.email,
          name: session.user.email.split("@")[0]
        };
        showDashboard();
        return true;
      }
      return false;
    }
  };

  // --- VIEW MANAGEMENT ---
  const showAuthView = () => {
    DOM.authView.style.display = "flex";
    DOM.dashboardView.style.display = "none";
  };

  const showDashboard = () => {
    DOM.authView.style.display = "none";
    DOM.dashboardView.style.display = "flex";
    updateAdminProfile();
    render();
  };

  const updateAdminProfile = () => {
    if (state.currentUser) {
      DOM.adminNameDisplay.textContent = state.currentUser.name || "Admin";
      DOM.profileAvatar.textContent = state.currentUser.name[0].toUpperCase();
    }
  };

  const switchView = (viewName) => {
    state.currentView = viewName;

    // Update nav items
    DOM.navItems.forEach(item => {
      item.classList.toggle("active", item.dataset.view === viewName);
    });

    // Show/hide view sections
    DOM.viewSections.forEach(section => {
      section.classList.toggle("active", section.id === `view-${viewName}`);
    });

    // Update title
    const titles = {
      dashboard: "Dashboard",
      "add-solution": "Add Solution",
      "all-solutions": "Manage Solutions",
      pending: "Pending Submissions",
      analytics: "Analytics"
    };
    DOM.viewTitle.textContent = titles[viewName] || "Dashboard";
    DOM.viewSubtitle.textContent = "";

    // Reset form when switching to add solution
    if (viewName === "add-solution") {
      DOM.addSolutionForm.reset();
    }

    render();
  };

  // --- RENDERING FUNCTIONS ---
  const render = () => {
    updateStats();
    renderRecentSolutions();
    renderSolutionsTable();
    renderAnalytics();
    renderPending();
  };

  const updateStats = () => {
    const published = state.solutions.filter(s => s.status === "Published");
    const totalViews = state.solutions.reduce((sum, s) => sum + (s.views || 0), 0);
    const totalHelpful = state.solutions.reduce((sum, s) => sum + (s.helpful || 0), 0);

    DOM.totalSolutions.textContent = state.solutions.length;
    DOM.totalViews.textContent = totalViews;
    DOM.totalHelpful.textContent = totalHelpful;
    DOM.pendingCount.textContent = state.pendingSubmissions.length;

    // Update pending badge
    if (state.pendingSubmissions.length > 0) {
      DOM.pendingBadge.style.display = "inline-block";
      DOM.pendingBadge.textContent = state.pendingSubmissions.length;
    } else {
      DOM.pendingBadge.style.display = "none";
    }
  };

  const renderRecentSolutions = () => {
    const recent = state.solutions
      .sort((a, b) => new Date(b.editedAt || b.createdAt) - new Date(a.editedAt || a.createdAt))
      .slice(0, 5);

    DOM.recentSolutions.innerHTML = recent.length > 0 
      ? recent.map(s => `
          <div class="recent-item">
            <div>
              <div style="font-weight: 600; margin-bottom: 2px;">${s.title}</div>
              <div style="font-size: 12px; color: var(--text-secondary);">
                ${s.category} • ${s.status}
              </div>
            </div>
          </div>
        `).join("")
      : '<div class="recent-item">No solutions yet</div>';
  };

  const renderSolutionsTable = () => {
    let filtered = state.solutions;

    if (DOM.solutionSearch.value) {
      const query = DOM.solutionSearch.value.toLowerCase();
      filtered = filtered.filter(s =>
        s.title.toLowerCase().includes(query) ||
        s.problem.toLowerCase().includes(query)
      );
    }

    if (DOM.filterCategory.value) {
      filtered = filtered.filter(s => s.category === DOM.filterCategory.value);
    }

    if (DOM.filterStatus.value) {
      filtered = filtered.filter(s => s.status === DOM.filterStatus.value);
    }

    const html = filtered.length > 0
      ? `
          <table>
            <thead>
              <tr>
                <th style="width: 30%;">Title</th>
                <th style="width: 15%;">Category</th>
                <th style="width: 12%;">Difficulty</th>
                <th style="width: 12%;">Status</th>
                <th style="width: 15%;">Updated</th>
                <th style="width: 16%;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${filtered.map(s => `
                <tr>
                  <td>
                    <div style="font-weight: 500;">${s.title}</div>
                    <div style="font-size: 12px; color: var(--text-secondary);">${s.problem.substring(0, 50)}...</div>
                  </td>
                  <td>${s.category}</td>
                  <td>
                    <div style="font-size: 12px; padding: 2px 6px; background: rgba(31, 115, 231, 0.1); display: inline-block; border-radius: 4px;">
                      ${s.difficulty}
                    </div>
                  </td>
                  <td>
                    <span class="status-badge status-${s.status.toLowerCase()}">
                      ${s.status}
                    </span>
                  </td>
                  <td>${Utils.formatDate(s.editedAt || s.createdAt)}</td>
                  <td>
                    <div class="table-actions">
                      <button class="action-btn edit" onclick="AdminApp.editSolution('${s.id}')">✏️ Edit</button>
                      <button class="action-btn delete" onclick="AdminApp.deleteSolution('${s.id}')">🗑️ Delete</button>
                    </div>
                  </td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        `
      : '<div style="padding: 40px; text-align: center; color: var(--text-secondary);">No solutions found</div>';

    DOM.solutionsTable.innerHTML = html;
  };

  const renderAnalytics = () => {
    // Most viewed
    const mostViewedList = [...state.solutions]
      .sort((a, b) => (b.views || 0) - (a.views || 0))
      .slice(0, 5);

    DOM.mostViewed.innerHTML = mostViewedList.map(s => `
      <div class="analytics-item">
        <span>${s.title}</span>
        <span class="analytics-value">${s.views || 0} views</span>
      </div>
    `).join("");

    // Most helpful
    const mostHelpfulList = [...state.solutions]
      .sort((a, b) => (b.helpful || 0) - (a.helpful || 0))
      .slice(0, 5);

    DOM.mostHelpful.innerHTML = mostHelpfulList.map(s => `
      <div class="analytics-item">
        <span>${s.title}</span>
        <span class="analytics-value">${s.helpful || 0} 👍</span>
      </div>
    `).join("");

    // Category stats
    const categoryStats = {};
    state.solutions.forEach(s => {
      categoryStats[s.category] = (categoryStats[s.category] || 0) + 1;
    });

    DOM.categoryStats.innerHTML = Object.entries(categoryStats)
      .sort((a, b) => b[1] - a[1])
      .map(([cat, count]) => `
        <div class="analytics-item">
          <span>${cat}</span>
          <span class="analytics-value">${count}</span>
        </div>
      `).join("");

    // Difficulty stats
    const difficultyStats = {};
    state.solutions.forEach(s => {
      difficultyStats[s.difficulty] = (difficultyStats[s.difficulty] || 0) + 1;
    });

    DOM.difficultyStats.innerHTML = Object.entries(difficultyStats)
      .sort((a, b) => b[1] - a[1])
      .map(([diff, count]) => `
        <div class="analytics-item">
          <span>${diff}</span>
          <span class="analytics-value">${count}</span>
        </div>
      `).join("");
  };

  const renderPending = () => {
    DOM.pendingList.innerHTML = state.pendingSubmissions.length > 0
      ? state.pendingSubmissions.map(s => `
          <div class="pending-card">
            <div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:8px;">
              ${s.category ? `<span class="status-badge status-published">${s.category}</span>` : ""}
              ${s.language ? `<span class="status-badge status-draft">${s.language}</span>` : ""}
            </div>
            <h3>${s.problem}</h3>
            ${s.suggested_solution ? `<p><strong>Suggested solution:</strong> ${s.suggested_solution}</p>` : `<p style="font-style:italic;">No suggested solution provided.</p>`}
            <p style="font-size:12px; color: var(--text-secondary); margin-top:8px;">
              Submitted ${Utils.formatDate(s.created_at)}
            </p>
            <div class="pending-actions">
              <button class="btn btn-primary" onclick="AdminApp.reviewSubmission('${s.id}')" style="padding: 8px 12px; font-size: 13px;">
                ✏️ Review & Publish
              </button>
              <button class="btn btn-secondary" onclick="AdminApp.rejectPending('${s.id}')" style="padding: 8px 12px; font-size: 13px;">
                ✕ Reject
              </button>
            </div>
          </div>
        `).join("")
      : '<div style="padding: 40px; text-align: center; color: var(--text-secondary);">No pending submissions</div>';
  };

  // --- EVENT HANDLERS ---
  const bindEvents = () => {
    // Login
    DOM.loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = document.getElementById("adminEmail").value;
      const password = document.getElementById("adminPassword").value;

      DOM.authError.style.display = "none";

      const result = await Auth.login(email, password);
      if (result.ok) {
        await Promise.all([DataManager.load(), DataManager.loadPendingSubmissions()]);
        showDashboard();
        DOM.loginForm.reset();
      } else {
        DOM.authError.style.display = "block";
        DOM.authError.textContent = result.message || "Invalid email or password";
      }
    });

    // Logout
    DOM.logoutBtn.addEventListener("click", async () => {
      await Auth.logout();
    });

    // Navigation
    DOM.navItems.forEach(item => {
      item.addEventListener("click", () => {
        switchView(item.dataset.view);
      });
    });

    // Cancel a submission review (revert Add Solution form to a normal blank form)
    const cancelReviewBtn = document.getElementById("cancelReviewBtn");
    if (cancelReviewBtn) {
      cancelReviewBtn.addEventListener("click", () => cancelReview());
    }

    // Add solution form
    DOM.addSolutionForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const newSolution = {
        title: document.getElementById("solutionTitle").value,
        category: document.getElementById("solutionCategory").value,
        type: document.getElementById("solutionType").value,
        language: document.getElementById("solutionLanguage").value,
        difficulty: document.getElementById("solutionDifficulty").value,
        status: "Published",
        problem: document.getElementById("solutionProblem").value,
        content: document.getElementById("solutionContent").value,
        keywords: document.getElementById("solutionKeywords").value.split(",").map(k => k.trim()),
        notes: document.getElementById("solutionNotes").value,
        views: 0,
        helpful: 0,
        unhelpful: 0
      };

      const reviewingId = document.getElementById("reviewingSubmissionId").value;

      try {
        await DataManager.addSolution(newSolution);
        if (reviewingId) {
          await DataManager.approveSubmission(reviewingId);
          const banner = document.getElementById("reviewBanner");
          if (banner) banner.style.display = "none";
        }
        Notify.show("✓ Solution published successfully!");
        DOM.addSolutionForm.reset();
        switchView("all-solutions");
      } catch (error) {
        console.error("Failed to publish solution:", error);
        Notify.show("✕ Failed to publish: " + (error.message || "unknown error"), "error");
      }
    });

    // Save as draft
    DOM.saveDraftBtn.addEventListener("click", async () => {
      const solution = {
        title: document.getElementById("solutionTitle").value || "Untitled",
        category: document.getElementById("solutionCategory").value || "Study",
        type: document.getElementById("solutionType").value,
        language: document.getElementById("solutionLanguage").value,
        difficulty: document.getElementById("solutionDifficulty").value || "Beginner",
        status: "Draft",
        problem: document.getElementById("solutionProblem").value,
        content: document.getElementById("solutionContent").value,
        keywords: document.getElementById("solutionKeywords").value.split(",").map(k => k.trim()),
        notes: document.getElementById("solutionNotes").value,
        views: 0,
        helpful: 0,
        unhelpful: 0
      };

      try {
        await DataManager.addSolution(solution);
        Notify.show("✓ Saved as draft");
        DOM.addSolutionForm.reset();
        const banner = document.getElementById("reviewBanner");
        if (banner) banner.style.display = "none";
        render();
      } catch (error) {
        console.error("Failed to save draft:", error);
        Notify.show("✕ Failed to save draft: " + (error.message || "unknown error"), "error");
      }
    });

    // Search and filters
    DOM.solutionSearch.addEventListener("input", Utils.debounce(() => renderSolutionsTable(), 300));
    DOM.filterCategory.addEventListener("change", () => renderSolutionsTable());
    DOM.filterStatus.addEventListener("change", () => renderSolutionsTable());

    // Edit modal
    DOM.closeEditModal.addEventListener("click", () => closeEditModal());
    DOM.cancelEditBtn.addEventListener("click", () => closeEditModal());

    DOM.editForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const id = document.getElementById("editSolutionId").value;
      try {
        await DataManager.updateSolution(id, {
          title: document.getElementById("editTitle").value,
          category: document.getElementById("editCategory").value,
          difficulty: document.getElementById("editDifficulty").value,
          problem: document.getElementById("editProblem").value,
          content: document.getElementById("editContent").value,
          status: document.getElementById("editStatus").value
        });
        Notify.show("✓ Solution updated");
        closeEditModal();
        render();
      } catch (error) {
        console.error("Failed to update solution:", error);
        Notify.show("✕ Failed to update: " + (error.message || "unknown error"), "error");
      }
    });

    // Theme toggle
    DOM.themeBtn.addEventListener("click", () => {
      const isDark = document.documentElement.getAttribute("data-theme") === "dark";
      const theme = isDark ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", theme);
      localStorage.setItem("solvexa_admin_theme", theme);
      DOM.themeBtn.textContent = theme === "dark" ? "☀️" : "🌙";
    });
  };

  // --- PUBLIC METHODS ---
  const editSolution = (id) => {
    const solution = state.solutions.find(s => s.id == id);
    if (!solution) return;

    document.getElementById("editSolutionId").value = id;
    document.getElementById("editTitle").value = solution.title;
    document.getElementById("editCategory").value = solution.category;
    document.getElementById("editDifficulty").value = solution.difficulty;
    document.getElementById("editProblem").value = solution.problem;
    document.getElementById("editContent").value = solution.content;
    document.getElementById("editStatus").value = solution.status;

    DOM.editModal.style.display = "flex";
  };

  const closeEditModal = () => {
    DOM.editModal.style.display = "none";
  };

  const deleteSolution = async (id) => {
    if (confirm("Are you sure you want to delete this solution?")) {
      try {
        await DataManager.deleteSolution(id);
        Notify.show("✓ Solution deleted");
        render();
      } catch (error) {
        console.error("Failed to delete solution:", error);
        Notify.show("✕ Failed to delete: " + (error.message || "unknown error"), "error");
      }
    }
  };

  const reviewSubmission = (id) => {
    // id comes from an onclick string attribute, so match loosely (string vs number).
    const submission = state.pendingSubmissions.find(s => String(s.id) === String(id));
    if (!submission) return;

    switchView("add-solution");
    DOM.addSolutionForm.reset();

    document.getElementById("reviewingSubmissionId").value = submission.id;
    document.getElementById("solutionProblem").value = submission.problem || "";
    document.getElementById("solutionContent").value = submission.suggested_solution || "";
    if (submission.category) document.getElementById("solutionCategory").value = submission.category;
    if (submission.language) document.getElementById("solutionLanguage").value = submission.language;

    const banner = document.getElementById("reviewBanner");
    if (banner) banner.style.display = "block";

    Notify.show("Fill in the remaining details, then publish or save as draft.");
  };

  const cancelReview = () => {
    document.getElementById("reviewingSubmissionId").value = "";
    const banner = document.getElementById("reviewBanner");
    if (banner) banner.style.display = "none";
    DOM.addSolutionForm.reset();
  };

  const rejectPending = async (id) => {
    const submission = state.pendingSubmissions.find(s => String(s.id) === String(id));
    if (!submission) return;

    if (!confirm("Reject this submission?")) return;
    const note = prompt("Optional note (why it was rejected):", "") || "";

    try {
      await DataManager.rejectSubmission(submission.id, note);
      Notify.show("✓ Submission rejected");
      render();
    } catch (error) {
      console.error("Failed to reject submission:", error);
      Notify.show("✕ Failed to reject: " + (error.message || "unknown error"), "error");
    }
  };

  // --- INITIALIZATION ---
  return {
    init: async () => {
      // Load theme
      const savedTheme = localStorage.getItem("solvexa_admin_theme") || "light";
      document.documentElement.setAttribute("data-theme", savedTheme);
      DOM.themeBtn.textContent = savedTheme === "dark" ? "☀️" : "🌙";

      bindEvents();

      // Check existing session
      if (!(await Auth.checkSession())) {
        showAuthView();
      } else {
        await Promise.all([DataManager.load(), DataManager.loadPendingSubmissions()]);
        render();
      }
    },

    // Public methods for inline calls
    editSolution,
    deleteSolution,
    reviewSubmission,
    rejectPending,
    closeEditModal
  };
})();

// Initialize app
document.addEventListener("DOMContentLoaded", AdminApp.init);
