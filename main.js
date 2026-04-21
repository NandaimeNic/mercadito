// --- Supabase config ---
const SUPABASE_URL = "https://pwcmwmmerrclkjzgnjgt.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3Y213bW1lcnJjbGtqemduamd0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3MTI0MDgsImV4cCI6MjA5MjI4ODQwOH0.OV-D2p2RmSBxk2td-PkZtellr9bTCfhcpa5ZERayEeo";

let supabaseClient;
let currentUser = null;

// --- INIT ---
async function init(){

  if (!window.supabase) {
    alert("Error cargando sistema");
    return;
  }

  supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
  );

  // Restore session
  supabaseClient.auth.onAuthStateChange((event, session) => {
    currentUser = session?.user || null;
    console.log("Auth state:", event, currentUser?.id);
  });

  await loadUser();
  await resumePendingAd();
  await checkPaymentReturn();

  loadListings();
}

window.addEventListener("DOMContentLoaded", init);

// --- USER ---
async function loadUser(){
  try {
    const { data: { session } } = await supabaseClient.auth.getSession();
    currentUser = session?.user || null;
  } catch (err) {
    console.error("Auth error:", err);
  }
}

// --- AUTH SYSTEM ---
async function signUp(email, password){

  const { error } = await supabaseClient.auth.signUp({
    email,
    password
  });

  if(error){
    alert(error.message);
    return;
  }

  alert("Cuenta creada. Ahora inicia sesión.");
}

async function login(email, password){

  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email,
    password
  });

  if(error){
    alert(error.message);
    return;
  }

  currentUser = data.user;

  alert("Sesión iniciada");

  toggleAuthUI(); // close modal

  await resumePendingAd();

  loadListings();
}

async function logout(){
  await supabaseClient.auth.signOut();
  currentUser = null;
  alert("Sesión cerrada");
}

// --- AUTH UI ---
function toggleAuthUI(){
  const modal = document.getElementById("authModal");
  modal.style.display =
    modal.style.display === "flex" ? "none" : "flex";
}

function loginFromUI(){
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  login(email, password);
}

function signupFromUI(){
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  signUp(email, password);
}

// --- REQUIRE AUTH ---
async function requireAuth(){

  await loadUser();

  if(currentUser){
    return true;
  }

  toggleAuthUI();
  return false;
}

// --- ADMIN CHECK ---
async function isAdmin(){

  if(!currentUser) return false;

  const { data, error } = await supabaseClient
    .from('profiles')
    .select('role')
    .eq('id', currentUser.id)
    .single();

  if(error){
    console.error(error);
    return false;
  }

  return data?.role === 'admin';
}

// --- Toggle form ---
function toggleForm(){
  const box = document.getElementById("formBox");
  box.style.display =
    box.style.display === "block" ? "none" : "block";
}

// --- IMAGE UPLOAD ---
async function uploadImage(file){

  if(!file) return "";

  const fileExt = file.name.split('.').pop();
  const fileName = `${Date.now()}-${Math.floor(Math.random()*10000)}.${fileExt}`;

  const { error } = await supabaseClient
    .storage
    .from("listings")
    .upload(fileName, file);

  if(error){
    alert("Error subiendo imagen");
    console.error(error);
    return "";
  }

  const { data } = supabaseClient
    .storage
    .from("listings")
    .getPublicUrl(fileName);

  return data.publicUrl;
}

// --- CREATE LISTING (ADMIN DIRECT) ---
async function createListingDirect(ad){

  const { error } = await supabaseClient
    .from('listings')
    .insert([{
      ...ad,
      user_id: currentUser.id,
      is_active: true
    }]);

  if(error){
    alert(error.message);
    console.error(error);
    return;
  }

  localStorage.removeItem("pendingAd");

  alert("Publicado");

  loadListings();
}

// --- START POST FLOW ---
async function startPayment(){

  const isAuth = await requireAuth();
  if(!isAuth) return;

  const file = document.getElementById("imageInput").files[0];
  const imageUrl = await uploadImage(file);

  const pendingAd = {
    title: document.getElementById("title").value.trim(),
    price: document.getElementById("price").value.trim(),
    category: document.getElementById("category").value,
    description: document.getElementById("desc").value.trim(),
    phone: document.getElementById("phone").value.trim(),
    image_url: imageUrl
  };

  if(!pendingAd.title || !pendingAd.phone){
    alert("Falta información");
    return;
  }

  localStorage.setItem("pendingAd", JSON.stringify(pendingAd));

  const admin = await isAdmin();

  if(admin){
    await createListingDirect(pendingAd);
    return;
  }

  window.location.href =
    "https://checkout.revolut.com/pay/d551a8af-84fb-4f33-8f53-73160994575e";
}

