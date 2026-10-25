/**
 * Minimal Three.js virtual classroom builders (DEV).
 */
import * as THREE from 'three';
import { createBlackboard } from './blackboard-state.js';

export const CLASSROOM_VERSION = '0.1.0-dev';

export function buildClassroom(scene) {
  const root = new THREE.Group();
  root.name = 'virtual-classroom';

  // Ground
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(12, 12),
    new THREE.MeshStandardMaterial({ color: 0x2a3a2a, roughness: 0.9 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  root.add(ground);

  // Chair
  const chair = new THREE.Group();
  chair.name = 'chair';
  const seat = new THREE.Mesh(
    new THREE.BoxGeometry(0.55, 0.08, 0.55),
    new THREE.MeshStandardMaterial({ color: 0x8b5a2b })
  );
  seat.position.y = 0.45;
  const back = new THREE.Mesh(
    new THREE.BoxGeometry(0.55, 0.55, 0.08),
    new THREE.MeshStandardMaterial({ color: 0x6b4423 })
  );
  back.position.set(0, 0.75, -0.24);
  chair.add(seat, back);
  chair.position.set(-1.2, 0, 0.2);
  root.add(chair);

  // Blackboard visual
  const bbMesh = new THREE.Mesh(
    new THREE.BoxGeometry(2.4, 1.2, 0.06),
    new THREE.MeshStandardMaterial({ color: 0x1a3d1a })
  );
  bbMesh.position.set(0, 1.6, -3.5);
  bbMesh.name = 'blackboard-mesh';
  root.add(bbMesh);

  // Eraser
  const eraser = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 0.06, 0.1),
    new THREE.MeshStandardMaterial({ color: 0xdddddd })
  );
  eraser.position.set(1.1, 1.05, -3.2);
  eraser.name = 'eraser';
  root.add(eraser);

  scene.add(root);

  const blackboard = createBlackboard('AIVAULT 虛擬教室\n請擦掉這行字');

  const objects = {
    chair: { id: 'chair-1', domain: 'virtual', mesh: chair, position: chair.position.clone() },
    blackboard: {
      id: 'bb-1',
      domain: 'virtual',
      mesh: bbMesh,
      api: blackboard,
      get text() {
        return blackboard.getState().text;
      }
    },
    eraser: { id: 'eraser-1', domain: 'virtual', mesh: eraser, position: eraser.position.clone() }
  };

  return {
    version: CLASSROOM_VERSION,
    root,
    objects,
    blackboard,
    sceneDescriptor: {
      id: 'virtual-classroom-v0',
      objects: {
        chair: { id: 'chair-1', domain: 'virtual' },
        blackboard: { id: 'bb-1', domain: 'virtual' },
        eraser: { id: 'eraser-1', domain: 'virtual' }
      }
    }
  };
}
