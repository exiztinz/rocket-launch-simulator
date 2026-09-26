import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const R = 53;
const METERS = R / 6371000;
const Y = new THREE.Vector3(0, 1, 0);
const QUALITY = {
  low: { stars: 650, dpr: 1 },
  medium: { stars: 1600, dpr: 1.5 },
  high: { stars: 3000, dpr: 2 }
};
const vector = (v) => new THREE.Vector3(v.x, v.z, -v.y);
const geo = (lat, lon, radius = R) => {
  const a = THREE.MathUtils.degToRad(lat),
    b = THREE.MathUtils.degToRad(lon);
  return new THREE.Vector3(
    Math.cos(a) * Math.cos(b),
    Math.sin(a),
    -Math.cos(a) * Math.sin(b)
  ).multiplyScalar(radius);
};
const dispose = (group) =>
  group.traverse((o) => {
    o.geometry?.dispose();
    if (o.material)
      (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
  });

function earth() {
  const group = new THREE.Group();
  const loader = new THREE.TextureLoader();
  const texture = (file, color = false) => {
    const map = loader.load(new URL('../../assets/textures/earth/' + file, import.meta.url).href);
    if (color) map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 4;
    return map;
  };
  const surface = new THREE.Mesh(
    new THREE.SphereGeometry(R, 128, 96),
    new THREE.MeshStandardMaterial({
      map: texture('earth_day_preview.jpg', true),
      normalMap: texture('earth_normal_2048.jpg'),
      normalScale: new THREE.Vector2(0.12, 0.12),
      roughness: 0.82,
      emissiveMap: texture('earth_lights_2048.png', true),
      emissive: 0xffcd86,
      emissiveIntensity: 0.13
    })
  );
  group.add(surface);
  group.userData.surface = surface;
  group.userData.dayMapSource = 'earth_day_preview.jpg';
  const clouds = new THREE.Mesh(
    new THREE.SphereGeometry(R + 0.035, 96, 64),
    new THREE.MeshStandardMaterial({
      map: texture('earth_clouds_1024.png', true),
      alphaMap: texture('earth_clouds_1024.png'),
      transparent: true,
      opacity: 0.24,
      depthWrite: false,
      roughness: 1
    })
  );
  group.add(clouds);
  return group;
}

function atmosphere() {
  return new THREE.Mesh(
    new THREE.SphereGeometry(R + 0.7, 96, 64),
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      uniforms: { sun: { value: new THREE.Vector3(1, 1, 1).normalize() } },
      vertexShader: `varying vec3 n; varying vec3 p; void main() { vec4 w = modelMatrix * vec4(position, 1.0); n = normalize(mat3(modelMatrix) * normal); p = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: `uniform vec3 sun; varying vec3 n; varying vec3 p; void main() {
      vec3 view = normalize(cameraPosition - p); float facing = abs(dot(normalize(n),view));
      float rim = pow(max(0.0, 1.0-facing), 4.0) * smoothstep(0.0,0.22,facing);
      float light = 0.14 + 0.86 * smoothstep(-0.25,0.6,dot(normalize(n),sun));
      gl_FragColor = vec4(mix(vec3(0.08,0.24,0.7),vec3(0.22,0.65,1.0),rim),rim*light*0.68);
    }`
    })
  );
}

function rocketModel(vehicle) {
  const group = new THREE.Group();
  const white = new THREE.MeshStandardMaterial({
    color: 0xf0f3f6,
    roughness: 0.42,
    metalness: 0.2
  });
  const black = new THREE.MeshStandardMaterial({
    color: 0x17212c,
    roughness: 0.48,
    metalness: 0.4
  });
  const metal = new THREE.MeshStandardMaterial({
    color: 0x71808f,
    roughness: 0.3,
    metalness: 0.85
  });
  const orange = new THREE.MeshStandardMaterial({ color: 0xc17b42, roughness: 0.95 });
  const sections = [];
  const part = (geometry, material, x, y, z, parent = group) => {
    const m = new THREE.Mesh(geometry, material);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  };
  const cylinder = (radius, height, y, material, parent = group) =>
    part(new THREE.CylinderGeometry(radius, radius, height, 32), material, 0, y, 0, parent);
  if (/shuttle/i.test(vehicle)) {
    const boosters = new THREE.Group();
    group.add(boosters);
    sections.push(boosters);
    for (const x of [-0.4, 0.4]) {
      part(new THREE.CylinderGeometry(0.13, 0.13, 2.35, 24), white, x, 1.18, 0, boosters);
      part(new THREE.ConeGeometry(0.13, 0.3, 24), white, x, 2.5, 0, boosters);
      part(new THREE.CylinderGeometry(0.09, 0.15, 0.2, 20), metal, x, 0, 0, boosters);
    }
    cylinder(0.27, 2.5, 1.4, orange);
    part(new THREE.SphereGeometry(0.27, 24, 16), orange, 0, 2.65, 0);
    part(new THREE.CylinderGeometry(0.15, 0.22, 1.7, 24), white, 0, 1.3, 0.37);
    part(new THREE.ConeGeometry(0.15, 0.45, 24), white, 0, 2.36, 0.37);
    const shape = new THREE.Shape();
    shape.moveTo(-0.17, 1.6);
    shape.lineTo(-0.85, 0.4);
    shape.lineTo(0.85, 0.4);
    shape.lineTo(0.17, 1.6);
    const wing = part(
      new THREE.ExtrudeGeometry(shape, { depth: 0.045, bevelEnabled: false }),
      white,
      0,
      0,
      0.42
    );
    wing.geometry.computeVertexNormals();
    part(new THREE.BoxGeometry(0.18, 0.14, 0.035), black, 0, 2.05, 0.53);
  } else {
    const saturn = /saturn/i.test(vehicle);
    const heights = saturn ? [1.55, 1.0, 0.75] : [1.95, 0.8];
    let base = 0;
    heights.forEach((height, i) => {
      const section = new THREE.Group();
      section.userData.base = base;
      group.add(section);
      sections.push(section);
      const radius = saturn ? 0.22 - i * 0.03 : i === 0 ? 0.13 : 0.12;
      cylinder(radius, height, base + height / 2, white, section);
      cylinder(radius + 0.003, 0.13, base + height - 0.09, black, section);
      for (let j = 0; j < (saturn ? 8 : 4); j++) {
        const a = (j * Math.PI * 2) / (saturn ? 8 : 4);
        const stripe = part(
          new THREE.BoxGeometry(0.04, height * 0.27, 0.01),
          black,
          Math.sin(a) * (radius + 0.003),
          base + height * 0.72,
          Math.cos(a) * (radius + 0.003),
          section
        );
        stripe.rotation.y = a;
      }
      part(
        new THREE.CylinderGeometry(radius * 0.35, radius * 0.75, 0.16, 24, 1, true),
        metal,
        0,
        base - 0.04,
        0,
        section
      );
      base += height;
    });
    const cap = new THREE.Group();
    group.add(cap);
    part(new THREE.ConeGeometry(saturn ? 0.15 : 0.17, 0.55, 32), white, 0, base + 0.275, 0, cap);
    if (saturn) cylinder(0.018, 0.36, base + 0.7, white, cap);
  }
  group.children.forEach((child) => {
    child.userData.restY = child.position.y;
  });
  group.userData.sections = sections;
  return group;
}

export class LaunchScene {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance'
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x03070e);
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.02, 1600);
    this.cameraMode = 'follow';
    this.quality = 'medium';
    this.reducedMotion = false;
    this.simulationTimeSec = 0;
    this.currentAltitudeM = 0;
    this.currentTarget = new THREE.Vector3();
    this.earth = earth();
    this.scene.add(this.earth);
    this.atmosphere = atmosphere();
    this.scene.add(this.atmosphere);
    this.sun = new THREE.DirectionalLight(0xfff2dd, 3.1);
    this.scene.add(this.sun);
    this.scene.add(new THREE.AmbientLight(0x8eafd3, 0.38));
    this.fill = new THREE.DirectionalLight(0x9fceff, 1.3);
    this.scene.add(this.fill);
    this.rocket = rocketModel('Saturn V');
    this.rocket.scale.setScalar(0.26);
    this.scene.add(this.rocket);
    this.plume = new THREE.Group();
    this.rocket.add(this.plume);
    for (const [radius, height, color, opacity] of [
      [0.22, 2.5, 0xffa658, 0.38],
      [0.1, 1.4, 0xc3e9ff, 0.8]
    ]) {
      const geometry = new THREE.CylinderGeometry(radius * 0.3, radius, height, 32, 1, true);
      geometry.translate(0, -height / 2, 0);
      const material = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        uniforms: { color: { value: new THREE.Color(color) }, opacity: { value: opacity } },
        vertexShader: `varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
        fragmentShader: `varying vec2 vUv; uniform vec3 color; uniform float opacity; void main(){float fade=pow(vUv.y,0.65);gl_FragColor=vec4(color,opacity*fade);}`
      });
      this.plume.add(new THREE.Mesh(geometry, material));
    }
    this.plume.visible = false;
    this.engineLight = new THREE.PointLight(0xffa34b, 0, 4);
    this.plume.add(this.engineLight);
    this.pathGeometry = new THREE.BufferGeometry();
    this.pathBuffer = new Float32Array(32768 * 3);
    this.pathGeometry.setAttribute(
      'position',
      new THREE.BufferAttribute(this.pathBuffer, 3).setUsage(THREE.DynamicDrawUsage)
    );
    this.pathGeometry.setDrawRange(0, 0);
    this.pathLine = new THREE.Line(
      this.pathGeometry,
      new THREE.LineBasicMaterial({
        color: 0x6be3fb,
        transparent: true,
        opacity: 0.8,
        depthWrite: false
      })
    );
    this.pathLine.frustumCulled = false;
    this.earth.add(this.pathLine);
    this.pathCount = 0;
    this.lastPathTime = -Infinity;
    this.pad = new THREE.Group();
    const disk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.22, 0.018, 48),
      new THREE.MeshStandardMaterial({ color: 0x24394d, metalness: 0.5, roughness: 0.6 })
    );
    this.pad.add(disk);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.28, 0.012, 8, 64),
      new THREE.MeshBasicMaterial({ color: 0x69e5e7 })
    );
    ring.rotation.x = Math.PI / 2;
    this.pad.add(ring);
    this.earth.add(this.pad);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enabled = false;
    this.canvas.style.touchAction = 'pan-y';
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 1.5;
    this.controls.maxDistance = 220;
    this.controls.addEventListener('change', () => this.keepCameraAboveGround());
    this.canvas.addEventListener('webglcontextlost', (event) => {
      event.preventDefault();
      this.contextLost = true;
      canvas.dispatchEvent(
        new CustomEvent('sceneerror', { detail: 'Graphics paused. Restoring the 3D view...' })
      );
    });
    this.canvas.addEventListener('webglcontextrestored', () => {
      this.contextLost = false;
      canvas.dispatchEvent(new CustomEvent('scenerestored'));
    });
    this.setQuality('medium');
    this.setLaunchSite({ lat: 28.6084, lon: -80.6043 });
    this.resetPath();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.resize();
  }

  setPreset(preset) {
    this.rocket.remove(this.plume);
    this.scene.remove(this.rocket);
    dispose(this.rocket);
    this.rocket = rocketModel(preset.vehicle);
    this.rocket.scale.setScalar(0.26);
    this.rocket.add(this.plume);
    this.scene.add(this.rocket);
    this.setLaunchSite(preset.location);
  }

  setLaunchSite(location) {
    this.launchLatitude = location.lat ?? 0;
    this.launchLongitude = location.lon ?? 0;
    this.launchRadial = geo(this.launchLatitude, this.launchLongitude, 1);
    this.launchEast = new THREE.Vector3().crossVectors(Y, this.launchRadial).normalize();
    this.pad.position.copy(this.launchRadial).multiplyScalar(R + 0.012);
    this.pad.quaternion.setFromUnitVectors(Y, this.launchRadial);
    // Consistent illustrative daylight for every replay, independent of wall clock.
    const light = this.launchRadial
      .clone()
      .multiplyScalar(0.8)
      .addScaledVector(this.launchEast, 0.6)
      .normalize();
    this.sun.position.copy(light).multiplyScalar(250);
    this.atmosphere.material.uniforms.sun.value.copy(light);
  }

  setQuality(level) {
    this.quality = QUALITY[level] ? level : 'medium';
    const quality = QUALITY[this.quality];
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality.dpr));
    const source =
      this.quality === 'high' && this.renderer.capabilities.maxTextureSize >= 8192
        ? 'earth_day_8192.png'
        : 'earth_day_preview.jpg';
    if (source !== this.earth.userData.dayMapSource) {
      this.earth.userData.dayMapSource = source;
      const request = (this.textureRequest = (this.textureRequest || 0) + 1);
      new THREE.TextureLoader().load(
        new URL('../../assets/textures/earth/' + source, import.meta.url).href,
        (map) => {
          if (request !== this.textureRequest) {
            map.dispose();
            return;
          }
          map.colorSpace = THREE.SRGBColorSpace;
          map.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
          this.earth.userData.surface.material.map.dispose();
          this.earth.userData.surface.material.map = map;
        }
      );
    }
    if (this.stars) {
      this.scene.remove(this.stars);
      dispose(this.stars);
    }
    let seed = 41;
    const random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const positions = [],
      colors = [];
    for (let i = 0; i < quality.stars; i++) {
      const z = random() * 2 - 1,
        a = random() * Math.PI * 2,
        s = Math.sqrt(1 - z * z);
      positions.push(Math.cos(a) * s * 700, z * 700, Math.sin(a) * s * 700);
      const c = 0.55 + random() * 0.45;
      colors.push(c * 0.9, c * 0.95, c);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    this.stars = new THREE.Points(
      geometry,
      new THREE.PointsMaterial({
        size: 1.25,
        sizeAttenuation: false,
        vertexColors: true,
        transparent: true,
        opacity: 0.75,
        depthWrite: false
      })
    );
    this.scene.add(this.stars);
    this.resize();
  }
  setReducedMotion(enabled) {
    this.reducedMotion = enabled;
    this.controls.enableDamping = !enabled;
  }
  resize() {
    const w = this.canvas.clientWidth,
      h = this.canvas.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }
  setCameraMode(mode) {
    this.cameraMode = mode;
    this.controls.enabled = mode === 'free';
    this.canvas.style.touchAction = mode === 'free' ? 'none' : 'pan-y';
    if (mode === 'free') {
      this.camera.up.copy(Y);
      this.controls.target.copy(this.currentTarget);
      this.controls.update();
    } else this.updateCamera(0, true);
  }
  keepCameraAboveGround() {
    if (this.camera.position.length() < R + 0.12) this.camera.position.setLength(R + 0.12);
  }
  resetPath() {
    this.pathCount = 0;
    this.pathGeometry.setDrawRange(0, 0);
    this.lastPathTime = -Infinity;
    this.simulationTimeSec = 0;
    this.earth.rotation.y = 0;
    this.currentAltitudeM = 0;
    this.plume.visible = false;
    this.currentTarget.copy(this.launchRadial).multiplyScalar(R);
    this.rocket.position.copy(this.currentTarget);
    this.rocket.quaternion.setFromUnitVectors(Y, this.launchRadial);
    this.updateCamera(0, true);
  }
  appendSample(sample) {
    if (sample.tSec - this.lastPathTime < 0.5 || this.pathCount >= this.pathBuffer.length / 3)
      return;
    const p = vector(sample.posEcef).multiplyScalar(METERS);
    this.pathBuffer.set([p.x, p.y, p.z], this.pathCount * 3);
    this.pathCount++;
    this.lastPathTime = sample.tSec;
    this.pathGeometry.attributes.position.needsUpdate = true;
    this.pathGeometry.setDrawRange(0, this.pathCount);
  }
  updateFromSample(sample, { appendPath = false, snapCamera = false } = {}) {
    this.sample = sample;
    this.simulationTimeSec = sample.tSec;
    this.currentAltitudeM = sample.altitudeM;
    this.earth.rotation.y = sample.tSec * 7.2921159e-5;
    this.currentTarget.copy(vector(sample.posEci).multiplyScalar(METERS));
    this.rocket.position.copy(this.currentTarget);
    this.rocket.quaternion.setFromUnitVectors(Y, vector(sample.attitudeEci).normalize());
    this.plume.visible = sample.engineOn;
    const sections = this.rocket.userData.sections;
    sections.forEach((section, i) => {
      section.visible = i >= sample.stageIndex;
    });
    const base = sections[sample.stageIndex]?.userData.base ?? 0;
    this.rocket.children
      .filter((o) => o !== this.plume)
      .forEach((o) => {
        o.position.y = (o.userData.restY ?? 0) - base;
      });
    this.plume.position.y = -0.07;
    if (appendPath) this.appendSample(sample);
    if (snapCamera) this.updateCamera(0, true);
  }
  updateCamera(dt, snap = false) {
    if (this.cameraMode === 'free') {
      this.controls.update(dt);
      this.keepCameraAboveGround();
      return;
    }
    const radial = this.currentTarget.clone().normalize();
    const east = new THREE.Vector3().crossVectors(Y, radial).normalize();
    const north = new THREE.Vector3().crossVectors(radial, east).normalize();
    const aspectFit = Math.max(1, 0.85 / this.camera.aspect);
    let target = this.currentTarget.clone().addScaledVector(radial, 0.35),
      desired;
    if (this.cameraMode === 'ground') {
      const local = this.launchRadial
        .clone()
        .multiplyScalar(R + 0.35)
        .addScaledVector(this.launchEast, -2.5);
      desired = local.applyAxisAngle(Y, this.earth.rotation.y);
    } else if (this.cameraMode === 'orbit') {
      target.set(0, 0, 0);
      desired = radial
        .clone()
        .multiplyScalar(146 * aspectFit)
        .addScaledVector(east, 42);
    } else {
      const distance =
        THREE.MathUtils.lerp(
          4.2,
          7.8,
          THREE.MathUtils.clamp(this.currentAltitudeM / 250000, 0, 1)
        ) * aspectFit;
      desired = this.currentTarget
        .clone()
        .addScaledVector(east, -distance * 0.7)
        .addScaledVector(north, distance * 0.8)
        .addScaledVector(radial, distance * 0.4);
    }
    const damping = snap || this.reducedMotion ? 1 : 1 - Math.exp(-5 * dt);
    this.camera.position.lerp(desired, damping);
    this.keepCameraAboveGround();
    this.camera.up.copy(this.cameraMode === 'orbit' ? Y : radial);
    this.camera.lookAt(target);
    this.fill.position.copy(this.camera.position);
  }
  render(dt = 1 / 60) {
    if (this.contextLost) return;
    this.updateCamera(dt);
    if (this.plume.visible) {
      const pulse = this.reducedMotion ? 1 : 1 + Math.sin(this.simulationTimeSec * 31) * 0.035;
      const expansion = 1 + Math.min(1, this.currentAltitudeM / 80000) * 1.6;
      const power = Math.sqrt(this.sample?.thrustRatio ?? 1);
      this.plume.scale.set(expansion, pulse * (0.7 + power * 0.8), expansion);
      this.engineLight.intensity = 2 * power;
    }
    this.renderer.render(this.scene, this.camera);
  }
}
