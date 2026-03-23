import { Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import PublicLayout from "./components/PublicLayout";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import TrainingDocsPage from "./pages/TrainingDocsPage";
import ManageStudentsPage from "./pages/ManageStudentsPage";

import StudentLayout from "./student/StudentLayout";
import Toggle from "./student/Toggle";
import Dashboard from "./student/studentDashboard.jsx";

import LetterLevel from "./student/LetterLevel";
import TwoLetterLevel from "./student/TwoLetterLevel";
import WordLevel from "./student/WordLevel";
import SentenceLevel from "./student/SentenceLevel.jsx";
import SentenceReport from "./student/Sentencereport.jsx";
import WordReport from "./student/Wordreport.jsx";
import LetterReport from "./student/Letterreport";

import TherapistLayout from "./therapist/TherapistLayout";
import TherapistDashboard from "./therapist/TherapistDashboard";
import TherapistStudentDetail from "./therapist/TherapistStudentDetail";

import GuardianLayout from "./guardian/GuardianLayout";
import GuardianDashboard from "./guardian/GuardianDashboard";
import GuardianStudentDetail from "./guardian/GuardianStudentDetail";
import ChangePassword from "./student/ChangePassword";

/* ================= Protected Route ================= */
function ProtectedRoute({ children, allowedRoles }) {
  const user = JSON.parse(localStorage.getItem("user") || "null");

  if (!user) return <Navigate to="/login" replace />;
  if (allowedRoles && !allowedRoles.includes(user.role)) return <Navigate to="/" replace />;

  return children;
}

/* ================= App ================= */
function App() {
  const location = useLocation();

  return (
    <>
      <Routes>
        {/* -------- Public Routes -------- */}
        <Route element={<PublicLayout />}>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
        </Route>

      {/* -------- Student Routes -------- */}
      <Route
        path="/student"
        element={
          <ProtectedRoute allowedRoles={["student"]}>
            <StudentLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Toggle />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="letter-level" element={<LetterLevel />} />
        <Route path="two-letter-level" element={<TwoLetterLevel />} />
        <Route path="word-level" element={<WordLevel />} />
        <Route path="sentence-level" element={<SentenceLevel />} />

        {/* ✅ Report routes — relative paths, inside StudentLayout so navbar shows */}
        <Route path="report/sentences" element={<SentenceReport />} />
        <Route path="report/words" element={<WordReport />} />
        <Route path="report/letters" element={<LetterReport />} />
      </Route>

        {/* -------- Teacher -------- */}
        <Route
          path="/teacher/dashboard"
          element={
            <ProtectedRoute allowedRoles={["teacher"]}>
              <TrainingDocsPage role="teacher" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/teacher/training-docs"
          element={
            <ProtectedRoute allowedRoles={["teacher"]}>
              <TrainingDocsPage role="teacher" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/teacher/manage-students"
          element={
            <ProtectedRoute allowedRoles={["teacher"]}>
              <ManageStudentsPage role="teacher" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/teacher/change-password"
          element={
            <ProtectedRoute allowedRoles={["teacher"]}>
              <ChangePassword />
            </ProtectedRoute>
          }
        />

      {/* -------- Therapist -------- */}
      <Route
        path="/therapist"
        element={
          <ProtectedRoute allowedRoles={["therapist"]}>
            <TherapistLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<TherapistDashboard />} />
        <Route path="dashboard" element={<TherapistDashboard />} />
        <Route path="student/:studentId" element={<TherapistStudentDetail />} />
      </Route>

      {/* -------- Guardian -------- */}
      <Route
        path="/guardian"
        element={
          <ProtectedRoute allowedRoles={["guardian"]}>
            <GuardianLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<GuardianDashboard />} />
        <Route path="dashboard" element={<GuardianDashboard />} />
        <Route path="student/:studentId" element={<GuardianStudentDetail />} />
      </Route>

        {/* -------- Parent -------- */}
        <Route
          path="/parent/dashboard"
          element={
            <ProtectedRoute allowedRoles={["parent"]}>
              <TrainingDocsPage role="parent" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/parent/training-docs"
          element={
            <ProtectedRoute allowedRoles={["parent"]}>
              <TrainingDocsPage role="parent" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/parent/manage-children"
          element={
            <ProtectedRoute allowedRoles={["parent"]}>
              <ManageStudentsPage role="parent" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/parent/change-password"
          element={
            <ProtectedRoute allowedRoles={["parent"]}>
              <ChangePassword />
            </ProtectedRoute>
          }
        />

        {/* -------- Admin -------- */}
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

        {/* -------- Catch All -------- */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <UploadDocsShortcut pathname={location.pathname} />
    </>
  );
}

function UploadDocsShortcut({ pathname }) {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user") || "null");

  if (!user || !["student", "teacher", "parent"].includes(user.role)) return null;

  const uploadPathByRole = {
    student: "/student/training-docs",
    teacher: "/teacher/training-docs",
    parent: "/parent/training-docs",
  };

  const targetPath = uploadPathByRole[user.role];
  if (!targetPath || pathname === targetPath) return null;

  return (
    <button style={shortcutStyles.button} onClick={() => navigate(targetPath)}>
      Upload Docs
    </button>
  );
}

const placeholderStyle = {
  minHeight: "100vh",
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  alignItems: "center",
  fontFamily: 
    '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", sans-serif',
};

// const shortcutStyles = {
//   button: {
//     position: "fixed",
//     right: 20,
//     bottom: 20,
//     zIndex: 9999,
//     border: "none",
//     borderRadius: 999,
//     background: "#0f172a",
//     color: "white",
//     fontWeight: 700,
//     fontSize: 14,
//     padding: "12px 16px",
//     cursor: "pointer",
//     boxShadow: "0 8px 20px rgba(2, 6, 23, 0.28)",
//   },
// };

const shortcutStyles = {
  button: {
    position: "fixed",
    right: 20,
    bottom: 20,
    zIndex: 9999,
    border: "none",
    borderRadius: 999,
    background: "#0f172a",
    color: "white",
    fontWeight: 700,
    fontSize: 14,
    padding: "12px 16px",
    cursor: "pointer",
    boxShadow: "0 8px 20px rgba(2, 6, 23, 0.28)",
  },
};

export default App;