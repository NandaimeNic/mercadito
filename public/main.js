console.log("MAIN JS LOADED v3");

// ----------------------
// SUPABASE INIT
// ----------------------
const SUPABASE_URL = "https://ddfvxfaqbuybiwnfejwh.supabase.co";
const SUPABASE_ANON_KEY = "YOUR_ANON_KEY"; // <-- REPLACE

const supabase = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

// ----------------------
// STATE
// ----------------------
let currentUser = null;

// ----------------------
// ELEMENTS
// ----------------------
const form = document.getElementById("listingForm");
const modal = document.getElementById("authModal");
const loginBtn = document.getElementById("loginBtn");
const signupBtn = document.getElementById("signupBtn");

// ----------------------
// SESSION CHECK
// ----------------------
async function checkSession() {
  const { data, error } = await supabase.auth.getUser();

  if (error) {
    console.error("Session error:", error);
    return;
  }

  if (data?.user) {
    currentUser = data.user;
    console.log("USER RESTORED:", currentUser.id);
    resumeFlow();
  }
}

// ----------------------
// FORM SUBMIT
// ----------------------
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  console.log("FORM SUBMIT");

  if (!currentUser) {
    console.log("NOT LOGGED IN → OPEN MODAL");
    savePendingListing();
    modal.classList.remove("hidden");
    return;
  }

  await publishListing();
});

// ----------------------
// SAVE STATE
// ----------------------
function savePendingListing() {
  const data = {
    title: document.getElementById("title").value,
    description: document.getElementById("description").value,
    price: document.getElementById("price").value,
  };

  localStorage.setItem("pendingListing", JSON.stringify(data));
  console.log("Saved to localStorage");
}

// ----------------------
// RESTORE STATE
// ----------------------
function loadPendingListing() {
  const data = localStorage.getItem("pendingListing");
  if (!data) return;

  const parsed = JSON.parse(data);

  document.getElementById("title").value = parsed.title || "";
  document.getElementById("description").value = parsed.description || "";
  document.getElementById("price").value = parsed.price || "";

  console.log("Restored pending listing");
}

// ----------------------
// LOGIN
// ----------------------
loginBtn.addEventListener("click", async () => {
  console.log("LOGIN CLICKED");

  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    console.error("Login error:", error.message);
    alert(error.message);
    return;
  }

  currentUser = data.user;

  modal.classList.add("hidden");

  resumeFlow();
});

// ----------------------
// SIGNUP
// ----------------------
signupBtn.addEventListener("click", async () => {
  console.log("SIGNUP CLICKED");

  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) {
    console.error("Signup error:", error.message);
    alert(error.message);
    return;
  }

  currentUser = data.user;

  modal.classList.add("hidden");

  resumeFlow();
});

// ----------------------
// RESUME FLOW (FIXED)
// ----------------------
function resumeFlow() {
  console.log("RESUMING FLOW");

  const pending = localStorage.getItem("pendingListing");
  if (!pending) return;

  publishListing();
}

// ----------------------
// PUBLISH
// ----------------------
async function publishListing() {
  console.log("PUBLISH CLICKED");

  const title = document.getElementById("title").value;
  const description = document.getElementById("description").value;
  const price = document.getElementById("price").value;

  try {
    const { data, error } = await supabase
      .from("listings")
      .insert([
        {
          title,
          description,
          price,
          user_id: currentUser.id
        }
      ])
      .select();

    if (error) {
      console.error("Insert error:", error);
      alert("Failed to publish");
      return;
    }

    console.log("INSERT SUCCESS:", data);

    renderListing({ title, description, price });

    localStorage.removeItem("pendingListing");

  } catch (err) {
    console.error("Unexpected error:", err);
  }
}

// ----------------------
// RENDER
// ----------------------
function renderListing(item) {
  const container = document.getElementById("listings");

  const div = document.createElement("div");
  div.className = "card";

  div.innerHTML = `
    <h3>${item.title}</h3>
    <p>${item.description}</p>
    <strong>$${item.price}</strong>
  `;

  container.prepend(div);
}

// ----------------------
// INIT
// ----------------------
loadPendingListing();
checkSession();