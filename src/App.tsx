/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls, Line2, LineGeometry, LineMaterial, CSS3DRenderer, CSS3DSprite } from 'three-stdlib';

// --- CONFIGURATION ---
const R1 = 290;
const R2 = 380;
const R3 = 480;

const PARTICLE_COUNT = 15;
const LINE_OPACITY_RANGE = [0.3, 0.6];
const LINE_THICKNESS = 1.8; 
const LINE_CHANGE_INTERVAL = [1.2, 3.5];
const MIN_ACTIVE_LINES = 6;

const AUTO_ROTATE_SPEED = 0.25;
const IDLE_TIME_TO_START = 2000;
const IDLE_TIME_TO_RESUME = 3000;

// Configuration radii are already defined above

const NODES_DATA = [
  { id: 'ual', text: 'UAL', size: 15, r: 0, dir: [0, 0, 0], z: 0, opacity: 0.5 }, // Core
  { id: 'publication', text: 'PUBLICATION', size: 30, r: R1, dir: [-1.00, -0.10, 0], z: 60 }, // Mid
  { id: 'digital-print', text: 'DIGITAL PRINT', size: 24, r: R2, dir: [-0.85, 0.35, 0], z: 220 }, // Front
  { id: 'printmaking', text: 'PRINTMAKING', size: 24, r: R2, dir: [0.85, 0.35, 0], z: 220 }, // Front
  { id: 'art-shop', text: 'ART SHOP', size: 17, r: R3, dir: [0.00, 1.00, 0], z: -260 }, // Back
  { id: 'print-dye', text: 'PRINT&DYE', size: 17, r: R3, dir: [1.00, -0.10, 0], z: 60 }, // Mid
  { id: 'swap-shop', text: 'SWAP SHOP', size: 17, r: R3, dir: [0.00, -1.00, 0], z: -260 }, // Back
];

const CALLOUT_DATA: Record<string, { title: string; body: string; color: string }> = {
  'digital-print': {
    color: '#209BFF',
    title: "FRONT-END RATING AND SELECTION PLANET",
    body: "The Digital Print workshop allows CSM students to output their work through inkjet, thermal wax, laser, risograph and eco UV and eco solvent printers."
  },
  'printmaking': {
    color: '#FFDE34',
    title: "PRACTICE-EMBEDDED REUSE PLANET",
    body: "The Printmaking facility is based around four core areas of traditional printmaking techniques: silkscreen, lithography, etching and relief printing."
  },
  'publication': {
    color: '#EC4899',
    title: "CURATED REDISTRIBUTION PLANET",
    body: "The Publications workshop offers digital print production facilities and a bindery workshop to help CSM students to produce book projects and short-run publications (multiple copies). Facilities include a Xerox printing press, riso printer, folding machine, paper drill, electric guillotine, large format trimmer and round corner puncher."
  },
  'print-dye': {
    color: '#FE9F00',
    title: "HIGH-THROUGHPUT UTILITY PLANET",
    body: "The Heat Press, Print and Dye workshops focus on developing fabric designs, through colour, pattern and texture, using screen print, heat transfer (both traditional and digital) and dyeing (including yarn dyeing)."
  },
  'art-shop': {
    color: '#FF494C',
    title: "RETAIL ENTRY ISLAND PLANET",
    body: "The University of the Arts London has 7 arts shops across all Colleges, offering art, fashion and other specialist tools and materials.\n\nThe arts shops are run by UAL, staffed by artists and are not for profit. We're not subsidised by the university and are financially self sufficient. This means that the products sold in the arts shops cover our retail staff salaries."
  },
  'swap-shop': {
    color: '#A856F7',
    title: "RESIDUAL HUB / REDISTRIBUTION SINK PLANET",
    body: "Swap Shop is the centre of sustainable material learning and exchange at Central Saint Martins, turning waste into creative opportunity."
  }
};

