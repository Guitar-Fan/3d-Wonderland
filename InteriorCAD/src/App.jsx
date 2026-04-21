import React from 'react';
import ModelViewer from './components/ModelViewer';
import Sidebar from './components/Sidebar';

function App() {
  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden', margin: 0, padding: 0, background: '#222' }}>
      <Sidebar />
      <div style={{ flex: 1, position: 'relative' }}>
          <ModelViewer />
      </div>
    </div>
  );
}

export default App;
