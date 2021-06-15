/**
 * GlTFLoader.ts
 * 
 * @Author  :dtysky(dtysky@outlook.com)
 * @Date    : 6/9/2021, 6:24:15 PM
*/
import {buildinEffects} from "../buildin";
import Node from "../core/Node";
import Camera from "../core/Camera";
import Geometry, {IBoundingBox} from "../core/Geometry";
import Material from "../core/Material";
import Mesh from "../core/Mesh";
import Texture from "../core/Texture";
import Loader from "./Loader";
import { TUniformValue } from "../core/Effect";
import Light from "../core/Light";
import CubeTexture from "../core/CubeTexture";

export interface IGlTFLoaderOptions {

}

export interface IGlTFResource {
  rootNode: Node;
  nodes: Node[];
  meshes: (Mesh | Node)[];
  images: HTMLImageElement[];
  textures: Texture[];
  cubeTextures: CubeTexture[];
  materials: Material[];
  // samplers: GPUSamplerDescriptor[];
  cameras: Camera[];
  lights: Light[];
}

export default class GlTFLoader extends Loader<IGlTFLoaderOptions, IGlTFResource> {
  public static CLASS_NAME: string = 'GlTFLoader';
  public isGlTFLoader: boolean = true;

  private _baseUri: string;
  private _json: any;
  private _buffers: ArrayBuffer[] = [];
  private _res: IGlTFResource;
  
  public async load(src: string, options: IGlTFLoaderOptions): Promise<IGlTFResource> {
    const tmp = src.split('/');
    tmp.pop();
    this._baseUri = tmp.join('/');
    this._json = await this.request(src, 'json');
    await this._loadBuffers();

    this._res = {
      rootNode: new Node(),
      nodes: [],
      meshes: [],
      images: [],
      textures: [],
      cubeTextures: [],
      materials: [],
      // samplers: [],
      cameras: [],
      lights: []
    }

    await this._loadImages();
    await this._loadTextures();
    await this._loadCubeTextures();
    await this._loadMaterials();
    await this._loadMeshes();
    await this._loadCameras();
    await this._loadLights();
    await this._loadNodes();

    return this._res;
  }

  private async _loadBuffers() {
    const {buffers} = this._json;

    for (const {uri} of buffers) {
      this._buffers.push(await this.request(this._baseUri + '/' + uri, 'buffer'));
    }
  }

  private async _loadImages() {
    const {images: imagesSrc} = this._json;
    const {images} = this._res;

    for (const {uri} of imagesSrc) {
      images.push(await this._loadImage(this._baseUri + '/' + uri));
    }
  }

  private async _loadTextures() {
    const {textures: texturesSrc, images: imagesSrc} = this._json;
    const {images, textures} = this._res;

    for (const {source} of texturesSrc) {
      const image = images[source];

      const bitmap = await createImageBitmap(image);
      const texture = new Texture(image.naturalWidth, image.naturalHeight, bitmap);
      bitmap.close();
      
      const isRGBD: boolean = imagesSrc.extras?.type === 'HDR' && imagesSrc.extras?.format === 'RGBD';
      const isNormal: boolean = !!imagesSrc.extras?.isNormalMap;
      
      textures.push(texture);
    }
  }

  private async _loadCubeTextures() {
    const cubeTexturesSrc = this._json.extensions?.Sein_cubeTexture?.textures;
    const {images, cubeTextures} = this._res;

    if (!cubeTexturesSrc) {
      return;
    }

    for (const {images: imageIds} of cubeTexturesSrc) {
      const tasks = Promise.all<ImageBitmap>(imageIds.map((imageId: number) => {
        return createImageBitmap(images[imageId]);
      }));

      const bms = await tasks;
      const cubeTexture = new CubeTexture(bms[0].width, bms[1].width, bms);
      bms.forEach(bm => bm.close());

      cubeTextures.push(cubeTexture);
    }
  }

  private async _loadMaterials() {
    const {_buffers} = this;
    const {materials: materialsSrc} = this._json;
    const {materials, textures} = this._res;

    for (const {name, pbrMetallicRoughness, normalTexture} of materialsSrc) {
      // const effect = buildinEffects.rRTGBuffer;
      const effect = buildinEffects.rUnlit;
      const uniforms: {[key: string]: TUniformValue} = {};

      if (normalTexture) {
        uniforms['u_normalTexture'] = textures[normalTexture.index]
      }

      if (pbrMetallicRoughness) {
        const {
          baseColorTexture, metallicFactor, roughnessFactor, metallicRoughnessTexture
        } = pbrMetallicRoughness;

        if (baseColorTexture) {
          uniforms['u_baseColorTexture'] = textures[baseColorTexture.index]
        }
        if (metallicRoughnessTexture) {
          uniforms['u_metallicRoughnessTexture'] = textures[metallicRoughnessTexture.index]
        }

        uniforms['u_metallicFactor'] = metallicFactor;
        uniforms['u_metallicFactor'] = roughnessFactor;
        uniforms['u_roughnessFactor'] = roughnessFactor;
      }

      const material = new Material(effect, uniforms);
      material.name = name;
      materials.push(material);
    }
  }

  private async _loadMeshes() {
    const {meshes: meshesSrc} = this._json;
    const {meshes} = this._res;

    for (const {primitives, name} of meshesSrc) {
      if (primitives.length === 1) {
        const mesh = await this._createMesh(primitives[0]);
        mesh.name = name;
        meshes.push(mesh);
        continue;
      }

      const node = new Node();
      node.name = name;
      for (let prim of primitives) {
        node.addChild(await this._createMesh(prim));
      }

      meshes.push(node);
    }
  }

