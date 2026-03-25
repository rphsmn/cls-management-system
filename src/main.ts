import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app'; // This is correct for your repo

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));