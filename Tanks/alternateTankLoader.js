(function () {
    const ALT_TANK_URL = 'assets/alternate_tank.glb';
    let template = null;
    let loadPromise = null;

    function markShadows(root) {
        root.traverse(node => {
            if (node.isMesh) {
                node.castShadow = true;
                node.receiveShadow = true;
                if (node.material) {
                    node.material.metalness = Math.min(0.6, node.material.metalness ?? 0.2);
                    node.material.roughness = Math.max(0.3, node.material.roughness ?? 0.6);
                }
            }
        });
    }

    function centerAndScale(root) {
        const box = new THREE.Box3().setFromObject(root);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());

        // Normalize model to roughly the same footprint as the classic tank.
        const maxSide = Math.max(size.x, size.z, 0.0001);
        const targetSide = 3.0;
        const scale = targetSide / maxSide;

        root.scale.setScalar(scale);
        root.position.sub(center.multiplyScalar(scale));

        const scaledBox = new THREE.Box3().setFromObject(root);
        const minY = scaledBox.min.y;
        root.position.y -= minY;
    }

    function load() {
        if (template) return Promise.resolve(template);
        if (loadPromise) return loadPromise;

        loadPromise = new Promise((resolve, reject) => {
            if (!THREE.GLTFLoader) {
                reject(new Error('GLTFLoader is not available.'));
                return;
            }

            const loader = new THREE.GLTFLoader();
            loader.load(
                ALT_TANK_URL,
                gltf => {
                    template = gltf.scene;
                    markShadows(template);
                    centerAndScale(template);
                    resolve(template);
                },
                undefined,
                err => reject(err)
            );
        });

        return loadPromise;
    }

    function createInstance() {
        if (!template) return null;
        const clone = template.clone(true);
        markShadows(clone);
        return clone;
    }

    window.AlternateTankLoader = {
        load,
        createInstance,
        get isLoaded() {
            return !!template;
        }
    };
})();
