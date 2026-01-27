// page/Layout.jsx
import React from "react";
import NavBar from "../components/NavBar";

const Layout = ({ children }) => {
  return (
    <div className="h-screen flex flex-col bg-[var(--bg-primary)] text-[var(--text-primary)] overflow-hidden">
      <NavBar />

      {/* Content area scrolls normally */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {children}
      </div>
    </div>
  );
};

export default Layout;
