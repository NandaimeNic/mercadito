const SUPABASE_URL = "https://mvcqoyhepcfoyutcvtrh.supabase.co";
const SUPABASE_KEY = "sb_publishable_H6BeHo4_ihvf0QHBSAL0yg_-RmyxNLF";

const supabase = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

/* Toggle form */
function toggleForm(){
  const box = document.getElementById("formBox");
  box.style.display =
    box.style.display === "block" ? "none" : "block";
}

/* Start payment */
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

  localStorage.setItem(
    "pendingAd",
    JSON.stringify(pendingAd)
  );

  window.location.href =
  "https://checkout.revolut.com/pay/d551a8af-84fb-4f33-8f53-73160994575e";
}

/* Return after payment */
async function checkPaymentReturn(){

  const urlParams =
    new URLSearchParams(window.location.search);

  if(urlParams.get("paid") === "true"){

    const data = JSON.parse(
      localStorage.getItem("pendingAd")
    );

    if(!data) return;

    const expires =
      data.category === "restaurants"
      ? null
      : new Date(
        Date.now() + 5*24*60*60*1000
      ).toISOString();

    const { error } = await supabase
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
      console.log(error);
      return;
    }

    localStorage.removeItem("pendingAd");
    window.location.href = "index.html";
  }
}

/* Load listings */
async function loadListings(){

  const container =
    document.getElementById("listings");

  try{

    const { data, error } = await supabase
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

    data.forEach(item => {

      if(
        item.expires_at &&
        new Date(item.expires_at) < new Date()
      ){
        return;
      }

      container.innerHTML += `
        <div class="card">
          <img src="https://images.unsplash.com/photo-1600185365483-26d7a4cc7519">
          <div class="content">
            <div><strong>${item.title}</strong></div>
            <div>${item.description || ""}</div>
            <div class="price">${item.price || ""}</div>
            <button class="whatsapp"
              onclick="contact('${item.phone}')">
              Contactar
            </button>
          </div>
        </div>
      `;
    });

  }catch(err){
    container.innerHTML =
      "<p>Error JS: " + err.message + "</p>";
  }
}

/* WhatsApp */
function contact(phone){

  const clean = phone.replace(/\D/g,"");

  window.open(
    `https://wa.me/${clean}?text=Hola vi tu anuncio en Mercadito Nandaime`,
    "_blank"
  );
}

/* Init */
checkPaymentReturn();
loadListings();