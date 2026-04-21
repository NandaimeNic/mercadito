// --- Supabase config ---
const SUPABASE_URL = "https://pwcmwmmerrclkjzgnjgt.supabase.co";
const SUPABASE_KEY = "YOUR_KEY_HERE";

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

  await loadUser();

  await checkPaymentReturn();

  loadListings();
}

window.addEventListener("DOMContentLoaded", init);

// --- USER ---
async function loadUser(){
  try {
    const { data, error } = await supabaseClient.auth.getUser();
    if (error) throw error;
    currentUser = data.user;
  } catch (err) {
    console.error("Auth error:", err);
  }
}

async function login(){

  const email = prompt("Ingresa tu email:");
  if(!email) return;

  const { error } = await supabaseClient.auth.signInWithOtp({ email });

  if(error){
    alert("Error enviando código");
    console.error(error);
    return;
  }

  alert("Revisa tu correo y vuelve a la app");
}

async function requireAuth(){

  await loadUser();

  if(currentUser){
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

// --- PAYMENT START ---
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

  window.location.href =
  "https://checkout.revolut.com/pay/d551a8af-84fb-4f33-8f53-73160994575e";
}

// --- PAYMENT RETURN (STABILIZED) ---
async function checkPaymentReturn(){

  const urlParams = new URLSearchParams(window.location.search);

  if(urlParams.get("paid") !== "true") return;

  await loadUser();

  if(!currentUser){
    alert("Sesión perdida. Inicia sesión otra vez.");
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

    if(error) throw error;

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
    alert("Error cargando anuncios");
    console.error(err);
    container.innerHTML = "Error cargando datos";
  }
}