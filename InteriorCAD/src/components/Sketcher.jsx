import React, { useRef, useState } from 'react';
import { useStore } from '../store';
import { Line } from '@react-three/drei';
import * as THREE from 'three';

export default function Sketcher() {
  const sketchPlane = useStore(state => state.sketchPlane);
  const appMode = useStore(state => state.appMode);
  const sketches = useStore(state => state.sketches);
  const addSketchElement = useStore(state => state.addSketchElement);

  const [currentLine, setCurrentLine] = useState([]);
  
  if (!sketchPlane) return null;

  const handlePointerDown = (e) => {
     if(appMode !== 'sketch_line') return;
     e.stopPropagation();
     // We intersect against a large invisible plane defining our sketch grid
     if(e.point) {
        // Convert world point to local point on the sketch plane
        const localPt = e.point.clone();
        
        setCurrentLine([localPt.x, localPt.y, localPt.z]);
     }
  };

  const handlePointerMove = (e) => {
     if(appMode === 'sketch_line' && currentLine.length > 0) {
         e.stopPropagation();
         const localPt = e.point.clone();
         setCurrentLine([currentLine[0], currentLine[1], currentLine[2], localPt.x, localPt.y, localPt.z]);
     }
  };

  const handlePointerUp = (e) => {
      if(appMode === 'sketch_line' && currentLine.length === 6) {
          e.stopPropagation();
          addSketchElement({ type: 'line', points: [...currentLine] });
          setCurrentLine([]);
      }
  };

  const q = new THREE.Quaternion(sketchPlane.quaternion.x, sketchPlane.quaternion.y, sketchPlane.quaternion.z, sketchPlane.quaternion.w);

  return (
      <group 
         position={[sketchPlane.position.x, sketchPlane.position.y, sketchPlane.position.z]}
         quaternion={q}
      >
          {/* Drawing Grid */}
          <gridHelper args={[1000, 100, '#66ccff', '#aa44ff']} rotation={[Math.PI/2, 0, 0]} />
          
          <mesh 
            visible={false} 
            onPointerDown={handlePointerDown}
             onPointerMove={handlePointerMove}
             onPointerUp={handlePointerUp}
          >
              <planeGeometry args={[10000, 10000]} />
              <meshBasicMaterial side={THREE.DoubleSide} />
          </mesh>

          {/* Render committed sketches */}
          {sketches.map((s, i) => (
              <Line key={i} points={[new THREE.Vector3(s.points[0], s.points[1], s.points[2]), new THREE.Vector3(s.points[3], s.points[4], s.points[5])]} color="white" lineWidth={3} />
          ))}

          {/* Active drawing ghost */}
          {currentLine.length === 6 && (
              <Line points={[new THREE.Vector3(currentLine[0], currentLine[1], currentLine[2]), new THREE.Vector3(currentLine[3], currentLine[4], currentLine[5])]} color="yellow" lineWidth={2} />
          )}
      </group>
  );
}