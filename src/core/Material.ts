/**
 * @File   : Material.ts
 * @Author : dtysky (dtysky@outlook.com)
 * @Link   : dtysky.moe
 * @Date   : 2021/6/6下午7:26:33
 */
import HObject from "./HObject";
import Effect, { IUniformBlock, TUniformValue } from "./Effect";
import renderEnv from "./renderEnv";
import {TTypedArray} from "./shared";
import RenderTexture from "./RenderTexture";
import Texture from "./Texture";

export default class Material extends HObject {
  public static  CLASS_NAME: string = 'Material';
  public isMaterial: boolean = true;

  public isMarcoDirty: boolean = false;

  protected _isDirty: boolean = false;
  protected _uniformBlock: IUniformBlock;
  protected _bindingGroup: GPUBindGroup;
  protected _marcos: {[key: string]: number | boolean};

  get effect() {
    return this._effect;
  }

  get marcos() {
    return this._marcos;
  }


  get bindingGroup() {
    if (this._isDirty) {
      this._bindingGroup = renderEnv.device.createBindGroup({
        layout: this._uniformBlock.layout,
        entries: this._uniformBlock.entries
      });
      this._isDirty = false;
    }

    return this._bindingGroup;
  }

  constructor(
    protected _effect: Effect,
    values?: {[name: string]: TUniformValue},
    marcos?: {[key: string]: number | boolean}
  ) {
    super();

    this._uniformBlock = _effect.createDefaultUniformBlock();

    if (values) {
      Object.keys(values).forEach(name => this.setUniform(name, values[name]));
    }

    this._marcos = marcos || {};

    this._bindingGroup = renderEnv.device.createBindGroup({
      layout: this._uniformBlock.layout,
      entries: this._uniformBlock.entries
    });
  }

  public setUniform(
    name: string,
    value: TUniformValue
  ) {
    const info = this._effect.uniformsInfo[name];

    if (!info) {
      return;
    }

    const {entries} = this._uniformBlock;
    const {index, type, byteOffset} = info;
    const values = this._uniformBlock.values[name];

    if (type === 'buffer') {
      value = value as TTypedArray;
      renderEnv.device.queue.writeBuffer(
        values.gpuValue as GPUBuffer,
        byteOffset,
        value.buffer,
        value.byteOffset,
        value.byteLength
      );
    } else if (type === 'sampler') {
      console.warn('Not implemented!');
    } else if (RenderTexture.IS(value)) {
      entries[index].resource = values.gpuValue = value.colorView;
      this._isDirty = true;
    } else {
      value = value as Texture;
      entries[index].resource = values.gpuValue = value.view;
      this._isDirty = true;
      return;
    }

    values.value = value;
  }

  public getUniform(name: string): TUniformValue {
    return this._uniformBlock.values[name]?.value;
  }

  public setMarcos(marcos: {[key: string]: number | boolean}) {
    Object.assign(this._marcos, marcos);
    this.isMarcoDirty = true;
  }
}
