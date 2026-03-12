// FamiliaTrack - Service Worker para notificaciones push
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyPLACEHOLDER",
  authDomain: "te-ubico-9080b.firebaseapp.com",
  databaseURL: "https://te-ubico-9080b-default-rtdb.firebaseio.com",
  projectId: "te-ubico-9080b",
  storageBucket: "te-ubico-9080b.appspot.com",
  messagingSenderId: "260737022822",
  appId: "PLACEHOLDER"
});

const messaging = firebase.messaging();

// Mostrar notificación cuando la app está en SEGUNDO PLANO o CERRADA
messaging.onBackgroundMessage(payload => {
  const { title, body, icon } = payload.notification || {};
  self.registration.showNotification(title || '📡 FamiliaTrack', {
    body: body || 'Nueva señal recibida',
    icon: icon || '/icon.png',
    badge: '/icon.png',
    vibrate: [300, 100, 300, 100, 600],
    data: payload.data,
    actions: [
      { action: 'open', title: '👀 Ver ubicación' },
      { action: 'confirm', title: '✓ Confirmar' }
    ]
  });
});

// Al hacer clic en la notificación, abrir la app
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url.includes('netlify.app') && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow('https://dulcet-phoenix-67ae3a.netlify.app');
    })
  );
});
