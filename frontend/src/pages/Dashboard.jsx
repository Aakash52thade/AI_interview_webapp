// frontend/src/pages/Dashboard.jsx
// Example page — replace with your real UI.
// Shows how to use Clerk user data and call your backend.

import { useUser, UserButton } from "@clerk/clerk-react";
import { useAuthFetch } from "../hooks/useAuthFetch.jsx";

function Dashboard() {
  const { user } = useUser();
  const { authFetch } = useAuthFetch();

  // Example: how to call a protected backend route
  const handleTestBackend = async () => {
    try {
      const data = await authFetch("/api/test");
      console.log("Backend response:", data);
    } catch (err) {
      console.error("Backend call failed:", err.message);
    }
  };

  return (
    <div style={{ padding: "2rem" }}>
      {/* UserButton shows the user avatar + sign-out option */}
      <UserButton afterSignOutUrl="/" />

      <h1>Welcome, {user?.firstName || "User"} 👋</h1>
      <p>Email: {user?.emailAddresses[0]?.emailAddress}</p>

      <button onClick={handleTestBackend}>
        Test Backend Call
      </button>
    </div>
  );
}

export default Dashboard;