  private async _loadCameras() {
    const {cameras: camerasSrc} = this._json;
    const {cameras, cubeTextures} = this._res;

    if (!camerasSrc) {
      return;
    }

    for (const {perspective, type, name, extensions} of camerasSrc) {
      if (type !== 'perspective') {
        throw new Error('Only support perspective camera now!');
      }

      const camera = new Camera({}, {
        near: perspective.znear,
        far: perspective.zfar,
        fov: 1 / perspective.yfov
      });
      camera.name = name;

      const skybox = extensions && extensions.Sein_skybox;

      if (skybox) {
        if (skybox.type !== 'Cube') {
          throw new Error('Only support cube texture skybox now!');
        }

        const skyboxMat = new Material(buildinEffects.rSkybox, {
          u_factor: new Float32Array([skybox.factor]),
          u_color: new Float32Array(skybox.color),
          u_cubeTexture: cubeTextures[skybox.texture.index],
          u_rotation: new Float32Array([skybox.rotation]),
          u_exposure: new Float32Array([skybox.exposure])
        });

        camera.skyboxMat = skyboxMat;
      }

      cameras.push(camera);
    }
  }

  private async _loadLights() {
    if (!this._json.extensions) {
      return;
    }

    const lightsSrc = this._json.extensions?.KHR_lights_punctual?.lights;
    const {lights} = this._res;

    if (lightsSrc) {
      for (const {name, type, intensity, color} of lightsSrc) {
        if (type !== 'directional') {
          throw new Error('Only support directional light now!');
        }
  
        const light = new Light(color.map(c => c * intensity));
        light.name = name;
  
        lights.push(light);
      }
    }
  }

  private async _loadNodes() {
    const {nodes: nodesSrc, scenes} = this._json;
    const {rootNode, nodes, meshes, cameras, lights} = this._res;

    for (const {matrix, name, extensions, mesh: meshId, camera: cameraId} of nodesSrc) {
      let node: Node;

      if (meshId !== undefined) {
        node = meshes[meshId];
      } else if (cameraId !== undefined) {
        node = cameras[cameraId];
      } else if (extensions.KHR_lights_punctual) {
        node = lights[extensions.KHR_lights_punctual.light];
      } else {
        node = new Node();
      }
      node.name = name;

      if (matrix) {
        node.worldMat = matrix;
      }

      nodes.push(node);
    }

    let index = 0;
    for (const node of nodes) {
      const {children} = nodesSrc[index];

      if (children) {
        for (const childId of children) {
          node.addChild(nodes[childId]);
        }
      }
      index += 1;
    }

    for (let nodeId of scenes[0].nodes) {
      rootNode.addChild(nodes[nodeId]);
    }
  }

  private async _createMesh(prim: {attributes: any, indices: number, material: number}): Promise<Mesh> {
    const {_buffers} = this;
    const {accessors, bufferViews} = this._json;
    const {materials} = this._res;

    const attributes: (GPUVertexAttribute & {name: string})[] = [];
    let arrayStride: number = 0;
    let id: number = 0;
    let vertexData: Uint8Array;

    let boundingBox: IBoundingBox;

    for (const attrName in prim.attributes) {
      const {bufferView, byteOffset, componentType, type, max, min} = accessors[prim.attributes[attrName]];
      const view = bufferViews[bufferView];
      const [format, byteLength] = this._convertVertexFormat(type, componentType);
      arrayStride += byteLength;
      vertexData = vertexData || new Uint8Array(_buffers[view.buffer], view.byteOffset || 0, view.byteLength);

      if (attrName === 'POSITION' && max?.length === 3 && min?.length === 3) {
        boundingBox = this._getBoundingBox(max, min);
      }

      attributes.push({
        name: attrName.toLowerCase(),
        format,
        offset: byteOffset || 0,
        shaderLocation: id
      });

      id += 1;
    }

    const idxInfo = accessors[prim.indices];
    const idxView = bufferViews[idxInfo.bufferView];
    const indexBuffer = new Uint16Array(_buffers[idxView.buffer], idxView.byteOffset, idxView.byteLength / 2);

    const geometry = new Geometry({arrayStride, attributes}, vertexData, indexBuffer, idxInfo.count, boundingBox);
    const material = materials[prim.material];

    return new Mesh(geometry, material);
  }

  private _convertVertexFormat(type: 'SCALE' | 'VEC2' | 'VEC3' | 'VEC4', componentType: GLenum): [GPUVertexFormat, number] {
    if (componentType !== 5126) {
      throw new Error('Only support componentType float!');
    }

    switch (type) {
      case 'SCALE':
        return ['float32', 4];
      case 'VEC2':
        return ['float32x2', 8];
      case 'VEC3':
        return ['float32x3', 12];
      case 'VEC4':
        return ['float32x4', 16];
    }

    throw new Error(`Not support type ${type}!`)
  }

  protected _getBoundingBox(
    max: [number, number, number],
    min: [number, number, number]
  ) {
    return {
      start: min,
      center: max.map((mx, index) => (mx + min[index]) / 2) as  [number, number, number],
      size: max.map((mx, index) => (mx - min[index])) as  [number, number, number]
    }
  }

  private async _loadImage(uri: string): Promise<HTMLImageElement> {
    const img = document.createElement('img');
    img.src = uri;
    await img.decode();

    return img;
  }
}
