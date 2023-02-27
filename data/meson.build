desktop_file = i18n.merge_file(
        input: 'com.vixalien.sticky.desktop.in',
       output: 'com.vixalien.sticky.desktop',
         type: 'desktop',
       po_dir: '../po',
      install: true,
  install_dir: join_paths(get_option('datadir'), 'applications')
)

desktop_utils = find_program('desktop-file-validate', required: false)
if desktop_utils.found()
  test('Validate desktop file', desktop_utils, args: [desktop_file])
endif

appstream_file = i18n.merge_file(
        input: 'com.vixalien.sticky.appdata.xml.in',
       output: 'com.vixalien.sticky.appdata.xml',
       po_dir: '../po',
      install: true,
  install_dir: join_paths(get_option('datadir'), 'appdata')
)

appstream_util = find_program('appstream-util', required: false)
if appstream_util.found()
  test('Validate appstream file', appstream_util, args: ['validate', appstream_file])
endif

gsettings_schema = 'com.vixalien.sticky.gschema.xml'

install_data(gsettings_schema,
  install_dir: join_paths(get_option('datadir'), 'glib-2.0/schemas')
)

compile_schemas = find_program('glib-compile-schemas', required: false)

if compile_schemas.found()
  test('Validate schema file',
       compile_schemas,
       args: ['--strict', '--dry-run', meson.current_source_dir()])
endif

subdir('icons')

local_schemas = configure_file(
  copy: true,
  input: gsettings_schema,
  output: gsettings_schema
)

compile_local_schemas = custom_target(
  'compile_local_schemas',
  input: local_schemas,
  output: 'gschemas.compiled',
  command: [compile_schemas, meson.current_build_dir()]
)

pkgdatadir = join_paths(get_option('datadir'), meson.project_name())

stylus_sources = [
  'style.styl',
  'style-selector.styl',
  'style-dark.styl',
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
    package_manager, package_manager_args, 'run', 'css', '--out', meson.project_build_root() / '@OUTDIR@', '--cwd', meson.current_source_dir(), '@INPUT@',
  ],
  depends: package_manager_deps,
  output: stylus_outputs,
)

data_res = gnome.compile_resources(
  'com.vixalien.sticky.data',
  'com.vixalien.sticky.data.gresource.xml',
  dependencies: stylus,
  gresource_bundle: true,
  install: true,
  install_dir: pkgdatadir,
)
