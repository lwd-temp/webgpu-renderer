struct VertexOutput {
  [[builtin(position)]] Position: vec4<f32>;
  [[location(0)]] v_texcoord_0: vec2<f32>;
};

[[stage(vertex)]]
  fn main(attrs: Attrs) -> VertexOutput {
  var output: VertexOutput;

  output.Position = uniforms.u_vp * uniforms.u_world * vec4<f32>(attrs.position, 1.);
  output.v_texcoord_0 = attrs.texcoord_0;

  return output;
}
