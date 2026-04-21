import React, { useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid, ContactShadows, Bounds } from '@react-three/drei';
import CADModel from './CADModel';
import Sketcher from './Sketcher';
import { useStore } from '../store';
import * as THREE from 'three';

export default function ModelViewer() {
  const models = useStore(state => state.models);
  const clearSelection = useStore(state => state.clearSelection);
  const appMode = useStore(state => state.appMode);
  const setSketchPlane = useStore(state => state.setSketchPlane);
  const orbitRef = useRef();

  const handlePointerDown = (e) => {
      // If we are selecting a plane
      if(appMode === 'sketch_select_plane' && e.face) {
          e.stopPropagation();
          const targetNormal = e.face.normal.clone();
          targetNormal.transformDirection(e.object.matrixWorld);

          // Quaternion to align Z axis to the surface normal
          const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), targetNormal);
          
          setSketchPlane({ 
              position: e.point.clone(), 
              normal: targetNormal,
              quaternion: q
          });

          // Focus camera
          if (orbitRef.current) {
              orbitRef.current.target.copy(e.point);
          }
      }
  };

  return (
    <Canvas
      camera={{ position: [100, 100, 200], fov: 50, near: 0.1, far: 20000 }} // Zoomed out ~20x
      style={{ width: '100%', height: '100%', background: '#222222' }}
      onPointerMissed={(e) => {
          if(appMode === 'select') clearSelection();
      }}
      raycaster={{ params: { Line: { threshold: 1 } } }}
    >
      <ambientLight intensity={1} />
      <hemisphereLight intensity={1} color="#ffffff" groundColor="#aaaaaa" />
      <directionalLight position={[100, 100, 50]} intensity={1.5} castShadow />
      <directionalLight position={[-100, 100, -50]} intensity={0.5} />
      
      {/* XYZ Coordinate axes overlay */}
      <primitive object={new THREE.AxesHelper(1000)} />

      {/* Adjusting grid to handle mm sizing */}
      <Grid 
        infiniteGrid 
        fadeDistance={5000} 
        sectionSize={100} // Major lines every 100mm
        sectionColor={'#444444'} 
        cellSize={10}     // Minor lines every 10mm
        cellColor={'#333333'} 
        position={[0, -0.01, 0]} 
      />
      <ContactShadows resolution={1024} scale={500} blur={2} opacity={0.5} far={100} color="#000000" />
      <Sketcher />

      {/* Handle pointer interactions on all objects if sketch selecting */}
      <group onPointerDown={appMode === 'sketch_select_plane' ? handlePointerDown : null}>
          {models.map(model => (
              <React.Suspense fallback={null} key={model.id}>
                 <CADModel model={model} />
              </React.Suspense>
          ))}
      </group>

      <OrbitControls ref={orbitRef} makeDefault minPolarAngle={0} maxPolarAngle={Math.PI / 1.5} />
    </Canvas>
  );
}