// --- RESUME FLOW ---
async function resumePendingAd(){

  const ad = JSON.parse(localStorage.getItem("pendingAd"));

  if(!ad || !currentUser) return;

  console.log("Pending ad exists");
}

// --- PAYMENT RETURN ---
async function checkPaymentReturn(){

  const urlParams = new URLSearchParams(window.location.search);

  if(urlParams.get("paid") !== "true") return;

  await loadUser();

  if(!currentUser){
    alert("Debes iniciar sesión primero");
    return;
  }

  const ad = JSON.parse(localStorage.getItem("pendingAd"));
  if(!ad) return;

  const expires =
    ad.category === "comida"
      ? null
      : new Date(Date.now() + 5*24*60*60*1000).toISOString();

  const { error } = await supabaseClient
    .from('listings')
    .insert([{
      title: ad.title,
      price: ad.price,
      category: ad.category,
      description: ad.description,
      phone: ad.phone,
      user_id: currentUser.id,
      is_active: true,
      expires_at: expires,
      image_url: ad.image_url
    }]);

  if(error){
    alert("Error guardando: " + error.message);
    console.error(error);
    return;
  }

  localStorage.removeItem("pendingAd");

  alert("Publicado correctamente");

  window.location.href = "/";
}

// --- DELETE ---
async function deleteListing(id){

  const confirmDelete = confirm("¿Eliminar este anuncio?");
  if(!confirmDelete) return;

  const { error } = await supabaseClient
    .from('listings')
    .delete()
    .eq('id', id);

  if(error){
    alert("Error al eliminar");
    console.error(error);
    return;
  }

  alert("Eliminado");

  loadListings();
}

// --- TIME AGO ---
function timeAgo(dateString){

  if(!dateString) return "";

  const diff = Math.floor((new Date() - new Date(dateString)) / 1000);
  const hours = Math.floor(diff / 3600);

  if (hours < 1) return "Hace minutos";
  if (hours < 24) return `Hace ${hours}h`;

  const days = Math.floor(hours / 24);
  return `Hace ${days}d`;
}

// --- LOAD LISTINGS ---
async function loadListings(){

  const container = document.getElementById("listings");

  try {
    const { data, error } = await supabaseClient
      .from('listings')
      .select("*")
      .order("id", { ascending: false });

    if(error){
      console.error("Supabase error:", error);
      alert(error.message);
      throw error;
    }

    container.innerHTML = "";

    if(!data || data.length === 0){
      container.innerHTML = "<p style='color:#D4AF37'>No hay anuncios todavía</p>";
      return;
    }

    data.forEach(item => {

      const div = document.createElement("div");
      div.style.marginBottom = "16px";
      div.style.borderBottom = "1px solid #333";
      div.style.paddingBottom = "10px";

      const isOwner = currentUser && item.user_id === currentUser.id;

      div.innerHTML = `
        ${item.image_url ? `<img src="${item.image_url}" style="width:100%;border-radius:8px;margin-bottom:8px;" />` : ""}
        
        <h3 style="color:#D4AF37">${item.title || ''}</h3>
        
        <p style="color:#fff">${item.price || ''}</p>

        <p style="font-size:12px;opacity:0.6;">
          ${timeAgo(item.created_at)}
        </p>

        <p style="font-size:12px;color:#D4AF37;">
          ${item.category || "General"}
        </p>

        <a href="https://wa.me/${item.phone}" target="_blank" style="color:#25D366">
          WhatsApp
        </a>

        ${isOwner ? `
          <br/>
          <button onclick="deleteListing('${item.id}')" style="color:red;margin-top:8px;">
            Eliminar
          </button>
        ` : ""}
      `;

      container.appendChild(div);
    });

  } catch (err) {
    console.error(err);
    container.innerHTML = "Error cargando datos";
  }
}