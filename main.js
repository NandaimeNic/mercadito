// --- Supabase config ---
const SUPABASE_URL = "https://pwcmwmmerrclkjzgnjgt.supabase.co";
const SUPABASE_KEY = "YOUR_ANON_KEY";

let supabaseClient;
let currentUser = null;

// --- INIT ---
async function init() {
  if (!window.supabase) {
    alert("Error cargando sistema");
    return;
  }

  supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
  );

  try {
    const { data, error } = await supabaseClient.auth.getUser();

    if (error) throw error;

    currentUser = data.user;
  } catch (err) {
    console.error("Auth error:", err);
  }

  await checkPaymentReturn();
  await loadListings();
}

window.addEventListener("DOMContentLoaded", init);

// --- AUTH ---
async function login() {
  const email = prompt("Ingresa tu email:");

  if (!email) return;

  const { error } =
    await supabaseClient.auth.signInWithOtp({
      email: email
    });

  if (error) {
    alert("Error enviando código");
    console.error(error);
    return;
  }

  alert("Revisa tu correo y vuelve a la app");
}

async function requireAuth() {
  const { data } =
    await supabaseClient.auth.getUser();

  if (data.user) {
    currentUser = data.user;
    return true;
  }

  await login();
  return false;
}

// --- Toggle form ---
function toggleForm() {
  const box =
    document.getElementById("formBox");

  box.style.display =
    box.style.display === "block"
      ? "none"
      : "block";
}

// --- IMAGE UPLOAD FIXED ---
async function uploadImage(file) {
  if (!file) return "";

  const ext =
    file.name.split(".").pop();

  const fileName =
    `${Date.now()}-${Math.floor(Math.random() * 9999)}.${ext}`;

  const { error } =
    await supabaseClient.storage
      .from("listings")
      .upload(fileName, file, {
        upsert: false
      });

  if (error) {
    console.error(error);
    alert("Error subiendo imagen");
    return "";
  }

  const { data } =
    supabaseClient.storage
      .from("listings")
      .getPublicUrl(fileName);

  if (!data || !data.publicUrl) {
    alert("No se pudo generar URL pública");
    return "";
  }

  return data.publicUrl;
}

// --- START PAYMENT ---
async function startPayment() {
  const isAuth =
    await requireAuth();

  if (!isAuth) return;

  const file =
    document.getElementById("imageInput")
      .files[0];

  const imageUrl =
    await uploadImage(file);

  const pendingAd = {
    title:
      document.getElementById("title")
        .value.trim(),

    price:
      document.getElementById("price")
        .value.trim(),

    category:
      document.getElementById("category")
        .value,

    description:
      document.getElementById("desc")
        .value.trim(),

    phone:
      document.getElementById("phone")
        .value.trim(),

    image_url: imageUrl
  };

  if (
    !pendingAd.title ||
    !pendingAd.phone
  ) {
    alert("Falta información");
    return;
  }

  localStorage.setItem(
    "pendingAd",
    JSON.stringify(pendingAd)
  );

  window.location.href =
    "https://checkout.revolut.com/pay/d551a8af-84fb-4f33-8f53-73160994575e";
}

// --- PAYMENT RETURN ---
async function checkPaymentReturn() {
  const params =
    new URLSearchParams(
      window.location.search
    );

  if (
    params.get("paid") !== "true"
  ) return;

  const { data } =
    await supabaseClient.auth.getUser();

  if (!data.user) {
    alert(
      "Debes iniciar sesión después del pago"
    );
    return;
  }

  const raw =
    localStorage.getItem(
      "pendingAd"
    );

  if (!raw) return;

  const ad =
    JSON.parse(raw);

  const expires =
    ad.category === "comida"
      ? null
      : new Date(
          Date.now() +
          5 * 24 * 60 * 60 * 1000
        ).toISOString();

  const { error } =
    await supabaseClient
      .from("listings")
      .insert([
        {
          title: ad.title,
          price: ad.price,
          category: ad.category,
          description: ad.description,
          phone: ad.phone,
          user_id: data.user.id,
          is_active: true,
          expires_at: expires,
          image_url:
            ad.image_url || ""
        }
      ]);

  if (error) {
    alert(
      "Error guardando: " +
      error.message
    );
    console.error(error);
    return;
  }

  localStorage.removeItem(
    "pendingAd"
  );

  alert("Anuncio publicado");

  window.location.href = "/";
}

// --- LOAD LISTINGS ---
async function loadListings() {
  const container =
    document.getElementById(
      "listings"
    );

  try {
    const { data, error } =
      await supabaseClient
        .from("listings")
        .select("*")
        .eq("is_active", true)
        .order("id", {
          ascending: false
        });

    if (error) throw error;

    container.innerHTML = "";

    if (
      !data ||
      data.length === 0
    ) {
      container.innerHTML =
        "<p style='color:#D4AF37'>No hay anuncios todavía</p>";
      return;
    }

    data.forEach(item => {
      const div =
        document.createElement(
          "div"
        );

      div.style.background =
        "#111";
      div.style.borderRadius =
        "12px";
      div.style.padding =
        "10px";
      div.style.marginBottom =
        "16px";
      div.style.boxShadow =
        "0 2px 6px rgba(0,0,0,0.4)";

      const image =
        item.image_url &&
        item.image_url.trim() !== ""
          ? item.image_url
          : "https://via.placeholder.com/600x400?text=Sin+Imagen";

      div.innerHTML = `
        <img
          src="${image}"
          onerror="this.src='https://via.placeholder.com/600x400?text=Sin+Imagen'"
          style="
            width:100%;
            height:180px;
            object-fit:cover;
            border-radius:10px;
          "
        />

        <div style="margin-top:8px;">
          <div style="
            color:#D4AF37;
            font-size:16px;
            font-weight:600;
          ">
            ${item.title || ""}
          </div>

          <div style="
            color:#fff;
            font-size:18px;
            font-weight:bold;
            margin-top:4px;
          ">
            ${item.price || ""}
          </div>

          <a
            href="https://wa.me/${item.phone}"
            target="_blank"
            style="
              display:block;
              margin-top:10px;
              text-align:center;
              background:#25D366;
              color:#000;
              padding:10px;
              border-radius:8px;
              font-weight:bold;
              text-decoration:none;
            "
          >
            WhatsApp
          </a>
        </div>
      `;

      container.appendChild(div);
    });

  } catch (err) {
    console.error(err);

    container.innerHTML =
      "Error cargando anuncios";
  }
}