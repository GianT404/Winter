// Configuration file for the application
// This allows for easy changing of environment-specific settings

const config = {
  // API and SignalR URLs
  api: {
    // Use the current hostname with the backend port
    // This makes the app work on both localhost and when deployed to other environments
    baseUrl: `http://${window.location.hostname}:5195`,
    signalR: {
      hubUrl: `http://${window.location.hostname}:5195/chathub`,
      reconnectAttempts: 5,
      reconnectDelayMs: 3000,
      timeout: 15000
    }
  }
};

export default config;
