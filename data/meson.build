desktop_conf = configuration_data()
desktop_conf.set('app-id', application_id)

desktop_file = i18n.merge_file(
  input: configure_file(
  	input: 'com.vixalien.sticky.desktop.in.in',
  	output: '@BASENAME@',
  	configuration: desktop_conf
  ),
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

appstream_conf = configuration_data()
appstream_conf.set('app-id', application_id)
appstream_conf.set('gettext-package', GETTEXT_PACKAGE)

appstream_file = i18n.merge_file(
  input: 'com.vixalien.sticky.appdata.xml.in',
    input: configure_file(
  	input: 'com.vixalien.sticky.appdata.xml.in.in',
  	output: '@BASENAME@',
  	configuration: appstream_conf
	),
  output: 'com.vixalien.sticky.appdata.xml',
  po_dir: '../po',
  install: true,
  install_dir: join_paths(get_option('datadir'), 'appdata')
)

appstream_util = find_program('appstream-util', required: false)
if appstream_util.found()
  test('Validate appstream file', appstream_util, args: ['validate-relax', appstream_file])
endif

gsettings_conf = configuration_data()
gsettings_conf.set('app-id', application_id)
gsettings_conf.set('gettext-package', GETTEXT_PACKAGE)

gsettings_schema = configure_file(
  input: 'com.vixalien.sticky.gschema.xml.in',
  output: 'com.vixalien.sticky.gschema.xml',
  configuration: gsettings_conf,
  install: true,
  install_dir: join_paths(get_option('datadir'), 'glib-2.0/schemas')
)

compile_schemas = find_program('glib-compile-schemas', required: false)

if compile_schemas.found()
  test('Validate schema file',
       compile_schemas,
       args: ['--strict', '--dry-run', meson.current_source_dir()])
endif

subdir('icons')

# local_schemas = configure_file(
#   copy: true,
#   input: gsettings_schema,
#   output: gsettings_schema.full_path()
# )

compile_local_schemas = custom_target(
  'compile_local_schemas',
  input: gsettings_schema,
  output: 'gschemas.compiled',
  command: [compile_schemas, meson.current_build_dir()]
)

pkgdatadir = join_paths(get_option('datadir'), meson.project_name())

subdir('stylus')

data_res = gnome.compile_resources(
  'com.vixalien.sticky.data',
  'com.vixalien.sticky.data.gresource.xml',
  dependencies: stylus,
  gresource_bundle: true,
  install: true,
  install_dir: pkgdatadir,
)
