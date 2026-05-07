import React from "react";
import ReactDOM from "react-dom/client";
import { Provider } from 'react-redux'
import App from "./App.jsx";
import { ClerkProvider } from "@clerk/clerk-react";
import './index.css'
import { StrictMode } from "react";
import store from './app/store.js'
import { BrowserRouter as Router } from 'react-router-dom'
import { Analytics } from '@vercel/analytics/react'

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!PUBLISHABLE_KEY) {
  throw new Error("Missing Clerk Publishable Key. Add VITE_CLERK_PUBLISHABLE_KEY to your .env file.");
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
      <Provider store={store}>
        <Router>
          <App />
          <Analytics />
        </Router>
      </Provider>
    </ClerkProvider>
  </StrictMode>
);
