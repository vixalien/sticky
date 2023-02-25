gnome = import('gnome')

sources = [
  'application.ts',
  'card.ts',
  'main.ts',
  'notes.ts',
  'styleselector.ts',
  'view.ts',
  'window.ts',
  'util.ts'
]

outputs = []
foreach source : sources
	outputs += source.replace('.ts', '.js')
endforeach

typescript = custom_target(
  'typescript-compile',
  build_by_default: true,
  input: files(sources),
  command: [
    package_manager, package_manager_args, 'run', 'build', '--out', meson.project_build_root() / '@OUTDIR@', '--cwd', meson.current_source_dir(), '@INPUT@',
  ],
  depends: package_manager_deps,
  output: outputs,
)

src_res = gnome.compile_resources(
  'com.vixalien.sticky.src',
  'com.vixalien.sticky.src.gresource.xml',
  dependencies: typescript,
  gresource_bundle: true,
  install: true,
  install_dir: pkgdatadir,
)

bin_conf = configuration_data()
bin_conf.set('GJS', gjs_console)
bin_conf.set('PACKAGE_VERSION', meson.project_version())
bin_conf.set('PACKAGE_NAME', meson.project_name())
bin_conf.set('prefix', get_option('prefix'))
bin_conf.set('libdir', join_paths(get_option('prefix'), get_option('libdir')))
bin_conf.set('datadir', join_paths(get_option('prefix'), get_option('datadir')))
bin_conf.set('resource_path', '/com/vixalien/sticky')

app_launcher = configure_file(
  input: 'com.vixalien.sticky.in',
  output: 'com.vixalien.sticky',
  configuration: bin_conf,
  install: true,
  install_dir: get_option('bindir'),
  install_mode: 'rwxr-xr-x'
)

run_target(
  'devel',
  command: [gjs_console, '-m', app_launcher],
  depends: [src_res, data_res, compile_local_schemas]
)