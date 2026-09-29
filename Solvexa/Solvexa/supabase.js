/**
 * Solvexa - Supabase Connection
 * One shared client, lazily created, reused by every data module.
 * Plain script (no ES modules) so it works from any host, any way it's opened.
 * Requires the Supabase UMD script (window.supabase) to load before this file.
 */

(function () {
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

  window.Solvexa = window.Solvexa || {};
  window.Solvexa.initSupabase = initSupabase;
})();
