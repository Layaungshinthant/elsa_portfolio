/**
 * Production Client Engine - Connects HTML UI elements to Google Apps Backend Web App
 */
const GOOGLE_APP_URL = "https://script.google.com/macros/s/YOUR_DEPLOYED_WEB_APP_ID/exec";

document.addEventListener("DOMContentLoaded", () => {
  initializePortfolioAssets();
  setupTrackingTriggers();
});

// Fetch all Google Sheets Content dynamically on structural configuration load
async function initializePortfolioAssets() {
  try {
    const response = await fetch(`${GOOGLE_APP_URL}?action=init`);
    const data = await response.json();
    
    // 1. Dynamic Status Check
    if (data.config.location_status) {
      const badge = document.getElementById("location-badge");
      if (badge) badge.innerText = data.config.location_status;
    }
    
    // 2. Dynamic Image Pipeline Injection
    if (data.config.profile_picture) {
      document.querySelectorAll("img[src='my-photo.jpg']").forEach(img => {
        img.src = data.config.profile_picture;
      });
    }

    // 3. Render Experience Timeline Items dynamically
    if (data.experience && data.experience.length > 0) {
      renderExperienceTimeline(data.experience);
    }

    // 4. Render Article Feeds cleanly
    if (data.articles && data.articles.length > 0) {
      renderArticles(data.articles);
    }
  } catch (err) {
    console.error("Asset lifecycle configuration initialization fault:", err);
  }
}

// Intercept chat/contact submission to relay payload straight into Google Sheets
async function submitInquiryForm(event) {
  event.preventDefault();
  
  const payload = {
    action: "inquiry",
    name: document.getElementById("cf-name").value,
    type: document.getElementById("cf-type").value,
    message: document.getElementById("cf-message").value,
    email: document.getElementById("cf-email") ? document.getElementById("cf-email").value : "",
    appointmentDate: document.getElementById("cf-date") ? document.getElementById("cf-date").value : ""
  };

  // UI state orchestration toggles
  toggleSpinner(true);

  try {
    const response = await fetch(GOOGLE_APP_URL, {
      method: "POST",
      mode: "no-cors", // Bypasses explicit CORS preconditions cleanly via microservices pattern
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    
    document.getElementById("chat-form").reset();
    document.getElementById("chat-success").style.display = "block";
  } catch (error) {
    showToastNotification("Transmission pipeline interruption error.");
  } finally {
    toggleSpinner(false);
  }
}

// Log analytical tracking interactions natively
function logUserClickAction(btnName, section) {
  fetch(GOOGLE_APP_URL, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "log_click", buttonName: btnName, section: section })
  });
}

function setupTrackingTriggers() {
  document.querySelectorAll(".nav-btn, .f-btn, #enter-btn").forEach(elem => {
    elem.addEventListener("click", (e) => {
      const label = e.target.innerText || e.target.id;
      logUserClickAction(label, "Interactive UI Component");
    });
  });
}

function toggleSpinner(show) {
  const lbl = document.getElementById("chat-send-label");
  const spn = document.getElementById("chat-spinner");
  if(lbl && spn) {
    lbl.style.display = show ? "none" : "inline";
    spn.style.display = show ? "inline-block" : "none";
  }
}

function showToastNotification(msg) {
  const toast = document.getElementById("toast");
  if(toast) {
    toast.innerText = msg;
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 3500);
  }
}
