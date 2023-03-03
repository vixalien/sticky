project('sticky-notes',
          version: '0.1.1',
    meson_version: '>= 0.62.0',
  default_options: [ 'warning_level=2', 'werror=false', ],
)

application_id = 'com.vixalien.sticky'
GETTEXT_PACKAGE = application_id

i18n = import('i18n')
gnome = import('gnome')

gjs_dep = dependency('gjs-1.0', version: '>= 1.54.0')
gjs_console = gjs_dep.get_variable(pkgconfig: 'gjs_console')

pm_name = 'yarn'

package_manager = find_program(pm_name, '/usr/local/bin/yarn', required: true)

package_manager_args = ['--cwd', meson.project_source_root()]

yarnrc = get_option('yarnrc')

if pm_name == 'yarn' and yarnrc != ''
  # configure_file(input: 'empty_file',
  #   output: meson.current_source_dir() / '.yarnrc',
  #   capture: true,
  #   command: [
  #     '/bin/echo',
  #     'yarn-offline-mirror ' + offline_mirror
  #   ])

  # run_command(
  #   package_manager,
  #   'config',
  #   '--offline',
  #   'set',
  #   'yarn-offline-mirror',
  #   offline_mirror,
  #   env: { 'HOME': meson.current_source_dir() },
  #   check: true
  # )

  package_manager_args += [
    # note that this does not affect network requests, as it's getting them from
    # the offline mirror
    '--offline',
    '--use-yarnrc', yarnrc
  ]
endif

package_manager_deps = custom_target(
  'node-package-manager-deps',
  command: [ package_manager, 'install', package_manager_args ],
  output: ['node-package-manager-out']
)

subdir('data')
subdir('src')
subdir('po')

gnome.post_install(
     glib_compile_schemas: true,
    gtk_update_icon_cache: true,
  update_desktop_database: true,
)
