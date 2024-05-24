stylus_sources = [
  'style.styl',
  'style-selector.styl',
  'style-dark.styl',
  'theme-selector.styl',
]

stylus_outputs = []
foreach source : stylus_sources
	stylus_outputs += source.replace('.styl', '.css')
endforeach

stylus = custom_target(
  'stylus-compile',
  input: stylus_sources,
  build_by_default: true,
  command: [
    yarn, yarn_args, 'run', 'css', '--out', meson.project_build_root() / '@OUTDIR@', '--cwd', meson.project_build_root(), '@INPUT@',
  ],
  depends: yarn_deps,
  output: stylus_outputs,
)
