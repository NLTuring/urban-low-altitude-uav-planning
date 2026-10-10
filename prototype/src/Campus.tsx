import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { routes, pathFor, positionAt, visibleAt, type PlanId, type RouteId } from './domain';

interface Props {
  time: number;
  ceiling: number;
  selected: RouteId | null;
  plan: PlanId | null;
  hidden: RouteId[];
  topView: boolean;
  resetView: number;
  quality: 'standard' | 'low';
  showRisk: boolean;
  focusEvent: boolean;
  onSelect: (id: RouteId) => void;
  onEvent: () => void;
}

export default function Campus(props: Props) {
  const host = useRef<HTMLDivElement>(null);
  const labels = useRef<(HTMLButtonElement | null)[]>([]);
  const riskLabel = useRef<HTMLButtonElement>(null);
  const latest = useRef(props);
  const dirty = useRef(true);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);
  latest.current = props;
  useEffect(() => { dirty.current = true; }, [props]);
  useEffect(() => { dirty.current = true; }, [status]);

  useEffect(() => {
    const parent = host.current!;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    } catch {
      setStatus('error');
      return;
    }
    let stopped = false;
    setStatus('loading');
    parent.appendChild(renderer.domElement);
    renderer.domElement.setAttribute('aria-label', '可旋转和缩放的三维园区');
    renderer.domElement.setAttribute('role', 'img');
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.localClippingEnabled = true;

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-400, 400, 300, -300, 1, 4000);
    camera.position.set(650, 790, 880);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 20, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.10;
    controls.minZoom = 0.65;
    controls.maxZoom = 3.5;
    controls.maxPolarAngle = Math.PI / 2.12;
    controls.minPolarAngle = 0.01;
    controls.addEventListener('change', () => { dirty.current = true; });
    controls.update();

    scene.add(new THREE.HemisphereLight('#dfe8ee', '#666857', 1.65));
    const sun = new THREE.DirectionalLight('#fff0db', 2.1);
    sun.position.set(-200, 480, 190);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -450;
    sun.shadow.camera.right = 450;
    sun.shadow.camera.top = 350;
    sun.shadow.camera.bottom = -350;
    sun.shadow.camera.far = 1400;
    sun.shadow.bias = -0.00025;
    sun.shadow.normalBias = 0.2;
    scene.add(sun);

    const disposeObject = (object: THREE.Object3D) => {
      object.traverse(child => {
        const mesh = child as THREE.Mesh;
        mesh.geometry?.dispose();
        const materials = mesh.material ? (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) : [];
        for (const material of materials) material.dispose();
      });
    };
    new GLTFLoader().load('/models/campus.glb', gltf => {
      if (stopped) { disposeObject(gltf.scene); return; }
      gltf.scene.traverse(child => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
      scene.add(gltf.scene);
      dirty.current = true;
      setStatus('ready');
    }, undefined, () => { if (!stopped) setStatus('error'); });

    const clip = new THREE.Plane(new THREE.Vector3(0, -1, 0), 120);
    const flightGroup = new THREE.Group();
    scene.add(flightGroup);
    const lines: Line2[] = [];
    const drones: THREE.Mesh[] = [];
    const baselineGeometry = new LineGeometry();
    baselineGeometry.setPositions(routes[0].points.flatMap(p => p.position));
    const baselineMaterial = new LineMaterial({ color: '#879791', linewidth: 1.2, dashed: true, dashSize: 3, gapSize: 3, transparent: true, opacity: 0.32, clippingPlanes: [clip] });
    const baseline = new Line2(baselineGeometry, baselineMaterial);
    baseline.computeLineDistances();
    flightGroup.add(baseline);
    for (const route of routes) {
      const geometry = new LineGeometry();
      geometry.setPositions(route.points.flatMap(p => p.position));
      const material = new LineMaterial({ color: route.color, linewidth: 2, transparent: true, opacity: 0.85, dashed: true, dashSize: 5, gapSize: 2.5, clippingPlanes: [clip] });
      const line = new Line2(geometry, material);
      line.userData.routeId = route.id;
      line.computeLineDistances();
      flightGroup.add(line);
      lines.push(line);
      const drone = new THREE.Mesh(new THREE.OctahedronGeometry(3.4), new THREE.MeshBasicMaterial({ color: route.color }));
      flightGroup.add(drone);
      drones.push(drone);
    }
    const riskRing = new THREE.Mesh(new THREE.RingGeometry(11.5, 12.3, 64), new THREE.MeshBasicMaterial({ color: '#de8b71', transparent: true, opacity: 0.9, side: THREE.DoubleSide }));
    riskRing.rotation.x = -Math.PI / 2;
    riskRing.position.set(191, 46, -30);
    scene.add(riskRing);
    const guide = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(191, 1, -30), new THREE.Vector3(191, 46, -30)]), new THREE.LineDashedMaterial({ color: '#de8b71', dashSize: 2, gapSize: 3, transparent: true, opacity: 0.5 }));
    guide.computeLineDistances();
    scene.add(guide);

    let width = 1, height = 1;
    const resize = () => {
      width = parent.clientWidth;
      height = parent.clientHeight;
      const aspect = width / Math.max(1, height);
      const half = Math.max(280, 400 / aspect);
      camera.left = -half * aspect; camera.right = half * aspect;
      camera.top = half; camera.bottom = -half;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
      [...lines, baseline].forEach(l => l.material.resolution.set(width, height));
      dirty.current = true;
    };
    const observer = new ResizeObserver(resize);
    observer.observe(parent);
    resize();
    const raycaster = new THREE.Raycaster();
    raycaster.params.Line2 = { threshold: 6 };
    let pointerStart = { x: 0, y: 0 };
    const pointerDown = (e: PointerEvent) => { pointerStart = { x: e.clientX, y: e.clientY }; };
    const pointerUp = (e: PointerEvent) => {
      if (Math.hypot(e.clientX - pointerStart.x, e.clientY - pointerStart.y) > 5) return;
      const rect = renderer.domElement.getBoundingClientRect();
      raycaster.setFromCamera(new THREE.Vector2((e.clientX - rect.left) / rect.width * 2 - 1, -(e.clientY - rect.top) / rect.height * 2 + 1), camera);
      const hits = raycaster.intersectObjects(lines.filter(l => l.visible));
      const hit = hits.find(h => h.point.y <= latest.current.ceiling);
      if (hit) latest.current.onSelect(hit.object.userData.routeId);
    };
    renderer.domElement.addEventListener('pointerdown', pointerDown);
    renderer.domElement.addEventListener('pointerup', pointerUp);
    const contextLost = (event: Event) => { event.preventDefault(); setStatus('error'); };
    renderer.domElement.addEventListener('webglcontextlost', contextLost);

    let lastPlan: PlanId | null = null;
    let lastReset = props.resetView;
    let lastTop = false;
    let lastFocus = false;
    let lastQuality = props.quality;
    let frame = 0;
    let occupied: { left: number; top: number; right: number; bottom: number }[] = [];
    const project = (element: HTMLElement | null, point: THREE.Vector3, show: boolean) => {
      if (!element) return;
      const projected = point.clone().project(camera);
      const x = (projected.x + 1) * width / 2;
      const y = (-projected.y + 1) * height / 2;
      const w = element.offsetWidth, h = element.offsetHeight;
      const offsets = [[-w / 2, -h - 12], [16, 6], [-w - 16, 6], [-w / 2, -h - 48], [-w / 2, 32]];
      const spot = offsets.map(([dx, dy]) => ({ left: x + dx, top: y + dy, right: x + dx + w, bottom: y + dy + h })).find(box => box.left > 10 && box.right < width - 10 && box.top > 52 && box.bottom < height - 38 && !occupied.some(other => box.left < other.right + 7 && box.right > other.left - 7 && box.top < other.bottom + 7 && box.bottom > other.top - 7));
      if (spot && show && projected.z < 1) {
        element.style.transform = `translate(${spot.left}px, ${spot.top}px)`;
        element.style.visibility = 'visible';
        occupied.push(spot);
      } else element.style.visibility = 'hidden';
    };
    const draw = () => {
      if (stopped) return;
      frame = requestAnimationFrame(draw);
      const p = latest.current;
      if (lastReset !== p.resetView || lastTop !== p.topView || lastFocus !== p.focusEvent) {
        const target = p.focusEvent ? new THREE.Vector3(125, 25, -15) : new THREE.Vector3(0, 20, 0);
        controls.target.copy(target);
        if (p.topView) camera.position.copy(target).add(new THREE.Vector3(0, 1200, 0.01));
        else camera.position.copy(target).add(new THREE.Vector3(650, 770, 880));
        camera.zoom = p.focusEvent ? 1.55 : 1;
        camera.updateProjectionMatrix();
        lastReset = p.resetView; lastTop = p.topView; lastFocus = p.focusEvent;
        dirty.current = true;
      }
      controls.enableRotate = !p.topView;
      controls.update();
      if (!dirty.current) return;
      dirty.current = false;
      if (lastQuality !== p.quality) {
        renderer.setPixelRatio(p.quality === 'low' ? 1 : Math.min(devicePixelRatio, 1.5));
        renderer.shadowMap.enabled = p.quality !== 'low';
        scene.traverse(o => { if (o instanceof THREE.Mesh) { const mats = Array.isArray(o.material) ? o.material : [o.material]; mats.forEach(m => { m.needsUpdate = true; }); } });
        lastQuality = p.quality;
      }
      if (lastPlan !== p.plan) {
        lines[0].geometry.dispose();
        lines[0].geometry = new LineGeometry().setPositions(pathFor(routes[0], p.plan).flatMap(pt => pt.position));
        lines[0].computeLineDistances();
        lastPlan = p.plan;
      }
      clip.constant = p.ceiling;
      baseline.visible = p.plan === 'reroute' && !p.hidden.includes('D03');
      occupied = [{ left: 0, top: 0, right: 230, bottom: height < 420 ? 105 : 185 }, { left: width - 105, top: 0, right: width, bottom: Math.min(height - 50, 345) }];
      const showRisk = p.showRisk && p.ceiling >= 46 && !p.hidden.includes('D03') && !p.hidden.includes('E01');
      riskRing.visible = showRisk; guide.visible = showRisk;
      project(riskLabel.current, riskRing.position, showRisk);
      routes.forEach((r, i) => {
        const pos = positionAt(r, p.time, p.plan);
        const shown = !p.hidden.includes(r.id);
        lines[i].visible = shown;
        lines[i].material.opacity = p.selected && p.selected !== r.id ? 0.25 : 0.9;
        lines[i].material.linewidth = p.selected === r.id ? 3.4 : 2;
        drones[i].position.set(...pos);
        drones[i].rotation.y = p.time * 0.005;
        drones[i].visible = shown && visibleAt(pos, p.ceiling);
        project(labels.current[i], drones[i].position, drones[i].visible);
      });
      renderer.render(scene, camera);
      parent.parentElement?.parentElement?.style.setProperty('--map-scale-width', `${100 / (camera.right - camera.left) * camera.zoom * width}px`);
      parent.parentElement?.parentElement?.style.setProperty('--north-rotation', `${controls.getAzimuthalAngle() * 180 / Math.PI - 45}deg`);
    };
    draw();
    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      renderer.domElement.removeEventListener('pointerdown', pointerDown);
      renderer.domElement.removeEventListener('pointerup', pointerUp);
      renderer.domElement.removeEventListener('webglcontextlost', contextLost);
      disposeObject(scene);
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [attempt]);

  return <div className="campus" data-scene-status={status}>
    <div ref={host} className="canvas-host" />
    {status === 'loading' && <div className="scene-loading"><span className="loading-mark" /><span>正在展开园区<span className="small muted">加载本地三维模型</span></span></div>}
    {status === 'error' && <div className="scene-fallback"><img src="/images/campus-overview.png" alt="园区静态总览" /><div>三维视图暂不可用 · 当前显示静态总览 <button onClick={() => setAttempt(a => a + 1)}>重试</button></div></div>}
    {status === 'ready' && <div className="map-labels">
      {routes.map((r, i) => <button key={r.id} ref={el => { labels.current[i] = el; }} className={`map-label ${props.selected === r.id ? 'selected' : ''}`} style={{ '--route-color': r.color } as React.CSSProperties} onClick={() => props.onSelect(r.id)} aria-label={`选择航路 ${r.id}`}><i />{r.id}<span>{r.business}</span></button>)}
      <button ref={riskLabel} className="map-label risk-label" onClick={props.onEvent} aria-label="定位冲突 C-017"><span className="risk-diamond">!</span>{props.plan ? '原计划 C-017' : 'C-017'}<span>09:44:40</span></button>
    </div>}
  </div>;
}
