// import { Link } from "react-router-dom";

// export default function Landing() {
//   return (
//     <div style={styles.container}>
//       <nav style={styles.nav}>
//         <h2 style={styles.logo}>LexCura</h2>
//         <div>
//           <Link to="/login" style={styles.link}>Login</Link>
//           <Link to="/signup" style={styles.signup}>Sign Up</Link>
//         </div>
//       </nav>

//       <section style={styles.hero}>
//         <h1 style={styles.title}>
//           Learn Pronunciation <span style={{ color: "#6366f1" }}>The Smart Way</span>
//         </h1>
//         <p style={styles.subtitle}>
//           AI-powered pronunciation practice for letters, words & sentences.
//         </p>

//         <div style={styles.cta}>
//           <Link to="/signup" style={styles.primaryBtn}>Get Started Free</Link>
//           <Link to="/login" style={styles.secondaryBtn}>I have an account</Link>
//         </div>
//       </section>

//       <section style={styles.features}>
//         <Feature title="🎤 Speak & Practice" desc="Real-time pronunciation practice" />
//         <Feature title="🤖 AI Feedback" desc="Powered by Gemini AI" />
//         <Feature title="📊 Progress Tracking" desc="See your improvement over time" />
//       </section>

//       <footer style={styles.footer}>
//         © {new Date().getFullYear()} LexiEase. All rights reserved.
//       </footer>
//     </div>
//   );
// }

// function Feature({ title, desc }) {
//   return (
//     <div style={styles.featureCard}>
//       <h3>{title}</h3>
//       <p>{desc}</p>
//     </div>
//   );
// }

// const styles = {
//   container: {
//     minHeight: "100vh",
//     background: "linear-gradient(135deg, #eef2ff, #f9fafb)",
//     display: "flex",
//     flexDirection: "column"
//   },
//   nav: {
//     display: "flex",
//     justifyContent: "space-between",
//     padding: "20px 40px",
//     alignItems: "center"
//   },
//   logo: {
//     fontSize: "24px",
//     fontWeight: "bold",
//     color: "#4f46e5"
//   },
//   link: {
//     marginRight: "20px",
//     textDecoration: "none",
//     color: "#374151",
//     fontWeight: 500
//   },
//   signup: {
//     textDecoration: "none",
//     background: "#4f46e5",
//     color: "white",
//     padding: "8px 16px",
//     borderRadius: "6px"
//   },
//   hero: {
//     textAlign: "center",
//     padding: "80px 20px"
//   },
//   title: {
//     fontSize: "48px",
//     fontWeight: "800"
//   },
//   subtitle: {
//     fontSize: "18px",
//     color: "#6b7280",
//     marginTop: "15px"
//   },
//   cta: {
//     marginTop: "30px",
//     display: "flex",
//     justifyContent: "center",
//     gap: "15px"
//   },
//   primaryBtn: {
//     background: "#6366f1",
//     color: "white",
//     padding: "14px 28px",
//     borderRadius: "8px",
//     textDecoration: "none",
//     fontWeight: "600"
//   },
//   secondaryBtn: {
//     border: "2px solid #6366f1",
//     color: "#6366f1",
//     padding: "14px 28px",
//     borderRadius: "8px",
//     textDecoration: "none",
//     fontWeight: "600"
//   },
//   features: {
//     display: "grid",
//     gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
//     gap: "20px",
//     padding: "40px"
//   },
//   featureCard: {
//     background: "white",
//     padding: "25px",
//     borderRadius: "12px",
//     textAlign: "center",
//     boxShadow: "0 10px 20px rgba(0,0,0,0.05)"
//   },
//   footer: {
//     textAlign: "center",
//     padding: "20px",
//     color: "#6b7280",
//     marginTop: "auto"
//   }
// };

import { Link } from "react-router-dom";

