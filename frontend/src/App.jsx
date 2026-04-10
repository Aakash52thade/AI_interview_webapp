import {
  SignIn,
  SignedIn,
  SignedOut,
  UserButton,
} from "@clerk/clerk-react";

function App() {
  return (
    <>
      <SignedOut>
        <SignIn />
      </SignedOut>

      <SignedIn>
        <h1>Welcome 🚀</h1>
        <UserButton />
      </SignedIn>
    </>
  );
}

export default App;