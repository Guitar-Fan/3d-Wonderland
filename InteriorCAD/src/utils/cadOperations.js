import { CSG } from 'three-csg-ts';
import * as THREE from 'three';

// Utility to merge all meshes inside a grouping object into one single Mesh
// so boolean operations have a single continuous volume to work with
function getMergedMesh(object) {
    if (!object) return null;
    
    let baseMesh = null;
    object.updateMatrixWorld(true);

    // Fast path: if object is already a solid mesh
    if (object.isMesh && object.geometry) {
        return object.clone();
    }

    // Otherwise, find the first mesh to represent the bounding volume
    object.traverse((child) => {
        if (child.isMesh && !baseMesh) {
            baseMesh = child.clone();
            baseMesh.applyMatrix4(child.matrixWorld);
            baseMesh.position.set(0,0,0);
            baseMesh.rotation.set(0,0,0);
            baseMesh.scale.set(1,1,1);
            baseMesh.updateMatrixWorld();
        }
    });

    return baseMesh;
}

export const performBoolean = (meshA, meshB, operation) => {
    try {
        const solidA = getMergedMesh(meshA);
        const solidB = getMergedMesh(meshB);
        
        if (!solidA || !solidB) return null;

        solidA.updateMatrixWorld(true);
        solidB.updateMatrixWorld(true);

        const bspA = CSG.fromMesh(solidA);
        const bspB = CSG.fromMesh(solidB);
        
        let resultBsp;
        if (operation === 'subtract') resultBsp = bspA.subtract(bspB);
        else if (operation === 'union') resultBsp = bspA.union(bspB);
        else if (operation === 'intersect') resultBsp = bspA.intersect(bspB);
        
        const resultMesh = CSG.toMesh(resultBsp, solidA.matrixWorld);
        resultMesh.material = solidA.material || new THREE.MeshStandardMaterial({ color: '#cccccc' });
        
        // Center the resulting geometry relative to its origin
        resultMesh.geometry.computeBoundingBox();
        resultMesh.geometry.computeVertexNormals();

        return { geometry: resultMesh.geometry, material: resultMesh.material };
    } catch(err) {
        console.error("CSG Error", err);
        return null;
    }
}

export const createExtrusion = (shapePoints, depth) => {
    const shape = new THREE.Shape();
    if(shapePoints.length > 0) {
        shape.moveTo(shapePoints[0].x, shapePoints[0].y);
        for(let i=1; i<shapePoints.length; i++) {
           shape.lineTo(shapePoints[i].x, shapePoints[i].y);
        }
        shape.lineTo(shapePoints[0].x, shapePoints[0].y);
    }
    
    const extrudeSettings = { depth: depth, bevelEnabled: false };
    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    geometry.center();
    return geometry;
}
