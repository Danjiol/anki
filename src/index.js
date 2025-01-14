// Ihre App-Initialisierung (z.B. React.render oder ähnliches)
// ...

// Service Worker erst danach registrieren
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    setTimeout(() => { // Kleiner Delay zur Sicherheit
      navigator.serviceWorker
        .register("/serviceWorker.js")
        .then((registration) => {
          console.log("ServiceWorker registration successful");
        })
        .catch((err) => {
          console.log("ServiceWorker registration failed: ", err);
        });
    }, 1000);
  });
} 