export default function App() {
  const webglContainerRef = useRef<HTMLDivElement>(null);
  const css3dContainerRef = useRef<HTMLDivElement>(null);
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  
  // Callout State
  const [callout, setCallout] = React.useState<{ 
    visible: boolean; 
    x: number; 
    y: number; 
    side: 'left' | 'right';
    title: string;
    body: string;
    color: string;
    nodeId: string | null;
  }>({
    visible: false,
    x: 0,
    y: 0,
    side: 'right',
    title: '',
    body: '',
    color: '',
    nodeId: null
  });

  const isHoveringLabelRef = useRef(false);
  const activeNodeIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!webglContainerRef.current || !css3dContainerRef.current) return;

    // --- SCENE & CAMERA ---
    const scene = new THREE.Scene();
    const cssScene = new THREE.Scene();
    const bgColor = new THREE.Color('#E8ECEF');
    scene.background = bgColor;
    
    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 4000);
    camera.position.set(0, 0, 1000);

    // --- RENDERERS ---
    if (webglContainerRef.current) webglContainerRef.current.innerHTML = '';
    if (css3dContainerRef.current) css3dContainerRef.current.innerHTML = '';

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    webglContainerRef.current.appendChild(renderer.domElement);

    const labelRenderer = new CSS3DRenderer();
    labelRenderer.setSize(window.innerWidth, window.innerHeight);
    labelRenderer.domElement.style.position = 'absolute';
    labelRenderer.domElement.style.top = '0';
    labelRenderer.domElement.style.pointerEvents = 'none';
    css3dContainerRef.current.appendChild(labelRenderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 400;
    controls.maxDistance = 2000;
    controls.target.set(0, 0, 0);
    controls.autoRotate = true;
    controls.autoRotateSpeed = AUTO_ROTATE_SPEED;
    controlsRef.current = controls;

    // --- IDLE LOGIC ---
    const resetIdleTimer = (delay: number) => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      controls.autoRotate = false;
      idleTimerRef.current = setTimeout(() => {
        if (!isHoveringLabelRef.current) {
          controls.autoRotate = true;
        }
      }, delay);
    };

    const onInteraction = () => resetIdleTimer(IDLE_TIME_TO_RESUME);
    renderer.domElement.addEventListener('pointerdown', onInteraction);
    renderer.domElement.addEventListener('wheel', onInteraction);

    // Initial delay
    idleTimerRef.current = setTimeout(() => {
      if (!isHoveringLabelRef.current) {
        controls.autoRotate = true;
      }
    }, IDLE_TIME_TO_START);

    // --- NODES PLACEMENT ---
    const nodes: { id: string, pos: THREE.Vector3, element: HTMLDivElement, object: CSS3DSprite, baseOpacity: number, radius: number }[] = [];
    
    NODES_DATA.forEach(data => {
      const pos = new THREE.Vector3(data.dir[0], data.dir[1], 0);
      if (pos.lengthSq() > 0) pos.normalize();
      pos.multiplyScalar(data.r);
      // Apply explicit Z tiers
      pos.z = (data as any).z ?? 0;
      
      const el = document.createElement('div');
      el.textContent = data.text;
      el.style.color = '#111';
      el.style.fontFamily = 'Menlo, ui-monospace, SFMono-Regular, Monaco, Consolas, "Liberation Mono", monospace';
      el.style.fontSize = `${data.size}px`;
      el.style.fontWeight = 'bold';
      el.style.whiteSpace = 'nowrap';
      el.style.userSelect = 'none';
      el.style.transition = 'opacity 0.3s ease';
      el.style.cursor = 'pointer';
      el.style.pointerEvents = 'auto'; // Enable hover
      
      el.onmouseenter = () => {
        isHoveringLabelRef.current = true;
        controls.autoRotate = false;
        const calloutData = CALLOUT_DATA[data.id];
        if (calloutData) {
          activeNodeIdRef.current = data.id;
          setCallout(prev => ({ 
            ...prev, 
            visible: true,
            nodeId: data.id,
            ...calloutData
          }));
        }
      };
      
      el.onmouseleave = () => {
        isHoveringLabelRef.current = false;
        if (activeNodeIdRef.current === data.id) {
          activeNodeIdRef.current = null;
          setCallout(prev => ({ ...prev, visible: false, nodeId: null }));
        }
        // Resume after delay if no interaction
        resetIdleTimer(IDLE_TIME_TO_RESUME);
      };

      // CSS3DSprite automatically billboards (faces camera)
      const obj = new CSS3DSprite(el);
      obj.position.copy(pos);
      cssScene.add(obj);
      
      nodes.push({
        id: data.id,
        pos,
        element: el,
        object: obj,
        baseOpacity: data.opacity ?? 1.0,
        radius: data.r
      });
    });

    // --- CURVED CONNECTIONS ---
    const curves: {
      line: Line2;
      targetOpacity: number;
      currentOpacity: number;
      state: 'invisible' | 'solid' | 'dashed';
      nextChangeTime: number;
    }[] = [];

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const start = nodes[i].pos;
        const end = nodes[j].pos;
        
        const mid = new THREE.Vector3().addVectors(start, end);
        if (mid.lengthSq() < 0.1) mid.set(0, 1, 0);
        
        const maxR = Math.max(nodes[i].radius, nodes[j].radius);
        const control = mid.clone().normalize().multiplyScalar(Math.max(maxR, 100) * 1.15);
        
        const curve = new THREE.QuadraticBezierCurve3(start, control, end);
        const points = curve.getPoints(40);
        const positions: number[] = [];
        points.forEach(p => positions.push(p.x, p.y, p.z));

        const geometry = new LineGeometry();
        geometry.setPositions(positions);

        const material = new LineMaterial({
          color: 0x222222,
          linewidth: LINE_THICKNESS,
          transparent: true,
          opacity: 0,
          dashed: false,
          dashScale: 2,
          dashSize: 10,
          gapSize: 5,
          resolution: new THREE.Vector2(window.innerWidth, window.innerHeight)
        });

        const line = new Line2(geometry, material);
        line.computeLineDistances();
        scene.add(line);

        curves.push({
          line,
          targetOpacity: 0,
          currentOpacity: 0,
          state: 'invisible',
          nextChangeTime: Date.now() + Math.random() * 2000
        });
      }
    }

    // --- DOTS ---
    const dotTexture = new THREE.CanvasTexture((() => {
      const canvas = document.createElement('canvas');
      canvas.width = 64; canvas.height = 64;
      const ctx = canvas.getContext('2d')!;
      ctx.beginPath(); ctx.arc(32, 32, 28, 0, Math.PI * 2);
      ctx.fillStyle = '#222'; ctx.fill();
      return canvas;
    })());

    const dots: THREE.Sprite[] = [];
    const dotVelocities: THREE.Vector3[] = [];

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const clusterNode = Math.random() > 0.5 ? nodes[1] : nodes[2];
      const spread = 80;
      
      const material = new THREE.SpriteMaterial({ map: dotTexture, transparent: true, opacity: 0.7 });
      const sprite = new THREE.Sprite(material);
      
      const offset = new THREE.Vector3(
        (Math.random() - 0.5) * spread,
        (Math.random() - 0.5) * spread,
        (Math.random() - 0.5) * spread
      );
      sprite.position.copy(clusterNode.pos).add(offset);
      sprite.scale.set(12, 12, 1);
      
      scene.add(sprite);
      dots.push(sprite);
      dotVelocities.push(new THREE.Vector3((Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 0.2));
    }

    // --- ANIMATION ---
    const animate = () => {
      requestAnimationFrame(animate);
      const now = Date.now();

      // Update Curves
      let activeCount = curves.filter(c => c.state !== 'invisible').length;
      curves.forEach(c => {
        if (now > c.nextChangeTime) {
          const rand = Math.random();
          if (rand < 0.3 && activeCount > MIN_ACTIVE_LINES) {
            c.state = 'invisible'; c.targetOpacity = 0; activeCount--;
          } else if (rand < 0.65) {
            c.state = 'solid'; c.targetOpacity = Math.random() * (LINE_OPACITY_RANGE[1] - LINE_OPACITY_RANGE[0]) + LINE_OPACITY_RANGE[0];
            c.line.material.dashed = false;
          } else {
            c.state = 'dashed'; c.targetOpacity = Math.random() * (LINE_OPACITY_RANGE[1] - LINE_OPACITY_RANGE[0]) + LINE_OPACITY_RANGE[0];
            c.line.material.dashed = true;
          }
          c.nextChangeTime = now + (Math.random() * (LINE_CHANGE_INTERVAL[1] - LINE_CHANGE_INTERVAL[0]) + LINE_CHANGE_INTERVAL[0]) * 1000;
        }
        c.currentOpacity += (c.targetOpacity - c.currentOpacity) * 0.05;
        c.line.material.opacity = c.currentOpacity;
        c.line.material.resolution.set(window.innerWidth, window.innerHeight);
      });

      // Update Dots
      dots.forEach((dot, i) => {
        dot.position.add(dotVelocities[i]);
        if (dot.position.distanceTo(new THREE.Vector3(0,0,0)) > R3 * 1.8) {
          dotVelocities[i].multiplyScalar(-1);
        }
      });

      // Depth Readability
      nodes.forEach(node => {
        const dot = node.pos.dot(camera.position);
        const isBack = dot < 0;
        node.element.style.opacity = isBack ? (node.baseOpacity * 0.3).toString() : node.baseOpacity.toString();
        
        // Callout Positioning for active node
        if (activeNodeIdRef.current === node.id) {
          const vector = node.pos.clone();
          vector.project(camera);
          
          const x = (vector.x * 0.5 + 0.5) * window.innerWidth;
          const y = (-(vector.y * 0.5) + 0.5) * window.innerHeight;
          const side = x < window.innerWidth * 0.5 ? 'right' : 'left';
          
          setCallout(prev => ({
            ...prev,
            x,
            y,
            side
          }));
        }
      });

      controls.update();
      renderer.render(scene, camera);
      labelRenderer.render(cssScene, camera);
    };

    animate();

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
      labelRenderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      renderer.domElement.removeEventListener('pointerdown', onInteraction);
      renderer.domElement.removeEventListener('wheel', onInteraction);
      renderer.dispose();
      webglContainerRef.current?.removeChild(renderer.domElement);
      css3dContainerRef.current?.removeChild(labelRenderer.domElement);
    };
  }, []);

  return (
    <div className="relative w-full h-screen overflow-hidden bg-[#E8ECEF] font-sans">
      <style>
        {`
          @keyframes flicker {
            0% { opacity: 0.1; transform: translateX(-2px); }
            10% { opacity: 0.8; transform: translateX(2px); }
            20% { opacity: 0.2; transform: translateX(-1px); }
            30% { opacity: 1; transform: translateX(0); }
            40% { opacity: 0.4; }
            50% { opacity: 1; }
            100% { opacity: 1; }
          }
          .callout-flicker {
            animation: flicker 0.4s ease-out forwards;
          }
        `}
      </style>

      {/* Micro-Titles */}
      <div className="absolute top-6 left-8 z-20 text-[#111] opacity-75 pointer-events-none uppercase tracking-[0.08em]" style={{ fontSize: '11px', fontFamily: 'Menlo, monospace' }}>
        UAL:CENTRAL SAINT MARTINS
      </div>
      <div className="absolute top-6 right-8 z-20 text-[#111] opacity-75 pointer-events-none uppercase tracking-[0.08em]" style={{ fontSize: '11px', fontFamily: 'Menlo, monospace' }}>
        SYSTEM COMPLEXITY INDEX // 2050 RECONSTRUCTION
      </div>

      {/* Micro-Caption */}
      <div 
        className="absolute bottom-6 left-8 z-20 text-[#111] opacity-70 cursor-pointer uppercase tracking-[0.08em]" 
        style={{ fontSize: '11px', fontFamily: 'Menlo, monospace', pointerEvents: 'auto' }}
        onMouseEnter={() => {
          setCallout({
            visible: true,
            x: 32, // left-8 is roughly 32px
            y: window.innerHeight - 40, // bottom-6 is roughly 24px
            side: 'right',
            title: "OUTSOURCED DISTRIBUTED INFRASTRUCTURE PLANET",
            body: "PaperCut is packed full of features such as encouraging duplex printing, implementing reasonable usage quotas, and full pay-for-print and print chargeback policies. When we surveyed our customers, we found that implementing just one feature, like secure print release, helped them save as much as 15%.",
            color: '#B3E55F',
            nodeId: 'general-printer'
          });
        }}
        onMouseLeave={() => {
          setCallout(prev => prev.nodeId === 'general-printer' ? { ...prev, visible: false, nodeId: null } : prev);
        }}
      >
        ● = GENERAL PRINTER
      </div>

      {/* Callout UI */}
      {callout.visible && (
        <div 
          key={callout.nodeId}
          className="callout-flicker absolute z-50 pointer-events-none"
          style={{
            bottom: callout.nodeId === 'general-printer' ? '60px' : undefined,
            top: callout.nodeId === 'general-printer' ? undefined : Math.max(20, Math.min(window.innerHeight - 220, callout.y - 60)),
            [callout.side === 'right' ? 'left' : 'right']: callout.side === 'right' ? (callout.x + 40) : (window.innerWidth - callout.x + 40),
            width: '320px',
            border: `2px solid ${callout.color}`,
            backgroundColor: '#FFFFFF',
            boxShadow: `4px 4px 0px ${callout.color}33`,
            fontFamily: 'Menlo, monospace'
          }}
        >
          <div style={{ backgroundColor: callout.color, color: '#FFF', padding: '4px 8px', fontSize: '10px', fontWeight: 'bold', letterSpacing: '0.05em' }}>
            SYSTEM DATA // {callout.nodeId === 'general-printer' ? 'INFRASTRUCTURE' : `NODE: ${callout.nodeId?.toUpperCase().replace('-', ' ')}`}
          </div>
          <div style={{ padding: '12px', color: '#111' }}>
            <div style={{ fontWeight: 'bold', fontSize: '13px', marginBottom: '8px', lineHeight: '1.2' }}>
              {callout.title}
            </div>
            <div style={{ fontSize: '11px', lineHeight: '1.5', opacity: 0.9, whiteSpace: 'pre-wrap' }}>
              {callout.body}
            </div>
          </div>
        </div>
      )}

      {/* Renderers */}
      <div ref={webglContainerRef} className="absolute inset-0 z-0" />
      <div ref={css3dContainerRef} className="absolute inset-0 z-10 pointer-events-none" />

      {/* UI Hint */}
      <div className="absolute bottom-6 right-8 z-20 text-[#111] opacity-30 pointer-events-none uppercase tracking-widest" style={{ fontSize: '10px', fontFamily: 'Menlo, monospace' }}>
        [ ORBIT: DRAG ] [ ZOOM: SCROLL ] [ STATUS: ACTIVE ]
      </div>
    </div>
  );
}
