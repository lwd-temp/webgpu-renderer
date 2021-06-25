/**
 * @File   : effects.ts
 * @Author : dtysky (dtysky@outlook.com)
 * @Link   : dtysky.moe
 * @Date   : 2021/6/6下午8:56:49
 */
import {mat4} from 'gl-matrix';
import Effect from '../core/Effect';
import {createGPUBuffer} from '../core/shared';
import textures from './textures';

const effects: {
  rColor: Effect,
  rUnlit: Effect,
  rPBR: Effect,
  rSkybox: Effect,
  iBlit: Effect,
  rRTGBuffer: Effect,
  iRTGShow: Effect,
  cRTSS: Effect,
  cCreateSimpleBlur: (radius: number) => Effect
} = {} as any;

export default effects;

const commonMarcos = {
  USE_TEXCOORD_0: false,
  USE_NORMAL: false,
  USE_TANGENT: false,
  USE_COLOR_0: false,
  USE_TEXCOORD_1: false
};

export function init() {
  const emptyStorageBuffer = {
    value: new Float32Array(4),
    gpuValue: createGPUBuffer(new Float32Array(4), GPUBufferUsage.STORAGE)
  };

  effects.rColor = new Effect('rColor', {
    vs: require('./shaders/basic/model.vert.wgsl'),
    fs: require('./shaders/basic/color.frag.wgsl'),
    uniformDesc: {
      uniforms: [
        {
          name: 'u_color',
          type: 'vec4',
          defaultValue: new Float32Array([1, 0, 0, 1])
        }
      ]
    },
    marcos: commonMarcos
  });

  effects.rUnlit = new Effect('rUnlit', {
    vs: require('./shaders/basic/model.vert.wgsl'),
    fs: require('./shaders/basic/unlit.frag.wgsl'),
    uniformDesc: {
      uniforms: [
        {
          name: 'u_baseColorFactor',
          type: 'vec4',
          defaultValue: new Float32Array([1, 1, 1, 1])
        }
      ],
      textures: [
        {
          name: 'u_baseColorTexture',
          defaultValue: textures.white
        }
      ],
      samplers: [
        {
          name: 'u_sampler',
          defaultValue: {magFilter: 'linear', minFilter: 'linear', mipmapFilter: 'nearest'}
        }
      ]
    },
    marcos: commonMarcos
  });

  effects.rPBR = new Effect('rPBR', {
    vs: require('./shaders/basic/model.vert.wgsl'),
    fs: require('./shaders/basic/unlit.frag.wgsl'),
    uniformDesc: {
      uniforms: [
        {
          name: 'u_baseColorFactor',
          type: 'vec4',
          defaultValue: new Float32Array([1, 1, 1, 1])
        },
        {
          name: 'u_metallicFactor',
          type: 'number',
          defaultValue: new Float32Array([1])
        },
        {
          name: 'u_roughnessFactor',
          type: 'number',
          defaultValue: new Float32Array([1])
        },
        {
          name: 'u_normalTextureScale',
          type: 'number',
          defaultValue: new Float32Array([1])
        }
      ],
      textures: [
        {
          name: 'u_baseColorTexture',
          defaultValue: textures.empty
        },
        {
          name: 'u_normalTexture',
          defaultValue: textures.empty
        },
        {
          name: 'u_metallicRoughnessTexture',
          defaultValue: textures.empty
        }
      ],
      samplers: [
        {
          name: 'u_sampler',
          defaultValue: {magFilter: 'linear', minFilter: 'linear', mipmapFilter: 'nearest'}
        }
      ]
    },
    marcos: commonMarcos
  });

  effects.rSkybox = new Effect('rSkybox', {
    vs: require('./shaders/basic/skybox.vert.wgsl'),
    fs: require('./shaders/basic/skybox.frag.wgsl'),
    uniformDesc: {
      uniforms: [
        {
          name: 'u_color',
          type: 'vec4',
          defaultValue: mat4.identity(new Float32Array(4)) as Float32Array
        },
        {
          name: 'u_factor',
          type: 'number',
          defaultValue: new Float32Array(1)
        },
        {
          name: 'u_rotation',
          type: 'number',
          defaultValue: new Float32Array(1)
        },
        {
          name: 'u_exposure',
          type: 'number',
          defaultValue: new Float32Array(1)
        },
      ],
      textures: [
        {
          name: 'u_cubeTexture',
          defaultValue: textures.cubeWhite
        }
      ],
      samplers: [
        {
          name: 'u_sampler',
          defaultValue: {magFilter: 'linear', minFilter: 'linear', mipmapFilter: 'nearest'}
        }
      ]
    }
  });

  effects.rRTGBuffer = new Effect('rRTGBuffer', {
    vs: require('./shaders/ray-tracing/gbuffer.vert.wgsl'),
    fs: require('./shaders/ray-tracing/gbuffer.frag.wgsl'),
    uniformDesc: {
      uniforms: [
        // support materials up to 128
        {
          name: 'u_matId2TexturesId',
          type: 'vec4',
          format: 'i32',
          size: 128,
          defaultValue: new Int32Array(2 * 128)
        },
        {
          name: 'u_baseColorFactors',
          type: 'vec4',
          size: 128,
          defaultValue: new Float32Array(4 * 128)
        },
        {
          name: 'u_metallicRoughnessFactorNormalScales',
          type: 'vec3',
          size: 128,
          defaultValue: new Float32Array(128)
        }
      ],
      textures: [
        {
          name: 'u_baseColorTextures',
          defaultValue: textures.array1white
        },
        {
          name: 'u_normalTextures',
          defaultValue: textures.array1white
        },
        {
          name: 'u_metallicRoughnessTextures',
          defaultValue: textures.array1white
        }
      ],
      samplers: [
        {
          name: 'u_sampler',
          defaultValue: {magFilter: 'linear', minFilter: 'linear', mipmapFilter: 'nearest'}
        }
      ],
    },
    marcos: commonMarcos
  });
  

  effects.cRTSS = new Effect('cRTSS', {
    cs: require('./shaders/ray-tracing/rtss.comp.wgsl'),
    uniformDesc: {
      uniforms: [
        // support materials up to 128
        {
          name: 'u_matId2TexturesId',
          type: 'vec4',
          format: 'i32',
          size: 128,
          defaultValue: new Int32Array(2 * 128)
        },
        {
          name: 'u_baseColorFactors',
          type: 'vec4',
          size: 128,
          defaultValue: new Float32Array(4 * 128)
        },
        {
          name: 'u_metallicRoughnessFactorNormalScales',
          type: 'vec3',
          size: 128,
          defaultValue: new Float32Array(128)
        }
      ],
      storages: [
        {
          name: 'u_positions',
          type: 'vec3',
          defaultValue: emptyStorageBuffer.value,
          gpuValue: emptyStorageBuffer.gpuValue,
        },
        {
          name: 'u_normals',
          type: 'vec3',
          defaultValue: emptyStorageBuffer.value,
          gpuValue: emptyStorageBuffer.gpuValue,
        },
        {
          name: 'u_uvs',
          type: 'vec2',
          defaultValue: emptyStorageBuffer.value,
          gpuValue: emptyStorageBuffer.gpuValue,
        },
        {
          name: 'u_meshMatIndexes',
          type: 'vec2',
          format: 'u32',
          defaultValue: emptyStorageBuffer.value,
          gpuValue: emptyStorageBuffer.gpuValue,
        },
        {
          name: 'u_bvh',
          type: 'vec4',
          defaultValue: emptyStorageBuffer.value,
          gpuValue: emptyStorageBuffer.gpuValue,
        }
      ],
      textures: [
        {
          name: 'u_output',
          defaultValue: textures.empty,
          asOutput: true
        },
        {
          name: 'u_gbPositionMetal',
          defaultValue: textures.empty
        },
        {
          name: 'u_gbDiffuseRough',
          defaultValue: textures.empty
        },
        {
          name: 'u_gbNormalMeshIndex',
          defaultValue: textures.empty
        },
        {
          name: 'u_gbFaceNormalMatIndex',
          defaultValue: textures.empty
        },
        {
          name: 'u_baseColorTextures',
          defaultValue: textures.array1white
        },
        {
          name: 'u_normalTextures',
          defaultValue: textures.array1white
        },
        {
          name: 'u_metallicRoughnessTextures',
          defaultValue: textures.array1white
        }
      ],
      samplers: [
        {
          name: 'u_sampler',
          defaultValue: {magFilter: 'linear', minFilter: 'linear', mipmapFilter: 'nearest'}
        },
        {
          name: 'u_samplerGB',
          defaultValue: {magFilter: 'nearest', minFilter: 'nearest'}
        }
      ]
    },
    marcos: {BVH_DEPTH: 0}
  });

  effects.iRTGShow = new Effect('iRTGShow', {
    vs: require('./shaders/image/image.vert.wgsl'),
    fs: require('./shaders/ray-tracing/gshow.frag.wgsl'),
    uniformDesc: {
      uniforms: [],
      textures: [
        {
          name: 'u_gbPositionMetal',
          defaultValue: textures.white
        },
        {
          name: 'u_gbDiffuseRough',
          defaultValue: textures.white
        },
        {
          name: 'u_gbNormalMeshIndex',
          defaultValue: textures.white
        },
        {
          name: 'u_gbFaceNormalMatIndex',
          defaultValue: textures.white
        }
      ],
      samplers: [
        {
          name: 'u_sampler',
          defaultValue: {magFilter: 'linear', minFilter: 'linear'}
        }
      ]
    }
  });

  effects.iBlit = new Effect('iBlit', {
    vs: require('./shaders/image/image.vert.wgsl'),
    fs: require('./shaders/image/blit.frag.wgsl'),
    uniformDesc: {
      uniforms: [],
      textures: [
        {
          name: 'u_texture',
          defaultValue: textures.white
        }
      ],
      samplers: [
        {
          name: 'u_sampler',
          defaultValue: {magFilter: 'linear', minFilter: 'linear'}
        }
      ]
    }
  });

  effects.cCreateSimpleBlur = (radius: number) => {
    const realKernelSize = Math.pow((radius * 2 + 1), 2);
    const mod = realKernelSize % 4;
    const kernelSize = realKernelSize + (4 - mod);

    return new Effect('cSimpleBlur-' + radius, {
      cs: require('./shaders/compute/blur.comp.wgsl')
        .replace(/\${MARCO_RADIUS}/g, radius)
        .replace(/\${MARCO_WINDOW_SIZE}/g, radius * 2 + 1)
        .replace(/\${TILE_SIZE}/g, radius * 4 + 1),
      uniformDesc: {
        uniforms: [
          {
            name: 'u_kernel',
            type: 'vec4',
            size: kernelSize / 4,
            defaultValue: new Float32Array(kernelSize).fill(1)
          }
        ],
        textures: [
          {
            name: 'u_input',
            defaultValue: textures.white
          },
          {
            name: 'u_output',
            defaultValue: textures.white,
            asOutput: true
          }
        ],
        samplers: [
          {
            name: 'u_sampler',
            defaultValue: {magFilter: 'linear', minFilter: 'linear'}
          }
        ]
      }
    })
  };
}
