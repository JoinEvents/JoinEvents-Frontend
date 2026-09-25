export const environment = {
  production: true,
  /** JoinEvents backend — same API the web app talks to. */
  apiUrl: 'https://joinevents-backend-c9gqc4c6acauc2eg.centralindia-01.azurewebsites.net/api/v1',
  googleClientId: 'YOUR_GOOGLE_CLIENT_ID',
  facebookAppId: 'YOUR_FACEBOOK_APP_ID',
  /**
   * Android push needs Firebase (google-services.json in android/app/). Without
   * it, PushNotifications.register() crashes the app on launch, so push stays
   * off until Firebase is configured. The APK workflow flips this on when the
   * GOOGLE_SERVICES_JSON secret is present.
   */
  pushEnabled: false,
  /** Seconds between message-thread polls while a chat is open. */
  chatPollSeconds: 8,
  /** Seconds between notification badge refreshes. */
  notificationPollSeconds: 60
};
