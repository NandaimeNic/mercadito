// ===== CONFIG =====
const SUPABASE_URL = "YOUR_SUPABASE_URL";
const SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_KEY";

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ===== STATE =====
let currentUser = null;
let currentProfile = null;

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
  const { error } = await supabase.auth.signUp({ email, password });
  if (error) return console.error("Signup error:", error.message);
}

async function login(email, password) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return console.error("Login error:", error.message);
}

async function logout() {
  const { error } = await supabase.auth.signOut();
  if (error) console.error("Logout error:", error.message);
  currentUser = null;
  currentProfile = null;
}

// ===== SESSION RESTORE =====
async function restoreSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) return console.error("Session error:", error.message);

  if (data.session) {
    currentUser = data.session.user;
    await loadProfile();
  }
}

// ===== PROFILE =====
async function loadProfile() {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", currentUser.id)
    .single();

  if (error) return console.error("Profile error:", error.message);

  currentProfile = data;
}

// ===== IMAGE UPLOAD =====
async function uploadImage(file) {
  try {
    const filePath = `${Date.now()}-${file.name}`;

    const { error } = await supabase.storage
      .from("listings")
      .upload(filePath, file);

    if (error) throw error;

    const { data } = supabase.storage
      .from("listings")
      .getPublicUrl(filePath);

    return data.publicUrl;
  } catch (err) {
    console.error("Upload failed:", err.message);
    return null; // SAFE FAIL
  }
}

// ===== INSERT LISTING =====
async function insertListing(listing) {
  const { error } = await supabase.from("listings").insert([listing]);
  if (error) {
    console.error("Insert failed:", error.message);
    return false;
  }
  return true;
}

// ===== PAYMENT REDIRECT =====
function goToPayment() {
  window.location.href = "/?paid=true";
}

// ===== HANDLE POST FLOW =====
async function handlePublish(form) {
  const file = form.image.files[0];

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

  savePendingListing(listing);

  if (!currentUser) {
    openAuthModal();
    return;
  }

  if (currentProfile.role === "admin") {
    listing.user_id = currentUser.id;
    await insertListing(listing);
    clearPendingListing();
    loadListings();
    return;
  }

  goToPayment();
}

// ===== AFTER LOGIN RESUME =====
async function resumeAfterLogin() {
  const pending = loadPendingListing();
  if (!pending) return;

  if (currentProfile.role === "admin") {
    pending.user_id = currentUser.id;
    await insertListing(pending);
    clearPendingListing();
    loadListings();
  } else {
    goToPayment();
  }
}

// ===== AFTER PAYMENT =====
async function handlePaymentReturn() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("paid") !== "true") return;

  const pending = loadPendingListing();
  if (!pending || !currentUser) return;

  pending.user_id = currentUser.id;

  const success = await insertListing(pending);
  if (success) {
    clearPendingListing();
    loadListings();
  }
}

// ===== LOAD LISTINGS =====
async function loadListings() {
  const { data, error } = await supabase
    .from("listings")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) return console.error("Load listings error:", error.message);

  const container = document.getElementById("listings");
  container.innerHTML = "";

  data.forEach(item => {
    const el = document.createElement("div");
    el.innerHTML = `
      <h3>${item.title}</h3>
      <p>${item.price}</p>
      <img src="${item.image_url || ""}" width="100"/>
    `;
    container.appendChild(el);
  });
}

// ===== AUTH MODAL =====
function openAuthModal() {
  document.getElementById("authModal").style.display = "block";
}

// ===== INIT =====
window.addEventListener("DOMContentLoaded", async () => {
  await restoreSession();

  if (currentUser) {
    await resumeAfterLogin();
  }

  await handlePaymentReturn();
  await loadListings();
});