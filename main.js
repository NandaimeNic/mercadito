// =============================
// SUPABASE CONFIG
// =============================
const SUPABASE_URL = "https://pwcmwmmerrclkjzgnjgt.supabase.co";
const SUPABASE_KEY = "YOUR_KEY_HERE";

let supabase;
let currentUser = null;
let currentProfile = null;

// =============================
// INIT
// =============================
async function init() {

  if (!window.supabase) {
    alert("Error cargando sistema");
    return;
  }

  supabase = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
  );

  // Auth state listener
  supabase.auth.onAuthStateChange(async (event, session) => {
    currentUser = session?.user || null;

    if (currentUser) {
      await loadProfile();
      await afterLogin();
    }
  });

  await restoreSession();
  await handlePaymentReturn();
  loadListings();
}

window.addEventListener("DOMContentLoaded", init);

// =============================
// SESSION
// =============================
async function restoreSession() {
  const { data: { session } } = await supabase.auth.getSession();

  currentUser = session?.user || null;

  if (currentUser) {
    await loadProfile();
  }
}

// =============================
// PROFILE
// =============================
async function loadProfile() {

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", currentUser.id)
    .single();

  if (error) {
    console.error("Profile error:", error);
    currentProfile = { role: "user" };
    return;
  }

  currentProfile = data;
}

function isAdmin() {
  return currentProfile?.role === "admin";
}

// =============================
// AUTH
// =============================
async function signupFromUI() {

  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  const { error } = await supabase.auth.signUp({
    email,
    password
  });

  if (error) return alert(error.message);

  alert("Cuenta creada. Inicia sesión.");
}

async function loginFromUI() {

  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) return alert(error.message);

  closeAuthModal();
}

async function logout() {
  await supabase.auth.signOut();
  currentUser = null;
  currentProfile = null;
}

// =============================
// AUTH UI
// =============================
function openAuthModal() {
  document.getElementById("authModal").style.display = "flex";
}

function closeAuthModal() {
  document.getElementById("authModal").style.display = "none";
}

// =============================
// PENDING LISTING STATE
// =============================
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

// =============================
// IMAGE UPLOAD
// =============================
async function uploadImage(file) {

  if (!file) return "";

  const fileExt = file.name.split(".").pop();
  const fileName = `${Date.now()}-${Math.random()}.${fileExt}`;

  const { error } = await supabase
    .storage
    .from("listings")
    .upload(fileName, file);

  if (error) {
    console.error(error);
    alert("Error subiendo imagen");
    return "";
  }

  const { data } = supabase
    .storage
    .from("listings")
    .getPublicUrl(fileName);

  return data.publicUrl;
}

// =============================
// CREATE LISTING ENTRY POINT
// =============================
async function startPostFlow() {

  const file = document.getElementById("imageInput").files[0];
  const imageUrl = await uploadImage(file);

  const listing = {
    title: document.getElementById("title").value.trim(),
    price: document.getElementById("price").value.trim(),
    category: document.getElementById("category").value,
    description: document.getElementById("desc").value.trim(),
    phone: document.getElementById("phone").value.trim(),
    image_url: imageUrl
  };

  if (!listing.title || !listing.phone) {
    alert("Falta información");
    return;
  }

  await handlePost(listing);
}

// =============================
// CORE POST LOGIC
// =============================
async function handlePost(listingData) {

  if (!currentUser) {
    savePendingListing(listingData);
    openAuthModal();
    return;
  }

  if (isAdmin()) {
    await insertListing(listingData);
    clearPendingListing();
    alert("Publicado (admin)");
    return;
  }

  // NORMAL USER → PAYMENT
  savePendingListing(listingData);
  startPaymentFlow();
}

// =============================
// PAYMENT
// =============================
function startPaymentFlow() {
  window.location.href =
    "https://checkout.revolut.com/pay/d551a8af-84fb-4f33-8f53-73160994575e";
}

// =============================
// AFTER LOGIN
// =============================
async function afterLogin() {

  const pending = loadPendingListing();

  if (!pending) return;

  await handlePost(pending);
}

// =============================
// AFTER PAYMENT
// =============================
async function handlePaymentReturn() {

  const params = new URLSearchParams(window.location.search);

  if (params.get("paid") !== "true") return;

  const pending = loadPendingListing();

  if (!pending) return;

  if (!currentUser) {
    openAuthModal();
    return;
  }

  await insertListing(pending);

  clearPendingListing();

  alert("Publicado correctamente");

  window.history.replaceState({}, document.title, "/");
}

// =============================
// INSERT LISTING
// =============================
async function insertListing(data) {

  const expires =
    data.category === "comida"
      ? null
      : new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();

  const { error } = await supabase
    .from("listings")
    .insert([{
      ...data,
      user_id: currentUser.id,
      is_active: true,
      expires_at: expires
    }]);

  if (error) {
    console.error(error);
    alert("Error al publicar");
  }
}

// =============================
// DELETE
// =============================
async function deleteListing(id) {

  if (!confirm("¿Eliminar anuncio?")) return;

  const { error } = await supabase
    .from("listings")
    .delete()
    .eq("id", id);

  if (error) {
    console.error(error);
    alert("Error");
    return;
  }

  loadListings();
}

// =============================
// LISTINGS UI
// =============================
function timeAgo(dateString) {

  if (!dateString) return "";

  const diff = Math.floor((new Date() - new Date(dateString)) / 1000);
  const hours = Math.floor(diff / 3600);

  if (hours < 1) return "Hace minutos";
  if (hours < 24) return `Hace ${hours}h`;

  const days = Math.floor(hours / 24);
  return `Hace ${days}d`;
}

async function loadListings() {

  const container = document.getElementById("listings");

  const { data, error } = await supabase
    .from("listings")
    .select("*")
    .order("id", { ascending: false });

  if (error) {
    console.error(error);
    container.innerHTML = "Error cargando";
    return;
  }

  container.innerHTML = "";

  if (!data.length) {
    container.innerHTML = "<p>No hay anuncios</p>";
    return;
  }

  data.forEach(item => {

    const isOwner = currentUser && item.user_id === currentUser.id;

    const div = document.createElement("div");

    div.innerHTML = `
      ${item.image_url ? `<img src="${item.image_url}" style="width:100%">` : ""}
      <h3>${item.title}</h3>
      <p>${item.price}</p>
      <p>${timeAgo(item.created_at)}</p>

      <a href="https://wa.me/${item.phone}" target="_blank">WhatsApp</a>

      ${isOwner ? `<button onclick="deleteListing('${item.id}')">Eliminar</button>` : ""}
    `;

    container.appendChild(div);
  });
}