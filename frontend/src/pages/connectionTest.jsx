// Add this as a temporary route in your App.jsx to test the connection

import { useState } from "react";

export default function ConnectionTest() {
  const [directTest, setDirectTest] = useState("Testing...");
  const [proxyTest, setProxyTest] = useState("Testing...");
  const [authTest, setAuthTest] = useState("Testing...");

  const runTests = () => {
    // Test 1: Direct backend call
    fetch("http://localhost:5001/api/test")
      .then((r) => r.json())
      .then((data) => setDirectTest(`✅ SUCCESS: ${JSON.stringify(data)}`))
      .catch((err) => setDirectTest(`❌ FAILED: ${err.message}`));

    // Test 2: Through proxy
    fetch("/api/test")
      .then((r) => r.json())
      .then((data) => setProxyTest(`✅ SUCCESS: ${JSON.stringify(data)}`))
      .catch((err) => setProxyTest(`❌ FAILED: ${err.message}`));

    // Test 3: Auth route specifically
    fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "test@test.com", password: "test" }),
    })
      .then((r) => r.text())
      .then((text) => setAuthTest(`Response: ${text}`))
      .catch((err) => setAuthTest(`❌ FAILED: ${err.message}`));
  };

  return (
    <div style={{ padding: "40px", fontFamily: "monospace" }}>
      <h1>🔍 Connection Diagnostic Tool</h1>
      <button
        onClick={runTests}
        style={{
          padding: "12px 24px",
          background: "#1e40af",
          color: "white",
          border: "none",
          borderRadius: "8px",
          cursor: "pointer",
          fontSize: "16px",
          marginBottom: "30px",
        }}
      >
        Run Tests
      </button>

      <div style={{ marginBottom: "20px" }}>
        <h3>Test 1: Direct Backend (http://localhost:5001/api/test)</h3>
        <p style={{ background: "#f1f5f9", padding: "10px", borderRadius: "4px" }}>
          {directTest}
        </p>
      </div>

      <div style={{ marginBottom: "20px" }}>
        <h3>Test 2: Through Vite Proxy (/api/test)</h3>
        <p style={{ background: "#f1f5f9", padding: "10px", borderRadius: "4px" }}>
          {proxyTest}
        </p>
      </div>

      <div style={{ marginBottom: "20px" }}>
        <h3>Test 3: Auth Route (/api/auth/login)</h3>
        <p style={{ background: "#f1f5f9", padding: "10px", borderRadius: "4px" }}>
          {authTest}
        </p>
      </div>

      <div style={{ marginTop: "40px", background: "#fef3c7", padding: "20px", borderRadius: "8px" }}>
        <h3>📋 What the results mean:</h3>
        <ul style={{ lineHeight: "2" }}>
          <li>
            <strong>Test 1 SUCCESS:</strong> Backend is running ✅
          </li>
          <li>
            <strong>Test 1 FAILED:</strong> Backend is NOT running or not on port 5001 ❌
          </li>
          <li>
            <strong>Test 2 SUCCESS:</strong> Proxy is configured correctly ✅
          </li>
          <li>
            <strong>Test 2 FAILED:</strong> Proxy not working - frontend needs restart ❌
          </li>
          <li>
            <strong>Test 3:</strong> Shows what backend returns for auth requests
          </li>
        </ul>
      </div>

      <div style={{ marginTop: "20px", background: "#fee2e2", padding: "20px", borderRadius: "8px" }}>
        <h3>🔧 Quick Fixes:</h3>
        <ol style={{ lineHeight: "2" }}>
          <li>
            <strong>If Test 1 fails:</strong> Start backend with <code>node server.js</code>
          </li>
          <li>
            <strong>If Test 2 fails but Test 1 works:</strong>
            <br />
            1. Check vite.config.js has proxy config
            <br />
            2. Stop frontend (Ctrl+C) and run <code>npm run dev</code> again
          </li>
          <li>
            <strong>If Test 3 shows 404:</strong> Check backend authRoutes.js is set up correctly
          </li>
        </ol>
      </div>
    </div>
  );
}