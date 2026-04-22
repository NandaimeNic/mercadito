console.log("STEP 2: LOGIN SYSTEM");

// ----------------------
// STATE
// ----------------------
let currentUser = null;

// ----------------------
// ELEMENTS
// ----------------------
const form = document.getElementById("listingForm");
const listings = document.getElementById("listings");
const modal = document.getElementById("authModal");
const loginBtn = document.getElementById("loginBtn");

// ----------------------
// FORM SUBMIT
// ----------------------
form.addEventListener("submit", (e) => {
  e.preventDefault();

  if (!currentUser) {
    console.log("NOT LOGGED IN");
    modal.classList.remove("hidden");
    return;
  }

  createListing();
});

// ----------------------
// LOGIN
// ----------------------
loginBtn.addEventListener("click", () => {
  const username = document.getElementById("username").value;

  if (!username) {
    alert("Enter username");
    return;
  }

  currentUser = { name: username };

  modal.classList.add("hidden");

  console.log("LOGGED IN:", username);

  createListing();
});

// ----------------------
// CREATE LISTING
// ----------------------
function createListing() {
  const title = document.getElementById("title").value;
  const description = document.getElementById("description").value;
  const price = document.getElementById("price").value;

  const item = { title, description, price };

  renderListing(item);

  form.reset();

  console.log("LISTING CREATED");
}

// ----------------------
// RENDER
// ----------------------
function renderListing(item) {
  const div = document.createElement("div");
  div.className = "card";

  div.innerHTML = `
    <h3>${item.title}</h3>
    <p>${item.description}</p>
    <strong>$${item.price}</strong>
  `;

  listings.prepend(div);
}