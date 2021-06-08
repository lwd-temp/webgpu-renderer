/**
 * Effect.ts
 * 
 * @Author  : hikaridai(hikaridai@tencent.com)
 * @Date    : 2021/6/7下午1:51:11
 */
 import {createGPUBuffer, TTypedArray} from "./shared";
import renderEnv from "./renderEnv";
import RenderTexture from "./RenderTexture";
import Texture from "./Texture";
import HObject from "./HObject";

export type TUniformValue = TTypedArray | Texture | GPUSamplerDescriptor | RenderTexture;

export interface IUniformsDescriptor {
  uniforms: {
    name: string,
    type: 'number' | 'vec2' | 'vec3' | 'vec4' | 'mat2x2' | 'mat3x3' | 'mat4x4',
    format?: 'f32' | 'u32' | 'u16' | 'u8' | 'i32' | 'i16',
    size?: number,
    defaultValue: TTypedArray
  }[],
  textures: {
    name: string,
    format?: 'f32' | 'u32' | 'u16' | 'u8' | 'i32' | 'i16' | GPUTextureFormat,
    defaultValue: Texture,
    asOutput?: boolean
  }[],
  samplers: {
    name: string,
    defaultValue: GPUSamplerDescriptor
  }[]
}

export interface IConstantsDescriptor {

}

export interface IUniformBlock {
  layout: GPUBindGroupLayout;
  entries: GPUBindGroupEntry[];
  values: {
    [name: string]: {
      value: TUniformValue,
      gpuValue: GPUBuffer | GPUSampler | GPUTextureView
    }
  };
}

export interface IEffectOptionsRender {
  vs: string;
  fs: string;
  uniformDesc: IUniformsDescriptor;
  constants?: IConstantsDescriptor;
}
export interface IEffectOptionsCompute {
  cs: string;
  uniformDesc: IUniformsDescriptor;
  constants?: IConstantsDescriptor;
}
export type TEffectOptions = IEffectOptionsRender | IEffectOptionsCompute;

function isComputeOptions(value: TEffectOptions): value is IEffectOptionsCompute {
  return !!(value as IEffectOptionsCompute).cs;
}

export default class Effect extends HObject {
  public static CLASS_NAME: string = 'Effect';
  public isEffect: boolean = true;

  protected _vs: string;
  protected _fs: string;
  protected _cs: string;
  protected _uniformDesc: IUniformsDescriptor;
  protected _shaderPrefix: string;
  protected _vsShader: GPUShaderModule;
  protected _fsShader: GPUShaderModule;
  protected _csShader: GPUShaderModule;
  protected _csPipeline: GPUComputePipeline;
  protected _uniformLayoutDesc: GPUBindGroupLayoutDescriptor;
  protected _uniformLayout: GPUBindGroupLayout;
  protected _uniformBindDesc: GPUBindGroupDescriptor;
  protected _uniformsBufferDefault: Uint8Array;
  protected _uniformsInfo: {[name: string]: {
    bindingId: number,
    index: number,
    type: 'texture' | 'buffer' | 'sampler',
    byteOffset?: number,
    defaultValue?: TTypedArray | Texture | GPUSamplerDescriptor,
    defaultGpuValue?: GPUSampler | GPUTextureView
  }};

  get vs() {
    return this._vsShader;
  }

  get fs() {
    return this._fsShader;
  }

  get cs() {
    return this._csShader;
  }

  get computePipeline() {
    return this._csPipeline;
  }

  get uniformLayout() {
    return this._uniformLayout;
  }

  get uniformsInfo() {
    return this._uniformsInfo;
  }

