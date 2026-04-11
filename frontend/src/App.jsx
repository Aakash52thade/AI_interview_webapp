import { SignedIn, SignedOut, RedirectToSignIn } from "@clerk/clerk-react";
import Dashboard from "./pages/Dashboard.jsx";

function App() {
  return (
    <>
      {/* If user is NOT signed in → redirect to Clerk's hosted sign-in page */}
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>

      {/* If user IS signed in → show the app */}
      <SignedIn>
        <Dashboard />
      </SignedIn>
    </>
  );
}

export default App;