// --- Supabase config ---
const SUPABASE_URL = "https://mvcqoyhepcfoyutcvtrh.supabase.co";
const SUPABASE_KEY = "PASTE_YOUR_ANON_KEY_HERE"; // ← replace with eyJhbGciOiJIUzI1NiIs...

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

// --- AUTH ---
async function login(){

  const email = prompt("Ingresa tu email:");
  if(!email) return;

  const { error } = await supabaseClient.auth.signInWithOtp({ email });

  if(error){
    alert("Error enviando código");
    return;
  }

  alert("Revisa tu correo");
}

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

// --- IMAGE UPLOAD ---
async function uploadImage(file){

  if(!file) return "";

  const fileExt = file.name.split('.').pop();
  const fileName = `${Date.now()}.${fileExt}`;

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

// --- Payment ---
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

// --- Payment return ---
async function checkPaymentReturn(){

  const urlParams = new URLSearchParams(window.location.search);

  if(urlParams.get("paid") === "true"){

    const { data } = await supabaseClient.auth.getUser();
    if(!data.user){
      alert("Debes iniciar sesión");
      return;
    }

    const ad = JSON.parse(localStorage.getItem("pendingAd"));
    if(!ad) return;

    const expires =
      ad.category === "comida"
      ? null
      : new Date(Date.now() + 5*24*60*60*1000).toISOString();

    const { error } = await supabaseClient
      .from('"Listings"')
      .insert([{
        title: ad.title,
        price: ad.price,
        category: ad.category,
        description: ad.description,
        phone: ad.phone,
        user_id: data.user.id,
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
    window.location.href = "/";
  }
}

// --- Load listings ---
async function loadListings(){

  const container = document.getElementById("listings");

  const { data, error } = await supabaseClient
    .from('"Listings"')
    .select("*")
    .order("id",{ascending:false});

  if(error){
    alert("Error loading listings: " + error.message);
    console.error(error);
    container.innerHTML = "Error: " + error.message;
    return;
  }

  container.innerHTML = "";
}