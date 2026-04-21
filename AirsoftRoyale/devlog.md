# Created *Airsoft Royale*

To follow the theme of my other combat games, I made a shooting game on three.js. My vision for this web-app was to create a shooting game that required agile dodges and movement through a maze of indoor walls, inspired by the recreational game of Airsoft. It is functional, but room for improvements in 3d environment.

### Tactical Environment and True Dark Mode
- Implemented a "Dark Mode" setting with true near-zero visibility utilizing three.js.
- Overhauled lighting by pushing `THREE.FogExp2` and `THREE.AmbientLight` to near pitch-black levels and drastically lowering the renderer's `toneMappingExposure`.
- Added dynamic tactical flashlights (`THREE.SpotLight`) for both the player and enemies to cut through the darkness. 
- Updated the enemy AI vision system so they no longer rely on a simple distance-based aggro radius. Instead, they can only spot and chase the player if the player crosses into their specific flashlight illumination cone.

### Combat, Building, and Melee System
- Introduced a dynamic Fortnite-style building mechanic using an in-game grid-snapping system. Players can dynamically spawn `THREE.Mesh` and `CANNON.js` physics bodies to construct walls, floors, and ramps on the fly for tactical cover.
- Added a new melee weapon category—a "Stick" with infinite ammo—alongside the standard firearms.
- Engineered a conical hit detection system for the melee weapon. By calculating dot products and distance checks, the stick registers wide-arc melee strikes rather than relying on the single-point raycasts used by the guns.
- Developed distinct weapon sway and custom procedural swing animations (using `Math.sin`/`Math.cos` offsets) specifically for the stick to differentiate its heavy, sweeping feel from standard gun recoil.

### Other Features
- Hotkey-based modular construction: Players can use specific keybinds (B, V, N, M) to instantly select and place different building pieces.
- Integrated UI toggle controls to enable or disable Dark Mode dynamically based on player preference.

### Developer Note
- *The journey of tweaking the lighting engine to achieve absolute, terrifying darkness while keeping the tactical flashlights functionally bright was challenging but rewarding. The addition of the wide-swinging stick and the building mechanics completely change the pacing of the typical indoor firefight.*