export default function Landing() {
  return (
    <div style={styles.container}>
      {/* Navigation */}
     

      {/* Hero */}
      <section style={styles.hero}>
        <h1 style={styles.title}>
          Building Reading Fluency Through{" "}
          <span style={styles.highlight}>Science & Care</span>
        </h1>
        <p style={styles.subtitle}>
          LexCura supports rapid naming, reading speed, and confident speech
          using evidence-based fluency practice.
        </p>
      </section>

      {/* Images */}
      <div style={styles.imageRow}>
        <div style={styles.imageCard}>
          <div style={styles.imagePlaceholder}>📚</div>
        </div>
        <div style={styles.imageCard}>
          <div style={styles.imagePlaceholder}>🎯</div>
        </div>
        <div style={styles.imageCard}>
          <div style={styles.imagePlaceholder}>📈</div>
        </div>
      </div>

      {/* About */}
      <section style={styles.about}>
        <h2 style={styles.aboutHeading}>About LexCura</h2>
        <p style={styles.aboutText}>
          LexCura is designed for learners who experience slow reading,
          difficulty with rapid naming, or reduced reading confidence. The focus
          is on automaticity, consistency, and fluency — measured through
          meaningful data, not forced perfection.
        </p>
      </section>

      {/* Features */}
      <section style={styles.features}>
        <Feature
          title="Evidence-Based"
          desc="Built on proven research in reading fluency and rapid naming interventions"
        />
        <Feature
          title="Progress Tracking"
          desc="Meaningful metrics that capture growth in speed, accuracy, and confidence"
        />
        <Feature
          title="Adaptive Practice"
          desc="Personalized exercises that meet learners where they are"
        />
        <Feature
          title="Safe Environment"
          desc="Focus on improvement without pressure or judgment"
        />
      </section>

      {/* Footer */}
      <footer style={styles.footer}>
        <p>© {new Date().getFullYear()} LexCura. All rights reserved.</p>
      </footer>
    </div>
  );
}

function Feature({ title, desc }) {
  return (
    <div style={styles.featureCard}>
      <h3 style={styles.featureTitle}>{title}</h3>
      <p style={styles.featureDesc}>{desc}</p>
    </div>
  );
}

/* ========================= Professional Styles ========================= */
const styles = {
  container: {
    minHeight: "100vh",
    background: "linear-gradient(to bottom, #f8fafc 0%, #ffffff 100%)",
    display: "flex",
    flexDirection: "column",
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", sans-serif',
  },
  
  hero: {
    textAlign: "center",
    padding: "80px 24px 48px",
    maxWidth: "900px",
    margin: "0 auto",
  },
  title: {
    fontSize: "48px",
    fontWeight: 800,
    lineHeight: 1.15,
    color: "#0f172a",
    marginBottom: "20px",
    letterSpacing: "-1px",
  },
  highlight: {
    background: "linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    backgroundClip: "text",
  },
  subtitle: {
    fontSize: "19px",
    color: "#64748b",
    maxWidth: "700px",
    margin: "0 auto",
    lineHeight: 1.7,
    fontWeight: 400,
  },
  imageRow: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: "24px",
    padding: "40px 48px",
    maxWidth: "1100px",
    margin: "0 auto",
  },
  imageCard: {
    background: "white",
    borderRadius: "16px",
    overflow: "hidden",
    boxShadow: "0 4px 6px rgba(0, 0, 0, 0.05), 0 2px 4px rgba(0, 0, 0, 0.03)",
    transition: "all 0.3s ease",
    border: "1px solid #e2e8f0",
  },
  imagePlaceholder: {
    width: "100%",
    height: "200px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "64px",
    background: "linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)",
  },
  about: {
    padding: "60px 24px",
    textAlign: "center",
    maxWidth: "800px",
    margin: "0 auto",
  },
  aboutHeading: {
    fontSize: "32px",
    fontWeight: 700,
    marginBottom: "20px",
    color: "#0f172a",
    letterSpacing: "-0.5px",
  },
  aboutText: {
    fontSize: "17px",
    lineHeight: 1.8,
    color: "#475569",
    fontWeight: 400,
  },
  features: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: "28px",
    padding: "40px 48px 80px",
    maxWidth: "1100px",
    margin: "0 auto",
  },
  featureCard: {
    background: "white",
    padding: "32px 28px",
    borderRadius: "12px",
    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.04)",
    border: "1px solid #e2e8f0",
    textAlign: "center",
    transition: "all 0.3s ease",
  },
  featureTitle: {
    fontSize: "18px",
    fontWeight: 600,
    marginBottom: "12px",
    color: "#0f172a",
  },
  featureDesc: {
    fontSize: "15px",
    lineHeight: 1.7,
    color: "#64748b",
    fontWeight: 400,
  },
  footer: {
    textAlign: "center",
    padding: "32px 24px",
    color: "#94a3b8",
    fontSize: "14px",
    marginTop: "auto",
    borderTop: "1px solid #e2e8f0",
    background: "#fafafa",
  },
};