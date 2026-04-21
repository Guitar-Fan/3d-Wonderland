import React, { useRef, useEffect } from 'react';
import { useStore } from '../store';
import { TransformControls } from '@react-three/drei';
import { meshRegistry } from '../utils/registry';
import { useLoader } from '@react-three/fiber';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader';
import * as THREE from 'three';

const extMap = {
  'glb': GLTFLoader,
  'gltf': GLTFLoader,
  'obj': OBJLoader,
  'stl': STLLoader
};

function ImportedContent({ url, fileType }) {
  const ext = fileType.replace('.', '').toLowerCase();
  const LoaderClass = extMap[ext] || GLTFLoader;
  const result = useLoader(LoaderClass, url);

  if (ext === 'glb' || ext === 'gltf') {
    return <primitive object={result.scene?.clone() || result} />;
  } else if (ext === 'obj') {
    return <primitive object={result} />;
  } else if (ext === 'stl') {
    return <mesh geometry={result} material={new THREE.MeshStandardMaterial({ color: '#cccccc' })} />;
  }
  return null;
}

export default function CADModel({ model }) {
  const { id, type, shape, url, fileType, color, position, rotation, scale, geometryRef } = model;
  
  const objectRef = useRef();
  const isSelected = useStore(state => state.selectedIds.includes(id));
  const transformMode = useStore(state => state.transformMode);
  const toggleSelection = useStore(state => state.toggleSelection);
  const appMode = useStore(state => state.appMode);
  
  const updateModel = useStore(state => state.updateModel);

  // Register the ref locally for boolean operations to query via useStore.getState()...
  // But wait, zustand state is pure. Better register in a JS object dictionary
  useEffect(() => {
      if (objectRef.current) {
          meshRegistry[id] = objectRef.current;
      }
      return () => {
          delete meshRegistry[id];
      }
  }, [id, type]);

  const handlePointerDown = (e) => {
      // Don't intercept clicks if in sketch plane selection (ModelViewer handles it)
      if(appMode === 'sketch_select_plane') return; 

      e.stopPropagation();
      toggleSelection(id, e.shiftKey);
  }

  return (
      <group>
          {isSelected && (
              <TransformControls
                 mode={transformMode}
                 object={objectRef}
                 onMouseUp={() => {
                     updateModel(id, {
                         position: objectRef.current.position.toArray(),
                         rotation: objectRef.current.rotation.toArray(),
                         scale: objectRef.current.scale.toArray(),
                     });
                 }}
              />
          )}

          <group
             ref={objectRef}
             position={position}
             rotation={rotation}
             scale={scale}
             onPointerDown={handlePointerDown}
             onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = 'pointer'; }}
             onPointerOut={(e) => { e.stopPropagation(); document.body.style.cursor = 'auto'; }}
          >
              {type === 'primitive' && shape === 'box' && (
                 <mesh castShadow receiveShadow>
                     <boxGeometry args={[1, 1, 1]} />
                     <meshStandardMaterial color={color || '#cccccc'} emissive={isSelected ? '#222' : '#000'} />
                 </mesh>
              )}
              
              {type === 'primitive' && shape === 'cylinder' && (
                 <mesh castShadow receiveShadow>
                     <cylinderGeometry args={[0.5, 0.5, 1, 32]} />
                     <meshStandardMaterial color={color || '#cccccc'} emissive={isSelected ? '#222' : '#000'} />
                 </mesh>
              )}

              {type === 'primitive' && shape === 'sphere' && (
                 <mesh castShadow receiveShadow>
                     <sphereGeometry args={[0.6, 32, 32]} />
                     <meshStandardMaterial color={color || '#cccccc'} emissive={isSelected ? '#222' : '#000'} />
                 </mesh>
              )}

              {type === 'imported' && (
                 <React.Suspense fallback={<mesh><boxGeometry/><meshBasicMaterial wireframe color="red"/></mesh>}>
                     <group visible={!isSelected}><ImportedContent url={url} fileType={fileType} /></group>
                     {/* Outline / selected state logic could go here */}
                     {isSelected && <group><ImportedContent url={url} fileType={fileType} /></group>}
                 </React.Suspense>
              )}

              {type === 'csg' && geometryRef && (
                 <mesh geometry={geometryRef} castShadow receiveShadow>
                     <meshStandardMaterial color={color || '#999999'} emissive={isSelected ? '#222' : '#000'} />
                 </mesh>
              )}
          </group>
      </group>
  );
}
