console.log("APP RUNNING CLEAN");

// ----------------------
// ELEMENTS
// ----------------------
const form = document.getElementById("listingForm");
const listings = document.getElementById("listings");

// ----------------------
// FORM SUBMIT
// ----------------------
form.addEventListener("submit", (e) => {
  e.preventDefault();

  const title = document.getElementById("title").value;
  const description = document.getElementById("description").value;
  const price = document.getElementById("price").value;

  const item = { title, description, price };

  renderListing(item);

  form.reset();

  console.log("LISTING ADDED");
});

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