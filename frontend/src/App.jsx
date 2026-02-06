// import { useState } from "react";
// import Login from "./auth/Login";
// import LetterLevel from "./student/LetterLevel";
// import SentenceLevel from "./student/SentenceLevel";

// function App() {
//   const [user, setUser] = useState(null);
//   const [mode, setMode] = useState("letters"); // "letters" | "sentences"

//   if (!user) return <Login onLogin={setUser} />;

//   if (user.role === "student") {
//     return (
//       <div style={{ textAlign: "center", marginTop: 20 }}>
//         {/* Simple navigation */}
//         <div style={{ marginBottom: 20 }}>
//           <button
//             onClick={() => setMode("letters")}
//             disabled={mode === "letters"}
//             style={{ marginRight: 10 }}
//           >
//             Letter Practice
//           </button>

//           <button
//             onClick={() => setMode("sentences")}
//             disabled={mode === "sentences"}
//           >
//             Sentence Practice
//           </button>
//         </div>

//         {mode === "letters" && <LetterLevel />}
//         {mode === "sentences" && <SentenceLevel />}
//       </div>
//     );
//   }

//   return <div>Logged in as {user.role}</div>;
// }

// export default App;

import { Routes, Route, Navigate } from "react-router-dom";
import PublicLayout from "./components/PublicLayout";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Signup from "./pages/Signup";


import LetterLevel from "./student/LetterLevel";
//import WordLevel from "./student/WordLevel";
import SentenceLevel from "./student/SentenceLevel";
import StudentLayout from "./student/StudentLayout";
import Toggle from "./student/Toggle";
import Dashboard from "./student/Dashboard";
// Protected Route Component
function ProtectedRoute({ children, allowedRoles }) {
  const user = JSON.parse(localStorage.getItem("user") || "null");

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return children;
}

function App() {
  return (
    <Routes>
      {/* ================= Public Routes ================= */}
       <Route element={<PublicLayout />}>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
        </Route>
      {/* ================= Student Routes ================= */}
      <Route
        path="/student"
        element={
          <ProtectedRoute allowedRoles={["student"]}>
            <StudentLayout />
          </ProtectedRoute>
        }
      >

<Route index element={<Toggle />} />
  <Route path="toggle" element={<Toggle />} />
          <Route index element={<Dashboard />} />
  <Route path="dashboard" element={<Dashboard />} />
        <Route path="letter-level" element={<LetterLevel />} />
      
        <Route path="sentence-level" element={<SentenceLevel />} />
       
        {/* Default student redirect */}
        <Route index element={<Navigate to="letter-level" replace />} />
      </Route>

      {/* ================= Teacher Routes ================= */}
      <Route
        path="/teacher/dashboard"
        element={
          <ProtectedRoute allowedRoles={["teacher"]}>
            <div style={placeholderStyle}>
              <h1>Teacher Dashboard</h1>
              <p>Coming Soon</p>
            </div>
          </ProtectedRoute>
        }
      />

      {/* ================= Parent Routes ================= */}
      <Route
        path="/parent/dashboard"
        element={
          <ProtectedRoute allowedRoles={["parent"]}>
            <div style={placeholderStyle}>
              <h1>Parent Dashboard</h1>
              <p>Coming Soon</p>
            </div>
          </ProtectedRoute>
        }
      />

      {/* ================= Admin Routes ================= */}
      <Route
        path="/admin/dashboard"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <div style={placeholderStyle}>
              <h1>Admin Dashboard</h1>
              <p>Coming Soon</p>
            </div>
          </ProtectedRoute>
        }
      />

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

const placeholderStyle = {
  minHeight: "100vh",
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  alignItems: "center",
  fontFamily: '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", sans-serif',
};

export default App;
