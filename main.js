// --- Supabase config ---
const SUPABASE_URL = "https://mvcqoyhepcfoyutcvtrh.supabase.co";
const SUPABASE_KEY = "sb_publishable_H6BeHo4_ihvf0QHBSAL0yg_-RmyxNLF";

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

  const { data } = await supabaseClient.auth.getUser();
  currentUser = data.user;

  checkPaymentReturn();
  loadListings();
}

window.addEventListener("DOMContentLoaded", init);

// --- AUTH (OTP email for now) ---
async function login(){

  const email = prompt("Ingresa tu email para continuar:");

  if(!email) return;

  const { error } = await supabaseClient.auth.signInWithOtp({
    email: email
  });

  if(error){
    alert("Error enviando código");
    return;
  }

  alert("Revisa tu email para continuar");
}

// --- ENSURE AUTH ---
async function requireAuth(){

  const { data } = await supabaseClient.auth.getUser();

  if(data.user){
    currentUser = data.user;
    return true;
  }

  await login();
  return false;
}

// --- Toggle form ---
function toggleForm(){
  const box = document.getElementById("formBox");
  box.style.display =
    box.style.display === "block" ? "none" : "block";
}

// --- Payment ---
async function startPayment(){

  const isAuth = await requireAuth();
  if(!isAuth) return;

  const pendingAd = {
    title: document.getElementById("title").value.trim(),
    price: document.getElementById("price").value.trim(),
    category: document.getElementById("category").value,
    description: document.getElementById("desc").value.trim(),
    phone: document.getElementById("phone").value.trim()
  };

  if(!pendingAd.title || !pendingAd.phone){
    alert("Falta información");
    return;
  }

  localStorage.setItem("pendingAd", JSON.stringify(pendingAd));

  window.location.href =
  "https://checkout.revolut.com/pay/d551a8af-84fb-4f33-8f53-73160994575e";
}

// --- Payment return ---
async function checkPaymentReturn(){

  const urlParams = new URLSearchParams(window.location.search);

  if(urlParams.get("paid") === "true"){

    const { data } = await supabaseClient.auth.getUser();
    if(!data.user){
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
      .from("listings")
      .insert([{
        title: ad.title,
        price: ad.price,
        category: ad.category,
        description: ad.description,
        phone: ad.phone,
        user_id: data.user.id,
        is_active: true,
        expires_at: expires
      }]);

    if(error){
      alert("Error guardando");
      console.error(error);
      return;
    }

    localStorage.removeItem("pendingAd");
    window.location.href = "index.html";
  }
}

// --- Categories ---
const CATEGORIES = [
  "ropa",
  "electronica",
  "reparaciones",
  "hogar",
  "vehiculos",
  "comida",
  "servicios",
  "otros"
];

const CATEGORY_LABELS = {
  ropa: "👕 Ropa",
  electronica: "📱 Electrónica",
  reparaciones: "🔧 Reparaciones",
  hogar: "🏠 Hogar",
  vehiculos: "🚗 Vehículos",
  comida: "🍔 Comida",
  servicios: "🧰 Servicios",
  otros: "📦 Otros"
};

// --- Load listings ---
async function loadListings(){

  const container = document.getElementById("listings");

  const { data, error } = await supabaseClient
    .from("listings")
    .select("*")
    .order("id", { ascending:false });

  if(error){
    container.innerHTML = "Error";
    return;
  }

  container.innerHTML = "";

  CATEGORIES.forEach(cat => {

    const items = data.filter(item => {
      if(item.category !== cat) return false;

      if(
        item.expires_at &&
        new Date(item.expires_at) < new Date()
      ){
        return false;
      }

      return true;
    });

    if(items.length === 0) return;

    const section = document.createElement("div");

    section.innerHTML =
      `<div class="category-title">${CATEGORY_LABELS[cat]}</div>`;

    let html = "";

    items.forEach(item => {

      html += `
        <div class="card" onclick='openDetail(${JSON.stringify(item)})'>
          <img src="https://images.unsplash.com/photo-1600185365483-26d7a4cc7519">
          <div class="content">
            <div><strong>${item.title}</strong></div>
            <div class="price">${item.price || ""}</div>
          </div>
        </div>
      `;
    });

    section.innerHTML += html;
    container.appendChild(section);

  });
}

// --- Modal ---
function openDetail(item){

  const modal = document.getElementById("detailModal");

  modal.innerHTML = `
    <div class="modal-content">
      <h2>${item.title}</h2>
      <p>${item.description || ""}</p>
      <div>${item.price || ""}</div>
      <button onclick="contact('${item.phone}')">WhatsApp</button>
      <button onclick="closeModal()">Cerrar</button>
    </div>
  `;

  modal.style.display = "flex";
}

function closeModal(){
  document.getElementById("detailModal").style.display = "none";
}

// --- WhatsApp ---
function contact(phone){
  const clean = phone.replace(/\D/g,"");

  window.open(
    `https://wa.me/${clean}?text=Hola vi tu anuncio`,
    "_blank"
  );
}