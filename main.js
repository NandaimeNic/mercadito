// ===== CONFIG =====
const SUPABASE_URL = "https://ddfvxfaqbuybiwnfejwh.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_sq748d9a6577RhRgjMjyew_IYFrxhve";

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ===== STATE =====
let currentUser = null;
let currentProfile = null;
let isSubmitting = false;

// ===== LOCAL STORAGE =====
function savePendingListing(data) {
  localStorage.setItem("pendingListing", JSON.stringify(data));
}

function loadPendingListing() {
  const data = localStorage.getItem("pendingListing");
  return data ? JSON.parse(data) : null;
}

function clearPendingListing() {
  localStorage.removeItem("pendingListing");
}

// ===== AUTH =====
async function signUp(email, password) {
  console.log("SIGNUP ATTEMPT");

  const { error } = await supabase.auth.signUp({ email, password });

  if (error) {
    console.error("Signup error:", error.message);
    return;
  }

  console.log("Signup success");
}

async function login(email, password) {
  console.log("LOGIN ATTEMPT");

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    console.error("Login error:", error.message);
    return;
  }

  console.log("Login success");

  // refresh session immediately after login
  await restoreSession();
  await resumeAfterLogin();
}

async function logout() {
  const { error } = await supabase.auth.signOut();
  if (error) console.error("Logout error:", error.message);

  currentUser = null;
  currentProfile = null;
}

// ===== SESSION RESTORE =====
async function restoreSession() {
  console.log("RESTORING SESSION");

  const { data, error } = await supabase.auth.getSession();

  if (error) {
    console.error("Session error:", error.message);
    return;
  }

  if (data.session) {
    currentUser = data.session.user;
    console.log("USER RESTORED:", currentUser.id);
    await loadProfile();
  } else {
    console.log("NO ACTIVE SESSION");
  }
}

// ===== PROFILE =====
async function loadProfile() {
  if (!currentUser) return;

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", currentUser.id)
    .single();

  if (error) {
    console.error("Profile error:", error.message);
    return;
  }

  currentProfile = data;
  console.log("PROFILE LOADED:", currentProfile);
}

// ===== IMAGE UPLOAD =====
async function uploadImage(file) {
  try {
    console.log("UPLOADING IMAGE");

    const filePath = `${Date.now()}-${file.name}`;

    const { error } = await supabase.storage
      .from("listings")
      .upload(filePath, file);

    if (error) throw error;

    const { data } = supabase.storage
      .from("listings")
      .getPublicUrl(filePath);

    console.log("IMAGE UPLOADED");

    return data.publicUrl;
  } catch (err) {
    console.error("Upload failed:", err.message);
    return null;
  }
}

// ===== INSERT LISTING =====
async function insertListing(listing) {
  console.log("INSERTING LISTING");

  const { error } = await supabase.from("listings").insert([listing]);

  if (error) {
    console.error("Insert failed:", error.message);
    return false;
  }

  console.log("INSERT SUCCESS");
  return true;
}

// ===== PAYMENT REDIRECT =====
function goToPayment() {
  console.log("REDIRECTING TO PAYMENT");
  window.location.href = "/?paid=true";
}

// ===== HANDLE POST FLOW =====
async function handlePublish(form) {
  console.log("PUBLISH CLICKED");

  if (isSubmitting) {
    console.warn("Already submitting");
    return;
  }

  isSubmitting = true;

  try {
    const file = form.image?.files?.[0];
    let imageUrl = null;

    if (file) {
      imageUrl = await uploadImage(file);
    }

    const listing = {
      user_id: currentUser?.id || null,
      title: form.title.value,
      price: form.price.value,
      category: form.category.value,
      description: form.description.value,
      phone: form.phone.value,
      image_url: imageUrl,
      is_active: true
    };

    console.log("LISTING PREPARED:", listing);

    // Save first (critical for recovery)
    savePendingListing(listing);

    // AUTH GUARD
    if (!currentUser) {
      console.log("NO USER → OPEN MODAL");
      openAuthModal();
      return;
    }

    // ADMIN BYPASS
    if (currentProfile?.role === "admin") {
      listing.user_id = currentUser.id;

      const success = await insertListing(listing);

      if (success) {
        clearPendingListing();
        await loadListings();
      }

      return;
    }

    // NORMAL USER
    goToPayment();

  } catch (err) {
    console.error("Publish error:", err);
  } finally {
    isSubmitting = false;
  }
}

// ===== AFTER LOGIN RESUME =====
async function resumeAfterLogin() {
  console.log("RESUME AFTER LOGIN");

  const pending = loadPendingListing();
  if (!pending) return;

  if (!currentUser) return;

  if (currentProfile?.role === "admin") {
    pending.user_id = currentUser.id;

    const success = await insertListing(pending);

    if (success) {
      clearPendingListing();
      await loadListings();
    }
  } else {
    goToPayment();
  }
}

// ===== AFTER PAYMENT =====
async function handlePaymentReturn() {
  const params = new URLSearchParams(window.location.search);

  if (params.get("paid") !== "true") return;

  console.log("PAYMENT RETURN DETECTED");

  const pending = loadPendingListing();

  if (!pending || !currentUser) {
    console.warn("Missing pending or user");
    return;
  }

  pending.user_id = currentUser.id;

  const success = await insertListing(pending);

  if (success) {
    clearPendingListing();
    await loadListings();
  }
}

// ===== LOAD LISTINGS =====
async function loadListings() {
  console.log("LOADING LISTINGS");

  const { data, error } = await supabase
    .from("listings")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Load listings error:", error.message);
    return;
  }

  const container = document.getElementById("listings");
  if (!container) return;

  container.innerHTML = "";

  data.forEach(item => {
    const el = document.createElement("div");
    el.className = "card";

    el.innerHTML = `
      <h3>${item.title}</h3>
      <p>${item.price}</p>
      ${item.image_url ? `<img src="${item.image_url}" />` : ""}
    `;

    container.appendChild(el);
  });
}

// ===== AUTH MODAL =====
function openAuthModal() {
  const modal = document.getElementById("authModal");

  if (!modal) {
    console.error("Auth modal missing");
    return;
  }

  modal.style.display = "block";
}

// ===== INIT =====
window.addEventListener("DOMContentLoaded", async () => {
  console.log("APP INIT");

  await restoreSession();

  if (currentUser) {
    await resumeAfterLogin();
  }

  await handlePaymentReturn();
  await loadListings();
});