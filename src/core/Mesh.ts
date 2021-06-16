/**
 * @File   : Mesh.ts
 * @Author : dtysky (dtysky@outlook.com)
 * @Link   : dtysky.moe
 * @Date   : 2021/6/6下午7:25:05
 */
import Node from './Node';
import Geometry from './Geometry';
import Material from './Material';
import renderEnv from './renderEnv';
import RenderTexture from './RenderTexture';
import Light from './Light';

declare type Camera = import('./Camera').default;

export default class Mesh extends Node {
  public static  CLASS_NAME: string = 'Mesh';

  public static IS(value: any): value is Mesh{
    return !!(value as Mesh).isMesh;
  }

  public isMesh: boolean = true;
  public sortZ: number = 0;

  protected _pipelines: {[hash: number]: GPURenderPipeline} = {};
  protected _matVersion: number = -1;

  get geometry() {
    return this._geometry;
  }

  get material() {
    return this._material;
  }

  set material(value: Material) {
    this._material = value;
    this._pipelines = {};
  }

  constructor(
    protected _geometry: Geometry,
    protected _material: Material
  ) {
    super();
  }

  public render(
    pass: GPURenderPassEncoder,
    camera: Camera,
    rt: RenderTexture,
    lights: Light[],
  ) {
    const {_geometry, _material} = this;

    if (_material.version !== this._matVersion || !this._pipelines[rt.pipelineHash]) {
      this._createPipeline(rt);
      this._matVersion = _material.version;
    }

    camera.fillUniforms(_material);
    _material.setUniform('u_world', this._worldMat);
    lights.forEach((light, index) => light.fillUniforms(index, _material));

    _geometry.vertexes.forEach((vertex, index) => {
      pass.setVertexBuffer(index, vertex);
    });
    pass.setIndexBuffer(_geometry.indexes, 'uint16');
    pass.setBindGroup(0, _material.bindingGroup);
    pass.setPipeline(this._pipelines[rt.pipelineHash]);
    pass.drawIndexed(_geometry.count, 1, 0, 0, 0);
  }

  protected _createPipeline(rt: RenderTexture) {
    const {device} = renderEnv;
    const {_geometry, _material} = this;
    
    const marcos = Object.assign({}, _geometry.marcos, _material.marcos);
    const {vs, fs} = _material.effect.getShader(marcos, _geometry.attributesDef);

    this._pipelines[rt.pipelineHash] = device.createRenderPipeline({
      layout: device.createPipelineLayout({bindGroupLayouts: [
        _material.effect.uniformLayout
      ]}),
  
      vertex: {
        module: vs,
        entryPoint: "main",
        buffers: _geometry.vertexLayouts
      },
  
      fragment: {
        module: fs,
        targets: rt.colorFormats.map(format => ({format})),
        entryPoint: "main"
      },
  
      primitive: {
        topology: 'triangle-list',
        cullMode: 'back'
      },

      depthStencil: rt.depthStencilFormat && {
        format: rt.depthStencilFormat,
        depthWriteEnabled: true,
        depthCompare: 'less-equal'
      }
    });
  }
}
