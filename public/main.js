console.log("MAIN JS LOADED");

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
// TEST CLICK (DEBUG)
// ----------------------
window.testClick = function () {
  console.log("BUTTON CLICKED");
};

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
// AUTH (SIMULATED SAFE)
// ----------------------
loginBtn.addEventListener("click", () => {
  console.log("LOGIN CLICKED");

  currentUser = { id: "demo-user" };

  modal.classList.add("hidden");

  resumeFlow();
});

signupBtn.addEventListener("click", () => {
  console.log("SIGNUP CLICKED");

  currentUser = { id: "demo-user" };

  modal.classList.add("hidden");

  resumeFlow();
});

// ----------------------
// RESUME FLOW
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

  const listing = {
    title: document.getElementById("title").value,
    description: document.getElementById("description").value,
    price: document.getElementById("price").value,
  };

  try {
    renderListing(listing);

    localStorage.removeItem("pendingListing");

    console.log("Listing published (mock)");
  } catch (err) {
    console.error("Publish failed", err);
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