import { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import ReadingSupportPanel from "./ReadingSupportPanel";
import FloatingBrushTool from "./FloatingBrushTool";
import { getReadingStyle, useReadingPreferences } from "./useReadingPreferences";

const levels = [
  { label: "Letter", path: "/student/letter-level" },
  { label: "Two Letter Word", path: "/student/two-letter-level" },
  { label: "Word", path: "/student/word-level" },
  { label: "Sentence", path: "/student/sentence-level" },
  { label: "Docs", path: "/student/training-docs" },
  { label: "Password", path: "/student/change-password" },
];

export default function StudentLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [showSupport, setShowSupport] = useState(false);
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);
  const [isBrushDown, setIsBrushDown] = useState(false);
  const [brushPointer, setBrushPointer] = useState({ x: 0, y: 0 });
  const [clearHighlightsVersion, setClearHighlightsVersion] = useState(0);
  const {
    preferences,
    draftPreferences,
    setDraftPreference,
    setLivePreference,
    applyPreferences,
    resetPreferences,
  } = useReadingPreferences();
  const readingStyle = getReadingStyle(preferences);

  useEffect(() => {
    const stopInteractions = () => {
      setIsBrushDown(false);
    };

    window.addEventListener("pointerup", stopInteractions);
    return () => window.removeEventListener("pointerup", stopInteractions);
  }, []);

  useEffect(() => {
    const movePointer = (event) => {
      setBrushPointer({ x: event.clientX, y: event.clientY });
    };

    window.addEventListener("pointermove", movePointer);
    return () => window.removeEventListener("pointermove", movePointer);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("user");
    navigate("/login");
  };

  const showToggle = location.pathname !== "/student/dashboard";
  const brushVisible = Boolean(readingStyle.paintbrushEnabled);

  return (
    <div
      style={{
        ...styles.container,
        background: readingStyle.colors.page,
        color: readingStyle.colors.ink,
        fontFamily: readingStyle.fontFamily,
      }}
    >
      {/* Top Header */}
      <header
        style={{
          ...styles.header,
          background: readingStyle.colors.card,
          borderBottom: `1px solid ${readingStyle.colors.border}`,
        }}
      >
       <div style={styles.left}>
  <div
    style={styles.logo}
    onClick={() => navigate("/")}
  >
    LexCura
  </div>

  <button
    onClick={() => navigate("/student/dashboard")}
    style={styles.dashboardBtn}
  >
    Dashboard
  </button>
</div>


        {showToggle && (
          <div style={styles.toggleBar}>
            {levels.map((level) => {
              const active = location.pathname === level.path;
              return (
                <button
                  key={level.path}
                  onClick={() => navigate(level.path)}
                  style={{
                    ...styles.toggleBtn,
                    ...(active ? styles.active : {}),
                  }}
                >
                  {level.label}
                </button>
              );
            })}
          </div>
        )}

        <div style={styles.rightActions}>
          <button
            type="button"
            onClick={() => setShowSupport((prev) => !prev)}
            style={styles.supportBtn}
          >
            Reading Tools
          </button>
          <button onClick={handleLogout} style={styles.logoutBtn}>
            Logout
          </button>
        </div>
      </header>

      {/* Page Content */}
      <main style={styles.content}>
        {showSupport && (
          <div style={styles.panelWrap}>
            <ReadingSupportPanel
              isCollapsed={isPanelCollapsed}
              onToggleCollapse={() =>
                setIsPanelCollapsed((prev) => !prev)
              }
              draftPreferences={draftPreferences}
              setDraftPreference={setDraftPreference}
              applyPreferences={applyPreferences}
              resetPreferences={resetPreferences}
            />
          </div>
        )}
        <Outlet
          context={{
            preferences,
            draftPreferences,
            readingStyle,
            setLivePreference,
            isBrushDown,
            setIsBrushDown,
            brushState: {
              color: readingStyle.brushColor,
              opacity: readingStyle.brushOpacity,
              size: readingStyle.brushSize,
              mode: readingStyle.brushMode,
            },
            clearHighlightsVersion,
          }}
        />
      </main>
      {brushVisible && (
        <FloatingBrushTool
          visible={brushVisible}
          brushState={{
            color: readingStyle.brushColor,
            opacity: readingStyle.brushOpacity,
            size: readingStyle.brushSize,
            mode: readingStyle.brushMode,
          }}
          onUpdate={setLivePreference}
          onClear={() => setClearHighlightsVersion((prev) => prev + 1)}
          onClose={() => setLivePreference("paintbrushEnabled", false)}
        />
      )}
      {brushVisible && isBrushDown && (
        <div
          style={{
            ...styles.brushCursor,
            width: readingStyle.brushSize,
            height: readingStyle.brushSize,
            left: brushPointer.x,
            top: brushPointer.y,
            borderColor: readingStyle.brushColor,
            background: `${readingStyle.brushColor}${Math.round(
              readingStyle.brushOpacity * 255
            )
              .toString(16)
              .padStart(2, "0")}`,
            transform: "translate(-50%, -50%) scale(1.08)",
          }}
        >
          <span style={styles.cursorCore} />
        </div>
      )}
    </div>
  );
}

/* =========================
   Styles (THIS WAS MISSING)
========================== */
const styles = {
  container: {
    minHeight: "100vh",
    background: "#f8fafc",
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", sans-serif',
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "16px 28px",
    background: "white",
    borderBottom: "1px solid #e2e8f0",
    position: "sticky",
    top: 0,
    zIndex: 100,
  },
  logo: {
    fontSize: 22,
    fontWeight: 800,
    color: "#1e40af",
    cursor: "pointer",
  },
  toggleBar: {
    display: "flex",
    gap: 10,
  },
  left: {
  display: "flex",
  alignItems: "center",
  gap: 16,
},
  rightActions: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
dashboardBtn: {
  background: "transparent",
  border: "1px solid #c7d2fe",
  color: "#1e40af",
  padding: "6px 14px",
  borderRadius: 999,
  fontWeight: 600,
  cursor: "pointer",
  fontSize: 13,
},
  supportBtn: {
    background: "#e8f0ff",
    color: "#173a73",
    border: "1px solid #bfd1ff",
    padding: "8px 14px",
    borderRadius: 999,
    fontWeight: 700,
    cursor: "pointer",
    fontSize: 13,
  },

  toggleBtn: {
    padding: "8px 16px",
    borderRadius: 999,
    border: "1px solid #c7d2fe",
    background: "white",
    color: "#1e40af",
    fontWeight: 600,
    cursor: "pointer",
    fontSize: 14,
  },
  active: {
    background: "#1e40af",
    color: "white",
  },
  logoutBtn: {
    background: "#fee2e2",
    color: "#991b1b",
    border: "none",
    padding: "8px 16px",
    borderRadius: 8,
    fontWeight: 600,
    cursor: "pointer",
  },
  content: {
    padding: 32,
    maxWidth: 1200,
    margin: "0 auto",
  },
  panelWrap: {
    marginBottom: 20,
  },
  brushCursor: {
    position: "fixed",
    zIndex: 1190,
    pointerEvents: "none",
    borderRadius: "50%",
    border: "2px solid rgba(15,23,42,0.18)",
    boxShadow: "0 8px 20px rgba(15,23,42,0.15)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "transform 0.08s linear",
  },
  cursorCore: {
    width: 6,
    height: 6,
    borderRadius: "50%",
    background: "rgba(15,23,42,0.72)",
  },
};