  constructor(
    options: TEffectOptions
  ) {
    super();

    const {device} = renderEnv;
    const _uniformDesc = this._uniformDesc = options.uniformDesc;
    const visibility = (options as IEffectOptionsCompute).cs ? GPUShaderStage.COMPUTE : GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT;

    let index: number = 0;
    let bindingId: number = 0;
    this._shaderPrefix = '';
    this._uniformsInfo = {};

    const entries: GPUBindGroupLayoutEntry[] = [];
    
    if (_uniformDesc.uniforms.length) {
      this._shaderPrefix += '[[block]] struct Uniforms {\n';
      entries.push({
        binding: 0,
        visibility,
        buffer: {type: 'uniform' as GPUBufferBindingType}
      });

      let uniformsByteLength: number = 0;
      _uniformDesc.uniforms.forEach((ud) => {
        this._uniformsInfo[ud.name] = {bindingId: 0, index, type: 'buffer', byteOffset: uniformsByteLength, defaultValue: ud.defaultValue};
        uniformsByteLength += ud.defaultValue.byteLength;
        const sym = ud.type === 'number' ? `${ud.format || 'f32'}` : `${ud.type}<${ud.format || 'f32'}>`;
        if (!ud.size) {
          this._shaderPrefix += `  ${ud.name}: ${sym};\n`;
        } else {
          ud.size > 1 && (this._shaderPrefix += `  ${ud.name}: array<${sym}, ${ud.size}>;\n`);
        }
        index += 1;
      });
      this._uniformsBufferDefault = new Uint8Array(uniformsByteLength);
      this._shaderPrefix += `};\n[[binding(0), group(0)]] var<uniform> uniforms: Uniforms;\n`

      bindingId += 1;
    }

    _uniformDesc.textures.forEach((ud) => {
      entries.push({
        binding: bindingId,
        visibility,
        texture: {sampleType: 'float' as GPUTextureSampleType}
      });
      this._uniformsInfo[ud.name] = {
        bindingId, index, type: 'texture',
        defaultGpuValue: (ud.defaultValue as Texture).view
      };
      if (ud.asOutput) {
        this._shaderPrefix += `[[group(0), binding(${bindingId})]] var ${ud.name}: texture_storage_2d<${ud.format || 'rgba8unorm'}, write>;\n`
      } else {
        this._shaderPrefix += `[[group(0), binding(${bindingId})]] var ${ud.name}: texture_2d<${ud.format || 'f32'}>;\n`
      }
      bindingId += 1;
      index += 1;
    });

    _uniformDesc.samplers.forEach((ud) => {
      entries.push({
        binding: bindingId,
        visibility,
        sampler: {type: 'filtering'}
      });
      this._uniformsInfo[ud.name] = {
        bindingId, index, type: 'sampler',
        defaultGpuValue: device.createSampler(ud.defaultValue as GPUSamplerDescriptor)
      };
      this._shaderPrefix += `[[group(0), binding(${bindingId})]] var ${ud.name}: sampler;\n`
      bindingId += 1;
      index += 1;
    });
    this._shaderPrefix += '\n';

    _uniformDesc.uniforms.forEach((ud, index) => {
      this._uniformsBufferDefault.set(new Uint8Array(ud.defaultValue.buffer), this._uniformsInfo[ud.name].byteOffset);
    });

    this._uniformLayoutDesc = {entries};

    if (isComputeOptions(options)) {
      this._cs = options.cs
      this._csShader = device.createShaderModule({code: this._shaderPrefix + this._cs});
      console.log(this._shaderPrefix + this._cs)
      this._csPipeline = device.createComputePipeline({
        compute: {
          module: this._csShader,
          entryPoint: 'main'
        }
      });
      this._uniformLayout = this._csPipeline.getBindGroupLayout(0);
    } else {
      this._vs = options.vs;
      this._fs = options.fs;
      this._vsShader = device.createShaderModule({code: this._shaderPrefix + this._vs});
      this._fsShader = device.createShaderModule({code: this._shaderPrefix + this._fs});
      this._uniformLayout = device.createBindGroupLayout(this._uniformLayoutDesc);
    }
  }

  public createDefaultUniformBlock(): IUniformBlock {
    const {_uniformDesc, _uniformsInfo, _uniformsBufferDefault} = this;
    const values: IUniformBlock['values'] = {};
    const groupEntries: GPUBindGroupEntry[] = [];

    if (_uniformsBufferDefault) {
      const uniformsBuffer = createGPUBuffer(_uniformsBufferDefault, GPUBufferUsage.UNIFORM);
      groupEntries.push({
        binding: 0,
        resource: {buffer: uniformsBuffer}
      });
      _uniformDesc.uniforms.forEach((ud) => {
        values[ud.name] = {value: ud.defaultValue, gpuValue: uniformsBuffer};
      });
    }

    _uniformDesc.textures.forEach((ud) => {
      const view = _uniformsInfo[ud.name].defaultGpuValue;
      values[ud.name] = {value: ud.defaultValue, gpuValue: view};
      groupEntries.push({
        binding: _uniformsInfo[ud.name].bindingId,
        resource: view
      });
    });
    _uniformDesc.samplers.forEach((ud) => {
      const sampler = _uniformsInfo[ud.name].defaultGpuValue;
      values[ud.name] = {value: ud.defaultValue, gpuValue: sampler};
      groupEntries.push({
        binding: _uniformsInfo[ud.name].bindingId,
        resource: sampler
      });
    });

    return {entries: groupEntries, values, layout: this._uniformLayout};
  }
}
