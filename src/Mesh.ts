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

export default class Mesh extends Node {
  public className: string = 'Mesh';
  public isMesh: boolean = true;

  public sortZ: number = 0;

  protected _pipeline: GPURenderPipeline;

  constructor(
    protected _geometry: Geometry,
    protected _material: Material
  ) {
    super();

    const {device, swapChainFormat} = renderEnv;

    this._pipeline = device.createRenderPipeline({
      layout: device.createPipelineLayout({bindGroupLayouts: [
        _material.uniformLayout
      ]}),
  
      vertex: {
        module: _material.vs,
        entryPoint: "main",
        buffers: [_geometry.vertexLayout]
      },
  
      fragment: {
        module: _material.fs,
        targets: [
          {format: swapChainFormat}
        ],
        entryPoint: "main"
      },
  
      primitive: {
        topology: 'triangle-list'
      }
    });
  }

  public render(pass: GPURenderPassEncoder) {
    const {_geometry, _material} = this;

    _material.setUniform('u_world', this._worldMat);

    pass.setVertexBuffer(0, _geometry.vertexes);
    pass.setIndexBuffer(_geometry.indexes, 'uint16');
    pass.setBindGroup(0, _material.uniforms);
    pass.setPipeline(this._pipeline);
    pass.drawIndexed(_geometry.count, 1, 0, 0, 0);
  }
}
