// --- Supabase config ---
const SUPABASE_URL = "https://mvcqoyhepcfoyutcvtrh.supabase.co";
const SUPABASE_KEY = "sb_publishable_H6BeHo4_ihvf0QHBSAL0yg_-RmyxNLF";

// --- Safe client init ---
let supabaseClient;

try {
  if (!window.supabase) {
    throw new Error("Supabase library not loaded");
  }

  supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
  );

} catch (err) {
  console.error(err);
  alert("Error cargando base de datos");
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

// --- Toggle form ---
function toggleForm(){
  const box = document.getElementById("formBox");
  box.style.display =
    box.style.display === "block" ? "none" : "block";
}

// --- Payment ---
function startPayment(){

  const pendingAd = {
    title: document.getElementById("title").value.trim(),
    price: document.getElementById("price").value.trim(),
    category: document.getElementById("category").value,
    description: document.getElementById("desc").value.trim(),
    phone: document.getElementById("phone").value.trim()
  };

  if(!pendingAd.title || !pendingAd.phone){
    alert("Falta título o WhatsApp");
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

    const data = JSON.parse(localStorage.getItem("pendingAd"));
    if(!data) return;

    const expires =
      data.category === "comida"
      ? null
      : new Date(Date.now() + 5*24*60*60*1000).toISOString();

    const { error } = await supabaseClient
      .from("listings")
      .insert([{
        title: data.title,
        price: data.price,
        category: data.category,
        description: data.description,
        phone: data.phone,
        is_active: true,
        expires_at: expires
      }]);

    if(error){
      alert("Error guardando anuncio");
      console.error(error);
      return;
    }

    localStorage.removeItem("pendingAd");
    window.location.href = "index.html";
  }
}

// --- Load listings ---
async function loadListings(){

  const container = document.getElementById("listings");

  if(!supabaseClient){
    container.innerHTML = "<p>Error conexión base de datos</p>";
    return;
  }

  try{

    const { data, error } = await supabaseClient
      .from("listings")
      .select("*")
      .order("id", { ascending:false });

    if(error){
      container.innerHTML =
        "<p>Error: " + error.message + "</p>";
      return;
    }

    if(!data || data.length === 0){
      container.innerHTML =
        "<p>No hay publicaciones todavía</p>";
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

      let cardsHTML = "";

      items.forEach(item => {

        cardsHTML += `
          <div class="card" onclick='openDetail(${JSON.stringify(item)})'>
            <img src="https://images.unsplash.com/photo-1600185365483-26d7a4cc7519">
            <div class="content">
              <div><strong>${item.title}</strong></div>
              <div class="price">${item.price || ""}</div>
            </div>
          </div>
        `;
      });

      section.innerHTML += cardsHTML;
      container.appendChild(section);

    });

  }catch(err){
    container.innerHTML =
      "<p>Error JS: " + err.message + "</p>";
  }
}

// --- Detail modal ---
function openDetail(item){

  const modal = document.getElementById("detailModal");

  modal.innerHTML = `
    <div class="modal-content">
      <img src="https://images.unsplash.com/photo-1600185365483-26d7a4cc7519">
      <h2>${item.title}</h2>
      <p>${item.description || ""}</p>
      <div class="price">${item.price || ""}</div>
      <button onclick="contact('${item.phone}')">Contactar por WhatsApp</button>
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
    `https://wa.me/${clean}?text=Hola vi tu anuncio en Mercadito Nandaime`,
    "_blank"
  );
}

// --- INIT ---
window.addEventListener("DOMContentLoaded", () => {
  checkPaymentReturn();
  loadListings();
});