loginBtn.addEventListener("click", async () => {
  console.log("LOGIN CLICKED");

  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  console.log("EMAIL:", email);

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  console.log("RESULT:", data, error);

  if (error) {
    alert(error.message);
    console.error("LOGIN ERROR:", error);
    return;
  }

  currentUser = data.user;
  modal.classList.add("hidden");

  console.log("LOGIN SUCCESS");

  createListing();
});