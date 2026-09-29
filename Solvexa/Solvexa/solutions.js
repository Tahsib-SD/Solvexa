/**
 * Solvexa - Solutions API
 * All direct database reads/writes for solutions and user submissions.
 * Pure data layer: no DOM, no rendering, no app state - just Supabase in, data out.
 * Plain script (no ES modules) - depends on supabase.js having loaded first.
 */

(function () {
  const initSupabase = window.Solvexa.initSupabase;

  // Fetch every Published solution, mapped to the shape the UI expects.
  const fetchPublishedSolutions = async () => {
    const client = initSupabase();
    if (!client) {
      throw new Error("Supabase could not be loaded. Please refresh the page.");
    }

    const { data, error } = await client
      .from("solutions")
      .select("*")
      .eq("status", "Published")
      .order("created_at", { ascending: false });

    if (error) throw error;

    return (data || []).map(s => ({
      ...s,
      type: s.type || "How-To",
      language: s.language || "English",
      difficulty: s.difficulty || "Beginner",
      keywords: Array.isArray(s.keywords) ? s.keywords : [],
      views: Number(s.views) || 0,
      helpful: Number(s.helpful) || 0,
      unhelpful: Number(s.unhelpful) || 0,
      // The database uses created_at; the frontend expects date.
      date: s.date || s.created_at
    }));
  };

  // Submit a reader's "Suggest a Solution" entry as a Pending user_submissions row.
  const submitSuggestion = async ({ problem, suggestedSolution, category, language }) => {
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
  };

  window.Solvexa = window.Solvexa || {};
  window.Solvexa.fetchPublishedSolutions = fetchPublishedSolutions;
  window.Solvexa.submitSuggestion = submitSuggestion;
})();
