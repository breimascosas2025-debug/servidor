import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login';
import FileExplorer from './components/FileExplorer';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/explorer" element={<FileExplorer />} />
        <Route path="/" element={<Navigate to="/explorer" />} />
      </Routes>
    </Router>
  );
}

export default App;
