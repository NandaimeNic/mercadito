// =============================
// CONFIG
// =============================
const SUPABASE_URL = "https://pwcmwmmerrclkjzgnjgt.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3Y213bW1lcnJjbGtqemduamd0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3MTI0MDgsImV4cCI6MjA5MjI4ODQwOH0.OV-D2p2RmSBxk2td-PkZtellr9bTCfhcpa5ZERayEeo";

let supabase;
let currentUser = null;
let currentProfile = { role: "user" };

// =============================
// INIT
// =============================
async function init() {
  console.log("INIT");

  if (!window.supabase) {
    alert("Supabase no cargó");
    return;
  }

  supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

  supabase.auth.onAuthStateChange(async (event, session) => {
    console.log("AUTH:", event);

    currentUser = session?.user || null;

    if (currentUser) {
      await loadProfile();
      await afterLogin();
    }

    loadListings();
  });

  await restoreSession();
  await handlePaymentReturn();
  await loadListings();
}

window.addEventListener("DOMContentLoaded", init);

// =============================
// SESSION
// =============================
async function restoreSession() {
  const { data } = await supabase.auth.getSession();
  currentUser = data?.session?.user || null;

  if (currentUser) {
    await loadProfile();
  }
}

// =============================
// PROFILE (SAFE)
// =============================
async function loadProfile() {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", currentUser.id)
      .single();

    if (error) throw error;

    currentProfile = data || { role: "user" };
  } catch {
    currentProfile = { role: "user" };
  }
}

function isAdmin() {
  return currentProfile?.role === "admin";
}

// =============================
// AUTH
// =============================
async function loginFromUI() {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) return alert(error.message);

  closeAuthModal();
}

async function signupFromUI() {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  const { error } = await supabase.auth.signUp({ email, password });

  if (error) return alert(error.message);

  alert("Cuenta creada");
}

async function logout() {
  await supabase.auth.signOut();
  currentUser = null;
  currentProfile = { role: "user" };
  loadListings();
}

// =============================
// UI
// =============================
function toggleAuthUI() {
  const m = document.getElementById("authModal");
  m.style.display = m.style.display === "flex" ? "none" : "flex";
}

function closeAuthModal() {
  document.getElementById("authModal").style.display = "none";
}

function toggleForm() {
  const box = document.getElementById("formBox");
  box.style.display = box.style.display === "block" ? "none" : "block";
}

// =============================
// STORAGE STATE
// =============================
function savePendingListing(data) {
  localStorage.setItem("pendingListing", JSON.stringify(data));
}

function loadPendingListing() {
  const d = localStorage.getItem("pendingListing");
  return d ? JSON.parse(d) : null;
}

function clearPendingListing() {
  localStorage.removeItem("pendingListing");
}

// =============================
// IMAGE UPLOAD
// =============================
async function uploadImage(file) {
  if (!file) return "";

  const name = Date.now() + "-" + file.name;

  const { error } = await supabase.storage
    .from("listings")
    .upload(name, file);

  if (error) {
    console.error("UPLOAD ERROR:", error);
    return "";
  }

  const { data } = supabase.storage
    .from("listings")
    .getPublicUrl(name);

  return data.publicUrl;
}

// =============================
// ENTRY POINT
// =============================
async function startPost() {
  const file = document.getElementById("imageInput").files[0];
  const image = await uploadImage(file);

  const listing = {
    title: document.getElementById("title").value.trim(),
    price: document.getElementById("price").value.trim(),
    category: document.getElementById("category").value,
    description: document.getElementById("desc").value.trim(),
    phone: document.getElementById("phone").value.trim(),
    image_url: image
  };

  if (!listing.title || !listing.phone) {
    alert("Falta información");
    return;
  }

  await handlePost(listing);
}

// =============================
// CORE LOGIC
// =============================
async function handlePost(data) {
  if (!currentUser) {
    savePendingListing(data);
    toggleAuthUI();
    return;
  }

  if (isAdmin()) {
    await insertListing(data);
    clearPendingListing();
    alert("Publicado");
    return;
  }

  savePendingListing(data);

  window.location.href =
    "https://checkout.revolut.com/pay/d551a8af-84fb-4f33-8f53-73160994575e";
}

// =============================
// AFTER LOGIN
// =============================
async function afterLogin() {
  const pending = loadPendingListing();
  if (pending) await handlePost(pending);
}

// =============================
// AFTER PAYMENT
// =============================
async function handlePaymentReturn() {
  const params = new URLSearchParams(window.location.search);

  if (params.get("paid") !== "true") return;

  const pending = loadPendingListing();

  if (!pending || !currentUser) return;

  await insertListing(pending);
  clearPendingListing();

  alert("Publicado");

  window.history.replaceState({}, document.title, "/");
}

// =============================
// INSERT
// =============================
async function insertListing(data) {
  const { error } = await supabase
    .from("listings")
    .insert([{
      ...data,
      user_id: currentUser.id,
      is_active: true
    }]);

  if (error) {
    console.error("INSERT ERROR:", error);
    alert("Error al publicar");
  } else {
    loadListings();
  }
}

// =============================
// DELETE
// =============================
async function deleteListing(id) {
  const { error } = await supabase
    .from("listings")
    .delete()
    .eq("id", id);

  if (error) alert("Error");
  else loadListings();
}

// =============================
// LOAD LISTINGS
// =============================
async function loadListings() {
  const el = document.getElementById("listings");

  const { data, error } = await supabase
    .from("listings")
    .select("*")
    .order("id", { ascending: false });

  if (error) {
    console.error(error);
    el.innerHTML = "Error cargando";
    return;
  }

  el.innerHTML = "";

  if (!data.length) {
    el.innerHTML = "No hay anuncios";
    return;
  }

  data.forEach(item => {
    const owner = currentUser && item.user_id === currentUser.id;

    const div = document.createElement("div");

    div.innerHTML = `
      ${item.image_url ? `<img src="${item.image_url}" style="width:100%">` : ""}
      <h3>${item.title}</h3>
      <p>${item.price}</p>
      <a href="https://wa.me/${item.phone}" target="_blank">WhatsApp</a>
      ${owner ? `<button onclick="deleteListing('${item.id}')">Eliminar</button>` : ""}
    `;

    el.appendChild(div);
  });
}

// =============================
// GLOBAL BINDINGS
// =============================
window.toggleAuthUI = toggleAuthUI;
window.loginFromUI = loginFromUI;
window.signupFromUI = signupFromUI;
window.logout = logout;
window.toggleForm = toggleForm;
window.startPost = startPost;
window.deleteListing = deleteListing;