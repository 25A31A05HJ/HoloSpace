import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// "half" = half the model's height at scale 1, so objects can sit on the ground.
export const SHAPES = {
  cube: { label: 'Cube', half: 0.5, geo: () => new THREE.BoxGeometry(1, 1, 1) },
  tower: { label: 'Tower', half: 1.5, geo: () => new THREE.BoxGeometry(1, 3, 1) },
  road: { label: 'Road', half: 0.05, geo: () => new THREE.BoxGeometry(4, 0.1, 1) },
  sphere: { label: 'Sphere', half: 0.6, geo: () => new THREE.SphereGeometry(0.6, 32, 20) },
  cylinder: { label: 'Cylinder', half: 0.5, geo: () => new THREE.CylinderGeometry(0.5, 0.5, 1, 32) },
  cone: { label: 'Cone', half: 0.6, geo: () => new THREE.ConeGeometry(0.6, 1.2, 32) },
  ring: { label: 'Ring', half: 0.7, geo: () => new THREE.TorusGeometry(0.5, 0.2, 16, 48) },
};

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export default function Scene3D({ objects, selectedId, onSelect, onChange }) {
  const mountRef = useRef(null);
  const [noGL, setNoGL] = useState(false);
  const three = useRef({ scene: null, meshes: new Map(), dragId: null });
  const latest = useRef({ objects, onSelect, onChange });
  latest.current = { objects, onSelect, onChange };

  /* ---- one-time setup ---- */
  useEffect(() => {
    const mount = mountRef.current;
    const meshes = new Map();

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch (_) {
      setNoGL(true); // WebGL disabled or unsupported: keep the rest of the app working
      return undefined;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.touchAction = 'none';
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 200);
    camera.position.set(7, 6, 9);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.maxPolarAngle = Math.PI / 2 - 0.03;
    controls.minDistance = 3;
    controls.maxDistance = 40;
    controls.target.set(0, 0.5, 0);

    scene.add(new THREE.HemisphereLight(0xdbe8ff, 0x0a2559, 1.0));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(6, 12, 5);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -15;
    sun.shadow.camera.right = 15;
    sun.shadow.camera.top = 15;
    sun.shadow.camera.bottom = -15;
    sun.shadow.camera.updateProjectionMatrix();
    scene.add(sun);

    const grid = new THREE.GridHelper(40, 40, 0x8fb4ff, 0x4d78d6);
    grid.material.transparent = true;
    grid.material.opacity = 0.55;
    scene.add(grid);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(40, 40),
      new THREE.ShadowMaterial({ opacity: 0.3 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0.001;
    ground.receiveShadow = true;
    scene.add(ground);

    three.current = { scene, meshes, dragId: null };

    /* ---- dragging objects across the ground ---- */
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const hit = new THREE.Vector3();
    let drag = null;
    let lastSent = 0;

    const setRay = (e) => {
      const r = renderer.domElement.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
    };

    const emit = (final) => {
      if (!drag) return;
      const o = latest.current.objects[drag.id];
      if (!o) return;
      latest.current.onChange(
        { ...o, pos: [drag.mesh.position.x, o.pos[1], drag.mesh.position.z] },
        final
      );
    };

    const onDown = (e) => {
      if (e.button !== 0) return;
      setRay(e);
      const hits = raycaster.intersectObjects([...meshes.values()], false);
      if (!hits.length) {
        latest.current.onSelect(null);
        return;
      }
      const mesh = hits[0].object;
      latest.current.onSelect(mesh.userData.id);
      plane.constant = -mesh.position.y;
      if (!raycaster.ray.intersectPlane(plane, hit)) return;
      drag = {
        id: mesh.userData.id,
        mesh,
        offset: new THREE.Vector3().subVectors(mesh.position, hit),
        moved: false,
      };
      three.current.dragId = drag.id;
      controls.enabled = false; // runs before OrbitControls sees the event (capture phase)
    };

    const onMove = (e) => {
      if (!drag) return;
      setRay(e);
      if (!raycaster.ray.intersectPlane(plane, hit)) return;
      hit.add(drag.offset);
      const x = clamp(hit.x, -19, 19);
      const z = clamp(hit.z, -19, 19);
      drag.mesh.position.x = x;
      drag.mesh.position.z = z;
      drag.mesh.userData.target.set(x, drag.mesh.position.y, z);
      drag.moved = true;
      const now = performance.now();
      if (now - lastSent > 50) {
        lastSent = now;
        emit(false);
      }
    };

    const onUp = () => {
      if (!drag) return;
      if (drag.moved) emit(true);
      drag = null;
      three.current.dragId = null;
      controls.enabled = true;
    };

    mount.addEventListener('pointerdown', onDown, true);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);

    /* ---- sizing + render loop ---- */
    const resize = () => {
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(mount);
    resize();

    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      for (const mesh of meshes.values()) {
        const u = mesh.userData;
        if (three.current.dragId !== u.id) mesh.position.lerp(u.target, 0.25);
        const s = mesh.scale.x + (u.tScale - mesh.scale.x) * 0.25;
        mesh.scale.setScalar(s);
        if (u.tRot !== undefined) mesh.rotation.y += (u.tRot - mesh.rotation.y) * 0.25;
      }
      controls.update();
      renderer.render(scene, camera);
    };
    tick();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      mount.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      controls.dispose();
      for (const mesh of meshes.values()) {
        mesh.geometry.dispose();
        mesh.material.dispose();
      }
      meshes.clear();
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
      three.current = { scene: null, meshes: new Map(), dragId: null };
    };
  }, []);

  /* ---- keep meshes in sync with the shared objects ---- */
  useEffect(() => {
    const { scene, meshes } = three.current;
    if (!scene) return;
    const ids = new Set(Object.keys(objects));

    for (const [id, mesh] of [...meshes]) {
      if (!ids.has(id)) {
        scene.remove(mesh);
        mesh.geometry.dispose();
        mesh.material.dispose();
        meshes.delete(id);
      }
    }

    for (const id of ids) {
      const o = objects[id];
      const shape = SHAPES[o.kind] || SHAPES.cube;
      let mesh = meshes.get(id);
      if (!mesh) {
        mesh = new THREE.Mesh(
          shape.geo(),
          new THREE.MeshStandardMaterial({ color: o.color, roughness: 0.4, metalness: 0.15 })
        );
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData = { id, target: new THREE.Vector3(o.pos[0], o.pos[1], o.pos[2]), tScale: o.scale };
        mesh.position.set(o.pos[0], o.pos[1], o.pos[2]);
        mesh.scale.setScalar(o.scale);
        mesh.rotation.y = o.rotY || 0;
        scene.add(mesh);
        meshes.set(id, mesh);
      }
      if (three.current.dragId !== id) mesh.userData.target.set(o.pos[0], o.pos[1], o.pos[2]);
      mesh.userData.tScale = o.scale;
      mesh.userData.tRot = o.rotY || 0;
      mesh.material.color.set(o.color);
      mesh.material.emissive.set(id === selectedId ? 0x3b6bc4 : 0x000000);
    }
  }, [objects, selectedId]);

  if (noGL) {
    return (
      <p className="empty" style={{ top: '30%' }}>
        The 3D stage needs WebGL, which is turned off or unsupported in this browser. Enable hardware acceleration or try
        another browser. The whiteboard still works.
      </p>
    );
  }
  return <div className="scene-mount" ref={mountRef} />;
}
