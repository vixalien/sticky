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
    package_manager, package_manager_args, 'run', 'css', '--out', meson.project_build_root() / '@OUTDIR@', '--cwd', meson.project_build_root(), '@INPUT@',
  ],
  depends: package_manager_deps,
  output: stylus_outputs,
)
