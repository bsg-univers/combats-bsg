const CACHE_NAME = 'bsg-player-v2';

self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  // Nettoyage des vieux caches si nécessaire
  e.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  // STRATÉGIE POUR L'AUDIO
  // On ne cache pas l'audio (trop volumineux), mais on s'assure que 
  // la requête est traitée de manière à ne pas interrompre le flux.
  if (event.request.destination === 'audio' || url.includes('.mp3')) {
    event.respondWith(
      fetch(event.request, {
        mode: 'no-cors', // Évite certains blocages de sécurité sur les flux externes
        credentials: 'omit'
      }).catch(err => {
        console.error("Erreur de récupération audio dans le SW:", err);
      })
    );
    return;
  }

  // STRATÉGIE PAR DÉFAUT (Réseau d'abord)
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});
