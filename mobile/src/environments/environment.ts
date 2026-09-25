export const environment = {
  production: true,
  /** JoinEvents backend — same API the web app talks to. */
  apiUrl: 'https://joinevents-backend-c9gqc4c6acauc2eg.centralindia-01.azurewebsites.net/api/v1',
  googleClientId: 'YOUR_GOOGLE_CLIENT_ID',
  facebookAppId: 'YOUR_FACEBOOK_APP_ID',
  /** Seconds between message-thread polls while a chat is open. */
  chatPollSeconds: 8,
  /** Seconds between notification badge refreshes. */
  notificationPollSeconds: 60
};
