import React, { useCallback } from 'react';
import { useStore } from '../store';
import { v4 as uuidv4 } from 'uuid';
import { meshRegistry } from '../utils/registry';
import { performBoolean, createExtrusion } from '../utils/cadOperations';
import * as THREE from 'three';

export default function Sidebar() {
  const models = useStore(state => state.models);
  const selectedIds = useStore(state => state.selectedIds);
  const addModel = useStore(state => state.addModel);
  const removeModel = useStore(state => state.removeModel);
  const clearModels = useStore(state => state.clearModels);
  const appMode = useStore(state => state.appMode);
  const setAppMode = useStore(state => state.setAppMode);
  const clearSketch = useStore(state => state.clearSketch);
  const transformMode = useStore(state => state.transformMode);
  const setTransformMode = useStore(state => state.setTransformMode);
  const clearSelection = useStore(state => state.clearSelection);

  const handleAddPrimitive = (shape) => {
    addModel({
        id: uuidv4(),
        type: 'primitive',
        shape: shape,
        color: ['#ff8800','#00ff88','#0088ff'][Math.floor(Math.random()*3)],
        position: [0, 0.5, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1]
    });
  };

  const handleBoolean = (operation) => {
     if(selectedIds.length !== 2) {
         alert("Please select exactly two objects (shift+click) for boolean operations.");
         return;
     }
     const [idA, idB] = selectedIds;
     const meshA = meshRegistry[idA];
     const meshB = meshRegistry[idB];
     
     if(!meshA || !meshB) return;
     
     const result = performBoolean(meshA, meshB, operation);
     if(result && result.geometry) {
         // Create a CSG Object
         addModel({
             id: uuidv4(),
             type: 'csg',
             geometryRef: result.geometry,
             color: '#aaaaaa',
             position: [meshA.position.x, meshA.position.y, meshA.position.z],
             rotation: [meshA.rotation.x, meshA.rotation.y, meshA.rotation.z],
             scale: [meshA.scale.x, meshA.scale.y, meshA.scale.z]
         });
         // Remove source items
         removeModel(idA);
         removeModel(idB);
         clearSelection();
     } else {
         alert("Boolean operation failed. Ensure shapes intersect or are solid volumes.");
     }
  };

  const handleExtrude = () => {
     // Extrude a quick L shape profile as demo of 2D CAD -> 3D
     const points = [
         new THREE.Vector2(0,0),
         new THREE.Vector2(2,0),
         new THREE.Vector2(2,0.5),
         new THREE.Vector2(0.5,0.5),
         new THREE.Vector2(0.5,2),
         new THREE.Vector2(0,2)
     ];
     const geom = createExtrusion(points, 0.5);
     addModel({
         id: uuidv4(),
         type: 'csg',
         geometryRef: geom,
         color: '#aa44ff',
         position: [0, 1, 0],
         rotation: [-Math.PI/2, 0, 0], // Lay flat
         scale: [1,1,1]
     });
  };

  const onFileDrop = useCallback((e) => {
    e.preventDefault();
    const files = e.dataTransfer ? e.dataTransfer.files : e.target.files;
    if (files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const extension = file.name.split('.').pop().toLowerCase();
        
        if (['glb', 'gltf', 'obj', 'stl'].includes(extension)) {
            const tempUrl = URL.createObjectURL(file);
            addModel({
                id: uuidv4(),
                type: 'imported',
                url: tempUrl,
                fileType: extension,
                name: file.name,
                position: [0, 0, 0],
                rotation: [0,0,0],
                scale: [1, 1, 1],
            });
        }
    }
  }, [addModel]);

  return (
    <div style={{
       width: '300px', height: '100%', background: '#1c1c1c', borderRight: '1px solid #333',
       color: 'white', padding: '20px', boxSizing: 'border-box', overflowY: 'auto'
    }}>
      <h2 style={{ fontSize: '20px', marginTop: 0, marginBottom: '20px' }}>CAD Tools</h2>
      
      <div style={{ marginBottom: '20px' }}>
          <h4>Transforms</h4>
          <div style={{ display: 'flex', gap: '5px' }}>
             {['translate', 'rotate', 'scale'].map(mode => (
                 <button 
                    key={mode}
                    onClick={() => setTransformMode(mode)}
                    style={{ flex: 1, padding: '5px', background: transformMode === mode ? '#aaa' : '#333', color: transformMode === mode ? '#000' : '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                     {mode.charAt(0).toUpperCase() + mode.slice(1)}
                 </button>
             ))}
          </div>
      </div>

      <div style={{ marginBottom: '20px' }}>
          <h4>Sketch & Draw</h4>
          <button 
             onClick={() => setAppMode('sketch_select_plane')} 
             style={{...btnStyle, background: appMode === 'sketch_select_plane' ? '#ffaa00' : '#333'}}
          >
             Select Plane / Surface
          </button>
          
          {appMode.startsWith('sketch') && appMode !== 'sketch_select_plane' && (
             <div style={{ padding: '10px', background: '#222', borderRadius: '4px', border: '1px solid #444', marginTop: '10px' }}>
                 <p style={{ fontSize: '12px', margin: '0 0 10px 0', color: '#ffaa00' }}>Plane Active</p>
                 <button onClick={() => setAppMode('sketch_line')} style={{...btnStyle, background: appMode === 'sketch_line' ? '#555' : '#333'}}>Line (Drag)</button>
                 {/* Circle/Rect placeholders to expand upon */}
                 <button disabled style={{...btnStyle, opacity: 0.5}}>Circle (Soon)</button>
                 <button disabled style={{...btnStyle, opacity: 0.5}}>Rectangle (Soon)</button>
                 <button onClick={clearSketch} style={{...btnStyle, background: '#aa4444', marginTop: '10px', textAlign: 'center'}}>Finish Sketch</button>
             </div>
          )}
      </div>

      <div style={{ marginBottom: '20px' }}>
          <h4>Primitives (Scale: mm)</h4>
          <button onClick={() => handleAddPrimitive('box')} style={btnStyle}>Add Box</button>
          <button onClick={() => handleAddPrimitive('cylinder')} style={btnStyle}>Add Cylinder</button>
          <button onClick={() => handleAddPrimitive('sphere')} style={btnStyle}>Add Sphere</button>
          <button onClick={handleExtrude} style={{...btnStyle, borderLeft: '3px solid #aa44ff'}}>Extrude custom 2D</button>
      </div>

      <div style={{ marginBottom: '20px' }}>
          <h4>Booleans (CSG)</h4>
          <p style={{fontSize:'12px', color:'#999'}}>Shift-click to select 2 geometries.</p>
          <button onClick={() => handleBoolean('subtract')} style={btnStyle} disabled={selectedIds.length !== 2}>Subtract (A-B)</button>
          <button onClick={() => handleBoolean('union')} style={btnStyle} disabled={selectedIds.length !== 2}>Union (A+B)</button>
          <button onClick={() => handleBoolean('intersect')} style={btnStyle} disabled={selectedIds.length !== 2}>Intersect (A&B)</button>
      </div>

      <div style={{ marginBottom: '20px' }}>
          <h4>Import 3D Asset</h4>
          <input type="file" multiple accept=".glb,.gltf,.obj,.stl" onChange={onFileDrop} style={{ fontSize: '12px', width: '100%' }} />
      </div>

      <div style={{ marginTop: '40px', borderTop: '1px solid #333', paddingTop: '20px' }}>
         <button onClick={clearModels} style={{...btnStyle, background: '#ff4444'}}>Clear Scene</button>
         <div><p style={{fontSize: '12px', color: '#999'}}>{models.length} items. {selectedIds.length} selected.</p></div>
      </div>
    </div>
  );
}

const btnStyle = {
    display: 'block', width: '100%', marginBottom: '8px', padding: '8px',
    background: '#333', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', textAlign: 'left'
};
